import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Pressable, Text, TextInput } from '../../i18n/native';
import { useAccessibility } from '../../context/AccessibilityContext';
import { getAppTheme } from '../../theme/tokens';
import { ProblemReportType } from '../../types/domain';
import {
  PROBLEM_REPORT_OPTIONS,
  getRegionalSimilarProblems,
} from '../../utils/agronomyHelpers';

interface ReportarProblemaSubscreenProps {
  onBack: () => void;
}

export const ReportarProblemaSubscreen: React.FC<ReportarProblemaSubscreenProps> = ({
  onBack,
}) => {
  const { accessibility, activeFarm, registerFieldLog, speak } = useAccessibility();
  const theme = getAppTheme(accessibility);

  const [tipoProblema, setTipoProblema] = useState<ProblemReportType>('seca_estiagem');
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [descricao, setDescricao] = useState('');
  const [selectedLotId, setSelectedLotId] = useState(activeFarm?.lotes?.[0]?.id ?? '');
  const [submittedMsg, setSubmittedMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!activeFarm) return null;

  const lots = activeFarm.lotes ?? [];
  const activeOption =
    PROBLEM_REPORT_OPTIONS.find((p) => p.id === tipoProblema) ??
    PROBLEM_REPORT_OPTIONS[0];
  const similarProblems = getRegionalSimilarProblems(activeFarm.bioma, tipoProblema);

  const handlePickPhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      const res = perm.granted
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.4 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.4 });
      if (!res.canceled && res.assets?.[0]?.uri) {
        setFotoUri(res.assets[0].uri);
      }
    } catch {
      // Silencioso caso câmera indisponível
    }
  };

  const handleSubmitReport = async () => {
    setSaving(true);
    setSubmittedMsg(null);
    try {
      const selectedLot = lots.find((l) => l.id === selectedLotId);
      await registerFieldLog({
        tipo: 'problema_relatado',
        tipoProblema,
        fotoUri: fotoUri ?? undefined,
        loteId: selectedLot?.id,
        loteNome: selectedLot?.nome,
        choveuHoje: tipoProblema === 'excesso_chuva' ? true : tipoProblema === 'seca_estiagem' ? false : undefined,
        umidadeSoloCampo:
          tipoProblema === 'seca_estiagem'
            ? 'seca_rachando'
            : tipoProblema === 'excesso_chuva'
            ? 'encharcada'
            : undefined,
        estadoLavoura:
          tipoProblema === 'praga_inseto'
            ? 'com_pragas'
            : tipoProblema === 'doenca_folha'
            ? 'amarelada'
            : undefined,
        sinaisErosao: tipoProblema === 'erosao_solo',
        observacao:
          descricao.trim() || `${activeOption.label}${selectedLot ? ` (${selectedLot.nome})` : ''}`,
      });
      setSubmittedMsg(
        `Problema registrado! Dica imediata: ${activeOption.dicaRapida}`
      );
      setDescricao('');
      speak(`Problema registrado: ${activeOption.label}. ${activeOption.dicaRapida}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Pressable
          onPress={onBack}
          style={[styles.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Ionicons name="arrow-back" size={18} color={theme.text} />
          <Text style={[styles.backText, { color: theme.text }]}>Voltar</Text>
        </Pressable>
        <Text style={[styles.screenTitle, { color: theme.text, fontSize: 18 * theme.scale }]}>
          Reportar problema
        </Text>
        <View style={{ width: 64 }} />
      </View>

      {/* Bloco 1: Tipo de problema */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: '#2563EB' }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Tipo de problema</Text>
        <View style={styles.chipWrap}>
          {PROBLEM_REPORT_OPTIONS.map((opt) => {
            const active = tipoProblema === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setTipoProblema(opt.id)}
                style={[
                  styles.probChip,
                  {
                    backgroundColor: active ? '#DC2626' : theme.surfaceMuted,
                    borderColor: active ? '#DC2626' : theme.border,
                  },
                ]}
              >
                <Ionicons
                  name={opt.icon as keyof typeof Ionicons.glyphMap}
                  size={15}
                  color={active ? '#FFFFFF' : theme.text}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '800',
                    color: active ? '#FFFFFF' : theme.text,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {lots.length > 0 && (
          <View style={styles.chipWrap}>
            {lots.map((l) => (
              <Pressable
                key={l.id}
                onPress={() => setSelectedLotId(l.id)}
                style={[
                  styles.lotMini,
                  {
                    backgroundColor: selectedLotId === l.id ? l.corHex : theme.surfaceMuted,
                    borderColor: l.corHex,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '800',
                    color: selectedLotId === l.id ? '#FFFFFF' : theme.text,
                  }}
                >
                  {l.nome}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <TextInput
          value={descricao}
          onChangeText={setDescricao}
          placeholder="Descreva o que está acontecendo no lote (opcional)"
          placeholderTextColor={theme.textMuted}
          multiline
          style={[
            styles.input,
            { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text },
          ]}
        />

        {/* Foto de validação */}
        <Text style={[styles.cardTitle, { color: theme.text, marginTop: 4 }]}>
          Foto de validação
        </Text>
        <Pressable
          onPress={handlePickPhoto}
          style={[
            styles.photoBtn,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}
        >
          <Ionicons name="camera-outline" size={20} color="#2563EB" />
          <Text style={{ fontWeight: '800', color: '#2563EB' }}>
            {fotoUri ? 'Trocar foto do problema' : 'Tirar foto ou escolher da galeria'}
          </Text>
        </Pressable>

        {fotoUri && (
          <Image source={{ uri: fotoUri }} style={styles.previewImg} />
        )}

        <Pressable
          onPress={handleSubmitReport}
          disabled={saving}
          style={[styles.submitBtn, { backgroundColor: '#DC2626' }]}
        >
          <Ionicons name="send" size={18} color="#FFFFFF" />
          <Text style={{ fontWeight: '900', color: '#FFFFFF' }}>
            {saving ? 'Enviando...' : 'Registrar problema'}
          </Text>
        </Pressable>

        {submittedMsg && (
          <View
            style={[
              styles.successBox,
              { backgroundColor: theme.successBg, borderColor: theme.successBorder },
            ]}
          >
            <Text style={{ fontSize: 12, fontWeight: '800', color: theme.successText }}>
              ✓ {submittedMsg}
            </Text>
          </View>
        )}
      </View>

      {/* Bloco 2: Leitura de problemas semelhantes na região */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          Leitura de problemas semelhantes na região
        </Text>
        <Text style={{ fontSize: 12, color: theme.textMuted }}>
          Relatos próximos ao bioma {activeFarm.bioma} e o que funcionou na prática:
        </Text>

        {similarProblems.map((prob) => (
          <View
            key={prob.id}
            style={[
              styles.similarCard,
              { backgroundColor: theme.bg, borderColor: theme.border },
            ]}
          >
            <View style={styles.similarHeader}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '900', color: theme.text }}>
                  {prob.titulo}
                </Text>
                <Text style={{ fontSize: 11, color: theme.textMuted }}>
                  {prob.autor} • {prob.municipio} • há {prob.haQuantosDias} dias
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  speak(`${prob.titulo}. ${prob.descricao}. O que funcionou: ${prob.acaoQueFuncionou}`, true)
                }
                style={[styles.listenBtn, { backgroundColor: theme.surfaceMuted }]}
              >
                <Ionicons name="volume-high" size={16} color={theme.primary} />
                <Text style={{ fontSize: 11, fontWeight: '800', color: theme.primary }}>
                  Ouvir
                </Text>
              </Pressable>
            </View>
            <Text style={{ fontSize: 12, color: theme.text, lineHeight: 17 }}>
              {prob.descricao}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: '800', color: theme.primary }}>
              ✓ O que funcionou: {prob.acaoQueFuncionou}
            </Text>
          </View>
        ))}
      </View>
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
  card: { borderRadius: 18, borderWidth: 2, padding: 14, gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '900' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  probChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  lotMini: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1.5 },
  input: {
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    minHeight: 54,
  },
  photoBtn: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  previewImg: { width: '100%', height: 150, borderRadius: 12 },
  submitBtn: {
    minHeight: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  successBox: { borderRadius: 12, borderWidth: 1.5, padding: 10 },
  similarCard: { borderRadius: 14, borderWidth: 1, padding: 10, gap: 5 },
  similarHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  listenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
});
