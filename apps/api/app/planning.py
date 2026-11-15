"""Calendar feasibility for one field, independent of DSSAT simulation."""

from __future__ import annotations

from collections.abc import Callable
from datetime import date, timedelta
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, model_validator

CropLookup = Callable[[str], dict | None]


class CalendarModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PlantingWindow(CalendarModel):
    crop: str = Field(min_length=1, max_length=60)
    cultivar: str | None = Field(default=None, min_length=1, max_length=6)
    planting_date: date


class CalendarRequest(CalendarModel):
    horizon_start: date
    horizon_end: date
    known_crops: list[Annotated[str, Field(min_length=1, max_length=60)]] = Field(min_length=1, max_length=30)
    windows: list[PlantingWindow] = Field(min_length=1, max_length=60)
    max_cycles: int = Field(default=2, ge=1, le=3)
    max_candidates: int = Field(default=10, ge=1, le=30)
    min_gap_days: int = Field(default=0, ge=0, le=180)

    @model_validator(mode="after")
    def _check_horizon(self):
        if not 0 <= (self.horizon_end - self.horizon_start).days <= 1095:
            raise ValueError("o horizonte deve estar em ordem e abranger até 1096 dias")
        if any(not self.horizon_start <= w.planting_date <= self.horizon_end for w in self.windows):
            raise ValueError("datas de plantio devem estar dentro do horizonte")
        return self


class CalendarCycle(PlantingWindow):
    cultivar: str = Field(min_length=1, max_length=6)
    end_date: date

    @model_validator(mode="after")
    def _check_dates(self):
        if self.end_date < self.planting_date:
            raise ValueError("end_date não pode ser anterior ao plantio")
        return self


class CalendarReplanRequest(CalendarRequest):
    decision_date: date = Field(description="Último dia considerado realizado")
    route: list[CalendarCycle] = Field(min_length=1, max_length=3,
                                      description="Rota atual com início real dos ciclos já plantados e fim estimado para a cultura em pé")

    @model_validator(mode="after")
    def _check_route(self):
        if not self.horizon_start <= self.decision_date <= self.horizon_end:
            raise ValueError("decision_date deve estar dentro do horizonte")
        for previous, current in zip(self.route, self.route[1:]):
            if current.planting_date <= previous.end_date:
                raise ValueError("route deve estar em ordem cronológica e sem sobreposição")
        if len([cycle for cycle in self.route if cycle.planting_date <= self.decision_date]) > self.max_cycles:
            raise ValueError("max_cycles deve incluir os ciclos já iniciados")
        return self


def _crop(code: str, find_crop: CropLookup) -> dict:
    crop = find_crop(code)
    if crop is None:
        raise ValueError(f"cultura desconhecida: {code}")
    return crop


def _cultivar(crop: dict, cultivar: str | None) -> str:
    selected = cultivar.upper() if cultivar is not None else crop["default_cultivar"]["id"]
    if selected not in {item["id"] for item in crop["cultivars"]}:
        raise ValueError(f"cultivar {selected} inválido para {crop['code']}")
    return selected


def _options(req: CalendarRequest, find_crop: CropLookup) -> list[CalendarCycle]:
    known = {_crop(code, find_crop)["code"] for code in req.known_crops}
    options = {}
    for window in req.windows:
        crop = _crop(window.crop, find_crop)
        if crop["code"] not in known:
            raise ValueError(f"cultura fora de known_crops: {crop['code']}")
        cultivar = _cultivar(crop, window.cultivar)
        days = crop.get("cycle_days_max")
        if not isinstance(days, int) or days <= 0:
            raise ValueError(f"duração não disponível para {crop['code']}")
        if days > (req.horizon_end - window.planting_date).days:
            continue
        end = window.planting_date + timedelta(days=days)
        key = (window.planting_date, crop["code"], cultivar)
        options[key] = CalendarCycle(crop=crop["code"], cultivar=cultivar,
                                     planting_date=window.planting_date, end_date=end)
    return [options[key] for key in sorted(options)]


def _candidates(req: CalendarRequest, options: list[CalendarCycle],
                prefix: list[CalendarCycle], cutoff: date | None) -> dict:
    # Search longer calendars first. The schema bounds both depth and branching.
    def schedules(route, start_index, remaining):
        if remaining == 0:
            yield route
            return
        for i in range(start_index, len(options)):
            cycle = options[i]
            if cutoff is not None and cycle.planting_date <= cutoff:
                continue
            if route and (cycle.planting_date - route[-1].end_date).days <= req.min_gap_days:
                continue
            yield from schedules([*route, cycle], i + 1, remaining - 1)

    alternatives = []
    min_added = 0 if prefix else 1
    for count in range(req.max_cycles - len(prefix), min_added - 1, -1):
        for route in schedules(prefix, 0, count):
            if len(alternatives) == req.max_candidates:
                return {"candidates": alternatives, "truncated": True}
            alternatives.append({"cycles": [cycle.model_dump(mode="json") for cycle in route]})
    return {"candidates": alternatives, "truncated": False}


def _evidence() -> dict:
    return {
        "schema_version": "1",
        "evidence": {"scope": "calendar_only", "dssat_simulated": False, "is_actual_forecast": False},
        "provenance": {"duration": "cycle_days_max do catálogo Field Shift", "planting_dates": "informadas no pedido"},
        "assumptions": ["Datas de fim das alternativas são estimativas conservadoras do catálogo.",
                        "A ordem favorece mais ciclos e datas mais próximas. Não é ranking agronômico."],
    }


def generate_calendar(req: CalendarRequest, find_crop: CropLookup) -> dict:
    return {**_evidence(), **_candidates(req, _options(req, find_crop), [], None)}


def replan_calendar(req: CalendarReplanRequest, find_crop: CropLookup) -> dict:
    options = _options(req, find_crop)
    route = []
    for cycle in req.route:
        crop = _crop(cycle.crop, find_crop)
        route.append(cycle.model_copy(update={"crop": crop["code"], "cultivar": _cultivar(crop, cycle.cultivar)}))
    prefix = [cycle for cycle in route if cycle.planting_date <= req.decision_date]
    available = {(cycle.crop, cycle.cultivar, cycle.planting_date): cycle.end_date for cycle in options}
    future = route[len(prefix):]
    def fits_current_window(cycle: CalendarCycle) -> bool:
        earliest_end = available.get((cycle.crop, cycle.cultivar, cycle.planting_date))
        return earliest_end is not None and earliest_end <= cycle.end_date <= req.horizon_end

    valid_future = all(fits_current_window(cycle) for cycle in future)
    valid_gap = all((b.planting_date - a.end_date).days > req.min_gap_days
                    for a, b in zip(route, route[1:]) if b.planting_date > req.decision_date)
    can_keep = valid_future and valid_gap and len(route) <= req.max_cycles
    active = bool(prefix and prefix[-1].end_date >= req.decision_date)
    return {
        **_evidence(),
        "realized_prefix": [cycle.model_dump(mode="json") for cycle in prefix],
        "keep_route": {"status": "calendar_feasible" if can_keep else "calendar_infeasible",
                       "cycles": [cycle.model_dump(mode="json") for cycle in route],
                       "reason": None if can_keep else "O calendário anterior conflita com as janelas, durações ou limites atuais."},
        "keep_crop_adapt_future": _candidates(req, options, prefix, req.decision_date),
        "terminate_and_restart": {"status": "unsupported" if active else "not_applicable",
                                  "reason": "Encerramento da cultura e continuidade do solo exigem suporte do motor."},
    }
