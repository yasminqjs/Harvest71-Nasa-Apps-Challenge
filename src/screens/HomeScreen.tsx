import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MainTabKey } from '../components/BottomTabBar';
import { useAccessibility } from '../context/AccessibilityContext';
import { getAppTheme } from '../theme/tokens';
import { FieldValidationLog } from '../types/domain';
import { formatArea, regionalizarTexto } from '../utils/regionalize';

interface HomeScreenProps {
  onNavigateTab: (tab: MainTabKey) => void;
  onOpenFeedback?: () => void;
  onOpenTutorial?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigateTab,
  onOpenFeedback,
  onOpenTutorial,
}) => {
  const {
    accessibility,
    activeFarmer,
    activeFarm,
    registerFieldLog,
    lastSyncMessage,
    speak,
  } = useAccessibility();
  const theme = getAppTheme(accessibility);
  const [showClimateDetail, setShowClimateDetail] = useState(false);
  const [rainFeedback, setRainFeedback] = useState<string | null>(null);

  // Estado da validação detalhada de campo
  const [showFieldDetailModal, setShowFieldDetailModal] = useState(false);
  const [intensidadeChuva, setIntensidadeChuva] = useState<
    NonNullable<FieldValidationLog['intensidadeChuva']>
  >('sem_chuva');
  const [umidadeSoloCampo, setUmidadeSoloCampo] = useState<
    NonNullable<FieldValidationLog['umidadeSoloCampo']>
  >('umida_boa');
  const [estadoLavoura, setEstadoLavoura] = useState<
    NonNullable<FieldValidationLog['estadoLavoura']>
  >('vigorosa');
  const [temperaturaPercebida, setTemperaturaPercebida] = useState<
    NonNullable<FieldValidationLog['temperaturaPercebida']>
  >('quente');
  const [sinaisErosao, setSinaisErosao] = useState(false);
  const [pragaOuObs, setPragaOuObs] = useState('');

  useEffect(() => {
    if (!showFieldDetailModal && !showClimateDetail) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowFieldDetailModal(false);
      setShowClimateDetail(false);
      return true;
    });
    return () => sub.remove();
  }, [showFieldDetailModal, showClimateDetail]);

  if (!activeFarm || !activeFarmer) return null;

  const nomeCadastrado =
    accessibility.registrationCompleted &&
    activeFarmer.tratamento &&
    activeFarmer.tratamento !== 'Agricultor(a)'
      ? activeFarmer.tratamento
      : undefined;

  const diag = activeFarm.diagnostico;
  const level = accessibility.languageLevel;

  const isDroughtAlert =
    diag.modeloB.nivel === 'alerta' || diag.modeloB.nivel === 'seca_confirmada';
  const isAttention = diag.modeloB.nivel === 'atencao';

  const card2Bg = isDroughtAlert
    ? theme.dangerBg
    : isAttention
    ? theme.warningBg
    : theme.surface;
  const card2Border = isDroughtAlert
    ? theme.dangerBorder
    : isAttention
    ? theme.warningBorder
    : theme.border;

  const handleQuickRain = async (choveu: boolean) => {
    await registerFieldLog({
      tipo: 'chuva_hoje',
      choveuHoje: choveu,
      observacao: choveu
        ? 'Agricultor confirmou chuva hoje na roça'
        : 'Agricultor confirmou tempo seco hoje na roça',
    });
    const msg = choveu
      ? 'Chuva registrada! O balanço de água da roça foi atualizado.'
      : 'Registro salvo: sem chuva hoje na roça.';
    setRainFeedback(msg);
    speak(msg);
  };

  const handleQuickSoil = async (umida: boolean) => {
    await registerFieldLog({
      tipo: 'terra_umida',
      terraUmida: umida,
      observacao: umida ? 'Terra úmida no campo' : 'Terra seca no campo',
    });
    const msg = umida
      ? 'Anotado: a terra está úmida na roça.'
      : 'Anotado: a terra está seca na roça.';
    setRainFeedback(msg);
    speak(msg);
  };

  const handleSaveDetailedField = async () => {
    const mmMap = {
      sem_chuva: 0,
      garoa_fraca: 5,
      chuva_boa: 20,
      temporal_forte: 45,
    };
    const mm = mmMap[intensidadeChuva];
    const resumoObs = [
      `Chuva: ${intensidadeChuva} (${mm} mm)`,
      `Solo: ${umidadeSoloCampo}`,
      `Planta: ${estadoLavoura}`,
      `Calor: ${temperaturaPercebida}`,
      sinaisErosao ? 'Com erosão/enxurrada' : 'Sem erosão',
      pragaOuObs.trim() ? `Obs: ${pragaOuObs.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' • ');

    await registerFieldLog({
      tipo: 'inspecao_completa',
      choveuHoje: mm > 0,
      intensidadeChuva,
      milimetrosEstimados: mm,
      terraUmida:
        umidadeSoloCampo === 'umida_boa' || umidadeSoloCampo === 'encharcada',
      umidadeSoloCampo,
      estadoLavoura,
      sinaisErosao,
      temperaturaPercebida,
      pragaOuDoenca: pragaOuObs.trim() || undefined,
      observacao: resumoObs,
    });

    setShowFieldDetailModal(false);
    setPragaOuObs('');
    const msg = 'Validação completa registrada! Diagnóstico da roça atualizado.';
    setRainFeedback(msg);
    speak(msg);
  };

  const handleSpeakSummary = () => {
    const summary = `Hoje em ${activeFarm.regiaoNome}, faz ${diag.climaDia.tempMaxC} graus com ${diag.climaDia.condicao}. ${
      level === 'acessivel'
        ? diag.modeloA.resumoAcessivel
        : diag.modeloA.resumoTecnico
    } ${
      level === 'acessivel'
        ? diag.modeloB.resumoAcessivel
        : diag.modeloB.resumoTecnico
    } Na rotação atual de ${diag.rotacaoAtual.culturas}, faltam ${diag.rotacaoAtual.diasRestantes} dias para a colheita.`;
    speak(summary, true);
  };

  const weatherIconName: keyof typeof Ionicons.glyphMap =
    diag.climaDia.icone === '🌧️' || diag.climaDia.icone === '🌦️'
      ? 'rainy'
      : diag.climaDia.icone === '⛅'
      ? 'partly-sunny'
      : diag.climaDia.icone === '🔥'
      ? 'flame'
      : 'sunny';

  const weatherIconColor =
    diag.climaDia.icone === '🌧️' || diag.climaDia.icone === '🌦️'
      ? theme.accent
      : diag.climaDia.icone === '🔥'
      ? theme.dangerBorder
      : theme.warningBorder;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.bg }}
        contentContainerStyle={styles.container}
      >
        <View style={styles.greetingRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: theme.text, fontSize: 16 * theme.scale }]}>
              {nomeCadastrado ? `Olá, ${nomeCadastrado}` : 'Olá! Sua roça hoje'}
            </Text>
          <Text style={[styles.farmTag, { color: theme.textMuted }]}>
            {activeFarm.nome} • {formatArea(activeFarm.areaHectares, activeFarm.areaTarefasBa)}
          </Text>
        </View>
        <Pressable
          onPress={handleSpeakSummary}
          style={[
            styles.listenPill,
            { backgroundColor: theme.primary, borderColor: theme.border },
          ]}
        >
          <Ionicons name="volume-high" size={18} color={theme.primaryText} />
          <Text style={[styles.listenPillText, { color: theme.primaryText }]}>
            Ouvir tudo
          </Text>
        </Pressable>
      </View>

      {/* CARD 1 DO WIREFRAME: clima do dia / nome da região */}
      <Pressable
        onPress={() => {
          setShowClimateDetail(true);
          speak(
            level === 'acessivel'
              ? diag.modeloA.resumoAcessivel
              : diag.modeloA.resumoTecnico
          );
        }}
        style={[
          styles.wireframeCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View
          style={[
            styles.cardLeftIcon,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}
        >
          <Ionicons name={weatherIconName} size={32} color={weatherIconColor} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.cardTitle, { color: theme.text, fontSize: 20 * theme.scale }]}>
              Clima do dia
            </Text>
            <Text style={[styles.tempBadge, { color: theme.primary }]}>
              {diag.climaDia.tempMaxC}° / {diag.climaDia.tempMinC}°C
            </Text>
          </View>
          <Text style={[styles.cardSub, { color: theme.textMuted, fontSize: 14 * theme.scale }]}>
            {activeFarm.regiaoNome} ({activeFarm.municipio} - {activeFarm.estado})
          </Text>
          <View style={styles.inlineIconRow}>
            <Ionicons
              name={
                diag.modeloA.status === 'deficit_confirmado'
                  ? 'alert-circle'
                  : 'water'
              }
              size={15}
              color={
                diag.modeloA.status === 'deficit_confirmado'
                  ? theme.warningBorder
                  : theme.accent
              }
            />
            <Text style={[styles.cardHint, { color: theme.text }]}>
              {diag.modeloA.status === 'deficit_confirmado'
                ? 'Terra perdendo água (toque para ver)'
                : 'Água equilibrada na semana • Toque p/ ver'}
            </Text>
          </View>
        </View>
      </Pressable>

      {/* CARD 2 DO WIREFRAME: previsão trimestre + indicador que muda com alertas */}
      <Pressable
        onPress={() => {
          onNavigateTab('safra');
          speak(
            level === 'acessivel'
              ? diag.modeloB.resumoAcessivel
              : diag.modeloB.resumoTecnico
          );
        }}
        style={[
          styles.wireframeCard,
          { backgroundColor: card2Bg, borderColor: card2Border },
        ]}
      >
        <View
          style={[
            styles.cardLeftIcon,
            {
              backgroundColor: isDroughtAlert
                ? theme.surface
                : isAttention
                ? theme.surface
                : theme.surfaceMuted,
              borderColor: card2Border,
            },
          ]}
        >
          <Ionicons
            name={isDroughtAlert ? 'warning' : isAttention ? 'alert-circle' : 'calendar'}
            size={30}
            color={
              isDroughtAlert
                ? theme.dangerBorder
                : isAttention
                ? theme.warningBorder
                : theme.primary
            }
          />
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: theme.text, fontSize: 20 * theme.scale }]}>
            Previsão do tempo
          </Text>
          <View style={styles.emojiAlertRow}>
            <Text style={styles.reactiveFace}>{diag.modeloB.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.alertLabel,
                  {
                    color: isDroughtAlert
                      ? theme.dangerText
                      : isAttention
                      ? theme.warningText
                      : theme.successText,
                    fontSize: 14 * theme.scale,
                  },
                ]}
              >
                {diag.modeloB.nivel === 'normal'
                  ? 'Sem alertas na roça'
                  : diag.modeloB.nivel === 'atencao'
                  ? 'Atenção: pouca chuva (1 sinal)'
                  : diag.modeloB.nivel === 'alerta'
                  ? 'Alerta de seca (2 sinais)'
                  : 'Seca confirmada! Ver PANCs'}
              </Text>
              <Text style={[styles.cardSubSmall, { color: theme.textMuted }]}>
                {diag.modeloC.titulo}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>

      {/* CARD 3 DO WIREFRAME: rotação atual / count_down da plantação / progresso */}
      <Pressable
        onPress={() => {
          onNavigateTab('safra');
          speak(
            `Rotação atual de ${diag.rotacaoAtual.culturas}. Faltam ${diag.rotacaoAtual.diasRestantes} dias para a colheita, com ${diag.rotacaoAtual.progressoPct}% concluído.`
          );
        }}
        style={[
          styles.wireframeCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View
          style={[
            styles.cardLeftIcon,
            { backgroundColor: theme.successBg, borderColor: theme.successBorder },
          ]}
        >
          <Ionicons name="leaf" size={30} color={theme.primary} />
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: theme.text, fontSize: 20 * theme.scale }]}>
            Rotação atual
          </Text>
          <Text style={[styles.cropTitle, { color: theme.primary, fontSize: 14 * theme.scale }]}>
            {diag.rotacaoAtual.culturas}
          </Text>
          <View style={styles.countdownRow}>
            <Text style={[styles.countdownText, { color: theme.text }]}>
              Faltam {diag.rotacaoAtual.diasRestantes} dias
            </Text>
            <Text style={[styles.progressPct, { color: theme.textMuted }]}>
              {diag.rotacaoAtual.progressoPct}% progresso
            </Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: theme.surfaceMuted }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${diag.rotacaoAtual.progressoPct}%`,
                  backgroundColor: theme.primary,
                },
              ]}
            />
          </View>
        </View>
      </Pressable>

      {/* Detector automático de segurança alimentar quando houver alerta severo */}
      {isDroughtAlert && (
        <Pressable
          onPress={() => onNavigateTab('pancs')}
          style={[
            styles.foodAlertBanner,
            { backgroundColor: theme.warningBg, borderColor: theme.warningBorder },
          ]}
        >
          <Ionicons name="nutrition" size={24} color={theme.warningText} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.foodAlertTitle, { color: theme.warningText }]}>
              Detector de Segurança Alimentar (PANCs Offline)
            </Text>
            <Text style={{ fontSize: 12, color: theme.warningText }}>
              Toque para ver plantas resistentes ao solo da sua terra (palma, umbu, mandacaru, sorgo).
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.warningText} />
        </Pressable>
      )}

      {/* Validação de campo Ground-Truth em 1 toque (salvo no SQLite sync_queue) */}
      <View
        style={[
          styles.fieldCheckCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.fieldTitle, { color: theme.text }]}>
          Validação de campo (funciona sem internet):
        </Text>
        <View style={styles.fieldBtnRow}>
          <Pressable
            onPress={() => handleQuickRain(true)}
            style={[
              styles.fieldBtn,
              { backgroundColor: theme.successBg, borderColor: theme.successBorder },
            ]}
          >
            <View style={styles.inlineIconCenter}>
              <Ionicons name="rainy-outline" size={18} color={theme.successText} />
              <Text style={[styles.fieldBtnText, { color: theme.successText }]}>
                Choveu hoje
              </Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => handleQuickRain(false)}
            style={[
              styles.fieldBtn,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}
          >
            <View style={styles.inlineIconCenter}>
              <Ionicons name="sunny-outline" size={18} color={theme.text} />
              <Text style={[styles.fieldBtnText, { color: theme.text }]}>
                Não choveu
              </Text>
            </View>
          </Pressable>
        </View>
        <View style={styles.fieldBtnRow}>
          <Pressable
            onPress={() => handleQuickSoil(true)}
            style={[
              styles.fieldBtn,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}
          >
            <View style={styles.inlineIconCenter}>
              <Ionicons name="water-outline" size={18} color={theme.accent} />
              <Text style={[styles.fieldBtnText, { color: theme.text }]}>
                Terra úmida
              </Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => handleQuickSoil(false)}
            style={[
              styles.fieldBtn,
              { backgroundColor: theme.warningBg, borderColor: theme.warningBorder },
            ]}
          >
            <View style={styles.inlineIconCenter}>
              <Ionicons name="layers-outline" size={18} color={theme.warningText} />
              <Text style={[styles.fieldBtnText, { color: theme.warningText }]}>
                Terra seca
              </Text>
            </View>
          </Pressable>
        </View>
        {(rainFeedback || lastSyncMessage) && (
          <Text style={[styles.feedbackText, { color: theme.primary }]}>
            ✓ {rainFeedback ?? lastSyncMessage}
          </Text>
        )}

        <Pressable
          onPress={() => setShowFieldDetailModal(true)}
          style={[
            styles.detailFieldBtn,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}
        >
          <Ionicons name="clipboard-outline" size={20} color={theme.primary} />
          <Text style={{ fontSize: 13, fontWeight: '900', color: theme.text }}>
            + Validação completa (intensidade, plantas, praga, erosão)
          </Text>
        </Pressable>
      </View>

      {/* Atalhos rápidos para Feedback e Tutorial */}
      <View style={styles.supportRow}>
        {onOpenFeedback && (
          <Pressable
            onPress={onOpenFeedback}
            style={[
              styles.supportCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Ionicons name="chatbox-ellipses-outline" size={24} color={theme.primary} />
            <Text style={{ fontSize: 13, fontWeight: '900', color: theme.text }}>
              Dar Feedback
            </Text>
            <Text style={{ fontSize: 11, color: theme.textMuted }}>
              Avalie se a dica funcionou
            </Text>
          </Pressable>
        )}
        {onOpenTutorial && (
          <Pressable
            onPress={onOpenTutorial}
            style={[
              styles.supportCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Ionicons name="book-outline" size={24} color={theme.accent} />
            <Text style={{ fontSize: 13, fontWeight: '900', color: theme.text }}>
              Tutorial de Uso
            </Text>
            <Text style={{ fontSize: 11, color: theme.textMuted }}>
              Ver passo a passo do app
            </Text>
          </Pressable>
        )}
        </View>
      </ScrollView>

      {/* Modal de Validação Completa do Campo */}
      {showFieldDetailModal && (
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.surface, borderColor: theme.border, maxHeight: '88%' },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                📋 Validação Detalhada do Campo
              </Text>
              <Pressable onPress={() => setShowFieldDetailModal(false)}>
                <Ionicons name="close-circle" size={28} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: 10 }}>
              <Text style={[styles.detailLabel, { color: theme.text }]}>
                1. Como foi a chuva hoje?
              </Text>
              <View style={styles.chipWrap}>
                {(
                  [
                    { id: 'sem_chuva', label: '☀️ Sem chuva' },
                    { id: 'garoa_fraca', label: '🌦️ Garoa (~5mm)' },
                    { id: 'chuva_boa', label: '🌧️ Chuva boa (~20mm)' },
                    { id: 'temporal_forte', label: '⛈️ Temporal (~45mm)' },
                  ] as const
                ).map((opt) => (
                  <Pressable
                    key={opt.id}
                    onPress={() => setIntensidadeChuva(opt.id)}
                    style={[
                      styles.detailChip,
                      {
                        backgroundColor:
                          intensidadeChuva === opt.id ? theme.primary : theme.surfaceMuted,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '800',
                        color:
                          intensidadeChuva === opt.id ? theme.primaryText : theme.text,
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.detailLabel, { color: theme.text }]}>
                2. Umidade da terra (um palmo fundo):
              </Text>
              <View style={styles.chipWrap}>
                {(
                  [
                    { id: 'seca_rachando', label: '🏜️ Seca rachando' },
                    { id: 'seca_solta', label: '🌾 Seca solta' },
                    { id: 'umida_boa', label: '💧 Úmida na medida' },
                    { id: 'encharcada', label: '🌊 Encharcada' },
                  ] as const
                ).map((opt) => (
                  <Pressable
                    key={opt.id}
                    onPress={() => setUmidadeSoloCampo(opt.id)}
                    style={[
                      styles.detailChip,
                      {
                        backgroundColor:
                          umidadeSoloCampo === opt.id ? theme.primary : theme.surfaceMuted,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '800',
                        color:
                          umidadeSoloCampo === opt.id ? theme.primaryText : theme.text,
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.detailLabel, { color: theme.text }]}>
                3. Estado das plantas na roça:
              </Text>
              <View style={styles.chipWrap}>
                {(
                  [
                    { id: 'vigorosa', label: '🌿 Verdes e firmes' },
                    { id: 'murcha_sol', label: '🥀 Murcha no sol' },
                    { id: 'amarelada', label: '🍂 Amarelando' },
                    { id: 'com_pragas', label: '🐛 Pragas / Manchas' },
                  ] as const
                ).map((opt) => (
                  <Pressable
                    key={opt.id}
                    onPress={() => setEstadoLavoura(opt.id)}
                    style={[
                      styles.detailChip,
                      {
                        backgroundColor:
                          estadoLavoura === opt.id ? theme.primary : theme.surfaceMuted,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '800',
                        color:
                          estadoLavoura === opt.id ? theme.primaryText : theme.text,
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.detailLabel, { color: theme.text }]}>
                4. Calor e sinais no terreno:
              </Text>
              <View style={styles.chipWrap}>
                {(
                  [
                    { id: 'amena', label: '🌤️ Amena' },
                    { id: 'quente', label: '☀️ Quente' },
                    { id: 'calor_extremo', label: '🔥 Calor extremo' },
                  ] as const
                ).map((opt) => (
                  <Pressable
                    key={opt.id}
                    onPress={() => setTemperaturaPercebida(opt.id)}
                    style={[
                      styles.detailChip,
                      {
                        backgroundColor:
                          temperaturaPercebida === opt.id
                            ? theme.primary
                            : theme.surfaceMuted,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '800',
                        color:
                          temperaturaPercebida === opt.id
                            ? theme.primaryText
                            : theme.text,
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}

                <Pressable
                  onPress={() => setSinaisErosao((v) => !v)}
                  style={[
                    styles.detailChip,
                    {
                      backgroundColor: sinaisErosao ? theme.dangerBg : theme.surfaceMuted,
                      borderColor: sinaisErosao ? theme.dangerBorder : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '800',
                      color: sinaisErosao ? theme.dangerText : theme.text,
                    }}
                  >
                    {sinaisErosao
                      ? '⚠️ Enxurrada / Erosão marcada'
                      : '⛰️ Marcar se houver enxurrada'}
                  </Text>
                </Pressable>
              </View>

              <Text style={[styles.detailLabel, { color: theme.text }]}>
                5. Praga observada ou anotação (opcional):
              </Text>
              <TextInput
                value={pragaOuObs}
                onChangeText={setPragaOuObs}
                placeholder="Ex.: Lagarta no milho, solo rachando no alto..."
                placeholderTextColor={theme.textMuted}
                style={[
                  styles.detailInput,
                  {
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
              />

              <Pressable
                onPress={handleSaveDetailedField}
                style={[styles.speakModalBtn, { backgroundColor: theme.primary }]}
              >
                <Ionicons name="checkmark-circle" size={22} color={theme.primaryText} />
                <Text style={{ color: theme.primaryText, fontWeight: '900', fontSize: 15 }}>
                  Salvar Validação e Atualizar Roça
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      )}

      {/* Modal do Balanço Hídrico Semanal */}
      {showClimateDetail && (
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                ☀️ Água para a lavoura (Balanço)
              </Text>
              <Pressable onPress={() => setShowClimateDetail(false)}>
                <Ionicons name="close-circle" size={28} color={theme.text} />
              </Pressable>
            </View>

            <Text style={[styles.modalLead, { color: theme.text }]}>
              {regionalizarTexto(
                level === 'acessivel'
                  ? diag.modeloA.resumoAcessivel
                  : diag.modeloA.resumoTecnico,
                level,
                nomeCadastrado
              )}
            </Text>

            <View style={[styles.metricGrid, { backgroundColor: theme.bg }]}>
              <Text style={[styles.metricLine, { color: theme.text }]}>
                • Chuva semanal (IMERG):{' '}
                <Text style={{ fontWeight: '900' }}>{diag.modeloA.chuvaImergMm} mm</Text>
              </Text>
              <Text style={[styles.metricLine, { color: theme.text }]}>
                • Perda atmosférica × Kc ({diag.modeloA.kcAplicado}):{' '}
                <Text style={{ fontWeight: '900' }}>{diag.modeloA.demandaCulturaMm} mm</Text>
              </Text>
              <Text style={[styles.metricLine, { color: theme.text }]}>
                • Saldo hídrico:{' '}
                <Text style={{ fontWeight: '900' }}>{diag.modeloA.saldoHidricoMm} mm</Text>
              </Text>
              <Text style={[styles.metricLine, { color: theme.text }]}>
                • Umidade do solo (SMAP):{' '}
                <Text style={{ fontWeight: '900' }}>{diag.modeloA.smapTendencia}</Text>
              </Text>
            </View>

            <Pressable
              onPress={() =>
                speak(
                  level === 'acessivel'
                    ? diag.modeloA.resumoAcessivel
                    : diag.modeloA.resumoTecnico,
                  true
                )
              }
              style={[styles.speakModalBtn, { backgroundColor: theme.primary }]}
            >
              <Ionicons name="volume-high" size={20} color={theme.primaryText} />
              <Text style={{ color: theme.primaryText, fontWeight: '800' }}>
                Ouvir explicação
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 14,
    gap: 12,
    paddingBottom: 24,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  greeting: {
    fontWeight: '900',
  },
  farmTag: {
    fontSize: 12,
    fontWeight: '700',
  },
  listenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    minHeight: 42,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  listenPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  wireframeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 15,
    gap: 14,
    minHeight: 110,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardLeftIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  inlineIconCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  cardTitle: {
    fontWeight: '900',
  },
  tempBadge: {
    fontSize: 14,
    fontWeight: '900',
  },
  cardSub: {
    fontWeight: '700',
  },
  cardSubSmall: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  cardHint: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  emojiAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reactiveFace: {
    fontSize: 38,
  },
  alertLabel: {
    fontWeight: '900',
  },
  cropTitle: {
    fontWeight: '800',
  },
  countdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countdownText: {
    fontSize: 13,
    fontWeight: '800',
  },
  progressPct: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    height: 10,
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  foodAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 2,
    borderRadius: 18,
    padding: 12,
  },
  foodAlertTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  fieldCheckCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 14,
    gap: 8,
  },
  fieldTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  fieldBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  fieldBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  fieldBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: '800',
  },
  detailFieldBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  supportRow: {
    flexDirection: 'row',
    gap: 10,
  },
  supportCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    gap: 4,
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailChip: {
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  detailInput: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 60,
    elevation: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 24,
    borderWidth: 2,
    padding: 18,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    flex: 1,
  },
  modalLead: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  metricGrid: {
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  metricLine: {
    fontSize: 13,
    lineHeight: 19,
  },
  speakModalBtn: {
    minHeight: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
