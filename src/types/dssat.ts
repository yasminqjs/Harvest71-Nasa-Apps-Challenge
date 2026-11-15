/**
 * Contratos da API Field Shift (DSSAT). Campos opcionais de propósito: a API pode evoluir e
 * resultados podem chegar parciais (status "running" com o resultado atual já preenchido).
 * Fonte: docs/API.md e docs/GUIA_FRONT_DSSAT.md.
 */

export type JobStatus = 'queued' | 'running' | 'done' | 'failed';
export type JobKind = 'simulation' | 'rotation_search' | 'rotation';

export interface JobAccepted {
  id: string;
  status: JobStatus;
  created_utc?: string;
  poll: string;
  note?: string;
  supported_crops?: string[];
  excluded_crops?: string[];
}

// ----------------------------------------------------------------------------- catálogo

export interface CatalogCultivar {
  id: string;
  name: string;
  origin?: string;
  source?: string;
}

export interface CatalogCrop {
  code: string;
  name: string;
  product?: string;
  default_cultivar?: { id: string; name?: string };
  n_cultivars?: number;
  harvest?: string;
  cycle_days_max?: number | null;
  cultivars?: CatalogCultivar[];
}

export interface CapabilityCrop {
  code: string;
  calendar?: boolean;
  single_crop?: boolean;
  dssat_sequence?: boolean;
  rotation_target_metric?: 'yield_kg_ha' | 'biomass_kg_ha' | string;
}

export interface Capabilities {
  schema_version?: string;
  sequence_pairs: [string, string][];
  sequence_max_crops?: number;
  rotation_search?: boolean;
  dssat_replan?: boolean;
  events?: Record<string, string>;
  crops: CapabilityCrop[];
}

export interface ClimateProjectionOptions {
  source?: string;
  method?: string;
  available?: {
    scenarios?: Record<string, string>;
    periods?: string[];
    models?: string[];
    coverage?: string;
  };
  if_not_ready?: string;
}

// ----------------------------------------------------------------------------- simulação individual

export interface Quantiles {
  p10: number | null;
  p50: number | null;
  p90: number | null;
}

export interface ScenarioSummary {
  trno: number;
  name: string;
  planting_mm_dd?: string;
  irrigated: boolean;
  n_seasons?: number;
  yield_kg_ha: Quantiles;
  share_seasons_below_1000_kg_ha?: number | null;
  share_seasons_below_half_irrigated_p50?: number | null;
  maturity_dap_p50?: number | null;
  rain_mm_p50?: number | null;
  irrigation_mm_p50?: number | null;
  et_mm_p50?: number | null;
}

export interface SoilLayer {
  SLB: number;          // profundidade da base da camada (cm)
  SLLL?: number;        // ponto de murcha (cm³/cm³)
  SDUL?: number;        // capacidade de campo (cm³/cm³)
  SSAT?: number;        // saturação (cm³/cm³)
  SBDM?: number;        // densidade (g/cm³)
  SLOC?: number;        // carbono orgânico (%)
  SLCL?: number;        // argila (%)
  SLSI?: number;        // silte (%)
  SLHW?: number;        // pH em água
  SCEC?: number;        // CTC (cmol/kg)
  CE_dS_m?: number | null;
  origem?: string;
}

export interface ProjectionClimateChange {
  tmax_change_c?: number;
  tmin_change_c?: number;
  rain_change_pct?: number | null;
  srad_change_pct?: number | null;
}

export interface ProjectionModel {
  model: string;
  institution?: string;
  climate_change?: ProjectionClimateChange;
  scenario_summary?: ScenarioSummary[];
}

export interface ProjectionEnsembleRow {
  trno: number;
  name: string;
  irrigated: boolean;
  n_models: number;
  baseline_yield_p50: number | null;
  future_yield_p50_median: number | null;
  future_yield_p50_range?: [number, number] | null;
  yield_change_pct: number | null;
  baseline_share_below_1000?: number | null;
  future_share_below_1000_median?: number | null;
  models_with_loss?: number;
}

