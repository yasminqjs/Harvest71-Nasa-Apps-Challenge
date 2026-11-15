import {
  CommunityGraphEdge,
  CommunityGraphNode,
  CommunityPost,
  CommunityTopic,
  FarmProperty,
} from '../types/domain';
import { distanceKm } from '../utils/geoprocessing';

export const TOPIC_META: Record<
  CommunityTopic,
  { label: string; color: string; bg: string }
> = {
  praga: { label: 'Pragas', color: '#D97706', bg: '#FEF3C7' },
  mudanca_preco: { label: 'Mudança de Preço', color: '#0D9488', bg: '#CCFBF1' },
  desastre_natural: { label: 'Desastre Natural', color: '#DC2626', bg: '#FEE2E2' },
  seca: { label: 'Seca / Chuva', color: '#B45309', bg: '#FFEDD5' },
  rotacao: { label: 'Rotação', color: '#16A34A', bg: '#DCFCE7' },
  solo: { label: 'Solo / Erosão', color: '#7C3AED', bg: '#F3E8FF' },
  duvida: { label: 'Dúvida Geral', color: '#2563EB', bg: '#DBEAFE' },
};

export const MOCK_COMMUNITY_POSTS: CommunityPost[] = [
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
    titulo: 'Sorgo + Feijão-Caupi segurou bem um veranico de 12 dias',
    mensagem:
      'Metade do meu Lote 1 ficou só no milho e sentiu muito o sol. Na metade onde coloquei sorgo forrageiro em faixa com feijão-caupi sobre palha seca, as folhas aguentaram até voltar a chuva.',
    curtidas: 19,
    haQuantoTempo: 'há 3 horas',
    respostas: [
      {
        id: 'rep-1',
        autor: 'Dona Rita Souza',
        regiaoNome: 'Portal do Sertão',
        municipio: 'Feira de Santana',
        texto: 'Fiz igual no ano passado e colhi feijão verde mesmo com pouca chuva em março.',
        criadoEm: 'há 2 horas',
      },
      {
        id: 'rep-2',
        autor: 'Zé Carlos',
        regiaoNome: 'Alto Sertão Sergipano',
        municipio: 'N. Sra. da Glória',
        texto: 'Vocês plantam o sorgo na mesma cova ou em fileira alternada?',
        criadoEm: 'há 1 hora',
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
    titulo: 'Qual melhor época para plantar mandioca após colheita de feijão?',
    mensagem:
      'Estou colhendo o feijão-caupi do Lote 1 semana que vem e quero aproveitar a terra ainda úmida. Vale plantar maniva logo em seguida ou colocar cobertura antes?',
    curtidas: 14,
    haQuantoTempo: 'há 5 horas',
    respostas: [
      {
        id: 'rep-3',
        autor: 'Compadre Valdir',
        regiaoNome: 'Recôncavo Baiano',
        municipio: 'Cruz das Almas',
        texto:
          'Se tiver palhada do feijão, deixe por cima da terra e já finque as manivas no começo das chuvas firmes!',
        criadoEm: 'há 4 horas',
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
    titulo: 'Pulgão nas bordas do feijão após 5 dias de calor forte',
    mensagem:
      'Apareceram pontinhos pretos e pulgão na borda oeste. Passei óleo de nim diluído no fim da tarde e plantei faixa de gergelim na beira para atrair joaninha.',
    curtidas: 23,
    haQuantoTempo: 'ontem',
    respostas: [
      {
        id: 'rep-4',
        autor: 'Marcos Vinícius',
        regiaoNome: 'Portal do Sertão',
        municipio: 'Feira de Santana',
        texto: 'Ótima dica do gergelim na bordadura! Aqui reduziu bem a cigarrinha.',
        criadoEm: 'ontem',
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
    titulo: 'Cordões de palma evitaram enxurrada na ladeira do Lote 2',
    mensagem:
      'Choveu 42 mm numa noite e antes levava toda a semente embora. Depois que cortamos a descida com fileiras de palma + resteva de milheto, a água infiltrou parada.',
    curtidas: 31,
    haQuantoTempo: 'há 2 dias',
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
    titulo: 'Alguém mais sentindo terra rachando fundo com menos de 1 semana sem chuva?',
    mensagem:
      'Aqui perto de Juazeiro o calor bateu 36°C três dias seguidos e o solo secou muito rápido. Vocês estão cobrindo o pé da planta com capim seco ou esterco?',
    curtidas: 11,
    haQuantoTempo: 'há 2 dias',
    respostas: [
      {
        id: 'rep-5',
        autor: 'Seu Antônio Lima',
        regiaoNome: 'Território do Sisal',
        municipio: 'Serrinha',
        texto:
          'Capim seco picado ajuda demais! Abaixa o calor da terra e segura umidade por vários dias a mais.',
        criadoEm: 'há 1 dia',
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
    titulo: 'Vale misturar feijão-de-porco antes do milho para recuperar terra cansada?',
    mensagem:
      'Meu lote 2 está com solo fraco depois de 3 anos seguidos plantando só milho. Quem já usou feijão-de-porco ou crotalária sentiu diferença na próxima safra?',
    curtidas: 17,
    haQuantoTempo: 'há 3 dias',
    respostas: [
      {
        id: 'rep-6',
        autor: 'Zé Raimundo',
        regiaoNome: 'Chapada / Irecê',
        municipio: 'Irecê',
        texto:
          'Dá muita diferença no verde da folha e na retenção de água, porque o nitrogênio e a palha renovam o chão.',
        criadoEm: 'há 2 dias',
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
    titulo: 'Saca de feijão-caupi subiu 18% na feira regional essa semana',
    mensagem:
      'Na feira livre e na cooperativa de Feira, o preço da saca de 60 kg subiu por causa da estiagem em regiões vizinhas. Quem colheu cedo está segurando parte para venda melhor.',
    curtidas: 28,
    haQuantoTempo: 'há 4 horas',
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
    titulo: 'Vendaval com enxurrada rápida derrubou cobertura na baixada',
    mensagem:
      'Ontem à noite deu uma rajada forte com 55 mm em 40 minutos. Quem tem terreno inclinado precisa reforçar os cordões de contenção e drenagem antes do próximo pico.',
    curtidas: 21,
    haQuantoTempo: 'há 6 horas',
    respostas: [],
  },
];

export function buildCommunityReportGraph(
  posts: CommunityPost[],
  activeFarm: FarmProperty
): {
  nodes: CommunityGraphNode[];
  edges: CommunityGraphEdge[];
} {
  const width = 320;
  const height = 240;
  const cx = width / 2;
  const cy = height / 2;

  const userNodeId = `node-user-${activeFarm.municipio}`;

  // Agrupa relatos por município + estado
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
      autores: ['Sua Roça', ...userOwnPosts.map((p) => p.autor)],
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

  const edges: CommunityGraphEdge[] = [];
  const otherNodes = nodes.filter((n) => !n.isUserFarm);

  // Conecta a roça do usuário aos polos que compartilham bioma ou são mais próximos
  otherNodes.forEach((target) => {
    const sameBiome = target.bioma === activeFarm.bioma;
    const closeNeighbor = target.distanceKm <= 260;
    if (sameBiome || closeNeighbor) {
      edges.push({
        id: `edge-u-${target.id}`,
        fromId: userNodeId,
        toId: target.id,
        relation: sameBiome ? 'mesmo_bioma' : 'vizinho',
        label: sameBiome ? `Bioma ${target.bioma}` : `${target.distanceKm} km`,
      });
    }
  });

  // Conecta nós externos que compartilham o mesmo tópico predominante
  for (let i = 0; i < otherNodes.length; i++) {
    for (let j = i + 1; j < otherNodes.length; j++) {
      if (otherNodes[i].dominantTopic === otherNodes[j].dominantTopic) {
        edges.push({
          id: `edge-t-${otherNodes[i].id}-${otherNodes[j].id}`,
          fromId: otherNodes[i].id,
          toId: otherNodes[j].id,
          relation: 'mesmo_tema',
          label: TOPIC_META[otherNodes[i].dominantTopic].label,
        });
      }
    }
  }

  return { nodes, edges };
}
