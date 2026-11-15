import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useLanguage } from '../i18n/Language';
import { Pressable, Text } from '../i18n/native';
import type { getAppTheme } from '../theme/tokens';

export function LanguageMenu({ theme }: { theme: ReturnType<typeof getAppTheme> }) {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Trocar idioma" accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={[styles.button, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
        <Ionicons name="language-outline" size={19} color={theme.text} />
        <Text style={{ color: theme.text, fontSize: 10, fontWeight: '800' }}>{language.toUpperCase()}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.panel, { borderColor: theme.border, backgroundColor: theme.surface }]} accessibilityViewIsModal>
            <Text accessibilityRole="header" style={{ color: theme.text, fontSize: 20 * theme.scale, fontWeight: '800' }}>Idioma</Text>
            {(['en', 'pt'] as const).map((option) => (
              <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: language === option }}
                onPress={() => { setLanguage(option); setOpen(false); }} style={styles.option}>
                <Text style={{ color: theme.text, fontSize: 16 * theme.scale }}>
                  {option === 'en' ? 'English' : 'Português (Brasil)'}
                </Text>
                {language === option && <Ionicons name="checkmark" size={20} color={theme.primary} />}
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.option}>
              <Text style={{ color: theme.primary, fontWeight: '800' }}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { minWidth: 40, minHeight: 40, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0008' },
  panel: { width: '100%', maxWidth: 320, borderWidth: 1, borderRadius: 16, padding: 18 },
  option: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
