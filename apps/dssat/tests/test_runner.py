from pathlib import Path

import runner

FIXTURE = Path(__file__).parent / "fixtures" / "BRPI0202_Summary.OUT"


def test_parse_summary_reads_all_treatments():
    rows = runner.summarize(runner.parse_summary(FIXTURE))
    assert [r["treatment"] for r in rows] == list(range(1, 9))
    assert all(r["crop"] == "MZ" and r["model"] == "MZCER048" for r in rows)


def test_reference_values_match_expected():
    rows = runner.summarize(runner.parse_summary(FIXTURE))
    assert runner.check_reference(rows) == []


def test_reference_check_detects_wrong_yield():
    rows = runner.summarize(runner.parse_summary(FIXTURE))
    rows[0]["yield_kg_ha"] = int(rows[0]["yield_kg_ha"] * 1.05)
    errors = runner.check_reference(rows)
    assert len(errors) == 1 and "produtividade" in errors[0]


def test_missing_values_become_none():
    assert runner.as_int("-99") is None
    assert runner.as_int("abc") is None
    assert runner.doy_diff(2002072, 2002125) == 53
