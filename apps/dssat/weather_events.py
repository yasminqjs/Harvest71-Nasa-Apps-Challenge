"""Transformações explícitas para cenários meteorológicos hipotéticos.

Essas transformações alteram apenas uma cópia da série diária. Não representam
previsão e não modificam a fonte usada por outros candidatos.
"""
from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from datetime import date
import math
from typing import Iterable

from fieldshift_inputs import Weather


@dataclass(frozen=True)
class WeatherEvent:
    id: str
    type: str
    start_date: date
    end_date: date
    factor: float
    source_kind: str = "hypothetical"


TRANSFORM_VERSION = "weather-events-v1"


def apply_weather_events(weather: Weather, events: Iterable[WeatherEvent]) -> tuple[Weather, dict]:
    """Aplica fatores hipotéticos de chuva em janelas inclusivas.

    V1 aceita somente `rainfall_multiplier`, fatores finitos de 0 a 1 e eventos
    sem sobreposição. Falta de dia/chuva é erro: não se inventa clima para
    completar uma transformação.
    """
    event_list = tuple(events)
    ids: set[str] = set()
    claimed_dates: set[date] = set()

    for event in event_list:
        if not event.id or event.id in ids:
            raise ValueError("event id deve ser único e não vazio")
        ids.add(event.id)
        if event.type != "rainfall_multiplier":
            raise ValueError(f"tipo de evento não suportado: {event.type}")
        if event.source_kind != "hypothetical":
            raise ValueError("v1 aceita apenas eventos hipotéticos")
        if event.end_date < event.start_date:
            raise ValueError("end_date deve ser igual ou posterior a start_date")
        if not isinstance(event.factor, (int, float)) or isinstance(event.factor, bool):
            raise ValueError("factor deve ser numérico")
        if not math.isfinite(event.factor) or not 0 <= event.factor <= 1:
            raise ValueError("factor deve estar entre 0 e 1")

        days = (event.end_date - event.start_date).days + 1
        if days > 3660:
            raise ValueError("evento excede o limite de 10 anos")
        dates = {date.fromordinal(event.start_date.toordinal() + offset) for offset in range(days)}
        if claimed_dates.intersection(dates):
            raise ValueError("eventos de chuva sobrepostos não são suportados em v1")
        claimed_dates.update(dates)

    transformed = deepcopy(weather)
    for event in event_list:
        for ordinal in range(event.start_date.toordinal(), event.end_date.toordinal() + 1):
            day = date.fromordinal(ordinal)
            values = transformed.days.get(day)
            if values is None or values.get("RAIN") is None:
                raise ValueError(f"chuva ausente em {day.isoformat()}")
            rain = values["RAIN"]
            if rain < 0:
                raise ValueError(f"chuva negativa em {day.isoformat()}")
            values["RAIN"] = rain * event.factor

    manifest = {
        "transform_version": TRANSFORM_VERSION,
        "source_kind": "hypothetical" if event_list else "historical_unmodified",
        "events": [
            {
                "id": event.id,
                "type": event.type,
                "start_date": event.start_date.isoformat(),
                "end_date": event.end_date.isoformat(),
                "factor": float(event.factor),
                "source_kind": event.source_kind,
            }
            for event in event_list
        ],
    }
    return transformed, manifest


def apply_power_events(power_doc: dict, events: Iterable[WeatherEvent]) -> tuple[dict, dict]:
    """Aplica eventos à resposta diária NASA POWER, preservando o documento original."""
    event_list = tuple(events)
    transformed = deepcopy(power_doc)
    rainfall = transformed.get("properties", {}).get("parameter", {}).get("PRECTOTCORR")
    if not isinstance(rainfall, dict):
        if event_list:
            raise ValueError("NASA POWER sem série PRECTOTCORR")
        return transformed, {"transform_version": TRANSFORM_VERSION, "source_kind": "historical_unmodified", "events": []}

    # Valida integralmente antes de modificar; não permite eventos sobre datas repetidas.
    covered: set[date] = set()
    for event in event_list:
        if event.type != "rainfall_multiplier" or event.source_kind != "hypothetical":
            raise ValueError("evento não suportado em v1")
        if not event.id or event.end_date < event.start_date:
            raise ValueError("id ou intervalo do evento inválido")
        if not isinstance(event.factor, (int, float)) or isinstance(event.factor, bool) or not math.isfinite(event.factor) or not 0 <= event.factor <= 1:
            raise ValueError("factor deve ser finito e estar entre 0 e 1")
        if (event.end_date - event.start_date).days + 1 > 3660:
            raise ValueError("evento excede o limite de 10 anos")
        for ordinal in range(event.start_date.toordinal(), event.end_date.toordinal() + 1):
            day = date.fromordinal(ordinal)
            key = day.strftime("%Y%m%d")
            if day in covered:
                raise ValueError("eventos de chuva sobrepostos não são suportados em v1")
            if key not in rainfall or rainfall[key] is None or float(rainfall[key]) < 0:
                raise ValueError(f"chuva ausente ou inválida em {day.isoformat()}")
            covered.add(day)

    for event in event_list:
        for ordinal in range(event.start_date.toordinal(), event.end_date.toordinal() + 1):
            key = date.fromordinal(ordinal).strftime("%Y%m%d")
            rainfall[key] = float(rainfall[key]) * float(event.factor)
    manifest = {
        "transform_version": TRANSFORM_VERSION,
        "source_kind": "hypothetical" if event_list else "historical_unmodified",
        "events": [{"id": e.id, "type": e.type, "start_date": e.start_date.isoformat(),
                    "end_date": e.end_date.isoformat(), "factor": float(e.factor), "source_kind": e.source_kind}
                   for e in event_list],
    }
    return transformed, manifest
