import {
  DEFAULT_IRECE_FARM_CENTROID,
  DEFAULT_IRECE_LOT1_POLYGON,
  DEFAULT_IRECE_LOT2_POLYGON,
} from '../data/seedData';
import {
  FarmProperty,
  GeoPoint,
  NasaDiagnosticsPackage,
  PlantingLot,
  ProblemReportType,
  RegionalProblemReport,
  RotationComparisonStrategy,
} from '../types/domain';
import { calculatePolygonMetrics, createMicroPlotAroundPoint } from './geoprocessing';
import { cropCodeFromName } from './dssatLogic';
import dssatCatalog from '../../apps/api/app/crops.json';

export const LOT_PALETTE = [
  '#16A34A', // Verde safra
  '#2563EB', // Azul água
  '#D97706', // Âmbar sertão
  '#9333EA', // Roxo mandioca
  '#0D9488', // Turquesa palma
  '#DB2777', // Rosa cobertura
];

const LOCAL_PLANT_CHIPS = [
  'Feijão-Caupi',
  'Mandioca',
  'Milho',
  'Sorgo',
  'Palma Forrageira',
  'Milheto (cobertura)',
  'Feijão-de-Porco',
  'Crotalária',
  'Hortaliças / PANCs',
];

// O catálogo versionado mantém o cadastro e o histórico disponíveis offline.
const localCropCodes = new Set(LOCAL_PLANT_CHIPS.map((plant) => cropCodeFromName(plant, dssatCatalog.crops)));
export const PLANT_CATALOG_CHIPS = [
  ...LOCAL_PLANT_CHIPS,
  ...dssatCatalog.crops.filter(({ code }) => !localCropCodes.has(code)).map(({ name }) => name),
];

function subdividePolygonIntoTwoLots(
  centroid: GeoPoint,
  areaHectares: number,
  farmPolygon?: GeoPoint[]
): { poly1: GeoPoint[]; poly2: GeoPoint[] } {
  const isDefaultIrece =
    Math.abs(centroid.latitude - DEFAULT_IRECE_FARM_CENTROID.latitude) < 0.008 &&
    Math.abs(centroid.longitude - DEFAULT_IRECE_FARM_CENTROID.longitude) < 0.008;

  if (isDefaultIrece && (!farmPolygon || farmPolygon.length === 4)) {
    return {
      poly1: DEFAULT_IRECE_LOT1_POLYGON.map((pt) => ({ ...pt })),
      poly2: DEFAULT_IRECE_LOT2_POLYGON.map((pt) => ({ ...pt })),
    };
  }

  const basePoly =
    farmPolygon && farmPolygon.length >= 3
      ? farmPolygon
      : createMicroPlotAroundPoint(centroid, Math.max(0.8, areaHectares || 4.2));

  const lats = basePoly.map((p) => p.latitude);
  const lons = basePoly.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const latPad = (maxLat - minLat) * 0.08;
  const lonPad = (maxLon - minLon) * 0.08;
  const midLon = (minLon + maxLon) / 2;
  const gapLon = (maxLon - minLon) * 0.03;

  const poly1: GeoPoint[] = [
    { latitude: Number((maxLat - latPad).toFixed(6)), longitude: Number((minLon + lonPad).toFixed(6)) },
    { latitude: Number((maxLat - latPad).toFixed(6)), longitude: Number((midLon - gapLon).toFixed(6)) },
    { latitude: Number((minLat + latPad).toFixed(6)), longitude: Number((midLon - gapLon).toFixed(6)) },
    { latitude: Number((minLat + latPad).toFixed(6)), longitude: Number((minLon + lonPad).toFixed(6)) },
  ];
  const poly2: GeoPoint[] = [
    { latitude: Number((maxLat - latPad).toFixed(6)), longitude: Number((midLon + gapLon).toFixed(6)) },
    { latitude: Number((maxLat - latPad).toFixed(6)), longitude: Number((maxLon - lonPad).toFixed(6)) },
    { latitude: Number((minLat + latPad).toFixed(6)), longitude: Number((maxLon - lonPad).toFixed(6)) },
    { latitude: Number((minLat + latPad).toFixed(6)), longitude: Number((midLon + gapLon).toFixed(6)) },
  ];
  return { poly1, poly2 };
}

