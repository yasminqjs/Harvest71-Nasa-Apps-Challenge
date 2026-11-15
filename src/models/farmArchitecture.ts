import {
  CommunityPost,
  FarmArchitectureModel,
  FarmProperty,
  FarmerProfile,
  FeatureArchitectureDescriptor,
  FeatureColorCode,
  PlantationArchitectureModel,
  PlantingLot,
} from '../types/domain';

export const FEATURE_COLOR_STYLES: Record<
  FeatureColorCode,
  {
    codeLabel: string;
    bg: string;
    border: string;
    text: string;
  }
> = {
  verde: {
    codeLabel: 'VERDE • Pegador de informações da fazenda',
    bg: '#DCFCE7',
    border: '#16A34A',
    text: '#14532D',
  },
  azul: {
    codeLabel: 'AZUL • Pegador de feedback de acontecimentos do usuário',
    bg: '#DBEAFE',
    border: '#2563EB',
    text: '#1E3A8A',
  },
  salmao: {
    codeLabel: 'SALMÃO • Notificador de acontecimentos locais',
    bg: '#FEE2E2',
    border: '#F87171',
    text: '#7F1D1D',
  },
  cinza: {
    codeLabel: 'CINZA [PLACEHOLDER] • Previsão / Comparador / Otimizador DSSAT',
    bg: '#F3F4F6',
    border: '#9CA3AF',
    text: '#374151',
  },
  roxo: {
    codeLabel: 'ROXO [PLACEHOLDER] • Visualizador de qualidade da plantação atual',
    bg: '#F3E8FF',
    border: '#9333EA',
    text: '#581C87',
  },
  amarelo: {
    codeLabel: 'AMARELO • Visualizador de informações locais',
    bg: '#FEF9C3',
    border: '#CA8A04',
    text: '#713F12',
  },
};

export const FEATURE_COLOR_ARCHITECTURE: FeatureArchitectureDescriptor[] = [
  {
    id: 'feat-verde-onboarding',
    color: 'verde',
    featureName: 'Pegador de informações da fazenda',
    tab: 'onboarding',
    userActionLabel: 'Onboarding (região, terreno, lotes e perfil)',
    status: 'implementado',
    targetFile: 'src/screens/NordesteOnboardingScreen.tsx',
  },
  {
    id: 'feat-verde-plantacao',
    color: 'verde',
    featureName: 'Pegador de informações da fazenda',
    tab: 'plantacao',
    userActionLabel: 'Atualizar dados da plantação e da fazenda',
    status: 'implementado',
    targetFile: 'src/screens/DecisionScreen.tsx',
  },
  {
    id: 'feat-amarelo-resumo',
    color: 'amarelo',
    featureName: 'Visualizador de informações locais (temperatura, etc)',
    tab: 'resumo',
    userActionLabel: 'Ver informações básicas',
    status: 'implementado',
    targetFile: 'src/screens/HomeScreen.tsx',
  },
  {
    id: 'feat-cinza-comparador',
    color: 'cinza',
    featureName: 'Previsão / Comparador / Otimizador DSSAT',
    tab: 'plantacao',
    userActionLabel: 'Comparar rotação atual com outras rotações',
    status: 'placeholder',
    targetFile: 'src/components/placeholders/DssatComparatorPlaceholder.tsx',
    placeholderComponent: 'DssatComparatorPlaceholder',
  },
  {
    id: 'feat-cinza-otimizador',
    color: 'cinza',
    featureName: 'Previsão / Comparador / Otimizador DSSAT',
    tab: 'plantacao',
    userActionLabel: 'Encontrar rotação otimizada',
    status: 'placeholder',
    targetFile: 'src/components/placeholders/DssatOptimizerPlaceholder.tsx',
    placeholderComponent: 'DssatOptimizerPlaceholder',
  },
  {
    id: 'feat-roxo-qualidade',
    color: 'roxo',
    featureName: 'Visualizador de qualidade da plantação atual',
    tab: 'plantacao',
    userActionLabel: 'Ver qualidade da plantação atual',
    status: 'placeholder',
    targetFile: 'src/components/placeholders/PlantationQualityPlaceholder.tsx',
    placeholderComponent: 'PlantationQualityPlaceholder',
  },
  {
    id: 'feat-salmao-relatos',
    color: 'salmao',
    featureName: 'Notificador de acontecimentos locais',
    tab: 'comunidade',
    userActionLabel: 'Receber relatos de outros usuários + Ver usuários próximos',
    status: 'implementado',
    targetFile: 'src/screens/CommunityScreen.tsx',
  },
  {
    id: 'feat-azul-relatar',
    color: 'azul',
    featureName: 'Pegador de feedback de acontecimentos do usuário',
    tab: 'comunidade',
    userActionLabel: 'Relatar acontecimentos (pragas, mudanças de preço, desastres naturais)',
    status: 'implementado',
    targetFile: 'src/screens/CommunityScreen.tsx',
  },
];

