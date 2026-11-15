"""Run an experimental mixed-crop Q batch using existing synthetic fixtures."""

import json
import subprocess
import sys
from datetime import date
from pathlib import Path

import fieldshift_inputs as fi
import runner
from tests.test_point import ps_identify_doc, synthetic_power


def probe(work: Path) -> None:
    work.mkdir(parents=True, exist_ok=True)
    power = work / "power.json"
    power.write_text(json.dumps(synthetic_power()))
    weather = fi.read_power_json(power)
    fi.write_wth_files(weather, "FSPT", work, "Sequence probe")
    profile = fi.build_soil(fi.read_pronasolos_csv_text(fi.pronasolos_identify_to_csv(ps_identify_doc())),
                            soil_id="FSFSPT0001")
    fi.write_sol(profile, work / "FS.SOL", "Sequence probe", weather.lat, weather.lon)
    rows = ["$BATCH SEQUENCE PROBE"]
    for rotation, (code, planting) in enumerate(
        [("MZ", date(1992, 1, 15)), ("CP", date(1992, 7, 15))], start=1
    ):
        filex = work / f"FSPT000{rotation}.{code}X"
        fi.write_filex(filex, "FSPT", code, profile,
                       [fi.Scenario(1, code, planting, False)], 1,
                       crop=fi.get_crop(code), daily_water_output=True)
        rows.append(f"{filex.name:<92} {1:6d} {1:6d} {rotation:6d}")
    batch = work / "DSSBatch.v48"
    batch.write_text("\n".join(rows) + "\n", encoding="ascii")
    proc = subprocess.run([str(runner.EXE), "Q", batch.name], cwd=work,
                          input="", capture_output=True, text=True, timeout=60)
    (work / "process.log").write_text(proc.stdout + "\n" + proc.stderr, encoding="utf-8")
    summary = work / "Summary.OUT"
    records = runner.parse_summary(summary) if summary.exists() else []
    models = {row.get("MODEL", "").strip() for row in records}
    print(f"Q returncode={proc.returncode}, rows={len(records)}, models={sorted(models)}")
    if proc.returncode or len(models - {""}) < 2 or not (work / "SoilWat.OUT").is_file():
        print(proc.stdout[-4000:] + proc.stderr[-4000:])
        raise SystemExit("mixed-crop sequence or daily soil output missing")


if __name__ == "__main__":
    probe(Path(sys.argv[1]).resolve())