export function createDefaultLotsForFarm(
  centroid: GeoPoint,
  areaHectares: number,
  culturaPrincipal: string,
  farmPolygon?: GeoPoint[]
): PlantingLot[] {
  const { poly1, poly2 } = subdividePolygonIntoTwoLots(centroid, areaHectares, farmPolygon);

  const plants = culturaPrincipal
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean);
  const firstPlant = plants[0] || 'Feijão-Caupi';
  const secondPlant = plants[1] || 'Mandioca';
  const m1 = calculatePolygonMetrics(poly1);
  const m2 = calculatePolygonMetrics(poly2);

  return [
    {
      id: 'lot-1',
      nome: 'Lote 1 — Principal',
      corHex: LOT_PALETTE[0],
      polygon: poly1,
      areaHectares: m1.areaHectares,
      areaTarefasBa: m1.areaTarefasBa,
      sistema: plants.length > 1 ? 'rotacao' : 'monocultura',
      culturaAtual: culturaPrincipal,
      plantasRotacao: plants.length > 0 ? plants : [firstPlant],
      tempoPlantadaDias: 47,
      temDataColheita: true,
      dataColheitaPrevista: 'Em ~28 dias',
      cronogramaPlantacao: `${firstPlant} (dias 1–65) → ${secondPlant} + palha (dias 66–180)`,
      progressoRealPct: 63,
      progressoEsperadoPct: 66,
      retornoFinanceiroEstR$: Math.round(m1.areaHectares * 3150),
      historicoTerra: ['Milho sequeiro (2024)', 'Feijão-Caupi (2025)'],
      culturasFuturas: ['Sorgo Forrageiro', 'Palma em faixas'],
      fotosValidacao: [],
    },
    {
      id: 'lot-2',
      nome: 'Lote 2 — Reserva / Forragem',
      corHex: LOT_PALETTE[1],
      polygon: poly2,
      areaHectares: m2.areaHectares,
      areaTarefasBa: m2.areaTarefasBa,
      sistema: 'rotacao',
      culturaAtual: `${secondPlant} + Sorgo`,
      plantasRotacao: [secondPlant, 'Sorgo', 'Palma Forrageira'],
      tempoPlantadaDias: 32,
      temDataColheita: false,
      cronogramaPlantacao: `${secondPlant} + cobertura viva contínua para segurar umidade`,
      progressoRealPct: 41,
      progressoEsperadoPct: 45,
      retornoFinanceiroEstR$: Math.round(m2.areaHectares * 2680),
      historicoTerra: ['Pasto nativo / descanso (2024)'],
      culturasFuturas: ['Feijão-Caupi', 'Milheto (cobertura)'],
      fotosValidacao: [],
    },
  ];
}

export function buildSevenDayClimateSeries(diag: NasaDiagnosticsPackage): {
  dia: string;
  chuvaMm: number;
  umidadePct: number;
  calorC: number;
}[] {
  const baseMax = diag.climaDia.tempMaxC;
  const baseUmid = diag.climaDia.umidadeRelativaPct;
  const baseChuva = diag.climaDia.chuvaHojeMm;
  const riskVeranico = diag.modeloC.probabilidadeVeranicoPct / 100;

  const dias = ['Hoje', 'D+1', 'D+2', 'D+3', 'D+4', 'D+5', 'D+6'];
  const rainCurve = [1.0, 0.75, 0.3, 0.15, 0.65, 1.15, 0.85];
  const tempDelta = [0, 1, 2, 2, 0, -1, 0];
  const humDelta = [0, -3, -7, -10, -2, 6, 3];

  return dias.map((dia, idx) => {
    const chuvaRaw = Math.max(
      0,
      Math.round((baseChuva * rainCurve[idx] + (idx === 5 ? 6 : 0)) * (1 - riskVeranico * 0.45))
    );
    const umid = Math.min(96, Math.max(24, Math.round(baseUmid + humDelta[idx])));
    const calor = Math.min(44, Math.max(22, Math.round(baseMax + tempDelta[idx])));
    return {
      dia,
      chuvaMm: chuvaRaw,
      umidadePct: umid,
      calorC: calor,
    };
  });
}

export interface ForecastDayCell {
  key: string;
  dayNum: number;
  status: 'normal' | 'chuva_boa' | 'veranico' | 'calor_extremo' | 'solo_exposto';
  resumo: string;
}

export interface ForecastMonthBlock {
  mesLabel: string;
  dias: ForecastDayCell[];
}

