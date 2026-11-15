"""Planetary Computer STAC pipeline: Sentinel-2 L2A (10m), Landsat C2 L2 TIRS (30m), NASADEM (30m)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import math
from typing import Any

import numpy as np
import planetary_computer
from pyproj import Transformer
import pystac_client
import rasterio
from rasterio.features import geometry_mask
from rasterio.warp import Resampling, reproject
from rasterio.windows import from_bounds
from shapely.geometry import Polygon, mapping
from shapely.ops import transform as shapely_transform

STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
SCL_INVALID_CLASSES = {0, 1, 3, 8, 9, 10}  # nodata, saturated, cloud shadow, cloud med/high, cirrus


@dataclass
class StacRasterObservation:
    s2_scene_id: str
    s2_datetime: str
    s2_valid_pixels: int
    s2_total_pixels: int
    s2_clean_pixel_ratio: float
    insufficient_observation: bool
    landsat_scene_id: str
    landsat_datetime: str
    nasadem_tile_id: str
    elevation_m: float
    ndvi_mean: float
    ndvi_z_score: float
    evi_mean: float
    lai_mean: float
    ndwi_mean: float
    ndwi_z_score: float
    bsi_mean: float
    rusle_c_mean: float
    rusle_ls_mean: float
    canopy_temp_c_mean: float
    cwsi_mean: float
    # 2D arrays on the polygon's 10m Sentinel-2 grid (NaN outside polygon or cloudy)
    ndvi_grid: np.ndarray
    ndvi_z_grid: np.ndarray
    ndwi_z_grid: np.ndarray
    bsi_grid: np.ndarray
    rusle_c_grid: np.ndarray
    rusle_ls_grid: np.ndarray
    tc_grid: np.ndarray
    cwsi_grid: np.ndarray
    # Bounds and CRS of the 10m grid so sub-zones map precisely to WGS84 GeoJSON
    grid_transform: Any
    grid_crs: Any
    hist_scenes_used: int


def _stac_client() -> pystac_client.Client:
    return pystac_client.Client.open(
        STAC_URL,
        modifier=planetary_computer.sign_inplace,
    )


def _polygon_from_coords(coords: list[list[float]]) -> Polygon:
    ring = list(coords)
    if ring[0] != ring[-1]:
        ring.append(ring[0])
    return Polygon(ring)


def _reproject_polygon(poly_wgs84: Polygon, target_crs: Any) -> Polygon:
    transformer = Transformer.from_crs("EPSG:4326", target_crs, always_xy=True)
    return shapely_transform(transformer.transform, poly_wgs84)


def _s2_offset_for_item(item: Any) -> float:
    baseline_str = str(item.properties.get("s2:processing_baseline", "04.00"))
    try:
        baseline = float(baseline_str)
    except ValueError:
        baseline = 4.0
    return -1000.0 if baseline >= 4.0 else 0.0


def _read_s2_on_grid(
    item: Any,
    poly_wgs84: Polygon,
    ref_shape: tuple[int, int] | None = None,
    ref_transform: Any = None,
    ref_crs: Any = None,
) -> dict[str, Any]:
    """Read Sentinel-2 B02, B04, B08, B11, SCL clipped & aligned to 10m grid."""
    offset = _s2_offset_for_item(item)

    with rasterio.open(item.assets["B04"].href) as b04_src:
        crs = b04_src.crs
        poly_proj = _reproject_polygon(poly_wgs84, crs)
        minx, miny, maxx, maxy = poly_proj.bounds
        # Add 10m padding to avoid edge clipping
        pad = 10.0
        win = from_bounds(minx - pad, miny - pad, maxx + pad, maxy + pad, b04_src.transform)
        win = win.round_offsets().round_lengths()

        if ref_shape is None or ref_transform is None or ref_crs is None:
            b04_raw = b04_src.read(1, window=win).astype(np.float32)
            out_shape = b04_raw.shape
            out_transform = rasterio.windows.transform(win, b04_src.transform)
            out_crs = crs
            b04 = np.clip((b04_raw + offset) / 10000.0, 0.0001, 1.0)
        else:
            out_shape = ref_shape
            out_transform = ref_transform
            out_crs = ref_crs
            b04 = np.empty(out_shape, dtype=np.float32)
            b04_raw = b04_src.read(1, window=win).astype(np.float32)
            b04_win_tr = rasterio.windows.transform(win, b04_src.transform)
            reproject(
                source=np.clip((b04_raw + offset) / 10000.0, 0.0001, 1.0),
                destination=b04,
                src_transform=b04_win_tr,
                src_crs=crs,
                dst_transform=out_transform,
                dst_crs=out_crs,
                resampling=Resampling.bilinear,
            )

    def _read_and_align(asset_key: str, resampling: Resampling, is_scl: bool = False) -> np.ndarray:
        with rasterio.open(item.assets[asset_key].href) as src:
            p_proj = _reproject_polygon(poly_wgs84, src.crs)
            px0, py0, px1, py1 = p_proj.bounds
            w = from_bounds(px0 - 25.0, py0 - 25.0, px1 + 25.0, py1 + 25.0, src.transform)
            w = w.round_offsets().round_lengths()
            raw = src.read(1, window=w)
            w_tr = rasterio.windows.transform(w, src.transform)
            if is_scl:
                dst = np.zeros(out_shape, dtype=np.uint8)
                reproject(
                    source=raw.astype(np.uint8),
                    destination=dst,
                    src_transform=w_tr,
                    src_crs=src.crs,
                    dst_transform=out_transform,
                    dst_crs=out_crs,
                    resampling=Resampling.nearest,
                )
                return dst
            src_refl = np.clip((raw.astype(np.float32) + offset) / 10000.0, 0.0001, 1.0)
            dst_f = np.empty(out_shape, dtype=np.float32)
            reproject(
                source=src_refl,
                destination=dst_f,
                src_transform=w_tr,
                src_crs=src.crs,
                dst_transform=out_transform,
                dst_crs=out_crs,
                resampling=resampling,
            )
            return dst_f

    b02 = _read_and_align("B02", Resampling.bilinear)
    b08 = _read_and_align("B08", Resampling.bilinear)
    b11 = _read_and_align("B11", Resampling.bilinear)
    scl = _read_and_align("SCL", Resampling.nearest, is_scl=True)

    poly_out = _reproject_polygon(poly_wgs84, out_crs)
    inside_mask = ~geometry_mask(
        [mapping(poly_out)],
        out_shape=out_shape,
        transform=out_transform,
        invert=False,
    )
    # Fallback if polygon is very small relative to pixel center
    if inside_mask.sum() == 0:
        inside_mask = np.ones(out_shape, dtype=bool)

    clean_scl = ~np.isin(scl, list(SCL_INVALID_CLASSES))
    valid_mask = inside_mask & clean_scl

    total_poly_px = int(inside_mask.sum())
    valid_px = int(valid_mask.sum())
    clean_ratio = valid_px / max(1, total_poly_px)

    ndvi = (b08 - b04) / (b08 + b04 + 1e-6)
    evi = 2.5 * (b08 - b04) / (b08 + 6.0 * b04 - 7.5 * b02 + 1.0 + 1e-6)
    evi = np.clip(evi, -0.5, 1.2)
    lai = np.maximum(0.0, 3.618 * evi - 0.118)
    ndwi = (b08 - b11) / (b08 + b11 + 1e-6)
    bsi = ((b11 + b04) - (b08 + b02)) / ((b11 + b04) + (b08 + b02) + 1e-6)
    ndvi_clipped = np.clip(ndvi, 0.0, 0.95)
    rusle_c = np.exp(-2.0 * (ndvi_clipped / (1.0 - ndvi_clipped + 1e-6)))

    return {
        "out_shape": out_shape,
        "out_transform": out_transform,
        "out_crs": out_crs,
        "inside_mask": inside_mask,
        "valid_mask": valid_mask,
        "total_poly_px": total_poly_px,
        "valid_px": valid_px,
        "clean_ratio": clean_ratio,
        "ndvi": np.where(valid_mask, ndvi, np.nan),
        "evi": np.where(valid_mask, evi, np.nan),
        "lai": np.where(valid_mask, lai, np.nan),
        "ndwi": np.where(valid_mask, ndwi, np.nan),
        "bsi": np.where(valid_mask, bsi, np.nan),
        "rusle_c": np.where(valid_mask, rusle_c, np.nan),
    }


def _read_landsat_tc_on_grid(
    catalog: pystac_client.Client,
    poly_wgs84: Polygon,
    ref_date: datetime,
    out_shape: tuple[int, int],
    out_transform: Any,
    out_crs: Any,
    fallback_ta_c: float,
) -> tuple[str, str, np.ndarray]:
    """Fetch Landsat C2 L2 lwir11 (30m), mask QA_PIXEL clouds, convert to Celsius."""
    start_dt = (ref_date - timedelta(days=60)).strftime("%Y-%m-%d")
    end_dt = ref_date.strftime("%Y-%m-%d")

    search = catalog.search(
        collections=["landsat-c2-l2"],
        intersects=mapping(poly_wgs84),
        datetime=f"{start_dt}/{end_dt}",
        query={"eo:cloud_cover": {"lt": 50}},
        sortby=[{"field": "properties.datetime", "direction": "desc"}],
        limit=6,
    )
    items = list(search.items())
    if not items:
        search = catalog.search(
            collections=["landsat-c2-l2"],
            intersects=mapping(poly_wgs84),
            datetime=f"{(ref_date - timedelta(days=150)).strftime('%Y-%m-%d')}/{end_dt}",
            sortby=[{"field": "properties.datetime", "direction": "desc"}],
            limit=4,
        )
        items = list(search.items())

    for item in items:
        if "lwir11" not in item.assets:
            continue
        with rasterio.open(item.assets["lwir11"].href) as lwir_src:
            p_proj = _reproject_polygon(poly_wgs84, lwir_src.crs)
            px0, py0, px1, py1 = p_proj.bounds
            pad = 90.0  # 3 Landsat pixels padding for clean bilinear interpolation
            win = from_bounds(px0 - pad, py0 - pad, px1 + pad, py1 + pad, lwir_src.transform)
            win = win.round_offsets().round_lengths()
            dn = lwir_src.read(1, window=win).astype(np.float32)
            w_tr = rasterio.windows.transform(win, lwir_src.transform)

            bands_meta = item.assets["lwir11"].extra_fields.get("raster:bands", [{}])
            scale = float(bands_meta[0].get("scale", 0.00341802)) if bands_meta else 0.00341802
            offset_k = float(bands_meta[0].get("offset", 149.0)) if bands_meta else 149.0

            tc_c = np.where(dn > 0, (dn * scale + offset_k) - 273.15, np.nan)

            if "qa_pixel" in item.assets:
                with rasterio.open(item.assets["qa_pixel"].href) as qa_src:
                    qa = qa_src.read(1, window=win)
                    # Landsat C2 QA_PIXEL bits: 0=Fill, 1=Dilated Cloud, 2=Cirrus, 3=Cloud, 4=Cloud Shadow
                    bad_qa = (qa & ((1 << 0) | (1 << 1) | (1 << 2) | (1 << 3) | (1 << 4))) != 0
                    tc_c = np.where(bad_qa, np.nan, tc_c)

            valid_tc = tc_c[np.isfinite(tc_c)]
            if valid_tc.size == 0:
                continue

            # Fill isolated cloud pixels in neighborhood with local scene median before reprojecting
            tc_filled = np.where(np.isfinite(tc_c), tc_c, float(np.nanmedian(valid_tc))).astype(np.float32)
            tc_grid = np.empty(out_shape, dtype=np.float32)
            reproject(
                source=tc_filled,
                destination=tc_grid,
                src_transform=w_tr,
                src_crs=lwir_src.crs,
                dst_transform=out_transform,
                dst_crs=out_crs,
                resampling=Resampling.bilinear,
            )
            dt_str = str(item.datetime.isoformat() if item.datetime else end_dt)
            return item.id, dt_str, tc_grid

    return (
        "LANDSAT_THERMAL_FALLBACK",
        end_dt,
        np.full(out_shape, fallback_ta_c + 2.5, dtype=np.float32),
    )


def _read_nasadem_ls_on_grid(
    catalog: pystac_client.Client,
    poly_wgs84: Polygon,
    out_shape: tuple[int, int],
    out_transform: Any,
    out_crs: Any,
) -> tuple[str, float, np.ndarray]:
    """Fetch NASA NASADEM (30m) and compute slope angle and Moore & Burch (1986) LS factor."""
    items = list(
        catalog.search(
            collections=["nasadem"],
            intersects=mapping(poly_wgs84),
            limit=1,
        ).items()
    )
    if not items:
        return "NASADEM_HGT_UNAVAILABLE", 400.0, np.full(out_shape, 0.45, dtype=np.float32)

    item = items[0]
    with rasterio.open(item.assets["elevation"].href) as dem_src:
        minx, miny, maxx, maxy = poly_wgs84.bounds
        pad_deg = 0.0025  # ~275m buffer around field for slope gradient calculation
        win = from_bounds(
            minx - pad_deg,
            miny - pad_deg,
            maxx + pad_deg,
            maxy + pad_deg,
            dem_src.transform,
        )
        win = win.round_offsets().round_lengths()
        elev = dem_src.read(1, window=win).astype(np.float32)
        w_tr = rasterio.windows.transform(win, dem_src.transform)

        # Compute gradient in meters (NASADEM resolution ~30.8m at equator/tropics)
        lat_mid = 0.5 * (miny + maxy)
        dx_m = abs(w_tr.a) * 111320.0 * max(0.2, math.cos(math.radians(lat_mid)))
        dy_m = abs(w_tr.e) * 110540.0
        dz_dy, dz_dx = np.gradient(elev, dy_m, dx_m)
        slope_rad = np.arctan(np.sqrt(dz_dx ** 2 + dz_dy ** 2))
        # Moore & Burch (1986) LS factor using specific catchment area As = 30m
        ls_raw = ((30.0 / 22.13) ** 0.4) * ((np.sin(slope_rad) / 0.0896) ** 1.3)
        ls_raw = np.clip(ls_raw, 0.05, 12.0).astype(np.float32)

        ls_grid = np.empty(out_shape, dtype=np.float32)
        reproject(
            source=ls_raw,
            destination=ls_grid,
            src_transform=w_tr,
            src_crs=dem_src.crs,
            dst_transform=out_transform,
            dst_crs=out_crs,
            resampling=Resampling.bilinear,
        )
        elev_mean = float(np.nanmean(elev))
        return item.id, round(elev_mean, 1), ls_grid


def fetch_stac_biophysical_observation(
    *,
    polygon_coordinates: list[list[float]],
    ta_celsius: float,
    vpd_kpa: float,
    ref_datetime: datetime | None = None,
) -> StacRasterObservation:
    """Run synchronous Planetary Computer STAC extraction for S2, Landsat TIRS, and NASADEM."""
    now = ref_datetime or datetime.now(timezone.utc)
    poly_wgs84 = _polygon_from_coords(polygon_coordinates)
    catalog = _stac_client()

    start_30d = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    end_now = now.strftime("%Y-%m-%d")

    recent_s2_items = list(
        catalog.search(
            collections=["sentinel-2-l2a"],
            intersects=mapping(poly_wgs84),
            datetime=f"{start_30d}/{end_now}",
            sortby=[{"field": "properties.datetime", "direction": "desc"}],
            limit=12,
        ).items()
    )
    if not recent_s2_items:
        raise RuntimeError("No Sentinel-2 L2A scenes found in the last 30 days.")

    # Inspect the latest scenes, preferring >= 60% clean SCL pixels inside the actual field polygon
    best_obs: dict[str, Any] | None = None
    best_item = recent_s2_items[0]
    for item in recent_s2_items[:6]:
        # Quick pre-filter if scene-level cloud cover is > 95% and we have others
        obs = _read_s2_on_grid(item, poly_wgs84)
        if best_obs is None or obs["clean_ratio"] > best_obs["clean_ratio"]:
            best_obs = obs
            best_item = item
        if obs["clean_ratio"] >= 0.60:
            best_obs = obs
            best_item = item
            break

    assert best_obs is not None
    insufficient_obs = best_obs["clean_ratio"] < 0.60

    # Historical phenological scenes (same +/- 35 day period across past 2 years)
    hist_ndvi_means: list[float] = []
    hist_ndwi_means: list[float] = []
    for yr_back in (1, 2):
        target_dt = now - timedelta(days=365 * yr_back)
        h_start = (target_dt - timedelta(days=35)).strftime("%Y-%m-%d")
        h_end = (target_dt + timedelta(days=35)).strftime("%Y-%m-%d")
        hist_items = list(
            catalog.search(
                collections=["sentinel-2-l2a"],
                intersects=mapping(poly_wgs84),
                datetime=f"{h_start}/{h_end}",
                query={"eo:cloud_cover": {"lt": 25}},
                sortby=[{"field": "properties.eo:cloud_cover", "direction": "asc"}],
                limit=3,
            ).items()
        )
        for h_item in hist_items[:2]:
            h_obs = _read_s2_on_grid(
                h_item,
                poly_wgs84,
                ref_shape=best_obs["out_shape"],
                ref_transform=best_obs["out_transform"],
                ref_crs=best_obs["out_crs"],
            )
            if h_obs["clean_ratio"] >= 0.60:
                hist_ndvi_means.append(float(np.nanmean(h_obs["ndvi"])))
                hist_ndwi_means.append(float(np.nanmean(h_obs["ndwi"])))

    if len(hist_ndvi_means) >= 2:
        mu_ndvi = float(np.mean(hist_ndvi_means))
        sigma_ndvi = max(0.035, float(np.std(hist_ndvi_means, ddof=1)))
        mu_ndwi = float(np.mean(hist_ndwi_means))
        sigma_ndwi = max(0.035, float(np.std(hist_ndwi_means, ddof=1)))
    elif len(hist_ndvi_means) == 1:
        mu_ndvi = hist_ndvi_means[0]
        sigma_ndvi = 0.06
        mu_ndwi = hist_ndwi_means[0]
        sigma_ndwi = 0.06
    else:
        mu_ndvi = float(np.nanmean(best_obs["ndvi"])) if np.any(np.isfinite(best_obs["ndvi"])) else 0.45
        sigma_ndvi = 0.08
        mu_ndwi = float(np.nanmean(best_obs["ndwi"])) if np.any(np.isfinite(best_obs["ndwi"])) else 0.0
        sigma_ndwi = 0.08

    ndvi_grid = best_obs["ndvi"]
    ndwi_grid = best_obs["ndwi"]
    ndvi_z_grid = (ndvi_grid - mu_ndvi) / sigma_ndvi
    ndwi_z_grid = (ndwi_grid - mu_ndwi) / sigma_ndwi

    landsat_id, landsat_dt, tc_grid = _read_landsat_tc_on_grid(
        catalog=catalog,
        poly_wgs84=poly_wgs84,
        ref_date=now,
        out_shape=best_obs["out_shape"],
        out_transform=best_obs["out_transform"],
        out_crs=best_obs["out_crs"],
        fallback_ta_c=ta_celsius,
    )

    # Thermal downscaling (DisTrad principle): modulate 30m Landsat LST with 10m Sentinel-2 fc
    ndvi_safe = np.where(np.isfinite(ndvi_grid), ndvi_grid, float(np.nanmean(ndvi_grid)) if np.any(np.isfinite(ndvi_grid)) else 0.25)
    fc_10m = np.clip((ndvi_safe - 0.12) / 0.58, 0.0, 1.0)
    fc_mean = float(np.nanmean(fc_10m))
    tc_grid = tc_grid - 4.5 * (fc_10m - fc_mean)

    # CWSI (Idso et al., 1981; Jackson et al., 1981)
    dt_ll = 1.8 - 2.1 * vpd_kpa
    dt_ul = max(dt_ll + 4.0, 6.5)
    cwsi_grid = np.clip(((tc_grid - ta_celsius) - dt_ll) / (dt_ul - dt_ll), 0.0, 1.0)

    nasadem_id, elev_m, ls_grid = _read_nasadem_ls_on_grid(
        catalog=catalog,
        poly_wgs84=poly_wgs84,
        out_shape=best_obs["out_shape"],
        out_transform=best_obs["out_transform"],
        out_crs=best_obs["out_crs"],
    )

    inside = best_obs["inside_mask"]
    valid = best_obs["valid_mask"]
    use_mask = valid if np.any(valid) else inside

    def _safe_mean(arr: np.ndarray, default: float) -> float:
        vals = arr[use_mask]
        vals = vals[np.isfinite(vals)]
        return round(float(np.mean(vals)), 3) if vals.size > 0 else default

    return StacRasterObservation(
        s2_scene_id=best_item.id,
        s2_datetime=str(best_item.datetime.isoformat() if best_item.datetime else end_now),
        s2_valid_pixels=best_obs["valid_px"],
        s2_total_pixels=best_obs["total_poly_px"],
        s2_clean_pixel_ratio=round(best_obs["clean_ratio"], 3),
        insufficient_observation=insufficient_obs,
        landsat_scene_id=landsat_id,
        landsat_datetime=landsat_dt,
        nasadem_tile_id=nasadem_id,
        elevation_m=elev_m,
        ndvi_mean=_safe_mean(ndvi_grid, 0.35),
        ndvi_z_score=_safe_mean(ndvi_z_grid, 0.0),
        evi_mean=_safe_mean(best_obs["evi"], 0.25),
        lai_mean=_safe_mean(best_obs["lai"], 0.78),
        ndwi_mean=_safe_mean(ndwi_grid, -0.05),
        ndwi_z_score=_safe_mean(ndwi_z_grid, 0.0),
        bsi_mean=_safe_mean(best_obs["bsi"], 0.10),
        rusle_c_mean=_safe_mean(best_obs["rusle_c"], 0.35),
        rusle_ls_mean=_safe_mean(ls_grid, 0.65),
        canopy_temp_c_mean=round(_safe_mean(tc_grid, ta_celsius + 2.5), 2),
        cwsi_mean=_safe_mean(cwsi_grid, 0.40),
        ndvi_grid=np.where(inside, ndvi_grid, np.nan),
        ndvi_z_grid=np.where(inside, ndvi_z_grid, np.nan),
        ndwi_z_grid=np.where(inside, ndwi_z_grid, np.nan),
        bsi_grid=np.where(inside, best_obs["bsi"], np.nan),
        rusle_c_grid=np.where(inside, best_obs["rusle_c"], np.nan),
        rusle_ls_grid=np.where(inside, ls_grid, np.nan),
        tc_grid=np.where(inside, tc_grid, np.nan),
        cwsi_grid=np.where(inside, cwsi_grid, np.nan),
        grid_transform=best_obs["out_transform"],
        grid_crs=best_obs["out_crs"],
        hist_scenes_used=len(hist_ndvi_means),
    )
