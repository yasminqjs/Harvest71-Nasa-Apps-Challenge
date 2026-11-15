import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polygon, Rect } from 'react-native-svg';
import { AppTheme } from '../theme/tokens';
import { VisualFieldZone } from '../types/cropQuality';
import { GeoPoint } from '../types/domain';

/**
 * Mapa vetorial (offline, web + nativo via react-native-svg) da plantação com as manchas
 * de qualidade clusterizadas a partir dos pixels de 10 m do Sentinel-2 e do downscaling
 * térmico (DisTrad) do Landsat C2 TIRS. Cada mancha recebe um marcador clicável com cor
 * de semáforo e ícone grande (🌱, 💧, 🐛, 🔥) para leitura sob sol forte.
 */

export function mapFieldZoneIconToEmoji(iconName: string): string {
  switch (iconName) {
    case 'bug':
    case 'bug-alert':
    case 'search-leaf':
      return '🐛';
    case 'flame':
    case 'flame-alert':
      return '🔥';
    case 'droplet':
    case 'water-alert':
      return '💧';
    case 'cloud':
    case 'cloud-alert':
      return '☁️';
    case 'layers':
    case 'layers-alert':
    case 'shield-soil':
    case 'sprout':
    case 'sprout-ok':
    default:
      return '🌱';
  }
}

function summarizeZoneShortLabel(label: string): string {
  if (label.length <= 18) return label;
  const trimmed = label.replace('Olhar folhas (Suspeita de Praga)', 'Suspeita de Praga');
  if (trimmed.length <= 18) return trimmed;
  return `${trimmed.slice(0, 16)}…`;
}

export interface CropQualityFieldMapProps {
  centroid: GeoPoint;
  polygon: GeoPoint[];
  fieldZones: VisualFieldZone[];
  selectedZoneId?: string | null;
  onSelectFieldZone?: (zone: VisualFieldZone) => void;
  theme: AppTheme;
  height?: number;
}

