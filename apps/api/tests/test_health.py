import json

from fastapi.testclient import TestClient

from app.main import API_VERSION, app

client = TestClient(app)


def test_health_ok():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_version_reports_commit(monkeypatch):
    monkeypatch.setenv("GIT_COMMIT", "abc1234")
    r = client.get("/version")
    assert r.status_code == 200
    body = r.json()
    assert body["service"] == "fieldshift-api"
    assert body["version"] == API_VERSION
    assert body["commit"] == "abc1234"


def test_version_unknown_commit_by_default(monkeypatch):
    monkeypatch.delenv("GIT_COMMIT", raising=False)
    assert client.get("/version").json()["commit"] == "unknown"


def test_no_unprotected_simulation_endpoint():
    # Rotas que iniciam jobs só existem com chave: nenhum caminho alternativo aberto.
    assert client.post("/simulate").status_code == 404
    assert client.post("/api/v1/simulations").status_code == 404


SAMPLE = {
    "generated_utc": "20261115T000000Z",
    "crop": "milho (CERES-Maize)",
    "dssat_build": {"dssat_csm_os": "25c93b9"},
    "sites": [{"site": "JUAZ", "title": "Juazeiro-BA", "lat": -9.41, "lon": -40.5,
               "seasons": {"n_years": 33}, "scenario_summary": [{"trno": 1}],
               "evidence": {"is_actual_forecast": False}, "assumptions": {"cultivar": "x"}}],
}


def test_scenarios_list(monkeypatch):
    import app.main as m
    monkeypatch.setattr(m, "_load_scenarios", lambda: SAMPLE)
    body = client.get("/scenarios").json()
    assert body["sites"][0]["site"] == "JUAZ"
    assert "assumptions" not in body["sites"][0]   # lista é enxuta


def test_scenarios_site_and_404(monkeypatch):
    import app.main as m
    monkeypatch.setattr(m, "_load_scenarios", lambda: SAMPLE)
    assert client.get("/scenarios/juaz").json()["assumptions"] == {"cultivar": "x"}
    assert client.get("/scenarios/XXXX").status_code == 404


def test_scenarios_is_read_only():
    assert client.post("/scenarios").status_code == 405


# ----------------------------------------------------------------------------- simulações
import pytest  # noqa: E402

GOOD = {"lat": -9.41, "lon": -40.5, "label": "Roça do Zé"}


@pytest.fixture
def sim(monkeypatch):
    import app.main as m
    store = {}
    monkeypatch.setenv("API_KEYS", "chave-teste,outra")
    monkeypatch.setattr(m, "_put_json", lambda n, o: store.__setitem__(n, o))
    monkeypatch.setattr(m, "_get_json", lambda n: store.get(n))
    runs = []
    monkeypatch.setattr(m, "_run_job", lambda rid: runs.append(rid) or "exec-1")
    m._hits.clear()
    return m, store, runs


def test_open_mode_works_without_key(sim, monkeypatch):
    monkeypatch.delenv("REQUIRE_API_KEY", raising=False)
    monkeypatch.delenv("API_KEYS", raising=False)
    r = client.post("/simulations", json=GOOD)
    assert r.status_code == 202
    assert client.get(f"/simulations/{r.json()['id']}").json()["status"] == "queued"


def test_simulation_serializes_weather_event_dates(sim):
    import json

    _, store, _ = sim
    event = {"id": "seca", "type": "rainfall_multiplier",
             "start_date": "2024-02-29", "end_date": "2024-03-10", "factor": 0.2}
    response = client.post("/simulations", json={**GOOD, "weather_events": [event]})
    assert response.status_code == 202
    request = json.loads(json.dumps(store[f"requests/{response.json()['id']}.json"]))
    assert request["weather_events"] == [event | {"source_kind": "hypothetical"}]


