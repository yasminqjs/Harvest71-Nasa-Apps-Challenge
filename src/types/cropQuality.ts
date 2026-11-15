/**
 * Tipos do módulo ROXO — Visualizador de Qualidade da Plantação Atual
 * (NASA POWER/MERRA-2 + Landsat C2 TIRS + NASADEM + Sentinel-2 + FAO EcoCrop/GAEZ v4).
 * Mantidos em arquivo próprio para não alterar o contrato de `domain.ts` do front base.
 */

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface VisualFieldZone {
  zone_id: string;
  location_label_pt: string;
  color_hex: string;
  icon_name: string;
  short_label_pt: string;
  polygon_geojson: GeoJsonPolygon;
}

export interface FarmerActionCard {
  step_number: number;
  urgency_color: 'RED' | 'YELLOW' | 'GREEN';
  icon_name: string;
  title_pt: string;
  instruction_pt: string;
}

export interface FarmerAccessibleView {
  overall_traffic_light: 'RED' | 'YELLOW' | 'GREEN';
  status_badge_title: string;
  status_icon: string;
  health_score_0_to_100: number;
  voice_tts_script_pt: string;
  visual_field_zones: VisualFieldZone[];
  action_cards: FarmerActionCard[];
}

export interface FaoEcocropParameters {
  t_base_c: number;
  t_opt_min_c: number;
  t_opt_max_c: number;
  t_max_lethal_c: number;
  cycle_days_min: number;
  cycle_days_max: number;
  r_min_mm: number;
  r_opt_min_mm: number;
  source: string;
}

export interface FaoGaezSuitability {
  suitability_index_0_100: number;
  attainable_yield_low_input_kg_ha: number;
  water_supply_regime: 'RAINFED' | 'IRRIGATED';
  source: string;
}

export interface CropAgronomicBaseline {
  scientific_name: string;
  common_name_pt: string;
  fao_ecocrop_parameters: FaoEcocropParameters;
  fao_gaez_v4_suitability: FaoGaezSuitability;
}

export interface BiophysicalIndices {
  ndvi_mean: number;
  ndvi_phenological_z_score: number;
  evi_mean: number;
  lai_boegh_m2_m2: number;
  ndwi_gao_mean: number;
  ndwi_z_score: number;
  bsi_rikimaru_mean: number;
  rusle_c_factor: number;
  rusle_ls_factor: number;
  canopy_temp_celsius: number;
  cwsi_jackson_index: number;
  nasa_gwetroot_0_to_1: number;
  fao56_ks_water_stress_coeff: number;
  gdd_accumulated_c_day: number;
  et0_fao56_30d_mm: number;
  precip_gpm_power_30d_mm: number;
}

export interface DiagnosticAssessment {
  condition_code:
    | 'OPTIMAL_VIGOR'
    | 'WATER_DEFICIT_STRESS'
    | 'PHYTOSANITARY_ANOMALY'
    | 'THERMAL_HEAT_SHOCK'
    | 'SOIL_EROSION_EXPOSURE'
    | 'INSUFFICIENT_OBSERVATION';
  severity: 'LOW' | 'MODERATE' | 'HIGH';
  confidence: number;
  equation_triggered: string;
}

export interface ScientificTelemetry {
  data_provenance: Record<string, unknown>[];
  biophysical_indices: BiophysicalIndices;
  diagnostic_assessments: DiagnosticAssessment[];
}

export interface DssatStateVector {
  observed_lai_m2_m2: number;
  water_stress_factor_swfac: number;
  rootzone_soil_wetness_fraction: number;
  soil_surface_cover_fraction: number;
  accumulated_gdd: number;
  pest_disease_damage_detected: boolean;
  rotation_constraints_for_dssat: string[];
}

export interface CropQualityAnalysisResponse {
  request_id: string;
  evaluated_at_utc: string;
  farmer_accessible_view: FarmerAccessibleView;
  crop_agronomic_baseline: CropAgronomicBaseline;
  scientific_telemetry: ScientificTelemetry;
  dssat_state_vector: DssatStateVector;
  scale_disclaimers: string[];
  human_in_the_loop_notice: string;
  cache_metadata?: Record<string, unknown> | null;
}

export interface PilotAreaPreset {
  id: string;
  name: string;
  municipality: string;
  state: string;
  area_ha: number;
  crop_name: string;
  water_regime: 'RAINFED' | 'IRRIGATED';
  polygon_coordinates: number[][];
  centroid: { lat: number; lon: number };
  audited_diagnosis: CropQualityAnalysisResponse;
}
