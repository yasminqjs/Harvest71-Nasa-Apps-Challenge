"""Pré-processa as projeções NASA NEX-GDDP-CMIP6 para o Nordeste e grava no bucket.

Para cada modelo × (histórico 1995–2014 e cada cenário/período de data/nex_gddp.json) × variável × ano,
baixa UM recorte da região (NCSS, netCDF3, ~6 MB) e acumula a média mensal de cada célula de 0,25°.
Resultado: gs://$BUCKET/nex-gddp-cmip6/v2/<recorte>/<modelo>/<experimento>_<anos>.json
(recortes em data/nex_gddp.json: "nordeste" primeiro, rápido; depois "brasil", o país inteiro)
(médias mensais por célula: TMAX/TMIN °C, RAIN mm/dia, SRAD MJ/m²/dia).
O Job do DSSAT lê esses arquivos e a simulação com clima futuro fica instantânea para qualquer
ponto do Nordeste. Arquivos já existentes no bucket são pulados (a conta de ingestão não sobrescreve).

Uso (GitHub Actions, depois do auth do Google):
    python3 data/scripts/nex_gddp_prefetch.py --config data/nex_gddp.json --bucket "$BUCKET"
Teste local sem bucket:
    python3 data/scripts/nex_gddp_prefetch.py --config data/nex_gddp.json --out /tmp/nex --only GISS-E2-1-G
"""
from __future__ import annotations

import argparse
import io
import json
import subprocess
import sys
import tempfile
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from scipy.io import netcdf_file

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "dssat"))
import nex_gddp as nx  # noqa: E402


def bbox_url(url_path: str, var: str, r: dict) -> str:
    q = urllib.parse.urlencode({"var": var, "north": r["north"], "south": r["south"], "west": r["west"],
                                "east": r["east"], "horizStride": 1, "temporal": "all", "accept": "netcdf3"})
    return f"{nx.THREDDS}/ncss/grid/{url_path}?{q}"


def http_bytes(url: str, tries: int = 5, timeout: int = 300) -> bytes:
    import urllib.request
    last = None
    for i in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=timeout) as resp:
                return resp.read()
        except Exception as e:
            last = e
            time.sleep(5 * (i + 1))
    raise RuntimeError(f"falha: {url.split('?')[0]}: {last}")


def read_year(blob: bytes, var: str, year: int):
    """(lat, lon, soma mensal [12, lat, lon], contagem [12, lat, lon]) de um arquivo anual."""
    f = netcdf_file(io.BytesIO(blob), mmap=False)
    try:
        lat = np.array(f.variables["lat"][:], dtype=float)
        lon = np.array(f.variables["lon"][:], dtype=float)
        data = np.array(f.variables[var][:], dtype=float)          # [tempo, lat, lon]
        fill = getattr(f.variables[var], "_FillValue", 1e20)
    finally:
        f.close()
    data[(data >= 1e19) | (data == fill)] = np.nan
    data = nx.VARS[var][1](data)                                     # unidades do POWER/DSSAT
    months = np.array(nx.month_index(data.shape[0], leap=(year % 4 == 0)))
    sums = np.zeros((12,) + data.shape[1:])
    cnt = np.zeros((12,) + data.shape[1:])
    for m in range(1, 13):
        sel = data[months == m]
        sums[m - 1] = np.nansum(sel, axis=0)
        cnt[m - 1] = np.sum(~np.isnan(sel), axis=0)
    lon = np.where(lon > 180, lon - 360, lon)
    return lat, lon, sums, cnt


