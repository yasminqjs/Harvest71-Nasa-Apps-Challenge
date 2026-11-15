import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  BackHandler,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MainTabKey } from '../components/BottomTabBar';
import { ClimaDiaSubscreen } from '../components/subscreens/ClimaDiaSubscreen';
import { HistoricoPlantioSubscreen } from '../components/subscreens/HistoricoPlantioSubscreen';
import { PrevisaoTrimestreSubscreen } from '../components/subscreens/PrevisaoTrimestreSubscreen';
import { ReportarProblemaSubscreen } from '../components/subscreens/ReportarProblemaSubscreen';
import { RotacaoAtualSubscreen } from '../components/subscreens/RotacaoAtualSubscreen';
import { useAccessibility } from '../context/AccessibilityContext';
import { getAppTheme } from '../theme/tokens';
import { formatArea } from '../utils/regionalize';

interface HomeScreenProps {
  onNavigateTab: (tab: MainTabKey) => void;
  onOpenFeedback?: () => void;
  onOpenTutorial?: () => void;
}

type HomeSubscreen = 'clima' | 'historico' | 'trimestre' | 'rotacao' | 'reportar' | null;

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigateTab,
  onOpenFeedback,
  onOpenTutorial,
}) => {
  const { accessibility, activeFarmer, activeFarm, alerts, speak } = useAccessibility();
  const theme = getAppTheme(accessibility);
  const [subscreen, setSubscreen] = useState<HomeSubscreen>(null);
  const [reportStatus, setReportStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!subscreen) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSubscreen(null);
      return true;
    });
    return () => sub.remove();
  }, [subscreen]);

  if (!activeFarm || !activeFarmer) return null;

  const diag = activeFarm.diagnostico;
  const lots = activeFarm.lotes ?? [];
  const primaryProgress =
    lots.length > 0
      ? Math.round(lots.reduce((sum, l) => sum + l.progressoRealPct, 0) / lots.length)
      : diag.rotacaoAtual.progressoPct;
  const historyCount =
    (activeFarmer.historicoCultivoDetalhado?.length ?? 0) ||
    (activeFarmer.historicoCultivo?.length ?? 0);
  const unreadAlerts = alerts.filter((a) => !a.lido).length;

  const buildWhatsappReportText = (): string => {
    const lotsSummary = lots
      .map(
        (l) =>
          `- ${l.nome}: ${l.culturaAtual} (${l.sistema}), progresso ${l.progressoRealPct}% vs ${l.progressoEsperadoPct}% esperado`
      )
      .join('\n');
    return (
      `RELATÓRIO ROÇAVIVA — ${activeFarm.nome}\n` +
      `Produtor(a): ${activeFarmer.tratamento}\n` +
      `Região: ${activeFarm.regiaoNome} (${activeFarm.municipio} - ${activeFarm.estado})\n` +
      `Área: ${formatArea(activeFarm.areaHectares, activeFarm.areaTarefasBa)}\n` +
      `Clima hoje: ${diag.climaDia.tempMaxC}°/${diag.climaDia.tempMinC}°C • Chuva ${diag.climaDia.chuvaHojeMm} mm • Umidade ${diag.climaDia.umidadeRelativaPct}%\n` +
      `Alerta de Seca (NASA): ${diag.modeloB.sinaisAtivos}/4 sinais (${diag.modeloB.nivel})\n` +
      `Lotes ativos:\n${lotsSummary || `- ${activeFarm.culturaPrincipal}`}\n` +
      `Recomendação: ${diag.modeloC.titulo} (${diag.modeloC.explicacaoAcessivel})`
    );
  };

  const handleGenerateZapReport = async () => {
    const message = buildWhatsappReportText();
    setReportStatus('Relatório gerado! Pronto para enviar no WhatsApp.');
    speak('Relatório da roça gerado para envio pelo WhatsApp.', true);
    try {
      const zapUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      const supported = await Linking.canOpenURL(zapUrl).catch(() => false);
      if (supported) {
        await Linking.openURL(zapUrl);
        return;
      }
      await Share.share({
        title: `Relatório RoçaViva — ${activeFarm.nome}`,
        message,
      });
    } catch {
      // Fallback visual permanece na tela
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={styles.container}
    >
      {subscreen === 'clima' ? (
        <ClimaDiaSubscreen
          farm={activeFarm}
          onBack={() => setSubscreen(null)}
          onSpeak={(txt) => speak(txt, true)}
          theme={theme}
        />
      ) : subscreen === 'historico' ? (
        <HistoricoPlantioSubscreen onBack={() => setSubscreen(null)} />
      ) : subscreen === 'trimestre' ? (
        <PrevisaoTrimestreSubscreen
          farm={activeFarm}
          onBack={() => setSubscreen(null)}
          onSpeak={(txt) => speak(txt, true)}
          theme={theme}
        />
      ) : subscreen === 'rotacao' ? (
        <RotacaoAtualSubscreen onBack={() => setSubscreen(null)} />
      ) : subscreen === 'reportar' ? (
        <ReportarProblemaSubscreen onBack={() => setSubscreen(null)} />
      ) : (
        <>
          {/* Grade 2x2 de caixas azuis do diagrama */}
          <View style={styles.gridRow}>
            <Pressable
              onPress={() => setSubscreen('clima')}
              style={[
                styles.blueBox,
                { backgroundColor: theme.surface, borderColor: '#2563EB' },
              ]}
            >
              <Text style={[styles.boxTitle, { color: theme.text }]}>Clima do dia</Text>
              <Ionicons name="sunny" size={34} color="#F59E0B" />
              <Text style={[styles.boxValue, { color: '#2563EB' }]}>
                {diag.climaDia.tempMaxC}° / {diag.climaDia.tempMinC}°C
              </Text>
              <Text style={[styles.boxSub, { color: theme.textMuted }]} numberOfLines={2}>
                {activeFarm.regiaoNome}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setSubscreen('historico')}
              style={[
                styles.blueBox,
                { backgroundColor: theme.surface, borderColor: '#2563EB' },
              ]}
            >
              <Text style={[styles.boxTitle, { color: theme.text }]}>
                Histórico de plantação
              </Text>
              <Ionicons name="trending-up" size={34} color="#2563EB" />
              <Text style={[styles.boxValue, { color: theme.text }]}>
                {historyCount} {historyCount === 1 ? 'registro' : 'registros'}
              </Text>
              <Text style={[styles.boxSub, { color: theme.textMuted }]} numberOfLines={2}>
                Ver e cadastrar rotações
              </Text>
            </Pressable>
          </View>

          <View style={styles.gridRow}>
            <Pressable
              onPress={() => setSubscreen('trimestre')}
              style={[
                styles.blueBox,
                { backgroundColor: theme.surface, borderColor: '#2563EB' },
              ]}
            >
              <Text style={[styles.boxTitle, { color: theme.text }]}>
                Previsão do trimestre
              </Text>
              <View style={styles.trimestreIconRow}>
                <Ionicons name="calendar-outline" size={28} color="#2563EB" />
                <Text style={{ fontSize: 28 }}>{diag.modeloB.emoji}</Text>
              </View>
              <Text
                style={[
                  styles.boxSub,
                  {
                    color:
                      diag.modeloB.sinaisAtivos >= 2
                        ? theme.dangerText
                        : theme.textMuted,
                    fontWeight: '800',
                  },
                ]}
                numberOfLines={2}
              >
                {diag.modeloC.titulo}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setSubscreen('rotacao')}
              style={[
                styles.blueBox,
                { backgroundColor: theme.surface, borderColor: '#2563EB' },
              ]}
            >
              <Text style={[styles.boxTitle, { color: theme.text }]}>Rotação atual</Text>
              <Ionicons name="leaf" size={32} color={theme.primary} />
              <View style={styles.miniProgressWrap}>
                <View style={[styles.miniTrack, { backgroundColor: theme.surfaceMuted }]}>
                  <View
                    style={[
                      styles.miniFill,
                      { width: `${primaryProgress}%`, backgroundColor: theme.primary },
                    ]}
                  />
                </View>
                <Text style={{ fontSize: 11, fontWeight: '900', color: theme.primary }}>
                  {primaryProgress}% progresso ({lots.length || 1} lote{lots.length === 1 ? '' : 's'})
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Caixa "Reportar problemas" */}
          <Pressable
            onPress={() => setSubscreen('reportar')}
            style={[
              styles.reportBtn,
              { backgroundColor: theme.surface, borderColor: '#DC2626' },
            ]}
          >
            <Ionicons name="warning-outline" size={22} color="#DC2626" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '900', color: '#DC2626' }}>
                Reportar problemas
              </Text>
              <Text style={{ fontSize: 11, color: theme.textMuted }}>
                Registrar foto, problema no lote e ler casos parecidos na região
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#DC2626" />
          </Pressable>

          {/* Barra verde: GERAR RELATÓRIO: zap ... */}
          <Pressable
            onPress={handleGenerateZapReport}
            style={[
              styles.zapBar,
              { backgroundColor: theme.surface, borderColor: '#16A34A' },
            ]}
          >
            <View style={styles.zapIconBadge}>
              <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '900', color: '#15803D' }}>
                GERAR RELATÓRIO: WhatsApp
              </Text>
              <Text style={{ fontSize: 11, color: theme.textMuted }}>
                Enviar resumo da roça, lotes e clima pelo Zap
              </Text>
            </View>
            <Ionicons name="share-social-outline" size={20} color="#15803D" />
          </Pressable>

          {reportStatus && (
            <View
              style={[
                styles.statusBox,
                { backgroundColor: theme.successBg, borderColor: theme.successBorder },
              ]}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: theme.successText }}>
                ✓ {reportStatus}
              </Text>
            </View>
          )}

          {/* Atalho discreto para Comunidade se houver alerta de seca ativo */}
          {unreadAlerts > 0 && diag.modeloB.sinaisAtivos >= 2 && (
            <Pressable
              onPress={() => onNavigateTab('comunidade')}
              style={[
                styles.pancsQuickBtn,
                { backgroundColor: theme.warningBg, borderColor: theme.warningBorder },
              ]}
            >
              <Ionicons name="people" size={20} color={theme.warningText} />
              <Text style={{ flex: 1, fontSize: 12, fontWeight: '800', color: theme.warningText }}>
                Ver perguntas e relatos de outros agricultores na Comunidade
              </Text>
              <Ionicons name="chevron-forward" size={18} color={theme.warningText} />
            </Pressable>
          )}

          <View style={styles.supportRow}>
            {onOpenFeedback && (
              <Pressable
                onPress={onOpenFeedback}
                style={[
                  styles.supportBtn,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Ionicons name="chatbox-ellipses-outline" size={18} color={theme.primary} />
                <Text style={{ fontSize: 12, fontWeight: '800', color: theme.text }}>
                  Dar Feedback
                </Text>
              </Pressable>
            )}
            {onOpenTutorial && (
              <Pressable
                onPress={onOpenTutorial}
                style={[
                  styles.supportBtn,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Ionicons name="book-outline" size={18} color="#2563EB" />
                <Text style={{ fontSize: 12, fontWeight: '800', color: theme.text }}>
                  Tutorial
                </Text>
              </Pressable>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 14,
    gap: 12,
    paddingBottom: 26,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  blueBox: {
    flex: 1,
    minHeight: 146,
    borderRadius: 20,
    borderWidth: 2,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  boxTitle: {
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  boxValue: {
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  boxSub: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  trimestreIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniProgressWrap: {
    width: '100%',
    gap: 4,
    alignItems: 'center',
  },
  miniTrack: {
    width: '100%',
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  miniFill: {
    height: '100%',
    borderRadius: 4,
  },
  reportBtn: {
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 2,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  zapBar: {
    minHeight: 62,
    borderRadius: 16,
    borderWidth: 2,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  zapIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBox: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 10,
  },
  pancsQuickBtn: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  supportRow: {
    flexDirection: 'row',
    gap: 10,
  },
  supportBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
