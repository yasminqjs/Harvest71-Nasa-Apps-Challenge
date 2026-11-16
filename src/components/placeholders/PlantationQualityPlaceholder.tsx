import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { useAccessibility } from '../../context/AccessibilityContext';
import { buildLotTarget, useCropQuality } from '../../context/CropQualityContext';
import { useLanguage } from '../../i18n/Language';
import { Pressable, Text } from '../../i18n/native';
import { translate } from '../../i18n/translate';
import { FEATURE_COLOR_STYLES } from '../../models/farmArchitecture';
import { SimulatedLeafProfile, analyzeLeafImageOffline } from '../../services/leafAnalyzer';
import { AppTheme } from '../../theme/tokens';
import { VisualFieldZone } from '../../types/cropQuality';
import { FarmArchitectureModel, PlantationArchitectureModel } from '../../types/domain';
import {
  CropQualityAnalysisCard,
  buildCropQualityEnglishVoiceScript,
} from '../CropQualityAnalysisCard';
import { FarmMapCanvas } from '../FarmMapCanvas';
import { FeatureBadge } from '../FeatureBadge';
import { MapLotOverlay } from '../VectorFarmCanvas';
import { VoiceReadBar } from '../VoiceReadBar';

/**
 * @featureColor ROXO
 * @featureModule Visualizador de qualidade da plantação atual
 * @userAction Ver qualidade da plantação atual (Aba Plantação)
 * @status IMPLEMENTADO — Módulo de Qualidade da Plantação (NASA POWER + Sentinel-2 + Landsat + NASADEM).
 *
 * Pipeline científico (consulta NASA POWER ao vivo + fallback offline auditado):
 * - NASA POWER (community=AG) + MERRA-2 GWETROOT -> ET0 FAO-56, Ks, GDD
 * - Sentinel-2 L2A 10 m (NDVI Z-Score, EVI, LAI, NDWI, BSI) via Planetary Computer STAC
 * - Landsat C2 L2 TIRS 30 m (lwir11, downscaling DisTrad) -> CWSI (Jackson, 1981)
 * - NASADEM 30 m -> declividade / fator LS -> risco RUSLE
 * - FAO EcoCrop + FAO GAEZ v4 + ISRIC SoilGrids (Saxton & Rawls, 2006)
 */
export interface PlantationQualityPlaceholderProps {
  farmArchitecture: FarmArchitectureModel;
  selectedPlantation?: PlantationArchitectureModel;
  onBack?: () => void;
  onOpenSatelliteForecast?: () => void;
  theme: AppTheme;
}

