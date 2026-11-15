"""Projeções climáticas da NASA (NEX-GDDP-CMIP6) para complementar o NASA POWER no DSSAT.

Fonte: NASA Earth Exchange Global Daily Downscaled Projections, CMIP6 (NEX-GDDP-CMIP6, v2.0),
NASA Ames, servidas pelo THREDDS do NASA Center for Climate Simulation (NCCS).
Diário, 0,25°, 1950–2014 (historical) e 2015–2100 (SSP1-2.6, SSP2-4.5, SSP3-7.0, SSP5-8.5), licença CC0.
Citação: Thrasher, B. et al. (2022). NASA Global Daily Downscaled Projections, CMIP6.
Scientific Data 9, 262. https://doi.org/10.1038/s41597-022-01393-4

Método (delta mensal, "change factor"):
  1. Para cada modelo, média mensal de 20 anos no histórico (1995–2014) e no período futuro.
  2. Mudança por mês: temperatura máx./mín. somada (°C); chuva e radiação multiplicadas (razão).
  3. A mudança é aplicada à série diária observada do NASA POWER (1991–2025) do mesmo ponto.
Assim o resultado futuro é comparável, safra a safra, com o resultado atual (mesma base POWER),
e o viés do modelo climático se cancela. Limite: a variabilidade diária e a sequência de anos
continuam as do clima observado; mudanças na frequência de secas longas não aparecem.

Regra da equipe: nenhum modelo de instituição chinesa (lista EXCLUDED_MODELS).
"""
from __future__ import annotations

import copy
import json
import math
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

THREDDS = "https://ds.nccs.nasa.gov/thredds"
ROOT = "AMES/NEX/GDDP-CMIP6"
SOURCE = ("NASA NEX-GDDP-CMIP6 v2.0 (NASA Earth Exchange / Ames; servidor THREDDS do NCCS), "
          "projeções diárias 0,25°; Thrasher et al. 2022, Scientific Data 9:262, doi:10.1038/s41597-022-01393-4")

HIST_YEARS = (1995, 2014)
PERIODS = {"2021-2040": (2021, 2040), "2041-2060": (2041, 2060),
           "2061-2080": (2061, 2080), "2081-2100": (2081, 2100)}
SCENARIOS = {
    "ssp126": "SSP1-2.6 (emissões baixas)",
    "ssp245": "SSP2-4.5 (emissões intermediárias)",
    "ssp370": "SSP3-7.0 (emissões altas)",
    "ssp585": "SSP5-8.5 (emissões muito altas)",
}

# Modelos do NEX-GDDP-CMIP6 permitidos (instituição de origem do modelo climático).
MODELS = {
    "GISS-E2-1-G": "NASA Goddard Institute for Space Studies (EUA)",
    "GFDL-ESM4": "NOAA Geophysical Fluid Dynamics Laboratory (EUA)",
    "MPI-ESM1-2-HR": "Max Planck Institute for Meteorology (Alemanha)",
    "MRI-ESM2-0": "Meteorological Research Institute (Japão)",
    "ACCESS-CM2": "CSIRO / ARCCSS (Austrália)",
    "CNRM-CM6-1": "CNRM-CERFACS (França)",
    "IPSL-CM6A-LR": "Institut Pierre-Simon Laplace (França)",
    "NorESM2-MM": "Norwegian Climate Consortium (Noruega)",
    "MIROC6": "MIROC (Japão)",
    "EC-Earth3": "EC-Earth Consortium (Europa)",
    "UKESM1-0-LL": "Met Office Hadley Centre / NERC (Reino Unido)",
    "CanESM5": "Canadian Centre for Climate Modelling and Analysis (Canadá)",
}
DEFAULT_MODELS = ["GISS-E2-1-G", "GFDL-ESM4", "MPI-ESM1-2-HR"]
EXCLUDED_MODELS = {
    "BCC-CSM2-MR": "Beijing Climate Center (China)",
    "FGOALS-g3": "Chinese Academy of Sciences (China)",
    "NESM3": "Nanjing University of Information Science and Technology (China)",
    "CAS-ESM2-0": "Chinese Academy of Sciences (China)",
    "CIESM": "Tsinghua University (China)",
    "TaiESM1": "Academia Sinica (Taiwan) — fora por precaução",
}

