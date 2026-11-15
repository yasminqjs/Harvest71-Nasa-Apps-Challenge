import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Pressable, Text } from '../../i18n/native';
import { FEATURE_COLOR_STYLES } from '../../models/farmArchitecture';
import { AppTheme } from '../../theme/tokens';
import { FarmArchitectureModel } from '../../types/domain';
import { FeatureBadge } from '../FeatureBadge';

/**
 * @featureColor CINZA
 * @featureModule Previsão / Comparador / Otimizador DSSAT
 * @userAction Encontrar rotação otimizada (Aba Plantação)
 * @status PLACEHOLDER — Substituir em merge futuro pelo algoritmo de otimização + DSSAT.
 *
 * Ponto de substituição no merge:
 * Este componente recebe `farmArchitecture` completa (`variaveisDaFazenda`,
 * `acontecimentosDaRegiao`, `plantacoes[].historicoDaTerra` e `culturaAtual`) e devolve
 * recomendações para `culturasFuturas` simuladas pelo software DSSAT.
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
            <Text style={[styles.backText, { color: theme.text }]}>Voltar</Text>
          </Pressable>
          <Text style={[styles.title, { color: theme.text, fontSize: 17 * theme.scale }]}>
            Otimizador de Rotação (DSSAT)
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
            Encontrar rotação otimizada
          </Text>
        </View>
        <Text style={[styles.body, { color: palette.text }]}>
          Placeholder da feature Cinza (algoritmo de otimização + previsão de resultado no
          software DSSAT). Em merges futuros, este módulo calculará a melhor sequência de culturas
          futuras considerando restrições da fazenda e clima local.
        </Text>

        <View style={[styles.slotBox, { backgroundColor: theme.surface, borderColor: palette.border }]}>
          <Text style={[styles.slotTitle, { color: theme.text }]}>
            Variáveis da fazenda prontas para o otimizador:
          </Text>
          <Text style={[styles.slotItem, { color: theme.textMuted }]}>
            • Área demarcada: {vars.areaHectares.toFixed(2)} ha ({farmArchitecture.plantacoes.length}{' '}
            plantações)
          </Text>
          <Text style={[styles.slotItem, { color: theme.textMuted }]}>
            • Acesso à água: {vars.waterAccess} • Trabalho: {vars.laborType}
          </Text>
          <Text style={[styles.slotItem, { color: theme.textMuted }]}>
            • Perfil financeiro: {vars.financialTier} • Objetivo: {vars.objective}
          </Text>
          <Text style={[styles.slotItem, { color: theme.textMuted }]}>
            • Acontecimentos da região considerados:{' '}
            {farmArchitecture.acontecimentosDaRegiao.eventos.length} relatos
          </Text>
        </View>

        <Text style={[styles.mergeNote, { color: palette.text }]}>
          Arquivo alvo para merge: src/components/placeholders/DssatOptimizerPlaceholder.tsx
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
