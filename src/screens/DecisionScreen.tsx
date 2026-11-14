import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';
import { analyzeLeafImageOffline } from '../services/leafAnalyzer';
import { getAppTheme } from '../theme/tokens';
import { formatArea, formatCurrencyBRL, regionalizarTexto } from '../utils/regionalize';

const ROTATION_OPTIONS = [
  'Feijão-Caupi + Mandioca',
  'Feijão-Caupi + Milho',
  'Feijão-Caupi + Sorgo + Palma',
];

export const DecisionScreen: React.FC = () => {
  const {
    accessibility,
    activeFarmer,
    activeFarm,
    lastLeafAnalysis,
    saveLeafAnalysis,
    simulateRotation,
    speak,
  } = useAccessibility();

  const theme = getAppTheme(accessibility);
  const [pronafPreview, setPronafPreview] = useState<string | null>(null);
  const [analyzingLeaf, setAnalyzingLeaf] = useState(false);

  if (!activeFarm || !activeFarmer) return null;

  const d = activeFarm.diagnostico;
  const level = accessibility.languageLevel;
  const ha = activeFarm.areaHectares;

  const mainCrop =
    d.culturasRecomendadas.find((c) =>
      activeFarm.culturaPrincipal.toLowerCase().includes(c.nome.split(' ')[0].toLowerCase())
    ) ?? d.culturasRecomendadas[0];

  const prodTotalKg = Math.round(mainCrop.produtividadeKgPorHa * ha);
  const custoTotal = Math.round(mainCrop.custoInsumosPorHa * ha);
  const receitaBruta = Math.round(prodTotalKg * mainCrop.precoMedioKg);
  const margemEstimada = receitaBruta - custoTotal;

  const handleOpenLeafCamera = async () => {
    setAnalyzingLeaf(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      let res: ImagePicker.ImagePickerResult;

      if (perm.granted) {
        res = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.35,
          base64: true,
        });
      } else {
        res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.35,
          base64: true,
        });
      }

      if (!res.canceled && res.assets?.[0]?.uri) {
        const asset = res.assets[0];
        const analysis = await analyzeLeafImageOffline(
          asset.uri,
          undefined,
          asset.base64
        );
        await saveLeafAnalysis(analysis);
        speak(
          `${analysis.titulo}. ${
            level === 'acessivel'
              ? analysis.diagnosticoAcessivel
              : analysis.diagnosticoTecnico
          } ${analysis.acaoRecomendada}`,
          true
        );
      }
    } catch {
      const fallback = await analyzeLeafImageOffline(
        'local-sample://folha',
        d.modeloB.sinaisAtivos >= 2 ? 'amarelada' : 'saudavel'
      );
      await saveLeafAnalysis(fallback);
      speak(fallback.diagnosticoAcessivel, true);
    } finally {
      setAnalyzingLeaf(false);
    }
  };

  const handleSimulateLeafTest = async (profile: 'saudavel' | 'amarelada') => {
    const analysis = await analyzeLeafImageOffline(
      `sample-${profile}://folha`,
      profile
    );
    await saveLeafAnalysis(analysis);
    speak(`${analysis.titulo}. ${analysis.diagnosticoAcessivel}`, true);
  };

  const buildShareReport = () => {
    return [
      `🌱 *RELATÓRIO TÉCNICO ROÇAVIVA — NASA FIELD SHIFT*`,
      `Produtor(a): ${activeFarmer.tratamento} (${activeFarmer.nome})`,
      `Propriedade: ${activeFarm.nome} — ${activeFarm.municipio}/${activeFarm.estado}`,
      `Área demarcada: ${formatArea(activeFarm.areaHectares, activeFarm.areaTarefasBa)}`,
      `Solo (ISRIC SoilGrids): pH ${d.soloSoilGrids.ph} • ${d.soloSoilGrids.textura}`,
      ``,
      `1) Balanço Hídrico (IMERG/POWER/SMAP): ${d.modeloA.resumoTecnico}`,
      `2) Cascata de Seca: ${d.modeloB.emoji} ${d.modeloB.resumoTecnico}`,
      `3) Janela de Plantio: ${d.modeloC.titulo} (${d.modeloC.explicacaoTecnica})`,
      `4) Risco de Erosão: ${d.modeloD.nivel.toUpperCase()} — ${d.modeloD.resumoTecnico}`,
      `5) Projeção 2030–2050 (CMIP6): ${d.modeloE.resumoTecnico}`,
      ``,
      `Cultura: ${activeFarm.culturaPrincipal}`,
      `Produção est. (${ha.toFixed(2)} ha): ${prodTotalKg} kg • Custo insumos: ${formatCurrencyBRL(custoTotal)} • Margem/economia: ${formatCurrencyBRL(margemEstimada)}`,
    ].join('\n');
  };

  const handleSharePronaf = async () => {
    const text = buildShareReport();
    setPronafPreview(text);
    try {
      await Share.share({ message: text, title: 'Laudo RoçaViva — Pronaf / WhatsApp' });
    } catch {
      // Modal exibe o texto pronto em navegador de notebook
    }
  };

  const speakFullCard = () => {
    const speech = `Cartão de decisão para ${activeFarm.nome}. ${
      level === 'acessivel' ? d.modeloB.resumoAcessivel : d.modeloB.resumoTecnico
    } ${
      level === 'acessivel' ? d.modeloC.explicacaoAcessivel : d.modeloC.explicacaoTecnica
    } Risco de erosão ${d.modeloD.nivel}. Até 2050, ${d.modeloE.resumoAcessivel}`;
    speak(speech, true);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={styles.container}
    >
      {/* Cartão de Decisão da Safra */}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: theme.text, fontSize: 18 * theme.scale }]}>
              🌾 Cartão de Decisão da Safra
            </Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textMuted }}>
              Solo pH {d.soloSoilGrids.ph} ({d.soloSoilGrids.textura}) •{' '}
              {formatArea(ha, activeFarm.areaTarefasBa)}
            </Text>
          </View>
          <Pressable
            onPress={speakFullCard}
            style={[styles.voiceCircle, { backgroundColor: theme.primary }]}
          >
            <Ionicons name="volume-high" size={20} color={theme.primaryText} />
          </Pressable>
        </View>

        <View
          style={[
            styles.calloutBox,
            {
              backgroundColor:
                d.modeloC.recomendacao === 'plantar_agora'
                  ? theme.successBg
                  : theme.warningBg,
              borderColor:
                d.modeloC.recomendacao === 'plantar_agora'
                  ? theme.successBorder
                  : theme.warningBorder,
            },
          ]}
        >
          <Text
            style={[
              styles.calloutTitle,
              {
                color:
                  d.modeloC.recomendacao === 'plantar_agora'
                    ? theme.successText
                    : theme.warningText,
              },
            ]}
          >
            🌱 Quando plantar: {d.modeloC.titulo}
          </Text>
          <Text
            style={{
              fontSize: 13,
              lineHeight: 19,
              color:
                d.modeloC.recomendacao === 'plantar_agora'
                  ? theme.successText
                  : theme.warningText,
            }}
          >
            {regionalizarTexto(
              level === 'acessivel'
                ? d.modeloC.explicacaoAcessivel
                : d.modeloC.explicacaoTecnica,
              level
            )}
          </Text>
        </View>

        <Text style={[styles.subHeader, { color: theme.text }]}>
          Culturas indicadas (Embrapa ZARC / IBGE SIDRA):
        </Text>
        {d.culturasRecomendadas.slice(0, 3).map((crop) => {
          const prodHa = Math.round(crop.produtividadeKgPorHa * ha);
          const custo = Math.round(crop.custoInsumosPorHa * ha);
          return (
            <View
              key={crop.id}
              style={[styles.cropRow, { backgroundColor: theme.bg, borderColor: theme.border }]}
            >
              <View style={styles.cropTop}>
                <Text style={{ fontSize: 13, fontWeight: '900', color: theme.text, flex: 1 }}>
                  {crop.nome}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '800', color: theme.primary }}>
                  {crop.diasColheita} dias
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: theme.textMuted }}>
                {crop.variedadeRegional} • Est.: {prodHa} kg • Insumos: {formatCurrencyBRL(custo)}
              </Text>
            </View>
          );
        })}

        <Pressable
          onPress={handleSharePronaf}
          style={[styles.pronafBtn, { backgroundColor: theme.primary }]}
        >
          <Ionicons name="share-social" size={18} color={theme.primaryText} />
          <Text style={{ color: theme.primaryText, fontWeight: '900', fontSize: 13 }}>
            Gerar Resumo WhatsApp / Crédito Pronaf
          </Text>
        </Pressable>
      </View>

      {/* Saúde das Plantações: Visão Orbital NDVI + Câmera Offline */}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: theme.text, fontSize: 17 * theme.scale }]}>
          📸 Saúde das Plantações (NDVI + Câmera Offline)
        </Text>
        <Text style={{ fontSize: 12, color: theme.textMuted }}>
          Manchas de vigor na sua roça demarcada (verde = forte, amarelo = atenção, vermelho = estresse):
        </Text>

        <View style={styles.ndviList}>
          {d.ndviZonas.map((z) => {
            const dotColor =
              z.vigor === 'verde'
                ? '#16A34A'
                : z.vigor === 'amarelo'
                ? '#D97706'
                : '#DC2626';
            return (
              <View
                key={z.id}
                style={[styles.ndviRow, { backgroundColor: theme.bg }]}
              >
                <View style={[styles.ndviDot, { backgroundColor: dotColor }]} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '900', color: theme.text }}>
                    {z.setor} (NDVI {z.ndviValor})
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.textMuted }}>{z.descricao}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <Pressable
          onPress={handleOpenLeafCamera}
          disabled={analyzingLeaf}
          style={[styles.cameraBtn, { backgroundColor: theme.accent }]}
        >
          <Ionicons name="camera" size={22} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 14 }}>
            {analyzingLeaf ? 'Analisando folha...' : 'Examinar Folha com a Câmera'}
          </Text>
        </Pressable>

        {/* Botões rápidos para testar no notebook sem precisar fotografar uma planta */}
        <View style={styles.leafSimRow}>
          <Pressable
            onPress={() => handleSimulateLeafTest('saudavel')}
            style={[styles.leafSimBtn, { borderColor: theme.border, backgroundColor: theme.successBg }]}
          >
            <Text style={{ fontSize: 11, fontWeight: '800', color: theme.successText }}>
              Teste folha verde
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleSimulateLeafTest('amarelada')}
            style={[styles.leafSimBtn, { borderColor: theme.border, backgroundColor: theme.warningBg }]}
          >
            <Text style={{ fontSize: 11, fontWeight: '800', color: theme.warningText }}>
              Teste folha amarelada
            </Text>
          </Pressable>
        </View>

        {lastLeafAnalysis && (
          <View
            style={[
              styles.leafResultBox,
              {
                backgroundColor:
                  lastLeafAnalysis.status === 'saudavel'
                    ? theme.successBg
                    : lastLeafAnalysis.status === 'estresse_leve'
                    ? theme.warningBg
                    : theme.dangerBg,
                borderColor: theme.border,
              },
            ]}
          >
            {lastLeafAnalysis.imageUri.startsWith('http') ||
            lastLeafAnalysis.imageUri.startsWith('file') ||
            lastLeafAnalysis.imageUri.startsWith('data') ||
            lastLeafAnalysis.imageUri.startsWith('blob') ? (
              <Image
                source={{ uri: lastLeafAnalysis.imageUri }}
                style={styles.leafThumb}
              />
            ) : null}
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontSize: 13, fontWeight: '900', color: theme.text }}>
                {lastLeafAnalysis.titulo}
              </Text>
              <Text style={{ fontSize: 12, color: theme.text }}>
                {level === 'acessivel'
                  ? lastLeafAnalysis.diagnosticoAcessivel
                  : lastLeafAnalysis.diagnosticoTecnico}
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '800', color: theme.primary }}>
                Orientação: {lastLeafAnalysis.acaoRecomendada}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Cascata de Seca em 4 Sinais */}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.cardTitle, { color: theme.text, fontSize: 17 * theme.scale }]}>
            {d.modeloB.emoji} Cascata de Seca (4 Sinais)
          </Text>
          <Text style={{ fontSize: 12, fontWeight: '900', color: theme.textMuted }}>
            {d.modeloB.sinaisAtivos}/4 sinais
          </Text>
        </View>
        <View style={styles.timeline}>
          {d.modeloB.sinais.map((sig, idx) => (
            <View
              key={sig.etapa}
              style={[
                styles.timelineStep,
                {
                  backgroundColor: sig.anomaliaDetectada ? theme.dangerBg : theme.successBg,
                  borderColor: sig.anomaliaDetectada ? theme.dangerBorder : theme.successBorder,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '900',
                  color: sig.anomaliaDetectada ? theme.dangerText : theme.successText,
                }}
              >
                {idx + 1}. {sig.etapa} ({sig.fonte})
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '800',
                  color: sig.anomaliaDetectada ? theme.dangerText : theme.successText,
                }}
              >
                {sig.valorAtual} • {sig.descricao}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Simulador de Viabilidade Econômica, Rotação, Erosão e Futuro 2030–2050 */}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: theme.text, fontSize: 17 * theme.scale }]}>
          🔄 Simulador Econômico, Erosão e 2030–2050
        </Text>
        <View style={styles.rotChips}>
          {ROTATION_OPTIONS.map((rot) => {
            const active = activeFarm.culturaPrincipal === rot;
            return (
              <Pressable
                key={rot}
                onPress={() => simulateRotation(rot)}
                style={[
                  styles.rotChip,
                  {
                    backgroundColor: active ? theme.primary : theme.surfaceMuted,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '800',
                    color: active ? theme.primaryText : theme.text,
                  }}
                >
                  {rot}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.econBox, { backgroundColor: theme.bg }]}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: theme.text }}>
            💰 {activeFarmer.objective === 'subsistencia' ? 'Economia doméstica' : 'Margem'} ({ha.toFixed(2)} ha):
          </Text>
          <Text style={{ fontSize: 12, color: theme.textMuted }}>
            Produção: {prodTotalKg} kg • Custo: {formatCurrencyBRL(custoTotal)} • Resultado est.:{' '}
            <Text style={{ fontWeight: '900', color: theme.primary }}>
              {formatCurrencyBRL(margemEstimada)}
            </Text>
          </Text>
        </View>

        <View
          style={[
            styles.subModelBox,
            {
              backgroundColor:
                d.modeloD.nivel === 'alto'
                  ? theme.dangerBg
                  : d.modeloD.nivel === 'moderado'
                  ? theme.warningBg
                  : theme.successBg,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={{ fontSize: 13, fontWeight: '900', color: theme.text }}>
            ⛰️ Risco de Erosão: {d.modeloD.nivel.toUpperCase()}
          </Text>
          <Text style={{ fontSize: 12, color: theme.text, lineHeight: 18 }}>
            {regionalizarTexto(
              level === 'acessivel' ? d.modeloD.resumoAcessivel : d.modeloD.resumoTecnico,
              level
            )}
          </Text>
        </View>

        <View
          style={[
            styles.subModelBox,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}
        >
          <Text style={{ fontSize: 13, fontWeight: '900', color: theme.text }}>
            🔮 Cenário Climático 2030–2050 (CMIP6)
          </Text>
          <Text style={{ fontSize: 12, color: theme.text, lineHeight: 18 }}>
            {regionalizarTexto(
              level === 'acessivel' ? d.modeloE.resumoAcessivel : d.modeloE.resumoTecnico,
              level
            )}
          </Text>
          <Text style={{ fontSize: 12, fontWeight: '900', color: theme.primary }}>
            +{d.modeloE.semanasDeficitAdicionais} semanas de déficit hídrico/ano • Sugestão:{' '}
            {d.modeloE.rotacaoResilienteSugerida}
          </Text>
        </View>
      </View>

      <Modal
        visible={Boolean(pronafPreview)}
        transparent
        animationType="fade"
        onRequestClose={() => setPronafPreview(null)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.headerRow}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: theme.text }}>
                Resumo WhatsApp / Laudo Pronaf
              </Text>
              <Pressable onPress={() => setPronafPreview(null)}>
                <Ionicons name="close-circle" size={26} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              <Text style={{ fontSize: 12, color: theme.text, lineHeight: 18 }}>
                {pronafPreview}
              </Text>
            </ScrollView>
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
  card: {
    borderRadius: 22,
    borderWidth: 2,
    padding: 14,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    fontWeight: '900',
  },
  voiceCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calloutBox: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    gap: 4,
  },
  calloutTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  subHeader: {
    fontSize: 13,
    fontWeight: '800',
  },
  cropRow: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 2,
  },
  cropTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pronafBtn: {
    minHeight: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ndviList: {
    gap: 6,
  },
  ndviRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
  },
  ndviDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  cameraBtn: {
    minHeight: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  leafSimRow: {
    flexDirection: 'row',
    gap: 8,
  },
  leafSimBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leafResultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  leafThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  timeline: {
    gap: 6,
  },
  timelineStep: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 10,
    gap: 2,
  },
  rotChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rotChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  econBox: {
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  subModelBox: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    gap: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 22,
    borderWidth: 2,
    padding: 16,
    gap: 10,
  },
});
