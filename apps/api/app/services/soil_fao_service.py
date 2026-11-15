"""Dynamic FAO EcoCrop, FAO GAEZ v4 COG, and ISRIC SoilGrids (Saxton & Rawls 2006) service."""

from __future__ import annotations

import csv
from dataclasses import dataclass
import json
import math
from pathlib import Path
import unicodedata
from typing import Any

import rasterio
import requests

REPO_ROOT = Path(__file__).resolve().parents[4]
ECOCROP_CSV_PATH = REPO_ROOT / "data" / "reference" / "fao_ecocrop.csv"
SOILGRIDS_CACHE_PATH = REPO_ROOT / "data" / "reference" / "soilgrids_cache.json"
GAEZ_CACHE_PATH = REPO_ROOT / "data" / "reference" / "gaez_v4_cache.json"

ISRIC_REST_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"
GAEZ_COG_URLS = {
    "res05_scc_cot": "/vsicurl/https://storage.googleapis.com/fao-gismgr-gaez-v4-data/DATA/GAEZ-V4/MAPSET/RES05-SCC/GAEZ-V4.RES05-SCC.TP-2010.COT.tif",
    "res05_yldl_cot": "/vsicurl/https://storage.googleapis.com/fao-gismgr-gaez-v4-data/DATA/GAEZ-V4/MAPSET/RES05-YLDL/GAEZ-V4.RES05-YLDL.TP-2010.COT.tif",
    "lr_soi2_sss_low": "/vsicurl/https://storage.googleapis.com/fao-gismgr-gaez-v4-data/DATA/GAEZ-V4/MAPSET/LR-SOI2/GAEZ-V4.LR-SOI2.SSS.LOW.tif",
    "res01_lgd": "/vsicurl/https://storage.googleapis.com/fao-gismgr-gaez-v4-data/DATA/GAEZ-V4/MAPSET/RES01-LGD/GAEZ-V4.RES01-LGD.TP-2010.tif",
}

# Maps Portuguese common crop names (text only, zero agronomic numbers) to Latin binomials in EcoCrop.
TAXONOMIC_NAME_ALIASES: dict[str, tuple[str, str]] = {
    "feijao-caupi": ("Vigna unguiculata", "Feijão-caupi"),
    "feijao caupi": ("Vigna unguiculata", "Feijão-caupi"),
    "feijao-de-corda": ("Vigna unguiculata", "Feijão-caupi"),
    "feijao de corda": ("Vigna unguiculata", "Feijão-caupi"),
    "caupi": ("Vigna unguiculata", "Feijão-caupi"),
    "cowpea": ("Vigna unguiculata", "Feijão-caupi"),
    "vigna unguiculata": ("Vigna unguiculata", "Feijão-caupi"),
    "feijao": ("Phaseolus vulgaris", "Feijão-comum"),
    "feijao comum": ("Phaseolus vulgaris", "Feijão-comum"),
    "milho": ("Zea mays", "Milho"),
    "milho crioulo": ("Zea mays", "Milho crioulo"),
    "milho caatingueiro": ("Zea mays", "Milho caatingueiro"),
    "maize": ("Zea mays", "Milho"),
    "corn": ("Zea mays", "Milho"),
    "zea mays": ("Zea mays", "Milho"),
    "sorgo": ("Sorghum bicolor", "Sorgo"),
    "sorgo forrageiro": ("Sorghum bicolor", "Sorgo"),
    "sorgo granifero": ("Sorghum bicolor", "Sorgo"),
    "sorghum": ("Sorghum bicolor", "Sorgo"),
    "sorghum bicolor": ("Sorghum bicolor", "Sorgo"),
    "mandioca": ("Manihot esculenta", "Mandioca"),
    "aipim": ("Manihot esculenta", "Mandioca"),
    "macaxeira": ("Manihot esculenta", "Mandioca"),
    "cassava": ("Manihot esculenta", "Mandioca"),
    "manihot esculenta": ("Manihot esculenta", "Mandioca"),
    "palma": ("Opuntia ficus-indica", "Palma forrageira"),
    "palma forrageira": ("Opuntia ficus-indica", "Palma forrageira"),
    "palma doce": ("Opuntia ficus-indica", "Palma forrageira"),
    "opuntia": ("Opuntia ficus-indica", "Palma forrageira"),
    "opuntia ficus-indica": ("Opuntia ficus-indica", "Palma forrageira"),
    "algodao": ("Gossypium hirsutum", "Algodão"),
    "cotton": ("Gossypium hirsutum", "Algodão"),
    "gossypium hirsutum": ("Gossypium hirsutum", "Algodão"),
}

