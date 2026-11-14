import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';
import { getAppTheme } from '../theme/tokens';

export type MainTabKey = 'inicio' | 'mapa' | 'safra' | 'pancs';

interface BottomTabBarProps {
  activeTab: MainTabKey;
  onChangeTab: (tab: MainTabKey) => void;
}

const TABS: Array<{
  key: MainTabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'inicio', label: 'Início', icon: 'home' },
  { key: 'mapa', label: 'Mapa', icon: 'map' },
  { key: 'safra', label: 'Safra', icon: 'leaf' },
  { key: 'pancs', label: 'PANCs', icon: 'nutrition' },
];

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  onChangeTab,
}) => {
  const { accessibility, activeFarm } = useAccessibility();
  const theme = getAppTheme(accessibility);
  const droughtLevel = activeFarm?.diagnostico.modeloB.nivel ?? 'normal';
  const foodAlertActive =
    droughtLevel === 'alerta' || droughtLevel === 'seca_confirmada';

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: theme.surface, borderTopColor: theme.border },
      ]}
    >
      {TABS.map((t) => {
        const isActive = activeTab === t.key;
        const showBadge = t.key === 'pancs' && foodAlertActive;

        return (
          <Pressable
            key={t.key}
            onPress={() => onChangeTab(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            style={[
              styles.tabSquare,
              {
                backgroundColor: isActive ? theme.primary : theme.surfaceMuted,
                borderColor: isActive ? theme.primary : theme.border,
              },
            ]}
          >
            <View>
              <Ionicons
                name={t.icon}
                size={22}
                color={isActive ? theme.primaryText : theme.text}
              />
              {showBadge && <View style={styles.alertDot} />}
            </View>
            <Text
              style={[
                styles.tabLabel,
                {
                  color: isActive ? theme.primaryText : theme.text,
                  fontSize: 11 * theme.scale,
                },
              ]}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 2,
  },
  tabSquare: {
    flex: 1,
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontWeight: '800',
  },
  alertDot: {
    position: 'absolute',
    top: -2,
    right: -6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
});
