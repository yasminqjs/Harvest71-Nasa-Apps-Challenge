import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { VoiceReadBar } from '../components/VoiceReadBar';
import { useAccessibility } from '../context/AccessibilityContext';
import { useLanguage } from '../i18n/Language';
import { Pressable, Text } from '../i18n/native';
import { useResponsiveLayout } from '../theme/responsive';
import { getAppTheme } from '../theme/tokens';

type PipelineStepId =
  | 'overview'
  | 'weather'
  | 'soil'
  | 'climate'
  | 'satellite'
  | 'dssat';

interface MappingRow {
  sourceField: string;
  targetField: string;
  rule: string;
}

interface PipelineStep {
  id: PipelineStepId;
  order: string;
  icon: keyof typeof Ionicons.glyphMap;
  titleEn: string;
  titlePt: string;
  subtitleEn: string;
  subtitlePt: string;
  provenanceTagEn: string;
  provenanceTagPt: string;
  sourcesEn: string;
  sourcesPt: string;
  summaryEn: string;
  summaryPt: string;
  stepsEn: string[];
  stepsPt: string[];
  mappingsEn: MappingRow[];
  mappingsPt: MappingRow[];
  caveatEn: string;
  caveatPt: string;
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: 'overview',
    order: '01',
    icon: 'layers-outline',
    titleEn: 'Architecture & Data Hygiene',
    titlePt: 'Arquitetura e Higienização de Dados',
    subtitleEn: 'Traceability, offline cache & privacy rules',
    subtitlePt: 'Rastreabilidade, cache offline e regras de privacidade',
    provenanceTagEn: 'DATA • DERIVED • ASSUMPTION',
    provenanceTagPt: 'DADO • DERIVADO • SUPOSIÇÃO',
    sourcesEn: 'NASA POWER · Embrapa PronaSolos · Sentinel-2 · Landsat TIRS · NASADEM · IBGE',
    sourcesPt: 'NASA POWER · Embrapa PronaSolos · Sentinel-2 · Landsat TIRS · NASADEM · IBGE',
    summaryEn:
      'Every parameter sent to the agronomic models is classified into observed DATA (NASA/Embrapa), DERIVED values (documented formulas), or ASSUMPTIONs (scenario choices), keeping the cloud API decoupled from private storage.',
    summaryPt:
      'Cada parâmetro enviado aos modelos agronômicos é classificado em DADO observado (NASA/Embrapa), DERIVADO (fórmula documentada) ou SUPOSIÇÃO (escolha de cenário), mantendo a API separada do armazenamento privado.',
    stepsEn: [
      'Coordinates only: plot simulation routes receive latitude/longitude, crop selection, and optional lab soil values — never farmer identity or raw history.',
      'All DSSAT text fields are normalized to pure ASCII (accent removal) because DSSAT-CSM 4.8.6 reads fixed-width byte columns.',
      'Strict source hygiene: datasets, cultivars, and climate models are audited to exclude restricted sources before catalog compilation.',
      'On-device SQLite + audited regional NASA caches allow field inspection and leaf analysis even with zero internet connection.',
    ],
    stepsPt: [
      'Apenas coordenadas: as rotas de simulação recebem latitude/longitude, cultura e análise de solo opcional — nunca identidade do agricultor nem histórico bruto.',
      'Todo texto gravado para o DSSAT é normalizado em ASCII puro (sem acentos), pois o DSSAT-CSM 4.8.6 lê colunas com largura fixa em bytes.',
      'Higiene estrita de fontes: conjuntos de dados, cultivares e modelos climáticos passam por auditoria antes de entrar no catálogo.',
      'SQLite local e caches auditados regionais da NASA permitem consultas de campo e exame de folha mesmo sem internet.',
    ],
    mappingsEn: [
      { sourceField: 'UTF-8 Names', targetField: 'ASCII Fixed-Width', rule: 'NFKD + strip accents for DSSAT' },
      { sourceField: 'Farm Plot', targetField: 'Centroid Lat/Lon', rule: 'Only coordinates leave device' },
      { sourceField: 'All Inputs', targetField: 'provenance[]', rule: 'Tagged DATA / DERIVED / ASSUMPTION' },
    ],
    mappingsPt: [
      { sourceField: 'Nomes UTF-8', targetField: 'ASCII Largura Fixa', rule: 'NFKD sem acentos para o DSSAT' },
      { sourceField: 'Talhão', targetField: 'Centroide Lat/Lon', rule: 'Só coordenadas saem do aparelho' },
      { sourceField: 'Entradas', targetField: 'provenance[]', rule: 'Etiqueta DADO / DERIVADO / SUPOSIÇÃO' },
    ],
    caveatEn:
      'Outputs are exploratory relative comparisons designed to support planning alongside farmer knowledge and local extension technicians (EMATER/BAHIATER).',
    caveatPt:
      'Os resultados são comparações relativas exploratórias para apoiar decisões junto ao saber do agricultor e de técnicos da extensão rural (EMATER/BAHIATER).',
  },
  {
    id: 'weather',
    order: '02',
    icon: 'partly-sunny-outline',
    titleEn: 'Weather Series -> .WTH Files',
    titlePt: 'Série Climática -> Arquivos .WTH',
    subtitleEn: 'NASA POWER daily cleaning & gap handling',
    subtitlePt: 'Limpeza diária e preenchimento de falhas NASA POWER',
    provenanceTagEn: 'DATA + DERIVED (GAP FILL)',
    provenanceTagPt: 'DADO + DERIVADO (LACUNAS)',
    sourcesEn: 'NASA POWER Agroclimatology (AG Community daily JSON)',
    sourcesPt: 'NASA POWER Agroclimatologia (JSON diário comunidade AG)',
    summaryEn:
      'Daily meteorological variables from NASA POWER are validated against fill values (-999), unit-converted, trimmed to complete records, and formatted into annual DSSAT .WTH weather stations.',
    summaryPt:
      'Variáveis meteorológicas diárias da NASA POWER são validadas contra valores nulos (-999), convertidas de unidade, cortadas no último dia completo e gravadas em arquivos anuais .WTH.',
    stepsEn: [
      'Maps POWER keys to DSSAT columns: solar radiation (ALLSKY_SFC_SW_DWN), Tmax, Tmin, bias-corrected rain (PRECTOTCORR), dew point, relative humidity, and wind speed (converted m/s -> km/day via × 86.4).',
      'Short gaps (≤ 5 consecutive days) in radiation, temperature, dew point, humidity, or wind are linearly interpolated between adjacent valid days.',
      'Missing rainfall days are never fabricated: gaps > 5 days or missing rain trim the series at the last complete day.',
      'Calculates long-term annual mean temperature (TAV) and monthly amplitude (AMP) headers, writing one <INSI><YY>01.WTH file per year with YYDDD dates.',
    ],
    stepsPt: [
      'Mapeia variáveis POWER para colunas DSSAT: radiação solar (ALLSKY_SFC_SW_DWN), Tmáx, Tmín, chuva corrigida (PRECTOTCORR), ponto de orvalho, umidade relativa e vento (m/s -> km/dia via × 86,4).',
      'Falhas curtas (≤ 5 dias seguidos) em radiação, temperatura, orvalho, umidade ou vento usam interpolação linear entre dias vizinhos.',
      'Dias sem chuva nunca são inventados: falhas > 5 dias ou falta de chuva encerram a série no último dia completo.',
      'Calcula cabeçalhos de média anual (TAV) e amplitude mensal (AMP), gerando um arquivo <INSI><AA>01.WTH por ano no formato AADDD.',
    ],
    mappingsEn: [
      { sourceField: 'PRECTOTCORR', targetField: 'RAIN (mm/day)', rule: 'Required; no synthetic fill' },
      { sourceField: 'WS2M (m/s)', targetField: 'WIND (km/day)', rule: 'Multiplied by 86.4' },
      { sourceField: 'T2M_MAX/MIN', targetField: 'TAV & AMP', rule: 'Long-term monthly climate means' },
    ],
    mappingsPt: [
      { sourceField: 'PRECTOTCORR', targetField: 'RAIN (mm/dia)', rule: 'Obrigatório; sem preenchimento artificial' },
      { sourceField: 'WS2M (m/s)', targetField: 'WIND (km/dia)', rule: 'Multiplicado por 86,4' },
      { sourceField: 'T2M_MAX/MIN', targetField: 'TAV & AMP', rule: 'Médias mensais de longo prazo' },
    ],
    caveatEn:
      'NASA POWER grid cells represent regional meteorology (~0.5°), so local micro-storms or hail at sub-kilometer scale require on-farm rain gauges.',
    caveatPt:
      'As células da grade NASA POWER representam meteorologia regional (~0,5°), portanto chuvas muito localizadas pedem conferência com pluviômetro na propriedade.',
  },
  {
    id: 'soil',
    order: '03',
    icon: 'earth-outline',
    titleEn: 'Soil Profile -> .SOL & Pedotransfer',
    titlePt: 'Perfil de Solo -> .SOL e Pedotransferência',
    subtitleEn: 'PronaSolos 90 m horizons + Saxton & Rawls',
    subtitlePt: 'Horizontes PronaSolos 90 m + Saxton & Rawls',
    provenanceTagEn: 'DATA + DERIVED (HYDRAULICS)',
    provenanceTagPt: 'DADO + DERIVADO (HIDRÁULICA)',
    sourcesEn: 'Embrapa / SGB PronaSolos (90 m) + Optional Farmer Soil Lab',
    sourcesPt: 'Embrapa / SGB PronaSolos (90 m) + Laudo Opcional do Produtor',
    summaryEn:
      'Six vertical soil depth layers are extracted from PronaSolos 90 m maps, optionally updated with user laboratory test values, and converted into hydraulic retention curves via USDA-ARS Saxton & Rawls equations.',
    summaryPt:
      'Seis camadas verticais de profundidade são extraídas do mapa PronaSolos (90 m), atualizadas opcionalmente pelo laudo do produtor e convertidas em curvas de retenção hídrica via equações Saxton & Rawls.',
    stepsEn: [
      'Reads 6 standard PronaSolos depth intervals: 0–5, 5–15, 15–30, 30–60, 60–100, and 100–200 cm.',
      'Extracts sand, silt, clay, organic carbon, cation exchange capacity (CEC), water pH, and electrical conductivity in SI units (g/kg, cmolc/kg, dS/m).',
      'Because PronaSolos does not provide bulk density or water limits, Saxton & Rawls (2006) pedotransfer equations derive Lower Limit (LL), Drained Upper Limit (DUL), and Saturation (SAT).',
      'If the user submits a laboratory soil sample, surface horizons override the regional estimate while deeper layers remain anchored to PronaSolos.',
    ],
    stepsPt: [
      'Lê 6 camadas padrão do PronaSolos: 0–5, 5–15, 15–30, 30–60, 60–100 e 100–200 cm.',
      'Extrai areia, silte, argila, carbono orgânico, CTC, pH em água e condutividade elétrica nas unidades originais (g/kg, cmolc/kg, dS/m).',
      'Como o PronaSolos não informa densidade nem retenção de água, as equações de Saxton & Rawls (2006) derivam ponto de murcha (LL), capacidade de campo (DUL) e saturação (SAT).',
      'Se o produtor informar análise laboratorial, as camadas superficiais substituem a estimativa regional mantendo o subsolo ancorado no PronaSolos.',
    ],
    mappingsEn: [
      { sourceField: 'Sand/Clay/OC', targetField: 'LL · DUL · SAT', rule: 'Saxton & Rawls (2006, USDA-ARS)' },
      { sourceField: '6 Depths', targetField: '0–200 cm Profile', rule: 'Mapped to DSSAT .SOL horizons' },
      { sourceField: 'Lab Override', targetField: 'Surface Layers', rule: 'Replaces default surface texture/pH' },
    ],
    mappingsPt: [
      { sourceField: 'Areia/Argila/CO', targetField: 'LL · DUL · SAT', rule: 'Saxton & Rawls (2006, USDA-ARS)' },
      { sourceField: '6 Profundidades', targetField: 'Perfil 0–200 cm', rule: 'Convertido em horizontes .SOL' },
      { sourceField: 'Laudo Local', targetField: 'Camadas Superficiais', rule: 'Sobrescreve textura e pH de superfície' },
    ],
    caveatEn:
      'Standard albedo, drainage, and runoff curve defaults are assumed whenever plot-level infiltration measurements are absent.',
    caveatPt:
      'Albedo, drenagem e curva de escoamento padrão são assumidos na ausência de ensaios locais de infiltração.',
  },
  {
    id: 'climate',
    order: '04',
    icon: 'thermometer-outline',
    titleEn: 'Future Climate (Delta Factor)',
    titlePt: 'Clima Futuro (Fator Delta)',
    subtitleEn: 'NASA NEX-GDDP-CMIP6 bias cancellation',
    subtitlePt: 'Cancelamento de viés NASA NEX-GDDP-CMIP6',
    provenanceTagEn: 'DERIVED CLIMATE PROJECTION',
    provenanceTagPt: 'PROJEÇÃO CLIMÁTICA DERIVADA',
    sourcesEn: 'NASA NEX-GDDP-CMIP6 v2.0 (NCCS THREDDS, 0.25° daily)',
    sourcesPt: 'NASA NEX-GDDP-CMIP6 v2.0 (NCCS THREDDS, diário 0,25°)',
    summaryEn:
      'Instead of feeding raw global climate model days (which carry systematic bias), the pipeline applies monthly 20-year delta "change factors" directly onto the local observed NASA POWER series.',
    summaryPt:
      'Em vez de usar dias brutos de modelos globais (sujeitos a viés sistemático), o sistema aplica deltas mensais de 20 anos diretamente sobre a série observada da NASA POWER do ponto.',
    stepsEn: [
      'Compares each climate model’s 20-year monthly averages between historical baseline (1995–2014) and target window (e.g., 2041–2060) across SSP1-2.6, SSP2-4.5, SSP3-7.0, or SSP5-8.5.',
      'Temperature change (ΔTmax, ΔTmin in °C) is added to each matching calendar month in the local NASA POWER series.',
      'Rainfall and solar radiation changes are applied multiplicatively using monthly ratios so current vs future runs remain directly comparable.',
      'Allowed climate models (NASA GISS, NOAA GFDL, MPI, MRI, CSIRO, CNRM, IPSL, NorESM) exclude restricted institutional sources.',
    ],
    stepsPt: [
      'Compara médias mensais de 20 anos de cada modelo climático entre o histórico (1995–2014) e a janela futura (ex.: 2041–2060) nos cenários SSP1-2.6, SSP2-4.5, SSP3-7.0 ou SSP5-8.5.',
      'A variação de temperatura (ΔTmáx, ΔTmín em °C) é somada a cada mês correspondente na série local NASA POWER.',
      'Chuva e radiação solar recebem razão multiplicativa mensal, mantendo as simulações atual e futura comparáveis safra a safra.',
      'Modelos permitidos (NASA GISS, NOAA GFDL, MPI, MRI, CSIRO, CNRM, IPSL, NorESM) seguem a política de exclusão de fontes restritas.',
    ],
    mappingsEn: [
      { sourceField: 'Future − Hist (°C)', targetField: 'TMAX / TMIN', rule: 'Additive monthly temperature delta' },
      { sourceField: 'Future ÷ Hist Ratio', targetField: 'RAIN / SRAD', rule: 'Multiplicative monthly scaling' },
      { sourceField: 'POWER 1991–2025', targetField: 'Future .WTH', rule: 'Preserves local daily sequence' },
    ],
    mappingsPt: [
      { sourceField: 'Futuro − Hist (°C)', targetField: 'TMAX / TMIN', rule: 'Delta aditivo mensal de temperatura' },
      { sourceField: 'Razão Futuro ÷ Hist', targetField: 'RAIN / SRAD', rule: 'Fator multiplicativo mensal' },
      { sourceField: 'POWER 1991–2025', targetField: '.WTH Futuro', rule: 'Preserva sequência diária observada' },
    ],
    caveatEn:
      'Monthly delta scaling cancels model bias, but preserves the historical daily sequence — changes in multi-year drought clustering are not simulated.',
    caveatPt:
      'O método delta cancela o viés do modelo climático, porém mantém a sequência diária histórica — mudanças na frequência de secas longas não aparecem.',
  },
  {
    id: 'satellite',
    order: '05',
    icon: 'scan-outline',
    titleEn: 'Satellite Telemetry & Leaf Pixels',
    titlePt: 'Telemetria Orbital e Análise de Folha',
    subtitleEn: 'Sentinel-2, Landsat TIRS & offline photo classification',
    subtitlePt: 'Sentinel-2, Landsat TIRS e leitura de foto offline',
    provenanceTagEn: 'REMOTE SENSING + ON-DEVICE',
    provenanceTagPt: 'SENSORIAMENTO + NO APARELHO',
    sourcesEn: 'Sentinel-2 L2A (10 m) · Landsat C2 TIRS (30 m) · NASADEM · Camera JPEG/Canvas',
    sourcesPt: 'Sentinel-2 L2A (10 m) · Landsat C2 TIRS (30 m) · NASADEM · Câmera JPEG/Canvas',
    summaryEn:
      'Spatial plot diagnostics fuse multi-sensor optical/thermal indices with FAO EcoCrop baselines, while the offline camera tool quantifies foliar pixel color fractions directly on the device.',
    summaryPt:
      'O diagnóstico espacial do talhão cruza índices ópticos/termais com parâmetros FAO EcoCrop, enquanto a ferramenta de câmera offline quantifica proporções cromáticas da folha diretamente no aparelho.',
    stepsEn: [
      'Sentinel-2 L2A (10 m) supplies vegetation vigor (NDVI, EVI), water index (NDWI Gao), bare soil index (BSI), and Boegh LAI.',
      'Landsat C2 TIRS (30 m lwir11 band) extracts canopy temperature and Crop Water Stress Index (CWSI, Jackson 1981).',
      'NASADEM (30 m) derives slope/RUSLE LS erosion factor; 30-day POWER totals feed FAO-56 ET0 and Ks root stress.',
      'Offline leaf analysis decodes JPEG/canvas RGBA pixels in the center frame into green chlorophyll %, yellowing %, dry brown %, and dark spot necrosis % without uploading photos.',
    ],
    stepsPt: [
      'Sentinel-2 L2A (10 m) fornece vigor vegetativo (NDVI, EVI), índice de água (NDWI Gao), solo exposto (BSI) e IAF de Boegh.',
      'Landsat C2 TIRS (banda lwir11 30 m) extrai temperatura do dossel e índice de estresse hídrico (CWSI, Jackson 1981).',
      'NASADEM (30 m) calcula declividade/fator RUSLE LS; totais de 30 dias do POWER alimentam ET0 FAO-56 e coeficiente Ks.',
      'A análise offline de folha decodifica pixels RGBA (JPEG/Canvas) no centro da foto em % verde clorofila, % amarelamento, % seco e % pontos escuros sem enviar a imagem para fora.',
    ],
    mappingsEn: [
      { sourceField: 'S2 B04/B08/B11', targetField: 'NDVI · NDWI · BSI', rule: '10 m optical canopy indices' },
      { sourceField: 'L8/9 lwir11', targetField: 'Tc & CWSI', rule: '30 m canopy thermal stress' },
      { sourceField: 'Leaf RGBA', targetField: 'Health Class', rule: 'Green / Yellow / Dry / Black spots' },
    ],
    mappingsPt: [
      { sourceField: 'S2 B04/B08/B11', targetField: 'NDVI · NDWI · BSI', rule: 'Índices ópticos de 10 m' },
      { sourceField: 'L8/9 lwir11', targetField: 'Tc e CWSI', rule: 'Estresse térmico de 30 m' },
      { sourceField: 'RGBA da Folha', targetField: 'Classe Foliar', rule: 'Verde / Amarela / Seca / Pontos pretos' },
    ],
    caveatEn:
      'Optical/thermal field zones use 10–30 m pixels while POWER GWETROOT and FAO GAEZ v4 have coarse regional footprints (9–50 km).',
    caveatPt:
      'Zonas internas usam pixels de 10–30 m, enquanto GWETROOT (POWER) e FAO GAEZ v4 possuem resolução regional ampla (9–50 km).',
  },
  {
    id: 'dssat',
    order: '06',
    icon: 'analytics-outline',
    titleEn: 'DSSAT 4.8.6 & Simulation Limits',
    titlePt: 'DSSAT 4.8.6 e Limites da Simulação',
    subtitleEn: '23 crops, percentiles & honest comparison rules',
    subtitlePt: '23 culturas, percentis e regras de comparação',
    provenanceTagEn: 'MODEL OUTPUT • EXPLORATORY',
    provenanceTagPt: 'SAÍDA DE MODELO • EXPLORATÓRIO',
    sourcesEn: 'DSSAT-CSM 4.8.6 (Cloud Run Job) · 23 Crops · cultivars_br.json',
    sourcesPt: 'DSSAT-CSM 4.8.6 (Cloud Run Job) · 23 Culturas · cultivars_br.json',
    summaryEn:
      'Normalized .WTH and .SOL files drive DSSAT-CSM 4.8.6 over 30+ historical seasons per coordinate, outputting poor (p20), typical (p50), and good (p80) yield bands under rainfed and automatic irrigation modes.',
    summaryPt:
      'Arquivos .WTH e .SOL padronizados alimentam o DSSAT-CSM 4.8.6 em mais de 30 safras históricas por coordenada, gerando faixas de ano ruim (p20), típico (p50) e bom (p80) em sequeiro e irrigação automática.',
    stepsEn: [
      'Initial soil moisture starts at 25% of plant-available water 30 days prior to sowing with low initial mineral nitrogen.',
      'Rainfed vs Automatic Irrigation ceiling: auto-irrigation triggers at 50% available water in the top 30 cm with 0.75 efficiency.',
      'Nitrogen stress is disabled in baseline runs (NITRO=N), isolating weather, water balance, and soil physics constraints.',
      'Yields are reported in kg/ha of dry matter for each crop’s harvested organ; cross-crop risk is compared using relative water deficit indices rather than raw tons.',
    ],
    stepsPt: [
      'A umidade inicial começa em 25% da água disponível 30 dias antes do plantio, com nitrogênio mineral inicial baixo.',
      'Sequeiro vs Irrigação Automática (teto hídrico): irriga automaticamente ao atingir 50% da água disponível nos primeiros 30 cm (eficiência 0,75).',
      'O efeito de nitrogênio fica desligado na base (NITRO=N) para isolar restrições de clima, balanço hídrico e física do solo.',
      'A produção sai em kg/ha de matéria seca do órgão colhido; entre culturas diferentes, compara-se risco relativo hídrico e não peso bruto.',
    ],
    mappingsEn: [
      { sourceField: 'WTH + SOL + FileX', targetField: 'p20 / p50 / p80', rule: 'Multi-year dry matter percentiles' },
      { sourceField: 'Auto Windows', targetField: 'Rainy Onset', rule: 'Estimated; verify against ZARC' },
      { sourceField: 'Cultivars', targetField: 'Un-calibrated', rule: 'Catalog + BR literature coefficients' },
    ],
    mappingsPt: [
      { sourceField: 'WTH + SOL + FileX', targetField: 'p20 / p50 / p80', rule: 'Percentis de matéria seca multi-ano' },
      { sourceField: 'Janelas Auto', targetField: 'Início das Chuvas', rule: 'Estimativa; validar com o ZARC' },
      { sourceField: 'Cultivares', targetField: 'Sem Calibração', rule: 'Catálogo + coeficientes de artigos BR' },
    ],
    caveatEn:
      'Cultivar coefficients are not locally calibrated for each farm and NPK fertilization does not enter baseline yield — validate sowing windows with official ZARC (MAPA).',
    caveatPt:
      'Os coeficientes não têm calibração local por propriedade e adubação NPK não entra no cálculo base — sempre valide datas com o ZARC oficial (MAPA).',
  },
];

