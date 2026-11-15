"""Core diagnostic engine combining NASA POWER, Planetary Computer STAC, FAO EcoCrop/GAEZ, and ISRIC SoilGrids."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import math
from pathlib import Path
import time
from typing import Any
import uuid

import numpy as np
from pyproj import Transformer
from shapely.geometry import Polygon, box, mapping
from shapely.ops import transform as shapely_transform

from app.models.schemas import (
    BiophysicalIndices,
    CropAgronomicBaseline,
    CropQualityRequest,
    CropQualityResponse,
    DiagnosticAssessment,
    DssatStateVector,
    FaoEcocropParameters,
    FaoGaezSuitability,
    FarmerAccessibleView,
    FarmerActionCard,
    GeoJsonPolygon,
    ScientificTelemetry,
    VisualFieldZone,
)
from app.services.nasa_power_service import NasaPowerSummary, fetch_nasa_power_agroclimate
from app.services.soil_fao_service import (
    EcoCropEntry,
    GaezSuitabilityProfile,
    SoilPhysicalProfile,
    evaluate_gaez_v4_suitability,
    fetch_soil_profile,
    lookup_ecocrop,
)
from app.services.stac_copernicus_nasa_service import (
    StacRasterObservation,
    fetch_stac_biophysical_observation,
)

REPO_ROOT = Path(__file__).resolve().parents[4]
AUDITED_CACHE_PATH = REPO_ROOT / "data" / "cache" / "nordeste_audited_cache.json"

PILOT_AREAS: list[dict[str, Any]] = [
    {
        "id": "irece-ba",
        "name": "Irecê - BA (4.2 ha — Sequeiro)",
        "municipality": "Irecê",
        "state": "BA",
        "area_ha": 4.2,
        "crop_name": "Feijão-caupi",
        "water_regime": "RAINFED",
        "polygon_coordinates": [
            [-41.8562, -11.3045],
            [-41.8542, -11.3045],
            [-41.8542, -11.3064],
            [-41.8562, -11.3064],
            [-41.8562, -11.3045],
        ],
    },
    {
        "id": "quixeramobim-ce",
        "name": "Quixeramobim - CE (3.6 ha — Semiárido Central)",
        "municipality": "Quixeramobim",
        "state": "CE",
        "area_ha": 3.6,
        "crop_name": "Sorgo",
        "water_regime": "RAINFED",
        "polygon_coordinates": [
            [-39.2915, -5.1982],
            [-39.2897, -5.1982],
            [-39.2897, -5.1999],
            [-39.2915, -5.1999],
            [-39.2915, -5.1982],
        ],
    },
    {
        "id": "juazeiro-ba",
        "name": "Juazeiro - BA / Vale do São Francisco (4.8 ha — Irrigado)",
        "municipality": "Juazeiro",
        "state": "BA",
        "area_ha": 4.8,
        "crop_name": "Milho",
        "water_regime": "IRRIGATED",
        "polygon_coordinates": [
            [-40.4820, -9.4310],
            [-40.4798, -9.4310],
            [-40.4798, -9.4330],
            [-40.4820, -9.4330],
            [-40.4820, -9.4310],
        ],
    },
]


def _polygon_centroid(coords: list[list[float]]) -> tuple[float, float]:
    ring = list(coords)
    if ring[0] != ring[-1]:
        ring.append(ring[0])
    poly = Polygon(ring)
    c = poly.centroid
    return float(c.y), float(c.x)


def _split_polygon_into_3_zones(coords: list[list[float]]) -> list[tuple[str, str, Polygon]]:
    """Partition the field polygon into 3 contiguous latitudinal zones (North/Upper, Central, South/Lower)."""
    ring = list(coords)
    if ring[0] != ring[-1]:
        ring.append(ring[0])
    poly = Polygon(ring)
    if not poly.is_valid:
        poly = poly.buffer(0)
    minx, miny, maxx, maxy = poly.bounds
    h = max(1e-5, maxy - miny)
    pad = 1e-4

    y_low_cut = miny + h * 0.34
    y_high_cut = miny + h * 0.67

    zones_specs = [
        ("zona_norte", "Parte de cima do terreno (Norte)", box(minx - pad, y_high_cut, maxx + pad, maxy + pad)),
        ("zona_central", "Meio da roça", box(minx - pad, y_low_cut, maxx + pad, y_high_cut)),
        ("zona_sul_baixa", "Parte mais baixa (Descida)", box(minx - pad, miny - pad, maxx + pad, y_low_cut)),
    ]

    result: list[tuple[str, str, Polygon]] = []
    for zid, label, slice_box in zones_specs:
        inter = poly.intersection(slice_box)
        if inter.is_empty:
            inter = poly
        elif inter.geom_type == "MultiPolygon":
            inter = max(inter.geoms, key=lambda g: g.area)
        elif inter.geom_type != "Polygon":
            inter = poly
        result.append((zid, label, inter))
    return result


def _zone_grid_stats(
    zone_poly_wgs84: Polygon,
    obs: StacRasterObservation,
) -> dict[str, float]:
    """Compute biophysical statistics strictly inside a sub-zone on the 10m raster grid."""
    transformer = Transformer.from_crs("EPSG:4326", obs.grid_crs, always_xy=True)
    zone_proj = shapely_transform(transformer.transform, zone_poly_wgs84)
    from rasterio.features import geometry_mask

    mask = ~geometry_mask(
        [mapping(zone_proj)],
        out_shape=obs.ndvi_grid.shape,
        transform=obs.grid_transform,
        invert=False,
    )
    if mask.sum() == 0:
        mask = np.isfinite(obs.ndvi_grid)

    def _mean_or(arr: np.ndarray, fallback: float) -> float:
        vals = arr[mask]
        vals = vals[np.isfinite(vals)]
        return float(np.mean(vals)) if vals.size > 0 else fallback

    return {
        "ndvi": _mean_or(obs.ndvi_grid, obs.ndvi_mean),
        "z_ndvi": _mean_or(obs.ndvi_z_grid, obs.ndvi_z_score),
        "z_ndwi": _mean_or(obs.ndwi_z_grid, obs.ndwi_z_score),
        "bsi": _mean_or(obs.bsi_grid, obs.bsi_mean),
        "rusle_c": _mean_or(obs.rusle_c_grid, obs.rusle_c_mean),
        "rusle_ls": _mean_or(obs.rusle_ls_grid, obs.rusle_ls_mean),
        "tc": _mean_or(obs.tc_grid, obs.canopy_temp_c_mean),
        "cwsi": _mean_or(obs.cwsi_grid, obs.cwsi_mean),
    }


def _evaluate_zone_condition(
    *,
    z_stats: dict[str, float],
    ndvi_field_mean: float,
    tc_healthy_ref: float,
    power: NasaPowerSummary,
    crop: EcoCropEntry,
    water_regime: str,
    community_pest_alert: bool,
    insufficient_obs: bool,
) -> tuple[str, str, str, str]:
    """Evaluate MODULE_SPEC Section 4 multi-scenario rules for a single field zone."""
    if insufficient_obs:
        return (
            "INSUFFICIENT_OBSERVATION",
            "#D97706",
            "cloud",
            "Nuvens cobrindo a lavoura",
        )

    z_ndvi = z_stats["z_ndvi"]
    z_ndwi = z_stats["z_ndwi"]
    cwsi = z_stats["cwsi"]
    rusle_c = z_stats["rusle_c"]
    rusle_ls = z_stats["rusle_ls"]
    delta_ndvi = z_stats["ndvi"] - ndvi_field_mean
    delta_tc = z_stats["tc"] - tc_healthy_ref
    ks = 0.85 if water_regime == "IRRIGATED" else power.fao56_ks
    gwet = 0.72 if water_regime == "IRRIGATED" else power.gwetroot_latest

    adequate_soil_water = (gwet >= 0.50 or ks >= 0.65) and (
        water_regime == "IRRIGATED" or power.precip_cycle_mm >= crop.r_min_mm * 0.15
    )

    # Rule 3: PHYTOSANITARY_ANOMALY (Biophysical Exclusion Logic)
    if (
        adequate_soil_water
        and (z_ndvi <= -1.5 or delta_ndvi <= -0.045)
        and (cwsi >= 0.45 or delta_tc >= 0.6)
        and (power.rh2m_mean_pct >= 52.0 or community_pest_alert or power.gdd_accumulated_c_day >= 300.0)
    ):
        return (
            "PHYTOSANITARY_ANOMALY",
            "#DC2626",
            "bug",
            "Olhar folhas (Suspeita de Praga)",
        )

    # Rule 1 (Local vigorous pocket before global alerts): healthier / irrigated cooler sector
    if (z_ndvi > -0.8 and cwsi < 0.35 and ks >= 0.70) or (
        delta_ndvi >= 0.015 and delta_tc <= -0.15 and ks >= 0.60 and cwsi < 0.62
    ):
        return (
            "OPTIMAL_VIGOR",
            "#16A34A",
            "sprout",
            "Planta forte e sadia",
        )

    # Rule 2: WATER_DEFICIT_STRESS (prioritize water deficit on rainfed dry soil or cooler dry sector)
    if ks < 0.55 and (z_ndwi <= -1.0 or cwsi >= 0.45) and (delta_tc <= 0.1 or z_stats["ndvi"] >= ndvi_field_mean):
        return (
            "WATER_DEFICIT_STRESS",
            "#DC2626" if (ks < 0.35 and cwsi >= 0.68) else "#D97706",
            "droplet",
            "Planta com sede" if cwsi >= 0.65 else "Atenção: pouca água",
        )

    # Rule 4: THERMAL_HEAT_SHOCK
    if power.t2m_max_7d_c > crop.t_opt_max_c and cwsi >= 0.45 and delta_tc >= -0.15:
        return (
            "THERMAL_HEAT_SHOCK",
            "#DC2626" if cwsi >= 0.58 else "#D97706",
            "flame",
            "Calor forte na florada",
        )

    # Rule 5: SOIL_EROSION_EXPOSURE
    if (rusle_c > 0.40 and rusle_ls > 0.85) or (z_stats["bsi"] > 0.10 and delta_ndvi <= -0.01):
        return (
            "SOIL_EROSION_EXPOSURE",
            "#D97706",
            "layers",
            "Terra nua (Cobrir com palha)",
        )

    # Moderate transition state when soil is mildly stressed or exposed
    if rusle_c > 0.50 or z_stats["bsi"] > 0.12:
        return (
            "SOIL_EROSION_EXPOSURE",
            "#D97706",
            "layers",
            "Terra descoberta (Proteger solo)",
        )
    if ks < 0.60 or cwsi >= 0.45:
        return (
            "WATER_DEFICIT_STRESS",
            "#D97706",
            "droplet",
            "Atenção: pouca água",
        )
    return (
        "OPTIMAL_VIGOR",
        "#16A34A",
        "sprout",
        "Planta forte e sadia",
    )


def _build_field_assessments(
    *,
    obs: StacRasterObservation,
    power: NasaPowerSummary,
    crop: EcoCropEntry,
    water_regime: str,
    community_pest_alert: bool,
    zone_codes: list[str],
) -> list[DiagnosticAssessment]:
    """Evaluate all MODULE_SPEC Section 4 multi-scenario rules at field & zone scale."""
    assessments: list[DiagnosticAssessment] = []
    ks_eff = max(power.fao56_ks, 0.82) if water_regime == "IRRIGATED" else power.fao56_ks
    gwet_eff = max(power.gwetroot_latest, 0.68) if water_regime == "IRRIGATED" else power.gwetroot_latest

    if obs.insufficient_observation:
        assessments.append(
            DiagnosticAssessment(
                condition_code="INSUFFICIENT_OBSERVATION",
                severity="MODERATE",
                confidence=0.92,
                equation_triggered=f"SCL_clean_ratio = {obs.s2_clean_pixel_ratio:.2f} < 0.60",
            )
        )

    # 1. PHYTOSANITARY_ANOMALY
    if "PHYTOSANITARY_ANOMALY" in zone_codes or (
        (gwet_eff >= 0.50 or ks_eff >= 0.65)
        and obs.ndvi_z_score <= -1.5
        and obs.cwsi_mean >= 0.50
    ):
        assessments.append(
            DiagnosticAssessment(
                condition_code="PHYTOSANITARY_ANOMALY",
                severity="HIGH",
                confidence=round(min(0.95, 0.72 + (0.12 if community_pest_alert else 0.06) + abs(min(0.0, obs.ndvi_z_score)) * 0.05), 2),
                equation_triggered=(
                    f"Ks={ks_eff:.2f} >= 0.65 AND GWETROOT={gwet_eff:.2f} >= 0.50 "
                    f"AND Z_NDVI={obs.ndvi_z_score:.2f} <= -1.5 AND CWSI={obs.cwsi_mean:.2f} >= 0.50"
                ),
            )
        )

    # 2. WATER_DEFICIT_STRESS
    if (ks_eff < 0.55 and (obs.ndwi_z_score <= -1.0 or obs.cwsi_mean >= 0.50)) or "WATER_DEFICIT_STRESS" in zone_codes:
        sev = "HIGH" if (ks_eff < 0.40 and obs.cwsi_mean >= 0.55) else "MODERATE"
        assessments.append(
            DiagnosticAssessment(
                condition_code="WATER_DEFICIT_STRESS",
                severity=sev,
                confidence=round(min(0.96, 0.70 + (0.55 - min(0.55, ks_eff)) * 0.4 + max(0.0, obs.cwsi_mean - 0.3) * 0.2), 2),
                equation_triggered=(
                    f"FAO56_Ks={ks_eff:.2f} < 0.55 AND (Z_NDWI={obs.ndwi_z_score:.2f} <= -1.0 "
                    f"OR CWSI={obs.cwsi_mean:.2f} >= 0.50)"
                ),
            )
        )

    # 3. THERMAL_HEAT_SHOCK
    if (power.t2m_max_7d_c > crop.t_opt_max_c and obs.cwsi_mean >= 0.45) or "THERMAL_HEAT_SHOCK" in zone_codes:
        assessments.append(
            DiagnosticAssessment(
                condition_code="THERMAL_HEAT_SHOCK",
                severity="HIGH" if power.t2m_max_7d_c >= crop.t_max_lethal_c - 2.0 else "MODERATE",
                confidence=round(min(0.94, 0.74 + max(0.0, power.t2m_max_7d_c - crop.t_opt_max_c) * 0.04), 2),
                equation_triggered=(
                    f"T2M_MAX_7d={power.t2m_max_7d_c:.1f}C > EcoCrop_TOPMX={crop.t_opt_max_c:.1f}C "
                    f"AND CWSI={obs.cwsi_mean:.2f} >= 0.45"
                ),
            )
        )

    # 4. SOIL_EROSION_EXPOSURE
    if (obs.rusle_c_mean > 0.40 and obs.rusle_ls_mean > 0.85) or "SOIL_EROSION_EXPOSURE" in zone_codes:
        assessments.append(
            DiagnosticAssessment(
                condition_code="SOIL_EROSION_EXPOSURE",
                severity="HIGH" if (obs.rusle_c_mean > 0.65 and obs.rusle_ls_mean > 1.2) else "MODERATE",
                confidence=round(min(0.92, 0.68 + max(0.0, obs.rusle_c_mean - 0.4) * 0.35), 2),
                equation_triggered=(
                    f"RUSLE_C={obs.rusle_c_mean:.2f} > 0.40 AND RUSLE_LS={obs.rusle_ls_mean:.2f} "
                    f"(BSI={obs.bsi_mean:.2f})"
                ),
            )
        )

    # 5. OPTIMAL_VIGOR
    if not assessments or (obs.ndvi_z_score > -0.8 and obs.cwsi_mean < 0.35 and ks_eff >= 0.70):
        assessments.append(
            DiagnosticAssessment(
                condition_code="OPTIMAL_VIGOR",
                severity="LOW",
                confidence=round(min(0.95, 0.75 + max(0.0, ks_eff - 0.65) * 0.4), 2),
                equation_triggered=(
                    f"Z_NDVI={obs.ndvi_z_score:.2f} > -0.8 AND CWSI={obs.cwsi_mean:.2f} < 0.35 "
                    f"AND Ks={ks_eff:.2f} >= 0.70"
                ),
            )
        )

    return assessments


def _compose_farmer_view(
    *,
    crop: EcoCropEntry,
    obs: StacRasterObservation,
    power: NasaPowerSummary,
    water_regime: str,
    assessments: list[DiagnosticAssessment],
    zones: list[VisualFieldZone],
    zone_codes: list[str],
) -> tuple[FarmerAccessibleView, bool, list[str]]:
    """Translate physical assessments into traffic light, pt-BR voice script, and simple action cards."""
    codes = {a.condition_code for a in assessments}
    has_pest = "PHYTOSANITARY_ANOMALY" in codes
    has_water = "WATER_DEFICIT_STRESS" in codes
    has_heat = "THERMAL_HEAT_SHOCK" in codes
    has_erosion = "SOIL_EROSION_EXPOSURE" in codes
    has_clouds = "INSUFFICIENT_OBSERVATION" in codes

    high_count = sum(1 for a in assessments if a.severity == "HIGH")
    mod_count = sum(1 for a in assessments if a.severity == "MODERATE")

    if has_pest or high_count >= 1:
        traffic_light = "RED"
    elif has_water or has_heat or has_erosion or has_clouds or mod_count >= 1:
        traffic_light = "YELLOW"
    else:
        traffic_light = "GREEN"

    # Physical health score 0..100 anchored to NDVI, Ks, CWSI, and RUSLE_C
    ndvi_term = max(0.0, min(1.0, (obs.ndvi_mean - 0.12) / 0.58))
    ks_eff = max(power.fao56_ks, 0.82) if water_regime == "IRRIGATED" else power.fao56_ks
    ks_term = max(0.0, min(1.0, ks_eff))
    cwsi_term = 1.0 - max(0.0, min(1.0, obs.cwsi_mean))
    cover_term = 1.0 - max(0.0, min(1.0, obs.rusle_c_mean))
    health_score = int(round(100.0 * (0.35 * ndvi_term + 0.25 * ks_term + 0.25 * cwsi_term + 0.15 * cover_term)))
    if has_pest:
        health_score = min(health_score, 62)
    health_score = max(18, min(98, health_score))

    action_cards: list[FarmerActionCard] = []
    voice_parts = [
        f"Olá, companheiro agricultor. Olhamos sua roça de {crop.common_name_pt} pelos satélites da NASA."
    ]
    dssat_constraints: list[str] = []

    if has_pest:
        badge_title = "Atenção na Roça: Possível Praga e Estresse Local"
        status_icon = "bug-alert"
        voice_parts.append(
            "A terra tem umidade razoável, mas em um trecho do terreno as plantas perderam força e esquentaram na folha, "
            "o que indica ataque de bicho ou doença, e não falta de chuva."
        )
        action_cards.append(
            FarmerActionCard(
                step_number=len(action_cards) + 1,
                urgency_color="RED",
                icon_name="search-leaf",
                title_pt="Olhar debaixo das folhas na mancha vermelha",
                instruction_pt="Vá até a parte vermelha do mapa e vire as folhas. Procure por pulgão, lagarta ou manchas. Não jogue veneno antes de mostrar a um técnico rural.",
            )
        )
        dssat_constraints.append("BREAK_PEST_HOST_CYCLE")
    elif has_water:
        badge_title = "Alerta na Roça: Planta com Sede na Terra Seca"
        status_icon = "water-alert"
        voice_parts.append(
            f"Nos últimos 30 dias choveu apenas {int(round(power.precip_30d_mm))} milímetros e a terra está secando na raiz. "
            "As folhas estão fechando os poros para não perder água."
        )
        action_cards.append(
            FarmerActionCard(
                step_number=len(action_cards) + 1,
                urgency_color="RED" if traffic_light == "RED" else "YELLOW",
                icon_name="droplet",
                title_pt="Segurar a água no pé da planta",
                instruction_pt="Cubra o chão ao redor das plantas com palha seca ou resto de capim para o sol não secar a pouca umidade que sobrou.",
            )
        )
        dssat_constraints.append("PRIORITIZE_DROUGHT_TOLERANT_CULTIVAR")
    elif has_heat:
        badge_title = "Cuidado: Calor Forte na Plantação"
        status_icon = "flame-alert"
        voice_parts.append(
            f"O calor chegou a {power.t2m_max_7d_c:.0f} graus na última semana, acima do que a planta aguenta bem sem sofrer na florada."
        )
    elif has_erosion:
        badge_title = "Atenção: Terra Descoberta em Risco de Enxurrada"
        status_icon = "layers-alert"
        voice_parts.append(
            "Tem trechos com terra exposta e pouco verde protegendo o chão. Se cair chuva forte, pode lavar a terra boa."
        )
    elif has_clouds:
        badge_title = "Nuvens no Céu: Usando Leitura Segura"
        status_icon = "cloud-alert"
        voice_parts.append(
            "Nos últimos dias muitas nuvens cobriram a sua roça. Caminhe pelo terreno e olhe as folhas de perto para confirmar."
        )
    else:
        badge_title = "Roça Forte e Sadia no Satélite"
        status_icon = "sprout-ok"
        voice_parts.append(
            "As folhas estão firmes, bem verdes e com boa água na raiz. Continue cuidando da cobertura do solo."
        )

    if has_heat and "THERMAL_HEAT_SHOCK" in codes and not any(c.icon_name == "flame" for c in action_cards):
        action_cards.append(
            FarmerActionCard(
                step_number=len(action_cards) + 1,
                urgency_color="YELLOW",
                icon_name="flame",
                title_pt="Proteger a florada do sol quente",
                instruction_pt="Se tiver água reservada, molhe bem cedo ou no final da tarde. Evite capinar nas horas mais quentes do dia.",
            )
        )
        dssat_constraints.append("HEAT_RESILIENT_FLOWERING_WINDOW")

    if has_erosion:
        action_cards.append(
            FarmerActionCard(
                step_number=len(action_cards) + 1,
                urgency_color="YELLOW",
                icon_name="shield-soil",
                title_pt="Proteger a terra descoberta",
                instruction_pt="Espalhe palha seca, folha ou resto de capim na mancha amarela do mapa para a chuva forte não lavar a terra boa.",
            )
        )
        dssat_constraints.append("INCREASE_BIOMASS_COVER_HIGH_RUSLE_C")

    if not action_cards:
        action_cards.append(
            FarmerActionCard(
                step_number=1,
                urgency_color="GREEN",
                icon_name="sprout",
                title_pt="Manter a roça protegida",
                instruction_pt="Sua plantação está indo bem. Deixe a palha entre as fileiras para guardar umidade e evitar mato.",
            )
        )

    voice_parts.append("Toque nos cartões abaixo para ver o que fazer hoje.")

    return (
        FarmerAccessibleView(
            overall_traffic_light=traffic_light,
            status_badge_title=badge_title,
            status_icon=status_icon,
            health_score_0_to_100=health_score,
            voice_tts_script_pt=" ".join(voice_parts),
            visual_field_zones=zones,
            action_cards=action_cards,
        ),
        has_pest,
        dssat_constraints,
    )


def _load_audited_cache() -> list[dict[str, Any]]:
    if not AUDITED_CACHE_PATH.exists():
        return []
    try:
        data = json.loads(AUDITED_CACHE_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _adapt_cached_response(
    cached_entry: dict[str, Any],
    req: CropQualityRequest,
    reason: str,
    started_at: float,
) -> CropQualityResponse:
    """Re-project cached zone GeoJSON polygons onto the requested polygon in <300ms."""
    raw_resp = json.loads(json.dumps(cached_entry["response"]))
    zone_slices = _split_polygon_into_3_zones(req.polygon_coordinates)
    slice_map = {zid: (label, poly) for zid, label, poly in zone_slices}

    for zone in raw_resp["farmer_accessible_view"]["visual_field_zones"]:
        zid = zone["zone_id"]
        if zid in slice_map:
            label, zpoly = slice_map[zid]
            zone["location_label_pt"] = label
            zone["polygon_geojson"] = {
                "type": "Polygon",
                "coordinates": [[[round(x, 6), round(y, 6)] for x, y in zpoly.exterior.coords]],
            }

    try:
        crop = lookup_ecocrop(req.crop_name)
        raw_resp["crop_agronomic_baseline"]["scientific_name"] = crop.scientific_name
        raw_resp["crop_agronomic_baseline"]["common_name_pt"] = crop.common_name_pt
        raw_resp["crop_agronomic_baseline"]["fao_ecocrop_parameters"] = {
            "t_base_c": crop.t_base_c,
            "t_opt_min_c": crop.t_opt_min_c,
            "t_opt_max_c": crop.t_opt_max_c,
            "t_max_lethal_c": crop.t_max_lethal_c,
            "cycle_days_min": crop.cycle_days_min,
            "cycle_days_max": crop.cycle_days_max,
            "r_min_mm": crop.r_min_mm,
            "r_opt_min_mm": crop.r_opt_min_mm,
            "source": "FAO_ECOCROP_DATABASE",
        }
        raw_resp["crop_agronomic_baseline"]["fao_gaez_v4_suitability"]["water_supply_regime"] = req.water_regime
    except Exception:
        pass

    raw_resp["request_id"] = str(uuid.uuid4())
    raw_resp["evaluated_at_utc"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    elapsed_ms = round((time.perf_counter() - started_at) * 1000.0, 1)
    raw_resp["cache_metadata"] = {
        "fallback_used": True,
        "pilot_area_id": cached_entry["pilot_id"],
        "reason": reason,
        "latency_ms": elapsed_ms,
    }
    return CropQualityResponse(**raw_resp)


def run_live_scientific_pipeline(
    req: CropQualityRequest,
    *,
    prefer_soil_gaez_cache: bool = True,
) -> CropQualityResponse:
    """Execute the full live NASA POWER + Planetary Computer STAC + FAO + SoilGrids pipeline."""
    lat, lon = _polygon_centroid(req.polygon_coordinates)
    crop = lookup_ecocrop(req.crop_name)
    soil = fetch_soil_profile(lat, lon, prefer_cache=prefer_soil_gaez_cache)

    power = fetch_nasa_power_agroclimate(
        lat=lat,
        lon=lon,
        planting_date=req.planting_date,
        t_base_c=crop.t_base_c,
        theta_wp=soil.theta_wp,
        theta_fc=soil.theta_fc,
        theta_sat=soil.theta_sat,
        p_base=crop.p_depletion_base,
    )

    t_daytime_ref = round(0.65 * power.t2m_max_latest_c + 0.35 * power.t2m_mean_c, 2)
    obs = fetch_stac_biophysical_observation(
        polygon_coordinates=req.polygon_coordinates,
        ta_celsius=t_daytime_ref,
        vpd_kpa=power.vpd_kpa,
    )

    gaez = evaluate_gaez_v4_suitability(
        lat=lat,
        lon=lon,
        crop=crop,
        soil=soil,
        t_mean_c=power.t2m_mean_c,
        precip_30d_mm=power.precip_30d_mm,
        water_regime=req.water_regime,
        prefer_cache=prefer_soil_gaez_cache,
    )

    # Healthy-pixel canopy temperature reference for thermal anomaly exclusion
    healthy_mask = np.isfinite(obs.ndvi_z_grid) & (obs.ndvi_z_grid > -0.5) & np.isfinite(obs.tc_grid)
    if np.any(healthy_mask):
        tc_healthy_ref = float(np.nanmean(obs.tc_grid[healthy_mask]))
    else:
        tc_healthy_ref = obs.canopy_temp_c_mean

    zone_slices = _split_polygon_into_3_zones(req.polygon_coordinates)
    visual_zones: list[VisualFieldZone] = []
    zone_codes: list[str] = []

    for zid, label, zpoly in zone_slices:
        z_stats = _zone_grid_stats(zpoly, obs)
        code, color_hex, icon_name, short_label = _evaluate_zone_condition(
            z_stats=z_stats,
            ndvi_field_mean=obs.ndvi_mean,
            tc_healthy_ref=tc_healthy_ref,
            power=power,
            crop=crop,
            water_regime=req.water_regime,
            community_pest_alert=req.community_pest_alert,
            insufficient_obs=obs.insufficient_observation,
        )
        zone_codes.append(code)
        visual_zones.append(
            VisualFieldZone(
                zone_id=zid,
                location_label_pt=label,
                color_hex=color_hex,
                icon_name=icon_name,
                short_label_pt=short_label,
                polygon_geojson=GeoJsonPolygon(
                    type="Polygon",
                    coordinates=[[[round(x, 6), round(y, 6)] for x, y in zpoly.exterior.coords]],
                ),
            )
        )

    assessments = _build_field_assessments(
        obs=obs,
        power=power,
        crop=crop,
        water_regime=req.water_regime,
        community_pest_alert=req.community_pest_alert,
        zone_codes=zone_codes,
    )

    farmer_view, pest_detected, dssat_constraints = _compose_farmer_view(
        crop=crop,
        obs=obs,
        power=power,
        water_regime=req.water_regime,
        assessments=assessments,
        zones=visual_zones,
        zone_codes=zone_codes,
    )

    surface_cover_fraction = round(max(0.05, min(0.98, 1.0 - 0.68 * obs.rusle_c_mean)), 3)

    return CropQualityResponse(
        request_id=str(uuid.uuid4()),
        evaluated_at_utc=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        farmer_accessible_view=farmer_view,
        crop_agronomic_baseline=CropAgronomicBaseline(
            scientific_name=crop.scientific_name,
            common_name_pt=crop.common_name_pt,
            fao_ecocrop_parameters=FaoEcocropParameters(
                t_base_c=crop.t_base_c,
                t_opt_min_c=crop.t_opt_min_c,
                t_opt_max_c=crop.t_opt_max_c,
                t_max_lethal_c=crop.t_max_lethal_c,
                cycle_days_min=crop.cycle_days_min,
                cycle_days_max=crop.cycle_days_max,
                r_min_mm=crop.r_min_mm,
                r_opt_min_mm=crop.r_opt_min_mm,
                source="FAO_ECOCROP_DATABASE",
            ),
            fao_gaez_v4_suitability=FaoGaezSuitability(
                suitability_index_0_100=gaez.suitability_index_0_100,
                attainable_yield_low_input_kg_ha=gaez.attainable_yield_low_input_kg_ha,
                water_supply_regime=req.water_regime,
                source="FAO_GAEZ_V4_RES05_COG",
            ),
        ),
        scientific_telemetry=ScientificTelemetry(
            data_provenance=[
                {
                    "dataset": "COPERNICUS/S2_L2A_STAC",
                    "scene_id": obs.s2_scene_id,
                    "scene_datetime": obs.s2_datetime,
                    "native_resolution_m": 10,
                    "valid_pixels_in_polygon": obs.s2_valid_pixels,
                    "clean_pixel_ratio": obs.s2_clean_pixel_ratio,
                    "historical_baseline_scenes": obs.hist_scenes_used,
                },
                {
                    "dataset": "NASA_USGS/LANDSAT_C2_L2_TIRS",
                    "scene_id": obs.landsat_scene_id,
                    "scene_datetime": obs.landsat_datetime,
                    "native_resolution_m": 30,
                    "band": "lwir11_surface_temperature",
                },
                {
                    "dataset": "NASA/NASADEM_HGT_V001",
                    "tile_id": obs.nasadem_tile_id,
                    "elevation_m": obs.elevation_m,
                    "native_resolution_m": 30,
                },
                {
                    "dataset": "NASA/POWER_MERRA2_AG_DAILY",
                    "variables": [
                        "PRECTOTCORR",
                        "GWETROOT",
                        "GWETTOP",
                        "T2M_MAX",
                        "T2M_MIN",
                        "T2M",
                        "RH2M",
                        "ALLSKY_SFC_SW_DWN",
                        "WS2M",
                        "EVPTRNS",
                    ],
                    "window": f"{power.data_start}..{power.data_end}",
                    "native_resolution_km": 50.0,
                },
                {
                    "dataset": "ISRIC/SOILGRIDS_V2",
                    "source": soil.source,
                    "clay_pct": soil.clay_pct,
                    "sand_pct": soil.sand_pct,
                    "om_pct": soil.om_pct,
                    "ph_h2o": soil.ph_h2o,
                    "theta_wp": soil.theta_wp,
                    "theta_fc": soil.theta_fc,
                },
            ],
            biophysical_indices=BiophysicalIndices(
                ndvi_mean=obs.ndvi_mean,
                ndvi_phenological_z_score=obs.ndvi_z_score,
                evi_mean=obs.evi_mean,
                lai_boegh_m2_m2=obs.lai_mean,
                ndwi_gao_mean=obs.ndwi_mean,
                ndwi_z_score=obs.ndwi_z_score,
                bsi_rikimaru_mean=obs.bsi_mean,
                rusle_c_factor=obs.rusle_c_mean,
                rusle_ls_factor=obs.rusle_ls_mean,
                canopy_temp_celsius=obs.canopy_temp_c_mean,
                cwsi_jackson_index=obs.cwsi_mean,
                nasa_gwetroot_0_to_1=power.gwetroot_latest,
                fao56_ks_water_stress_coeff=power.fao56_ks,
                gdd_accumulated_c_day=power.gdd_accumulated_c_day,
                et0_fao56_30d_mm=power.et0_30d_mm,
                precip_gpm_power_30d_mm=power.precip_30d_mm,
            ),
            diagnostic_assessments=assessments,
        ),
        dssat_state_vector=DssatStateVector(
            observed_lai_m2_m2=obs.lai_mean,
            water_stress_factor_swfac=power.fao56_ks,
            rootzone_soil_wetness_fraction=power.gwetroot_latest,
            soil_surface_cover_fraction=surface_cover_fraction,
            accumulated_gdd=power.gdd_accumulated_c_day,
            pest_disease_damage_detected=pest_detected,
            rotation_constraints_for_dssat=dssat_constraints,
        ),
        scale_disclaimers=[
            "O diagnóstico espacial dentro do terreno (< 5 ha) utiliza pixels reais de 10m (Sentinel-2) e 30m (Landsat TIRS e NASA NASADEM). Variáveis agroclimáticas e de umidade profunda (NASA POWER/MERRA-2 GWETROOT e FAO GAEZ v4) possuem resolução regional (9 km a 50 km) e calibram o balanço físico macro."
        ],
        human_in_the_loop_notice=(
            "Esta ferramenta apoia a tomada de decisão e não substitui o conhecimento do agricultor "
            "nem a vistoria presencial de um técnico da extensão rural (EMATER/BAHIATER)."
        ),
        cache_metadata={"fallback_used": False, "reason": "live_nasa_copernicus_pipeline"},
    )


def get_pilot_areas_payload() -> list[dict[str, Any]]:
    """Return the 3 Northeast pilot areas together with their audited satellite payloads."""
    cached_by_id = {entry["pilot_id"]: entry for entry in _load_audited_cache()}
    output: list[dict[str, Any]] = []
    for pilot in PILOT_AREAS:
        entry = cached_by_id.get(pilot["id"])
        output.append(
            {
                **pilot,
                "audited_diagnosis": entry["response"] if entry else None,
            }
        )
    return output


def analyze_crop_quality(req: CropQualityRequest) -> CropQualityResponse:
    """Analyze crop quality synchronously, using <300ms audited cache fallback when clouds >40% or offline."""
    started_at = time.perf_counter()
    lat, lon = _polygon_centroid(req.polygon_coordinates)
    cache_entries = _load_audited_cache()

    def _nearest_cache() -> dict[str, Any] | None:
        if not cache_entries:
            return None
        return min(
            cache_entries,
            key=lambda e: math.hypot(float(e["centroid"]["lat"]) - lat, float(e["centroid"]["lon"]) - lon),
        )

    if req.prefer_audited_cache:
        cached = _nearest_cache()
        if cached is not None:
            return _adapt_cached_response(
                cached,
                req,
                reason="audited_cache_requested",
                started_at=started_at,
            )

    try:
        result = run_live_scientific_pipeline(req)
        clean_ratio = result.scientific_telemetry.data_provenance[0].get("clean_pixel_ratio", 1.0)
        if req.use_cache_fallback and float(clean_ratio) < 0.60:
            cached = _nearest_cache()
            if cached is not None:
                return _adapt_cached_response(
                    cached,
                    req,
                    reason=f"cloud_cover_exceeded_40pct (clean_ratio={clean_ratio:.2f})",
                    started_at=started_at,
                )
        elapsed_ms = round((time.perf_counter() - started_at) * 1000.0, 1)
        result.cache_metadata = {
            "fallback_used": False,
            "reason": "live_nasa_copernicus_pipeline",
            "latency_ms": elapsed_ms,
        }
        return result
    except Exception as exc:
        if req.use_cache_fallback:
            cached = _nearest_cache()
            if cached is not None:
                return _adapt_cached_response(
                    cached,
                    req,
                    reason=f"live_pipeline_fallback: {type(exc).__name__}",
                    started_at=started_at,
                )
        raise
