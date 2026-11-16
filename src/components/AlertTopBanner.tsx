import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLanguage } from '../i18n/Language';
import { Pressable, Text } from '../i18n/native';
import { translate } from '../i18n/translate';
import { useAccessibility } from '../context/AccessibilityContext';
import { getAppTheme } from '../theme/tokens';
import { useResponsiveLayout } from '../theme/responsive';
import { ProactiveAlertItem } from '../types/domain';

interface AlertTopBannerProps {
  onOpenAllAlerts: () => void;
}

const SEVERITY_PRIORITY: Record<ProactiveAlertItem['severidade'], number> = {
  urgente: 0,
  atencao: 1,
  info: 2,
};

export const AlertTopBanner: React.FC<AlertTopBannerProps> = ({
  onOpenAllAlerts,
}) => {
  const { accessibility, alerts, markAlertRead, speak } = useAccessibility();
  const { language } = useLanguage();
  const en = language === 'en';
  const theme = getAppTheme(accessibility);
  const { contentMaxWidth } = useResponsiveLayout();
  const [expanded, setExpanded] = useState(true);

  const pendingAlerts = useMemo(
    () =>
      alerts
        .filter((a) => !a.lido)
        .sort(
          (a, b) =>
            SEVERITY_PRIORITY[a.severidade] - SEVERITY_PRIORITY[b.severidade]
        ),
    [alerts]
  );

  if (pendingAlerts.length === 0) return null;

  const activeAlert = pendingAlerts[0];
  const isUrgent = activeAlert.severidade === 'urgente';
  const isAttention = activeAlert.severidade === 'atencao';

  const bg = isUrgent
    ? theme.dangerBg
    : isAttention
    ? theme.warningBg
    : theme.successBg;
  const borderColor = isUrgent
    ? theme.dangerBorder
    : isAttention
    ? theme.warningBorder
    : theme.successBorder;
  const textColor = isUrgent
    ? theme.dangerText
    : isAttention
    ? theme.warningText
    : theme.successText;

  const iconName: keyof typeof Ionicons.glyphMap = isUrgent
    ? 'warning'
    : isAttention
    ? 'alert-circle'
    : 'notifications';

  const severityLabel = isUrgent
    ? en
      ? 'URGENT ALERT'
      : 'ALERTA URGENTE'
    : isAttention
    ? en
      ? 'FIELD ATTENTION'
      : 'ATENÇÃO NA ROÇA'
    : en
    ? 'IMPORTANT NOTICE'
    : 'AVISO IMPORTANTE';

  const bodyMsg =
    accessibility.languageLevel === 'acessivel'
      ? activeAlert.mensagemAcessivel
      : activeAlert.mensagemTecnica;

  const handleConfirmAware = async () => {
    await markAlertRead(activeAlert.id);
    speak(
      en
        ? 'Alert confirmed. You acknowledged this situation.'
        : 'Alerta confirmado. Você registrou que está ciente da situação.'
    );
  };

  return (
    <View style={[styles.bannerOuter, { maxWidth: contentMaxWidth }]}>
      <View
        style={[
          styles.bannerWrap,
          {
            maxWidth: contentMaxWidth,
            backgroundColor: bg,
            borderColor: borderColor,
          },
        ]}
      >
      <Pressable
        onPress={() => setExpanded((e) => !e)}
        accessibilityRole="button"
        accessibilityLabel="Expandir ou recolher notificação de alerta"
        style={styles.topRow}
      >
        <View style={[styles.iconPill, { backgroundColor: borderColor }]}>
          <Ionicons name={iconName} size={18} color="#FFFFFF" />
        </View>

        <View style={styles.titleCol}>
          <View style={styles.badgeLine}>
            <Text style={[styles.severityTag, { color: textColor }]}>
              {severityLabel}
            </Text>
            {pendingAlerts.length > 1 && (
              <View style={[styles.countPill, { backgroundColor: borderColor }]}>
                <Text style={styles.countText}>
                  {en
                    ? `1 of ${pendingAlerts.length} pending`
                    : `1 de ${pendingAlerts.length} pendentes`}
                </Text>
              </View>
            )}
          </View>
          <Text
            style={[
              styles.alertTitle,
              { color: textColor, fontSize: 13 * theme.scale },
            ]}
            numberOfLines={expanded ? 2 : 1}
          >
            {activeAlert.titulo}
          </Text>
        </View>

        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={textColor}
        />
      </Pressable>

      {expanded && (
        <View style={styles.detailBox}>
          <Text
            style={[
              styles.alertMsg,
              { color: textColor, fontSize: 12.5 * theme.scale },
            ]}
          >
            {bodyMsg}
          </Text>

          <View style={styles.actionsRow}>
            <Pressable
              onPress={handleConfirmAware}
              style={[
                styles.confirmBtn,
                { backgroundColor: borderColor },
              ]}
            >
              <Ionicons name="checkmark-done-circle" size={18} color="#FFFFFF" />
              <Text style={styles.confirmBtnText}>
                Estou ciente da situação
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                speak(
                  en
                    ? `${translate(activeAlert.titulo, 'en')}. ${translate(bodyMsg, 'en')}`
                    : `${activeAlert.titulo}. ${bodyMsg}`,
                  true
                )
              }
              style={[
                styles.secondaryBtn,
                { backgroundColor: theme.surface, borderColor },
              ]}
            >
              <Ionicons name="volume-high" size={16} color={textColor} />
              <Text style={[styles.secondaryBtnText, { color: textColor }]}>
                Ouvir
              </Text>
            </Pressable>

            {pendingAlerts.length > 1 && (
              <Pressable
                onPress={onOpenAllAlerts}
                style={[
                  styles.secondaryBtn,
                  { backgroundColor: theme.surface, borderColor },
                ]}
              >
                <Text style={[styles.secondaryBtnText, { color: textColor }]}>
                  Ver todos
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bannerOuter: {
    width: '100%',
    maxWidth: 1184,
    alignSelf: 'center',
    paddingHorizontal: 12,
    marginTop: 8,
  },
  bannerWrap: {
    width: '100%',
    maxWidth: 1160,
    alignSelf: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconPill: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {
    flex: 1,
    gap: 1,
  },
  badgeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  severityTag: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  countPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 99,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
  },
  alertTitle: {
    fontWeight: '900',
  },
  detailBox: {
    gap: 8,
    paddingTop: 2,
  },
  alertMsg: {
    fontWeight: '600',
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  confirmBtn: {
    flex: 1,
    minWidth: 180,
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '900',
  },
  secondaryBtn: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 11,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  secondaryBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
