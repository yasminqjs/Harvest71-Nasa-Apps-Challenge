import {
  AppLanguage,
  CommunityGraphEdge,
  CommunityGraphNode,
  CommunityPost,
  CommunityTopic,
  FarmProperty,
} from '../types/domain';
import { distanceKm } from '../utils/geoprocessing';
import { formatCommunityTopicLabel, isEn, pickLang } from '../i18n/locale';
import { localizeBiome } from './seedData';

export const TOPIC_META: Record<
  CommunityTopic,
  { label: string; color: string; bg: string }
> = {
  praga: { label: 'Pests', color: '#D97706', bg: '#FEF3C7' },
  mudanca_preco: { label: 'Price Shift', color: '#0D9488', bg: '#CCFBF1' },
  desastre_natural: { label: 'Natural Disaster', color: '#DC2626', bg: '#FEE2E2' },
  seca: { label: 'Drought / Rain', color: '#B45309', bg: '#FFEDD5' },
  rotacao: { label: 'Rotation', color: '#16A34A', bg: '#DCFCE7' },
  solo: { label: 'Soil / Erosion', color: '#7C3AED', bg: '#F3E8FF' },
  duvida: { label: 'General Question', color: '#2563EB', bg: '#DBEAFE' },
};

export function getTopicMeta(
  lang: AppLanguage = 'en'
): Record<CommunityTopic, { label: string; color: string; bg: string }> {
  return {
    praga: {
      label: formatCommunityTopicLabel('praga', lang),
      color: '#D97706',
      bg: '#FEF3C7',
    },
    mudanca_preco: {
      label: formatCommunityTopicLabel('mudanca_preco', lang),
      color: '#0D9488',
      bg: '#CCFBF1',
    },
    desastre_natural: {
      label: formatCommunityTopicLabel('desastre_natural', lang),
      color: '#DC2626',
      bg: '#FEE2E2',
    },
    seca: {
      label: formatCommunityTopicLabel('seca', lang),
      color: '#B45309',
      bg: '#FFEDD5',
    },
    rotacao: {
      label: formatCommunityTopicLabel('rotacao', lang),
      color: '#16A34A',
      bg: '#DCFCE7',
    },
    solo: {
      label: formatCommunityTopicLabel('solo', lang),
      color: '#7C3AED',
      bg: '#F3E8FF',
    },
    duvida: {
      label: formatCommunityTopicLabel('duvida', lang),
      color: '#2563EB',
      bg: '#DBEAFE',
    },
  };
}

