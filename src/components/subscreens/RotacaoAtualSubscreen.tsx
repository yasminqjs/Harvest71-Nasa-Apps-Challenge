import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Pressable, Text } from '../../i18n/native';
import { useAccessibility } from '../../context/AccessibilityContext';
import { analyzeLeafImageOffline } from '../../services/leafAnalyzer';
import { getAppTheme } from '../../theme/tokens';
import { createDefaultLotsForFarm } from '../../utils/agronomyHelpers';
import { formatArea, formatCurrencyBRL } from '../../utils/regionalize';

interface RotacaoAtualSubscreenProps {
  onBack?: () => void;
  onPlanRotation: (lotId: string) => void;
  initialLotId?: string;
  title?: string;
  showProgressInput?: boolean;
}

export const RotacaoAtualSubscreen: React.FC<RotacaoAtualSubscreenProps> = ({
  onBack,
  onPlanRotation,
  initialLotId,
  title = 'Rotação atual',
  showProgressInput = true,
}) => {
  const {
    accessibility,
    activeFarm,
    updateLotDetails,
    saveLeafAnalysis,
    speak,
  } = useAccessibility();
  const theme = getAppTheme(accessibility);

  const lots =
    activeFarm?.lotes && activeFarm.lotes.length > 0
      ? activeFarm.lotes
      : activeFarm
      ? createDefaultLotsForFarm(
          activeFarm.centroid,
          activeFarm.areaHectares,
          activeFarm.culturaPrincipal
        )
      : [];

  const [selectedLotId, setSelectedLotId] = useState(initialLotId ?? lots[0]?.id ?? 'lot-1');
  const [photoBusy, setPhotoBusy] = useState(false);

  if (!activeFarm) return null;

  const activeLot = lots.find((l) => l.id === selectedLotId) ?? lots[0];

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
        const leafRes = await analyzeLeafImageOffline(asset.uri, undefined, asset.base64);
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
        speak(`Foto da plantação validada no ${activeLot.nome}: ${leafRes.titulo}`);
      }
    } catch {
      const fallback = await analyzeLeafImageOffline('local-sample://lot', 'saudavel');
      await saveLeafAnalysis(fallback);
      speak('Foto simulada validada no lote.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleUpdateProgress = async (nextPct: number) => {
    if (!activeLot) return;
    const clamped = Math.max(0, Math.min(100, nextPct));
    await updateLotDetails(activeLot.id, { progressoRealPct: clamped });
    speak(`Progresso do ${activeLot.nome} atualizado para ${clamped}%.`);
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
            <Text style={[styles.backText, { color: theme.text }]}>Voltar</Text>
          </Pressable>
          <Text style={[styles.screenTitle, { color: theme.text, fontSize: 18 * theme.scale }]}>
            {title}
          </Text>
          <Pressable
            onPress={() =>
              activeLot &&
              speak(
                `${activeLot.nome}, plantio de ${activeLot.culturaAtual}. Progresso informado de ${activeLot.progressoRealPct}%, expectativa de ${activeLot.progressoEsperadoPct}%.`
              )
            }
            style={[styles.voiceBtn, { backgroundColor: theme.surfaceMuted }]}
          >
            <Ionicons name="volume-high" size={18} color={theme.primary} />
          </Pressable>
        </View>
      )}

      {/* Seletor de Lote */}
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
          {/* Validar plantação (fotos) */}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: '#2563EB' },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Validar plantação (fotos)
            </Text>
            <Pressable
              onPress={handleAddValidationPhoto}
              disabled={photoBusy}
              style={[styles.cameraBtn, { backgroundColor: '#2563EB' }]}
            >
              <Ionicons name="camera" size={20} color="#FFFFFF" />
              <Text style={{ fontWeight: '900', color: '#FFFFFF' }}>
                {photoBusy ? 'Analisando foto...' : 'Tirar ou enviar foto do lote'}
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

          {/* Infos da plantação (4 caixas conforme diagrama) */}
          <Text style={[styles.sectionTitle, { color: theme.text, paddingHorizontal: 2 }]}>
            Infos da plantação
          </Text>

          {/* 1. Tipo de planta */}
          <View
            style={[
              styles.infoBox,
              { backgroundColor: theme.surface, borderColor: '#2563EB' },
            ]}
          >
            <View style={styles.infoHeader}>
              <Ionicons name="leaf-outline" size={18} color="#2563EB" />
              <Text style={[styles.infoBoxTitle, { color: '#2563EB' }]}>Tipo de planta</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '900', color: theme.text }}>
              {activeLot.culturaAtual} ({activeLot.sistema === 'monocultura' ? 'Monocultura' : 'Rotação'})
            </Text>
            <Text style={{ fontSize: 12, color: theme.textMuted }}>
              Área: {formatArea(activeLot.areaHectares, activeLot.areaTarefasBa)} • Plantada há{' '}
              {activeLot.tempoPlantadaDias} dias
              {activeLot.temDataColheita && activeLot.dataColheitaPrevista
                ? ` • Colheita: ${activeLot.dataColheitaPrevista}`
                : ''}
            </Text>
            <Text style={{ fontSize: 12, color: theme.text }}>
              Cronograma: {activeLot.cronogramaPlantacao}
            </Text>
          </View>

          {/* 2. Informar progresso */}
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
                  Informar progresso ({activeLot.progressoRealPct}%)
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

          {/* 3. Progressão x expectativa */}
          <View
            style={[
              styles.infoBox,
              { backgroundColor: theme.surface, borderColor: '#2563EB' },
            ]}
          >
            <View style={styles.infoHeader}>
              <Ionicons name="stats-chart-outline" size={18} color="#2563EB" />
              <Text style={[styles.infoBoxTitle, { color: '#2563EB' }]}>
                Progressão x expectativa
              </Text>
            </View>
            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>
              Real informado: {activeLot.progressoRealPct}% • Expectativa NASA/ciclo:{' '}
              {activeLot.progressoEsperadoPct}%
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
                ? '✓ Desenvolvimento acima do esperado para a época.'
                : progressDiff >= -5
                ? '✓ Desenvolvimento dentro da expectativa climática.'
                : '⚠️ Desenvolvimento um pouco atrasado. Cheque umidade e cobertura morta.'}
            </Text>
          </View>

          {/* 4. Retorno financeiro */}
          <View
            style={[
              styles.infoBox,
              { backgroundColor: theme.surface, borderColor: '#2563EB' },
            ]}
          >
            <View style={styles.infoHeader}>
              <Ionicons name="cash-outline" size={18} color="#2563EB" />
              <Text style={[styles.infoBoxTitle, { color: '#2563EB' }]}>
                Retorno financeiro estimado
              </Text>
            </View>
            <Text style={{ fontSize: 18, fontWeight: '900', color: theme.primary }}>
              {formatCurrencyBRL(activeLot.retornoFinanceiroEstR$)} neste lote
            </Text>
            <Text style={{ fontSize: 11, color: theme.textMuted }}>
              Equivalente médio de{' '}
              {formatCurrencyBRL(
                Math.round(
                  activeLot.retornoFinanceiroEstR$ / Math.max(0.25, activeLot.areaHectares)
                )
              )}{' '}
              por hectare.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => onPlanRotation(activeLot.id)}
            style={[styles.planButton, { backgroundColor: theme.primary }]}
          >
            <Ionicons name="calendar-outline" size={18} color={theme.primaryText} />
            <Text style={{ fontSize: 13, fontWeight: '900', color: theme.primaryText }}>
              Planejar a partir deste lote
            </Text>
          </Pressable>
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
  planButton: {
    minHeight: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
});
