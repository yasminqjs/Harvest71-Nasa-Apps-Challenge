import {
  AppLanguage,
  CropDecisionItem,
  EdiblePlantPANC,
  FarmProperty,
  FarmerProfile,
  ProactiveAlertItem,
  WellPoint,
} from '../types/domain';
import { pickLang } from '../i18n/locale';
import { createMicroPlotAroundPoint } from '../utils/geoprocessing';

export interface BahiaRegionPreset {
  id: string;
  nome: string;
  municipio: string;
  estado: string;
  bioma: 'Caatinga' | 'Mata Atlântica' | 'Cerrado';
  centroid: { latitude: number; longitude: number };
  chuvaSemanalBaseMm: number;
  et0SemanalMm: number;
  phSolo: number;
  texturaSolo: string;
  declividadePct: number;
  riscoVeranicoPct: number;
  sinaisSecaPadrao: number;
  salinidadeRisco: 'baixo' | 'moderado' | 'alto';
}

export const NORDESTE_REGIONS: BahiaRegionPreset[] = [
  {
    id: 'reconcavo-ba',
    nome: 'Recôncavo Baiano',
    municipio: 'Salvador / Cruz das Almas',
    estado: 'BA',
    bioma: 'Mata Atlântica',
    centroid: { latitude: -12.9714, longitude: -38.5014 },
    chuvaSemanalBaseMm: 28,
    et0SemanalMm: 31,
    phSolo: 5.8,
    texturaSolo: 'Argilo-arenoso',
    declividadePct: 6.4,
    riscoVeranicoPct: 18,
    sinaisSecaPadrao: 0,
    salinidadeRisco: 'baixo',
  },
  {
    id: 'semiarido-feira-ba',
    nome: 'Portal do Sertão',
    municipio: 'Feira de Santana',
    estado: 'BA',
    bioma: 'Caatinga',
    centroid: { latitude: -12.2664, longitude: -38.9663 },
    chuvaSemanalBaseMm: 14,
    et0SemanalMm: 36,
    phSolo: 6.3,
    texturaSolo: 'Franco-arenoso',
    declividadePct: 4.8,
    riscoVeranicoPct: 44,
    sinaisSecaPadrao: 2,
    salinidadeRisco: 'moderado',
  },
  {
    id: 'irece-ba',
    nome: 'Território de Irecê',
    municipio: 'Irecê',
    estado: 'BA',
    bioma: 'Caatinga',
    centroid: { latitude: -11.3042, longitude: -41.8558 },
    chuvaSemanalBaseMm: 9,
    et0SemanalMm: 41,
    phSolo: 6.8,
    texturaSolo: 'Calcário / Franco-argiloso',
    declividadePct: 3.2,
    riscoVeranicoPct: 62,
    sinaisSecaPadrao: 3,
    salinidadeRisco: 'alto',
  },
  {
    id: 'juazeiro-ba',
    nome: 'Vale do São Francisco',
    municipio: 'Juazeiro',
    estado: 'BA',
    bioma: 'Caatinga',
    centroid: { latitude: -9.4167, longitude: -40.5033 },
    chuvaSemanalBaseMm: 6,
    et0SemanalMm: 44,
    phSolo: 6.6,
    texturaSolo: 'Arenoso-franco',
    declividadePct: 2.5,
    riscoVeranicoPct: 58,
    sinaisSecaPadrao: 2,
    salinidadeRisco: 'alto',
  },
  {
    id: 'conquista-ba',
    nome: 'Sudoeste Baiano',
    municipio: 'Vitória da Conquista',
    estado: 'BA',
    bioma: 'Mata Atlântica',
    centroid: { latitude: -14.8661, longitude: -40.8394 },
    chuvaSemanalBaseMm: 22,
    et0SemanalMm: 27,
    phSolo: 5.5,
    texturaSolo: 'Argiloso',
    declividadePct: 11.5,
    riscoVeranicoPct: 24,
    sinaisSecaPadrao: 1,
    salinidadeRisco: 'baixo',
  },
  {
    id: 'barreiras-ba',
    nome: 'Oeste Baiano',
    municipio: 'Barreiras',
    estado: 'BA',
    bioma: 'Cerrado',
    centroid: { latitude: -12.1528, longitude: -44.99 },
    chuvaSemanalBaseMm: 26,
    et0SemanalMm: 34,
    phSolo: 5.4,
    texturaSolo: 'Latossolo arenoso',
    declividadePct: 3.9,
    riscoVeranicoPct: 29,
    sinaisSecaPadrao: 1,
    salinidadeRisco: 'baixo',
  },
  {
    id: 'pajeu-pe',
    nome: 'Sertão do Pajeú',
    municipio: 'Serra Talhada',
    estado: 'PE',
    bioma: 'Caatinga',
    centroid: { latitude: -7.9919, longitude: -38.2983 },
    chuvaSemanalBaseMm: 8,
    et0SemanalMm: 43,
    phSolo: 6.5,
    texturaSolo: 'Franco-arenoso pedregoso',
    declividadePct: 5.4,
    riscoVeranicoPct: 60,
    sinaisSecaPadrao: 2,
    salinidadeRisco: 'alto',
  },
  {
    id: 'agreste-al',
    nome: 'Agreste Alagoano',
    municipio: 'Arapiraca',
    estado: 'AL',
    bioma: 'Caatinga',
    centroid: { latitude: -9.7525, longitude: -36.6611 },
    chuvaSemanalBaseMm: 17,
    et0SemanalMm: 35,
    phSolo: 6.0,
    texturaSolo: 'Argilo-arenoso',
    declividadePct: 4.5,
    riscoVeranicoPct: 38,
    sinaisSecaPadrao: 1,
    salinidadeRisco: 'moderado',
  },
  {
    id: 'sertao-se',
    nome: 'Alto Sertão Sergipano',
    municipio: 'N. Sra. da Glória',
    estado: 'SE',
    bioma: 'Caatinga',
    centroid: { latitude: -10.2175, longitude: -37.4203 },
    chuvaSemanalBaseMm: 12,
    et0SemanalMm: 38,
    phSolo: 6.4,
    texturaSolo: 'Franco-argiloso',
    declividadePct: 4.1,
    riscoVeranicoPct: 47,
    sinaisSecaPadrao: 2,
    salinidadeRisco: 'moderado',
  },
  {
    id: 'borborema-pb',
    nome: 'Borborema / Cariri PB',
    municipio: 'Campina Grande',
    estado: 'PB',
    bioma: 'Caatinga',
    centroid: { latitude: -7.2306, longitude: -35.8811 },
    chuvaSemanalBaseMm: 14,
    et0SemanalMm: 37,
    phSolo: 6.3,
    texturaSolo: 'Franco-arenoso',
    declividadePct: 7.2,
    riscoVeranicoPct: 45,
    sinaisSecaPadrao: 2,
    salinidadeRisco: 'moderado',
  },
  {
    id: 'oeste-rn',
    nome: 'Oeste Potiguar',
    municipio: 'Mossoró',
    estado: 'RN',
    bioma: 'Caatinga',
    centroid: { latitude: -5.1875, longitude: -37.3442 },
    chuvaSemanalBaseMm: 7,
    et0SemanalMm: 45,
    phSolo: 6.9,
    texturaSolo: 'Calcário / Arenoso',
    declividadePct: 2.3,
    riscoVeranicoPct: 64,
    sinaisSecaPadrao: 3,
    salinidadeRisco: 'alto',
  },
  {
    id: 'cariri-ce',
    nome: 'Cariri Cearense',
    municipio: 'Juazeiro do Norte / Crato',
    estado: 'CE',
    bioma: 'Caatinga',
    centroid: { latitude: -7.2131, longitude: -39.3153 },
    chuvaSemanalBaseMm: 13,
    et0SemanalMm: 39,
    phSolo: 6.2,
    texturaSolo: 'Franco-argilo-arenoso',
    declividadePct: 6.0,
    riscoVeranicoPct: 42,
    sinaisSecaPadrao: 2,
    salinidadeRisco: 'moderado',
  },
  {
    id: 'centro-pi',
    nome: 'Entre Rios Piauiense',
    municipio: 'Teresina / Campo Maior',
    estado: 'PI',
    bioma: 'Cerrado',
    centroid: { latitude: -5.0892, longitude: -42.8016 },
    chuvaSemanalBaseMm: 19,
    et0SemanalMm: 38,
    phSolo: 5.7,
    texturaSolo: 'Latossolo arenoso',
    declividadePct: 3.1,
    riscoVeranicoPct: 36,
    sinaisSecaPadrao: 1,
    salinidadeRisco: 'baixo',
  },
  {
    id: 'baixada-ma',
    nome: 'Vale do Mearim / Itapecuru',
    municipio: 'Santa Inês / Itapecuru',
    estado: 'MA',
    bioma: 'Cerrado',
    centroid: { latitude: -3.6667, longitude: -45.3833 },
    chuvaSemanalBaseMm: 31,
    et0SemanalMm: 32,
    phSolo: 5.4,
    texturaSolo: 'Argilo-siltoso',
    declividadePct: 2.8,
    riscoVeranicoPct: 19,
    sinaisSecaPadrao: 0,
    salinidadeRisco: 'baixo',
  },
];

