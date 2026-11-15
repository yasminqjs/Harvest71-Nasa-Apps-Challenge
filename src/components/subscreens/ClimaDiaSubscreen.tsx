import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Pressable, Text } from '../../i18n/native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { SvgText } from '../../i18n/svg';
import { AppTheme } from '../../theme/tokens';
import { FarmProperty } from '../../types/domain';
import { buildSevenDayClimateSeries } from '../../utils/agronomyHelpers';

interface ClimaDiaSubscreenProps {
  farm: FarmProperty;
  onBack: () => void;
  onSpeak: (text: string) => void;
  theme: AppTheme;
}

export const ClimaDiaSubscreen: React.FC<ClimaDiaSubscreenProps> = ({
  farm,
  onBack,
  onSpeak,
  theme,
}) => {
  const diag = farm.diagnostico;
  const series = buildSevenDayClimateSeries(diag);

  // Dimensões do gráfico SVG com os 3 aspectos (chuva, umidade, calor)
  const w = 310;
  const h = 170;
  const padL = 28;
  const padR = 14;
  const padT = 18;
  const padB = 26;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const maxRain = Math.max(30, ...series.map((s) => s.chuvaMm));
  const stepX = plotW / Math.max(1, series.length - 1);

  const buildPath = (getVal: (idx: number) => number, maxVal: number, minVal = 0) =>
    series
      .map((_, idx) => {
        const x = padL + idx * stepX;
        const norm = Math.max(0, Math.min(1, (getVal(idx) - minVal) / (maxVal - minVal || 1)));
        const y = padT + plotH - norm * plotH;
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');

  const humidityPath = buildPath((i) => series[i].umidadePct, 100, 0);
  const heatPath = buildPath((i) => series[i].calorC, 46, 15);

  const speakSummary = () => {
    onSpeak(
      `Clima do dia em ${farm.regiaoNome}: previsão de chuva de ${diag.climaDia.chuvaHojeMm} milímetros, umidade em ${diag.climaDia.umidadeRelativaPct}% e calor máximo de ${diag.climaDia.tempMaxC} graus.`
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Pressable
          onPress={onBack}
          style={[styles.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Ionicons name="arrow-back" size={18} color={theme.text} />
          <Text style={[styles.backText, { color: theme.text }]}>Voltar</Text>
        </Pressable>
        <Text style={[styles.screenTitle, { color: theme.text, fontSize: 18 * theme.scale }]}>
          Clima do dia
        </Text>
        <Pressable
          onPress={speakSummary}
          style={[styles.voiceBtn, { backgroundColor: theme.surfaceMuted }]}
        >
          <Ionicons name="volume-high" size={18} color={theme.primary} />
        </Pressable>
      </View>

      <Text style={[styles.regionSub, { color: theme.textMuted }]}>
        {farm.regiaoNome} • {farm.municipio} - {farm.estado} ({diag.climaDia.condicao})
      </Text>

      {/* 3 blocos principais do diagrama: previsão de chuva, umidade, calor */}
      <View style={styles.metricGrid}>
        <View
          style={[
            styles.metricCard,
            { backgroundColor: theme.surface, borderColor: '#2563EB' },
          ]}
        >
          <Ionicons name="rainy-outline" size={24} color="#2563EB" />
          <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Previsão de chuva</Text>
          <Text style={[styles.metricValue, { color: '#2563EB' }]}>
            {diag.climaDia.chuvaHojeMm} mm
          </Text>
          <Text style={[styles.metricHint, { color: theme.textMuted }]}>
            IMERG: {diag.modeloA.chuvaImergMm} mm
          </Text>
        </View>

        <View
          style={[
            styles.metricCard,
            { backgroundColor: theme.surface, borderColor: '#0D9488' },
          ]}
        >
          <Ionicons name="water-outline" size={24} color="#0D9488" />
          <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Umidade</Text>
          <Text style={[styles.metricValue, { color: '#0D9488' }]}>
            {diag.climaDia.umidadeRelativaPct}%
          </Text>
          <Text style={[styles.metricHint, { color: theme.textMuted }]}>
            Solo SMAP: {diag.modeloA.smapTendencia}
          </Text>
        </View>

        <View
          style={[
            styles.metricCard,
            { backgroundColor: theme.surface, borderColor: '#D97706' },
          ]}
        >
          <Ionicons name="sunny-outline" size={24} color="#D97706" />
          <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Calor</Text>
          <Text style={[styles.metricValue, { color: '#D97706' }]}>
            {diag.climaDia.tempMaxC}°C
          </Text>
          <Text style={[styles.metricHint, { color: theme.textMuted }]}>
            Mín: {diag.climaDia.tempMinC}°C • ET₀ {diag.modeloA.et0PowerMm} mm
          </Text>
        </View>
      </View>

      {/* Gráfico com os três aspectos */}
      <View
        style={[
          styles.chartCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.chartTitle, { color: theme.text }]}>
          Gráfico de 7 dias: Chuva, Umidade e Calor
        </Text>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#60A5FA' }]} />
            <Text style={[styles.legendText, { color: theme.textMuted }]}>Chuva (mm)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#0D9488' }]} />
            <Text style={[styles.legendText, { color: theme.textMuted }]}>Umidade (%)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#EA580C' }]} />
            <Text style={[styles.legendText, { color: theme.textMuted }]}>Calor (°C)</Text>
          </View>
        </View>

        <Svg width="100%" height={180} viewBox={`0 0 ${w} ${h}`}>
          {/* Linhas de grade horizontais */}
          {[0.25, 0.5, 0.75, 1].map((frac) => {
            const y = padT + plotH - frac * plotH;
            return (
              <Line
                key={frac}
                x1={padL}
                y1={y}
                x2={w - padR}
                y2={y}
                stroke="#E5E7EB"
                strokeWidth={1}
                strokeDasharray="3,3"
              />
            );
          })}

          {/* Barras de Chuva (mm) */}
          {series.map((item, idx) => {
            const barW = 14;
            const x = padL + idx * stepX - barW / 2;
            const barH = Math.max(2, (item.chuvaMm / maxRain) * plotH);
            const y = padT + plotH - barH;
            return (
              <Rect
                key={`rain-${item.dia}`}
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={4}
                fill="rgba(59, 130, 246, 0.35)"
              />
            );
          })}

          {/* Linha de Umidade (%) */}
          <Path d={humidityPath} stroke="#0D9488" strokeWidth={2.5} fill="none" />
          {/* Linha de Calor (°C) */}
          <Path d={heatPath} stroke="#EA580C" strokeWidth={2.5} fill="none" />

          {/* Pontos e rótulos do eixo X */}
          {series.map((item, idx) => {
            const x = padL + idx * stepX;
            const yHum = padT + plotH - (item.umidadePct / 100) * plotH;
            const yHeat =
              padT + plotH - Math.max(0, Math.min(1, (item.calorC - 15) / 31)) * plotH;
            return (
              <React.Fragment key={`pts-${item.dia}`}>
                <Circle cx={x} cy={yHum} r={3.5} fill="#0D9488" />
                <Circle cx={x} cy={yHeat} r={3.5} fill="#EA580C" />
                <SvgText
                  x={x}
                  y={h - 6}
                  fontSize="9"
                  fontWeight="700"
                  fill="#6B7280"
                  textAnchor="middle"
                >
                  {item.dia}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>

        <Text style={[styles.modelNote, { color: theme.text }]}>
          {diag.modeloA.status === 'deficit_confirmado'
            ? '⚠️ A terra está perdendo mais água do que recebe (GPM IMERG x POWER ET₀). Cubra as entrelinhas com palha.'
            : '✓ Balanço hídrico positivo no solo esta semana. Aproveite a umidade.'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  backText: { fontSize: 13, fontWeight: '800' },
  screenTitle: { flex: 1, textAlign: 'center', fontWeight: '900' },
  voiceBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  regionSub: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  metricGrid: { flexDirection: 'row', gap: 8 },
  metricCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    padding: 10,
    alignItems: 'center',
    gap: 3,
  },
  metricLabel: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  metricValue: { fontSize: 18, fontWeight: '900' },
  metricHint: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  chartCard: {
    borderRadius: 18,
    borderWidth: 2,
    padding: 14,
    gap: 8,
  },
  chartTitle: { fontSize: 14, fontWeight: '900' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, fontWeight: '700' },
  modelNote: { fontSize: 12, fontWeight: '700', lineHeight: 17 },
});
