"""Automated tests for NASA/FAO scientific backend, cache fallback latency, and MVP contract."""

from __future__ import annotations

import time
from fastapi.testclient import TestClient

from app.main import API_VERSION, app
from app.services.diagnostic_engine import PILOT_AREAS
from app.services.nasa_power_service import compute_fao56_et0_mm_day
from app.services.soil_fao_service import ECOCROP_CSV_PATH, lookup_ecocrop, saxton_rawls_2006

client = TestClient(app)


def test_health_and_version_and_no_simulate(monkeypatch):
    r_health = client.get("/health")
    assert r_health.status_code == 200
    assert r_health.json() == {"status": "ok"}

    monkeypatch.setenv("GIT_COMMIT", "testsha123")
    r_ver = client.get("/version")
    assert r_ver.status_code == 200
    assert r_ver.json() == {
        "service": "fieldshift-api",
        "version": API_VERSION,
        "commit": "testsha123",
    }

    assert client.post("/simulate").status_code == 404
    assert client.post("/api/v1/simulations").status_code == 404


def test_ecocrop_dynamic_lookup_zero_hardcoding():
    assert ECOCROP_CSV_PATH.exists()

    cowpea = lookup_ecocrop("Feijão-caupi")
    assert cowpea.scientific_name == "Vigna unguiculata"
    assert cowpea.t_base_c > 0
    assert cowpea.t_opt_min_c < cowpea.t_opt_max_c < cowpea.t_max_lethal_c
    assert cowpea.cycle_days_min >= 30

    maize = lookup_ecocrop("Milho")
    assert maize.scientific_name == "Zea mays"
    assert maize.r_min_mm > 0

    sorghum = lookup_ecocrop("Sorgo")
    assert sorghum.scientific_name == "Sorghum bicolor"

    cassava = lookup_ecocrop("Mandioca")
    assert cassava.scientific_name == "Manihot esculenta"


def test_saxton_rawls_2006_physical_bounds():
    wp_sand, fc_sand, sat_sand = saxton_rawls_2006(sand_pct=78.0, clay_pct=10.0, om_pct=1.0)
    wp_clay, fc_clay, sat_clay = saxton_rawls_2006(sand_pct=22.0, clay_pct=44.0, om_pct=2.2)

    assert 0.04 <= wp_sand < fc_sand < sat_sand <= 0.60
    assert 0.04 <= wp_clay < fc_clay < sat_clay <= 0.60
    assert wp_clay > wp_sand
    assert fc_clay > fc_sand


def test_fao56_penman_monteith_et0_range():
    et0, vpd = compute_fao56_et0_mm_day(
        lat_deg=-11.3055,
        elevation_m=720.0,
        doy=300,
        t_max_c=33.0,
        t_min_c=20.0,
        rh_mean_pct=45.0,
        rs_mj_m2_day=22.5,
        u2_m_s=2.4,
    )
    assert 3.0 <= et0 <= 9.0
    assert 0.5 <= vpd <= 4.0


def test_pilot_areas_and_sync_endpoints():
    r_pilots = client.get("/api/v1/crop-quality/pilot-areas")
    assert r_pilots.status_code == 200
    pilots = r_pilots.json()["pilot_areas"]
    assert len(pilots) == 3
    ids = {p["id"] for p in pilots}
    assert ids == {"irece-ba", "quixeramobim-ce", "juazeiro-ba"}
    for p in pilots:
        assert 0.1 < p["area_ha"] < 5.0
        assert p["audited_diagnosis"] is not None

    r_sync = client.post(
        "/api/fazendas/sincronizar",
        json={
            "fazenda_id": "farm-irece-01",
            "centroid": {"latitude": -11.3055, "longitude": -41.8552},
            "polygon": [],
            "cultura_principal": "Feijão-caupi",
            "raio_km": 5.0,
            "registros_pendentes": [{"tipo": "chuva_hoje", "choveuHoje": False}],
        },
    )
    assert r_sync.status_code == 200
    assert r_sync.json()["status"] == "sincronizado"
    assert r_sync.json()["registros_recebidos"] == 1


def test_analyze_crop_quality_cache_fallback_under_300ms():
    irece = PILOT_AREAS[0]
    custom_poly = [
        [-41.8560, -11.3046],
        [-41.8543, -11.3046],
        [-41.8543, -11.3063],
        [-41.8560, -11.3063],
        [-41.8560, -11.3046],
    ]

    started = time.perf_counter()
    resp = client.post(
        "/api/v1/crop-quality/analyze",
        json={
            "polygon_coordinates": custom_poly,
            "crop_name": "Milho",
            "water_regime": "RAINFED",
            "prefer_audited_cache": True,
        },
    )
    elapsed_ms = (time.perf_counter() - started) * 1000.0
    assert resp.status_code == 200
    assert elapsed_ms < 300.0, f"Audited cache fallback took {elapsed_ms:.1f}ms >= 300ms"

    body = resp.json()
    assert body["farmer_accessible_view"]["overall_traffic_light"] in {"RED", "YELLOW", "GREEN"}
    assert "Olhamos sua roça" in body["farmer_accessible_view"]["voice_tts_script_pt"]
    assert len(body["farmer_accessible_view"]["visual_field_zones"]) == 3
    assert len(body["farmer_accessible_view"]["action_cards"]) >= 1

    # Verify visual_field_zones fit cleanly inside requested polygon bounding box
    lons = [p[0] for p in custom_poly]
    lats = [p[1] for p in custom_poly]
    for zone in body["farmer_accessible_view"]["visual_field_zones"]:
        for x, y in zone["polygon_geojson"]["coordinates"][0]:
            assert min(lons) - 1e-5 <= x <= max(lons) + 1e-5
            assert min(lats) - 1e-5 <= y <= max(lats) + 1e-5

    assert body["crop_agronomic_baseline"]["scientific_name"] == "Zea mays"
    assert "ndvi_mean" in body["scientific_telemetry"]["biophysical_indices"]
    assert "observed_lai_m2_m2" in body["dssat_state_vector"]
    assert len(body["scale_disclaimers"]) >= 1
    assert "EMATER" in body["human_in_the_loop_notice"]
    assert body["cache_metadata"]["fallback_used"] is True
    assert irece["id"] == body["cache_metadata"]["pilot_area_id"]


def test_cloud_cover_above_40pct_triggers_audited_fallback(monkeypatch):
    irece = PILOT_AREAS[0]
    from app.services import diagnostic_engine

    # Get a baseline response, then tamper clean_pixel_ratio < 0.60
    sample = diagnostic_engine.analyze_crop_quality(
        diagnostic_engine.CropQualityRequest(
            polygon_coordinates=irece["polygon_coordinates"],
            crop_name=irece["crop_name"],
            prefer_audited_cache=True,
        )
    )
    sample.scientific_telemetry.data_provenance[0]["clean_pixel_ratio"] = 0.42

    def _cloudy_live_pipeline(req):
        return sample

    monkeypatch.setattr(diagnostic_engine, "run_live_scientific_pipeline", _cloudy_live_pipeline)

    started = time.perf_counter()
    resp = client.post(
        "/api/v1/crop-quality/analyze",
        json={
            "polygon_coordinates": irece["polygon_coordinates"],
            "crop_name": irece["crop_name"],
            "use_cache_fallback": True,
            "prefer_audited_cache": False,
        },
    )
    elapsed_ms = (time.perf_counter() - started) * 1000.0
    assert resp.status_code == 200
    assert elapsed_ms < 300.0
    meta = resp.json()["cache_metadata"]
    assert meta["fallback_used"] is True
    assert "cloud_cover_exceeded_40pct" in meta["reason"]
