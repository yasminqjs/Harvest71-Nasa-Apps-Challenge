import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppTheme } from '../theme/tokens';
import {
  CropQualityAnalysisResponse,
  FarmerActionCard,
  VisualFieldZone,
} from '../types/cropQuality';
import { GeoPoint } from '../types/domain';
import { PILOT_AREAS_AUDITED } from '../services/cropQualityService';
import { CropQualityFieldMap, mapFieldZoneIconToEmoji } from './CropQualityFieldMap';

function deriveGeometryFromZones(zones: VisualFieldZone[]): {
  centroid: GeoPoint;
  polygon: GeoPoint[];
} {
  const allCoords: [number, number][] = [];
  for (const z of zones) {
    const ring = z.polygon_geojson?.coordinates?.[0] ?? [];
    for (const pt of ring) {
      if (pt.length >= 2) allCoords.push([pt[0], pt[1]]);
    }
  }
  if (allCoords.length === 0) {
    const rawFallback = PILOT_AREAS_AUDITED[0].centroid;
    const fallback: GeoPoint = {
      latitude: rawFallback.lat,
      longitude: rawFallback.lon,
    };
    return {
      centroid: fallback,
      polygon: [
        { latitude: fallback.latitude + 0.001, longitude: fallback.longitude - 0.001 },
        { latitude: fallback.latitude + 0.001, longitude: fallback.longitude + 0.001 },
        { latitude: fallback.latitude - 0.001, longitude: fallback.longitude + 0.001 },
        { latitude: fallback.latitude - 0.001, longitude: fallback.longitude - 0.001 },
      ],
    };
  }
  const lats = allCoords.map((c) => c[1]);
  const lons = allCoords.map((c) => c[0]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  return {
    centroid: {
      latitude: Number(((minLat + maxLat) / 2).toFixed(6)),
      longitude: Number(((minLon + maxLon) / 2).toFixed(6)),
    },
    polygon: [
      { latitude: maxLat, longitude: minLon },
      { latitude: maxLat, longitude: maxLon },
      { latitude: minLat, longitude: maxLon },
      { latitude: minLat, longitude: minLon },
    ],
  };
}

interface CropQualityAnalysisCardProps {
  analysis: CropQualityAnalysisResponse;
  theme: AppTheme;
  fontScale: number;
  centroid?: GeoPoint;
  polygon?: GeoPoint[];
  selectedPilotId?: string;
  selectedZoneId?: string | null;
  isAnalyzing?: boolean;
  loadingStage?: string;
  loadingProgressPct?: number;
  loadingElapsedSec?: number;
  communityPestAlert?: boolean;
  isPlayingAudio?: boolean;
  onSelectPilotArea?: (pilotId: string) => void;
  onRefreshLive?: () => void;
  onToggleCommunityPestAlert?: () => void;
  onPlayVoiceScript?: (script: string) => void;
  onStopAudio?: () => void;
  onSelectZone?: (zone: VisualFieldZone) => void;
}

function mapActionCardEmoji(iconName: string): string {
  switch (iconName) {
    case 'search-leaf':
    case 'bug':
    case 'bug-alert':
      return '🐛';
    case 'droplet':
    case 'water-alert':
      return '💧';
    case 'flame':
    case 'flame-alert':
      return '🔥';
    case 'shield-soil':
    case 'layers':
    case 'layers-alert':
      return '🌿';
    case 'cloud':
    case 'cloud-alert':
      return '☁️';
    case 'sprout':
    case 'sprout-ok':
    default:
      return '🌱';
  }
}

function trafficPalette(status: 'RED' | 'YELLOW' | 'GREEN') {
  if (status === 'RED') {
    return {
      bg: '#FEF2F2',
      border: '#DC2626',
      badgeBg: '#DC2626',
      text: '#7F1D1D',
      label: 'VERMELHO • AÇÃO IMEDIATA',
    };
  }
  if (status === 'YELLOW') {
    return {
      bg: '#FFFBEB',
      border: '#D97706',
      badgeBg: '#D97706',
      text: '#78350F',
      label: 'AMARELO • ATENÇÃO NA ROÇA',
    };
  }
  return {
    bg: '#F0FDF4',
    border: '#16A34A',
    badgeBg: '#16A34A',
    text: '#14532D',
    label: 'VERDE • LAVOURA SAUDÁVEL',
  };
}

function translateConditionCodePt(code: string): string {
  switch (code) {
    case 'OPTIMAL_VIGOR':
      return 'Vigor Ótimo';
    case 'WATER_DEFICIT_STRESS':
      return 'Déficit Hídrico (Seca)';
    case 'PHYTOSANITARY_ANOMALY':
      return 'Anomalia Fitossanitária (Praga/Doença)';
    case 'THERMAL_HEAT_SHOCK':
      return 'Estresse Térmico na Florada';
    case 'SOIL_EROSION_EXPOSURE':
      return 'Exposição de Solo / Risco RUSLE';
    case 'INSUFFICIENT_OBSERVATION':
    default:
      return 'Cobertura de Nuvens (>40%)';
  }
}

function formatYmdDateBr(raw: string): string {
  const clean = raw.trim();
  if (/^\d{8}$/.test(clean)) {
    return `${clean.slice(6, 8)}/${clean.slice(4, 6)}/${clean.slice(0, 4)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    return `${clean.slice(8, 10)}/${clean.slice(5, 7)}/${clean.slice(0, 4)}`;
  }
  return clean;
}

function formatWindowBr(windowStr: string): string {
  const parts = windowStr.split('..');
  if (parts.length === 2) {
    return `${formatYmdDateBr(parts[0])} a ${formatYmdDateBr(parts[1])}`;
  }
  return windowStr;
}

function extractProvenanceSummary(analysis: CropQualityAnalysisResponse) {
  const list = analysis.scientific_telemetry.data_provenance ?? [];
  const findByDataset = (substr: string) =>
    list.find(
      (item) => typeof item.dataset === 'string' && item.dataset.includes(substr)
    ) as Record<string, unknown> | undefined;

  const power = findByDataset('NASA/POWER');
  const s2 = findByDataset('COPERNICUS/S2');
  const landsat = findByDataset('LANDSAT');
  const nasadem = findByDataset('NASADEM');

  const powerWindow =
    typeof power?.window === 'string' ? formatWindowBr(power.window) : 'Últimos 30 dias';
  const powerSource =
    typeof power?.source === 'string' ? power.source : 'power.larc.nasa.gov (API AG)';
  const s2Date =
    typeof s2?.acquisition_date === 'string' ? formatYmdDateBr(s2.acquisition_date) : '—';
  const s2Scene = typeof s2?.scene_id === 'string' ? s2.scene_id : 'Sentinel-2 L2A';
  const landsatDate =
    typeof landsat?.acquisition_date === 'string' && landsat.acquisition_date !== 'N/A'
      ? formatYmdDateBr(landsat.acquisition_date)
      : 'Derivado térmico 30 m';
  const landsatScene =
    typeof landsat?.scene_id === 'string' ? landsat.scene_id : 'Landsat C2 TIRS';
  const nasademTile =
    typeof nasadem?.tile_id === 'string' ? nasadem.tile_id : 'NASADEM 30 m';

  const evalDate = analysis.evaluated_at_utc
    ? `${formatYmdDateBr(analysis.evaluated_at_utc)} às ${analysis.evaluated_at_utc.slice(11, 19)} UTC`
    : 'Agora';

  return {
    evalDate,
    powerWindow,
    powerSource,
    s2Date,
    s2Scene,
    landsatDate,
    landsatScene,
    nasademTile,
  };
}

export const CropQualityAnalysisCard: React.FC<CropQualityAnalysisCardProps> = ({
  analysis,
  theme,
  fontScale,
  centroid,
  polygon,
  selectedPilotId,
  selectedZoneId,
  isAnalyzing = false,
  loadingStage = 'Conectando à NASA POWER & Planetary Computer STAC...',
  loadingProgressPct = 0,
  loadingElapsedSec = 0,
  communityPestAlert = false,
  isPlayingAudio = false,
  onSelectPilotArea,
  onRefreshLive,
  onToggleCommunityPestAlert,
  onPlayVoiceScript,
  onStopAudio,
  onSelectZone,
}) => {
  const [showJudgeData, setShowJudgeData] = useState(false);

  const view = analysis.farmer_accessible_view;
  const palette = trafficPalette(view.overall_traffic_light);
  const bio = analysis.scientific_telemetry.biophysical_indices;
  const baseline = analysis.crop_agronomic_baseline;
  const dssat = analysis.dssat_state_vector;
  const cacheMeta = analysis.cache_metadata;

  const derivedGeo = deriveGeometryFromZones(view.visual_field_zones);
  const mapPolygon = polygon && polygon.length >= 3 ? polygon : derivedGeo.polygon;
  const mapCentroid = centroid ?? derivedGeo.centroid;
  const activeZone =
    view.visual_field_zones.find((z) => z.zone_id === selectedZoneId) ??
    view.visual_field_zones[0] ??
    null;

  const isFallback = Boolean(cacheMeta?.fallback_used);
  const provSummary = extractProvenanceSummary(analysis);
  const sourceBadge = isFallback
    ? `⚡ Cache Auditado NASA (${cacheMeta?.latency_ms ?? 4}ms)`
    : `🟢 AO VIVO • Consultado na NASA (${cacheMeta?.latency_ms ?? 0}ms)`;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.surface,
          borderColor: palette.border,
        },
      ]}
    >
      {/* Topo da Visão Agricultor com Semáforo de Alto Contraste */}
      <View
        style={[
          styles.heroBanner,
          { backgroundColor: palette.bg, borderColor: palette.border },
        ]}
      >
        <View style={styles.heroTopRow}>
          <View style={[styles.trafficPill, { backgroundColor: palette.badgeBg }]}>
            <Text style={styles.trafficPillText}>{palette.label}</Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={[styles.scoreNum, { color: palette.badgeBg }]}>
              {view.health_score_0_to_100}/100
            </Text>
          </View>
        </View>

        <View style={styles.heroTitleRow}>
          <Text style={styles.heroEmoji}>{mapActionCardEmoji(view.status_icon)}</Text>
          <View style={styles.flexOne}>
            <Text
              style={[
                styles.heroTitle,
                { color: palette.text, fontSize: 18 * fontScale },
              ]}
            >
              {view.status_badge_title}
            </Text>
            <Text style={[styles.heroSub, { color: palette.text }]}>
              {baseline.common_name_pt} ({baseline.scientific_name}) •{' '}
              {baseline.fao_gaez_v4_suitability.water_supply_regime === 'IRRIGATED'
                ? 'Irrigado'
                : 'Sequeiro'}
            </Text>
          </View>
        </View>

        <Text style={[styles.provenancePill, { color: palette.text }]}>{sourceBadge}</Text>
        <View style={styles.datesVerifyBox}>
          <Text style={styles.datesVerifyTitle}>
            📅 Datas Reais dos Dados NASA &amp; Satélite:
          </Text>
          <Text style={styles.datesVerifyLine}>
            • Consulta executada: {provSummary.evalDate}
          </Text>
          <Text style={styles.datesVerifyLine}>
            • NASA POWER / MERRA-2: {provSummary.powerWindow} ({provSummary.powerSource})
          </Text>
          <Text style={styles.datesVerifyLine}>
            • Sentinel-2 L2A (10 m): {provSummary.s2Date} ({provSummary.s2Scene})
          </Text>
          <Text style={styles.datesVerifyLine}>
            • NASA/USGS Landsat TIRS: {provSummary.landsatDate} • NASADEM: {provSummary.nasademTile}
          </Text>
        </View>
      </View>

      {/* Botão de Destaque Web Speech API / Expo Speech (pt-BR) */}
      <Pressable
        onPress={() => {
          if (isPlayingAudio) {
            onStopAudio?.();
          } else {
            onPlayVoiceScript?.(view.voice_tts_script_pt);
          }
        }}
        accessibilityRole="button"
        accessibilityLabel="Ouvir Diagnóstico da Roça"
        style={({ pressed }) => [
          styles.voiceMainBtn,
          {
            backgroundColor: isPlayingAudio ? '#B91C1C' : '#0F172A',
            opacity: pressed ? 0.88 : 1,
          },
        ]}
      >
        <Text style={styles.voiceBtnEmoji}>{isPlayingAudio ? '⏹️' : '🔊'}</Text>
        <View style={styles.flexOne}>
          <Text style={[styles.voiceBtnTitle, { fontSize: 16 * fontScale }]}>
            {isPlayingAudio ? 'Tocando Diagnóstico (Toque para Parar)' : 'Ouvir Diagnóstico da Roça'}
          </Text>
          <Text style={styles.voiceBtnSub}>
            {isPlayingAudio
              ? '🎙️ Narrando em Português claro (pt-BR)...'
              : 'Explicação falada em linguagem simples da sua lavoura'}
          </Text>
        </View>
      </Pressable>

      {/* Seletor rápido dos 3 Polígonos Piloto do Nordeste + Ações Ao Vivo */}
      {(onSelectPilotArea || onRefreshLive) && (
        <View style={styles.controlsBox}>
          <Text style={[styles.sectionMiniTitle, { color: theme.textMuted }]}>
            ÁREAS PILOTO DO SEMIÁRIDO (&lt; 5 ha) &amp; SATÉLITE AO VIVO
          </Text>
          {onSelectPilotArea && (
            <View style={styles.chipsRow}>
              {PILOT_AREAS_AUDITED.map((pilot) => {
                const active = selectedPilotId === pilot.id;
                return (
                  <Pressable
                    key={pilot.id}
                    onPress={() => onSelectPilotArea(pilot.id)}
                    style={[
                      styles.pilotChip,
                      {
                        backgroundColor: active ? theme.primary : theme.bg,
                        borderColor: active ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pilotChipText,
                        { color: active ? '#FFFFFF' : theme.text },
                      ]}
                    >
                      {pilot.municipality}-{pilot.state} ({pilot.area_ha} ha)
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={styles.chipsRow}>
            {onRefreshLive && (
              <Pressable
                onPress={onRefreshLive}
                disabled={isAnalyzing}
                style={[
                  styles.liveBtn,
                  {
                    backgroundColor: '#1E3A8A',
                    opacity: isAnalyzing ? 0.72 : 1,
                  },
                ]}
              >
                {isAnalyzing ? (
                  <View style={styles.liveBtnLoadingRow}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.liveBtnText}>
                      Sincronizando ({loadingProgressPct}%)...
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.liveBtnText}>🛰️ Atualizar Satélite Ao Vivo</Text>
                )}
              </Pressable>
            )}

            {onToggleCommunityPestAlert && (
              <Pressable
                onPress={onToggleCommunityPestAlert}
                style={[
                  styles.pestToggleBtn,
                  {
                    backgroundColor: communityPestAlert ? '#FEF2F2' : theme.bg,
                    borderColor: communityPestAlert ? '#DC2626' : theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.pestToggleText,
                    { color: communityPestAlert ? '#991B1B' : theme.text },
                  ]}
                >
                  🐛 Alerta Praga Vizinha: {communityPestAlert ? 'SIM' : 'NÃO'}
                </Text>
              </Pressable>
            )}
          </View>

          {isAnalyzing && (
            <View style={styles.loadingCard}>
              <View style={styles.loadingHeaderRow}>
                <ActivityIndicator size="small" color="#1D4ED8" />
                <Text style={styles.loadingTitle}>
                  Baixando Satélite NASA &amp; Copernicus Ao Vivo
                </Text>
                <Text style={styles.loadingPctBadge}>
                  {loadingProgressPct}% • {loadingElapsedSec}s
                </Text>
              </View>
              <View style={styles.loadingTrack}>
                <View
                  style={[
                    styles.loadingFill,
                    { width: `${Math.max(8, Math.min(100, loadingProgressPct))}%` },
                  ]}
                />
              </View>
              <Text style={styles.loadingStageText}>{loadingStage}</Text>
              <Text style={styles.loadingBgNote}>
                🔄 Carregando em 2º plano: você pode mudar de aba (Mapa, Início, PANCs) que a busca do satélite continua rodando sem interromper!
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Mapa Embutido da Plantação com Marcadores de Qualidade do Satélite */}
      <View style={styles.mapBlock}>
        <Text style={[styles.sectionTitle, { color: theme.text, fontSize: 15 * fontScale }]}>
          🗺️ Mapa da Plantação &amp; Marcadores de Qualidade (Satélite 10m)
        </Text>
        <Text style={[styles.mapHintText, { color: theme.textMuted }]}>
          Cada marcador colorido mostra a condição real encontrada por Sentinel-2 e Landsat dentro do seu talhão.
        </Text>

        <CropQualityFieldMap
          centroid={mapCentroid}
          polygon={mapPolygon}
          fieldZones={view.visual_field_zones}
          selectedZoneId={activeZone?.zone_id ?? null}
          onSelectFieldZone={onSelectZone}
          theme={theme}
          height={235}
        />

        {activeZone && (
          <View
            style={[
              styles.selectedZoneBox,
              {
                borderColor: activeZone.color_hex,
                backgroundColor: `${activeZone.color_hex}14`,
              },
            ]}
          >
            <View style={styles.selectedZoneTop}>
              <Text style={styles.selectedZoneEmoji}>
                {mapFieldZoneIconToEmoji(activeZone.icon_name)}
              </Text>
              <View style={styles.flexOne}>
                <Text style={[styles.selectedZoneTitle, { color: theme.text }]}>
                  {activeZone.location_label_pt}
                </Text>
                <Text style={[styles.selectedZoneSub, { color: activeZone.color_hex }]}>
                  {activeZone.short_label_pt}
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  onPlayVoiceScript?.(
                    `${activeZone.location_label_pt}: ${activeZone.short_label_pt}`
                  )
                }
                style={styles.miniAudioBtn}
              >
                <Text style={styles.miniAudioText}>🔊 Ouvir esta zona</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* Zonas do Terreno (Talhões 10m clusterizados) */}
      <View style={styles.zonesBlock}>
        <Text style={[styles.sectionTitle, { color: theme.text, fontSize: 15 * fontScale }]}>
          Manchas da Sua Roça no Satélite
        </Text>
        <View style={styles.zonesList}>
          {view.visual_field_zones.map((zone) => {
            const isSelected = selectedZoneId === zone.zone_id;
            return (
              <Pressable
                key={zone.zone_id}
                onPress={() => onSelectZone?.(zone)}
                style={[
                  styles.zoneRow,
                  {
                    borderColor: isSelected ? '#111827' : zone.color_hex,
                    borderWidth: isSelected ? 2.5 : 1.5,
                    backgroundColor: `${zone.color_hex}14`,
                  },
                ]}
              >
                <Text style={styles.zoneEmoji}>{mapFieldZoneIconToEmoji(zone.icon_name)}</Text>
                <View style={styles.flexOne}>
                  <Text style={[styles.zoneLocation, { color: theme.text }]}>
                    {zone.location_label_pt}
                  </Text>
                  <Text style={[styles.zoneShortLabel, { color: zone.color_hex }]}>
                    {zone.short_label_pt}
                  </Text>
                </View>
                <View style={[styles.zoneDot, { backgroundColor: zone.color_hex }]} />
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Passo-a-Passo Simples de Alto Contraste para Leitura sob Sol Forte */}
      <View style={styles.actionsBlock}>
        <Text style={[styles.sectionTitle, { color: theme.text, fontSize: 15 * fontScale }]}>
          O Que Fazer Hoje na Lavoura
        </Text>
        {view.action_cards.map((card: FarmerActionCard) => {
          const cardPalette = trafficPalette(card.urgency_color);
          return (
            <View
              key={`step-${card.step_number}`}
              style={[
                styles.actionCard,
                {
                  backgroundColor: '#FFFFFF',
                  borderColor: cardPalette.border,
                },
              ]}
            >
              <View style={styles.actionHeader}>
                <View style={[styles.stepBadge, { backgroundColor: cardPalette.badgeBg }]}>
                  <Text style={styles.stepBadgeText}>Passo {card.step_number}</Text>
                </View>
                <Text style={styles.actionEmoji}>{mapActionCardEmoji(card.icon_name)}</Text>
                <Pressable
                  onPress={() => onPlayVoiceScript?.(`${card.title_pt}. ${card.instruction_pt}`)}
                  style={styles.miniAudioBtn}
                >
                  <Text style={styles.miniAudioText}>🔊 Ouvir</Text>
                </Pressable>
              </View>
              <Text style={[styles.actionTitle, { fontSize: 15 * fontScale }]}>
                {card.title_pt}
              </Text>
              <Text style={[styles.actionBody, { fontSize: 14 * fontScale }]}>
                {card.instruction_pt}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Modo Técnico / Juiz da NASA (Toggle Expansível) */}
      <Pressable
        onPress={() => setShowJudgeData((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel="Dados Científicos NASA e DSSAT"
        style={[
          styles.judgeToggleBtn,
          {
            backgroundColor: showJudgeData ? '#0F172A' : '#EEF2FF',
            borderColor: '#1E40AF',
          },
        ]}
      >
        <Text
          style={[
            styles.judgeToggleText,
            { color: showJudgeData ? '#FFFFFF' : '#1E3A8A', fontSize: 14 * fontScale },
          ]}
        >
          🛰️ Dados Científicos NASA &amp; DSSAT {showJudgeData ? '▲' : '▼'}
        </Text>
      </Pressable>

      {showJudgeData && (
        <View style={styles.judgePanel}>
          <Text style={styles.judgeHeading}>1. Telemetria Biofísica (Sentinel-2 / Landsat / POWER)</Text>
          <View style={styles.metricsGrid}>
            <MetricChip label="NDVI Médio (10m)" value={bio.ndvi_mean.toFixed(3)} />
            <MetricChip
              label="NDVI Z-Score Hist."
              value={bio.ndvi_phenological_z_score.toFixed(2)}
              highlight={bio.ndvi_phenological_z_score <= -1.5}
            />
            <MetricChip label="EVI" value={bio.evi_mean.toFixed(3)} />
            <MetricChip label="LAI (Boegh et al.)" value={`${bio.lai_boegh_m2_m2.toFixed(2)} m²/m²`} />
            <MetricChip label="NDWI (Gao)" value={bio.ndwi_gao_mean.toFixed(3)} />
            <MetricChip label="NDWI Z-Score" value={bio.ndwi_z_score.toFixed(2)} />
            <MetricChip label="BSI (Rikimaru)" value={bio.bsi_rikimaru_mean.toFixed(3)} />
            <MetricChip label="Tc Folha (Landsat)" value={`${bio.canopy_temp_celsius.toFixed(1)} °C`} />
            <MetricChip
              label="CWSI (Jackson 1981)"
              value={bio.cwsi_jackson_index.toFixed(3)}
              highlight={bio.cwsi_jackson_index >= 0.5}
            />
            <MetricChip
              label="NASA GWETROOT"
              value={bio.nasa_gwetroot_0_to_1.toFixed(3)}
              highlight={bio.nasa_gwetroot_0_to_1 < 0.4}
            />
            <MetricChip
              label="FAO-56 Ks"
              value={bio.fao56_ks_water_stress_coeff.toFixed(3)}
              highlight={bio.fao56_ks_water_stress_coeff < 0.55}
            />
            <MetricChip label="GDD Acumulado" value={`${bio.gdd_accumulated_c_day.toFixed(0)} °C·d`} />
            <MetricChip label="ET0 FAO-56 (30d)" value={`${bio.et0_fao56_30d_mm.toFixed(1)} mm`} />
            <MetricChip label="Chuva POWER (30d)" value={`${bio.precip_gpm_power_30d_mm.toFixed(1)} mm`} />
            <MetricChip label="RUSLE C" value={bio.rusle_c_factor.toFixed(3)} />
            <MetricChip label="RUSLE LS (NASADEM)" value={bio.rusle_ls_factor.toFixed(2)} />
          </View>

          <Text style={styles.judgeHeading}>2. Matriz Multi-Cenário &amp; Equações Acionadas</Text>
          {analysis.scientific_telemetry.diagnostic_assessments.map((ass, i) => (
            <View key={`${ass.condition_code}-${i}`} style={styles.assessmentBox}>
              <Text style={styles.assessmentTitle}>
                {translateConditionCodePt(ass.condition_code)} • {ass.severity} (Confiança{' '}
                {Math.round(ass.confidence * 100)}%)
              </Text>
              <Text style={styles.monoCode}>{ass.equation_triggered}</Text>
            </View>
          ))}

          <Text style={styles.judgeHeading}>3. FAO EcoCrop &amp; Aptidão FAO GAEZ v4</Text>
          <View style={styles.assessmentBox}>
            <Text style={styles.assessmentBody}>
              Espécie: {baseline.scientific_name} ({baseline.common_name_pt}){'\n'}
              EcoCrop: Tbase={baseline.fao_ecocrop_parameters.t_base_c}°C • Topt=
              {baseline.fao_ecocrop_parameters.t_opt_min_c}–
              {baseline.fao_ecocrop_parameters.t_opt_max_c}°C • Tmax=
              {baseline.fao_ecocrop_parameters.t_max_lethal_c}°C • Ciclo=
              {baseline.fao_ecocrop_parameters.cycle_days_min}–
              {baseline.fao_ecocrop_parameters.cycle_days_max} dias • Rmin=
              {baseline.fao_ecocrop_parameters.r_min_mm} mm{'\n'}
              GAEZ v4: Índice {baseline.fao_gaez_v4_suitability.suitability_index_0_100}/100 •
              Produtividade Baixo Insumo:{' '}
              {baseline.fao_gaez_v4_suitability.attainable_yield_low_input_kg_ha.toFixed(0)} kg/ha
            </Text>
          </View>

          <Text style={styles.judgeHeading}>4. Vetor de Estado DSSAT (Módulo de Rotação)</Text>
          <View style={styles.assessmentBox}>
            <Text style={styles.monoCode}>
              observed_lai_m2_m2: {dssat.observed_lai_m2_m2}{'\n'}
              water_stress_factor_swfac: {dssat.water_stress_factor_swfac}{'\n'}
              rootzone_soil_wetness_fraction: {dssat.rootzone_soil_wetness_fraction}{'\n'}
              soil_surface_cover_fraction: {dssat.soil_surface_cover_fraction}{'\n'}
              accumulated_gdd: {dssat.accumulated_gdd}{'\n'}
              pest_disease_damage_detected: {String(dssat.pest_disease_damage_detected)}{'\n'}
              rotation_constraints: [{dssat.rotation_constraints_for_dssat.join(', ')}]
            </Text>
          </View>

          <Text style={styles.judgeHeading}>5. Proveniência das Cenas &amp; Escala</Text>
          {analysis.scientific_telemetry.data_provenance.map((prov, idx) => (
            <View key={`prov-${idx}`} style={styles.provenanceBox}>
              <Text style={styles.monoCode}>{JSON.stringify(prov)}</Text>
            </View>
          ))}

          {analysis.scale_disclaimers.map((disc, idx) => (
            <Text key={`disc-${idx}`} style={styles.disclaimerText}>
              ℹ️ {disc}
            </Text>
          ))}

          <View style={styles.hitlBox}>
            <Text style={styles.hitlText}>👩🏽‍🌾 {analysis.human_in_the_loop_notice}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const MetricChip: React.FC<{ label: string; value: string; highlight?: boolean }> = ({
  label,
  value,
  highlight = false,
}) => (
  <View style={[styles.metricChip, highlight && styles.metricChipHighlight]}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={[styles.metricValue, highlight && styles.metricValueHighlight]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    borderWidth: 2,
    padding: 14,
    gap: 12,
  },
  flexOne: { flex: 1 },
  heroBanner: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 14,
    gap: 8,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  trafficPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  trafficPillText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11,
  },
  scoreBox: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  scoreNum: {
    fontWeight: '900',
    fontSize: 14,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroEmoji: { fontSize: 34 },
  heroTitle: { fontWeight: '900', lineHeight: 22 },
  heroSub: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  provenancePill: { fontSize: 11, fontWeight: '800' },
  datesVerifyBox: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.15)',
    gap: 2,
    marginTop: 2,
  },
  datesVerifyTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0F172A',
  },
  datesVerifyLine: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E293B',
    lineHeight: 14,
  },
  voiceMainBtn: {
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  voiceBtnEmoji: { fontSize: 28 },
  voiceBtnTitle: { color: '#FFFFFF', fontWeight: '900' },
  voiceBtnSub: { color: '#CBD5E1', fontSize: 12, marginTop: 2 },
  controlsBox: { gap: 8 },
  sectionMiniTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pilotChip: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pilotChipText: { fontSize: 12, fontWeight: '800' },
  liveBtn: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 34,
    justifyContent: 'center',
  },
  liveBtnLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  loadingCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#60A5FA',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  loadingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingTitle: {
    flex: 1,
    color: '#1E3A8A',
    fontSize: 13,
    fontWeight: '900',
  },
  loadingPctBadge: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '900',
  },
  loadingTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#DBEAFE',
    overflow: 'hidden',
  },
  loadingFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#2563EB',
  },
  loadingStageText: {
    color: '#1E40AF',
    fontSize: 12,
    fontWeight: '800',
  },
  loadingBgNote: {
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 8,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
  mapBlock: {
    gap: 8,
  },
  mapHintText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  selectedZoneBox: {
    borderRadius: 14,
    borderWidth: 2,
    padding: 10,
  },
  selectedZoneTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectedZoneEmoji: {
    fontSize: 24,
  },
  selectedZoneTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  selectedZoneSub: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 1,
  },
  pestToggleBtn: {
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pestToggleText: { fontSize: 12, fontWeight: '800' },
  zonesBlock: { gap: 8 },
  sectionTitle: { fontWeight: '900' },
  zonesList: { gap: 8 },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    gap: 10,
  },
  zoneEmoji: { fontSize: 24 },
  zoneLocation: { fontSize: 13, fontWeight: '900' },
  zoneShortLabel: { fontSize: 13, fontWeight: '800', marginTop: 1 },
  zoneDot: { width: 12, height: 12, borderRadius: 6 },
  actionsBlock: { gap: 8 },
  actionCard: {
    borderWidth: 2,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  stepBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  actionEmoji: { fontSize: 22 },
  miniAudioBtn: {
    marginLeft: 'auto',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  miniAudioText: { color: '#0F172A', fontSize: 12, fontWeight: '800' },
  actionTitle: { color: '#0F172A', fontWeight: '900' },
  actionBody: { color: '#1E293B', lineHeight: 20, fontWeight: '600' },
  judgeToggleBtn: {
    borderRadius: 14,
    borderWidth: 2,
    padding: 12,
    alignItems: 'center',
  },
  judgeToggleText: { fontWeight: '900' },
  judgePanel: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  judgeHeading: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metricChip: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  metricChipHighlight: {
    borderColor: '#F59E0B',
    backgroundColor: '#27201A',
  },
  metricLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '700' },
  metricValue: { color: '#F8FAFC', fontSize: 13, fontWeight: '900', marginTop: 2 },
  metricValueHighlight: { color: '#FBBF24' },
  assessmentBox: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  assessmentTitle: { color: '#FCD34D', fontSize: 12, fontWeight: '900' },
  assessmentBody: { color: '#E2E8F0', fontSize: 12, lineHeight: 18 },
  monoCode: {
    color: '#A7F3D0',
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  provenanceBox: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 8,
  },
  disclaimerText: {
    color: '#CBD5E1',
    fontSize: 11,
    lineHeight: 16,
  },
  hitlBox: {
    backgroundColor: '#14532D',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  hitlText: {
    color: '#ECFDF5',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
});