export function buildCommunityPosts(lang: AppLanguage = 'en'): CommunityPost[] {
  const en = isEn(lang);
  return [
    {
      id: 'post-1',
      autor: 'Seu Antônio Lima',
      regiaoNome: 'Território do Sisal',
      municipio: 'Serrinha',
      estado: 'BA',
      bioma: 'Caatinga',
      centroid: { latitude: -11.664, longitude: -39.007 },
      topico: 'rotacao',
      tipo: 'relato',
      titulo: en
        ? 'Sorghum + Cowpea held up well during a 12-day dry spell'
        : 'Sorgo + Feijão-Caupi segurou bem um veranico de 12 dias',
      mensagem: en
        ? 'Half of my Plot 1 had only maize and suffered heavily under the sun. In the half where I planted forage sorghum strips with cowpea over dry mulch, the leaves held on until the rain returned.'
        : 'Metade do meu Lote 1 ficou só no milho e sentiu muito o sol. Na metade onde coloquei sorgo forrageiro em faixa com feijão-caupi sobre palha seca, as folhas aguentaram até voltar a chuva.',
      curtidas: 19,
      haQuantoTempo: en ? '3 hours ago' : 'há 3 horas',
      respostas: [
        {
          id: 'rep-1',
          autor: 'Dona Rita Souza',
          regiaoNome: 'Portal do Sertão',
          municipio: 'Feira de Santana',
          texto: en
            ? 'I did the same last year and harvested green beans even with low March rainfall.'
            : 'Fiz igual no ano passado e colhi feijão verde mesmo com pouca chuva em março.',
          criadoEm: en ? '2 hours ago' : 'há 2 horas',
        },
        {
          id: 'rep-2',
          autor: 'Zé Carlos',
          regiaoNome: 'Alto Sertão Sergipano',
          municipio: 'N. Sra. da Glória',
          texto: en
            ? 'Do you plant the sorghum in the same hole or in alternating rows?'
            : 'Vocês plantam o sorgo na mesma cova ou em fileira alternada?',
          criadoEm: en ? '1 hour ago' : 'há 1 hora',
        },
      ],
    },
    {
      id: 'post-2',
      autor: 'Dona Maria das Graças',
      regiaoNome: 'Agreste Alagoano',
      municipio: 'Arapiraca',
      estado: 'AL',
      bioma: 'Caatinga',
      centroid: { latitude: -9.7525, longitude: -36.6611 },
      topico: 'duvida',
      tipo: 'pergunta',
      titulo: en
        ? 'Best timing to plant cassava right after cowpea harvest?'
        : 'Qual melhor época para plantar mandioca após colheita de feijão?',
      mensagem: en
        ? 'I am harvesting cowpea in Plot 1 next week and want to take advantage of still-moist soil. Should I plant stem cuttings right away or lay cover mulch first?'
        : 'Estou colhendo o feijão-caupi do Lote 1 semana que vem e quero aproveitar a terra ainda úmida. Vale plantar maniva logo em seguida ou colocar cobertura antes?',
      curtidas: 14,
      haQuantoTempo: en ? '5 hours ago' : 'há 5 horas',
      respostas: [
        {
          id: 'rep-3',
          autor: 'Compadre Valdir',
          regiaoNome: 'Recôncavo Baiano',
          municipio: 'Cruz das Almas',
          texto: en
            ? 'If you have bean residue, leave it over the soil and stake the cassava cuttings as steady rains begin!'
            : 'Se tiver palhada do feijão, deixe por cima da terra e já finque as manivas no começo das chuvas firmes!',
          criadoEm: en ? '4 hours ago' : 'há 4 horas',
        },
      ],
    },
    {
      id: 'post-3',
      autor: 'Dona Lourdes Ferreira',
      regiaoNome: 'Recôncavo Baiano',
      municipio: 'Cruz das Almas',
      estado: 'BA',
      bioma: 'Mata Atlântica',
      centroid: { latitude: -12.6708, longitude: -39.1019 },
      topico: 'praga',
      tipo: 'relato',
      titulo: en
        ? 'Aphids along cowpea borders after 5 days of intense heat'
        : 'Pulgão nas bordas do feijão após 5 dias de calor forte',
      mensagem: en
        ? 'Dark spots and aphids appeared on the west border. I sprayed diluted neem oil at dusk and planted a sesame border strip to attract ladybugs.'
        : 'Apareceram pontinhos pretos e pulgão na borda oeste. Passei óleo de nim diluído no fim da tarde e plantei faixa de gergelim na beira para atrair joaninha.',
      curtidas: 23,
      haQuantoTempo: en ? 'yesterday' : 'ontem',
      respostas: [
        {
          id: 'rep-4',
          autor: 'Marcos Vinícius',
          regiaoNome: 'Portal do Sertão',
          municipio: 'Feira de Santana',
          texto: en
            ? 'Great tip on border sesame! It cut down leafhopper pressure here too.'
            : 'Ótima dica do gergelim na bordadura! Aqui reduziu bem a cigarrinha.',
          criadoEm: en ? 'yesterday' : 'ontem',
        },
      ],
    },
    {
      id: 'post-4',
      autor: 'Zé Raimundo',
      regiaoNome: 'Chapada / Irecê',
      municipio: 'Irecê',
      estado: 'BA',
      bioma: 'Cerrado',
      centroid: { latitude: -11.304, longitude: -41.855 },
      topico: 'solo',
      tipo: 'relato',
      titulo: en
        ? 'Spineless cactus contour rows stopped runoff on the Plot 2 slope'
        : 'Cordões de palma evitaram enxurrada na ladeira do Lote 2',
      mensagem: en
        ? '42 mm fell in one night and used to wash away every seed. After cutting the slope with cactus rows plus millet stubble, rainwater infiltrated right where it fell.'
        : 'Choveu 42 mm numa noite e antes levava toda a semente embora. Depois que cortamos a descida com fileiras de palma + resteva de milheto, a água infiltrou parada.',
      curtidas: 31,
      haQuantoTempo: en ? '2 days ago' : 'há 2 dias',
      respostas: [],
    },
    {
      id: 'post-5',
      autor: 'Cícera Oliveira',
      regiaoNome: 'Sertão do São Francisco',
      municipio: 'Juazeiro',
      estado: 'BA',
      bioma: 'Caatinga',
      centroid: { latitude: -9.416, longitude: -40.503 },
      topico: 'seca',
      tipo: 'pergunta',
      titulo: en
        ? 'Anyone else seeing deep soil cracks under 1 week without rain?'
        : 'Alguém mais sentindo terra rachando fundo com menos de 1 semana sem chuva?',
      mensagem: en
        ? 'Near Juazeiro heat hit 36°C three days in a row and soil dried out super fast. Are you mulching the plant base with dry grass or manure?'
        : 'Aqui perto de Juazeiro o calor bateu 36°C três dias seguidos e o solo secou muito rápido. Vocês estão cobrindo o pé da planta com capim seco ou esterco?',
      curtidas: 11,
      haQuantoTempo: en ? '2 days ago' : 'há 2 dias',
      respostas: [
        {
          id: 'rep-5',
          autor: 'Seu Antônio Lima',
          regiaoNome: 'Território do Sisal',
          municipio: 'Serrinha',
          texto: en
            ? 'Chopped dry grass helps a ton! It drops soil temperature and holds moisture for several extra days.'
            : 'Capim seco picado ajuda demais! Abaixa o calor da terra e segura umidade por vários dias a mais.',
          criadoEm: en ? '1 day ago' : 'há 1 dia',
        },
      ],
    },
    {
      id: 'post-6',
      autor: 'João Batista',
      regiaoNome: 'Alto Sertão Sergipano',
      municipio: 'N. Sra. da Glória',
      estado: 'SE',
      bioma: 'Caatinga',
      centroid: { latitude: -10.218, longitude: -37.42 },
      topico: 'rotacao',
      tipo: 'pergunta',
      titulo: en
        ? 'Worth mixing jack bean before maize to recover tired soil?'
        : 'Vale misturar feijão-de-porco antes do milho para recuperar terra cansada?',
      mensagem: en
        ? 'My Plot 2 has weak soil after 3 consecutive years of maize monocropping. Anyone who used jack bean or sunn hemp saw a difference next season?'
        : 'Meu lote 2 está com solo fraco depois de 3 anos seguidos plantando só milho. Quem já usou feijão-de-porco ou crotalária sentiu diferença na próxima safra?',
      curtidas: 17,
      haQuantoTempo: en ? '3 days ago' : 'há 3 dias',
      respostas: [
        {
          id: 'rep-6',
          autor: 'Zé Raimundo',
          regiaoNome: 'Chapada / Irecê',
          municipio: 'Irecê',
          texto: en
            ? 'Makes a big difference in leaf greenness and water retention because nitrogen and biomass renew the soil.'
            : 'Dá muita diferença no verde da folha e na retenção de água, porque o nitrogênio e a palha renovam o chão.',
          criadoEm: en ? '2 days ago' : 'há 2 dias',
        },
      ],
    },
    {
      id: 'post-7',
      autor: 'Comadre Socorro',
      regiaoNome: 'Portal do Sertão',
      municipio: 'Feira de Santana',
      estado: 'BA',
      bioma: 'Caatinga',
      centroid: { latitude: -12.266, longitude: -38.966 },
      topico: 'mudanca_preco',
      tipo: 'relato',
      titulo: en
        ? 'Cowpea 60 kg sack rose 18% at the regional market this week'
        : 'Saca de feijão-caupi subiu 18% na feira regional essa semana',
      mensagem: en
        ? 'At the farmers market and coop in Feira, 60 kg sack prices rose due to drought in neighboring districts. Early harvesters are holding part of the lot for better prices.'
        : 'Na feira livre e na cooperativa de Feira, o preço da saca de 60 kg subiu por causa da estiagem em regiões vizinhas. Quem colheu cedo está segurando parte para venda melhor.',
      curtidas: 28,
      haQuantoTempo: en ? '4 hours ago' : 'há 4 horas',
      respostas: [],
    },
    {
      id: 'post-8',
      autor: 'Seu Pedro Rocha',
      regiaoNome: 'Agreste Alagoano',
      municipio: 'Arapiraca',
      estado: 'AL',
      bioma: 'Caatinga',
      centroid: { latitude: -9.7525, longitude: -36.6611 },
      topico: 'desastre_natural',
      tipo: 'relato',
      titulo: en
        ? 'Windstorm with flash runoff knocked down mulch in the lowland'
        : 'Vendaval com enxurrada rápida derrubou cobertura na baixada',
      mensagem: en
        ? 'Last night a heavy squall dropped 55 mm in 40 minutes. Farmers with sloped land need to reinforce contour bunds and drainage before the next peak.'
        : 'Ontem à noite deu uma rajada forte com 55 mm em 40 minutos. Quem tem terreno inclinado precisa reforçar os cordões de contenção e drenagem antes do próximo pico.',
      curtidas: 21,
      haQuantoTempo: en ? '6 hours ago' : 'há 6 horas',
      respostas: [],
    },
  ];
}