export const PlantationQualityPlaceholder: React.FC<PlantationQualityPlaceholderProps> = ({
  farmArchitecture,
  onBack,
  onOpenSatelliteForecast,
  theme,
}) => {
  const { language } = useLanguage();
  const en = language === 'en';
  const palette = FEATURE_COLOR_STYLES.roxo;
  const { accessibility, lastLeafAnalysis, saveLeafAnalysis, speak } = useAccessibility();
  const level = accessibility.languageLevel;
  const {
    target,
    analysis,
    selectedPilotId,
    isAnalyzing,
    loadingProgressPct,
    loadingStage,
    elapsedSec,
    communityPestAlert,
    isPlayingAudio,
    setTarget,
    selectPilotArea,
    refreshAnalysis,
    toggleCommunityPestAlert,
    playVoice,
    stopVoice,
  } = useCropQuality();
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [showRealSatelliteOverlay, setShowRealSatelliteOverlay] = useState<boolean>(true);
  const [analyzingLeaf, setAnalyzingLeaf] = useState<boolean>(false);

  const handleOpenLeafCamera = async () => {
    setAnalyzingLeaf(true);
    try {
      let res: ImagePicker.ImagePickerResult;
      if (Platform.OS === 'web') {
        res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.35,
          base64: true,
        });
      } else {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        res = perm.granted
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              quality: 0.35,
              base64: true,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.35,
              base64: true,
            });
      }

      if (!res.canceled && res.assets?.[0]?.uri) {
        const asset = res.assets[0];
        const leafResult = await analyzeLeafImageOffline(
          asset.uri,
          undefined,
          asset.base64,
          en ? 'en' : 'pt'
        );
        await saveLeafAnalysis(leafResult);
        speak(
          `${leafResult.titulo}. ${
            level === 'acessivel' ? leafResult.diagnosticoAcessivel : leafResult.diagnosticoTecnico
          } ${leafResult.acaoRecomendada}`,
          true
        );
      }
    } catch {
      const fallback = await analyzeLeafImageOffline(
        'local-sample://folha',
        'saudavel',
        undefined,
        en ? 'en' : 'pt'
      );
      await saveLeafAnalysis(fallback);
      speak(fallback.diagnosticoAcessivel, true);
    } finally {
      setAnalyzingLeaf(false);
    }
  };

  const handleSimulateLeafTest = async (profile: SimulatedLeafProfile) => {
    const leafResult = await analyzeLeafImageOffline(
      `sample-${profile}://folha`,
      profile,
      undefined,
      en ? 'en' : 'pt'
    );
    await saveLeafAnalysis(leafResult);
    speak(`${leafResult.titulo}. ${leafResult.diagnosticoAcessivel}`, true);
  };

  const farmVars = farmArchitecture.variaveisDaFazenda;
  const lots = useMemo(
    () => farmArchitecture.plantacoes.filter((p) => p.polygon.length >= 3),
    [farmArchitecture.plantacoes]
  );

  const satelliteLotOverlays: MapLotOverlay[] = useMemo(
    () =>
      lots.map((lot) => {
        const lower = lot.culturaAtual.culturaNome.toLowerCase();
        const isCornSorghum = lower.includes('milho') || lower.includes('sorgo');
        const sacksHa = isCornSorghum ? 48.0 : 23.0;
        const totalSacks = Number((sacksHa * Math.max(0.5, lot.areaHectares)).toFixed(0));
        const harvest = lot.culturaAtual.dataColheitaPrevista
          ? en
            ? translate(lot.culturaAtual.dataColheitaPrevista, 'en')
            : lot.culturaAtual.dataColheitaPrevista
          : en
          ? 'In 35 days'
          : 'Em 35 dias';
        return {
          id: lot.id,
          nome: lot.nome,
          corHex: lot.corHex,
          polygon: lot.polygon,
          culturaAtual: lot.culturaAtual.culturaNome,
          previsaoBadge: en
            ? `📈 ~${sacksHa} sc/ha (${totalSacks} sc) • Harvest: ${harvest}`
            : `📈 ~${sacksHa} sc/ha (${totalSacks} sc) • Colheita: ${harvest}`,
          areaHectares: lot.areaHectares,
        };
      }),
    [lots, en]
  );

  const activeLotIdOnSat = target?.key.startsWith('lot:')
    ? target.key.replace('lot:', '')
    : undefined;

  const handleSelectZone = (zone: VisualFieldZone) => {
    setSelectedZoneId(zone.zone_id);
    const label = en ? translate(zone.location_label_pt, 'en') : zone.location_label_pt;
    const summary = en ? translate(zone.short_label_pt, 'en') : zone.short_label_pt;
    playVoice(`${label}: ${summary}`);
  };

  const selectFarm = () => {
    if (farmVars.polygon.length < 3) return;
    setSelectedZoneId(null);
    setTarget({
      key: `farm:${farmArchitecture.fazendaId}`,
      label: farmArchitecture.nomeFazenda,
      polygon: farmVars.polygon,
      centroid: farmVars.centroid,
      cropName: farmArchitecture.plantacoes[0]?.culturaAtual.culturaNome ?? 'Feijão-Caupi',
      waterRegime: farmVars.waterAccess === 'irrigacao' ? 'IRRIGATED' : 'RAINFED',
    });
  };

  const selectLot = (lot: PlantationArchitectureModel) => {
    const next = buildLotTarget({
      id: lot.id,
      nome: lot.nome,
      polygon: lot.polygon,
      cropName: lot.culturaAtual.culturaNome,
    });
    if (!next) return;
    setSelectedZoneId(null);
    setTarget(next);
  };

  const voiceSummaryText = analysis
    ? en
      ? buildCropQualityEnglishVoiceScript(analysis)
      : `${analysis.farmer_accessible_view.status_badge_title}. ${analysis.farmer_accessible_view.voice_tts_script_pt}`
    : en
      ? `Current plantation quality for ${target?.label ?? farmArchitecture.nomeFazenda}.`
      : `Qualidade da plantação atual para ${target?.label ?? farmArchitecture.nomeFazenda}.`;

  return (
    <View style={styles.container}>
      {onBack && (
        <View style={styles.topRow}>
          <Pressable
            onPress={onBack}
            style={[styles.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Ionicons name="arrow-back" size={18} color={theme.text} />
            <Text style={[styles.backText, { color: theme.text }]}>
              {en ? 'Back' : 'Voltar'}
            </Text>
          </Pressable>
          <Text style={[styles.title, { color: theme.text, fontSize: 17 * theme.scale }]}>
            {en ? 'Current Plantation Quality' : 'Qualidade da Plantação Atual'}
          </Text>
          <View style={{ width: 64 }} />
        </View>
      )}

      <VoiceReadBar
        text={voiceSummaryText}
        theme={theme}
        label={en ? 'Read crop condition aloud' : 'Ouvir qualidade da plantação atual'}
      />

      <View style={[styles.headerCard, { backgroundColor: palette.bg, borderColor: palette.border }]}>
        <FeatureBadge
          color="roxo"
          customText={
            en
              ? 'PURPLE • Plantation Quality (NASA + Sentinel-2)'
              : 'ROXO • Qualidade da plantação (NASA + Sentinel-2)'
          }
        />
        <Text style={[styles.targetLabel, { color: palette.text }]}>
          📍 {en ? 'Analyzing' : 'Analisando'}: {target?.label ?? farmArchitecture.nomeFazenda}
        </Text>
        <View style={styles.chipsRow}>
          <Pressable
            onPress={selectFarm}
            style={[
              styles.chip,
              {
                backgroundColor:
                  target?.key === `farm:${farmArchitecture.fazendaId}` ? palette.border : theme.surface,
                borderColor: palette.border,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                {
                  color:
                    target?.key === `farm:${farmArchitecture.fazendaId}` ? '#FFFFFF' : palette.text,
                },
              ]}
            >
              🏡 {en ? 'Whole Farm' : 'Fazenda inteira'}
            </Text>
          </Pressable>
          {lots.map((lot) => {
            const active = target?.key === `lot:${lot.id}`;
            return (
              <Pressable
                key={lot.id}
                onPress={() => selectLot(lot)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? palette.border : theme.surface,
                    borderColor: lot.corHex || palette.border,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: active ? '#FFFFFF' : palette.text }]}>
                  🌱 {lot.nome} ({lot.culturaAtual.culturaNome})
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.satToggleRow}>
          <Pressable
            onPress={() => setShowRealSatelliteOverlay((v) => !v)}
            style={[
              styles.satToggleBtn,
              {
                backgroundColor: showRealSatelliteOverlay ? '#0284C7' : theme.surface,
                borderColor: '#0284C7',
              },
            ]}
          >
            <Ionicons
              name="planet-outline"
              size={15}
              color={showRealSatelliteOverlay ? '#FFFFFF' : '#0284C7'}
            />
            <Text
              style={{
                fontSize: 12,
                fontWeight: '900',
                color: showRealSatelliteOverlay ? '#FFFFFF' : '#0284C7',
              }}
            >
              {showRealSatelliteOverlay
                ? en
                  ? 'Hide Live Satellite + Forecasts'
                  : 'Ocultar Satélite Real + Previsões'
                : en
                  ? 'View Live Satellite + Forecasts'
                  : 'Ver Satélite Real + Previsões'}
            </Text>
          </Pressable>

          {onOpenSatelliteForecast && (
            <Pressable
              onPress={onOpenSatelliteForecast}
              style={[
                styles.satToggleBtn,
                { backgroundColor: '#0F172A', borderColor: '#38BDF8' },
              ]}
            >
              <Ionicons name="trending-up-outline" size={15} color="#38BDF8" />
              <Text style={{ fontSize: 12, fontWeight: '900', color: '#F8FAFC' }}>
                {en ? 'Full Grain Forecast Panel' : 'Painel Completo de Previsões por Grão'}
              </Text>
            </Pressable>
          )}
        </View>

        {showRealSatelliteOverlay && farmVars.polygon.length >= 3 && (
          <View style={{ gap: 6, marginTop: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: palette.text }}>
              🛰️{' '}
              {en
                ? `Real Satellite Imagery (${farmVars.municipio}-${farmVars.estado}) with Farm Boundary (${farmVars.areaHectares.toFixed(2)} ha) & ${lots.length} Mapped Grains:`
                : `Imagem de Satélite Real (${farmVars.municipio}-${farmVars.estado}) com Terreno da Fazenda (${farmVars.areaHectares.toFixed(2)} ha) e ${lots.length} Grãos Mapeados:`}
            </Text>
            <FarmMapCanvas
              key={`roxo-sat-${farmVars.centroid.latitude.toFixed(4)}-${lots.length}`}
              centroid={farmVars.centroid}
              polygon={farmVars.polygon}
              lots={satelliteLotOverlays}
              activeLotId={activeLotIdOnSat}
              showWells={false}
              showNdvi={false}
              drawingMode={false}
              height={280}
              onAddPoint={() => {}}
              onSelectLot={(lotId) => {
                const found = lots.find((l) => l.id === lotId);
                if (found) selectLot(found);
              }}
              theme={theme}
            />
          </View>
        )}
      </View>

      {/* Exame visual da folha por foto/imagem (verde, amarelada, seca, pontos pretos) */}
      <View
        style={[
          styles.leafCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={styles.leafCardHeader}>
          <Ionicons name="leaf-outline" size={20} color={theme.primary} />
          <Text style={[styles.leafCardTitle, { color: theme.text, fontSize: 15 * theme.scale }]}>
            {en
              ? 'Plant Leaf Examination by Image (Offline)'
              : 'Examinação da Folha por Imagem (Câmera Offline)'}
          </Text>
        </View>
        <Text style={[styles.leafCardSub, { color: theme.textMuted }]}>
          {en
            ? 'Send or photograph a plant leaf to test whether it is green/healthy, dry, yellowed, or has black spots without internet.'
            : 'Envie ou fotografe uma folha da planta para detectar se ela está verde, seca, amarelada ou com pontos pretos sem precisar de internet.'}
        </Text>

        <Pressable
          onPress={handleOpenLeafCamera}
          disabled={analyzingLeaf}
          style={[styles.cameraBtn, { backgroundColor: theme.accent }]}
        >
          <Ionicons name="camera" size={20} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 13.5 }}>
            {analyzingLeaf
              ? en
                ? 'Analyzing leaf...'
                : 'Analisando folha...'
              : en
                ? 'Examine Leaf with Camera / Image'
                : 'Examinar Folha com a Câmera / Imagem'}
          </Text>
        </Pressable>

        <View style={styles.leafSimGrid}>
          <Pressable
            onPress={() => handleSimulateLeafTest('saudavel')}
            style={[
              styles.leafSimBtn,
              { borderColor: theme.successBorder, backgroundColor: theme.successBg },
            ]}
          >
            <Text style={{ fontSize: 11.5, fontWeight: '800', color: theme.successText }}>
              {en ? 'Green leaf test' : 'Teste folha verde'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleSimulateLeafTest('seca_total')}
            style={[
              styles.leafSimBtn,
              { borderColor: theme.dangerBorder, backgroundColor: theme.dangerBg },
            ]}
          >
            <Text style={{ fontSize: 11.5, fontWeight: '800', color: theme.dangerText }}>
              {en ? 'Dry leaf test' : 'Teste folha seca'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleSimulateLeafTest('pontos_pretos')}
            style={[
              styles.leafSimBtn,
              { borderColor: theme.border, backgroundColor: theme.surfaceMuted },
            ]}
          >
            <Text style={{ fontSize: 11.5, fontWeight: '800', color: theme.text }}>
              {en ? 'Black spots test' : 'Teste pontos pretos'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleSimulateLeafTest('amarelada')}
            style={[
              styles.leafSimBtn,
              { borderColor: theme.warningBorder, backgroundColor: theme.warningBg },
            ]}
          >
            <Text style={{ fontSize: 11.5, fontWeight: '800', color: theme.warningText }}>
              {en ? 'Yellowed leaf test' : 'Teste amarelada'}
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
                borderColor:
                  lastLeafAnalysis.status === 'saudavel'
                    ? theme.successBorder
                    : lastLeafAnalysis.status === 'estresse_leve'
                      ? theme.warningBorder
                      : theme.dangerBorder,
              },
            ]}
          >
            {lastLeafAnalysis.imageUri.startsWith('http') ||
            lastLeafAnalysis.imageUri.startsWith('file') ||
            lastLeafAnalysis.imageUri.startsWith('data') ||
            lastLeafAnalysis.imageUri.startsWith('blob') ? (
              <Image source={{ uri: lastLeafAnalysis.imageUri }} style={styles.leafThumb} />
            ) : null}
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontSize: 13.5, fontWeight: '900', color: theme.text }}>
                {lastLeafAnalysis.titulo}
              </Text>
              <Text style={{ fontSize: 12, color: theme.text }}>
                {level === 'acessivel'
                  ? lastLeafAnalysis.diagnosticoAcessivel
                  : lastLeafAnalysis.diagnosticoTecnico}
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textMuted }}>
                {en
                  ? `Green: ${lastLeafAnalysis.indiceVerdePct}% • Yellow: ${lastLeafAnalysis.amarelamentoPct}% • Dry: ${lastLeafAnalysis.necrosePct ?? 0}% • Black spots: ${lastLeafAnalysis.pontosPretosPct ?? 0}%`
                  : `Verde: ${lastLeafAnalysis.indiceVerdePct}% • Amarelo: ${lastLeafAnalysis.amarelamentoPct}% • Seco: ${lastLeafAnalysis.necrosePct ?? 0}% • Pontos pretos: ${lastLeafAnalysis.pontosPretosPct ?? 0}%`}
              </Text>
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: theme.primary }}>
                {en ? 'Guidance: ' : 'Orientação: '}
                {lastLeafAnalysis.acaoRecomendada}
              </Text>
            </View>
          </View>
        )}
      </View>

      {analysis ? (
        <CropQualityAnalysisCard
          analysis={analysis}
          theme={theme}
          fontScale={theme.scale}
          centroid={target?.centroid}
          polygon={target?.polygon}
          selectedPilotId={selectedPilotId ?? undefined}
          selectedZoneId={selectedZoneId}
          isAnalyzing={isAnalyzing}
          loadingStage={loadingStage}
          loadingProgressPct={loadingProgressPct}
          loadingElapsedSec={elapsedSec}
          communityPestAlert={communityPestAlert}
          isPlayingAudio={isPlayingAudio}
          onSelectPilotArea={(pid) => {
            setSelectedZoneId(null);
            selectPilotArea(pid);
          }}
          onRefreshLive={() => refreshAnalysis({ liveSatellite: true })}
          onToggleCommunityPestAlert={toggleCommunityPestAlert}
          onPlayVoiceScript={playVoice}
          onStopAudio={stopVoice}
          onSelectZone={handleSelectZone}
        />
      ) : (
        <View style={[styles.emptyBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.emptyText, { color: theme.text }]}>
            {en
              ? 'Outline your farm boundary (Crops → Update data → Map) to see satellite crop quality.'
              : 'Demarque o terreno da sua roça (Plantação → Atualizar dados → Mapa) para ver a qualidade da lavoura pelo satélite.'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12 },
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
  backText: { fontSize: 13, fontWeight: '800' },
  title: { fontWeight: '900', textAlign: 'center', flex: 1 },
  headerCard: {
    borderRadius: 18,
    borderWidth: 2,
    padding: 12,
    gap: 8,
  },
  targetLabel: { fontSize: 13, fontWeight: '900' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipText: { fontSize: 12, fontWeight: '800' },
  satToggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  satToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  leafCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    gap: 10,
  },
  leafCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leafCardTitle: {
    fontWeight: '900',
    flex: 1,
  },
  leafCardSub: {
    fontSize: 12,
    lineHeight: 17,
  },
  cameraBtn: {
    minHeight: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  leafSimGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  leafSimBtn: {
    flexGrow: 1,
    minWidth: 140,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
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
    width: 60,
    height: 60,
    borderRadius: 10,
  },
  emptyBox: { borderRadius: 14, borderWidth: 1.5, padding: 14 },
  emptyText: { fontSize: 13, fontWeight: '700', lineHeight: 19 },
});
