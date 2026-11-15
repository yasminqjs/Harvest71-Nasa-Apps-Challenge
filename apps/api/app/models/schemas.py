"""Pydantic models implementing the unified MODULE_SPEC.md JSON contract."""

from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field


class CropQualityRequest(BaseModel):
    polygon_coordinates: list[list[float]] = Field(
        ...,
        min_length=4,
        description="Polygon ring in [lon, lat] order (GeoJSON WGS84).",
    )
    crop_name: str = Field(..., min_length=2, description="Crop name or scientific name.")
    planting_date: str | None = Field(
        default=None,
        description="Planting date ISO YYYY-MM-DD (defaults to ~45 days before evaluation).",
    )
    water_regime: Literal["RAINFED", "IRRIGATED"] = Field(
        default="RAINFED",
        description="Water supply regime.",
    )
    community_pest_alert: bool = Field(
        default=False,
        description="Whether nearby farmers reported pest/disease pressure.",
    )
    use_cache_fallback: bool = Field(
        default=True,
        description="Allow <300ms audited cache fallback when cloud cover >40% or offline.",
    )
    prefer_audited_cache: bool = Field(
        default=False,
        description="Serve audited regional cache directly (<300ms) when available.",
    )


class GeoJsonPolygon(BaseModel):
    type: Literal["Polygon"] = "Polygon"
    coordinates: list[list[list[float]]]


class VisualFieldZone(BaseModel):
    zone_id: str
    location_label_pt: str
    color_hex: str
    icon_name: str
    short_label_pt: str
    polygon_geojson: GeoJsonPolygon


class FarmerActionCard(BaseModel):
    step_number: int
    urgency_color: Literal["RED", "YELLOW", "GREEN"]
    icon_name: str
    title_pt: str
    instruction_pt: str


class FarmerAccessibleView(BaseModel):
    overall_traffic_light: Literal["RED", "YELLOW", "GREEN"]
    status_badge_title: str
    status_icon: str
    health_score_0_to_100: int
    voice_tts_script_pt: str
    visual_field_zones: list[VisualFieldZone]
    action_cards: list[FarmerActionCard]


class FaoEcocropParameters(BaseModel):
    t_base_c: float
    t_opt_min_c: float
    t_opt_max_c: float
    t_max_lethal_c: float
    cycle_days_min: int
    cycle_days_max: int
    r_min_mm: float
    r_opt_min_mm: float
    source: str = "FAO_ECOCROP_DATABASE"


class FaoGaezSuitability(BaseModel):
    suitability_index_0_100: float
    attainable_yield_low_input_kg_ha: float
    water_supply_regime: Literal["RAINFED", "IRRIGATED"]
    source: str = "FAO_GAEZ_V4_RES05_COG"


class CropAgronomicBaseline(BaseModel):
    scientific_name: str
    common_name_pt: str
    fao_ecocrop_parameters: FaoEcocropParameters
    fao_gaez_v4_suitability: FaoGaezSuitability


class BiophysicalIndices(BaseModel):
    ndvi_mean: float
    ndvi_phenological_z_score: float
    evi_mean: float
    lai_boegh_m2_m2: float
    ndwi_gao_mean: float
    ndwi_z_score: float
    bsi_rikimaru_mean: float
    rusle_c_factor: float
    rusle_ls_factor: float
    canopy_temp_celsius: float
    cwsi_jackson_index: float
    nasa_gwetroot_0_to_1: float
    fao56_ks_water_stress_coeff: float
    gdd_accumulated_c_day: float
    et0_fao56_30d_mm: float
    precip_gpm_power_30d_mm: float


class DiagnosticAssessment(BaseModel):
    condition_code: Literal[
        "OPTIMAL_VIGOR",
        "WATER_DEFICIT_STRESS",
        "PHYTOSANITARY_ANOMALY",
        "THERMAL_HEAT_SHOCK",
        "SOIL_EROSION_EXPOSURE",
        "INSUFFICIENT_OBSERVATION",
    ]
    severity: Literal["LOW", "MODERATE", "HIGH"]
    confidence: float
    equation_triggered: str


class ScientificTelemetry(BaseModel):
    data_provenance: list[dict[str, Any]]
    biophysical_indices: BiophysicalIndices
    diagnostic_assessments: list[DiagnosticAssessment]


class DssatStateVector(BaseModel):
    observed_lai_m2_m2: float
    water_stress_factor_swfac: float
    rootzone_soil_wetness_fraction: float
    soil_surface_cover_fraction: float
    accumulated_gdd: float
    pest_disease_damage_detected: bool
    rotation_constraints_for_dssat: list[str]


class CropQualityResponse(BaseModel):
    request_id: str
    evaluated_at_utc: str
    farmer_accessible_view: FarmerAccessibleView
    crop_agronomic_baseline: CropAgronomicBaseline
    scientific_telemetry: ScientificTelemetry
    dssat_state_vector: DssatStateVector
    scale_disclaimers: list[str]
    human_in_the_loop_notice: str
    cache_metadata: dict[str, Any] | None = None
