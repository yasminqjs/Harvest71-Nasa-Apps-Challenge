import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';
import { pickLang } from '../i18n/locale';
import { FEATURE_COLOR_STYLES } from '../models/farmArchitecture';
import { AppLanguage, FeatureColorCode } from '../types/domain';

interface FeatureBadgeProps {
  color: FeatureColorCode;
  customText?: string;
}

function getBadgeText(color: FeatureColorCode, lang: AppLanguage): string {
  switch (color) {
    case 'verde':
      return pickLang(
        lang,
        'GREEN • Farm Info Collector',
        'VERDE • Pegador de informações da fazenda'
      );
    case 'azul':
      return pickLang(
        lang,
        'BLUE • User Event Collector',
        'AZUL • Pegador de feedback de acontecimentos do usuário'
      );
    case 'salmao':
      return pickLang(
        lang,
        'SALMON • Local Event Notifier',
        'SALMÃO • Notificador de acontecimentos locais'
      );
    case 'cinza':
      return pickLang(
        lang,
        'GRAY [PLACEHOLDER] • DSSAT Forecast / Comparator / Optimizer',
        'CINZA [PLACEHOLDER] • Previsão / Comparador / Otimizador DSSAT'
      );
    case 'roxo':
      return pickLang(
        lang,
        'PURPLE [PLACEHOLDER] • Current Plantation Quality Viewer',
        'ROXO [PLACEHOLDER] • Visualizador de qualidade da plantação atual'
      );
    case 'amarelo':
      return pickLang(
        lang,
        'YELLOW • Local Info Viewer',
        'AMARELO • Visualizador de informações locais'
      );
  }
}

export const FeatureBadge: React.FC<FeatureBadgeProps> = ({ color, customText }) => {
  const { language } = useAccessibility();
  const palette = FEATURE_COLOR_STYLES[color];
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: palette.bg, borderColor: palette.border },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: palette.border }]} />
      <Text style={[styles.label, { color: palette.text }]} numberOfLines={1}>
        {customText ?? getBadgeText(color, language)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1.5,
    maxWidth: '100%',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    flexShrink: 1,
  },
});
