import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Pressable, Text } from '../../i18n/native';
import { FEATURE_COLOR_STYLES } from '../../models/farmArchitecture';
import { AppTheme } from '../../theme/tokens';
import { FarmArchitectureModel, PlantationArchitectureModel } from '../../types/domain';
import { FeatureBadge } from '../FeatureBadge';

/**
 * @featureColor CINZA
 * @featureModule Previsão / Comparador / Otimizador DSSAT
 * @userAction Comparar rotação atual com outras rotações (Aba Plantação)
 * @status PLACEHOLDER — Substituir em merge futuro pela integração real com DSSAT.
 *
 * Ponto de substituição no merge:
 * Renderize aqui o comparador que lê `farmArchitecture.plantacoes[i].culturaAtual`
 * (usuário + FAO GAEZ EcoCrop), `historicoDaTerra` (NASA POWER + SRTM/Landsat 30 m)
 * e `culturasFuturas` para comparar produtividade, água e risco entre rotações no DSSAT.
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
            <Text style={[styles.backText, { color: theme.text }]}>Voltar</Text>
          </Pressable>
          <Text style={[styles.title, { color: theme.text, fontSize: 17 * theme.scale }]}>
            Comparar Rotações (DSSAT)
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
            Comparar rotação atual com outras rotações
          </Text>
        </View>
        <Text style={[styles.body, { color: palette.text }]}>
          Placeholder da feature Cinza (Previsão / Comparador / Otimizador DSSAT). Em merges
          futuros, este módulo substituirá este bloco para simular e comparar a rotação atual com
          outras combinações no software DSSAT.
        </Text>

        <View style={[styles.slotBox, { backgroundColor: theme.surface, borderColor: palette.border }]}>
          <Text style={[styles.slotTitle, { color: theme.text }]}>
            Entradas já conectadas pela Modelagem da Fazenda:
          </Text>
          <Text style={[styles.slotItem, { color: theme.textMuted }]}>
            • Cultura atual (usuário): {lot?.culturaAtual.culturaNome ?? 'Nenhuma plantação cadastrada'}
          </Text>
          <Text style={[styles.slotItem, { color: theme.textMuted }]}>
            • Especificações EcoCrop: {lot?.culturaAtual.especificacoesCultura.variedadeRegional ?? '—'} (Kc{' '}
            {lot?.culturaAtual.especificacoesCultura.kcMedio ?? '—'})
          </Text>
          <Text style={[styles.slotItem, { color: theme.textMuted }]}>
            • Clima (NASA POWER): {lot?.historicoDaTerra.variaveisClimaticas.tempMaxC ?? '—'}°C máx •
            ET₀ {lot?.historicoDaTerra.variaveisClimaticas.et0PowerMm ?? '—'} mm
          </Text>
          <Text style={[styles.slotItem, { color: theme.textMuted }]}>
            • Solo (SRTM + Landsat C2 L2 TIRS 30 m): declividade{' '}
            {lot?.historicoDaTerra.variaveisDoSolo.declividadePct ?? '—'}% • pH{' '}
            {lot?.historicoDaTerra.variaveisDoSolo.phSolo ?? '—'}
          </Text>
          <Text style={[styles.slotItem, { color: theme.textMuted }]}>
            • Rotações futuras planejadas:{' '}
            {lot?.culturasFuturas.rotacaoPlanejada.join(', ') || 'A definir / DSSAT'}
          </Text>
        </View>

        <Text style={[styles.mergeNote, { color: palette.text }]}>
          Arquivo alvo para merge: src/components/placeholders/DssatComparatorPlaceholder.tsx
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
