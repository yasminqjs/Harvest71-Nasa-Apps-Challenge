import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useLanguage } from '../i18n/Language';
import { Pressable, Text } from '../i18n/native';
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Polyline,
  Rect,
} from 'react-native-svg';
import { SvgText } from '../i18n/svg';
import { useAccessibility } from '../context/AccessibilityContext';
import { NORDESTE_IBGE_GEOJSON } from '../data/nordesteIbgeGeo';
import { BahiaRegionPreset, NORDESTE_REGIONS } from '../data/seedData';
import { AppTheme } from '../theme/tokens';
import { GeoPoint } from '../types/domain';
import { NordesteLeafletMap } from './NordesteLeafletMap';

interface NordesteSvgMapProps {
  selectedRegionName: string;
  gpsDetectedRegionId?: string | null;
  gpsUserCoords?: GeoPoint | null;
  onSelectRegion: (region: BahiaRegionPreset) => void;
  theme: AppTheme;
}

type LatLon = [number, number];

function projectToSvg(lat: number, lon: number): { x: number; y: number } {
  const minLon = -49.2;
  const maxLon = -33.9;
  const maxLat = -0.3;
  const minLat = -18.9;

  const x = ((lon - minLon) / (maxLon - minLon)) * 292 + 16;
  const y = ((maxLat - lat) / (maxLat - minLat)) * 296 + 16;
  return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
}