export const SEED_FARMERS: FarmerProfile[] = [
  {
    id: 'farmer-maria',
    tratamento: 'Dona Maria',
    nome: 'Maria das Graças Santos',
    faixaEtaria: '56+',
    genero: 'feminino',
    tempoAgriculturaFamiliar: 'mais_15',
    waterAccess: 'sequeiro',
    laborType: 'familiar',
    financialTier: 'pronaf',
    objective: 'subsistencia',
    limitacoes: ['visual'],
    historicoCultivo: ['Feijão-caupi', 'Mandioca', 'Milho crioulo'],
  },
  {
    id: 'farmer-joao',
    tratamento: 'Seu João',
    nome: 'João Batista Oliveira',
    faixaEtaria: '36-55',
    genero: 'masculino',
    tempoAgriculturaFamiliar: '5_a_15',
    waterAccess: 'poco_artesiano',
    laborType: 'tracao_animal',
    financialTier: 'recursos_proprios',
    objective: 'misto',
    limitacoes: [],
    historicoCultivo: ['Palma forrageira', 'Feijão-caupi', 'Sorgo'],
  },
];

export const SEED_CROPS: CropDecisionItem[] = [
  {
    id: 'feijao-caupi',
    nome: 'Feijão-Caupi (Feijão-de-Corda)',
    variedadeRegional: 'BRS Guariba / Sempre-Verde',
    kcMedio: 0.85,
    diasColheita: 70,
    produtividadeKgPorHa: 1150,
    custoInsumosPorHa: 780,
    precoMedioKg: 6.4,
    zarcStatus: 'indicada',
    resilienciaSeca: 'alta',
    observacao: 'Segura bem veranicos curtos e ajuda a segurar nitrogênio na terra.',
  },
  {
    id: 'mandioca',
    nome: 'Mandioca / Aipim',
    variedadeRegional: 'BRS Formosa / Caravela',
    kcMedio: 0.72,
    diasColheita: 270,
    produtividadeKgPorHa: 14500,
    custoInsumosPorHa: 1250,
    precoMedioKg: 1.35,
    zarcStatus: 'indicada',
    resilienciaSeca: 'alta',
    observacao: 'Reserva alimentar firme na terra para enfrentar meses secos.',
  },
  {
    id: 'milho-crioulo',
    nome: 'Milho Caatingueiro / Crioulo',
    variedadeRegional: 'BRS Caatingueiro',
    kcMedio: 1.05,
    diasColheita: 95,
    produtividadeKgPorHa: 2400,
    custoInsumosPorHa: 1180,
    precoMedioKg: 1.9,
    zarcStatus: 'restricao_leve',
    resilienciaSeca: 'media',
    observacao: 'Precisa de chuva firme no pendoamento; evite plantar em falso início.',
  },
  {
    id: 'sorgo-forrageiro',
    nome: 'Sorgo Granífero / Forrageiro',
    variedadeRegional: 'BRS Ponta Negra',
    kcMedio: 0.82,
    diasColheita: 100,
    produtividadeKgPorHa: 3200,
    custoInsumosPorHa: 920,
    precoMedioKg: 1.45,
    zarcStatus: 'indicada',
    resilienciaSeca: 'alta',
    observacao: 'Aguenta até 40% menos água que o milho comum sem perder a safra.',
  },
  {
    id: 'palma-forrageira',
    nome: 'Palma Forrageira Doce (Miúda)',
    variedadeRegional: 'Orelha de Elefante Mexicana',
    kcMedio: 0.45,
    diasColheita: 180,
    produtividadeKgPorHa: 45000,
    custoInsumosPorHa: 1400,
    precoMedioKg: 0.45,
    zarcStatus: 'indicada',
    resilienciaSeca: 'alta',
    observacao: 'Reserva viva de água e alimento para criação e brotos comestíveis.',
  },
];

