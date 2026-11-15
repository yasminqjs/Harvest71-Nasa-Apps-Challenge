import json
import os
import re
import subprocess
from pathlib import Path

import pytest

import fieldshift_inputs as fi
import runner
from tests.test_point import synthetic_power, ps_identify_doc

CHINA = re.compile(r"china|chinese|beijing|nanjing|gansu|lanzhou", re.I)
DSSAT = Path(os.environ.get("DSSAT_HOME", "/opt/dssat"), "dscsm048")
CODES = [c["code"] for c in fi.catalog()["crops"]]


def test_catalog_is_clean_and_complete():
    cat = fi.catalog()
    assert len(cat["crops"]) >= 20
    for c in cat["crops"]:
        assert not CHINA.search(json.dumps(c, ensure_ascii=False)), c["code"]
        assert c["default_cultivar"]["id"] in {x["id"] for x in c["cultivars"]}, c["code"]
        assert c["planting_template"].strip() and c["model"]


def test_api_catalog_is_identical():
    api = Path(__file__).resolve().parents[2] / "api" / "app" / "crops.json"
    assert json.loads(api.read_text()) == fi.catalog()


def test_genotype_keep_list_matches_catalog():
    keep = set(Path(fi.__file__).with_name("genotype_keep.txt").read_text().split())
    for c in fi.catalog()["crops"]:
        assert f"{c['genotype_file']}.CUL" in keep


def test_unknown_crop_or_cultivar():
    with pytest.raises(ValueError):
        fi.get_crop("XX")
    with pytest.raises(ValueError):
        fi.pick_cultivar(fi.get_crop("MZ"), "NAOEXI")


@pytest.mark.skipif(not DSSAT.exists(), reason="DSSAT não instalado")
@pytest.mark.parametrize("code", CODES)
def test_every_crop_runs_all_seasons(tmp_path, code):
    (tmp_path / "p.json").write_text(json.dumps(synthetic_power()))
    (tmp_path / "s.csv").write_text(fi.pronasolos_identify_to_csv(ps_identify_doc()))
    m = fi.build_site("FSPT", "Teste", tmp_path / "p.json", tmp_path / "s.csv", tmp_path / "run",
                      auto_window=True, crop_code=code)
    p = subprocess.run([str(DSSAT), "A", m["filex"]], cwd=tmp_path / "run", capture_output=True, text=True, timeout=600)
    assert p.returncode == 0
    seasons = runner.summarize(runner.parse_summary(tmp_path / "run" / "Summary.OUT"))
    assert len(seasons) == m["seasons"]["n_years"] * len(m["scenarios"])
    var = "biomass_kg_ha" if m["crop"]["yield_variable"] == "CWAM" else "yield_kg_ha"
    assert sum(1 for s in seasons if (s[var] or 0) > 0) >= 0.5 * len(seasons)
    agg = runner.aggregate(m, seasons)
    assert all(a["yield_kg_ha"]["p50"] is not None for a in agg)
