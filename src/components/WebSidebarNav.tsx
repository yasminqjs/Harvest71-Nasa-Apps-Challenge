import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';
import { useLanguage } from '../i18n/Language';
import { Pressable, Text } from '../i18n/native';
import { useResponsiveLayout } from '../theme/responsive';
import type { MainTabKey } from './BottomTabBar';

interface WebSidebarNavProps {
  activeTab: MainTabKey;
  onChangeTab: (tab: MainTabKey) => void;
  onOpenAlerts: () => void;
  onOpenSettings: () => void;
  onOpenTutorial?: () => void;
}

const SIDEBAR_ITEMS: {
  key: MainTabKey;
  labelEn: string;
  labelPt: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconInactive: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'resumo', labelEn: 'Dashboard', labelPt: 'Resumo', icon: 'grid', iconInactive: 'grid-outline' },
  { key: 'plantacao', labelEn: 'Crops & Satellites', labelPt: 'Plantação & Satélite', icon: 'leaf', iconInactive: 'leaf-outline' },
  { key: 'comunidade', labelEn: 'Community Alerts', labelPt: 'Comunidade', icon: 'people', iconInactive: 'people-outline' },
  { key: 'metodologia', labelEn: 'Data Methodology', labelPt: 'Metodologia', icon: 'git-network', iconInactive: 'git-network-outline' },
];

/**
 * Persistent left workspace navigation rail for desktop web viewports (`width >= 1024`),
 * framing Harvest71 as an agritech web platform rather than a mobile shell.
 */
