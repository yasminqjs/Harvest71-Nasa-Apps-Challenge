import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';
import { getAppTheme } from '../theme/tokens';

interface TutorialStep {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  bullets: string[];
  voiceText: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    icon: 'home',
    title: '1. Tela Início: Sua roça em 3 cartões',
    subtitle: 'Resumo diário traduzido sem termos difíceis',
    bullets: [
      'Clima do dia: mostra calor, chuva e se a terra está perdendo água.',
      'Previsão trimestre: a carinha muda de cor se houver risco de seca.',
      'Validação de campo: registre chuva, umidade da terra, pragas ou enxurrada sem precisar de internet.',
    ],
    voiceText:
      'Passo 1 do tutorial. Na tela Início, você vê o clima do dia, a previsão do trimestre e o andamento da colheita. Abaixo, pode registrar o que vê na roça mesmo sem internet.',
  },
  {
    icon: 'map',
    title: '2. Aba Mapa: Demarcar roça e Poços',
    subtitle: 'Desenho fino no mapa ou caminhando pelo perímetro',
    bullets: [
      'Toque nos cantos da sua roça ou ative Caminhar com GPS para medir hectares e tarefas.',
      'Veja os poços da região (SIAGAS) com profundidade média, chance de água e salinidade.',
      'Use o seletor de raio (1 a 30 km) para ajustar a busca ao redor da sua terra.',
    ],
    voiceText:
      'Passo 2 do tutorial. Na aba Mapa, demarque sua roça tocando na tela ou caminhando com o GPS sem internet, e veja os poços mais próximos.',
  },
  {
    icon: 'camera',
    title: '3. Aba Safra: Quando plantar & Folha',
    subtitle: 'Janela segura de plantio e câmera offline',
    bullets: [
      'Descubra se já pode plantar ou se há risco de veranico (falso início de chuva).',
      'Tire foto de uma folha para identificar folha saudável, seca, amarelada ou com manchas pretas.',
      'Gere resumo pronto para WhatsApp ou crédito PRONAF em 1 toque.',
    ],
    voiceText:
      'Passo 3 do tutorial. Na aba Safra, confira se já é hora de plantar, fotografe folhas com a câmera offline e gere seu resumo para o PRONAF.',
  },
  {
    icon: 'mic',
    title: '4. Aba Comida & Voz: Pergunte falando',
    subtitle: 'Plantas resistentes (PANCs) e assistente em áudio',
    bullets: [
      'Toque no microfone e pergunte com suas palavras: "Falta água?", "Já posso plantar?", "Onde furar poço?".',
      'Consulte plantas nativas e comestíveis indicadas para o solo e clima da sua terra.',
      'No topo da tela, ligue ou desligue a leitura em voz alta quando quiser.',
    ],
    voiceText:
      'Passo 4 do tutorial. Na aba Comida e Voz, pergunte falando no microfone e veja plantas resistentes que garantem o alimento da família mesmo na seca.',
  },
  {
    icon: 'chatbox-ellipses',
    title: '5. Sua opinião melhora o RoçaViva',
    subtitle: 'Sistema de feedback offline + perfil compartilhado',
    bullets: [
      'Avalie se a previsão bateu com a chuva ou seca na sua propriedade.',
      'Envie comentários escritos ou falados pelo microfone — fica salvo no celular até conectar.',
      'No ícone de usuário no topo, você também troca de agricultor no mesmo aparelho e ajusta letras grandes ou alto contraste.',
    ],
    voiceText:
      'Passo 5 do tutorial. Você pode enviar sua opinião dizendo se a previsão funcionou na roça. Tudo funciona offline e sincroniza quando tiver sinal. Bom trabalho!',
  },
];

