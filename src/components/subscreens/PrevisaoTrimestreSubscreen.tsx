import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAccessibility } from '../../context/AccessibilityContext';
import { pickLang } from '../../i18n/locale';
import { AppTheme } from '../../theme/tokens';
import { AppLanguage, FarmProperty } from '../../types/domain';
import {
  ForecastDayCell,
  buildQuarterlyForecastCalendar,
} from '../../utils/agronomyHelpers';

interface PrevisaoTrimestreSubscreenProps {
  farm: FarmProperty;
  onBack: () => void;
  onSpeak: (text: string) => void;
  theme: AppTheme;
}

function getStatusStyle(
  lang: AppLanguage
): Record<ForecastDayCell['status'], { bg: string; border: string; text: string; label: string }> {
  return {
    normal: {
      bg: '#F3F4F6',
      border: '#D1D5DB',
      text: '#374151',
      label: pickLang(lang, 'Normal field work', 'Manejo normal'),
    },
    chuva_boa: {
      bg: '#DCFCE7',
      border: '#16A34A',
      text: '#166534',
      label: pickLang(lang, 'Good rain window (GPM)', 'Janela de chuva boa (GPM)'),
    },
    veranico: {
      bg: '#FEE2E2',
      border: '#DC2626',
      text: '#991B1B',
      label: pickLang(lang, 'Dry spell / drought risk (SMAP)', 'Risco de veranico / seca (SMAP)'),
    },
    calor_extremo: {
      bg: '#FFEDD5',
      border: '#EA580C',
      text: '#9A3412',
      label: pickLang(lang, 'Heat / leaf stress (MODIS LST)', 'Calor / estresse folha (MODIS LST)'),
    },
    solo_exposto: {
      bg: '#FEF3C7',
      border: '#D97706',
      text: '#92400E',
      label: pickLang(lang, 'Bare soil / erosion risk (SRTM)', 'Risco solo descoberto / erosão (SRTM)'),
    },
  };
}