export const MOCK_COMMUNITY_POSTS: CommunityPost[] = buildCommunityPosts('en');

export function buildCommunityReportGraph(
  posts: CommunityPost[],
  activeFarm: FarmProperty,
  lang: AppLanguage = 'en'
): {
  nodes: CommunityGraphNode[];
  edges: CommunityGraphEdge[];
} {
  const width = 320;
  const height = 240;
  const cx = width / 2;
  const cy = height / 2;

  const userNodeId = `node-user-${activeFarm.municipio}`;

  const grouped = new Map<
    string,
    {
      municipio: string;
      estado: string;
      regiaoNome: string;
      bioma: 'Caatinga' | 'Mata Atlântica' | 'Cerrado';
      centroid: { latitude: number; longitude: number };
      posts: CommunityPost[];
    }
  >();

  for (const post of posts) {
    const key = `${post.municipio}-${post.estado}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.posts.push(post);
    } else {
      grouped.set(key, {
        municipio: post.municipio,
        estado: post.estado,
        regiaoNome: post.regiaoNome,
        bioma: post.bioma,
        centroid: post.centroid,
        posts: [post],
      });
    }
  }

  const userGroupKey = `${activeFarm.municipio}-${activeFarm.estado}`;
  const userOwnPosts = grouped.get(userGroupKey)?.posts ?? [];

  const nodes: CommunityGraphNode[] = [
    {
      id: userNodeId,
      regiaoNome: activeFarm.regiaoNome,
      municipio: activeFarm.municipio,
      estado: activeFarm.estado,
      bioma: activeFarm.bioma,
      isUserFarm: true,
      reportCount: userOwnPosts.length,
      dominantTopic: userOwnPosts[0]?.topico ?? 'rotacao',
      distanceKm: 0,
      x: cx,
      y: cy,
      autores: [
        pickLang(lang, 'Your Farm', 'Sua Roça'),
        ...userOwnPosts.map((p) => p.autor),
      ],
    },
  ];

  const externalGroups = Array.from(grouped.entries()).filter(
    ([key]) => key !== userGroupKey
  );

  const rx = 114;
  const ry = 84;
  externalGroups.forEach(([key, g], idx) => {
    const angle = (idx / Math.max(1, externalGroups.length)) * Math.PI * 2 - Math.PI / 2;
    const topicCounts = new Map<CommunityTopic, number>();
    for (const p of g.posts) {
      topicCounts.set(p.topico, (topicCounts.get(p.topico) ?? 0) + 1);
    }
    let dominantTopic: CommunityTopic = g.posts[0]?.topico ?? 'duvida';
    let bestCount = -1;
    topicCounts.forEach((cnt, top) => {
      if (cnt > bestCount) {
        bestCount = cnt;
        dominantTopic = top;
      }
    });

    nodes.push({
      id: `node-${key}`,
      regiaoNome: g.regiaoNome,
      municipio: g.municipio,
      estado: g.estado,
      bioma: g.bioma,
      isUserFarm: false,
      reportCount: g.posts.length,
      dominantTopic,
      distanceKm: Math.round(distanceKm(activeFarm.centroid, g.centroid)),
      x: Number((cx + Math.cos(angle) * rx).toFixed(1)),
      y: Number((cy + Math.sin(angle) * ry).toFixed(1)),
      autores: g.posts.map((p) => p.autor),
    });
  });

  const topicMeta = getTopicMeta(lang);
  const edges: CommunityGraphEdge[] = [];
  const otherNodes = nodes.filter((n) => !n.isUserFarm);

  otherNodes.forEach((target) => {
    const sameBiome = target.bioma === activeFarm.bioma;
    const closeNeighbor = target.distanceKm <= 260;
    if (sameBiome || closeNeighbor) {
      const biomeDisplay = localizeBiome(target.bioma, lang);
      edges.push({
        id: `edge-u-${target.id}`,
        fromId: userNodeId,
        toId: target.id,
        relation: sameBiome ? 'mesmo_bioma' : 'vizinho',
        label: sameBiome
          ? pickLang(lang, `${biomeDisplay} Biome`, `Bioma ${biomeDisplay}`)
          : `${target.distanceKm} km`,
      });
    }
  });

  for (let i = 0; i < otherNodes.length; i++) {
    for (let j = i + 1; j < otherNodes.length; j++) {
      if (otherNodes[i].dominantTopic === otherNodes[j].dominantTopic) {
        edges.push({
          id: `edge-t-${otherNodes[i].id}-${otherNodes[j].id}`,
          fromId: otherNodes[i].id,
          toId: otherNodes[j].id,
          relation: 'mesmo_tema',
          label: topicMeta[otherNodes[i].dominantTopic].label,
        });
      }
    }
  }

  return { nodes, edges };
}
