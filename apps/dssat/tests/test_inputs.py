import json
import shutil
from datetime import datetime
from pathlib import Path

import pytest

import fieldshift_inputs as fi

FIX = Path(__file__).parent / "fixtures"
DSSAT = Path("/opt/dssat/dscsm048")


def power_doc_from_wth(path: Path) -> dict:
    """Converte o clima oficial (BRPI0201.WTH) para o formato JSON do NASA POWER."""
    par = {k: {} for k in ("ALLSKY_SFC_SW_DWN", "T2M_MAX", "T2M_MIN", "PRECTOTCORR")}
    for line in path.read_text().splitlines()[5:]:
        p = line.split()
        if len(p) < 5:
            continue
        d = datetime.strptime("20" + p[0], "%Y%j").strftime("%Y%m%d")
        for k, v in zip(par, p[1:5]):
            par[k][d] = float(v)
    return {"geometry": {"coordinates": [-47.25, -22.43, 580]}, "header": {"fill_value": -999},
            "properties": {"parameter": par}}


def test_power_to_wth_preserves_values(tmp_path):
    (tmp_path / "p.json").write_text(json.dumps(power_doc_from_wth(FIX / "BRPI0201.WTH")))
    w = fi.read_power_json(tmp_path / "p.json")
    names = fi.write_wth_files(w, "BRPI", tmp_path, "t")
    assert names == ["BRPI0201.WTH"]
    orig = [l.split()[:5] for l in (FIX / "BRPI0201.WTH").read_text().splitlines()[5:] if l.strip()]
    mine = [l.split()[:5] for l in (tmp_path / "BRPI0201.WTH").read_text().splitlines()[5:] if l.strip()]
    assert orig == mine


def test_missing_and_units(tmp_path):
    doc = {"geometry": {"coordinates": [-40, -9, 400]}, "header": {"fill_value": -999},
           "properties": {"parameter": {
               "ALLSKY_SFC_SW_DWN": {"20240101": 20, "20240102": -999, "20240103": 22, "20240104": 21},
               "T2M_MAX": {"20240101": 33, "20240102": 34, "20240103": 35, "20240104": -999},
               "T2M_MIN": {"20240101": 22, "20240102": 22, "20240103": 23, "20240104": 23},
               "PRECTOTCORR": {"20240101": 0, "20240102": 5, "20240103": 0, "20240104": 0},
               "WS2M": {"20240101": 1, "20240102": 1, "20240103": 1, "20240104": 1}}}}
    (tmp_path / "p.json").write_text(json.dumps(doc))
    w = fi.read_power_json(tmp_path / "p.json")
    days = list(w.days.values())
    assert len(days) == 3                     # último dia sem TMAX é cortado
    assert days[1]["SRAD"] == pytest.approx(21)  # falha curta interpolada
    assert days[0]["WIND"] == pytest.approx(86.4)  # m/s -> km/dia


PS_SAMPLE = """propriedade,profundidade,valor
""" + "\n".join(
    f"{p},{d},{v}" for d, _ in fi.PS_DEPTHS for p, v in
    {"areia_g_kg": 578, "argila_g_kg": 183, "silte_g_kg": 239, "carbono_organico_g_kg": 5,
     "ctc_cmolc_kg": 5.1, "ph_agua": 6.3, "ce_ds_m": 0.012, "estoque_c_mg_ha": 3.4}.items())


def test_pronasolos_profile():
    ps = fi.read_pronasolos_csv_text(PS_SAMPLE)
    assert ps["0-5cm"]["areia_g_kg"] == 578
    prof = fi.build_soil(ps, "FSTEST0001")
    L = prof.layers[0]
    assert L["SLCL"] == pytest.approx(18.3) and L["SLSI"] == pytest.approx(23.9)
    assert L["SLOC"] == pytest.approx(0.5) and L["SLHW"] == 6.3 and L["SCEC"] == 5.1
    ll, dul, sat = fi.saxton_rawls(0.578, 0.183, 0.5 * 1.724)
    assert (L["SLLL"], L["SDUL"], L["SSAT"]) == pytest.approx((ll, dul, sat))
    assert L["SBDM"] == pytest.approx((1 - sat) * 2.65)
    assert 0 < L["SLLL"] < L["SDUL"] < L["SSAT"] < 1
    assert L["SLNI"] == -99 and L["SLCF"] == -99
    assert [x["SLB"] for x in prof.layers] == [5, 15, 30, 60, 100, 200]
    assert prof.text == "SL"
    assert prof.warnings == []


def test_pronasolos_missing_texture_truncates():
    prof = fi.build_soil(fi.read_pronasolos_csv_text(PS_SAMPLE.replace("areia_g_kg,30-60cm,578", "x,30-60cm,0")), "FS")
    assert [x["SLB"] for x in prof.layers] == [5, 15, 30]
    assert any("30-60cm" in w for w in prof.warnings)


def test_saxton_rawls_loam_reasonable():
    ll, dul, sat = fi.saxton_rawls(0.40, 0.20, 2.5)
    assert 0.08 < ll < 0.16 and 0.22 < dul < 0.32 and 0.40 < sat < 0.50
    assert fi.ksat_cm_h(ll, dul, sat) > 0


@pytest.mark.parametrize("sand,silt,clay,code", [(90, 5, 5, "S"), (20, 20, 60, "C"), (40, 40, 20, "L"),
                                                 (10, 70, 20, "SIL"), (65, 15, 20, "SCL"), (70, 20, 10, "SL")])
def test_texture(sand, silt, clay, code):
    assert fi.texture_code(sand, silt, clay) == code


@pytest.mark.skipif(not DSSAT.exists(), reason="DSSAT não instalado (roda dentro da imagem)")
def test_roundtrip_weather_reproduces_reference(tmp_path):
    import runner
    (tmp_path / "p.json").write_text(json.dumps(power_doc_from_wth(FIX / "BRPI0201.WTH")))
    w = fi.read_power_json(tmp_path / "p.json")
    fi.write_wth_files(w, "BRPI", tmp_path, "t")
    wth = tmp_path / "BRPI0201.WTH"   # mesmo TAV/AMP de longo prazo do arquivo oficial
    lines = wth.read_text().splitlines()
    lines[3] = "  BRPI  -22.430  -47.250   580  21.6   7.2   2.0   2.0"
    wth.write_text("\n".join(lines) + "\n")
    for f in Path("/opt/dssat/reference").iterdir():
        shutil.copy(f, tmp_path)
    proc = runner.run_dssat(tmp_path, "BRPI0202.MZX")
    assert proc.returncode == 0
    rows = runner.summarize(runner.parse_summary(tmp_path / "Summary.OUT"))
    assert runner.check_reference(rows) == []
