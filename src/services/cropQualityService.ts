import * as turf from '@turf/turf';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { PILOT_AREAS_AUDITED } from '../data/auditedNasaCache';
import {
  CropQualityAnalysisResponse,
  PilotAreaPreset,
  VisualFieldZone,
} from '../types/cropQuality';
import { GeoPoint } from '../types/domain';
import { createMicroPlotAroundPoint } from '../utils/geoprocessing';

export { PILOT_AREAS_AUDITED };

const ZONE_META: Record<string, { label: string }> = {
  zona_sul_baixa: { label: 'Parte mais baixa (Descida)' },
  zona_central: { label: 'Meio da roça' },
  zona_norte: { label: 'Parte de cima do terreno (Norte)' },
};

export function resolveCropQualityApiUrl(overrideUrl?: string): string {
  if (overrideUrl && overrideUrl.trim().length > 0) {
    return overrideUrl.replace(/\/+$/, '');
  }
  const extraUrl = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  const envUrl =
    typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_API_URL : undefined;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.replace(/\/+$/, '');
  }
  if (extraUrl && extraUrl.trim().length > 0) {
    return extraUrl.replace(/\/+$/, '');
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  return 'http://localhost:8000';
}

export function slicePolygonIntoVisualZones(
  polygon: GeoPoint[],
  templateZones: VisualFieldZone[]
): VisualFieldZone[] {
  const safePts =
    polygon.length >= 3
      ? polygon
      : createMicroPlotAroundPoint({ latitude: -11.3055, longitude: -41.8552 }, 4.2);

  const ring = safePts.map((p) => [Number(p.longitude.toFixed(6)), Number(p.latitude.toFixed(6))]);
  if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
    ring.push([...ring[0]]);
  }

  let minX = Math.min(...ring.map((r) => r[0]));
  let minY = Math.min(...ring.map((r) => r[1]));
  let maxX = Math.max(...ring.map((r) => r[0]));
  let maxY = Math.max(...ring.map((r) => r[1]));

  if (Math.abs(maxY - minY) < 1e-6) {
    minY -= 0.0005;
    maxY += 0.0005;
  }
  if (Math.abs(maxX - minX) < 1e-6) {
    minX -= 0.0005;
    maxX += 0.0005;
  }

  const farmPoly = turf.polygon([ring]);
  const spanY = maxY - minY;
  const bands: { zoneId: string; y0: number; y1: number }[] = [
    { zoneId: 'zona_norte', y0: minY + spanY * 0.67, y1: maxY + 0.0001 },
    { zoneId: 'zona_central', y0: minY + spanY * 0.34, y1: minY + spanY * 0.67 },
    { zoneId: 'zona_sul_baixa', y0: minY - 0.0001, y1: minY + spanY * 0.34 },
  ];

  const fallbackTemplates: VisualFieldZone[] =
    templateZones.length >= 3
      ? templateZones
      : [
          {
            zone_id: 'zona_norte',
            location_label_pt: ZONE_META.zona_norte.label,
            color_hex: '#16A34A',
            icon_name: 'sprout',
            short_label_pt: 'Planta forte e sadia',
            polygon_geojson: { type: 'Polygon', coordinates: [ring] },
          },
          {
            zone_id: 'zona_central',
            location_label_pt: ZONE_META.zona_central.label,
            color_hex: '#D97706',
            icon_name: 'droplet',
            short_label_pt: 'Atenção: pouca água',
            polygon_geojson: { type: 'Polygon', coordinates: [ring] },
          },
          {
            zone_id: 'zona_sul_baixa',
            location_label_pt: ZONE_META.zona_sul_baixa.label,
            color_hex: '#16A34A',
            icon_name: 'sprout',
            short_label_pt: 'Planta forte e sadia',
            polygon_geojson: { type: 'Polygon', coordinates: [ring] },
          },
        ];

  return bands.map((band, idx) => {
    const tpl =
      fallbackTemplates.find((z) => z.zone_id === band.zoneId) ?? fallbackTemplates[idx];
    const bandBox = turf.polygon([
      [
        [minX - 0.0001, band.y0],
        [maxX + 0.0001, band.y0],
        [maxX + 0.0001, band.y1],
        [minX - 0.0001, band.y1],
        [minX - 0.0001, band.y0],
      ],
    ]);

    let slicedRing: number[][] = bandBox.geometry.coordinates[0];
    try {
      const intersection = turf.intersect(turf.featureCollection([farmPoly, bandBox]));
      if (intersection?.geometry.type === 'Polygon') {
        slicedRing = intersection.geometry.coordinates[0];
      } else if (intersection?.geometry.type === 'MultiPolygon') {
        slicedRing = intersection.geometry.coordinates[0][0];
      }
    } catch {
      // Fallback safely to bounding slice if polygon self-intersects while user draws vertices
    }

    return {
      ...tpl,
      zone_id: band.zoneId,
      location_label_pt: tpl.location_label_pt || ZONE_META[band.zoneId].label,
      polygon_geojson: {
        type: 'Polygon',
        coordinates: [slicedRing],
      },
    };
  });
}