export function buildQuarterlyForecastCalendar(
  diag: NasaDiagnosticsPackage
): ForecastMonthBlock[] {
  const now = new Date();
  const monthNames = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];

  const veranicoHigh = diag.modeloC.probabilidadeVeranicoPct >= 40;
  const droughtSevere =
    diag.modeloB.nivel === 'alerta' || diag.modeloB.nivel === 'seca_confirmada';
  const erosionHigh = diag.modeloD.nivel === 'alto';

  return [0, 1, 2].map((offset) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const monthIndex = d.getMonth();
    const totalDays = 28;
    const cells: ForecastDayCell[] = [];

    for (let day = 1; day <= totalDays; day++) {
      let status: ForecastDayCell['status'] = 'normal';
      let resumo = 'Condição estável para manejo';

      if (offset === 0 && day >= 8 && day <= 14 && (veranicoHigh || droughtSevere)) {
        status = 'veranico';
        resumo = 'Risco de veranico (SMAP + IMERG): evite semear área toda.';
      } else if (offset === 1 && day >= 10 && day <= 17 && (droughtSevere || diag.climaDia.tempMaxC >= 32)) {
        status = 'calor_extremo';
        resumo = 'Estresse térmico MODIS LST: proteja raízes com palhada.';
      } else if (offset === 2 && day >= 12 && day <= 19 && (erosionHigh || diag.modeloD.mesesSoloExposto >= 2)) {
        status = 'solo_exposto';
        resumo = 'Período crítico de solo descoberto / erosão (SRTM + chuva intensa).';
      } else if ((day === 4 || day === 5 || day === 21 || day === 22) && !droughtSevere) {
        status = 'chuva_boa';
        resumo = 'Janela favorável de chuva e umidade (GPM IMERG).';
      }

      cells.push({
        key: `${monthIndex}-${day}`,
        dayNum: day,
        status,
        resumo,
      });
    }

    return {
      mesLabel: `${monthNames[monthIndex]} / ${d.getFullYear()}`,
      dias: cells,
    };
  });
}

