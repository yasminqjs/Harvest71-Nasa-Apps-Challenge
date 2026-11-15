import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppTheme } from '../theme/tokens';
import { AppLanguage, CommunityTopic, DroughtAlertLevel, FeatureColorCode } from '../types/domain';

export function isEn(lang?: AppLanguage): boolean {
  return lang !== 'pt';
}

export function pickLang<T>(lang: AppLanguage | undefined, en: T, pt: T): T {
  return lang === 'pt' ? pt : en;
}

export function formatAlertSeverity(level: DroughtAlertLevel | string, lang?: AppLanguage): string {
  switch (level) {
    case 'critico':
    case 'urgente':
    case 'seca_confirmada':
      return pickLang(lang, 'CRITICAL', 'CRÍTICO');
    case 'alto':
    case 'alerta':
      return pickLang(lang, 'HIGH ALERT', 'ALERTA ALTO');
    case 'atencao':
      return pickLang(lang, 'WATCH', 'ATENÇÃO');
    default:
      return pickLang(lang, 'NORMAL', 'NORMAL');
  }
}

export function formatSalinityRisk(
  risk: 'baixo' | 'moderado' | 'alto',
  lang?: AppLanguage
): string {
  switch (risk) {
    case 'alto':
      return pickLang(lang, 'high', 'alto');
    case 'moderado':
      return pickLang(lang, 'moderate', 'moderado');
    default:
      return pickLang(lang, 'low', 'baixo');
  }
}

export function formatPlantingStage(
  stage: 'preparo' | 'crescimento' | 'floracao' | 'colheita' | 'descanso',
  lang?: AppLanguage
): string {
  switch (stage) {
    case 'preparo':
      return pickLang(lang, 'Soil prep', 'Preparo');
    case 'crescimento':
      return pickLang(lang, 'Growing', 'Crescimento');
    case 'floracao':
      return pickLang(lang, 'Flowering', 'Floração');
    case 'colheita':
      return pickLang(lang, 'Harvest', 'Colheita');
    default:
      return pickLang(lang, 'Fallow / Rest', 'Descanso');
  }
}

export function formatCommunityTopicLabel(topic: CommunityTopic | string, lang?: AppLanguage): string {
  switch (topic) {
    case 'praga':
    case 'pragas':
      return pickLang(lang, 'Pests & Diseases', 'Pragas e Doenças');
    case 'mudanca_preco':
      return pickLang(lang, 'Price Change', 'Mudança de Preço');
    case 'desastre_natural':
      return pickLang(lang, 'Natural Disaster', 'Desastre Natural');
    default:
      return topic;
  }
}

export function formatFeatureColorLabel(color: FeatureColorCode, lang?: AppLanguage): string {
  switch (color) {
    case 'verde':
      return pickLang(lang, 'GREEN', 'VERDE');
    case 'azul':
      return pickLang(lang, 'BLUE', 'AZUL');
    case 'salmao':
      return pickLang(lang, 'SALMON', 'SALMÃO');
    case 'cinza':
      return pickLang(lang, 'GRAY', 'CINZA');
    case 'roxo':
      return pickLang(lang, 'PURPLE', 'ROXO');
    case 'amarelo':
      return pickLang(lang, 'YELLOW', 'AMARELO');
  }
}

interface LanguageTogglePillProps {
  language: AppLanguage;
  onSelect: (lang: AppLanguage) => void;
  theme?: AppTheme;
  compact?: boolean;
}

export const LanguageTogglePill: React.FC<LanguageTogglePillProps> = ({
  language,
  onSelect,
  theme,
  compact = false,
}) => {
  const activeBg = theme?.primary ?? '#1B6B40';
  const activeText = theme?.primaryText ?? '#FFFFFF';
  const surfaceBg = theme?.surfaceMuted ?? '#EAE6D9';
  const borderColor = theme?.border ?? '#6C6658';
  const mutedText = theme?.text ?? '#19221C';

  return (
    <View
      style={[
        styles.pillWrap,
        { backgroundColor: surfaceBg, borderColor },
        compact && styles.pillWrapCompact,
      ]}
      accessibilityRole="radiogroup"
      accessibilityLabel={pickLang(language, 'Language selector', 'Seletor de idioma')}
    >
      {(['en', 'pt'] as AppLanguage[]).map((code) => {
        const selected = language === code;
        return (
          <Pressable
            key={code}
            onPress={() => onSelect(code)}
            style={[
              styles.optionBtn,
              compact && styles.optionBtnCompact,
              selected && { backgroundColor: activeBg },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={
              code === 'en' ? 'English (Default)' : 'Português (Brasil)'
            }
          >
            <Text
              style={[
                styles.optionText,
                compact && styles.optionTextCompact,
                { color: selected ? activeText : mutedText },
              ]}
            >
              {code.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  pillWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 2,
    gap: 2,
  },
  pillWrapCompact: {
    borderRadius: 10,
    padding: 2,
  },
  optionBtn: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
    minHeight: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionBtnCompact: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    minHeight: 30,
  },
  optionText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  optionTextCompact: {
    fontSize: 11,
  },
});