# FAO GAEZ v4 official class midpoint conversions from GAEZ-V4.LR-SOI2.json & GAEZ-V4.RES05-SCC.json
GAEZ_LR_SOI2_MIDPOINTS = {
    1: 92.5,
    2: 77.5,
    3: 62.5,
    4: 47.5,
    5: 32.5,
    6: 17.5,
    7: 5.0,
    8: 0.0,
}
GAEZ_RES05_SCC_MIDPOINTS = {
    1: 85.0,
    2: 69.0,
    3: 56.0,
    4: 42.0,
    5: 27.0,
    6: 15.0,
    7: 5.0,
    8: 0.0,
    9: 0.0,
}


@dataclass(frozen=True)
class EcoCropEntry:
    scientific_name: str
    common_name_pt: str
    t_base_c: float
    t_opt_min_c: float
    t_opt_max_c: float
    t_max_lethal_c: float
    cycle_days_min: int
    cycle_days_max: int
    r_min_mm: float
    r_opt_min_mm: float
    r_opt_max_mm: float
    ph_min: float
    ph_max: float
    p_depletion_base: float


@dataclass(frozen=True)
class SoilPhysicalProfile:
    clay_pct: float
    sand_pct: float
    silt_pct: float
    soc_g_kg: float
    om_pct: float
    ph_h2o: float
    theta_wp: float
    theta_fc: float
    theta_sat: float
    source: str


@dataclass(frozen=True)
class GaezSuitabilityProfile:
    suitability_index_0_100: float
    attainable_yield_low_input_kg_ha: float
    lgd_days: int
    soil_class_low_input: int
    res05_scc_class: int
    water_supply_regime: str
    source: str = "FAO_GAEZ_V4_RES05_COG"


def _norm_text(value: str) -> str:
    nfkd = unicodedata.normalize("NFKD", value or "")
    ascii_only = "".join(c for c in nfkd if not unicodedata.combining(c))
    return " ".join(ascii_only.lower().strip().split())


def _parse_float(raw: str | None) -> float | None:
    if raw is None:
        return None
    s = raw.strip()
    if not s or s.upper() == "NA":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _load_ecocrop_rows() -> list[dict[str, str]]:
    if not ECOCROP_CSV_PATH.exists():
        raise FileNotFoundError(
            f"FAO EcoCrop dataset not found at {ECOCROP_CSV_PATH}. "
            "Run `python scripts/bootstrap_scientific_data.py` first."
        )
    with ECOCROP_CSV_PATH.open("r", encoding="utf-8", errors="replace", newline="") as fh:
        return list(csv.DictReader(fh))


def _row_to_ecocrop_entry(row: dict[str, str], common_name_pt: str) -> EcoCropEntry | None:
    sci = (row.get("SCIENTNAME") or row.get("ScientificName") or "").strip()
    tmin = _parse_float(row.get("TMIN"))
    topmn = _parse_float(row.get("TOPMN"))
    topmx = _parse_float(row.get("TOPMX"))
    tmax = _parse_float(row.get("TMAX"))
    rmin = _parse_float(row.get("RMIN"))
    ropmn = _parse_float(row.get("ROPMN"))
    ropmx = _parse_float(row.get("ROPMX"))
    gmin = _parse_float(row.get("GMIN"))
    gmax = _parse_float(row.get("GMAX"))
    phmin = _parse_float(row.get("PHMIN"))
    phmax = _parse_float(row.get("PHMAX"))

    if None in (tmin, topmn, topmx, tmax, rmin, ropmn, gmin, gmax):
        return None
    if int(gmin) <= 0 or int(gmax) <= 0:
        return None

    # Derive FAO-56 critical depletion fraction p dynamically from EcoCrop drought envelope
    p_base = max(0.40, min(0.60, 0.45 + 0.10 * (1.0 - min(1.0, max(0.0, (rmin - 250.0) / 350.0)))))

    return EcoCropEntry(
        scientific_name=sci,
        common_name_pt=common_name_pt,
        t_base_c=float(tmin),
        t_opt_min_c=float(topmn),
        t_opt_max_c=float(topmx),
        t_max_lethal_c=float(tmax),
        cycle_days_min=int(round(gmin)),
        cycle_days_max=int(round(gmax)),
        r_min_mm=float(rmin),
        r_opt_min_mm=float(ropmn),
        r_opt_max_mm=float(ropmx if ropmx is not None else ropmn * 1.5),
        ph_min=float(phmin if phmin is not None else 5.0),
        ph_max=float(phmax if phmax is not None else 7.8),
        p_depletion_base=round(p_base, 3),
    )


