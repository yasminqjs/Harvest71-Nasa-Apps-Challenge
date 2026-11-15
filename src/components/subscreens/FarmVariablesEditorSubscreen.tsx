import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLanguage } from '../../i18n/Language';
import { Pressable, Text } from '../../i18n/native';
import { useAccessibility } from '../../context/AccessibilityContext';
import { FEATURE_COLOR_STYLES } from '../../models/farmArchitecture';
import { getAppTheme } from '../../theme/tokens';
import {
  FarmObjective,
  FinancialTier,
  LaborType,
  WaterAccess,
  WaterStorageType,
} from '../../types/domain';
import { FeatureBadge } from '../FeatureBadge';

interface FarmVariablesEditorSubscreenProps {
  onBack: () => void;
}

/**
 * @featureColor VERDE
 * @featureModule Pegador de informações da fazenda
 * @userAction Atualizar variáveis da fazenda (fonte: usuário) dentro da Aba Plantação
 */
export const FarmVariablesEditorSubscreen: React.FC<FarmVariablesEditorSubscreenProps> = ({
  onBack,
}) => {
  const { accessibility, activeFarmer, activeFarm, updateFarmVariables, speak } =
    useAccessibility();
  const { language } = useLanguage();
  const en = language === 'en';
  const theme = getAppTheme(accessibility);
  const green = FEATURE_COLOR_STYLES.verde;

  const [waterAccess, setWaterAccess] = useState<WaterAccess>(
    activeFarmer?.waterAccess ?? 'sequeiro'
  );
  const [armazenamento, setArmazenamento] = useState<WaterStorageType>(
    activeFarmer?.armazenamentoAgua ?? 'cisterna_placa'
  );
  const [laborType, setLaborType] = useState<LaborType>(
    activeFarmer?.laborType ?? 'familiar'
  );
  const [financialTier, setFinancialTier] = useState<FinancialTier>(
    activeFarmer?.financialTier ?? 'pronaf'
  );
  const [objective, setObjective] = useState<FarmObjective>(
    activeFarmer?.objective ?? 'subsistencia'
  );
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  if (!activeFarmer || !activeFarm) return null;

  const handleSave = async () => {
    await updateFarmVariables({
      waterAccess,
      armazenamentoAgua: armazenamento,
      laborType,
      financialTier,
      objective,
    });
    setSavedMsg('Variáveis da fazenda atualizadas no modelo da propriedade.');
    speak('Variáveis da fazenda atualizadas com sucesso.', true);
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
        <Text style={[styles.title, { color: theme.text, fontSize: 17 * theme.scale }]}>
          Variáveis da Fazenda
        </Text>
        <Pressable
          onPress={() =>
            speak(
              en
                ? `Farm variables for ${activeFarm.nome}. Water access: ${waterAccess}. Labor: ${laborType}. Financing: ${financialTier}. Goal: ${objective}.`
                : `Variáveis da fazenda ${activeFarm.nome}. Acesso à água: ${waterAccess}. Trabalho: ${laborType}. Situação financeira: ${financialTier}. Objetivo: ${objective}.`,
              true
            )
          }
          style={[styles.backBtn, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
        >
          <Ionicons name="volume-high" size={18} color={theme.primary} />
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: green.border }]}>
        <FeatureBadge color="verde" />
        <Text style={{ fontSize: 12, color: theme.textMuted }}>
          Fonte: usuário • {activeFarm.nome} ({activeFarm.municipio} - {activeFarm.estado})
        </Text>

        <Text style={[styles.label, { color: theme.text }]}>Acesso à água:</Text>
        <View style={styles.chipWrap}>
          {(
            [
              { id: 'sequeiro', label: 'Sequeiro (chuva)' },
              { id: 'cisterna', label: 'Cisterna' },
              { id: 'acude', label: 'Açude / Barreiro' },
              { id: 'poco_artesiano', label: 'Poço artesiano' },
              { id: 'irrigacao', label: 'Irrigação' },
            ] as const
          ).map((opt) => (
            <Pressable
              key={opt.id}
              onPress={() => setWaterAccess(opt.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: waterAccess === opt.id ? theme.primary : theme.surfaceMuted,
                  borderColor: waterAccess === opt.id ? theme.primary : theme.border,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: waterAccess === opt.id ? theme.primaryText : theme.text,
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: theme.text }]}>Reserva de água:</Text>
        <View style={styles.chipWrap}>
          {(
            [
              { id: 'cisterna_placa', label: 'Cisterna de placa' },
              { id: 'barreiro', label: 'Barreiro / Tanque' },
              { id: 'caixa_dagua', label: "Caixa d'água" },
              { id: 'nenhum', label: 'Sem reservatório' },
            ] as const
          ).map((opt) => (
            <Pressable
              key={opt.id}
              onPress={() => setArmazenamento(opt.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: armazenamento === opt.id ? theme.primary : theme.surfaceMuted,
                  borderColor: armazenamento === opt.id ? theme.primary : theme.border,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: armazenamento === opt.id ? theme.primaryText : theme.text,
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: theme.text }]}>Força de trabalho:</Text>
        <View style={styles.chipWrap}>
          {(
            [
              { id: 'familiar', label: 'Familiar / enxada' },
              { id: 'mutirao_diarista', label: 'Mutirão / diarista' },
              { id: 'tracao_animal', label: 'Tração animal' },
              { id: 'maquinario', label: 'Trator / Maquinário' },
            ] as const
          ).map((opt) => (
            <Pressable
              key={opt.id}
              onPress={() => setLaborType(opt.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: laborType === opt.id ? theme.primary : theme.surfaceMuted,
                  borderColor: laborType === opt.id ? theme.primary : theme.border,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: laborType === opt.id ? theme.primaryText : theme.text,
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: theme.text }]}>Perfil financeiro:</Text>
        <View style={styles.chipWrap}>
          {(
            [
              { id: 'recursos_proprios', label: 'Recurso próprio' },
              { id: 'pronaf', label: 'PRONAF' },
              { id: 'programa_social', label: 'Garantia-Safra / PAA' },
              { id: 'emprestimo_local', label: 'Cooperativa' },
            ] as const
          ).map((opt) => (
            <Pressable
              key={opt.id}
              onPress={() => setFinancialTier(opt.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: financialTier === opt.id ? theme.primary : theme.surfaceMuted,
                  borderColor: financialTier === opt.id ? theme.primary : theme.border,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: financialTier === opt.id ? theme.primaryText : theme.text,
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: theme.text }]}>Objetivo da plantação:</Text>
        <View style={styles.chipWrap}>
          {(
            [
              { id: 'subsistencia', label: 'Comida da família' },
              { id: 'misto', label: 'Consumo + Feira' },
              { id: 'comercial', label: 'Venda comercial' },
            ] as const
          ).map((opt) => (
            <Pressable
              key={opt.id}
              onPress={() => setObjective(opt.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: objective === opt.id ? theme.primary : theme.surfaceMuted,
                  borderColor: objective === opt.id ? theme.primary : theme.border,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: objective === opt.id ? theme.primaryText : theme.text,
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={handleSave}
          style={[styles.saveBtn, { backgroundColor: theme.primary }]}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color={theme.primaryText} />
          <Text style={{ fontSize: 14, fontWeight: '900', color: theme.primaryText }}>
            Salvar variáveis da fazenda
          </Text>
        </Pressable>

        {savedMsg && (
          <Text style={{ fontSize: 12, fontWeight: '800', color: theme.successText }}>
            {savedMsg}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  backText: { fontSize: 13, fontWeight: '800' },
  title: { fontWeight: '900', textAlign: 'center', flex: 1 },
  card: {
    borderRadius: 18,
    borderWidth: 2,
    padding: 14,
    gap: 10,
  },
  label: { fontSize: 12, fontWeight: '900', marginTop: 2 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  saveBtn: {
    marginTop: 6,
    minHeight: 46,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
