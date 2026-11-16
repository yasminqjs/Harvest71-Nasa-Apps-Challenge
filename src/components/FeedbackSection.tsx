import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLanguage } from '../i18n/Language';
import { Pressable, Text, TextInput } from '../i18n/native';
import { useAccessibility } from '../context/AccessibilityContext';
import { startVoiceCapture } from '../services/voiceAssistant';
import { getAppTheme } from '../theme/tokens';
import { AppFeedbackItem } from '../types/domain';

const CATEGORIES: {
  id: AppFeedbackItem['categoria'];
  label: string;
  labelEn: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: 'previsao', label: 'Previsão / Chuva', labelEn: 'Forecast / Rain', icon: 'rainy-outline' },
  { id: 'folha', label: 'Exame da Folha', labelEn: 'Leaf Scan', icon: 'camera-outline' },
  { id: 'mapa_pocos', label: 'Mapa e Poços', labelEn: 'Map & Wells', icon: 'map-outline' },
  { id: 'voz_clareza', label: 'Voz e Clareza', labelEn: 'Voice & Clarity', icon: 'volume-high-outline' },
  { id: 'sugestao', label: 'Sugestão / Erro', labelEn: 'Suggestion / Bug', icon: 'bulb-outline' },
];

export const FeedbackSection: React.FC = () => {
  const { accessibility, feedbacks, submitAppFeedback, speak } = useAccessibility();
  const { language } = useLanguage();
  const en = language === 'en';
  const theme = getAppTheme(accessibility);

  const [categoria, setCategoria] = useState<AppFeedbackItem['categoria']>('previsao');
  const [previsaoBateu, setPrevisaoBateu] = useState<'sim' | 'parcial' | 'nao'>('sim');
  const [nota, setNota] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [comentario, setComentario] = useState('');
  const [listening, setListening] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const commentInputRef = useRef<React.ComponentRef<typeof TextInput> | null>(null);

  const handleVoiceComment = () => {
    if (listening) {
      stopRef.current?.();
      stopRef.current = null;
      setListening(false);
      return;
    }

    setStatusMsg(null);
    setListening(true);
    stopRef.current = startVoiceCapture(
      (transcript) => {
        stopRef.current = null;
        setListening(false);
        setStatusMsg(null);
        setComentario((prev) => (prev ? `${prev} ${transcript}` : transcript));
      },
      (err) => {
        stopRef.current = null;
        setListening(false);
        setStatusMsg(err);
      },
      {
        onStatus: (msg) => {
          setStatusMsg(msg);
        },
        onEnd: () => {
          stopRef.current = null;
          setListening(false);
        },
        onExpoGoFallback: () => {
          setTimeout(() => commentInputRef.current?.focus(), 100);
        },
        unsupportedMessage: en
          ? 'In Expo Go, tap the keyboard microphone (🎤) to dictate your feedback.'
          : 'No Expo Go, toque no microfone (🎤) do teclado para ditar seu feedback.',
      }
    );
  };

  const handleSend = async () => {
    await submitAppFeedback({
      categoria,
      previsaoBateu,
      nota,
      comentario:
        comentario.trim() ||
        (en
          ? `Rating ${nota}/5 for ${categoria} (matched field: ${previsaoBateu})`
          : `Avaliação ${nota}/5 sobre ${categoria} (bateu com a roça: ${previsaoBateu})`),
    });
    setComentario('');
    setStatusMsg(
      en
        ? 'Thank you! Your feedback has been recorded.'
        : 'Obrigado! Sua opinião foi registrada com sucesso.'
    );
    speak(
      en
        ? 'Thank you! Your feedback was saved in the app.'
        : 'Obrigado! Sua opinião foi salva no aplicativo.'
    );
  };

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.title, { color: theme.text, fontSize: 17 * theme.scale }]}>
          💬 Sua Opinião sobre o Harvest71
        </Text>
        <Text style={{ fontSize: 12, color: theme.textMuted }}>
          Conte se as dicas e previsões funcionaram na sua roça. Funciona offline e envia quando conectar.
        </Text>

        <Text style={[styles.label, { color: theme.text }]}>
          1. A previsão/dica bateu com a realidade da sua terra?
        </Text>
        <View style={styles.rowGap}>
          {(
            [
              { id: 'sim', label: '👍 Bateu certo' },
              { id: 'parcial', label: '😐 Mais ou menos' },
              { id: 'nao', label: '👎 Não bateu' },
            ] as const
          ).map((opt) => {
            const active = previsaoBateu === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setPrevisaoBateu(opt.id)}
                style={[
                  styles.pillBtn,
                  {
                    backgroundColor: active ? theme.primary : theme.surfaceMuted,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '800',
                    color: active ? theme.primaryText : theme.text,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: theme.text }]}>
          2. Nota de facilidade do aplicativo:
        </Text>
        <View style={styles.starsRow}>
          {([1, 2, 3, 4, 5] as const).map((star) => (
            <Pressable
              key={star}
              onPress={() => setNota(star)}
              style={[
                styles.starBtn,
                {
                  backgroundColor: star <= nota ? theme.warningBg : theme.surfaceMuted,
                  borderColor: star <= nota ? theme.warningBorder : theme.border,
                },
              ]}
            >
              <Ionicons
                name={star <= nota ? 'star' : 'star-outline'}
                size={24}
                color={star <= nota ? '#D97706' : theme.textMuted}
              />
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: theme.text }]}>3. Assunto do comentário:</Text>
        <View style={styles.rowGap}>
          {CATEGORIES.map((cat) => {
            const active = categoria === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setCategoria(cat.id)}
                style={[
                  styles.catChip,
                  {
                    backgroundColor: active ? theme.primary : theme.surfaceMuted,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Ionicons
                  name={cat.icon}
                  size={15}
                  color={active ? theme.primaryText : theme.text}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '800',
                    color: active ? theme.primaryText : theme.text,
                  }}
                >
                  {en ? cat.labelEn : cat.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: theme.text }]}>
          4. Escreva ou fale o que achou (opcional):
        </Text>
        <View style={styles.commentRow}>
          <TextInput
            ref={commentInputRef}
            value={comentario}
            onChangeText={setComentario}
            placeholder="Ex.: Aviso de seca ajudou a plantar mandioca..."
            placeholderTextColor={theme.textMuted}
            multiline
            style={[
              styles.input,
              {
                backgroundColor: theme.bg,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
          />
          <Pressable
            onPress={handleVoiceComment}
            accessibilityLabel="Falar comentário pelo microfone"
            style={[
              styles.micBtn,
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
          </Pressable>
        </View>

        <Pressable
          onPress={handleSend}
          style={[styles.sendBtn, { backgroundColor: theme.primary }]}
        >
          <Ionicons name="send" size={18} color={theme.primaryText} />
          <Text style={{ color: theme.primaryText, fontWeight: '900', fontSize: 15 }}>
            Enviar Feedback
          </Text>
        </Pressable>

        {statusMsg && (
          <Text style={{ fontSize: 12, fontWeight: '800', color: theme.primary }}>
            ✓ {statusMsg}
          </Text>
        )}
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.title, { color: theme.text, fontSize: 15 * theme.scale }]}>
          📋 Feedbacks registrados ({feedbacks.length})
        </Text>
        {feedbacks.length === 0 ? (
          <Text style={{ fontSize: 12, color: theme.textMuted }}>
            Nenhuma opinião enviada ainda neste aparelho.
          </Text>
        ) : (
          feedbacks.slice(0, 8).map((fb) => (
            <View key={fb.id} style={[styles.historyItem, { backgroundColor: theme.bg }]}>
              <View style={styles.historyHeader}>
                <Text style={{ fontSize: 12, fontWeight: '900', color: theme.text }}>
                  {'★'.repeat(fb.nota)} ({fb.categoria})
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '800',
                    color: fb.sincronizado ? theme.successText : theme.warningText,
                  }}
                >
                  {fb.sincronizado ? '✓ Sincronizado' : '⏳ Offline na fila'}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: theme.text }}>{fb.comentario}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  card: {
    borderRadius: 20,
    borderWidth: 2,
    padding: 14,
    gap: 10,
  },
  title: {
    fontWeight: '900',
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  rowGap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillBtn: {
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  starBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  input: {
    flex: 1,
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  micBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: 16,
  },
  historyItem: {
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
