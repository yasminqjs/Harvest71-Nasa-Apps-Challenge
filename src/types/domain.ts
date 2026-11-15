export type LanguageLevel = 'acessivel' | 'tecnico';

export type WaterAccess =
  | 'sequeiro'
  | 'irrigacao'
  | 'poco_artesiano'
  | 'acude'
  | 'cisterna';

export type LaborType =
  | 'familiar'
  | 'mutirao_diarista'
  | 'tracao_animal'
  | 'maquinario';

export type FinancialTier =
  | 'recursos_proprios'
  | 'pronaf'
  | 'emprestimo_local'
  | 'programa_social';

export type FarmObjective = 'subsistencia' | 'misto' | 'comercial';

export type WaterStorageType =
  | 'nenhum'
  | 'cisterna_placa'
  | 'barreiro'
  | 'caixa_dagua';

export type GenderOption =
  | 'feminino'
  | 'masculino'
  | 'nao_binario'
  | 'prefiro_nao_informar';

export type FarmingTenureOption =
  | 'menos_2'
  | '2_a_5'
  | '5_a_15'
  | 'mais_15';

export type DroughtAlertLevel =
  | 'normal'
  | 'atencao'
  | 'alerta'
  | 'seca_confirmada';

export type ErosionRiskLevel = 'baixo' | 'moderado' | 'alto';

export type AppLanguage = 'en' | 'pt';

export interface AccessibilityProfile {
  voiceOnboardingCompleted: boolean;
  registrationCompleted?: boolean;
  tutorialCompleted?: boolean;
  appLanguage?: AppLanguage;
  voiceGuidanceEnabled: boolean;
  speechRate: number; // 0.85 default for clear cadence in the field
  highContrast: boolean;
  largeText: boolean;
  languageLevel: LanguageLevel;
}

export interface FarmerProfile {
  id: string;
  tratamento: string; // Ex.: "Dona Maria", "Seu João"
  nome: string;
  faixaEtaria: '18-35' | '36-55' | '56+';
  genero?: GenderOption;
  tempoAgriculturaFamiliar?: FarmingTenureOption;
  waterAccess: WaterAccess;
  armazenamentoAgua?: WaterStorageType;
  laborType: LaborType;
  financialTier: FinancialTier;
  objective: FarmObjective;
  tamanhoEstimadoHa?: number;
  culturaDesejada?: string;
  desafiosPrincipais?: string[];
  limitacoes: string[];
  historicoCultivo: string[];
  historicoCultivoDetalhado?: CropHistoryRecord[];
}

export type HarvestQuantityUnit = 'kg' | 'sacas' | 'toneladas';

export interface CropHistoryRecord {
  id: string;
  farmerId: string;
  nomeCultura: string;
  cropId?: string;
  quantidadeColhida?: number;
  unidadeQuantidade?: HarvestQuantityUnit;
  periodoSafra?: string;
  observacao?: string;
  tipoSistema?: 'monocultura' | 'rotacao';
  plantas?: string[];
  duracaoTexto?: string;
  loteNome?: string;
  registradaEm: string;
}

export interface LotPhotoRecord {
  id: string;
  uri: string;
  label: string;
  criadoEm: string;
}

export interface PlantingLot {
  id: string;
  nome: string;
  corHex: string;
  polygon: GeoPoint[];
  areaHectares: number;
  areaTarefasBa: number;
  sistema: 'monocultura' | 'rotacao';
  culturaAtual: string;
  plantasRotacao: string[];
  tempoPlantadaDias: number;
  temDataColheita: boolean;
  dataColheitaPrevista?: string;
  cronogramaPlantacao: string;
  progressoRealPct: number;
  progressoEsperadoPct: number;
  retornoFinanceiroEstR$: number;
  historicoTerra: string[];
  culturasFuturas: string[];
  fotosValidacao?: LotPhotoRecord[];
}

export type ProblemReportType =
  | 'seca_estiagem'
  | 'excesso_chuva'
  | 'praga_inseto'
  | 'doenca_folha'
  | 'erosao_solo'
  | 'solo_fraco'
  | 'outro';

export interface RegionalProblemReport {
  id: string;
  autor: string;
  municipio: string;
  bioma: 'Caatinga' | 'Mata Atlântica' | 'Cerrado';
  tipoProblema: ProblemReportType;
  titulo: string;
  descricao: string;
  haQuantosDias: number;
  acaoQueFuncionou: string;
}

