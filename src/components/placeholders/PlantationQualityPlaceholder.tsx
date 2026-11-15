import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAccessibility } from '../../context/AccessibilityContext';
import { pickLang } from '../../i18n/locale';
import { FEATURE_COLOR_STYLES } from '../../models/farmArchitecture';
import { AppTheme } from '../../theme/tokens';
import { FarmArchitectureModel, PlantationArchitectureModel } from '../../types/domain';
import { FeatureBadge } from '../FeatureBadge';

/**
 * @featureColor PURPLE (ROXO)
 * @featureModule Current Plantation Quality Viewer
 * @userAction View current plantation quality (Crop Tab)
 * @status PLACEHOLDER — Replace in future merge with live crop quality dashboard.
 */
export interface PlantationQualityPlaceholderProps {
  farmArchitecture: FarmArchitectureModel;
  selectedPlantation?: PlantationArchitectureModel;
  onBack?: () => void;
  theme: AppTheme;
}

export const PlantationQualityPlaceholder: React.FC<PlantationQualityPlaceholderProps> = ({
  farmArchitecture,
  selectedPlantation,
  onBack,
  theme,
}) => {
  const { language } = useAccessibility();
  const palette = FEATURE_COLOR_STYLES.roxo;
  const lot = selectedPlantation ?? farmArchitecture.plantacoes[0];

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
          <Text style={[styles.title, { color: theme.text, fontSize: 17 * theme.scale }]}>
            {pickLang(language, 'Current Plantation Quality', 'Qualidade da Plantação Atual')}
          </Text>
          <View style={{ width: 64 }} />
        </View>
      )}

      <View
        style={[
          styles.card,
          { backgroundColor: palette.bg, borderColor: palette.border },
        ]}
      >
        <FeatureBadge color="roxo" />
        <View style={styles.headerRow}>
          <Ionicons name="pulse-outline" size={26} color={palette.text} />
          <Text style={[styles.cardTitle, { color: palette.text, fontSize: 16 * theme.scale }]}>
            {pickLang(
              language,
              'View current plantation quality',
              'Ver qualidade da plantação atual'
            )}
          </Text>
        </View>
        <Text style={[styles.body, { color: palette.text }]}>
          {pickLang(
            language,
            'Purple feature placeholder (Current Plantation Quality Viewer). Future merges will populate vegetative health indicators, 30 m satellite vigor, and plot-level crop inspection here.',
            'Placeholder da feature Roxa (Visualizador de qualidade da plantação atual). Em merges futuros, este bloco receberá o painel completo de saúde vegetativa, vigor por satélite (30 m) e inspeção da cultura atual.'
          )}
        </Text>

        <View style={[styles.slotBox, { backgroundColor: theme.surface, borderColor: palette.border }]}>
          <Text style={[styles.slotTitle, { color: theme.text }]}>
            {pickLang(
              language,
              'Current data wired to the viewer:',
              'Dados atuais prontos para o visualizador:'
            )}
          </Text>
          <Text style={[styles.slotItem, { color: theme.textMuted }]}>
            {pickLang(language, '• Plot / Plantation: ', '• Talhão / Plantação: ')}
            {lot?.nome ?? pickLang(language, 'No plot selected', 'Nenhum lote selecionado')} (
            {lot?.areaHectares.toFixed(2) ?? '0.00'} ha)
          </Text>
          <Text style={[styles.slotItem, { color: theme.textMuted }]}>
            {pickLang(language, '• Current crop (user): ', '• Cultura atual (usuário): ')}
            {lot?.culturaAtual.culturaNome ?? '—'} (
            {lot?.culturaAtual.tempoPlantadaDias ?? 0}{' '}
            {pickLang(language, 'days planted', 'dias plantada')})
          </Text>
          <Text style={[styles.slotItem, { color: theme.textMuted }]}>
            {pickLang(language, '• FAO GAEZ EcoCrop spec: ', '• Especificação FAO GAEZ EcoCrop: ')}
            {lot?.culturaAtual.especificacoesCultura.observacaoEcoCrop ?? '—'}
          </Text>
          <Text style={[styles.slotItem, { color: theme.textMuted }]}>
            {pickLang(language, '• Spatial layer: ', '• Camada espacial: ')}
            {lot?.historicoDaTerra.variaveisDoSolo.fonte ?? 'Landsat C2 L2 TIRS 30 m'}
          </Text>
        </View>

        <Text style={[styles.mergeNote, { color: palette.text }]}>
          {pickLang(
            language,
            'Target merge file: src/components/placeholders/PlantationQualityPlaceholder.tsx',
            'Arquivo alvo para merge: src/components/placeholders/PlantationQualityPlaceholder.tsx'
          )}
        </Text>
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
    borderStyle: 'dashed',
    padding: 14,
    gap: 10,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { flex: 1, fontWeight: '900' },
  body: { fontSize: 12, lineHeight: 18, fontWeight: '600' },
  slotBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 4,
  },
  slotTitle: { fontSize: 12, fontWeight: '900', marginBottom: 2 },
  slotItem: { fontSize: 11, lineHeight: 16, fontWeight: '700' },
  mergeNote: { fontSize: 11, fontWeight: '900' },
});
