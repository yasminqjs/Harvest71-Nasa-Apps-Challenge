import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useLanguage } from '../i18n/Language';
import { Pressable, Text } from '../i18n/native';
import { useAccessibility } from '../context/AccessibilityContext';

export const MobileViewport: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { width } = useWindowDimensions();
  const { language } = useLanguage();
  const en = language === 'en';
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const {
    simulatedOffline,
    setSimulatedOffline,
    dryStressBoost,
    simulateDroughtLevel,
    resetDemoData,
    pendingSyncCount,
  } = useAccessibility();

  const isWeb = Platform.OS === 'web';
  const isCompactWeb = width < 768;

  return (
    <View style={styles.full}>
      {children}

      {isWeb && (
        <View
          pointerEvents="box-none"
          style={[
            styles.floatingAnchor,
            { bottom: isCompactWeb ? 84 : 20, right: isCompactWeb ? 12 : 20 },
          ]}
        >
          {simulatorOpen && (
            <View style={styles.demoPopover}>
              <View style={styles.panelHeader}>
                <View style={styles.panelTitleRow}>
                  <Ionicons name="flask-outline" size={16} color="#166534" />
                  <Text style={styles.testTitle}>
                    {en ? 'Test Mode (Web)' : 'Modo Teste (Notebook)'}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setSimulatorOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel={en ? 'Close simulator' : 'Fechar simulador'}
                  style={styles.closeBtn}
                >
                  <Ionicons name="close" size={16} color="#4A5A50" />
                </Pressable>
              </View>

              <Text style={styles.testSubtitle}>
                {en
                  ? 'Simulate offline connectivity, drought severity, or restart onboarding.'
                  : 'Simule conectividade offline, severidade de seca ou reinicie o onboarding.'}
              </Text>

              <Text style={styles.sectionLabel}>
                {en ? 'Connectivity (NetInfo)' : 'Conectividade (NetInfo)'}
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
                    ? en
                      ? '✈️ Offline Field Mode ACTIVE'
                      : '✈️ Modo Roça Offline ATIVO'
                    : en
                    ? '📶 Synced (Simulate Offline)'
                    : '📶 Sincronizado (Simular Offline)'}
                </Text>
              </Pressable>
              {pendingSyncCount > 0 && (
                <Text style={styles.queueNote}>
                  {en
                    ? `${pendingSyncCount} item(s) in sync queue waiting for signal.`
                    : `${pendingSyncCount} item(ns) na fila \`sync_queue\` aguardando sinal.`}
                </Text>
              )}

              <Text style={styles.sectionLabel}>
                {en ? 'Simulate Drought Alert (Changes Emoji)' : 'Simular Alerta de Seca (Muda o Emoji)'}
              </Text>
              <View style={styles.emojiRow}>
                {[
                  { boost: 0, label: en ? '😊 Normal' : '😊 Normal' },
                  { boost: 1, label: en ? '😐 Attention' : '😐 Atenção' },
                  { boost: 2, label: en ? '😟 Alert' : '😟 Alerta' },
                  { boost: 3, label: en ? '😰 Drought' : '😰 Seca' },
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
                {en ? 'Initial Flow' : 'Fluxo Inicial'}
              </Text>
              <Pressable
                onPress={() => {
                  setSimulatorOpen(false);
                  resetDemoData();
                }}
                style={styles.resetBtn}
              >
                <Text style={styles.resetBtnText}>
                  {en ? '↺ Restart Onboarding & Map' : '↺ Reiniciar Onboarding & Mapa'}
                </Text>
              </Pressable>
            </View>
          )}

          <Pressable
            onPress={() => setSimulatorOpen((v) => !v)}
            accessibilityRole="button"
            style={[styles.fabBtn, simulatorOpen && styles.fabBtnActive]}
          >
            <Ionicons
              name={simulatorOpen ? 'close' : 'flask-outline'}
              size={16}
              color={simulatorOpen ? '#FFFFFF' : '#166534'}
            />
            <Text style={[styles.fabText, simulatorOpen && styles.fabTextActive]}>
              {simulatorOpen
                ? en
                  ? 'Close simulator'
                  : 'Fechar simulador'
                : en
                ? 'Demo Simulator'
                : 'Simulador Demo'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  full: {
    flex: 1,
    width: '100%',
  },
  floatingAnchor: {
    position: 'absolute',
    alignItems: 'flex-end',
    gap: 10,
    zIndex: 900,
  },
  fabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderColor: '#D5CFC0',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabBtnActive: {
    backgroundColor: '#166534',
    borderColor: '#166534',
  },
  fabText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#16211A',
  },
  fabTextActive: {
    color: '#FFFFFF',
  },
  demoPopover: {
    width: 300,
    maxWidth: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D5CFC0',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  panelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  testTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#16211A',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EFECE1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  testSubtitle: {
    fontSize: 11.5,
    color: '#4A5A50',
    marginTop: 6,
    lineHeight: 16,
  },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: '#5B6B60',
    marginTop: 12,
    marginBottom: 6,
  },
  testBtn: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  testBtnOk: {
    backgroundColor: '#ECFDF5',
    borderColor: '#16A34A',
  },
  testBtnWarn: {
    backgroundColor: '#FEF9C3',
    borderColor: '#D97706',
  },
  testBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16211A',
  },
  queueNote: {
    fontSize: 11,
    color: '#854D0E',
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
    borderColor: '#D5CFC0',
    backgroundColor: '#F6F4EC',
  },
  chipBtnActive: {
    backgroundColor: '#166534',
    borderColor: '#166534',
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#16211A',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  resetBtn: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#EFECE1',
    borderWidth: 1,
    borderColor: '#D5CFC0',
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#16211A',
    textAlign: 'center',
  },
});