export function findNearestAuditedPilot(centroid: GeoPoint): PilotAreaPreset {
  let best = PILOT_AREAS_AUDITED[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const pilot of PILOT_AREAS_AUDITED) {
    const d = Math.hypot(
      pilot.centroid.lat - centroid.latitude,
      pilot.centroid.lon - centroid.longitude
    );
    if (d < bestDist) {
      bestDist = d;
      best = pilot;
    }
  }
  return best;
}

export function buildOfflineAuditedCropQuality(
  centroid: GeoPoint,
  polygon: GeoPoint[],
  cropName: string,
  waterRegime: 'RAINFED' | 'IRRIGATED' = 'RAINFED',
  dryStressBoost: number = 0
): CropQualityAnalysisResponse {
  const nearest = findNearestAuditedPilot(centroid);
  const cloned = JSON.parse(
    JSON.stringify(nearest.audited_diagnosis)
  ) as CropQualityAnalysisResponse;

  cloned.evaluated_at_utc = new Date().toISOString();
  cloned.farmer_accessible_view.visual_field_zones = slicePolygonIntoVisualZones(
    polygon,
    cloned.farmer_accessible_view.visual_field_zones
  );
  cloned.crop_agronomic_baseline.common_name_pt = cropName;
  cloned.crop_agronomic_baseline.fao_gaez_v4_suitability.water_supply_regime = waterRegime;

  if (dryStressBoost >= 2) {
    cloned.farmer_accessible_view.overall_traffic_light = 'RED';
    cloned.farmer_accessible_view.health_score_0_to_100 = Math.min(
      cloned.farmer_accessible_view.health_score_0_to_100,
      42
    );
    cloned.farmer_accessible_view.status_badge_title =
      'Simulação de Seca Severa: Água Crítica na Raiz';
  }

  cloned.cache_metadata = {
    fallback_used: true,
    pilot_area_id: nearest.id,
    pilot_area_name: nearest.name,
    reason: 'offline_audited_nasa_cache',
    latency_ms: 4,
  };

  return cloned;
}

function formatYyyymmdd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function validPowerValues(series?: Record<string, number>): { date: string; val: number }[] {
  if (!series) return [];
  return Object.entries(series)
    .filter(([, v]) => typeof v === 'number' && Number.isFinite(v) && v > -900)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, val]) => ({ date, val }));
}

