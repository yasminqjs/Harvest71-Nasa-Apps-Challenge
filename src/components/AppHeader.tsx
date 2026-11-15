import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Pressable, Text } from '../i18n/native';
import { useAccessibility } from '../context/AccessibilityContext';
import { getAppTheme } from '../theme/tokens';
import { LanguageMenu } from './LanguageMenu';

interface AppHeaderProps {
  onOpenSettings: () => void;
  onOpenTutorial?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onOpenSettings,
  onOpenTutorial,
}) => {
  const {
    accessibility,
    activeFarmer,
    isOnline,
    pendingSyncCount,
    unreadAlertsCount,
    toggleVoiceGuidance,
  } = useAccessibility();
  const theme = getAppTheme(accessibility);

  return (
    <View
      style={[
        styles.header,
        { backgroundColor: theme.surface, borderBottomColor: theme.border },
      ]}
    >
      <View style={styles.leftGroup}>
        <Text style={[styles.appName, { color: theme.text, fontSize: 21 * theme.scale }]}>
          RoçaViva
        </Text>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: isOnline ? theme.successBg : theme.warningBg,
              borderColor: isOnline ? theme.successBorder : theme.warningBorder,
            },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: isOnline ? theme.successText : theme.warningText },
            ]}
          >
            {isOnline
              ? pendingSyncCount > 0
                ? `Sincronizando (${pendingSyncCount})`
                : 'Sincronizado'
              : `Modo Roça Offline${pendingSyncCount > 0 ? ` (${pendingSyncCount})` : ''}`}
          </Text>
        </View>
      </View>

      <View style={styles.rightGroup}>
        <Pressable
          onPress={toggleVoiceGuidance}
          accessibilityLabel={
            accessibility.voiceGuidanceEnabled
              ? 'Desativar guia por voz'
              : 'Ativar guia por voz'
          }
          style={[
            styles.voiceBtn,
            {
              backgroundColor: accessibility.voiceGuidanceEnabled
                ? theme.primary
                : theme.surfaceMuted,
              borderColor: theme.border,
            },
          ]}
        >
          <Ionicons
            name={accessibility.voiceGuidanceEnabled ? 'volume-high' : 'volume-mute'}
            size={17}
            color={accessibility.voiceGuidanceEnabled ? theme.primaryText : theme.text}
          />
          <Text
            style={[
              styles.voiceBtnText,
              {
                color: accessibility.voiceGuidanceEnabled ? theme.primaryText : theme.text,
              },
            ]}
          >
            {accessibility.voiceGuidanceEnabled ? 'Voz' : 'Mudo'}
          </Text>
        </Pressable>

        {onOpenTutorial && (
          <Pressable
            onPress={onOpenTutorial}
            accessibilityLabel="Abrir tutorial de uso"
            style={[
              styles.helpCircle,
              {
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons name="help" size={18} color={theme.text} />
          </Pressable>
        )}

        <LanguageMenu theme={theme} />
        <Pressable
          onPress={onOpenSettings}
          accessibilityLabel="Abrir perfil do usuário, alertas e configurações"
          style={[
            styles.userCircle,
            {
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
            },
          ]}
        >
          <Ionicons name="person" size={19} color={theme.text} />
          <Text style={[styles.userTinyLabel, { color: theme.textMuted }]} numberOfLines={1}>
            {accessibility.registrationCompleted &&
            activeFarmer?.tratamento &&
            activeFarmer.tratamento !== 'Agricultor(a)'
              ? activeFarmer.tratamento.split(' ')[0]
              : 'Perfil'}
          </Text>
          {unreadAlertsCount > 0 && (
            <View style={styles.alertBadge}>
              <Text style={styles.alertBadgeText}>{unreadAlertsCount}</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 2,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  appName: {
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 99,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  voiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
  },
  voiceBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  helpCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  userTinyLabel: {
    fontSize: 8,
    fontWeight: '800',
    marginTop: -1,
  },
  alertBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  alertBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
});
