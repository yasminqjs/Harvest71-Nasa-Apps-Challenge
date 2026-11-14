import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { BahiaRegionPreset, NORDESTE_REGIONS } from '../data/seedData';
import { AppTheme } from '../theme/tokens';

interface NordesteSvgMapProps {
  selectedRegionName: string;
  onSelectRegion: (region: BahiaRegionPreset) => void;
  theme: AppTheme;
}

function projectToSvg(lat: number, lon: number): { x: number; y: number } {
  const minLon = -48.5;
  const maxLon = -34.5;
  const maxLat = -1.0;
  const minLat = -18.5;

  const x = ((lon - minLon) / (maxLon - minLon)) * 260 + 20;
  const y = ((maxLat - lat) / (maxLat - minLat)) * 280 + 20;
  return { x, y };
}

export const NordesteSvgMap: React.FC<NordesteSvgMapProps> = ({
  selectedRegionName,
  onSelectRegion,
  theme,
}) => {
  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={270} viewBox="0 0 300 320">
        <Path
          d="M 65 42 L 128 32 L 195 52 L 265 88 L 278 118 L 270 154 L 245 178 L 222 198 L 204 242 L 188 286 L 165 292 L 154 250 L 120 238 L 94 218 L 72 178 L 48 164 L 40 116 L 56 76 Z"
          fill={theme.surfaceMuted}
          stroke={theme.border}
          strokeWidth={3.5}
          strokeLinejoin="round"
        />
        <Path
          d="M 94 176 L 165 156 L 224 166 L 222 198 L 204 242 L 188 286 L 165 292 L 154 250 L 120 238 L 94 218 Z"
          fill={theme.successBg}
          stroke={theme.primary}
          strokeWidth={2}
          strokeDasharray="5,3"
        />

        <SvgText
          x="138"
          y="134"
          fill={theme.text}
          fontSize="24"
          fontWeight="900"
          letterSpacing="3"
          textAnchor="middle"
          transform="rotate(24, 138, 134)"
        >
          NORDESTE
        </SvgText>

        {NORDESTE_REGIONS.map((reg) => {
          const { x, y } = projectToSvg(reg.centroid.latitude, reg.centroid.longitude);
          const isSelected = selectedRegionName === reg.nome;
          return (
            <G key={reg.id} onPress={() => onSelectRegion(reg)}>
              {isSelected && (
                <Circle cx={x} cy={y} r={14} fill={theme.primary} opacity={0.25} />
              )}
              <Circle
                cx={x}
                cy={y}
                r={isSelected ? 7.5 : 5.5}
                fill={isSelected ? theme.primary : theme.accent}
                stroke="#FFFFFF"
                strokeWidth={2}
              />
            </G>
          );
        })}
      </Svg>

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
  },
  regionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