export const SEED_PANCS: EdiblePlantPANC[] = [
  {
    id: 'panc-palma',
    nomePopular: 'Palma (Broto / Verdura da Palma)',
    nomeCientifico: 'Opuntia ficus-indica / Nopalea cochenillifera',
    biomas: ['Caatinga', 'Mata Atlântica', 'Cerrado'],
    phMin: 5.0,
    phMax: 7.8,
    resistenciaSeca: 'extrema',
    parteComestivel: 'Brotos tenros (nopalitos) e frutos',
    diasColheitaRapida: 35,
    cultivoRapido:
      'Plante a raquete em pé enterrando 1/3 na terra seca ou úmida; não precisa regar nos primeiros 10 dias.',
    preparoCulinario:
      'Raspe os espinhos pequenos, pique em tiras e refogue com cebola, alho e ovo ou faça ensopado com feijão.',
    fonteValidacao: 'Lista Sociobiodiversidade MMA/MDS + INSA',
  },
  {
    id: 'panc-mandacaru-sem-espinho',
    nomePopular: 'Mandacaru Sem Espinhos (Brotos e Fruto)',
    nomeCientifico: 'Cereus jamacaru (mutante inerme)',
    biomas: ['Caatinga', 'Cerrado'],
    phMin: 5.2,
    phMax: 7.6,
    resistenciaSeca: 'extrema',
    parteComestivel: 'Miolo macio dos brotos jovens e polpa doce do fruto',
    diasColheitaRapida: 45,
    cultivoRapido:
      'Pegue estaca sadia, deixe cicatrizar 5 dias na sombra e finque em solo drenado perto do quintal.',
    preparoCulinario:
      'Corte em cubos, ferva por 8 minutos trocando a água e use em guisados, farofa ou doce do fruto.',
    fonteValidacao: 'INSA / Embrapa Semiárido / Flora do Brasil',
  },
  {
    id: 'panc-umbu',
    nomePopular: 'Umbuzeiro (Fruto e Batata-do-Umbu)',
    nomeCientifico: 'Spondias tuberosa',
    biomas: ['Caatinga'],
    phMin: 5.0,
    phMax: 7.4,
    resistenciaSeca: 'extrema',
    parteComestivel: 'Fruto verde ou maduro (umbuzada) e túbera hidratante',
    diasColheitaRapida: 60,
    cultivoRapido:
      'Use estacas grossas no início das chuvas ou cuide das mudas nativas protegendo com cerca viva.',
    preparoCulinario:
      'Cozinhe o umbu com leite ou água para umbuzada, faça geleia sem desperdício e aproveite a polpa.',
    fonteValidacao: 'Lista Sociobiodiversidade MMA/MDS + GBIF',
  },
  {
    id: 'panc-beldroega',
    nomePopular: 'Beldroega (Capim-Gordo)',
    nomeCientifico: 'Portulaca oleracea',
    biomas: ['Caatinga', 'Mata Atlântica', 'Cerrado'],
    phMin: 5.0,
    phMax: 7.5,
    resistenciaSeca: 'alta',
    parteComestivel: 'Folhas, ramos jovens e sementes (rica em ômega-3 e ferro)',
    diasColheitaRapida: 22,
    cultivoRapido:
      'Nasce espontânea após qualquer sereno; basta deixar no canteiro sombreado com cobertura de palha.',
    preparoCulinario:
      'Lave bem e coma crua em salada com limão ou refogada rapidamente no feijão e cuscuz.',
    fonteValidacao: 'Flora do Brasil + GBIF',
  },
  {
    id: 'panc-ora-pro-nobis',
    nomePopular: 'Ora-pro-nóbis (Carne-dos-Pobres)',
    nomeCientifico: 'Pereskia aculeata / Pereskia bahiensis',
    biomas: ['Caatinga', 'Mata Atlântica', 'Cerrado'],
    phMin: 5.2,
    phMax: 7.2,
    resistenciaSeca: 'alta',
    parteComestivel: 'Folhas ricas em proteína e ferro (até 25% na matéria seca)',
    diasColheitaRapida: 30,
    cultivoRapido:
      'Corte um galho de 20 cm, retire folhas da base e plante junto à cerca do quintal com pouca água.',
    preparoCulinario:
      'Pique as folhas no caldo do feijão, arroz, omelete ou angu para reforçar a proteína da família.',
    fonteValidacao: 'Lista Sociobiodiversidade MMA/MDS + Flora do Brasil',
  },
  {
    id: 'cultura-feijao-caupi',
    nomePopular: 'Feijão-Caupi (Feijão-de-Corda)',
    nomeCientifico: 'Vigna unguiculata',
    biomas: ['Caatinga', 'Mata Atlântica', 'Cerrado'],
    phMin: 5.0,
    phMax: 7.2,
    resistenciaSeca: 'alta',
    parteComestivel: 'Grãos secos, feijão verde e vagens tenras',
    diasColheitaRapida: 65,
    cultivoRapido:
      'Semeie em covas rasas (3 cm) logo após chuva que molhe ao menos um palmo de terra.',
    preparoCulinario:
      'Feijão verde no leite de coco, baião de dois ou farinha de feijão para segurança nutricional.',
    fonteValidacao: 'Embrapa ZARC + IBGE SIDRA',
    isCulturaResiliente: true,
  },
  {
    id: 'cultura-sorgo',
    nomePopular: 'Sorgo Alimentar e Forrageiro',
    nomeCientifico: 'Sorghum bicolor',
    biomas: ['Caatinga', 'Cerrado', 'Mata Atlântica'],
    phMin: 5.2,
    phMax: 7.5,
    resistenciaSeca: 'extrema',
    parteComestivel: 'Grãos para farinha/cuscuz e massa verde para criação',
    diasColheitaRapida: 90,
    cultivoRapido:
      'Substituto direto do milho em anos secos; rebrota após corte se houver mínima umidade.',
    preparoCulinario:
      'Torre ou moa o grão para mingau, pipoca nutritiva e farinha misturada ao milho.',
    fonteValidacao: 'Embrapa Milho e Sorgo + INSA',
    isCulturaResiliente: true,
  },
];

