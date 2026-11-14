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