# variável NEX -> (nome interno, conversão para a unidade do POWER/DSSAT)
VARS = {
    "tasmax": ("TMAX", lambda v: v - 273.15),     # K -> °C
    "tasmin": ("TMIN", lambda v: v - 273.15),     # K -> °C
    "pr": ("RAIN", lambda v: v * 86400.0),        # kg m-2 s-1 -> mm/dia
    "rsds": ("SRAD", lambda v: v * 0.0864),       # W m-2 -> MJ m-2 dia-1
}
# Pré-processamento regional (Nordeste): um recorte por arquivo cobre todas as células da região,
# e o resultado (médias mensais por célula) fica no bucket. Ponto fora da região: baixa só a célula.
REGION = {"name": "nordeste", "north": -0.75, "south": -18.5, "west": -48.75, "east": -34.5}
REGIONAL_PREFIX = "nex-gddp-cmip6/v2"

RAIN_FACTOR_LIMITS = (0.25, 4.0)
SRAD_FACTOR_LIMITS = (0.7, 1.3)
DRY_MONTH_MM_DAY = 0.2   # mês quase sem chuva no histórico: razão instável, usa 1


def grid_cell(lat: float, lon: float) -> tuple[float, float]:
    """Centro da célula 0,25° do NEX-GDDP (centros em ±0,125 + k·0,25; longitude 0–360)."""
    clat = math.floor(lat / 0.25) * 0.25 + 0.125
    lon360 = lon % 360.0
    clon = math.floor(lon360 / 0.25) * 0.25 + 0.125
    return round(clat, 3), round(clon, 3)


def cell_key(lat: float, lon: float) -> str:
    clat, clon = grid_cell(lat, lon)
    return f"{clat:.3f}_{clon:.3f}"


def validate(scenario: str, period: str, models: list[str] | None) -> list[str]:
    if scenario not in SCENARIOS:
        raise ValueError(f"cenário desconhecido: {scenario}")
    if period not in PERIODS:
        raise ValueError(f"período desconhecido: {period}")
    models = list(models or DEFAULT_MODELS)
    for m in models:
        if m in EXCLUDED_MODELS:
            raise ValueError(f"modelo {m} excluído pela política da equipe ({EXCLUDED_MODELS[m]})")
        if m not in MODELS:
            raise ValueError(f"modelo desconhecido: {m}")
    return models


# ----------------------------------------------------------------------------- rede

def http_text(url: str, timeout: int = 120, tries: int = 4) -> str:
    last = None
    for i in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=timeout) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:  # servidor ocupado: espera e tenta de novo
            last = e
            time.sleep(2 * (i + 1))
    raise RuntimeError(f"falha ao baixar {url.split('?')[0]}: {last}")


def _catalog(path: str, get=http_text) -> tuple[list[str], list[str]]:
    """(subcatálogos, urlPaths de arquivos) de um catálogo THREDDS."""
    root = ET.fromstring(get(f"{THREDDS}/catalog/{ROOT}/{path}/catalog.xml"))
    refs, files = [], []
    for el in root.iter():
        tag = el.tag.rsplit("}", 1)[-1]
        if tag == "catalogRef":
            href = next((v for k, v in el.attrib.items() if k.endswith("href")), "")
            refs.append(href.replace("/catalog.xml", ""))
        elif tag == "dataset" and el.attrib.get("urlPath"):
            files.append(el.attrib["urlPath"])
    return refs, files


