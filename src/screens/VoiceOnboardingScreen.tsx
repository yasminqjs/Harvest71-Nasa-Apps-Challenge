import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';
import { LanguageTogglePill, pickLang } from '../i18n/locale';
import {
  interpretYesNoVoiceReply,
  speakText,
  startVoiceCapture,
  stopSpeaking,
} from '../services/voiceAssistant';
import { getAppTheme } from '../theme/tokens';

export const VoiceOnboardingScreen: React.FC = () => {
  const { language, setAppLanguage, accessibility, completeVoiceOnboarding } =
    useAccessibility();
  const theme = getAppTheme(accessibility);

  const onboardingSpeech = pickLang(
    language,
    'Hello! Welcome to RoçaViva. Would you like the app to read screens aloud and assist you with voice commands? You can say Yes or No.',
    'Olá! Bem-vindo ao RoçaViva. Gostaria que o aplicativo faça a leitura e ajude com comandos de voz? Pode dizer Sim ou Não.'
  );

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
      setVoiceFeedback(
        pickLang(
          language,
          'Understood: “Yes”. Enabling voice guide...',
          'Entendido: “Sim”. Ativando guia por voz...'
        )
      );
      completeVoiceOnboarding(true);
      return;
    }
    if (intent === 'nao') {
      setVoiceFeedback(
        pickLang(
          language,
          'Understood: “No”. Continuing in reading mode...',
          'Entendido: “Não”. Continuando apenas lendo...'
        )
      );
      completeVoiceOnboarding(false);
      return;
    }
    if (intent === 'repetir') {
      setVoiceFeedback(
        pickLang(language, 'Repeating the question...', 'Repetindo a pergunta...')
      );
      playQuestion(true);
      return;
    }

    setVoiceFeedback(
      pickLang(
        language,
        'Could not recognize “Yes” or “No”. Listening again...',
        'Não consegui identificar “Sim” ou “Não”. Ouvindo novamente...'
      )
    );
    speakText(
      pickLang(
        language,
        'I did not quite catch that. Say Yes to enable voice reading, or No to continue in reading mode.',
        'Não entendi bem. Diga Sim para ativar a leitura por voz, ou Não para continuar apenas lendo.'
      ),
      {
        enabled: true,
        rate: accessibility.speechRate,
        languageLevel: 'acessivel',
        lang: language,
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
      setVoiceFeedback(
        pickLang(
          language,
          'Microphone paused. Tap to try again or choose a button.',
          'Microfone pausado. Toque para tentar de novo ou escolha um botão.'
        )
      );
      return;
    }

    stopSpeaking();
    setHeardText(null);
    setVoiceFeedback(
      pickLang(
        language,
        'Listening... Say “Yes” or “No” near the microphone.',
        'Ouvindo... Fale “Sim” ou “Não” perto do microfone.'
      )
    );
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
        lang: language,
        onEnd: () => {
          if (!mountedRef.current) return;
          stopCaptureRef.current = null;
          setListening(false);
        },
        unsupportedMessage: pickLang(
          language,
          'Expo Go does not include background speech recognition (requires a Development Build / APK). You can tap “Yes” or “No” below.',
          'O Expo Go não inclui reconhecimento de fala automático em segundo plano (requer Development Build / APK). Você pode tocar em “Sim” ou “Não” abaixo.'
        ),
      }
    );

    stopCaptureRef.current = stopFn;
  };

  const playQuestion = (listenAfter = true) => {
    stopListening();
    setVoiceFeedback(null);
    speakText(onboardingSpeech, {
      enabled: true,
      rate: accessibility.speechRate,
      languageLevel: 'acessivel',
      lang: language,
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
      // On Web browsers block auto microphone without user gesture;
      // on APK start listening right after reading the question.
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
      <View style={styles.langRow}>
        <LanguageTogglePill language={language} onSelect={setAppLanguage} theme={theme} />
      </View>

      <View style={styles.brandBox}>
        <View style={[styles.logoCircle, { backgroundColor: theme.primary }]}>
          <Ionicons name="leaf" size={38} color={theme.primaryText} />
        </View>
        <Text style={[styles.appTitle, { color: theme.text, fontSize: 28 * theme.scale }]}>
          RoçaViva
        </Text>
        <Text style={[styles.subtitle, { color: theme.textMuted, fontSize: 14 * theme.scale }]}>
          {pickLang(
            language,
            'Digital Rural Extension Agent • Works offline',
            'Extensionista Rural Digital • Funciona sem internet'
          )}
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
          {pickLang(
            language,
            'Would you like the app to read screens aloud and help with voice commands?',
            'Gostaria que o aplicativo faça a leitura e ajude com comandos de voz?'
          )}
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
            {listening
              ? pickLang(language, 'Listening... Say “Yes” or “No”', 'Ouvindo... Diga “Sim” ou “Não”')
              : pickLang(
                  language,
                  'Reply by speaking (Yes or No)',
                  'Responder falando (Sim ou Não)'
                )}
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
                {pickLang(language, 'You said:', 'Você disse:')} &ldquo;{heardText}&rdquo;
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
            {pickLang(language, 'Hear question again', 'Ouvir pergunta novamente')}
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
              {pickLang(language, 'Yes, enable voice guide', 'Sim, ativar guia por voz')}
            </Text>
            <Text style={[styles.choiceSub, { color: theme.primaryText }]}>
              {pickLang(
                language,
                'The app reads screens, alerts, and understands your spoken questions',
                'O app lê as telas, alertas e entende suas perguntas faladas'
              )}
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
              {pickLang(language, 'No, continue reading only', 'Não, continuar apenas lendo')}
            </Text>
            <Text style={[styles.choiceSub, { color: theme.textMuted }]}>
              {pickLang(
                language,
                'You can turn audio on or off anytime at the top',
                'Você pode ligar ou desligar o som a qualquer hora no topo'
              )}
            </Text>
          </View>
        </Pressable>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  langRow: {
    alignItems: 'flex-end',
  },
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
