import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Pressable, Text } from '../i18n/native';
import { useAccessibility } from '../context/AccessibilityContext';
import { getAppTheme } from '../theme/tokens';
import { useResponsiveLayout } from '../theme/responsive';
import type { MainTabKey } from './BottomTabBar';
import { LanguageMenu } from './LanguageMenu';

interface AppHeaderProps {
  activeTab?: MainTabKey;
  onChangeTab?: (tab: MainTabKey) => void;
  onOpenSettings: () => void;
  onOpenTutorial?: () => void;
}

const WEB_NAV_TABS: {
  key: MainTabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconInactive: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'resumo', label: 'Resumo', icon: 'sunny', iconInactive: 'sunny-outline' },
  { key: 'plantacao', label: 'Plantação', icon: 'leaf', iconInactive: 'leaf-outline' },
  { key: 'comunidade', label: 'Comunidade', icon: 'people', iconInactive: 'people-outline' },
  { key: 'metodologia', label: 'Metodologia', icon: 'git-network', iconInactive: 'git-network-outline' },
];

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeTab,
  onChangeTab,
  onOpenSettings,
  onOpenTutorial,
}) => {
  const { isTablet: isDesktopWeb, headerMaxWidth } = useResponsiveLayout();
  const {
    accessibility,
    activeFarmer,
    activeFarm,
    isOnline,
    pendingSyncCount,
    unreadAlertsCount,
    toggleVoiceGuidance,
  } = useAccessibility();
  const theme = getAppTheme(accessibility);
  const droughtLevel = activeFarm?.diagnostico.modeloB.nivel ?? 'normal';
  const foodAlertActive =
    droughtLevel === 'alerta' || droughtLevel === 'seca_confirmada';

  return (
    <View
      style={[
        styles.headerOuter,
        { backgroundColor: theme.surface, borderBottomColor: theme.border },
      ]}
    >
      <View style={[styles.header, isDesktopWeb && styles.headerWide, { maxWidth: headerMaxWidth }]}>
        <View style={[styles.leftGroup, isDesktopWeb && styles.leftGroupWide]}>
          <Image
            source={require('../../assets/harvest71-logo.png')}
            style={styles.brandLogo}
            resizeMode="contain"
            accessibilityLabel="Harvest71"
          />
          <Text
            style={[styles.appName, { color: theme.text, fontSize: 17 * theme.scale }]}
            numberOfLines={1}
          >
            Harvest71
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
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isOnline ? theme.successBorder : theme.warningBorder },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: isOnline ? theme.successText : theme.warningText },
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {isOnline
                ? pendingSyncCount > 0
                  ? `Sincronizando (${pendingSyncCount})`
                  : 'Sincronizado'
                : `Offline${pendingSyncCount > 0 ? ` (${pendingSyncCount})` : ''}`}
            </Text>
          </View>
        </View>

        {isDesktopWeb && activeTab && onChangeTab && (
          <View style={styles.topNav} accessibilityRole="tablist">
            {WEB_NAV_TABS.map((t) => {
              const isActive = activeTab === t.key;
              const showBadge = t.key === 'comunidade' && foodAlertActive;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => onChangeTab(t.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  style={[
                    styles.navPill,
                    {
                      backgroundColor: isActive ? theme.primary : theme.surfaceMuted,
                      borderColor: isActive ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <View>
                    <Ionicons
                      name={isActive ? t.icon : t.iconInactive}
                      size={17}
                      color={isActive ? theme.primaryText : theme.textMuted}
                    />
                    {showBadge && <View style={styles.navAlertDot} />}
                  </View>
                  <Text
                    style={[
                      styles.navPillText,
                      {
                        color: isActive ? theme.primaryText : theme.text,
                        fontSize: 13 * theme.scale,
                      },
                    ]}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

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
    </View>
  );
};

const styles = StyleSheet.create({
  headerOuter: {
    borderBottomWidth: 1,
    width: '100%',
  },
  header: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  headerWide: {
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  leftGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  leftGroupWide: {
    flex: 0,
    flexShrink: 1,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  navPillText: {
    fontWeight: '800',
  },
  navAlertDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  brandLogo: {
    width: 32,
    height: 32,
    flexShrink: 0,
  },
  appName: {
    fontWeight: '900',
    letterSpacing: -0.3,
    flexShrink: 0,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 99,
    borderWidth: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  statusText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  voiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
  },
  voiceBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  helpCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
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