export function buildRotationComparisonOptions(
  farm: FarmProperty,
  activeLot?: PlantingLot
): RotationComparisonStrategy[] {
  const diag = farm.diagnostico;
  const baseHa = activeLot?.areaHectares || farm.areaHectares || 3.5;
  const isMono = activeLot?.sistema === 'monocultura';
  const currentTitle =
    activeLot?.culturaAtual || farm.culturaPrincipal || 'Feijão-Caupi + Mandioca';
  const currentPlants =
    activeLot && activeLot.plantasRotacao.length > 0
      ? activeLot.plantasRotacao
      : currentTitle.split('+').map((s) => s.trim()).filter(Boolean);

  const currentScore = isMono
    ? 44
    : currentTitle.toLowerCase().includes('palma') || currentTitle.toLowerCase().includes('sorgo')
    ? 89
    : 71;

  const currentStrategy: RotationComparisonStrategy = {
    id: 'strat-atual',
    nome: `${currentTitle} (Atual)`,
    isAtual: true,
    sistema: isMono ? 'monocultura' : 'rotacao',
    plantas: currentPlants,
    scoreResiliencia: currentScore,
    demandaAgua: isMono ? 'alta' : 'media',
    fixacaoNitrogenio: currentPlants.some((p) => p.toLowerCase().includes('feij')),
    valorForragem: currentPlants.some(
      (p) => p.toLowerCase().includes('palma') || p.toLowerCase().includes('sorgo')
    )
      ? 'alto'
      : 'medio',
    quebraCicloPragas: isMono ? 'baixa' : 'media',
    reducaoErosaoPct: isMono ? 12 : 42,
    retornoLiquidoEstHaR$: Math.round(
      (activeLot?.retornoFinanceiroEstR$ ?? baseHa * 2800) / Math.max(0.5, baseHa)
    ),
    porqueSugerida: isMono
      ? 'Sistema atual em cultivo único no lote; serve como linha de base para comparar ganho hídrico e biológico.'
      : 'Sistema atual cadastrado no seu lote, usado como referência frente às alternativas NASA + Embrapa.',
    evidencias: `SMAP ${diag.modeloA.smapTendencia} • Veranico ${diag.modeloC.probabilidadeVeranicoPct}% • Solo pH ${diag.soloSoilGrids.ph}`,
    beneficios: isMono
      ? 'Manejo conhecido na propriedade, porém vulnerável a veranicos acima de 10 dias e cigarrinha.'
      : 'Já diversifica raízes e reduz parte do risco de perda total no sequeiro.',
    lacunasInformacao:
      'Sem pluviômetro local contínuo e análise laboratorial recente de NPK, valores de umidade dependem do pixel SMAP/GLDAS (~9 km).',
    riscosRevisaoLocal: isMono
      ? 'Alto risco de compactação, erosão laminar e multiplicação de pragas no mesmo talhão.'
      : 'Confirmar se a janela de chuva local permite concluir a colheita antes do estresse térmico.',
  };

  const sorgoPalma: RotationComparisonStrategy = {
    id: 'strat-sorgo-palma',
    nome: 'Feijão-Caupi + Sorgo + Palma Forrageira',
    isAtual: false,
    sistema: 'rotacao',
    plantas: ['Feijão-Caupi', 'Sorgo', 'Palma Forrageira'],
    scoreResiliencia: 91,
    demandaAgua: 'baixa',
    fixacaoNitrogenio: true,
    valorForragem: 'alto',
    quebraCicloPragas: 'alta',
    reducaoErosaoPct: 76,
    retornoLiquidoEstHaR$: 3480,
    porqueSugerida: `Recomendada pelos sinais ${diag.modeloB.sinaisAtivos}/4 da cascata de seca e projeção 2050 (+${diag.modeloE.semanasDeficitAdicionais} semanas de déficit).`,
    evidencias: `NASA POWER ET₀ ${diag.modeloA.et0PowerMm} mm • MODIS LST + Embrapa Semiárido ZARC.`,
    beneficios:
      'Feijão-Caupi fixa nitrogênio (até 45 kg/ha), sorgo substitui o milho com metade da água e a palma segura barreira viva contra erosão e garante forragem na seca.',
    lacunasInformacao:
      'Disponibilidade de raquetes sadias de palma resistente à cochonilha-do-carmim varia por município.',
    riscosRevisaoLocal:
      'Validar escoamento do terreno (SRTM) para não plantar palma em baixio encharcado.',
  };

  const coberturaMilheto: RotationComparisonStrategy = {
    id: 'strat-cobertura-mandioca',
    nome: 'Mandioca + Feijão-de-Porco + Milheto',
    isAtual: false,
    sistema: 'rotacao',
    plantas: ['Mandioca', 'Feijão-de-Porco', 'Milheto (cobertura)'],
    scoreResiliencia: 84,
    demandaAgua: 'baixa',
    fixacaoNitrogenio: true,
    valorForragem: 'medio',
    quebraCicloPragas: 'alta',
    reducaoErosaoPct: 82,
    retornoLiquidoEstHaR$: 3190,
    porqueSugerida: `Ideal quando há ${diag.modeloD.mesesSoloExposto} meses de solo exposto e risco de erosão ${diag.modeloD.nivel}.`,
    evidencias: `NASA SRTM declividade ${diag.modeloD.declividadePct}% + SoilGrids carbono ${diag.soloSoilGrids.carbonoOrganicoGKg} g/kg.`,
    beneficios:
      'Cobertura morta rápida reduz temperatura superficial do solo (MODIS LST) em até 4°C, eleva infiltração da chuva GPM e corta nematóides e ervas daninhas.',
    lacunasInformacao:
      'Tempo de decomposição da palha depende da umidade microbiana real do talhão.',
    riscosRevisaoLocal:
      'Roçar o milheto antes da floração plena para evitar competição por água com a mandioca jovem.',
  };

  // Evita duplicar se a atual já for igual à sugestão 2
  const distinctStrategies = [currentStrategy, sorgoPalma, coberturaMilheto];
  if (currentTitle.toLowerCase().includes('palma') && currentTitle.toLowerCase().includes('sorgo')) {
    distinctStrategies[1] = {
      id: 'strat-agroflorestal',
      nome: 'Umbuzeiro / Palma + Feijão-Caupi + Milho Crioulo',
      isAtual: false,
      sistema: 'rotacao',
      plantas: ['Feijão-Caupi', 'Milho Crioulo', 'Palma', 'Umbu (bordadura)'],
      scoreResiliencia: 93,
      demandaAgua: 'baixa',
      fixacaoNitrogenio: true,
      valorForragem: 'alto',
      quebraCicloPragas: 'alta',
      reducaoErosaoPct: 86,
      retornoLiquidoEstHaR$: 3720,
      porqueSugerida: 'Consórcio com árvores/frutíferas nativas reduz vento quente e preserva polinizadores.',
      evidencias: 'ECOSTRESS + MODIS NDVI mostram 18% maior estabilidade de vigor em áreas arborizadas.',
      beneficios: 'Renda complementar com umbu/polpa e microclima mais úmido dentro do lote.',
      lacunasInformacao: 'Retorno das mudas arbóreas inicia a partir do 3º ano.',
      riscosRevisaoLocal: 'Ajustar espaçamento para não sombrear excessivamente o feijão.',
    };
  }

  return distinctStrategies;
}

