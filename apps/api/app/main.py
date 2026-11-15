"""Field Shift API — única porta de entrada do app e dos outros devs (ninguém acessa o bucket).

Públicas:      GET /health, /version, /scenarios, /scenarios/{site}, /crops, /crops/{code}
Simulações:    POST /simulations, GET /simulations/{id}
               Por enquanto ABERTAS (sem chave), com limite por IP e teto diário global.
               Para exigir chave: variável de ambiente REQUIRE_API_KEY=true no serviço.

POST /simulations dispara o Cloud Run Job fieldshift-dssat em modo "point": clima NASA POWER e
solo PronaSolos são buscados automaticamente para a coordenada; a análise de solo do agricultor
é opcional e substitui a estimativa nas camadas informadas.
"""

import json
import os
import re
import secrets
import threading
import time
import uuid
from collections import defaultdict, deque
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator, model_validator

API_VERSION = "0.3.0"
DATA_BUCKET = os.environ.get("DATA_BUCKET", "fieldshift-data-fieldshift-harvest71-2026")
PROJECT_ID = os.environ.get("PROJECT_ID", "fieldshift-harvest71-2026")
REGION = os.environ.get("REGION", "us-central1")
DSSAT_JOB = os.environ.get("DSSAT_JOB", "fieldshift-dssat")
RATE_PER_MINUTE = int(os.environ.get("RATE_PER_MINUTE", "6"))
RATE_PER_DAY = int(os.environ.get("RATE_PER_DAY", "200"))
GLOBAL_PER_DAY = int(os.environ.get("GLOBAL_PER_DAY", "500"))   # teto por instância (máx. 2 instâncias)
RESULT_TIMEOUT_S = 15 * 60
BRAZIL_BBOX = (-34.0, 5.5, -74.5, -28.5)
CROPS = json.loads((__import__("pathlib").Path(__file__).with_name("crops.json")).read_text())["crops"]


def _norm(s: str) -> str:
    import unicodedata
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower().strip()


def find_crop(value: str) -> Optional[dict]:
    """Aceita o código (MZ) ou o nome em português, com ou sem acento (milho, feijão-caupi)."""
    v = _norm(value or "")
    for c in CROPS:
        if v in (c["code"].lower(), _norm(c["name"])):
            return c
    aliases = {"maize": "MZ", "caupi": "CP", "feijao de corda": "CP", "macaxeira": "CS", "aipim": "CS",
               "guandu": "PP", "cana": "SC", "inhame": "TR", "taioba": "TN"}
    code = aliases.get(v)
    return next((c for c in CROPS if c["code"] == code), None) if code else None  # lat_min, lat_max, lon_min, lon_max (cobertura do PronaSolos)
SCENARIOS_OBJECT = "runs/scenarios/latest.json"
CACHE_SECONDS = 300
_cache: dict = {"t": 0.0, "doc": None}