export const SEED_WELLS: WellPoint[] = [
  {
    id: 'w-1',
    codigoSiagas: 'SIAGAS-2900412',
    latitude: -12.954,
    longitude: -38.472,
    profundidadeM: 48,
    vazaoLph: 3200,
    salinidade: 'doce',
    sucessoHistoricoPct: 86,
    custoEstimadoPerfR$: 7200,
  },
  {
    id: 'w-2',
    codigoSiagas: 'SIAGAS-2900588',
    latitude: -12.989,
    longitude: -38.532,
    profundidadeM: 62,
    vazaoLph: 2600,
    salinidade: 'doce',
    sucessoHistoricoPct: 81,
    custoEstimadoPerfR$: 9100,
  },
  {
    id: 'w-3',
    codigoSiagas: 'SIAGAS-2900901',
    latitude: -12.912,
    longitude: -38.448,
    profundidadeM: 38,
    vazaoLph: 4100,
    salinidade: 'doce',
    sucessoHistoricoPct: 90,
    custoEstimadoPerfR$: 5800,
  },
  {
    id: 'w-4',
    codigoSiagas: 'SIAGAS-2901844',
    latitude: -12.248,
    longitude: -38.939,
    profundidadeM: 76,
    vazaoLph: 1450,
    salinidade: 'salobra',
    sucessoHistoricoPct: 68,
    custoEstimadoPerfR$: 11200,
  },
  {
    id: 'w-5',
    codigoSiagas: 'SIAGAS-2901910',
    latitude: -12.288,
    longitude: -38.992,
    profundidadeM: 54,
    vazaoLph: 2100,
    salinidade: 'doce',
    sucessoHistoricoPct: 79,
    custoEstimadoPerfR$: 8400,
  },
  {
    id: 'w-6',
    codigoSiagas: 'SIAGAS-2903211',
    latitude: -11.288,
    longitude: -41.832,
    profundidadeM: 110,
    vazaoLph: 1900,
    salinidade: 'salobra',
    sucessoHistoricoPct: 64,
    custoEstimadoPerfR$: 15500,
  },
  {
    id: 'w-7',
    codigoSiagas: 'SIAGAS-2903250',
    latitude: -11.324,
    longitude: -41.884,
    profundidadeM: 88,
    vazaoLph: 2300,
    salinidade: 'doce',
    sucessoHistoricoPct: 72,
    custoEstimadoPerfR$: 12800,
  },
  {
    id: 'w-8',
    codigoSiagas: 'SIAGAS-2904415',
    latitude: -9.431,
    longitude: -40.482,
    profundidadeM: 94,
    vazaoLph: 1200,
    salinidade: 'salina',
    sucessoHistoricoPct: 55,
    custoEstimadoPerfR$: 13900,
  },
];

