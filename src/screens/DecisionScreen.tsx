import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { useLanguage } from '../i18n/Language';
import { Pressable, Text } from '../i18n/native';
import { FeatureBadge } from '../components/FeatureBadge';
import { VoiceReadBar } from '../components/VoiceReadBar';
import { DssatAreaSimulation } from '../components/dssat/DssatAreaSimulation';
import { DssatRotationSearch } from '../components/dssat/DssatRotationSearch';
import { PlantationQualityPlaceholder } from '../components/placeholders/PlantationQualityPlaceholder';
import { FarmVariablesEditorSubscreen } from '../components/subscreens/FarmVariablesEditorSubscreen';
import { HistoricoPlantioSubscreen } from '../components/subscreens/HistoricoPlantioSubscreen';
import { RotacaoAtualSubscreen } from '../components/subscreens/RotacaoAtualSubscreen';
import { SatellitePlantationForecastSubscreen } from '../components/subscreens/SatellitePlantationForecastSubscreen';
import { useAccessibility } from '../context/AccessibilityContext';
import { useCropQuality } from '../context/CropQualityContext';
import { FEATURE_COLOR_STYLES } from '../models/farmArchitecture';
import { getAppTheme } from '../theme/tokens';
import { formatArea } from '../utils/regionalize';
import { MapScreen } from './MapScreen';

type PlantationBlock =
  | 'atualizar_hub'
  | 'atualizar_lotes'
  | 'atualizar_mapa'
  | 'atualizar_variaveis'
  | 'atualizar_historico'
  | 'talhao_dssat'
  | 'planejar_rotacao'
  | 'qualidade_atual'
  | 'satelite_previsoes'
  | null;

/**
 * Aba Plantação ("O que o usuário vê" -> aba plantação):
 * - VERDE:   Atualizar dados da plantação e da fazenda (Pegador de informações da fazenda)
 * - CINZA:   Planejar rotações futuras e comparar opções com o DSSAT
 * - ROXO:    Ver qualidade da plantação atual + satélite em tempo real
 */
