import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Linking, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useLanguage } from '../i18n/Language';
import { Pressable, Text } from '../i18n/native';
import { MainTabKey } from '../components/BottomTabBar';
import { FeatureBadge } from '../components/FeatureBadge';
import { VoiceReadBar } from '../components/VoiceReadBar';
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
      ? `Overview tab for ${activeFarm.nome} in ${activeFarm.municipio}. Today's weather: max ${diag.climaDia.tempMaxC} degrees, min ${diag.climaDia.tempMinC} degrees, rainfall ${diag.climaDia.chuvaHojeMm} millimeters, humidity ${diag.climaDia.umidadeRelativaPct} percent. Three-month outlook: ${diag.modeloC.titulo}. Current rotation progress: ${primaryProgress} percent across ${lots.length} plots. Soil pH ${diag.soloSoilGrids.ph}.`
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
      .map(
        (l) =>
          `- ${l.nome}: ${l.culturaAtual} (${l.sistema}), progresso ${l.progressoRealPct}% vs ${l.progressoEsperadoPct}% esperado`
      )
      .join('\n');
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
        title: `Relatório Harvest71 — ${activeFarm.nome}`,
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
              { borderLeftColor: yellow.border, borderBottomColor: theme.border },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Text style={[styles.summaryTitle, { color: theme.text, fontSize: 17 * theme.scale, flex: 1 }]}>
                Resumo Local da Roça
              </Text>
              <FeatureBadge color="amarelo" />
            </View>
            <Text style={{ fontSize: 11.5, color: theme.textMuted }} numberOfLines={1}>
              {activeFarm.nome} • {activeFarm.municipio}-{activeFarm.estado} •{' '}
              {formatArea(activeFarm.areaHectares, activeFarm.areaTarefasBa)}
            </Text>
          </View>

          <VoiceReadBar
            text={resumoVoiceText}
            theme={theme}
            label={en ? 'Read Overview tab aloud' : 'Ouvir leitura da aba Resumo'}
          />

          {/* Grade 2x2 enxuta: Ver informações básicas */}
          <View style={styles.gridRow}>
            <Pressable
              onPress={() => setSubscreen('clima')}
              style={[
                styles.blueBox,
                { backgroundColor: theme.surface, borderColor: yellow.border },
              ]}
            >
              <Text style={[styles.boxTitle, { color: theme.text }]}>Clima do dia</Text>
              <Ionicons name="sunny" size={26} color="#CA8A04" />
              <Text style={[styles.boxValue, { color: '#92400E' }]}>
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
              <Text style={[styles.boxTitle, { color: theme.text }]}>
                Previsão do trimestre
              </Text>
              <View style={styles.trimestreIconRow}>
                <Ionicons name="calendar-outline" size={22} color="#CA8A04" />
                <Text style={{ fontSize: 22 }}>{diag.modeloB.emoji}</Text>
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
              <Ionicons name="leaf" size={24} color={theme.primary} />
              <View style={styles.miniProgressWrap}>
                <View style={[styles.miniTrack, { backgroundColor: theme.surfaceMuted }]}>
                  <View
                    style={[
                      styles.miniFill,
                      { width: `${primaryProgress}%`, backgroundColor: theme.primary },
                    ]}
                  />
                </View>
                <Text style={{ fontSize: 10.5, fontWeight: '900', color: theme.primary }}>
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
              <Text style={[styles.boxTitle, { color: theme.text }]}>
                Histórico da terra
              </Text>
              <Ionicons name="layers-outline" size={24} color="#2563EB" />
              <Text style={[styles.boxValue, { color: theme.text }]}>
                pH {diag.soloSoilGrids.ph} • {historyCount} reg.
              </Text>
              <Text style={[styles.boxSub, { color: theme.textMuted }]} numberOfLines={1}>
                NASA POWER + Landsat
              </Text>
            </Pressable>
          </View>

          {/* Atalhos + detalhes técnicos da fazenda expansíveis */}
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

          {/* Barra verde: GERAR RELATÓRIO: zap ... */}
          <Pressable
            onPress={handleGenerateZapReport}
            style={[
              styles.zapBar,
              { backgroundColor: theme.surface, borderColor: '#16A34A' },
            ]}
          >
            <View style={styles.zapIconBadge}>
              <Ionicons name="logo-whatsapp" size={19} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13.5, fontWeight: '900', color: '#15803D' }}>
                GERAR RELATÓRIO: WhatsApp
              </Text>
              <Text style={{ fontSize: 11, color: theme.textMuted }} numberOfLines={1}>
                Enviar resumo da roça, lotes e clima pelo Zap
              </Text>
            </View>
            <Ionicons name="share-social-outline" size={18} color="#15803D" />
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
    padding: 12,
    gap: 8,
    paddingBottom: 20,
  },
  summaryBanner: {
    borderLeftWidth: 3,
    borderBottomWidth: 1,
    paddingLeft: 10,
    paddingBottom: 8,
    gap: 2,
  },
  summaryTitle: {
    fontWeight: '900',
  },
  expandRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  modelBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 4,
  },
  quickNavRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickNavBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  blueBox: {
    flex: 1,
    minHeight: 104,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  boxTitle: {
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  boxValue: {
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  boxSub: {
    fontSize: 10.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  trimestreIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniProgressWrap: {
    width: '100%',
    gap: 4,
    alignItems: 'center',
  },
  miniTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  miniFill: {
    height: '100%',
    borderRadius: 3,
  },
  reportBtn: {
    minHeight: 50,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  zapBar: {
    minHeight: 52,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  zapIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
  },
  pancsQuickBtn: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  supportRow: {
    flexDirection: 'row',
    gap: 8,
  },
  supportBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
