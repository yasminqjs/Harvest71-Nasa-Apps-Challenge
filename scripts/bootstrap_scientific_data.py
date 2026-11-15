"""Bootstrap real FAO EcoCrop, FAO GAEZ v4 COGs, ISRIC SoilGrids, and audited Northeast NASA/Copernicus cache."""

from __future__ import annotations

import csv
from dataclasses import asdict
import json
from pathlib import Path
import sys
import time
from typing import Any

import requests

REPO_ROOT = Path(__file__).resolve().parents[1]
API_DIR = REPO_ROOT / "apps" / "api"
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.models.schemas import CropQualityRequest  # noqa: E402
from app.services.diagnostic_engine import (  # noqa: E402
    AUDITED_CACHE_PATH,
    PILOT_AREAS,
    _polygon_centroid,
    run_live_scientific_pipeline,
)
from app.services.soil_fao_service import (  # noqa: E402
    ECOCROP_CSV_PATH,
    GAEZ_CACHE_PATH,
    SOILGRIDS_CACHE_PATH,
    fetch_soil_profile,
    lookup_ecocrop,
    sample_gaez_v4_cogs,
)

ECOCROP_UPSTREAM_URL = "https://raw.githubusercontent.com/OpenCLIM/ecocrop/master/EcoCrop_DB.csv"
ECOCROP_INDEX_PATH = REPO_ROOT / "data" / "reference" / "fao_ecocrop_index.json"
FRONTEND_AUDITED_CACHE_TS = REPO_ROOT / "src" / "data" / "auditedNasaCache.ts"


