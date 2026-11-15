import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Pressable, Text, TextInput } from '../i18n/native';
import { useAccessibility } from '../context/AccessibilityContext';
import {
  VoiceReply,
  answerFarmerVoiceQuery,
  startVoiceCapture,
} from '../services/voiceAssistant';
import { getAppTheme } from '../theme/tokens';

const QUICK_VOICE_QUESTIONS = [
  'Falta água pra minha roça?',
  'Já posso plantar?',
  'Tem risco de seca?',
  'Onde furar poço?',
];

export const FoodSecurityScreen: React.FC = () => {
  const {
    accessibility,
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
      setMicNote('Digite ou toque no microfone para fazer sua pergunta.');
      return;
    }
    setMicNote(null);
    setQuestionText(trimmed);
    const reply = answerFarmerVoiceQuery(
      trimmed,
      activeFarm,
      activeFarmer,
      compatiblePancs,
      accessibility.languageLevel
    );
    setVoiceReply(reply);
    speak(reply.texto, true);
  };

  const handleToggleMic = () => {
    if (listening) {
      stopCaptureRef.current?.();
      stopCaptureRef.current = null;
      setListening(false);
      setMicNote('Escuta encerrada. Toque no microfone para falar de novo.');
      return;
    }
    setMicNote('🎙️ Ouvindo... Fale sua pergunta agora.');
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
        onEnd: () => {
          stopCaptureRef.current = null;
          setListening(false);
        },
        onExpoGoFallback: () => {
          setTimeout(() => questionInputRef.current?.focus(), 100);
        },
        unsupportedMessage:
          'No Expo Go, toque no microfone (🎤) do teclado que abriu para ditar sua pergunta.',
      }
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={styles.container}
    >
      {/* Assistente de Voz Bidirecional e Regionalizado */}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.title, { color: theme.text, fontSize: 18 * theme.scale }]}>
          🎤 Pergunte em Voz Alta (RoçaViva)
        </Text>
        <Text style={{ fontSize: 12, color: theme.textMuted }}>
          Fale ou toque em uma pergunta para ouvir a resposta traduzida para o dia a dia do campo:
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
            placeholder="Ex.: Falta água pra minha roça?"
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
          {QUICK_VOICE_QUESTIONS.map((q) => (
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

      {/* Detector de Segurança Alimentar (PANCs + Culturas Resilientes Offline SQLite) */}
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
          🌵 Segurança Alimentar (PANCs Offline)
        </Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textMuted }}>
          {severeDrought
            ? `⚠️ Seca detectada! Plantas recomendadas no SQLite para ${activeFarm.bioma} (pH ${activeFarm.diagnostico.soloSoilGrids.ph}):`
            : `Catálogo offline (MMA/INSA/Flora do Brasil) filtrado para ${activeFarm.bioma} • Solo pH ${activeFarm.diagnostico.soloSoilGrids.ph}:`}
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
                  {plant.nomeCientifico} • Colheita rápida ~{plant.diasColheitaRapida} dias
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  speak(
                    `${plant.nomePopular}. Parte de comer: ${plant.parteComestivel}. Como plantar: ${plant.cultivoRapido} Como preparar: ${plant.preparoCulinario}`,
                    true
                  )
                }
                style={[styles.speakPlantBtn, { backgroundColor: theme.primary }]}
              >
                <Ionicons name="volume-high" size={18} color={theme.primaryText} />
              </Pressable>
            </View>

            <Text style={{ fontSize: 12, color: theme.text, marginTop: 4 }}>
              <Text style={{ fontWeight: '800' }}>Come-se: </Text>
              {plant.parteComestivel}
            </Text>
            <Text style={{ fontSize: 12, color: theme.text, marginTop: 2 }}>
              <Text style={{ fontWeight: '800' }}>Como plantar: </Text>
              {plant.cultivoRapido}
            </Text>
            <Text style={{ fontSize: 12, color: theme.text, marginTop: 2 }}>
              <Text style={{ fontWeight: '800' }}>Na cozinha: </Text>
              {plant.preparoCulinario}
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: theme.primary, marginTop: 4 }}>
              Base: {plant.fonteValidacao}
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
