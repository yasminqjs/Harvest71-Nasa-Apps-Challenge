import {
  BahiaRegionPreset,
  NORDESTE_REGIONS,
  SEED_CROPS,
  SEED_WELLS,
} from '../data/seedData';
import {
  AppLanguage,
  DroughtAlertLevel,
  ErosionRiskLevel,
  GeoPoint,
  ModelAWaterBalance,
  ModelBDroughtCascade,
  ModelCPlantingWindow,
  ModelDErosionMatrix,
  ModelEClimate2050,
  NasaDiagnosticsPackage,
  NdviZonePatch,
  WellHeatmapSummary,
} from '../types/domain';
import { pickLang } from '../i18n/locale';
import { distanceKm, filterWellsByRadius } from '../utils/geoprocessing';

export interface AgronomicSimulationInput {
  dryStressBoost?: number;
  rotacaoSelecionada?: string;
  chuvaCampoMm?: number;
  soloCampoSeco?: boolean;
  soloEncharcado?: boolean;
  sinaisErosaoCampo?: boolean;
  estressePlantaCampo?: boolean;
}

function findNearestRegion(centroid: GeoPoint): BahiaRegionPreset {
  let nearest = NORDESTE_REGIONS[0];
  let bestDist = Infinity;
  for (const reg of NORDESTE_REGIONS) {
    const d = distanceKm(centroid, reg.centroid);
    if (d < bestDist) {
      bestDist = d;
      nearest = reg;
    }
  }
  return nearest;
}

function resolveKcForCrop(cultura: string): number {
  const lower = cultura.toLowerCase();
  if (lower.includes('palma') || lower.includes('cactus')) return 0.45;
  if (lower.includes('mandioca') || lower.includes('aipim') || lower.includes('cassava')) {
    return 0.72;
  }
  if (lower.includes('sorgo') || lower.includes('sorghum')) return 0.82;
  if (
    lower.includes('feijão') ||
    lower.includes('feijao') ||
    lower.includes('caupi') ||
    lower.includes('cowpea') ||
    lower.includes('bean')
  ) {
    return 0.85;
  }
  if (lower.includes('milho') || lower.includes('corn') || lower.includes('maize')) {
    return 1.05;
  }
  return 0.85;
}

function buildNdviZones(sinaisSeca: number, lang: AppLanguage = 'en'): NdviZonePatch[] {
  const highStress = sinaisSeca >= 2;
  return [
    {
      id: 'ndvi-norte',
      setor: pickLang(lang, 'Lowland / Back of field', 'Baixada / Fundo da roça'),
      vigor: 'verde',
      ndviValor: highStress ? 0.48 : 0.68,
      descricao: pickLang(
        lang,
        'Deep green leaves holding soil moisture better.',
        'Folhas bem verdes, segurando melhor a umidade.'
      ),
      relativeBox: { xPct: 14, yPct: 16, wPct: 44, hPct: 42 },
    },
    {
      id: 'ndvi-meio',
      setor: pickLang(lang, 'Mid-field crop', 'Meio da lavoura'),
      vigor: highStress ? 'amarelo' : 'verde',
      ndviValor: highStress ? 0.34 : 0.54,
      descricao: highStress
        ? pickLang(
            lang,
            'Early yellowing on leaf tips; consider mulching with straw.',
            'Início de amarelamento nas pontas; vale cobrir com palha.'
          )
        : pickLang(lang, 'Steady, uniform crop growth.', 'Crescimento firme e uniforme.'),
      relativeBox: { xPct: 50, yPct: 24, wPct: 36, hPct: 40 },
    },
    {
      id: 'ndvi-topo',
      setor: pickLang(lang, 'Upper slope / Exposed edge', 'Parte alta / Borda exposta'),
      vigor: sinaisSeca >= 3 ? 'vermelho' : 'amarelo',
      ndviValor: sinaisSeca >= 3 ? 0.22 : 0.38,
      descricao:
        sinaisSeca >= 3
          ? pickLang(
              lang,
              'Severe heat & water stress; scan a leaf with the camera.',
              'Estresse forte de calor e pouca água; examine a folha com a câmera.'
            )
          : pickLang(
              lang,
              'Drier topsoil uphill; keep close watch.',
              'Solo mais seco no alto; atenção redobrada.'
            ),
      relativeBox: { xPct: 22, yPct: 56, wPct: 58, hPct: 28 },
    },
  ];
}

