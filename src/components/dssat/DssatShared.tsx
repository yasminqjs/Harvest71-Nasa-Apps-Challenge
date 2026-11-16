import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAccessibility } from '../../context/AccessibilityContext';
import { useLanguage } from '../../i18n/Language';
import { Pressable, Text } from '../../i18n/native';
import type { JobState } from '../../hooks/useDssatJob';
import type { AppTheme } from '../../theme/tokens';
import type { FarmProperty } from '../../types/domain';

export const DssatHeader: React.FC<{
  theme: AppTheme;
  title: string;
  onBack: () => void;
  speechText?: string;
}> = ({ theme, title, onBack, speechText }) => {
  const { speak, stopVoice } = useAccessibility();
  const { language } = useLanguage();
  const en = language === 'en';
  const toSpeak = speechText ?? title;

  return (
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
      <View style={styles.headerVoiceGroup}>
        <Pressable
          onPress={() => speak(toSpeak, true)}
          accessibilityRole="button"
          accessibilityLabel={en ? 'Read screen aloud' : 'Ouvir leitura desta tela'}
          style={[styles.headerVoiceBtn, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
        >
          <Ionicons name="volume-high" size={16} color={theme.primary} />
        </Pressable>
        <Pressable
          onPress={stopVoice}
          accessibilityRole="button"
          accessibilityLabel={en ? 'Stop reading' : 'Parar leitura'}
          style={[styles.headerVoiceBtn, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
        >
          <Ionicons name="stop-circle-outline" size={16} color={theme.textMuted} />
        </Pressable>
      </View>
    </View>
  );
};

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
  tone?: 'normal' | 'compatible' | 'incompatible';
}> = ({ theme, label, selected, onPress, warn, disabled, tone = 'normal' }) => {
  const { language } = useLanguage();
  const en = language === 'en';
  const isCompat = !selected && !warn && tone === 'compatible';
  const isIncompat = !selected && !warn && tone === 'incompatible';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={
        warn
          ? en
            ? `${label}, no enabled pair in this selection`
            : `${label}, sem par habilitado nesta seleção`
          : label
      }
      style={[
        styles.chip,
        {
          backgroundColor: selected
            ? theme.primary
            : isCompat
            ? theme.successBg
            : theme.surface,
          borderColor: warn
            ? theme.warningBorder
            : selected
            ? theme.primary
            : isCompat
            ? theme.successBorder
            : theme.border,
          borderStyle: isIncompat ? 'dashed' : 'solid',
          opacity: disabled ? 0.5 : isIncompat ? 0.55 : 1,
        },
      ]}
    >
      {warn ? (
        <Ionicons name="alert-circle" size={14} color={selected ? theme.primaryText : theme.warningText} />
      ) : isCompat ? (
        <Ionicons name="link-outline" size={13} color={theme.successText} />
      ) : null}
      <Text
        style={{
          fontSize: 12.5 * theme.scale,
          fontWeight: '800',
          color: selected ? theme.primaryText : isCompat ? theme.successText : theme.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
};

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

export const SectionDivider: React.FC<{ theme: AppTheme }> = ({ theme }) => (
  <View style={{ height: 1, backgroundColor: theme.border, opacity: 0.45, marginVertical: 4 }} />
);

export const ExpandableDetails: React.FC<{
  theme: AppTheme;
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ theme, label, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={{ gap: 6 }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={[
          styles.expandBtn,
          { borderColor: theme.border, backgroundColor: open ? theme.surfaceMuted : 'transparent' },
        ]}
      >
        <Ionicons
          name={open ? 'chevron-up-outline' : 'information-circle-outline'}
          size={15}
          color={theme.primary}
        />
        <Text style={{ fontSize: 12 * theme.scale, fontWeight: '800', color: theme.primary, flex: 1 }}>
          {label}
        </Text>
        <Ionicons name={open ? 'remove-outline' : 'add-outline'} size={15} color={theme.primary} />
      </Pressable>
      {open ? <View style={[styles.expandBody, { borderLeftColor: theme.primary }]}>{children}</View> : null}
    </View>
  );
};

/** Talhão e ponto que serão enviados (compacto na tela; coordenadas/privacidade expansíveis). */
export const PointInfo: React.FC<{ theme: AppTheme; farm: FarmProperty }> = ({ theme, farm }) => {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.compactStrip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.rowBetween}
      >
        <View style={[styles.row, { flex: 1 }]}>
          <Ionicons name="location-outline" size={16} color={theme.primary} />
          <P theme={theme} bold>
            {farm.nome} — {farm.municipio}/{farm.estado}
          </P>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'information-circle-outline'} size={16} color={theme.textMuted} />
      </Pressable>
      {open ? (
        <Text style={{ fontSize: 11.5 * theme.scale, color: theme.textMuted, lineHeight: 16 }}>
          {language === 'en'
            ? `Coordinates sent: ${farm.centroid.latitude.toFixed(4)}, ${farm.centroid.longitude.toFixed(4)}. Only coordinates and screen selections leave the device.`
            : `Ponto enviado ao simulador: centro do talhão (${farm.centroid.latitude.toFixed(4)}, ${farm.centroid.longitude.toFixed(4)}). Só as coordenadas e as escolhas desta tela saem do aparelho.`}
        </Text>
      ) : null}
    </View>
  );
};

/** Origin badge: clarifies results come from DSSAT rather than local app diagnosis. */
export const SourceBadge: React.FC<{ theme: AppTheme; text?: string }> = ({ theme, text }) => {
  const { language } = useLanguage();
  const en = language === 'en';
  return (
    <View style={[styles.badge, { borderColor: theme.accent }]}>
      <Ionicons name="cloud-done-outline" size={14} color={theme.accent} />
      <Text style={{ fontSize: 11.5 * theme.scale, color: theme.accent, fontWeight: '800', flexShrink: 1 }}>
        {text ??
          (en
            ? 'DSSAT output (cloud) • NASA POWER historical weather • PronaSolos soil estimate'
            : 'Resultado DSSAT (nuvem) • clima histórico NASA POWER • solo estimado PronaSolos')}
      </Text>
    </View>
  );
};

const PHASE_TEXT_PT: Record<string, string> = {
  submitting: 'Enviando o pedido…',
  queued: 'Pedido recebido. Na fila do simulador…',
  running: 'Simulando as safras no DSSAT…',
};

const PHASE_TEXT_EN: Record<string, string> = {
  submitting: 'Submitting request…',
  queued: 'Request received. Queued in simulator…',
  running: 'Simulating seasons in DSSAT…',
};

/** Estado do Job: andamento, erro com ação e opção de nova consulta. */
export const JobStatusBox: React.FC<{
  theme: AppTheme;
  state: JobState;
  onRetry: () => void;
  onReset: () => void;
  runningExtra?: string;
}> = ({ theme, state, onRetry, onReset, runningExtra }) => {
  const { language } = useLanguage();
  const en = language === 'en';
  if (state.phase === 'idle' || state.phase === 'done') return null;
  if (state.phase === 'error' || state.phase === 'failed') {
    return (
      <Card theme={theme} tone="danger">
        <View style={styles.row}>
          <Ionicons name="warning-outline" size={18} color={theme.dangerText} />
          <Text style={{ color: theme.dangerText, fontWeight: '900', fontSize: 14 * theme.scale }}>
            {state.phase === 'failed'
              ? en
                ? 'Simulation did not finish'
                : 'A simulação não terminou'
              : en
              ? 'Could not complete request'
              : 'Não foi possível concluir'}
          </Text>
        </View>
        <Text accessibilityLiveRegion="polite" style={{ color: theme.dangerText, fontSize: 13 * theme.scale }}>
          {state.error || (en ? 'Unknown error.' : 'Erro desconhecido.')}
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
              <Text style={{ color: theme.dangerText, fontWeight: '800' }}>
                {en ? 'Try again' : 'Tentar de novo'}
              </Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onReset} accessibilityRole="button" style={[styles.smallBtn, { borderColor: theme.dangerBorder }]}>
            <Text style={{ color: theme.dangerText, fontWeight: '800' }}>
              {en ? 'Back to form' : 'Voltar ao formulário'}
            </Text>
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
          {(en ? PHASE_TEXT_EN : PHASE_TEXT_PT)[state.phase]}
        </Text>
      </View>
      <Text style={{ color: theme.warningText, fontSize: 12 * theme.scale }}>
        {en
          ? 'Usually takes 30s to 2 min. You can leave this screen and tracking continues when you return.'
          : 'Leva em geral de 30 s a 2 min. Pode sair desta tela: ao voltar, o acompanhamento continua.'}
        {runningExtra ? ` ${runningExtra}` : ''}
      </Text>
      {state.job ? (
        <Text style={{ color: theme.warningText, fontSize: 11 * theme.scale }}>
          {en ? `Job ${state.job.id}` : `Pedido ${state.job.id}`}
        </Text>
      ) : null}
      <Pressable onPress={onReset} accessibilityRole="button" style={[styles.smallBtn, { borderColor: theme.warningBorder }]}>
        <Text style={{ color: theme.warningText, fontWeight: '800' }}>
          {en ? 'Stop tracking' : 'Parar de acompanhar'}
        </Text>
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
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7,
    borderRadius: 12, borderWidth: 1,
  },
  backText: { fontSize: 13, fontWeight: '800' },
  title: { flex: 1, textAlign: 'center', fontWeight: '900' },
  headerVoiceGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerVoiceBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 7,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  compactStrip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1,
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 16, minHeight: 48,
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start',
  },
  smallBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7, alignSelf: 'flex-start' },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  expandBody: {
    borderLeftWidth: 2,
    paddingLeft: 10,
    gap: 5,
  },
});
