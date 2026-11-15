import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';
import { useLanguage } from '../i18n/Language';
import { Pressable, Text } from '../i18n/native';
import type { AppTheme } from '../theme/tokens';

interface VoiceReadBarProps {
  text: string;
  theme: AppTheme;
  label?: string;
}

/**
 * Compact bar for reading the current tab or subscreen aloud on tap.
 */
export const VoiceReadBar: React.FC<VoiceReadBarProps> = ({ text, theme, label }) => {
  const { speak, stopVoice } = useAccessibility();
  const { language } = useLanguage();
  const en = language === 'en';
  const readLabel = label ?? (en ? 'Read screen aloud' : 'Ouvir leitura desta aba');

  return (
    <View style={[styles.bar, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <Pressable
        onPress={() => speak(text, true)}
        accessibilityRole="button"
        accessibilityLabel={readLabel}
        style={[styles.readBtn, { backgroundColor: theme.surfaceMuted }]}
      >
        <Ionicons name="volume-high" size={16} color={theme.primary} />
        <Text
          style={{ fontSize: 12 * theme.scale, fontWeight: '800', color: theme.primary }}
          numberOfLines={1}
        >
          {readLabel}
        </Text>
      </Pressable>
      <Pressable
        onPress={stopVoice}
        accessibilityRole="button"
        accessibilityLabel={en ? 'Stop voice reading' : 'Parar leitura por voz'}
        style={[styles.stopBtn, { borderColor: theme.border, backgroundColor: theme.bg }]}
      >
        <Ionicons name="stop-circle-outline" size={15} color={theme.textMuted} />
        <Text style={{ fontSize: 11.5 * theme.scale, fontWeight: '800', color: theme.textMuted }}>
          {en ? 'Stop' : 'Parar'}
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    padding: 4,
  },
  readBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
});
