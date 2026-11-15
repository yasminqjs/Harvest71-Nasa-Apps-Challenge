import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { BahiaRegionPreset, NORDESTE_REGIONS } from '../data/seedData';
import { AppTheme } from '../theme/tokens';

interface NordesteSvgMapProps {
  selectedRegionName: string;
  onSelectRegion: (region: BahiaRegionPreset) => void;
  theme: AppTheme;
}

type LatLon = [number, number];

function projectToSvg(lat: number, lon: number): { x: number; y: number } {
  const minLon = -48.9;
  const maxLon = -34.1;
  const maxLat = -0.6;
  const minLat = -18.7;

  const x = ((lon - minLon) / (maxLon - minLon)) * 270 + 20;
  const y = ((maxLat - lat) / (maxLat - minLat)) * 276 + 18;
  return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
}

function buildPolygonPath(coords: LatLon[]): string {
  return (
    coords
      .map(([lat, lon], idx) => {
        const { x, y } = projectToSvg(lat, lon);
        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ') + ' Z'
  );
}

const STATE_SHAPES: {
  uf: string;
  labelCoord: LatLon;
  isFocus?: boolean;
  coords: LatLon[];
}[] = [
  {
    uf: 'MA',
    labelCoord: [-4.9, -45.3],
    coords: [
      [-1.15, -45.8],
      [-1.1, -44.5],
      [-2.35, -43.2],
      [-2.75, -41.8],
      [-3.9, -41.7],
      [-5.3, -42.8],
      [-6.8, -43.8],
      [-7.6, -45.3],
      [-9.8, -46.0],
      [-7.5, -47.4],
      [-5.3, -48.6],
      [-3.5, -46.8],
      [-1.9, -46.2],
    ],
  },
  {
    uf: 'PI',
    labelCoord: [-6.8, -42.7],
    coords: [
      [-2.75, -41.8],
      [-2.9, -41.2],
      [-4.2, -41.0],
      [-6.2, -40.7],
      [-7.5, -40.7],
      [-9.4, -42.2],
      [-10.8, -45.0],
      [-9.8, -46.0],
      [-7.6, -45.3],
      [-6.8, -43.8],
      [-5.3, -42.8],
      [-3.9, -41.7],
    ],
  },
  {
    uf: 'CE',
    labelCoord: [-5.1, -39.4],
    coords: [
      [-2.9, -41.2],
      [-2.8, -40.0],
      [-3.7, -38.5],
      [-4.8, -37.2],
      [-6.3, -38.5],
      [-7.5, -39.1],
      [-7.6, -40.4],
      [-7.5, -40.7],
      [-6.2, -40.7],
      [-4.2, -41.0],
    ],
  },
  {
    uf: 'RN',
    labelCoord: [-5.75, -36.5],
    coords: [
      [-4.8, -37.2],
      [-5.1, -35.6],
      [-5.8, -35.15],
      [-6.45, -35.0],
      [-6.55, -36.5],
      [-6.3, -38.5],
    ],
  },
  {
    uf: 'PB',
    labelCoord: [-7.1, -36.6],
    coords: [
      [-6.3, -38.5],
      [-6.55, -36.5],
      [-6.45, -35.0],
      [-7.15, -34.78],
      [-7.55, -34.82],
      [-7.75, -36.9],
      [-7.75, -38.5],
    ],
  },
  {
    uf: 'PE',
    labelCoord: [-8.35, -38.0],
    coords: [
      [-7.55, -34.82],
      [-8.05, -34.85],
      [-8.92, -35.15],
      [-9.3, -36.6],
      [-9.4, -38.2],
      [-9.4, -40.5],
      [-8.5, -40.9],
      [-7.5, -40.7],
      [-7.6, -40.4],
      [-7.75, -38.5],
      [-7.75, -36.9],
    ],
  },
  {
    uf: 'AL',
    labelCoord: [-9.55, -36.6],
    coords: [
      [-8.92, -35.15],
      [-9.66, -35.73],
      [-10.48, -36.38],
      [-9.6, -37.9],
      [-9.4, -38.2],
      [-9.3, -36.6],
    ],
  },
  {
    uf: 'SE',
    labelCoord: [-10.75, -37.45],
    coords: [
      [-10.48, -36.38],
      [-10.92, -37.05],
      [-11.48, -37.4],
      [-11.38, -38.1],
      [-10.2, -38.1],
      [-9.6, -37.9],
    ],
  },
  {
    uf: 'BA',
    labelCoord: [-13.2, -42.3],
    isFocus: true,
    coords: [
      [-9.4, -40.5],
      [-9.4, -38.2],
      [-9.6, -37.9],
      [-10.2, -38.1],
      [-11.38, -38.1],
      [-11.48, -37.4],
      [-12.6, -38.0],
      [-12.97, -38.5],
      [-13.85, -38.9],
      [-14.8, -39.02],
      [-16.4, -39.05],
      [-18.3, -39.65],
      [-17.8, -40.5],
      [-16.3, -41.4],
      [-15.3, -42.8],
      [-14.9, -44.2],
      [-14.5, -46.1],
      [-12.2, -46.45],
      [-10.8, -45.0],
      [-9.4, -42.2],
    ],
  },
];

// Deslocamento estratégico dos rótulos das regiões para evitar sobreposição entre Recôncavo e Feira
const PIN_OFFSETS: Record<string, { dx: number; dy: number; shortLabel: string }> = {
  'reconcavo-ba': { dx: 24, dy: 18, shortLabel: 'Recôncavo' },
  'semiarido-feira-ba': { dx: 22, dy: -16, shortLabel: 'Feira / Sertão' },
  'irece-ba': { dx: -16, dy: -18, shortLabel: 'Irecê' },
  'juazeiro-ba': { dx: 18, dy: -16, shortLabel: 'Juazeiro' },
  'conquista-ba': { dx: -12, dy: 20, shortLabel: 'V. Conquista' },
  'barreiras-ba': { dx: -18, dy: -18, shortLabel: 'Barreiras' },
};

export const NordesteSvgMap: React.FC<NordesteSvgMapProps> = ({
  selectedRegionName,
  onSelectRegion,
  theme,
}) => {
  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.svgBox,
          { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
        ]}
      >
        <Svg width="100%" height={286} viewBox="0 0 320 310">
          {/* Oceano Atlântico sutil */}
          <Rect
            x="0"
            y="0"
            width="320"
            height="310"
            rx="16"
            fill={theme.bg}
            opacity={0.7}
          />

          {/* Rosa dos ventos discreta */}
          <G transform="translate(284, 30)">
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
          </G>

          {/* Legenda superior do mapa */}
          <SvgText
            x="16"
            y="26"
            fill={theme.textMuted}
            fontSize="10"
            fontWeight="800"
          >
            NORDESTE • BAHIA
          </SvgText>

          {/* Estados do Nordeste */}
          {STATE_SHAPES.map((st) => {
            const labelPos = projectToSvg(st.labelCoord[0], st.labelCoord[1]);
            return (
              <G key={st.uf}>
                <Path
                  d={buildPolygonPath(st.coords)}
                  fill={st.isFocus ? theme.successBg : theme.surface}
                  stroke={st.isFocus ? theme.primary : theme.border}
                  strokeWidth={st.isFocus ? 2.4 : 1.2}
                  strokeLinejoin="round"
                />
                <SvgText
                  x={labelPos.x}
                  y={labelPos.y}
                  fill={st.isFocus ? theme.primary : theme.textMuted}
                  fontSize={st.isFocus ? '12' : '9'}
                  fontWeight="900"
                  opacity={st.isFocus ? 0.55 : 0.7}
                  textAnchor="middle"
                >
                  {st.uf}
                </SvgText>
              </G>
            );
          })}

          {/* Pinos das microrregiões da Bahia com rótulos sem sobreposição */}
          {NORDESTE_REGIONS.map((reg) => {
            const { x, y } = projectToSvg(reg.centroid.latitude, reg.centroid.longitude);
            const isSelected = selectedRegionName === reg.nome;
            const offset = PIN_OFFSETS[reg.id] ?? {
              dx: 0,
              dy: -16,
              shortLabel: reg.municipio,
            };
            const lx = Math.min(266, Math.max(46, x + offset.dx));
            const ly = Math.min(294, Math.max(24, y + offset.dy));
            const pillW = offset.shortLabel.length * 5.6 + 14;

            return (
              <G key={reg.id} onPress={() => onSelectRegion(reg)}>
                <Line
                  x1={x}
                  y1={y}
                  x2={lx}
                  y2={ly}
                  stroke={isSelected ? theme.primary : theme.textMuted}
                  strokeWidth={isSelected ? 1.8 : 1}
                  strokeDasharray={isSelected ? undefined : '2,2'}
                />

                {isSelected && (
                  <Circle
                    cx={x}
                    cy={y}
                    r={14}
                    fill={theme.primary}
                    opacity={0.25}
                  />
                )}

                {/* Alvo de toque ampliado */}
                <Circle cx={x} cy={y} r={16} fill="transparent" />

                <Circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 7 : 5}
                  fill={isSelected ? theme.primary : theme.accent}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />

                {/* Pílula do nome da região */}
                <Rect
                  x={lx - pillW / 2}
                  y={ly - 9}
                  width={pillW}
                  height={16}
                  rx={8}
                  fill={isSelected ? theme.primary : theme.surface}
                  stroke={isSelected ? theme.primary : theme.border}
                  strokeWidth={isSelected ? 1.5 : 1}
                />
                <SvgText
                  x={lx}
                  y={ly + 2}
                  fill={isSelected ? theme.primaryText : theme.text}
                  fontSize="8.5"
                  fontWeight="800"
                  textAnchor="middle"
                >
                  {offset.shortLabel}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>

      <View style={styles.regionChips}>
        {NORDESTE_REGIONS.map((reg) => {
          const active = selectedRegionName === reg.nome;
          return (
            <Pressable
              key={reg.id}
              onPress={() => onSelectRegion(reg)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? theme.primary : theme.surface,
                  borderColor: active ? theme.primary : theme.border,
                },
              ]}
            >
              <Ionicons
                name={active ? 'location' : 'location-outline'}
                size={14}
                color={active ? theme.primaryText : theme.primary}
              />
              <Text
                style={[
                  styles.chipText,
                  { color: active ? theme.primaryText : theme.text },
                ]}
              >
                {reg.nome}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
    gap: 10,
  },
  svgBox: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  regionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
