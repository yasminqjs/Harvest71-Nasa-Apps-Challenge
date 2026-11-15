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
 * @featureColor GRAY (CINZA)
 * @featureModule DSSAT Forecast / Comparator / Optimizer
 * @userAction Compare current rotation with other rotations (Crop Tab)
 * @status PLACEHOLDER — Replace in a future merge with real DSSAT integration.
 */
export interface DssatComparatorPlaceholderProps {
  farmArchitecture: FarmArchitectureModel;
  selectedPlantation?: PlantationArchitectureModel;
  onBack?: () => void;
  theme: AppTheme;
}

export const DssatComparatorPlaceholder: React.FC<DssatComparatorPlaceholderProps> = ({
  farmArchitecture,
  selectedPlantation,
  onBack,
  theme,
}) => {
  const { language } = useAccessibility();
  const palette = FEATURE_COLOR_STYLES.cinza;
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
            {pickLang(language, 'Compare Rotations (DSSAT)', 'Comparar Rotações (DSSAT)')}
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
          <Ionicons name="git-compare-outline" size={26} color={palette.text} />
          <Text style={[styles.cardTitle, { color: palette.text, fontSize: 16 * theme.scale }]}>
            {pickLang(
              language,
              'Compare current rotation with alternative rotations',
              'Comparar rotação atual com outras rotações'
            )}
          </Text>
        </View>
        <Text style={[styles.body, { color: palette.text }]}>
          {pickLang(
            language,
            'Gray feature placeholder (DSSAT Forecast / Comparator / Optimizer). Future merges will replace this block to simulate and compare the current rotation against alternatives inside DSSAT.',
            'Placeholder da feature Cinza (Previsão / Comparador / Otimizador DSSAT). Em merges futuros, este módulo substituirá este bloco para simular e comparar a rotação atual com outras combinações no software DSSAT.'
          )}
        </Text>

        <View style={[styles.slotBox, { backgroundColor: theme.surface, borderColor: palette.border }]}>
          <Text style={[styles.slotTitle, { color: theme.text }]}>
            {pickLang(
              language,
              'Inputs already wired from Farm Data Architecture:',
              'Entradas já conectadas pela Modelagem da Fazenda:'
            )}
          </Text>
          <Text style={[styles.slotItem, { color: theme.textMuted }]}>
            {pickLang(language, '• Current crop (user): ', '• Cultura atual (usuário): ')}
            {lot?.culturaAtual.culturaNome ??
              pickLang(language, 'No crop registered', 'Nenhuma plantação cadastrada')}
          </Text>
          <Text style={[styles.slotItem, { color: theme.textMuted }]}>
            {pickLang(language, '• EcoCrop specs: ', '• Especificações EcoCrop: ')}
            {lot?.culturaAtual.especificacoesCultura.variedadeRegional ?? '—'} (Kc{' '}
            {lot?.culturaAtual.especificacoesCultura.kcMedio ?? '—'})
          </Text>
          <Text style={[styles.slotItem, { color: theme.textMuted }]}>
            {pickLang(language, '• Climate (NASA POWER): ', '• Clima (NASA POWER): ')}
            {lot?.historicoDaTerra.variaveisClimaticas.tempMaxC ?? '—'}°C max • ET₀{' '}
            {lot?.historicoDaTerra.variaveisClimaticas.et0PowerMm ?? '—'} mm
          </Text>
          <Text style={[styles.slotItem, { color: theme.textMuted }]}>
            {pickLang(
              language,
              '• Soil (SRTM + Landsat C2 L2 TIRS 30 m): slope ',
              '• Solo (SRTM + Landsat C2 L2 TIRS 30 m): declividade '
            )}
            {lot?.historicoDaTerra.variaveisDoSolo.declividadePct ?? '—'}% • pH{' '}
            {lot?.historicoDaTerra.variaveisDoSolo.phSolo ?? '—'}
          </Text>
          <Text style={[styles.slotItem, { color: theme.textMuted }]}>
            {pickLang(
              language,
              '• Planned future rotations: ',
              '• Rotações futuras planejadas: '
            )}
            {lot?.culturasFuturas.rotacaoPlanejada.join(', ') ||
              pickLang(language, 'TBD / DSSAT', 'A definir / DSSAT')}
          </Text>
        </View>

        <Text style={[styles.mergeNote, { color: palette.text }]}>
          {pickLang(
            language,
            'Target merge file: src/components/placeholders/DssatComparatorPlaceholder.tsx',
            'Arquivo alvo para merge: src/components/placeholders/DssatComparatorPlaceholder.tsx'
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