def build(model: str, experiment: str, years: tuple[int, int], workers: int, region: dict | None = None) -> dict:
    region = region or nx.REGION
    jobs = []
    for var in nx.VARS:
        files = nx.list_files(model, experiment, var)
        miss = [y for y in range(years[0], years[1] + 1) if y not in files]
        if miss:
            raise RuntimeError(f"{model}/{experiment}/{var}: faltam anos {miss[:5]}")
        jobs += [(var, y, files[y]) for y in range(years[0], years[1] + 1)]
    acc: dict[str, list] = {}
    grid = {}
    t0 = time.time()

    def one(job):
        var, y, path = job
        return var, read_year(http_bytes(bbox_url(path, var, region)), var, y)

    with ThreadPoolExecutor(max_workers=workers) as ex:
        for k, (var, (lat, lon, s, c)) in enumerate(ex.map(one, jobs), 1):
            grid.setdefault("lat", lat)
            grid.setdefault("lon", lon)
            if var not in acc:
                acc[var] = [np.zeros_like(s), np.zeros_like(c)]
            acc[var][0] += s
            acc[var][1] += c
            if k % 20 == 0 or k == len(jobs):
                print(f"  {model} {experiment} {k}/{len(jobs)} arquivos ({time.time() - t0:.0f} s)", flush=True)
    monthly = {}
    n_days = {}
    for var, (s, c) in acc.items():
        with np.errstate(invalid="ignore", divide="ignore"):
            mean = np.where(c > 0, s / c, np.nan)
        name = nx.VARS[var][0]
        monthly[name] = [[[None if np.isnan(v) else round(float(v), 3) for v in row] for row in mean[m]]
                         for m in range(12)]
        n_days[name] = int(np.nanmax(c.sum(axis=0)))
    return {"source": nx.SOURCE, "model": model, "institution": nx.MODELS[model], "experiment": experiment,
            "years": list(years), "region": region,
            "lat": [round(float(x), 3) for x in grid["lat"]], "lon": [round(float(x), 3) for x in grid["lon"]],
            "units": {"TMAX": "°C", "TMIN": "°C", "RAIN": "mm/dia", "SRAD": "MJ/m²/dia"},
            "monthly": monthly, "n_days": n_days,
            "generated_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}


def gcs_exists(uri: str) -> bool:
    return subprocess.run(["gcloud", "storage", "ls", uri], capture_output=True).returncode == 0


def gcs_put(doc: dict, uri: str) -> None:
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as t:
        json.dump(doc, t, ensure_ascii=False, separators=(",", ":"))
    subprocess.run(["gcloud", "storage", "cp", t.name, uri, "--content-type=application/json"], check=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=str(ROOT / "data" / "nex_gddp.json"))
    ap.add_argument("--bucket")
    ap.add_argument("--out", help="pasta local (teste), em vez do bucket")
    ap.add_argument("--only", help="só este modelo")
    ap.add_argument("--workers", type=int, default=6)
    a = ap.parse_args()
    cfg = json.loads(Path(a.config).read_text())
    models = [a.only] if a.only else cfg["models"]
    nx.validate(cfg["scenarios"][0], cfg["periods"][0], models)   # política: nenhum modelo chinês
    tasks = [("historical", nx.HIST_YEARS)]
    tasks += [(s, nx.PERIODS[p]) for s in cfg["scenarios"] for p in cfg["periods"]]
    regions = [nx.region_by_name(r) for r in cfg.get("regions", [nx.REGION["name"]])]
    failures = []
    for region in regions:
        for model in models:
            for exp, yrs in tasks:
                rel = nx.regional_blob(model, exp, yrs, region["name"])
                dest = f"gs://{a.bucket}/{rel}" if a.bucket else str(Path(a.out) / rel)
                if (a.bucket and gcs_exists(dest)) or (a.out and Path(dest).exists()):
                    print(f"já existe: {rel}")
                    continue
                print(f"gerando {rel}", flush=True)
                try:
                    doc = build(model, exp, yrs, a.workers, region)
                except Exception as e:
                    print(f"  ERRO {rel}: {e}", flush=True)
                    failures.append(rel)
                    continue
                if a.bucket:
                    gcs_put(doc, dest)
                else:
                    Path(dest).parent.mkdir(parents=True, exist_ok=True)
                    Path(dest).write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")))
                print(f"  ok: {dest}", flush=True)
    if failures:
        print("falharam:", *failures, sep="\n  ")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
