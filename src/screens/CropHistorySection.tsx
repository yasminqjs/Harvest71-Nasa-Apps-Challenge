import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLanguage } from '../i18n/Language';
import { translate } from '../i18n/translate';
import { Pressable, Text, TextInput } from '../i18n/native';
import { useAccessibility } from '../context/AccessibilityContext';
import { SEED_CROPS } from '../data/seedData';
import { CropDecisionItem, HarvestQuantityUnit } from '../types/domain';
import { getAppTheme } from '../theme/tokens';

const QUANTITY_UNITS: { key: HarvestQuantityUnit; label: string; labelEn: string }[] = [
  { key: 'kg', label: 'kg', labelEn: 'kg' },
  { key: 'sacas', label: 'sacas', labelEn: 'sacks' },
  { key: 'toneladas', label: 'toneladas', labelEn: 'tons' },
];

function normalizeCropName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim();
}

export const CropHistorySection: React.FC = () => {
  const { accessibility, activeFarmer, recordCropHistory } = useAccessibility();
  const { language } = useLanguage();
  const en = language === 'en';
  const theme = getAppTheme(accessibility);
  const [query, setQuery] = useState('');
  const [selectedCrop, setSelectedCrop] = useState<CropDecisionItem | null>(null);
  const [customCrop, setCustomCrop] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<HarvestQuantityUnit>('kg');
  const [period, setPeriod] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const suggestions = useMemo(() => {
    const normalizedQuery = normalizeCropName(query);
    if (!normalizedQuery) return [];
    return SEED_CROPS.filter((crop) =>
      [crop.nome, crop.variedadeRegional].some((name) =>
        normalizeCropName(name).includes(normalizedQuery)
      )
    ).slice(0, 4);
  }, [query]);

  const detailedHistory = activeFarmer.historicoCultivoDetalhado ?? [];
  const detailedNames = new Set(detailedHistory.map((record) => normalizeCropName(record.nomeCultura)));
  const previousHistory = (activeFarmer.historicoCultivo ?? []).filter(
    (name) => !detailedNames.has(normalizeCropName(name))
  );

  const chooseCrop = (crop: CropDecisionItem) => {
    setSelectedCrop(crop);
    setCustomCrop('');
    setQuery(crop.nome);
    setError('');
  };

  const chooseCustomCrop = () => {
    const name = query.trim();
    if (!name) return;
    setSelectedCrop(null);
    setCustomCrop(name);
    setQuery(name);
    setError('');
  };

  const saveRecord = async () => {
    const cropName = selectedCrop?.nome ?? customCrop;
    if (!cropName) {
      setError(
        en
          ? 'Pick a suggestion or confirm the typed crop name.'
          : 'Escolha uma sugestão ou confirme o nome digitado.'
      );
      return;
    }
    const parsedQuantity = quantity.trim()
      ? Number(quantity.trim().replace(',', '.'))
      : undefined;
    if (parsedQuantity !== undefined && (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0)) {
      setError(
        en
          ? 'Enter a quantity greater than zero.'
          : 'Informe uma quantidade maior que zero.'
      );
      return;
    }

    setSaving(true);
    setError('');
    try {
      await recordCropHistory({
        nomeCultura: cropName,
        cropId: selectedCrop?.id,
        quantidadeColhida: parsedQuantity,
        unidadeQuantidade: parsedQuantity === undefined ? undefined : unit,
        periodoSafra: period.trim() || undefined,
      });
      setQuery('');
      setSelectedCrop(null);
      setCustomCrop('');
      setQuantity('');
      setPeriod('');
    } catch {
      setError(en ? 'Could not save. Please try again.' : 'Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.heading}>
        <Ionicons name="leaf-outline" size={21} color={theme.primary} />
        <Text style={[styles.title, { color: theme.text, fontSize: 17 * theme.scale }]}>
          Histórico de cultivos
        </Text>
      </View>
      <Text style={{ color: theme.textMuted, fontSize: 12 }}>
        {en
          ? `Record what ${activeFarmer.tratamento} has already planted and harvested.`
          : `Registre o que já foi plantado e colhido por ${activeFarmer.tratamento}.`}
      </Text>

      <Text style={[styles.label, { color: theme.text }]}>Cultura</Text>
      <TextInput
        value={query}
        onChangeText={(value) => {
          setQuery(value);
          setSelectedCrop(null);
          setCustomCrop('');
          setError('');
        }}
        placeholder="Digite o nome da cultura"
        placeholderTextColor={theme.textMuted}
        style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
        accessibilityLabel="Nome da cultura"
      />

      {query.trim().length > 0 && !selectedCrop && !customCrop && (
        <View style={styles.suggestions}>
          {suggestions.map((crop) => (
            <Pressable
              key={crop.id}
              onPress={() => chooseCrop(crop)}
              style={[styles.suggestion, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}
            >
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>
                {translate(crop.nome, language)}
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                {translate(crop.variedadeRegional, language)}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={chooseCustomCrop}
            style={[styles.customOption, { borderColor: theme.border }]}
          >
            <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 12 }}>
              {en ? `Use "${query.trim()}" as crop name` : `Usar “${query.trim()}” como nome da cultura`}
            </Text>
          </Pressable>
        </View>
      )}

      {(selectedCrop || customCrop) && (
        <View style={[styles.confirmed, { backgroundColor: theme.successBg, borderColor: theme.successBorder }]}>
          <Ionicons name="checkmark-circle" size={18} color={theme.successText} />
          <Text style={{ color: theme.successText, fontWeight: '800', fontSize: 12, flex: 1 }}>
            {selectedCrop
              ? en
                ? `Match: ${translate(selectedCrop.nome, language)}`
                : `Correspondência: ${selectedCrop.nome}`
              : en
              ? `Entered name: ${customCrop}`
              : `Nome informado: ${customCrop}`}
          </Text>
          <Pressable
            onPress={() => {
              setSelectedCrop(null);
              setCustomCrop('');
            }}
            accessibilityRole="button"
            accessibilityLabel="Alterar cultura escolhida"
          >
            <Ionicons name="pencil" size={17} color={theme.successText} />
          </Pressable>
        </View>
      )}

      <View style={styles.row}>
        <View style={styles.quantityField}>
          <Text style={[styles.label, { color: theme.text }]}>Quantidade colhida (opcional)</Text>
          <TextInput
            value={quantity}
            onChangeText={setQuantity}
            placeholder="Ex.: 120"
            placeholderTextColor={theme.textMuted}
            keyboardType="decimal-pad"
            style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
            accessibilityLabel="Quantidade colhida"
          />
        </View>
        <View style={styles.quantityField}>
          <Text style={[styles.label, { color: theme.text }]}>Unidade</Text>
          <View style={styles.units}>
            {QUANTITY_UNITS.map((option) => {
              const active = option.key === unit;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setUnit(option.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.unitButton,
                    {
                      backgroundColor: active ? theme.primary : theme.surfaceMuted,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text style={{ color: active ? theme.primaryText : theme.text, fontWeight: '800', fontSize: 10 }}>
                    {en ? option.labelEn : option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <Text style={[styles.label, { color: theme.text }]}>Safra ou período (opcional)</Text>
      <TextInput
        value={period}
        onChangeText={setPeriod}
        placeholder="Ex.: 2024/25 ou inverno de 2023"
        placeholderTextColor={theme.textMuted}
        style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
        accessibilityLabel="Safra ou período de cultivo"
      />

      {error ? <Text style={{ color: theme.dangerText, fontSize: 12 }}>{error}</Text> : null}
      <Pressable
        onPress={saveRecord}
        disabled={saving}
        style={[styles.saveButton, { backgroundColor: theme.primary, opacity: saving ? 0.6 : 1 }]}
      >
        <Ionicons name="save-outline" size={18} color={theme.primaryText} />
        <Text style={{ color: theme.primaryText, fontWeight: '900', fontSize: 13 }}>
          {saving ? (en ? 'Saving...' : 'Salvando...') : en ? 'Confirm & save crop' : 'Confirmar e salvar cultivo'}
        </Text>
      </Pressable>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <Text style={[styles.label, { color: theme.text }]}>Cultivos registrados</Text>
      {detailedHistory.map((record) => {
        const unitLabel = QUANTITY_UNITS.find((u) => u.key === record.unidadeQuantidade);
        const unitText = en ? unitLabel?.labelEn ?? record.unidadeQuantidade : record.unidadeQuantidade;
        return (
          <View key={record.id} style={[styles.historyRow, { backgroundColor: theme.bg }]}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: theme.text, fontWeight: '900', fontSize: 13 }}>
                {translate(record.nomeCultura, language)}
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                {[
                  record.quantidadeColhida !== undefined && record.unidadeQuantidade
                    ? `${en ? 'Harvest' : 'Colheita'}: ${record.quantidadeColhida} ${unitText}`
                    : null,
                  record.periodoSafra,
                ]
                  .filter(Boolean)
                  .join(' • ') || (en ? 'No quantity or period recorded' : 'Sem quantidade ou período informado')}
              </Text>
            </View>
            {record.cropId ? <Ionicons name="checkmark-circle" size={18} color={theme.successText} /> : null}
          </View>
        );
      })}
      {previousHistory.map((name) => (
        <View key={`legacy-${name}`} style={[styles.historyRow, { backgroundColor: theme.bg }]}>
          <Text style={{ color: theme.text, fontWeight: '800', fontSize: 12, flex: 1 }}>
            {translate(name, language)}
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 10 }}>
            {en ? 'already recorded' : 'já informado'}
          </Text>
        </View>
      ))}
      {detailedHistory.length === 0 && previousHistory.length === 0 && (
        <Text style={{ color: theme.textMuted, fontSize: 12 }}>Nenhum cultivo registrado ainda.</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderWidth: 2, borderRadius: 16, padding: 14, gap: 10 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontWeight: '900' },
  label: { fontSize: 12, fontWeight: '800' },
  input: { minHeight: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, fontSize: 13 },
  suggestions: { gap: 6 },
  suggestion: { borderWidth: 1, borderRadius: 10, padding: 9, gap: 2 },
  customOption: { borderWidth: 1, borderRadius: 10, borderStyle: 'dashed', padding: 9 },
  confirmed: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 9, gap: 7 },
  row: { flexDirection: 'row', gap: 8 },
  quantityField: { flex: 1, gap: 6 },
  units: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  unitButton: { minHeight: 38, flexGrow: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 7 },
  saveButton: { minHeight: 46, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  divider: { height: 1, opacity: 0.5, marginVertical: 2 },
  historyRow: { minHeight: 42, borderRadius: 9, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 8 },
});