"""Executa o DSSAT-CSM de forma isolada e reprodutível (Cloud Run Job ou local).

Modos:
  reference  (padrão)  Roda o experimento oficial BRPI0202 (milho, Piracicaba-SP) embutido
                       na imagem e confere o resultado com os valores esperados. Serve como
                       teste de fumaça do contêiner e do acesso ao bucket.
  run                  Baixa as entradas de gs://<INPUT_PREFIX>, roda o arquivo FILEX
                       e grava saídas, log e metadados em gs://<OUTPUT_PREFIX>.
  point                Simulação sob demanda: lê o pedido gs://<DATA_BUCKET>/requests/<REQUEST_ID>.json
                       (lat, lon, janelas, análise de solo), busca NASA POWER e PronaSolos na hora
                       (com cache no bucket) e grava gs://<DATA_BUCKET>/results/<REQUEST_ID>.json.
  scenarios            Para cada local: lê NASA POWER e PronaSolos de gs://<DATA_BUCKET>/raw/,
                       gera .WTH/.SOL/.MZX, roda as safras históricas e grava um resumo
                       comparável por cenário em gs://<DATA_BUCKET>/runs/scenarios/.

Variáveis de ambiente:
  MODE            reference | run                     (padrão: reference)
  OUTPUT_PREFIX   gs://bucket/caminho/  (opcional em reference; obrigatório em run)
  INPUT_PREFIX    gs://bucket/caminho/  (run)  .WTH, .SOL, FileX, .CUL etc.
  FILEX           nome do arquivo de experimento, ex.: FSHT0001.MZX (run)
  DATA_BUCKET     bucket com raw/ (scenarios)
  SITES           ids separados por vírgula (scenarios; padrão: todos com clima e solo)
  POWER_PERIOD    pasta do período do POWER (padrão 19910101_20251231)
  REQUEST_ID      id do pedido (point)
  DSSAT_HOME      instalação do DSSAT (padrão /opt/dssat)
  RUN_TIMEOUT     segundos (padrão 600)

Nenhum valor é inventado: se o DSSAT falhar, o job falha e o log é gravado.
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

DSSAT_HOME = Path(os.environ.get("DSSAT_HOME", "/opt/dssat"))
EXE = DSSAT_HOME / "dscsm048"
RUN_TIMEOUT = int(os.environ.get("RUN_TIMEOUT", "600"))

# Resultado esperado do experimento de referência com os commits fixados no Dockerfile.
# Datas: dias após o plantio (antese ADAP, maturidade MDAP); HWAM: produtividade de grãos (kg/ha).
# Obtido compilando o DSSAT-CSM 4.8.6.004 (commit 25c93b9) e rodando BRPI0202.MZX no modo A.
REFERENCE_EXPECTED = {
    1: {"ADAP": 53, "MDAP": 118, "HWAM": 4329},
    2: {"ADAP": 62, "MDAP": 140, "HWAM": 4358},
    3: {"ADAP": 60, "MDAP": 129, "HWAM": 4559},
    4: {"ADAP": 57, "MDAP": 128, "HWAM": 4878},
    5: {"ADAP": 53, "MDAP": 118, "HWAM": 5215},
    6: {"ADAP": 62, "MDAP": 140, "HWAM": 5859},
    7: {"ADAP": 60, "MDAP": 129, "HWAM": 5596},
    8: {"ADAP": 57, "MDAP": 128, "HWAM": 6149},
}
YIELD_TOLERANCE = 0.01  # 1 %: margem para diferenças de compilador/arquitetura


def log(msg: str) -> None:
    print(f"[dssat-runner] {msg}", flush=True)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# ---------- Cloud Storage (importado só quando necessário) ----------
def _split(uri: str) -> tuple[str, str]:
    if not uri.startswith("gs://"):
        raise ValueError(f"URI inválida: {uri}")
    bucket, _, prefix = uri[5:].partition("/")
    return bucket, prefix.rstrip("/") + "/" if prefix else ""


def gcs_download(prefix_uri: str, dest: Path) -> list[str]:
    from google.cloud import storage

    bucket_name, prefix = _split(prefix_uri)
    client = storage.Client()
    names = []
    for blob in client.list_blobs(bucket_name, prefix=prefix):
        rel = blob.name[len(prefix):]
        if not rel or rel.endswith("/") or "/" in rel:
            continue  # só arquivos do nível do prefixo
        blob.download_to_filename(dest / rel)
        names.append(rel)
    return names


def gcs_upload(src: Path, prefix_uri: str) -> int:
    from google.cloud import storage

    bucket_name, prefix = _split(prefix_uri)
    bucket = storage.Client().bucket(bucket_name)
    n = 0
    for f in sorted(src.iterdir()):
        if f.is_file():
            bucket.blob(prefix + f.name).upload_from_filename(f)
            n += 1
    return n


# ---------- DSSAT ----------
def run_dssat(workdir: Path, filex: str) -> subprocess.CompletedProcess:
    if not EXE.exists():
        raise FileNotFoundError(f"executável não encontrado: {EXE}")
    t0 = time.monotonic()
    proc = subprocess.run(
        [str(EXE), "A", filex], cwd=workdir, capture_output=True, text=True, timeout=RUN_TIMEOUT
    )
    (workdir / "dssat_stdout.log").write_text(proc.stdout + "\n--- stderr ---\n" + proc.stderr)
    log(f"DSSAT terminou com código {proc.returncode} em {time.monotonic() - t0:.2f} s")
    return proc


def parse_summary(path: Path) -> list[dict]:
    """Lê Summary.OUT pela POSIÇÃO das colunas do cabeçalho '@' (valores alinhados à direita).

    Ler por posição evita desalinhar quando um campo está vazio ou a linha termina antes
    (safra que falhou), o que quebraria uma leitura por espaços.
    """
    import re
    rows, spans = [], None
    for line in path.read_text(errors="replace").splitlines():
        if line.startswith("@"):
            spans, prev = [], 0
            for m in re.finditer(r"\S+", line):
                name = m.group().lstrip("@").rstrip(".")
                if name:
                    spans.append((name, prev, m.end()))
                prev = m.end()
            continue
        if spans and line.strip() and line[0] == " ":
            rows.append({name: line[a:b].strip() for name, a, b in spans})
    return rows


def as_int(v: str) -> int | None:
    try:
        x = int(float(v))
        return None if x == -99 else x
    except (TypeError, ValueError):
        return None


def summarize(rows: list[dict]) -> list[dict]:
    out = []
    for r in rows:
        pdat, adat, mdat = (as_int(r.get(k)) for k in ("PDAT", "ADAT", "MDAT"))
        out.append({
            "treatment": as_int(r.get("TRNO")),
            "crop": r.get("CR"),
            "model": r.get("MODEL"),
            "planting_yyyyddd": pdat,
            "anthesis_yyyyddd": adat,
            "maturity_yyyyddd": mdat,
            "anthesis_dap": doy_diff(pdat, adat),
            "maturity_dap": doy_diff(pdat, mdat),
            "yield_kg_ha": as_int(r.get("HWAM")),
            "biomass_kg_ha": as_int(r.get("CWAM")),
            "rain_mm": as_int(r.get("PRCM")),
            "irrigation_mm": as_int(r.get("IRCM")),
            "et_mm": as_int(r.get("ETCM")),
        })
    return out


def doy_diff(a: int | None, b: int | None) -> int | None:
    # alguns modelos (ex.: inhame/taioba) gravam 0 em vez de -99 para datas ausentes
    if not a or not b or len(str(a)) != 7 or len(str(b)) != 7:
        return None
    da = datetime.strptime(str(a), "%Y%j")
    db = datetime.strptime(str(b), "%Y%j")
    return (db - da).days


def check_reference(summary: list[dict]) -> list[str]:
    errors = []
    by_trt = {s["treatment"]: s for s in summary}
    for trt, exp in REFERENCE_EXPECTED.items():
        got = by_trt.get(trt)
        if not got:
            errors.append(f"tratamento {trt} ausente")
            continue
        if got["anthesis_dap"] != exp["ADAP"]:
            errors.append(f"trt {trt}: antese {got['anthesis_dap']} != {exp['ADAP']} DAP")
        if got["maturity_dap"] != exp["MDAP"]:
            errors.append(f"trt {trt}: maturidade {got['maturity_dap']} != {exp['MDAP']} DAP")
        y = got["yield_kg_ha"] or 0
        if abs(y - exp["HWAM"]) > YIELD_TOLERANCE * exp["HWAM"]:
            errors.append(f"trt {trt}: produtividade {y} fora de ±1% de {exp['HWAM']}")
    return errors


def metadata(workdir: Path, mode: str, filex: str, inputs: list[str], rc: int, summary: list[dict]) -> dict:
    build = {}
    info = DSSAT_HOME / "BUILD_INFO.json"
    if info.exists():
        build = json.loads(info.read_text())
    return {
        "finished_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mode": mode,
        "filex": filex,
        "return_code": rc,
        "image_git_commit": os.environ.get("GIT_COMMIT", "unknown"),
        "dssat_build": build,
        "inputs_sha256": {n: sha256(workdir / n) for n in inputs if (workdir / n).exists()},
        "summary": summary,
        "evidence": {
            "is_actual_forecast": False,
            "note": "Simulação DSSAT: válida apenas sob as entradas e hipóteses usadas; "
                    "sem calibração local não é previsão de produtividade da propriedade.",
        },
    }

# ---------- Cenários a partir dos dados coletados ----------
def gcs_list(bucket_name: str, prefix: str) -> list[str]:
    from google.cloud import storage
    return [b.name for b in storage.Client().list_blobs(bucket_name, prefix=prefix)]


def gcs_get(bucket_name: str, name: str, dest: Path) -> None:
    from google.cloud import storage
    storage.Client().bucket(bucket_name).blob(name).download_to_filename(dest)


def gcs_put_json(bucket_name: str, name: str, obj) -> None:
    from google.cloud import storage
    storage.Client().bucket(bucket_name).blob(name).upload_from_string(
        json.dumps(obj, indent=2, ensure_ascii=False), content_type="application/json")


def percentile(xs: list[float], q: float) -> float | None:
    xs = sorted(x for x in xs if x is not None)
    if not xs:
        return None
    k = (len(xs) - 1) * q
    lo, hi = int(k), min(int(k) + 1, len(xs) - 1)
    return round(xs[lo] + (xs[hi] - xs[lo]) * (k - lo), 1)


def aggregate(meta: dict, seasons: list[dict], low_yield: float = 1000.0) -> list[dict]:
    """Resumo por cenário ao longo dos anos: distribuição, não um número único.

    'Quebra forte' = safra abaixo de metade da mediana do cenário irrigado (potencial hídrico do local).
    """
    var = "biomass_kg_ha" if (meta.get("crop") or {}).get("yield_variable") == "CWAM" else "yield_kg_ha"
    irrigated = [x[var] or 0 for sc in meta["scenarios"] if sc["irrigated"]
                 for x in seasons if x["treatment"] == sc["trno"]]
    potential = percentile(irrigated, .5) or 0
    out = []
    for sc in meta["scenarios"]:
        v = [x for x in seasons if x["treatment"] == sc["trno"]]
        y = [x[var] or 0 for x in v]
        out.append({
            **sc,
            "n_seasons": len(v),
            "yield_kg_ha": {"p10": percentile(y, .1), "p50": percentile(y, .5), "p90": percentile(y, .9)},
            "share_seasons_below_1000_kg_ha": round(sum(1 for t in y if t < low_yield) / len(y), 3) if y else None,
            "share_seasons_below_half_irrigated_p50":
                round(sum(1 for t in y if t < 0.5 * potential) / len(y), 3) if y and potential else None,
            "maturity_dap_p50": percentile([x["maturity_dap"] for x in v], .5),
            "rain_mm_p50": percentile([x["rain_mm"] for x in v], .5),
            "irrigation_mm_p50": percentile([x["irrigation_mm"] for x in v], .5),
            "et_mm_p50": percentile([x["et_mm"] for x in v], .5),
        })
    return out


def run_scenarios() -> int:
    import fieldshift_inputs as fi

    bucket = os.environ["DATA_BUCKET"]
    period = os.environ.get("POWER_PERIOD", "19910101_20251231")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    names = gcs_list(bucket, "raw/")
    have_w = {n.split("/")[-1][:-5] for n in names if n.startswith(f"raw/nasa-power/{period}/") and n.endswith(".json")}
    have_s = {n.split("/")[-1][:-4] for n in names if n.startswith("raw/pronasolos/v1/") and n.endswith(".csv")}
    sites = [x for x in os.environ.get("SITES", "").split(",") if x] or sorted(have_w & have_s)
    titles = {}
    for n in names:  # títulos a partir do manifesto mais recente
        if n.startswith("raw/manifests/"):
            titles["_m"] = n
    if "_m" in titles:
        with tempfile.TemporaryDirectory() as t:
            gcs_get(bucket, titles["_m"], Path(t) / "m.json")
            for p in json.loads((Path(t) / "m.json").read_text()).get("points", []):
                titles[p["id"]] = p["name"]
    log(f"locais: {sites or 'nenhum'} (clima: {sorted(have_w)}, solo: {sorted(have_s)})")
    if not sites:
        log("ERRO: nenhum local com clima e solo no bucket")
        return 1

    results, failures = [], []
    for site in sites:
        with tempfile.TemporaryDirectory(prefix=f"fs-{site}-") as tmp:
            work = Path(tmp)
            try:
                gcs_get(bucket, f"raw/nasa-power/{period}/{site}.json", work / "power.json")
                gcs_get(bucket, f"raw/pronasolos/v1/{site}.csv", work / "soil.csv")
                indir = work / "run"
                meta = fi.build_site(site, titles.get(site, site), work / "power.json", work / "soil.csv", indir)
                proc = run_dssat(indir, meta["filex"])
                seasons = summarize(parse_summary(indir / "Summary.OUT")) if (indir / "Summary.OUT").exists() else []
                expected = meta["seasons"]["n_years"] * len(meta["scenarios"])
                ok = proc.returncode == 0 and len(seasons) == expected and any((x["yield_kg_ha"] or 0) > 0 for x in seasons)
                meta.update({
                    "dssat_return_code": proc.returncode, "seasons_expected": expected, "seasons_simulated": len(seasons),
                    "scenario_summary": aggregate(meta, seasons) if seasons else [],
                    "evidence": {"quality_level": "exploratorio", "local_calibration_available": False,
                                 "is_actual_forecast": False,
                                 "note": "Comparação relativa entre janelas e manejo hídrico; não é previsão de produtividade."},
                })
                (indir / "site_metadata.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False))
                (indir / "seasons.json").write_text(json.dumps(seasons, ensure_ascii=False))
                for junk in ("power.json",):
                    (work / junk).unlink(missing_ok=True)
                n = gcs_upload(indir, f"gs://{bucket}/runs/scenarios/{stamp}/{site}/")
                log(f"{site}: {len(seasons)}/{expected} safras, {n} arquivos gravados")
                if ok:
                    results.append({k: meta[k] for k in ("site", "title", "lat", "lon", "seasons", "crop",
                                                          "scenario_summary", "assumptions", "evidence")} |
                                   {"soil_texture_top": meta["soil"]["texture_top"],
                                    "soil_warnings": meta["soil"]["warnings"]})
                else:
                    failures.append({"site": site, "reason": "simulação incompleta", "seasons": len(seasons)})
            except Exception as e:  # um local com problema não derruba os outros
                failures.append({"site": site, "reason": f"{type(e).__name__}: {e}"})
                log(f"{site}: ERRO {e}")

    build = json.loads((DSSAT_HOME / "BUILD_INFO.json").read_text()) if (DSSAT_HOME / "BUILD_INFO.json").exists() else {}
    report = {"generated_utc": stamp, "image_git_commit": os.environ.get("GIT_COMMIT", "unknown"),
              "dssat_build": build, "crop": "milho (CERES-Maize)",
              "data_sources": {"clima": "NASA POWER (NASA Langley), diário 1991–2025",
                               "solo": "PronaSolos 90 m (Embrapa/SGB) + Saxton & Rawls 2006 (USDA-ARS)",
                               "modelo": "DSSAT-CSM 4.8.6, só arquivos de milho; cultivar AG9010 (Brasil)",
                               "excluidas": "nenhuma fonte, autor ou dado de origem chinesa (política da equipe)"},
              "sites": results, "failures": failures}
    gcs_put_json(bucket, f"runs/scenarios/{stamp}/summary.json", report)
    if results:
        gcs_put_json(bucket, "runs/scenarios/latest.json", report)
    print(json.dumps({"sites_ok": [r["site"] for r in results], "failures": failures}, ensure_ascii=False))
    log(f"resumo: gs://{bucket}/runs/scenarios/{stamp}/summary.json")
    return 0 if results and not failures else 1

# ---------- Simulação sob demanda (um ponto) ----------
POWER_PARAMS = "ALLSKY_SFC_SW_DWN,T2M_MAX,T2M_MIN,PRECTOTCORR,T2M,T2MDEW,RH2M,WS2M"
POWER_START, POWER_END = "19910101", "20251231"
PS_URL = "https://geoportal.sgb.gov.br/server/rest/services/pronasolos/atributos_solo_90m/MapServer/identify"


def http_get_json(url: str, timeout: int = 120, tries: int = 3) -> dict:
    import urllib.request
    last = None
    for i in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=timeout) as r:
                return json.loads(r.read())
        except Exception as e:  # rede instável: tenta de novo
            last = e
            time.sleep(3 * (i + 1))
    raise RuntimeError(f"falha ao baixar {url.split('?')[0]}: {last}")


def power_cell(lat: float, lon: float) -> str:
    """Célula da grade do POWER (0,5° × 0,625°): pontos na mesma célula têm o mesmo clima."""
    import math
    return f"{math.floor((lat + 90) / 0.5)}_{math.floor((lon + 180) / 0.625)}"


def fetch_power(lat: float, lon: float) -> dict:
    url = ("https://power.larc.nasa.gov/api/temporal/daily/point?"
           f"parameters={POWER_PARAMS}&community=AG&latitude={lat:.4f}&longitude={lon:.4f}"
           f"&start={POWER_START}&end={POWER_END}&time-standard=LST&format=JSON")
    return http_get_json(url, timeout=180)


def fetch_pronasolos(lat: float, lon: float) -> dict:
    from urllib.parse import urlencode
    q = urlencode({"geometry": f"{lon},{lat}", "geometryType": "esriGeometryPoint", "sr": 4326, "layers": "all",
                   "tolerance": 0, "mapExtent": f"{lon - .5},{lat - .5},{lon + .5},{lat + .5}",
                   "imageDisplay": "400,400,96", "returnGeometry": "false", "f": "json"})
    return http_get_json(f"{PS_URL}?{q}", timeout=60)


def gcs_read_json(bucket_name: str, name: str):
    from google.cloud import storage
    blob = storage.Client().bucket(bucket_name).blob(name)
    return json.loads(blob.download_as_bytes()) if blob.exists() else None


def cached(bucket: str, name: str, producer):
    doc = gcs_read_json(bucket, name)
    if doc is not None:
        return doc, True
    doc = producer()
    gcs_put_json(bucket, name, doc)
    return doc, False


def run_point() -> int:
    import fieldshift_inputs as fi
    from weather_events import WeatherEvent, apply_power_events

    bucket = os.environ["DATA_BUCKET"]
    rid = os.environ["REQUEST_ID"]
    result_name = f"results/{rid}.json"
    started = datetime.now(timezone.utc)
    req = None
    try:
        req = gcs_read_json(bucket, f"requests/{rid}.json")
        if req is None:
            raise ValueError("pedido não encontrado")
        lat, lon = float(req["lat"]), float(req["lon"])
        gcs_put_json(bucket, result_name, {"id": rid, "status": "running", "started_utc": started.isoformat(timespec="seconds")})
        power, power_hit = cached(bucket, f"cache/nasa-power/{POWER_START}_{POWER_END}/{power_cell(lat, lon)}.json",
                                  lambda: fetch_power(lat, lon))
        events = [WeatherEvent(id=e["id"], type=e["type"], start_date=datetime.strptime(e["start_date"], "%Y-%m-%d").date(),
                               end_date=datetime.strptime(e["end_date"], "%Y-%m-%d").date(), factor=e["factor"],
                               source_kind=e["source_kind"])
                  for e in req.get("weather_events", [])]
        power, weather_event_manifest = apply_power_events(power, events)
        ps_doc, ps_hit = cached(bucket, f"cache/pronasolos/v1/{lat:.4f}_{lon:.4f}.json", lambda: fetch_pronasolos(lat, lon))
        with tempfile.TemporaryDirectory(prefix=f"fs-{rid}-") as tmp:
            work = Path(tmp)
            (work / "power.json").write_text(json.dumps(power))
            (work / "soil.csv").write_text(fi.pronasolos_identify_to_csv(ps_doc))
            if req.get("kind") == "rotation_search":
                from rotation_search import search

                result = search(work / "power.json", work / "soil.csv", work / "rotation", req)
                gcs_put_json(bucket, result_name, {
                    **result, "id": rid, "status": "done", "kind": "rotation_search",
                    "request": {key: req[key] for key in (
                        "lat", "lon", "known_crops", "planting_dates", "yield_targets_kg_ha",
                    )},
                })
                return 0
            if req.get("kind") == "rotation":
                from rotation_compare import compare

                dates = tuple(datetime.fromisoformat(day).date() for day in req["planting_dates"])
                result = compare(work / "power.json", work / "soil.csv", work / "rotation",
                                 tuple(req["crops"]), dates)
                gcs_put_json(bucket, result_name, {
                    **result, "id": rid, "status": "done", "kind": "rotation",
                    "request": {key: req[key] for key in ("lat", "lon", "crops", "planting_dates")},
                })
                return 0
            windows = [tuple(int(x) for x in w.split("-")) for w in req.get("planting_windows") or []] or None
            indir = work / "run"
            meta = fi.build_site("FSPT", req.get("label") or f"{lat:.4f},{lon:.4f}", work / "power.json",
                                 work / "soil.csv", indir, soil_analysis=req.get("soil_analysis"),
                                 windows=windows, auto_window=True,
                                 crop_code=req.get("crop") or "MZ", cultivar_id=req.get("cultivar"))
            proc = run_dssat(indir, meta["filex"])
            seasons = summarize(parse_summary(indir / "Summary.OUT")) if (indir / "Summary.OUT").exists() else []
            expected = meta["seasons"]["n_years"] * len(meta["scenarios"])
            if proc.returncode != 0 or len(seasons) != expected:
                raise RuntimeError(f"DSSAT incompleto ({len(seasons)}/{expected} safras, código {proc.returncode})")
            gcs_upload(indir, f"gs://{bucket}/runs/point/{rid}/")
        build = json.loads((DSSAT_HOME / "BUILD_INFO.json").read_text()) if (DSSAT_HOME / "BUILD_INFO.json").exists() else {}
        result = {
            "id": rid, "status": "done",
            "started_utc": started.isoformat(timespec="seconds"),
            "finished_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "request": {k: req.get(k) for k in ("lat", "lon", "label", "crop", "cultivar", "planting_windows",
                                                "weather_events", "climate_projection")},
            "location": {"lat": lat, "lon": lon, "elev_m": meta["elev_m"], "power_cell": power_cell(lat, lon)},
            "crop": meta["crop"],
            "seasons": meta["seasons"],
            "scenario_summary": aggregate(meta, seasons),
            "climate": {"source": "NASA POWER diário (AG)", "period": meta["weather_period"],
                        "tav_c": meta["tav_c"], "amp_c": meta["amp_c"], "cache_hit": power_hit,
                        "event_transform": weather_event_manifest},
            "soil": {"source": meta["soil_source"], "texture_top": meta["soil"]["texture_top"],
                     "layers": meta["soil"]["layers"], "warnings": meta["soil"]["warnings"], "cache_hit": ps_hit},
            "planting_windows_source": meta["planting_windows_source"],
            "provenance": meta["provenance"],
            "assumptions": meta["assumptions"],
            "dssat_build": build,
            "evidence": {"quality_level": "exploratorio",
                         "local_soil_analysis": bool(req.get("soil_analysis")),
                         "local_calibration_available": False, "is_actual_forecast": False,
                         "note": "Comparação relativa entre janelas e manejo hídrico; não é previsão de produtividade."},
        }
        if req.get("climate_projection"):
            gcs_put_json(bucket, result_name, result | {"status": "running",
                                                        "note": "resultado atual pronto; calculando o clima futuro"})
            result["climate_projection"] = run_projection(bucket, rid, req, lat, lon, power, ps_doc, meta,
                                                          result["scenario_summary"])
            result["evidence"]["climate_projection"] = (
                "Clima futuro = NASA POWER observado + mudança mensal projetada (NEX-GDDP-CMIP6). "
                "Indica tendência, não previsão de uma safra específica.")
            result["finished_utc"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        gcs_put_json(bucket, result_name, result)
        log(f"{rid}: ok ({len(seasons)} safras)")
        return 0
    except Exception as e:
        public_error = str(e) if isinstance(e, ValueError) else "DSSAT não completou a comparação nos plantios solicitados."
        try_rotation = req is not None and req.get("kind") in {"rotation", "rotation_search"}
        gcs_put_json(bucket, result_name, {"id": rid, "status": "failed", "error": public_error if try_rotation else f"{type(e).__name__}: {e}",
                                           "finished_utc": datetime.now(timezone.utc).isoformat(timespec="seconds")})
        log(f"{rid}: ERRO {e}")
        return 1



def run_projection(bucket: str, rid: str, req: dict, lat: float, lon: float, power: dict, ps_doc: dict,
                   meta: dict, baseline_summary: list[dict]) -> dict:
    """Clima futuro (NEX-GDDP-CMIP6, NASA) aplicado ao NASA POWER do ponto; uma rodada do DSSAT por modelo.

    Erros aqui não derrubam o resultado atual: vão em climate_projection.error / failures.
    """
    import fieldshift_inputs as fi
    import nex_gddp as nx
    from concurrent.futures import ThreadPoolExecutor

    cp = req["climate_projection"] or {}
    scenario, period = cp.get("scenario", "ssp245"), cp.get("period", "2041-2060")
    out = {"source": nx.SOURCE, "scenario": scenario, "scenario_name": nx.SCENARIOS.get(scenario),
           "period": period, "historical_reference": f"{nx.HIST_YEARS[0]}-{nx.HIST_YEARS[1]}",
           "method": ("delta mensal: média de 20 anos do modelo no período futuro menos (temperatura) ou dividida "
                      "por (chuva, radiação) a média 1995–2014 do mesmo modelo, aplicada dia a dia ao NASA POWER "
                      "1991–2025 do ponto; mesmas janelas de plantio, solo, cultura e cultivar do resultado atual"),
           "baseline": "scenario_summary (NASA POWER 1991–2025)", "nex_cell": None,
           "models": [], "failures": []}
    try:
        models = nx.validate(scenario, period, cp.get("models"))
        years = nx.PERIODS[period]
        key = nx.cell_key(lat, lon)
        clat, clon = nx.grid_cell(lat, lon)
        out["nex_cell"] = {"lat": clat, "lon": round(clon - 360, 3) if clon > 180 else clon, "size_deg": 0.25}
        windows = nx.windows_from_meta(meta)

        def clim(model, experiment, yrs):
            # 1) recorte regional pré-processado (instantâneo); 2) senão, baixa só a célula (lento, fica em cache)
            if nx.in_region(lat, lon):
                reg = gcs_read_json(bucket, nx.regional_blob(model, experiment, yrs))
                doc = nx.from_regional(reg, lat, lon) if reg else None
                if doc:
                    return doc
            name = f"cache/nex-gddp-cmip6/v2/{model}/{experiment}_{yrs[0]}-{yrs[1]}/{key}.json"
            doc, _ = cached(bucket, name, lambda: nx.climatology(model, experiment, yrs, lat, lon, workers=8))
            return doc

        def one(model):
            hist = clim(model, "historical", nx.HIST_YEARS)
            fut = clim(model, scenario, years)
            deltas = nx.monthly_deltas(hist, fut)
            fpower = nx.apply_to_power(power, deltas)
            with tempfile.TemporaryDirectory(prefix=f"fs-{rid}-{model}-") as tmp:
                work = Path(tmp)
                (work / "power.json").write_text(json.dumps(fpower))
                (work / "soil.csv").write_text(fi.pronasolos_identify_to_csv(ps_doc))
                indir = work / "run"
                m = fi.build_site("FSPT", req.get("label") or f"{lat:.4f},{lon:.4f}", work / "power.json",
                                  work / "soil.csv", indir, soil_analysis=req.get("soil_analysis"),
                                  windows=windows, crop_code=meta["crop"]["code"],
                                  cultivar_id=meta["crop"]["cultivar"]["id"],
                                  weather_label=f"POWER + {model} {scenario} {period}")
                proc = run_dssat(indir, m["filex"])
                seasons = summarize(parse_summary(indir / "Summary.OUT")) if (indir / "Summary.OUT").exists() else []
                expected = m["seasons"]["n_years"] * len(m["scenarios"])
                if proc.returncode != 0 or len(seasons) != expected:
                    raise RuntimeError(f"DSSAT incompleto ({len(seasons)}/{expected} safras)")
                gcs_upload(indir, f"gs://{bucket}/runs/point/{rid}/projection/{model}/")
            return {"model": model, "institution": nx.MODELS[model],
                    "climate_change": nx.annual_summary(hist, fut, deltas),
                    "monthly_deltas": {str(k): v for k, v in deltas.items()},
                    "scenario_summary": aggregate(m, seasons)}

        def safe(model):
            try:
                return one(model)
            except Exception as e:
                return {"model": model, "error": f"{type(e).__name__}: {e}"}

        with ThreadPoolExecutor(max_workers=3) as ex:
            res = list(ex.map(safe, models))
        out["models"] = [r for r in res if "error" not in r]
        out["failures"] = [r for r in res if "error" in r]
        if not out["models"]:
            raise RuntimeError("nenhum modelo climático concluiu: " + "; ".join(f["error"] for f in out["failures"]))
        out["ensemble"] = nx.ensemble(baseline_summary, out["models"])
        out["status"] = "done"
    except Exception as e:
        out["status"] = "failed"
        out["error"] = f"{type(e).__name__}: {e}"
        log(f"{rid}: projeção falhou: {e}")
    return out


def main() -> int:
    mode = os.environ.get("MODE", "reference")
    if mode == "scenarios":
        return run_scenarios()
    if mode == "point":
        return run_point()

    output_prefix = os.environ.get("OUTPUT_PREFIX", "").strip()
    with tempfile.TemporaryDirectory(prefix="dssat-") as tmp:
        work = Path(tmp)
        if mode == "reference":
            filex = "BRPI0202.MZX"
            inputs = []
            for f in (DSSAT_HOME / "reference").iterdir():
                shutil.copy(f, work / f.name)
                inputs.append(f.name)
        elif mode == "run":
            input_prefix = os.environ["INPUT_PREFIX"]
            filex = os.environ["FILEX"]
            if not output_prefix:
                raise SystemExit("OUTPUT_PREFIX é obrigatório no modo run")
            inputs = gcs_download(input_prefix, work)
            log(f"{len(inputs)} entradas baixadas de {input_prefix}")
            if filex not in inputs:
                raise SystemExit(f"FILEX {filex} não está em {input_prefix}")
        else:
            raise SystemExit(f"MODE desconhecido: {mode}")

        proc = run_dssat(work, filex)
        summary_file = work / "Summary.OUT"
        summary = summarize(parse_summary(summary_file)) if summary_file.exists() else []
        meta = metadata(work, mode, filex, inputs, proc.returncode, summary)

        errors = []
        if proc.returncode != 0 or not summary:
            errors.append("DSSAT não produziu Summary.OUT válido")
        if mode == "reference":
            errors += check_reference(summary)
        meta["checks"] = {"passed": not errors, "errors": errors}
        (work / "run_metadata.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False))
        print(json.dumps({"summary": summary, "checks": meta["checks"]}, ensure_ascii=False))

        if output_prefix:
            n = gcs_upload(work, output_prefix)
            log(f"{n} arquivos gravados em {output_prefix}")

        if errors:
            for e in errors:
                log(f"ERRO: {e}")
            return 1
        log("OK")
        return 0


if __name__ == "__main__":
    sys.exit(main())
