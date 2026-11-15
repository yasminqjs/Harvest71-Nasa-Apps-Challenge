import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';
import {
  VoiceReply,
  answerFarmerVoiceQuery,
  startVoiceCapture,
} from '../services/voiceAssistant';
import { getAppTheme } from '../theme/tokens';
import { pickLang } from '../i18n/locale';
import { localizeBiome } from '../data/seedData';

const getQuickVoiceQuestions = (lang: 'en' | 'pt') =>
  lang === 'en'
    ? [
        'Does my plot lack water?',
        'Can I plant now?',
        'Is there a drought risk?',
        'Where to drill a well?',
      ]
    : [
        'Falta água pra minha roça?',
        'Já posso plantar?',
        'Tem risco de seca?',
        'Onde furar poço?',
      ];

export const FoodSecurityScreen: React.FC = () => {
  const {
    accessibility,
    language,
    activeFarmer,
    activeFarm,
    compatiblePancs,
    speak,
    stopVoice,
  } = useAccessibility();

  const theme = getAppTheme(accessibility);
  const [questionText, setQuestionText] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceReply, setVoiceReply] = useState<VoiceReply | null>(null);
  const [micNote, setMicNote] = useState<string | null>(null);
  const questionInputRef = React.useRef<React.ComponentRef<typeof TextInput> | null>(null);
  const stopCaptureRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    return () => {
      stopCaptureRef.current?.();
      stopCaptureRef.current = null;
    };
  }, []);

  if (!activeFarm || !activeFarmer) return null;

  const droughtLevel = activeFarm.diagnostico.modeloB.nivel;
  const severeDrought =
    droughtLevel === 'alerta' || droughtLevel === 'seca_confirmada';

  const runVoiceQuestion = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setMicNote(
        pickLang(
          language,
          'Type or tap the microphone to ask your question.',
          'Digite ou toque no microfone para fazer sua pergunta.'
        )
      );
      return;
    }
    setMicNote(null);
    setQuestionText(trimmed);
    const reply = answerFarmerVoiceQuery(
      trimmed,
      activeFarm,
      activeFarmer,
      compatiblePancs,
      accessibility.languageLevel,
      language
    );
    setVoiceReply(reply);
    speak(reply.texto, true);
  };

  const handleToggleMic = () => {
    if (listening) {
      stopCaptureRef.current?.();
      stopCaptureRef.current = null;
      setListening(false);
      setMicNote(
        pickLang(
          language,
          'Listening stopped. Tap the microphone to speak again.',
          'Escuta encerrada. Toque no microfone para falar de novo.'
        )
      );
      return;
    }
    setMicNote(
      pickLang(
        language,
        '🎙️ Listening... Speak your question now.',
        '🎙️ Ouvindo... Fale sua pergunta agora.'
      )
    );
    setListening(true);
    stopCaptureRef.current = startVoiceCapture(
      (transcript) => {
        stopCaptureRef.current = null;
        setListening(false);
        setMicNote(null);
        runVoiceQuestion(transcript);
      },
      (err) => {
        stopCaptureRef.current = null;
        setListening(false);
        setMicNote(err);
      },
      {
        lang: language,
        onEnd: () => {
          stopCaptureRef.current = null;
          setListening(false);
        },
        onExpoGoFallback: () => {
          setTimeout(() => questionInputRef.current?.focus(), 100);
        },
        unsupportedMessage: pickLang(
          language,
          'In Expo Go, tap the keyboard microphone (🎤) to dictate your question.',
          'No Expo Go, toque no microfone (🎤) do teclado que abriu para ditar sua pergunta.'
        ),
      }
    );
  };

  const quickVoiceQuestions = getQuickVoiceQuestions(language);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={styles.container}
    >
      {/* Bidirectional & Localized Voice Assistant */}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.title, { color: theme.text, fontSize: 18 * theme.scale }]}>
          {pickLang(
            language,
            '🎤 Ask Out Loud (RoçaViva)',
            '🎤 Pergunte em Voz Alta (RoçaViva)'
          )}
        </Text>
        <Text style={{ fontSize: 12, color: theme.textMuted }}>
          {pickLang(
            language,
            'Speak or tap a question to hear the answer translated for everyday fieldwork:',
            'Fale ou toque em uma pergunta para ouvir a resposta traduzida para o dia a dia do campo:'
          )}
        </Text>

        <View style={styles.voiceInputRow}>
          <Pressable
            onPress={handleToggleMic}
            style={[
              styles.micBtn,
              {
                backgroundColor: listening ? '#DC2626' : theme.primary,
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons name="mic" size={24} color="#FFFFFF" />
          </Pressable>
          <TextInput
            ref={questionInputRef}
            value={questionText}
            onChangeText={setQuestionText}
            placeholder={pickLang(
              language,
              'E.g., Does my plot lack water?',
              'Ex.: Falta água pra minha roça?'
            )}
            placeholderTextColor={theme.textMuted}
            onSubmitEditing={() => runVoiceQuestion(questionText)}
            style={[
              styles.textInput,
              {
                backgroundColor: theme.bg,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
          />
          <Pressable
            onPress={() => runVoiceQuestion(questionText)}
            style={[styles.askBtn, { backgroundColor: theme.accent }]}
          >
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        {micNote && (
          <Text style={{ fontSize: 11, color: theme.warningText, fontWeight: '700' }}>
            {micNote}
          </Text>
        )}

        <View style={styles.quickChips}>
          {quickVoiceQuestions.map((q) => (
            <Pressable
              key={q}
              onPress={() => runVoiceQuestion(q)}
              style={[
                styles.quickChip,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
              ]}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: theme.text }}>
                🔊 {q}
              </Text>
            </Pressable>
          ))}
        </View>

        {voiceReply && (
          <View
            style={[
              styles.replyBox,
              { backgroundColor: theme.successBg, borderColor: theme.successBorder },
            ]}
          >
            <View style={styles.replyHeader}>
              <Text style={{ fontSize: 13, fontWeight: '900', color: theme.successText, flex: 1 }}>
                {voiceReply.titulo}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Pressable onPress={() => speak(voiceReply.texto, true)}>
                  <Ionicons name="volume-high" size={20} color={theme.successText} />
                </Pressable>
                <Pressable onPress={stopVoice}>
                  <Ionicons name="stop-circle-outline" size={20} color={theme.successText} />
                </Pressable>
              </View>
            </View>
            <Text style={{ fontSize: 13, color: theme.successText, lineHeight: 19 }}>
              {voiceReply.texto}
            </Text>
          </View>
        )}
      </View>

      {/* Food Security Detector (Wild Edibles + Resilient Crops Offline SQLite) */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: severeDrought ? theme.warningBg : theme.surface,
            borderColor: severeDrought ? theme.warningBorder : theme.border,
          },
        ]}
      >
        <Text style={[styles.title, { color: theme.text, fontSize: 18 * theme.scale }]}>
          {pickLang(
            language,
            '🌵 Food Security (Offline Wild Edibles)',
            '🌵 Segurança Alimentar (PANCs Offline)'
          )}
        </Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textMuted }}>
          {severeDrought
            ? pickLang(
                language,
                `⚠️ Drought detected! Recommended SQLite plants for ${localizeBiome(activeFarm.bioma, language)} (pH ${activeFarm.diagnostico.soloSoilGrids.ph}):`,
                `⚠️ Seca detectada! Plantas recomendadas no SQLite para ${localizeBiome(activeFarm.bioma, language)} (pH ${activeFarm.diagnostico.soloSoilGrids.ph}):`
              )
            : pickLang(
                language,
                `Offline catalog (MMA/INSA/Flora do Brasil) filtered for ${localizeBiome(activeFarm.bioma, language)} • Soil pH ${activeFarm.diagnostico.soloSoilGrids.ph}:`,
                `Catálogo offline (MMA/INSA/Flora do Brasil) filtrado para ${localizeBiome(activeFarm.bioma, language)} • Solo pH ${activeFarm.diagnostico.soloSoilGrids.ph}:`
              )}
        </Text>

        {compatiblePancs.map((plant) => (
          <View
            key={plant.id}
            style={[
              styles.plantCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.plantTop}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '900', color: theme.text }}>
                  {plant.isCulturaResiliente ? '🌾 ' : '🌿 '}
                  {plant.nomePopular}
                </Text>
                <Text style={{ fontSize: 11, fontStyle: 'italic', color: theme.textMuted }}>
                  {plant.nomeCientifico} •{' '}
                  {pickLang(
                    language,
                    `Fast harvest ~${plant.diasColheitaRapida} days`,
                    `Colheita rápida ~${plant.diasColheitaRapida} dias`
                  )}
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  speak(
                    pickLang(
                      language,
                      `${plant.nomePopular}. Edible part: ${plant.parteComestivel}. How to plant: ${plant.cultivoRapido} How to prepare: ${plant.preparoCulinario}`,
                      `${plant.nomePopular}. Parte de comer: ${plant.parteComestivel}. Como plantar: ${plant.cultivoRapido} Como preparar: ${plant.preparoCulinario}`
                    ),
                    true
                  )
                }
                style={[styles.speakPlantBtn, { backgroundColor: theme.primary }]}
              >
                <Ionicons name="volume-high" size={18} color={theme.primaryText} />
              </Pressable>
            </View>

            <Text style={{ fontSize: 12, color: theme.text, marginTop: 4 }}>
              <Text style={{ fontWeight: '800' }}>
                {pickLang(language, 'Edible part: ', 'Come-se: ')}
              </Text>
              {plant.parteComestivel}
            </Text>
            <Text style={{ fontSize: 12, color: theme.text, marginTop: 2 }}>
              <Text style={{ fontWeight: '800' }}>
                {pickLang(language, 'How to plant: ', 'Como plantar: ')}
              </Text>
              {plant.cultivoRapido}
            </Text>
            <Text style={{ fontSize: 12, color: theme.text, marginTop: 2 }}>
              <Text style={{ fontWeight: '800' }}>
                {pickLang(language, 'In the kitchen: ', 'Na cozinha: ')}
              </Text>
              {plant.preparoCulinario}
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: theme.primary, marginTop: 4 }}>
              {pickLang(language, 'Source: ', 'Base: ')}
              {plant.fonteValidacao}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 14,
    gap: 12,
    paddingBottom: 24,
  },
  card: {
    borderRadius: 22,
    borderWidth: 2,
    padding: 14,
    gap: 10,
  },
  title: {
    fontWeight: '900',
  },
  voiceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  micBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '700',
  },
  askBtn: {
    width: 48,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  replyBox: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    gap: 4,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  plantCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
  },
  plantTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  speakPlantBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
