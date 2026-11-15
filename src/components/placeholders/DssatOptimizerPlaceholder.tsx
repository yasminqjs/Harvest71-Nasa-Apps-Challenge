import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAccessibility } from '../../context/AccessibilityContext';
import { pickLang } from '../../i18n/locale';
import { FEATURE_COLOR_STYLES } from '../../models/farmArchitecture';
import { AppTheme } from '../../theme/tokens';
import { FarmArchitectureModel } from '../../types/domain';
import { FeatureBadge } from '../FeatureBadge';

/**
 * @featureColor GRAY (CINZA)
 * @featureModule DSSAT Forecast / Comparator / Optimizer
 * @userAction Find optimized rotation (Crop Tab)
 * @status PLACEHOLDER — Replace in future merge with optimization algorithm + DSSAT.
 */
export interface DssatOptimizerPlaceholderProps {
  farmArchitecture: FarmArchitectureModel;
  onBack?: () => void;
  theme: AppTheme;
}

export const DssatOptimizerPlaceholder: React.FC<DssatOptimizerPlaceholderProps> = ({
  farmArchitecture,
  onBack,
  theme,
}) => {
  const { language } = useAccessibility();
  const palette = FEATURE_COLOR_STYLES.cinza;
  const vars = farmArchitecture.variaveisDaFazenda;

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
            {pickLang(language, 'Rotation Optimizer (DSSAT)', 'Otimizador de Rotação (DSSAT)')}
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
        <FeatureBadge color="cinza" />
        <View style={styles.headerRow}>
          <Ionicons name="sparkles-outline" size={26} color={palette.text} />
          <Text style={[styles.cardTitle, { color: palette.text, fontSize: 16 * theme.scale }]}>
            {pickLang(language, 'Find optimized rotation', 'Encontrar rotação otimizada')}
          </Text>
        </View>
        <Text style={[styles.body, { color: palette.text }]}>
          {pickLang(
            language,
            'Gray feature placeholder (optimization algorithm + DSSAT crop-outcome forecast). Future merges will compute the best upcoming crop sequence considering farm constraints and local climate.',
            'Placeholder da feature Cinza (algoritmo de otimização + previsão de resultado no software DSSAT). Em merges futuros, este módulo calculará a melhor sequência de culturas futuras considerando restrições da fazenda e clima local.'
          )}
        </Text>

        <View style={[styles.slotBox, { backgroundColor: theme.surface, borderColor: palette.border }]}>
          <Text style={[styles.slotTitle, { color: theme.text }]}>
            {pickLang(
              language,
              'Farm variables ready for the optimizer:',
              'Variáveis da fazenda prontas para o otimizador:'
            )}
          </Text>
          <Text style={[styles.slotItem, { color: theme.textMuted }]}>
            {pickLang(language, '• Demarcated area: ', '• Área demarcada: ')}
            {vars.areaHectares.toFixed(2)} ha ({farmArchitecture.plantacoes.length}{' '}
            {pickLang(language, 'plantations', 'plantações')})
          </Text>
          <Text style={[styles.slotItem, { color: theme.textMuted }]}>
            {pickLang(language, '• Water access: ', '• Acesso à água: ')}
            {vars.waterAccess} • {pickLang(language, 'Labor: ', 'Trabalho: ')}
            {vars.laborType}
          </Text>
          <Text style={[styles.slotItem, { color: theme.textMuted }]}>
            {pickLang(language, '• Financial profile: ', '• Perfil financeiro: ')}
            {vars.financialTier} • {pickLang(language, 'Objective: ', 'Objetivo: ')}
            {vars.objective}
          </Text>
          <Text style={[styles.slotItem, { color: theme.textMuted }]}>
            {pickLang(
              language,
              '• Regional events considered: ',
              '• Acontecimentos da região considerados: '
            )}
            {farmArchitecture.acontecimentosDaRegiao.eventos.length}{' '}
            {pickLang(language, 'reports', 'relatos')}
          </Text>
        </View>

        <Text style={[styles.mergeNote, { color: palette.text }]}>
          {pickLang(
            language,
            'Target merge file: src/components/placeholders/DssatOptimizerPlaceholder.tsx',
            'Arquivo alvo para merge: src/components/placeholders/DssatOptimizerPlaceholder.tsx'
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
