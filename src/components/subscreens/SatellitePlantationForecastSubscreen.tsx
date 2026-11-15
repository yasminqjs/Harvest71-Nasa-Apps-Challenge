import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Pressable, Text } from '../../i18n/native';
import { VoiceReadBar } from '../VoiceReadBar';
import { useAccessibility } from '../../context/AccessibilityContext';
import { buildLotTarget, useCropQuality } from '../../context/CropQualityContext';
import {
  DEFAULT_IRECE_FARM_CENTROID,
  DEFAULT_IRECE_FARM_POLYGON,
} from '../../data/seedData';
import { getAppTheme } from '../../theme/tokens';
import { PlantingLot } from '../../types/domain';
import {
  buildSevenDayClimateSeries,
  createDefaultLotsForFarm,
} from '../../utils/agronomyHelpers';
import { calculatePolygonMetrics } from '../../utils/geoprocessing';
import { formatArea } from '../../utils/regionalize';
import { FarmMapCanvas } from '../FarmMapCanvas';
import { MapLotOverlay } from '../VectorFarmCanvas';

interface SatellitePlantationForecastSubscreenProps {
  onBack: () => void;
  onOpenFullNasaDiagnostics?: () => void;
}

interface LotForecastMetrics {
  lot: PlantingLot;
  grainIcon: string;
  varietyLabel: string;
  kcMedio: number;
  cycleDays: number;
  daysRemaining: number;
  yieldKgHa: number;
  yieldSacksHa: number;
  totalKg: number;
  totalSacks: number;
  estimatedRevenueBRL: number;
  waterStressStatus: 'Ótimo' | 'Atenção Moderada' | 'Estresse Hídrico';
  waterStressColor: string;
  forecastSummaryPt: string;
  previsaoBadge: string;
}

function computeLotForecast(
  lot: PlantingLot,
  waterBalanceRatio: number,
  veranicoRiskPct: number
): LotForecastMetrics {
  const lower = lot.culturaAtual.toLowerCase();
  const isCornSorghum = lower.includes('milho') || lower.includes('sorgo');
  const isCassava = lower.includes('mandioca') || lower.includes('macaxeira');

  const baseKgHa = isCornSorghum ? 2880 : isCassava ? 11500 : 1380;
  const cycleDays = isCornSorghum ? 95 : isCassava ? 240 : 70;
  const kcMedio = isCornSorghum ? 0.92 : isCassava ? 0.78 : 0.82;
  const varietyLabel = isCornSorghum
    ? 'Milho BRS Caatingueiro + Sorgo Ponta Negra (Consórcio de Grãos)'
    : isCassava
    ? 'Mandioca BRS Formosa + Feijão-Caupi'
    : 'Feijão-Caupi BRS Pujante (Ciclo Superprecoce)';
  const grainIcon = isCornSorghum ? '🌽' : isCassava ? '🌿' : '🫘';

  const climateFactor = Math.max(
    0.68,
    Math.min(1.12, 0.82 + waterBalanceRatio * 0.25 - (veranicoRiskPct / 100) * 0.12)
  );
  const progressFactor =
    lot.progressoEsperadoPct > 0
      ? Math.max(0.8, Math.min(1.1, lot.progressoRealPct / lot.progressoEsperadoPct))
      : 1;

  const yieldKgHa = Math.round(baseKgHa * climateFactor * progressFactor);
  const yieldSacksHa = Number((yieldKgHa / 60).toFixed(1));
  const areaHa = Math.max(0.2, lot.areaHectares || 2.5);
  const totalKg = Math.round(yieldKgHa * areaHa);
  const totalSacks = Number((totalKg / 60).toFixed(1));

  const pricePerSack = isCornSorghum ? 68 : isCassava ? 45 : 165;
  const estimatedRevenueBRL =
    lot.retornoFinanceiroEstR$ > 0
      ? lot.retornoFinanceiroEstR$
      : Math.round(totalSacks * pricePerSack);

  const daysRemaining = Math.max(5, cycleDays - (lot.tempoPlantadaDias || 35));
  const harvestLabel = lot.dataColheitaPrevista || `Em ${daysRemaining} dias`;

  const waterStressStatus: LotForecastMetrics['waterStressStatus'] =
    waterBalanceRatio >= 0.72
      ? 'Ótimo'
      : waterBalanceRatio >= 0.48
      ? 'Atenção Moderada'
      : 'Estresse Hídrico';

  const waterStressColor =
    waterStressStatus === 'Ótimo'
      ? '#16A34A'
      : waterStressStatus === 'Atenção Moderada'
      ? '#D97706'
      : '#DC2626';

  const previsaoBadge = `📈 ~${yieldSacksHa} sc/ha (${totalSacks} sc) • Colheita: ${harvestLabel}`;

  const forecastSummaryPt = isCornSorghum
    ? `Grão em fase vegetativa/pendoamento. Previsão de ${yieldSacksHa} sacas/ha (${totalSacks} sacas no talhão). O sorgo em bordadura protege o milho contra ventos secos e garante cobertura residual.`
    : `Grão em floração/enchimento de vagens. Previsão de ${yieldSacksHa} sacas/ha (${totalSacks} sacas no talhão). Janela firme para colheita ${harvestLabel.toLowerCase()} com boa retenção de umidade.`;

  return {
    lot,
    grainIcon,
    varietyLabel,
    kcMedio,
    cycleDays,
    daysRemaining,
    yieldKgHa,
    yieldSacksHa,
    totalKg,
    totalSacks,
    estimatedRevenueBRL,
    waterStressStatus,
    waterStressColor,
    forecastSummaryPt,
    previsaoBadge,
  };
}