function computeDailyEt0Fao56(
  tMax: number,
  tMin: number,
  rh: number,
  rs: number,
  u2: number,
  latDeg: number,
  doy: number
): number {
  const tMean = 0.5 * (tMax + tMin);
  const elev = 450;
  const press = 101.3 * Math.pow((293 - 0.0065 * elev) / 293, 5.26);
  const gamma = 0.000665 * press;
  const esMax = 0.6108 * Math.exp((17.27 * tMax) / (tMax + 237.3));
  const esMin = 0.6108 * Math.exp((17.27 * tMin) / (tMin + 237.3));
  const es = 0.5 * (esMax + esMin);
  const ea = Math.max(0.05, Math.min(es, (rh / 100) * es));
  const delta = (4098 * 0.6108 * Math.exp((17.27 * tMean) / (tMean + 237.3))) / Math.pow(tMean + 237.3, 2);

  const latRad = (latDeg * Math.PI) / 180;
  const dr = 1 + 0.033 * Math.cos(((2 * Math.PI) / 365) * doy);
  const decl = 0.409 * Math.sin(((2 * Math.PI) / 365) * doy - 1.39);
  const ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(latRad) * Math.tan(decl))));
  const ra = Math.max(
    1,
    ((24 * 60) / Math.PI) *
      0.082 *
      dr *
      (ws * Math.sin(latRad) * Math.sin(decl) + Math.cos(latRad) * Math.cos(decl) * Math.sin(ws))
  );
  const rso = (0.75 + 2e-5 * elev) * ra;
  const rns = 0.77 * Math.max(0, rs);
  const rnl =
    4.903e-9 *
    ((Math.pow(tMax + 273.16, 4) + Math.pow(tMin + 273.16, 4)) / 2) *
    (0.34 - 0.14 * Math.sqrt(ea)) *
    (1.35 * Math.min(1, Math.max(0.25, rs / Math.max(1, rso))) - 0.35);
  const rn = rns - rnl;
  const num = 0.408 * delta * rn + gamma * (900 / (tMean + 273)) * Math.max(0.2, u2) * (es - ea);
  const den = delta + gamma * (1 + 0.34 * Math.max(0.2, u2));
  return Math.max(0.5, Math.min(12.0, num / Math.max(0.1, den)));
}

