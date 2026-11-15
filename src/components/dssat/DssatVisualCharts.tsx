import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLanguage, type Language } from '../../i18n/Language';
import { Text } from '../../i18n/native';
import type { AppTheme } from '../../theme/tokens';
import type {
  ProjectionEnsembleRow,
  ProjectionModel,
  RotationCompareAlternative,
  RotationOption,
  ScenarioSummary,
  SoilLayer,
} from '../../types/dssat';
import { ExpandableDetails } from './DssatShared';

function tr(language: Language, en: string, pt: string): string {
  return language === 'en' ? en : pt;
}

function fmtNum(v: number | null | undefined, language: Language): string {
  if (v === null || v === undefined || !Number.isFinite(v)) {
    return tr(language, 'no data', 'sem dado');
  }
  return Math.round(v).toLocaleString(language === 'en' ? 'en-US' : 'pt-BR');
}

function fmtPctSafe(fraction: number | null | undefined, language: Language): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) {
    return tr(language, 'no data', 'sem dado');
  }
  return `${Math.round(fraction * 100)}%`;
}

export interface FriendlyScenarioInfo {
  id: string;
  shortTitle: string;
  title: string;
  badge: string;
  description: string;
  technicalCode: string;
  accentColor: string;
  bgTint: string;
  icon: keyof typeof Ionicons.glyphMap;
}

/**
 * Translates raw IPCC scenario identifiers (ssp245 / ssp585) into plain,
 * farmer-friendly titles and descriptions while keeping technical codes subtle.
 */
export function getFriendlyClimateScenario(
  id: string | undefined,
  rawLabel: string | undefined,
  language: Language
): FriendlyScenarioInfo {
  const key = (id ?? '').toLowerCase().trim();
  if (key === 'ssp126') {
    return {
      id: 'ssp126',
      shortTitle: tr(language, 'Mild future', 'Futuro leve'),
      title: tr(language, 'Mild Future (Best Case)', 'Futuro Leve (Melhor Cenário)'),
      badge: tr(language, 'Low warming', 'Baixo aquecimento'),
      description: tr(
        language,
        'Small shifts in heat and rainfall.',
        'Pouco aumento de calor e mudanças leves na chuva.'
      ),
      technicalCode: 'NASA / IPCC SSP1-2.6',
      accentColor: '#047857',
      bgTint: '#ECFDF5',
      icon: 'leaf-outline',
    };
  }
  if (key === 'ssp245') {
    return {
      id: 'ssp245',
      shortTitle: tr(language, 'Moderate', 'Moderado'),
      title: tr(language, 'Moderate Future (Likely Trend)', 'Futuro Moderado (Tendência Média)'),
      badge: tr(language, 'Middle path', 'Tendência média'),
      description: tr(
        language,
        'Warmer days and moderate rainfall changes if current trends hold.',
        'Mais calor e mudança moderada na chuva seguindo o ritmo atual.'
      ),
      technicalCode: 'NASA / IPCC SSP2-4.5',
      accentColor: '#B45309',
      bgTint: '#FFFBEB',
      icon: 'partly-sunny-outline',
    };
  }
  if (key === 'ssp370') {
    return {
      id: 'ssp370',
      shortTitle: tr(language, 'Hotter', 'Mais quente'),
      title: tr(language, 'Hotter Future (High Risk)', 'Futuro Mais Quente (Risco Alto)'),
      badge: tr(language, 'High heat', 'Calor alto'),
      description: tr(
        language,
        'Stronger heat waves and tougher dry spells.',
        'Ondas de calor mais fortes e veranicos puxados.'
      ),
      technicalCode: 'NASA / IPCC SSP3-7.0',
      accentColor: '#C2410C',
      bgTint: '#FFF7ED',
      icon: 'flame-outline',
    };
  }
  if (key === 'ssp585') {
    return {
      id: 'ssp585',
      shortTitle: tr(language, 'Extreme test', 'Teste extremo'),
      title: tr(language, 'Extreme Stress Test (Worst Case)', 'Teste Extremo (Pior Cenário)'),
      badge: tr(language, 'Max stress', 'Estresse máximo'),
      description: tr(
        language,
        'Tests crop limits under severe heat and intense drought.',
        'Testa se a cultura aguenta calor extremo e seca severa.'
      ),
      technicalCode: 'NASA / IPCC SSP5-8.5',
      accentColor: '#B91C1C',
      bgTint: '#FEF2F2',
      icon: 'thermometer-outline',
    };
  }
  return {
    id: id || 'custom',
    shortTitle: rawLabel || id || tr(language, 'Future', 'Futuro'),
    title: rawLabel || id || tr(language, 'Future scenario', 'Cenário futuro'),
    badge: tr(language, 'Projection', 'Projeção'),
    description: tr(
      language,
      'NASA future climate projection vs. recent historical weather.',
      'Projeção climática futura da NASA vs. clima recente.'
    ),
    technicalCode: (id ?? '').toUpperCase() || 'CMIP6',
    accentColor: '#1D4ED8',
    bgTint: '#EFF6FF',
    icon: 'analytics-outline',
  };
}