interface AppTutorialModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AppTutorialModal: React.FC<AppTutorialModalProps> = ({
  visible,
  onClose,
}) => {
  const { accessibility, speak, stopVoice } = useAccessibility();
  const theme = getAppTheme(accessibility);
  const [stepIndex, setStepIndex] = useState(0);

  const current = TUTORIAL_STEPS[stepIndex];
  const isLast = stepIndex === TUTORIAL_STEPS.length - 1;

  useEffect(() => {
    if (!visible) {
      stopVoice();
    }
  }, [visible, stopVoice]);

  useEffect(() => {
    if (visible && accessibility.voiceGuidanceEnabled) {
      speak(TUTORIAL_STEPS[stepIndex].voiceText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, stepIndex]);

  const handleClose = () => {
    stopVoice();
    setStepIndex(0);
    onClose();
  };

  if (!visible) return null;

  return (
    <View style={[styles.overlayRoot, { backgroundColor: theme.bg }]}>
      <View style={[styles.root, { backgroundColor: theme.bg }]}>
        <View
          style={[
            styles.header,
            { backgroundColor: theme.surface, borderBottomColor: theme.border },
          ]}
        >
          <Text style={[styles.headerTag, { color: theme.primary }]}>
            Tutorial ({stepIndex + 1}/{TUTORIAL_STEPS.length})
          </Text>
          <Pressable onPress={handleClose} style={styles.skipBtn}>
            <Text style={{ fontSize: 13, fontWeight: '900', color: theme.textMuted }}>
              Pular tutorial ✕
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <View
            style={[
              styles.heroCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={[styles.heroIconWrap, { backgroundColor: theme.primary }]}>
              <Ionicons name={current.icon} size={46} color={theme.primaryText} />
            </View>

            <Text style={[styles.title, { color: theme.text, fontSize: 21 * theme.scale }]}>
              {current.title}
            </Text>
            <Text style={[styles.subtitle, { color: theme.primary }]}>
              {current.subtitle}
            </Text>

            <Pressable
              onPress={() => speak(current.voiceText, true)}
              style={[
                styles.listenBtn,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
              ]}
            >
              <Ionicons name="volume-high" size={22} color={theme.primary} />
              <Text style={{ fontSize: 14, fontWeight: '800', color: theme.text }}>
                Ouvir explicação em áudio
              </Text>
            </Pressable>

            <View style={styles.bullets}>
              {current.bullets.map((line, i) => (
                <View
                  key={i}
                  style={[styles.bulletRow, { backgroundColor: theme.bg }]}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={theme.primary}
                    style={{ marginTop: 1 }}
                  />
                  <Text
                    style={[
                      styles.bulletText,
                      { color: theme.text, fontSize: 14 * theme.scale },
                    ]}
                  >
                    {line}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.dotsRow}>
            {TUTORIAL_STEPS.map((_, idx) => (
              <Pressable
                key={idx}
                onPress={() => setStepIndex(idx)}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      idx === stepIndex ? theme.primary : theme.surfaceMuted,
                    width: idx === stepIndex ? 24 : 10,
                    borderColor: theme.border,
                  },
                ]}
              />
            ))}
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            { backgroundColor: theme.surface, borderTopColor: theme.border },
          ]}
        >
          {stepIndex > 0 ? (
            <Pressable
              onPress={() => setStepIndex((i) => Math.max(0, i - 1))}
              style={[
                styles.navBtnSecondary,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
              ]}
            >
              <Ionicons name="arrow-back" size={20} color={theme.text} />
              <Text style={{ fontWeight: '800', color: theme.text }}>Anterior</Text>
            </Pressable>
          ) : (
            <View />
          )}

          <Pressable
            onPress={() => {
              if (isLast) handleClose();
              else setStepIndex((i) => i + 1);
            }}
            style={[styles.navBtnPrimary, { backgroundColor: theme.primary }]}
          >
            <Text style={{ fontWeight: '900', fontSize: 16, color: theme.primaryText }}>
              {isLast ? 'Começar a usar!' : 'Próximo passo'}
            </Text>
            <Ionicons
              name={isLast ? 'checkmark-circle' : 'arrow-forward'}
              size={22}
              color={theme.primaryText}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayRoot: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 999,
    elevation: 24,
  },
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 2,
  },
  headerTag: {
    fontSize: 14,
    fontWeight: '900',
  },
  skipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  body: {
    padding: 16,
    gap: 16,
    flexGrow: 1,
    justifyContent: 'center',
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 2,
    padding: 18,
    alignItems: 'center',
    gap: 12,
  },
  heroIconWrap: {
    width: 82,
    height: 82,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  listenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    width: '100%',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
  },
  bullets: {
    width: '100%',
    gap: 8,
    marginTop: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 14,
  },
  bulletText: {
    flex: 1,
    fontWeight: '600',
    lineHeight: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderTopWidth: 2,
    gap: 12,
  },
  navBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 54,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
  },
  navBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 54,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
});
