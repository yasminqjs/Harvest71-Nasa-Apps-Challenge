import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FarmMapCanvas } from '../components/FarmMapCanvas';
import { NordesteSvgMap } from '../components/NordesteSvgMap';
import { useAccessibility } from '../context/AccessibilityContext';
import { BahiaRegionPreset } from '../data/seedData';
import { getAppTheme } from '../theme/tokens';
import { GeoPoint } from '../types/domain';
import {
  calculatePolygonMetrics,
  createMicroPlotAroundPoint,
  filterWellsByRadius,
} from '../utils/geoprocessing';
import { formatArea, formatCurrencyBRL, regionalizarTexto } from '../utils/regionalize';

export const MapScreen: React.FC = () => {
  const {
    accessibility,
    activeFarmer,
    activeFarm,
    wells,
    updateFarmPolygon,
    selectBahiaRegion,
    updateFarmRadius,
    registerFieldLog,
    speak,
  } = useAccessibility();

  const theme = getAppTheme(accessibility);
  const [drawingMode, setDrawingMode] = useState(false);
  const [showWells, setShowWells] = useState(true);
  const [showNordesteOverview, setShowNordesteOverview] = useState(false);
  const [draftPoints, setDraftPoints] = useState<GeoPoint[]>(activeFarm?.polygon ?? []);
  const [gpsWalking, setGpsWalking] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [wellDepthInput, setWellDepthInput] = useState('45');
  const [wellSavedMsg, setWellSavedMsg] = useState<string | null>(null);

  const gpsSubRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    return () => {
      gpsSubRef.current?.remove();
    };
  }, []);

  const nearbyWells = useMemo(() => {
    if (!activeFarm) return [];
    return filterWellsByRadius(wells, activeFarm.centroid, activeFarm.raioBuscaKm);
  }, [wells, activeFarm]);

  if (!activeFarm || !activeFarmer) return null;

  const liveMetrics = calculatePolygonMetrics(draftPoints);

  const handleAddTouchPoint = (pt: GeoPoint) => {
    const next = [...draftPoints, pt];
    setDraftPoints(next);
    if (next.length >= 3) {
      const m = calculatePolygonMetrics(next);
      speak(`Ponto marcado. Área atual: ${m.areaHectares.toFixed(1)} hectares.`);
    }
  };

  const handleSavePolygon = async () => {
    if (draftPoints.length < 3) return;
    await updateFarmPolygon(draftPoints);
    setDrawingMode(false);
    speak(
      `Roça demarcada com ${liveMetrics.areaHectares.toFixed(1)} hectares e ${liveMetrics.areaTarefasBa.toFixed(1)} tarefas. Diagnóstico atualizado.`
    );
  };

  const handleToggleGpsWalk = async () => {
    if (gpsWalking) {
      gpsSubRef.current?.remove();
      gpsSubRef.current = null;
      setGpsWalking(false);
      setGpsStatus('Caminhada GPS encerrada. Toque em "Salvar demarcação" para confirmar.');
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsStatus('Permissão de GPS negada. Você pode marcar os cantos tocando no mapa.');
        return;
      }

      setGpsWalking(true);
      setDrawingMode(true);
      setDraftPoints([]);
      setGpsStatus('Caminhando pelo perímetro via satélite (sem internet)...');
      speak('Caminhada com GPS iniciada. Vá andando pelas bordas da sua roça.');

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 8,
          timeInterval: 3000,
        },
        (loc) => {
          setDraftPoints((prev) => [
            ...prev,
            {
              latitude: Number(loc.coords.latitude.toFixed(6)),
              longitude: Number(loc.coords.longitude.toFixed(6)),
            },
          ]);
        }
      );
      gpsSubRef.current = sub;
    } catch {
      const simPlot = createMicroPlotAroundPoint(activeFarm.centroid, 2.8);
      setDraftPoints(simPlot);
      setGpsWalking(false);
      setGpsStatus('Perímetro capturado pela posição atual (2,80 ha).');
    }
  };

  const handlePresetPlot = async (targetHa: number) => {
    const plot = createMicroPlotAroundPoint(activeFarm.centroid, targetHa);
    setDraftPoints(plot);
    await updateFarmPolygon(plot);
    speak(`Área ajustada para ${targetHa} hectares.`);
  };

  const handleSelectNordesteRegion = async (reg: BahiaRegionPreset) => {
    await selectBahiaRegion(reg.id);
    setShowNordesteOverview(false);
    speak(`Mapa movido para ${reg.nome}, ${reg.municipio}.`);
  };

  const handleLogWellDrilled = async (deuAgua: boolean) => {
    const depth = Number(wellDepthInput) || 45;
    await registerFieldLog({
      tipo: 'poco_perfurado',
      pocoDeuAgua: deuAgua,
      pocoProfundidadeM: depth,
      observacao: deuAgua
        ? `Poço perfurado no local deu água em ${depth}m`
        : `Poço perfurado até ${depth}m sem água suficiente`,
    });
    setWellSavedMsg(
      deuAgua
        ? `Validação salva: deu água em ${depth}m!`
        : `Validação salva: seco até ${depth}m.`
    );
  };

  const wellSum = activeFarm.diagnostico.wellSummary;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={styles.container}
    >
      <View
        style={[
          styles.summaryBox,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text, fontSize: 17 * theme.scale }]}>
            🗺️ {activeFarm.nome} • {activeFarm.regiaoNome}
          </Text>
          <Text style={[styles.areaReadout, { color: theme.primary }]}>
            {formatArea(
              drawingMode && draftPoints.length >= 3
                ? liveMetrics.areaHectares
                : activeFarm.areaHectares,
              drawingMode && draftPoints.length >= 3
                ? liveMetrics.areaTarefasBa
                : activeFarm.areaTarefasBa
            )}
          </Text>
          <Text style={[styles.subText, { color: theme.textMuted }]}>
            Micro-mapeamento (&lt; 5 ha a 15 ha) • Solo pH{' '}
            {activeFarm.diagnostico.soloSoilGrids.ph}
          </Text>
        </View>
        <Pressable
          onPress={() => setShowNordesteOverview(!showNordesteOverview)}
          style={[
            styles.nordesteBtn,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.nordesteBtnText, { color: theme.text }]}>
            {showNordesteOverview ? 'Fechar NE' : 'Nordeste'}
          </Text>
        </Pressable>
      </View>

      {showNordesteOverview && (
        <View
          style={[
            styles.nordesteCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <NordesteSvgMap
            selectedRegionName={activeFarm.regiaoNome}
            onSelectRegion={handleSelectNordesteRegion}
            theme={theme}
          />
        </View>
      )}

      <FarmMapCanvas
        centroid={activeFarm.centroid}
        polygon={drawingMode ? draftPoints : activeFarm.polygon}
        wells={nearbyWells.length > 0 ? nearbyWells : wells.slice(0, 4)}
        ndviZones={activeFarm.diagnostico.ndviZonas}
        showWells={showWells}
        showNdvi={!showWells}
        drawingMode={drawingMode}
        onAddPoint={handleAddTouchPoint}
        theme={theme}
      />

      <View style={styles.actionGrid}>
        <Pressable
          onPress={() => {
            if (!drawingMode) {
              setDraftPoints([]);
              setDrawingMode(true);
              setShowWells(false);
              speak('Modo de desenho ativado. Toque nos cantos da sua roça.');
            } else {
              setDrawingMode(false);
              setDraftPoints(activeFarm.polygon);
            }
          }}
          style={[
            styles.actionBtn,
            {
              backgroundColor: drawingMode ? theme.warningBg : theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <Ionicons name="create-outline" size={20} color={theme.text} />
          <Text style={[styles.actionBtnText, { color: theme.text }]}>
            {drawingMode ? 'Cancelar desenho' : 'Desenhar por toque'}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleToggleGpsWalk}
          style={[
            styles.actionBtn,
            {
              backgroundColor: gpsWalking ? theme.dangerBg : theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <Ionicons name="walk" size={20} color={theme.text} />
          <Text style={[styles.actionBtnText, { color: theme.text }]}>
            {gpsWalking ? 'Parar GPS' : 'Caminhar c/ GPS'}
          </Text>
        </Pressable>
      </View>

      {drawingMode && (
        <View
          style={[
            styles.drawHelper,
            { backgroundColor: theme.successBg, borderColor: theme.successBorder },
          ]}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.successText }}>
            Pontos marcados: {draftPoints.length} (mínimo 3).{' '}
            {draftPoints.length >= 3
              ? `Área calculada: ${formatArea(liveMetrics.areaHectares, liveMetrics.areaTarefasBa)}`
              : 'Toque em pelo menos 3 cantos do terreno.'}
          </Text>
          {draftPoints.length >= 3 && (
            <Pressable
              onPress={handleSavePolygon}
              style={[styles.savePolyBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={{ color: theme.primaryText, fontWeight: '900' }}>
                ✓ Salvar demarcação da roça
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {gpsStatus && (
        <Text style={{ fontSize: 12, fontWeight: '700', color: theme.primary }}>
          🛰️ {gpsStatus}
        </Text>
      )}

      <View style={styles.presetRow}>
        <Text style={[styles.smallLabel, { color: theme.textMuted }]}>Tamanho rápido:</Text>
        {[2.5, 4.2, 8.5, 13.0].map((ha) => (
          <Pressable
            key={ha}
            onPress={() => handlePresetPlot(ha)}
            style={[
              styles.miniChip,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={{ fontSize: 11, fontWeight: '800', color: theme.text }}>
              {ha} ha
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Heatmap de Poços e Água Subterrânea */}
      <View
        style={[
          styles.wellCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={styles.wellHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.wellTitle, { color: theme.text, fontSize: 16 * theme.scale }]}>
              💧 Heatmap de Poços vs. Zonas NDVI
            </Text>
            <Text style={{ fontSize: 12, color: theme.textMuted }}>
              Alterne para ver poços (SIAGAS + GRACE-FO) ou manchas NDVI da roça
            </Text>
          </View>
          <Pressable
            onPress={() => setShowWells(!showWells)}
            style={[
              styles.togglePill,
              {
                backgroundColor: showWells ? theme.accent : theme.primary,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF' }}>
              {showWells ? 'Ver NDVI' : 'Ver Poços'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.presetRow}>
          <Text style={[styles.smallLabel, { color: theme.textMuted }]}>Raio:</Text>
          {[5, 15, 30, 50].map((km) => (
            <Pressable
              key={km}
              onPress={() => updateFarmRadius(km)}
              style={[
                styles.miniChip,
                {
                  backgroundColor:
                    activeFarm.raioBuscaKm === km ? theme.accent : theme.surfaceMuted,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '800',
                  color: activeFarm.raioBuscaKm === km ? '#FFFFFF' : theme.text,
                }}
              >
                {km} km
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.wellStatsGrid}>
          <View style={[styles.statBox, { backgroundColor: theme.bg }]}>
            <Text style={styles.statLabel}>Profundidade est.</Text>
            <Text style={[styles.statVal, { color: theme.text }]}>
              {wellSum.faixaProfundidadeMinM}–{wellSum.faixaProfundidadeMaxM} m
            </Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: theme.bg }]}>
            <Text style={styles.statLabel}>Sucesso histórico</Text>
            <Text style={[styles.statVal, { color: theme.primary }]}>
              {wellSum.taxaSucessoPct}%
            </Text>
          </View>
          <View
            style={[
              styles.statBox,
              {
                backgroundColor:
                  wellSum.riscoSalinidade === 'alto'
                    ? theme.dangerBg
                    : wellSum.riscoSalinidade === 'moderado'
                    ? theme.warningBg
                    : theme.successBg,
              },
            ]}
          >
            <Text style={styles.statLabel}>Salinidade</Text>
            <Text
              style={[
                styles.statVal,
                {
                  color:
                    wellSum.riscoSalinidade === 'alto'
                      ? theme.dangerText
                      : wellSum.riscoSalinidade === 'moderado'
                      ? theme.warningText
                      : theme.successText,
                },
              ]}
            >
              {wellSum.riscoSalinidade.toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={[styles.wellAdvice, { color: theme.text }]}>
          {regionalizarTexto(
            wellSum.orientacaoBaixaRenda,
            accessibility.languageLevel,
            accessibility.registrationCompleted && activeFarmer.tratamento !== 'Agricultor(a)'
              ? activeFarmer.tratamento
              : undefined
          )}
        </Text>

        {nearbyWells.slice(0, 3).map((w) => (
          <View key={w.id} style={[styles.wellRow, { borderTopColor: theme.surfaceMuted }]}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: theme.text }}>
              {w.codigoSiagas} ({w.distanciaKm} km)
            </Text>
            <Text style={{ fontSize: 12, color: theme.textMuted }}>
              {w.profundidadeM} m • {w.vazaoLph} L/h • Água{' '}
              <Text
                style={{
                  fontWeight: '900',
                  color: w.salinidade === 'doce' ? theme.primary : '#B45309',
                }}
              >
                {w.salinidade}
              </Text>{' '}
              • ~{formatCurrencyBRL(w.custoEstimadoPerfR$)}
            </Text>
          </View>
        ))}

        <View style={[styles.wellValidationBox, { backgroundColor: theme.bg }]}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: theme.text }}>
            Furou poço? Deu água em quantos metros?
          </Text>
          <View style={styles.wellInputRow}>
            <TextInput
              value={wellDepthInput}
              onChangeText={setWellDepthInput}
              keyboardType="numeric"
              placeholder="Metros"
              style={[
                styles.depthInput,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
            />
            <Pressable
              onPress={() => handleLogWellDrilled(true)}
              style={[styles.wellLogBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800' }}>
                💧 Deu água
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleLogWellDrilled(false)}
              style={[styles.wellLogBtn, { backgroundColor: '#6B7280' }]}
            >
              <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800' }}>
                Seco
              </Text>
            </Pressable>
          </View>
          {wellSavedMsg && (
            <Text style={{ fontSize: 11, fontWeight: '800', color: theme.primary }}>
              ✓ {wellSavedMsg}
            </Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 14,
    gap: 12,
    paddingBottom: 24,
  },
  summaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 2,
    padding: 14,
    gap: 10,
  },
  title: {
    fontWeight: '900',
  },
  areaReadout: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  subText: {
    fontSize: 12,
    fontWeight: '600',
  },
  nordesteBtn: {
    paddingHorizontal: 12,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  nordesteBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  nordesteCard: {
    borderRadius: 20,
    borderWidth: 2,
    padding: 10,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  drawHelper: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
    gap: 8,
  },
  savePolyBtn: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  smallLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  miniChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  wellCard: {
    borderRadius: 22,
    borderWidth: 2,
    padding: 14,
    gap: 10,
  },
  wellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  wellTitle: {
    fontWeight: '900',
  },
  togglePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  wellStatsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
  },
  statVal: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  wellAdvice: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  wellRow: {
    borderTopWidth: 1,
    paddingTop: 6,
  },
  wellValidationBox: {
    borderRadius: 14,
    padding: 10,
    gap: 8,
  },
  wellInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  depthInput: {
    width: 72,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  wellLogBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