export const SEED_ALERTS: ProactiveAlertItem[] = [
  {
    id: 'al-1',
    categoria: 'plantio',
    severidade: 'info',
    titulo: 'Planting window open in Recôncavo',
    mensagemAcessivel:
      'Soil retained recent rainfall moisture. Good moment to sow cowpea with straw mulch cover.',
    mensagemTecnica:
      'SMAP moisture stable for 9 days and mid-season dry-spell risk at 18% (NASA IMERG).',
    criadoEm: new Date().toISOString(),
    lido: false,
  },
  {
    id: 'al-2',
    categoria: 'veranico',
    severidade: 'atencao',
    titulo: 'Dry-spell watch in the Semiarid',
    mensagemAcessivel:
      'A short dry break during the rainy season may occur in the next 10 days. Avoid sowing all seeds at once.',
    mensagemTecnica:
      'Historical mid-season dry-spell probability of 44%–62% across semiarid Bahia microregions.',
    criadoEm: new Date().toISOString(),
    lido: false,
  },
  {
    id: 'al-3',
    categoria: 'fitossanitario',
    severidade: 'atencao',
    titulo: 'Crop health watch: leafhoppers & aphids after heat spikes',
    mensagemAcessivel:
      'With intense sun and yellowing leaf edges, inspect a leaf with the app camera before applying bio-control.',
    mensagemTecnica:
      'Thermal stress (MODIS LST) favors sap-sucking pests in young cowpea and maize plots.',
    criadoEm: new Date().toISOString(),
    lido: false,
  },
];

