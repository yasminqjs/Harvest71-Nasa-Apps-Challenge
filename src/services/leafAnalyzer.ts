import * as jpeg from 'jpeg-js';
import { Platform } from 'react-native';
import { AppLanguage, LeafAnalysisResult } from '../types/domain';
import { isEn } from '../i18n/locale';

function decodeBase64ToBytes(base64: string): Uint8Array {
  const clean = base64.includes(',') ? base64.split(',')[1] : base64;
  if (typeof globalThis.atob === 'function') {
    const bin = globalThis.atob(clean);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  }

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const outLen = Math.floor((clean.length * 3) / 4) - padding;
  const bytes = new Uint8Array(outLen);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = lookup[clean.charCodeAt(i)];
    const b = lookup[clean.charCodeAt(i + 1)];
    const c = lookup[clean.charCodeAt(i + 2)];
    const d = lookup[clean.charCodeAt(i + 3)];
    const triplet = (a << 18) | (b << 12) | (c << 6) | d;
    if (p < outLen) bytes[p++] = (triplet >> 16) & 0xff;
    if (p < outLen) bytes[p++] = (triplet >> 8) & 0xff;
    if (p < outLen) bytes[p++] = triplet & 0xff;
  }
  return bytes;
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const v = max / 255;
  const s = max === 0 ? 0 : delta / max;

  let h = 0;
  if (delta > 0) {
    if (max === r) {
      h = 60 * (((g - b) / delta) % 6);
      if (h < 0) h += 360;
    } else if (max === g) {
      h = 60 * ((b - r) / delta + 2);
    } else {
      h = 60 * ((r - g) / delta + 4);
    }
  }
  return { h, s, v };
}

type PixelClass = 'bg' | 'green' | 'yellow' | 'dry_brown' | 'dark';

function classifyPixel(r: number, g: number, b: number): PixelClass {
  const { h, s, v } = rgbToHsv(r, g, b);
  const exG = 2 * g - r - b;

  // Pixels muito escuros (candidatos a pontos pretos / necrose escura se estiverem dentro da folha)
  if (v <= 0.22) {
    return 'dark';
  }

  // Ignora branco estourado, cinza neutro claro e azul de céu
  if ((v > 0.95 && s < 0.14) || (h > 175 && h < 340)) {
    return 'bg';
  }

  // Folha verde saudável
  if (s >= 0.14 && h >= 68 && h <= 172 && (g > r || exG > 8)) {
    return 'green';
  }

  // Amarelo (clorose): matiz amarela com vermelho próximo ou acima do verde e saturação viva
  if (s >= 0.24 && v >= 0.38 && h >= 42 && h < 68 && r >= g * 0.92) {
    return 'yellow';
  }

  // Folha seca / palha / marrom (cobre de marrom escuro até palha/bege claro seco)
  if (h >= 10 && h < 45 && r >= g && s >= 0.13 && v > 0.22 && v <= 0.88) {
    return 'dry_brown';
  }

  // Folha seca cinza-palha muito desbotada (baixa saturação, tom quente)
  if (s >= 0.07 && s < 0.14 && v >= 0.35 && v <= 0.82 && r >= g && g >= b) {
    return 'dry_brown';
  }

  return 'bg';
}

export interface FoliarPixelMetrics {
  greenPct: number;
  yellowPct: number;
  dryBrownPct: number;
  blackSpotPct: number;
  leafCoveragePct: number;
}

/**
 * Analisa pixels RGBA em duas passadas:
 * 1) Mapeia o tecido foliar (verde, amarelo, seco/marrom) e suas bordas por linha/coluna;
 * 2) Conta pontos pretos/manchas escuras apenas DENTRO do contorno da folha (ignorando fundo preto ao redor).
 */
