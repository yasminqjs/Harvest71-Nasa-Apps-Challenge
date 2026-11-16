import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { useLanguage } from '../i18n/Language';
import { Pressable, Text } from '../i18n/native';
import { translate } from '../i18n/translate';
import { VoiceReadBar } from '../components/VoiceReadBar';
import { FarmMapCanvas } from '../components/FarmMapCanvas';
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
import { useResponsiveLayout } from '../theme/responsive';
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
  const { width, height, contentMaxWidth, pagePadding, gridColumns } = useResponsiveLayout();
  const isWideWeb = width >= 640;
  const isDesktopSplit = width >= 820;
  const cropsMapHeight = Math.round(Math.max(270, Math.min(620, height - 430)));
  const cardWidthPct = gridColumns === 3 ? '32.2%' : gridColumns === 2 ? '48.8%' : '100%';
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
  const hubCropsText = hubPlantacoes
    .map((p) => (en ? translate(p.culturaAtual.culturaNome, 'en') : p.culturaAtual.culturaNome))
    .filter(Boolean)
    .join(', ');
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
  const plantacoes = farmArchitecture.plantacoes;
  const ha = activeFarm.areaHectares;
  const historyCount =
    (activeFarmer.historicoCultivoDetalhado?.length ?? 0) ||
    (activeFarmer.historicoCultivo?.length ?? 0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.bg }}
        contentContainerStyle={[
          styles.container,
          isWideWeb && styles.containerWide,
          { maxWidth: contentMaxWidth, paddingHorizontal: pagePadding },
        ]}
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

            <View style={[styles.cardsStack, isWideWeb && styles.cardsGridWide]}>
              <Pressable
                onPress={() => setActiveBlock('atualizar_lotes')}
                style={[styles.choiceRow, isWideWeb && styles.choiceCardWide, { backgroundColor: theme.surface, borderColor: theme.border, borderLeftColor: verde.border }]}
              >
                <View style={[styles.choiceIconBadge, { backgroundColor: accessibility.highContrast ? theme.surfaceMuted : verde.bg }]}>
                  <Ionicons name="leaf-outline" size={21} color={accessibility.highContrast ? theme.primary : verde.text} />
                </View>
                <View style={styles.choiceBody}>
                  <Text style={[styles.choiceTitle, { color: theme.text }]}>
                    Cultura atual e rotações planejadas
                  </Text>
                  <Text style={[styles.choiceSub, { color: theme.textMuted }]} numberOfLines={2}>
                    {plantacoes.length}{' '}
                    {en
                      ? plantacoes.length === 1
                        ? 'crop'
                        : 'crops'
                      : `plantação${plantacoes.length === 1 ? '' : 'ões'}`}{' '}
                    • NASA/FAO EcoCrop
                  </Text>
                </View>
                <View style={[styles.chevronCircle, { backgroundColor: theme.surfaceMuted }]}>
                  <Ionicons name="chevron-forward" size={16} color={accessibility.highContrast ? theme.primary : verde.text} />
                </View>
              </Pressable>

              <Pressable
                onPress={() => setActiveBlock('atualizar_mapa')}
                style={[styles.choiceRow, isWideWeb && styles.choiceCardWide, { backgroundColor: theme.surface, borderColor: theme.border, borderLeftColor: verde.border }]}
              >
                <View style={[styles.choiceIconBadge, { backgroundColor: accessibility.highContrast ? theme.surfaceMuted : verde.bg }]}>
                  <Ionicons name="map-outline" size={21} color={accessibility.highContrast ? theme.primary : verde.text} />
                </View>
                <View style={styles.choiceBody}>
                  <Text style={[styles.choiceTitle, { color: theme.text }]}>
                    Demarcar terreno da fazenda no mapa
                  </Text>
                  <Text style={[styles.choiceSub, { color: theme.textMuted }]} numberOfLines={2}>
                    {en ? 'Current area: ' : 'Área atual: '}{formatArea(ha, activeFarm.areaTarefasBa)}
                  </Text>
                </View>
                <View style={[styles.chevronCircle, { backgroundColor: theme.surfaceMuted }]}>
                  <Ionicons name="chevron-forward" size={16} color={accessibility.highContrast ? theme.primary : verde.text} />
                </View>
              </Pressable>

              <Pressable
                onPress={() => setActiveBlock('atualizar_variaveis')}
                style={[styles.choiceRow, isWideWeb && styles.choiceCardWide, { backgroundColor: theme.surface, borderColor: theme.border, borderLeftColor: verde.border }]}
              >
                <View style={[styles.choiceIconBadge, { backgroundColor: accessibility.highContrast ? theme.surfaceMuted : verde.bg }]}>
                  <Ionicons name="options-outline" size={21} color={accessibility.highContrast ? theme.primary : verde.text} />
                </View>
                <View style={styles.choiceBody}>
                  <Text style={[styles.choiceTitle, { color: theme.text }]}>
                    Variáveis da fazenda (usuário)
                  </Text>
                  <Text style={[styles.choiceSub, { color: theme.textMuted }]} numberOfLines={2}>
                    {translate(activeFarmer.waterAccess, language)} •{' '}
                    {translate(activeFarmer.laborType, language)} •{' '}
                    {translate(activeFarmer.objective, language)}
                  </Text>
                </View>
                <View style={[styles.chevronCircle, { backgroundColor: theme.surfaceMuted }]}>
                  <Ionicons name="chevron-forward" size={16} color={accessibility.highContrast ? theme.primary : verde.text} />
                </View>
              </Pressable>

              <Pressable
                onPress={() => setActiveBlock('atualizar_historico')}
                style={[styles.choiceRow, isWideWeb && styles.choiceCardWide, { backgroundColor: theme.surface, borderColor: theme.border, borderLeftColor: verde.border }]}
              >
                <View style={[styles.choiceIconBadge, { backgroundColor: accessibility.highContrast ? theme.surfaceMuted : verde.bg }]}>
                  <Ionicons name="calendar-outline" size={21} color={accessibility.highContrast ? theme.primary : verde.text} />
                </View>
                <View style={styles.choiceBody}>
                  <Text style={[styles.choiceTitle, { color: theme.text }]}>
                    Histórico da terra e safras anteriores
                  </Text>
                  <Text style={[styles.choiceSub, { color: theme.textMuted }]} numberOfLines={2}>
                    {historyCount}{' '}
                    {en
                      ? historyCount === 1
                        ? 'record'
                        : 'records'
                      : `registro${historyCount === 1 ? '' : 's'}`}
                  </Text>
                </View>
                <View style={[styles.chevronCircle, { backgroundColor: theme.surfaceMuted }]}>
                  <Ionicons name="chevron-forward" size={16} color={accessibility.highContrast ? theme.primary : verde.text} />
                </View>
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
          /* HUB DA ABA PLANTAÇÃO — cartões interativos claros e fáceis de tocar */
          <View style={{ gap: 10 }}>
            <View
              style={[
                styles.headerStrip,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View style={[styles.headerFlexRow, isWideWeb && styles.headerFlexRowWide]}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.hubTitle, { color: theme.text, fontSize: 18 * theme.scale }]}>
                    Plantação e Modelagem da Fazenda
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.textMuted, fontWeight: '600' }}>
                    {activeFarm.nome} • {formatArea(ha, activeFarm.areaTarefasBa)} •{' '}
                    {plantacoes.length}{' '}
                    {en
                      ? plantacoes.length === 1
                        ? 'crop'
                        : 'crops'
                      : `plantação${plantacoes.length === 1 ? '' : 'ões'}`}
                  </Text>
                </View>
                <View style={isWideWeb ? { width: 310 } : { width: '100%' }}>
                  <VoiceReadBar
                    text={cropsVoiceText}
                    theme={theme}
                    label={en ? 'Read Crops tab aloud' : 'Ouvir leitura da aba Plantação'}
                  />
                </View>
              </View>
              <Pressable
                onPress={() => setShowDataLayers((v) => !v)}
                accessibilityRole="button"
                style={styles.layersToggle}
              >
                <Ionicons name="layers-outline" size={14} color={theme.primary} />
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: theme.primary, flex: 1 }}>
                  {en ? 'Active data layers on this farm' : 'Camadas de dados ativas nesta fazenda'}
                </Text>
                <Ionicons name={showDataLayers ? 'chevron-up' : 'chevron-down'} size={14} color={theme.primary} />
              </Pressable>
              {showDataLayers && (
                <View style={[styles.dataModelStrip, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                  <Text style={{ fontSize: 11, color: theme.textMuted }}>
                    {en
                      ? '• Land history: NASA POWER + SRTM + Landsat C2 L2 TIRS (30 m)'
                      : '• Histórico da terra: NASA POWER + SRTM + Landsat C2 L2 TIRS (30 m)'}
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.textMuted }}>
                    {en
                      ? '• Current crop: user selection + NASA/FAO GAEZ EcoCrop'
                      : '• Cultura atual: seleção do usuário + NASA/FAO GAEZ EcoCrop'}
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.textMuted }}>
                    {en
                      ? '• Future crops: farmer records or rotation planning'
                      : '• Culturas futuras: registro do agricultor ou planejamento de rotações'}
                  </Text>
                </View>
              )}
            </View>

            <View style={[styles.cardsStack, isWideWeb && styles.cardsGridWide]}>
              {/* 1. Atualizar dados */}
              <Pressable
                onPress={() => setActiveBlock('atualizar_hub')}
                style={[styles.choiceRow, isWideWeb && { width: cardWidthPct, flexGrow: 1 }, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <View style={[styles.choiceIconBadge, { backgroundColor: accessibility.highContrast ? theme.surfaceMuted : verde.bg }]}>
                  <Ionicons name="create-outline" size={20} color={accessibility.highContrast ? theme.primary : verde.text} />
                </View>
                <View style={styles.choiceBody}>
                  <Text style={[styles.choiceTitle, { color: theme.text }]}>
                    Atualizar dados da plantação e da fazenda
                  </Text>
                  <Text style={[styles.choiceSub, { color: theme.textMuted }]} numberOfLines={2}>
                    Editar terreno, lotes, cultura atual, variáveis da fazenda e histórico
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </Pressable>

              {([
                ['planejar_rotacao', 'calendar-outline', 'Planejar rotação', 'Monte, compare e salve opções para os próximos plantios.'],
                ['talhao_dssat', 'earth-outline', 'Meu Talhão no DSSAT', 'Simule uma cultura com o solo e o clima da área cadastrada.'],
              ] as const).map(([block, icon, title, description]) => (
                <Pressable
                  key={block}
                  accessibilityRole="button"
                  onPress={() => setActiveBlock(block)}
                  style={[styles.choiceRow, isWideWeb && { width: cardWidthPct, flexGrow: 1 }, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <View style={[styles.choiceIconBadge, { backgroundColor: theme.surfaceMuted }]}>
                    <Ionicons name={icon} size={20} color={theme.primary} />
                  </View>
                  <View style={styles.choiceBody}>
                    <Text style={[styles.choiceTitle, { color: theme.text }]}>{title}</Text>
                    <Text style={[styles.choiceSub, { color: theme.textMuted }]} numberOfLines={2}>{description}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                </Pressable>
              ))}

              {/* 4. Ver qualidade da plantação atual */}
              <Pressable
                onPress={() => setActiveBlock('qualidade_atual')}
                style={[
                  styles.choiceRow,
                  isWideWeb && { width: cardWidthPct, flexGrow: 1 },
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.choiceIconBadge,
                    { backgroundColor: theme.surfaceMuted },
                  ]}
                >
                  <Ionicons name="pulse-outline" size={20} color={theme.primary} />
                </View>
                <View style={styles.choiceBody}>
                  <Text style={[styles.choiceTitle, { color: theme.text }]}>
                    Ver qualidade da plantação atual
                  </Text>
                  <Text style={[styles.choiceSub, { color: theme.textMuted }]} numberOfLines={2}>
                    {en
                      ? 'NASA POWER, Sentinel-2, leaf photo test, patches & audio'
                      : 'NASA POWER, Sentinel-2, exame da folha por foto, manchas e áudio'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </Pressable>

              {/* 5. SATÉLITE + PREVISÕES POR GRÃO */}
              <Pressable
                onPress={() => setActiveBlock('satelite_previsoes')}
                style={[
                  styles.choiceRow,
                  isWideWeb && { width: cardWidthPct, flexGrow: 1 },
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.choiceIconBadge,
                    { backgroundColor: theme.surfaceMuted },
                  ]}
                >
                  <Ionicons name="planet-outline" size={20} color={theme.primary} />
                </View>
                <View style={styles.choiceBody}>
                  <Text style={[styles.choiceTitle, { color: theme.text }]}>
                    {en
                      ? 'Plantation Satellite + Grain Forecasts'
                      : 'Satélite da Plantação + Previsões por Grão'}
                  </Text>
                  <Text style={[styles.choiceSub, { color: theme.textMuted }]} numberOfLines={2}>
                    {en
                      ? 'Real terrain imagery, estimated yield (sc/ha), climate risk, and 7-day weather'
                      : 'Terreno em imagem real, produtividade estimada (sc/ha), risco climático e clima 7 dias'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </Pressable>
            </View>

            {isDesktopSplit && (
              <View style={styles.bottomWorkspaceRow}>
                <View style={[styles.mapShowcaseCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={styles.workspaceCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.eyebrowText, { color: theme.primary }]}>
                        {en ? 'SENTINEL-2 NDVI & FIELD PLOTS' : 'SENTINEL-2 NDVI E TALHÕES ATIVOS'}
                      </Text>
                      <Text style={[styles.choiceTitle, { color: theme.text }]}>
                        {activeFarm.nome} • {plantacoes.length}{' '}
                        {en
                          ? plantacoes.length === 1
                            ? 'active planting'
                            : 'active plantings'
                          : plantacoes.length === 1
                          ? 'plantio ativo'
                          : 'plantios ativos'}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setActiveBlock('satelite_previsoes')}
                      style={[styles.headerActionBtn, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
                    >
                      <Ionicons name="planet-outline" size={14} color={theme.primary} />
                      <Text style={{ fontSize: 11.5, fontWeight: '800', color: theme.primary }}>
                        {en ? 'Satellite Forecast' : 'Abrir Satélite'}
                      </Text>
                    </Pressable>
                  </View>

                  <FarmMapCanvas
                    centroid={activeFarm.centroid}
                    polygon={activeFarm.polygon}
                    lots={plantacoes.map((p) => ({
                      id: p.id,
                      nome: p.nome,
                      corHex: p.corHex,
                      polygon: p.polygon,
                      culturaAtual: translate(p.culturaAtual.culturaNome, language),
                      areaHectares: p.areaHectares,
                    }))}
                    wells={[]}
                    showWells={false}
                    showNdvi
                    drawingMode={false}
                    height={cropsMapHeight}
                    onAddPoint={() => {}}
                    onSelectLot={(lotId) => {
                      setPlannerLotId(lotId);
                      setActiveBlock('atualizar_lotes');
                    }}
                    theme={theme}
                  />

                  {activeFarm.diagnostico.ndviZonas.length > 0 && (
                    <View style={styles.ndviStrip}>
                      {activeFarm.diagnostico.ndviZonas.slice(0, 3).map((zone) => {
                        const zoneColor =
                          zone.vigor === 'verde'
                            ? '#15803D'
                            : zone.vigor === 'amarelo'
                            ? '#B45309'
                            : '#B91C1C';
                        return (
                          <Pressable
                            key={zone.id}
                            onPress={() => setActiveBlock('qualidade_atual')}
                            style={[styles.ndviPill, { backgroundColor: theme.bg, borderColor: theme.border }]}
                          >
                            <View style={[styles.ndviDot, { backgroundColor: zoneColor }]} />
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={{ fontSize: 11, fontWeight: '800', color: theme.text }} numberOfLines={1}>
                                {translate(zone.setor, language)}
                              </Text>
                              <Text style={{ fontSize: 10, color: theme.textMuted }} numberOfLines={1}>
                                NDVI {zone.ndviValor.toFixed(2)}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>

                <View style={styles.rightPanelCol}>
                  <View style={[styles.panelCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View style={styles.workspaceCardHeader}>
                      <Text style={[styles.choiceTitle, { color: theme.text }]}>
                        {en ? 'Registered Crops & Plots' : 'Talhões e Culturas Cadastradas'}
                      </Text>
                      <Pressable onPress={() => setActiveBlock('atualizar_lotes')}>
                        <Text style={{ fontSize: 11.5, fontWeight: '800', color: theme.primary }}>
                          {en ? 'Edit plots →' : 'Editar lotes →'}
                        </Text>
                      </Pressable>
                    </View>

                    <View style={{ gap: 7 }}>
                      {plantacoes.slice(0, 3).map((p) => {
                        const sysLabel =
                          p.culturaAtual.sistema === 'rotacao'
                            ? en
                              ? 'Rotation'
                              : 'Rotação'
                            : en
                            ? 'Monoculture'
                            : 'Monocultura';
                        const droughtLabel =
                          p.culturaAtual.especificacoesCultura.resilienciaSeca === 'alta'
                            ? en
                              ? 'High drought resilience'
                              : 'Alta resiliência à seca'
                            : p.culturaAtual.especificacoesCultura.resilienciaSeca === 'media'
                            ? en
                              ? 'Moderate drought resilience'
                              : 'Resiliência média'
                            : en
                            ? 'Low drought resilience'
                            : 'Baixa resiliência';
                        return (
                          <Pressable
                            key={p.id}
                            onPress={() => {
                              setPlannerLotId(p.id);
                              setActiveBlock('atualizar_lotes');
                            }}
                            style={[styles.plotRowCard, { backgroundColor: theme.bg, borderColor: theme.border }]}
                          >
                            <View style={[styles.plotColorDot, { backgroundColor: p.corHex }]} />
                            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                              <Text style={{ fontSize: 12.5, fontWeight: '800', color: theme.text }} numberOfLines={1}>
                                {p.nome} • {translate(p.culturaAtual.culturaNome, language)}
                              </Text>
                              <Text style={{ fontSize: 11, color: theme.textMuted }} numberOfLines={1}>
                                {p.areaHectares.toFixed(2)} ha • {sysLabel} • Kc {p.culturaAtual.especificacoesCultura.kcMedio.toFixed(2)} • {droughtLabel}
                              </Text>
                            </View>
                            <Text style={{ fontSize: 11.5, fontWeight: '900', color: theme.primary }}>
                              {p.culturaAtual.tempoPlantadaDias}d
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  <View style={[styles.panelCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View style={styles.workspaceCardHeader}>
                      <Text style={[styles.choiceTitle, { color: theme.text }]}>
                        {en ? 'Soil & DSSAT Modeling Baseline' : 'Base de Solo e Modelagem DSSAT'}
                      </Text>
                      <Text style={{ fontSize: 10.5, fontWeight: '800', color: theme.textMuted }}>
                        SoilGrids + NASA POWER
                      </Text>
                    </View>

                    <View style={styles.baselineGrid}>
                      <View style={[styles.baselineMetric, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: theme.textMuted }}>
                          {en ? 'Soil pH & Texture' : 'pH e Textura do Solo'}
                        </Text>
                        <Text style={{ fontSize: 13.5, fontWeight: '900', color: theme.text }} numberOfLines={1}>
                          pH {activeFarm.diagnostico.soloSoilGrids.ph.toFixed(1)} • {translate(activeFarm.diagnostico.soloSoilGrids.textura, language)}
                        </Text>
                      </View>
                      <View style={[styles.baselineMetric, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: theme.textMuted }}>
                          {en ? 'Organic Carbon' : 'Carbono Orgânico'}
                        </Text>
                        <Text style={{ fontSize: 13.5, fontWeight: '900', color: theme.text }}>
                          {activeFarm.diagnostico.soloSoilGrids.carbonoOrganicoGKg} g/kg
                        </Text>
                      </View>
                      <View style={[styles.baselineMetric, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: theme.textMuted }}>
                          {en ? 'Weekly ET0 Demand' : 'Evapotranspiração (ET0)'}
                        </Text>
                        <Text style={{ fontSize: 13.5, fontWeight: '900', color: theme.text }}>
                          {activeFarm.diagnostico.modeloA.et0PowerMm} mm
                        </Text>
                      </View>
                    </View>

                    {activeFarm.diagnostico.culturasRecomendadas[0] && (
                      <View style={[styles.dssatHintBox, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                        <Ionicons name="sparkles-outline" size={16} color={theme.primary} />
                        <Text style={{ flex: 1, fontSize: 11.5, color: theme.text, lineHeight: 16 }}>
                          <Text style={{ fontWeight: '900' }}>
                            {en ? 'Top climate match: ' : 'Melhor adaptação climática: '}
                            {translate(activeFarm.diagnostico.culturasRecomendadas[0].nome, language)}
                          </Text>
                          {' — '}
                          {activeFarm.diagnostico.culturasRecomendadas[0].diasColheita}{' '}
                          {en ? 'days cycle' : 'dias de ciclo'} •{' '}
                          {activeFarm.diagnostico.culturasRecomendadas[0].produtividadeKgPorHa} kg/ha
                        </Text>
                      </View>
                    )}

                    <View style={styles.quickActionFooter}>
                      <Pressable
                        onPress={() => setActiveBlock('talhao_dssat')}
                        style={[styles.footerPrimaryBtn, { backgroundColor: theme.accent }]}
                      >
                        <Ionicons name="earth-outline" size={15} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '900' }}>
                          {en ? 'Run Plot in DSSAT' : 'Simular Talhão no DSSAT'}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setActiveBlock('planejar_rotacao')}
                        style={[styles.footerSecondaryBtn, { backgroundColor: theme.bg, borderColor: theme.border }]}
                      >
                        <Ionicons name="calendar-outline" size={15} color={theme.primary} />
                        <Text style={{ color: theme.primary, fontSize: 12.5, fontWeight: '800' }}>
                          {en ? 'Plan Rotation' : 'Planejar Rotação'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
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
  headerStrip: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  headerFlexRow: {
    gap: 10,
  },
  headerFlexRowWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
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
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 4,
    marginTop: 4,
  },
  cardsStack: {
    gap: 10,
  },
  cardsGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  choiceCardWide: {
    width: '48.8%',
    flexGrow: 1,
  },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    minHeight: 72,
    borderRadius: 12,
    borderWidth: 1,
  },
  choiceIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  choiceBody: {
    flex: 1,
    gap: 3,
  },
  choiceTitle: {
    fontSize: 14.5,
    fontWeight: '900',
  },
  choiceSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  chevronCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
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
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
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
  bottomWorkspaceRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 16,
  },
  mapShowcaseCard: {
    flex: 1.35,
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  workspaceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  eyebrowText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ndviStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ndviPill: {
    flex: 1,
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  ndviDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  rightPanelCol: {
    flex: 1,
    minWidth: 300,
    gap: 10,
  },
  panelCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  plotRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  plotColorDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    flexShrink: 0,
  },
  baselineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  baselineMetric: {
    flex: 1,
    minWidth: 115,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 7,
    gap: 2,
  },
  dssatHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  quickActionFooter: {
    flexDirection: 'row',
    gap: 8,
  },
  footerPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 9,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  footerSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 9,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
});
