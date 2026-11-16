import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { FarmMapCanvas } from '../components/FarmMapCanvas';
import { useAccessibility } from '../context/AccessibilityContext';
import { useLanguage } from '../i18n/Language';
import { Pressable, Text, TextInput } from '../i18n/native';
import { translate } from '../i18n/translate';
import { useResponsiveLayout } from '../theme/responsive';
import { getAppTheme } from '../theme/tokens';
import { GeoPoint, PlantingLot } from '../types/domain';
import { LOT_PALETTE, PLANT_CATALOG_CHIPS } from '../utils/agronomyHelpers';
import {
  calculatePolygonMetrics,
  createMicroPlotAroundPoint,
  isPointInPolygon,
  sortPolygonPoints,
} from '../utils/geoprocessing';
import { formatArea } from '../utils/regionalize';

type BoundaryEditTarget = 'farm' | 'plot';

export const MapScreen: React.FC = () => {
  const {
    accessibility,
    activeFarm,
    updateFarmPolygon,
    updateFarmLots,
    updateLotDetails,
    speak,
  } = useAccessibility();
  const { language } = useLanguage();
  const en = language === 'en';
  const { width, height } = useResponsiveLayout();
  const isWide = width >= 900;
  const mapHeight = isWide ? Math.round(Math.max(360, Math.min(520, height - 295))) : 360;

  const theme = getAppTheme(accessibility);
  const lots = activeFarm?.lotes ?? [];

  const [editTarget, setEditTarget] = useState<BoundaryEditTarget>('farm');
  const [drawingMode, setDrawingMode] = useState(false);
  const [draftPoints, setDraftPoints] = useState<GeoPoint[]>(activeFarm?.polygon ?? []);

  const [selectedLotId, setSelectedLotId] = useState<string | undefined>(lots[0]?.id);
  const activeLot = lots.find((l) => l.id === selectedLotId) ?? lots[0];

  const [drawingLot, setDrawingLot] = useState(false);
  const [draftLotPoints, setDraftLotPoints] = useState<GeoPoint[]>(activeLot?.polygon ?? []);
  const [outsideWarning, setOutsideWarning] = useState<string | null>(null);

  const [lotNameDraft, setLotNameDraft] = useState(activeLot?.nome ?? '');
  const [sistemaDraft, setSistemaDraft] = useState<'rotacao' | 'monocultura'>(
    activeLot?.sistema ?? 'rotacao'
  );
  const [plantsDraft, setPlantsDraft] = useState<string[]>(activeLot?.plantasRotacao ?? []);
  const [customPlantInput, setCustomPlantInput] = useState('');
  const [daysPlantedDraft, setDaysPlantedDraft] = useState(
    String(activeLot?.tempoPlantadaDias ?? 30)
  );
  const [hasHarvestDateDraft, setHasHarvestDateDraft] = useState(
    activeLot?.temDataColheita ?? true
  );
  const [harvestWindowDraft, setHarvestWindowDraft] = useState(
    activeLot?.dataColheitaPrevista ?? (en ? 'In 45 days' : 'Em 45 dias')
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadLotIntoDraft = (lot: PlantingLot | undefined) => {
    if (!lot) return;
    setDraftLotPoints(lot.polygon);
    setLotNameDraft(lot.nome);
    setSistemaDraft(lot.sistema);
    setPlantsDraft(
      lot.plantasRotacao.length > 0
        ? lot.plantasRotacao
        : lot.culturaAtual
        ? lot.culturaAtual.split('+').map((s) => s.trim()).filter(Boolean)
        : ['Milho']
    );
    setDaysPlantedDraft(String(lot.tempoPlantadaDias ?? 0));
    setHasHarvestDateDraft(lot.temDataColheita);
    setHarvestWindowDraft(lot.dataColheitaPrevista ?? '');
  };

  if (!activeFarm) return null;

  const liveFarmMetrics = calculatePolygonMetrics(draftPoints);
  const liveLotMetrics = calculatePolygonMetrics(draftLotPoints);

  const displayedAreaHa =
    drawingMode && draftPoints.length >= 3
      ? liveFarmMetrics.areaHectares
      : activeFarm.areaHectares;
  const displayedAreaTarefas =
    drawingMode && draftPoints.length >= 3
      ? liveFarmMetrics.areaTarefasBa
      : activeFarm.areaTarefasBa;

  const handleSelectLotTarget = (lotId: string) => {
    const found = lots.find((l) => l.id === lotId);
    setSelectedLotId(lotId);
    setEditTarget('plot');
    setDrawingMode(false);
    setDrawingLot(false);
    setOutsideWarning(null);
    setStatusMessage(null);
    loadLotIntoDraft(found);
  };

  const handleAddTouchPoint = (pt: GeoPoint) => {
    if (drawingMode && editTarget === 'farm') {
      const next = [...draftPoints, pt];
      setDraftPoints(next);
      if (next.length >= 3) {
        const m = calculatePolygonMetrics(next);
        speak(
          en
            ? `Point marked. Current farm area: ${m.areaHectares.toFixed(1)} hectares.`
            : `Ponto marcado. Área atual: ${m.areaHectares.toFixed(1)} hectares.`
        );
      }
      return;
    }

    if (drawingLot && editTarget === 'plot' && activeLot) {
      if (activeFarm.polygon.length >= 3 && !isPointInPolygon(pt, activeFarm.polygon)) {
        const msg = en
          ? 'Point is outside the green farm boundary. Tap inside the farm boundary to mark this plot.'
          : 'Ponto fora do seu terreno. Toque dentro da área verde da fazenda para demarcar este lote.';
        setOutsideWarning(msg);
        speak(msg);
        return;
      }
      setOutsideWarning(null);
      const nextPoly = [...draftLotPoints, pt];
      const ordered = nextPoly.length >= 3 ? sortPolygonPoints(nextPoly) : nextPoly;
      setDraftLotPoints(ordered);
      if (ordered.length >= 3) {
        const m = calculatePolygonMetrics(ordered);
        speak(
          en
            ? `Plot corner added. Current plot area: ${m.areaHectares.toFixed(2)} hectares.`
            : `Ponto do lote marcado. Área atual: ${m.areaHectares.toFixed(2)} hectares.`
        );
      }
    }
  };

  const handleToggleDemarcarFarm = () => {
    setEditTarget('farm');
    setDrawingLot(false);
    setOutsideWarning(null);
    setStatusMessage(null);
    if (!drawingMode) {
      setDraftPoints([]);
      setDrawingMode(true);
      speak(
        en
          ? 'Mark Farm Boundary mode enabled. Tap the corners of your farm on the map.'
          : 'Modo Demarcar Terreno ativado. Toque nos cantos da sua roça no mapa.'
      );
    } else {
      setDrawingMode(false);
      setDraftPoints(activeFarm.polygon);
    }
  };

  const handleSaveFarmPolygon = async () => {
    if (draftPoints.length < 3) return;
    const orderedPoints = sortPolygonPoints(draftPoints);
    setDraftPoints(orderedPoints);
    await updateFarmPolygon(orderedPoints);
    setDrawingMode(false);
    const msg = en
      ? `Farm boundary saved (${liveFarmMetrics.areaHectares.toFixed(1)} ha).`
      : `Terreno demarcado (${liveFarmMetrics.areaHectares.toFixed(1)} ha).`;
    setStatusMessage(msg);
    speak(msg);
  };

  const handleToggleDrawLot = () => {
    if (!activeLot) return;
    setEditTarget('plot');
    setDrawingMode(false);
    setOutsideWarning(null);
    setStatusMessage(null);
    if (!drawingLot) {
      setDrawingLot(true);
      speak(
        en
          ? `Plot boundary editing enabled for ${translate(activeLot.nome, language)}. Tap corners inside the green farm area or clear and redraw.`
          : `Edição dos limites ativada para ${activeLot.nome}. Toque no mapa dentro da área verde da fazenda.`
      );
    } else {
      setDrawingLot(false);
      setDraftLotPoints(activeLot.polygon);
    }
  };

  const handleSaveLotPolygon = async () => {
    if (!activeLot || draftLotPoints.length < 3) return;
    const ordered = sortPolygonPoints(draftLotPoints);
    const m = calculatePolygonMetrics(ordered);
    setDraftLotPoints(ordered);
    await updateLotDetails(activeLot.id, {
      polygon: ordered,
      areaHectares: m.areaHectares,
      areaTarefasBa: m.areaTarefasBa,
      retornoFinanceiroEstR$: Math.round(m.areaHectares * 2850),
    });
    setDrawingLot(false);
    setOutsideWarning(null);
    const msg = en
      ? `Plot boundary saved (${m.areaHectares.toFixed(2)} ha).`
      : `Limites do lote salvos (${m.areaHectares.toFixed(2)} ha).`;
    setStatusMessage(msg);
    speak(msg);
  };

  const handleTogglePlant = (plant: string) => {
    setStatusMessage(null);
    setPlantsDraft((prev) => {
      if (sistemaDraft === 'monocultura') {
        return [plant];
      }
      const exists = prev.includes(plant);
      const next = exists ? prev.filter((p) => p !== plant) : [...prev, plant];
      return next.length > 0 ? next : [plant];
    });
  };

  const handleAddCustomPlant = () => {
    const trimmed = customPlantInput.trim();
    if (!trimmed) return;
    setStatusMessage(null);
    setPlantsDraft((prev) =>
      sistemaDraft === 'monocultura'
        ? [trimmed]
        : prev.includes(trimmed)
        ? prev
        : [...prev, trimmed]
    );
    setCustomPlantInput('');
  };

  const handleSaveLotDetails = async () => {
    if (!activeLot) return;
    const cleanPlants = plantsDraft.length > 0 ? plantsDraft : ['Milho'];
    const resolvedCropName =
      sistemaDraft === 'monocultura' ? cleanPlants[0] : cleanPlants.join(' + ');
    const nextDays = Math.max(0, Number(daysPlantedDraft.replace(/\D/g, '')) || 0);
    await updateLotDetails(activeLot.id, {
      nome: lotNameDraft.trim() || activeLot.nome,
      sistema: sistemaDraft,
      plantasRotacao: cleanPlants,
      culturaAtual: resolvedCropName,
      tempoPlantadaDias: nextDays,
      temDataColheita: hasHarvestDateDraft,
      dataColheitaPrevista: hasHarvestDateDraft
        ? harvestWindowDraft.trim() || (en ? 'In 45 days' : 'Em 45 dias')
        : undefined,
    });
    const msg = en ? '✓ Plot details & current crop saved.' : '✓ Dados e plantio do lote salvos.';
    setStatusMessage(msg);
    speak(msg);
  };

  const handleAddNewPlot = async () => {
    const nextIdx = lots.length;
    const starterPoly = createMicroPlotAroundPoint(
      activeFarm.centroid,
      Math.max(0.4, Math.min(2.0, activeFarm.areaHectares * 0.2))
    );
    const m = calculatePolygonMetrics(starterPoly);
    const newLot: PlantingLot = {
      id: `lot-${Date.now()}`,
      nome: `Lote ${nextIdx + 1}`,
      corHex: LOT_PALETTE[nextIdx % LOT_PALETTE.length],
      polygon: starterPoly,
      areaHectares: m.areaHectares,
      areaTarefasBa: m.areaTarefasBa,
      sistema: 'rotacao',
      culturaAtual: 'Feijão-Caupi + Milho',
      plantasRotacao: ['Feijão-Caupi', 'Milho'],
      tempoPlantadaDias: 15,
      temDataColheita: true,
      dataColheitaPrevista: 'Em 60 dias',
      cronogramaPlantacao: 'Ciclo das águas → Cobertura seca',
      progressoRealPct: 25,
      progressoEsperadoPct: 30,
      retornoFinanceiroEstR$: Math.round(m.areaHectares * 2850),
      historicoTerra: [],
      culturasFuturas: ['Sorgo Forrageiro'],
      fotosValidacao: [],
    };
    await updateFarmLots([...lots, newLot]);
    setSelectedLotId(newLot.id);
    setEditTarget('plot');
    setDrawingMode(false);
    setDrawingLot(true);
    loadLotIntoDraft(newLot);
    setStatusMessage(
      en
        ? 'New plot added — adjust its boundary on the map or pick its crop below.'
        : 'Novo lote adicionado — ajuste os limites no mapa ou escolha a cultura.'
    );
  };

  const handleDeleteActivePlot = async () => {
    if (!activeLot || lots.length <= 1) return;
    const nextLots = lots.filter((l) => l.id !== activeLot.id);
    await updateFarmLots(nextLots);
    setSelectedLotId(nextLots[0]?.id);
    loadLotIntoDraft(nextLots[0]);
    setDrawingLot(false);
    setOutsideWarning(null);
    setStatusMessage(en ? 'Plot removed.' : 'Lote removido.');
  };

  // Overlay live draft lot polygon onto canvas so user sees edits immediately
  const mapLotsOverlay = lots.map((l) =>
    activeLot && l.id === activeLot.id && (drawingLot || editTarget === 'plot')
      ? { ...l, polygon: draftLotPoints }
      : l
  );

  const editorPanel = (
    <View style={isWide ? styles.sidePanelCol : { gap: 10 }}>
      {/* Seletor de Alvo: Fazenda vs Talhão/Lote */}
      <View style={[styles.targetTabsRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Pressable
          onPress={() => {
            setEditTarget('farm');
            setDrawingLot(false);
            setOutsideWarning(null);
            setStatusMessage(null);
          }}
          style={[
            styles.targetTabBtn,
            editTarget === 'farm' && { backgroundColor: theme.primary },
          ]}
        >
          <Ionicons
            name="resize-outline"
            size={15}
            color={editTarget === 'farm' ? theme.primaryText : theme.text}
          />
          <Text
            style={{
              fontSize: 12.5,
              fontWeight: '900',
              color: editTarget === 'farm' ? theme.primaryText : theme.text,
            }}
          >
            {en ? 'Farm Boundary' : 'Limite da Fazenda'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            const targetLot = activeLot ?? lots[0];
            if (targetLot) {
              setSelectedLotId(targetLot.id);
              loadLotIntoDraft(targetLot);
            }
            setEditTarget('plot');
            setDrawingMode(false);
            setStatusMessage(null);
          }}
          style={[
            styles.targetTabBtn,
            editTarget === 'plot' && { backgroundColor: theme.primary },
          ]}
        >
          <Ionicons
            name="leaf-outline"
            size={15}
            color={editTarget === 'plot' ? theme.primaryText : theme.text}
          />
          <Text
            style={{
              fontSize: 12.5,
              fontWeight: '900',
              color: editTarget === 'plot' ? theme.primaryText : theme.text,
            }}
          >
            {en ? `Edit Plots (${lots.length})` : `Editar Lotes (${lots.length})`}
          </Text>
        </Pressable>
      </View>

      {statusMessage && (
        <View style={[styles.statusBanner, { backgroundColor: theme.successBg, borderColor: theme.successBorder }]}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: theme.successText }}>
            {statusMessage}
          </Text>
        </View>
      )}

      {editTarget === 'farm' ? (
        <View style={[styles.editorCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={{ fontSize: 14, fontWeight: '900', color: theme.text }}>
            {en ? 'Farm Outer Boundary' : 'Contorno Externo da Propriedade'}
          </Text>
          <Text style={{ fontSize: 12, color: theme.textMuted, lineHeight: 17 }}>
            {en
              ? 'Redraw the outer perimeter of your property by tapping corners on the satellite map, then save.'
              : 'Redesenhe o contorno externo da sua propriedade tocando nos cantos pelo satélite e salve.'}
          </Text>

          <Pressable
            onPress={handleToggleDemarcarFarm}
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
              size={18}
              color={drawingMode ? theme.warningText : theme.primaryText}
            />
            <Text
              style={[
                styles.demarcarBtnText,
                { color: drawingMode ? theme.warningText : theme.primaryText },
              ]}
            >
              {drawingMode
                ? en
                  ? 'Cancel Farm Drawing'
                  : 'Cancelar Demarcação'
                : en
                ? 'Map Farm Boundary'
                : 'Demarcar Terreno'}
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
                {en
                  ? `Marked points: ${draftPoints.length} (min 3). `
                  : `Pontos marcados: ${draftPoints.length} (mínimo 3). `}
                {draftPoints.length >= 3
                  ? en
                    ? `Calculated area: ${formatArea(liveFarmMetrics.areaHectares, liveFarmMetrics.areaTarefasBa)}`
                    : `Área calculada: ${formatArea(liveFarmMetrics.areaHectares, liveFarmMetrics.areaTarefasBa)}`
                  : en
                  ? 'Tap boundary corners on the map.'
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
                      {en ? 'Undo point' : 'Desfazer ponto'}
                    </Text>
                  </Pressable>
                )}
                {draftPoints.length >= 3 && (
                  <Pressable
                    onPress={handleSaveFarmPolygon}
                    style={[styles.helperBtn, { backgroundColor: theme.primary }]}
                  >
                    <Text style={{ color: theme.primaryText, fontWeight: '900', fontSize: 12 }}>
                      {en ? '✓ Save Farm' : '✓ Salvar Terreno'}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.editorCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.editorHeaderRow}>
            <Text style={{ fontSize: 14, fontWeight: '900', color: theme.text }}>
              {en ? 'Selected Plot & Crops' : 'Lote Selecionado e Cultivo'}
            </Text>
            <Pressable
              onPress={handleAddNewPlot}
              style={[styles.addPlotChip, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
            >
              <Ionicons name="add-circle-outline" size={14} color={theme.primary} />
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: theme.primary }}>
                {en ? 'Add Plot' : 'Novo Lote'}
              </Text>
            </Pressable>
          </View>

          {activeLot ? (
            <>
              {/* Limites e localização do lote */}
              <View style={[styles.subSectionBox, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <View style={styles.editorHeaderRow}>
                  <Text style={{ fontSize: 12, fontWeight: '900', color: theme.text }}>
                    {en ? 'Plot Location & Boundaries' : 'Localização e Limites do Lote'}
                  </Text>
                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: activeLot.corHex }}>
                    {draftLotPoints.length >= 3
                      ? formatArea(liveLotMetrics.areaHectares, liveLotMetrics.areaTarefasBa)
                      : en
                      ? `${draftLotPoints.length}/3 pts`
                      : `${draftLotPoints.length}/3 pts`}
                  </Text>
                </View>

                <Pressable
                  onPress={handleToggleDrawLot}
                  style={[
                    styles.secondaryActionBtn,
                    {
                      backgroundColor: drawingLot ? theme.warningBg : theme.primary,
                      borderColor: drawingLot ? theme.warningBorder : theme.primary,
                    },
                  ]}
                >
                  <Ionicons
                    name={drawingLot ? 'close-circle-outline' : 'locate-outline'}
                    size={16}
                    color={drawingLot ? theme.warningText : theme.primaryText}
                  />
                  <Text
                    style={{
                      fontSize: 12.5,
                      fontWeight: '900',
                      color: drawingLot ? theme.warningText : theme.primaryText,
                    }}
                  >
                    {drawingLot
                      ? en
                        ? 'Stop Map Editing'
                        : 'Parar Edição no Mapa'
                      : en
                      ? 'Edit Plot Boundary on Map'
                      : 'Editar Limites no Mapa'}
                  </Text>
                </Pressable>

                {outsideWarning && (
                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: theme.dangerText }}>
                    {outsideWarning}
                  </Text>
                )}

                {drawingLot && (
                  <View style={{ gap: 7 }}>
                    <Text style={{ fontSize: 11, color: theme.textMuted }}>
                      {en
                        ? 'Tap inside the green farm perimeter on the map to place corners, or clear to redraw from scratch.'
                        : 'Toque dentro da área verde da fazenda no mapa para marcar pontos, ou limpe para redesenhar.'}
                    </Text>
                    <View style={styles.drawActionsRow}>
                      <Pressable
                        onPress={() => {
                          setDraftLotPoints([]);
                          setOutsideWarning(null);
                        }}
                        style={[
                          styles.helperBtn,
                          { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 },
                        ]}
                      >
                        <Text style={{ color: theme.text, fontWeight: '800', fontSize: 11.5 }}>
                          {en ? 'Clear & Redraw' : 'Limpar e Redesenhar'}
                        </Text>
                      </Pressable>
                      {draftLotPoints.length > 0 && (
                        <Pressable
                          onPress={() => setDraftLotPoints((prev) => prev.slice(0, -1))}
                          style={[
                            styles.helperBtn,
                            { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 },
                          ]}
                        >
                          <Text style={{ color: theme.text, fontWeight: '800', fontSize: 11.5 }}>
                            {en ? 'Undo Point' : 'Desfazer'}
                          </Text>
                        </Pressable>
                      )}
                      {draftLotPoints.length >= 3 && (
                        <Pressable
                          onPress={handleSaveLotPolygon}
                          style={[styles.helperBtn, { backgroundColor: activeLot.corHex }]}
                        >
                          <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 11.5 }}>
                            {en ? '✓ Save Boundary' : '✓ Salvar Limites'}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                )}
              </View>

              {/* Nome, sistema e plantação atual do lote */}
              <View style={{ gap: 6 }}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>
                  {en ? 'Plot name' : 'Nome do lote'}
                </Text>
                <TextInput
                  value={lotNameDraft}
                  onChangeText={(txt) => {
                    setLotNameDraft(txt);
                    setStatusMessage(null);
                  }}
                  placeholder={en ? 'Ex.: Plot 1 — Main' : 'Ex.: Lote 1 — Principal'}
                  placeholderTextColor={theme.textMuted}
                  style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
                />
              </View>

              <View style={{ gap: 6 }}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>
                  {en ? 'Cropping system' : 'Sistema de plantio'}
                </Text>
                <View style={styles.drawActionsRow}>
                  {(
                    [
                      { id: 'rotacao', label: en ? 'Rotation / Intercrop' : 'Rotação / Consórcio' },
                      { id: 'monocultura', label: en ? 'Monoculture (1 crop)' : 'Monocultura (1 planta)' },
                    ] as const
                  ).map((sys) => {
                    const activeSys = sistemaDraft === sys.id;
                    return (
                      <Pressable
                        key={sys.id}
                        onPress={() => {
                          setSistemaDraft(sys.id);
                          setStatusMessage(null);
                          if (sys.id === 'monocultura' && plantsDraft.length > 1) {
                            setPlantsDraft([plantsDraft[0]]);
                          }
                        }}
                        style={[
                          styles.sysPill,
                          {
                            backgroundColor: activeSys ? theme.primary : theme.surfaceMuted,
                            borderColor: activeSys ? theme.primary : theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '900',
                            color: activeSys ? theme.primaryText : theme.text,
                          }}
                        >
                          {sys.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={{ gap: 6 }}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>
                  {en ? 'Current crop(s) in this plot' : 'Cultura(s) atual(is) neste lote'}
                </Text>
                <View style={styles.chipWrap}>
                  {PLANT_CATALOG_CHIPS.slice(0, 12).map((plant) => {
                    const sel = plantsDraft.includes(plant);
                    return (
                      <Pressable
                        key={plant}
                        onPress={() => handleTogglePlant(plant)}
                        style={[
                          styles.plantChip,
                          {
                            backgroundColor: sel ? theme.primary : theme.surfaceMuted,
                            borderColor: sel ? theme.primary : theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '800',
                            color: sel ? theme.primaryText : theme.text,
                          }}
                        >
                          {translate(plant, language)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.customCropRow}>
                  <TextInput
                    value={customPlantInput}
                    onChangeText={setCustomPlantInput}
                    placeholder={en ? 'Other crop / cultivar...' : 'Outra cultura / variedade...'}
                    placeholderTextColor={theme.textMuted}
                    style={[
                      styles.input,
                      { flex: 1, backgroundColor: theme.bg, borderColor: theme.border, color: theme.text },
                    ]}
                  />
                  <Pressable
                    onPress={handleAddCustomPlant}
                    style={[styles.addCropBtn, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: '900', color: theme.primary }}>
                      {en ? '+ Add' : '+ Incluir'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.inlineRow}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>
                    {en ? 'Days planted' : 'Dias de plantio'}
                  </Text>
                  <TextInput
                    value={daysPlantedDraft}
                    onChangeText={(txt) => {
                      setDaysPlantedDraft(txt.replace(/\D/g, ''));
                      setStatusMessage(null);
                    }}
                    keyboardType="numeric"
                    placeholder="30"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
                  />
                </View>
                <View style={{ flex: 1.4, gap: 4 }}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>
                    {en ? 'Expected harvest window' : 'Previsão de colheita'}
                  </Text>
                  <TextInput
                    value={harvestWindowDraft}
                    onChangeText={(txt) => {
                      setHarvestWindowDraft(txt);
                      setHasHarvestDateDraft(true);
                      setStatusMessage(null);
                    }}
                    placeholder={en ? 'Ex.: In 45 days' : 'Ex.: Em 45 dias'}
                    placeholderTextColor={theme.textMuted}
                    style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
                  />
                </View>
              </View>

              <View style={styles.drawActionsRow}>
                <Pressable
                  onPress={handleSaveLotDetails}
                  style={[styles.savePrimaryBtn, { backgroundColor: theme.primary }]}
                >
                  <Ionicons name="checkmark-circle-outline" size={16} color={theme.primaryText} />
                  <Text style={{ fontSize: 13, fontWeight: '900', color: theme.primaryText }}>
                    {en ? 'Save Plot Changes' : 'Salvar Alterações do Lote'}
                  </Text>
                </Pressable>

                {lots.length > 1 && (
                  <Pressable
                    onPress={handleDeleteActivePlot}
                    style={[styles.deletePlotBtn, { backgroundColor: theme.dangerBg, borderColor: theme.dangerBorder }]}
                  >
                    <Ionicons name="trash-outline" size={15} color={theme.dangerText} />
                  </Pressable>
                )}
              </View>
            </>
          ) : (
            <Text style={{ fontSize: 12, color: theme.textMuted }}>
              {en ? 'Tap Add Plot above to create a field plot.' : 'Toque em Novo Lote acima para criar um talhão.'}
            </Text>
          )}
        </View>
      )}
    </View>
  );

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
          {en ? 'Region' : 'Região'}: {activeFarm.regiaoNome} ({activeFarm.municipio} - {activeFarm.estado}) •{' '}
          {formatArea(displayedAreaHa, displayedAreaTarefas)}
        </Text>
      </View>

      <View style={isWide ? styles.workspaceRowWide : styles.workspaceStack}>
        <View style={isWide ? styles.mapColWide : { gap: 10 }}>
          <FarmMapCanvas
            centroid={activeFarm.centroid}
            polygon={drawingMode ? draftPoints : activeFarm.polygon}
            lots={mapLotsOverlay}
            activeLotId={selectedLotId}
            showWells={false}
            showNdvi={false}
            drawingMode={drawingMode || drawingLot}
            height={mapHeight}
            onAddPoint={handleAddTouchPoint}
            onSelectLot={handleSelectLotTarget}
            theme={theme}
          />

          {lots.length > 0 && (
            <View style={styles.lotsLegendRow}>
              {lots.map((lot) => {
                const active = selectedLotId === lot.id;
                return (
                  <Pressable
                    key={lot.id}
                    onPress={() => handleSelectLotTarget(lot.id)}
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
                      {translate(lot.nome, language)} ({translate(lot.culturaAtual, language)})
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {editorPanel}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
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
  workspaceRowWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  workspaceStack: {
    gap: 10,
  },
  mapColWide: {
    flex: 1.25,
    minWidth: 0,
    gap: 10,
  },
  sidePanelCol: {
    flex: 1,
    minWidth: 320,
    gap: 10,
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
  targetTabsRow: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  targetTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 9,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  statusBanner: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editorCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 13,
    gap: 11,
  },
  editorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  addPlotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  subSectionBox: {
    borderRadius: 11,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  demarcarBtn: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  demarcarBtnText: {
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryActionBtn: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  drawHelper: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  drawActionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  helperBtn: {
    flex: 1,
    minWidth: 96,
    minHeight: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  input: {
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  sysPill: {
    flex: 1,
    minWidth: 120,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  plantChip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  customCropRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  addCropBtn: {
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 8,
  },
  savePrimaryBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  deletePlotBtn: {
    width: 44,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
