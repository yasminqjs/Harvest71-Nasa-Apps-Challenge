"""NASA POWER AG API client and FAO-56 Penman-Monteith agroclimatic engine."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
import math
from typing import Any

import requests

NASA_POWER_ENDPOINT = "https://power.larc.nasa.gov/api/temporal/daily/point"
NASA_POWER_PARAMS = (
    "T2M_MAX,T2M_MIN,T2M,RH2M,ALLSKY_SFC_SW_DWN,WS2M,"
    "PRECTOTCORR,GWETROOT,GWETTOP,EVPTRNS"
)


@dataclass(frozen=True)
class NasaPowerSummary:
    et0_daily_mean_mm: float
    et0_30d_mm: float
    precip_30d_mm: float
    precip_cycle_mm: float
    gwetroot_latest: float
    gwettop_latest: float
    t2m_mean_c: float
    t2m_max_latest_c: float
    t2m_max_7d_c: float
    t2m_min_latest_c: float
    rh2m_mean_pct: float
    vpd_kpa: float
    evptrns_mean_mm_day: float
    gdd_accumulated_c_day: float
    fao56_ks: float
    fao56_p_depletion: float
    data_start: str
    data_end: str
    raw_days_count: int


def _valid_series(values_map: dict[str, float]) -> list[tuple[str, float]]:
    return [
        (k, float(v))
        for k, v in sorted(values_map.items())
        if v is not None and float(v) > -900.0
    ]


def _saturation_vapor_pressure_kpa(temp_c: float) -> float:
    return 0.6108 * math.exp((17.27 * temp_c) / (temp_c + 237.3))


def compute_fao56_et0_mm_day(
    *,
    lat_deg: float,
    elevation_m: float,
    doy: int,
    t_max_c: float,
    t_min_c: float,
    rh_mean_pct: float,
    rs_mj_m2_day: float,
    u2_m_s: float,
) -> tuple[float, float]:
    """Compute daily reference evapotranspiration ET0 (mm/day) and VPD (kPa) per FAO-56."""
    t_mean = 0.5 * (t_max_c + t_min_c)
    pressure_kpa = 101.3 * (((293.0 - 0.0065 * elevation_m) / 293.0) ** 5.26)
    gamma = 0.000665 * pressure_kpa

    es_tmax = _saturation_vapor_pressure_kpa(t_max_c)
    es_tmin = _saturation_vapor_pressure_kpa(t_min_c)
    es = 0.5 * (es_tmax + es_tmin)
    ea = max(0.05, min(es, (rh_mean_pct / 100.0) * es))
    vpd = max(0.05, es - ea)

    delta = (4098.0 * _saturation_vapor_pressure_kpa(t_mean)) / ((t_mean + 237.3) ** 2)

    lat_rad = math.radians(lat_deg)
    dr = 1.0 + 0.033 * math.cos((2.0 * math.pi / 365.0) * doy)
    declination = 0.409 * math.sin((2.0 * math.pi / 365.0) * doy - 1.39)
    arg = max(-1.0, min(1.0, -math.tan(lat_rad) * math.tan(declination)))
    ws = math.acos(arg)
    gsc = 0.0820
    ra = (
        (24.0 * 60.0 / math.pi)
        * gsc
        * dr
        * (
            ws * math.sin(lat_rad) * math.sin(declination)
            + math.cos(lat_rad) * math.cos(declination) * math.sin(ws)
        )
    )
    ra = max(1.0, ra)
    rso = (0.75 + 2e-5 * elevation_m) * ra
    rns = (1.0 - 0.23) * max(0.0, rs_mj_m2_day)
    rs_ratio = max(0.25, min(1.0, rs_mj_m2_day / max(0.1, rso)))
    sigma = 4.903e-9
    tmax_k4 = (t_max_c + 273.16) ** 4
    tmin_k4 = (t_min_c + 273.16) ** 4
    rnl = (
        sigma
        * 0.5
        * (tmax_k4 + tmin_k4)
        * (0.34 - 0.14 * math.sqrt(ea))
        * (1.35 * rs_ratio - 0.35)
    )
    rn = rns - rnl
    u2 = max(0.2, u2_m_s)

    numerator = 0.408 * delta * rn + gamma * (900.0 / (t_mean + 273.0)) * u2 * vpd
    denominator = delta + gamma * (1.0 + 0.34 * u2)
    et0 = max(0.1, numerator / max(0.01, denominator))
    return et0, vpd


def compute_fao56_ks(
    *,
    gwetroot: float,
    theta_wp: float,
    theta_fc: float,
    theta_sat: float,
    et0_daily_mm: float,
    p_base: float = 0.50,
) -> tuple[float, float]:
    """Compute FAO-56 water stress coefficient Ks from NASA MERRA-2 GWETROOT & soil retention.

    NASA MERRA-2 GWETROOT expresses degree of root-zone saturation (0..1), so
    volumetric water content is theta_v = GWETROOT * theta_sat (Saxton & Rawls porosity).
    The critical depletion fraction p is adjusted for atmospheric demand per FAO-56 Eq. 82.
    """
    p_adj = max(0.15, min(0.80, p_base + 0.04 * (5.0 - et0_daily_mm)))
    theta_v = max(0.0, min(theta_sat, gwetroot * theta_sat))
    denom = max(1e-4, (1.0 - p_adj) * max(0.02, theta_fc - theta_wp))
    ks = max(0.0, min(1.0, (theta_v - theta_wp) / denom))
    return round(ks, 3), round(p_adj, 3)


def fetch_nasa_power_agroclimate(
    *,
    lat: float,
    lon: float,
    planting_date: str | None,
    t_base_c: float,
    theta_wp: float,
    theta_fc: float,
    theta_sat: float,
    elevation_m: float = 400.0,
    p_base: float = 0.50,
    timeout_sec: float = 12.0,
) -> NasaPowerSummary:
    """Query NASA POWER AG daily point API synchronously and compute agroclimatic indices."""
    today = datetime.now(timezone.utc).date()
    if planting_date:
        try:
            plant_dt = date.fromisoformat(planting_date[:10])
        except ValueError:
            plant_dt = today - timedelta(days=48)
    else:
        plant_dt = today - timedelta(days=48)

    if plant_dt > today:
        plant_dt = today - timedelta(days=30)

    window_start = min(plant_dt, today - timedelta(days=35))
    start_str = window_start.strftime("%Y%m%d")
    end_str = today.strftime("%Y%m%d")

    params: dict[str, Any] = {
        "parameters": NASA_POWER_PARAMS,
        "community": "AG",
        "longitude": round(lon, 4),
        "latitude": round(lat, 4),
        "start": start_str,
        "end": end_str,
        "format": "JSON",
    }
    resp = requests.get(NASA_POWER_ENDPOINT, params=params, timeout=timeout_sec)
    resp.raise_for_status()
    payload = resp.json()
    param_data = payload["properties"]["parameter"]

    tmax_map = dict(_valid_series(param_data.get("T2M_MAX", {})))
    tmin_map = dict(_valid_series(param_data.get("T2M_MIN", {})))
    t2m_map = dict(_valid_series(param_data.get("T2M", {})))
    rh_map = dict(_valid_series(param_data.get("RH2M", {})))
    sw_map = dict(_valid_series(param_data.get("ALLSKY_SFC_SW_DWN", {})))
    ws_map = dict(_valid_series(param_data.get("WS2M", {})))
    precip_map = dict(_valid_series(param_data.get("PRECTOTCORR", {})))
    gwet_map = dict(_valid_series(param_data.get("GWETROOT", {})))
    gwettop_map = dict(_valid_series(param_data.get("GWETTOP", {})))
    evp_map = dict(_valid_series(param_data.get("EVPTRNS", {})))

    valid_dates = sorted(
        set(tmax_map.keys())
        & set(tmin_map.keys())
        & set(rh_map.keys())
        & set(sw_map.keys())
        & set(ws_map.keys())
    )
    if not valid_dates:
        raise ValueError("NASA POWER returned no valid meteorological days for window.")

    last30_dates = valid_dates[-30:]
    et0_series: list[float] = []
    vpd_series: list[float] = []

    for ds in last30_dates:
        dt = datetime.strptime(ds, "%Y%m%d").date()
        doy = dt.timetuple().tm_yday
        et0_d, vpd_d = compute_fao56_et0_mm_day(
            lat_deg=lat,
            elevation_m=elevation_m,
            doy=doy,
            t_max_c=tmax_map[ds],
            t_min_c=tmin_map[ds],
            rh_mean_pct=rh_map[ds],
            rs_mj_m2_day=sw_map[ds],
            u2_m_s=ws_map[ds],
        )
        et0_series.append(et0_d)
        vpd_series.append(vpd_d)

    et0_daily_mean = sum(et0_series) / len(et0_series)
    et0_30d = et0_daily_mean * 30.0

    precip_dates = sorted(precip_map.keys())
    precip_last30 = [precip_map[d] for d in precip_dates[-30:]]
    precip_30d = (sum(precip_last30) / max(1, len(precip_last30))) * min(30, max(len(precip_last30), 1))

    plant_ymd = plant_dt.strftime("%Y%m%d")
    cycle_dates = [d for d in sorted(set(tmax_map) & set(tmin_map)) if d >= plant_ymd]
    if not cycle_dates:
        cycle_dates = valid_dates[-30:]

    gdd_total = sum(
        max(0.0, 0.5 * (tmax_map[d] + tmin_map[d]) - t_base_c)
        for d in cycle_dates
    )
    precip_cycle = sum(precip_map.get(d, 0.0) for d in cycle_dates)

    gwetroot_vals = [v for _, v in sorted(gwet_map.items())]
    gwettop_vals = [v for _, v in sorted(gwettop_map.items())]
    gwetroot_latest = gwetroot_vals[-1] if gwetroot_vals else 0.5
    gwettop_latest = gwettop_vals[-1] if gwettop_vals else gwetroot_latest

    ks, p_adj = compute_fao56_ks(
        gwetroot=gwetroot_latest,
        theta_wp=theta_wp,
        theta_fc=theta_fc,
        theta_sat=theta_sat,
        et0_daily_mm=et0_daily_mean,
        p_base=p_base,
    )

    evp_vals = [evp_map[d] for d in sorted(evp_map.keys())[-10:]]
    evptrns_mean_mm = (sum(evp_vals) / len(evp_vals)) / 2.45 if evp_vals else et0_daily_mean * 0.5

    t2m_vals = [t2m_map[d] for d in last30_dates if d in t2m_map]
    t2m_mean = sum(t2m_vals) / len(t2m_vals) if t2m_vals else 0.5 * (
        tmax_map[last30_dates[-1]] + tmin_map[last30_dates[-1]]
    )
    tmax_7d = max(tmax_map[d] for d in last30_dates[-7:])
    rh_mean = sum(rh_map[d] for d in last30_dates) / len(last30_dates)

    return NasaPowerSummary(
        et0_daily_mean_mm=round(et0_daily_mean, 2),
        et0_30d_mm=round(et0_30d, 1),
        precip_30d_mm=round(precip_30d, 1),
        precip_cycle_mm=round(precip_cycle, 1),
        gwetroot_latest=round(gwetroot_latest, 3),
        gwettop_latest=round(gwettop_latest, 3),
        t2m_mean_c=round(t2m_mean, 2),
        t2m_max_latest_c=round(tmax_map[last30_dates[-1]], 2),
        t2m_max_7d_c=round(tmax_7d, 2),
        t2m_min_latest_c=round(tmin_map[last30_dates[-1]], 2),
        rh2m_mean_pct=round(rh_mean, 1),
        vpd_kpa=round(sum(vpd_series) / len(vpd_series), 3),
        evptrns_mean_mm_day=round(evptrns_mean_mm, 2),
        gdd_accumulated_c_day=round(gdd_total, 1),
        fao56_ks=ks,
        fao56_p_depletion=p_adj,
        data_start=valid_dates[0],
        data_end=valid_dates[-1],
        raw_days_count=len(valid_dates),
    )
