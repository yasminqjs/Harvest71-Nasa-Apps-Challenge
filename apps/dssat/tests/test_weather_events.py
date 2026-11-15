from datetime import date

import pytest

from weather_events import WeatherEvent, apply_power_events


def test_power_event_preserves_source_and_only_alters_selected_days():
    rain = {"20240228": 12, "20240229": 10, "20240301": 5, "20240302": 8}
    power = {"properties": {"parameter": {"PRECTOTCORR": rain}}}
    event = WeatherEvent("seca", "rainfall_multiplier", date(2024, 2, 29), date(2024, 3, 1), 0.2)
    transformed, manifest = apply_power_events(power, [event])

    assert transformed["properties"]["parameter"]["PRECTOTCORR"] == {
        "20240228": 12, "20240229": 2, "20240301": 1, "20240302": 8,
    }
    assert rain["20240229"] == 10
    assert manifest["events"][0]["start_date"] == "2024-02-29"


@pytest.mark.parametrize("invalid", [None, -999, float("nan")])
def test_power_event_rejects_unusable_rainfall(invalid):
    power = {"properties": {"parameter": {"PRECTOTCORR": {"20240229": invalid}}}}
    event = WeatherEvent("seca", "rainfall_multiplier", date(2024, 2, 29), date(2024, 2, 29), 0)
    with pytest.raises(ValueError, match="chuva ausente ou inválida"):
        apply_power_events(power, [event])