def test_rotation_queues_only_supported_pair(sim):
    _, store, runs = sim
    body = {**GOOD, "planting_dates": ["2024-01-15", "2024-07-15"]}
    rejected = client.post("/rotations", json={**body, "crops": ["CP", "CS"]})
    assert rejected.status_code == 422
    assert not runs
    response = client.post("/rotations", json={**body, "crops": ["caupi", "milho"]})
    assert response.status_code == 202
    result = response.json()
    assert runs == [result["id"]]
    request = store[f"requests/{result['id']}.json"]
    assert request["kind"] == "rotation"
    assert request["crops"] == ["CP", "MZ"]
    assert request["planting_dates"] == body["planting_dates"]
    assert client.get(result["poll"]).json()["status"] == "queued"


def test_rotation_accepts_trio_with_one_date_per_crop(sim):
    _, store, runs = sim
    body = {**GOOD, "crops": ["milho", "caupi", "sorgo"],
            "planting_dates": ["2024-01-15", "2024-05-20", "2024-09-20"]}
    assert client.post("/rotations", json={**body, "planting_dates": body["planting_dates"][:2]}).status_code == 422
    assert client.post("/rotations", json={**body, "crops": ["milho", "MZ", "sorgo"]}).status_code == 422
    response = client.post("/rotations", json=body)
    assert response.status_code == 202
    assert store[f"requests/{runs[0]}.json"]["crops"] == ["MZ", "CP", "SG"]


SEARCH = {**GOOD, "known_crops": ["milho", "caupi", "sorgo", "abacaxi"],
          "planting_dates": ["2024-01-15", "2024-07-15", "2025-02-20"],
          "historical_start_years": [1992, 2000],
          "yield_targets_kg_ha": {"milho": 1000, "CP": 500, "SG": 1000}}


def test_rotation_search_persists_normalized_input_and_reports_exclusions(sim):
    _, store, runs = sim
    response = client.post("/rotations/search", json=SEARCH)
    assert response.status_code == 202
    data = response.json()
    assert data["supported_crops"] == ["MZ", "CP", "SG"]
    assert data["excluded_crops"] == ["PI"]
    request = store[f"requests/{runs[0]}.json"]
    assert request["kind"] == "rotation_search"
    assert request["yield_targets_kg_ha"] == {"MZ": 1000, "CP": 500, "SG": 1000}
    assert request["planting_dates"] == SEARCH["planting_dates"]
    assert client.get(data["poll"]).json()["status"] == "queued"


@pytest.mark.parametrize("change", [
    {"known_crops": ["milho", "MZ", "caupi"]},
    {"yield_targets_kg_ha": {"MZ": 1000, "CP": 500}},
    {"historical_start_years": [1992, 1992]},
    {"planting_dates": ["2024-02-29", "2024-07-15", "2025-02-20"],
     "historical_start_years": [1992, 1993]},
    {"max_candidates": 9},
])
def test_rotation_search_rejects_unusable_portfolio(sim, change):
    _, _, runs = sim
    assert client.post("/rotations/search", json={**SEARCH, **change}).status_code == 422
    assert not runs


def test_rotation_search_has_stricter_quota(sim, monkeypatch):
    module, _, runs = sim
    monkeypatch.setattr(module, "ROTATION_SEARCH_PER_DAY", 1)
    assert client.post("/rotations/search", json=SEARCH).status_code == 202
    assert client.post("/rotations/search", json=SEARCH).status_code == 429
    assert len(runs) == 1


def test_rotation_search_requires_explicit_cane_biomass_target(sim):
    _, _, runs = sim
    body = {**SEARCH, "known_crops": ["MZ", "SC"], "yield_targets_kg_ha": {"MZ": 1000, "SC": 7000}}
    assert client.post("/rotations/search", json=body).status_code == 422
    assert not runs
    assert client.post("/rotations/search", json={**body, "biomass_target_crops": ["SC"]}).status_code == 202


def test_calendar_planning_and_replan(sim):
    body = {
        "horizon_start": "2027-01-01", "horizon_end": "2028-12-31",
        "known_crops": ["milho", "caupi"],
        "windows": [{"crop": "MZ", "planting_date": "2027-01-10"},
                    {"crop": "CP", "planting_date": "2028-01-10"}],
    }
    response = client.post("/planning/calendar", json=body)
    assert response.status_code == 200
    result = response.json()
    route = result["candidates"][0]["cycles"]
    assert [cycle["crop"] for cycle in route] == ["MZ", "CP"]
    assert result["evidence"]["dssat_simulated"] is False
    response = client.post("/planning/calendar/replan", json={
        **body, "route": route, "decision_date": "2027-01-11",
    })
    assert response.status_code == 200
    assert response.json()["realized_prefix"] == route[:1]
    assert response.json()["terminate_and_restart"]["status"] == "unsupported"