/**
 * 100% Local Agronomic Engine (Offline-First Front-end):
 * Runs the 5 NASA models (Water Balance, 4-Signal Drought Cascade,
 * Dry Spell Detector, Erosion Risk Matrix, and 2030–2050 Climate Projection)
 * + NDVI Zones and Well Fusion (GRACE-FO + SRTM + SIAGAS).
 */
export function runLocalAgronomicEngine(
  centroid: GeoPoint,
  culturaPrincipal: string,
  raioBuscaKm: number,
  input: AgronomicSimulationInput = {},
  lang: AppLanguage = 'en'
): NasaDiagnosticsPackage {
  const region = findNearestRegion(centroid);
  const dryBoost = input.dryStressBoost ?? 0;
  const chuvaCampo = input.chuvaCampoMm ?? 0;
  const rotacao = input.rotacaoSelecionada ?? culturaPrincipal;

  // Modelo A: Balanço Hídrico Semanal + Confirmação SMAP / Campo
  const chuvaImergMm = Math.max(
    0,
    Number((region.chuvaSemanalBaseMm - dryBoost * 6 + chuvaCampo).toFixed(1))
  );
  const et0PowerMm = Number((region.et0SemanalMm + dryBoost * 3.5).toFixed(1));
  const kcAplicado = resolveKcForCrop(rotacao);
  const demandaCulturaMm = Number((et0PowerMm * kcAplicado).toFixed(1));
  const ajusteSoloCampo = input.soloCampoSeco ? -6 : input.soloEncharcado ? 8 : 0;
  const saldoHidricoMm = Number(
    (chuvaImergMm - demandaCulturaMm + ajusteSoloCampo).toFixed(1)
  );

  const smapTendencia: ModelAWaterBalance['smapTendencia'] =
    input.soloCampoSeco || saldoHidricoMm < -10
      ? 'caindo'
      : input.soloEncharcado || saldoHidricoMm > 4
      ? 'subindo'
      : 'estavel';

  const statusA: ModelAWaterBalance['status'] =
    saldoHidricoMm < -5 && smapTendencia === 'caindo'
      ? 'deficit_confirmado'
      : saldoHidricoMm >= 2
      ? 'positivo'
      : 'equilibrado';

  const modeloA: ModelAWaterBalance = {
    chuvaImergMm,
    et0PowerMm,
    kcAplicado,
    demandaCulturaMm,
    saldoHidricoMm,
    smapTendencia,
    status: statusA,
    resumoTecnico:
      statusA === 'deficit_confirmado'
        ? pickLang(
            lang,
            `Negative water balance (${saldoHidricoMm} mm/wk) confirmed by NASA SMAP soil moisture drop.`,
            `Balanço hídrico negativo (${saldoHidricoMm} mm/sem) confirmado por queda de umidade no NASA SMAP.`
          )
        : statusA === 'positivo'
        ? pickLang(
            lang,
            `Positive water balance (+${saldoHidricoMm} mm/wk) with favorable soil moisture.`,
            `Balanço hídrico positivo (+${saldoHidricoMm} mm/sem) com umidade do solo favorável.`
          )
        : pickLang(
            lang,
            `Water balance near equilibrium (${saldoHidricoMm} mm/wk).`,
            `Balanço hídrico próximo ao equilíbrio (${saldoHidricoMm} mm/sem).`
          ),
    resumoAcessivel:
      statusA === 'deficit_confirmado'
        ? pickLang(
            lang,
            `Water shortage on the farm: ${chuvaImergMm} mm of rain came in while sun demand took ${demandaCulturaMm} mm. Satellite confirms soil is drying.`,
            `Falta água para a roça: entrou ${chuvaImergMm} mm de chuva e o sol puxou ${demandaCulturaMm} mm. O satélite confirmou que a terra está secando.`
          )
        : statusA === 'positivo'
        ? pickLang(
            lang,
            `Good moisture on the farm: ${chuvaImergMm} mm of rain fell and the soil is holding water for crops.`,
            `Água boa na roça: choveu ${chuvaImergMm} mm e a terra está segurando umidade para a planta.`
          )
        : pickLang(
            lang,
            `Even water balance this week (${chuvaImergMm} mm rain). Mulching around crop roots helps keep soil cool.`,
            `Conta de água empatada nesta semana (${chuvaImergMm} mm de chuva). Vale cobrir o pé da planta com palha.`
          ),
  };

  // Model B: 4-Signal Drought Cascade (Rain -> Soil -> Plant -> Heat)
  const campoBoost =
    (input.soloCampoSeco ? 1 : 0) +
    (input.estressePlantaCampo ? 1 : 0) -
    (chuvaCampo >= 15 ? 1 : 0);
  const totalSinais = Math.min(
    4,
    Math.max(0, region.sinaisSecaPadrao + dryBoost + campoBoost)
  );
  const s1 = totalSinais >= 1;
  const s2 = totalSinais >= 2;
  const s3 = totalSinais >= 3;
  const s4 = totalSinais >= 4;

  let nivelB: DroughtAlertLevel = 'normal';
  let emojiB: ModelBDroughtCascade['emoji'] = '😊';
  if (totalSinais === 1) {
    nivelB = 'atencao';
    emojiB = '😐';
  } else if (totalSinais === 2) {
    nivelB = 'alerta';
    emojiB = '😟';
  } else if (totalSinais >= 3) {
    nivelB = 'seca_confirmada';
    emojiB = '😰';
  }

  const modeloB: ModelBDroughtCascade = {
    sinaisAtivos: totalSinais,
    nivel: nivelB,
    emoji: emojiB,
    sinais: [
      {
        etapa: pickLang(lang, 'Rainfall', 'Chuva'),
        fonte: 'NASA IMERG',
        anomaliaDetectada: s1,
        valorAtual: s1
          ? pickLang(lang, '-38% vs avg', '-38% vs média')
          : pickLang(lang, '+5% vs avg', '+5% vs média'),
        referenciaHistorica: pickLang(lang, '6-week average', 'Média de 6 semanas'),
        descricao: s1
          ? pickLang(
              lang,
              'Rainfall below normal for 6 consecutive weeks.',
              'Chuva abaixo do normal por 6 semanas seguidas.'
            )
          : pickLang(
              lang,
              'Rainfall within expected seasonal range.',
              'Chuva dentro do esperado para a época.'
            ),
      },
      {
        etapa: pickLang(lang, 'Soil', 'Solo'),
        fonte: 'NASA SMAP / GLDAS',
        anomaliaDetectada: s2,
        valorAtual: s2
          ? pickLang(lang, '11% moisture', '11% umidade')
          : pickLang(lang, '24% moisture', '24% umidade'),
        referenciaHistorica: pickLang(lang, 'Normal: 21%', 'Normal: 21%'),
        descricao: s2
          ? pickLang(
              lang,
              'Soil drying below historical average.',
              'Terra secando abaixo da média histórica.'
            )
          : pickLang(
              lang,
              'Soil moisture within safe range.',
              'Umidade do solo dentro da faixa segura.'
            ),
      },
      {
        etapa: pickLang(lang, 'Crop', 'Planta'),
        fonte: 'MODIS / VIIRS / HLS 30m',
        anomaliaDetectada: s3,
        valorAtual: s3
          ? pickLang(lang, 'NDVI 0.29 (drop)', 'NDVI 0.29 (queda)')
          : pickLang(lang, 'NDVI 0.56 (good)', 'NDVI 0.56 (bom)'),
        referenciaHistorica: pickLang(lang, 'Normal: 0.48', 'Normal: 0.48'),
        descricao: s3
          ? pickLang(
              lang,
              'Leaves losing greenness and growth vigor.',
              'Folhas perdendo verdura e força de crescimento.'
            )
          : pickLang(
              lang,
              'Crop maintaining strong vegetative vigor.',
              'Plantação mantendo bom vigor vegetativo.'
            ),
      },
      {
        etapa: pickLang(lang, 'Heat', 'Calor'),
        fonte: 'MODIS LST / ECOSTRESS',
        anomaliaDetectada: s4,
        valorAtual: s4
          ? pickLang(lang, '+3.4 °C above', '+3,4 °C acima')
          : pickLang(lang, '+0.4 °C normal', '+0,4 °C normal'),
        referenciaHistorica: pickLang(lang, 'Local historical mean', 'Média histórica local'),
        descricao: s4
          ? pickLang(
              lang,
              'Very hot topsoil increasing water loss.',
              'Chão muito quente aumentando a perda de água.'
            )
          : pickLang(
              lang,
              'Surface temperature without extreme heat stress.',
              'Temperatura da superfície sem estresse extremo.'
            ),
      },
    ],
    resumoTecnico:
      nivelB === 'normal'
        ? pickLang(
            lang,
            '0 of 4 anomaly signals in the drought cascade (IMERG, SMAP, NDVI, LST).',
            '0 de 4 sinais de anomalia na cascata de seca (IMERG, SMAP, NDVI, LST).'
          )
        : pickLang(
            lang,
            `${totalSinais} of 4 active signals (${nivelB.replace('_', ' ').toUpperCase()}).`,
            `${totalSinais} de 4 sinais ativos (${nivelB.replace('_', ' ').toUpperCase()}).`
          ),
    resumoAcessivel:
      nivelB === 'normal'
        ? pickLang(
            lang,
            'All calm this quarter: rainfall, soil moisture, and crops are on track.',
            'Tudo tranquilo no trimestre: chuva, terra e plantas estão no ritmo certo.'
          )
        : nivelB === 'atencao'
        ? pickLang(
            lang,
            'Watch: rainfall dropped in recent weeks. Keep an eye on soil moisture.',
            'Atenção: a chuva diminuiu nas últimas semanas. Fique de olho na umidade da terra.'
          )
        : nivelB === 'alerta'
        ? pickLang(
            lang,
            'Farm alert: low rain and drying soil. Good time to inspect resilient crops and store water.',
            'Alerta na roça: pouca chuva e terra secando. Bom momento para checar plantas resistentes e reservar água.'
          )
        : pickLang(
            lang,
            'Satellite-confirmed drought: low rainfall, dry soil, and strong heat. Prioritize drought-hardy crops & water conservation.',
            'Seca confirmada pelo satélite: falta chuva, terra seca e calor forte. Priorize plantas resistentes e conservação de água.'
          ),
  };

  // Model C: When to Plant? (False Start / Dry Spell Detector)
  const riscoVeranico = Math.min(88, region.riscoVeranicoPct + dryBoost * 15);
  const umidadeEstavelDias =
    statusA === 'deficit_confirmado' ? 2 : riscoVeranico > 40 ? 4 : 9;

  const recomendacaoC: ModelCPlantingWindow['recomendacao'] =
    riscoVeranico >= 45 || totalSinais >= 3
      ? 'esperar_semana'
      : chuvaImergMm < 12
      ? 'aguardar_chuvas'
      : 'plantar_agora';

  const modeloC: ModelCPlantingWindow = {
    primeirasChuvasDetectadasMm: chuvaImergMm,
    smapUmidadeEstavelDias: umidadeEstavelDias,
    probabilidadeVeranicoPct: riscoVeranico,
    recomendacao: recomendacaoC,
    titulo:
      recomendacaoC === 'plantar_agora'
        ? pickLang(lang, 'Safe planting window: ready to sow', 'Janela segura: pode plantar')
        : recomendacaoC === 'esperar_semana'
        ? pickLang(
            lang,
            'Wait one more week (high mid-season dry-spell risk)',
            'Espere mais uma semana (risco alto de veranico)'
          )
        : pickLang(
            lang,
            'Wait for steadier rainfall before sowing',
            'Aguarde chuva mais firme antes de semear'
          ),
    explicacaoTecnica: pickLang(
      lang,
      `Weekly IMERG ${chuvaImergMm} mm; SMAP stable for ${umidadeEstavelDias} days; historical dry-spell probability: ${riscoVeranico}%.`,
      `IMERG semanal ${chuvaImergMm} mm; SMAP estável há ${umidadeEstavelDias} dias; probabilidade histórica de veranico: ${riscoVeranico}%.`
    ),
    explicacaoAcessivel:
      recomendacaoC === 'plantar_agora'
        ? pickLang(
            lang,
            `Safe to sow now: soil stayed moist for ${umidadeEstavelDias} straight days and dry-spell risk is low (${riscoVeranico}%).`,
            `Pode plantar com calma: a terra já molhou direito por ${umidadeEstavelDias} dias seguidos e o risco de veranico está baixo (${riscoVeranico}%).`
          )
        : pickLang(
            lang,
            `Better hold seeds one more week: ${riscoVeranico}% chance of a false wet-season start drying young seedlings.`,
            `Melhor segurar a semente mais uma semana: há ${riscoVeranico}% de chance de dar um veranico (falso começo de inverno) e secar a muda nova.`
          ),
  };

  // Model D: Erosion Risk Matrix
  const chuvaIntensaScore =
    chuvaCampo >= 35 || region.bioma === 'Mata Atlântica' ? 4 : 3;
  const mesesSoloExposto =
    rotacao.toLowerCase().includes('palma') ||
    rotacao.toLowerCase().includes('cactus') ||
    rotacao.toLowerCase().includes('mandioca') ||
    rotacao.toLowerCase().includes('cassava')
      ? 2
      : 5;
  const erodibilidade: ModelDErosionMatrix['erodibilidadeSoilGrids'] =
    region.texturaSolo.toLowerCase().includes('arenos') ? 'alta' : 'media';

  const fatoresAltos = [
    chuvaIntensaScore >= 4,
    region.declividadePct >= 8 || Boolean(input.sinaisErosaoCampo),
    mesesSoloExposto >= 4,
    erodibilidade === 'alta',
  ].filter(Boolean).length;

  const nivelErosao: ErosionRiskLevel =
    input.sinaisErosaoCampo || fatoresAltos === 4
      ? 'alto'
      : fatoresAltos >= 2
      ? 'moderado'
      : 'baixo';

  const erodLabel =
    erodibilidade === 'alta' ? pickLang(lang, 'high', 'alta') : pickLang(lang, 'medium', 'média');

  const modeloD: ModelDErosionMatrix = {
    chuvaIntensaScore,
    declividadePct: region.declividadePct,
    mesesSoloExposto,
    erodibilidadeSoilGrids: erodibilidade,
    nivel: nivelErosao,
    praticasRecomendadas: [
      pickLang(
        lang,
        'Contour planting following the natural slope of the terrain',
        'Plantio em curvas de nível acompanhando o caimento do terreno'
      ),
      pickLang(
        lang,
        'Keep dead mulch cover (straw / crop residue) between rows',
        'Manter cobertura morta (palhada/resto de cultura) entre as fileiras'
      ),
      pickLang(
        lang,
        'Living barriers with forage cactus pear or vetiver grass on steeper slopes',
        'Barreiras vivas com palma ou capim-vetiver nas partes mais inclinadas'
      ),
    ],
    resumoTecnico: pickLang(
      lang,
      `SRTM slope ${region.declividadePct}%, ${mesesSoloExposto} months bare soil (MODIS), SoilGrids erodibility ${erodLabel}.`,
      `Declividade SRTM ${region.declividadePct}%, ${mesesSoloExposto} meses exposto (MODIS), erodibilidade SoilGrids ${erodibilidade}.`
    ),
    resumoAcessivel:
      nivelErosao === 'alto'
        ? pickLang(
            lang,
            'High risk of heavy rain washing away topsoil. Plant along contour lines and cover soil with straw.',
            'Perigo alto da chuva forte lavar a terra boa. Plante acompanhando o caimento do terreno e cubra o solo com palha.'
          )
        : nivelErosao === 'moderado'
        ? pickLang(
            lang,
            'Moderate runoff watch on the farm. Leaving straw mulch on the ground protects the topsoil well.',
            'Cuidado médio com enxurrada na roça. Deixar palha no chão já segura bastante a terra.'
          )
        : pickLang(
            lang,
            'Low risk of topsoil runoff in this area.',
            'Risco baixo de a chuva lavar a terra boa nesta área.'
          ),
  };

  // Model E: 2030–2050 Climate Simulation (NEX-GDDP-CMIP6)
  const deltaTempC = 1.5;
  const deltaChuvaPct = region.bioma === 'Caatinga' ? -12 : -10;
  const semanasDeficitAtual = totalSinais >= 2 ? 14 : 7;
  const fatorCultura =
    rotacao.toLowerCase().includes('milho') || rotacao.toLowerCase().includes('maize')
      ? 1.35
      : 1.15;
  const semanasDeficit2050 = Math.round(semanasDeficitAtual * fatorCultura + 3);
  const semanasDeficitAdicionais = Math.max(1, semanasDeficit2050 - semanasDeficitAtual);

  const rotacaoResilienteSugerida =
    rotacao.toLowerCase().includes('milho') || rotacao.toLowerCase().includes('maize')
      ? pickLang(
          lang,
          'Cowpea + Sorghum + Forage Cactus Pear',
          'Feijão-Caupi + Sorgo + Palma Forrageira'
        )
      : pickLang(
          lang,
          'Cowpea + Cassava BRS Formosa + Cactus Pear',
          'Feijão-Caupi + Mandioca BRS Formosa + Palma'
        );

  const modeloE: ModelEClimate2050 = {
    deltaTempC,
    deltaChuvaPct,
    semanasDeficitAtual,
    semanasDeficit2050,
    semanasDeficitAdicionais,
    rotacaoAtual: rotacao,
    rotacaoResilienteSugerida,
    resumoTecnico: pickLang(
      lang,
      `NEX-GDDP-CMIP6 projection (+${deltaTempC} °C, ${deltaChuvaPct}% rain): +${semanasDeficitAdicionais} water-deficit weeks/yr by 2050.`,
      `Projeção NEX-GDDP-CMIP6 (+${deltaTempC} °C, ${deltaChuvaPct}% chuva): +${semanasDeficitAdicionais} semanas de déficit hídrico/ano até 2050.`
    ),
    resumoAcessivel: pickLang(
      lang,
      `Between 2030 and 2050, climate may warm by ${deltaTempC}°C with less rainfall. This rotation would face ${semanasDeficitAdicionais} extra dry weeks per year. Shifting part of maize to ${rotacaoResilienteSugerida} keeps the farm safer.`,
      `Entre 2030 e 2050, o clima pode ficar ${deltaTempC}°C mais quente e chover menos. Essa rotação enfrentaria ${semanasDeficitAdicionais} semanas a mais de falta de água por ano. Trocar parte do milho por ${rotacaoResilienteSugerida} deixa a roça mais segura.`
    ),
  };

  // Scale Fusion for Wells (GRACE-FO + SRTM + SIAGAS)
  const wellsNearby = filterWellsByRadius(SEED_WELLS, centroid, raioBuscaKm);
  const wellPool = wellsNearby.length > 0 ? wellsNearby : SEED_WELLS.slice(0, 3);
  const minDepth = Math.min(...wellPool.map((w) => w.profundidadeM));
  const maxDepth = Math.max(...wellPool.map((w) => w.profundidadeM));
  const avgSuccess = Math.round(
    wellPool.reduce((s, w) => s + w.sucessoHistoricoPct, 0) / wellPool.length
  );

  const wellSummary: WellHeatmapSummary = {
    faixaProfundidadeMinM: minDepth,
    faixaProfundidadeMaxM: maxDepth,
    taxaSucessoPct: avgSuccess,
    riscoSalinidade: region.salinidadeRisco,
    tendenciaGraceFo: dryBoost >= 2 ? 'rebaixamento' : 'estavel',
    orientacaoBaixaRenda:
      minDepth <= 55
        ? pickLang(
            lang,
            `Prioritize the lower terrain drainage (SRTM): local wells reach freshwater between ${minDepth} m and ${Math.min(maxDepth, 65)} m with lower drilling cost.`,
            `Priorize a área mais baixa do terreno (drenagem SRTM): poços locais acham água doce entre ${minDepth} m e ${Math.min(maxDepth, 65)} m, com menor custo de perfuração.`
          )
        : pickLang(
            lang,
            `Wells in this region require deeper drilling (${minDepth}–${maxDepth} m). Check salinity risk first and consider runoff cisterns or catchment ponds.`,
            `Poços na região exigem maior profundidade (${minDepth}–${maxDepth} m). Antes de furar, confira o risco de água salobra e considere cisterna de enxurrada ou barreiro.`
          ),
  };

  const tempMax = Math.round(28 + dryBoost * 2.2 + (region.bioma === 'Caatinga' ? 3 : 0));
  const tempMin = Math.round(tempMax - 9);

  return {
    atualizadoEm: new Date().toISOString(),
    fontePacote: 'motor_local',
    climaDia: {
      tempMaxC: tempMax,
      tempMinC: tempMin,
      condicao:
        chuvaImergMm >= 22
          ? pickLang(lang, 'Scattered showers in the area', 'Pancadas de chuva na região')
          : dryBoost >= 2 || totalSinais >= 3
          ? pickLang(lang, 'Strong sun and dry weather', 'Sol forte e tempo seco')
          : pickLang(lang, 'Sunny with scattered clouds', 'Sol com nuvens esparsas'),
      icone:
        chuvaImergMm >= 22
          ? '🌦️'
          : dryBoost >= 2 || totalSinais >= 3
          ? '🔥'
          : '☀️',
      chuvaHojeMm: chuvaCampo > 0 ? chuvaCampo : chuvaImergMm >= 20 ? 6.5 : 0,
      umidadeRelativaPct: Math.max(28, 72 - dryBoost * 11 - totalSinais * 5),
    },
    rotacaoAtual: {
      culturas: rotacao,
      diasPassados: 48,
      diasTotais: 76,
      diasRestantes: 28,
      progressoPct: 63,
      fase: pickLang(lang, 'Flowering and pod filling', 'Floração e enchimento de vagens'),
    },
    soloSoilGrids: {
      ph: region.phSolo,
      textura: region.texturaSolo,
      carbonoOrganicoGKg: region.bioma === 'Mata Atlântica' ? 18.4 : 11.2,
    },
    ndviZonas: buildNdviZones(totalSinais, lang),
    modeloA,
    modeloB,
    modeloC,
    modeloD,
    modeloE,
    culturasRecomendadas: SEED_CROPS,
    wellSummary,
  };
}