export const SatellitePlantationForecastSubscreen: React.FC<
  SatellitePlantationForecastSubscreenProps
> = ({ onBack, onOpenFullNasaDiagnostics }) => {
  const {
    accessibility,
    activeFarm,
    updateFarmPolygon,
    updateFarmLots,
    speak,
  } = useAccessibility();
  const { analysis, setTarget, playVoice, stopVoice, isPlayingAudio } = useCropQuality();
  const theme = getAppTheme(accessibility);

  const [selectedLotId, setSelectedLotId] = useState<string | undefined>(undefined);

  const safeLots = useMemo(() => {
    if (activeFarm.lotes && activeFarm.lotes.length >= 2) {
      return activeFarm.lotes;
    }
    return createDefaultLotsForFarm(
      activeFarm.centroid,
      activeFarm.areaHectares,
      activeFarm.culturaPrincipal,
      activeFarm.polygon
    );
  }, [
    activeFarm.lotes,
    activeFarm.centroid,
    activeFarm.areaHectares,
    activeFarm.culturaPrincipal,
    activeFarm.polygon,
  ]);

  const waterBalanceRatio = useMemo(() => {
    const ks =
      analysis?.scientific_telemetry?.biophysical_indices
        ?.fao56_ks_water_stress_coeff;
    if (ks !== undefined) {
      return ks;
    }
    const modA = activeFarm.diagnostico.modeloA;
    const ratio =
      modA.demandaCulturaMm > 0
        ? modA.chuvaImergMm / modA.demandaCulturaMm
        : 0.78;
    return Math.max(0.35, Math.min(1, ratio));
  }, [analysis, activeFarm.diagnostico.modeloA]);

  const veranicoRiskPct =
    activeFarm.diagnostico.modeloC.probabilidadeVeranicoPct;

  const lotForecasts = useMemo(
    () =>
      safeLots.map((lot) =>
        computeLotForecast(lot, waterBalanceRatio, veranicoRiskPct)
      ),
    [safeLots, waterBalanceRatio, veranicoRiskPct]
  );

  const mapLots: MapLotOverlay[] = useMemo(
    () =>
      lotForecasts.map((lf) => ({
        id: lf.lot.id,
        nome: lf.lot.nome,
        corHex: lf.lot.corHex,
        polygon: lf.lot.polygon,
        culturaAtual: lf.lot.culturaAtual,
        previsaoBadge: lf.previsaoBadge,
        areaHectares: lf.lot.areaHectares,
      })),
    [lotForecasts]
  );

  const sevenDaySeries = useMemo(
    () => buildSevenDayClimateSeries(activeFarm.diagnostico),
    [activeFarm.diagnostico]
  );

  const totalFarmSacks = useMemo(
    () =>
      Number(
        lotForecasts.reduce((acc, item) => acc + item.totalSacks, 0).toFixed(1)
      ),
    [lotForecasts]
  );

  const totalFarmRevenue = useMemo(
    () =>
      lotForecasts.reduce((acc, item) => acc + item.estimatedRevenueBRL, 0),
    [lotForecasts]
  );

  const handleSelectLotOnMap = (lotId: string | undefined) => {
    setSelectedLotId(lotId);
    if (!lotId) {
      setTarget({
        key: `farm:${activeFarm.id}`,
        label: activeFarm.nome,
        polygon: activeFarm.polygon,
        centroid: activeFarm.centroid,
        cropName: activeFarm.culturaPrincipal,
        waterRegime: 'RAINFED',
      });
      return;
    }
    const found = safeLots.find((l) => l.id === lotId);
    if (found) {
      const nextTarget = buildLotTarget({
        id: found.id,
        nome: found.nome,
        polygon: found.polygon,
        cropName: found.culturaAtual,
      });
      if (nextTarget) setTarget(nextTarget);
    }
  };

  const handleLoadVerifiedIreceFarm = async () => {
    const metrics = calculatePolygonMetrics(DEFAULT_IRECE_FARM_POLYGON);
    const defaultLots = createDefaultLotsForFarm(
      DEFAULT_IRECE_FARM_CENTROID,
      metrics.areaHectares,
      'Feijão-Caupi + Milho',
      DEFAULT_IRECE_FARM_POLYGON
    );
    await updateFarmPolygon(
      DEFAULT_IRECE_FARM_POLYGON,
      'Fazenda Nova — Polo de Grãos (Irecê - BA)'
    );
    await updateFarmLots(defaultLots);
    setSelectedLotId(undefined);
    speak(
      'Fazenda real de grãos em Irecê, Bahia carregada no satélite com dois talhões: Lote 1 com Feijão-Caupi e Lote 2 com Milho e Sorgo.'
    );
  };

  const lotsSpeech = lotForecasts
    .map(
      (lf) =>
        `${lf.lot.nome}, plantado com ${lf.lot.culturaAtual} em ${lf.lot.areaHectares.toFixed(
          1
        )} hectares: previsão de ${lf.yieldSacksHa} sacas por hectare, totalizando ${
          lf.totalSacks
        } sacas, colheita prevista ${lf.lot.dataColheitaPrevista?.toLowerCase() || `em ${lf.daysRemaining} dias`}.`
    )
    .join(' ');
  const forecastVoiceText = `Visão de satélite e previsões da ${activeFarm.nome}, em ${activeFarm.municipio}. Terreno mapeado com ${activeFarm.areaHectares.toFixed(
    2
  )} hectares e ${lotForecasts.length} grãos simultâneos. ${lotsSpeech} Previsão total da fazenda: ${totalFarmSacks} sacas e retorno estimado de ${totalFarmRevenue.toLocaleString(
    'pt-BR'
  )} reais.`;

  const handleSpeakForecastSummary = () => {
    if (isPlayingAudio) {
      stopVoice();
      return;
    }
    playVoice(forecastVoiceText);
  };

  const isUsingDefaultIrece =
    Math.abs(activeFarm.centroid.latitude - DEFAULT_IRECE_FARM_CENTROID.latitude) <
      0.01 &&
    Math.abs(activeFarm.centroid.longitude - DEFAULT_IRECE_FARM_CENTROID.longitude) <
      0.01;

  return (
    <View style={styles.container}>
      {/* Barra superior */}
      <View style={styles.topRow}>
        <Pressable
          onPress={onBack}
          style={[
            styles.backBtn,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Ionicons name="arrow-back" size={18} color={theme.text} />
          <Text style={[styles.backText, { color: theme.text }]}>Plantação</Text>
        </Pressable>
        <Text
          style={[
            styles.screenTitle,
            { color: theme.text, fontSize: 16 * theme.scale },
          ]}
        >
          Satélite da Plantação + Previsões
        </Text>
        <View style={{ width: 68 }} />
      </View>

      {/* Cabeçalho com Coordenadas Reais e Botão de Voz */}
      <View
        style={[
          styles.heroCard,
          { backgroundColor: '#0F172A', borderColor: '#1E293B' },
        ]}
      >
        <View style={styles.heroHeaderRow}>
          <View style={styles.heroPill}>
            <Ionicons name="planet" size={14} color="#38BDF8" />
            <Text style={styles.heroPillText}>
              IMAGEM DE SATÉLITE REAL (ESRI WORLD IMAGERY) + PREVISÕES NASA/FAO
            </Text>
          </View>
        </View>

        <Text style={[styles.heroTitle, { fontSize: 17 * theme.scale }]}>
          {activeFarm.nome} ({activeFarm.municipio} - {activeFarm.estado})
        </Text>
        <Text style={styles.heroCoords}>
          📍 Coordenadas reais: {activeFarm.centroid.latitude.toFixed(5)}°,{' '}
          {activeFarm.centroid.longitude.toFixed(5)}° • Terreno:{' '}
          {formatArea(activeFarm.areaHectares, activeFarm.areaTarefasBa)} •{' '}
          {lotForecasts.length} grãos mapeados simultaneamente
        </Text>

        <View style={styles.heroStatsStrip}>
          <View style={styles.heroStatBox}>
            <Text style={styles.heroStatLabel}>COLHEITA TOTAL PREVISTA</Text>
            <Text style={styles.heroStatValue}>{totalFarmSacks} sacas (60 kg)</Text>
          </View>
          <View style={styles.heroStatBox}>
            <Text style={styles.heroStatLabel}>RETORNO BRUTO ESTIMADO</Text>
            <Text style={[styles.heroStatValue, { color: '#4ADE80' }]}>
              R$ {totalFarmRevenue.toLocaleString('pt-BR')}
            </Text>
          </View>
          <View style={styles.heroStatBox}>
            <Text style={styles.heroStatLabel}>ÍNDICE HÍDRICO (Ks)</Text>
            <Text style={[styles.heroStatValue, { color: '#38BDF8' }]}>
              {(waterBalanceRatio * 100).toFixed(0)}% (NASA POWER)
            </Text>
          </View>
        </View>

        <View style={styles.heroActionsRow}>
          <Pressable
            onPress={handleSpeakForecastSummary}
            style={[
              styles.voiceBtn,
              { backgroundColor: isPlayingAudio ? '#DC2626' : '#2563EB' },
            ]}
          >
            <Ionicons
              name={isPlayingAudio ? 'stop-circle' : 'volume-high'}
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.voiceBtnText}>
              {isPlayingAudio
                ? 'Parar Narração'
                : '🔊 Ouvir Previsões da Plantação no Satélite'}
            </Text>
          </Pressable>

          {!isUsingDefaultIrece && (
            <Pressable
              onPress={() => void handleLoadVerifiedIreceFarm()}
              style={styles.resetRealFarmBtn}
            >
              <Ionicons name="locate" size={16} color="#FDE047" />
              <Text style={styles.resetRealFarmBtnText}>
                Carregar Fazenda Real Irecê-BA (2 Grãos)
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <VoiceReadBar
        text={forecastVoiceText}
        theme={theme}
        label="Ouvir previsões e análise do satélite"
      />

      {/* Seletor rápido de Talhão/Grão para focar no Satélite */}
      <View
        style={[
          styles.selectorCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.selectorTitle, { color: theme.text }]}>
          🗺️ Toque em um grão abaixo (ou direto na imagem de satélite) para destacar sua previsão:
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          <Pressable
            onPress={() => handleSelectLotOnMap(undefined)}
            style={[
              styles.lotChip,
              {
                backgroundColor: !selectedLotId ? '#16A34A' : theme.surfaceMuted,
                borderColor: !selectedLotId ? '#16A34A' : theme.border,
              },
            ]}
          >
            <Text
              style={[
                styles.lotChipText,
                { color: !selectedLotId ? '#FFFFFF' : theme.text },
              ]}
            >
              🏡 Terreno da Fazenda ({activeFarm.areaHectares.toFixed(2)} ha)
            </Text>
          </Pressable>

          {lotForecasts.map((lf) => {
            const isSelected = selectedLotId === lf.lot.id;
            return (
              <Pressable
                key={lf.lot.id}
                onPress={() => handleSelectLotOnMap(lf.lot.id)}
                style={[
                  styles.lotChip,
                  {
                    backgroundColor: isSelected ? lf.lot.corHex : theme.surfaceMuted,
                    borderColor: lf.lot.corHex,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.lotChipText,
                    { color: isSelected ? '#FFFFFF' : theme.text },
                  ]}
                >
                  {lf.grainIcon} {lf.lot.nome.split('—')[0].trim()} •{' '}
                  {lf.lot.culturaAtual} ({lf.lot.areaHectares.toFixed(2)} ha)
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Mapa de Satélite Real com Terreno da Fazenda + 2 Grãos + Badges de Previsão */}
        <FarmMapCanvas
          key={`sat-forecast-${activeFarm.centroid.latitude.toFixed(4)}-${safeLots.length}`}
          centroid={activeFarm.centroid}
          polygon={activeFarm.polygon}
          lots={mapLots}
          activeLotId={selectedLotId}
          showWells={false}
          showNdvi={false}
          drawingMode={false}
          height={330}
          onAddPoint={() => {}}
          onSelectLot={(lotId) =>
            handleSelectLotOnMap(selectedLotId === lotId ? undefined : lotId)
          }
          theme={theme}
        />

        <View style={styles.mapLegendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: '#22C55E' }]} />
            <Text style={[styles.legendText, { color: theme.textMuted }]}>
              Terreno cercado da fazenda ({activeFarm.areaHectares.toFixed(2)} ha)
            </Text>
          </View>
          {lotForecasts.map((lf) => (
            <View key={`leg-${lf.lot.id}`} style={styles.legendItem}>
              <View
                style={[styles.legendSwatch, { backgroundColor: lf.lot.corHex }]}
              />
              <Text style={[styles.legendText, { color: theme.textMuted }]}>
                {lf.lot.culturaAtual} ({lf.lot.areaHectares.toFixed(2)} ha)
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Cards de Previsão por Grão Mapeado Simultaneamente */}
      <View style={{ gap: 10 }}>
        <Text
          style={[
            styles.sectionHeader,
            { color: theme.text, fontSize: 16 * theme.scale },
          ]}
        >
          🌾 Previsões de Safra por Grão Mapeado ({lotForecasts.length} Plantios Simultâneos)
        </Text>

        {lotForecasts.map((lf) => {
          const isFocused = !selectedLotId || selectedLotId === lf.lot.id;
          return (
            <Pressable
              key={`forecast-card-${lf.lot.id}`}
              onPress={() =>
                handleSelectLotOnMap(
                  selectedLotId === lf.lot.id ? undefined : lf.lot.id
                )
              }
              style={[
                styles.grainCard,
                {
                  backgroundColor: theme.surface,
                  borderColor:
                    selectedLotId === lf.lot.id ? lf.lot.corHex : theme.border,
                  opacity: isFocused ? 1 : 0.78,
                },
              ]}
            >
              <View style={styles.grainCardHeader}>
                <View
                  style={[
                    styles.grainBadge,
                    { backgroundColor: `${lf.lot.corHex}22`, borderColor: lf.lot.corHex },
                  ]}
                >
                  <Text style={styles.grainEmoji}>{lf.grainIcon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.grainTitle,
                      { color: theme.text, fontSize: 15 * theme.scale },
                    ]}
                  >
                    {lf.lot.nome}
                  </Text>
                  <Text style={[styles.grainSub, { color: theme.textMuted }]}>
                    {lf.varietyLabel} •{' '}
                    {formatArea(lf.lot.areaHectares, lf.lot.areaTarefasBa)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: `${lf.waterStressColor}1F` },
                  ]}
                >
                  <Text
                    style={[styles.statusPillText, { color: lf.waterStressColor }]}
                  >
                    {lf.waterStressStatus}
                  </Text>
                </View>
              </View>

              {/* Métricas de Previsão do Lote */}
              <View
                style={[
                  styles.metricsGrid,
                  { backgroundColor: theme.bg, borderColor: theme.border },
                ]}
              >
                <View style={styles.metricCell}>
                  <Text style={[styles.metricLabel, { color: theme.textMuted }]}>
                    PRODUTIVIDADE PREVISTA
                  </Text>
                  <Text style={[styles.metricValue, { color: theme.text }]}>
                    {lf.yieldSacksHa} sc/ha
                  </Text>
                  <Text style={[styles.metricHint, { color: theme.textMuted }]}>
                    ({lf.yieldKgHa} kg/ha • FAO GAEZ)
                  </Text>
                </View>

                <View style={styles.metricCell}>
                  <Text style={[styles.metricLabel, { color: theme.textMuted }]}>
                    PRODUÇÃO NO TALHÃO
                  </Text>
                  <Text style={[styles.metricValue, { color: theme.primary }]}>
                    {lf.totalSacks} sacas
                  </Text>
                  <Text style={[styles.metricHint, { color: theme.textMuted }]}>
                    ({lf.totalKg.toLocaleString('pt-BR')} kg totais)
                  </Text>
                </View>

                <View style={styles.metricCell}>
                  <Text style={[styles.metricLabel, { color: theme.textMuted }]}>
                    JANELA DE COLHEITA
                  </Text>
                  <Text style={[styles.metricValue, { color: '#D97706' }]}>
                    {lf.lot.dataColheitaPrevista || `Em ${lf.daysRemaining} dias`}
                  </Text>
                  <Text style={[styles.metricHint, { color: theme.textMuted }]}>
                    Plantado há {lf.lot.tempoPlantadaDias}d / ciclo {lf.cycleDays}d
                  </Text>
                </View>

                <View style={styles.metricCell}>
                  <Text style={[styles.metricLabel, { color: theme.textMuted }]}>
                    RETORNO ESTIMADO
                  </Text>
                  <Text style={[styles.metricValue, { color: '#16A34A' }]}>
                    R$ {lf.estimatedRevenueBRL.toLocaleString('pt-BR')}
                  </Text>
                  <Text style={[styles.metricHint, { color: theme.textMuted }]}>
                    Kc FAO-56: {lf.kcMedio.toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Barra de Progresso Fenológico Real vs Esperado */}
              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <Text style={[styles.progressLabel, { color: theme.text }]}>
                    Desenvolvimento no Satélite (NDVI/GDD): {lf.lot.progressoRealPct}%
                  </Text>
                  <Text style={[styles.progressExpected, { color: theme.textMuted }]}>
                    Meta fenológica: {lf.lot.progressoEsperadoPct}%
                  </Text>
                </View>
                <View
                  style={[
                    styles.progressTrack,
                    { backgroundColor: theme.surfaceMuted },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(100, lf.lot.progressoRealPct)}%`,
                        backgroundColor: lf.lot.corHex,
                      },
                    ]}
                  />
                </View>
              </View>

              <Text style={[styles.forecastNote, { color: theme.text }]}>
                💡 {lf.forecastSummaryPt}
              </Text>
              <Text style={[styles.rotationNote, { color: theme.textMuted }]}>
                🔄 Manejo / Sucessão no lote: {lf.lot.cronogramaPlantacao}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Previsão Agroclimática de 7 Dias + Trimestre (NASA POWER / GPM IMERG) */}
      <View
        style={[
          styles.climateCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={styles.climateHeaderRow}>
          <Ionicons name="partly-sunny" size={22} color="#0284C7" />
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.climateTitle,
                { color: theme.text, fontSize: 15 * theme.scale },
              ]}
            >
              Previsão Agroclimática 7 Dias + Balanço Hídrico (NASA POWER)
            </Text>
            <Text style={{ fontSize: 11, color: theme.textMuted }}>
              Chuva (IMERG): {activeFarm.diagnostico.modeloA.chuvaImergMm} mm •
              ET0 (NASA POWER): {activeFarm.diagnostico.modeloA.et0PowerMm} mm •
              Risco de veranico: {veranicoRiskPct}%
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.daysRow}
        >
          {sevenDaySeries.map((day) => (
            <View
              key={day.dia}
              style={[
                styles.dayBox,
                { backgroundColor: theme.bg, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.dayLabel, { color: theme.text }]}>
                {day.dia}
              </Text>
              <Ionicons
                name={
                  day.chuvaMm >= 5
                    ? 'rainy'
                    : day.chuvaMm >= 1
                    ? 'cloud-outline'
                    : 'sunny-outline'
                }
                size={20}
                color={day.chuvaMm >= 2 ? '#0284C7' : '#D97706'}
              />
              <Text style={[styles.dayRain, { color: '#0284C7' }]}>
                {day.chuvaMm.toFixed(1)} mm
              </Text>
              <Text style={[styles.dayMeta, { color: theme.textMuted }]}>
                Umid {day.umidadePct.toFixed(0)}%
              </Text>
              <Text style={[styles.dayMeta, { color: theme.textMuted }]}>
                Máx {day.calorC.toFixed(0)}°C
              </Text>
            </View>
          ))}
        </ScrollView>

        <View
          style={[
            styles.seasonalBanner,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}
        >
          <Text style={{ fontSize: 12, fontWeight: '800', color: theme.text }}>
            📅 Janela de Plantio e Clima ({activeFarm.diagnostico.modeloC.titulo}):
          </Text>
          <Text style={{ fontSize: 12, color: theme.textMuted, lineHeight: 17 }}>
            {activeFarm.diagnostico.modeloC.explicacaoAcessivel}
          </Text>
        </View>

        {onOpenFullNasaDiagnostics && (
          <Pressable
            onPress={onOpenFullNasaDiagnostics}
            style={[styles.openRoxoBtn, { backgroundColor: '#6D28D9' }]}
          >
            <Ionicons name="analytics-outline" size={18} color="#FFFFFF" />
            <Text style={styles.openRoxoBtnText}>
              Abrir Diagnóstico Completo de Manchas NDVI 10m e Auditoria NASA
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
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
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  backText: {
    fontSize: 13,
    fontWeight: '800',
  },
  screenTitle: {
    fontWeight: '900',
    textAlign: 'center',
    flex: 1,
  },
  heroCard: {
    borderRadius: 18,
    borderWidth: 2,
    padding: 14,
    gap: 10,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  heroPillText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#38BDF8',
  },
  heroTitle: {
    fontWeight: '900',
    color: '#FFFFFF',
  },
  heroCoords: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
    lineHeight: 17,
  },
  heroStatsStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroStatBox: {
    flex: 1,
    minWidth: 120,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 2,
  },
  heroStatLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94A3B8',
  },
  heroStatValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  heroActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  voiceBtn: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  voiceBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  resetRealFarmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FDE047',
    backgroundColor: 'rgba(253, 224, 71, 0.12)',
  },
  resetRealFarmBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FDE047',
  },
  selectorCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 12,
    gap: 10,
  },
  selectorTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  lotChip: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  lotChipText: {
    fontSize: 12,
    fontWeight: '900',
  },
  mapLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHeader: {
    fontWeight: '900',
    marginTop: 2,
  },
  grainCard: {
    borderRadius: 18,
    borderWidth: 2,
    padding: 14,
    gap: 10,
  },
  grainCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  grainBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grainEmoji: {
    fontSize: 22,
  },
  grainTitle: {
    fontWeight: '900',
  },
  grainSub: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '900',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    gap: 10,
  },
  metricCell: {
    flex: 1,
    minWidth: 125,
    gap: 2,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '900',
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '900',
  },
  metricHint: {
    fontSize: 10,
    fontWeight: '700',
  },
  progressSection: {
    gap: 5,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  progressExpected: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressTrack: {
    height: 9,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  forecastNote: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  rotationNote: {
    fontSize: 11,
    fontWeight: '700',
  },
  climateCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    gap: 12,
  },
  climateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  climateTitle: {
    fontWeight: '900',
  },
  daysRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  dayBox: {
    width: 78,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 4,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '900',
  },
  dayRain: {
    fontSize: 12,
    fontWeight: '900',
  },
  dayMeta: {
    fontSize: 10,
    fontWeight: '700',
  },
  seasonalBanner: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 4,
  },
  openRoxoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  openRoxoBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