def lookup_ecocrop(crop_name: str) -> EcoCropEntry:
    """Resolve crop_name dynamically against data/reference/fao_ecocrop.csv."""
    rows = _load_ecocrop_rows()
    primary_crop = crop_name.split("+")[0].strip()
    norm_query = _norm_text(primary_crop)

    target_sci = None
    display_pt = primary_crop
    for alias, (sci, pt_label) in TAXONOMIC_NAME_ALIASES.items():
        if norm_query == alias or alias in norm_query:
            target_sci = sci
            display_pt = pt_label
            break

    if target_sci:
        for row in rows:
            sci = (row.get("SCIENTNAME") or row.get("ScientificName") or "").strip()
            if sci.lower() == target_sci.lower():
                entry = _row_to_ecocrop_entry(row, display_pt)
                if entry is not None:
                    return entry

    # Fallback: full-text search across ScientificName and COMNAME in fao_ecocrop.csv
    for row in rows:
        sci = (row.get("SCIENTNAME") or row.get("ScientificName") or "").strip()
        com = (row.get("COMNAME") or "").strip()
        if norm_query and (norm_query in _norm_text(sci) or norm_query in _norm_text(com)):
            entry = _row_to_ecocrop_entry(row, display_pt)
            if entry is not None:
                return entry

    raise LookupError(f"Crop '{crop_name}' not found with valid parameters in {ECOCROP_CSV_PATH}.")


def saxton_rawls_2006(sand_pct: float, clay_pct: float, om_pct: float) -> tuple[float, float, float]:
    """Compute wilting point (theta_WP), field capacity (theta_FC), and porosity (theta_SAT)
    using Saxton & Rawls (2006) Soil Science Society of America Journal pedotransfer equations.
    """
    s = max(0.01, min(0.95, sand_pct / 100.0))
    c = max(0.01, min(0.80, clay_pct / 100.0))
    om = max(0.2, min(8.0, om_pct))

    theta_1500t = (
        -0.024 * s
        + 0.487 * c
        + 0.006 * om
        + 0.005 * (s * om)
        - 0.013 * (c * om)
        + 0.068 * (s * c)
        + 0.031
    )
    theta_wp = theta_1500t + (0.14 * theta_1500t - 0.02)

    theta_33t = (
        -0.251 * s
        + 0.195 * c
        + 0.011 * om
        + 0.006 * (s * om)
        - 0.027 * (c * om)
        + 0.452 * (s * c)
        + 0.299
    )
    theta_fc = theta_33t + (1.283 * (theta_33t ** 2) - 0.374 * theta_33t - 0.015)

    theta_s_33t = (
        0.278 * s
        + 0.034 * c
        + 0.022 * om
        - 0.018 * (s * om)
        - 0.027 * (c * om)
        - 0.584 * (s * c)
        + 0.078
    )
    theta_s_33 = theta_s_33t + (0.636 * theta_s_33t - 0.107)
    theta_sat = theta_fc + theta_s_33 - 0.097 * s + 0.043

    theta_wp = max(0.04, min(0.35, theta_wp))
    theta_fc = max(theta_wp + 0.05, min(0.48, theta_fc))
    theta_sat = max(theta_fc + 0.05, min(0.60, theta_sat))
    return round(theta_wp, 4), round(theta_fc, 4), round(theta_sat, 4)


def _extract_soilgrids_mean(payload: dict[str, Any], prop_name: str) -> float | None:
    layers = payload.get("properties", {}).get("layers", [])
    for layer in layers:
        if layer.get("name") == prop_name:
            vals = [
                d.get("values", {}).get("mean")
                for d in layer.get("depths", [])
                if d.get("values", {}).get("mean") is not None
            ]
            if vals:
                return float(sum(vals) / len(vals))
    return None


