import json
import os
import shutil
from pathlib import Path

import pytest

import runner
from tests.test_inputs import power_doc_from_wth, FIX

DSSAT_OK = Path(os.environ.get("DSSAT_HOME", "/opt/dssat"), "dscsm048").exists()


def synthetic_power() -> dict:
    """35 anos repetindo o clima oficial de 2002 (só para testar a mecânica)."""
    from datetime import date, timedelta
    base = power_doc_from_wth(FIX / "BRPI0201.WTH")
    one = base["properties"]["parameter"]
    par = {k: {} for k in one}
    d = date(1991, 1, 1)
    while d <= date(2025, 12, 31):
        src = f"2002{d.strftime('%m%d')}" if d.strftime("%m%d") != "0229" else "20020228"
        for k in par:
            par[k][d.strftime("%Y%m%d")] = one[k][src]
        d += timedelta(days=1)
    base["geometry"]["coordinates"] = [-40.5, -9.41, 370]
    base["properties"]["parameter"] = par
    return base


def ps_identify_doc() -> dict:
    vals = {1: 3.4, 8: 5, 15: 578, 22: 183, 29: 239, 36: 5.1, 43: 6.3, 50: 0.012}
    return {"results": [{"layerId": g + 1 + i, "attributes": {"Classify.Pixel Value": str(v)}}
                        for g, v in vals.items() for i in range(6)]}


@pytest.fixture
def fake_bucket(tmp_path, monkeypatch):
    root = tmp_path / "bucket"
    calls = {"power": 0, "ps": 0}

    def put_json(b, name, obj):
        p = root / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(obj, ensure_ascii=False))

    def read_json(b, name):
        p = root / name
        return json.loads(p.read_text()) if p.exists() else None

    def upload(src, prefix):
        dst = root / prefix.split("/", 3)[3]
        dst.mkdir(parents=True, exist_ok=True)
        for f in src.iterdir():
            if f.is_file():
                shutil.copy(f, dst / f.name)
        return 1

    def power(lat, lon):
        calls["power"] += 1
        return synthetic_power()

    def ps(lat, lon):
        calls["ps"] += 1
        return ps_identify_doc()

    monkeypatch.setattr(runner, "gcs_put_json", put_json)
    monkeypatch.setattr(runner, "gcs_read_json", read_json)
    monkeypatch.setattr(runner, "gcs_upload", upload)
    monkeypatch.setattr(runner, "fetch_power", power)
    monkeypatch.setattr(runner, "fetch_pronasolos", ps)
    monkeypatch.setenv("DATA_BUCKET", "b")
    return root, put_json, calls


def test_power_cell():
    assert runner.power_cell(-9.41, -40.50) == runner.power_cell(-9.30, -40.20)
    assert runner.power_cell(-9.41, -40.50) != runner.power_cell(-8.9, -40.5)


@pytest.mark.skipif(not DSSAT_OK, reason="DSSAT não instalado")
def test_point_with_and_without_soil_analysis(fake_bucket, monkeypatch):
    root, put_json, calls = fake_bucket
    put_json("b", "requests/r1.json", {"lat": -9.41, "lon": -40.5, "label": "Roça do Zé – São João"})
    monkeypatch.setenv("REQUEST_ID", "r1")
    assert runner.run_point() == 0
    r1 = json.loads((root / "results/r1.json").read_text())
    assert r1["status"] == "done" and len(r1["scenario_summary"]) == 4
    assert r1["soil"]["source"] == "estimado (PronaSolos 90 m)"
    assert r1["planting_windows_source"].startswith("automática")
    assert r1["request"]["label"] == "Roça do Zé – São João"     # acentos preservados na resposta

    analysis = {"lab": "Lab X", "layers": [{"top_cm": 0, "bottom_cm": 20, "areia_g_kg": 400, "argila_g_kg": 400,
                                            "silte_g_kg": 200, "materia_organica_g_kg": 30, "p_mg_dm3": 6}]}
    put_json("b", "requests/r2.json", {"lat": -9.40, "lon": -40.49, "soil_analysis": analysis,
                                       "planting_windows": ["12-01", "01-01"]})
    monkeypatch.setenv("REQUEST_ID", "r2")
    assert runner.run_point() == 0
    r2 = json.loads((root / "results/r2.json").read_text())
    assert r2["soil"]["source"] == "medido + estimado"
    assert r2["soil"]["layers"][0]["origem"].startswith("medido")
    assert r2["soil"]["layers"][3]["origem"].startswith("estimado")
    assert r2["planting_windows_source"] == "informada pelo usuário"
    assert [s["planting_mm_dd"] for s in r2["scenario_summary"]] == ["12-01", "01-01", "01-01"]
    assert r2["climate"]["cache_hit"] is True and calls["power"] == 1   # mesma célula do POWER: reaproveitou


def test_point_missing_request_fails_cleanly(fake_bucket, monkeypatch):
    root, _, _ = fake_bucket
    monkeypatch.setenv("REQUEST_ID", "nao-existe")
    assert runner.run_point() == 1
    assert json.loads((root / "results/nao-existe.json").read_text())["status"] == "failed"
