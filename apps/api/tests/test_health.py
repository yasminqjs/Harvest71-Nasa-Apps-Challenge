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


def test_simulations_disabled_without_keys(monkeypatch):
    monkeypatch.delenv("API_KEYS", raising=False)
    assert client.post("/simulations", json=GOOD).status_code == 503


def test_simulations_require_valid_key(sim):
    assert client.post("/simulations", json=GOOD).status_code == 401
    assert client.post("/simulations", json=GOOD, headers={"X-API-Key": "errada"}).status_code == 401


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
    assert client.get(f"/simulations/{rid}").status_code == 401
    assert client.get("/simulations/0123456789abcdef", headers=h).status_code == 404
    assert client.get("/simulations/../../etc", headers=h).status_code == 404


@pytest.mark.parametrize("bad", [
    {"lat": 40.7, "lon": -74.0},                                   # fora do Brasil
    {**GOOD, "crop": "soja"},                                       # cultura ainda não liberada
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
