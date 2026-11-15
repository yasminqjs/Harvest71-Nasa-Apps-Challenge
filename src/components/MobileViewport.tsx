import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';

export const MobileViewport: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { width, height } = useWindowDimensions();
  const {
    simulatedOffline,
    setSimulatedOffline,
    dryStressBoost,
    simulateDroughtLevel,
    resetDemoData,
    pendingSyncCount,
  } = useAccessibility();

  const isDesktopWeb = Platform.OS === 'web' && width > 560;

  if (!isDesktopWeb) {
    return <View style={styles.full}>{children}</View>;
  }

  const frameHeight = Math.min(840, Math.max(640, height - 36));

  return (
    <View style={styles.desktopBg}>
      {/* Painel lateral de testes em notebook (fora da tela do celular) */}
      <View style={styles.testPanel}>
        <Text style={styles.testTitle}>Modo Teste (Notebook)</Text>
        <Text style={styles.testSubtitle}>
          Simulador de tela móvel para validar voz, offline SQLite, mapa, câmera foliar e alertas.
        </Text>

        <Text style={styles.sectionLabel}>Conectividade (NetInfo)</Text>
        <Pressable
          onPress={() => setSimulatedOffline(!simulatedOffline)}
          style={[
            styles.testBtn,
            simulatedOffline ? styles.testBtnWarn : styles.testBtnOk,
          ]}
        >
          <Text style={styles.testBtnText}>
            {simulatedOffline
              ? '✈️ Modo Roça Offline ATIVO'
              : '📶 Sincronizado (Simular Offline)'}
          </Text>
        </Pressable>
        {pendingSyncCount > 0 && (
          <Text style={styles.queueNote}>
            {pendingSyncCount} item(ns) na fila `sync_queue` aguardando sinal.
          </Text>
        )}

        <Text style={styles.sectionLabel}>Simular Alerta de Seca (Muda o Emoji)</Text>
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

        <Text style={styles.sectionLabel}>Fluxo Inicial</Text>
        <Pressable onPress={resetDemoData} style={styles.resetBtn}>
          <Text style={styles.resetBtnText}>↺ Reiniciar Onboarding & Mapa</Text>
        </Pressable>
      </View>

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
    width: 274,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
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
