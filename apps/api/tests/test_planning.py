from app.main import find_crop
from app.planning import CalendarReplanRequest, CalendarRequest, generate_calendar, replan_calendar


def request_fields():
    return {
        "horizon_start": "2025-01-01",
        "horizon_end": "2026-01-01",
        "known_crops": ["milho", "caupi"],
        "windows": [
            {"crop": "MZ", "planting_date": "2025-01-01"},
            {"crop": "CP", "planting_date": "2025-02-01"},
            {"crop": "CP", "planting_date": "2025-06-01"},
        ],
    }


def test_calendar_skips_overlap_and_reports_candidate_limit():
    result = generate_calendar(CalendarRequest(**request_fields(), max_candidates=1), find_crop)
    assert result["evidence"]["dssat_simulated"] is False
    assert result["truncated"] is True
    route = result["candidates"][0]["cycles"]
    assert [cycle["crop"] for cycle in route] == ["MZ", "CP"]
    assert route[1]["planting_date"] == "2025-06-01"


def test_replan_keeps_current_cycle_and_rejects_shortened_future_cycle():
    fields = request_fields()
    route = generate_calendar(CalendarRequest(**fields), find_crop)["candidates"][0]["cycles"]
    route[1]["end_date"] = "2025-06-02"
    request = CalendarReplanRequest(**fields, decision_date="2025-03-01", route=route)
    result = replan_calendar(request, find_crop)
    assert result["realized_prefix"] == route[:1]
    assert result["keep_route"]["status"] == "calendar_infeasible"
    assert all(item["cycles"][:1] == route[:1] for item in result["keep_crop_adapt_future"]["candidates"])
    assert result["terminate_and_restart"]["status"] == "unsupported"