export const WebSidebarNav: React.FC<WebSidebarNavProps> = ({
  activeTab,
  onChangeTab,
  onOpenAlerts,
  onOpenSettings,
  onOpenTutorial,
}) => {
  const { accessibility, activeFarm, isOnline, unreadAlertsCount } = useAccessibility();
  const { language } = useLanguage();
  const en = language === 'en';
  const { sidebarWidth } = useResponsiveLayout();
  const highContrast = accessibility.highContrast;

  const droughtLevel = activeFarm?.diagnostico.modeloB.nivel ?? 'normal';
  const foodAlertActive = droughtLevel === 'alerta' || droughtLevel === 'seca_confirmada';

  const bg = highContrast ? '#0D1117' : '#182820';
  const border = highContrast ? '#FFD60A' : '#263C31';
  const cardBg = highContrast ? '#161B22' : 'rgba(255,255,255,0.06)';
  const activeBg = highContrast ? '#FFD60A' : 'rgba(255,255,255,0.13)';
  const activeText = highContrast ? '#0D1117' : '#FFFFFF';
  const mutedText = highContrast ? '#E6EDF3' : '#A6BCB0';
  const accentColor = highContrast ? '#FFD60A' : '#6EE7B7';

  return (
    <View style={[styles.sidebar, { width: sidebarWidth || 216, backgroundColor: bg, borderRightColor: border }]}>
      {/* Brand header */}
      <View style={styles.brandBlock}>
        <View style={styles.logoTile}>
          <Image
            source={require('../../assets/harvest71-logo.png')}
            style={styles.logoImg}
            resizeMode="contain"
            accessibilityLabel="Harvest71"
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.brandName, { color: '#FFFFFF', fontSize: 16 * (accessibility.largeText ? 1.12 : 1) }]}>
            HARVEST 71
          </Text>
          <Text style={[styles.brandSub, { color: mutedText }]} numberOfLines={1}>
            {en ? 'Climate-Tech Web' : 'Plataforma Agro Web'}
          </Text>
        </View>
      </View>

      {/* Main section navigation */}
      <View style={styles.navSection}>
        <Text style={[styles.sectionEyebrow, { color: mutedText }]}>
          {en ? 'WORKSPACE' : 'ÁREA DE TRABALHO'}
        </Text>
        {SIDEBAR_ITEMS.map((item) => {
          const isActive = activeTab === item.key;
          const showDot = item.key === 'comunidade' && foodAlertActive;
          return (
            <Pressable
              key={item.key}
              onPress={() => onChangeTab(item.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              style={[
                styles.navItem,
                {
                  backgroundColor: isActive ? activeBg : 'transparent',
                  borderColor: isActive ? (highContrast ? '#FFD60A' : 'rgba(255,255,255,0.14)') : 'transparent',
                },
              ]}
            >
              {isActive && (
                <View style={[styles.activeBar, { backgroundColor: accentColor }]} />
              )}
              <Ionicons
                name={isActive ? item.icon : item.iconInactive}
                size={18}
                color={isActive ? activeText : mutedText}
              />
              <Text
                style={[
                  styles.navLabel,
                  {
                    color: isActive ? activeText : '#D8E5DD',
                    fontSize: 13 * (accessibility.largeText ? 1.08 : 1),
                  },
                ]}
                numberOfLines={1}
              >
                {en ? item.labelEn : item.labelPt}
              </Text>
              {showDot && <View style={styles.alertDot} />}
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      {/* Active farm status card */}
      {activeFarm && (
        <View style={[styles.farmCard, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={styles.farmTopRow}>
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: isOnline ? '#4ADE80' : '#FBBF24' },
              ]}
            />
            <Text style={[styles.farmStatusText, { color: accentColor }]}>
              {isOnline ? (en ? 'Status: Active' : 'Status: Ativo') : en ? 'Offline Mode' : 'Modo Offline'}
            </Text>
          </View>
          <Text style={styles.farmName} numberOfLines={1}>
            {activeFarm.nome}
          </Text>
          <Text style={[styles.farmLoc, { color: mutedText }]} numberOfLines={1}>
            {activeFarm.municipio} - {activeFarm.estado} • {activeFarm.areaHectares.toFixed(1)} ha
          </Text>
        </View>
      )}

      {/* Utility links */}
      <View style={[styles.utilitySection, { borderTopColor: border }]}>
        <Pressable onPress={onOpenAlerts} style={styles.utilBtn}>
          <Ionicons name="notifications-outline" size={17} color={mutedText} />
          <Text style={[styles.utilText, { color: '#D8E5DD' }]}>
            {en ? 'Alerts' : 'Alertas'}
          </Text>
          {unreadAlertsCount > 0 && (
            <View style={styles.unreadPill}>
              <Text style={styles.unreadText}>{unreadAlertsCount}</Text>
            </View>
          )}
        </Pressable>

        {onOpenTutorial && (
          <Pressable onPress={onOpenTutorial} style={styles.utilBtn}>
            <Ionicons name="help-circle-outline" size={17} color={mutedText} />
            <Text style={[styles.utilText, { color: '#D8E5DD' }]}>
              {en ? 'Platform Guide' : 'Guia de Uso'}
            </Text>
          </Pressable>
        )}

        <Pressable onPress={onOpenSettings} style={styles.utilBtn}>
          <Ionicons name="settings-outline" size={17} color={mutedText} />
          <Text style={[styles.utilText, { color: '#D8E5DD' }]}>
            {en ? 'Settings & Sources' : 'Ajustes e Fontes'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    flexShrink: 0,
    borderRightWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 14,
  },
  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  logoTile: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
    flexShrink: 0,
  },
  logoImg: {
    width: 32,
    height: 32,
  },
  brandName: {
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  brandSub: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  navSection: {
    gap: 5,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    position: 'relative',
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
  },
  navLabel: {
    flex: 1,
    fontWeight: '700',
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  farmCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 11,
    gap: 3,
  },
  farmTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusIndicator: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  farmStatusText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  farmName: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  farmLoc: {
    fontSize: 11,
    fontWeight: '600',
  },
  utilitySection: {
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 4,
  },
  utilBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
  },
  utilText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '700',
  },
  unreadPill: {
    backgroundColor: '#DC2626',
    borderRadius: 99,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
});
