import json
import os
import subprocess
from pathlib import Path

import pytest

import fieldshift_inputs as fi
import nex_gddp as nx
import runner
from tests.test_point import synthetic_power, ps_identify_doc, fake_bucket  # noqa: F401

FIX = Path(__file__).parent / "fixtures" / "nex"
DSSAT = Path(os.environ.get("DSSAT_HOME", "/opt/dssat"), "dscsm048")
CHINA = ("BCC", "FGOALS", "NESM", "CAS-", "CIESM", "TaiESM")


def ncss_csv(var: str, year: int, value_fn, days360: bool = False) -> str:
    """Resposta NCSS no formato real do THREDDS do NCCS (cabeçalho e colunas)."""
    unit = {"pr": "kg m-2 s-1", "rsds": "W m-2"}.get(var, "K")
    lines = [f'time,station,latitude[unit="degrees_north"],longitude[unit="degrees_east"],{var}[unit="{unit}"]']
    months = [30] * 12 if days360 else [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    for m, n in enumerate(months, 1):
        for d in range(1, n + 1):
            lines.append(f"{year}-{m:02d}-{d:02d}T12:00:00Z,GridPointRequestedAt[12.670S_39.100W],"
                         f"-12.625,-39.125,{value_fn(m):.6E}")
    return "\n".join(lines) + "\n"


def fake_server(future_shift: dict):
    """Imita catálogo + NCSS. future_shift: mudanças (K, fator chuva, fator radiação) no SSP."""
    base = {"tasmax": lambda m: 303.15, "tasmin": lambda m: 293.15,
            "pr": lambda m: (4.0 if m in (4, 5, 6, 7) else 1.0) / 86400, "rsds": lambda m: 200.0}
    model_cat = (FIX / "catalog_model.xml").read_text()
    calls = {"ncss": 0, "catalog": 0}

    def get(url):
        if "/catalog/" in url:
            calls["catalog"] += 1
            path = url.split("GDDP-CMIP6/")[1].replace("/catalog.xml", "")
            parts = path.split("/")
            if len(parts) == 2:
                return model_cat.replace("GISS-E2-1-G/historical", path)
            model, exp, variant, var = parts
            ds = "".join(
                f'<dataset name="f" urlPath="AMES/NEX/GDDP-CMIP6/{model}/{exp}/{variant}/{var}/'
                f'{var}_day_{model}_{exp}_{variant}_gn_{y}_v{v}.nc"/>'
                for y in range(1990, 2101) for v in ("1.1", "2.0"))
            return ('<catalog xmlns="http://www.unidata.ucar.edu/namespaces/thredds/InvCatalog/v1.0">'
                    f"<dataset name='d'>{ds}</dataset></catalog>")
        calls["ncss"] += 1
        assert "temporal=all" in url and "accept=csv" in url
        path = url.split("/ncss/grid/")[1].split("?")[0]
        assert path.endswith("_v2.0.nc")  # versão mais nova
        var = path.rsplit("/", 2)[-2]
        year = int(path.rsplit("_", 2)[-2])
        fn = base[var]
        if "ssp" in path:
            k = future_shift.get(var)
            if var in ("tasmax", "tasmin"):
                fn = (lambda f, k: lambda m: f(m) + k)(base[var], k or 0)
            elif k:
                fn = (lambda f, k: lambda m: f(m) * k)(base[var], k)
        return ncss_csv(var, year, fn, days360="UKESM" in path)
    return get, calls


def test_grid_cell_and_key():
    assert nx.grid_cell(-12.67, -39.10) == (-12.625, 320.875)   # igual ao ponto devolvido pelo NCSS
    assert nx.cell_key(-12.67, -39.10) == nx.cell_key(-12.70, -39.05)
    assert nx.cell_key(-12.67, -39.10) != nx.cell_key(-12.40, -39.10)


def test_model_policy():
    assert not any(c in m for m in nx.MODELS for c in CHINA)
    assert set(nx.DEFAULT_MODELS) <= set(nx.MODELS)
    assert "GISS-E2-1-G" in nx.DEFAULT_MODELS   # modelo da própria NASA
    for bad in nx.EXCLUDED_MODELS:
        with pytest.raises(ValueError):
            nx.validate("ssp245", "2041-2060", [bad])
    with pytest.raises(ValueError):
        nx.validate("ssp999", "2041-2060", None)
    with pytest.raises(ValueError):
        nx.validate("ssp245", "2030-2050", None)


def test_parse_units_and_360_day_calendar():
    rows = nx.parse_ncss_csv(ncss_csv("pr", 2041, lambda m: 1 / 86400, days360=True), "pr")
    assert len(rows) == 360 and rows[0] == (2041, 1, pytest.approx(1.0))
    assert any(r[1] == 2 for r in rows)   # '2041-02-30' lido pelo texto, sem quebrar
    t = nx.parse_ncss_csv(ncss_csv("tasmax", 2041, lambda m: 300.0), "tasmax")
    assert t[0][2] == pytest.approx(26.85)
    s = nx.parse_ncss_csv(ncss_csv("rsds", 2041, lambda m: 250.0), "rsds")
    assert s[0][2] == pytest.approx(21.6)


def test_climatology_and_deltas_from_fake_server():
    get, calls = fake_server({"tasmax": 2.0, "tasmin": 1.5, "pr": 0.8, "rsds": 1.02})
    hist = nx.climatology("GISS-E2-1-G", "historical", (1995, 2014), -12.67, -39.10, get=get, workers=4)
    fut = nx.climatology("GISS-E2-1-G", "ssp245", (2041, 2060), -12.67, -39.10, get=get, workers=4)
    assert calls["ncss"] == 2 * 4 * 20
    assert hist["cell"] == {"lat": -12.625, "lon": -39.125}
    d = nx.monthly_deltas(hist, fut)
    assert d[1]["dTMAX"] == pytest.approx(2.0) and d[1]["dTMIN"] == pytest.approx(1.5)
    assert d[5]["fRAIN"] == pytest.approx(0.8) and d[5]["fSRAD"] == pytest.approx(1.02)
    a = nx.annual_summary(hist, fut, d)
    assert a["rain_change_pct"] == pytest.approx(-20.0, abs=0.1)
    assert a["tmax_change_c"] == pytest.approx(2.0)


def test_missing_years_fail_clearly():
    get, _ = fake_server({})
    with pytest.raises(RuntimeError):
        nx.climatology("GISS-E2-1-G", "historical", (1980, 1989), -12.67, -39.10, get=get, workers=2)


def test_delta_limits_and_dry_months():
    h = {"monthly": {"TMAX": {str(m): 30 for m in range(1, 13)}, "TMIN": {str(m): 20 for m in range(1, 13)},
                     "RAIN": {str(m): (0.05 if m == 8 else 2.0) for m in range(1, 13)},
                     "SRAD": {str(m): 20 for m in range(1, 13)}}}
    f = json.loads(json.dumps(h))
    f["monthly"]["RAIN"]["8"] = 3.0      # mês seco no histórico: razão instável
    f["monthly"]["RAIN"]["1"] = 20.0     # 10x: limitado a 4x
    d = nx.monthly_deltas(h, f)
    assert d[8]["fRAIN"] == 1.0 and d[1]["fRAIN"] == nx.RAIN_FACTOR_LIMITS[1]


def test_apply_to_power_keeps_consistency():
    p = synthetic_power()
    p["properties"]["parameter"]["T2MDEW"] = {k: v - 1 for k, v in p["properties"]["parameter"]["T2M_MIN"].items()}
    deltas = {m: {"dTMAX": 2.0, "dTMIN": 3.0, "fRAIN": 0.5, "fSRAD": 1.1} for m in range(1, 13)}
    q = nx.apply_to_power(p, deltas)
    k = "20100115"
    par0, par1 = p["properties"]["parameter"], q["properties"]["parameter"]
    assert par1["T2M_MAX"][k] == pytest.approx(par0["T2M_MAX"][k] + 2.0)
    assert par1["PRECTOTCORR"][k] == pytest.approx(par0["PRECTOTCORR"][k] * 0.5)
    assert par1["ALLSKY_SFC_SW_DWN"][k] == pytest.approx(par0["ALLSKY_SFC_SW_DWN"][k] * 1.1, abs=1e-3)
    for d in par1["T2M_MAX"]:
        assert par1["T2M_MIN"][d] < par1["T2M_MAX"][d]
        if "T2MDEW" in par1:
            assert par1["T2MDEW"][d] <= par1["T2M_MIN"][d]
    assert par0["T2M_MAX"][k] != par1["T2M_MAX"][k]   # original não é alterado


def test_ensemble_math():
    base = [{"trno": 1, "name": "J1", "irrigated": False, "yield_kg_ha": {"p50": 1000},
             "share_seasons_below_1000_kg_ha": 0.5}]
    models = [{"scenario_summary": [{"trno": 1, "yield_kg_ha": {"p50": v}, "share_seasons_below_1000_kg_ha": s}]}
              for v, s in ((800, 0.6), (900, 0.55), (1100, 0.4))]
    e = nx.ensemble(base, models)[0]
    assert e["future_yield_p50_median"] == 900 and e["yield_change_pct"] == -10.0
    assert e["future_yield_p50_range"] == [800, 1100] and e["models_with_loss"] == 2


@pytest.mark.skipif(not DSSAT.exists(), reason="DSSAT não instalado")
def test_point_with_projection_end_to_end(fake_bucket, monkeypatch):  # noqa: F811
    root, put_json, _ = fake_bucket
    monkeypatch.setenv("NEX_ALLOW_DOWNLOAD", "true")   # download pontual só em uso manual
    get, calls = fake_server({"tasmax": 2.5, "tasmin": 2.0, "pr": 0.7, "rsds": 1.0})
    monkeypatch.setattr(nx, "http_text", get)
    orig = nx.climatology
    monkeypatch.setattr(nx, "climatology", lambda *a, **k: orig(*a, **{**k, "get": get}))
    rid = "proj1"
    put_json("b", f"requests/{rid}.json", {"lat": -12.67, "lon": -39.10, "crop": "MZ",
                                            "climate_projection": {"scenario": "ssp245", "period": "2041-2060",
                                                                   "models": ["GISS-E2-1-G", "GFDL-ESM4"]}})
    monkeypatch.setenv("REQUEST_ID", rid)
    assert runner.run_point() == 0
    res = json.loads((root / f"results/{rid}.json").read_text())
    cp = res["climate_projection"]
    assert res["status"] == "done" and cp["status"] == "done", cp.get("error")
    assert [m["model"] for m in cp["models"]] == ["GISS-E2-1-G", "GFDL-ESM4"]
    assert cp["models"][0]["climate_change"]["rain_change_pct"] == pytest.approx(-30.0, abs=0.5)
    sequeiro = [e for e in cp["ensemble"] if not e["irrigated"]]
    assert all(e["yield_change_pct"] is not None for e in cp["ensemble"])
    assert sum(e["yield_change_pct"] for e in sequeiro) < 0      # mais quente e mais seco: perde
    # mesmas janelas de plantio do resultado atual
    assert [s["name"] for s in cp["models"][0]["scenario_summary"]] == [s["name"] for s in res["scenario_summary"]]
    # cache: segunda chamada não baixa nada
    n = calls["ncss"]
    put_json("b", "requests/proj2.json", {"lat": -12.70, "lon": -39.05, "crop": "MZ",
                                           "climate_projection": {"scenario": "ssp245", "period": "2041-2060",
                                                                  "models": ["GISS-E2-1-G"]}})
    monkeypatch.setenv("REQUEST_ID", "proj2")
    assert runner.run_point() == 0
    assert calls["ncss"] == n


@pytest.mark.skipif(not DSSAT.exists(), reason="DSSAT não instalado")
def test_projection_failure_keeps_current_result(fake_bucket, monkeypatch):  # noqa: F811
    root, put_json, _ = fake_bucket

    monkeypatch.setenv("NEX_ALLOW_DOWNLOAD", "true")

    def boom(*a, **k):
        raise RuntimeError("NCCS fora do ar")
    monkeypatch.setattr(nx, "climatology", boom)
    put_json("b", "requests/p3.json", {"lat": -9.41, "lon": -40.5, "crop": "MZ",
                                        "climate_projection": {"scenario": "ssp585", "period": "2081-2100"}})
    monkeypatch.setenv("REQUEST_ID", "p3")
    assert runner.run_point() == 0
    res = json.loads((root / "results/p3.json").read_text())
    assert res["status"] == "done" and res["scenario_summary"]
    assert res["climate_projection"]["status"] == "failed"
    assert len(res["climate_projection"]["failures"]) == 3


def regional_doc(model, exp, years, tmax):
    g = lambda v: [[[v, v]] for _ in range(12)]  # noqa: E731  12 meses × 1 lat × 2 lon
    return {"model": model, "experiment": exp, "years": list(years), "lat": [-12.625], "lon": [-39.375, -39.125],
            "monthly": {"TMAX": g(tmax), "TMIN": g(20.0), "RAIN": g(3.0), "SRAD": g(20.0)}}


@pytest.mark.skipif(not DSSAT.exists(), reason="DSSAT não instalado")
def test_point_uses_regional_files_without_download(fake_bucket, monkeypatch):  # noqa: F811
    root, put_json, _ = fake_bucket
    for exp, yrs, t in (("historical", nx.HIST_YEARS, 30.0), ("ssp245", nx.PERIODS["2041-2060"], 32.0)):
        put_json("b", nx.regional_blob("GISS-E2-1-G", exp, yrs), regional_doc("GISS-E2-1-G", exp, yrs, t))

    def no_download(*a, **k):
        raise AssertionError("não devia baixar: o recorte regional existe")
    monkeypatch.setattr(nx, "climatology", no_download)
    put_json("b", "requests/r1.json", {"lat": -12.67, "lon": -39.10, "crop": "CP",
                                        "climate_projection": {"models": ["GISS-E2-1-G"]}})
    monkeypatch.setenv("REQUEST_ID", "r1")
    assert runner.run_point() == 0
    cp = json.loads((root / "results/r1.json").read_text())["climate_projection"]
    assert cp["status"] == "done", cp
    assert cp["scenario"] == "ssp245" and cp["period"] == "2041-2060"     # padrões
    assert cp["models"][0]["climate_change"]["tmax_change_c"] == pytest.approx(2.0)


@pytest.mark.skipif(not DSSAT.exists(), reason="DSSAT não instalado")
def test_not_preprocessed_returns_fast_unavailable(fake_bucket, monkeypatch):  # noqa: F811
    """Sem recorte pré-processado: nada de download da NASA durante o pedido; responde 'unavailable'."""
    root, put_json, _ = fake_bucket
    monkeypatch.delenv("NEX_ALLOW_DOWNLOAD", raising=False)

    def no_download(*a, **k):
        raise AssertionError("o app não pode esperar download da NASA")
    monkeypatch.setattr(nx, "climatology", no_download)
    put_json("b", "requests/u1.json", {"lat": -23.5, "lon": -46.6, "crop": "MZ", "climate_projection": {}})
    monkeypatch.setenv("REQUEST_ID", "u1")
    assert runner.run_point() == 0
    res = json.loads((root / "results/u1.json").read_text())
    assert res["status"] == "done" and res["scenario_summary"]
    assert res["climate_projection"]["status"] == "unavailable"


def test_regions_order_and_coverage():
    assert [r["name"] for r in nx.regions_for(-12.67, -39.10)] == ["nordeste", "brasil"]
    assert [r["name"] for r in nx.regions_for(-23.5, -46.6)] == ["brasil"]      # São Paulo: só o recorte Brasil
    assert nx.regions_for(40.7, -74.0) == []


@pytest.mark.skipif(not DSSAT.exists(), reason="DSSAT não instalado")
def test_point_outside_northeast_uses_brazil_file(fake_bucket, monkeypatch):  # noqa: F811
    root, put_json, _ = fake_bucket
    for exp, yrs, t in (("historical", nx.HIST_YEARS, 25.0), ("ssp585", nx.PERIODS["2041-2060"], 28.0)):
        doc = regional_doc("GFDL-ESM4", exp, yrs, t)
        doc["lat"], doc["lon"] = [-23.625], [-46.625, -46.375]
        put_json("b", nx.regional_blob("GFDL-ESM4", exp, yrs, "brasil"), doc)
    put_json("b", "requests/b1.json", {"lat": -23.6, "lon": -46.6, "crop": "MZ",
                                        "climate_projection": {"scenario": "ssp585", "models": ["GFDL-ESM4"]}})
    monkeypatch.setenv("REQUEST_ID", "b1")
    assert runner.run_point() == 0
    cp = json.loads((root / "results/b1.json").read_text())["climate_projection"]
    assert cp["status"] == "done" and cp["models"][0]["climate_change"]["tmax_change_c"] == pytest.approx(3.0)
