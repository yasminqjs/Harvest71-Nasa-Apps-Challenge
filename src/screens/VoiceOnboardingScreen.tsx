import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Pressable, Text } from '../i18n/native';
import { useAccessibility } from '../context/AccessibilityContext';
import {
  interpretYesNoVoiceReply,
  speakText,
  startVoiceCapture,
  stopSpeaking,
} from '../services/voiceAssistant';
import { getAppTheme } from '../theme/tokens';

const ONBOARDING_SPEECH =
  'Olá! Bem-vindo ao RoçaViva. Gostaria que o aplicativo faça a leitura e ajude com comandos de voz? Pode dizer Sim ou Não.';

export const VoiceOnboardingScreen: React.FC = () => {
  const { accessibility, completeVoiceOnboarding } = useAccessibility();
  const theme = getAppTheme(accessibility);

  const [listening, setListening] = useState(false);
  const [heardText, setHeardText] = useState<string | null>(null);
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);

  const stopCaptureRef = useRef<(() => void) | null>(null);
  const listenDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const stopListening = () => {
    if (listenDelayRef.current) {
      clearTimeout(listenDelayRef.current);
      listenDelayRef.current = null;
    }
    if (stopCaptureRef.current) {
      stopCaptureRef.current();
      stopCaptureRef.current = null;
    }
    setListening(false);
  };

  const processTranscript = (transcript: string) => {
    const trimmed = transcript.trim();
    if (!trimmed) return;
    setHeardText(trimmed);

    const intent = interpretYesNoVoiceReply(trimmed);
    if (intent === 'sim') {
      setVoiceFeedback('Entendido: "Sim". Ativando guia por voz...');
      completeVoiceOnboarding(true);
      return;
    }
    if (intent === 'nao') {
      setVoiceFeedback('Entendido: "Não". Continuando apenas lendo...');
      completeVoiceOnboarding(false);
      return;
    }
    if (intent === 'repetir') {
      setVoiceFeedback('Repetindo a pergunta...');
      playQuestion(true);
      return;
    }

    setVoiceFeedback(
      'Não consegui identificar "Sim" ou "Não". Ouvindo novamente...'
    );
    speakText(
      'Não entendi bem. Diga Sim para ativar a leitura por voz, ou Não para continuar apenas lendo.',
      {
        enabled: true,
        rate: accessibility.speechRate,
        languageLevel: 'acessivel',
        force: true,
        onDone: () => {
          if (!mountedRef.current) return;
          listenDelayRef.current = setTimeout(() => {
            if (mountedRef.current) beginVoiceReply();
          }, 220);
        },
      }
    );
  };

  const beginVoiceReply = () => {
    if (listening) {
      stopListening();
      setVoiceFeedback('Microfone pausado. Toque para tentar de novo ou escolha um botão.');
      return;
    }

    stopSpeaking();
    setHeardText(null);
    setVoiceFeedback('Ouvindo... Fale "Sim" ou "Não" perto do microfone.');
    setListening(true);

    const stopFn = startVoiceCapture(
      (transcript) => {
        if (!mountedRef.current) return;
        stopCaptureRef.current = null;
        setListening(false);
        processTranscript(transcript);
      },
      (errMessage) => {
        if (!mountedRef.current) return;
        stopCaptureRef.current = null;
        setListening(false);
        setVoiceFeedback(errMessage);
      },
      {
        onEnd: () => {
          if (!mountedRef.current) return;
          stopCaptureRef.current = null;
          setListening(false);
        },
        unsupportedMessage:
          'O Expo Go não inclui reconhecimento de fala automático em segundo plano (requer Development Build / APK). Você pode tocar em "Sim" ou "Não" abaixo.',
      }
    );

    stopCaptureRef.current = stopFn;
  };

  const playQuestion = (listenAfter = true) => {
    stopListening();
    setVoiceFeedback(null);
    speakText(ONBOARDING_SPEECH, {
      enabled: true,
      rate: accessibility.speechRate,
      languageLevel: 'acessivel',
      force: true,
      onDone: listenAfter
        ? () => {
            if (!mountedRef.current) return;
            listenDelayRef.current = setTimeout(() => {
              if (mountedRef.current) beginVoiceReply();
            }, 220);
          }
        : undefined,
    });
  };

  const handleManualChoice = (enableVoice: boolean) => {
    stopListening();
    stopSpeaking();
    completeVoiceOnboarding(enableVoice);
  };

  useEffect(() => {
    mountedRef.current = true;
    const timer = setTimeout(() => {
      // Na Web os navegadores bloqueiam microfone automático sem clique do usuário;
      // no APK inicia a escuta logo após ler a pergunta.
      playQuestion(Platform.OS !== 'web');
    }, 350);
    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
      if (listenDelayRef.current) {
        clearTimeout(listenDelayRef.current);
        listenDelayRef.current = null;
      }
      if (stopCaptureRef.current) {
        stopCaptureRef.current();
        stopCaptureRef.current = null;
      }
    };
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
          onPress={beginVoiceReply}
          style={[
            styles.voiceReplyBtn,
            {
              backgroundColor: listening ? theme.dangerBg : theme.primary,
              borderColor: listening ? theme.dangerBorder : theme.border,
            },
          ]}
        >
          <Ionicons
            name={listening ? 'radio-button-on' : 'mic'}
            size={24}
            color={listening ? theme.dangerText : theme.primaryText}
          />
          <Text
            style={[
              styles.voiceReplyText,
              {
                color: listening ? theme.dangerText : theme.primaryText,
                fontSize: 16 * theme.scale,
              },
            ]}
          >
            {listening ? 'Ouvindo... Diga "Sim" ou "Não"' : 'Responder falando (Sim ou Não)'}
          </Text>
        </Pressable>

        {(heardText || voiceFeedback) && (
          <View
            style={[
              styles.feedbackBox,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}
          >
            {heardText && (
              <Text style={[styles.heardLabel, { color: theme.text, fontSize: 14 * theme.scale }]}>
                Você disse: &ldquo;{heardText}&rdquo;
              </Text>
            )}
            {voiceFeedback && (
              <Text
                style={[styles.feedbackText, { color: theme.textMuted, fontSize: 13 * theme.scale }]}
              >
                {voiceFeedback}
              </Text>
            )}
          </View>
        )}

        <Pressable
          onPress={() => playQuestion(true)}
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
          onPress={() => handleManualChoice(true)}
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
          onPress={() => handleManualChoice(false)}
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
  voiceReplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 2,
    width: '100%',
  },
  voiceReplyText: {
    fontWeight: '800',
    textAlign: 'center',
    flexShrink: 1,
  },
  feedbackBox: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    gap: 4,
  },
  heardLabel: {
    fontWeight: '800',
    textAlign: 'center',
  },
  feedbackText: {
    fontWeight: '600',
    textAlign: 'center',
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
