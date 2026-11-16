import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useLanguage } from '../i18n/Language';
import { Pressable, Text } from '../i18n/native';
import { useAccessibility } from '../context/AccessibilityContext';
import {
  interpretYesNoVoiceReply,
  speakText,
  startVoiceCapture,
  stopSpeaking,
} from '../services/voiceAssistant';
import { getAppTheme } from '../theme/tokens';
import { useResponsiveLayout } from '../theme/responsive';

const ONBOARDING_SPEECH_PT =
  'Olá! Bem-vindo ao Harvest71. Gostaria que o aplicativo faça a leitura e ajude com comandos de voz? Pode dizer Sim ou Não.';
const ONBOARDING_SPEECH_EN =
  'Hello! Welcome to Harvest71. Would you like the app to read aloud and help with voice commands? You can say Yes or No.';

export const VoiceOnboardingScreen: React.FC = () => {
  const { accessibility, completeVoiceOnboarding } = useAccessibility();
  const { language } = useLanguage();
  const en = language === 'en';
  const theme = getAppTheme(accessibility);
  const { voiceMaxWidth, isTablet, isCompactHeight } = useResponsiveLayout();

  const [listening, setListening] = useState(false);
  const [heardText, setHeardText] = useState<string | null>(null);
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);

  const stopCaptureRef = useRef<(() => void) | null>(null);
  const listenDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handledCaptureRef = useRef(false);
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
    if (!trimmed || handledCaptureRef.current) return;
    setHeardText(trimmed);

    const intent = interpretYesNoVoiceReply(trimmed);
    if (intent === 'sim') {
      handledCaptureRef.current = true;
      setVoiceFeedback(
        en ? 'Understood: "Yes". Turning on voice guidance...' : 'Entendido: "Sim". Ativando guia por voz...'
      );
      completeVoiceOnboarding(true);
      return;
    }
    if (intent === 'nao') {
      handledCaptureRef.current = true;
      setVoiceFeedback(
        en ? 'Understood: "No". Continuing in reading mode...' : 'Entendido: "Não". Continuando apenas lendo...'
      );
      completeVoiceOnboarding(false);
      return;
    }
    if (intent === 'repetir') {
      handledCaptureRef.current = true;
      setVoiceFeedback(en ? 'Repeating the question...' : 'Repetindo a pergunta...');
      playQuestion(true);
      return;
    }

    handledCaptureRef.current = true;
    setVoiceFeedback(
      en
        ? 'Could not recognize "Yes" or "No". Listening again...'
        : 'Não consegui identificar "Sim" ou "Não". Ouvindo novamente...'
    );
    speakText(
      en
        ? 'I did not catch that. Say Yes to turn on voice reading, or No to keep reading silently.'
        : 'Não entendi bem. Diga Sim para ativar a leitura por voz, ou Não para continuar apenas lendo.',
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
      setVoiceFeedback(
        en
          ? 'Microphone paused. Tap to try again or choose an option below.'
          : 'Microfone pausado. Toque para tentar de novo ou escolha um botão.'
      );
      return;
    }

    stopSpeaking();
    handledCaptureRef.current = false;
    setHeardText(null);
    setVoiceFeedback(
      en
        ? 'Listening... Say "Yes" or "No" near your microphone.'
        : 'Ouvindo... Fale "Sim" ou "Não" perto do microfone.'
    );
    setListening(true);

    const stopFn = startVoiceCapture(
      (transcript) => {
        if (!mountedRef.current || handledCaptureRef.current) return;
        stopCaptureRef.current = null;
        setListening(false);
        processTranscript(transcript);
      },
      (errMessage) => {
        if (!mountedRef.current || handledCaptureRef.current) return;
        stopCaptureRef.current = null;
        setListening(false);
        setVoiceFeedback(errMessage);
      },
      {
        onInterim: (partial) => {
          if (!mountedRef.current || handledCaptureRef.current) return;
          setHeardText(partial);
          const quickIntent = interpretYesNoVoiceReply(partial);
          if (quickIntent === 'sim' || quickIntent === 'nao') {
            stopListening();
            processTranscript(partial);
          }
        },
        onStatus: (msg) => {
          if (!mountedRef.current || handledCaptureRef.current) return;
          setVoiceFeedback(msg);
        },
        onEnd: () => {
          if (!mountedRef.current) return;
          stopCaptureRef.current = null;
          setListening(false);
        },
        unsupportedMessage: en
          ? 'Automatic background speech recognition is unavailable here. Please tap "Yes" or "No" below.'
          : 'O reconhecimento de fala automático não está disponível neste ambiente. Você pode tocar em "Sim" ou "Não" abaixo.',
      }
    );

    stopCaptureRef.current = stopFn;
  };

  const playQuestion = (listenAfter = true) => {
    stopListening();
    setVoiceFeedback(null);
    speakText(en ? ONBOARDING_SPEECH_EN : ONBOARDING_SPEECH_PT, {
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
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={[
        styles.container,
        isCompactHeight && styles.containerCompact,
        { backgroundColor: theme.bg },
      ]}
    >
      <View
        style={[
          styles.innerWrap,
          { maxWidth: voiceMaxWidth },
          isCompactHeight && { gap: 12 },
        ]}
      >
      <View style={styles.brandBox}>
        <View style={[styles.eyebrowPill, { backgroundColor: theme.successBg, borderColor: theme.border }]}>
          <Text style={[styles.eyebrowText, { color: theme.primary }]}>
            {en ? 'SCIENCE-DRIVEN DIGITAL AGRONOMY' : 'AGRONOMIA DIGITAL BASEADA EM CIÊNCIA'}
          </Text>
        </View>
        <Image
          source={require('../../assets/harvest71-logo.png')}
          style={[
            styles.logoImage,
            isCompactHeight && { width: 78, height: 78 },
          ]}
          resizeMode="contain"
          accessibilityLabel="Harvest71"
        />
        <Text style={[styles.appTitle, { color: theme.text, fontSize: (isCompactHeight ? 24 : 28) * theme.scale }]}>
          Harvest71
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

      <View style={[styles.actions, isTablet && styles.actionsWide]}>
        <Pressable
          onPress={() => handleManualChoice(true)}
          style={[
            styles.choiceBtn,
            isTablet && styles.choiceBtnWide,
            { backgroundColor: theme.primary, borderColor: theme.primary },
          ]}
        >
          <View style={[styles.choiceIconCircle, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
            <Ionicons name="mic" size={24} color={theme.primaryText} />
          </View>
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
            isTablet && styles.choiceBtnWide,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={[styles.choiceIconCircle, { backgroundColor: theme.surfaceMuted }]}>
            <Ionicons name="book-outline" size={24} color={theme.text} />
          </View>
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
  containerCompact: {
    padding: 12,
    gap: 12,
  },
  innerWrap: {
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
    gap: 16,
  },
  brandBox: {
    alignItems: 'center',
    gap: 4,
  },
  eyebrowPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 4,
  },
  eyebrowText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  logoImage: {
    width: 104,
    height: 104,
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
    borderWidth: 1.5,
    padding: 20,
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
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
    gap: 12,
  },
  actionsWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  choiceBtnWide: {
    flex: 1,
  },
  choiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 74,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  choiceIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
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
