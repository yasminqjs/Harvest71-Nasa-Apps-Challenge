import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAccessibility } from '../../context/AccessibilityContext';
import { pickLang } from '../../i18n/locale';
import { analyzeLeafImageOffline } from '../../services/leafAnalyzer';
import { getAppTheme } from '../../theme/tokens';
import {
  buildRotationComparisonOptions,
  createDefaultLotsForFarm,
} from '../../utils/agronomyHelpers';
import { formatArea, formatCurrencyBRL } from '../../utils/regionalize';

interface RotacaoAtualSubscreenProps {
  onBack?: () => void;
  title?: string;
  showProgressInput?: boolean;
}

export const RotacaoAtualSubscreen: React.FC<RotacaoAtualSubscreenProps> = ({
  onBack,
  title,
  showProgressInput = true,
}) => {
  const {
    accessibility,
    language,
    activeFarm,
    updateLotDetails,
    simulateRotation,
    saveLeafAnalysis,
    speak,
  } = useAccessibility();
  const theme = getAppTheme(accessibility);
  const resolvedTitle = title ?? pickLang(language, 'Current Rotation', 'Rotação atual');

  const lots =
    activeFarm?.lotes && activeFarm.lotes.length > 0
      ? activeFarm.lotes
      : activeFarm
      ? createDefaultLotsForFarm(
          activeFarm.centroid,
          activeFarm.areaHectares,
          activeFarm.culturaPrincipal,
          language
        )
      : [];

  const [selectedLotId, setSelectedLotId] = useState(lots[0]?.id ?? 'lot-1');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [expandedStrategyId, setExpandedStrategyId] = useState<string | null>(null);

  if (!activeFarm) return null;

  const activeLot = lots.find((l) => l.id === selectedLotId) ?? lots[0];
  const strategies = buildRotationComparisonOptions(activeFarm, activeLot, language);

  const handleAddValidationPhoto = async () => {
    if (!activeLot) return;
    setPhotoBusy(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      const res = perm.granted
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

      if (!res.canceled && res.assets?.[0]?.uri) {
        const asset = res.assets[0];
        const leafRes = await analyzeLeafImageOffline(
          asset.uri,
          undefined,
          asset.base64,
          language
        );
        await saveLeafAnalysis(leafRes);
        const existingPhotos = activeLot.fotosValidacao ?? [];
        await updateLotDetails(activeLot.id, {
          fotosValidacao: [
            {
              id: `foto-${Date.now()}`,
              uri: asset.uri,
              label: leafRes.titulo,
              criadoEm: new Date().toISOString(),
            },
            ...existingPhotos,
          ],
        });
        speak(
          pickLang(
            language,
            `Crop photo validated on ${activeLot.nome}: ${leafRes.titulo}`,
            `Foto da plantação validada no ${activeLot.nome}: ${leafRes.titulo}`
          )
        );
      }
    } catch {
      const fallback = await analyzeLeafImageOffline(
        'local-sample://lot',
        'saudavel',
        undefined,
        language
      );
      await saveLeafAnalysis(fallback);
      speak(
        pickLang(
          language,
          'Simulated photo validated on the plot.',
          'Foto simulada validada no lote.'
        )
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleUpdateProgress = async (nextPct: number) => {
    if (!activeLot) return;
    const clamped = Math.max(0, Math.min(100, nextPct));
    await updateLotDetails(activeLot.id, { progressoRealPct: clamped });
    speak(
      pickLang(
        language,
        `Progress on ${activeLot.nome} updated to ${clamped}%.`,
        `Progresso do ${activeLot.nome} atualizado para ${clamped}%.`
      )
    );
  };

  const handleAdoptStrategy = async (strategyName: string, plants: string[]) => {
    if (!activeLot) return;
    const cleanName = strategyName
      .replace(' (Atual)', '')
      .replace(' (Current)', '');
    await updateLotDetails(activeLot.id, {
      sistema: plants.length > 1 ? 'rotacao' : 'monocultura',
      culturaAtual: cleanName,
      plantasRotacao: plants,
      culturasFuturas: plants,
      cronogramaPlantacao: pickLang(
        language,
        `Adopted plan: ${cleanName}`,
        `Plano adotado: ${cleanName}`
      ),
    });
    await simulateRotation(cleanName);
    speak(
      pickLang(
        language,
        `Rotation ${cleanName} applied to ${activeLot.nome}.`,
        `Rotação ${cleanName} aplicada ao ${activeLot.nome}.`
      )
    );
  };

  const progressDiff = activeLot
    ? activeLot.progressoRealPct - activeLot.progressoEsperadoPct
    : 0;

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
              {pickLang(language, 'Back', 'Voltar')}
            </Text>
          </Pressable>
          <Text style={[styles.screenTitle, { color: theme.text, fontSize: 18 * theme.scale }]}>
            {resolvedTitle}
          </Text>
          <Pressable
            onPress={() =>
              activeLot &&
              speak(
                pickLang(
                  language,
                  `${activeLot.nome}, growing ${activeLot.culturaAtual}. Reported progress ${activeLot.progressoRealPct}%, expected ${activeLot.progressoEsperadoPct}%.`,
                  `${activeLot.nome}, plantio de ${activeLot.culturaAtual}. Progresso informado de ${activeLot.progressoRealPct}%, expectativa de ${activeLot.progressoEsperadoPct}%.`
                )
              )
            }
            style={[styles.voiceBtn, { backgroundColor: theme.surfaceMuted }]}
          >
            <Ionicons name="volume-high" size={18} color={theme.primary} />
          </Pressable>
        </View>
      )}

      {/* Plot Selector */}
      <View style={styles.lotsRow}>
        {lots.map((lot) => {
          const active = lot.id === activeLot?.id;
          return (
            <Pressable
              key={lot.id}
              onPress={() => setSelectedLotId(lot.id)}
              style={[
                styles.lotChip,
                {
                  backgroundColor: active ? lot.corHex : theme.surface,
                  borderColor: lot.corHex,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '900',
                  color: active ? '#FFFFFF' : theme.text,
                }}
              >
                {lot.nome}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {activeLot && (
        <>
          {/* Validate plantation (photos) */}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: '#2563EB' },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {pickLang(language, 'Validate crops (photos)', 'Validar plantação (fotos)')}
            </Text>
            <Pressable
              onPress={handleAddValidationPhoto}
              disabled={photoBusy}
              style={[styles.cameraBtn, { backgroundColor: '#2563EB' }]}
            >
              <Ionicons name="camera" size={20} color="#FFFFFF" />
              <Text style={{ fontWeight: '900', color: '#FFFFFF' }}>
                {photoBusy
                  ? pickLang(language, 'Analyzing photo...', 'Analisando foto...')
                  : pickLang(
                      language,
                      'Take or upload plot photo',
                      'Tirar ou enviar foto do lote'
                    )}
              </Text>
            </Pressable>

            {(activeLot.fotosValidacao ?? []).length > 0 && (
              <View style={styles.photoGrid}>
                {(activeLot.fotosValidacao ?? []).slice(0, 3).map((foto) => (
                  <View
                    key={foto.id}
                    style={[styles.photoCard, { borderColor: theme.border }]}
                  >
                    <Image source={{ uri: foto.uri }} style={styles.photoThumb} />
                    <Text style={{ fontSize: 10, fontWeight: '800', color: theme.text }} numberOfLines={2}>
                      {foto.label}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Plantation Info */}
          <Text style={[styles.sectionTitle, { color: theme.text, paddingHorizontal: 2 }]}>
            {pickLang(language, 'Plantation info', 'Infos da plantação')}
          </Text>

          {/* 1. Crop type */}
          <View
            style={[
              styles.infoBox,
              { backgroundColor: theme.surface, borderColor: '#2563EB' },
            ]}
          >
            <View style={styles.infoHeader}>
              <Ionicons name="leaf-outline" size={18} color="#2563EB" />
              <Text style={[styles.infoBoxTitle, { color: '#2563EB' }]}>
                {pickLang(language, 'Crop type', 'Tipo de planta')}
              </Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '900', color: theme.text }}>
              {activeLot.culturaAtual} (
              {activeLot.sistema === 'monocultura'
                ? pickLang(language, 'Monoculture', 'Monocultura')
                : pickLang(language, 'Rotation', 'Rotação')}
              )
            </Text>
            <Text style={{ fontSize: 12, color: theme.textMuted }}>
              {pickLang(language, 'Area:', 'Área:')}{' '}
              {formatArea(activeLot.areaHectares, activeLot.areaTarefasBa, language)} •{' '}
              {pickLang(
                language,
                `Planted ${activeLot.tempoPlantadaDias} days ago`,
                `Plantada há ${activeLot.tempoPlantadaDias} dias`
              )}
              {activeLot.temDataColheita && activeLot.dataColheitaPrevista
                ? ` • ${pickLang(language, 'Harvest:', 'Colheita:')} ${activeLot.dataColheitaPrevista}`
                : ''}
            </Text>
            <Text style={{ fontSize: 12, color: theme.text }}>
              {pickLang(language, 'Schedule:', 'Cronograma:')} {activeLot.cronogramaPlantacao}
            </Text>
          </View>

          {/* 2. Update progress */}
          {showProgressInput && (
            <View
              style={[
                styles.infoBox,
                { backgroundColor: theme.surface, borderColor: '#2563EB' },
              ]}
            >
              <View style={styles.infoHeader}>
                <Ionicons name="analytics-outline" size={18} color="#2563EB" />
                <Text style={[styles.infoBoxTitle, { color: '#2563EB' }]}>
                  {pickLang(
                    language,
                    `Update progress (${activeLot.progressoRealPct}%)`,
                    `Informar progresso (${activeLot.progressoRealPct}%)`
                  )}
                </Text>
              </View>
              <View style={styles.progressBtnsRow}>
                {[25, 50, 75, 100].map((val) => (
                  <Pressable
                    key={val}
                    onPress={() => handleUpdateProgress(val)}
                    style={[
                      styles.pctChip,
                      {
                        backgroundColor:
                          Math.abs(activeLot.progressoRealPct - val) <= 5
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
                          Math.abs(activeLot.progressoRealPct - val) <= 5
                            ? theme.primaryText
                            : theme.text,
                      }}
                    >
                      {val}%
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.stepBtns}>
                <Pressable
                  onPress={() => handleUpdateProgress(activeLot.progressoRealPct - 10)}
                  style={[
                    styles.stepBtn,
                    { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                  ]}
                >
                  <Text style={{ fontWeight: '900', color: theme.text }}>-10%</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleUpdateProgress(activeLot.progressoRealPct + 10)}
                  style={[
                    styles.stepBtn,
                    { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                  ]}
                >
                  <Text style={{ fontWeight: '900', color: theme.text }}>+10%</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* 3. Actual vs Expected Progression */}
          <View
            style={[
              styles.infoBox,
              { backgroundColor: theme.surface, borderColor: '#2563EB' },
            ]}
          >
            <View style={styles.infoHeader}>
              <Ionicons name="stats-chart-outline" size={18} color="#2563EB" />
              <Text style={[styles.infoBoxTitle, { color: '#2563EB' }]}>
                {pickLang(language, 'Actual vs Expected Growth', 'Progressão x expectativa')}
              </Text>
            </View>
            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>
              {pickLang(
                language,
                `Reported: ${activeLot.progressoRealPct}% • NASA/cycle expectation: ${activeLot.progressoEsperadoPct}%`,
                `Real informado: ${activeLot.progressoRealPct}% • Expectativa NASA/ciclo: ${activeLot.progressoEsperadoPct}%`
              )}
            </Text>
            <View style={styles.barGroup}>
              <View style={[styles.barTrack, { backgroundColor: theme.surfaceMuted }]}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${activeLot.progressoRealPct}%`, backgroundColor: theme.primary },
                  ]}
                />
              </View>
              <View style={[styles.barTrack, { backgroundColor: theme.surfaceMuted }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${activeLot.progressoEsperadoPct}%`,
                      backgroundColor: '#2563EB',
                    },
                  ]}
                />
              </View>
            </View>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '800',
                color: progressDiff >= -5 ? theme.successText : theme.warningText,
              }}
            >
              {progressDiff >= 5
                ? pickLang(
                    language,
                    '✓ Development ahead of seasonal expectation.',
                    '✓ Desenvolvimento acima do esperado para a época.'
                  )
                : progressDiff >= -5
                ? pickLang(
                    language,
                    '✓ Development aligned with climate expectations.',
                    '✓ Desenvolvimento dentro da expectativa climática.'
                  )
                : pickLang(
                    language,
                    '⚠️ Development slightly behind. Check soil moisture & straw mulch.',
                    '⚠️ Desenvolvimento um pouco atrasado. Cheque umidade e cobertura morta.'
                  )}
            </Text>
          </View>

          {/* 4. Financial Return */}
          <View
            style={[
              styles.infoBox,
              { backgroundColor: theme.surface, borderColor: '#2563EB' },
            ]}
          >
            <View style={styles.infoHeader}>
              <Ionicons name="cash-outline" size={18} color="#2563EB" />
              <Text style={[styles.infoBoxTitle, { color: '#2563EB' }]}>
                {pickLang(
                  language,
                  'Estimated financial return',
                  'Retorno financeiro estimado'
                )}
              </Text>
            </View>
            <Text style={{ fontSize: 18, fontWeight: '900', color: theme.primary }}>
              {formatCurrencyBRL(activeLot.retornoFinanceiroEstR$, language)}{' '}
              {pickLang(language, 'on this plot', 'neste lote')}
            </Text>
            <Text style={{ fontSize: 11, color: theme.textMuted }}>
              {pickLang(language, 'Average equivalent of ', 'Equivalente médio de ')}
              {formatCurrencyBRL(
                Math.round(
                  activeLot.retornoFinanceiroEstR$ / Math.max(0.25, activeLot.areaHectares)
                ),
                language
              )}{' '}
              {pickLang(language, 'per hectare.', 'por hectare.')}
            </Text>
          </View>

          {/* Compare current rotation vs alternatives */}
          <View
            style={[
              styles.compareCard,
              { backgroundColor: theme.warningBg, borderColor: theme.warningBorder },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.warningText }]}>
              {pickLang(
                language,
                'Compare current rotation vs alternatives',
                'Comparar rotação atual vs outras opções'
              )}
            </Text>
            <Text style={{ fontSize: 12, color: theme.warningText }}>
              {pickLang(
                language,
                'Compare at least 3 rotation strategies across water use, nitrogen, pest interruption, and farm return (decision-support tool).',
                'Compare pelo menos 3 estratégias de rotação com base em água, nitrogênio, pragas e retorno no seu terreno (apoio à decisão local).'
              )}
            </Text>

            {strategies.map((strat) => {
              const isOpen = expandedStrategyId === strat.id;
              const waterLabel =
                strat.demandaAgua === 'alta'
                  ? pickLang(language, 'high', 'alta')
                  : strat.demandaAgua === 'baixa'
                  ? pickLang(language, 'low', 'baixa')
                  : pickLang(language, 'medium', 'média');
              const forageLabel =
                strat.valorForragem === 'alto'
                  ? pickLang(language, 'high', 'alto')
                  : pickLang(language, 'medium', 'médio');
              return (
                <View
                  key={strat.id}
                  style={[
                    styles.stratCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: strat.isAtual ? '#2563EB' : theme.primary,
                    },
                  ]}
                >
                  <View style={styles.stratTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '900', color: theme.text }}>
                        {strat.nome}
                      </Text>
                      <Text style={{ fontSize: 11, color: theme.textMuted }}>
                        {pickLang(language, 'Resilience:', 'Resiliência:')}{' '}
                        {strat.scoreResiliencia}/100 • {pickLang(language, 'Water:', 'Água:')}{' '}
                        {waterLabel} • {pickLang(language, 'Erosion', 'Erosão')} -
                        {strat.reducaoErosaoPct}%
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.scoreBadge,
                        {
                          backgroundColor: strat.isAtual ? '#2563EB' : theme.primary,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '900', color: '#FFFFFF' }}>
                        {strat.scoreResiliencia}%
                      </Text>
                    </View>
                  </View>

                  <Text style={{ fontSize: 12, color: theme.text }}>
                    {pickLang(language, 'Fixes Nitrogen:', 'Fixa Nitrogênio:')}{' '}
                    {strat.fixacaoNitrogenio
                      ? pickLang(language, 'Yes', 'Sim')
                      : pickLang(language, 'No', 'Não')}{' '}
                    • {pickLang(language, 'Forage:', 'Forragem:')} {forageLabel} •{' '}
                    {pickLang(language, 'Return:', 'Retorno:')}{' '}
                    {formatCurrencyBRL(strat.retornoLiquidoEstHaR$, language)}/ha
                  </Text>

                  <Pressable
                    onPress={() => setExpandedStrategyId(isOpen ? null : strat.id)}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '900', color: '#2563EB' }}>
                      {isOpen
                        ? pickLang(
                            language,
                            '▲ Hide rationale & risks',
                            '▲ Ocultar justificativa e riscos'
                          )
                        : pickLang(
                            language,
                            '▼ View evidence, gaps & risks',
                            '▼ Ver evidências, lacunas e riscos'
                          )}
                    </Text>
                  </Pressable>

                  {isOpen && (
                    <View style={{ gap: 4, paddingTop: 4 }}>
                      <Text style={styles.detailLine}>
                        •{' '}
                        <Text style={{ fontWeight: '900' }}>
                          {pickLang(language, 'Why suggested:', 'Por que sugerida:')}
                        </Text>{' '}
                        {strat.porqueSugerida}
                      </Text>
                      <Text style={styles.detailLine}>
                        •{' '}
                        <Text style={{ fontWeight: '900' }}>
                          {pickLang(language, 'NASA/Soil evidence:', 'Evidências NASA/Solo:')}
                        </Text>{' '}
                        {strat.evidencias}
                      </Text>
                      <Text style={styles.detailLine}>
                        •{' '}
                        <Text style={{ fontWeight: '900' }}>
                          {pickLang(language, 'Benefits:', 'Benefícios:')}
                        </Text>{' '}
                        {strat.beneficios}
                      </Text>
                      <Text style={styles.detailLine}>
                        •{' '}
                        <Text style={{ fontWeight: '900' }}>
                          {pickLang(language, 'Information gaps:', 'Lacuna de informação:')}
                        </Text>{' '}
                        {strat.lacunasInformacao}
                      </Text>
                      <Text style={styles.detailLine}>
                        •{' '}
                        <Text style={{ fontWeight: '900' }}>
                          {pickLang(language, 'Risk / local check:', 'Risco / revisão local:')}
                        </Text>{' '}
                        {strat.riscosRevisaoLocal}
                      </Text>
                    </View>
                  )}

                  {!strat.isAtual && (
                    <Pressable
                      onPress={() => handleAdoptStrategy(strat.nome, strat.plantas)}
                      style={[styles.adoptBtn, { backgroundColor: theme.primary }]}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '900', color: theme.primaryText }}>
                        {pickLang(
                          language,
                          `Adopt this plan on ${activeLot.nome}`,
                          `Adotar esta opção no ${activeLot.nome}`
                        )}
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  backText: { fontSize: 13, fontWeight: '800' },
  screenTitle: { flex: 1, textAlign: 'center', fontWeight: '900' },
  voiceBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  lotsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  lotChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
  },
  card: { borderRadius: 18, borderWidth: 2, padding: 14, gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '900' },
  cameraBtn: {
    minHeight: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  photoCard: { width: 92, borderWidth: 1, borderRadius: 10, padding: 4, gap: 4 },
  photoThumb: { width: '100%', height: 64, borderRadius: 6 },
  infoBox: { borderRadius: 16, borderWidth: 2, padding: 12, gap: 6 },
  infoHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoBoxTitle: { fontSize: 14, fontWeight: '900' },
  progressBtnsRow: { flexDirection: 'row', gap: 8 },
  pctChip: {
    flex: 1,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtns: { flexDirection: 'row', gap: 8 },
  stepBtn: {
    flex: 1,
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barGroup: { gap: 4 },
  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  compareCard: { borderRadius: 18, borderWidth: 2, padding: 14, gap: 10 },
  stratCard: { borderRadius: 14, borderWidth: 1.5, padding: 12, gap: 6 },
  stratTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  scoreBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  detailLine: { fontSize: 11, color: '#1F2937', lineHeight: 16 },
  adoptBtn: {
    minHeight: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
});
