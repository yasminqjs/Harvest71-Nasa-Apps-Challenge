import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FarmBoundaryStep, FarmLotsStep } from '../components/onboarding/FarmLotDemarcationStep';
import { NordesteSvgMap } from '../components/NordesteSvgMap';
import { useAccessibility } from '../context/AccessibilityContext';
import { BahiaRegionPreset, localizeBiome, NORDESTE_REGIONS } from '../data/seedData';
import { isEn, LanguageTogglePill, pickLang } from '../i18n/locale';
import { getAppTheme } from '../theme/tokens';
import {
  calculatePolygonMetrics,
  createMicroPlotAroundPoint,
  findNearestRegion,
} from '../utils/geoprocessing';
import {
  AppLanguage,
  FarmObjective,
  FarmingTenureOption,
  FinancialTier,
  GenderOption,
  GeoPoint,
  LaborType,
  PlantingLot,
  WaterAccess,
  WaterStorageType,
} from '../types/domain';

type OnboardingStage = 'mapa' | 'demarcacao_fazenda' | 'lotes' | 'cadastro';

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

function getParamTabs(lang: AppLanguage): ParamTabMeta[] {
  const en = isEn(lang);
  return [
    {
      key: 'identidade',
      shortLabel: en ? 'Name & Gender' : 'Nome e Gênero',
      icon: 'person-outline',
      title: en ? 'Name & Gender' : 'Nome e Gênero',
      voice: en
        ? 'Tab 1: Name and Gender. Enter how you prefer to be called, your gender, and age group.'
        : 'Aba 1: Nome e Gênero. Diga como prefere ser chamado, escolha seu gênero e sua faixa de idade.',
    },
    {
      key: 'terra_tempo',
      shortLabel: en ? 'Years Farming' : 'Tempo na Roça',
      icon: 'time-outline',
      title: en ? 'Farming Experience' : 'Experiência na Agricultura',
      voice: en
        ? 'Tab 2: Tell us how long you have worked in family farming.'
        : 'Aba 2: Informe há quanto tempo você trabalha na agricultura familiar.',
    },
    {
      key: 'agua',
      shortLabel: en ? 'Water' : 'Água',
      icon: 'water-outline',
      title: en ? 'Water Access' : 'Acesso à Água',
      voice: en
        ? 'Tab 3: Water Access. Select where your farm water comes from and whether you have storage.'
        : 'Aba 3: Acesso à água. Informe de onde vem a água da roça e se há reservatório.',
    },
    {
      key: 'trabalho',
      shortLabel: en ? 'Labor' : 'Trabalho',
      icon: 'people-outline',
      title: en ? 'Workforce' : 'Força de Trabalho',
      voice: en
        ? 'Tab 4: Workforce. Tell us who does the farm work on your property.'
        : 'Aba 4: Força de trabalho. Diga quem faz o serviço na propriedade.',
    },
    {
      key: 'financeiro',
      shortLabel: en ? 'Finance' : 'Situação Financeira',
      icon: 'wallet-outline',
      title: en ? 'Financial Situation' : 'Situação Financeira',
      voice: en
        ? 'Tab 5: Financial situation. Select what funding or support program you currently use.'
        : 'Aba 5: Situação financeira. Selecione qual recurso ou apoio financeiro utiliza hoje.',
    },
    {
      key: 'objetivo',
      shortLabel: en ? 'Goal' : 'Objetivo',
      icon: 'flag-outline',
      title: en ? 'Farm Goal' : 'Objetivo da Roça',
      voice: en
        ? 'Tab 6: Farm goal. Choose why you farm and your main challenges.'
        : 'Aba 6: Objetivo da produção. Escolha para que você planta e os principais desafios.',
    },
  ];
}

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
    language,
    setAppLanguage,
    accessibility,
    activeFarmer,
    activeFarm,
    selectBahiaRegion,
    applyRegistrationSetup,
    toggleVoiceGuidance,
    speak,
  } = useAccessibility();
  const theme = getAppTheme(accessibility);
  const paramTabs = getParamTabs(language);

  const [stage, setStage] = useState<OnboardingStage>('mapa');
  const [activeParamIdx, setActiveParamIdx] = useState(0);
  const [gpsStatus, setGpsStatus] = useState<
    'idle' | 'locating' | 'found' | 'denied' | 'error'
  >('idle');
  const [gpsMatch, setGpsMatch] = useState<{
    region: BahiaRegionPreset;
    distanceKm: number;
  } | null>(null);
  const [gpsUserCoords, setGpsUserCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const [tratamento, setTratamento] = useState(
    accessibility.registrationCompleted ? activeFarmer?.tratamento ?? '' : ''
  );
  const [genero, setGenero] = useState<GenderOption>(
    activeFarmer?.genero ?? 'feminino'
  );
  const [faixaEtaria, setFaixaEtaria] = useState<'18-35' | '36-55' | '56+'>(
    activeFarmer?.faixaEtaria ?? '56+'
  );
  const [tempoAgricultura, setTempoAgricultura] = useState<FarmingTenureOption>(
    activeFarmer?.tempoAgriculturaFamiliar ?? 'mais_15'
  );
  const [farmPolygonDraft, setFarmPolygonDraft] = useState<GeoPoint[]>(
    activeFarm?.polygon && activeFarm.polygon.length >= 3
      ? activeFarm.polygon
      : createMicroPlotAroundPoint(
          activeFarm?.centroid ?? { latitude: -12.9714, longitude: -38.5014 },
          3.8
        )
  );
  const [lotesDraft, setLotesDraft] = useState<PlantingLot[]>([]);
  const [lotStepError, setLotStepError] = useState<string | null>(null);
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

  const currentTab = paramTabs[activeParamIdx];

  const detectRegionViaGps = useCallback(async () => {
    setGpsStatus('locating');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsStatus('denied');
        return;
      }

      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: 300000,
      }).catch(() => null);

      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 5500)
      );
      const currentPos =
        lastKnown ??
        (await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }).catch(() => null),
          timeoutPromise,
        ]));

      if (!currentPos) {
        setGpsStatus('error');
        return;
      }

      const coords = {
        latitude: currentPos.coords.latitude,
        longitude: currentPos.coords.longitude,
      };
      const match = findNearestRegion(coords, NORDESTE_REGIONS);
      setGpsUserCoords(coords);
      setGpsMatch(match);
      setGpsStatus('found');
      await selectBahiaRegion(match.region.id);
      setFarmPolygonDraft(createMicroPlotAroundPoint(match.region.centroid, 3.8));
      setLotesDraft([]);
      setLotStepError(null);
      speak(
        pickLang(
          language,
          `Location detected via GPS: ${match.region.nome}, in ${match.region.municipio}. Tap confirm if correct or choose another region on the map.`,
          `Local detectado pelo GPS: ${match.region.nome}, em ${match.region.municipio}. Toque em confirmar se estiver correto ou escolha outra região no mapa.`
        )
      );
    } catch {
      setGpsStatus('error');
    }
  }, [selectBahiaRegion, speak, language]);

  useEffect(() => {
    if (stage !== 'mapa' || gpsStatus !== 'idle') return undefined;
    const timer = setTimeout(() => {
      void detectRegionViaGps();
    }, 0);
    return () => clearTimeout(timer);
  }, [stage, gpsStatus, detectRegionViaGps]);

  const stageVoicePrompt =
    stage === 'mapa'
      ? pickLang(
          language,
          'First, confirm your GPS-detected region or tap another point on the Northeast map.',
          'Primeiro, confirme sua região detectada pelo GPS ou toque em outro ponto no mapa do Nordeste.'
        )
      : stage === 'demarcacao_fazenda'
      ? pickLang(
          language,
          'Tap the corners of your farm boundary on the zoomed-in map to calculate your land area.',
          'Toque nos cantos do terreno da sua fazenda no mapa com zoom para calcular a área.'
        )
      : stage === 'lotes'
      ? pickLang(
          language,
          'Enter how many planting plots are on your farm, outline each plot, and enter what is planted, whether it is monocropping or rotation, days planted, and harvest date.',
          'Informe quantos lotes de plantio existem na fazenda, demarque cada lote e diga o que está plantado, se é monocultura ou rotação, há quantos dias foi plantado e se já tem data de colheita.'
        )
      : currentTab.voice;

  useEffect(() => {
    if (!accessibility.voiceGuidanceEnabled) return;
    speak(stageVoicePrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, activeParamIdx]);

  const handleSelectRegion = async (reg: BahiaRegionPreset) => {
    await selectBahiaRegion(reg.id);
    const freshPoly = createMicroPlotAroundPoint(reg.centroid, 3.8);
    setFarmPolygonDraft(freshPoly);
    setLotesDraft([]);
    setLotStepError(null);
    speak(
      pickLang(
        language,
        `Selected region: ${reg.nome}, ${reg.municipio} - ${reg.estado}.`,
        `Região selecionada: ${reg.nome}, ${reg.municipio} - ${reg.estado}.`
      )
    );
  };

  const handleGoToFarmDemarcation = () => {
    if (activeFarm) {
      const m = calculatePolygonMetrics(farmPolygonDraft);
      const distLat = Math.abs(m.centroid.latitude - activeFarm.centroid.latitude);
      const distLon = Math.abs(m.centroid.longitude - activeFarm.centroid.longitude);
      if (farmPolygonDraft.length < 3 || distLat > 0.2 || distLon > 0.2) {
        const freshPoly = createMicroPlotAroundPoint(activeFarm.centroid, 3.8);
        setFarmPolygonDraft(freshPoly);
        setLotesDraft([]);
        setLotStepError(null);
      }
    }
    setStage('demarcacao_fazenda');
  };

  const toggleDesafio = (id: string) => {
    setDesafios((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleFinish = async () => {
    const farmMetrics = calculatePolygonMetrics(farmPolygonDraft);
    const primaryCulture =
      lotesDraft[0]?.culturaAtual ||
      pickLang(language, 'Cowpea + Cassava', 'Feijão-Caupi + Mandioca');
    if (activeFarmer) {
      await applyRegistrationSetup(
        {
          ...activeFarmer,
          tratamento:
            tratamento.trim() || pickLang(language, 'Farmer', 'Agricultor(a)'),
          nome: tratamento.trim() || activeFarmer.nome,
          genero,
          faixaEtaria,
          tempoAgriculturaFamiliar: tempoAgricultura,
          waterAccess,
          armazenamentoAgua: armazenamento,
          laborType,
          financialTier,
          objective,
          tamanhoEstimadoHa: farmMetrics.areaHectares,
          culturaDesejada: primaryCulture,
          desafiosPrincipais: desafios,
        },
        {
          polygon: farmPolygonDraft.length >= 3 ? farmPolygonDraft : undefined,
          lotes: lotesDraft,
          culturaPrincipal: primaryCulture,
        }
      );
    }
    speak(
      pickLang(
        language,
        `Registration completed! Opening the quick tutorial for your farm in ${
          activeFarm?.regiaoNome ?? 'Bahia'
        }.`,
        `Cadastro concluído! Abrindo o tutorial rápido da sua roça em ${
          activeFarm?.regiaoNome ?? 'Bahia'
        }.`
      )
    );
  };

  const progressPct =
    stage === 'mapa'
      ? 12
      : stage === 'demarcacao_fazenda'
      ? 26
      : stage === 'lotes'
      ? 42
      : Math.round(((activeParamIdx + 4) / (paramTabs.length + 3)) * 100);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      {/* Cabeçalho fixo */}
      <View style={styles.topHeader}>
        <View style={styles.topBar}>
          <View style={styles.titleStack}>
            <Text style={[styles.stepBadge, { color: theme.primary }]}>
              {stage === 'mapa'
                ? pickLang(language, 'Step 1 • Northeast Region', 'Etapa 1 • Região no Nordeste')
                : stage === 'demarcacao_fazenda'
                ? pickLang(language, 'Step 2 • Mark Farm Area', 'Etapa 2 • Demarcar Fazenda')
                : stage === 'lotes'
                ? pickLang(
                    language,
                    'Step 3 • Plots & Current Crops',
                    'Etapa 3 • Lotes e Culturas Atuais'
                  )
                : pickLang(
                    language,
                    `Step 4 • Profile (${activeParamIdx + 1}/${paramTabs.length})`,
                    `Etapa 4 • Perfil (${activeParamIdx + 1}/${paramTabs.length})`
                  )}
            </Text>
            <Text
              style={[
                styles.appName,
                { color: theme.text, fontSize: 20 * theme.scale },
              ]}
            >
              {stage === 'mapa'
                ? pickLang(language, 'Where is your farm?', 'Onde fica a sua roça?')
                : stage === 'demarcacao_fazenda'
                ? pickLang(language, 'Mark your farm boundary', 'Demarque a área da fazenda')
                : stage === 'lotes'
                ? pickLang(
                    language,
                    'Outline & register plantings',
                    'Demarcar e cadastrar plantios'
                  )
                : pickLang(language, 'Farmer Registration', 'Cadastro do Produtor')}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <LanguageTogglePill
              language={language}
              onSelect={setAppLanguage}
              theme={theme}
              compact
            />

            <Pressable
              onPress={() => speak(stageVoicePrompt, true)}
              style={[
                styles.listenStepBtn,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
              ]}
            >
              <Ionicons name="volume-medium" size={18} color={theme.primary} />
              <Text style={{ fontSize: 12, fontWeight: '800', color: theme.text }}>
                {pickLang(language, 'Listen', 'Ouvir')}
              </Text>
            </Pressable>

            <Pressable
              onPress={toggleVoiceGuidance}
              accessibilityLabel={pickLang(
                language,
                'Toggle voice guidance',
                'Alternar guia por voz'
              )}
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
                  {pickLang(language, 'Change location', 'Trocar local')}
                </Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsScroll}
            >
              {paramTabs.map((tabItem, idx) => {
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
        {stage === 'demarcacao_fazenda' ? (
          <FarmBoundaryStep
            regiaoNome={activeFarm?.regiaoNome ?? 'Recôncavo Baiano'}
            municipio={activeFarm?.municipio ?? 'Cruz das Almas'}
            estado={activeFarm?.estado ?? 'BA'}
            centroid={activeFarm?.centroid ?? { latitude: -12.9714, longitude: -38.5014 }}
            farmPolygon={farmPolygonDraft}
            onChangeFarmPolygon={setFarmPolygonDraft}
            onSpeak={(txt) => speak(txt)}
            theme={theme}
          />
        ) : stage === 'lotes' ? (
          <View style={{ gap: 10 }}>
            <FarmLotsStep
              farmPolygon={farmPolygonDraft}
              farmCentroid={calculatePolygonMetrics(farmPolygonDraft).centroid}
              lotes={lotesDraft}
              onChangeLotes={(next) => {
                setLotesDraft(next);
                if (lotStepError) setLotStepError(null);
              }}
              onSpeak={(txt) => speak(txt)}
              theme={theme}
            />
            {lotStepError && (
              <View
                style={{
                  borderRadius: 12,
                  borderWidth: 1.5,
                  padding: 12,
                  backgroundColor: theme.dangerBg,
                  borderColor: theme.dangerBorder,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: theme.dangerText }}>
                  {lotStepError}
                </Text>
              </View>
            )}
          </View>
        ) : stage === 'mapa' ? (
          <View
            style={[
              styles.mapCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            {/* Card de detecção automática por GPS com confirmação */}
            <View
              style={[
                styles.gpsBox,
                {
                  backgroundColor:
                    gpsStatus === 'found' ? theme.successBg : theme.surfaceMuted,
                  borderColor:
                    gpsStatus === 'found' ? theme.successBorder : theme.border,
                },
              ]}
            >
              <View style={styles.gpsHeaderRow}>
                {gpsStatus === 'locating' ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Ionicons
                    name={gpsStatus === 'found' ? 'navigate-circle' : 'locate-outline'}
                    size={22}
                    color={gpsStatus === 'found' ? theme.successText : theme.primary}
                  />
                )}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13 * theme.scale,
                      fontWeight: '900',
                      color: gpsStatus === 'found' ? theme.successText : theme.text,
                    }}
                  >
                    {gpsStatus === 'locating'
                      ? pickLang(
                          language,
                          'Detecting your region via GPS...',
                          'Detectando sua região pelo GPS...'
                        )
                      : gpsStatus === 'found' && gpsMatch
                      ? pickLang(
                          language,
                          `GPS detected: ${gpsMatch.region.nome} (${gpsMatch.region.estado})`,
                          `GPS detectou: ${gpsMatch.region.nome} (${gpsMatch.region.estado})`
                        )
                      : gpsStatus === 'denied'
                      ? pickLang(
                          language,
                          'GPS permission denied — select on the map below',
                          'GPS sem permissão — selecione no mapa abaixo'
                        )
                      : pickLang(
                          language,
                          'Use GPS to locate your region',
                          'Usar GPS para localizar sua região'
                        )}
                  </Text>
                  {gpsStatus === 'found' && gpsMatch && (
                    <Text
                      style={{
                        fontSize: 11 * theme.scale,
                        fontWeight: '700',
                        color: theme.textMuted,
                      }}
                    >
                      {pickLang(
                        language,
                        `Nearby hub: ${gpsMatch.region.municipio} (~${Math.round(
                          gpsMatch.distanceKm
                        )} km). Confirm or tap another region.`,
                        `Polo próximo: ${gpsMatch.region.municipio} (~${Math.round(
                          gpsMatch.distanceKm
                        )} km). Confirme ou toque em outra região.`
                      )}
                    </Text>
                  )}
                </View>

                <Pressable
                  onPress={() => void detectRegionViaGps()}
                  disabled={gpsStatus === 'locating'}
                  style={[
                    styles.gpsRetryBtn,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <Ionicons name="refresh" size={15} color={theme.primary} />
                  <Text style={{ fontSize: 11, fontWeight: '800', color: theme.primary }}>
                    GPS
                  </Text>
                </Pressable>
              </View>

              {gpsStatus === 'found' &&
                gpsMatch &&
                activeFarm?.regiaoNome === gpsMatch.region.nome && (
                  <Pressable
                    onPress={handleGoToFarmDemarcation}
                    style={[styles.gpsConfirmBtn, { backgroundColor: theme.primary }]}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={theme.primaryText}
                    />
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '900',
                        color: theme.primaryText,
                      }}
                    >
                      {pickLang(
                        language,
                        'Confirm detected region and continue',
                        'Confirmar região detectada e continuar'
                      )}
                    </Text>
                  </Pressable>
                )}
            </View>

            <NordesteSvgMap
              selectedRegionName={activeFarm?.regiaoNome ?? 'Recôncavo Baiano'}
              gpsDetectedRegionId={gpsMatch?.region.id ?? null}
              gpsUserCoords={gpsUserCoords}
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
                {pickLang(language, 'Selected:', 'Selecionado:')} {activeFarm?.regiaoNome} (
                {activeFarm?.municipio} - {activeFarm?.estado}) •{' '}
                {pickLang(language, 'Biome', 'Bioma')}{' '}
                {localizeBiome(activeFarm?.bioma ?? 'Caatinga', language)}
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

            {/* TAB 1: NAME & GENDER */}
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
                      {pickLang(
                        language,
                        'Name (how you prefer to be addressed)',
                        'Nome (como prefere ser chamado/a)'
                      )}
                    </Text>
                  </View>
                  <TextInput
                    value={tratamento}
                    onChangeText={setTratamento}
                    placeholder={pickLang(
                      language,
                      'e.g., Dona Maria, Seu João...',
                      'Ex.: Dona Maria, Seu João...'
                    )}
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

                <Text style={[styles.groupTitle, { color: theme.text }]}>
                  {pickLang(language, 'Gender:', 'Gênero:')}
                </Text>
                {(
                  [
                    {
                      id: 'feminino',
                      icon: 'female-outline',
                      titleEn: 'Female',
                      titlePt: 'Feminino',
                      subEn: 'Female farmer / Rural worker',
                      subPt: 'Agricultora / Trabalhadora rural',
                    },
                    {
                      id: 'masculino',
                      icon: 'male-outline',
                      titleEn: 'Male',
                      titlePt: 'Masculino',
                      subEn: 'Male farmer / Rural worker',
                      subPt: 'Agricultor / Trabalhador rural',
                    },
                    {
                      id: 'nao_binario',
                      icon: 'person-outline',
                      titleEn: 'Other / Non-binary',
                      titlePt: 'Outro / Não-binário',
                      subEn: 'Self-identification',
                      subPt: 'Identificação livre',
                    },
                    {
                      id: 'prefiro_nao_informar',
                      icon: 'shield-outline',
                      titleEn: 'Prefer not to say',
                      titlePt: 'Prefiro não informar',
                      subEn: 'Optional in local profile',
                      subPt: 'Opcional no cadastro local',
                    },
                  ] as const
                ).map((opt) => (
                  <BigOptionCard
                    key={opt.id}
                    selected={genero === opt.id}
                    icon={opt.icon}
                    title={pickLang(language, opt.titleEn, opt.titlePt)}
                    subtitle={pickLang(language, opt.subEn, opt.subPt)}
                    onPress={() => setGenero(opt.id)}
                    theme={theme}
                  />
                ))}

                <Text style={[styles.groupTitle, { color: theme.text, marginTop: 6 }]}>
                  {pickLang(language, 'Age group:', 'Faixa de idade:')}
                </Text>
                {(
                  [
                    {
                      id: '18-35',
                      icon: 'leaf-outline',
                      titleEn: '18 to 35 years',
                      titlePt: '18 a 35 anos',
                      subEn: 'Young farmer',
                      subPt: 'Agricultura jovem',
                    },
                    {
                      id: '36-55',
                      icon: 'sunny-outline',
                      titleEn: '36 to 55 years',
                      titlePt: '36 a 55 anos',
                      subEn: 'Active field experience',
                      subPt: 'Experiência ativa no campo',
                    },
                    {
                      id: '56+',
                      icon: 'heart-outline',
                      titleEn: '56 years or older',
                      titlePt: '56 anos ou mais',
                      subEn: 'Clear text and calm voice guidance',
                      subPt: 'Letras claras e guia com voz calma',
                    },
                  ] as const
                ).map((opt) => (
                  <BigOptionCard
                    key={opt.id}
                    selected={faixaEtaria === opt.id}
                    icon={opt.icon}
                    title={pickLang(language, opt.titleEn, opt.titlePt)}
                    subtitle={pickLang(language, opt.subEn, opt.subPt)}
                    onPress={() => setFaixaEtaria(opt.id)}
                    theme={theme}
                  />
                ))}
              </>
            )}

            {/* TAB 2: TIME IN FAMILY FARMING */}
            {currentTab.key === 'terra_tempo' && (
              <>
                <Text style={[styles.groupTitle, { color: theme.text }]}>
                  {pickLang(
                    language,
                    'Time in family farming:',
                    'Tempo na agricultura familiar:'
                  )}
                </Text>
                {(
                  [
                    {
                      id: 'menos_2',
                      icon: 'sparkles-outline',
                      titleEn: 'Less than 2 years',
                      titlePt: 'Menos de 2 anos',
                      subEn: 'Starting or returning to farming',
                      subPt: 'Iniciando ou retornando para a roça',
                    },
                    {
                      id: '2_a_5',
                      icon: 'leaf-outline',
                      titleEn: '2 to 5 years',
                      titlePt: '2 a 5 anos',
                      subEn: 'Building experience over recent harvests',
                      subPt: 'Construindo experiência nas últimas safras',
                    },
                    {
                      id: '5_a_15',
                      icon: 'calendar-outline',
                      titleEn: '5 to 15 years',
                      titlePt: '5 a 15 anos',
                      subEn: 'Knows local rain and drought cycles well',
                      subPt: 'Conhece bem os ciclos de chuva e seca',
                    },
                    {
                      id: 'mais_15',
                      icon: 'ribbon-outline',
                      titleEn: 'More than 15 years',
                      titlePt: 'Mais de 15 anos',
                      subEn: 'Tradition and wisdom on family land',
                      subPt: 'Tradição e sabedoria na terra da família',
                    },
                  ] as const
                ).map((opt) => (
                  <BigOptionCard
                    key={opt.id}
                    selected={tempoAgricultura === opt.id}
                    icon={opt.icon}
                    title={pickLang(language, opt.titleEn, opt.titlePt)}
                    subtitle={pickLang(language, opt.subEn, opt.subPt)}
                    onPress={() => setTempoAgricultura(opt.id)}
                    theme={theme}
                  />
                ))}
              </>
            )}

            {/* TAB 3: WATER ACCESS */}
            {currentTab.key === 'agua' && (
              <>
                <Text style={[styles.groupTitle, { color: theme.text }]}>
                  {pickLang(
                    language,
                    'Main water source for crops:',
                    'Principal fonte de água para a plantação:'
                  )}
                </Text>
                {(
                  [
                    {
                      id: 'sequeiro',
                      icon: 'rainy-outline',
                      titleEn: 'Rainfed (rainfall only)',
                      titlePt: 'Sequeiro (só água da chuva)',
                      subEn: 'Depends on rainy season and soil moisture',
                      subPt: 'Depende do inverno e da umidade do solo',
                    },
                    {
                      id: 'cisterna',
                      icon: 'water-outline',
                      titleEn: 'Cistern / Catchment Pond',
                      titlePt: 'Cisterna / Barreiro',
                      subEn: 'Stored runoff or roof-harvested water',
                      subPt: 'Água guardada da enxurrada ou calha',
                    },
                    {
                      id: 'acude',
                      icon: 'boat-outline',
                      titleEn: 'Dam / River / Stream',
                      titlePt: 'Açude / Rio / Riacho',
                      subEn: 'Surface intake near the property',
                      subPt: 'Captação próxima ao terreno',
                    },
                    {
                      id: 'poco_artesiano',
                      icon: 'disc-outline',
                      titleEn: 'Artesian Well / Shallow Well',
                      titlePt: 'Poço Artesiano / Cacimba',
                      subEn: 'Groundwater (SIAGAS)',
                      subPt: 'Água subterrânea (SIAGAS)',
                    },
                    {
                      id: 'irrigacao',
                      icon: 'sparkles-outline',
                      titleEn: 'Irrigation / Drip System',
                      titlePt: 'Irrigação / Gotejamento',
                      subEn: 'Installed irrigation system on plot',
                      subPt: 'Sistema instalado na área',
                    },
                  ] as const
                ).map((opt) => (
                  <BigOptionCard
                    key={opt.id}
                    selected={waterAccess === opt.id}
                    icon={opt.icon}
                    title={pickLang(language, opt.titleEn, opt.titlePt)}
                    subtitle={pickLang(language, opt.subEn, opt.subPt)}
                    onPress={() => setWaterAccess(opt.id)}
                    theme={theme}
                  />
                ))}

                <Text style={[styles.groupTitle, { color: theme.text, marginTop: 8 }]}>
                  {pickLang(
                    language,
                    'Water storage on property:',
                    'Reserva de água na propriedade:'
                  )}
                </Text>
                {(
                  [
                    {
                      id: 'cisterna_placa',
                      icon: 'cube-outline',
                      titleEn: 'Precast Slab Cistern',
                      titlePt: 'Cisterna de placa',
                    },
                    {
                      id: 'barreiro',
                      icon: 'layers-outline',
                      titleEn: 'Earthen Pond / Rock Tank',
                      titlePt: 'Barreiro / Tanque de pedra',
                    },
                    {
                      id: 'caixa_dagua',
                      icon: 'beaker-outline',
                      titleEn: 'Water Tank / Drum',
                      titlePt: "Caixa d'água / Tambor",
                    },
                    {
                      id: 'nenhum',
                      icon: 'alert-circle-outline',
                      titleEn: 'No reservoir yet',
                      titlePt: 'Sem reservatório ainda',
                    },
                  ] as const
                ).map((opt) => (
                  <BigOptionCard
                    key={opt.id}
                    selected={armazenamento === opt.id}
                    icon={opt.icon}
                    title={pickLang(language, opt.titleEn, opt.titlePt)}
                    onPress={() => setArmazenamento(opt.id)}
                    theme={theme}
                  />
                ))}
              </>
            )}

            {/* TAB 4: WORKFORCE */}
            {currentTab.key === 'trabalho' && (
              <>
                <Text style={[styles.groupTitle, { color: theme.text }]}>
                  {pickLang(
                    language,
                    'Who handles farm labor:',
                    'Quem faz o trabalho na roça:'
                  )}
                </Text>
                {(
                  [
                    {
                      id: 'familiar',
                      icon: 'people-outline',
                      titleEn: 'Family labor / hand tools',
                      titlePt: 'Trabalho familiar / enxada',
                      subEn: 'Labor from the household itself',
                      subPt: 'Mão de obra da própria família',
                    },
                    {
                      id: 'mutirao_diarista',
                      icon: 'hand-left-outline',
                      titleEn: 'Community work / day laborer',
                      titlePt: 'Mutirão ou diarista',
                      subEn: 'Day swaps with neighbors or hired help',
                      subPt: 'Troca de dias com vizinhos ou ajuda paga',
                    },
                    {
                      id: 'tracao_animal',
                      icon: 'trail-sign-outline',
                      titleEn: 'Animal traction',
                      titlePt: 'Tração animal',
                      subEn: 'Plowing or transport using animals',
                      subPt: 'Arado ou transporte com animal',
                    },
                    {
                      id: 'maquinario',
                      icon: 'construct-outline',
                      titleEn: 'Tractor / Machinery',
                      titlePt: 'Trator / Maquinário',
                      subEn: 'Own or cooperative tractor hours',
                      subPt: 'Hora de trator própria ou da associação',
                    },
                  ] as const
                ).map((opt) => (
                  <BigOptionCard
                    key={opt.id}
                    selected={laborType === opt.id}
                    icon={opt.icon}
                    title={pickLang(language, opt.titleEn, opt.titlePt)}
                    subtitle={pickLang(language, opt.subEn, opt.subPt)}
                    onPress={() => setLaborType(opt.id)}
                    theme={theme}
                  />
                ))}
              </>
            )}

            {/* TAB 5: FINANCIAL SITUATION */}
            {currentTab.key === 'financeiro' && (
              <>
                <Text style={[styles.groupTitle, { color: theme.text }]}>
                  {pickLang(
                    language,
                    'What is your financial setup for planting?',
                    'Qual é a sua situação financeira para plantar?'
                  )}
                </Text>
                {(
                  [
                    {
                      id: 'recursos_proprios',
                      icon: 'wallet-outline',
                      titleEn: 'Own funds (no debt)',
                      titlePt: 'Recurso próprio (sem dívida)',
                      subEn: 'Prioritize zero or low-cost practices',
                      subPt: 'Prioridade para soluções de baixo ou nenhum custo',
                    },
                    {
                      id: 'pronaf',
                      icon: 'business-outline',
                      titleEn: 'PRONAF (Family Farming Credit)',
                      titlePt: 'PRONAF (Agricultura Familiar)',
                      subEn: 'Rural credit supported by technical report in app',
                      subPt: 'Financiamento rural com laudo técnico no app',
                    },
                    {
                      id: 'programa_social',
                      icon: 'ribbon-outline',
                      titleEn: 'Garantia-Safra / PAA / Public Support',
                      titlePt: 'Garantia-Safra / PAA / Apoio Social',
                      subEn: 'Drought insurance and institutional sales',
                      subPt: 'Segurança na estiagem e venda pública',
                    },
                    {
                      id: 'emprestimo_local',
                      icon: 'card-outline',
                      titleEn: 'Co-op / Local Credit Union',
                      titlePt: 'Crédito em cooperativa / associação',
                      subEn: 'Local co-op or community bank financing',
                      subPt: 'Apoio de cooperativa ou banco local',
                    },
                  ] as const
                ).map((opt) => (
                  <BigOptionCard
                    key={opt.id}
                    selected={financialTier === opt.id}
                    icon={opt.icon}
                    title={pickLang(language, opt.titleEn, opt.titlePt)}
                    subtitle={pickLang(language, opt.subEn, opt.subPt)}
                    onPress={() => setFinancialTier(opt.id)}
                    theme={theme}
                  />
                ))}
              </>
            )}

            {/* TAB 6: GOAL & CHALLENGES */}
            {currentTab.key === 'objetivo' && (
              <>
                <Text style={[styles.groupTitle, { color: theme.text }]}>
                  {pickLang(
                    language,
                    'Why do you mainly farm?',
                    'Para que você planta principalmente?'
                  )}
                </Text>
                {(
                  [
                    {
                      id: 'subsistencia',
                      icon: 'restaurant-outline',
                      titleEn: 'Family food (subsistence)',
                      titlePt: 'Comida da família (subsistência)',
                      subEn: 'Focus on reliable year-round household food',
                      subPt: 'Foco em alimento seguro o ano inteiro',
                    },
                    {
                      id: 'misto',
                      icon: 'basket-outline',
                      titleEn: 'Household food + Local market sales',
                      titlePt: 'Consumo da casa + Venda na feira',
                      subEn: 'Feeds the family and sells surplus',
                      subPt: 'Garante a mesa e vende o excedente',
                    },
                    {
                      id: 'comercial',
                      icon: 'trending-up-outline',
                      titleEn: 'Commercial / Co-op / Market',
                      titlePt: 'Venda / Cooperativa / Mercado',
                      subEn: 'Yield per hectare and harvest margin',
                      subPt: 'Rendimento por hectare e margem de safra',
                    },
                  ] as const
                ).map((opt) => (
                  <BigOptionCard
                    key={opt.id}
                    selected={objective === opt.id}
                    icon={opt.icon}
                    title={pickLang(language, opt.titleEn, opt.titlePt)}
                    subtitle={pickLang(language, opt.subEn, opt.subPt)}
                    onPress={() => setObjective(opt.id)}
                    theme={theme}
                  />
                ))}

                <Text style={[styles.groupTitle, { color: theme.text, marginTop: 8 }]}>
                  {pickLang(
                    language,
                    'Biggest challenges today (select all that apply):',
                    'Maiores desafios hoje (pode marcar vários):'
                  )}
                </Text>
                {[
                  {
                    id: 'seca',
                    icon: 'sunny-outline' as const,
                    titleEn: 'Drought / irregular rainfall',
                    titlePt: 'Seca / chuva irregular',
                  },
                  {
                    id: 'erosao',
                    icon: 'layers-outline' as const,
                    titleEn: 'Depleted soil or flash runoff',
                    titlePt: 'Terra fraca ou enxurrada',
                  },
                  {
                    id: 'pragas',
                    icon: 'bug-outline' as const,
                    titleEn: 'Pests and diseased leaves',
                    titlePt: 'Pragas e folhas doentes',
                  },
                  {
                    id: 'agua',
                    icon: 'water-outline' as const,
                    titleEn: 'Water scarcity / deep wells',
                    titlePt: 'Falta de água / poço fundo',
                  },
                  {
                    id: 'venda',
                    icon: 'cash-outline' as const,
                    titleEn: 'Low prices or market access',
                    titlePt: 'Preço baixo ou escoamento',
                  },
                ].map((opt) => (
                  <BigOptionCard
                    key={opt.id}
                    selected={desafios.includes(opt.id)}
                    icon={opt.icon}
                    title={pickLang(language, opt.titleEn, opt.titlePt)}
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
              onPress={handleGoToFarmDemarcation}
              style={[styles.nextBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.nextText, { color: theme.primaryText }]}>
                {pickLang(
                  language,
                  'Confirm location & outline land',
                  'Confirmar local e demarcar terreno'
                )}
              </Text>
              <Ionicons name="arrow-forward" size={20} color={theme.primaryText} />
            </Pressable>
          </>
        ) : stage === 'demarcacao_fazenda' ? (
          <>
            <Pressable
              onPress={() => setStage('mapa')}
              style={[
                styles.backBtn,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
              ]}
            >
              <Ionicons name="arrow-back" size={20} color={theme.text} />
              <Text style={[styles.backText, { color: theme.text }]}>
                {pickLang(language, 'Region', 'Região')}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                if (farmPolygonDraft.length < 3) {
                  handleGoToFarmDemarcation();
                  return;
                }
                setLotStepError(null);
                setStage('lotes');
              }}
              style={[styles.nextBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.nextText, { color: theme.primaryText }]}>
                {pickLang(
                  language,
                  'Next: planting plots',
                  'Avançar para lotes de plantio'
                )}
              </Text>
              <Ionicons name="arrow-forward" size={20} color={theme.primaryText} />
            </Pressable>
          </>
        ) : stage === 'lotes' ? (
          <>
            <Pressable
              onPress={() => {
                setLotStepError(null);
                setStage('demarcacao_fazenda');
              }}
              style={[
                styles.backBtn,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
              ]}
            >
              <Ionicons name="arrow-back" size={20} color={theme.text} />
              <Text style={[styles.backText, { color: theme.text }]}>
                {pickLang(language, 'Farm', 'Fazenda')}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                if (lotesDraft.length === 0) {
                  const msg = pickLang(
                    language,
                    'Select how many plots are on your farm (or tap Add plot) before continuing.',
                    'Selecione quantos lotes tem na sua fazenda (ou toque em Adicionar lote) antes de continuar.'
                  );
                  setLotStepError(msg);
                  speak(msg);
                  return;
                }
                const undemarcated = lotesDraft.find((lot) => lot.polygon.length < 3);
                if (undemarcated) {
                  const msg = pickLang(
                    language,
                    `Outline the area for "${undemarcated.nome}" on the map (at least 3 points inside your farm boundary) before continuing.`,
                    `Demarque a área de "${undemarcated.nome}" no mapa (mínimo 3 pontos dentro do terreno) antes de avançar.`
                  );
                  setLotStepError(msg);
                  speak(msg);
                  return;
                }
                setLotStepError(null);
                setStage('cadastro');
                setActiveParamIdx(0);
              }}
              style={[styles.nextBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.nextText, { color: theme.primaryText }]}>
                {pickLang(
                  language,
                  'Next: farmer profile',
                  'Ir para dados do produtor'
                )}
              </Text>
              <Ionicons name="arrow-forward" size={20} color={theme.primaryText} />
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              onPress={() => {
                if (activeParamIdx === 0) setStage('lotes');
                else setActiveParamIdx((i) => Math.max(0, i - 1));
              }}
              style={[
                styles.backBtn,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
              ]}
            >
              <Ionicons name="arrow-back" size={20} color={theme.text} />
              <Text style={[styles.backText, { color: theme.text }]}>
                {activeParamIdx === 0
                  ? pickLang(language, 'Plots', 'Lotes')
                  : pickLang(language, 'Previous', 'Anterior')}
              </Text>
            </Pressable>

            {activeParamIdx < paramTabs.length - 1 ? (
              <Pressable
                onPress={() =>
                  setActiveParamIdx((i) => Math.min(paramTabs.length - 1, i + 1))
                }
                style={[styles.nextBtn, { backgroundColor: theme.primary }]}
              >
                <Text style={[styles.nextText, { color: theme.primaryText }]}>
                  {pickLang(language, 'Next tab', 'Próxima aba')}
                </Text>
                <Ionicons name="arrow-forward" size={20} color={theme.primaryText} />
              </Pressable>
            ) : (
              <Pressable
                onPress={handleFinish}
                style={[styles.nextBtn, { backgroundColor: theme.primary }]}
              >
                <Text style={[styles.nextText, { color: theme.primaryText }]}>
                  {pickLang(language, 'Finish registration', 'Concluir cadastro')}
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
  gpsBox: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 10,
    gap: 8,
  },
  gpsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gpsRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  gpsConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    minHeight: 42,
  },
});