export const MethodologyScreen: React.FC = () => {
  const { accessibility, activeFarm } = useAccessibility();
  const { language } = useLanguage();
  const en = language === 'en';
  const theme = getAppTheme(accessibility);
  const { isDesktop, contentMaxWidth } = useResponsiveLayout();
  const [selectedId, setSelectedId] = useState<PipelineStepId>('overview');

  const activeStep = useMemo(
    () => PIPELINE_STEPS.find((s) => s.id === selectedId) ?? PIPELINE_STEPS[0],
    [selectedId]
  );

  const voiceSummary = en
    ? `Data Methodology tab. Step ${activeStep.order}: ${activeStep.titleEn}. ${activeStep.summaryEn} Caveat: ${activeStep.caveatEn}`
    : `Aba Metodologia dos Dados. Etapa ${activeStep.order}: ${activeStep.titlePt}. ${activeStep.summaryPt} Limite: ${activeStep.caveatPt}`;

  const stepsList = (
    <View style={isDesktop ? styles.navColDesktop : styles.navRowMobile}>
      {PIPELINE_STEPS.map((step) => {
        const selected = step.id === activeStep.id;
        return (
          <Pressable
            key={step.id}
            onPress={() => setSelectedId(step.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[
              isDesktop ? styles.stepNavCardDesktop : styles.stepNavPillMobile,
              {
                backgroundColor: selected ? theme.primary : theme.surface,
                borderColor: selected ? theme.primary : theme.border,
              },
            ]}
          >
            <View
              style={[
                styles.stepOrderBadge,
                {
                  backgroundColor: selected
                    ? 'rgba(255,255,255,0.22)'
                    : theme.surfaceMuted,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '900',
                  color: selected ? theme.primaryText : theme.primary,
                }}
              >
                {step.order}
              </Text>
            </View>
            <Ionicons
              name={step.icon}
              size={18}
              color={selected ? theme.primaryText : theme.primary}
            />
            <View style={isDesktop ? { flex: 1, minWidth: 0 } : undefined}>
              <Text
                style={{
                  fontSize: 12.5 * theme.scale,
                  fontWeight: '900',
                  color: selected ? theme.primaryText : theme.text,
                }}
                numberOfLines={1}
              >
                {en ? step.titleEn : step.titlePt}
              </Text>
              {isDesktop && (
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: selected ? 'rgba(255,255,255,0.88)' : theme.textMuted,
                  }}
                  numberOfLines={1}
                >
                  {en ? step.subtitleEn : step.subtitlePt}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );

  const mappings = en ? activeStep.mappingsEn : activeStep.mappingsPt;
  const steps = en ? activeStep.stepsEn : activeStep.stepsPt;

  const detailCard = (
    <View
      style={[
        styles.detailCard,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <View style={styles.detailHeaderRow}>
        <View style={[styles.detailIconBox, { backgroundColor: theme.surfaceMuted }]}>
          <Ionicons name={activeStep.icon} size={22} color={theme.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={[styles.detailTitle, { color: theme.text, fontSize: 17 * theme.scale }]}>
            {activeStep.order}. {en ? activeStep.titleEn : activeStep.titlePt}
          </Text>
          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textMuted }}>
            {en ? activeStep.sourcesEn : activeStep.sourcesPt}
          </Text>
        </View>
        <View
          style={[
            styles.provenancePill,
            { backgroundColor: theme.successBg, borderColor: theme.successBorder },
          ]}
        >
          <Text style={{ fontSize: 10, fontWeight: '900', color: theme.successText }}>
            {en ? activeStep.provenanceTagEn : activeStep.provenanceTagPt}
          </Text>
        </View>
      </View>

      <Text style={[styles.summaryBody, { color: theme.text, fontSize: 13.5 * theme.scale }]}>
        {en ? activeStep.summaryEn : activeStep.summaryPt}
      </Text>

      {/* Compact raw -> processed variable flow */}
      <View style={[styles.mappingWrap, { backgroundColor: theme.bg, borderColor: theme.border }]}>
        <Text style={[styles.subHeading, { color: theme.primary }]}>
          {en ? 'HOW RAW DATA IS STRUCTURED' : 'COMO OS DADOS SÃO ESTRUTURADOS'}
        </Text>
        <View style={[styles.mappingGrid, isDesktop && styles.mappingGridDesktop]}>
          {mappings.map((row) => (
            <View
              key={`${row.sourceField}-${row.targetField}`}
              style={[
                styles.mappingChip,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={{ fontSize: 11.5, fontWeight: '900', color: theme.text }}>
                {row.sourceField} → {row.targetField}
              </Text>
              <Text style={{ fontSize: 11, color: theme.textMuted }}>{row.rule}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={[styles.subHeading, { color: theme.primary }]}>
          {en ? 'PROCESSING & FORMATTING RULES' : 'REGRAS DE PROCESSAMENTO E LIMPEZA'}
        </Text>
        {steps.map((line, i) => (
          <View key={line} style={styles.bulletRow}>
            <View style={[styles.bulletDot, { backgroundColor: theme.primary }]}>
              <Text style={{ fontSize: 10, fontWeight: '900', color: theme.primaryText }}>
                {i + 1}
              </Text>
            </View>
            <Text style={[styles.bulletText, { color: theme.text, fontSize: 12.5 * theme.scale }]}>
              {line}
            </Text>
          </View>
        ))}
      </View>

      <View
        style={[
          styles.caveatBox,
          { backgroundColor: theme.warningBg, borderColor: theme.warningBorder },
        ]}
      >
        <Ionicons name="shield-checkmark-outline" size={18} color={theme.warningText} />
        <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: theme.warningText, lineHeight: 17 }}>
          {en ? 'Scientific honesty & scope: ' : 'Honestidade científica e limites: '}
          {en ? activeStep.caveatEn : activeStep.caveatPt}
        </Text>
      </View>
    </View>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={[
        styles.container,
        isDesktop && styles.containerDesktop,
        { maxWidth: contentMaxWidth },
      ]}
    >
      <View
        style={[
          styles.topBanner,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.screenTitle, { color: theme.text, fontSize: 18 * theme.scale }]}>
            {en
              ? 'Data Pipeline & Scientific Methodology'
              : 'Metodologia: Como os Dados são Organizados'}
          </Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textMuted }}>
            {en
              ? `Transparent trace from raw NASA/Embrapa datasets to ${activeFarm?.nome ?? 'your plot'} outputs (DATA vs DERIVED vs ASSUMPTION).`
              : `Rastreamento transparente das bases NASA/Embrapa até os cálculos de ${activeFarm?.nome ?? 'seu talhão'} (DADO vs DERIVADO vs SUPOSIÇÃO).`}
          </Text>
        </View>
        <View style={isDesktop ? { width: 320 } : { width: '100%' }}>
          <VoiceReadBar
            text={voiceSummary}
            theme={theme}
            label={en ? 'Listen to this step' : 'Ouvir esta etapa'}
          />
        </View>
      </View>

      {isDesktop ? (
        <View style={styles.splitRowDesktop}>
          <View style={styles.leftColDesktop}>{stepsList}</View>
          <View style={styles.rightColDesktop}>{detailCard}</View>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {stepsList}
          {detailCard}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'center',
    padding: 12,
    gap: 10,
    paddingBottom: 20,
  },
  containerDesktop: {
    padding: 16,
    gap: 12,
  },
  topBanner: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  screenTitle: {
    fontWeight: '900',
  },
  splitRowDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  leftColDesktop: {
    width: 320,
    flexShrink: 0,
  },
  rightColDesktop: {
    flex: 1,
    minWidth: 0,
  },
  navColDesktop: {
    gap: 8,
  },
  navRowMobile: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  stepNavCardDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  stepNavPillMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  stepOrderBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  detailCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    gap: 10,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTitle: {
    fontWeight: '900',
  },
  provenancePill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  summaryBody: {
    lineHeight: 20,
    fontWeight: '600',
  },
  mappingWrap: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  subHeading: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  mappingGrid: {
    gap: 8,
  },
  mappingGridDesktop: {
    flexDirection: 'row',
  },
  mappingChip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 2,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
    lineHeight: 18,
  },
  caveatBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
});