def list_files(model: str, experiment: str, var: str, get=http_text) -> dict[int, str]:
    """{ano: urlPath} — em versões repetidas do mesmo ano, fica a mais nova (v2.0 > v1.1)."""
    variants, _ = _catalog(f"{model}/{experiment}", get)
    if not variants:
        raise RuntimeError(f"{model}/{experiment}: sem membros no catálogo")
    _, files = _catalog(f"{model}/{experiment}/{sorted(variants)[0]}/{var}", get)
    out: dict[int, str] = {}
    for f in sorted(files):
        name = f.rsplit("/", 1)[-1]
        for part in name.replace(".nc", "").split("_"):
            if len(part) == 4 and part.isdigit():
                out[int(part)] = f   # ordenado: a versão mais nova sobrescreve
                break
    return out


def ncss_url(url_path: str, var: str, lat: float, lon: float) -> str:
    q = urllib.parse.urlencode({"var": var, "latitude": f"{lat:.4f}", "longitude": f"{lon:.4f}",
                                "temporal": "all", "accept": "csv"})
    return f"{THREDDS}/ncss/grid/{url_path}?{q}"


def parse_ncss_csv(text: str, var: str) -> list[tuple[int, int, float]]:
    """(ano, mês, valor convertido) por dia. Lê o mês do texto da data: aceita calendários
    de 365 e 360 dias (ex.: '2041-02-30') sem converter para date."""
    conv = VARS[var][1]
    out = []
    lines = text.strip().splitlines()
    if not lines or not lines[0].startswith("time"):
        raise ValueError("resposta NCSS inesperada")
    for line in lines[1:]:
        parts = line.split(",")
        if len(parts) < 5 or not parts[-1].strip():
            continue
        ts = parts[0]
        try:
            y, m, val = int(ts[0:4]), int(ts[5:7]), float(parts[-1])
        except ValueError:
            continue
        if math.isnan(val) or abs(val) > 1e19:
            continue
        out.append((y, m, conv(val)))
    return out


def monthly_climatology(rows: list[tuple[int, int, float]]) -> dict[int, float]:
    acc: dict[int, list[float]] = defaultdict(list)
    for _, m, v in rows:
        acc[m].append(v)
    if len(acc) < 12:
        raise ValueError("série sem os 12 meses")
    return {m: sum(v) / len(v) for m, v in sorted(acc.items())}


def climatology(model: str, experiment: str, years: tuple[int, int], lat: float, lon: float,
                get=http_text, workers: int = 12) -> dict:
    """Médias mensais (°C, mm/dia, MJ/m²/dia) de um modelo/experimento/período para a célula do ponto."""
    jobs = []
    for var in VARS:
        files = list_files(model, experiment, var, get)
        missing = [y for y in range(years[0], years[1] + 1) if y not in files]
        if missing:
            raise RuntimeError(f"{model}/{experiment}/{var}: faltam os anos {missing[:5]}")
        jobs += [(var, files[y]) for y in range(years[0], years[1] + 1)]

    def one(job):
        var, path = job
        return var, parse_ncss_csv(get(ncss_url(path, var, lat, lon)), var)

    rows: dict[str, list] = defaultdict(list)
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for var, r in ex.map(one, jobs):
            rows[var].extend(r)
    clat, clon = grid_cell(lat, lon)
    return {"model": model, "experiment": experiment, "years": list(years),
            "cell": {"lat": clat, "lon": clon if clon <= 180 else round(clon - 360, 3)},
            "monthly": {VARS[v][0]: {str(m): round(x, 4) for m, x in monthly_climatology(rows[v]).items()}
                        for v in VARS},
            "n_days": {VARS[v][0]: len(rows[v]) for v in VARS}}


def regional_blob(model: str, experiment: str, years: tuple[int, int], region: str = REGION["name"]) -> str:
    return f"{REGIONAL_PREFIX}/{region}/{model}/{experiment}_{years[0]}-{years[1]}.json"


def in_region(lat: float, lon: float, r: dict = REGION) -> bool:
    return r["south"] <= lat <= r["north"] and r["west"] <= lon <= r["east"]