export function analyzeRgbaPixels(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number
): FoliarPixelMetrics {
  const xStart = Math.floor(width * 0.12);
  const xEnd = Math.ceil(width * 0.88);
  const yStart = Math.floor(height * 0.12);
  const yEnd = Math.ceil(height * 0.88);

  const roiPixels = Math.max(1, (xEnd - xStart) * (yEnd - yStart));
  const step = Math.max(1, Math.floor(Math.sqrt(roiPixels / 5500)));

  const cols = Math.ceil((xEnd - xStart) / step);
  const rows = Math.ceil((yEnd - yStart) / step);
  const grid: PixelClass[] = new Array(rows * cols);

  const rowMinX = new Array<number>(rows).fill(cols);
  const rowMaxX = new Array<number>(rows).fill(-1);
  const colMinY = new Array<number>(cols).fill(rows);
  const colMaxY = new Array<number>(cols).fill(-1);

  let greenCount = 0;
  let yellowCount = 0;
  let dryBrownCount = 0;
  let totalSampled = 0;

  for (let ry = 0; ry < rows; ry++) {
    const y = yStart + ry * step;
    if (y >= height) continue;
    for (let cx = 0; cx < cols; cx++) {
      const x = xStart + cx * step;
      if (x >= width) continue;
      const idx = (y * width + x) * 4;
      const cls = classifyPixel(data[idx], data[idx + 1], data[idx + 2]);
      grid[ry * cols + cx] = cls;
      totalSampled++;

      if (cls === 'green' || cls === 'yellow' || cls === 'dry_brown') {
        if (cx < rowMinX[ry]) rowMinX[ry] = cx;
        if (cx > rowMaxX[ry]) rowMaxX[ry] = cx;
        if (ry < colMinY[cx]) colMinY[cx] = ry;
        if (ry > colMaxY[cx]) colMaxY[cx] = ry;

        if (cls === 'green') greenCount++;
        else if (cls === 'yellow') yellowCount++;
        else dryBrownCount++;
      }
    }
  }

  let blackSpotCount = 0;
  for (let ry = 0; ry < rows; ry++) {
    for (let cx = 0; cx < cols; cx++) {
      if (grid[ry * cols + cx] === 'dark') {
        const insideRow = cx >= rowMinX[ry] && cx <= rowMaxX[ry];
        const insideCol = ry >= colMinY[cx] && ry <= colMaxY[cx];
        if (insideRow && insideCol) {
          blackSpotCount++;
        }
      }
    }
  }

  const leafTotal = greenCount + yellowCount + dryBrownCount + blackSpotCount;
  const leafCoveragePct =
    totalSampled > 0 ? Math.round((leafTotal / totalSampled) * 100) : 0;

  if (leafTotal < 15) {
    return {
      greenPct: 0,
      yellowPct: 0,
      dryBrownPct: 0,
      blackSpotPct: 0,
      leafCoveragePct: 0,
    };
  }

  return {
    greenPct: Math.round((greenCount / leafTotal) * 100),
    yellowPct: Math.round((yellowCount / leafTotal) * 100),
    dryBrownPct: Math.round((dryBrownCount / leafTotal) * 100),
    blackSpotPct: Math.round((blackSpotCount / leafTotal) * 100),
    leafCoveragePct,
  };
}

