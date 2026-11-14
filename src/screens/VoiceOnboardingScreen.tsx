import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';
import { speakText } from '../services/voiceAssistant';
import { getAppTheme } from '../theme/tokens';

const ONBOARDING_SPEECH =
  'Olá! Bem-vindo ao RoçaViva. Gostaria que o aplicativo faça a leitura e ajude com comandos de voz?';

export const VoiceOnboardingScreen: React.FC = () => {
  const { accessibility, completeVoiceOnboarding } = useAccessibility();
  const theme = getAppTheme(accessibility);

  const playQuestion = () => {
    speakText(ONBOARDING_SPEECH, {
      enabled: true,
      rate: accessibility.speechRate,
      languageLevel: 'acessivel',
      force: true,
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      playQuestion();
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: theme.bg }]}
    >
      <View style={styles.brandBox}>
        <View style={[styles.logoCircle, { backgroundColor: theme.primary }]}>
          <Ionicons name="leaf" size={38} color={theme.primaryText} />
        </View>
        <Text style={[styles.appTitle, { color: theme.text, fontSize: 28 * theme.scale }]}>
          RoçaViva
        </Text>
        <Text style={[styles.subtitle, { color: theme.textMuted, fontSize: 14 * theme.scale }]}>
          Extensionista Rural Digital • Funciona sem internet
        </Text>
      </View>

      <View
        style={[
          styles.questionCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Ionicons name="volume-high" size={34} color={theme.primary} />
        <Text style={[styles.questionText, { color: theme.text, fontSize: 20 * theme.scale }]}>
          Gostaria que o aplicativo faça a leitura e ajude com comandos de voz?
        </Text>

        <Pressable
          onPress={playQuestion}
          style={[
            styles.repeatBtn,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}
        >
          <Ionicons name="refresh" size={20} color={theme.text} />
          <Text style={[styles.repeatText, { color: theme.text, fontSize: 15 * theme.scale }]}>
            Ouvir pergunta novamente
          </Text>
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => completeVoiceOnboarding(true)}
          style={[
            styles.choiceBtn,
            { backgroundColor: theme.primary, borderColor: theme.border },
          ]}
        >
          <Ionicons name="mic" size={26} color={theme.primaryText} />
          <View style={styles.choiceTextWrap}>
            <Text
              style={[
                styles.choiceTitle,
                { color: theme.primaryText, fontSize: 18 * theme.scale },
              ]}
            >
              Sim, ativar guia por voz
            </Text>
            <Text style={[styles.choiceSub, { color: theme.primaryText }]}>
              O app lê as telas, alertas e entende suas perguntas faladas
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => completeVoiceOnboarding(false)}
          style={[
            styles.choiceBtn,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Ionicons name="book-outline" size={26} color={theme.text} />
          <View style={styles.choiceTextWrap}>
            <Text
              style={[
                styles.choiceTitle,
                { color: theme.text, fontSize: 18 * theme.scale },
              ]}
            >
              Não, continuar apenas lendo
            </Text>
            <Text style={[styles.choiceSub, { color: theme.textMuted }]}>
              Você pode ligar ou desligar o som a qualquer hora no topo
            </Text>
          </View>
        </Pressable>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
    gap: 20,
  },
  brandBox: {
    alignItems: 'center',
    gap: 6,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: {
    fontWeight: '900',
  },
  subtitle: {
    textAlign: 'center',
    fontWeight: '600',
  },
  questionCard: {
    borderRadius: 22,
    borderWidth: 2,
    padding: 20,
    alignItems: 'center',
    gap: 14,
  },
  questionText: {
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 28,
  },
  repeatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 56,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1.5,
    width: '100%',
  },
  repeatText: {
    fontWeight: '700',
  },
  actions: {
    gap: 14,
  },
  choiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 74,
    padding: 16,
    borderRadius: 20,
    borderWidth: 2,
  },
  choiceTextWrap: {
    flex: 1,
  },
  choiceTitle: {
    fontWeight: '900',
  },
  choiceSub: {
    fontSize: 13,
    marginTop: 2,
    opacity: 0.9,
  },
});