export async function fetchLiveNasaPowerFromBrowser(
  centroid: GeoPoint,
  baseResponse: CropQualityAnalysisResponse
): Promise<CropQualityAnalysisResponse | null> {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end.getTime() - 45 * 86400 * 1000);
  const url =
    `https://power.larc.nasa.gov/api/temporal/daily/point` +
    `?parameters=T2M_MAX,T2M_MIN,T2M,RH2M,ALLSKY_SFC_SW_DWN,WS2M,PRECTOTCORR,GWETROOT,GWETTOP` +
    `&community=AG&longitude=${centroid.longitude.toFixed(4)}&latitude=${centroid.latitude.toFixed(4)}` +
    `&start=${formatYyyymmdd(start)}&end=${formatYyyymmdd(end)}&format=JSON`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const t0 = Date.now();
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      properties?: { parameter?: Record<string, Record<string, number>> };
    };
    const param = json.properties?.parameter;
    if (!param) return null;

    const tmaxSeries = validPowerValues(param.T2M_MAX);
    const tminSeries = validPowerValues(param.T2M_MIN);
    const t2mSeries = validPowerValues(param.T2M);
    const rhSeries = validPowerValues(param.RH2M);
    const rsSeries = validPowerValues(param.ALLSKY_SFC_SW_DWN);
    const wsSeries = validPowerValues(param.WS2M);
    const precSeries = validPowerValues(param.PRECTOTCORR);
    const gwetSeries = validPowerValues(param.GWETROOT);

    if (tmaxSeries.length < 5 || gwetSeries.length < 3 || precSeries.length < 5) {
      return null;
    }

    const last30Prec = precSeries.slice(-30);
    const precip30d = Number(last30Prec.reduce((s, x) => s + x.val, 0).toFixed(1));
    const gwetLatest = Number(gwetSeries[gwetSeries.length - 1].val.toFixed(3));

    const tBase = baseResponse.crop_agronomic_baseline.fao_ecocrop_parameters.t_base_c || 10;
    const len = Math.min(
      tmaxSeries.length,
      tminSeries.length,
      rhSeries.length,
      rsSeries.length,
      wsSeries.length,
      30
    );
    let et0Sum = 0;
    let gddSum = 0;
    const startIdx = tmaxSeries.length - len;
    for (let i = 0; i < len; i++) {
      const tx = tmaxSeries[startIdx + i].val;
      const tn = tminSeries[tminSeries.length - len + i]?.val ?? tx - 9;
      const rh = rhSeries[rhSeries.length - len + i]?.val ?? 55;
      const rs = rsSeries[rsSeries.length - len + i]?.val ?? 21;
      const ws = wsSeries[wsSeries.length - len + i]?.val ?? 2.0;
      et0Sum += computeDailyEt0Fao56(tx, tn, rh, rs, ws, centroid.latitude, 300 + i);
      gddSum += Math.max(0, 0.5 * (tx + tn) - tBase);
    }

    const ks = Number(Math.max(0, Math.min(1, (gwetLatest - 0.35) / 0.35)).toFixed(3));
    const latestTempMean =
      t2mSeries.length > 0 ? t2mSeries[t2mSeries.length - 1].val : baseResponse.scientific_telemetry.biophysical_indices.canopy_temp_celsius;
    const latestTmax = tmaxSeries[tmaxSeries.length - 1].val;
    const latestTmin = tminSeries[tminSeries.length - 1]?.val ?? latestTmax - 9;
    const latestRh = rhSeries[rhSeries.length - 1]?.val ?? 55;
    const latestPrecip = precSeries[precSeries.length - 1]?.val ?? 0;

    const updated = JSON.parse(JSON.stringify(baseResponse)) as CropQualityAnalysisResponse;
    updated.evaluated_at_utc = new Date().toISOString();
    updated.scientific_telemetry.biophysical_indices.nasa_gwetroot_0_to_1 = gwetLatest;
    updated.scientific_telemetry.biophysical_indices.fao56_ks_water_stress_coeff = ks;
    updated.scientific_telemetry.biophysical_indices.et0_fao56_30d_mm = Number(et0Sum.toFixed(1));
    updated.scientific_telemetry.biophysical_indices.precip_gpm_power_30d_mm = precip30d;
    updated.scientific_telemetry.biophysical_indices.gdd_accumulated_c_day = Number(gddSum.toFixed(1));

    updated.dssat_state_vector.rootzone_soil_wetness_fraction = gwetLatest;
    updated.dssat_state_vector.water_stress_factor_swfac = ks;
    updated.dssat_state_vector.accumulated_gdd = Number(gddSum.toFixed(1));

    updated.scientific_telemetry.data_provenance = [
      ...updated.scientific_telemetry.data_provenance.filter(
        (p) => p.dataset !== 'NASA/POWER_MERRA2_AG_DAILY'
      ),
      {
        dataset: 'NASA/POWER_MERRA2_AG_DAILY_LIVE_CLIENT',
        endpoint: 'power.larc.nasa.gov/api/temporal/daily/point',
        window: `${tmaxSeries[0].date}..${tmaxSeries[tmaxSeries.length - 1].date}`,
        t2m_latest_c: Number(latestTempMean.toFixed(1)),
        t2m_max_latest_c: Number(latestTmax.toFixed(1)),
        t2m_min_latest_c: Number(latestTmin.toFixed(1)),
        rh2m_latest_pct: Number(latestRh.toFixed(0)),
        precip_latest_mm: Number(latestPrecip.toFixed(1)),
        precip_30d_mm: precip30d,
        gwetroot_latest: gwetLatest,
      },
    ];

    updated.cache_metadata = {
      fallback_used: false,
      pilot_area_id: baseResponse.cache_metadata?.pilot_area_id ?? 'live_client',
      reason: 'live_nasa_power_api_direct',
      latency_ms: Date.now() - t0,
    };

    return updated;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

