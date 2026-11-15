import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAccessibility } from '../../context/AccessibilityContext';
import { pickLang } from '../../i18n/locale';
import { FarmMapCanvas } from '../FarmMapCanvas';
import { AppTheme } from '../../theme/tokens';
import { GeoPoint, PlantingLot } from '../../types/domain';
import { getPlantCatalogChips, LOT_PALETTE } from '../../utils/agronomyHelpers';
import {
  calculatePolygonMetrics,
  createMicroPlotAroundPoint,
  isPointInPolygon,
  sortPolygonPoints,
} from '../../utils/geoprocessing';
import { formatArea } from '../../utils/regionalize';

interface FarmBoundaryStepProps {
  regiaoNome: string;
  municipio: string;
  estado: string;
  centroid: GeoPoint;
  farmPolygon: GeoPoint[];
  onChangeFarmPolygon: (poly: GeoPoint[]) => void;
  onSpeak: (text: string) => void;
  theme: AppTheme;
}

export const FarmBoundaryStep: React.FC<FarmBoundaryStepProps> = ({
  regiaoNome,
  municipio,
  estado,
  centroid,
  farmPolygon,
  onChangeFarmPolygon,
  onSpeak,
  theme,
}) => {
  const { language } = useAccessibility();
  const [drawingMode, setDrawingMode] = useState(true);
  const metrics = calculatePolygonMetrics(farmPolygon);

  const handleAddPoint = (pt: GeoPoint) => {
    const next = [...farmPolygon, pt];
    const sorted = next.length >= 3 ? sortPolygonPoints(next) : next;
    onChangeFarmPolygon(sorted);
    if (sorted.length >= 3) {
      const m = calculatePolygonMetrics(sorted);
      onSpeak(
        pickLang(
          language,
          `Marked area: ${m.areaHectares.toFixed(1)} hectares.`,
          `Área marcada: ${m.areaHectares.toFixed(1)} hectares.`
        )
      );
    }
  };

  const handleResetQuickPlot = (ha: number) => {
    const plot = createMicroPlotAroundPoint(centroid, ha);
    onChangeFarmPolygon(plot);
    onSpeak(
      pickLang(
        language,
        `Land boundary set to about ${ha} hectares. You can fine-tune by tapping on the map.`,
        `Terreno ajustado para cerca de ${ha} hectares. Você pode ajustar tocando no mapa.`
      )
    );
  };

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.infoCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.title, { color: theme.text, fontSize: 16 * theme.scale }]}>
          {pickLang(
            language,
            `Mark the farm boundary in ${regiaoNome}`,
            `Demarque o terreno da fazenda em ${regiaoNome}`
          )}
        </Text>
        <Text style={[styles.sub, { color: theme.textMuted }]}>
          {municipio} - {estado} •{' '}
          {pickLang(
            language,
            'Tap the corners of your land on the map below to calculate real area (hectares and tarefas).',
            'Toque nos cantos do seu terreno no mapa abaixo para calcular a área real (hectares e tarefas).'
          )}
        </Text>
      </View>

      <FarmMapCanvas
        key={`${regiaoNome}-${centroid.latitude.toFixed(3)}`}
        centroid={centroid}
        polygon={farmPolygon}
        showWells={false}
        showNdvi={false}
        drawingMode={drawingMode}
        height={320}
        onAddPoint={handleAddPoint}
        theme={theme}
      />

      <View
        style={[
          styles.metricsRow,
          { backgroundColor: theme.successBg, borderColor: theme.successBorder },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: theme.successText }}>
            {pickLang(
              language,
              `Marked points: ${farmPolygon.length} (minimum 3)`,
              `Pontos marcados: ${farmPolygon.length} (mínimo 3)`
            )}
          </Text>
          <Text style={{ fontSize: 15, fontWeight: '900', color: theme.successText }}>
            {farmPolygon.length >= 3
              ? `${pickLang(language, 'Area:', 'Área:')} ${formatArea(
                  metrics.areaHectares,
                  metrics.areaTarefasBa,
                  language
                )}`
              : pickLang(
                  language,
                  'Tap 3 or more corners of your land',
                  'Toque em 3 ou mais cantos do terreno'
                )}
          </Text>
        </View>
      </View>

      <View style={styles.btnRow}>
        <Pressable
          onPress={() => setDrawingMode((v) => !v)}
          style={[
            styles.btn,
            {
              backgroundColor: drawingMode ? theme.primary : theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <Ionicons
            name="create-outline"
            size={18}
            color={drawingMode ? theme.primaryText : theme.text}
          />
          <Text
            style={{
              fontSize: 12,
              fontWeight: '900',
              color: drawingMode ? theme.primaryText : theme.text,
            }}
          >
            {drawingMode
              ? pickLang(language, 'Tapping on map', 'Tocando no mapa')
              : pickLang(language, 'Mark Land Boundary', 'Demarcar Terreno')}
          </Text>
        </Pressable>

        {farmPolygon.length > 0 && (
          <Pressable
            onPress={() => onChangeFarmPolygon(farmPolygon.slice(0, -1))}
            style={[
              styles.btn,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Ionicons name="arrow-undo-outline" size={18} color={theme.text} />
            <Text style={{ fontSize: 12, fontWeight: '800', color: theme.text }}>
              {pickLang(language, 'Undo point', 'Desfazer ponto')}
            </Text>
          </Pressable>
        )}

        {farmPolygon.length > 0 && (
          <Pressable
            onPress={() => onChangeFarmPolygon([])}
            style={[
              styles.btn,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}
          >
            <Ionicons name="trash-outline" size={18} color={theme.text} />
            <Text style={{ fontSize: 12, fontWeight: '800', color: theme.text }}>
              {pickLang(language, 'Clear', 'Limpar')}
            </Text>
          </Pressable>
        )}
      </View>

      <View style={styles.presetRow}>
        <Text style={{ fontSize: 11, fontWeight: '800', color: theme.textMuted }}>
          {pickLang(
            language,
            'Or generate a quick template to adjust:',
            'Ou gerar base rápida para ajustar:'
          )}
        </Text>
        {[2.5, 4.0, 8.0].map((ha) => (
          <Pressable
            key={ha}
            onPress={() => handleResetQuickPlot(ha)}
            style={[
              styles.miniChip,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={{ fontSize: 11, fontWeight: '800', color: theme.text }}>
              ~{ha} ha
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

interface FarmLotsStepProps {
  farmPolygon: GeoPoint[];
  farmCentroid: GeoPoint;
  lotes: PlantingLot[];
  onChangeLotes: (next: PlantingLot[]) => void;
  onSpeak: (text: string) => void;
  theme: AppTheme;
}

export const FarmLotsStep: React.FC<FarmLotsStepProps> = ({
  farmPolygon,
  farmCentroid,
  lotes,
  onChangeLotes,
  onSpeak,
  theme,
}) => {
  const { language } = useAccessibility();
  const plantCatalog = getPlantCatalogChips(language);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [drawingLot, setDrawingLot] = useState(true);
  const [customCountInput, setCustomCountInput] = useState(
    lotes.length > 0 ? String(lotes.length) : ''
  );
  const [outsideWarning, setOutsideWarning] = useState<string | null>(null);

  const safeSelectedIdx = Math.min(selectedIdx, Math.max(0, lotes.length - 1));
  const activeLot = lotes[safeSelectedIdx];

  const createBlankLot = (index: number): PlantingLot => ({
    id: `lot-${index + 1}`,
    nome: pickLang(language, `Plot ${index + 1}`, `Lote ${index + 1}`),
    corHex: LOT_PALETTE[index % LOT_PALETTE.length],
    polygon: [],
    areaHectares: 0,
    areaTarefasBa: 0,
    sistema: 'rotacao',
    culturaAtual: pickLang(language, 'Cowpea + Cassava', 'Feijão-Caupi + Mandioca'),
    plantasRotacao: pickLang(
      language,
      ['Cowpea', 'Cassava'],
      ['Feijão-Caupi', 'Mandioca']
    ),
    tempoPlantadaDias: 30,
    temDataColheita: true,
    dataColheitaPrevista: pickLang(language, 'In 45 days', 'Em 45 dias'),
    cronogramaPlantacao: pickLang(
      language,
      'Rainy season (Cowpea) → Dry cover (Spineless Cactus/Sorghum)',
      'Ciclo das águas (Feijão-Caupi) → Cobertura seca (Palma/Sorgo)'
    ),
    progressoRealPct: 45,
    progressoEsperadoPct: 50,
    retornoFinanceiroEstR$: 0,
    historicoTerra: [],
    culturasFuturas: [pickLang(language, 'Pearl Millet (cover crop)', 'Milheto (cobertura)')],
    fotosValidacao: [],
  });

  const handleSetLotCount = (rawCount: number) => {
    const count = Math.max(0, Math.floor(rawCount));
    if (count === 0) {
      onChangeLotes([]);
      setCustomCountInput('0');
      setSelectedIdx(0);
      setOutsideWarning(null);
      return;
    }

    const next: PlantingLot[] = [];
    for (let i = 0; i < count; i++) {
      if (lotes[i]) {
        next.push(lotes[i]);
      } else {
        next.push(createBlankLot(i));
      }
    }
    onChangeLotes(next);
    setCustomCountInput(String(count));
    setOutsideWarning(null);
    const nextIdx = selectedIdx >= count ? count - 1 : selectedIdx;
    setSelectedIdx(nextIdx);
    setDrawingLot((next[nextIdx]?.polygon.length ?? 0) < 3);
    onSpeak(
      pickLang(
        language,
        `${count} ${count === 1 ? 'plot selected' : 'plots selected'}. Tap inside the green farm area on the map to outline ${next[nextIdx]?.nome ?? 'the plot'}.`,
        `${count} ${count === 1 ? 'lote selecionado' : 'lotes selecionados'}. Toque dentro da área verde da fazenda no mapa para demarcar ${next[nextIdx]?.nome ?? 'o lote'}.`
      )
    );
  };

  const handleAddSingleLot = () => {
    const nextIndex = lotes.length;
    const created = createBlankLot(nextIndex);
    const next = [...lotes, created];
    onChangeLotes(next);
    setCustomCountInput(String(next.length));
    setSelectedIdx(nextIndex);
    setDrawingLot(true);
    setOutsideWarning(null);
    onSpeak(
      pickLang(
        language,
        `${created.nome} added. Tap inside your land on the map to outline it.`,
        `${created.nome} adicionado. Toque dentro do terreno no mapa para demarcá-lo.`
      )
    );
  };

  const handleRemoveLot = (idxToRemove: number) => {
    const filtered = lotes
      .filter((_, idx) => idx !== idxToRemove)
      .map((lot, idx) => ({
        ...lot,
        id: `lot-${idx + 1}`,
        nome: /^(Lote|Plot) \d+$/.test(lot.nome)
          ? pickLang(language, `Plot ${idx + 1}`, `Lote ${idx + 1}`)
          : lot.nome,
        corHex: LOT_PALETTE[idx % LOT_PALETTE.length],
      }));
    onChangeLotes(filtered);
    setCustomCountInput(filtered.length > 0 ? String(filtered.length) : '');
    const nextIdx = Math.max(0, Math.min(safeSelectedIdx, filtered.length - 1));
    setSelectedIdx(nextIdx);
    setDrawingLot((filtered[nextIdx]?.polygon.length ?? 0) < 3);
    setOutsideWarning(null);
  };

  const patchActiveLot = (patch: Partial<PlantingLot>) => {
    if (!activeLot) return;
    const updated = lotes.map((lot, idx) =>
      idx === safeSelectedIdx ? { ...lot, ...patch } : lot
    );
    onChangeLotes(updated);
  };

  const handleTogglePlant = (plant: string) => {
    if (!activeLot) return;
    const exists = activeLot.plantasRotacao.includes(plant);
    const nextPlants = exists
      ? activeLot.plantasRotacao.filter((p) => p !== plant)
      : [...activeLot.plantasRotacao, plant];
    const safePlants = nextPlants.length > 0 ? nextPlants : [plant];
    patchActiveLot({
      plantasRotacao: safePlants,
      culturaAtual:
        activeLot.sistema === 'monocultura'
          ? safePlants[0]
          : safePlants.join(' + '),
    });
  };

  const handleAddLotPoint = (pt: GeoPoint) => {
    if (!activeLot || !drawingLot) return;
    if (farmPolygon.length >= 3 && !isPointInPolygon(pt, farmPolygon)) {
      setOutsideWarning(
        pickLang(
          language,
          'Point is outside your farm boundary. Tap inside the green farm area to outline this plot.',
          'Ponto fora do seu terreno. Toque dentro da área verde da fazenda para demarcar este lote.'
        )
      );
      onSpeak(
        pickLang(
          language,
          'Tap inside the green farm area to outline this plot.',
          'Toque dentro da área verde da sua fazenda para demarcar este lote.'
        )
      );
      return;
    }
    setOutsideWarning(null);
    const nextPoly = [...activeLot.polygon, pt];
    const ordered = nextPoly.length >= 3 ? sortPolygonPoints(nextPoly) : nextPoly;
    const m = calculatePolygonMetrics(ordered);
    patchActiveLot({
      polygon: ordered,
      areaHectares: ordered.length >= 3 ? m.areaHectares : 0,
      areaTarefasBa: ordered.length >= 3 ? m.areaTarefasBa : 0,
      retornoFinanceiroEstR$: ordered.length >= 3 ? Math.round(m.areaHectares * 2850) : 0,
    });
    if (ordered.length === 3) {
      onSpeak(
        pickLang(
          language,
          `${activeLot.nome} outlined with ${m.areaHectares.toFixed(2)} hectares.`,
          `${activeLot.nome} demarcado com ${m.areaHectares.toFixed(2)} hectares.`
        )
      );
    }
  };

  const pendingLotsCount = lotes.filter((l) => l.polygon.length < 3).length;

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.infoCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.title, { color: theme.text, fontSize: 16 * theme.scale }]}>
          {pickLang(
            language,
            'How many planting plots are on your farm?',
            'Quantos lotes de plantio tem na fazenda?'
          )}
        </Text>
        <Text style={[styles.sub, { color: theme.textMuted }]}>
          {pickLang(
            language,
            'Choose the exact number of plots (no limit) and outline each area directly inside your farm boundary on the map.',
            'Escolha a quantidade exata de lotes (sem limite) e demarque cada área diretamente dentro do seu terreno no mapa.'
          )}
        </Text>

        <View style={styles.countRow}>
          {[1, 2, 3, 4].map((n) => (
            <Pressable
              key={n}
              onPress={() => handleSetLotCount(n)}
              style={[
                styles.countPill,
                {
                  backgroundColor: lotes.length === n ? theme.primary : theme.surfaceMuted,
                  borderColor: lotes.length === n ? theme.primary : theme.border,
                },
              ]}
            >
              <Text
                style={{
                  fontWeight: '900',
                  color: lotes.length === n ? theme.primaryText : theme.text,
                }}
              >
                {n}{' '}
                {pickLang(
                  language,
                  n === 1 ? 'plot' : 'plots',
                  n === 1 ? 'lote' : 'lotes'
                )}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.customCountRow}>
          <Pressable
            onPress={() => handleSetLotCount(Math.max(0, lotes.length - 1))}
            accessibilityLabel={pickLang(
              language,
              'Decrease number of plots',
              'Diminuir quantidade de lotes'
            )}
            style={[
              styles.stepQtyBtn,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}
          >
            <Ionicons name="remove" size={18} color={theme.text} />
          </Pressable>

          <TextInput
            value={customCountInput}
            onChangeText={(txt) => {
              const digits = txt.replace(/\D/g, '');
              setCustomCountInput(digits);
              if (digits.length > 0) {
                const parsed = Number(digits);
                if (parsed > 0 && parsed <= 50) {
                  handleSetLotCount(parsed);
                }
              }
            }}
            keyboardType="numeric"
            placeholder={pickLang(language, 'Other #', 'Outro nº')}
            placeholderTextColor={theme.textMuted}
            style={[
              styles.qtyInput,
              { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text },
            ]}
          />

          <Pressable
            onPress={() => handleSetLotCount(lotes.length + 1)}
            accessibilityLabel={pickLang(
              language,
              'Increase number of plots',
              'Aumentar quantidade de lotes'
            )}
            style={[
              styles.stepQtyBtn,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}
          >
            <Ionicons name="add" size={18} color={theme.text} />
          </Pressable>

          <Pressable
            onPress={handleAddSingleLot}
            style={[styles.addLotBtn, { backgroundColor: theme.primary }]}
          >
            <Ionicons name="add-circle-outline" size={16} color={theme.primaryText} />
            <Text style={{ fontSize: 12, fontWeight: '900', color: theme.primaryText }}>
              {pickLang(language, 'Add plot', 'Adicionar lote')}
            </Text>
          </Pressable>
        </View>
      </View>

      {lotes.length === 0 ? (
        <View
          style={[
            styles.lotEditorCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.title, { color: theme.text, fontSize: 15 * theme.scale }]}>
            {pickLang(language, 'No plots outlined yet', 'Nenhum lote demarcado ainda')}
          </Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>
            {pickLang(
              language,
              'Select above how many plots you cultivate on the farm (or tap “Add plot”) to draw each area inside your green farm boundary.',
              'Selecione acima quantos lotes você cultiva na fazenda (ou toque em “Adicionar lote”) para desenhar cada área dentro do limite verde do seu terreno.'
            )}
          </Text>
          <FarmMapCanvas
            centroid={farmCentroid}
            polygon={farmPolygon}
            lots={[]}
            showWells={false}
            showNdvi={false}
            drawingMode={false}
            height={220}
            onAddPoint={() => {}}
            theme={theme}
          />
        </View>
      ) : (
        <>
          {/* Abas dos lotes */}
          <View style={styles.lotTabRow}>
            {lotes.map((lot, idx) => {
              const isSel = idx === safeSelectedIdx;
              const isDemarcated = lot.polygon.length >= 3;
              return (
                <Pressable
                  key={lot.id}
                  onPress={() => {
                    setSelectedIdx(idx);
                    setDrawingLot(lot.polygon.length < 3);
                    setOutsideWarning(null);
                  }}
                  style={[
                    styles.lotTab,
                    {
                      backgroundColor: isSel ? lot.corHex : theme.surface,
                      borderColor: lot.corHex,
                    },
                  ]}
                >
                  <View style={styles.lotTabInner}>
                    <Ionicons
                      name={isDemarcated ? 'checkmark-circle' : 'ellipse-outline'}
                      size={14}
                      color={isSel ? '#FFFFFF' : isDemarcated ? '#16A34A' : lot.corHex}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '900',
                        color: isSel ? '#FFFFFF' : theme.text,
                      }}
                    >
                      {lot.nome}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {pendingLotsCount > 0 && (
            <View
              style={[
                styles.pendingNotice,
                { backgroundColor: theme.warningBg, borderColor: theme.warningBorder },
              ]}
            >
              <Ionicons name="alert-circle-outline" size={16} color={theme.warningText} />
              <Text style={{ flex: 1, fontSize: 12, fontWeight: '800', color: theme.warningText }}>
                {pickLang(
                  language,
                  `${pendingLotsCount} ${pendingLotsCount === 1 ? 'plot' : 'plots'} still need mapping (at least 3 corners inside your farm boundary).`,
                  `Falta demarcar ${pendingLotsCount} ${
                    pendingLotsCount === 1 ? 'lote' : 'lotes'
                  } no mapa (mínimo 3 cantos dentro do seu terreno).`
                )}
              </Text>
            </View>
          )}
        </>
      )}

      {activeLot && (
        <View
          style={[
            styles.lotEditorCard,
            { backgroundColor: theme.surface, borderColor: activeLot.corHex },
          ]}
        >
          <View style={styles.lotHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.text, fontSize: 15 * theme.scale }]}>
                {pickLang(
                  language,
                  `Outline area for: ${activeLot.nome}`,
                  `Demarcar área de: ${activeLot.nome}`
                )}
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textMuted }}>
                {pickLang(
                  language,
                  `Tap inside your farm's green area (${activeLot.polygon.length} points)`,
                  `Toque dentro da área verde da sua fazenda (${activeLot.polygon.length} pontos)`
                )}
              </Text>
            </View>

            <Pressable
              onPress={() => {
                setOutsideWarning(null);
                setDrawingLot((prev) => !prev);
              }}
              style={[
                styles.demarcarSmallBtn,
                { backgroundColor: drawingLot ? theme.warningBg : activeLot.corHex },
              ]}
            >
              <Ionicons
                name={drawingLot ? 'checkmark' : 'create-outline'}
                size={15}
                color={drawingLot ? theme.warningText : '#FFFFFF'}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '900',
                  color: drawingLot ? theme.warningText : '#FFFFFF',
                }}
              >
                {drawingLot
                  ? pickLang(language, 'Done marking', 'Concluir pontos')
                  : pickLang(language, 'Mark Plot on Map', 'Demarcar Lote no Mapa')}
              </Text>
            </Pressable>
          </View>

          <FarmMapCanvas
            centroid={farmCentroid}
            polygon={farmPolygon}
            lots={lotes}
            activeLotId={activeLot.id}
            showWells={false}
            showNdvi={false}
            drawingMode={drawingLot}
            height={240}
            onAddPoint={handleAddLotPoint}
            theme={theme}
          />

          {outsideWarning && (
            <View
              style={[
                styles.pendingNotice,
                { backgroundColor: theme.dangerBg, borderColor: theme.dangerBorder },
              ]}
            >
              <Ionicons name="warning-outline" size={16} color={theme.dangerText} />
              <Text style={{ flex: 1, fontSize: 12, fontWeight: '800', color: theme.dangerText }}>
                {outsideWarning}
              </Text>
            </View>
          )}

          <View
            style={[
              styles.metricsRow,
              {
                backgroundColor:
                  activeLot.polygon.length >= 3 ? theme.successBg : theme.surfaceMuted,
                borderColor:
                  activeLot.polygon.length >= 3 ? theme.successBorder : theme.border,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color:
                    activeLot.polygon.length >= 3 ? theme.successText : theme.textMuted,
                }}
              >
                {pickLang(
                  language,
                  `Points marked in ${activeLot.nome}: ${activeLot.polygon.length} (min. 3)`,
                  `Pontos marcados no ${activeLot.nome}: ${activeLot.polygon.length} (mínimo 3)`
                )}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '900',
                  color: activeLot.polygon.length >= 3 ? theme.successText : theme.text,
                }}
              >
                {activeLot.polygon.length >= 3
                  ? `${pickLang(language, 'Plot area:', 'Área do lote:')} ${formatArea(
                      activeLot.areaHectares,
                      activeLot.areaTarefasBa,
                      language
                    )}`
                  : pickLang(
                      language,
                      'Tap corners inside the green farm area',
                      'Toque nos cantos dentro da área verde da fazenda'
                    )}
              </Text>
            </View>
          </View>

          <View style={styles.btnRow}>
            {activeLot.polygon.length > 0 && (
              <Pressable
                onPress={() => {
                  const nextPoly = activeLot.polygon.slice(0, -1);
                  const m = calculatePolygonMetrics(nextPoly);
                  patchActiveLot({
                    polygon: nextPoly,
                    areaHectares: nextPoly.length >= 3 ? m.areaHectares : 0,
                    areaTarefasBa: nextPoly.length >= 3 ? m.areaTarefasBa : 0,
                  });
                  setOutsideWarning(null);
                }}
                style={[
                  styles.btn,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Ionicons name="arrow-undo-outline" size={16} color={theme.text} />
                <Text style={{ fontSize: 12, fontWeight: '800', color: theme.text }}>
                  {pickLang(language, 'Undo point', 'Desfazer ponto')}
                </Text>
              </Pressable>
            )}

            {activeLot.polygon.length > 0 && (
              <Pressable
                onPress={() => {
                  patchActiveLot({
                    polygon: [],
                    areaHectares: 0,
                    areaTarefasBa: 0,
                    retornoFinanceiroEstR$: 0,
                  });
                  setDrawingLot(true);
                  setOutsideWarning(null);
                }}
                style={[
                  styles.btn,
                  { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                ]}
              >
                <Ionicons name="trash-outline" size={16} color={theme.text} />
                <Text style={{ fontSize: 12, fontWeight: '800', color: theme.text }}>
                  {pickLang(language, 'Clear plot', 'Limpar lote')}
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => handleRemoveLot(safeSelectedIdx)}
              style={[
                styles.btn,
                { backgroundColor: theme.dangerBg, borderColor: theme.dangerBorder },
              ]}
            >
              <Ionicons name="close-circle-outline" size={16} color={theme.dangerText} />
              <Text style={{ fontSize: 12, fontWeight: '800', color: theme.dangerText }}>
                {pickLang(language, 'Remove plot', 'Remover lote')}
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.fieldLabel, { color: theme.text }]}>
            {pickLang(language, 'Cropping system for this plot:', 'Sistema deste lote:')}
          </Text>
          <View style={styles.systemRow}>
            {(
              [
                {
                  id: 'rotacao',
                  labelEn: 'Rotation / Intercrop',
                  labelPt: 'Rotação / Consórcio',
                },
                {
                  id: 'monocultura',
                  labelEn: 'Monocropping (1 crop)',
                  labelPt: 'Monocultura (1 planta)',
                },
              ] as const
            ).map((sys) => (
              <Pressable
                key={sys.id}
                onPress={() =>
                  patchActiveLot({
                    sistema: sys.id,
                    culturaAtual:
                      sys.id === 'monocultura'
                        ? activeLot.plantasRotacao[0] || pickLang(language, 'Maize', 'Milho')
                        : activeLot.plantasRotacao.join(' + '),
                  })
                }
                style={[
                  styles.sysPill,
                  {
                    backgroundColor:
                      activeLot.sistema === sys.id ? theme.primary : theme.surfaceMuted,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '900',
                    color: activeLot.sistema === sys.id ? theme.primaryText : theme.text,
                  }}
                >
                  {pickLang(language, sys.labelEn, sys.labelPt)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { color: theme.text }]}>
            {pickLang(
              language,
              'Currently planted / Rotation crops:',
              'O que planta atualmente / Plantas na rotação:'
            )}
          </Text>
          <View style={styles.chipWrap}>
            {plantCatalog.map((plant) => {
              const sel = activeLot.plantasRotacao.includes(plant);
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
                    {plant}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.inlineFields}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>
                {pickLang(language, 'Days planted:', 'Tempo plantada (dias):')}
              </Text>
              <TextInput
                value={String(activeLot.tempoPlantadaDias || '')}
                onChangeText={(txt) =>
                  patchActiveLot({
                    tempoPlantadaDias: Math.max(0, Number(txt.replace(/\D/g, '')) || 0),
                  })
                }
                keyboardType="numeric"
                placeholder={pickLang(language, 'e.g., 45', 'Ex.: 45')}
                placeholderTextColor={theme.textMuted}
                style={[
                  styles.input,
                  { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text },
                ]}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>
                {pickLang(language, 'Harvest date set?', 'Já tem data de colheita?')}
              </Text>
              <View style={styles.systemRow}>
                {[true, false].map((hasDate) => (
                  <Pressable
                    key={String(hasDate)}
                    onPress={() => patchActiveLot({ temDataColheita: hasDate })}
                    style={[
                      styles.sysPill,
                      {
                        backgroundColor:
                          activeLot.temDataColheita === hasDate
                            ? theme.primary
                            : theme.surfaceMuted,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '900',
                        color:
                          activeLot.temDataColheita === hasDate
                            ? theme.primaryText
                            : theme.text,
                      }}
                    >
                      {hasDate
                        ? pickLang(language, 'Yes', 'Sim')
                        : pickLang(language, 'No', 'Não')}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {activeLot.temDataColheita && (
            <View>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>
                {pickLang(
                  language,
                  'Harvest date or estimate:',
                  'Data ou previsão da colheita:'
                )}
              </Text>
              <TextInput
                value={activeLot.dataColheitaPrevista ?? ''}
                onChangeText={(txt) => patchActiveLot({ dataColheitaPrevista: txt })}
                placeholder={pickLang(
                  language,
                  'e.g., 2026-07-20 or In 30 days',
                  'Ex.: 20/07/2026 ou Em 30 dias'
                )}
                placeholderTextColor={theme.textMuted}
                style={[
                  styles.input,
                  { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text },
                ]}
              />
            </View>
          )}

          <Text style={[styles.fieldLabel, { color: theme.text }]}>
            {pickLang(
              language,
              'Planting schedule (phases and next rotation):',
              'Cronograma da plantação (fases e próxima rotação):'
            )}
          </Text>
          <TextInput
            value={activeLot.cronogramaPlantacao}
            onChangeText={(txt) => patchActiveLot({ cronogramaPlantacao: txt })}
            multiline
            placeholder={pickLang(
              language,
              'e.g., Rainy (Cowpea) → Dry (Spineless Cactus/Sorghum)',
              'Ex.: Chuva (Feijão-Caupi) → Verão (Palma/Sorgo)'
            )}
            placeholderTextColor={theme.textMuted}
            style={[
              styles.input,
              {
                backgroundColor: theme.bg,
                borderColor: theme.border,
                color: theme.text,
                minHeight: 56,
              },
            ]}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  infoCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
    gap: 6,
  },
  title: {
    fontWeight: '900',
  },
  sub: {
    fontSize: 12,
    lineHeight: 17,
  },
  metricsRow: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  miniChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  countRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  countPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  customCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  stepQtyBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyInput: {
    minWidth: 74,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '900',
  },
  addLotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  lotTabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  lotTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  lotTabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pendingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  lotEditorCard: {
    borderRadius: 18,
    borderWidth: 2,
    padding: 12,
    gap: 10,
  },
  lotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  demarcarSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  systemRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sysPill: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  plantChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  inlineFields: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '700',
  },
});