export const PROBLEM_REPORT_OPTIONS: {
  id: ProblemReportType;
  label: string;
  icon: string;
  dicaRapida: string;
}[] = [
  {
    id: 'seca_estiagem',
    label: 'Falta de chuva / Seca',
    icon: 'sunny-outline',
    dicaRapida: 'Cubra o solo com palha e concentre o plantio na área mais úmida.',
  },
  {
    id: 'praga_inseto',
    label: 'Praga / Inseto na lavoura',
    icon: 'bug-outline',
    dicaRapida: 'Alterne famílias botânicas na próxima safra e use calda natural de nim.',
  },
  {
    id: 'doenca_folha',
    label: 'Folha amarela / Mancha',
    icon: 'leaf-outline',
    dicaRapida: 'Tire uma foto para medir clorofila/estresse hídrico e evite adubar no pico do sol.',
  },
  {
    id: 'erosao_solo',
    label: 'Enxurrada / Erosão no solo',
    icon: 'trending-down-outline',
    dicaRapida: 'Crie cordões de contorno ou fileiras de palma cortando a descida da água.',
  },
  {
    id: 'excesso_chuva',
    label: 'Encharcamento / Chuva forte',
    icon: 'rainy-outline',
    dicaRapida: 'Abra pequenos drenos rasos para evitar apodrecimento de raízes.',
  },
  {
    id: 'solo_fraco',
    label: 'Terra fraca / Compactada',
    icon: 'layers-outline',
    dicaRapida: 'Inclua feijão-caupi ou feijão-de-porco na rotação para repor nitrogênio.',
  },
];

export const REGIONAL_SIMILAR_PROBLEMS: RegionalProblemReport[] = [
  {
    id: 'reg-1',
    autor: 'Seu Antônio (Associação Umbuzeiro)',
    municipio: 'Euclides da Cunha / Serrinha',
    bioma: 'Caatinga',
    tipoProblema: 'seca_estiagem',
    titulo: 'Veranico de 12 dias queimando folha nova de milho',
    descricao:
      'Plantei milho puro em metade da tarefa e secou antes da espiga. Na outra metade com sorgo + feijão-caupi sobre palha de milheto, segurou até a próxima chuva.',
    haQuantosDias: 4,
    acaoQueFuncionou: 'Cobrir entrelinha com resteva seca e migrar área de risco para Sorgo + Palma.',
  },
  {
    id: 'reg-2',
    autor: 'Dona Lourdes (Cooperativa Recôncavo)',
    municipio: 'Cruz das Almas / Cachoeira',
    bioma: 'Mata Atlântica',
    tipoProblema: 'doenca_folha',
    titulo: 'Pulgão e amarelamento nas bordas do feijão-caupi',
    descricao:
      'Depois de 5 dias muito quentes seguidos, apareceram colônias de pulgão na borda oeste do lote.',
    haQuantosDias: 2,
    acaoQueFuncionou: 'Aplicação no fim da tarde de óleo de nim + água com sabão neutro e bordadura de gergelim.',
  },
  {
    id: 'reg-3',
    autor: 'Zé Raimundo (Comunidade Riacho Fundo)',
    municipio: 'Irecê / Oeste Baiano',
    bioma: 'Cerrado',
    tipoProblema: 'erosao_solo',
    titulo: 'Chuva forte abriu sulcos na cabeceira do talhão inclinado',
    descricao:
      'A primeira pancada de 42 mm arrastou semente recém-plantada no terreno sem curvas de nível.',
    haQuantosDias: 6,
    acaoQueFuncionou: 'Plantio cortando a descida do morro com faixas de palma + capim-vetiver.',
  },
  {
    id: 'reg-4',
    autor: 'Maria do Carmo (Alto Sertão)',
    municipio: 'Nossa Senhora da Glória (SE)',
    bioma: 'Caatinga',
    tipoProblema: 'solo_fraco',
    titulo: 'Terreno cansado após 4 anos só de milho',
    descricao:
      'Produção caiu quase metade nos últimos dois anos mesmo com chuva normal.',
    haQuantosDias: 9,
    acaoQueFuncionou: 'Consórcio com feijão-de-porco e esterco curtido devolveu vigor às folhas.',
  },
];

export function getRegionalSimilarProblems(
  bioma: 'Caatinga' | 'Mata Atlântica' | 'Cerrado',
  filterType?: ProblemReportType | null
): RegionalProblemReport[] {
  const byType = filterType
    ? REGIONAL_SIMILAR_PROBLEMS.filter((p) => p.tipoProblema === filterType)
    : REGIONAL_SIMILAR_PROBLEMS;
  const sorted = [...byType].sort((a, b) => {
    const aMatch = a.bioma === bioma ? 0 : 1;
    const bMatch = b.bioma === bioma ? 0 : 1;
    return aMatch - bMatch || a.haQuantosDias - b.haQuantosDias;
  });
  return sorted.length > 0 ? sorted : REGIONAL_SIMILAR_PROBLEMS;
}
