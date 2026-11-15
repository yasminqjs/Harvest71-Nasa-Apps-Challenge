import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../i18n/native';
import { FEATURE_COLOR_STYLES } from '../models/farmArchitecture';
import { FeatureColorCode } from '../types/domain';

interface FeatureBadgeProps {
  color: FeatureColorCode;
  customText?: string;
}

export const FeatureBadge: React.FC<FeatureBadgeProps> = ({ color, customText }) => {
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
        {customText ?? palette.codeLabel}
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