export const DecisionScreen: React.FC<{ openCurrentRotation?: boolean }> = ({
  openCurrentRotation = false,
}) => {
  const { accessibility, activeFarmer, activeFarm, farmArchitecture, speak } = useAccessibility();
  const { openQualityRequested, clearOpenQualityRequest } = useCropQuality();
  const { language } = useLanguage();
  const en = language === 'en';
  const theme = getAppTheme(accessibility);
  const [activeBlock, setActiveBlock] = useState<PlantationBlock>(
    openCurrentRotation ? 'atualizar_lotes' : null
  );
  const effectiveBlock: PlantationBlock = openQualityRequested ? 'qualidade_atual' : activeBlock;
  const [plannerLotId, setPlannerLotId] = useState<string>();
  const [showDataLayers, setShowDataLayers] = useState(false);
  const autoSpokenRef = useRef(false);

  const hubPlantacoes = farmArchitecture?.plantacoes ?? [];
  const hubCropsText = hubPlantacoes.map((p) => p.culturaAtual.culturaNome).filter(Boolean).join(', ');
  const cropsVoiceText = activeFarm
    ? en
      ? `Crops tab for ${activeFarm.nome}, ${formatArea(activeFarm.areaHectares, activeFarm.areaTarefasBa)}, with ${hubPlantacoes.length} plantings${hubCropsText ? `: ${hubCropsText}` : ''}. Choose Update farm details, Plan rotation with DSSAT, My Plot in DSSAT, Current crop quality, or Live Satellite & Crop Forecasts.`
      : `Aba Plantação de ${activeFarm.nome}, com ${formatArea(activeFarm.areaHectares, activeFarm.areaTarefasBa)} e ${hubPlantacoes.length} plantações${hubCropsText ? `: ${hubCropsText}` : ''}. Você pode escolher: Atualizar dados da fazenda, Planejar rotação, Meu Talhão no DSSAT, Ver qualidade da plantação atual, ou Satélite e Previsões por Grão.`
    : '';

  useEffect(() => {
    if (!accessibility.voiceGuidanceEnabled || autoSpokenRef.current || !cropsVoiceText || effectiveBlock) {
      return;
    }
    autoSpokenRef.current = true;
    speak(cropsVoiceText);
  }, [accessibility.voiceGuidanceEnabled, cropsVoiceText, effectiveBlock, speak]);

  const goBack = useCallback(() => {
    clearOpenQualityRequest();
    if (
      effectiveBlock === 'atualizar_lotes' ||
      effectiveBlock === 'atualizar_mapa' ||
      effectiveBlock === 'atualizar_variaveis' ||
      effectiveBlock === 'atualizar_historico'
    ) {
      if (effectiveBlock === 'atualizar_lotes') setPlannerLotId(undefined);
      setActiveBlock('atualizar_hub');
    } else if (effectiveBlock === 'planejar_rotacao' && plannerLotId) {
      setActiveBlock('atualizar_lotes');
    } else {
      setActiveBlock(null);
    }
  }, [effectiveBlock, plannerLotId, clearOpenQualityRequest]);

  useEffect(() => {
    if (!effectiveBlock) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [effectiveBlock, goBack]);

  if (!activeFarm || !activeFarmer || !farmArchitecture) return null;

  const verde = FEATURE_COLOR_STYLES.verde;
  const roxo = FEATURE_COLOR_STYLES.roxo;
  const plantacoes = farmArchitecture.plantacoes;
  const ha = activeFarm.areaHectares;
  const historyCount =
    (activeFarmer.historicoCultivoDetalhado?.length ?? 0) ||
    (activeFarmer.historicoCultivo?.length ?? 0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.bg }}
        contentContainerStyle={styles.container}
      >
        {effectiveBlock === 'atualizar_lotes' ? (
          <RotacaoAtualSubscreen
            onBack={goBack}
            initialLotId={plannerLotId}
            onPlanRotation={(lotId) => {
              setPlannerLotId(lotId);
              setActiveBlock('planejar_rotacao');
            }}
            title="Lotes e Cultura Atual"
          />
        ) : effectiveBlock === 'atualizar_historico' ? (
          <HistoricoPlantioSubscreen
            onBack={() => setActiveBlock('atualizar_hub')}
            title="Histórico da Terra e Cultivo"
          />
        ) : effectiveBlock === 'atualizar_variaveis' ? (
          <FarmVariablesEditorSubscreen onBack={() => setActiveBlock('atualizar_hub')} />
        ) : effectiveBlock === 'atualizar_mapa' ? (
          <View style={{ gap: 10 }}>
            <View style={styles.topRow}>
              <Pressable
                onPress={() => setActiveBlock('atualizar_hub')}
                style={[
                  styles.backBtn,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Ionicons name="arrow-back" size={18} color={theme.text} />
                <Text style={[styles.backText, { color: theme.text }]}>Voltar</Text>
              </Pressable>
              <Text style={[styles.screenTitle, { color: theme.text, fontSize: 17 * theme.scale }]}>
                Demarcar Terreno e Lotes
              </Text>
              <View style={{ width: 64 }} />
            </View>
            <VoiceReadBar
              theme={theme}
              label={en ? 'Read map instructions aloud' : 'Ouvir instruções do mapa'}
              text={
                en
                  ? `Farm boundary editor for ${activeFarm.nome}. Current mapped area is ${formatArea(ha, activeFarm.areaTarefasBa)}. Tap points on the map to adjust boundary corners.`
                  : `Demarcação de terreno para ${activeFarm.nome}. Área atual de ${formatArea(ha, activeFarm.areaTarefasBa)}. Toque nos cantos do terreno no mapa para ajustar os limites.`
              }
            />
            <MapScreen />
          </View>
        ) : effectiveBlock === 'atualizar_hub' ? (
          <View style={{ gap: 10 }}>
            <View style={styles.topRow}>
              <Pressable
                onPress={() => setActiveBlock(null)}
                style={[
                  styles.backBtn,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Ionicons name="arrow-back" size={18} color={theme.text} />
                <Text style={[styles.backText, { color: theme.text }]}>Plantação</Text>
              </Pressable>
              <Text style={[styles.screenTitle, { color: theme.text, fontSize: 17 * theme.scale }]}>
                Atualizar Dados
              </Text>
              <View style={{ width: 64 }} />
            </View>

            <VoiceReadBar
              theme={theme}
              label={en ? 'Read update options aloud' : 'Ouvir opções de atualização'}
              text={
                en
                  ? `Update farm and crop data. Choose Current crop and planned rotations, Map farm boundary, Farm variables, or Land and harvest history.`
                  : `Atualizar dados da fazenda e da plantação. Escolha entre: Cultura atual e rotações planejadas, Demarcar terreno no mapa, Variáveis da fazenda, ou Histórico da terra e safras anteriores.`
              }
            />

            <View style={[styles.listSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Pressable
                onPress={() => setActiveBlock('atualizar_lotes')}
                style={[styles.choiceRow, { borderBottomWidth: 1, borderBottomColor: theme.border, borderLeftColor: verde.border }]}
              >
                <Ionicons name="leaf-outline" size={20} color={verde.text} />
                <View style={styles.choiceBody}>
                  <Text style={[styles.choiceTitle, { color: theme.text }]}>
                    Cultura atual e rotações planejadas
                  </Text>
                  <Text style={{ fontSize: 11.5, color: theme.textMuted }} numberOfLines={1}>
                    {plantacoes.length} plantação{plantacoes.length === 1 ? '' : 'ões'} • NASA/FAO EcoCrop
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={verde.text} />
              </Pressable>

              <Pressable
                onPress={() => setActiveBlock('atualizar_mapa')}
                style={[styles.choiceRow, { borderBottomWidth: 1, borderBottomColor: theme.border, borderLeftColor: verde.border }]}
              >
                <Ionicons name="map-outline" size={20} color={verde.text} />
                <View style={styles.choiceBody}>
                  <Text style={[styles.choiceTitle, { color: theme.text }]}>
                    Demarcar terreno da fazenda no mapa
                  </Text>
                  <Text style={{ fontSize: 11.5, color: theme.textMuted }} numberOfLines={1}>
                    Área atual: {formatArea(ha, activeFarm.areaTarefasBa)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={verde.text} />
              </Pressable>

              <Pressable
                onPress={() => setActiveBlock('atualizar_variaveis')}
                style={[styles.choiceRow, { borderBottomWidth: 1, borderBottomColor: theme.border, borderLeftColor: verde.border }]}
              >
                <Ionicons name="options-outline" size={20} color={verde.text} />
                <View style={styles.choiceBody}>
                  <Text style={[styles.choiceTitle, { color: theme.text }]}>
                    Variáveis da fazenda (usuário)
                  </Text>
                  <Text style={{ fontSize: 11.5, color: theme.textMuted }} numberOfLines={1}>
                    {activeFarmer.waterAccess} • {activeFarmer.laborType} • {activeFarmer.objective}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={verde.text} />
              </Pressable>

              <Pressable
                onPress={() => setActiveBlock('atualizar_historico')}
                style={[styles.choiceRow, { borderLeftColor: verde.border }]}
              >
                <Ionicons name="calendar-outline" size={20} color={verde.text} />
                <View style={styles.choiceBody}>
                  <Text style={[styles.choiceTitle, { color: theme.text }]}>
                    Histórico da terra e safras anteriores
                  </Text>
                  <Text style={{ fontSize: 11.5, color: theme.textMuted }} numberOfLines={1}>
                    {historyCount} registro{historyCount === 1 ? '' : 's'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={verde.text} />
              </Pressable>
            </View>
          </View>
        ) : effectiveBlock === 'talhao_dssat' ? (
          <DssatAreaSimulation onBack={() => setActiveBlock(null)} />
        ) : effectiveBlock === 'planejar_rotacao' ? (
          <DssatRotationSearch initialLotId={plannerLotId} onBack={goBack} />
        ) : effectiveBlock === 'satelite_previsoes' ? (
          <SatellitePlantationForecastSubscreen
            onBack={() => setActiveBlock(null)}
            onOpenFullNasaDiagnostics={() => setActiveBlock('qualidade_atual')}
          />
        ) : effectiveBlock === 'qualidade_atual' ? (
          <PlantationQualityPlaceholder
            farmArchitecture={farmArchitecture}
            selectedPlantation={plantacoes[0]}
            onBack={() => {
              clearOpenQualityRequest();
              setActiveBlock(null);
            }}
            onOpenSatelliteForecast={() => {
              clearOpenQualityRequest();
              setActiveBlock('satelite_previsoes');
            }}
            theme={theme}
          />
        ) : (
          /* HUB DA ABA PLANTAÇÃO — lista enxuta sem quadrados espaçados */
          <View style={{ gap: 10 }}>
            <View style={[styles.headerStrip, { borderBottomColor: theme.border }]}>
              <Text style={[styles.hubTitle, { color: theme.text, fontSize: 18 * theme.scale }]}>
                Plantação e Modelagem da Fazenda
              </Text>
              <Text style={{ fontSize: 12, color: theme.textMuted }}>
                {activeFarm.nome} • {formatArea(ha, activeFarm.areaTarefasBa)} •{' '}
                {plantacoes.length} plantação{plantacoes.length === 1 ? '' : 'ões'}
              </Text>
              <Pressable
                onPress={() => setShowDataLayers((v) => !v)}
                accessibilityRole="button"
                style={styles.layersToggle}
              >
                <Ionicons name="layers-outline" size={14} color={theme.primary} />
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: theme.primary, flex: 1 }}>
                  Camadas de dados ativas nesta fazenda
                </Text>
                <Ionicons name={showDataLayers ? 'chevron-up' : 'chevron-down'} size={14} color={theme.primary} />
              </Pressable>
              {showDataLayers && (
                <View style={[styles.dataModelStrip, { backgroundColor: theme.surface }]}>
                  <Text style={{ fontSize: 11, color: theme.textMuted }}>
                    • Histórico da terra: NASA POWER + SRTM + Landsat C2 L2 TIRS (30 m)
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.textMuted }}>
                    • Cultura atual: seleção do usuário + NASA/FAO GAEZ EcoCrop
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.textMuted }}>
                    • Culturas futuras: registro do agricultor ou planejamento de rotações
                  </Text>
                </View>
              )}
            </View>

            <VoiceReadBar
              text={cropsVoiceText}
              theme={theme}
              label={en ? 'Read Crops tab aloud' : 'Ouvir leitura da aba Plantação'}
            />

            <View style={[styles.listSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {/* 1. VERDE: Atualizar dados */}
              <Pressable
                onPress={() => setActiveBlock('atualizar_hub')}
                style={[styles.choiceRow, { borderBottomWidth: 1, borderBottomColor: theme.border, borderLeftColor: verde.border }]}
              >
                <Ionicons name="create-outline" size={22} color={verde.text} />
                <View style={styles.choiceBody}>
                  <Text style={[styles.choiceTitle, { color: theme.text }]}>
                    Atualizar dados da plantação e da fazenda
                  </Text>
                  <Text style={{ fontSize: 11.5, color: theme.textMuted }} numberOfLines={1}>
                    Editar terreno, lotes, cultura atual, variáveis da fazenda e histórico
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={verde.text} />
              </Pressable>

              {([
                ['planejar_rotacao', 'calendar-outline', 'Planejar rotação', 'Monte, compare e salve opções para os próximos plantios.'],
                ['talhao_dssat', 'earth-outline', 'Meu Talhão no DSSAT', 'Simule uma cultura com o solo e o clima da área cadastrada.'],
              ] as const).map(([block, icon, title, description]) => (
                <Pressable
                  key={block}
                  accessibilityRole="button"
                  onPress={() => setActiveBlock(block)}
                  style={[styles.choiceRow, { borderBottomWidth: 1, borderBottomColor: theme.border, borderLeftColor: theme.accent }]}
                >
                  <Ionicons name={icon} size={22} color={theme.accent} />
                  <View style={styles.choiceBody}>
                    <Text style={[styles.choiceTitle, { color: theme.text }]}>{title}</Text>
                    <Text style={{ fontSize: 11.5, color: theme.textMuted }} numberOfLines={1}>{description}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.accent} />
                </Pressable>
              ))}

              {/* 4. ROXO (Implementado): Ver qualidade da plantação atual */}
              <Pressable
                onPress={() => setActiveBlock('qualidade_atual')}
                style={[styles.choiceRow, { borderBottomWidth: 1, borderBottomColor: theme.border, borderLeftColor: roxo.border, backgroundColor: roxo.bg }]}
              >
                <Ionicons name="pulse-outline" size={22} color={roxo.text} />
                <View style={styles.choiceBody}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={[styles.choiceTitle, { color: roxo.text }]}>
                      Ver qualidade da plantação atual
                    </Text>
                    <FeatureBadge color="roxo" customText="ROXO • Implementado" />
                  </View>
                  <Text style={{ fontSize: 11.5, color: roxo.text }} numberOfLines={1}>
                    NASA POWER + Sentinel-2 L2A + Landsat TIRS + manchas no mapa + áudio
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={roxo.text} />
              </Pressable>

              {/* 5. SATÉLITE + PREVISÕES POR GRÃO */}
              <Pressable
                onPress={() => setActiveBlock('satelite_previsoes')}
                style={[styles.choiceRow, { borderLeftColor: '#0284C7', backgroundColor: '#F0F9FF' }]}
              >
                <Ionicons name="planet-outline" size={22} color="#0369A1" />
                <View style={styles.choiceBody}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={[styles.choiceTitle, { color: '#0C4A6E' }]}>
                      Satélite da Plantação + Previsões por Grão
                    </Text>
                    <FeatureBadge color="roxo" customText="SATÉLITE REAL • FAO/NASA" />
                  </View>
                  <Text style={{ fontSize: 11.5, color: '#0369A1' }} numberOfLines={1}>
                    Terreno em imagem real, produtividade estimada (sc/ha), risco climático e clima 7 dias
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#0369A1" />
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
    gap: 10,
    paddingBottom: 22,
  },
  headerStrip: {
    borderBottomWidth: 1,
    paddingBottom: 8,
    gap: 4,
  },
  hubTitle: {
    fontWeight: '900',
  },
  layersToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  dataModelStrip: {
    borderRadius: 8,
    padding: 8,
    gap: 3,
    marginTop: 4,
  },
  listSheet: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 62,
    borderLeftWidth: 3,
  },
  choiceBody: {
    flex: 1,
    gap: 2,
  },
  choiceTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  backText: {
    fontSize: 13,
    fontWeight: '800',
  },
  screenTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '900',
  },
});
