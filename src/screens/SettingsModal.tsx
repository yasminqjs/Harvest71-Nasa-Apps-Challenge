import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';
import { OFFICIAL_DATA_SOURCES } from '../data/seedData';
import { getAppTheme } from '../theme/tokens';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const {
    accessibility,
    farmers,
    activeFarmer,
    alerts,
    syncQueue,
    fieldLogs,
    isOnline,
    pendingSyncCount,
    lastSyncMessage,
    selectFarmer,
    updateAccessibility,
    markAlertRead,
    triggerSyncNow,
    speak,
    resetDemoData,
  } = useAccessibility();

  const theme = getAppTheme(accessibility);
  const [tab, setTab] = useState<'perfil' | 'alertas' | 'sync' | 'fontes'>('perfil');

  if (!activeFarmer) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.bg }]}>
        <View
          style={[
            styles.header,
            { backgroundColor: theme.surface, borderBottomColor: theme.border },
          ]}
        >
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            👤 Usuário, Alertas & Fontes
          </Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close-circle" size={30} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.tabRow}>
          {[
            { id: 'perfil' as const, label: 'Perfil' },
            { id: 'alertas' as const, label: `Alertas (${alerts.length})` },
            { id: 'sync' as const, label: `Fila (${pendingSyncCount})` },
            { id: 'fontes' as const, label: 'Fontes' },
          ].map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setTab(item.id)}
              style={[
                styles.tabBtn,
                {
                  backgroundColor: tab === item.id ? theme.primary : theme.surface,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: tab === item.id ? theme.primaryText : theme.text,
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.scrollBody}>
          {tab === 'perfil' && (
            <>
              <View
                style={[
                  styles.card,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  Trocar agricultor(a) no mesmo aparelho
                </Text>
                <Text style={{ fontSize: 12, color: theme.textMuted }}>
                  Uso compartilhado para família ou comunidade (TIC IBGE):
                </Text>
                <View style={styles.farmerList}>
                  {farmers.map((f) => {
                    const active = f.id === activeFarmer.id;
                    return (
                      <Pressable
                        key={f.id}
                        onPress={() => selectFarmer(f.id)}
                        style={[
                          styles.farmerChip,
                          {
                            backgroundColor: active ? theme.primary : theme.surfaceMuted,
                            borderColor: theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontWeight: '900',
                            color: active ? theme.primaryText : theme.text,
                          }}
                        >
                          {f.tratamento}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            color: active ? theme.primaryText : theme.textMuted,
                          }}
                        >
                          {f.waterAccess} • {f.objective}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View
                style={[
                  styles.card,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  Acessibilidade & Voz (AccessibilityContext)
                </Text>

                <View style={styles.switchRow}>
                  <Text style={{ fontWeight: '700', color: theme.text, flex: 1 }}>
                    Leitura automática em voz alta
                  </Text>
                  <Switch
                    value={accessibility.voiceGuidanceEnabled}
                    onValueChange={(v) =>
                      updateAccessibility({ voiceGuidanceEnabled: v })
                    }
                  />
                </View>

                <View style={styles.switchRow}>
                  <Text style={{ fontWeight: '700', color: theme.text, flex: 1 }}>
                    Alto contraste (sol forte / baixa visão)
                  </Text>
                  <Switch
                    value={accessibility.highContrast}
                    onValueChange={(v) => updateAccessibility({ highContrast: v })}
                  />
                </View>

                <View style={styles.switchRow}>
                  <Text style={{ fontWeight: '700', color: theme.text, flex: 1 }}>
                    Letras grandes
                  </Text>
                  <Switch
                    value={accessibility.largeText}
                    onValueChange={(v) => updateAccessibility({ largeText: v })}
                  />
                </View>

                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textMuted }}>
                  Linguagem dos textos:
                </Text>
                <View style={styles.rowGap}>
                  {(
                    [
                      { id: 'acessivel', label: '🗣️ Linguagem do Campo' },
                      { id: 'tecnico', label: '📊 Modo Técnico' },
                    ] as const
                  ).map((opt) => (
                    <Pressable
                      key={opt.id}
                      onPress={() => updateAccessibility({ languageLevel: opt.id })}
                      style={[
                        styles.langBtn,
                        {
                          backgroundColor:
                            accessibility.languageLevel === opt.id
                              ? theme.primary
                              : theme.surfaceMuted,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '800',
                          color:
                            accessibility.languageLevel === opt.id
                              ? theme.primaryText
                              : theme.text,
                        }}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textMuted }}>
                  Velocidade da voz: {accessibility.speechRate}x
                </Text>
                <View style={styles.rowGap}>
                  {[0.75, 0.85, 1.0].map((rate) => (
                    <Pressable
                      key={rate}
                      onPress={() => updateAccessibility({ speechRate: rate })}
                      style={[
                        styles.langBtn,
                        {
                          backgroundColor:
                            accessibility.speechRate === rate
                              ? theme.accent
                              : theme.surfaceMuted,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '800',
                          color:
                            accessibility.speechRate === rate ? '#FFFFFF' : theme.text,
                        }}
                      >
                        {rate}x
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Pressable
                onPress={() => {
                  resetDemoData();
                  onClose();
                }}
                style={[
                  styles.resetBtn,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Text style={{ fontWeight: '800', color: theme.text }}>
                  ↺ Voltar ao Onboarding Inicial (Voz + Mapa Nordeste)
                </Text>
              </Pressable>
            </>
          )}

          {tab === 'alertas' && (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                🔔 Alertas Preventivos Locais (Offline)
              </Text>
              {alerts.map((al) => (
                <Pressable
                  key={al.id}
                  onPress={() => {
                    markAlertRead(al.id);
                    speak(
                      accessibility.languageLevel === 'acessivel'
                        ? al.mensagemAcessivel
                        : al.mensagemTecnica,
                      true
                    );
                  }}
                  style={[
                    styles.alertCard,
                    {
                      backgroundColor:
                        al.severidade === 'urgente'
                          ? theme.dangerBg
                          : al.severidade === 'atencao'
                          ? theme.warningBg
                          : theme.successBg,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View style={styles.rowBetween}>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: theme.text, flex: 1 }}>
                      {al.titulo}
                    </Text>
                    <Ionicons name="volume-high" size={18} color={theme.text} />
                  </View>
                  <Text style={{ fontSize: 12, color: theme.text, lineHeight: 18 }}>
                    {accessibility.languageLevel === 'acessivel'
                      ? al.mensagemAcessivel
                      : al.mensagemTecnica}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {tab === 'sync' && (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                📡 Banco SQLite Local & Fila `sync_queue`
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>
                Estado atual: {isOnline ? 'Sincronizado (Com Sinal)' : 'Modo Roça Offline'}
              </Text>
              {lastSyncMessage && (
                <Text style={{ fontSize: 12, color: theme.primary, fontWeight: '800' }}>
                  {lastSyncMessage}
                </Text>
              )}

              <Pressable
                onPress={triggerSyncNow}
                style={[styles.syncBtn, { backgroundColor: theme.primary }]}
              >
                <Ionicons name="sync" size={18} color={theme.primaryText} />
                <Text style={{ color: theme.primaryText, fontWeight: '900' }}>
                  Sincronizar agora
                </Text>
              </Pressable>

              <Text style={{ fontSize: 12, fontWeight: '800', color: theme.textMuted, marginTop: 6 }}>
                Registros de campo ({fieldLogs.length}) / Fila ({syncQueue.length}):
              </Text>
              {fieldLogs.length === 0 ? (
                <Text style={{ fontSize: 12, color: theme.textMuted }}>
                  Nenhum registro enviado hoje ainda. Use os botões da tela inicial ou mapa.
                </Text>
              ) : (
                fieldLogs.slice(0, 6).map((l) => (
                  <View
                    key={l.id}
                    style={[styles.logRow, { backgroundColor: theme.bg }]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '800', color: theme.text }}>
                      {l.sincronizado ? '✓ Sincronizado' : '⏳ Aguardando sinal'} • {l.observacao}
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}

          {tab === 'fontes' && (
            <View style={{ gap: 10 }}>
              {OFFICIAL_DATA_SOURCES.map((group) => (
                <View
                  key={group.categoria}
                  style={[
                    styles.card,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.cardTitle, { color: theme.primary }]}>
                    {group.categoria}
                  </Text>
                  {group.itens.map((item) => (
                    <Text key={item} style={{ fontSize: 12, color: theme.text, lineHeight: 18 }}>
                      • {item}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  closeBtn: {
    padding: 4,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 6,
    padding: 12,
  },
  tabBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    padding: 14,
    gap: 12,
    paddingBottom: 28,
  },
  card: {
    borderRadius: 20,
    borderWidth: 2,
    padding: 14,
    gap: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  farmerList: {
    flexDirection: 'row',
    gap: 8,
  },
  farmerChip: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 2,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  rowGap: {
    flexDirection: 'row',
    gap: 8,
  },
  langBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtn: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  alertCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    gap: 4,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  syncBtn: {
    minHeight: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logRow: {
    borderRadius: 10,
    padding: 10,
  },
});