function buildResultFromMetrics(
  imageUri: string,
  m: FoliarPixelMetrics,
  lang: AppLanguage = 'en'
): LeafAnalysisResult {
  const en = isEn(lang);
  const { greenPct, yellowPct, dryBrownPct, blackSpotPct } = m;

  if (greenPct + yellowPct + dryBrownPct + blackSpotPct === 0) {
    return {
      id: `leaf-${Date.now()}`,
      imageUri,
      criadoEm: new Date().toISOString(),
      indiceVerdePct: 0,
      amarelamentoPct: 0,
      necrosePct: 0,
      pontosPretosPct: 0,
      status: 'estresse_leve',
      titulo: en ? 'Frame the leaf closer' : 'Enquadre a folha mais de perto',
      diagnosticoAcessivel: en
        ? 'Could not see the leaf clearly in the center of the photo. Try taking another photo closer to the leaf in good light.'
        : 'Não consegui enxergar a folha direito no centro da foto. Tente tirar outra foto mais perto da folha, em lugar claro.',
      diagnosticoTecnico: en
        ? 'Low foliar coverage detected in image center. Retake photo closer to leaf.'
        : 'Baixa cobertura foliar detectada no centro da imagem. Repita a captura aproximando a câmera.',
      acaoRecomendada: en
        ? 'Place the leaf in the center of the screen, avoiding too much soil or wall background.'
        : 'Coloque a folha no meio da tela, evitando muito fundo de terra ou parede.',
    };
  }

  // 1) Completely dried leaf (predominantly brown/straw, almost no green)
  if (
    dryBrownPct >= 50 ||
    (dryBrownPct + blackSpotPct >= 62 && greenPct < 18)
  ) {
    return {
      id: `leaf-${Date.now()}`,
      imageUri,
      criadoEm: new Date().toISOString(),
      indiceVerdePct: greenPct,
      amarelamentoPct: yellowPct,
      necrosePct: dryBrownPct,
      pontosPretosPct: blackSpotPct,
      status: 'seca_total',
      titulo: en ? 'Completely dried leaf' : 'Folha totalmente seca',
      diagnosticoAcessivel: en
        ? `This leaf is already dry (${dryBrownPct}% dry and only ${greenPct}% green). This may indicate severe drought, intense heat, or an old dried lower leaf.`
        : `Essa folha já está seca (${dryBrownPct}% seca e apenas ${greenPct}% verde). Pode ser seca severa, calor forte ou folha velha que já secou no pé.`,
      diagnosticoTecnico: en
        ? `Senescent/dry leaf tissue: ${dryBrownPct}% dry, ${blackSpotPct}% dark necrosis, ${yellowPct}% yellow, ${greenPct}% chlorophyll.`
        : `Tecido foliar senescente/seco: ${dryBrownPct}% seco, ${blackSpotPct}% necrose escura, ${yellowPct}% amarelo, ${greenPct}% clorofila.`,
      acaoRecomendada: en
        ? 'Also check younger leaves in the middle of the plant; cover soil with plenty of mulch and prioritize water for younger plants.'
        : 'Confira também folhas novas do meio do pé; cubra o solo com bastante palha e priorize água nas plantas mais jovens.',
    };
  }

  // 2) Black spots / dark lesions (anthracnose, early blight, fungus) — even on green leaf
  if (blackSpotPct >= 5) {
    const withYellow = yellowPct >= 14;
    return {
      id: `leaf-${Date.now()}`,
      imageUri,
      criadoEm: new Date().toISOString(),
      indiceVerdePct: greenPct,
      amarelamentoPct: yellowPct,
      necrosePct: dryBrownPct,
      pontosPretosPct: blackSpotPct,
      status: 'manchas_pretas',
      titulo: en
        ? 'Black spots / dark lesions on leaf'
        : 'Pontos pretos / manchas escuras na folha',
      diagnosticoAcessivel: en
        ? `Black spots or dark lesions detected (${blackSpotPct}%)${
            withYellow ? ` along with yellowing (${yellowPct}%)` : ''
          }. This is commonly a sign of fungus (such as black spot or anthracnose) or foliar disease.`
        : `Foram detectados pontos pretos ou manchas escuras (${blackSpotPct}%)${
            withYellow ? ` junto com amarelamento (${yellowPct}%)` : ''
          }. Isso costuma ser sinal de fungo (como pinta-preta ou antracnose) ou mancha de doença.`,
      diagnosticoTecnico: en
        ? `Dark lesions / spot necrosis (${blackSpotPct}% black spots | ${greenPct}% green | ${yellowPct}% chlorosis | ${dryBrownPct}% dry).`
        : `Lesões escuras/necrose pontual (${blackSpotPct}% pontos pretos | ${greenPct}% verde | ${yellowPct}% clorose | ${dryBrownPct}% seco).`,
      acaoRecomendada: en
        ? 'Remove heavily spotted leaves and dispose away from the plot, avoid wetting leaves at night, and watch neighboring plants for spread.'
        : 'Retire e descarte longe da roça as folhas muito manchadas, evite molhar as folhas à noite e observe se está espalhando pelos pés vizinhos.',
    };
  }

  // 3) Partial scorch / necrosis (dry spots without whole leaf dried)
  if (dryBrownPct >= 22 && dryBrownPct > yellowPct) {
    return {
      id: `leaf-${Date.now()}`,
      imageUri,
      criadoEm: new Date().toISOString(),
      indiceVerdePct: greenPct,
      amarelamentoPct: yellowPct,
      necrosePct: dryBrownPct,
      pontosPretosPct: blackSpotPct,
      status: 'clorose_ou_seca',
      titulo: en
        ? 'Dry spots or leaf scorch'
        : 'Manchas secas ou queima na folha',
      diagnosticoAcessivel: en
        ? `Dry or scorched patches were spotted on the leaf (${dryBrownPct}%). Could be strong sun with low water or a disease lesion.`
        : `Foram vistas partes secas ou queimadas na folha (${dryBrownPct}%). Pode ser sol forte com pouca água ou mancha de doença.`,
      diagnosticoTecnico: en
        ? `Partial foliar necrosis/scorch (${dryBrownPct}% dry | ${yellowPct}% chlorosis | ${greenPct}% green).`
        : `Necrose/queima foliar parcial (${dryBrownPct}% seco | ${yellowPct}% clorose | ${greenPct}% verde).`,
      acaoRecomendada: en
        ? 'Remove heavily scorched leaves, reinforce mulch cover, and avoid watering leaves during peak heat.'
        : 'Retire folhas muito queimadas, reforce a cobertura morta e evite molhar as folhas no sol quente.',
    };
  }

  // 4) Severe chlorosis (heavily yellowed leaf)
  if (yellowPct >= 30 || (greenPct < 50 && yellowPct >= 15)) {
    return {
      id: `leaf-${Date.now()}`,
      imageUri,
      criadoEm: new Date().toISOString(),
      indiceVerdePct: greenPct,
      amarelamentoPct: yellowPct,
      necrosePct: dryBrownPct,
      pontosPretosPct: blackSpotPct,
      status: 'clorose_ou_seca',
      titulo: en
        ? 'Severe stress or leaf chlorosis'
        : 'Estresse forte ou clorose na folha',
      diagnosticoAcessivel: en
        ? `The leaf is heavily yellowed (${yellowPct}%). This indicates heat stress, lack of water, or soil nitrogen deficiency.`
        : `A folha está bastante amarelada (${yellowPct}%). Isso mostra estresse de calor, falta de água ou deficiência de nitrogênio na terra.`,
      diagnosticoTecnico: en
        ? `Severe chlorosis (${yellowPct}% yellowing | ${dryBrownPct}% dry | ${greenPct}% green).`
        : `Clorose severa (${yellowPct}% amarelamento | ${dryBrownPct}% seco | ${greenPct}% verde).`,
      acaoRecomendada: en
        ? 'Reinforce mulch cover, check underside of leaf for pests, and avoid synthetic fertilizer in harsh sun.'
        : 'Reforce a cobertura morta, cheque se há pragas embaixo da folha e evite adubação química no sol quente.',
    };
  }

  // 5) Early yellowing / mild stress
  if (yellowPct >= 12 || dryBrownPct >= 10 || blackSpotPct >= 2) {
    return {
      id: `leaf-${Date.now()}`,
      imageUri,
      criadoEm: new Date().toISOString(),
      indiceVerdePct: greenPct,
      amarelamentoPct: yellowPct,
      necrosePct: dryBrownPct,
      pontosPretosPct: blackSpotPct,
      status: 'estresse_leve',
      titulo: en
        ? 'Early yellowing (watch closely)'
        : 'Início de amarelamento (atenção)',
      diagnosticoAcessivel: en
        ? `Leaf shows early signs of yellowing (${yellowPct}%) or dry tips (${dryBrownPct}%). Could be early water deficit or need for organic matter.`
        : `A folha mostrou sinais iniciais de amarelamento (${yellowPct}%) ou pontas secas (${dryBrownPct}%). Pode ser início de falta de água ou de adubo orgânico.`,
      diagnosticoTecnico: en
        ? `Mild stress: ${greenPct}% green | ${yellowPct}% yellowing | ${dryBrownPct}% dry | ${blackSpotPct}% black spots.`
        : `Estresse leve: ${greenPct}% verde | ${yellowPct}% amarelamento | ${dryBrownPct}% seco | ${blackSpotPct}% pontos pretos.`,
      acaoRecomendada: en
        ? 'Cover soil around the plant with dry straw or aged manure and monitor soil moisture.'
        : 'Cubra o solo ao redor da planta com palha seca ou esterco curtido e observe a umidade da terra.',
    };
  }

  // 6) Healthy leaf
  return {
    id: `leaf-${Date.now()}`,
    imageUri,
    criadoEm: new Date().toISOString(),
    indiceVerdePct: greenPct,
    amarelamentoPct: yellowPct,
    necrosePct: dryBrownPct,
    pontosPretosPct: blackSpotPct,
    status: 'saudavel',
    titulo: en ? 'Healthy leaf (strong vigor)' : 'Folha saudável (bom vigor)',
    diagnosticoAcessivel: en
      ? `The leaf is rich green (${greenPct}% green) and vigorous! The plant is taking up water and nutrients well from the soil.`
      : `A folha está bem verdinha (${greenPct}% verde) e forte! A planta está puxando água e nutrientes direito da terra.`,
    diagnosticoTecnico: en
      ? `Leaf chlorophyll/green: ${greenPct}% | Yellowing: ${yellowPct}% | Dry: ${dryBrownPct}% | Black spots: ${blackSpotPct}%.`
      : `Clorofila/verde foliar: ${greenPct}% | Amarelamento: ${yellowPct}% | Seco: ${dryBrownPct}% | Pontos pretos: ${blackSpotPct}%.`,
    acaoRecomendada: en
      ? 'Keep maintaining straw mulch around the plant base to hold soil moisture.'
      : 'Continue mantendo cobertura de palha no pé da planta para segurar a umidade.',
  };
}

