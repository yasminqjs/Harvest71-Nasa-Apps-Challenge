"""Run the rotation comparison in the pinned DSSAT image with synthetic inputs."""
import json
import sys
from datetime import date, timedelta
from itertools import combinations
from pathlib import Path
from time import monotonic

import fieldshift_inputs as fi
from rotation_compare import compare
from rotation_search import search
from tests.test_point import ps_identify_doc, synthetic_power


def screen_catalog(power: Path, soil: Path, work: Path) -> None:
    """Record pair-specific engine evidence, using only catalog and fixture data."""
    catalog = {crop["code"]: crop for crop in fi.catalog()["crops"]}
    regional = ("MZ", "CP", "SG", "BN", "PN", "ML", "PP")
    pairs = list(combinations(regional, 2))
    pairs.extend(("MZ", code) for code in catalog if code not in regional)
    first = date(1992, 1, 15)
    deadline = monotonic() + 8 * 60
    entries = []
    for pair in pairs:
        # Try a planting date with room for the longer first cycle in either order.
        durations = [catalog[code].get("cycle_days_max") for code in pair]
        if any(not duration for duration in durations):
            entries.append({"crops": list(pair), "status": "skipped", "reason": "missing_cycle_duration"})
            continue
        second = first + timedelta(days=max(180, max(durations) + 35))
        entry = {"crops": list(pair), "planting_dates": [first.isoformat(), second.isoformat()]}
        if monotonic() >= deadline:
            entries.append({**entry, "status": "skipped", "reason": "probe_budget"})
            continue
        try:
            result = compare(power, soil, work / "catalog" / "-".join(pair), pair, (first, second))
        except ValueError as exc:
            entries.append({**entry, "status": "failed", "reason": str(exc)})
            continue
        successful = [alt["order"] for alt in result["alternatives"]]
        verified = len(successful) == 2 and not result["failed_alternatives"]
        entries.append({**entry, "status": "verified" if verified else "partial",
                        "successful_orders": successful, "failed_orders": result["failed_alternatives"]})

    report = {
        "fixture": "synthetic_power + ps_identify_doc",
        "evidence": "DSSAT Q completed the two crop orders on the recorded dates; no local calibration.",
        "pairs": entries,
    }
    (work / "sequence-eligibility.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("Catalog sequence probe:", sum(entry["status"] == "verified" for entry in entries),
          "verified pairs out of", len(entries))


if __name__ == "__main__":
    work = Path(sys.argv[1]).resolve()
    work.mkdir(parents=True, exist_ok=True)
    power = work / "power.json"
    power.write_text(json.dumps(synthetic_power()))
    soil = work / "soil.csv"
    soil.write_text(fi.pronasolos_identify_to_csv(ps_identify_doc()))
    result = compare(power, soil, work, ("MZ", "CP"), (date(1992, 1, 15), date(1992, 7, 15)))
    (work / "comparison.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result))
    trio = compare(power, soil, work / "trio", ("MZ", "CP", "SG"),
                   (date(1992, 1, 15), date(1992, 5, 20), date(1993, 1, 15)))
    assert len(trio["alternatives"]) + len(trio["failed_alternatives"]) == 6
    (work / "trio-comparison.json").write_text(json.dumps(trio, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(trio))
    portfolio = search(power, soil, work / "search", {
        "supported_crops": ["MZ", "CP", "SG"],
        "excluded_crops": ["CS"],
        "planting_dates": ["1992-01-15", "1992-06-15", "1993-01-15"],
        "historical_start_years": [1992, 1993],
        "yield_targets_kg_ha": {"MZ": 4000, "CP": 700, "SG": 3500},
        "max_candidates": 8,
    })
    assert portfolio["recommendations"]
    assert all(len(option["samples"]) == 2 for option in portfolio["ranked_alternatives"])
    (work / "rotation-search.json").write_text(json.dumps(portfolio, indent=2), encoding="utf-8")
    screen_catalog(power, soil, work)