def bootstrap_ecocrop() -> dict[str, Any]:
    print("[1/4] Downloading FAO EcoCrop dataset...")
    resp = requests.get(ECOCROP_UPSTREAM_URL, timeout=60.0)
    resp.raise_for_status()
    raw_lines = resp.text.splitlines()
    reader = csv.DictReader(raw_lines)
    if not reader.fieldnames:
        raise RuntimeError("Downloaded EcoCrop CSV has empty header.")

    fieldnames = list(reader.fieldnames)
    if "SCIENTNAME" not in fieldnames:
        fieldnames.append("SCIENTNAME")

    rows: list[dict[str, str]] = []
    index_by_species: dict[str, dict[str, Any]] = {}
    for row in reader:
        sci = (row.get("ScientificName") or row.get("SCIENTNAME") or "").strip()
        row["SCIENTNAME"] = sci
        rows.append(row)
        if sci and row.get("TMIN") and row.get("RMIN"):
            index_by_species[sci] = {
                "common_name": (row.get("COMNAME") or "").strip(),
                "tmin": row.get("TMIN"),
                "topmn": row.get("TOPMN"),
                "topmx": row.get("TOPMX"),
                "tmax": row.get("TMAX"),
                "rmin": row.get("RMIN"),
                "ropmn": row.get("ROPMN"),
                "ropmx": row.get("ROPMX"),
                "gmin": row.get("GMIN"),
                "gmax": row.get("GMAX"),
                "phmin": row.get("PHMIN"),
                "phmax": row.get("PHMAX"),
            }

    ECOCROP_CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    with ECOCROP_CSV_PATH.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    ECOCROP_INDEX_PATH.write_text(
        json.dumps(
            {
                "source": ECOCROP_UPSTREAM_URL,
                "total_rows": len(rows),
                "indexed_species": index_by_species,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    for crop_probe in ["Feijão-caupi", "Milho", "Sorgo", "Mandioca", "Palma"]:
        entry = lookup_ecocrop(crop_probe)
        print(
            f"  - Verified EcoCrop lookup '{crop_probe}' -> {entry.scientific_name} "
            f"(Tbase={entry.t_base_c}C, Topt={entry.t_opt_min_c}-{entry.t_opt_max_c}C, "
            f"GMIN={entry.cycle_days_min}d, Rmin={entry.r_min_mm}mm)"
        )

    return {"rows": len(rows), "indexed_species": len(index_by_species)}


def bootstrap_soilgrids_and_gaez() -> None:
    print("[2/4] Fetching ISRIC SoilGrids v2.0 + Saxton & Rawls (2006) & sampling FAO GAEZ v4 COGs...")
    soil_records: list[dict[str, Any]] = []
    gaez_records: list[dict[str, Any]] = []

    for idx, pilot in enumerate(PILOT_AREAS):
        lat, lon = _polygon_centroid(pilot["polygon_coordinates"])
        print(f"  - Pilot {pilot['id']} ({lat:.4f}, {lon:.4f})")

        # ISRIC SoilGrids REST (with gentle pacing to avoid HTTP 429)
        soil_profile = None
        for attempt in range(4):
            try:
                soil_profile = fetch_soil_profile(lat, lon, prefer_cache=False)
                break
            except Exception as exc:
                print(f"    ! SoilGrids attempt {attempt + 1} failed: {exc}")
                time.sleep(4.0 * (attempt + 1))
        if soil_profile is None:
            raise RuntimeError(f"Failed SoilGrids fetch for {pilot['id']}")

        soil_records.append(
            {
                "pilot_id": pilot["id"],
                "lat": lat,
                "lon": lon,
                "profile": asdict(soil_profile),
            }
        )
        print(
            f"    SoilGrids: clay={soil_profile.clay_pct}%, sand={soil_profile.sand_pct}%, "
            f"OC={soil_profile.soc_g_kg}g/kg, pH={soil_profile.ph_h2o}, "
            f"theta_WP={soil_profile.theta_wp}, theta_FC={soil_profile.theta_fc}"
        )

        # FAO GAEZ v4 COGs
        cog_values = sample_gaez_v4_cogs(lat, lon)
        gaez_records.append(
            {
                "pilot_id": pilot["id"],
                "lat": lat,
                "lon": lon,
                "cog_values": cog_values,
            }
        )
        print(f"    GAEZ COGs: {cog_values}")

        if idx < len(PILOT_AREAS) - 1:
            time.sleep(2.5)

    SOILGRIDS_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    SOILGRIDS_CACHE_PATH.write_text(json.dumps(soil_records, ensure_ascii=False, indent=2), encoding="utf-8")
    GAEZ_CACHE_PATH.write_text(json.dumps(gaez_records, ensure_ascii=False, indent=2), encoding="utf-8")


def bootstrap_audited_cache() -> None:
    print("[3/4] Running live NASA POWER + Sentinel-2 + Landsat + NASADEM pipeline for Northeast pilots...")
    audited_entries: list[dict[str, Any]] = []

    for pilot in PILOT_AREAS:
        lat, lon = _polygon_centroid(pilot["polygon_coordinates"])
        req = CropQualityRequest(
            polygon_coordinates=pilot["polygon_coordinates"],
            crop_name=pilot["crop_name"],
            water_regime=pilot["water_regime"],
            community_pest_alert=False,
            use_cache_fallback=False,
            prefer_audited_cache=False,
        )
        resp = run_live_scientific_pipeline(req, prefer_soil_gaez_cache=True)
        resp_dict = resp.model_dump()
        resp_dict["cache_metadata"] = {
            "fallback_used": False,
            "reason": "audited_live_capture",
            "pilot_id": pilot["id"],
        }
        audited_entries.append(
            {
                "pilot_id": pilot["id"],
                "name": pilot["name"],
                "municipality": pilot["municipality"],
                "state": pilot["state"],
                "area_ha": pilot["area_ha"],
                "centroid": {"lat": lat, "lon": lon},
                "response": resp_dict,
            }
        )
        t = resp.scientific_telemetry.biophysical_indices
        print(
            f"  - {pilot['id']}: status={resp.farmer_accessible_view.overall_traffic_light}, "
            f"score={resp.farmer_accessible_view.health_score_0_to_100}, "
            f"NDVI={t.ndvi_mean}, Z={t.ndvi_phenological_z_score}, CWSI={t.cwsi_jackson_index}, "
            f"GWETROOT={t.nasa_gwetroot_0_to_1}, Ks={t.fao56_ks_water_stress_coeff}",
            flush=True,
        )

    AUDITED_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    AUDITED_CACHE_PATH.write_text(json.dumps(audited_entries, ensure_ascii=False, indent=2), encoding="utf-8")

    print("[4/4] Writing TypeScript offline audited bundle to src/data/auditedNasaCache.ts...")
    frontend_pilots = []
    for pilot, cached in zip(PILOT_AREAS, audited_entries):
        frontend_pilots.append(
            {
                "id": pilot["id"],
                "name": pilot["name"],
                "municipality": pilot["municipality"],
                "state": pilot["state"],
                "area_ha": pilot["area_ha"],
                "crop_name": pilot["crop_name"],
                "water_regime": pilot["water_regime"],
                "polygon_coordinates": pilot["polygon_coordinates"],
                "centroid": cached["centroid"],
                "audited_diagnosis": cached["response"],
            }
        )

    ts_content = (
        "// Auto-generated by scripts/bootstrap_scientific_data.py from real NASA POWER, "
        "Sentinel-2, Landsat C2, NASADEM, FAO EcoCrop/GAEZ v4, and ISRIC SoilGrids.\n"
        "// Do not hand-edit numbers.\n"
        "import type { PilotAreaPreset } from '../types/domain';\n\n"
        f"export const PILOT_AREAS_AUDITED: PilotAreaPreset[] = {json.dumps(frontend_pilots, ensure_ascii=False, indent=2)};\n"
    )
    FRONTEND_AUDITED_CACHE_TS.parent.mkdir(parents=True, exist_ok=True)
    FRONTEND_AUDITED_CACHE_TS.write_text(ts_content, encoding="utf-8")


if __name__ == "__main__":
    skip_download = "--skip-download" in sys.argv
    if (
        skip_download
        and ECOCROP_CSV_PATH.exists()
        and SOILGRIDS_CACHE_PATH.exists()
        and GAEZ_CACHE_PATH.exists()
    ):
        print("Skipping EcoCrop/SoilGrids/GAEZ download (cached files present).", flush=True)
    else:
        bootstrap_ecocrop()
        bootstrap_soilgrids_and_gaez()
    bootstrap_audited_cache()
    print("Bootstrap complete! All real datasets & audited Northeast caches generated.", flush=True)
