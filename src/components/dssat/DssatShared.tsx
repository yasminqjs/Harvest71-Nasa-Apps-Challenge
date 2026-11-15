import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Pressable, Text } from '../../i18n/native';
import type { JobState } from '../../hooks/useDssatJob';
import type { AppTheme } from '../../theme/tokens';
import type { FarmProperty } from '../../types/domain';

export const DssatHeader: React.FC<{ theme: AppTheme; title: string; onBack: () => void }> = ({
  theme,
  title,
  onBack,
}) => (
  <View style={styles.topRow}>
    <Pressable
      onPress={onBack}
      accessibilityRole="button"
      accessibilityLabel="Voltar para os blocos da safra"
      style={[styles.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <Ionicons name="arrow-back" size={18} color={theme.text} />
      <Text style={[styles.backText, { color: theme.text }]}>Blocos</Text>
    </Pressable>
    <Text
      accessibilityRole="header"
      style={[styles.title, { color: theme.text, fontSize: 18 * theme.scale }]}
    >
      {title}
    </Text>
    <View style={{ width: 64 }} />
  </View>
);

export const Card: React.FC<{ theme: AppTheme; children: React.ReactNode; tone?: 'normal' | 'warning' | 'success' | 'danger' }> = ({
  theme,
  children,
  tone = 'normal',
}) => {
  const bg = tone === 'warning' ? theme.warningBg : tone === 'success' ? theme.successBg : tone === 'danger' ? theme.dangerBg : theme.surface;
  const border = tone === 'warning' ? theme.warningBorder : tone === 'success' ? theme.successBorder : tone === 'danger' ? theme.dangerBorder : theme.border;
  return <View style={[styles.card, { backgroundColor: bg, borderColor: border }]}>{children}</View>;
};

export const H: React.FC<{ theme: AppTheme; children: React.ReactNode }> = ({ theme, children }) => (
  <Text accessibilityRole="header" style={{ fontSize: 15 * theme.scale, fontWeight: '900', color: theme.text }}>
    {children}
  </Text>
);

export const P: React.FC<{ theme: AppTheme; children: React.ReactNode; muted?: boolean; bold?: boolean }> = ({
  theme,
  children,
  muted,
  bold,
}) => (
  <Text
    style={{
      fontSize: 13 * theme.scale,
      lineHeight: 19 * theme.scale,
      color: muted ? theme.textMuted : theme.text,
      fontWeight: bold ? '800' : '400',
    }}
  >
    {children}
  </Text>
);

export const Chip: React.FC<{
  theme: AppTheme;
  label: string;
  selected: boolean;
  onPress: () => void;
  warn?: boolean;
  disabled?: boolean;
}> = ({ theme, label, selected, onPress, warn, disabled }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="checkbox"
    accessibilityState={{ checked: selected, disabled }}
    accessibilityLabel={warn ? `${label}, sem par habilitado nesta seleção` : label}
    style={[
      styles.chip,
      {
        backgroundColor: selected ? theme.primary : theme.surface,
        borderColor: warn ? theme.warningBorder : selected ? theme.primary : theme.border,
        opacity: disabled ? 0.5 : 1,
      },
    ]}
  >
    {warn ? <Ionicons name="alert-circle" size={14} color={selected ? theme.primaryText : theme.warningText} /> : null}
    <Text style={{ fontSize: 13 * theme.scale, fontWeight: '800', color: selected ? theme.primaryText : theme.text }}>
      {label}
    </Text>
  </Pressable>
);

export const PrimaryButton: React.FC<{
  theme: AppTheme;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}> = ({ theme, label, onPress, disabled, icon }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityState={{ disabled }}
    style={[styles.primaryBtn, { backgroundColor: disabled ? theme.surfaceMuted : theme.primary }]}
  >
    {icon ? <Ionicons name={icon} size={18} color={disabled ? theme.textMuted : theme.primaryText} /> : null}
    <Text style={{ color: disabled ? theme.textMuted : theme.primaryText, fontWeight: '900', fontSize: 14 * theme.scale }}>
      {label}
    </Text>
  </Pressable>
);

/** Talhão e ponto que serão enviados (só lat/lon saem do aparelho). */
export const PointInfo: React.FC<{ theme: AppTheme; farm: FarmProperty }> = ({ theme, farm }) => (
  <Card theme={theme}>
    <View style={styles.row}>
      <Ionicons name="location-outline" size={18} color={theme.primary} />
      <P theme={theme} bold>
        {farm.nome} — {farm.municipio}/{farm.estado}
      </P>
    </View>
    <P theme={theme} muted>
      Ponto enviado ao simulador: centro do talhão ({farm.centroid.latitude.toFixed(4)},{' '}
      {farm.centroid.longitude.toFixed(4)}). Só as coordenadas e as escolhas desta tela saem do aparelho.
    </P>
  </Card>
);

/** Selo de origem: deixa claro que é DSSAT e não o diagnóstico local do app. */
export const SourceBadge: React.FC<{ theme: AppTheme; text?: string }> = ({ theme, text }) => (
  <View style={[styles.badge, { borderColor: theme.accent }]}>
    <Ionicons name="cloud-done-outline" size={14} color={theme.accent} />
    <Text style={{ fontSize: 11.5 * theme.scale, color: theme.accent, fontWeight: '800', flexShrink: 1 }}>
      {text ?? 'Resultado DSSAT (nuvem) • clima histórico NASA POWER • solo estimado PronaSolos'}
    </Text>
  </View>
);

const PHASE_TEXT: Record<string, string> = {
  submitting: 'Enviando o pedido…',
  queued: 'Pedido recebido. Na fila do simulador…',
  running: 'Simulando as safras no DSSAT…',
};

/** Estado do Job: andamento, erro com ação e opção de nova consulta. */
export const JobStatusBox: React.FC<{
  theme: AppTheme;
  state: JobState;
  onRetry: () => void;
  onReset: () => void;
  runningExtra?: string;
}> = ({ theme, state, onRetry, onReset, runningExtra }) => {
  if (state.phase === 'idle' || state.phase === 'done') return null;
  if (state.phase === 'error' || state.phase === 'failed') {
    return (
      <Card theme={theme} tone="danger">
        <View style={styles.row}>
          <Ionicons name="warning-outline" size={18} color={theme.dangerText} />
          <Text style={{ color: theme.dangerText, fontWeight: '900', fontSize: 14 * theme.scale }}>
            {state.phase === 'failed' ? 'A simulação não terminou' : 'Não foi possível concluir'}
          </Text>
        </View>
        <Text accessibilityLiveRegion="polite" style={{ color: theme.dangerText, fontSize: 13 * theme.scale }}>
          {state.error || 'Erro desconhecido.'}
        </Text>
        {state.errorFields?.length ? (
          <View style={{ gap: 2 }}>
            {state.errorFields.map((f, i) => (
              <Text key={i} style={{ color: theme.dangerText, fontSize: 12 * theme.scale }}>
                • {f.field ? `${f.field}: ` : ''}{f.message}
              </Text>
            ))}
          </View>
        ) : null}
        <View style={styles.row}>
          {state.job && state.phase === 'error' ? (
            <Pressable onPress={onRetry} accessibilityRole="button" style={[styles.smallBtn, { borderColor: theme.dangerBorder }]}>
              <Text style={{ color: theme.dangerText, fontWeight: '800' }}>Tentar de novo</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onReset} accessibilityRole="button" style={[styles.smallBtn, { borderColor: theme.dangerBorder }]}>
            <Text style={{ color: theme.dangerText, fontWeight: '800' }}>Voltar ao formulário</Text>
          </Pressable>
        </View>
      </Card>
    );
  }
  return (
    <Card theme={theme} tone="warning">
      <View style={styles.row}>
        <ActivityIndicator color={theme.warningText} />
        <Text accessibilityLiveRegion="polite" style={{ color: theme.warningText, fontWeight: '900', fontSize: 14 * theme.scale, flexShrink: 1 }}>
          {PHASE_TEXT[state.phase]}
        </Text>
      </View>
      <Text style={{ color: theme.warningText, fontSize: 12 * theme.scale }}>
        Leva em geral de 30 s a 2 min. Pode sair desta tela: ao voltar, o acompanhamento continua.
        {runningExtra ? ` ${runningExtra}` : ''}
      </Text>
      {state.job ? (
        <Text style={{ color: theme.warningText, fontSize: 11 * theme.scale }}>Pedido {state.job.id}</Text>
      ) : null}
      <Pressable onPress={onReset} accessibilityRole="button" style={[styles.smallBtn, { borderColor: theme.warningBorder }]}>
        <Text style={{ color: theme.warningText, fontWeight: '800' }}>Parar de acompanhar</Text>
      </Pressable>
    </Card>
  );
};

export const dssatStyles = StyleSheet.create({
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    minWidth: 110,
  },
});

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 12, borderWidth: 1.5,
  },
  backText: { fontSize: 13, fontWeight: '800' },
  title: { flex: 1, textAlign: 'center', fontWeight: '900' },
  card: { borderRadius: 18, borderWidth: 2, padding: 14, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1.5,
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14,
    paddingVertical: 13, paddingHorizontal: 16, minHeight: 48,
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 5, alignSelf: 'flex-start',
  },
  smallBtn: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, alignSelf: 'flex-start' },
});
