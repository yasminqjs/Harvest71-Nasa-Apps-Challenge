"""Pré-processamento regional (data/scripts/nex_gddp_prefetch.py) com netCDF3 sintético no formato do NCSS."""
import importlib.util
import io
import json
import sys
from pathlib import Path

import pytest

np = pytest.importorskip("numpy")
pytest.importorskip("scipy")
from scipy.io import netcdf_file  # noqa: E402

import nex_gddp as nx  # noqa: E402

SCRIPT = Path(__file__).resolve().parents[3] / "data" / "scripts" / "nex_gddp_prefetch.py"


def load_script():
    spec = importlib.util.spec_from_file_location("nex_prefetch", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    sys.modules["nex_prefetch"] = mod
    spec.loader.exec_module(mod)
    return mod


def nc3(var: str, n_days: int, value_fn, lon360: bool = True) -> bytes:
    """netCDF3 como o NCSS devolve: dims time/lat/lon, variável [time, lat, lon], _FillValue 1e20."""
    lat = np.array([-12.875, -12.625, -12.375])
    lon = np.array([320.625, 320.875]) if lon360 else np.array([-39.375, -39.125])
    buf = io.BytesIO()
    f = netcdf_file(buf, "w")
    f.createDimension("time", n_days)
    f.createDimension("lat", len(lat))
    f.createDimension("lon", len(lon))
    f.createVariable("lat", "d", ("lat",))[:] = lat
    f.createVariable("lon", "d", ("lon",))[:] = lon
    f.createVariable("time", "d", ("time",))[:] = np.arange(n_days) + 0.5
    v = f.createVariable(var, "f", ("time", "lat", "lon"))
    v._FillValue = np.float32(1e20)
    months = nx.month_index(n_days, leap=n_days == 366)
    data = np.array([[[value_fn(m)] * len(lon)] * len(lat) for m in months], dtype="f")
    data[:, 0, 0] = 1e20          # célula de mar: sem dado
    v[:] = data
    f.flush()
    out = buf.getvalue()
    f.close()
    return out


def test_month_index_calendars():
    assert len(nx.month_index(360, False)) == 360 and nx.month_index(360, False)[59] == 2
    assert nx.month_index(365, True).count(2) == 28        # calendário 365_day em ano bissexto
    assert nx.month_index(366, True).count(2) == 29
    with pytest.raises(ValueError):
        nx.month_index(300, False)


def test_read_year_units_and_fill():
    mod = load_script()
    lat, lon, s, c = mod.read_year(nc3("pr", 365, lambda m: 2 / 86400), "pr", 2041)
    assert list(lon) == [-39.375, -39.125]
    assert c[0, 0, 0] == 0 and c[0, 1, 1] == 31
    assert s[0, 1, 1] / c[0, 1, 1] == pytest.approx(2.0, rel=1e-5)


def test_build_and_point_lookup(monkeypatch, tmp_path):
    mod = load_script()
    base = {"tasmax": lambda m: 303.15, "tasmin": lambda m: 293.15,
            "pr": lambda m: (5.0 if m == 5 else 1.0) / 86400, "rsds": lambda m: 220.0}
    monkeypatch.setattr(nx, "list_files", lambda model, exp, var, get=None: {
        y: f"AMES/NEX/GDDP-CMIP6/{model}/{exp}/r1/{var}/{var}_{y}.nc" for y in range(1990, 2101)})

    def fake_bytes(url, **k):
        assert "accept=netcdf3" in url and "north=-0.75" in url
        path = url.split("/ncss/grid/")[1].split("?")[0]
        var = path.split("/")[-2]
        year = int(path.rsplit("_", 1)[1][:4])
        n = 366 if year % 4 == 0 else 365
        fn = base[var]
        if "ssp585" in path and var == "tasmax":
            fn = lambda m: 306.15  # noqa: E731
        return nc3(var, n, fn, lon360=year % 2 == 0)
    monkeypatch.setattr(mod, "http_bytes", fake_bytes)

    hist = mod.build("GISS-E2-1-G", "historical", (1995, 2014), workers=4)
    fut = mod.build("GISS-E2-1-G", "ssp585", (2041, 2060), workers=4)
    json.dumps(hist)                                              # serializável
    assert hist["monthly"]["TMAX"][0][0][0] is None                # mar fica vazio
    c = nx.from_regional(hist, -12.60, -39.10)
    assert c["cell"] == {"lat": -12.625, "lon": -39.125}
    assert c["monthly"]["RAIN"]["5"] == pytest.approx(5.0, rel=1e-4)
    assert c["monthly"]["SRAD"]["1"] == pytest.approx(19.008, rel=1e-4)
    assert nx.from_regional(hist, -12.85, -39.40) is None          # célula sem dado: vai para o download pontual
    assert nx.from_regional(hist, -5.0, -39.10) is None            # fora do recorte
    d = nx.monthly_deltas(c, nx.from_regional(fut, -12.60, -39.10))
    assert d[1]["dTMAX"] == pytest.approx(3.0, abs=1e-3) and d[1]["fRAIN"] == pytest.approx(1.0)


def test_prefetch_respects_policy(tmp_path):
    mod = load_script()
    cfg = tmp_path / "c.json"
    cfg.write_text(json.dumps({"models": ["BCC-CSM2-MR"], "scenarios": ["ssp245"], "periods": ["2041-2060"]}))
    sys.argv = ["x", "--config", str(cfg), "--out", str(tmp_path / "o")]
    with pytest.raises(ValueError):
        mod.main()


def test_config_file_is_valid():
    cfg = json.loads((SCRIPT.parents[1] / "nex_gddp.json").read_text())
    nx.validate(cfg["scenarios"][0], cfg["periods"][0], cfg["models"])
    for s in cfg["scenarios"]:
        assert s in nx.SCENARIOS
    for p in cfg["periods"]:
        assert p in nx.PERIODS