export interface RotationComparisonStrategy {
  id: string;
  nome: string;
  isAtual: boolean;
  sistema: 'monocultura' | 'rotacao';
  plantas: string[];
  scoreResiliencia: number; // 0-100
  demandaAgua: 'baixa' | 'media' | 'alta';
  fixacaoNitrogenio: boolean;
  valorForragem: 'alto' | 'medio' | 'baixo';
  quebraCicloPragas: 'alta' | 'media' | 'baixa';
  reducaoErosaoPct: number;
  retornoLiquidoEstHaR$: number;
  porqueSugerida: string;
  evidencias: string;
  beneficios: string;
  lacunasInformacao: string;
  riscosRevisaoLocal: string;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface NdviZonePatch {
  id: string;
  setor: string;
  vigor: 'verde' | 'amarelo' | 'vermelho';
  ndviValor: number;
  descricao: string;
  relativeBox: { xPct: number; yPct: number; wPct: number; hPct: number };
}

export interface LeafAnalysisResult {
  id: string;
  imageUri: string;
  criadoEm: string;
  indiceVerdePct: number;
  amarelamentoPct: number;
  necrosePct?: number;
  pontosPretosPct?: number;
  status:
    | 'saudavel'
    | 'estresse_leve'
    | 'clorose_ou_seca'
    | 'seca_total'
    | 'manchas_pretas';
  titulo: string;
  diagnosticoAcessivel: string;
  diagnosticoTecnico: string;
  acaoRecomendada: string;
}

export interface ModelAWaterBalance {
  chuvaImergMm: number;
  et0PowerMm: number;
  kcAplicado: number;
  demandaCulturaMm: number;
  saldoHidricoMm: number;
  smapTendencia: 'subindo' | 'estavel' | 'caindo';
  status: 'positivo' | 'equilibrado' | 'deficit_confirmado';
  resumoTecnico: string;
  resumoAcessivel: string;
}

export interface DroughtSignalStep {
  etapa: 'Chuva' | 'Solo' | 'Planta' | 'Calor';
  fonte: string;
  anomaliaDetectada: boolean;
  valorAtual: string;
  referenciaHistorica: string;
  descricao: string;
}

export interface ModelBDroughtCascade {
  sinaisAtivos: number;
  nivel: DroughtAlertLevel;
  emoji: '😊' | '😐' | '😟' | '😰';
  sinais: DroughtSignalStep[];
  resumoTecnico: string;
  resumoAcessivel: string;
}

export interface ModelCPlantingWindow {
  primeirasChuvasDetectadasMm: number;
  smapUmidadeEstavelDias: number;
  probabilidadeVeranicoPct: number;
  recomendacao: 'plantar_agora' | 'esperar_semana' | 'aguardar_chuvas';
  titulo: string;
  explicacaoTecnica: string;
  explicacaoAcessivel: string;
}

export interface ModelDErosionMatrix {
  chuvaIntensaScore: number;
  declividadePct: number;
  mesesSoloExposto: number;
  erodibilidadeSoilGrids: 'baixa' | 'media' | 'alta';
  nivel: ErosionRiskLevel;
  praticasRecomendadas: string[];
  resumoTecnico: string;
  resumoAcessivel: string;
}

export interface ModelEClimate2050 {
  deltaTempC: number;
  deltaChuvaPct: number;
  semanasDeficitAtual: number;
  semanasDeficit2050: number;
  semanasDeficitAdicionais: number;
  rotacaoAtual: string;
  rotacaoResilienteSugerida: string;
  resumoTecnico: string;
  resumoAcessivel: string;
}

export interface CropDecisionItem {
  id: string;
  nome: string;
  variedadeRegional: string;
  kcMedio: number;
  diasColheita: number;
  produtividadeKgPorHa: number;
  custoInsumosPorHa: number;
  precoMedioKg: number;
  zarcStatus: 'indicada' | 'restricao_leve' | 'nao_recomendada';
  resilienciaSeca: 'alta' | 'media' | 'baixa';
  observacao: string;
}

export interface WellPoint {
  id: string;
  codigoSiagas: string;
  latitude: number;
  longitude: number;
  profundidadeM: number;
  vazaoLph: number;
  salinidade: 'doce' | 'salobra' | 'salina';
  sucessoHistoricoPct: number;
  custoEstimadoPerfR$: number;
  distanciaKm?: number;
}

export interface WellHeatmapSummary {
  faixaProfundidadeMinM: number;
  faixaProfundidadeMaxM: number;
  taxaSucessoPct: number;
  riscoSalinidade: 'baixo' | 'moderado' | 'alto';
  tendenciaGraceFo: 'recarga_positiva' | 'estavel' | 'rebaixamento';
  orientacaoBaixaRenda: string;
}

export interface EdiblePlantPANC {
  id: string;
  nomePopular: string;
  nomeCientifico: string;
  biomas: string[];
  phMin: number;
  phMax: number;
  resistenciaSeca: 'extrema' | 'alta';
  parteComestivel: string;
  diasColheitaRapida: number;
  cultivoRapido: string;
  preparoCulinario: string;
  fonteValidacao: string;
  isCulturaResiliente?: boolean;
}

export interface ProactiveAlertItem {
  id: string;
  categoria: 'plantio' | 'veranico' | 'fitossanitario' | 'seca';
  severidade: 'info' | 'atencao' | 'urgente';
  titulo: string;
  mensagemAcessivel: string;
  mensagemTecnica: string;
  criadoEm: string;
  lido: boolean;
  confirmadoCienteEm?: string;
}

export interface NasaDiagnosticsPackage {
  atualizadoEm: string;
  fontePacote: 'local_seed' | 'motor_local' | 'api_remota';
  climaDia: {
    tempMaxC: number;
    tempMinC: number;
    condicao: string;
    icone: '☀️' | '⛅' | '🌦️' | '🌧️' | '🔥';
    chuvaHojeMm: number;
    umidadeRelativaPct: number;
  };
  rotacaoAtual: {
    culturas: string;
    diasPassados: number;
    diasTotais: number;
    diasRestantes: number;
    progressoPct: number;
    fase: string;
  };
  soloSoilGrids: {
    ph: number;
    textura: string;
    carbonoOrganicoGKg: number;
  };
  ndviZonas: NdviZonePatch[];
  modeloA: ModelAWaterBalance;
  modeloB: ModelBDroughtCascade;
  modeloC: ModelCPlantingWindow;
  modeloD: ModelDErosionMatrix;
  modeloE: ModelEClimate2050;
  culturasRecomendadas: CropDecisionItem[];
  wellSummary: WellHeatmapSummary;
}

export interface FarmProperty {
  id: string;
  farmerId: string;
  nome: string;
  municipio: string;
  estado: string;
  regiaoNome: string;
  bioma: 'Caatinga' | 'Mata Atlântica' | 'Cerrado';
  centroid: GeoPoint;
  polygon: GeoPoint[];
  areaHectares: number;
  areaTarefasBa: number;
  raioBuscaKm: number;
  culturaPrincipal: string;
  lotes?: PlantingLot[];
  diagnostico: NasaDiagnosticsPackage;
}

export interface FieldValidationLog {
  id: string;
  farmId: string;
  tipo:
    | 'chuva_hoje'
    | 'terra_umida'
    | 'poco_perfurado'
    | 'analise_foliar'
    | 'inspecao_completa'
    | 'problema_relatado';
  choveuHoje?: boolean;
  intensidadeChuva?: 'sem_chuva' | 'garoa_fraca' | 'chuva_boa' | 'temporal_forte';
  milimetrosEstimados?: number;
  terraUmida?: boolean;
  umidadeSoloCampo?: 'seca_rachando' | 'seca_solta' | 'umida_boa' | 'encharcada';
  estadoLavoura?: 'vigorosa' | 'murcha_sol' | 'amarelada' | 'com_pragas';
  sinaisErosao?: boolean;
  temperaturaPercebida?: 'amena' | 'quente' | 'calor_extremo';
  pragaOuDoenca?: string;
  tipoProblema?: ProblemReportType;
  fotoUri?: string;
  loteId?: string;
  loteNome?: string;
  pocoDeuAgua?: boolean;
  pocoProfundidadeM?: number;
  observacao: string;
  criadoEm: string;
  sincronizado: boolean;
}

export interface AppFeedbackItem {
  id: string;
  farmerId: string;
  farmId: string;
  categoria: 'previsao' | 'folha' | 'mapa_pocos' | 'voz_clareza' | 'sugestao';
  previsaoBateu: 'sim' | 'parcial' | 'nao';
  nota: 1 | 2 | 3 | 4 | 5;
  comentario: string;
  criadoEm: string;
  sincronizado: boolean;
}

export interface SyncQueueItem {
  id: string;
  endpoint: string;
  payloadJson: string;
  status: 'pendente' | 'sincronizado' | 'erro';
  criadoEm: string;
  tentativas: number;
}

export type CommunityTopic =
  | 'praga'
  | 'mudanca_preco'
  | 'desastre_natural'
  | 'seca'
  | 'rotacao'
  | 'solo'
  | 'duvida';

export interface CommunityReply {
  id: string;
  autor: string;
  regiaoNome: string;
  municipio: string;
  texto: string;
  criadoEm: string;
}

export interface CommunityPost {
  id: string;
  autor: string;
  regiaoNome: string;
  municipio: string;
  estado: string;
  bioma: 'Caatinga' | 'Mata Atlântica' | 'Cerrado';
  centroid: GeoPoint;
  topico: CommunityTopic;
  tipo: 'pergunta' | 'relato';
  titulo: string;
  mensagem: string;
  curtidas: number;
  curtidoPorMim?: boolean;
  haQuantoTempo: string;
  respostas: CommunityReply[];
}

export interface CommunityGraphNode {
  id: string;
  regiaoNome: string;
  municipio: string;
  estado: string;
  bioma: 'Caatinga' | 'Mata Atlântica' | 'Cerrado';
  isUserFarm: boolean;
  reportCount: number;
  dominantTopic: CommunityTopic;
  distanceKm: number;
  x: number;
  y: number;
  autores: string[];
}

export interface CommunityGraphEdge {
  id: string;
  fromId: string;
  toId: string;
  relation: 'mesmo_bioma' | 'mesmo_tema' | 'vizinho';
  label: string;
}

/**
 * Código de cor das 6 features principais na arquitetura do aplicativo:
 * - verde:   Pegador de informações da fazenda (Onboarding + Aba Plantação)
 * - azul:    Pegador de feedback de acontecimentos do usuário (Aba Comunidade)
 * - salmao:  Notificador de acontecimentos locais (Aba Comunidade)
 * - cinza:   Previsão / Comparador / Otimizador DSSAT (Aba Plantação — PLACEHOLDER)
 * - roxo:    Visualizador de qualidade da plantação atual (Aba Plantação — PLACEHOLDER)
 * - amarelo: Visualizador de informações locais (Aba Resumo)
 */
export type FeatureColorCode =
  | 'verde'
  | 'azul'
  | 'salmao'
  | 'cinza'
  | 'roxo'
  | 'amarelo';

export interface FeatureArchitectureDescriptor {
  id: string;
  color: FeatureColorCode;
  featureName: string;
  tab: 'onboarding' | 'resumo' | 'plantacao' | 'comunidade';
  userActionLabel: string;
  status: 'implementado' | 'placeholder';
  targetFile: string;
  placeholderComponent?: string;
}

export interface RegionalEventRecord {
  id: string;
  categoria: CommunityTopic;
  autor: string;
  regiaoNome: string;
  municipio: string;
  estado: string;
  titulo: string;
  descricao: string;
  haQuantoTempo: string;
  fonte: 'feedback_da_comunidade';
}

export interface PlantationArchitectureModel {
  id: string;
  nome: string;
  corHex: string;
  areaHectares: number;
  areaTarefasBa: number;
  polygon: GeoPoint[];
  historicoDaTerra: {
    variaveisClimaticas: {
      fonte: 'NASA POWER';
      tempMaxC: number;
      tempMinC: number;
      chuvaHojeMm: number;
      umidadeRelativaPct: number;
      et0PowerMm: number;
      chuvaImergMm: number;
      saldoHidricoMm: number;
    };
    variaveisDoSolo: {
      fonte: 'SRTM + Landsat Collection 2 Level-2 TIRS (NASA / USGS — 30 m)';
      declividadePct: number;
      erodibilidade: ErosionRiskLevel;
      resolucaoEspacialM: 30;
      phSolo: number;
      texturaSolo: string;
      carbonoOrganicoGKg: number;
      registrosHistoricos: string[];
    };
  };
  culturaAtual: {
    fonteSelecao: 'usuario';
    culturaNome: string;
    sistema: 'monocultura' | 'rotacao';
    plantas: string[];
    tempoPlantadaDias: number;
    dataColheitaPrevista?: string;
    cronogramaPlantacao: string;
    especificacoesCultura: {
      fonte: 'NASA / FAO GAEZ EcoCrop';
      variedadeRegional: string;
      kcMedio: number;
      diasColheitaTipico: number;
      resilienciaSeca: 'alta' | 'media' | 'baixa';
      observacaoEcoCrop: string;
    };
  };
  culturasFuturas: {
    fonteSelecao: 'usuario_ou_algoritmo_otimizacao';
    rotacaoPlanejada: string[];
    previsaoResultado: {
      fonte: 'Software DSSAT';
      status: 'placeholder';
      mensagemPlaceholder: string;
    };
  };
}

/**
 * Visão canônica dos dados da propriedade conforme diagrama "Modelagem da fazenda".
 */
export interface FarmArchitectureModel {
  fazendaId: string;
  nomeFazenda: string;
  acontecimentosDaRegiao: {
    fonte: 'feedback_da_comunidade';
    eventos: RegionalEventRecord[];
  };
  variaveisDaFazenda: {
    fonte: 'usuario';
    regiaoNome: string;
    municipio: string;
    estado: string;
    bioma: 'Caatinga' | 'Mata Atlântica' | 'Cerrado';
    centroid: GeoPoint;
    polygon: GeoPoint[];
    areaHectares: number;
    areaTarefasBa: number;
    waterAccess: WaterAccess;
    armazenamentoAgua?: WaterStorageType;
    laborType: LaborType;
    financialTier: FinancialTier;
    objective: FarmObjective;
  };
  plantacoes: PlantationArchitectureModel[];
}