export type SimulatedLeafProfile =
  | 'saudavel'
  | 'amarelada'
  | 'seca_total'
  | 'pontos_pretos';

/**
 * Analyzes a captured leaf photo 100% locally / offline.
 */
export async function analyzeLeafImageOffline(
  imageUri: string,
  simulatedProfile?: SimulatedLeafProfile,
  base64Data?: string | null,
  lang: AppLanguage = 'en'
): Promise<LeafAnalysisResult> {
  if (simulatedProfile === 'saudavel') {
    return buildResultFromMetrics(
      imageUri,
      {
        greenPct: 92,
        yellowPct: 4,
        dryBrownPct: 3,
        blackSpotPct: 1,
        leafCoveragePct: 80,
      },
      lang
    );
  }
  if (simulatedProfile === 'amarelada') {
    return buildResultFromMetrics(
      imageUri,
      {
        greenPct: 34,
        yellowPct: 54,
        dryBrownPct: 11,
        blackSpotPct: 1,
        leafCoveragePct: 80,
      },
      lang
    );
  }
  if (simulatedProfile === 'seca_total') {
    return buildResultFromMetrics(
      imageUri,
      {
        greenPct: 6,
        yellowPct: 14,
        dryBrownPct: 74,
        blackSpotPct: 6,
        leafCoveragePct: 80,
      },
      lang
    );
  }
  if (simulatedProfile === 'pontos_pretos') {
    return buildResultFromMetrics(
      imageUri,
      {
        greenPct: 68,
        yellowPct: 12,
        dryBrownPct: 6,
        blackSpotPct: 14,
        leafCoveragePct: 80,
      },
      lang
    );
  }

  if (base64Data) {
    try {
      const bytes = decodeBase64ToBytes(base64Data);
      if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
        const decoded = jpeg.decode(bytes, {
          useTArray: true,
          formatAsRGBA: true,
          tolerantDecoding: true,
        });
        const metrics = analyzeRgbaPixels(decoded.data, decoded.width, decoded.height);
        return buildResultFromMetrics(imageUri, metrics, lang);
      }
    } catch {
      // Fallback for Web canvas
    }
  }

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    try {
      const metrics = await new Promise<FoliarPixelMetrics>((resolve, reject) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const w = 128;
          const h = 128;
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('no-ctx'));
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          const data = ctx.getImageData(0, 0, w, h).data;
          resolve(analyzeRgbaPixels(data, w, h));
        };
        img.onerror = () => reject(new Error('img-load-err'));
        img.src = imageUri;
      });
      return buildResultFromMetrics(imageUri, metrics, lang);
    } catch {
      // Fallback if image load fails
    }
  }

  return buildResultFromMetrics(
    imageUri,
    {
      greenPct: 0,
      yellowPct: 0,
      dryBrownPct: 0,
      blackSpotPct: 0,
      leafCoveragePct: 0,
    },
    lang
  );
}
