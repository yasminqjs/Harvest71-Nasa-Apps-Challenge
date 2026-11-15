import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLanguage } from '../../i18n/Language';
import { Pressable, Text, TextInput } from '../../i18n/native';
import { useAccessibility } from '../../context/AccessibilityContext';
import { getAppTheme } from '../../theme/tokens';
import { PLANT_CATALOG_CHIPS } from '../../utils/agronomyHelpers';

interface HistoricoPlantioSubscreenProps {
  onBack?: () => void;
  title?: string;
}

export const HistoricoPlantioSubscreen: React.FC<HistoricoPlantioSubscreenProps> = ({
  onBack,
  title = 'Histórico de plantio',
}) => {
  const { accessibility, activeFarmer, activeFarm, recordCropHistory, speak } = useAccessibility();
  const { language } = useLanguage();
  const en = language === 'en';
  const theme = getAppTheme(accessibility);

  const [tipoSistema, setTipoSistema] = useState<'rotacao' | 'monocultura'>('rotacao');
  const [selectedPlants, setSelectedPlants] = useState<string[]>(['Feijão-Caupi', 'Mandioca']);
  const [customPlant, setCustomPlant] = useState('');
  const [duracaoTexto, setDuracaoTexto] = useState('');
  const [maisInfos, setMaisInfos] = useState('');
  const [selectedLoteNome, setSelectedLoteNome] = useState(
    activeFarm?.lotes?.[0]?.nome ?? 'Lote 1'
  );
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const detailedHistory = activeFarmer?.historicoCultivoDetalhado ?? [];
  const legacyNames = activeFarmer?.historicoCultivo ?? [];
  const lots = activeFarm?.lotes ?? [];

  const togglePlant = (plant: string) => {
    setSelectedPlants((prev) =>
      prev.includes(plant) ? prev.filter((p) => p !== plant) : [...prev, plant]
    );
  };

  const handleSave = async () => {
    const allPlants = [
      ...selectedPlants,
      ...(customPlant.trim() ? [customPlant.trim()] : []),
    ];
    if (allPlants.length === 0) {
      setStatusMsg('Escolha ou digite ao menos um tipo de planta.');
      return;
    }

    setSaving(true);
    setStatusMsg(null);
    try {
      const nomeCultura =
        tipoSistema === 'monocultura' ? allPlants[0] : allPlants.join(' + ');
      await recordCropHistory({
        nomeCultura,
        tipoSistema,
        plantas: tipoSistema === 'monocultura' ? [allPlants[0]] : allPlants,
        duracaoTexto: duracaoTexto.trim() || 'Safra anterior',
        loteNome: selectedLoteNome,
        observacao: maisInfos.trim() || undefined,
      });
      setCustomPlant('');
      setDuracaoTexto('');
      setMaisInfos('');
      setStatusMsg('Rotação adicionada ao histórico cadastrado!');
      speak(`Histórico salvo: ${nomeCultura}.`);
    } finally {
      setSaving(false);
    }
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
          <Text style={[styles.screenTitle, { color: theme.text, fontSize: 18 * theme.scale }]}>
            {title}
          </Text>
          <Pressable
            onPress={() =>
              speak(
                en
                  ? `Land and harvest history. You have ${detailedHistory.length || legacyNames.length} saved records. Choose rotation or single crop, select crops, and save to enrich future simulations.`
                  : `${title}. Existem ${detailedHistory.length || legacyNames.length} registros de plantio salvos. Escolha rotação ou monocultura, marque as plantas e salve para melhorar a simulação.`,
                true
              )
            }
            style={[styles.backBtn, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
          >
            <Ionicons name="volume-high" size={18} color={theme.primary} />
          </Pressable>
        </View>
      )}

      {/* Bloco 1: Cadastro de rotação */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: '#2563EB' }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Cadastro de rotação</Text>

        {lots.length > 0 && (
          <>
            <Text style={[styles.label, { color: theme.textMuted }]}>Lote / Área:</Text>
            <View style={styles.chipWrap}>
              {lots.map((l) => (
                <Pressable
                  key={l.id}
                  onPress={() => setSelectedLoteNome(l.nome)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor:
                        selectedLoteNome === l.nome ? l.corHex : theme.surfaceMuted,
                      borderColor: l.corHex,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '800',
                      color: selectedLoteNome === l.nome ? '#FFFFFF' : theme.text,
                    }}
                  >
                    {l.nome}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Text style={[styles.label, { color: theme.textMuted }]}>Rotação:</Text>
        <View style={styles.rowBtns}>
          {(
            [
              { id: 'rotacao', label: 'Rotação / Consórcio' },
              { id: 'monocultura', label: 'Monocultura' },
            ] as const
          ).map((sys) => (
            <Pressable
              key={sys.id}
              onPress={() => setTipoSistema(sys.id)}
              style={[
                styles.sysBtn,
                {
                  backgroundColor: tipoSistema === sys.id ? theme.primary : theme.surfaceMuted,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '900',
                  color: tipoSistema === sys.id ? theme.primaryText : theme.text,
                }}
              >
                {sys.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: theme.textMuted }]}>Tipos de planta:</Text>
        <View style={styles.chipWrap}>
          {PLANT_CATALOG_CHIPS.map((plant) => {
            const active = selectedPlants.includes(plant);
            return (
              <Pressable
                key={plant}
                onPress={() => togglePlant(plant)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme.primary : theme.surfaceMuted,
                    borderColor: active ? theme.primary : theme.border,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '800',
                    color: active ? theme.primaryText : theme.text,
                  }}
                >
                  {plant}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          value={customPlant}
          onChangeText={setCustomPlant}
          placeholder="Outra planta? (ex.: Gergelim, Batata-doce)"
          placeholderTextColor={theme.textMuted}
          style={[
            styles.input,
            { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text },
          ]}
        />

        <Text style={[styles.label, { color: theme.textMuted }]}>Duração:</Text>
        <TextInput
          value={duracaoTexto}
          onChangeText={setDuracaoTexto}
          placeholder="Ex.: 90 dias (Janeiro a Abril/2026)"
          placeholderTextColor={theme.textMuted}
          style={[
            styles.input,
            { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text },
          ]}
        />

        <Text style={[styles.label, { color: theme.textMuted }]}>Mais informações?</Text>
        <TextInput
          value={maisInfos}
          onChangeText={setMaisInfos}
          placeholder="Ex.: Produção de 12 sacas, solo segurou bem a chuva"
          placeholderTextColor={theme.textMuted}
          multiline
          style={[
            styles.input,
            {
              backgroundColor: theme.bg,
              borderColor: theme.border,
              color: theme.text,
              minHeight: 54,
            },
          ]}
        />

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveBtn, { backgroundColor: theme.primary }]}
        >
          <Ionicons name="add-circle" size={18} color={theme.primaryText} />
          <Text style={{ fontWeight: '900', color: theme.primaryText }}>
            {saving ? 'Salvando...' : 'Salvar no histórico'}
          </Text>
        </Pressable>

        {statusMsg && (
          <Text style={{ fontSize: 12, fontWeight: '800', color: theme.primary }}>
            ✓ {statusMsg}
          </Text>
        )}
      </View>

      {/* Bloco 2: Histórico cadastrado */}
      <View
        style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <Text style={[styles.cardTitle, { color: theme.text }]}>Histórico cadastrado</Text>

        {detailedHistory.length === 0 && legacyNames.length === 0 ? (
          <Text style={{ fontSize: 12, color: theme.textMuted }}>
            Nenhuma rotação antiga registrada ainda.
          </Text>
        ) : (
          <View style={{ gap: 8 }}>
            {detailedHistory.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.histRow,
                  { backgroundColor: theme.bg, borderColor: theme.border },
                ]}
              >
                <View style={styles.histTop}>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: theme.text }}>
                    {item.nomeCultura}
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: theme.primary }}>
                    {item.tipoSistema === 'monocultura' ? 'Monocultura' : 'Rotação'}
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: theme.textMuted }}>
                  {item.loteNome ? `${item.loteNome} • ` : ''}
                  Duração: {item.duracaoTexto || item.periodoSafra || 'Safra anterior'}
                  {item.quantidadeColhida
                    ? ` • Colhido: ${item.quantidadeColhida} ${item.unidadeQuantidade || 'kg'}`
                    : ''}
                </Text>
                {item.observacao ? (
                  <Text style={{ fontSize: 12, color: theme.text }}>{item.observacao}</Text>
                ) : null}
              </View>
            ))}

            {legacyNames.length > 0 && detailedHistory.length === 0 && (
              <View style={styles.chipWrap}>
                {legacyNames.map((name) => (
                  <View
                    key={name}
                    style={[
                      styles.chip,
                      { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                    ]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '800', color: theme.text }}>
                      {name}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
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
  card: {
    borderRadius: 18,
    borderWidth: 2,
    padding: 14,
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '900' },
  label: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  rowBtns: { flexDirection: 'row', gap: 8 },
  sysBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '700',
  },
  saveBtn: {
    minHeight: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  histRow: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 3,
  },
  histTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
