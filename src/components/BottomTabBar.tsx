import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Pressable, Text } from '../i18n/native';
import { useAccessibility } from '../context/AccessibilityContext';
import { getAppTheme } from '../theme/tokens';

export type MainTabKey = 'resumo' | 'plantacao' | 'comunidade';

interface BottomTabBarProps {
  activeTab: MainTabKey;
  onChangeTab: (tab: MainTabKey) => void;
}

const TABS: {
  key: MainTabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconInactive: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'resumo', label: 'Resumo', icon: 'sunny', iconInactive: 'sunny-outline' },
  { key: 'plantacao', label: 'Plantação', icon: 'leaf', iconInactive: 'leaf-outline' },
  { key: 'comunidade', label: 'Comunidade', icon: 'people', iconInactive: 'people-outline' },
];

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  onChangeTab,
}) => {
  const { width } = useWindowDimensions();
  const { accessibility, activeFarm } = useAccessibility();

  if (width >= 768) {
    return null;
  }

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
        const showBadge = t.key === 'comunidade' && foodAlertActive;

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
              isActive && styles.tabSquareActive,
            ]}
          >
            <View>
              <Ionicons
                name={isActive ? t.icon : t.iconInactive}
                size={22}
                color={isActive ? theme.primaryText : theme.textMuted}
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
    borderTopWidth: 1,
  },
  tabSquare: {
    flex: 1,
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabSquareActive: {
    shadowColor: '#166534',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
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