export const PrevisaoTrimestreSubscreen: React.FC<PrevisaoTrimestreSubscreenProps> = ({
  farm,
  onBack,
  onSpeak,
  theme,
}) => {
  const { language } = useAccessibility();
  const diag = farm.diagnostico;
  const STATUS_STYLE = getStatusStyle(language);
  const months = buildQuarterlyForecastCalendar(diag, language);
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(0);
  const [selectedDay, setSelectedDay] = useState<ForecastDayCell | null>(null);

  const activeMonth = months[selectedMonthIdx] ?? months[0];

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Pressable
          onPress={onBack}
          style={[styles.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Ionicons name="arrow-back" size={18} color={theme.text} />
          <Text style={[styles.backText, { color: theme.text }]}>
            {pickLang(language, 'Back', 'Voltar')}
          </Text>
        </Pressable>
        <Text style={[styles.screenTitle, { color: theme.text, fontSize: 18 * theme.scale }]}>
          {pickLang(language, 'Quarter Forecast', 'Previsão do trimestre')}
        </Text>
        <Pressable
          onPress={() => onSpeak(`${diag.modeloC.titulo}. ${diag.modeloC.explicacaoAcessivel}`)}
          style={[styles.voiceBtn, { backgroundColor: theme.surfaceMuted }]}
        >
          <Ionicons name="volume-high" size={18} color={theme.primary} />
        </Pressable>
      </View>

      {/* Quarterly summary */}
      <View
        style={[
          styles.summaryCard,
          { backgroundColor: theme.surface, borderColor: '#2563EB' },
        ]}
      >
        <Text style={{ fontSize: 28 }}>{diag.modeloB.emoji}</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 14, fontWeight: '900', color: theme.text }}>
            {diag.modeloC.titulo}
          </Text>
          <Text style={{ fontSize: 12, color: theme.textMuted }}>
            {pickLang(
              language,
              `Historical dry spell: ${diag.modeloC.probabilidadeVeranicoPct}% • ${diag.modeloB.sinaisAtivos}/4 active signals nearby`,
              `Veranico histórico: ${diag.modeloC.probabilidadeVeranicoPct}% • ${diag.modeloB.sinaisAtivos}/4 sinais ativos na região`
            )}
          </Text>
        </View>
      </View>

      {/* Quarterly Calendar */}
      <View
        style={[
          styles.calCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.calHeaderTitle, { color: theme.text }]}>
          {pickLang(language, 'Calendar (90 days)', 'Calendário (90 dias)')}
        </Text>

        <View style={styles.monthTabRow}>
          {months.map((m, idx) => {
            const active = idx === selectedMonthIdx;
            return (
              <Pressable
                key={m.mesLabel}
                onPress={() => {
                  setSelectedMonthIdx(idx);
                  setSelectedDay(null);
                }}
                style={[
                  styles.monthTab,
                  {
                    backgroundColor: active ? theme.primary : theme.surfaceMuted,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '900',
                    color: active ? theme.primaryText : theme.text,
                  }}
                >
                  {m.mesLabel.split('/')[0].trim()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.dayGrid}>
          {activeMonth.dias.map((cell) => {
            const st = STATUS_STYLE[cell.status];
            const isSelected = selectedDay?.key === cell.key;
            return (
              <Pressable
                key={cell.key}
                onPress={() => {
                  setSelectedDay(cell);
                  onSpeak(
                    pickLang(
                      language,
                      `Day ${cell.dayNum}: ${cell.resumo}`,
                      `Dia ${cell.dayNum}: ${cell.resumo}`
                    )
                  );
                }}
                style={[
                  styles.dayCell,
                  {
                    backgroundColor: st.bg,
                    borderColor: isSelected ? '#111827' : st.border,
                    borderWidth: isSelected ? 2.5 : 1.5,
                  },
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: '900', color: st.text }}>
                  {cell.dayNum}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {selectedDay && (
          <View
            style={[
              styles.selectedDayBanner,
              {
                backgroundColor: STATUS_STYLE[selectedDay.status].bg,
                borderColor: STATUS_STYLE[selectedDay.status].border,
              },
            ]}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '900',
                color: STATUS_STYLE[selectedDay.status].text,
              }}
            >
              {pickLang(
                language,
                `Day ${selectedDay.dayNum} of ${activeMonth.mesLabel}: ${selectedDay.resumo}`,
                `Dia ${selectedDay.dayNum} de ${activeMonth.mesLabel}: ${selectedDay.resumo}`
              )}
            </Text>
          </View>
        )}
      </View>

      {/* Problem legend (red card) */}
      <View
        style={[
          styles.legendCard,
          { backgroundColor: theme.surface, borderColor: '#DC2626' },
        ]}
      >
        <Text style={[styles.legendTitle, { color: '#DC2626' }]}>
          {pickLang(language, 'Issue legend', 'Legenda do problema')}
        </Text>
        {(Object.keys(STATUS_STYLE) as ForecastDayCell['status'][]).map((k) => {
          const item = STATUS_STYLE[k];
          return (
            <View key={k} style={styles.legendRow}>
              <View
                style={[
                  styles.legendSwatch,
                  { backgroundColor: item.bg, borderColor: item.border },
                ]}
              />
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text, flex: 1 }}>
                {item.label}
              </Text>
            </View>
          );
        })}
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
  summaryCard: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  calCard: {
    borderRadius: 18,
    borderWidth: 2,
    padding: 14,
    gap: 10,
  },
  calHeaderTitle: { fontSize: 15, fontWeight: '900' },
  monthTabRow: { flexDirection: 'row', gap: 8 },
  monthTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dayCell: {
    width: '12.4%',
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedDayBanner: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 10,
  },
  legendCard: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 14,
    gap: 8,
  },
  legendTitle: { fontSize: 15, fontWeight: '900' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendSwatch: { width: 18, height: 18, borderRadius: 6, borderWidth: 1.5 },
});