export async function analyzeCropQualityRemoteOrFallback(options: {
  polygon: GeoPoint[];
  centroid: GeoPoint;
  cropName: string;
  waterRegime?: 'RAINFED' | 'IRRIGATED';
  communityPestAlert?: boolean;
  preferAuditedCache?: boolean;
  remoteApiUrl?: string;
  isOnline?: boolean;
}): Promise<CropQualityAnalysisResponse> {
  const {
    polygon,
    centroid,
    cropName,
    waterRegime = 'RAINFED',
    communityPestAlert = false,
    preferAuditedCache = true,
    remoteApiUrl,
    isOnline = true,
  } = options;

  const offlineFallback = buildOfflineAuditedCropQuality(
    centroid,
    polygon,
    cropName,
    waterRegime
  );

  if (!isOnline) {
    return offlineFallback;
  }

  const safePoly =
    polygon.length >= 3
      ? polygon
      : createMicroPlotAroundPoint(centroid, 4.2);
  const ring = safePoly.map((p) => [p.longitude, p.latitude]);
  if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
    ring.push([...ring[0]]);
  }

  const baseUrl = resolveCropQualityApiUrl(remoteApiUrl);
  const controller = new AbortController();
  const timeoutMs = preferAuditedCache ? 2500 : 25000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(`${baseUrl}/api/v1/crop-quality/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        polygon_coordinates: ring,
        crop_name: cropName,
        water_regime: waterRegime,
        community_pest_alert: communityPestAlert,
        use_cache_fallback: true,
        prefer_audited_cache: preferAuditedCache,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (resp.ok) {
      return (await resp.json()) as CropQualityAnalysisResponse;
    }
  } catch {
    clearTimeout(timeout);
  }

  if (!preferAuditedCache) {
    const liveBrowser = await fetchLiveNasaPowerFromBrowser(centroid, offlineFallback);
    if (liveBrowser) {
      return liveBrowser;
    }
  }

  return offlineFallback;
}

export function extractLiveClimaDia(
  analysis: CropQualityAnalysisResponse,
  current: {
    tempMaxC: number;
    tempMinC: number;
    condicao: string;
    icone: '☀️' | '⛅' | '🌦️' | '🌧️' | '🔥';
    chuvaHojeMm: number;
    umidadeRelativaPct: number;
  }
) {
  const powerProv = analysis.scientific_telemetry.data_provenance.find(
    (p) =>
      typeof p.dataset === 'string' && p.dataset.includes('NASA/POWER')
  ) as Record<string, unknown> | undefined;

  const tmax =
    typeof powerProv?.t2m_max_latest_c === 'number'
      ? Math.round(powerProv.t2m_max_latest_c)
      : Math.round(analysis.scientific_telemetry.biophysical_indices.canopy_temp_celsius);
  const tmin =
    typeof powerProv?.t2m_min_latest_c === 'number'
      ? Math.round(powerProv.t2m_min_latest_c)
      : Math.max(14, tmax - 10);
  const precipRecent =
    typeof powerProv?.precip_latest_mm === 'number'
      ? Number(powerProv.precip_latest_mm.toFixed(1))
      : current.chuvaHojeMm;
  const rh =
    typeof powerProv?.rh2m_latest_pct === 'number'
      ? Math.round(powerProv.rh2m_latest_pct)
      : current.umidadeRelativaPct;

  const precip30d = analysis.scientific_telemetry.biophysical_indices.precip_gpm_power_30d_mm;
  const icone: '☀️' | '⛅' | '🌦️' | '🌧️' | '🔥' =
    precipRecent >= 5
      ? '🌧️'
      : precip30d >= 45
      ? '🌦️'
      : tmax >= 34
      ? '🔥'
      : '☀️';
  const condicao =
    precipRecent >= 5
      ? 'Chuva recente registrada pela NASA'
      : tmax >= 34
      ? 'Calor forte e baixa umidade (NASA)'
      : current.condicao;

  return {
    tempMaxC: tmax,
    tempMinC: tmin,
    condicao,
    icone,
    chuvaHojeMm: precipRecent,
    umidadeRelativaPct: rh,
  };
}
