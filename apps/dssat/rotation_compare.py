"""Compare the orders of a two-crop rotation under a shared historical year."""
import argparse
import json
import subprocess
from datetime import date
from pathlib import Path

import fieldshift_inputs as fi
import runner


def compare(power: Path, soil: Path, work: Path, crops: tuple[str, str],
            dates: tuple[date, date]) -> dict:
    if len(set(crops)) != 2 or not dates[0] < dates[1] or dates[0].year != dates[1].year:
        raise ValueError("Informe duas culturas diferentes e duas datas em ordem no mesmo ano.")
    weather = fi.read_power_json(power)
    profile = fi.build_soil(fi.read_pronasolos_csv(soil), soil_id="FSFSPT0001")
    alternatives = []
    for name, order in (("baseline", crops), ("reversed", crops[::-1])):
        folder = work / name
        folder.mkdir(parents=True)
        fi.write_wth_files(weather, "FSPT", folder, "Rotation comparison")
        fi.write_sol(profile, folder / "FS.SOL", "Rotation comparison", weather.lat, weather.lon)
        rows = ["$BATCH ROTATION COMPARISON"]
        for rotation, (code, planting) in enumerate(zip(order, dates), start=1):
            crop = fi.get_crop(code)
            filex = folder / f"FSPT000{rotation}.{crop['code']}X"
            fi.write_filex(filex, "FSPT", code, profile,
                           [fi.Scenario(1, code, planting, False)], 1,
                           crop=crop, daily_water_output=True, rotation_number=rotation)
            rows.append(f"{filex.name:<92} {1:6d} {1:6d} {rotation:6d}")
        batch = folder / "DSSBatch.v48"
        batch.write_text("\n".join(rows) + "\n", encoding="ascii")
        proc = subprocess.run([str(runner.EXE.resolve()), "Q", batch.name], cwd=folder,
                              input="", capture_output=True, text=True, timeout=60)
        (folder / "process.log").write_text(proc.stdout + "\n" + proc.stderr, encoding="utf-8")
        if proc.returncode:
            raise RuntimeError(f"{name}: DSSAT Q retornou {proc.returncode}\n{proc.stdout[-2000:]}")
        seasons = runner.summarize(runner.parse_summary(folder / "Summary.OUT"))
        selected = []
        for code, planting in zip(order, dates):
            target = planting.year * 1000 + planting.timetuple().tm_yday
            matches = [row for row in seasons if row["crop"] == code and row["planting_yyyyddd"] == target]
            if len(matches) != 1:
                raise RuntimeError(f"{name}: esperado um ciclo de {code} em {planting}; obtido {seasons}")
            selected.append(matches[0])
        unexpected = [
            row for row in seasons if row not in selected
            and row["planting_yyyyddd"] and row["planting_yyyyddd"] // 1000 <= dates[0].year
        ]
        if unexpected:
            raise ValueError(f"{name}: o motor registrou plantios extras dentro do ano comparado.")
        alternatives.append({"id": name, "cycles": selected, "engine_rows": len(seasons)})
    deltas = {}
    for base, other in zip(alternatives[0]["cycles"], reversed(alternatives[1]["cycles"])):
        deltas[base["crop"]] = {}
        for metric in ("yield_kg_ha", "biomass_kg_ha", "rain_mm", "et_mm"):
            a, b = base[metric], other[metric]
            deltas[base["crop"]][metric] = b - a if a is not None and b is not None else None
    return {
        "alternatives": alternatives,
        "reversed_minus_baseline": deltas,
        "evidence": {"quality_level": "exploratorio", "is_actual_forecast": False},
        "assumptions": ["Sequeiro, cultivares padrão, um ano histórico e sem simulação de nitrogênio."],
        "provenance": {"weather_sha256": runner.sha256(power), "soil_sha256": runner.sha256(soil)},
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("power", type=Path)
    parser.add_argument("soil", type=Path)
    parser.add_argument("work", type=Path)
    parser.add_argument("--crops", nargs=2, default=["MZ", "CP"])
    parser.add_argument("--dates", nargs=2, type=date.fromisoformat, required=True)
    args = parser.parse_args()
    result = compare(args.power, args.soil, args.work.resolve(), tuple(args.crops), tuple(args.dates))
    print(json.dumps(result, ensure_ascii=False, indent=2))