const SEED_ALERTS_PT_COPY: Record<
  string,
  Pick<ProactiveAlertItem, 'titulo' | 'mensagemAcessivel' | 'mensagemTecnica'>
> = {
  'al-1': {
    titulo: 'Janela de plantio aberta no Recôncavo',
    mensagemAcessivel:
      'A terra segurou chuva nos últimos dias. Bom momento para semear feijão-caupi com cobertura de palha.',
    mensagemTecnica:
      'Umidade SMAP estável por 9 dias e risco de veranico em 18% (NASA IMERG).',
  },
  'al-2': {
    titulo: 'Atenção para veranico no Semiárido',
    mensagemAcessivel:
      'No Sertão, pode dar uma estiagem no meio das chuvas nos próximos 10 dias. Não gaste toda a semente de uma vez.',
    mensagemTecnica:
      'Probabilidade histórica de veranico de 44%–62% nas microrregiões semiáridas da Bahia.',
  },
  'al-3': {
    titulo: 'Alerta fitossanitário: cigarrinha e pulgão após calor',
    mensagemAcessivel:
      'Com sol forte e folha amarelando na borda da roça, use a câmera do app para checar a folha e aplique calda de nim se precisar.',
    mensagemTecnica:
      'Estresse térmico (MODIS LST) favorece pragas sugadoras em feijão-caupi e milho jovem.',
  },
};

export function getLocalizedAlerts(
  lang: AppLanguage,
  existing?: ProactiveAlertItem[]
): ProactiveAlertItem[] {
  const enById = Object.fromEntries(SEED_ALERTS.map((a) => [a.id, a]));
  const baseList = existing && existing.length > 0 ? existing : SEED_ALERTS;
  return baseList.map((item) => {
    if (lang === 'pt') {
      const pt = SEED_ALERTS_PT_COPY[item.id];
      return pt ? { ...item, ...pt } : item;
    }
    const en = enById[item.id];
    return en
      ? {
          ...item,
          titulo: en.titulo,
          mensagemAcessivel: en.mensagemAcessivel,
          mensagemTecnica: en.mensagemTecnica,
        }
      : item;
  });
}

export function localizeBiome(
  bioma: 'Caatinga' | 'Mata Atlântica' | 'Cerrado',
  lang: AppLanguage
): string {
  if (lang === 'pt') return bioma;
  if (bioma === 'Mata Atlântica') return 'Atlantic Forest';
  return bioma;
}

export function getLocalizedCrops(lang: AppLanguage): CropDecisionItem[] {
  if (lang === 'pt') return SEED_CROPS;
  return SEED_CROPS.map((crop) => {
    switch (crop.id) {
      case 'feijao-caupi':
        return {
          ...crop,
          nome: 'Cowpea (Black-eyed Bean)',
          observacao: 'Handles short dry spells well and fixes nitrogen in the soil.',
        };
      case 'mandioca':
        return {
          ...crop,
          nome: 'Cassava / Yuca',
          observacao: 'Reliable in-ground food reserve through dry months.',
        };
      case 'milho-crioulo':
        return {
          ...crop,
          nome: 'Landrace / Dryland Maize',
          observacao: 'Needs steady rain at tasseling; avoid sowing on a false rain start.',
        };
      case 'sorgo-forrageiro':
        return {
          ...crop,
          nome: 'Grain / Forage Sorghum',
          observacao: 'Withstands up to 40% less water than standard maize without crop failure.',
        };
      case 'palma-forrageira':
        return {
          ...crop,
          nome: 'Sweet Forage Cactus Pear',
          observacao: 'Living reserve of water and forage for livestock and edible shoots.',
        };
      default:
        return crop;
    }
  });
}