def from_regional(doc: dict, lat: float, lon: float) -> dict | None:
    """Climatologia da célula mais próxima no arquivo regional (None se fora ou sem dado, ex.: mar)."""
    lats, lons = doc["lat"], doc["lon"]
    if not (min(lats) - 0.125 <= lat <= max(lats) + 0.125 and min(lons) - 0.125 <= lon <= max(lons) + 0.125):
        return None
    i = min(range(len(lats)), key=lambda k: abs(lats[k] - lat))
    j = min(range(len(lons)), key=lambda k: abs(lons[k] - lon))
    monthly = {}
    for var, grids in doc["monthly"].items():
        vals = [grids[m][i][j] for m in range(12)]
        if any(v is None for v in vals):
            return None
        monthly[var] = {str(m + 1): vals[m] for m in range(12)}
    return {"model": doc["model"], "experiment": doc["experiment"], "years": doc["years"],
            "cell": {"lat": lats[i], "lon": lons[j]}, "monthly": monthly,
            "n_days": doc.get("n_days"), "from": "regional"}


def month_index(n_days: int, leap: bool) -> list[int]:
    """Mês (1–12) de cada dia do arquivo anual, conforme o calendário do modelo (360, 365 ou 366 dias)."""
    if n_days == 360:
        return [d // 30 + 1 for d in range(360)]
    lens = [31, 29 if n_days == 366 or (leap and n_days != 365) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    out = []
    for m, n in enumerate(lens, 1):
        out += [m] * n
    if len(out) != n_days:
        raise ValueError(f"calendário inesperado: {n_days} dias")
    return out


# ----------------------------------------------------------------------------- deltas

def _ratio(fut: float, hist: float, limits: tuple[float, float], floor: float = 0.0) -> float:
    if hist <= floor:
        return 1.0
    return min(max(fut / hist, limits[0]), limits[1])


def monthly_deltas(hist: dict, fut: dict) -> dict[int, dict[str, float]]:
    h, f = hist["monthly"], fut["monthly"]
    out = {}
    for m in range(1, 13):
        k = str(m)
        out[m] = {
            "dTMAX": round(f["TMAX"][k] - h["TMAX"][k], 3),
            "dTMIN": round(f["TMIN"][k] - h["TMIN"][k], 3),
            "fRAIN": round(_ratio(f["RAIN"][k], h["RAIN"][k], RAIN_FACTOR_LIMITS, DRY_MONTH_MM_DAY), 4),
            "fSRAD": round(_ratio(f["SRAD"][k], h["SRAD"][k], SRAD_FACTOR_LIMITS), 4),
        }
    return out


def annual_summary(hist: dict, fut: dict, deltas: dict[int, dict[str, float]]) -> dict:
    """Mudança anual para mostrar ao usuário (chuva total e radiação ponderadas pelo histórico)."""
    h = hist["monthly"]
    days = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    rain_h = sum(h["RAIN"][str(m)] * days[m - 1] for m in range(1, 13))
    rain_f = sum(h["RAIN"][str(m)] * deltas[m]["fRAIN"] * days[m - 1] for m in range(1, 13))
    srad_h = sum(h["SRAD"][str(m)] for m in range(1, 13))
    srad_f = sum(h["SRAD"][str(m)] * deltas[m]["fSRAD"] for m in range(1, 13))
    return {
        "tmax_change_c": round(sum(d["dTMAX"] for d in deltas.values()) / 12, 2),
        "tmin_change_c": round(sum(d["dTMIN"] for d in deltas.values()) / 12, 2),
        "rain_change_pct": round(100 * (rain_f / rain_h - 1), 1) if rain_h > 0 else None,
        "srad_change_pct": round(100 * (srad_f / srad_h - 1), 1) if srad_h > 0 else None,
        "model_rain_hist_mm_year": round(rain_h, 0),
    }


def apply_to_power(power_doc: dict, deltas: dict[int, dict[str, float]]) -> dict:
    """Cópia do JSON do NASA POWER com as mudanças mensais aplicadas a cada dia.

    TMAX/TMIN/T2M somam o delta; chuva e radiação multiplicam; ponto de orvalho sobe com a
    temperatura média (umidade relativa ~ constante). Vento e umidade relativa não mudam.
    """
    doc = copy.deepcopy(power_doc)
    fill = float(doc.get("header", {}).get("fill_value", -999))
    par = doc["properties"]["parameter"]

    def upd(name, fn):
        series = par.get(name)
        if not series:
            return
        for k, v in series.items():
            if v is None or float(v) <= fill + 1e-6:
                continue
            series[k] = round(fn(int(k[4:6]), float(v)), 3)

    upd("T2M_MAX", lambda m, v: v + deltas[m]["dTMAX"])
    upd("T2M_MIN", lambda m, v: v + deltas[m]["dTMIN"])
    upd("T2M", lambda m, v: v + (deltas[m]["dTMAX"] + deltas[m]["dTMIN"]) / 2)
    upd("T2MDEW", lambda m, v: v + (deltas[m]["dTMAX"] + deltas[m]["dTMIN"]) / 2)
    upd("PRECTOTCORR", lambda m, v: max(0.0, v * deltas[m]["fRAIN"]))
    upd("ALLSKY_SFC_SW_DWN", lambda m, v: v * deltas[m]["fSRAD"])
    # garante TMIN < TMAX e orvalho ≤ TMIN depois do ajuste
    tx, tn, td = par.get("T2M_MAX", {}), par.get("T2M_MIN", {}), par.get("T2MDEW", {})
    for k in tx:
        a, b = tx.get(k), tn.get(k)
        if a is None or b is None or a <= fill + 1e-6 or b <= fill + 1e-6:
            continue
        if b >= a:
            tn[k] = round(a - 0.1, 3)
        d = td.get(k)
        if d is not None and d > fill + 1e-6 and d > tn[k]:
            td[k] = tn[k]
    doc.setdefault("header", {})["fieldshift_climate_projection"] = "NASA POWER + delta mensal NEX-GDDP-CMIP6"
    return doc


def ensemble(baseline: list[dict], per_model: list[dict]) -> list[dict]:
    """Por cenário de manejo (trno): mediana entre modelos e mudança em relação ao clima atual."""
    def med(xs):
        xs = sorted(x for x in xs if x is not None)
        if not xs:
            return None
        n = len(xs)
        return xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2

    base = {s["trno"]: s for s in baseline}
    out = []
    for trno, b in base.items():
        rows = [next((s for s in m["scenario_summary"] if s["trno"] == trno), None) for m in per_model]
        rows = [r for r in rows if r]
        p50 = med([r["yield_kg_ha"]["p50"] for r in rows])
        bp50 = b["yield_kg_ha"]["p50"]
        out.append({
            "trno": trno, "name": b["name"], "irrigated": b["irrigated"], "n_models": len(rows),
            "baseline_yield_p50": bp50,
            "future_yield_p50_median": p50,
            "future_yield_p50_range": [min(r["yield_kg_ha"]["p50"] for r in rows),
                                       max(r["yield_kg_ha"]["p50"] for r in rows)] if rows else None,
            "yield_change_pct": round(100 * (p50 / bp50 - 1), 1) if p50 is not None and bp50 else None,
            "baseline_share_below_1000": b.get("share_seasons_below_1000_kg_ha"),
            "future_share_below_1000_median": med([r.get("share_seasons_below_1000_kg_ha") for r in rows]),
            "models_with_loss": sum(1 for r in rows if bp50 and r["yield_kg_ha"]["p50"] < bp50),
        })
    return out


def windows_from_meta(meta: dict) -> list[tuple[int, int]]:
    """Janelas de plantio (mês, dia) do resultado atual, para o futuro usar as mesmas."""
    seen = []
    for s in meta["scenarios"]:
        if s["irrigated"]:
            continue
        m, d = (int(x) for x in s["planting_mm_dd"].split("-"))
        if (m, d) not in seen:
            seen.append((m, d))
    return seen


def to_json(obj) -> str:
    return json.dumps(obj, ensure_ascii=False)
