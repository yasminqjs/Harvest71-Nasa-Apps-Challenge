import {
  DEFAULT_IRECE_FARM_CENTROID,
  DEFAULT_IRECE_LOT1_POLYGON,
  DEFAULT_IRECE_LOT2_POLYGON,
} from '../data/seedData';
import {
  AppLanguage,
  FarmProperty,
  GeoPoint,
  NasaDiagnosticsPackage,
  PlantingLot,
  ProblemReportType,
  RegionalProblemReport,
  RotationComparisonStrategy,
} from '../types/domain';
import { pickLang } from '../i18n/locale';
import { calculatePolygonMetrics, createMicroPlotAroundPoint } from './geoprocessing';

export const LOT_PALETTE = [
  '#16A34A', // Harvest green
  '#2563EB', // Water blue
  '#D97706', // Semiarid amber
  '#9333EA', // Cassava purple
  '#0D9488', // Cactus teal
  '#DB2777', // Cover-crop pink
];

export const PLANT_CATALOG_CHIPS = [
  'Cowpea',
  'Cassava',
  'Maize',
  'Sorghum',
  'Forage Cactus Pear',
  'Pearl Millet (cover)',
  'Jack Bean',
  'Sunn Hemp',
  'Vegetables / Hardy Crops',
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

export function getPlantCatalogChips(lang: AppLanguage = 'en'): string[] {
  if (lang === 'pt') {
    return [
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
  }
  return PLANT_CATALOG_CHIPS;
}

export function createDefaultLotsForFarm(
  centroid: GeoPoint,
  areaHectares: number,
  culturaPrincipal: string,
  farmPolygon?: GeoPoint[],
  lang: AppLanguage = 'en'
): PlantingLot[] {
  const { poly1, poly2 } = subdividePolygonIntoTwoLots(
    centroid,
    areaHectares,
    farmPolygon
  );

  const plants = culturaPrincipal
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean);
  const firstGrain = plants[0] || pickLang(lang, 'Cowpea', 'Feijão-Caupi');
  const secondGrain =
    plants[1] && plants[1].toLowerCase() !== firstGrain.toLowerCase()
      ? plants[1]
      : pickLang(lang, 'Maize', 'Milho');
  const m1 = calculatePolygonMetrics(poly1);
  const m2 = calculatePolygonMetrics(poly2);

  return [
    {
      id: 'lot-1',
      nome: pickLang(
        lang,
        `Plot 1 — Southwest (${firstGrain})`,
        `Lote 1 — Talhão Sudoeste (${firstGrain})`
      ),
      corHex: LOT_PALETTE[2],
      polygon: poly1,
      areaHectares: m1.areaHectares,
      areaTarefasBa: m1.areaTarefasBa,
      sistema: 'rotacao',
      culturaAtual: firstGrain,
      plantasRotacao: [firstGrain, pickLang(lang, 'Pearl Millet (cover)', 'Milheto (cobertura)')],
      tempoPlantadaDias: 47,
      temDataColheita: true,
      dataColheitaPrevista: pickLang(lang, 'In ~23 days', 'Em ~23 dias'),
      cronogramaPlantacao: pickLang(
        lang,
        `${firstGrain} BRS Guariba (days 1–70) → Pearl Millet soil cover (post-harvest)`,
        `${firstGrain} BRS Guariba (dias 1–70) → Milheto cobertura de solo (pós-colheita)`
      ),
      progressoRealPct: 67,
      progressoEsperadoPct: 67,
      retornoFinanceiroEstR$: Math.round(m1.areaHectares * 7360),
      historicoTerra: [
        pickLang(lang, 'Maize BRS Caatingueiro (2024)', 'Milho BRS Caatingueiro (2024)'),
        pickLang(lang, 'Cowpea BRS Guariba (2025)', 'Feijão-Caupi BRS Guariba (2025)'),
      ],
      culturasFuturas: [
        pickLang(lang, 'Grain Sorghum', 'Sorgo Granífero'),
        pickLang(lang, 'Pearl Millet (cover)', 'Milheto (cobertura)'),
      ],
      fotosValidacao: [],
    },
    {
      id: 'lot-2',
      nome: pickLang(
        lang,
        `Plot 2 — East (${secondGrain} + Sorghum)`,
        `Lote 2 — Talhão Leste (${secondGrain} + Sorgo)`
      ),
      corHex: LOT_PALETTE[1],
      polygon: poly2,
      areaHectares: m2.areaHectares,
      areaTarefasBa: m2.areaTarefasBa,
      sistema: 'rotacao',
      culturaAtual: `${secondGrain} + ${pickLang(lang, 'Sorghum', 'Sorgo')}`,
      plantasRotacao: [secondGrain, pickLang(lang, 'Sorghum', 'Sorgo')],
      tempoPlantadaDias: 38,
      temDataColheita: true,
      dataColheitaPrevista: pickLang(lang, 'In ~57 days', 'Em ~57 dias'),
      cronogramaPlantacao: pickLang(
        lang,
        `${secondGrain} BRS Caatingueiro + Sorghum BRS Ponta Negra (days 1–95) → Jack Bean`,
        `${secondGrain} BRS Caatingueiro + Sorgo BRS Ponta Negra (dias 1–95) → Feijão-de-Porco`
      ),
      progressoRealPct: 40,
      progressoEsperadoPct: 42,
      retornoFinanceiroEstR$: Math.round(m2.areaHectares * 4620),
      historicoTerra: [
        pickLang(lang, 'Rainfed Cowpea (2024)', 'Feijão-Caupi sequeiro (2024)'),
        pickLang(lang, 'Grain Sorghum (2025)', 'Sorgo Granífero (2025)'),
      ],
      culturasFuturas: [
        pickLang(lang, 'Cowpea', 'Feijão-Caupi'),
        pickLang(lang, 'Sunn Hemp', 'Crotalária'),
      ],
      fotosValidacao: [],
    },
  ];
}

export function buildSevenDayClimateSeries(
  diag: NasaDiagnosticsPackage,
  lang: AppLanguage = 'en'
): {
  dia: string;
  chuvaMm: number;
  umidadePct: number;
  calorC: number;
}[] {
  const baseMax = diag.climaDia.tempMaxC;
  const baseUmid = diag.climaDia.umidadeRelativaPct;
  const baseChuva = diag.climaDia.chuvaHojeMm;
  const riskVeranico = diag.modeloC.probabilidadeVeranicoPct / 100;

  const dias = [
    pickLang(lang, 'Today', 'Hoje'),
    'D+1',
    'D+2',
    'D+3',
    'D+4',
    'D+5',
    'D+6',
  ];
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
  diag: NasaDiagnosticsPackage,
  lang: AppLanguage = 'en'
): ForecastMonthBlock[] {
  const now = new Date();
  const monthNames =
    lang === 'pt'
      ? [
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
        ]
      : [
          'January',
          'February',
          'March',
          'April',
          'May',
          'June',
          'July',
          'August',
          'September',
          'October',
          'November',
          'December',
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
      let resumo = pickLang(lang, 'Stable condition for field work', 'Condição estável para manejo');

      if (offset === 0 && day >= 8 && day <= 14 && (veranicoHigh || droughtSevere)) {
        status = 'veranico';
        resumo = pickLang(
          lang,
          'Mid-season dry-spell risk (SMAP + IMERG): avoid sowing the entire area at once.',
          'Risco de veranico (SMAP + IMERG): evite semear área toda.'
        );
      } else if (offset === 1 && day >= 10 && day <= 17 && (droughtSevere || diag.climaDia.tempMaxC >= 32)) {
        status = 'calor_extremo';
        resumo = pickLang(
          lang,
          'MODIS LST thermal stress: shield crop roots with straw mulch.',
          'Estresse térmico MODIS LST: proteja raízes com palhada.'
        );
      } else if (offset === 2 && day >= 12 && day <= 19 && (erosionHigh || diag.modeloD.mesesSoloExposto >= 2)) {
        status = 'solo_exposto';
        resumo = pickLang(
          lang,
          'Critical bare-soil / runoff period (SRTM + heavy rain).',
          'Período crítico de solo descoberto / erosão (SRTM + chuva intensa).'
        );
      } else if ((day === 4 || day === 5 || day === 21 || day === 22) && !droughtSevere) {
        status = 'chuva_boa';
        resumo = pickLang(
          lang,
          'Favorable rain and soil moisture window (GPM IMERG).',
          'Janela favorável de chuva e umidade (GPM IMERG).'
        );
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
  activeLot?: PlantingLot,
  lang: AppLanguage = 'en'
): RotationComparisonStrategy[] {
  const diag = farm.diagnostico;
  const baseHa = activeLot?.areaHectares || farm.areaHectares || 3.5;
  const isMono = activeLot?.sistema === 'monocultura';
  const currentTitle =
    activeLot?.culturaAtual ||
    farm.culturaPrincipal ||
    pickLang(lang, 'Cowpea + Cassava', 'Feijão-Caupi + Mandioca');
  const currentPlants =
    activeLot && activeLot.plantasRotacao.length > 0
      ? activeLot.plantasRotacao
      : currentTitle.split('+').map((s) => s.trim()).filter(Boolean);

  const currentScore = isMono
    ? 44
    : currentTitle.toLowerCase().includes('palma') ||
      currentTitle.toLowerCase().includes('sorgo') ||
      currentTitle.toLowerCase().includes('cactus') ||
      currentTitle.toLowerCase().includes('sorghum')
    ? 89
    : 71;

  const currentStrategy: RotationComparisonStrategy = {
    id: 'strat-atual',
    nome: `${currentTitle} (${pickLang(lang, 'Current', 'Atual')})`,
    isAtual: true,
    sistema: isMono ? 'monocultura' : 'rotacao',
    plantas: currentPlants,
    scoreResiliencia: currentScore,
    demandaAgua: isMono ? 'alta' : 'media',
    fixacaoNitrogenio: currentPlants.some(
      (p) => p.toLowerCase().includes('feij') || p.toLowerCase().includes('cowpea') || p.toLowerCase().includes('bean')
    ),
    valorForragem: currentPlants.some(
      (p) =>
        p.toLowerCase().includes('palma') ||
        p.toLowerCase().includes('sorgo') ||
        p.toLowerCase().includes('cactus') ||
        p.toLowerCase().includes('sorghum')
    )
      ? 'alto'
      : 'medio',
    quebraCicloPragas: isMono ? 'baixa' : 'media',
    reducaoErosaoPct: isMono ? 12 : 42,
    retornoLiquidoEstHaR$: Math.round(
      (activeLot?.retornoFinanceiroEstR$ ?? baseHa * 2800) / Math.max(0.5, baseHa)
    ),
    porqueSugerida: isMono
      ? pickLang(
          lang,
          'Current monoculture setup on the plot; serves as baseline to compare water and soil health gains.',
          'Sistema atual em cultivo único no lote; serve como linha de base para comparar ganho hídrico e biológico.'
        )
      : pickLang(
          lang,
          'Current registered plot system, used as baseline against NASA + Embrapa resilient alternatives.',
          'Sistema atual cadastrado no seu lote, usado como referência frente às alternativas NASA + Embrapa.'
        ),
    evidencias: pickLang(
      lang,
      `SMAP ${diag.modeloA.smapTendencia} • Dry spell ${diag.modeloC.probabilidadeVeranicoPct}% • Soil pH ${diag.soloSoilGrids.ph}`,
      `SMAP ${diag.modeloA.smapTendencia} • Veranico ${diag.modeloC.probabilidadeVeranicoPct}% • Solo pH ${diag.soloSoilGrids.ph}`
    ),
    beneficios: isMono
      ? pickLang(
          lang,
          'Familiar management on the property, but vulnerable to dry spells >10 days and leafhoppers.',
          'Manejo conhecido na propriedade, porém vulnerável a veranicos acima de 10 dias e cigarrinha.'
        )
      : pickLang(
          lang,
          'Already diversifies root depth and lowers total rainfed crop-failure risk.',
          'Já diversifica raízes e reduz parte do risco de perda total no sequeiro.'
        ),
    lacunasInformacao: pickLang(
      lang,
      'Without a local rain gauge and recent lab NPK test, soil moisture relies on the ~9 km SMAP/GLDAS pixel.',
      'Sem pluviômetro local contínuo e análise laboratorial recente de NPK, valores de umidade dependem do pixel SMAP/GLDAS (~9 km).'
    ),
    riscosRevisaoLocal: isMono
      ? pickLang(
          lang,
          'High risk of soil compaction, sheet erosion, and pest buildup in the same plot.',
          'Alto risco de compactação, erosão laminar e multiplicação de pragas no mesmo talhão.'
        )
      : pickLang(
          lang,
          'Confirm local rain window allows finishing harvest before peak heat stress.',
          'Confirmar se a janela de chuva local permite concluir a colheita antes do estresse térmico.'
        ),
  };

  const sorgoPalma: RotationComparisonStrategy = {
    id: 'strat-sorgo-palma',
    nome: pickLang(
      lang,
      'Cowpea + Sorghum + Forage Cactus Pear',
      'Feijão-Caupi + Sorgo + Palma Forrageira'
    ),
    isAtual: false,
    sistema: 'rotacao',
    plantas: [
      pickLang(lang, 'Cowpea', 'Feijão-Caupi'),
      pickLang(lang, 'Sorghum', 'Sorgo'),
      pickLang(lang, 'Forage Cactus Pear', 'Palma Forrageira'),
    ],
    scoreResiliencia: 91,
    demandaAgua: 'baixa',
    fixacaoNitrogenio: true,
    valorForragem: 'alto',
    quebraCicloPragas: 'alta',
    reducaoErosaoPct: 76,
    retornoLiquidoEstHaR$: 3480,
    porqueSugerida: pickLang(
      lang,
      `Recommended given ${diag.modeloB.sinaisAtivos}/4 drought cascade signals and 2050 outlook (+${diag.modeloE.semanasDeficitAdicionais} deficit weeks).`,
      `Recomendada pelos sinais ${diag.modeloB.sinaisAtivos}/4 da cascata de seca e projeção 2050 (+${diag.modeloE.semanasDeficitAdicionais} semanas de déficit).`
    ),
    evidencias: `NASA POWER ET₀ ${diag.modeloA.et0PowerMm} mm • MODIS LST + Embrapa ZARC.`,
    beneficios: pickLang(
      lang,
      'Cowpea fixes nitrogen (up to 45 kg/ha), sorghum replaces maize with half the water, and cactus pear builds living erosion barriers & dry-season forage.',
      'Feijão-Caupi fixa nitrogênio (até 45 kg/ha), sorgo substitui o milho com metade da água e a palma segura barreira viva contra erosão e garante forragem na seca.'
    ),
    lacunasInformacao: pickLang(
      lang,
      'Local availability of cochineal-resistant cactus pear pads varies by municipality.',
      'Disponibilidade de raquetes sadias de palma resistente à cochonilha-do-carmim varia por município.'
    ),
    riscosRevisaoLocal: pickLang(
      lang,
      'Check SRTM terrain drainage so cactus pear is not planted in waterlogged lowlands.',
      'Validar escoamento do terreno (SRTM) para não plantar palma em baixio encharcado.'
    ),
  };

  const coberturaMilheto: RotationComparisonStrategy = {
    id: 'strat-cobertura-mandioca',
    nome: pickLang(
      lang,
      'Cassava + Jack Bean + Pearl Millet',
      'Mandioca + Feijão-de-Porco + Milheto'
    ),
    isAtual: false,
    sistema: 'rotacao',
    plantas: [
      pickLang(lang, 'Cassava', 'Mandioca'),
      pickLang(lang, 'Jack Bean', 'Feijão-de-Porco'),
      pickLang(lang, 'Pearl Millet (cover)', 'Milheto (cobertura)'),
    ],
    scoreResiliencia: 84,
    demandaAgua: 'baixa',
    fixacaoNitrogenio: true,
    valorForragem: 'medio',
    quebraCicloPragas: 'alta',
    reducaoErosaoPct: 82,
    retornoLiquidoEstHaR$: 3190,
    porqueSugerida: pickLang(
      lang,
      `Ideal with ${diag.modeloD.mesesSoloExposto} months of bare soil and ${diag.modeloD.nivel} erosion risk.`,
      `Ideal quando há ${diag.modeloD.mesesSoloExposto} meses de solo exposto e risco de erosão ${diag.modeloD.nivel}.`
    ),
    evidencias: pickLang(
      lang,
      `NASA SRTM slope ${diag.modeloD.declividadePct}% + SoilGrids organic carbon ${diag.soloSoilGrids.carbonoOrganicoGKg} g/kg.`,
      `NASA SRTM declividade ${diag.modeloD.declividadePct}% + SoilGrids carbono ${diag.soloSoilGrids.carbonoOrganicoGKg} g/kg.`
    ),
    beneficios: pickLang(
      lang,
      'Fast straw mulch lowers soil surface heat (MODIS LST) up to 4°C, boosts GPM rainfall infiltration, and breaks nematodes & weeds.',
      'Cobertura morta rápida reduz temperatura superficial do solo (MODIS LST) em até 4°C, eleva infiltração da chuva GPM e corta nematóides e ervas daninhas.'
    ),
    lacunasInformacao: pickLang(
      lang,
      'Mulch breakdown speed depends on real soil microbial moisture in the plot.',
      'Tempo de decomposição da palha depende da umidade microbiana real do talhão.'
    ),
    riscosRevisaoLocal: pickLang(
      lang,
      'Cut pearl millet before full flowering so it does not compete for water with young cassava.',
      'Roçar o milheto antes da floração plena para evitar competição por água com a mandioca jovem.'
    ),
  };

  const distinctStrategies = [currentStrategy, sorgoPalma, coberturaMilheto];
  if (
    (currentTitle.toLowerCase().includes('palma') || currentTitle.toLowerCase().includes('cactus')) &&
    (currentTitle.toLowerCase().includes('sorgo') || currentTitle.toLowerCase().includes('sorghum'))
  ) {
    distinctStrategies[1] = {
      id: 'strat-agroflorestal',
      nome: pickLang(
        lang,
        'Umbu / Cactus + Cowpea + Landrace Maize',
        'Umbuzeiro / Palma + Feijão-Caupi + Milho Crioulo'
      ),
      isAtual: false,
      sistema: 'rotacao',
      plantas: [
        pickLang(lang, 'Cowpea', 'Feijão-Caupi'),
        pickLang(lang, 'Landrace Maize', 'Milho Crioulo'),
        pickLang(lang, 'Cactus Pear', 'Palma'),
        pickLang(lang, 'Umbu (border)', 'Umbu (bordadura)'),
      ],
      scoreResiliencia: 93,
      demandaAgua: 'baixa',
      fixacaoNitrogenio: true,
      valorForragem: 'alto',
      quebraCicloPragas: 'alta',
      reducaoErosaoPct: 86,
      retornoLiquidoEstHaR$: 3720,
      porqueSugerida: pickLang(
        lang,
        'Intercropping with native trees buffers hot winds and supports pollinators.',
        'Consórcio com árvores/frutíferas nativas reduz vento quente e preserva polinizadores.'
      ),
      evidencias: pickLang(
        lang,
        'ECOSTRESS + MODIS NDVI show 18% higher vigor stability in tree-buffered plots.',
        'ECOSTRESS + MODIS NDVI mostram 18% maior estabilidade de vigor em áreas arborizadas.'
      ),
      beneficios: pickLang(
        lang,
        'Supplemental income from umbu fruit/pulp and a cooler, moister microclimate inside the plot.',
        'Renda complementar com umbu/polpa e microclima mais úmido dentro do lote.'
      ),
      lacunasInformacao: pickLang(
        lang,
        'Tree fruit return starts from year 3 onward.',
        'Retorno das mudas arbóreas inicia a partir do 3º ano.'
      ),
      riscosRevisaoLocal: pickLang(
        lang,
        'Adjust spacing to avoid overshading cowpea.',
        'Ajustar espaçamento para não sombrear excessivamente o feijão.'
      ),
    };
  }

  return distinctStrategies;
}

export function getProblemReportOptions(lang: AppLanguage = 'en'): {
  id: ProblemReportType;
  label: string;
  icon: string;
  dicaRapida: string;
}[] {
  return [
    {
      id: 'seca_estiagem',
      label: pickLang(lang, 'Low rain / Drought', 'Falta de chuva / Seca'),
      icon: 'sunny-outline',
      dicaRapida: pickLang(
        lang,
        'Cover topsoil with straw mulch and focus sowing in the moistest zone.',
        'Cubra o solo com palha e concentre o plantio na área mais úmida.'
      ),
    },
    {
      id: 'praga_inseto',
      label: pickLang(lang, 'Pest / Insect in crops', 'Praga / Inseto na lavoura'),
      icon: 'bug-outline',
      dicaRapida: pickLang(
        lang,
        'Alternate botanical families next cycle and apply natural neem extract.',
        'Alterne famílias botânicas na próxima safra e use calda natural de nim.'
      ),
    },
    {
      id: 'doenca_folha',
      label: pickLang(lang, 'Yellow leaf / Spots', 'Folha amarela / Mancha'),
      icon: 'leaf-outline',
      dicaRapida: pickLang(
        lang,
        'Capture a photo to estimate chlorosis/heat stress and avoid fertilizing at midday.',
        'Tire uma foto para medir clorofila/estresse hídrico e evite adubar no pico do sol.'
      ),
    },
    {
      id: 'erosao_solo',
      label: pickLang(lang, 'Runoff / Soil erosion', 'Enxurrada / Erosão no solo'),
      icon: 'trending-down-outline',
      dicaRapida: pickLang(
        lang,
        'Build contour strips or cactus pear rows cutting across slope runoff.',
        'Crie cordões de contorno ou fileiras de palma cortando a descida da água.'
      ),
    },
    {
      id: 'excesso_chuva',
      label: pickLang(lang, 'Waterlogging / Heavy rain', 'Encharcamento / Chuva forte'),
      icon: 'rainy-outline',
      dicaRapida: pickLang(
        lang,
        'Open shallow drainage furrows to prevent root rot.',
        'Abra pequenos drenos rasos para evitar apodrecimento de raízes.'
      ),
    },
    {
      id: 'solo_fraco',
      label: pickLang(lang, 'Weak / Compacted soil', 'Terra fraca / Compactada'),
      icon: 'layers-outline',
      dicaRapida: pickLang(
        lang,
        'Include cowpea or jack bean in rotation to restore nitrogen.',
        'Inclua feijão-caupi ou feijão-de-porco na rotação para repor nitrogênio.'
      ),
    },
  ];
}

export const PROBLEM_REPORT_OPTIONS = getProblemReportOptions('en');

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
  filterType?: ProblemReportType | null,
  lang: AppLanguage = 'en'
): RegionalProblemReport[] {
  const pool: RegionalProblemReport[] =
    lang === 'pt'
      ? REGIONAL_SIMILAR_PROBLEMS
      : [
          {
            id: 'reg-1',
            autor: 'Seu Antônio (Umbuzeiro Assoc.)',
            municipio: 'Euclides da Cunha / Serrinha',
            bioma: 'Caatinga',
            tipoProblema: 'seca_estiagem',
            titulo: '12-day dry spell scorching young maize leaves',
            descricao:
              'Planted pure maize on half the plot and it dried before tasseling. The other half with sorghum + cowpea over millet straw held until the next rain.',
            haQuantosDias: 4,
            acaoQueFuncionou: 'Mulched rows with dry stover and shifted risk zone to Sorghum + Cactus Pear.',
          },
          {
            id: 'reg-2',
            autor: 'Dona Lourdes (Recôncavo Co-op)',
            municipio: 'Cruz das Almas / Cachoeira',
            bioma: 'Mata Atlântica',
            tipoProblema: 'doenca_folha',
            titulo: 'Aphids and edge yellowing on cowpea plots',
            descricao:
              'After 5 very hot days in a row, aphid colonies appeared along the west edge of the plot.',
            haQuantosDias: 2,
            acaoQueFuncionou: 'Late-afternoon neem oil + mild soap spray and sesame border strip.',
          },
          {
            id: 'reg-3',
            autor: 'Zé Raimundo (Riacho Fundo Community)',
            municipio: 'Irecê / Western Bahia',
            bioma: 'Cerrado',
            tipoProblema: 'erosao_solo',
            titulo: 'Heavy rain carved rills at the top of the sloped plot',
            descricao:
              'The first 42 mm storm washed away freshly sown seeds on ground without contour ridges.',
            haQuantosDias: 6,
            acaoQueFuncionou: 'Contour planting across the slope with cactus pear + vetiver strips.',
          },
          {
            id: 'reg-4',
            autor: 'Maria do Carmo (High Sertão)',
            municipio: 'Nossa Senhora da Glória (SE)',
            bioma: 'Caatinga',
            tipoProblema: 'solo_fraco',
            titulo: 'Exhausted soil after 4 years of continuous maize',
            descricao:
              'Yield dropped nearly half over the last two seasons despite normal rainfall.',
            haQuantosDias: 9,
            acaoQueFuncionou: 'Intercropping with jack bean and composted manure restored leaf vigor.',
          },
        ];

  const byType = filterType ? pool.filter((p) => p.tipoProblema === filterType) : pool;
  const sorted = [...byType].sort((a, b) => {
    const aMatch = a.bioma === bioma ? 0 : 1;
    const bMatch = b.bioma === bioma ? 0 : 1;
    return aMatch - bMatch || a.haQuantosDias - b.haQuantosDias;
  });
  return sorted.length > 0 ? sorted : pool;
}