export function getLocalizedPancs(lang: AppLanguage): EdiblePlantPANC[] {
  if (lang === 'pt') return SEED_PANCS;
  return SEED_PANCS.map((p) => {
    switch (p.id) {
      case 'panc-palma':
        return {
          ...p,
          nomePopular: 'Cactus Pear (Nopalitos / Young Pads)',
          parteComestivel: 'Tender young pads and fruits',
          cultivoRapido:
            'Plant the pad upright burying 1/3 in dry or moist soil; no watering needed for the first 10 days.',
          preparoCulinario:
            'Scrape off tiny spines, slice into strips and saute with onion, garlic, and egg or stew with beans.',
        };
      case 'panc-mandacaru-sem-espinho':
        return {
          ...p,
          nomePopular: 'Spineless Mandacaru Cactus (Shoots & Fruit)',
          parteComestivel: 'Soft inner core of young shoots and sweet fruit pulp',
          cultivoRapido:
            'Take a healthy cutting, let it callous 5 days in shade, and plant in drained backyard soil.',
          preparoCulinario:
            'Dice into cubes, boil for 8 minutes draining water, and use in stews or fruit preserves.',
        };
      case 'panc-umbu':
        return {
          ...p,
          nomePopular: 'Umbu Tree (Fruit & Root Tuber)',
          parteComestivel: 'Green or ripe fruit and water-storing tuber',
          cultivoRapido:
            'Plant thick cuttings at the onset of rains or protect native seedlings with living fences.',
          preparoCulinario:
            'Simmer umbu fruit with milk or water for umbuzada or prepare pulp preserves.',
        };
      case 'panc-beldroega':
        return {
          ...p,
          nomePopular: 'Common Purslane',
          parteComestivel: 'Leaves, tender stems, and seeds (rich in omega-3 & iron)',
          cultivoRapido:
            'Sprouts spontaneously after light dew; keep in lightly shaded beds under straw mulch.',
          preparoCulinario:
            'Wash well and eat fresh in lemon salad or quickly folded into cooked beans and couscous.',
        };
      case 'panc-ora-pro-nobis':
        return {
          ...p,
          nomePopular: 'Barbados Gooseberry (Ora-pro-nóbis)',
          parteComestivel: 'High-protein, iron-rich leaves (up to 25% dry weight)',
          cultivoRapido:
            'Cut a 20 cm woody stem, remove lower leaves, and plant along fences with minimal water.',
          preparoCulinario:
            'Chop leaves into bean broth, rice, omelets, or cornmeal porridge to boost family protein.',
        };
      case 'cultura-feijao-caupi':
        return {
          ...p,
          nomePopular: 'Cowpea (Dry & Green Pods)',
          parteComestivel: 'Dry beans, fresh green beans, and tender pods',
          cultivoRapido:
            'Sow in shallow holes (3 cm) right after rain wets topsoil at least a handspan deep.',
          preparoCulinario:
            'Simmer fresh green beans or pair with rice/cassava flour for balanced nutrition.',
        };
      case 'cultura-sorgo':
        return {
          ...p,
          nomePopular: 'Food & Forage Sorghum',
          parteComestivel: 'Grains for flour/porridge and green biomass for livestock',
          cultivoRapido:
            'Direct substitute for maize in dry years; ratoons after harvest with minimal moisture.',
          preparoCulinario:
            'Toast or mill grains for porridge, popped sorghum snacks, or flour blends.',
        };
      default:
        return p;
    }
  });
}

