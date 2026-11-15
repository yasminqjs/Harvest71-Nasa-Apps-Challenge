import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';
import { useCropQuality } from '../context/CropQualityContext';
import { LanguageTogglePill, pickLang } from '../i18n/locale';
import { PILOT_AREAS_AUDITED } from '../services/cropQualityService';

export const MobileViewport: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { width, height } = useWindowDimensions();
  const {
    language,
    setAppLanguage,
    simulatedOffline,
    setSimulatedOffline,
    dryStressBoost,
    simulateDroughtLevel,
    resetDemoData,
    pendingSyncCount,
  } = useAccessibility();
  const {
    analysis,
    selectedPilotId,
    isAnalyzing,
    loadingProgressPct,
    loadingStage,
    selectPilotArea,
    refreshAnalysis,
  } = useCropQuality();
  const bio = analysis?.scientific_telemetry.biophysical_indices;
  const view = analysis?.farmer_accessible_view;
  const isFallback = Boolean(analysis?.cache_metadata?.fallback_used);
  const powerProv = analysis?.scientific_telemetry.data_provenance.find(
    (p) => typeof p.dataset === 'string' && p.dataset.includes('NASA/POWER')
  ) as Record<string, unknown> | undefined;
  const s2Prov = analysis?.scientific_telemetry.data_provenance.find(
    (p) => typeof p.dataset === 'string' && p.dataset.includes('COPERNICUS/S2')
  ) as Record<string, unknown> | undefined;
  const powerWin = typeof powerProv?.window === 'string' ? powerProv.window : '—';
  const s2AcqDate =
    typeof s2Prov?.acquisition_date === 'string' ? s2Prov.acquisition_date : '—';

  const isDesktopWeb = Platform.OS === 'web' && width > 560;

  if (!isDesktopWeb) {
    return <View style={styles.full}>{children}</View>;
  }

  const frameHeight = Math.min(840, Math.max(640, height - 36));

  return (
    <View style={styles.desktopBg}>
      {/* Painel lateral de testes em notebook (fora da tela do celular) */}
      <ScrollView
        style={[styles.testPanel, { maxHeight: frameHeight }]}
        contentContainerStyle={styles.testPanelContent}
      >
        <Text style={styles.testTitle}>
          {pickLang(language, 'Test Mode (Laptop)', 'Modo Teste (Notebook)')}
        </Text>
        <Text style={styles.testSubtitle}>
          {pickLang(
            language,
            'Mobile screen simulator to validate voice, offline SQLite, map, leaf camera, and alerts.',
            'Simulador de tela móvel para validar voz, offline SQLite, mapa, câmera foliar e alertas.'
          )}
        </Text>

        <Text style={styles.sectionLabel}>
          {pickLang(language, 'Language / Idioma', 'Idioma / Language')}
        </Text>
        <LanguageTogglePill language={language} onSelect={setAppLanguage} />

        <Text style={styles.sectionLabel}>
          {pickLang(language, 'Live Satellite (NASA & Copernicus)', 'Satélite Real (NASA & Copernicus)')}
        </Text>
        <Pressable
          onPress={() => refreshAnalysis({ liveSatellite: true })}
          disabled={isAnalyzing}
          style={[styles.liveSatBtn, isAnalyzing && styles.liveSatBtnLoading]}
        >
          {isAnalyzing ? (
            <View style={styles.liveRow}>
              <ActivityIndicator size="small" color="#FACC15" />
              <Text style={styles.liveSatBtnText}>
                {pickLang(
                  language,
                  `Downloading NASA (${Math.round(loadingProgressPct)}%)...`,
                  `Baixando NASA (${Math.round(loadingProgressPct)}%)...`
                )}
              </Text>
            </View>
          ) : (
            <Text style={styles.liveSatBtnText}>
              {pickLang(
                language,
                '🛰️ Fetch Live Data (NASA Live)',
                '🛰️ Pegar Dados Reais (NASA Ao Vivo)'
              )}
            </Text>
          )}
        </Pressable>
        {isAnalyzing && <Text style={styles.liveStageNote}>{loadingStage}</Text>}

        <View style={styles.emojiRow}>
          {PILOT_AREAS_AUDITED.map((pilot) => {
            const active = selectedPilotId === pilot.id;
            return (
              <Pressable
                key={pilot.id}
                onPress={() => selectPilotArea(pilot.id)}
                style={[styles.chipBtn, active && styles.chipBtnActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  📍 {pilot.municipality}-{pilot.state}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {bio && view && (
          <View style={styles.telemetryBox}>
            <Text style={styles.telemetrySource}>
              {isFallback
                ? pickLang(language, '⚡ Source: Audited NASA Cache', '⚡ Fonte: Cache Auditado NASA')
                : pickLang(language, '🟢 Source: NASA Live', '🟢 Fonte: NASA Ao Vivo')}
            </Text>
            <Text style={styles.telemetryLine}>
              NDVI: {bio.ndvi_mean.toFixed(2)} • GWETROOT:{' '}
              {Math.round(bio.nasa_gwetroot_0_to_1 * 100)}%
            </Text>
            <Text style={styles.telemetryLine}>
              {pickLang(language, 'Rain 30d', 'Chuva 30d')}: {bio.precip_gpm_power_30d_mm.toFixed(1)}mm • ET₀:{' '}
              {bio.et0_fao56_30d_mm.toFixed(0)}mm
            </Text>
            <Text style={styles.telemetryLine}>
              {pickLang(language, 'Health', 'Saúde')}: {view.health_score_0_to_100}/100 ({view.overall_traffic_light})
            </Text>
            <Text style={styles.telemetryLine}>
              📅 POWER: {powerWin}
            </Text>
            <Text style={styles.telemetryLine}>
              🛰️ S2: {s2AcqDate}
            </Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>
          {pickLang(language, 'Connectivity (NetInfo)', 'Conectividade (NetInfo)')}
        </Text>
        <Pressable
          onPress={() => setSimulatedOffline(!simulatedOffline)}
          style={[
            styles.testBtn,
            simulatedOffline ? styles.testBtnWarn : styles.testBtnOk,
          ]}
        >
          <Text style={styles.testBtnText}>
            {simulatedOffline
              ? pickLang(
                  language,
                  '✈️ Offline Farm Mode ACTIVE',
                  '✈️ Modo Roça Offline ATIVO'
                )
              : pickLang(
                  language,
                  '📶 Synced (Simulate Offline)',
                  '📶 Sincronizado (Simular Offline)'
                )}
          </Text>
        </Pressable>
        {pendingSyncCount > 0 && (
          <Text style={styles.queueNote}>
            {pickLang(
              language,
              `${pendingSyncCount} item(s) in \`sync_queue\` waiting for signal.`,
              `${pendingSyncCount} item(ns) na fila \`sync_queue\` aguardando sinal.`
            )}
          </Text>
        )}

        <Text style={styles.sectionLabel}>
          {pickLang(
            language,
            'Simulate Drought Alert (Changes Emoji)',
            'Simular Alerta de Seca (Muda o Emoji)'
          )}
        </Text>
        <View style={styles.emojiRow}>
          {[
            { boost: 0, label: '😊 Normal' },
            { boost: 1, label: '😐 Atenção' },
            { boost: 2, label: '😟 Alerta' },
            { boost: 3, label: '😰 Seca' },
          ].map((opt) => (
            <Pressable
              key={opt.boost}
              onPress={() => simulateDroughtLevel(opt.boost)}
              style={[
                styles.chipBtn,
                dryStressBoost === opt.boost && styles.chipBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  dryStressBoost === opt.boost && styles.chipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>
          {pickLang(language, 'Initial Flow', 'Fluxo Inicial')}
        </Text>
        <Pressable onPress={resetDemoData} style={styles.resetBtn}>
          <Text style={styles.resetBtnText}>
            {pickLang(
              language,
              '↺ Restart Onboarding & Map',
              '↺ Reiniciar Onboarding & Mapa'
            )}
          </Text>
        </Pressable>
      </ScrollView>

      {/* Moldura realista de smartphone */}
      <View style={[styles.phoneShell, { height: frameHeight }]}>
        <View style={styles.speakerBar} />
        <View style={styles.phoneScreen}>{children}</View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  full: {
    flex: 1,
  },
  desktopBg: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    paddingHorizontal: 24,
  },
  testPanel: {
    width: 288,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  testPanelContent: {
    padding: 16,
  },
  liveSatBtn: {
    backgroundColor: '#1E3A8A',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    alignItems: 'center',
  },
  liveSatBtnLoading: {
    backgroundColor: '#0F172A',
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveSatBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  liveStageNote: {
    fontSize: 10,
    color: '#1D4ED8',
    fontWeight: '700',
    marginBottom: 6,
  },
  telemetryBox: {
    marginTop: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 8,
    gap: 2,
  },
  telemetrySource: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
  },
  telemetryLine: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  testTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  testSubtitle: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 4,
    lineHeight: 17,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#6B7280',
    marginTop: 14,
    marginBottom: 6,
  },
  testBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  testBtnOk: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  testBtnWarn: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
  },
  testBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  queueNote: {
    fontSize: 11,
    color: '#92400E',
    marginTop: 4,
  },
  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  chipBtnActive: {
    backgroundColor: '#1F6E43',
    borderColor: '#1F6E43',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  resetBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  phoneShell: {
    width: 404,
    backgroundColor: '#111827',
    borderRadius: 38,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
  },
  speakerBar: {
    width: 80,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#374151',
    alignSelf: 'center',
    marginBottom: 8,
    marginTop: 2,
  },
  phoneScreen: {
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#F7F5EE',
  },
});
