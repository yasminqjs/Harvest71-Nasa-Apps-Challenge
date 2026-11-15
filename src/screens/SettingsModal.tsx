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
import { FeedbackSection } from '../components/FeedbackSection';
import { useAccessibility } from '../context/AccessibilityContext';
import { OFFICIAL_DATA_SOURCES } from '../data/seedData';
import { getAppTheme } from '../theme/tokens';

export type SettingsTabKey = 'perfil' | 'alertas' | 'sync' | 'feedback' | 'fontes';

interface SettingsModalProps {
  visible: boolean;
  initialTab?: SettingsTabKey;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  initialTab = 'perfil',
  onClose,
}) => {
  const {
    accessibility,
    farmers,
    activeFarmer,
    alerts,
    feedbacks,
    syncQueue,
    fieldLogs,
    isOnline,
    pendingSyncCount,
    lastSyncMessage,
    selectFarmer,
    updateAccessibility,
    markAlertRead,
    triggerSyncNow,
    openTutorial,
    speak,
    resetDemoData,
  } = useAccessibility();

  const theme = getAppTheme(accessibility);
  const [tabOverride, setTabOverride] = useState<SettingsTabKey | null>(null);
  const tab = tabOverride ?? initialTab;

  const handleClose = () => {
    setTabOverride(null);
    onClose();
  };

  if (!activeFarmer) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.root, { backgroundColor: theme.bg }]}>
        <View
          style={[
            styles.header,
            { backgroundColor: theme.surface, borderBottomColor: theme.border },
          ]}
        >
          <View style={styles.titleWithIcon}>
            <Ionicons name="person-circle-outline" size={24} color={theme.primary} />
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              Usuário, Alertas & Fontes
            </Text>
          </View>
          <Pressable onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close-circle" size={30} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
          style={{ flexGrow: 0 }}
        >
          {[
            { id: 'perfil' as const, label: 'Perfil' },
            { id: 'alertas' as const, label: `Alertas (${alerts.length})` },
            { id: 'feedback' as const, label: `Feedback (${feedbacks.length})` },
            { id: 'sync' as const, label: `Fila (${pendingSyncCount})` },
            { id: 'fontes' as const, label: 'Fontes' },
          ].map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setTabOverride(item.id)}
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
        </ScrollView>

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
                      { id: 'acessivel', label: 'Linguagem do Campo' },
                      { id: 'tecnico', label: 'Modo Técnico' },
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

              <View
                style={[
                  styles.card,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <View style={styles.titleWithIcon}>
                  <Ionicons name="document-text-outline" size={20} color={theme.primary} />
                  <Text style={[styles.cardTitle, { color: theme.text }]}>
                    Dados do Cadastro Atual
                  </Text>
                </View>
                <Text style={{ fontSize: 12.5, color: theme.text, lineHeight: 20 }}>
                  • Nome: <Text style={{ fontWeight: '800' }}>{activeFarmer.tratamento}</Text>
                  {activeFarmer.genero
                    ? ` • Gênero: ${activeFarmer.genero}`
                    : ''}
                  {'\n'}• Tempo na agricultura familiar:{' '}
                  <Text style={{ fontWeight: '800' }}>
                    {activeFarmer.tempoAgriculturaFamiliar ?? 'Não informado'}
                  </Text>
                  {'\n'}• Tamanho da terra:{' '}
                  <Text style={{ fontWeight: '800' }}>
                    {activeFarmer.tamanhoEstimadoHa
                      ? `${activeFarmer.tamanhoEstimadoHa} ha`
                      : 'Padrão'}
                  </Text>
                  {'\n'}• Água: <Text style={{ fontWeight: '800' }}>{activeFarmer.waterAccess}</Text>
                  {activeFarmer.armazenamentoAgua
                    ? ` (Reserva: ${activeFarmer.armazenamentoAgua})`
                    : ''}
                  {'\n'}• Força de trabalho:{' '}
                  <Text style={{ fontWeight: '800' }}>{activeFarmer.laborType}</Text>
                  {'\n'}• Situação financeira:{' '}
                  <Text style={{ fontWeight: '800' }}>{activeFarmer.financialTier}</Text>
                  {'\n'}• Objetivo: <Text style={{ fontWeight: '800' }}>{activeFarmer.objective}</Text>
                  {activeFarmer.desafiosPrincipais &&
                  activeFarmer.desafiosPrincipais.length > 0
                    ? `\n• Desafios: ${activeFarmer.desafiosPrincipais.join(', ')}`
                    : ''}
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  handleClose();
                  openTutorial();
                }}
                style={[
                  styles.resetBtn,
                  { backgroundColor: theme.primary, borderColor: theme.border },
                ]}
              >
                <View style={styles.titleWithIcon}>
                  <Ionicons name="book-outline" size={18} color={theme.primaryText} />
                  <Text style={{ fontWeight: '900', color: theme.primaryText }}>
                    Ver Tutorial de Uso (Passo a Passo)
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  resetDemoData();
                  handleClose();
                }}
                style={[
                  styles.resetBtn,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <View style={styles.titleWithIcon}>
                  <Ionicons name="refresh-outline" size={18} color={theme.text} />
                  <Text style={{ fontWeight: '800', color: theme.text }}>
                    Refazer Cadastro & Onboarding Inicial
                  </Text>
                </View>
              </Pressable>
            </>
          )}

          {tab === 'feedback' && <FeedbackSection />}

          {tab === 'alertas' && (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View style={styles.titleWithIcon}>
                <Ionicons name="notifications-outline" size={20} color={theme.primary} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  Alertas Preventivos Locais (Offline)
                </Text>
              </View>
              {alerts.map((al) => {
                const body =
                  accessibility.languageLevel === 'acessivel'
                    ? al.mensagemAcessivel
                    : al.mensagemTecnica;
                const border =
                  al.severidade === 'urgente'
                    ? theme.dangerBorder
                    : al.severidade === 'atencao'
                    ? theme.warningBorder
                    : theme.successBorder;

                return (
                  <View
                    key={al.id}
                    style={[
                      styles.alertCard,
                      {
                        backgroundColor:
                          al.severidade === 'urgente'
                            ? theme.dangerBg
                            : al.severidade === 'atencao'
                            ? theme.warningBg
                            : theme.successBg,
                        borderColor: border,
                      },
                    ]}
                  >
                    <View style={styles.rowBetween}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '900',
                          color: theme.text,
                          flex: 1,
                        }}
                      >
                        {al.titulo}
                      </Text>
                      <Pressable
                        onPress={() => speak(`${al.titulo}. ${body}`, true)}
                        accessibilityLabel="Ouvir alerta"
                      >
                        <Ionicons name="volume-high" size={20} color={theme.text} />
                      </Pressable>
                    </View>
                    <Text style={{ fontSize: 12, color: theme.text, lineHeight: 18 }}>
                      {body}
                    </Text>

                    {al.lido ? (
                      <View style={styles.ackDoneRow}>
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color={theme.successText}
                        />
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '800',
                            color: theme.successText,
                          }}
                        >
                          Você confirmou estar ciente
                          {al.confirmadoCienteEm
                            ? ` (${new Date(al.confirmadoCienteEm).toLocaleDateString('pt-BR')})`
                            : ''}
                        </Text>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => {
                          markAlertRead(al.id);
                          speak('Confirmado que você está ciente deste alerta.');
                        }}
                        style={[styles.ackBtn, { backgroundColor: border }]}
                      >
                        <Ionicons
                          name="checkmark-done-circle"
                          size={16}
                          color="#FFFFFF"
                        />
                        <Text style={styles.ackBtnText}>
                          Estou ciente da situação
                        </Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
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
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tabBtn: {
    minHeight: 42,
    paddingHorizontal: 14,
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
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ackDoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  ackBtn: {
    marginTop: 6,
    minHeight: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ackBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
});