export function getOfficialDataSources(lang: AppLanguage) {
  if (lang === 'pt') return OFFICIAL_DATA_SOURCES;
  return [
    {
      categoria: 'Satellites & Climate Models — NASA',
      itens: [
        'NASA GPM IMERG — High-resolution daily and weekly rainfall',
        'NASA POWER — Max/min air temperature and solar radiation (ET₀)',
        'NASA SMAP & GLDAS — Surface and root-zone soil moisture',
        'NASA MODIS / VIIRS / HLS 30m — Vegetation vigor (NDVI) and ground cover',
        'NASA MODIS LST / ECOSTRESS — Land surface temperature and thermal stress',
        'NASA SRTM / NASADEM 30m — Terrain slope, relief, and drainage lines',
        'NASA GRACE-FO — Regional aquifer groundwater recharge trends',
        'NASA NEX-GDDP-CMIP6 — Regional 2030–2050 climate projections',
      ],
    },
    {
      categoria: 'Soil, Groundwater & Agronomy',
      itens: [
        'ISRIC SoilGrids — Soil pH, texture (sand/clay), and organic carbon',
        'SIAGAS / CPRM — Groundwater well registry, depth, and salinity',
        'Embrapa ZARC & Semiarid — Agricultural Climate Risk Zoning',
      ],
    },
    {
      categoria: 'Socioeconomics & Food Security (IBGE / MMA / INSA)',
      itens: [
        'IBGE (Ag Census, PNAD, POF/VigiSAN, ICT Survey) — Official Northeast rural baseline',
        'MMA / MDS — Official Brazilian Sociobiodiversity List',
        'INSA / Flora do Brasil / GBIF — Drought-tolerant native food plants',
      ],
    },
  ];
}

export const OFFICIAL_DATA_SOURCES = [
  {
    categoria: 'Satélites e Modelos Climáticos — NASA',
    itens: [
      'NASA GPM IMERG — Chuva diária e semanal de alta resolução',
      'NASA POWER — Temperatura máxima/mínima e radiação solar (ET₀)',
      'NASA SMAP & GLDAS — Umidade do solo superficial e radicular',
      'NASA MODIS / VIIRS / HLS 30m — Vigor das folhas (NDVI) e cobertura do solo',
      'NASA MODIS LST / ECOSTRESS — Temperatura da superfície e estresse térmico',
      'NASA SRTM / NASADEM 30m — Declividade, relevo e linhas de drenagem',
      'NASA GRACE-FO — Tendência regional de recarga do lençol aquífero',
      'NASA NEX-GDDP-CMIP6 — Projeções climáticas regionais 2030–2050',
    ],
  },
  {
    categoria: 'Solo, Água Subterrânea e Agronomia',
    itens: [
      'ISRIC SoilGrids — pH do solo, textura (areia/argila) e carbono orgânico',
      'SIAGAS / CPRM — Cadastro real de poços tubulares, profundidade e salinidade',
      'Embrapa ZARC & Semiárido — Zoneamento Agrícola de Risco Climático',
    ],
  },
  {
    categoria: 'Socioeconomia e Segurança Alimentar (IBGE / MMA / INSA)',
    itens: [
      'IBGE (Censo Agropecuário, PNAD Contínua, POF/VigiSAN, Pesquisa TIC) — Base oficial rural do Nordeste',
      'MMA / MDS — Lista Oficial da Sociobiodiversidade Brasileira',
      'INSA / Flora do Brasil / GBIF — Plantas nativas comestíveis (PANCs) do Semiárido',
    ],
  },
];

export function buildInitialSeedFarms(): Partial<FarmProperty>[] {
  return [
    {
      id: 'farm-maria-reconcavo',
      farmerId: 'farmer-maria',
      nome: 'Roça Esperança',
      municipio: 'Cruz das Almas',
      estado: 'BA',
      regiaoNome: 'Recôncavo Baiano',
      bioma: 'Mata Atlântica',
      centroid: { latitude: -12.9714, longitude: -38.5014 },
      polygon: createMicroPlotAroundPoint({ latitude: -12.9714, longitude: -38.5014 }, 3.8),
      areaHectares: 3.8,
      areaTarefasBa: 8.72,
      raioBuscaKm: 15,
      culturaPrincipal: 'Feijão-Caupi + Mandioca',
    },
    {
      id: 'farm-joao-sertao',
      farmerId: 'farmer-joao',
      nome: 'Sítio Mandacaru',
      municipio: 'Feira de Santana',
      estado: 'BA',
      regiaoNome: 'Portal do Sertão',
      bioma: 'Caatinga',
      centroid: { latitude: -12.2664, longitude: -38.9663 },
      polygon: createMicroPlotAroundPoint({ latitude: -12.2664, longitude: -38.9663 }, 6.4),
      areaHectares: 6.4,
      areaTarefasBa: 14.69,
      raioBuscaKm: 20,
      culturaPrincipal: 'Feijão-Caupi + Milho',
    },
  ];
}