// ---------------------------------------------------------------------------
// 1. Flat Lean Plot Soil Profile (KPI strip + Compact gauges + Expandable depth)
// ---------------------------------------------------------------------------

export const PlotSoilVisual: React.FC<{
  theme: AppTheme;
  soil: {
    texture: string;
    waterMm1m: number;
    ph: number | null;
    organicCarbonPct: number | null;
    clayPct: number | null;
    depthCm: number;
    measured: boolean;
  };
  layers?: SoilLayer[];
  sourceLabel?: string;
  warnings?: string[];
}> = ({ theme, soil, layers = [], sourceLabel, warnings = [] }) => {
  const { language } = useLanguage();

  const waterMax = 200;
  const waterPct = Math.max(4, Math.min(100, (soil.waterMm1m / waterMax) * 100));
  const waterTone =
    soil.waterMm1m < 80
      ? { color: '#DC2626', label: tr(language, 'Low — dries fast', 'Baixa — seca rápido') }
      : soil.waterMm1m < 140
      ? { color: '#D97706', label: tr(language, 'Moderate', 'Média') }
      : { color: '#059669', label: tr(language, 'Good retention', 'Boa retenção') };

  const phMin = 4.0;
  const phMax = 8.5;
  const phPct =
    soil.ph !== null ? Math.max(2, Math.min(98, ((soil.ph - phMin) / (phMax - phMin)) * 100)) : null;
  const idealPhLeft = ((5.5 - phMin) / (phMax - phMin)) * 100;
  const idealPhWidth = ((7.0 - 5.5) / (phMax - phMin)) * 100;
  const phShort =
    soil.ph === null
      ? '–'
      : soil.ph < 5.5
      ? tr(language, 'Acidic', 'Ácido')
      : soil.ph <= 7.0
      ? tr(language, 'Ideal', 'Ideal')
      : tr(language, 'Alkaline', 'Alcalino');

  const firstLayer = layers[0];
  const topClay = firstLayer?.SLCL ?? soil.clayPct ?? 0;
  const topSilt = firstLayer?.SLSI ?? 0;
  const topSand = Math.max(0, Math.round((100 - topClay - topSilt) * 10) / 10);

  return (
    <View style={{ gap: 8 }}>
      {/* Single clean 3-column inline KPI bar — no inner cards */}
      <View style={[styles.kpiStrip, { borderColor: theme.border }]}>
        <View style={styles.kpiCell}>
          <Text style={{ fontSize: 10.5, fontWeight: '700', color: theme.textMuted }}>
            {tr(language, 'Water (1 m)', 'Água (1 m)')}
          </Text>
          <Text style={{ fontSize: 14 * theme.scale, fontWeight: '900', color: waterTone.color }}>
            {soil.waterMm1m} mm
          </Text>
          <Text style={{ fontSize: 10, color: theme.textMuted }}>{waterTone.label}</Text>
        </View>

        <View style={[styles.kpiDivider, { backgroundColor: theme.border }]} />

        <View style={styles.kpiCell}>
          <Text style={{ fontSize: 10.5, fontWeight: '700', color: theme.textMuted }}>
            {tr(language, 'Topsoil pH', 'pH topo')}
          </Text>
          <Text style={{ fontSize: 14 * theme.scale, fontWeight: '900', color: theme.primary }}>
            {soil.ph !== null ? soil.ph.toFixed(1) : '–'}
          </Text>
          <Text style={{ fontSize: 10, color: theme.textMuted }}>{phShort}</Text>
        </View>

        <View style={[styles.kpiDivider, { backgroundColor: theme.border }]} />

        <View style={styles.kpiCell}>
          <Text style={{ fontSize: 10.5, fontWeight: '700', color: theme.textMuted }}>
            {tr(language, 'Texture', 'Textura')}
          </Text>
          <Text style={{ fontSize: 12.5 * theme.scale, fontWeight: '900', color: theme.text }} numberOfLines={1}>
            {soil.texture}
          </Text>
          <Text style={{ fontSize: 10, color: theme.textMuted }}>{soil.depthCm} cm</Text>
        </View>
      </View>

      {/* Compact inline water & pH visual gauges */}
      <View style={{ gap: 6 }}>
        <View style={styles.inlineGaugeRow}>
          <Text style={[styles.inlineGaugeLabel, { color: theme.textMuted }]}>
            {tr(language, 'Water reserve', 'Reserva água')}
          </Text>
          <View style={[styles.segmentedTrack, { backgroundColor: theme.surfaceMuted, flex: 1 }]}>
            <View style={{ flex: 80, backgroundColor: '#FCA5A5', opacity: 0.4 }} />
            <View style={{ flex: 60, backgroundColor: '#FCD34D', opacity: 0.4 }} />
            <View style={{ flex: 60, backgroundColor: '#6EE7B7', opacity: 0.4 }} />
            <View style={[styles.fillOverlay, { width: `${waterPct}%`, backgroundColor: waterTone.color }]} />
            <View
              style={[
                styles.needleMarker,
                { left: `${Math.min(97, waterPct)}%`, borderColor: '#FFFFFF', backgroundColor: waterTone.color },
              ]}
            />
          </View>
        </View>

        {phPct !== null && (
          <View style={styles.inlineGaugeRow}>
            <Text style={[styles.inlineGaugeLabel, { color: theme.textMuted }]}>
              {tr(language, 'Soil pH', 'pH do solo')}
            </Text>
            <View style={[styles.segmentedTrack, { backgroundColor: theme.surfaceMuted, flex: 1 }]}>
              <View
                style={{
                  position: 'absolute',
                  left: `${idealPhLeft}%`,
                  width: `${idealPhWidth}%`,
                  top: 0,
                  bottom: 0,
                  backgroundColor: '#10B981',
                  opacity: 0.35,
                }}
              />
              <View
                style={[
                  styles.needleMarker,
                  { left: `${phPct}%`, backgroundColor: theme.primary, borderColor: '#FFFFFF' },
                ]}
              />
            </View>
          </View>
        )}

        {(topClay > 0 || topSilt > 0) && (
          <View style={styles.inlineGaugeRow}>
            <Text style={[styles.inlineGaugeLabel, { color: theme.textMuted }]}>
              {tr(language, 'Composition', 'Composição')}
            </Text>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={styles.stackedCompositionBar}>
                {topClay > 0 && <View style={{ flex: topClay, backgroundColor: '#C2410C' }} />}
                {topSilt > 0 && <View style={{ flex: topSilt, backgroundColor: '#D97706' }} />}
                {topSand > 0 && <View style={{ flex: topSand, backgroundColor: '#FDE047' }} />}
              </View>
              <View style={styles.legendRow}>
                <LegendDot color="#C2410C" label={`${tr(language, 'Clay', 'Argila')} ${Math.round(topClay)}%`} textColor={theme.textMuted} />
                <LegendDot color="#D97706" label={`${tr(language, 'Silt', 'Silte')} ${Math.round(topSilt)}%`} textColor={theme.textMuted} />
                <LegendDot color="#CA8A04" label={`${tr(language, 'Sand', 'Areia')} ${Math.round(topSand)}%`} textColor={theme.textMuted} />
              </View>
            </View>
          </View>
        )}
      </View>

      {warnings.map((w, i) => (
        <Text key={i} style={{ color: theme.warningText, fontSize: 11.5 * theme.scale }}>
          ⚠ {w}
        </Text>
      ))}

      {/* Technical depth layers & metrics collapsed by default */}
      <ExpandableDetails
        theme={theme}
        label={tr(
          language,
          `Soil depth layers (${layers.length}) & source details`,
          `Camadas por profundidade (${layers.length}) e detalhes técnicos`
        )}
      >
        <Text style={{ fontSize: 11, color: theme.textMuted }}>
          {tr(language, 'Source:', 'Fonte:')} {sourceLabel ?? 'PronaSolos'}
          {soil.measured ? tr(language, ' (with local lab analysis)', ' (com análise local)') : ''} •{' '}
          {tr(language, 'Organic Carbon:', 'Carbono Orgânico:')}{' '}
          {soil.organicCarbonPct !== null ? `${soil.organicCarbonPct.toFixed(2)}%` : '–'}
        </Text>

        {layers.map((L, idx) => {
          const topDepth = idx === 0 ? 0 : layers[idx - 1].SLB;
          const clay = L.SLCL ?? 0;
          const silt = L.SLSI ?? 0;
          const sand = Math.max(0, 100 - clay - silt);
          const pawPct =
            L.SDUL !== undefined && L.SLLL !== undefined
              ? Math.max(0, Math.round((L.SDUL - L.SLLL) * 1000) / 10)
              : null;
          const pawBarWidth = pawPct !== null ? Math.max(6, Math.min(100, (pawPct / 22) * 100)) : 0;

          return (
            <View key={`${L.SLB}-${idx}`} style={[styles.horizonRow, { borderColor: theme.border }]}>
              <Text style={{ fontSize: 10.5, fontWeight: '900', color: theme.text, width: 46 }}>
                {topDepth}–{L.SLB}cm
              </Text>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={styles.horizonStackBar}>
                  {clay > 0 && <View style={{ flex: clay, backgroundColor: '#C2410C' }} />}
                  {silt > 0 && <View style={{ flex: silt, backgroundColor: '#D97706' }} />}
                  {sand > 0 && <View style={{ flex: sand, backgroundColor: '#FDE047' }} />}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={[styles.miniBarTrack, { backgroundColor: theme.surfaceMuted }]}>
                    <View style={{ width: `${pawBarWidth}%`, height: '100%', backgroundColor: '#0284C7', borderRadius: 3 }} />
                  </View>
                  <Text style={{ fontSize: 10, color: theme.textMuted }}>
                    {pawPct !== null ? `${pawPct}%` : '–'} {tr(language, 'water', 'água')} • pH{' '}
                    {L.SLHW !== undefined ? L.SLHW.toFixed(1) : '–'} • d={L.SBDM?.toFixed(2) ?? '–'}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </ExpandableDetails>
    </View>
  );
};

// ---------------------------------------------------------------------------
// 2. Yield Range & Water Comparison (Flat hairline-divided rows)
// ---------------------------------------------------------------------------

export const YieldRangeChart: React.FC<{
  theme: AppTheme;
  scenarios: ScenarioSummary[];
  bestTrno?: number;
}> = ({ theme, scenarios, bestTrno }) => {
  const { language } = useLanguage();
  const [expandedWindow, setExpandedWindow] = useState<number | null>(null);

  const maxYield = Math.max(
    1000,
    ...scenarios.flatMap((s) => [s.yield_kg_ha.p10 ?? 0, s.yield_kg_ha.p50 ?? 0, s.yield_kg_ha.p90 ?? 0])
  );
  const maxWater = Math.max(
    200,
    ...scenarios.map((s) => (s.rain_mm_p50 ?? 0) + (s.irrigation_mm_p50 ?? 0))
  );

  return (
    <View style={{ gap: 4 }}>
      <View style={styles.legendRow}>
        <LegendDot color="#94A3B8" label={tr(language, 'Range: poor (p10) to good year (p90)', 'Faixa: ano ruim a bom')} textColor={theme.textMuted} />
        <LegendDot color={theme.primary} label={tr(language, '● Typical (p50)', '● Típico (p50)')} textColor={theme.textMuted} />
      </View>

      {scenarios.map((s, idx) => {
        const isBest = bestTrno !== undefined && s.trno === bestTrno;
        const p10 = s.yield_kg_ha.p10 ?? 0;
        const p50 = s.yield_kg_ha.p50 ?? 0;
        const p90 = s.yield_kg_ha.p90 ?? 0;

        const leftPct = Math.max(0, Math.min(96, (p10 / maxYield) * 100));
        const widthPct = Math.max(4, Math.min(100 - leftPct, ((p90 - p10) / maxYield) * 100));
        const midPct = Math.max(2, Math.min(98, (p50 / maxYield) * 100));

        const failRisk = s.share_seasons_below_1000_kg_ha ?? null;
        const failPct = failRisk !== null ? Math.round(failRisk * 100) : null;
        const failColor =
          failPct === null ? theme.textMuted : failPct < 20 ? '#059669' : failPct < 45 ? '#D97706' : '#DC2626';

        const barColor = isBest ? theme.successText : s.irrigated ? '#0284C7' : theme.primary;
        const rainMm = s.rain_mm_p50 ?? 0;
        const irrigMm = s.irrigation_mm_p50 ?? 0;
        const rainPct = Math.min(100, (rainMm / maxWater) * 100);
        const irrigPct = Math.min(100 - rainPct, (irrigMm / maxWater) * 100);
        const isOpen = expandedWindow === s.trno;

        return (
          <View
            key={s.trno}
            style={[
              styles.flatListRow,
              idx < scenarios.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
              isBest && { borderLeftWidth: 3, borderLeftColor: theme.successText, paddingLeft: 8, backgroundColor: theme.successBg },
            ]}
          >
            <View style={styles.gaugeHeader}>
              <Text style={{ fontWeight: '900', color: theme.text, fontSize: 13 * theme.scale, flex: 1 }}>
                {s.name}
                {isBest ? tr(language, '  ★ Best', '  ★ Melhor') : ''}
                {s.irrigated ? '  💧' : ''}
              </Text>
              <Text style={{ fontSize: 12.5, fontWeight: '900', color: barColor }}>
                {fmtNum(s.yield_kg_ha.p50, language)} kg/ha
              </Text>
            </View>

            {/* Range whisker bar */}
            <View style={[styles.rangeTrack, { backgroundColor: theme.surfaceMuted }]}>
              <View
                style={[
                  styles.rangeSpan,
                  { left: `${leftPct}%`, width: `${widthPct}%`, backgroundColor: barColor, opacity: 0.28 },
                ]}
              />
              <View style={[styles.rangeTick, { left: `${leftPct}%`, backgroundColor: barColor }]} />
              <View
                style={[
                  styles.rangeTick,
                  { left: `${Math.min(99, leftPct + widthPct)}%`, backgroundColor: barColor },
                ]}
              />
              <View
                style={[
                  styles.rangeMedianDot,
                  { left: `${midPct}%`, backgroundColor: barColor, borderColor: '#FFFFFF' },
                ]}
              />
            </View>

            {/* Compact 1-line summary + technical expand button */}
            <View style={styles.axisLabels}>
              <Text style={{ fontSize: 11, color: theme.textMuted }}>
                {fmtNum(s.yield_kg_ha.p10, language)}–{fmtNum(s.yield_kg_ha.p90, language)} kg/ha •{' '}
                {s.maturity_dap_p50 ?? '–'}d •{' '}
                <Text style={{ color: failColor, fontWeight: '800' }}>
                  {tr(language, 'Risk:', 'Risco:')} {fmtPctSafe(failRisk, language)}
                </Text>
              </Text>
              <Text
                onPress={() => setExpandedWindow(isOpen ? null : s.trno)}
                style={{ fontSize: 11, fontWeight: '800', color: theme.primary }}
              >
                {isOpen ? tr(language, '− Less', '− Menos') : tr(language, '+ Details', '+ Detalhes')}
              </Text>
            </View>

            {isOpen && (
              <View style={{ gap: 4, paddingTop: 4 }}>
                <Text style={{ fontSize: 11, color: theme.textMuted }}>
                  {tr(language, 'Poor year (10%):', 'Ano ruim (10%):')} {fmtNum(s.yield_kg_ha.p10, language)} kg/ha •{' '}
                  {tr(language, 'Good year (90%):', 'Ano bom (90%):')} {fmtNum(s.yield_kg_ha.p90, language)} kg/ha
                </Text>
                <View style={styles.inlineGaugeRow}>
                  <Text style={{ fontSize: 10.5, color: theme.textMuted }}>
                    {tr(language, 'Rain:', 'Chuva:')} {rainMm} mm{s.irrigated ? ` + ${irrigMm} mm` : ''}
                  </Text>
                  <View style={[styles.miniBarTrack, { backgroundColor: theme.surfaceMuted, height: 6 }]}>
                    <View style={{ width: `${rainPct}%`, height: '100%', backgroundColor: '#2563EB' }} />
                    {irrigPct > 0 && <View style={{ width: `${irrigPct}%`, height: '100%', backgroundColor: '#06B6D4' }} />}
                  </View>
                </View>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};

// ---------------------------------------------------------------------------
// 3. Future Climate Charts (Main Today vs Future + Expandable Models Breakdown)
// ---------------------------------------------------------------------------

export const FutureYieldComparisonChart: React.FC<{
  theme: AppTheme;
  ensemble: ProjectionEnsembleRow[];
  models: ProjectionModel[];
}> = ({ theme, ensemble, models }) => {
  const { language } = useLanguage();
  if (!ensemble.length && !models.length) return null;

  const maxYield = Math.max(
    1000,
    ...ensemble.flatMap((e) => [
      e.baseline_yield_p50 ?? 0,
      e.future_yield_p50_median ?? 0,
      e.future_yield_p50_range?.[1] ?? 0,
    ])
  );

  return (
    <View style={{ gap: 8 }}>
      {ensemble.map((e, idx) => {
        const today = e.baseline_yield_p50 ?? 0;
        const futMed = e.future_yield_p50_median ?? 0;
        const futMin = e.future_yield_p50_range?.[0] ?? futMed;
        const futMax = e.future_yield_p50_range?.[1] ?? futMed;
        const pct = e.yield_change_pct ?? 0;
        const isDrop = pct < 0;
        const futureColor = isDrop ? '#DC2626' : '#059669';

        const todayPct = Math.max(2, Math.min(100, (today / maxYield) * 100));
        const futMinPct = Math.max(0, Math.min(96, (futMin / maxYield) * 100));
        const futSpreadPct = Math.max(4, Math.min(100 - futMinPct, ((futMax - futMin) / maxYield) * 100));
        const futMedPct = Math.max(2, Math.min(98, (futMed / maxYield) * 100));
        const losses = e.models_with_loss ?? 0;

        return (
          <View
            key={e.trno}
            style={[
              styles.flatListRow,
              idx < ensemble.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
            ]}
          >
            <View style={styles.gaugeHeader}>
              <Text style={{ fontWeight: '900', color: theme.text, fontSize: 13 * theme.scale, flex: 1 }}>
                {e.name}
              </Text>
              <Text style={{ fontSize: 12, fontWeight: '900', color: futureColor }}>
                {pct > 0 ? `+${Math.round(pct)}%` : `${Math.round(pct)}%`}
              </Text>
            </View>

            <View style={styles.compBarRow}>
              <Text style={{ fontSize: 10.5, fontWeight: '800', color: theme.textMuted, width: 46 }}>
                {tr(language, 'Today', 'Hoje')}
              </Text>
              <View style={[styles.miniBarTrack, { backgroundColor: theme.surfaceMuted, height: 8, flex: 1 }]}>
                <View style={{ width: `${todayPct}%`, height: '100%', backgroundColor: '#2563EB', borderRadius: 4 }} />
              </View>
              <Text style={{ fontSize: 11, fontWeight: '800', color: theme.text, width: 70, textAlign: 'right' }}>
                {fmtNum(today, language)} kg
              </Text>
            </View>

            <View style={styles.compBarRow}>
              <Text style={{ fontSize: 10.5, fontWeight: '800', color: theme.textMuted, width: 46 }}>
                {tr(language, 'Future', 'Futuro')}
              </Text>
              <View style={[styles.rangeTrack, { backgroundColor: theme.surfaceMuted, height: 10, flex: 1 }]}>
                <View
                  style={{
                    position: 'absolute',
                    left: `${futMinPct}%`,
                    width: `${futSpreadPct}%`,
                    top: 1,
                    bottom: 1,
                    backgroundColor: futureColor,
                    opacity: 0.35,
                    borderRadius: 5,
                  }}
                />
                <View
                  style={{
                    position: 'absolute',
                    left: `${futMedPct}%`,
                    marginLeft: -4,
                    top: 1,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: futureColor,
                  }}
                />
              </View>
              <Text style={{ fontSize: 11, fontWeight: '900', color: futureColor, width: 70, textAlign: 'right' }}>
                {fmtNum(futMed, language)} kg
              </Text>
            </View>

            <View style={styles.axisLabels}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {Array.from({ length: Math.max(1, e.n_models) }).map((_, i) => (
                  <View
                    key={i}
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 4,
                      backgroundColor: i < losses ? '#DC2626' : '#059669',
                    }}
                  />
                ))}
                <Text style={{ fontSize: 10.5, color: theme.textMuted }}>
                  {losses}/{e.n_models} {tr(language, 'models show drop', 'modelos c/ queda')}
                </Text>
              </View>
              {e.future_yield_p50_range && e.n_models > 1 && (
                <Text style={{ fontSize: 10.5, color: theme.textMuted }}>
                  {fmtNum(futMin, language)}–{fmtNum(futMax, language)} kg/ha
                </Text>
              )}
            </View>
          </View>
        );
      })}

      {/* Per-model climate deltas tucked cleanly inside expandable drawer */}
      {models.length > 0 && (
        <ExpandableDetails
          theme={theme}
          label={tr(
            language,
            `Technical climate breakdown (${models.length} NASA/CMIP6 models)`,
            `Detalhes técnicos do clima (${models.length} modelos NASA/CMIP6)`
          )}
        >
          {models.map((m) => {
            const tmax = m.climate_change?.tmax_change_c ?? 0;
            const rainPct = m.climate_change?.rain_change_pct ?? 0;
            const sradPct = m.climate_change?.srad_change_pct ?? 0;
            const tmaxWidth = Math.max(4, Math.min(100, (Math.abs(tmax) / 5.0) * 100));
            const rainHalfPct = Math.min(50, (Math.abs(rainPct) / 40) * 50);
            const rainIsNeg = rainPct < 0;

            return (
              <View key={m.model} style={{ gap: 3, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                <View style={styles.gaugeHeader}>
                  <Text style={{ fontSize: 11.5, fontWeight: '900', color: theme.text }}>{m.model}</Text>
                  <Text style={{ fontSize: 10.5, color: theme.textMuted }}>
                    {tr(language, 'Sun', 'Sol')} {sradPct > 0 ? `+${Math.round(sradPct)}%` : `${Math.round(sradPct)}%`}
                  </Text>
                </View>
                <View style={styles.compBarRow}>
                  <Text style={{ fontSize: 10.5, color: theme.textMuted, width: 64 }}>
                    {tr(language, 'Max temp', 'Temp máx.')}
                  </Text>
                  <View style={[styles.miniBarTrack, { backgroundColor: theme.surfaceMuted, height: 7, flex: 1 }]}>
                    <View style={{ width: `${tmaxWidth}%`, height: '100%', backgroundColor: '#EA580C', borderRadius: 4 }} />
                  </View>
                  <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#C2410C', width: 46, textAlign: 'right' }}>
                    {tmax >= 0 ? `+${tmax.toFixed(1)}` : tmax.toFixed(1)}°C
                  </Text>
                </View>
                <View style={styles.compBarRow}>
                  <Text style={{ fontSize: 10.5, color: theme.textMuted, width: 64 }}>
                    {tr(language, 'Rainfall', 'Chuva')}
                  </Text>
                  <View style={[styles.divergingTrack, { backgroundColor: theme.surfaceMuted }]}>
                    <View style={styles.centerLine} />
                    <View
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: rainIsNeg ? `${50 - rainHalfPct}%` : '50%',
                        width: `${Math.max(2, rainHalfPct)}%`,
                        backgroundColor: rainIsNeg ? '#D97706' : '#0284C7',
                        borderRadius: 3,
                      }}
                    />
                  </View>
                  <Text
                    style={{
                      fontSize: 10.5,
                      fontWeight: '800',
                      color: rainIsNeg ? '#B45309' : '#0369A1',
                      width: 46,
                      textAlign: 'right',
                    }}
                  >
                    {rainPct > 0 ? `+${Math.round(rainPct)}%` : `${Math.round(rainPct)}%`}
                  </Text>
                </View>
              </View>
            );
          })}
        </ExpandableDetails>
      )}
    </View>
  );
};

// ---------------------------------------------------------------------------
// 4. Rotation Timeline & Comparisons (Flat hairline rows)
// ---------------------------------------------------------------------------

const CROP_PALETTE = ['#15803D', '#0284C7', '#D97706', '#7C3AED', '#DC2626'];

export const RotationTimelineChart: React.FC<{
  theme: AppTheme;
  cycles: { crop: string; planting_date: string; end_date: string }[];
  cropName: (code: string) => string;
}> = ({ theme, cycles, cropName }) => {
  const { language } = useLanguage();
  if (!cycles.length) return null;

  const times = cycles.map((c) => ({
    ...c,
    startMs: Date.parse(c.planting_date),
    endMs: Date.parse(c.end_date),
  }));
  const minMs = Math.min(...times.map((t) => t.startMs));
  const maxMs = Math.max(...times.map((t) => t.endMs));
  const spanMs = Math.max(86_400_000, maxMs - minMs);

  return (
    <View style={{ gap: 5 }}>
      {times.map((c, idx) => {
        const leftPct = Math.max(0, Math.min(92, ((c.startMs - minMs) / spanMs) * 100));
        const widthPct = Math.max(8, Math.min(100 - leftPct, ((c.endMs - c.startMs) / spanMs) * 100));
        const days = Math.max(1, Math.round((c.endMs - c.startMs) / 86_400_000));
        const color = CROP_PALETTE[idx % CROP_PALETTE.length];

        return (
          <View key={`${c.crop}-${c.planting_date}-${idx}`} style={{ gap: 2 }}>
            <View style={styles.axisLabels}>
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: theme.text }}>
                {idx + 1}. {cropName(c.crop)} ({days}d)
              </Text>
              <Text style={{ fontSize: 10.5, color: theme.textMuted }}>
                {c.planting_date} → {c.end_date}
              </Text>
            </View>
            <View style={[styles.miniBarTrack, { backgroundColor: theme.surfaceMuted, height: 8 }]}>
              <View
                style={{
                  position: 'absolute',
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  top: 0,
                  bottom: 0,
                  backgroundColor: color,
                  borderRadius: 4,
                }}
              />
            </View>
          </View>
        );
      })}
      <Text style={{ fontSize: 10, color: theme.textMuted }}>
        {tr(language, 'Duration scaled across horizon', 'Duração proporcional ao horizonte')}
      </Text>
    </View>
  );
};

export const RotationCompareBarChart: React.FC<{
  theme: AppTheme;
  alternatives: RotationCompareAlternative[];
  baselineId?: string;
  cropName: (code: string) => string;
  valueOf: (cycle: RotationCompareAlternative['cycles'][number]) => number | null;
}> = ({ theme, alternatives, baselineId, cropName, valueOf }) => {
  const { language } = useLanguage();
  if (!alternatives.length) return null;

  const totals = alternatives.map((alt) =>
    alt.cycles.reduce((acc, c) => acc + Math.max(0, valueOf(c) ?? 0), 0)
  );
  const maxTotal = Math.max(1000, ...totals);

  return (
    <View style={{ gap: 2 }}>
      {alternatives.map((alt, i) => {
        const isBase = baselineId !== undefined && alt.id === baselineId;
        const total = totals[i];

        return (
          <View
            key={alt.id}
            style={[
              styles.flatListRow,
              i < alternatives.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
              isBase && { borderLeftWidth: 3, borderLeftColor: theme.primary, paddingLeft: 8 },
            ]}
          >
            <View style={styles.gaugeHeader}>
              <Text style={{ fontSize: 12, fontWeight: '900', color: theme.text, flex: 1 }}>
                {alt.order.map(cropName).join(' → ')}
                {isBase ? tr(language, ' (chosen)', ' (escolhida)') : ''}
              </Text>
              <Text style={{ fontSize: 12, fontWeight: '900', color: theme.primary }}>
                {fmtNum(total, language)} kg/ha
              </Text>
            </View>

            <View style={styles.stackedCompositionBar}>
              {alt.cycles.map((c, idx) => {
                const v = Math.max(0, valueOf(c) ?? 0);
                const wPct = (v / maxTotal) * 100;
                return (
                  <View
                    key={`${c.crop}-${idx}`}
                    style={{
                      width: `${Math.max(2, wPct)}%`,
                      height: '100%',
                      backgroundColor: CROP_PALETTE[idx % CROP_PALETTE.length],
                    }}
                  />
                );
              })}
            </View>

            <View style={styles.legendRow}>
              {alt.cycles.map((c, idx) => (
                <LegendDot
                  key={`${c.crop}-${idx}`}
                  color={CROP_PALETTE[idx % CROP_PALETTE.length]}
                  label={`${cropName(c.crop)}: ${fmtNum(valueOf(c), language)}`}
                  textColor={theme.textMuted}
                />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
};

export const GoalAttainmentCard: React.FC<{
  theme: AppTheme;
  option: RotationOption;
  cropName: (code: string) => string;
}> = ({ theme, option, cropName }) => {
  const { language } = useLanguage();
  const attainmentPct = Math.round((option.mean_target_attainment ?? 0) * 100);
  const metCount = option.years_all_targets_met ?? 0;
  const totalSeasons = option.samples.length;
  const barColor = attainmentPct >= 80 ? '#059669' : attainmentPct >= 50 ? '#D97706' : '#DC2626';

  return (
    <View style={[styles.flatListRow, { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
      <View style={styles.gaugeHeader}>
        <Text style={{ fontSize: 13 * theme.scale, fontWeight: '900', color: theme.text, flex: 1 }}>
          {option.order.map(cropName).join(' → ')}
        </Text>
        <Text style={{ fontSize: 12, fontWeight: '900', color: barColor }}>{attainmentPct}%</Text>
      </View>

      <View style={[styles.miniBarTrack, { backgroundColor: theme.surfaceMuted, height: 8 }]}>
        <View style={{ width: `${Math.min(100, attainmentPct)}%`, height: '100%', backgroundColor: barColor, borderRadius: 4 }} />
      </View>

      <View style={styles.axisLabels}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {option.samples.map((sample, idx) => (
            <Text
              key={idx}
              style={{
                fontSize: 10,
                fontWeight: '800',
                color: sample.all_targets_met ? '#166534' : '#92400E',
              }}
            >
              {sample.all_targets_met ? '✓' : '•'} {sample.start_year}
            </Text>
          ))}
        </View>
        <Text style={{ fontSize: 10.5, fontWeight: '700', color: theme.textMuted }}>
          {metCount}/{totalSeasons} {tr(language, 'seasons met', 'safras na meta')}
        </Text>
      </View>
    </View>
  );
};

const LegendDot: React.FC<{ color: string; label: string; textColor: string }> = ({
  color,
  label,
  textColor,
}) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    <Text style={{ fontSize: 10.5, fontWeight: '700', color: textColor }}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  kpiStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 7,
  },
  kpiCell: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
    paddingHorizontal: 4,
  },
  kpiDivider: {
    width: 1,
    alignSelf: 'stretch',
    opacity: 0.45,
  },
  inlineGaugeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineGaugeLabel: {
    width: 78,
    fontSize: 11,
    fontWeight: '700',
  },
  gaugeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  segmentedTrack: {
    height: 11,
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
    position: 'relative',
  },
  fillOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 6,
  },
  needleMarker: {
    position: 'absolute',
    top: -1,
    width: 10,
    height: 13,
    borderRadius: 5,
    borderWidth: 1.5,
    marginLeft: -5,
  },
  axisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  stackedCompositionBar: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  horizonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    paddingBottom: 5,
  },
  horizonStackBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  miniBarTrack: {
    flex: 1,
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
    position: 'relative',
  },
  flatListRow: {
    paddingVertical: 8,
    gap: 5,
  },
  rangeTrack: {
    height: 12,
    borderRadius: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  rangeSpan: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    borderRadius: 4,
  },
  rangeTick: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    width: 2.5,
    borderRadius: 2,
  },
  rangeMedianDot: {
    position: 'absolute',
    top: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: -5,
    borderWidth: 1.5,
  },
  divergingTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  centerLine: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: '#64748B',
    zIndex: 2,
  },
  compBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
