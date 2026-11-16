import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Linking, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useLanguage } from '../i18n/Language';
import { Pressable, Text } from '../i18n/native';
import { translate } from '../i18n/translate';
import { MainTabKey } from '../components/BottomTabBar';
import { FeatureBadge } from '../components/FeatureBadge';
import { VoiceReadBar } from '../components/VoiceReadBar';
import { ClimaDiaSubscreen } from '../components/subscreens/ClimaDiaSubscreen';
import { HistoricoPlantioSubscreen } from '../components/subscreens/HistoricoPlantioSubscreen';
import { PrevisaoTrimestreSubscreen } from '../components/subscreens/PrevisaoTrimestreSubscreen';
import { useAccessibility } from '../context/AccessibilityContext';
import { FEATURE_COLOR_STYLES } from '../models/farmArchitecture';
import { getAppTheme } from '../theme/tokens';
import { useResponsiveLayout } from '../theme/responsive';
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
  const { width, contentMaxWidth } = useResponsiveLayout();
  const isWideWeb = width >= 820;
  const { language } = useLanguage();
  const en = language === 'en';
  const theme = getAppTheme(accessibility);
  const yellow = FEATURE_COLOR_STYLES.amarelo;
  const [subscreen, setSubscreen] = useState<HomeSubscreen>(null);
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  const [showFarmDetails, setShowFarmDetails] = useState(false);
  const autoSpokenRef = useRef(false);

  const diag = activeFarm?.diagnostico;
  const lots = activeFarm?.lotes ?? [];
  const primaryProgress =
    lots.length > 0
      ? Math.round(lots.reduce((sum, l) => sum + l.progressoRealPct, 0) / lots.length)
      : diag?.rotacaoAtual.progressoPct ?? 0;

  const resumoVoiceText = activeFarm && diag
    ? en
      ? `Overview tab for ${activeFarm.nome} in ${activeFarm.municipio}. Today's weather: max ${diag.climaDia.tempMaxC} degrees, min ${diag.climaDia.tempMinC} degrees, rainfall ${diag.climaDia.chuvaHojeMm} millimeters, humidity ${diag.climaDia.umidadeRelativaPct} percent. Three-month outlook: ${translate(diag.modeloC.titulo, 'en')}. Current rotation progress: ${primaryProgress} percent across ${lots.length} plots. Soil pH ${diag.soloSoilGrids.ph}.`
      : `Aba Resumo de ${activeFarm.nome}, em ${activeFarm.municipio}. Clima hoje: máxima de ${diag.climaDia.tempMaxC} e mínima de ${diag.climaDia.tempMinC} graus, chuva de ${diag.climaDia.chuvaHojeMm} milímetros, umidade ${diag.climaDia.umidadeRelativaPct}%. Previsão do trimestre: ${diag.modeloC.titulo}. Rotação atual em ${primaryProgress}% de progresso em ${lots.length} lotes. Solo com pH ${diag.soloSoilGrids.ph}.`
    : '';

  useEffect(() => {
    if (!accessibility.voiceGuidanceEnabled || autoSpokenRef.current || !resumoVoiceText || subscreen) {
      return;
    }
    autoSpokenRef.current = true;
    speak(resumoVoiceText);
  }, [accessibility.voiceGuidanceEnabled, resumoVoiceText, subscreen, speak]);

  useEffect(() => {
    if (!subscreen) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSubscreen(null);
      return true;
    });
    return () => sub.remove();
  }, [subscreen]);

  if (!activeFarm || !activeFarmer) return null;

  const historyCount =
    (activeFarmer.historicoCultivoDetalhado?.length ?? 0) ||
    (activeFarmer.historicoCultivo?.length ?? 0);
  const regionalEventsCount =
    farmArchitecture?.acontecimentosDaRegiao.eventos.length ?? 0;

  const buildWhatsappReportText = (): string => {
    const lotsSummary = lots
      .map((l) =>
        en
          ? `- ${l.nome}: ${translate(l.culturaAtual, 'en')} (${l.sistema}), progress ${l.progressoRealPct}% vs ${l.progressoEsperadoPct}% expected`
          : `- ${l.nome}: ${l.culturaAtual} (${l.sistema}), progresso ${l.progressoRealPct}% vs ${l.progressoEsperadoPct}% esperado`
      )
      .join('\n');
    if (en) {
      return (
        `HARVEST71 REPORT — ${activeFarm.nome}\n` +
        `Farmer: ${activeFarmer.tratamento}\n` +
        `Region: ${activeFarm.regiaoNome} (${activeFarm.municipio} - ${activeFarm.estado})\n` +
        `Area: ${formatArea(activeFarm.areaHectares, activeFarm.areaTarefasBa)}\n` +
        `Today's weather: ${diag.climaDia.tempMaxC}°/${diag.climaDia.tempMinC}°C • Rain ${diag.climaDia.chuvaHojeMm} mm • Humidity ${diag.climaDia.umidadeRelativaPct}%\n` +
        `Drought Alert (NASA): ${diag.modeloB.sinaisAtivos}/4 signals (${diag.modeloB.nivel})\n` +
        `Active plots:\n${lotsSummary || `- ${translate(activeFarm.culturaPrincipal, 'en')}`}\n` +
        `Recommendation: ${translate(diag.modeloC.titulo, 'en')} (${translate(diag.modeloC.explicacaoAcessivel, 'en')})`
      );
    }
    return (
      `RELATÓRIO HARVEST71 — ${activeFarm.nome}\n` +
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
    setReportStatus(
      en
        ? 'Report generated! Ready to share on WhatsApp.'
        : 'Relatório gerado! Pronto para enviar no WhatsApp.'
    );
    speak(
      en
        ? 'Farm report generated for WhatsApp sharing.'
        : 'Relatório da roça gerado para envio pelo WhatsApp.',
      true
    );
    try {
      const zapUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      const supported = await Linking.canOpenURL(zapUrl).catch(() => false);
      if (supported) {
        await Linking.openURL(zapUrl);
        return;
      }
      await Share.share({
        title: en ? `Harvest71 Report — ${activeFarm.nome}` : `Relatório Harvest71 — ${activeFarm.nome}`,
        message,
      });
    } catch {
      // Fallback visual permanece na tela
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={[
        styles.container,
        isWideWeb && styles.containerWide,
        { maxWidth: contentMaxWidth },
      ]}
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
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                borderLeftColor: yellow.border,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Text style={[styles.summaryTitle, { color: theme.text, fontSize: 17 * theme.scale, flex: 1 }]}>
                Resumo Local da Roça
              </Text>
              <FeatureBadge color="amarelo" />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="location-outline" size={13} color={theme.textMuted} />
              <Text style={{ fontSize: 12, color: theme.textMuted, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                {activeFarm.nome} • {activeFarm.municipio}-{activeFarm.estado} •{' '}
                {formatArea(activeFarm.areaHectares, activeFarm.areaTarefasBa)}
              </Text>
            </View>
          </View>

          <VoiceReadBar
            text={resumoVoiceText}
            theme={theme}
            label={en ? 'Read Overview tab aloud' : 'Ouvir leitura da aba Resumo'}
          />

          {/* Grade de indicadores: 4 colunas no Web Desktop, 2x2 no celular */}
          <View style={isWideWeb ? styles.metricsGridWide : styles.metricsGridStack}>
            <View style={[styles.gridRow, isWideWeb && styles.gridRowWide]}>
              <Pressable
                onPress={() => setSubscreen('clima')}
                style={[
                  styles.blueBox,
                  { backgroundColor: theme.surface, borderColor: yellow.border },
                ]}
              >
                <View style={styles.cardTopRow}>
                  <View
                    style={[
                      styles.cardIconCircle,
                      { backgroundColor: accessibility.highContrast ? theme.surfaceMuted : '#FEF3C7' },
                    ]}
                  >
                    <Ionicons name="sunny" size={20} color="#CA8A04" />
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={theme.textMuted} />
                </View>
                <Text style={[styles.boxTitle, { color: theme.text }]}>Clima do dia</Text>
                <Text style={[styles.boxValue, { color: accessibility.highContrast ? theme.primary : '#92400E' }]}>
                  {diag.climaDia.tempMaxC}° / {diag.climaDia.tempMinC}°C
                </Text>
                <Text style={[styles.boxSub, { color: theme.textMuted }]} numberOfLines={1}>
                  Chuva {diag.climaDia.chuvaHojeMm} mm • Umid {diag.climaDia.umidadeRelativaPct}%
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setSubscreen('trimestre')}
                style={[
                  styles.blueBox,
                  { backgroundColor: theme.surface, borderColor: yellow.border },
                ]}
              >
                <View style={styles.cardTopRow}>
                  <View
                    style={[
                      styles.cardIconCircle,
                      { backgroundColor: accessibility.highContrast ? theme.surfaceMuted : '#FEF3C7' },
                    ]}
                  >
                    <Ionicons name="calendar-outline" size={19} color="#CA8A04" />
                  </View>
                  <View style={styles.trimestreIconRow}>
                    <Text style={{ fontSize: 18 }}>{diag.modeloB.emoji}</Text>
                    <Ionicons name="chevron-forward" size={15} color={theme.textMuted} />
                  </View>
                </View>
                <Text style={[styles.boxTitle, { color: theme.text }]}>
                  Previsão do trimestre
                </Text>
                <Text
                  style={[
                    styles.boxSub,
                    {
                      color:
                        diag.modeloB.sinaisAtivos >= 2
                          ? theme.dangerText
                          : theme.textMuted,
                      fontWeight: '800',
                      textAlign: 'left',
                    },
                  ]}
                  numberOfLines={2}
                >
                  {diag.modeloC.titulo}
                </Text>
              </Pressable>
            </View>

            <View style={[styles.gridRow, isWideWeb && styles.gridRowWide]}>
              <Pressable
                onPress={onOpenCurrentRotation}
                style={[
                  styles.blueBox,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <View style={styles.cardTopRow}>
                  <View
                    style={[
                      styles.cardIconCircle,
                      { backgroundColor: accessibility.highContrast ? theme.surfaceMuted : theme.successBg },
                    ]}
                  >
                    <Ionicons name="leaf" size={19} color={theme.primary} />
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={theme.textMuted} />
                </View>
                <Text style={[styles.boxTitle, { color: theme.text }]}>Rotação atual</Text>
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
                    {primaryProgress}% ({lots.length} lote{lots.length === 1 ? '' : 's'})
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
                <View style={styles.cardTopRow}>
                  <View
                    style={[
                      styles.cardIconCircle,
                      { backgroundColor: accessibility.highContrast ? theme.surfaceMuted : '#DBEAFE' },
                    ]}
                  >
                    <Ionicons name="layers-outline" size={19} color="#2563EB" />
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={theme.textMuted} />
                </View>
                <Text style={[styles.boxTitle, { color: theme.text }]}>
                  Histórico da terra
                </Text>
                <Text style={[styles.boxValue, { color: theme.text }]}>
                  pH {diag.soloSoilGrids.ph} • {historyCount} reg.
                </Text>
                <Text style={[styles.boxSub, { color: theme.textMuted }]} numberOfLines={1}>
                  NASA POWER + Landsat
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Atalhos + detalhes técnicos + relatório em 2 colunas no Web Desktop */}
          <View style={isWideWeb ? styles.bottomColumnsWide : styles.bottomColumnsStack}>
            <View style={isWideWeb ? styles.bottomCol : styles.bottomColStack}>
              <View style={styles.quickNavRow}>
                <Pressable
                  onPress={() => onNavigateTab('plantacao')}
                  style={[
                    styles.quickNavBtn,
                    { backgroundColor: '#DCFCE7', borderColor: '#16A34A' },
                  ]}
                >
                  <Ionicons name="leaf" size={15} color="#14532D" />
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
                  <Ionicons name="people" size={15} color="#7F1D1D" />
                  <Text style={{ fontSize: 12, fontWeight: '900', color: '#7F1D1D' }}>
                    Ir para Comunidade
                  </Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => setShowFarmDetails((v) => !v)}
                style={[styles.expandRowBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
              >
                <Ionicons name="information-circle-outline" size={16} color={theme.primary} />
                <Text style={{ fontSize: 12, fontWeight: '800', color: theme.primary, flex: 1 }}>
                  Visão Geral da Fazenda (Dados Atuais)
                </Text>
                <Ionicons name={showFarmDetails ? 'chevron-up' : 'chevron-down'} size={16} color={theme.primary} />
              </Pressable>

              {showFarmDetails && (
                <View style={[styles.modelBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
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
                </View>
              )}
            </View>

            <View style={isWideWeb ? styles.bottomCol : styles.bottomColStack}>
              {/* Barra verde: GERAR RELATÓRIO: zap ... */}
              <Pressable
                onPress={handleGenerateZapReport}
                style={[
                  styles.zapBar,
                  {
                    backgroundColor: accessibility.highContrast ? theme.surface : '#F0FDF4',
                    borderColor: '#16A34A',
                  },
                ]}
              >
                <View style={styles.zapIconBadge}>
                  <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '900', color: accessibility.highContrast ? theme.text : '#15803D' }}>
                    GERAR RELATÓRIO: WhatsApp
                  </Text>
                  <Text style={{ fontSize: 11.5, color: theme.textMuted }} numberOfLines={1}>
                    Enviar resumo da roça, lotes e clima pelo Zap
                  </Text>
                </View>
                <Ionicons name="share-social-outline" size={18} color={accessibility.highContrast ? theme.primary : '#15803D'} />
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
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: 1160,
    width: '100%',
    alignSelf: 'center',
    padding: 14,
    gap: 10,
    paddingBottom: 24,
  },
  containerWide: {
    padding: 16,
    gap: 10,
  },
  metricsGridStack: {
    gap: 10,
  },
  metricsGridWide: {
    flexDirection: 'row',
    gap: 14,
  },
  gridRowWide: {
    flex: 1,
    gap: 14,
  },
  bottomColumnsStack: {
    gap: 10,
  },
  bottomColumnsWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  bottomColStack: {
    gap: 10,
  },
  bottomCol: {
    flex: 1,
    gap: 10,
  },
  summaryBanner: {
    borderRadius: 18,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 14,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  summaryTitle: {
    fontWeight: '900',
  },
  expandRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modelBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 5,
  },
  quickNavRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickNavBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  blueBox: {
    flex: 1,
    minHeight: 118,
    borderRadius: 16,
    borderWidth: 1,
    padding: 13,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  boxValue: {
    fontSize: 15,
    fontWeight: '900',
  },
  boxSub: {
    fontSize: 11,
    fontWeight: '700',
  },
  trimestreIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniProgressWrap: {
    width: '100%',
    gap: 5,
    alignItems: 'flex-start',
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
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  zapBar: {
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#16A34A',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
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
    borderWidth: 1,
    padding: 10,
  },
  pancsQuickBtn: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
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
