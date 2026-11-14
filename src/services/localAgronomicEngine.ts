import {
  BahiaRegionPreset,
  NORDESTE_REGIONS,
  SEED_CROPS,
  SEED_WELLS,
} from '../data/seedData';
import {
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
import { distanceKm, filterWellsByRadius } from '../utils/geoprocessing';

export interface AgronomicSimulationInput {
  dryStressBoost?: number;
  rotacaoSelecionada?: string;
  chuvaCampoMm?: number;
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
  if (lower.includes('palma')) return 0.45;
  if (lower.includes('mandioca') || lower.includes('aipim')) return 0.72;
  if (lower.includes('sorgo')) return 0.82;
  if (lower.includes('feijão') || lower.includes('feijao') || lower.includes('caupi')) {
    return 0.85;
  }
  if (lower.includes('milho')) return 1.05;
  return 0.85;
}

function buildNdviZones(sinaisSeca: number): NdviZonePatch[] {
  const highStress = sinaisSeca >= 2;
  return [
    {
      id: 'ndvi-norte',
      setor: 'Baixada / Fundo da roça',
      vigor: 'verde',
      ndviValor: highStress ? 0.48 : 0.68,
      descricao: 'Folhas bem verdes, segurando melhor a umidade.',
      relativeBox: { xPct: 14, yPct: 16, wPct: 44, hPct: 42 },
    },
    {
      id: 'ndvi-meio',
      setor: 'Meio da lavoura',
      vigor: highStress ? 'amarelo' : 'verde',
      ndviValor: highStress ? 0.34 : 0.54,
      descricao: highStress
        ? 'Início de amarelamento nas pontas; vale cobrir com palha.'
        : 'Crescimento firme e uniforme.',
      relativeBox: { xPct: 50, yPct: 24, wPct: 36, hPct: 40 },
    },
    {
      id: 'ndvi-topo',
      setor: 'Parte alta / Borda exposta',
      vigor: sinaisSeca >= 3 ? 'vermelho' : 'amarelo',
      ndviValor: sinaisSeca >= 3 ? 0.22 : 0.38,
      descricao:
        sinaisSeca >= 3
          ? 'Estresse forte de calor e pouca água; examine a folha com a câmera.'
          : 'Solo mais seco no alto; atenção redobrada.',
      relativeBox: { xPct: 22, yPct: 56, wPct: 58, hPct: 28 },
    },
  ];
}

/**
 * Motor Agronômico 100% Local (Front-end Offline-First):
 * Executa os 5 modelos da NASA (Balanço Hídrico, Cascata de Seca em 4 Sinais,
 * Detector de Veranico, Matriz de Erosão e Projeção Climática 2030–2050)
 * + Zonas NDVI e Fusão de Poços (GRACE-FO + SRTM + SIAGAS).
 */
export function runLocalAgronomicEngine(
  centroid: GeoPoint,
  culturaPrincipal: string,
  raioBuscaKm: number,
  input: AgronomicSimulationInput = {}
): NasaDiagnosticsPackage {
  const region = findNearestRegion(centroid);
  const dryBoost = input.dryStressBoost ?? 0;
  const chuvaCampo = input.chuvaCampoMm ?? 0;
  const rotacao = input.rotacaoSelecionada ?? culturaPrincipal;

  // Modelo A: Balanço Hídrico Semanal + Confirmação SMAP
  const chuvaImergMm = Math.max(
    0,
    Number((region.chuvaSemanalBaseMm - dryBoost * 6 + chuvaCampo).toFixed(1))
  );
  const et0PowerMm = Number((region.et0SemanalMm + dryBoost * 3.5).toFixed(1));
  const kcAplicado = resolveKcForCrop(rotacao);
  const demandaCulturaMm = Number((et0PowerMm * kcAplicado).toFixed(1));
  const saldoHidricoMm = Number((chuvaImergMm - demandaCulturaMm).toFixed(1));

  const smapTendencia: ModelAWaterBalance['smapTendencia'] =
    saldoHidricoMm < -10 ? 'caindo' : saldoHidricoMm > 4 ? 'subindo' : 'estavel';

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
        ? `Balanço hídrico negativo (${saldoHidricoMm} mm/sem) confirmado por queda de umidade no NASA SMAP.`
        : statusA === 'positivo'
        ? `Balanço hídrico positivo (+${saldoHidricoMm} mm/sem) com umidade do solo favorável.`
        : `Balanço hídrico próximo ao equilíbrio (${saldoHidricoMm} mm/sem).`,
    resumoAcessivel:
      statusA === 'deficit_confirmado'
        ? `Falta água para a roça: entrou ${chuvaImergMm} mm de chuva e o sol puxou ${demandaCulturaMm} mm. O satélite confirmou que a terra está secando.`
        : statusA === 'positivo'
        ? `Água boa na roça: choveu ${chuvaImergMm} mm e a terra está segurando umidade para a planta.`
        : `Conta de água empatada nesta semana (${chuvaImergMm} mm de chuva). Vale cobrir o pé da planta com palha.`,
  };

  // Modelo B: Cascata de Seca em 4 Sinais (Chuva -> Solo -> Planta -> Calor)
  const totalSinais = Math.min(4, Math.max(0, region.sinaisSecaPadrao + dryBoost));
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
        etapa: 'Chuva',
        fonte: 'NASA IMERG',
        anomaliaDetectada: s1,
        valorAtual: s1 ? '-38% vs média' : '+5% vs média',
        referenciaHistorica: 'Média de 6 semanas',
        descricao: s1
          ? 'Chuva abaixo do normal por 6 semanas seguidas.'
          : 'Chuva dentro do esperado para a época.',
      },
      {
        etapa: 'Solo',
        fonte: 'NASA SMAP / GLDAS',
        anomaliaDetectada: s2,
        valorAtual: s2 ? '11% umidade' : '24% umidade',
        referenciaHistorica: 'Normal: 21%',
        descricao: s2
          ? 'Terra secando abaixo da média histórica.'
          : 'Umidade do solo dentro da faixa segura.',
      },
      {
        etapa: 'Planta',
        fonte: 'MODIS / VIIRS / HLS 30m',
        anomaliaDetectada: s3,
        valorAtual: s3 ? 'NDVI 0.29 (queda)' : 'NDVI 0.56 (bom)',
        referenciaHistorica: 'Normal: 0.48',
        descricao: s3
          ? 'Folhas perdendo verdura e força de crescimento.'
          : 'Plantação mantendo bom vigor vegetativo.',
      },
      {
        etapa: 'Calor',
        fonte: 'MODIS LST / ECOSTRESS',
        anomaliaDetectada: s4,
        valorAtual: s4 ? '+3,4 °C acima' : '+0,4 °C normal',
        referenciaHistorica: 'Média histórica local',
        descricao: s4
          ? 'Chão muito quente aumentando a perda de água.'
          : 'Temperatura da superfície sem estresse extremo.',
      },
    ],
    resumoTecnico:
      nivelB === 'normal'
        ? '0 de 4 sinais de anomalia na cascata de seca (IMERG, SMAP, NDVI, LST).'
        : `${totalSinais} de 4 sinais ativos (${nivelB.replace('_', ' ').toUpperCase()}).`,
    resumoAcessivel:
      nivelB === 'normal'
        ? 'Tudo tranquilo no trimestre: chuva, terra e plantas estão no ritmo certo.'
        : nivelB === 'atencao'
        ? 'Atenção: a chuva diminuiu nas últimas semanas. Fique de olho na umidade da terra.'
        : nivelB === 'alerta'
        ? 'Alerta na roça: pouca chuva e terra secando. Bom momento para checar plantas resistentes e reservar água.'
        : 'Seca confirmada pelo satélite: falta chuva, terra seca e calor forte. Priorize plantas nativas (PANCs) e proteção da família.',
  };

  // Modelo C: Quando Plantar? (Detector de Falso Início / Veranico)
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
        ? 'Janela segura: pode plantar'
        : recomendacaoC === 'esperar_semana'
        ? 'Espere mais uma semana (risco alto de veranico)'
        : 'Aguarde chuva mais firme antes de semear',
    explicacaoTecnica: `IMERG semanal ${chuvaImergMm} mm; SMAP estável há ${umidadeEstavelDias} dias; probabilidade histórica de veranico: ${riscoVeranico}%.`,
    explicacaoAcessivel:
      recomendacaoC === 'plantar_agora'
        ? `Pode plantar com calma: a terra já molhou direito por ${umidadeEstavelDias} dias seguidos e o risco de veranico está baixo (${riscoVeranico}%).`
        : `Melhor segurar a semente mais uma semana: há ${riscoVeranico}% de chance de dar um veranico (falso começo de inverno) e secar a muda nova.`,
  };

  // Modelo D: Matriz de Risco de Erosão
  const chuvaIntensaScore = region.bioma === 'Mata Atlântica' ? 4 : 3;
  const mesesSoloExposto =
    rotacao.toLowerCase().includes('palma') || rotacao.toLowerCase().includes('mandioca')
      ? 2
      : 5;
  const erodibilidade: ModelDErosionMatrix['erodibilidadeSoilGrids'] =
    region.texturaSolo.toLowerCase().includes('arenos') ? 'alta' : 'media';

  const fatoresAltos = [
    chuvaIntensaScore >= 4,
    region.declividadePct >= 8,
    mesesSoloExposto >= 4,
    erodibilidade === 'alta',
  ].filter(Boolean).length;

  const nivelErosao: ErosionRiskLevel =
    fatoresAltos === 4 ? 'alto' : fatoresAltos >= 2 ? 'moderado' : 'baixo';

  const modeloD: ModelDErosionMatrix = {
    chuvaIntensaScore,
    declividadePct: region.declividadePct,
    mesesSoloExposto,
    erodibilidadeSoilGrids: erodibilidade,
    nivel: nivelErosao,
    praticasRecomendadas: [
      'Plantio em curvas de nível acompanhando o caimento do terreno',
      'Manter cobertura morta (palhada/resto de cultura) entre as fileiras',
      'Barreiras vivas com palma ou capim-vetiver nas partes mais inclinadas',
    ],
    resumoTecnico: `Declividade SRTM ${region.declividadePct}%, ${mesesSoloExposto} meses exposto (MODIS), erodibilidade SoilGrids ${erodibilidade}.`,
    resumoAcessivel:
      nivelErosao === 'alto'
        ? 'Perigo alto da chuva forte lavar a terra boa. Plante acompanhando o caimento do terreno e cubra o solo com palha.'
        : nivelErosao === 'moderado'
        ? 'Cuidado médio com enxurrada na roça. Deixar palha no chão já segura bastante a terra.'
        : 'Risco baixo de a chuva lavar a terra boa nesta área.',
  };

  // Modelo E: Simulação Climática 2030–2050 (NEX-GDDP-CMIP6)
  const deltaTempC = 1.5;
  const deltaChuvaPct = region.bioma === 'Caatinga' ? -12 : -10;
  const semanasDeficitAtual = totalSinais >= 2 ? 14 : 7;
  const fatorCultura = rotacao.toLowerCase().includes('milho') ? 1.35 : 1.15;
  const semanasDeficit2050 = Math.round(semanasDeficitAtual * fatorCultura + 3);
  const semanasDeficitAdicionais = Math.max(1, semanasDeficit2050 - semanasDeficitAtual);

  const rotacaoResilienteSugerida = rotacao.toLowerCase().includes('milho')
    ? 'Feijão-Caupi + Sorgo + Palma Forrageira'
    : 'Feijão-Caupi + Mandioca BRS Formosa + Palma';

  const modeloE: ModelEClimate2050 = {
    deltaTempC,
    deltaChuvaPct,
    semanasDeficitAtual,
    semanasDeficit2050,
    semanasDeficitAdicionais,
    rotacaoAtual: rotacao,
    rotacaoResilienteSugerida,
    resumoTecnico: `Projeção NEX-GDDP-CMIP6 (+${deltaTempC} °C, ${deltaChuvaPct}% chuva): +${semanasDeficitAdicionais} semanas de déficit hídrico/ano até 2050.`,
    resumoAcessivel: `Entre 2030 e 2050, o clima pode ficar ${deltaTempC}°C mais quente e chover menos. Essa rotação enfrentaria ${semanasDeficitAdicionais} semanas a mais de falta de água por ano. Trocar parte do milho por ${rotacaoResilienteSugerida} deixa a roça mais segura.`,
  };

  // Fusão de Escalas para Poços (GRACE-FO + SRTM + SIAGAS)
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
        ? `Priorize a área mais baixa do terreno (drenagem SRTM): poços locais acham água doce entre ${minDepth} m e ${Math.min(maxDepth, 65)} m, com menor custo de perfuração.`
        : `Poços na região exigem maior profundidade (${minDepth}–${maxDepth} m). Antes de furar, confira o risco de água salobra e considere cisterna de enxurrada ou barreiro.`,
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
          ? 'Pancadas de chuva na região'
          : dryBoost >= 2 || totalSinais >= 3
          ? 'Sol forte e tempo seco'
          : 'Sol com nuvens esparsas',
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
      fase: 'Floração e enchimento de vagens',
    },
    soloSoilGrids: {
      ph: region.phSolo,
      textura: region.texturaSolo,
      carbonoOrganicoGKg: region.bioma === 'Mata Atlântica' ? 18.4 : 11.2,
    },
    ndviZonas: buildNdviZones(totalSinais),
    modeloA,
    modeloB,
    modeloC,
    modeloD,
    modeloE,
    culturasRecomendadas: SEED_CROPS,
    wellSummary,
  };
}