export interface ClimateProjectionResult {
  status?: 'done' | 'failed' | 'unavailable' | string;
  error?: string;
  scenario?: string;
  scenario_name?: string;
  period?: string;
  historical_reference?: string;
  source?: string;
  method?: string;
  nex_cell?: { lat: number; lon: number; size_deg?: number } | null;
  models?: ProjectionModel[];
  failures?: { model: string; error: string }[];
  ensemble?: ProjectionEnsembleRow[];
}

export interface SimulationResult {
  id: string;
  status: JobStatus;
  kind?: string;
  error?: string;
  note?: string;
  started_utc?: string;
  finished_utc?: string;
  location?: { lat: number; lon: number; elev_m?: number };
  crop?: {
    code: string;
    name: string;
    product?: string;
    yield_variable?: string;
    cultivar?: { id: string; name?: string };
  };
  seasons?: { first_planting_year?: number; n_years?: number };
  scenario_summary?: ScenarioSummary[];
  climate?: { source?: string; period?: [string, string]; tav_c?: number; amp_c?: number };
  soil?: { source?: string; texture_top?: string; layers?: SoilLayer[]; warnings?: string[] };
  planting_windows_source?: string;
  assumptions?: Record<string, string>;
  evidence?: Record<string, unknown>;
  climate_projection?: ClimateProjectionResult;
}

// ----------------------------------------------------------------------------- rotações

export interface RotationCycle {
  crop: string;
  yield_kg_ha: number | null;
  biomass_kg_ha: number | null;
  rain_mm?: number | null;
  et_mm?: number | null;
  irrigation_mm?: number | null;
  planting_yyyyddd?: number | null;
  maturity_yyyyddd?: number | null;
  maturity_dap?: number | null;
}

export interface RotationSample {
  start_year: number;
  cycles: RotationCycle[];
  all_targets_met: boolean;
  mean_target_attainment: number;
}

export interface RotationOption {
  id: string;
  order: string[];
  samples: RotationSample[];
  years_all_targets_met?: number;
  mean_target_attainment?: number;
  failed_years?: number[];
}

export interface RotationSearchResult {
  id: string;
  status: JobStatus;
  kind?: 'rotation_search';
  error?: string;
  recommendations?: RotationOption[];
  ranked_alternatives?: RotationOption[];
  incomplete_alternatives?: RotationOption[];
  target_metrics?: Record<string, string>;
  search?: {
    calendar_eligible?: number;
    calendar_filtered?: number;
    pair_filtered?: number;
    attempted_candidates?: number;
    budget_omitted?: number;
  };
  assumptions?: string[];
  evidence?: Record<string, unknown>;
}

export interface RotationCompareAlternative {
  id: string;
  order: string[];
  cycles: RotationCycle[];
  minus_baseline?: Record<string, Record<string, number | null>>;
}

export interface RotationCompareResult {
  id: string;
  status: JobStatus;
  kind?: 'rotation';
  error?: string;
  alternatives?: RotationCompareAlternative[];
  failed_alternatives?: { id: string; order: string[]; reason?: string }[];
  baseline_id?: string | null;
  assumptions?: string[];
}

export type AnyJobResult = SimulationResult | RotationSearchResult | RotationCompareResult;

// ----------------------------------------------------------------------------- pedidos

export interface SimulationRequest {
  lat: number;
  lon: number;
  crop: string;
  cultivar?: string;
  planting_windows?: string[];
  climate_projection?: { scenario: string; period: string };
}

export interface RotationSearchRequest {
  lat: number;
  lon: number;
  known_crops: string[];
  planting_dates: [string, string, string];
  historical_start_years: number[];
  yield_targets_kg_ha: Record<string, number>;
  biomass_target_crops?: string[];
  max_candidates?: number;
}

export interface RotationCompareRequest {
  lat: number;
  lon: number;
  crops: string[];
  planting_dates: string[];
}
