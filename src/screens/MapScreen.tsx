import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Pressable, Text } from '../i18n/native';
import { FarmMapCanvas } from '../components/FarmMapCanvas';
import { useAccessibility } from '../context/AccessibilityContext';
import { getAppTheme } from '../theme/tokens';
import { GeoPoint } from '../types/domain';
import { calculatePolygonMetrics, sortPolygonPoints } from '../utils/geoprocessing';
import { formatArea } from '../utils/regionalize';

export const MapScreen: React.FC = () => {
  const { accessibility, activeFarm, updateFarmPolygon, speak } = useAccessibility();

  const theme = getAppTheme(accessibility);
  const [drawingMode, setDrawingMode] = useState(false);
  const [draftPoints, setDraftPoints] = useState<GeoPoint[]>(activeFarm?.polygon ?? []);
  const [selectedLotId, setSelectedLotId] = useState<string | undefined>(undefined);

  if (!activeFarm) return null;

  const lots = activeFarm.lotes ?? [];
  const liveMetrics = calculatePolygonMetrics(draftPoints);
  const displayedAreaHa =
    drawingMode && draftPoints.length >= 3
      ? liveMetrics.areaHectares
      : activeFarm.areaHectares;
  const displayedAreaTarefas =
    drawingMode && draftPoints.length >= 3
      ? liveMetrics.areaTarefasBa
      : activeFarm.areaTarefasBa;

  const handleAddTouchPoint = (pt: GeoPoint) => {
    const next = [...draftPoints, pt];
    setDraftPoints(next);
    if (next.length >= 3) {
      const m = calculatePolygonMetrics(next);
      speak(`Ponto marcado. Área atual: ${m.areaHectares.toFixed(1)} hectares.`);
    }
  };

  const handleToggleDemarcar = () => {
    if (!drawingMode) {
      setDraftPoints([]);
      setDrawingMode(true);
      speak('Modo Demarcar Terreno ativado. Toque nos cantos da sua roça no mapa.');
    } else {
      setDrawingMode(false);
      setDraftPoints(activeFarm.polygon);
    }
  };

  const handleSavePolygon = async () => {
    if (draftPoints.length < 3) return;
    const orderedPoints = sortPolygonPoints(draftPoints);
    setDraftPoints(orderedPoints);
    await updateFarmPolygon(orderedPoints);
    setDrawingMode(false);
    speak(
      `Terreno demarcado com ${liveMetrics.areaHectares.toFixed(1)} hectares (${liveMetrics.areaTarefasBa.toFixed(1)} tarefas).`
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={styles.container}
    >
      <View
        style={[
          styles.regionStrip,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Ionicons name="location-outline" size={16} color={theme.primary} />
        <Text
          style={[styles.regionText, { color: theme.text, fontSize: 13 * theme.scale }]}
          numberOfLines={1}
        >
          Região: {activeFarm.regiaoNome} ({activeFarm.municipio} - {activeFarm.estado}) •{' '}
          {formatArea(displayedAreaHa, displayedAreaTarefas)}
        </Text>
      </View>

      <FarmMapCanvas
        centroid={activeFarm.centroid}
        polygon={drawingMode ? draftPoints : activeFarm.polygon}
        lots={lots}
        activeLotId={selectedLotId}
        showWells={false}
        showNdvi={false}
        drawingMode={drawingMode}
        height={410}
        onAddPoint={handleAddTouchPoint}
        theme={theme}
      />

      {lots.length > 0 && !drawingMode && (
        <View style={styles.lotsLegendRow}>
          {lots.map((lot) => {
            const active = selectedLotId === lot.id;
            return (
              <Pressable
                key={lot.id}
                onPress={() => setSelectedLotId(active ? undefined : lot.id)}
                style={[
                  styles.lotPill,
                  {
                    backgroundColor: active ? lot.corHex : theme.surface,
                    borderColor: lot.corHex,
                  },
                ]}
              >
                <View
                  style={[
                    styles.lotDot,
                    { backgroundColor: active ? '#FFFFFF' : lot.corHex },
                  ]}
                />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '800',
                    color: active ? '#FFFFFF' : theme.text,
                  }}
                >
                  {lot.nome} ({lot.culturaAtual})
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Pressable
        onPress={handleToggleDemarcar}
        style={[
          styles.demarcarBtn,
          {
            backgroundColor: drawingMode ? theme.warningBg : theme.primary,
            borderColor: drawingMode ? theme.warningBorder : theme.primary,
          },
        ]}
      >
        <Ionicons
          name={drawingMode ? 'close-circle-outline' : 'create-outline'}
          size={20}
          color={drawingMode ? theme.warningText : theme.primaryText}
        />
        <Text
          style={[
            styles.demarcarBtnText,
            { color: drawingMode ? theme.warningText : theme.primaryText },
          ]}
        >
          {drawingMode ? 'Cancelar Demarcação' : 'Demarcar Terreno'}
        </Text>
      </Pressable>

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
              : 'Toque nos cantos do terreno no mapa.'}
          </Text>
          <View style={styles.drawActionsRow}>
            {draftPoints.length > 0 && (
              <Pressable
                onPress={() => setDraftPoints((prev) => prev.slice(0, -1))}
                style={[
                  styles.helperBtn,
                  { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 },
                ]}
              >
                <Text style={{ color: theme.text, fontWeight: '800', fontSize: 12 }}>
                  Desfazer ponto
                </Text>
              </Pressable>
            )}
            {draftPoints.length >= 3 && (
              <Pressable
                onPress={handleSavePolygon}
                style={[styles.helperBtn, { backgroundColor: theme.primary }]}
              >
                <Text style={{ color: theme.primaryText, fontWeight: '900', fontSize: 12 }}>
                  ✓ Salvar Terreno
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 14,
    gap: 10,
    paddingBottom: 24,
  },
  regionStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  regionText: {
    flex: 1,
    fontWeight: '800',
  },
  lotsLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  lotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  lotDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  demarcarBtn: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  demarcarBtnText: {
    fontSize: 15,
    fontWeight: '900',
  },
  drawHelper: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    gap: 8,
  },
  drawActionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  helperBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
});