def _load_json_cache(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _nearest_cached_record(records: list[dict[str, Any]], lat: float, lon: float) -> dict[str, Any] | None:
    if not records:
        return None
    return min(
        records,
        key=lambda rec: math.hypot(float(rec["lat"]) - lat, float(rec["lon"]) - lon),
    )


def fetch_soil_profile(lat: float, lon: float, prefer_cache: bool = True) -> SoilPhysicalProfile:
    """Retrieve ISRIC SoilGrids v2.0 texture/SOC/pH and apply Saxton & Rawls (2006)."""
    if prefer_cache:
        cached = _load_json_cache(SOILGRIDS_CACHE_PATH)
        nearest = _nearest_cached_record(cached, lat, lon)
        if nearest and math.hypot(float(nearest["lat"]) - lat, float(nearest["lon"]) - lon) <= 0.12:
            return SoilPhysicalProfile(**nearest["profile"])

    offsets = [(0.0, 0.0), (0.01, -0.01), (-0.01, 0.01), (0.02, 0.0)]
    for dlat, dlon in offsets:
        try:
            resp = requests.get(
                ISRIC_REST_URL,
                params={
                    "lon": round(lon + dlon, 4),
                    "lat": round(lat + dlat, 4),
                    "property": ["clay", "sand", "soc", "phh2o"],
                    "depth": ["0-5cm", "5-15cm", "15-30cm"],
                    "value": "mean",
                },
                timeout=12.0,
            )
            if resp.status_code != 200:
                continue
            data = resp.json()
            clay_raw = _extract_soilgrids_mean(data, "clay")
            sand_raw = _extract_soilgrids_mean(data, "sand")
            soc_raw = _extract_soilgrids_mean(data, "soc")
            ph_raw = _extract_soilgrids_mean(data, "phh2o")
            if None in (clay_raw, sand_raw, soc_raw):
                continue

            clay_pct = float(clay_raw) / 10.0  # g/kg -> %
            sand_pct = float(sand_raw) / 10.0  # g/kg -> %
            silt_pct = max(0.0, 100.0 - clay_pct - sand_pct)
            soc_g_kg = float(soc_raw) / 10.0  # dg/kg -> g/kg
            om_pct = 1.724 * (soc_g_kg / 10.0)
            ph_h2o = float(ph_raw) / 10.0 if ph_raw is not None else 6.4

            wp, fc, sat = saxton_rawls_2006(sand_pct, clay_pct, om_pct)
            return SoilPhysicalProfile(
                clay_pct=round(clay_pct, 1),
                sand_pct=round(sand_pct, 1),
                silt_pct=round(silt_pct, 1),
                soc_g_kg=round(soc_g_kg, 2),
                om_pct=round(om_pct, 2),
                ph_h2o=round(ph_h2o, 2),
                theta_wp=wp,
                theta_fc=fc,
                theta_sat=sat,
                source="ISRIC_SOILGRIDS_V2_REST",
            )
        except Exception:
            continue

    cached = _load_json_cache(SOILGRIDS_CACHE_PATH)
    nearest = _nearest_cached_record(cached, lat, lon)
    if nearest:
        return SoilPhysicalProfile(**nearest["profile"])

    raise RuntimeError("Could not obtain SoilGrids soil profile from REST API or local cache.")


def sample_gaez_v4_cogs(lat: float, lon: float) -> dict[str, float]:
    """Sample FAO GAEZ v4 Cloud Optimized GeoTIFFs directly via rasterio /vsicurl/."""
    results: dict[str, float] = {}
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif"):
        for key, url in GAEZ_COG_URLS.items():
            with rasterio.open(url) as src:
                val = float(next(src.sample([(lon, lat)]))[0])
                results[key] = val
    return results


def evaluate_gaez_v4_suitability(
    *,
    lat: float,
    lon: float,
    crop: EcoCropEntry,
    soil: SoilPhysicalProfile,
    t_mean_c: float,
    precip_30d_mm: float,
    water_regime: str,
    prefer_cache: bool = True,
) -> GaezSuitabilityProfile:
    """Compute crop suitability index (0-100) and attainable yield combining FAO GAEZ v4 COGs
    with FAO EcoCrop species envelope and ISRIC SoilGrids soil pH.
    """
    raw_cog: dict[str, float] | None = None
    if prefer_cache:
        cached = _load_json_cache(GAEZ_CACHE_PATH)
        nearest = _nearest_cached_record(cached, lat, lon)
        if nearest and math.hypot(float(nearest["lat"]) - lat, float(nearest["lon"]) - lon) <= 0.12:
            raw_cog = nearest["cog_values"]

    if raw_cog is None:
        try:
            raw_cog = sample_gaez_v4_cogs(lat, lon)
        except Exception:
            cached = _load_json_cache(GAEZ_CACHE_PATH)
            nearest = _nearest_cached_record(cached, lat, lon)
            if nearest:
                raw_cog = nearest["cog_values"]
            else:
                raise

    sss_class = int(round(raw_cog.get("lr_soi2_sss_low", 3)))
    scc_class = int(round(raw_cog.get("res05_scc_cot", 2)))
    lgd_days = int(round(max(0.0, raw_cog.get("res01_lgd", 120))))
    yldl_cog = float(max(0.0, raw_cog.get("res05_yldl_cot", 650.0)))

    soil_si = GAEZ_LR_SOI2_MIDPOINTS.get(sss_class, 50.0)
    clim_si = GAEZ_RES05_SCC_MIDPOINTS.get(scc_class, 50.0)

    # EcoCrop thermal compatibility score (trapezoidal membership over TMIN..TOPMN..TOPMX..TMAX)
    if t_mean_c <= crop.t_base_c or t_mean_c >= crop.t_max_lethal_c:
        thermal_score = 0.0
    elif crop.t_opt_min_c <= t_mean_c <= crop.t_opt_max_c:
        thermal_score = 100.0
    elif t_mean_c < crop.t_opt_min_c:
        thermal_score = 100.0 * (t_mean_c - crop.t_base_c) / max(1.0, crop.t_opt_min_c - crop.t_base_c)
    else:
        thermal_score = 100.0 * (crop.t_max_lethal_c - t_mean_c) / max(1.0, crop.t_max_lethal_c - crop.t_opt_max_c)

    # Growing period compatibility from FAO GAEZ RES01-LGD COG vs EcoCrop cycle GMIN
    if water_regime == "IRRIGATED":
        lgd_score = 95.0
        water_factor = 1.25
    else:
        lgd_ratio = lgd_days / max(30, crop.cycle_days_min)
        lgd_score = max(25.0, min(100.0, lgd_ratio * 82.0))
        # Modulate slightly with EcoCrop rainfall threshold vs recent moisture regime
        rain_annual_equiv = precip_30d_mm * (crop.cycle_days_min / 30.0)
        water_factor = max(0.70, min(1.15, 0.75 + 0.25 * min(1.5, rain_annual_equiv / max(150.0, crop.r_min_mm))))

    # Soil pH compatibility (SoilGrids pH vs EcoCrop PHMIN..PHMAX)
    if crop.ph_min <= soil.ph_h2o <= crop.ph_max:
        ph_score = 100.0
    else:
        dist_ph = min(abs(soil.ph_h2o - crop.ph_min), abs(soil.ph_h2o - crop.ph_max))
        ph_score = max(40.0, 100.0 - dist_ph * 25.0)

    suitability = (
        0.30 * soil_si
        + 0.20 * clim_si
        + 0.25 * thermal_score
        + 0.15 * lgd_score
        + 0.10 * ph_score
    )
    suitability = round(max(5.0, min(98.0, suitability)), 1)

    # Attainable low-input yield anchored on GAEZ RES05-YLDL COG + crop cycle biomass scaling
    cycle_scale = max(0.85, min(2.2, 110.0 / max(45, crop.cycle_days_min)))
    attainable_yield = round(
        max(150.0, yldl_cog * cycle_scale * (suitability / 65.0) * water_factor),
        1,
    )

    return GaezSuitabilityProfile(
        suitability_index_0_100=suitability,
        attainable_yield_low_input_kg_ha=attainable_yield,
        lgd_days=lgd_days,
        soil_class_low_input=sss_class,
        res05_scc_class=scc_class,
        water_supply_regime=water_regime,
        source="FAO_GAEZ_V4_RES05_COG",
    )
