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


def test_no_simulation_endpoint_exposed():
    # Endpoints que iniciam jobs não podem existir sem autenticação.
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
