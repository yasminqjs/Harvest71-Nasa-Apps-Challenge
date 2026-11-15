import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NordesteSvgMap } from '../components/NordesteSvgMap';
import { useAccessibility } from '../context/AccessibilityContext';
import { BahiaRegionPreset } from '../data/seedData';
import { getAppTheme } from '../theme/tokens';
import {
  FarmObjective,
  FarmingTenureOption,
  FinancialTier,
  GenderOption,
  LaborType,
  WaterAccess,
  WaterStorageType,
} from '../types/domain';

type OnboardingStage = 'mapa' | 'cadastro';

type ParamTabKey =
  | 'identidade'
  | 'terra_tempo'
  | 'agua'
  | 'trabalho'
  | 'financeiro'
  | 'objetivo';

interface ParamTabMeta {
  key: ParamTabKey;
  shortLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  voice: string;
}

const PARAM_TABS: ParamTabMeta[] = [
  {
    key: 'identidade',
    shortLabel: 'Nome e Gênero',
    icon: 'person-outline',
    title: 'Nome e Gênero',
    voice:
      'Aba 1: Nome e Gênero. Diga como prefere ser chamado, escolha seu gênero e sua faixa de idade.',
  },
  {
    key: 'terra_tempo',
    shortLabel: 'Terra e Tempo',
    icon: 'time-outline',
    title: 'Tempo na Agricultura e Tamanho da Terra',
    voice:
      'Aba 2: Informe há quanto tempo você está na agricultura familiar e o tamanho aproximado da terra.',
  },
  {
    key: 'agua',
    shortLabel: 'Água',
    icon: 'water-outline',
    title: 'Acesso à Água',
    voice:
      'Aba 3: Acesso à água. Informe de onde vem a água da roça e se há reservatório.',
  },
  {
    key: 'trabalho',
    shortLabel: 'Trabalho',
    icon: 'people-outline',
    title: 'Força de Trabalho',
    voice:
      'Aba 4: Força de trabalho. Diga quem faz o serviço na propriedade.',
  },
  {
    key: 'financeiro',
    shortLabel: 'Situação Financeira',
    icon: 'wallet-outline',
    title: 'Situação Financeira',
    voice:
      'Aba 5: Situação financeira. Selecione qual recurso ou apoio financeiro utiliza hoje.',
  },
  {
    key: 'objetivo',
    shortLabel: 'Objetivo',
    icon: 'flag-outline',
    title: 'Objetivo da Roça',
    voice:
      'Aba 6: Objetivo da produção. Escolha para que você planta e os principais desafios.',
  },
];

interface OptionCardProps {
  selected: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  theme: ReturnType<typeof getAppTheme>;
}