app = FastAPI(
    title="Field Shift API",
    version=API_VERSION,
    docs_url=None,  # sem Swagger público no MVP de infraestrutura
    redoc_url=None,
    openapi_url=None,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()],
    allow_methods=["GET", "POST"],
    allow_headers=["X-API-Key", "Content-Type"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/version")
def version() -> dict:
    # GIT_COMMIT é injetado na imagem em build time; nunca colocar segredos aqui.
    return {
        "service": "fieldshift-api",
        "version": API_VERSION,
        "commit": os.environ.get("GIT_COMMIT", "unknown"),
    }


def _load_scenarios() -> dict:
    """Lê o último resumo de cenários do bucket privado (cache de 5 min)."""
    now = time.monotonic()
    if _cache["doc"] is not None and now - _cache["t"] < CACHE_SECONDS:
        return _cache["doc"]
    from google.cloud import storage  # import tardio: testes não precisam de credenciais

    blob = storage.Client().bucket(DATA_BUCKET).blob(SCENARIOS_OBJECT)
    if not blob.exists():
        raise HTTPException(status_code=404, detail="nenhum cenário calculado ainda")
    doc = json.loads(blob.download_as_bytes())
    _cache.update(t=now, doc=doc)
    return doc


@app.get("/scenarios")
def scenarios() -> dict:
    """Resumo de todos os locais (cenários históricos já simulados, sem disparar nada)."""
    doc = _load_scenarios()
    return {
        "generated_utc": doc.get("generated_utc"),
        "crop": doc.get("crop"),
        "dssat_build": doc.get("dssat_build"),
        "sites": [{k: s.get(k) for k in ("site", "title", "lat", "lon", "seasons", "scenario_summary", "evidence")}
                  for s in doc.get("sites", [])],
    }


@app.get("/scenarios/{site}")
def scenario_site(site: str) -> dict:
    """Detalhe de um local, incluindo suposições e avisos do solo."""
    doc = _load_scenarios()
    for s in doc.get("sites", []):
        if s.get("site", "").upper() == site.upper():
            return {"generated_utc": doc.get("generated_utc"), "dssat_build": doc.get("dssat_build"), **s}
    raise HTTPException(status_code=404, detail=f"local {site} sem cenários")


# ----------------------------------------------------------------------------- acesso

def _api_keys() -> set[str]:
    """Chaves vêm do Secret Manager como variável API_KEYS (separadas por vírgula). Nunca do código."""
    return {k.strip() for k in os.environ.get("API_KEYS", "").split(",") if k.strip()}


_hits: dict[str, deque] = defaultdict(deque)
_lock = threading.Lock()


def _require_key_enabled() -> bool:
    return os.environ.get("REQUIRE_API_KEY", "false").strip().lower() in ("1", "true", "sim", "yes")


def require_key(request: Request, x_api_key: Optional[str] = Header(default=None)) -> str:
    """Devolve a identidade usada no limite de uso: a chave, ou o IP de origem no modo aberto."""
    keys = _api_keys()
    if x_api_key and keys and any(secrets.compare_digest(x_api_key, k) for k in keys):
        return f"key:{x_api_key}"
    if _require_key_enabled():
        if not keys:
            raise HTTPException(status_code=503, detail="simulações ainda não habilitadas (sem chaves configuradas)")
        raise HTTPException(status_code=401, detail="chave de API ausente ou inválida (cabeçalho X-API-Key)")
    # Modo aberto: limite por IP (Cloud Run coloca o IP do cliente no início de X-Forwarded-For)
    fwd = request.headers.get("x-forwarded-for", "")
    ip = fwd.split(",")[0].strip() or (request.client.host if request.client else "desconhecido")
    return f"ip:{ip}"


def rate_limit(key: str) -> None:
    """Limite por chave ou IP (por instância; máx. 2 instâncias): N/min e N/dia, mais teto global diário."""
    now = time.time()
    with _lock:
        g = _hits["__global__"]
        while g and now - g[0] > 86400:
            g.popleft()
        if len(g) >= GLOBAL_PER_DAY:
            raise HTTPException(status_code=429, detail="limite diário do servidor atingido; tente amanhã")
        q = _hits[key]
        while q and now - q[0] > 86400:
            q.popleft()
        if len(q) >= RATE_PER_DAY:
            raise HTTPException(status_code=429, detail="limite diário de simulações atingido")
        if sum(1 for t in q if now - t < 60) >= RATE_PER_MINUTE:
            raise HTTPException(status_code=429, detail="muitas simulações por minuto; tente em instantes")
        q.append(now)
        g.append(now)


# ----------------------------------------------------------------------------- simulações

class SoilLayer(BaseModel):
    top_cm: float = Field(ge=0, le=200)
    bottom_cm: float = Field(gt=0, le=200)
    areia_g_kg: Optional[float] = Field(default=None, ge=0, le=1000)
    argila_g_kg: Optional[float] = Field(default=None, ge=0, le=1000)
    silte_g_kg: Optional[float] = Field(default=None, ge=0, le=1000)
    carbono_organico_g_kg: Optional[float] = Field(default=None, ge=0, le=200)
    materia_organica_g_kg: Optional[float] = Field(default=None, ge=0, le=350)
    ph_agua: Optional[float] = Field(default=None, ge=2, le=11)
    ctc_cmolc_kg: Optional[float] = Field(default=None, ge=0, le=200)
    densidade_g_cm3: Optional[float] = Field(default=None, ge=0.5, le=2.2)
    p_mg_dm3: Optional[float] = Field(default=None, ge=0)
    k_mg_dm3: Optional[float] = Field(default=None, ge=0)
    k_cmolc_dm3: Optional[float] = Field(default=None, ge=0)

    @field_validator("bottom_cm")
    @classmethod
    def _order(cls, v, info):
        if "top_cm" in info.data and v <= info.data["top_cm"]:
            raise ValueError("bottom_cm deve ser maior que top_cm")
        return v


class SoilAnalysis(BaseModel):
    lab: Optional[str] = Field(default=None, max_length=120)
    sample_date: Optional[str] = Field(default=None, max_length=20)
    layers: list[SoilLayer] = Field(min_length=1, max_length=6)


class WeatherEvent(BaseModel):
    id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9._-]+$")
    type: str = Field(description="v1: rainfall_multiplier")
    source_kind: str = Field(default="hypothetical")
    start_date: date
    end_date: date
    factor: float = Field(ge=0, le=1, allow_inf_nan=False)

    @model_validator(mode="after")
    def _valid_event(self):
        if self.type != "rainfall_multiplier":
            raise ValueError("tipo de evento não suportado; v1 aceita rainfall_multiplier")
        if self.source_kind != "hypothetical":
            raise ValueError("eventos v1 devem ter source_kind=hypothetical")
        if self.end_date < self.start_date:
            raise ValueError("end_date deve ser igual ou posterior a start_date")
        if (self.end_date - self.start_date).days >= 3660:
            raise ValueError("evento excede o limite de 10 anos")
        return self