export const CropQualityFieldMap: React.FC<CropQualityFieldMapProps> = ({
  centroid,
  polygon,
  fieldZones,
  selectedZoneId = null,
  onSelectFieldZone,
  theme,
  height = 235,
}) => {
  const [size, setSize] = useState({ width: 340, height });

  // Enquadramento: usa o polígono do lote + vértices das zonas para garantir que tudo caiba.
  const allLats: number[] = polygon.map((p) => p.latitude);
  const allLons: number[] = polygon.map((p) => p.longitude);
  for (const z of fieldZones) {
    for (const pt of z.polygon_geojson?.coordinates?.[0] ?? []) {
      allLons.push(pt[0]);
      allLats.push(pt[1]);
    }
  }
  let spanDeg = 0.0045;
  if (allLats.length >= 2) {
    const latSpan = Math.max(...allLats) - Math.min(...allLats);
    const lonSpan = Math.max(...allLons) - Math.min(...allLons);
    spanDeg = Math.max(0.0012, Math.max(latSpan, lonSpan) * 1.45);
  }

  const project = (pt: GeoPoint): { x: number; y: number } => ({
    x: ((pt.longitude - (centroid.longitude - spanDeg / 2)) / spanDeg) * size.width,
    y: ((centroid.latitude + spanDeg / 2 - pt.latitude) / spanDeg) * size.height,
  });

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height: h } = e.nativeEvent.layout;
    if (width > 0 && h > 0) setSize({ width, height: h });
  };

  const polygonPointsAttr = polygon
    .map((p) => {
      const { x, y } = project(p);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const projectedFieldZones = fieldZones
    .map((zone) => {
      const ring = zone.polygon_geojson?.coordinates?.[0] ?? [];
      if (ring.length < 3) return null;
      const uniqueVerts =
        ring.length > 3 &&
        ring[0][0] === ring[ring.length - 1][0] &&
        ring[0][1] === ring[ring.length - 1][1]
          ? ring.slice(0, -1)
          : ring;
      const projected = uniqueVerts.map(([lon, lat]) =>
        project({ latitude: lat, longitude: lon })
      );
      const cx = projected.reduce((acc, pt) => acc + pt.x, 0) / Math.max(1, projected.length);
      const cy = projected.reduce((acc, pt) => acc + pt.y, 0) / Math.max(1, projected.length);
      const pointsAttr = projected.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');
      return { zone, cx, cy, pointsAttr };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <View
      onLayout={handleLayout}
      style={[styles.canvasWrap, { height, backgroundColor: '#E8F0E3', borderColor: theme.border }]}
    >
      <Svg width="100%" height="100%">
        <Rect x="0" y="0" width={size.width} height={size.height} fill="#E6EFE0" />
        {[0.25, 0.5, 0.75].map((f) => (
          <React.Fragment key={f}>
            <Line
              x1={size.width * f}
              y1={0}
              x2={size.width * f}
              y2={size.height}
              stroke="#C9D8C0"
              strokeWidth={1}
              strokeDasharray="4,4"
            />
            <Line
              x1={0}
              y1={size.height * f}
              x2={size.width}
              y2={size.height * f}
              stroke="#C9D8C0"
              strokeWidth={1}
              strokeDasharray="4,4"
            />
          </React.Fragment>
        ))}

        {projectedFieldZones.map(({ zone, pointsAttr }) => {
          const isSelected = selectedZoneId === zone.zone_id;
          return (
            <Polygon
              key={zone.zone_id}
              points={pointsAttr}
              fill={zone.color_hex}
              fillOpacity={isSelected ? 0.66 : 0.48}
              stroke={isSelected ? '#111827' : '#FFFFFF'}
              strokeWidth={isSelected ? 3 : 1.8}
            />
          );
        })}

        {polygon.length >= 3 && (
          <Polygon points={polygonPointsAttr} fill="transparent" stroke="#1F6E43" strokeWidth={3} />
        )}

        {polygon.map((p, idx) => {
          const { x, y } = project(p);
          return (
            <Circle
              key={`${idx}-${p.latitude}`}
              cx={x}
              cy={y}
              r={4.5}
              fill="#1F6E43"
              stroke="#FFFFFF"
              strokeWidth={2}
            />
          );
        })}
      </Svg>

      {projectedFieldZones.map(({ zone, cx, cy }, idx) => {
        const isSelected = selectedZoneId === zone.zone_id;
        const staggerOffset = projectedFieldZones.length > 1 ? ((idx % 3) - 1) * 34 : 0;
        const approxPillWidth = 144;
        const left = Math.max(
          6,
          Math.min(
            Math.max(6, size.width - approxPillWidth - 6),
            cx + staggerOffset - approxPillWidth / 2
          )
        );
        const top = Math.max(34, Math.min(Math.max(34, size.height - 60), cy - 15));
        return (
          <Pressable
            key={`pin-${zone.zone_id}`}
            onPress={() => onSelectFieldZone?.(zone)}
            accessibilityRole="button"
            accessibilityLabel={`${zone.location_label_pt}: ${zone.short_label_pt}`}
            style={[
              styles.zonePinPill,
              {
                left,
                top,
                borderColor: isSelected ? '#111827' : zone.color_hex,
                backgroundColor: isSelected ? '#111827' : 'rgba(255,255,255,0.96)',
                zIndex: isSelected ? 20 : 10 + idx,
                transform: [{ scale: isSelected ? 1.06 : 1 }],
              },
            ]}
          >
            <View style={[styles.zonePinDot, { backgroundColor: zone.color_hex }]} />
            <Text style={styles.zonePinEmoji}>{mapFieldZoneIconToEmoji(zone.icon_name)}</Text>
            <Text
              numberOfLines={1}
              style={[styles.zonePinText, { color: isSelected ? '#FFFFFF' : '#0F172A' }]}
            >
              {summarizeZoneShortLabel(zone.short_label_pt)}
            </Text>
          </Pressable>
        );
      })}

      <View style={styles.overlayTop} pointerEvents="none">
        <Text style={styles.coordTag}>
          Lat {centroid.latitude.toFixed(4)} • Lon {centroid.longitude.toFixed(4)}
        </Text>
        <Text style={styles.modeTag}>🛰️ Sentinel-2 10 m + Landsat TIRS</Text>
      </View>

      {projectedFieldZones.length > 0 && (
        <View style={styles.legendBar} pointerEvents="none">
          <Text numberOfLines={1} style={styles.legendText}>
            🟢 Saudável • 🟡 Atenção • 🔴 Crítico — Toque nos marcadores
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  canvasWrap: {
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  zonePinPill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: 158,
    minHeight: 30,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 2.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  zonePinDot: { width: 8, height: 8, borderRadius: 4 },
  zonePinEmoji: { fontSize: 16 },
  zonePinText: { fontSize: 11, fontWeight: '900', flexShrink: 1 },
  overlayTop: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  coordTag: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 10,
    fontWeight: '800',
    color: '#111827',
  },
  modeTag: {
    backgroundColor: 'rgba(17,24,39,0.82)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  legendBar: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(15,23,42,0.86)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: 'center',
  },
  legendText: { color: '#F8FAFC', fontSize: 10, fontWeight: '800' },
});