const BigOptionCard: React.FC<OptionCardProps> = ({
  selected,
  icon,
  title,
  subtitle,
  onPress,
  theme,
}) => (
  <Pressable
    onPress={onPress}
    style={[
      styles.bigCard,
      {
        backgroundColor: selected ? theme.primary : theme.surface,
        borderColor: selected ? theme.primary : theme.border,
      },
    ]}
  >
    <View
      style={[
        styles.iconBadge,
        {
          backgroundColor: selected ? theme.surface : theme.surfaceMuted,
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={28}
        color={selected ? theme.primary : theme.text}
      />
    </View>
    <View style={styles.bigCardBody}>
      <Text
        style={[
          styles.bigCardTitle,
          {
            color: selected ? theme.primaryText : theme.text,
            fontSize: 15 * theme.scale,
          },
        ]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={[
            styles.bigCardSub,
            { color: selected ? theme.primaryText : theme.textMuted },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
    <Ionicons
      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
      size={24}
      color={selected ? theme.primaryText : theme.textMuted}
    />
  </Pressable>
);

export const NordesteOnboardingScreen: React.FC = () => {
  const {
    accessibility,
    activeFarmer,
    activeFarm,
    selectBahiaRegion,
    applyRegistrationSetup,
    toggleVoiceGuidance,
    speak,
  } = useAccessibility();
  const theme = getAppTheme(accessibility);

  const [stage, setStage] = useState<OnboardingStage>('mapa');
  const [activeParamIdx, setActiveParamIdx] = useState(0);

  const [tratamento, setTratamento] = useState(activeFarmer?.tratamento ?? 'Dona Maria');
  const [genero, setGenero] = useState<GenderOption>(
    activeFarmer?.genero ?? 'feminino'
  );
  const [faixaEtaria, setFaixaEtaria] = useState<'18-35' | '36-55' | '56+'>(
    activeFarmer?.faixaEtaria ?? '56+'
  );
  const [tempoAgricultura, setTempoAgricultura] = useState<FarmingTenureOption>(
    activeFarmer?.tempoAgriculturaFamiliar ?? 'mais_15'
  );
  const [tamanhoHa, setTamanhoHa] = useState<number>(
    activeFarmer?.tamanhoEstimadoHa ?? activeFarm?.areaHectares ?? 3.5
  );
  const [culturaPrincipal, setCulturaPrincipal] = useState<string>(
    activeFarmer?.culturaDesejada ??
      activeFarm?.culturaPrincipal ??
      'Feijão-Caupi + Mandioca'
  );
  const [waterAccess, setWaterAccess] = useState<WaterAccess>(
    activeFarmer?.waterAccess ?? 'sequeiro'
  );
  const [armazenamento, setArmazenamento] = useState<WaterStorageType>(
    activeFarmer?.armazenamentoAgua ?? 'cisterna_placa'
  );
  const [laborType, setLaborType] = useState<LaborType>(
    activeFarmer?.laborType ?? 'familiar'
  );
  const [financialTier, setFinancialTier] = useState<FinancialTier>(
    activeFarmer?.financialTier ?? 'pronaf'
  );
  const [objective, setObjective] = useState<FarmObjective>(
    activeFarmer?.objective ?? 'subsistencia'
  );
  const [desafios, setDesafios] = useState<string[]>(
    activeFarmer?.desafiosPrincipais ?? ['seca']
  );

  const currentTab = PARAM_TABS[activeParamIdx];

  useEffect(() => {
    if (!accessibility.voiceGuidanceEnabled) return;
    if (stage === 'mapa') {
      speak(
        'Primeiro, escolha onde fica a sua roça no mapa da Bahia e Nordeste.'
      );
    } else {
      speak(currentTab.voice);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, activeParamIdx]);

  const handleSelectRegion = async (reg: BahiaRegionPreset) => {
    await selectBahiaRegion(reg.id);
    speak(`Região selecionada: ${reg.nome}, ${reg.municipio}, na Bahia.`);
  };

  const toggleDesafio = (id: string) => {
    setDesafios((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleFinish = async () => {
    if (activeFarmer) {
      await applyRegistrationSetup(
        {
          ...activeFarmer,
          tratamento: tratamento.trim() || activeFarmer.tratamento,
          genero,
          faixaEtaria,
          tempoAgriculturaFamiliar: tempoAgricultura,
          waterAccess,
          armazenamentoAgua: armazenamento,
          laborType,
          financialTier,
          objective,
          tamanhoEstimadoHa: tamanhoHa,
          culturaDesejada: culturaPrincipal,
          desafiosPrincipais: desafios,
        },
        {
          tamanhoEstimadoHa: tamanhoHa,
          culturaPrincipal,
        }
      );
    }
    speak(
      `Cadastro concluído! Abrindo o tutorial rápido da sua roça em ${
        activeFarm?.regiaoNome ?? 'Bahia'
      }.`
    );
  };

  const progressPct =
    stage === 'mapa'
      ? 14
      : Math.round(((activeParamIdx + 2) / (PARAM_TABS.length + 1)) * 100);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      {/* Cabeçalho fixo */}
      <View style={styles.topHeader}>
        <View style={styles.topBar}>
          <View style={styles.titleStack}>
            <Text style={[styles.stepBadge, { color: theme.primary }]}>
              {stage === 'mapa'
                ? 'Etapa 1 • Seleção do Local'
                : `Etapa 2 • Parâmetros (${activeParamIdx + 1}/${PARAM_TABS.length})`}
            </Text>
            <Text
              style={[
                styles.appName,
                { color: theme.text, fontSize: 20 * theme.scale },
              ]}
            >
              {stage === 'mapa' ? 'Onde fica a sua roça?' : 'Cadastro da Roça'}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              onPress={() =>
                speak(
                  stage === 'mapa'
                    ? 'Toque em um ponto no mapa ou nas pílulas para escolher a região da sua roça.'
                    : currentTab.voice,
                  true
                )
              }
              style={[
                styles.listenStepBtn,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
              ]}
            >
              <Ionicons name="volume-medium" size={18} color={theme.primary} />
              <Text style={{ fontSize: 12, fontWeight: '800', color: theme.text }}>
                Ouvir
              </Text>
            </Pressable>

            <Pressable
              onPress={toggleVoiceGuidance}
              accessibilityLabel="Alternar guia por voz"
              style={[
                styles.soundPill,
                {
                  backgroundColor: accessibility.voiceGuidanceEnabled
                    ? theme.primary
                    : theme.surface,
                  borderColor: theme.border,
                },
              ]}
            >
              <Ionicons
                name={accessibility.voiceGuidanceEnabled ? 'volume-high' : 'volume-mute'}
                size={20}
                color={
                  accessibility.voiceGuidanceEnabled ? theme.primaryText : theme.text
                }
              />
            </Pressable>
          </View>
        </View>

        <View style={[styles.progressTrack, { backgroundColor: theme.surfaceMuted }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${progressPct}%`, backgroundColor: theme.primary },
            ]}
          />
        </View>

        {/* Barra de abas separadas logo após a seleção no mapa */}
        {stage === 'cadastro' && (
          <View style={styles.tabsHeaderWrap}>
            <View style={styles.selectedRegionChipRow}>
              <View
                style={[
                  styles.regionMiniBadge,
                  { backgroundColor: theme.successBg, borderColor: theme.successBorder },
                ]}
              >
                <Ionicons name="location" size={14} color={theme.successText} />
                <Text
                  style={{ fontSize: 12, fontWeight: '800', color: theme.successText }}
                  numberOfLines={1}
                >
                  {activeFarm?.regiaoNome} ({activeFarm?.municipio})
                </Text>
              </View>
              <Pressable
                onPress={() => setStage('mapa')}
                style={[
                  styles.changeMapBtn,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Ionicons name="map-outline" size={14} color={theme.primary} />
                <Text style={{ fontSize: 11, fontWeight: '800', color: theme.primary }}>
                  Trocar local
                </Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsScroll}
            >
              {PARAM_TABS.map((tabItem, idx) => {
                const isActive = idx === activeParamIdx;
                return (
                  <Pressable
                    key={tabItem.key}
                    onPress={() => setActiveParamIdx(idx)}
                    style={[
                      styles.paramTabPill,
                      {
                        backgroundColor: isActive ? theme.primary : theme.surface,
                        borderColor: isActive ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={tabItem.icon}
                      size={16}
                      color={isActive ? theme.primaryText : theme.primary}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '800',
                        color: isActive ? theme.primaryText : theme.text,
                      }}
                    >
                      {idx + 1}. {tabItem.shortLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Conteúdo principal */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.stepBody}
        showsVerticalScrollIndicator={false}
      >
        {stage === 'mapa' ? (
          <View
            style={[
              styles.mapCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <NordesteSvgMap
              selectedRegionName={activeFarm?.regiaoNome ?? 'Recôncavo Baiano'}
              onSelectRegion={handleSelectRegion}
              theme={theme}
            />
            <View
              style={[
                styles.selectedBanner,
                {
                  backgroundColor: theme.successBg,
                  borderColor: theme.successBorder,
                  borderWidth: 1,
                },
              ]}
            >
              <Ionicons name="location" size={22} color={theme.successText} />
              <Text style={[styles.selectedHint, { color: theme.successText }]}>
                {activeFarm?.regiaoNome} ({activeFarm?.municipio} - {activeFarm?.estado}) •
                Bioma {activeFarm?.bioma}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.stepStack}>
            <View style={styles.tabBannerTitle}>
              <Ionicons name={currentTab.icon} size={22} color={theme.primary} />
              <Text
                style={[
                  styles.stepTitle,
                  { color: theme.text, fontSize: 18 * theme.scale },
                ]}
              >
                {currentTab.title}
              </Text>
            </View>

            {/* ABA 1: NOME E GÊNERO */}
            {currentTab.key === 'identidade' && (
              <>
                <View
                  style={[
                    styles.inputCard,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <View style={styles.labelIconRow}>
                    <Ionicons name="person-circle" size={28} color={theme.primary} />
                    <Text
                      style={[
                        styles.fieldLabel,
                        { color: theme.text, fontSize: 16 * theme.scale },
                      ]}
                    >
                      Nome (como prefere ser chamado/a)
                    </Text>
                  </View>
                  <TextInput
                    value={tratamento}
                    onChangeText={setTratamento}
                    placeholder="Ex.: Dona Maria, Seu João..."
                    placeholderTextColor={theme.textMuted}
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.bg,
                        borderColor: theme.border,
                        color: theme.text,
                        fontSize: 16 * theme.scale,
                      },
                    ]}
                  />
                </View>

                <Text style={[styles.groupTitle, { color: theme.text }]}>Gênero:</Text>
                {(
                  [
                    {
                      id: 'feminino',
                      icon: 'female-outline',
                      title: 'Feminino',
                      sub: 'Agricultora / Trabalhadora rural',
                    },
                    {
                      id: 'masculino',
                      icon: 'male-outline',
                      title: 'Masculino',
                      sub: 'Agricultor / Trabalhador rural',
                    },
                    {
                      id: 'nao_binario',
                      icon: 'person-outline',
                      title: 'Outro / Não-binário',
                      sub: 'Identificação livre',
                    },
                    {
                      id: 'prefiro_nao_informar',
                      icon: 'shield-outline',
                      title: 'Prefiro não informar',
                      sub: 'Opcional no cadastro local',
                    },
                  ] as const
                ).map((opt) => (
                  <BigOptionCard
                    key={opt.id}
                    selected={genero === opt.id}
                    icon={opt.icon}
                    title={opt.title}
                    subtitle={opt.sub}
                    onPress={() => setGenero(opt.id)}
                    theme={theme}
                  />
                ))}

                <Text style={[styles.groupTitle, { color: theme.text, marginTop: 6 }]}>
                  Faixa de idade:
                </Text>
                {(
                  [
                    {
                      id: '18-35',
                      icon: 'leaf-outline',
                      title: '18 a 35 anos',
                      sub: 'Agricultura jovem',
                    },
                    {
                      id: '36-55',
                      icon: 'sunny-outline',
                      title: '36 a 55 anos',
                      sub: 'Experiência ativa no campo',
                    },
                    {
                      id: '56+',
                      icon: 'heart-outline',
                      title: '56 anos ou mais',
                      sub: 'Letras claras e guia com voz calma',
                    },
                  ] as const
                ).map((opt) => (
                  <BigOptionCard
                    key={opt.id}
                    selected={faixaEtaria === opt.id}
                    icon={opt.icon}
                    title={opt.title}
                    subtitle={opt.sub}
                    onPress={() => setFaixaEtaria(opt.id)}
                    theme={theme}
                  />
                ))}
              </>
            )}

            {/* ABA 2: TEMPO NA AGRICULTURA FAMILIAR E TAMANHO DA TERRA */}
            {currentTab.key === 'terra_tempo' && (
              <>
                <Text style={[styles.groupTitle, { color: theme.text }]}>
                  Tempo na agricultura familiar:
                </Text>
                {(
                  [
                    {
                      id: 'menos_2',
                      icon: 'sparkles-outline',
                      title: 'Menos de 2 anos',
                      sub: 'Iniciando ou retornando para a roça',
                    },
                    {
                      id: '2_a_5',
                      icon: 'leaf-outline',
                      title: '2 a 5 anos',
                      sub: 'Construindo experiência nas últimas safras',
                    },
                    {
                      id: '5_a_15',
                      icon: 'calendar-outline',
                      title: '5 a 15 anos',
                      sub: 'Conhece bem os ciclos de chuva e seca',
                    },
                    {
                      id: 'mais_15',
                      icon: 'ribbon-outline',
                      title: 'Mais de 15 anos',
                      sub: 'Tradição e sabedoria na terra da família',
                    },
                  ] as const
                ).map((opt) => (
                  <BigOptionCard
                    key={opt.id}
                    selected={tempoAgricultura === opt.id}
                    icon={opt.icon}
                    title={opt.title}
                    subtitle={opt.sub}
                    onPress={() => setTempoAgricultura(opt.id)}
                    theme={theme}
                  />
                ))}

                <Text style={[styles.groupTitle, { color: theme.text, marginTop: 8 }]}>
                  Tamanho aproximado da terra:
                </Text>
                {[
                  {
                    ha: 1.5,
                    icon: 'resize-outline' as const,
                    title: 'Até 2 hectares (até 4,5 tarefas)',
                    sub: 'Roça pequena ou quintal produtivo',
                  },
                  {
                    ha: 3.5,
                    icon: 'grid-outline' as const,
                    title: '2 a 5 hectares (5 a 11 tarefas)',
                    sub: 'Agricultura familiar típica',
                  },
                  {
                    ha: 10.0,
                    icon: 'map-outline' as const,
                    title: '5 a 15 hectares (12 a 34 tarefas)',
                    sub: 'Lavoura e criação integrada',
                  },
                  {
                    ha: 20.0,
                    icon: 'earth-outline' as const,
                    title: 'Mais de 15 hectares',
                    sub: 'Área ampla ou associação comunitária',
                  },
                ].map((opt) => (
                  <BigOptionCard
                    key={opt.ha}
                    selected={Math.abs(tamanhoHa - opt.ha) < 0.6}
                    icon={opt.icon}
                    title={opt.title}
                    subtitle={opt.sub}
                    onPress={() => setTamanhoHa(opt.ha)}
                    theme={theme}
                  />
                ))}

                <Text style={[styles.groupTitle, { color: theme.text, marginTop: 8 }]}>
                  O que você mais planta hoje?
                </Text>
                {[
                  {
                    crop: 'Feijão-Caupi + Mandioca',
                    icon: 'nutrition-outline' as const,
                    sub: 'Base alimentar resistente no Nordeste',
                  },
                  {
                    crop: 'Milho + Feijão',
                    icon: 'flower-outline' as const,
                    sub: 'Consórcio tradicional de chuva',
                  },
                  {
                    crop: 'Palma + Sorgo',
                    icon: 'shield-checkmark-outline' as const,
                    sub: 'Alta resistência ao calor e forragem',
                  },
                  {
                    crop: 'Horta + PANCs Nativas',
                    icon: 'basket-outline' as const,
                    sub: 'Segurança alimentar e renda rápida',
                  },
                ].map((opt) => (
                  <BigOptionCard
                    key={opt.crop}
                    selected={culturaPrincipal === opt.crop}
                    icon={opt.icon}
                    title={opt.crop}
                    subtitle={opt.sub}
                    onPress={() => setCulturaPrincipal(opt.crop)}
                    theme={theme}
                  />
                ))}
              </>
            )}

            {/* ABA 3: ACESSO À ÁGUA */}
            {currentTab.key === 'agua' && (
              <>
                <Text style={[styles.groupTitle, { color: theme.text }]}>
                  Principal fonte de água para a plantação:
                </Text>
                {(
                  [
                    {
                      id: 'sequeiro',
                      icon: 'rainy-outline',
                      title: 'Sequeiro (só água da chuva)',
                      sub: 'Depende do inverno e da umidade do solo',
                    },
                    {
                      id: 'cisterna',
                      icon: 'water-outline',
                      title: 'Cisterna / Barreiro',
                      sub: 'Água guardada da enxurrada ou calha',
                    },
                    {
                      id: 'acude',
                      icon: 'boat-outline',
                      title: 'Açude / Rio / Riacho',
                      sub: 'Captação próxima ao terreno',
                    },
                    {
                      id: 'poco_artesiano',
                      icon: 'disc-outline',
                      title: 'Poço Artesiano / Cacimba',
                      sub: 'Água subterrânea (SIAGAS)',
                    },
                    {
                      id: 'irrigacao',
                      icon: 'sparkles-outline',
                      title: 'Irrigação / Gotejamento',
                      sub: 'Sistema instalado na área',
                    },
                  ] as const
                ).map((opt) => (
                  <BigOptionCard
                    key={opt.id}
                    selected={waterAccess === opt.id}
                    icon={opt.icon}
                    title={opt.title}
                    subtitle={opt.sub}
                    onPress={() => setWaterAccess(opt.id)}
                    theme={theme}
                  />
                ))}

                <Text style={[styles.groupTitle, { color: theme.text, marginTop: 8 }]}>
                  Reserva de água na propriedade:
                </Text>
                {(
                  [
                    { id: 'cisterna_placa', icon: 'cube-outline', title: 'Cisterna de placa' },
                    {
                      id: 'barreiro',
                      icon: 'layers-outline',
                      title: 'Barreiro / Tanque de pedra',
                    },
                    {
                      id: 'caixa_dagua',
                      icon: 'beaker-outline',
                      title: "Caixa d'água / Tambor",
                    },
                    {
                      id: 'nenhum',
                      icon: 'alert-circle-outline',
                      title: 'Sem reservatório ainda',
                    },
                  ] as const
                ).map((opt) => (
                  <BigOptionCard
                    key={opt.id}
                    selected={armazenamento === opt.id}
                    icon={opt.icon}
                    title={opt.title}
                    onPress={() => setArmazenamento(opt.id)}
                    theme={theme}
                  />
                ))}
              </>
            )}

            {/* ABA 4: FORÇA DE TRABALHO */}
            {currentTab.key === 'trabalho' && (
              <>
                <Text style={[styles.groupTitle, { color: theme.text }]}>
                  Quem faz o trabalho na roça:
                </Text>
                {(
                  [
                    {
                      id: 'familiar',
                      icon: 'people-outline',
                      title: 'Trabalho familiar / enxada',
                      sub: 'Mão de obra da própria família',
                    },
                    {
                      id: 'mutirao_diarista',
                      icon: 'hand-left-outline',
                      title: 'Mutirão ou diarista',
                      sub: 'Troca de dias com vizinhos ou ajuda paga',
                    },
                    {
                      id: 'tracao_animal',
                      icon: 'trail-sign-outline',
                      title: 'Tração animal',
                      sub: 'Arado ou transporte com animal',
                    },
                    {
                      id: 'maquinario',
                      icon: 'construct-outline',
                      title: 'Trator / Maquinário',
                      sub: 'Hora de trator própria ou da associação',
                    },
                  ] as const
                ).map((opt) => (
                  <BigOptionCard
                    key={opt.id}
                    selected={laborType === opt.id}
                    icon={opt.icon}
                    title={opt.title}
                    subtitle={opt.sub}
                    onPress={() => setLaborType(opt.id)}
                    theme={theme}
                  />
                ))}
              </>
            )}

            {/* ABA 5: SITUAÇÃO FINANCEIRA */}
            {currentTab.key === 'financeiro' && (
              <>
                <Text style={[styles.groupTitle, { color: theme.text }]}>
                  Qual é a sua situação financeira para plantar?
                </Text>
                {(
                  [
                    {
                      id: 'recursos_proprios',
                      icon: 'wallet-outline',
                      title: 'Recurso próprio (sem dívida)',
                      sub: 'Prioridade para soluções de baixo ou nenhum custo',
                    },
                    {
                      id: 'pronaf',
                      icon: 'business-outline',
                      title: 'PRONAF (Agricultura Familiar)',
                      sub: 'Financiamento rural com laudo técnico no app',
                    },
                    {
                      id: 'programa_social',
                      icon: 'ribbon-outline',
                      title: 'Garantia-Safra / PAA / Apoio Social',
                      sub: 'Segurança na estiagem e venda pública',
                    },
                    {
                      id: 'emprestimo_local',
                      icon: 'card-outline',
                      title: 'Crédito em cooperativa / associação',
                      sub: 'Apoio de cooperativa ou banco local',
                    },
                  ] as const
                ).map((opt) => (
                  <BigOptionCard
                    key={opt.id}
                    selected={financialTier === opt.id}
                    icon={opt.icon}
                    title={opt.title}
                    subtitle={opt.sub}
                    onPress={() => setFinancialTier(opt.id)}
                    theme={theme}
                  />
                ))}
              </>
            )}

            {/* ABA 6: OBJETIVO */}
            {currentTab.key === 'objetivo' && (
              <>
                <Text style={[styles.groupTitle, { color: theme.text }]}>
                  Para que você planta principalmente?
                </Text>
                {(
                  [
                    {
                      id: 'subsistencia',
                      icon: 'restaurant-outline',
                      title: 'Comida da família (subsistência)',
                      sub: 'Foco em alimento seguro o ano inteiro',
                    },
                    {
                      id: 'misto',
                      icon: 'basket-outline',
                      title: 'Consumo da casa + Venda na feira',
                      sub: 'Garante a mesa e vende o excedente',
                    },
                    {
                      id: 'comercial',
                      icon: 'trending-up-outline',
                      title: 'Venda / Cooperativa / Mercado',
                      sub: 'Rendimento por hectare e margem de safra',
                    },
                  ] as const
                ).map((opt) => (
                  <BigOptionCard
                    key={opt.id}
                    selected={objective === opt.id}
                    icon={opt.icon}
                    title={opt.title}
                    subtitle={opt.sub}
                    onPress={() => setObjective(opt.id)}
                    theme={theme}
                  />
                ))}

                <Text style={[styles.groupTitle, { color: theme.text, marginTop: 8 }]}>
                  Maiores desafios hoje (pode marcar vários):
                </Text>
                {[
                  { id: 'seca', icon: 'sunny-outline' as const, title: 'Seca / chuva irregular' },
                  {
                    id: 'erosao',
                    icon: 'layers-outline' as const,
                    title: 'Terra fraca ou enxurrada',
                  },
                  {
                    id: 'pragas',
                    icon: 'bug-outline' as const,
                    title: 'Pragas e folhas doentes',
                  },
                  {
                    id: 'agua',
                    icon: 'water-outline' as const,
                    title: 'Falta de água / poço fundo',
                  },
                  {
                    id: 'venda',
                    icon: 'cash-outline' as const,
                    title: 'Preço baixo ou escoamento',
                  },
                ].map((opt) => (
                  <BigOptionCard
                    key={opt.id}
                    selected={desafios.includes(opt.id)}
                    icon={opt.icon}
                    title={opt.title}
                    onPress={() => toggleDesafio(opt.id)}
                    theme={theme}
                  />
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Navegação fixa inferior */}
      <View
        style={[
          styles.footerNav,
          { backgroundColor: theme.surface, borderTopColor: theme.border },
        ]}
      >
        {stage === 'mapa' ? (
          <>
            <View />
            <Pressable
              onPress={() => {
                setStage('cadastro');
                setActiveParamIdx(0);
              }}
              style={[styles.nextBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.nextText, { color: theme.primaryText }]}>
                Confirmar local e ir para o cadastro
              </Text>
              <Ionicons name="arrow-forward" size={20} color={theme.primaryText} />
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              onPress={() => {
                if (activeParamIdx === 0) setStage('mapa');
                else setActiveParamIdx((i) => Math.max(0, i - 1));
              }}
              style={[
                styles.backBtn,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
              ]}
            >
              <Ionicons name="arrow-back" size={20} color={theme.text} />
              <Text style={[styles.backText, { color: theme.text }]}>
                {activeParamIdx === 0 ? 'Mapa' : 'Anterior'}
              </Text>
            </Pressable>

            {activeParamIdx < PARAM_TABS.length - 1 ? (
              <Pressable
                onPress={() =>
                  setActiveParamIdx((i) => Math.min(PARAM_TABS.length - 1, i + 1))
                }
                style={[styles.nextBtn, { backgroundColor: theme.primary }]}
              >
                <Text style={[styles.nextText, { color: theme.primaryText }]}>
                  Próxima aba
                </Text>
                <Ionicons name="arrow-forward" size={20} color={theme.primaryText} />
              </Pressable>
            ) : (
              <Pressable
                onPress={handleFinish}
                style={[styles.nextBtn, { backgroundColor: theme.primary }]}
              >
                <Text style={[styles.nextText, { color: theme.primaryText }]}>
                  Concluir cadastro
                </Text>
                <Ionicons
                  name="checkmark-circle"
                  size={22}
                  color={theme.primaryText}
                />
              </Pressable>
            )}
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topHeader: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 8,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleStack: {
    flex: 1,
    gap: 2,
  },
  stepBadge: {
    fontSize: 12,
    fontWeight: '900',
  },
  appName: {
    fontWeight: '900',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  soundPill: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  tabsHeaderWrap: {
    gap: 8,
    marginTop: 2,
  },
  selectedRegionChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  regionMiniBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  changeMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  tabsScroll: {
    gap: 8,
    paddingRight: 10,
  },
  paramTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  tabBannerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  stepTitle: {
    flex: 1,
    fontWeight: '900',
  },
  listenStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  stepBody: {
    paddingHorizontal: 16,
    paddingBottom: 22,
    gap: 12,
  },
  stepStack: {
    gap: 10,
  },
  mapCard: {
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 12,
    alignItems: 'center',
    gap: 10,
  },
  selectedBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 14,
  },
  selectedHint: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  inputCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    gap: 10,
  },
  labelIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldLabel: {
    fontWeight: '900',
    flex: 1,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontWeight: '800',
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  bigCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
    minHeight: 68,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigCardBody: {
    flex: 1,
    gap: 2,
  },
  bigCardTitle: {
    fontWeight: '900',
  },
  bigCardSub: {
    fontSize: 12,
    fontWeight: '600',
  },
  footerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1.5,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    minHeight: 48,
  },
  backText: {
    fontSize: 14,
    fontWeight: '900',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    minHeight: 48,
    flexShrink: 1,
  },
  nextText: {
    fontSize: 14,
    fontWeight: '900',
  },
});