class SimulationRequest(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    label: Optional[str] = Field(default=None, max_length=60)
    crop: str = Field(default="milho", description="código (MZ) ou nome (milho, feijão-caupi...) — ver GET /crops")
    cultivar: Optional[str] = Field(default=None, max_length=6, description="id do cultivar (GET /crops/{code}); vazio = padrão")
    planting_windows: Optional[list[str]] = Field(default=None, min_length=1, max_length=3,
                                                  description="datas MM-DD, ex.: ['11-15','12-15']")
    soil_analysis: Optional[SoilAnalysis] = None
    weather_events: list[WeatherEvent] = Field(default_factory=list, max_length=4)

    @field_validator("crop")
    @classmethod
    def _crop(cls, v):
        c = find_crop(v)
        if not c:
            raise ValueError(f"cultura desconhecida: {v} (veja GET /crops)")
        return c["code"]

    @model_validator(mode="after")
    def _cultivar(self):
        if self.cultivar:
            c = find_crop(self.crop)
            ids = {x["id"] for x in c["cultivars"]}
            if self.cultivar.upper() not in ids:
                raise ValueError(f"cultivar {self.cultivar} não existe para {c['name']} (veja GET /crops/{c['code']})")
            self.cultivar = self.cultivar.upper()
        return self

    @field_validator("planting_windows")
    @classmethod
    def _windows(cls, v):
        for w in v or []:
            if not re.fullmatch(r"(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])", w) or w == "02-29":
                raise ValueError(f"janela inválida: {w} (use MM-DD, sem 29/02)")
            datetime.strptime(f"2001-{w}", "%Y-%m-%d")
        return v

    @model_validator(mode="after")
    def _events_do_not_overlap(self):
        events = sorted(self.weather_events, key=lambda e: e.start_date)
        if len({event.id for event in events}) != len(events):
            raise ValueError("ids de eventos devem ser únicos")
        for previous, current in zip(events, events[1:]):
            if current.start_date <= previous.end_date:
                raise ValueError("eventos de chuva sobrepostos não são suportados")
        return self


def _storage_bucket():
    from google.cloud import storage
    return storage.Client().bucket(DATA_BUCKET)


def _put_json(name: str, obj: dict) -> None:
    _storage_bucket().blob(name).upload_from_string(json.dumps(obj, ensure_ascii=False), content_type="application/json")


def _get_json(name: str) -> Optional[dict]:
    blob = _storage_bucket().blob(name)
    return json.loads(blob.download_as_bytes()) if blob.exists() else None


def _run_job(request_id: str) -> str:
    """Dispara o Job DSSAT com variáveis só desta execução (Cloud Run Admin API v2)."""
    import google.auth
    from google.auth.transport.requests import AuthorizedSession

    creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    url = f"https://run.googleapis.com/v2/projects/{PROJECT_ID}/locations/{REGION}/jobs/{DSSAT_JOB}:run"
    body = {"overrides": {"containerOverrides": [{"env": [
        {"name": "MODE", "value": "point"},
        {"name": "REQUEST_ID", "value": request_id},
        {"name": "DATA_BUCKET", "value": DATA_BUCKET},
    ]}]}}
    r = AuthorizedSession(creds).post(url, json=body, timeout=30)
    if r.status_code >= 300:
        raise HTTPException(status_code=502, detail=f"falha ao iniciar a simulação ({r.status_code})")
    return r.json().get("metadata", {}).get("name", "")


@app.post("/simulations", status_code=202)
def create_simulation(req: SimulationRequest, key: str = Depends(require_key)) -> dict:
    lat_min, lat_max, lon_min, lon_max = BRAZIL_BBOX
    if not (lat_min <= req.lat <= lat_max and lon_min <= req.lon <= lon_max):
        raise HTTPException(status_code=422, detail="coordenada fora do Brasil (solo do PronaSolos só cobre o Brasil)")
    rate_limit(key)
    rid = uuid.uuid4().hex[:16]
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    _put_json(f"requests/{rid}.json", {**req.model_dump(mode="json", exclude_none=True), "id": rid, "created_utc": now})
    _run_job(rid)
    return {"id": rid, "status": "queued", "created_utc": now, "poll": f"/simulations/{rid}",
            "note": "a simulação leva cerca de 15 a 60 s; consulte o endereço em 'poll'"}


@app.get("/simulations/{rid}")
def get_simulation(rid: str, key: str = Depends(require_key)) -> dict:
    if not re.fullmatch(r"[0-9a-f]{16}", rid):
        raise HTTPException(status_code=404, detail="simulação não encontrada")
    result = _get_json(f"results/{rid}.json")
    if result and result.get("status") in ("done", "failed"):
        return result
    req = _get_json(f"requests/{rid}.json")
    if not req:
        raise HTTPException(status_code=404, detail="simulação não encontrada")
    created = datetime.fromisoformat(req["created_utc"])
    if (datetime.now(timezone.utc) - created).total_seconds() > RESULT_TIMEOUT_S:
        return {"id": rid, "status": "failed", "error": "tempo esgotado sem resultado"}
    return {"id": rid, "status": (result or {}).get("status", "queued"), "created_utc": req["created_utc"]}


# ----------------------------------------------------------------------------- culturas

@app.get("/crops")
def list_crops() -> dict:
    """Culturas disponíveis no DSSAT do Field Shift (para o menu do app)."""
    return {"crops": [{"code": c["code"], "name": c["name"], "product": c["product"],
                       "default_cultivar": c["default_cultivar"], "n_cultivars": len(c["cultivars"]),
                       "harvest": c["harvest"]["mode"], "cycle_days_max": c.get("cycle_days_max")} for c in CROPS],
            "note": "Coeficientes da biblioteca DSSAT (não calibrados no local). Sem cultivares de origem chinesa."}


@app.get("/crops/{code}")
def get_crop(code: str) -> dict:
    c = find_crop(code)
    if not c:
        raise HTTPException(status_code=404, detail="cultura não encontrada")
    return {k: c[k] for k in ("code", "name", "product", "model", "default_cultivar", "cultivars",
                              "cycle_days_max", "reference")} | {"harvest": c["harvest"]["mode"]}