def test_open_mode_limits_per_ip(sim, monkeypatch):
    m, _, _ = sim
    monkeypatch.setattr(m, "RATE_PER_MINUTE", 2)
    a = {"X-Forwarded-For": "200.1.1.1"}
    b = {"X-Forwarded-For": "200.2.2.2, 10.0.0.1"}
    assert [client.post("/simulations", json=GOOD, headers=a).status_code for _ in range(3)] == [202, 202, 429]
    assert client.post("/simulations", json=GOOD, headers=b).status_code == 202   # outro IP não é afetado


def test_global_daily_cap(sim, monkeypatch):
    m, _, _ = sim
    monkeypatch.setattr(m, "GLOBAL_PER_DAY", 2)
    codes = [client.post("/simulations", json=GOOD, headers={"X-Forwarded-For": f"200.0.0.{i}"}).status_code
             for i in range(3)]
    assert codes == [202, 202, 429]


def test_key_mode_disabled_without_keys(monkeypatch):
    monkeypatch.setenv("REQUIRE_API_KEY", "true")
    monkeypatch.delenv("API_KEYS", raising=False)
    assert client.post("/simulations", json=GOOD).status_code == 503


def test_key_mode_requires_valid_key(sim, monkeypatch):
    monkeypatch.setenv("REQUIRE_API_KEY", "true")
    assert client.post("/simulations", json=GOOD).status_code == 401
    assert client.post("/simulations", json=GOOD, headers={"X-API-Key": "errada"}).status_code == 401
    assert client.post("/simulations", json=GOOD, headers={"X-API-Key": "chave-teste"}).status_code == 202


def test_simulation_flow(sim):
    m, store, runs = sim
    h = {"X-API-Key": "chave-teste"}
    body = {**GOOD, "planting_windows": ["11-15"], "soil_analysis": {"lab": "Lab X", "layers": [
        {"top_cm": 0, "bottom_cm": 20, "argila_g_kg": 300, "areia_g_kg": 500, "silte_g_kg": 200, "p_mg_dm3": 8}]}}
    r = client.post("/simulations", json=body, headers=h)
    assert r.status_code == 202
    rid = r.json()["id"]
    assert runs == [rid] and store[f"requests/{rid}.json"]["soil_analysis"]["layers"][0]["p_mg_dm3"] == 8
    assert client.get(f"/simulations/{rid}", headers=h).json()["status"] == "queued"
    store[f"results/{rid}.json"] = {"id": rid, "status": "done", "scenario_summary": []}
    assert client.get(f"/simulations/{rid}", headers=h).json()["status"] == "done"
    assert client.get("/simulations/0123456789abcdef", headers=h).status_code == 404
    assert client.get("/simulations/../../etc", headers=h).status_code == 404


@pytest.mark.parametrize("bad", [
    {"lat": 40.7, "lon": -74.0},                                   # fora do Brasil
    {**GOOD, "crop": "laranja"},                                    # cultura fora do catálogo
    {**GOOD, "crop": "milho", "cultivar": "ZZZZZZ"},                # cultivar inexistente
    {**GOOD, "planting_windows": ["02-29"]},
    {**GOOD, "planting_windows": ["13-01"]},
    {**GOOD, "soil_analysis": {"layers": [{"top_cm": 20, "bottom_cm": 10}]}},
    {**GOOD, "soil_analysis": {"layers": [{"top_cm": 0, "bottom_cm": 20, "ph_agua": 15}]}},
])
def test_simulation_validation(sim, bad):
    assert client.post("/simulations", json=bad, headers={"X-API-Key": "chave-teste"}).status_code == 422


