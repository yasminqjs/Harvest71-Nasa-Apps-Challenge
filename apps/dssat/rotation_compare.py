"""Compare the orders of a rotation of two or three crops under a shared historical year."""
import argparse
import json
import subprocess
from datetime import date
from itertools import permutations
from pathlib import Path

import fieldshift_inputs as fi
import runner


def compare(power: Path, soil: Path, work: Path, crops: tuple[str, ...],
            dates: tuple[date, ...]) -> dict:
    if (len(crops) not in (2, 3) or len(set(crops)) != len(crops)
            or len(dates) != len(crops) or tuple(sorted(set(dates))) != dates
            or dates[0].year != dates[-1].year):
        raise ValueError("Informe duas ou três culturas distintas e datas crescentes no mesmo ano.")
    for code in crops:
        fi.get_crop(code)
    weather = fi.read_power_json(power)
    profile = fi.build_soil(fi.read_pronasolos_csv(soil), soil_id="FSFSPT0001")
    alternatives = []
    failed = []
    for index, order in enumerate(permutations(crops)):
        name = "baseline" if index == 0 else "reversed" if len(crops) == 2 else "-".join(order)
        try:
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
            alternatives.append({"id": name, "order": list(order), "cycles": selected,
                                 "engine_rows": len(seasons)})
        except (RuntimeError, ValueError, FileNotFoundError, subprocess.TimeoutExpired) as exc:
            runner.log(f"Rotação {name}: {exc}")
            failed.append({"id": name, "order": list(order),
                           "reason": "DSSAT não retornou todos os plantios nas datas solicitadas."})
    if not alternatives:
        raise ValueError("Nenhuma ordem completou os plantios solicitados. Confira as datas e o espaçamento entre ciclos.")
    baseline = next((item for item in alternatives if item["id"] == "baseline"), None)
    if baseline:
        by_crop = {row["crop"]: row for row in baseline["cycles"]}
        for alternative in alternatives:
            delta = {}
            for row in alternative["cycles"]:
                reference = by_crop[row["crop"]]
                delta[row["crop"]] = {
                    metric: row[metric] - reference[metric]
                    if row[metric] is not None and reference[metric] is not None else None
                    for metric in ("yield_kg_ha", "biomass_kg_ha", "rain_mm", "et_mm")
                }
            alternative["minus_baseline"] = delta
    reversed_result = next((item for item in alternatives if item["id"] == "reversed"), {})
    return {
        "alternatives": alternatives,
        "reversed_minus_baseline": reversed_result.get("minus_baseline"),
        "failed_alternatives": failed,
        "baseline_id": baseline["id"] if baseline else None,
        "evidence": {"quality_level": "exploratorio", "is_actual_forecast": False},
        "assumptions": ["Sequeiro, cultivares padrão, um ano histórico e sem simulação de nitrogênio."],
        "provenance": {"weather_sha256": runner.sha256(power), "soil_sha256": runner.sha256(soil)},
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("power", type=Path)
    parser.add_argument("soil", type=Path)
    parser.add_argument("work", type=Path)
    parser.add_argument("--crops", nargs="+", default=["MZ", "CP"])
    parser.add_argument("--dates", nargs="+", type=date.fromisoformat, required=True)
    args = parser.parse_args()
    result = compare(args.power, args.soil, args.work.resolve(), tuple(args.crops), tuple(args.dates))
    print(json.dumps(result, ensure_ascii=False, indent=2))