function buildPlantationNode(
  lot: PlantingLot,
  farm: FarmProperty
): PlantationArchitectureModel {
  const d = farm.diagnostico;
  const cropToken = lot.culturaAtual.split('+')[0]?.trim().toLowerCase() ?? '';
  const ecoCropMatch =
    d.culturasRecomendadas.find((c) => c.nome.toLowerCase().includes(cropToken)) ??
    d.culturasRecomendadas[0];

  return {
    id: lot.id,
    nome: lot.nome,
    corHex: lot.corHex,
    areaHectares: lot.areaHectares,
    areaTarefasBa: lot.areaTarefasBa,
    polygon: lot.polygon,
    historicoDaTerra: {
      variaveisClimaticas: {
        fonte: 'NASA POWER',
        tempMaxC: d.climaDia.tempMaxC,
        tempMinC: d.climaDia.tempMinC,
        chuvaHojeMm: d.climaDia.chuvaHojeMm,
        umidadeRelativaPct: d.climaDia.umidadeRelativaPct,
        et0PowerMm: d.modeloA.et0PowerMm,
        chuvaImergMm: d.modeloA.chuvaImergMm,
        saldoHidricoMm: d.modeloA.saldoHidricoMm,
      },
      variaveisDoSolo: {
        fonte: 'SRTM + Landsat Collection 2 Level-2 TIRS (NASA / USGS — 30 m)',
        declividadePct: d.modeloD.declividadePct,
        erodibilidade: d.modeloD.nivel,
        resolucaoEspacialM: 30,
        phSolo: d.soloSoilGrids.ph,
        texturaSolo: d.soloSoilGrids.textura,
        carbonoOrganicoGKg: d.soloSoilGrids.carbonoOrganicoGKg,
        registrosHistoricos: lot.historicoTerra ?? [],
      },
    },
    culturaAtual: {
      fonteSelecao: 'usuario',
      culturaNome: lot.culturaAtual,
      sistema: lot.sistema,
      plantas: lot.plantasRotacao,
      tempoPlantadaDias: lot.tempoPlantadaDias,
      dataColheitaPrevista: lot.dataColheitaPrevista,
      cronogramaPlantacao: lot.cronogramaPlantacao,
      especificacoesCultura: {
        fonte: 'NASA / FAO GAEZ EcoCrop',
        variedadeRegional: ecoCropMatch.variedadeRegional,
        kcMedio: ecoCropMatch.kcMedio,
        diasColheitaTipico: ecoCropMatch.diasColheita,
        resilienciaSeca: ecoCropMatch.resilienciaSeca,
        observacaoEcoCrop: ecoCropMatch.observacao,
      },
    },
    culturasFuturas: {
      fonteSelecao: 'usuario_ou_algoritmo_otimizacao',
      rotacaoPlanejada: lot.culturasFuturas ?? [],
      previsaoResultado: {
        fonte: 'Software DSSAT',
        status: 'placeholder',
        mensagemPlaceholder:
          'Simulação DSSAT aguardando merge futuro (src/components/placeholders/DssatComparatorPlaceholder.tsx e DssatOptimizerPlaceholder.tsx).',
      },
    },
  };
}

/**
 * Constrói o grafo completo de dados da propriedade conforme o diagrama "Modelagem da fazenda".
 */
export function buildFarmArchitectureModel(
  farm: FarmProperty,
  farmer: FarmerProfile,
  communityPosts: CommunityPost[]
): FarmArchitectureModel {
  const lots = farm.lotes ?? [];
  const plantacoes: PlantationArchitectureModel[] = lots.map((lot) =>
    buildPlantationNode(lot, farm)
  );

  return {
    fazendaId: farm.id,
    nomeFazenda: farm.nome,
    acontecimentosDaRegiao: {
      fonte: 'feedback_da_comunidade',
      eventos: communityPosts.map((p) => ({
        id: p.id,
        categoria: p.topico,
        autor: p.autor,
        regiaoNome: p.regiaoNome,
        municipio: p.municipio,
        estado: p.estado,
        titulo: p.titulo,
        descricao: p.mensagem,
        haQuantoTempo: p.haQuantoTempo,
        fonte: 'feedback_da_comunidade',
      })),
    },
    variaveisDaFazenda: {
      fonte: 'usuario',
      regiaoNome: farm.regiaoNome,
      municipio: farm.municipio,
      estado: farm.estado,
      bioma: farm.bioma,
      centroid: farm.centroid,
      polygon: farm.polygon,
      areaHectares: farm.areaHectares,
      areaTarefasBa: farm.areaTarefasBa,
      waterAccess: farmer.waterAccess,
      armazenamentoAgua: farmer.armazenamentoAgua,
      laborType: farmer.laborType,
      financialTier: farmer.financialTier,
      objective: farmer.objective,
    },
    plantacoes,
  };
}
