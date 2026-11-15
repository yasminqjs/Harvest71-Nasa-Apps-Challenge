import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { BackHandler, Linking, ScrollView, Share, StyleSheet, View } from 'react-native';
import { Pressable, Text } from '../i18n/native';
import { MainTabKey } from '../components/BottomTabBar';
import { FeatureBadge } from '../components/FeatureBadge';
import { ClimaDiaSubscreen } from '../components/subscreens/ClimaDiaSubscreen';
import { HistoricoPlantioSubscreen } from '../components/subscreens/HistoricoPlantioSubscreen';
import { PrevisaoTrimestreSubscreen } from '../components/subscreens/PrevisaoTrimestreSubscreen';
import { useAccessibility } from '../context/AccessibilityContext';
import { FEATURE_COLOR_STYLES } from '../models/farmArchitecture';
import { getAppTheme } from '../theme/tokens';
import { formatArea } from '../utils/regionalize';

interface HomeScreenProps {
  onNavigateTab: (tab: MainTabKey) => void;
  onOpenCurrentRotation: () => void;
  onOpenFeedback?: () => void;
  onOpenTutorial?: () => void;
}

type HomeSubscreen = 'clima' | 'historico' | 'trimestre' | null;

/**
 * @featureColor AMARELO
 * @featureModule Visualizador de informações locais (temperatura, etc)
 * @userAction Ver informações básicas (Aba Resumo)
 */
export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigateTab,
  onOpenCurrentRotation,
  onOpenFeedback,
  onOpenTutorial,
}) => {
  const { accessibility, activeFarmer, activeFarm, farmArchitecture, speak } =
    useAccessibility();
  const theme = getAppTheme(accessibility);
  const yellow = FEATURE_COLOR_STYLES.amarelo;
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
  const regionalEventsCount =
    farmArchitecture?.acontecimentosDaRegiao.eventos.length ?? 0;

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
      ) : (
        <>
          <View
            style={[
              styles.summaryBanner,
              { backgroundColor: theme.surface, borderColor: yellow.border },
            ]}
          >
            <FeatureBadge color="amarelo" />
            <Text style={[styles.summaryTitle, { color: theme.text, fontSize: 18 * theme.scale }]}>
              Resumo Local da Roça
            </Text>
            <Text style={{ fontSize: 12, color: theme.textMuted }}>
              {activeFarm.nome} • {activeFarm.regiaoNome} ({activeFarm.municipio} -{' '}
              {activeFarm.estado}) • {formatArea(activeFarm.areaHectares, activeFarm.areaTarefasBa)}
            </Text>
          </View>

          {/* Grade 2x2: Ver informações básicas (Visualizador de informações locais) */}
          <View style={styles.gridRow}>
            <Pressable
              onPress={() => setSubscreen('clima')}
              style={[
                styles.blueBox,
                { backgroundColor: theme.surface, borderColor: yellow.border },
              ]}
            >
              <Text style={[styles.boxTitle, { color: theme.text }]}>Clima do dia</Text>
              <Ionicons name="sunny" size={34} color="#CA8A04" />
              <Text style={[styles.boxValue, { color: '#92400E' }]}>
                {diag.climaDia.tempMaxC}° / {diag.climaDia.tempMinC}°C
              </Text>
              <Text style={[styles.boxSub, { color: theme.textMuted }]} numberOfLines={2}>
                Chuva {diag.climaDia.chuvaHojeMm} mm • Umidade {diag.climaDia.umidadeRelativaPct}%
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setSubscreen('trimestre')}
              style={[
                styles.blueBox,
                { backgroundColor: theme.surface, borderColor: yellow.border },
              ]}
            >
              <Text style={[styles.boxTitle, { color: theme.text }]}>
                Previsão do trimestre
              </Text>
              <View style={styles.trimestreIconRow}>
                <Ionicons name="calendar-outline" size={28} color="#CA8A04" />
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
          </View>

          <View style={styles.gridRow}>
            <Pressable
              onPress={onOpenCurrentRotation}
              style={[
                styles.blueBox,
                { backgroundColor: theme.surface, borderColor: theme.border },
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
                  {primaryProgress}% progresso ({lots.length} plantação
                  {lots.length === 1 ? '' : 'ões'})
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setSubscreen('historico')}
              style={[
                styles.blueBox,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.boxTitle, { color: theme.text }]}>
                Histórico da terra
              </Text>
              <Ionicons name="layers-outline" size={32} color="#2563EB" />
              <Text style={[styles.boxValue, { color: theme.text }]}>
                pH {diag.soloSoilGrids.ph} • {historyCount} reg.
              </Text>
              <Text style={[styles.boxSub, { color: theme.textMuted }]} numberOfLines={2}>
                NASA POWER + SRTM/Landsat 30 m
              </Text>
            </Pressable>
          </View>

          {/* Resumo da Modelagem da Fazenda + atalhos para Plantação e Comunidade */}
          <View
            style={[
              styles.modelBox,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={{ fontSize: 13, fontWeight: '900', color: theme.text }}>
              Visão Geral da Fazenda (Dados Atuais)
            </Text>
            <Text style={{ fontSize: 11, color: theme.textMuted }}>
              • Variáveis da fazenda (usuário): água ({activeFarmer.waterAccess}) • objetivo (
              {activeFarmer.objective})
            </Text>
            <Text style={{ fontSize: 11, color: theme.textMuted }}>
              • Plantações ({lots.length}): {activeFarm.culturaPrincipal} • EcoCrop + NASA POWER
            </Text>
            <Text style={{ fontSize: 11, color: theme.textMuted }}>
              • Acontecimentos da região (comunidade): {regionalEventsCount} relatos locais
            </Text>
            <View style={styles.quickNavRow}>
              <Pressable
                onPress={() => onNavigateTab('plantacao')}
                style={[
                  styles.quickNavBtn,
                  { backgroundColor: '#DCFCE7', borderColor: '#16A34A' },
                ]}
              >
                <Ionicons name="leaf" size={16} color="#14532D" />
                <Text style={{ fontSize: 12, fontWeight: '900', color: '#14532D' }}>
                  Ir para Plantação
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onNavigateTab('comunidade')}
                style={[
                  styles.quickNavBtn,
                  { backgroundColor: '#FEE2E2', borderColor: '#F87171' },
                ]}
              >
                <Ionicons name="people" size={16} color="#7F1D1D" />
                <Text style={{ fontSize: 12, fontWeight: '900', color: '#7F1D1D' }}>
                  Ir para Comunidade
                </Text>
              </Pressable>
            </View>
          </View>

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
  summaryBanner: {
    borderRadius: 18,
    borderWidth: 2,
    padding: 12,
    gap: 6,
  },
  summaryTitle: {
    fontWeight: '900',
  },
  modelBox: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
    gap: 6,
  },
  quickNavRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  quickNavBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
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
