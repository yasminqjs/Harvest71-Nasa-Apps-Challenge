"""Bounded search across crop orders evaluated on shared historical calendars."""
import subprocess
from collections import Counter
from datetime import date
from itertools import permutations
from pathlib import Path

import fieldshift_inputs as fi
import runner
from rotation_compare import run_order

MAX_CANDIDATES = 8
MAX_YEARS = 3
ORDER_TIMEOUT = 20


def _candidate_orders(crops, dates, limit, pairs):
    durations = {code: fi.get_crop(code)["cycle_days_max"] for code in crops}
    valid = {size: [] for size in (2, 3)}
    discarded = 0
    unsupported = 0
    for size in valid:
        for order in permutations(sorted(crops), size):
            if any(frozenset(pair) not in pairs for pair in zip(order, order[1:])):
                unsupported += 1
                continue
            if any((end - start).days <= durations[code]
                   for code, start, end in zip(order, dates, dates[1:size])):
                discarded += 1
            else:
                valid[size].append(order)
    eligible = sum(map(len, valid.values()))
    used = Counter()
    selected = []
    while len(selected) < limit and any(valid.values()):
        for size in (3, 2):
            if not valid[size] or len(selected) == limit:
                continue
            order = min(valid[size], key=lambda item: (
                sum(used[code, slot] for slot, code in enumerate(item)), item,
            ))
            valid[size].remove(order)
            used.update((code, slot) for slot, code in enumerate(order))
            selected.append(order)
    return selected, eligible, discarded, unsupported


def search(power: Path, soil: Path, work: Path, req: dict) -> dict:
    crops = tuple(req["supported_crops"])
    dates = tuple(date.fromisoformat(day) for day in req["planting_dates"])
    years = req["historical_start_years"]
    limit = req["max_candidates"]
    targets = req["yield_targets_kg_ha"]
    if not (2 <= len(years) <= MAX_YEARS and 2 <= limit <= MAX_CANDIDATES):
        raise ValueError("Pedido excede o orçamento de simulação.")
    calendars = [
        tuple(day.replace(year=year + day.year - dates[0].year) for day in dates)
        for year in years
    ]
    pairs = {frozenset(pair) for pair in req.get("sequence_pairs", [("MZ", "CP"), ("MZ", "SG"), ("CP", "SG")])}
    orders, eligible, discarded, unsupported = _candidate_orders(crops, dates, limit, pairs)
    weather = fi.read_power_json(power)
    profile = fi.build_soil(fi.read_pronasolos_csv(soil), soil_id="FSFSPT0001")
    ranked, incomplete = [], []
    for order in orders:
        name = "-".join(order)
        samples, failures = [], []
        for year, calendar in zip(years, calendars):
            try:
                sample = run_order(weather, profile, work / name / str(year), name,
                                   order, calendar[:len(order)], timeout=ORDER_TIMEOUT)
                ratios = []
                for cycle in sample["cycles"]:
                    code = cycle["crop"]
                    variable = fi.get_crop(code)["yield_variable"]
                    key = "biomass_kg_ha" if variable == "CWAM" else "yield_kg_ha"
                    value = cycle[key]
                    if value is None or value < 0:
                        raise ValueError(f"Produção ausente para {code}.")
                    ratios.append(min(value / targets[code], 1.0))
                samples.append({
                    "start_year": year, "cycles": sample["cycles"],
                    "all_targets_met": all(ratio == 1.0 for ratio in ratios),
                    "mean_target_attainment": sum(ratios) / len(ratios),
                })
            except (RuntimeError, ValueError, FileNotFoundError, subprocess.TimeoutExpired) as exc:
                runner.log(f"Busca de rotação {name}/{year}: {exc}")
                failures.append(year)
        option = {"id": name, "order": list(order), "samples": samples}
        if failures:
            incomplete.append(option | {"failed_years": failures})
            continue
        ranked.append(option | {
            "years_all_targets_met": sum(sample["all_targets_met"] for sample in samples),
            "mean_target_attainment": sum(sample["mean_target_attainment"] for sample in samples) / len(years),
        })

    ranked.sort(key=lambda item: (-item["years_all_targets_met"],
                                  -item["mean_target_attainment"], item["id"]))
    return {
        "recommendations": ranked[:3],
        "ranked_alternatives": ranked,
        "incomplete_alternatives": incomplete,
        "excluded_crops": req["excluded_crops"],
        "search": {"calendar_eligible": eligible, "calendar_filtered": discarded,
                   "pair_filtered": unsupported, "attempted_candidates": len(orders), "budget_omitted": eligible - len(orders),
                   "historical_start_years": years,
                   "ranking": ["years_all_targets_met", "mean_target_attainment"]},
        "evidence": {"quality_level": "exploratorio", "is_actual_forecast": False},
        "assumptions": ["Sequeiro e cultivares padrão.",
                        "O filtro usa a duração de referência do catálogo e pode descartar ciclos mais curtos.",
                        "A classificação compara o cumprimento de metas por cultura, limitado a 100%."],
        "provenance": {"weather_sha256": runner.sha256(power), "soil_sha256": runner.sha256(soil)},
    }
