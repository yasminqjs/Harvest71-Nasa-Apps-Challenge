"""Field Shift API.

/health, /version e leitura (somente leitura) dos cenários DSSAT já calculados.
Nenhum endpoint dispara simulação e nenhum dado de agricultor é recebido.
Endpoints que iniciam jobs só entram depois de autenticação, autorização e
quotas (ver docs/decisions e o handoff).
"""

import json
import os
import time

from fastapi import FastAPI, HTTPException

API_VERSION = "0.2.0"
DATA_BUCKET = os.environ.get("DATA_BUCKET", "fieldshift-data-fieldshift-harvest71-2026")
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
