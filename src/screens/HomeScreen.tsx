import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MainTabKey } from '../components/BottomTabBar';
import { useAccessibility } from '../context/AccessibilityContext';
import { getAppTheme } from '../theme/tokens';
import { formatArea, regionalizarTexto } from '../utils/regionalize';

interface HomeScreenProps {
  onNavigateTab: (tab: MainTabKey) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigateTab }) => {
  const {
    accessibility,
    activeFarmer,
    activeFarm,
    registerFieldLog,
    lastSyncMessage,
    speak,
  } = useAccessibility();
  const theme = getAppTheme(accessibility);
  const [showClimateDetail, setShowClimateDetail] = useState(false);
  const [rainFeedback, setRainFeedback] = useState<string | null>(null);

  if (!activeFarm || !activeFarmer) return null;

  const diag = activeFarm.diagnostico;
  const level = accessibility.languageLevel;

  const isDroughtAlert =
    diag.modeloB.nivel === 'alerta' || diag.modeloB.nivel === 'seca_confirmada';
  const isAttention = diag.modeloB.nivel === 'atencao';

  const card2Bg = isDroughtAlert
    ? theme.dangerBg
    : isAttention
    ? theme.warningBg
    : theme.surface;
  const card2Border = isDroughtAlert
    ? theme.dangerBorder
    : isAttention
    ? theme.warningBorder
    : theme.border;

  const handleQuickRain = async (choveu: boolean) => {
    await registerFieldLog({
      tipo: 'chuva_hoje',
      choveuHoje: choveu,
      observacao: choveu
        ? 'Agricultor confirmou chuva hoje na roça'
        : 'Agricultor confirmou tempo seco hoje na roça',
    });
    const msg = choveu
      ? 'Chuva registrada! O balanço de água da roça foi atualizado.'
      : 'Registro salvo: sem chuva hoje na roça.';
    setRainFeedback(msg);
    speak(msg);
  };

  const handleQuickSoil = async (umida: boolean) => {
    await registerFieldLog({
      tipo: 'terra_umida',
      terraUmida: umida,
      observacao: umida ? 'Terra úmida no campo' : 'Terra seca no campo',
    });
    const msg = umida
      ? 'Anotado: a terra está úmida na roça.'
      : 'Anotado: a terra está seca na roça.';
    setRainFeedback(msg);
    speak(msg);
  };

  const handleSpeakSummary = () => {
    const summary = `Hoje em ${activeFarm.regiaoNome}, faz ${diag.climaDia.tempMaxC} graus com ${diag.climaDia.condicao}. ${
      level === 'acessivel'
        ? diag.modeloA.resumoAcessivel
        : diag.modeloA.resumoTecnico
    } ${
      level === 'acessivel'
        ? diag.modeloB.resumoAcessivel
        : diag.modeloB.resumoTecnico
    } Na rotação atual de ${diag.rotacaoAtual.culturas}, faltam ${diag.rotacaoAtual.diasRestantes} dias para a colheita.`;
    speak(summary, true);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.greetingRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: theme.text, fontSize: 16 * theme.scale }]}>
            Olá, {activeFarmer.tratamento}
          </Text>
          <Text style={[styles.farmTag, { color: theme.textMuted }]}>
            {activeFarm.nome} • {formatArea(activeFarm.areaHectares, activeFarm.areaTarefasBa)}
          </Text>
        </View>
        <Pressable
          onPress={handleSpeakSummary}
          style={[
            styles.listenPill,
            { backgroundColor: theme.primary, borderColor: theme.border },
          ]}
        >
          <Ionicons name="volume-high" size={18} color={theme.primaryText} />
          <Text style={[styles.listenPillText, { color: theme.primaryText }]}>
            Ouvir tudo
          </Text>
        </Pressable>
      </View>

      {/* CARD 1 DO WIREFRAME: clima do dia / nome da região */}
      <Pressable
        onPress={() => {
          setShowClimateDetail(true);
          speak(
            level === 'acessivel'
              ? diag.modeloA.resumoAcessivel
              : diag.modeloA.resumoTecnico
          );
        }}
        style={[
          styles.wireframeCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={styles.cardLeftIcon}>
          <Text style={styles.bigEmojiIcon}>{diag.climaDia.icone}</Text>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.cardTitle, { color: theme.text, fontSize: 20 * theme.scale }]}>
              clima do dia
            </Text>
            <Text style={[styles.tempBadge, { color: theme.primary }]}>
              {diag.climaDia.tempMaxC}° / {diag.climaDia.tempMinC}°C
            </Text>
          </View>
          <Text style={[styles.cardSub, { color: theme.textMuted, fontSize: 14 * theme.scale }]}>
            {activeFarm.regiaoNome} ({activeFarm.municipio} - {activeFarm.estado})
          </Text>
          <Text style={[styles.cardHint, { color: theme.text }]}>
            {diag.modeloA.status === 'deficit_confirmado'
              ? '⚠️ Terra perdendo água (toque para ver)'
              : '💧 Água equilibrada na semana • Toque p/ ver'}
          </Text>
        </View>
      </Pressable>

      {/* CARD 2 DO WIREFRAME: previsão trimestre + emoji que muda com alertas */}
      <Pressable
        onPress={() => {
          onNavigateTab('safra');
          speak(
            level === 'acessivel'
              ? diag.modeloB.resumoAcessivel
              : diag.modeloB.resumoTecnico
          );
        }}
        style={[
          styles.wireframeCard,
          { backgroundColor: card2Bg, borderColor: card2Border },
        ]}
      >
        <View style={styles.cardLeftIcon}>
          <Text style={styles.bigEmojiIcon}>📅</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: theme.text, fontSize: 20 * theme.scale }]}>
            previsão trimestre
          </Text>
          <View style={styles.emojiAlertRow}>
            <Text style={styles.reactiveFace}>{diag.modeloB.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.alertLabel,
                  {
                    color: isDroughtAlert
                      ? theme.dangerText
                      : isAttention
                      ? theme.warningText
                      : theme.successText,
                    fontSize: 14 * theme.scale,
                  },
                ]}
              >
                {diag.modeloB.nivel === 'normal'
                  ? 'Sem alertas na roça'
                  : diag.modeloB.nivel === 'atencao'
                  ? 'Atenção: pouca chuva (1 sinal)'
                  : diag.modeloB.nivel === 'alerta'
                  ? 'Alerta de seca (2 sinais)'
                  : 'Seca confirmada! Ver PANCs'}
              </Text>
              <Text style={[styles.cardSubSmall, { color: theme.textMuted }]}>
                {diag.modeloC.titulo}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>

      {/* CARD 3 DO WIREFRAME: rotação atual / count_down da plantação / progresso */}
      <Pressable
        onPress={() => {
          onNavigateTab('safra');
          speak(
            `Rotação atual de ${diag.rotacaoAtual.culturas}. Faltam ${diag.rotacaoAtual.diasRestantes} dias para a colheita, com ${diag.rotacaoAtual.progressoPct}% concluído.`
          );
        }}
        style={[
          styles.wireframeCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={styles.cardLeftIcon}>
          <Text style={styles.bigEmojiIcon}>🌱</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: theme.text, fontSize: 20 * theme.scale }]}>
            rotação atual
          </Text>
          <Text style={[styles.cropTitle, { color: theme.primary, fontSize: 14 * theme.scale }]}>
            {diag.rotacaoAtual.culturas}
          </Text>
          <View style={styles.countdownRow}>
            <Text style={[styles.countdownText, { color: theme.text }]}>
              Faltam {diag.rotacaoAtual.diasRestantes} dias
            </Text>
            <Text style={[styles.progressPct, { color: theme.textMuted }]}>
              {diag.rotacaoAtual.progressoPct}% progresso
            </Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: theme.surfaceMuted }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${diag.rotacaoAtual.progressoPct}%`,
                  backgroundColor: theme.primary,
                },
              ]}
            />
          </View>
        </View>
      </Pressable>

      {/* Detector automático de segurança alimentar quando houver alerta severo */}
      {isDroughtAlert && (
        <Pressable
          onPress={() => onNavigateTab('pancs')}
          style={[
            styles.foodAlertBanner,
            { backgroundColor: theme.warningBg, borderColor: theme.warningBorder },
          ]}
        >
          <Ionicons name="nutrition" size={24} color={theme.warningText} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.foodAlertTitle, { color: theme.warningText }]}>
              Detector de Segurança Alimentar (PANCs Offline)
            </Text>
            <Text style={{ fontSize: 12, color: theme.warningText }}>
              Toque para ver plantas resistentes ao solo da sua terra (palma, umbu, mandacaru, sorgo).
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.warningText} />
        </Pressable>
      )}

      {/* Validação de campo Ground-Truth em 1 toque (salvo no SQLite sync_queue) */}
      <View
        style={[
          styles.fieldCheckCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.fieldTitle, { color: theme.text }]}>
          Validação de campo (funciona sem internet):
        </Text>
        <View style={styles.fieldBtnRow}>
          <Pressable
            onPress={() => handleQuickRain(true)}
            style={[
              styles.fieldBtn,
              { backgroundColor: theme.successBg, borderColor: theme.successBorder },
            ]}
          >
            <Text style={[styles.fieldBtnText, { color: theme.successText }]}>
              🌧️ Choveu hoje
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleQuickRain(false)}
            style={[
              styles.fieldBtn,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.fieldBtnText, { color: theme.text }]}>
              ☀️ Não choveu
            </Text>
          </Pressable>
        </View>
        <View style={styles.fieldBtnRow}>
          <Pressable
            onPress={() => handleQuickSoil(true)}
            style={[
              styles.fieldBtn,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.fieldBtnText, { color: theme.text }]}>
              💧 Terra úmida
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleQuickSoil(false)}
            style={[
              styles.fieldBtn,
              { backgroundColor: theme.warningBg, borderColor: theme.warningBorder },
            ]}
          >
            <Text style={[styles.fieldBtnText, { color: theme.warningText }]}>
              🏜️ Terra seca
            </Text>
          </Pressable>
        </View>
        {(rainFeedback || lastSyncMessage) && (
          <Text style={[styles.feedbackText, { color: theme.primary }]}>
            ✓ {rainFeedback ?? lastSyncMessage}
          </Text>
        )}
      </View>

      {/* Modal do Balanço Hídrico Semanal */}
      <Modal
        visible={showClimateDetail}
        transparent
        animationType="slide"
        onRequestClose={() => setShowClimateDetail(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                ☀️ Água para a lavoura (Balanço)
              </Text>
              <Pressable onPress={() => setShowClimateDetail(false)}>
                <Ionicons name="close-circle" size={28} color={theme.text} />
              </Pressable>
            </View>

            <Text style={[styles.modalLead, { color: theme.text }]}>
              {regionalizarTexto(
                level === 'acessivel'
                  ? diag.modeloA.resumoAcessivel
                  : diag.modeloA.resumoTecnico,
                level,
                activeFarmer.tratamento
              )}
            </Text>

            <View style={[styles.metricGrid, { backgroundColor: theme.bg }]}>
              <Text style={[styles.metricLine, { color: theme.text }]}>
                • Chuva semanal (IMERG):{' '}
                <Text style={{ fontWeight: '900' }}>{diag.modeloA.chuvaImergMm} mm</Text>
              </Text>
              <Text style={[styles.metricLine, { color: theme.text }]}>
                • Perda atmosférica × Kc ({diag.modeloA.kcAplicado}):{' '}
                <Text style={{ fontWeight: '900' }}>{diag.modeloA.demandaCulturaMm} mm</Text>
              </Text>
              <Text style={[styles.metricLine, { color: theme.text }]}>
                • Saldo hídrico:{' '}
                <Text style={{ fontWeight: '900' }}>{diag.modeloA.saldoHidricoMm} mm</Text>
              </Text>
              <Text style={[styles.metricLine, { color: theme.text }]}>
                • Umidade do solo (SMAP):{' '}
                <Text style={{ fontWeight: '900' }}>{diag.modeloA.smapTendencia}</Text>
              </Text>
            </View>

            <Pressable
              onPress={() =>
                speak(
                  level === 'acessivel'
                    ? diag.modeloA.resumoAcessivel
                    : diag.modeloA.resumoTecnico,
                  true
                )
              }
              style={[styles.speakModalBtn, { backgroundColor: theme.primary }]}
            >
              <Ionicons name="volume-high" size={20} color={theme.primaryText} />
              <Text style={{ color: theme.primaryText, fontWeight: '800' }}>
                Ouvir explicação
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 14,
    gap: 12,
    paddingBottom: 24,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  greeting: {
    fontWeight: '900',
  },
  farmTag: {
    fontSize: 12,
    fontWeight: '700',
  },
  listenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    minHeight: 42,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  listenPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  wireframeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 2,
    padding: 16,
    gap: 14,
    minHeight: 112,
  },
  cardLeftIcon: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigEmojiIcon: {
    fontSize: 42,
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  cardTitle: {
    fontWeight: '900',
  },
  tempBadge: {
    fontSize: 14,
    fontWeight: '900',
  },
  cardSub: {
    fontWeight: '700',
  },
  cardSubSmall: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  cardHint: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  emojiAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reactiveFace: {
    fontSize: 38,
  },
  alertLabel: {
    fontWeight: '900',
  },
  cropTitle: {
    fontWeight: '800',
  },
  countdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countdownText: {
    fontSize: 13,
    fontWeight: '800',
  },
  progressPct: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    height: 10,
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  foodAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 2,
    borderRadius: 18,
    padding: 12,
  },
  foodAlertTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  fieldCheckCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 14,
    gap: 8,
  },
  fieldTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  fieldBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  fieldBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  fieldBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 24,
    borderWidth: 2,
    padding: 18,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    flex: 1,
  },
  modalLead: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  metricGrid: {
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  metricLine: {
    fontSize: 13,
    lineHeight: 19,
  },
  speakModalBtn: {
    minHeight: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
