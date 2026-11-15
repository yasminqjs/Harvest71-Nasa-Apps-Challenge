import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';
import { isEn, pickLang } from '../i18n/locale';
import { getAppTheme } from '../theme/tokens';
import { AppLanguage } from '../types/domain';

interface TutorialStep {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  bullets: string[];
  voiceText: string;
}

function getTutorialSteps(lang: AppLanguage): TutorialStep[] {
  const en = isEn(lang);
  return [
    {
      icon: 'sunny',
      title: en
        ? '1. Overview Tab: Local Farm Information'
        : '1. Aba Resumo: Informações locais da roça',
      subtitle: en
        ? 'Viewer for temperature, rainfall, humidity, and basic status'
        : 'Visualizador de temperatura, chuva, umidade e estado básico',
      bullets: en
        ? [
            'Daily weather & quarterly forecast with local climate data (NASA POWER).',
            'General summary of your plantations, land history (SRTM + Landsat 30 m), and regional events.',
            'Quick button to generate and share a farm report on WhatsApp.',
          ]
        : [
            'Clima do dia e previsão do trimestre com dados climáticos locais (NASA POWER).',
            'Resumo geral das suas plantações, histórico da terra (SRTM + Landsat 30 m) e acontecimentos da região.',
            'Botão rápido para gerar relatório da roça pelo WhatsApp.',
          ],
      voiceText: en
        ? 'Tutorial step 1. In the Overview tab, you track basic farm info: daily weather, quarterly forecast, and plantation summary.'
        : 'Passo 1 do tutorial. Na aba Resumo, você acompanha informações básicas da roça: clima do dia, previsão do trimestre e resumo das plantações.',
    },
    {
      icon: 'leaf',
      title: en
        ? '2. Crops Tab: Update Data & Simulations'
        : '2. Aba Plantação: Atualizar dados e simulações',
      subtitle: en
        ? 'Manage your farm and open the comparator, optimizer, and quality view'
        : 'Gerencie sua fazenda e acesse comparador, otimizador e qualidade',
      bullets: en
        ? [
            'Update plantation & farm data: edit land boundary on map, plots, current crop, farm variables, and history.',
            'Rotation comparator and optimizer (DSSAT — placeholder for upcoming merges).',
            'Current plantation quality viewer (placeholder for upcoming merges).',
          ]
        : [
            'Atualizar dados da plantação e da fazenda: edite terreno no mapa, lotes, cultura atual, variáveis da fazenda e histórico.',
            'Comparador e otimizador de rotações (DSSAT — espaço reservado para próximos merges).',
            'Qualidade da plantação atual (espaço reservado para próximos merges).',
          ],
      voiceText: en
        ? 'Tutorial step 2. In the Crops tab, you update farm, plot, and crop data, and access the DSSAT comparison and plantation quality modules.'
        : 'Passo 2 do tutorial. Na aba Plantação, você atualiza dados da fazenda, lotes e culturas, e acessa as áreas de comparação DSSAT e qualidade da plantação.',
    },
    {
      icon: 'people',
      title: en
        ? '3. Community Tab: Nearby Farmers & Reports'
        : '3. Aba Comunidade: Usuários próximos e Relatos',
      subtitle: en
        ? 'Receive local updates and log regional events'
        : 'Receba relatos locais e registre acontecimentos da região',
      bullets: en
        ? [
            'See nearby farmers in the regional network graph connected by biome and topic.',
            'Read reports from other farmers across your region.',
            'Report events (pests, price shifts, natural disasters) to help the community.',
          ]
        : [
            'Ver usuários próximos no grafo regional conectado por bioma e tema.',
            'Receber relatos de outros agricultores na sua região.',
            'Relatar acontecimentos (pragas, mudanças de preço, desastres naturais) para ajudar a comunidade.',
          ],
      voiceText: en
        ? 'Tutorial step 3. In the Community tab, see nearby farmers on the graph, read reports, and post local events such as pests, prices, or extreme weather.'
        : 'Passo 3 do tutorial. Na aba Comunidade, veja agricultores próximos no grafo, leia relatos e registre acontecimentos como pragas, preços ou desastres naturais.',
    },
    {
      icon: 'chatbox-ellipses',
      title: en
        ? '4. Your Feedback Improves RoçaViva'
        : '4. Sua opinião melhora o RoçaViva',
      subtitle: en
        ? 'Offline feedback system + shared profile'
        : 'Sistema de feedback offline + perfil compartilhado',
      bullets: en
        ? [
            'Rate whether the forecast matched actual rain or drought on your land.',
            'Send typed or voice-dictated feedback — saved on your device until online.',
            'Tap the user icon at the top to switch farmer profiles on one device, switch EN/PT, or enable large text / high contrast.',
          ]
        : [
            'Avalie se a previsão bateu com a chuva ou seca na sua propriedade.',
            'Envie comentários escritos ou falados pelo microfone — fica salvo no celular até conectar.',
            'No ícone de usuário no topo, você também troca de agricultor no mesmo aparelho e ajusta letras grandes ou alto contraste.',
          ],
      voiceText: en
        ? 'Tutorial step 4. You can send feedback on how well forecasts matched your farm. Everything works offline and syncs once connected. Good luck in the field!'
        : 'Passo 4 do tutorial. Você pode enviar sua opinião dizendo se a previsão funcionou na roça. Tudo funciona offline e sincroniza quando tiver sinal. Bom trabalho!',
    },
  ];
}

interface AppTutorialModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AppTutorialModal: React.FC<AppTutorialModalProps> = ({
  visible,
  onClose,
}) => {
  const { language, accessibility, speak, stopVoice } = useAccessibility();
  const theme = getAppTheme(accessibility);
  const [stepIndex, setStepIndex] = useState(0);

  const steps = getTutorialSteps(language);
  const current = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  useEffect(() => {
    if (!visible) {
      stopVoice();
    }
  }, [visible, stopVoice]);

  useEffect(() => {
    if (visible && accessibility.voiceGuidanceEnabled) {
      speak(steps[stepIndex].voiceText);
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
            {pickLang(
              language,
              `Tutorial (${stepIndex + 1}/${steps.length})`,
              `Tutorial (${stepIndex + 1}/${steps.length})`
            )}
          </Text>
          <Pressable onPress={handleClose} style={styles.skipBtn}>
            <Text style={{ fontSize: 13, fontWeight: '900', color: theme.textMuted }}>
              {pickLang(language, 'Skip tutorial ✕', 'Pular tutorial ✕')}
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
                {pickLang(
                  language,
                  'Listen to audio explanation',
                  'Ouvir explicação em áudio'
                )}
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
            {steps.map((_, idx) => (
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
              <Text style={{ fontWeight: '800', color: theme.text }}>
                {pickLang(language, 'Previous', 'Anterior')}
              </Text>
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
              {isLast
                ? pickLang(language, 'Get started!', 'Começar a usar!')
                : pickLang(language, 'Next step', 'Próximo passo')}
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
