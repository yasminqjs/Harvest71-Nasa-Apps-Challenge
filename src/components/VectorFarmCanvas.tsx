import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { useAccessibility } from '../context/AccessibilityContext';
import { pickLang } from '../i18n/locale';
import { AppTheme } from '../theme/tokens';
import { GeoPoint, NdviZonePatch, WellPoint } from '../types/domain';
import { sortPolygonPoints } from '../utils/geoprocessing';

export interface MapLotOverlay {
  id: string;
  nome: string;
  corHex: string;
  polygon: GeoPoint[];
  culturaAtual?: string;
  previsaoBadge?: string;
  areaHectares?: number;
}

export interface FarmMapCanvasProps {
  centroid: GeoPoint;
  polygon: GeoPoint[];
  lots?: MapLotOverlay[];
  activeLotId?: string;
  wells?: WellPoint[];
  ndviZones?: NdviZonePatch[];
  showWells: boolean;
  showNdvi?: boolean;
  drawingMode: boolean;
  height?: number;
  onAddPoint: (point: GeoPoint) => void;
  onSelectLot?: (lotId: string) => void;
  theme: AppTheme;
}

/** Canvas vetorial offline para demarcação do terreno e dos lotes de plantio. */
export const VectorFarmCanvas: React.FC<FarmMapCanvasProps> = ({
  centroid,
  polygon,
  lots = [],
  activeLotId,
  wells = [],
  ndviZones = [],
  showWells,
  showNdvi = false,
  drawingMode,
  height = 280,
  onAddPoint,
  theme,
}) => {
  const { language } = useAccessibility();
  const [size, setSize] = useState({ width: 320, height: 240 });

  const spanDeg = showWells ? 0.16 : 0.0045;

  const project = (pt: GeoPoint): { x: number; y: number } => {
    const x =
      ((pt.longitude - (centroid.longitude - spanDeg / 2)) / spanDeg) * size.width;
    const y =
      ((centroid.latitude + spanDeg / 2 - pt.latitude) / spanDeg) * size.height;
    return { x, y };
  };

  const unproject = (x: number, y: number): GeoPoint => {
    const lon = centroid.longitude - spanDeg / 2 + (x / size.width) * spanDeg;
    const lat = centroid.latitude + spanDeg / 2 - (y / size.height) * spanDeg;
    return {
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lon.toFixed(6)),
    };
  };

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setSize({ width, height });
  };

  const handlePress = (evt: { nativeEvent: { locationX: number; locationY: number } }) => {
    if (!drawingMode) return;
    onAddPoint(unproject(evt.nativeEvent.locationX, evt.nativeEvent.locationY));
  };

  const orderedPolygon = sortPolygonPoints(polygon);
  const polygonPointsAttr = orderedPolygon
    .map((p) => {
      const { x, y } = project(p);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <Pressable
      onLayout={handleLayout}
      onPress={handlePress}
      style={[
        styles.canvasWrap,
        { height, backgroundColor: '#E8F0E3', borderColor: theme.border },
      ]}
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

        {/* Drenagem SRTM */}
        <Line
          x1={0}
          y1={size.height * 0.78}
          x2={size.width}
          y2={size.height * 0.28}
          stroke="#60A5FA"
          strokeWidth={showWells ? 4 : 2}
          opacity={0.45}
        />

        {/* Manchas de vigor NDVI (verde, amarelo, vermelho) dentro da área quando em zoom local */}
        {showNdvi &&
          !showWells &&
          ndviZones.map((z) => {
            const fill =
              z.vigor === 'verde'
                ? 'rgba(34, 197, 94, 0.42)'
                : z.vigor === 'amarelo'
                ? 'rgba(234, 179, 8, 0.45)'
                : 'rgba(239, 68, 68, 0.45)';
            return (
              <Rect
                key={z.id}
                x={(z.relativeBox.xPct / 100) * size.width}
                y={(z.relativeBox.yPct / 100) * size.height}
                width={(z.relativeBox.wPct / 100) * size.width}
                height={(z.relativeBox.hPct / 100) * size.height}
                rx={14}
                fill={fill}
              />
            );
          })}

        {/* Heatmap de poços (SIAGAS + GRACE-FO) */}
        {showWells &&
          wells.map((w) => {
            const pt = project({ latitude: w.latitude, longitude: w.longitude });
            const color =
              w.salinidade === 'doce'
                ? '#0EA5E9'
                : w.salinidade === 'salobra'
                ? '#F59E0B'
                : '#EF4444';
            return (
              <React.Fragment key={w.id}>
                <Circle cx={pt.x} cy={pt.y} r={34} fill={color} opacity={0.18} />
                <Circle cx={pt.x} cy={pt.y} r={18} fill={color} opacity={0.28} />
                <Circle
                  cx={pt.x}
                  cy={pt.y}
                  r={7}
                  fill={color}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
                <SvgText
                  x={pt.x}
                  y={pt.y - 12}
                  fontSize="10"
                  fontWeight="800"
                  fill="#111827"
                  textAnchor="middle"
                >
                  {w.profundidadeM}m ({w.salinidade})
                </SvgText>
              </React.Fragment>
            );
          })}

        {polygon.length >= 3 && (
          <Polygon
            points={polygonPointsAttr}
            fill="rgba(31, 110, 67, 0.20)"
            stroke="#1F6E43"
            strokeWidth={3}
          />
        )}

        {lots.map((lot) => {
          const isSelected = lot.id === activeLotId;
          const lotPts = lot.polygon || [];
          const orderedLot = lotPts.length >= 3 ? sortPolygonPoints(lotPts) : lotPts;
          const ptsAttr = orderedLot
            .map((p) => {
              const { x, y } = project(p);
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(' ');
          const avgPt = orderedLot.length > 0
            ? orderedLot.reduce(
                (acc, p) => ({
                  latitude: acc.latitude + p.latitude / orderedLot.length,
                  longitude: acc.longitude + p.longitude / orderedLot.length,
                }),
                { latitude: 0, longitude: 0 }
              )
            : centroid;
          const labelPos = project(avgPt);
          return (
            <React.Fragment key={lot.id}>
              {lotPts.length >= 3 && (
                <>
                  <Polygon
                    points={ptsAttr}
                    fill={`${lot.corHex}44`}
                    stroke={lot.corHex}
                    strokeWidth={isSelected ? 3.5 : 2}
                  />
                  <SvgText
                    x={labelPos.x}
                    y={labelPos.y + 3}
                    fontSize="10"
                    fontWeight="900"
                    fill="#111827"
                    textAnchor="middle"
                  >
                    {lot.nome}
                  </SvgText>
                </>
              )}
              {isSelected && lotPts.length === 2 && (() => {
                const p1 = project(lotPts[0]);
                const p2 = project(lotPts[1]);
                return (
                  <Line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={lot.corHex}
                    strokeWidth={2.5}
                    strokeDasharray="4,4"
                  />
                );
              })()}
              {isSelected &&
                lotPts.map((p, idx) => {
                  const pt = project(p);
                  return (
                    <Circle
                      key={`${lot.id}-pt-${idx}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={5}
                      fill={lot.corHex}
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    />
                  );
                })}
            </React.Fragment>
          );
        })}

        {!activeLotId &&
          polygon.map((p, idx) => {
            const { x, y } = project(p);
            return (
              <Circle
                key={`${idx}-${p.latitude}`}
                cx={x}
                cy={y}
                r={5.5}
                fill="#1F6E43"
                stroke="#FFFFFF"
                strokeWidth={2}
              />
            );
          })}
      </Svg>

      <View style={styles.overlayTop}>
        <Text style={styles.coordTag}>
          Lat {centroid.latitude.toFixed(4)} • Lon {centroid.longitude.toFixed(4)}
        </Text>
        <Text style={styles.modeTag}>
          {drawingMode
            ? pickLang(language, '👆 Tap to mark', '👆 Toque para demarcar')
            : showWells
            ? pickLang(language, '💧 Map + Wells', '💧 Mapa + Poços')
            : pickLang(language, '🛰️ Offline Farm Map', '🛰️ Mapa da Roça Offline')}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  canvasWrap: {
    height: 255,
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
  },
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
});
