import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { buildLotTarget, useCropQuality } from '../../context/CropQualityContext';
import { FEATURE_COLOR_STYLES } from '../../models/farmArchitecture';
import { AppTheme } from '../../theme/tokens';
import { VisualFieldZone } from '../../types/cropQuality';
import { FarmArchitectureModel, PlantationArchitectureModel } from '../../types/domain';
import { CropQualityAnalysisCard } from '../CropQualityAnalysisCard';
import { FarmMapCanvas } from '../FarmMapCanvas';
import { FeatureBadge } from '../FeatureBadge';
import { MapLotOverlay } from '../VectorFarmCanvas';

/**
 * @featureColor ROXO
 * @featureModule Visualizador de qualidade da plantação atual
 * @userAction Ver qualidade da plantação atual (Aba Plantação)
 * @status IMPLEMENTADO — Placeholder substituído pelo módulo real de Qualidade da Plantação.
 *
 * Pipeline científico (apps/api + fallback offline auditado):
 * - NASA POWER (community=AG) + MERRA-2 GWETROOT → ET0 FAO-56, Ks, GDD
 * - Sentinel-2 L2A 10 m (NDVI Z-Score, EVI, LAI, NDWI, BSI) via Planetary Computer STAC
 * - Landsat C2 L2 TIRS 30 m (lwir11, downscaling DisTrad) → CWSI (Jackson, 1981)
 * - NASADEM 30 m → declividade / fator LS → risco RUSLE
 * - FAO EcoCrop + FAO GAEZ v4 + ISRIC SoilGrids (Saxton & Rawls, 2006)
 *
 * O nome do componente e as props foram mantidos para não alterar quem o consome
 * (src/screens/DecisionScreen.tsx).
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
  const palette = FEATURE_COLOR_STYLES.roxo;
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

  const farmVars = farmArchitecture.variaveisDaFazenda;
  const lots = farmArchitecture.plantacoes.filter((p) => p.polygon.length >= 3);

  const satelliteLotOverlays: MapLotOverlay[] = useMemo(
    () =>
      lots.map((lot) => {
        const lower = lot.culturaAtual.culturaNome.toLowerCase();
        const isCornSorghum = lower.includes('milho') || lower.includes('sorgo');
        const sacksHa = isCornSorghum ? 48.0 : 23.0;
        const totalSacks = Number((sacksHa * Math.max(0.5, lot.areaHectares)).toFixed(0));
        const harvest = lot.culturaAtual.dataColheitaPrevista || 'Em 35 dias';
        return {
          id: lot.id,
          nome: lot.nome,
          corHex: lot.corHex,
          polygon: lot.polygon,
          culturaAtual: lot.culturaAtual.culturaNome,
          previsaoBadge: `📈 ~${sacksHa} sc/ha (${totalSacks} sc) • Colheita: ${harvest}`,
          areaHectares: lot.areaHectares,
        };
      }),
    [lots]
  );

  const activeLotIdOnSat = target?.key.startsWith('lot:')
    ? target.key.replace('lot:', '')
    : undefined;

  const handleSelectZone = (zone: VisualFieldZone) => {
    setSelectedZoneId(zone.zone_id);
    playVoice(`${zone.location_label_pt}: ${zone.short_label_pt}`);
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

  return (
    <View style={styles.container}>
      {onBack && (
        <View style={styles.topRow}>
          <Pressable
            onPress={onBack}
            style={[styles.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Ionicons name="arrow-back" size={18} color={theme.text} />
            <Text style={[styles.backText, { color: theme.text }]}>Voltar</Text>
          </Pressable>
          <Text style={[styles.title, { color: theme.text, fontSize: 17 * theme.scale }]}>
            Qualidade da Plantação Atual
          </Text>
          <View style={{ width: 64 }} />
        </View>
      )}

      <View style={[styles.headerCard, { backgroundColor: palette.bg, borderColor: palette.border }]}>
        <FeatureBadge color="roxo" customText="ROXO • Qualidade da plantação (NASA + Sentinel-2)" />
        <Text style={[styles.targetLabel, { color: palette.text }]}>
          📍 Analisando: {target?.label ?? farmArchitecture.nomeFazenda}
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
              🏡 Fazenda inteira
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
                ? 'Ocultar Satélite Real + Previsões'
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
                Painel Completo de Previsões por Grão
              </Text>
            </Pressable>
          )}
        </View>

        {showRealSatelliteOverlay && farmVars.polygon.length >= 3 && (
          <View style={{ gap: 6, marginTop: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: palette.text }}>
              🛰️ Imagem de Satélite Real ({farmVars.municipio}-{farmVars.estado}) com Terreno da
              Fazenda ({farmVars.areaHectares.toFixed(2)} ha) e {lots.length} Grãos Mapeados:
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
            Demarque o terreno da sua roça (Plantação → Atualizar dados → Mapa) para ver a qualidade
            da lavoura pelo satélite.
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
  emptyBox: { borderRadius: 14, borderWidth: 1.5, padding: 14 },
  emptyText: { fontSize: 13, fontWeight: '700', lineHeight: 19 },
});
