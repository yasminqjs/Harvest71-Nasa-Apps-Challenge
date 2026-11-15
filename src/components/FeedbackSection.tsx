import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';
import { pickLang } from '../i18n/locale';
import { startVoiceCapture } from '../services/voiceAssistant';
import { getAppTheme } from '../theme/tokens';
import { AppFeedbackItem } from '../types/domain';

const CATEGORIES: {
  id: AppFeedbackItem['categoria'];
  labelEn: string;
  labelPt: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: 'previsao', labelEn: 'Forecast / Rain', labelPt: 'Previsão / Chuva', icon: 'rainy-outline' },
  { id: 'folha', labelEn: 'Leaf Exam', labelPt: 'Exame da Folha', icon: 'camera-outline' },
  { id: 'mapa_pocos', labelEn: 'Map & Plots', labelPt: 'Mapa e Lotes', icon: 'map-outline' },
  { id: 'voz_clareza', labelEn: 'Voice & Clarity', labelPt: 'Voz e Clareza', icon: 'volume-high-outline' },
  { id: 'sugestao', labelEn: 'Suggestion / Bug', labelPt: 'Sugestão / Erro', icon: 'bulb-outline' },
];

export const FeedbackSection: React.FC = () => {
  const { language, accessibility, feedbacks, submitAppFeedback, speak } = useAccessibility();
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
        setComentario((prev) => (prev ? `${prev} ${transcript}` : transcript));
      },
      (err) => {
        stopRef.current = null;
        setListening(false);
        setStatusMsg(err);
      },
      {
        lang: language,
        onEnd: () => {
          stopRef.current = null;
          setListening(false);
        },
        onExpoGoFallback: () => {
          setTimeout(() => commentInputRef.current?.focus(), 100);
        },
        unsupportedMessage: pickLang(
          language,
          'In Expo Go, tap your keyboard microphone (🎤) to dictate feedback.',
          'No Expo Go, toque no microfone (🎤) do teclado para ditar seu feedback.'
        ),
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
        pickLang(
          language,
          `Rating ${nota}/5 for ${categoria} (matched farm reality: ${previsaoBateu})`,
          `Avaliação ${nota}/5 sobre ${categoria} (bateu com a roça: ${previsaoBateu})`
        ),
    });
    setComentario('');
    setStatusMsg(
      pickLang(
        language,
        'Thank you! Your feedback has been saved.',
        'Obrigado! Sua opinião foi registrada com sucesso.'
      )
    );
    speak(
      pickLang(
        language,
        'Thank you! Your feedback has been saved in the app.',
        'Obrigado! Sua opinião foi salva no aplicativo.'
      )
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
          {pickLang(language, '💬 Your Feedback on RoçaViva', '💬 Sua Opinião sobre o RoçaViva')}
        </Text>
        <Text style={{ fontSize: 12, color: theme.textMuted }}>
          {pickLang(
            language,
            'Tell us if the tips and forecasts worked on your farm. Works offline and syncs when connected.',
            'Conte se as dicas e previsões funcionaram na sua roça. Funciona offline e envia quando conectar.'
          )}
        </Text>

        <Text style={[styles.label, { color: theme.text }]}>
          {pickLang(
            language,
            '1. Did the forecast/tip match your farm reality?',
            '1. A previsão/dica bateu com a realidade da sua terra?'
          )}
        </Text>
        <View style={styles.rowGap}>
          {(
            [
              { id: 'sim', labelEn: '👍 Matched', labelPt: '👍 Bateu certo' },
              { id: 'parcial', labelEn: '😐 Partially', labelPt: '😐 Mais ou menos' },
              { id: 'nao', labelEn: '👎 Did not match', labelPt: '👎 Não bateu' },
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
                  {pickLang(language, opt.labelEn, opt.labelPt)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: theme.text }]}>
          {pickLang(
            language,
            '2. App ease-of-use rating:',
            '2. Nota de facilidade do aplicativo:'
          )}
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

        <Text style={[styles.label, { color: theme.text }]}>
          {pickLang(language, '3. Feedback topic:', '3. Assunto do comentário:')}
        </Text>
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
                  {pickLang(language, cat.labelEn, cat.labelPt)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: theme.text }]}>
          {pickLang(
            language,
            '4. Write or speak what you thought (optional):',
            '4. Escreva ou fale o que achou (opcional):'
          )}
        </Text>
        <View style={styles.commentRow}>
          <TextInput
            ref={commentInputRef}
            value={comentario}
            onChangeText={setComentario}
            placeholder={pickLang(
              language,
              'e.g., Drought warning helped us plant cassava...',
              'Ex.: Aviso de seca ajudou a plantar mandioca...'
            )}
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
            accessibilityLabel={pickLang(
              language,
              'Speak comment using microphone',
              'Falar comentário pelo microfone'
            )}
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
            {pickLang(language, 'Send Feedback', 'Enviar Feedback')}
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
          {pickLang(
            language,
            `📋 Saved feedback (${feedbacks.length})`,
            `📋 Feedbacks registrados (${feedbacks.length})`
          )}
        </Text>
        {feedbacks.length === 0 ? (
          <Text style={{ fontSize: 12, color: theme.textMuted }}>
            {pickLang(
              language,
              'No feedback submitted yet on this device.',
              'Nenhuma opinião enviada ainda neste aparelho.'
            )}
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
                  {fb.sincronizado
                    ? pickLang(language, '✓ Synced', '✓ Sincronizado')
                    : pickLang(language, '⏳ Queued offline', '⏳ Offline na fila')}
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
