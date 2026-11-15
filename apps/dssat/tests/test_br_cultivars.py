import json
import os
import re
import shutil
import subprocess
from pathlib import Path

import pytest

import fieldshift_inputs as fi
import runner
from tests.test_point import synthetic_power, ps_identify_doc
from tools import br_cultivars as bc

DSSAT_HOME = Path(os.environ.get("DSSAT_HOME", "/opt/dssat"))
REG = bc.load()
IDS = [c["id"] for c in REG["cultivars"]]
CHINA = re.compile(r"china|chinese|beijing|nanjing|gansu|lanzhou", re.I)


def installed(c) -> bool:
    cul = DSSAT_HOME / "Genotype" / f"{c['genotype_file']}.CUL"
    return cul.exists() and any(l[:6] == c["id"] for l in cul.read_text(errors="replace").splitlines())


def test_registry_is_documented_and_clean():
    assert not CHINA.search(json.dumps(REG, ensure_ascii=False))
    assert len(set(IDS)) == len(IDS)
    for c in REG["cultivars"]:
        assert re.fullmatch(r"FS[A-Z]{2}\d{2}", c["id"])
        s = REG["sources"][c["source"]]
        assert s["citation"] and s["institution"] and s["location"] and s["model"]


def test_catalog_lists_every_article_cultivar_with_source():
    by_code = {c["code"]: c for c in fi.catalog()["crops"]}
    for c in REG["cultivars"]:
        entry = next(x for x in by_code[c["crop"]]["cultivars"] if x["id"] == c["id"])
        assert entry["origin"] == "Brasil" and entry["source"] and entry["calibration_model"]
    for code, ids in REG["library_brazil"].items():
        tagged = {x["id"] for x in by_code[code]["cultivars"] if x.get("origin") == "Brasil"}
        assert set(ids) <= tagged


@pytest.mark.skipif(not (DSSAT_HOME / "Genotype" / "SBGRO048.CUL").exists(), reason="DSSAT não instalado")
def test_lines_follow_file_columns_and_are_idempotent(tmp_path):
    g = tmp_path / "g"
    shutil.copytree(DSSAT_HOME / "Genotype", g)
    for c in REG["cultivars"]:  # parte de arquivos sem as linhas novas
        for ext in ("CUL", "ECO"):
            f = g / f"{c['genotype_file']}.{ext}"
            if f.exists():
                f.write_text("\n".join(l for l in f.read_text(errors="replace").splitlines() if l[:2] != "FS") + "\n")
    n = bc.apply_genotype(g)
    assert n == len(IDS) + sum(1 for c in REG["cultivars"] if c.get("eco_id"))
    assert bc.apply_genotype(g) == 0
    for c in REG["cultivars"]:
        text = (g / f"{c['genotype_file']}.CUL").read_text(errors="replace")
        hdr, row = bc._header_and_row(text, c["id"])
        cols = {n: (a, b) for n, a, b in bc._spans(hdr)}
        for k, v in c["cul"].items():
            a, b = cols[k]
            assert abs(float(row[a:b]) - float(v)) < 1e-3, (c["id"], k)


@pytest.mark.parametrize("cid", IDS)
def test_every_article_cultivar_runs(tmp_path, cid):
    c = next(x for x in REG["cultivars"] if x["id"] == cid)
    if not installed(c):
        pytest.skip("instalação local sem os cultivares brasileiros (a imagem tem)")
    (tmp_path / "p.json").write_text(json.dumps(synthetic_power()))
    (tmp_path / "s.csv").write_text(fi.pronasolos_identify_to_csv(ps_identify_doc()))
    m = fi.build_site("FSPT", "Teste", tmp_path / "p.json", tmp_path / "s.csv", tmp_path / "run",
                      auto_window=True, crop_code=c["crop"], cultivar_id=cid)
    p = subprocess.run([str(DSSAT_HOME / "dscsm048"), "A", m["filex"]], cwd=tmp_path / "run",
                       capture_output=True, text=True, timeout=600)
    assert p.returncode == 0
    seasons = runner.summarize(runner.parse_summary(tmp_path / "run" / "Summary.OUT"))
    assert len(seasons) == m["seasons"]["n_years"] * len(m["scenarios"])
    assert sorted(s["yield_kg_ha"] or 0 for s in seasons)[len(seasons) // 2] > 500
