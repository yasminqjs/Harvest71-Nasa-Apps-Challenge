"""Run the rotation comparison in the pinned DSSAT image with synthetic inputs."""
import json
import sys
from datetime import date
from pathlib import Path

import fieldshift_inputs as fi
from rotation_compare import compare
from tests.test_point import ps_identify_doc, synthetic_power


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
