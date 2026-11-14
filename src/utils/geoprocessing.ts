import * as turf from '@turf/turf';
import { GeoPoint, WellPoint } from '../types/domain';

const TAREFA_BAIANA_HECTARES = 0.4356;

export function calculatePolygonMetrics(points: GeoPoint[]): {
  areaHectares: number;
  areaTarefasBa: number;
  centroid: GeoPoint;
} {
  if (points.length === 0) {
    return {
      areaHectares: 0,
      areaTarefasBa: 0,
      centroid: { latitude: -12.9714, longitude: -38.5014 },
    };
  }

  if (points.length < 3) {
    const avgLat = points.reduce((s, p) => s + p.latitude, 0) / points.length;
    const avgLon = points.reduce((s, p) => s + p.longitude, 0) / points.length;
    return {
      areaHectares: 0,
      areaTarefasBa: 0,
      centroid: { latitude: avgLat, longitude: avgLon },
    };
  }

  const ring = points.map((p) => [p.longitude, p.latitude]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([...first]);
  }

  const poly = turf.polygon([ring]);
  const areaSqMeters = turf.area(poly);
  const areaHectares = Math.max(0.05, Number((areaSqMeters / 10000).toFixed(2)));
  const areaTarefasBa = Number((areaHectares / TAREFA_BAIANA_HECTARES).toFixed(2));
  const center = turf.centroid(poly);
  const [lon, lat] = center.geometry.coordinates;

  return {
    areaHectares,
    areaTarefasBa,
    centroid: {
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lon.toFixed(6)),
    },
  };
}

export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const from = turf.point([a.longitude, a.latitude]);
  const to = turf.point([b.longitude, b.latitude]);
  return Number(turf.distance(from, to, { units: 'kilometers' }).toFixed(2));
}

export function filterWellsByRadius(
  wells: WellPoint[],
  center: GeoPoint,
  radiusKm: number
): WellPoint[] {
  return wells
    .map((w) => ({
      ...w,
      distanciaKm: distanceKm(center, { latitude: w.latitude, longitude: w.longitude }),
    }))
    .filter((w) => (w.distanciaKm ?? 999) <= radiusKm)
    .sort((a, b) => (a.distanciaKm ?? 999) - (b.distanciaKm ?? 999));
}

export function createMicroPlotAroundPoint(
  center: GeoPoint,
  targetHectares: number = 4.2
): GeoPoint[] {
  const sideM = Math.sqrt(targetHectares * 10000);
  const halfLatDeg = sideM / 2 / 111320;
  const halfLonDeg =
    sideM / 2 / (111320 * Math.cos((center.latitude * Math.PI) / 180));

  return [
    { latitude: center.latitude + halfLatDeg * 0.95, longitude: center.longitude - halfLonDeg },
    { latitude: center.latitude + halfLatDeg, longitude: center.longitude + halfLonDeg * 0.9 },
    { latitude: center.latitude - halfLatDeg * 0.9, longitude: center.longitude + halfLonDeg },
    { latitude: center.latitude - halfLatDeg, longitude: center.longitude - halfLonDeg * 0.92 },
  ];
}