def test_rate_limit(sim, monkeypatch):
    m, _, _ = sim
    monkeypatch.setattr(m, "RATE_PER_MINUTE", 2)
    h = {"X-API-Key": "outra"}
    assert [client.post("/simulations", json=GOOD, headers=h).status_code for _ in range(3)] == [202, 202, 429]


def test_crops_catalog():
    body = client.get("/crops").json()
    codes = {c["code"] for c in body["crops"]}
    assert {"MZ", "BN", "CP", "CS", "SG", "PN"} <= codes and len(codes) >= 20
    assert "china" not in json.dumps(body).lower()
    mz = client.get("/crops/milho").json()
    assert mz["code"] == "MZ" and mz["default_cultivar"]["id"] in {c["id"] for c in mz["cultivars"]}
    assert client.get("/crops/feijão-caupi").json()["code"] == "CP"
    assert client.get("/crops/xx").status_code == 404


def test_simulation_accepts_crop_names_and_cultivar(sim):
    m, store, _ = sim
    h = {"X-API-Key": "chave-teste"}
    r = client.post("/simulations", json={**GOOD, "crop": "Macaxeira"}, headers=h)
    assert r.status_code == 202 and store[f"requests/{r.json()['id']}.json"]["crop"] == "CS"
    cv = client.get("/crops/BN").json()["cultivars"][1]["id"]
    r = client.post("/simulations", json={**GOOD, "crop": "feijão", "cultivar": cv.lower()}, headers=h)
    req = store[f"requests/{r.json()['id']}.json"]
    assert (req["crop"], req["cultivar"]) == ("BN", cv)


def test_climate_projection_options_match_dssat():
    import importlib.util
    from pathlib import Path
    import app.main as m
    spec = importlib.util.spec_from_file_location(
        "nex_gddp", Path(__file__).resolve().parents[2] / "dssat" / "nex_gddp.py")
    nx = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(nx)
    assert m.NEX_SCENARIOS == nx.SCENARIOS
    assert m.NEX_PERIODS == list(nx.PERIODS)
    assert m.NEX_MODELS == list(nx.MODELS)
    assert m.NEX_DEFAULT_MODELS == nx.DEFAULT_MODELS
    assert not set(m.NEX_MODELS) & set(nx.EXCLUDED_MODELS)
    r = client.get("/climate-projections").json()
    assert r["default_models"][0] == "GISS-E2-1-G" and "NASA" in r["source"]


def test_simulation_with_climate_projection(sim):
    m, store, runs = sim
    r = client.post("/simulations", json={**GOOD, "crop": "caupi", "climate_projection": {}},
                    headers={"X-API-Key": "chave-teste"})
    assert r.status_code == 202 and "clima futuro" in r.json()["note"]
    req = store[f"requests/{r.json()['id']}.json"]
    assert req["climate_projection"] == {"scenario": "ssp245", "period": "2041-2060"}
    r = client.post("/simulations", json={**GOOD, "climate_projection": {"scenario": "ssp585", "period": "2041-2060",
                                                                          "models": ["GISS-E2-1-G"]}},
                    headers={"X-API-Key": "chave-teste"})
    assert r.status_code == 202


@pytest.mark.parametrize("cp", [
    {"scenario": "ssp999"}, {"period": "2030-2050"}, {"models": ["BCC-CSM2-MR"]}, {"models": ["FGOALS-g3"]},
    {"models": []}, {"scenario": "ssp126"}, {"period": "2081-2100"}, {"models": ["MIROC6"]},   # não pré-processados
])
def test_climate_projection_validation(sim, cp):
    r = client.post("/simulations", json={**GOOD, "climate_projection": cp}, headers={"X-API-Key": "chave-teste"})
    assert r.status_code == 422


def test_api_accepts_exactly_what_is_preprocessed():
    from pathlib import Path
    import app.main as m
    cfg = json.loads((Path(__file__).resolve().parents[3] / "data" / "nex_gddp.json").read_text())
    p = m.NEX_PREPROCESSED
    assert p["scenarios"] == cfg["scenarios"] and p["periods"] == cfg["periods"]
    assert p["models"] == cfg["models"] and p["regions"] == cfg["regions"]