function ringToSvgPath(ring: readonly (readonly number[])[]): string {
  return (
    ring
      .map((coord, idx) => {
        const { x, y } = projectToSvg(coord[1], coord[0]);
        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ') + ' Z'
  );
}

function geometryToSvgPath(
  geom: (typeof NORDESTE_IBGE_GEOJSON)['features'][number]['geometry']
): string {
  if (geom.type === 'Polygon') {
    return geom.coordinates.map((ring) => ringToSvgPath(ring)).join(' ');
  }
  return geom.coordinates
    .map((poly) => poly.map((ring) => ringToSvgPath(ring)).join(' '))
    .join(' ');
}

function buildPolylinePoints(coords: LatLon[]): string {
  return coords
    .map(([lat, lon]) => {
      const { x, y } = projectToSvg(lat, lon);
      return `${x},${y}`;
    })
    .join(' ');
}

const UF_LABEL_POSITIONS: Record<string, LatLon> = {
  MA: [-4.8, -45.2],
  PI: [-7.1, -42.6],
  CE: [-5.15, -39.45],
  RN: [-5.75, -36.55],
  PB: [-7.12, -36.65],
  PE: [-8.35, -37.85],
  AL: [-9.55, -36.55],
  SE: [-10.65, -37.38],
  BA: [-12.8, -41.8],
};

const UF_BIOME_TONE: Record<string, 'cerrado' | 'caatinga' | 'atlantico'> = {
  MA: 'cerrado',
  PI: 'cerrado',
  CE: 'caatinga',
  RN: 'caatinga',
  PB: 'caatinga',
  PE: 'caatinga',
  AL: 'atlantico',
  SE: 'atlantico',
  BA: 'atlantico',
};

const SAO_FRANCISCO_RIVER: LatLon[] = [
  [-14.95, -44.08],
  [-14.2, -43.75],
  [-13.25, -43.42],
  [-12.1, -43.22],
  [-11.08, -43.14],
  [-10.22, -42.38],
  [-9.55, -41.15],
  [-9.4, -40.5],
  [-8.95, -39.65],
  [-9.38, -38.22],
  [-9.82, -37.45],
  [-10.22, -36.85],
  [-10.48, -36.38],
];

const PIN_OFFSETS: Record<string, { dx: number; dy: number; shortLabel: string }> = {
  'reconcavo-ba': { dx: 26, dy: 16, shortLabel: 'Recôncavo' },
  'semiarido-feira-ba': { dx: 22, dy: -16, shortLabel: 'Feira' },
  'irece-ba': { dx: -16, dy: -16, shortLabel: 'Irecê' },
  'juazeiro-ba': { dx: -24, dy: 14, shortLabel: 'Juazeiro' },
  'conquista-ba': { dx: -10, dy: 18, shortLabel: 'Conquista' },
  'barreiras-ba': { dx: -20, dy: -16, shortLabel: 'Barreiras' },
  'pajeu-pe': { dx: -14, dy: -16, shortLabel: 'Pajeú (PE)' },
  'agreste-al': { dx: 26, dy: -10, shortLabel: 'Agreste (AL)' },
  'sertao-se': { dx: 28, dy: 10, shortLabel: 'Sertão (SE)' },
  'borborema-pb': { dx: 28, dy: -14, shortLabel: 'Borborema' },
  'oeste-rn': { dx: 24, dy: -16, shortLabel: 'Mossoró' },
  'cariri-ce': { dx: -22, dy: -14, shortLabel: 'Cariri (CE)' },
  'centro-pi': { dx: -18, dy: -15, shortLabel: 'Teresina' },
  'baixada-ma': { dx: -20, dy: -16, shortLabel: 'Mearim (MA)' },
};

export const NordesteSvgMap: React.FC<NordesteSvgMapProps> = ({
  selectedRegionName,
  gpsDetectedRegionId,
  gpsUserCoords,
  onSelectRegion,
  theme,
}) => {
  const { isOnline } = useAccessibility();
  const { language } = useLanguage();
  const en = language === 'en';
  const [preferOfflineSvg, setPreferOfflineSvg] = useState(false);
  const chipsScrollRef = useRef<React.ComponentRef<typeof ScrollView> | null>(null);
  const chipsScrollXRef = useRef(0);

  const scrollChipsBy = (delta: number) => {
    const nextX = Math.max(0, chipsScrollXRef.current + delta);
    chipsScrollXRef.current = nextX;
    chipsScrollRef.current?.scrollTo({ x: nextX, animated: true });
  };

  const canUseInteractiveMap = isOnline && !preferOfflineSvg;
  const isHighContrastDark = theme.bg === '#0D1117';

  const ibgePaths = useMemo(
    () =>
      NORDESTE_IBGE_GEOJSON.features.map((feat) => ({
        uf: feat.properties.uf,
        nome: feat.properties.nome,
        pathD: geometryToSvgPath(feat.geometry),
      })),
    []
  );

  const stateFill = (uf: string, hasSelectedPin: boolean) => {
    const tone = UF_BIOME_TONE[uf] ?? 'caatinga';
    if (isHighContrastDark) {
      return hasSelectedPin ? '#1A2D1E' : '#131D31';
    }
    if (hasSelectedPin) {
      return '#DCEFD8';
    }
    if (tone === 'atlantico') return '#E7F2E3';
    if (tone === 'caatinga') return '#F2EFE2';
    return '#EAEFE0';
  };

  const selectedRegion = NORDESTE_REGIONS.find((r) => r.nome === selectedRegionName);

  return (
    <View style={styles.wrap}>
      {isOnline && (
        <View style={styles.modeSwitchRow}>
          <Pressable
            onPress={() => setPreferOfflineSvg(false)}
            style={[
              styles.modePill,
              {
                backgroundColor: !preferOfflineSvg ? theme.primary : theme.surface,
                borderColor: !preferOfflineSvg ? theme.primary : theme.border,
              },
            ]}
          >
            <Ionicons
              name="earth"
              size={14}
              color={!preferOfflineSvg ? theme.primaryText : theme.text}
            />
            <Text
              style={{
                fontSize: 11.5,
                fontWeight: '800',
                color: !preferOfflineSvg ? theme.primaryText : theme.text,
              }}
            >
              Mapa Realista (Satélite/OSM)
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setPreferOfflineSvg(true)}
            style={[
              styles.modePill,
              {
                backgroundColor: preferOfflineSvg ? theme.primary : theme.surface,
                borderColor: preferOfflineSvg ? theme.primary : theme.border,
              },
            ]}
          >
            <Ionicons
              name="layers-outline"
              size={14}
              color={preferOfflineSvg ? theme.primaryText : theme.text}
            />
            <Text
              style={{
                fontSize: 11.5,
                fontWeight: '800',
                color: preferOfflineSvg ? theme.primaryText : theme.text,
              }}
            >
              Malha IBGE Offline
            </Text>
          </Pressable>
        </View>
      )}

      {canUseInteractiveMap ? (
        <NordesteLeafletMap
          selectedRegionName={selectedRegionName}
          gpsDetectedRegionId={gpsDetectedRegionId}
          gpsUserCoords={gpsUserCoords}
          onSelectRegion={onSelectRegion}
          onFallbackOffline={() => setPreferOfflineSvg(true)}
          theme={theme}
        />
      ) : (
        <View
          style={[
            styles.svgBox,
            {
              backgroundColor: isHighContrastDark ? '#0E1729' : '#DFEEF6',
              borderColor: theme.border,
            },
          ]}
        >
          <Svg width="100%" height={304} viewBox="0 0 326 326">
            <Rect
              x="0"
              y="0"
              width="326"
              height="326"
              rx="16"
              fill={isHighContrastDark ? '#0D172B' : '#DCEEF8'}
            />

            {[-5, -10, -15].map((lat) => {
              const p = projectToSvg(lat, -49);
              return (
                <G key={`lat-${lat}`}>
                  <Line
                    x1="12"
                    y1={p.y}
                    x2="314"
                    y2={p.y}
                    stroke={isHighContrastDark ? '#1E2D45' : '#C3DCEB'}
                    strokeWidth={0.8}
                    strokeDasharray="3,4"
                  />
                  <SvgText
                    x="14"
                    y={p.y - 3}
                    fill={theme.textMuted}
                    fontSize="7"
                    opacity={0.7}
                  >
                    {Math.abs(lat)}°S
                  </SvgText>
                </G>
              );
            })}

            {[-45, -40, -35].map((lon) => {
              const p = projectToSvg(-18, lon);
              return (
                <Line
                  key={`lon-${lon}`}
                  x1={p.x}
                  y1="14"
                  x2={p.x}
                  y2="312"
                  stroke={isHighContrastDark ? '#1E2D45' : '#C3DCEB'}
                  strokeWidth={0.8}
                  strokeDasharray="3,4"
                />
              );
            })}

            <SvgText
              x="252"
              y="84"
              fill={isHighContrastDark ? '#6EA3CE' : '#4C86A8'}
              fontSize="7.5"
              fontWeight="800"
              letterSpacing={1}
              opacity={0.85}
            >
              OCEANO
            </SvgText>
            <SvgText
              x="248"
              y="94"
              fill={isHighContrastDark ? '#6EA3CE' : '#4C86A8'}
              fontSize="7.5"
              fontWeight="800"
              letterSpacing={1}
              opacity={0.85}
            >
              ATLÂNTICO
            </SvgText>

            <G transform="translate(292, 30)">
              <Circle r="14" fill={theme.surface} stroke={theme.border} strokeWidth={1.2} />
              <SvgText
                x="0"
                y="-3"
                fill={theme.primary}
                fontSize="8"
                fontWeight="900"
                textAnchor="middle"
              >
                N
              </SvgText>
              <Line x1="0" y1="0" x2="0" y2="8" stroke={theme.textMuted} strokeWidth={1.5} />
              <Line x1="-4" y1="3" x2="4" y2="3" stroke={theme.textMuted} strokeWidth={1} />
            </G>

            <SvgText x="16" y="22" fill={theme.text} fontSize="9.5" fontWeight="900">
              MALHA OFICIAL IBGE • NORDESTE
            </SvgText>

            {ibgePaths.map((st) => {
              const labelCoord = UF_LABEL_POSITIONS[st.uf] ?? [-10, -40];
              const labelPos = projectToSvg(labelCoord[0], labelCoord[1]);
              const hasSelected = selectedRegion?.estado === st.uf;
              return (
                <G key={st.uf}>
                  <Path
                    d={st.pathD}
                    fill={stateFill(st.uf, hasSelected)}
                    stroke={
                      hasSelected ? theme.primary : isHighContrastDark ? '#4B6386' : '#6F9478'
                    }
                    strokeWidth={hasSelected ? 2 : 1.15}
                    strokeLinejoin="round"
                  />
                  <SvgText
                    x={labelPos.x}
                    y={labelPos.y}
                    fill={hasSelected ? theme.primary : theme.textMuted}
                    fontSize={st.uf === 'BA' ? '12' : '8.5'}
                    fontWeight="900"
                    opacity={hasSelected ? 0.9 : 0.72}
                    textAnchor="middle"
                  >
                    {st.uf}
                  </SvgText>
                </G>
              );
            })}

            <Polyline
              points={buildPolylinePoints(SAO_FRANCISCO_RIVER)}
              fill="none"
              stroke={isHighContrastDark ? '#4DA8DA' : '#3C8DBC'}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.75}
            />

            {gpsUserCoords && (
              <G>
                <Circle
                  cx={projectToSvg(gpsUserCoords.latitude, gpsUserCoords.longitude).x}
                  cy={projectToSvg(gpsUserCoords.latitude, gpsUserCoords.longitude).y}
                  r={10}
                  fill="#0EA5E9"
                  opacity={0.25}
                />
                <Circle
                  cx={projectToSvg(gpsUserCoords.latitude, gpsUserCoords.longitude).x}
                  cy={projectToSvg(gpsUserCoords.latitude, gpsUserCoords.longitude).y}
                  r={4.2}
                  fill="#0284C7"
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                />
              </G>
            )}

            {[...NORDESTE_REGIONS]
              .sort((a, b) => {
                const aSel = a.nome === selectedRegionName ? 1 : 0;
                const bSel = b.nome === selectedRegionName ? 1 : 0;
                return aSel - bSel;
              })
              .map((reg) => {
                const { x, y } = projectToSvg(reg.centroid.latitude, reg.centroid.longitude);
                const isSelected = selectedRegionName === reg.nome;
                const isGpsDetected = gpsDetectedRegionId === reg.id;
                const offset = PIN_OFFSETS[reg.id] ?? {
                  dx: 0,
                  dy: -14,
                  shortLabel: reg.municipio,
                };
                const lx = Math.min(276, Math.max(46, x + offset.dx));
                const ly = Math.min(308, Math.max(30, y + offset.dy));
                const pillW = offset.shortLabel.length * 5.2 + 12;

                return (
                  <G key={reg.id} onPress={() => onSelectRegion(reg)}>
                    {isGpsDetected && (
                      <Circle
                        cx={x}
                        cy={y}
                        r={16}
                        fill="none"
                        stroke="#1D6FA5"
                        strokeWidth={1.8}
                        strokeDasharray="3,2"
                      />
                    )}
                    {isSelected && (
                      <Circle cx={x} cy={y} r={13} fill={theme.primary} opacity={0.28} />
                    )}
                    {isSelected && (
                      <Line x1={x} y1={y} x2={lx} y2={ly} stroke={theme.primary} strokeWidth={1.8} />
                    )}
                    <Circle cx={x} cy={y} r={14} fill="transparent" />
                    <Circle
                      cx={x}
                      cy={y}
                      r={isSelected ? 6.8 : 4.2}
                      fill={
                        isSelected ? theme.primary : isGpsDetected ? '#1D6FA5' : theme.accent
                      }
                      stroke="#FFFFFF"
                      strokeWidth={isSelected ? 2 : 1.4}
                    />
                    {(isSelected || isGpsDetected) && (
                      <G>
                        <Rect
                          x={lx - pillW / 2}
                          y={ly - 9}
                          width={pillW}
                          height={16}
                          rx={8}
                          fill={isSelected ? theme.primary : '#1D6FA5'}
                          stroke="#FFFFFF"
                          strokeWidth={1.2}
                        />
                        <SvgText
                          x={lx}
                          y={ly + 2}
                          fill="#FFFFFF"
                          fontSize="8.2"
                          fontWeight="800"
                          textAnchor="middle"
                        >
                          {offset.shortLabel}
                        </SvgText>
                      </G>
                    )}
                  </G>
                );
              })}
          </Svg>
        </View>
      )}

      <Text style={[styles.hintLabel, { color: theme.textMuted }]}>
        Toque no mapa ou escolha seu polo regional abaixo:
      </Text>

      <View style={styles.regionChipsBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={en ? 'Scroll regions left' : 'Rolar regiões para a esquerda'}
          onPress={() => scrollChipsBy(-220)}
          style={[
            styles.scrollArrowBtn,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Ionicons name="chevron-back" size={16} color={theme.text} />
        </Pressable>

        <ScrollView
          ref={chipsScrollRef}
          horizontal
          style={styles.regionChipsScroller}
          showsHorizontalScrollIndicator={Platform.OS === 'web'}
          scrollEventThrottle={16}
          onScroll={(e) => {
            chipsScrollXRef.current = e.nativeEvent.contentOffset.x;
          }}
          contentContainerStyle={styles.regionChipsScroll}
        >
          {NORDESTE_REGIONS.map((reg) => {
            const active = selectedRegionName === reg.nome;
            const isGps = gpsDetectedRegionId === reg.id;
            return (
              <Pressable
                key={reg.id}
                onPress={() => onSelectRegion(reg)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme.primary : theme.surface,
                    borderColor: active ? theme.primary : isGps ? '#1D6FA5' : theme.border,
                  },
                ]}
              >
                <Ionicons
                  name={isGps ? 'navigate' : active ? 'location' : 'location-outline'}
                  size={14}
                  color={active ? theme.primaryText : isGps ? '#1D6FA5' : theme.primary}
                />
                <Text
                  style={[styles.chipText, { color: active ? theme.primaryText : theme.text }]}
                >
                  {reg.estado} • {reg.nome}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={en ? 'Scroll regions right' : 'Rolar regiões para a direita'}
          onPress={() => scrollChipsBy(220)}
          style={[
            styles.scrollArrowBtn,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Ionicons name="chevron-forward" size={16} color={theme.text} />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    maxWidth: '100%',
    alignItems: 'center',
    gap: 8,
  },
  modeSwitchRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  modePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  svgBox: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  hintLabel: {
    fontSize: 11,
    fontWeight: '700',
    alignSelf: 'flex-start',
  },
  regionChipsBar: {
    width: '100%',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  regionChipsScroller: {
    flex: 1,
    minWidth: 0,
    width: '100%',
  },
  regionChipsScroll: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    gap: 8,
    alignItems: 'center',
  },
  scrollArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    flexShrink: 0,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
