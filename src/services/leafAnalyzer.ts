import * as jpeg from 'jpeg-js';
import { Platform } from 'react-native';
import { LeafAnalysisResult } from '../types/domain';

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

/**
 * Segmenta apenas os pixels da folha (ignorando fundo branco, cinza, céu ou sombra extrema)
 * na região central da foto e classifica em Verde (clorofila), Amarelo (clorose) e Marrom (necrose/queima).
 */
export function analyzeRgbaPixels(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number
): { greenPct: number; yellowPct: number; brownPct: number; leafCoveragePct: number } {
  // Foca nos 70% centrais onde o agricultor enquadra a folha
  const xStart = Math.floor(width * 0.15);
  const xEnd = Math.ceil(width * 0.85);
  const yStart = Math.floor(height * 0.15);
  const yEnd = Math.ceil(height * 0.85);

  const roiPixels = Math.max(1, (xEnd - xStart) * (yEnd - yStart));
  const step = Math.max(1, Math.floor(Math.sqrt(roiPixels / 4500)));

  let greenCount = 0;
  let yellowCount = 0;
  let brownCount = 0;
  let sampledCount = 0;

  for (let y = yStart; y < yEnd; y += step) {
    for (let x = xStart; x < xEnd; x += step) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      sampledCount++;

      const { h, s, v } = rgbToHsv(r, g, b);
      // Ignora fundo neutro (branco/cinza/preto) e azul de céu
      if (v < 0.09 || (v > 0.96 && s < 0.15) || s < 0.14 || (h > 175 && h < 340)) {
        continue;
      }

      const exG = 2 * g - r - b;

      // Folha verde saudável (inclui verde-oliva ao sol onde g > r e matiz >= 68°)
      if (h >= 68 && h <= 172 && (g > r || exG > 8)) {
        greenCount++;
      } else if (h >= 38 && h < 68 && r >= g * 0.92 && s >= 0.22 && v >= 0.35) {
        // Amarelamento real (clorose): vermelho próximo ou acima do verde
        yellowCount++;
      } else if (h >= 10 && h < 42 && r > g && s >= 0.2 && v >= 0.12 && v < 0.52) {
        // Manchas secas / necrose / queima
        brownCount++;
      }
    }
  }

  const leafTotal = greenCount + yellowCount + brownCount;
  const leafCoveragePct =
    sampledCount > 0 ? Math.round((leafTotal / sampledCount) * 100) : 0;

  if (leafTotal < 15) {
    return { greenPct: 0, yellowPct: 0, brownPct: 0, leafCoveragePct: 0 };
  }

  return {
    greenPct: Math.round((greenCount / leafTotal) * 100),
    yellowPct: Math.round((yellowCount / leafTotal) * 100),
    brownPct: Math.round((brownCount / leafTotal) * 100),
    leafCoveragePct,
  };
}

function buildResultFromMetrics(
  imageUri: string,
  greenPct: number,
  yellowPct: number,
  brownPct: number = 0
): LeafAnalysisResult {
  if (greenPct === 0 && yellowPct === 0 && brownPct === 0) {
    return {
      id: `leaf-${Date.now()}`,
      imageUri,
      criadoEm: new Date().toISOString(),
      indiceVerdePct: 0,
      amarelamentoPct: 0,
      necrosePct: 0,
      status: 'estresse_leve',
      titulo: 'Enquadre a folha mais de perto',
      diagnosticoAcessivel:
        'Não consegui enxergar a folha direito no centro da foto. Tente tirar outra foto mais perto da folha, em lugar claro.',
      diagnosticoTecnico:
        'Baixa cobertura foliar detectada no centro da imagem (ROI). Repita a captura aproximando a câmera.',
      acaoRecomendada:
        'Coloque a folha no meio da tela, evitando muito fundo de terra ou parede.',
    };
  }

  let status: LeafAnalysisResult['status'] = 'saudavel';
  if (brownPct >= 22 || yellowPct >= 30 || greenPct < 50) {
    status = 'clorose_ou_seca';
  } else if (yellowPct >= 14 || brownPct >= 10) {
    status = 'estresse_leve';
  }

  if (status === 'saudavel') {
    return {
      id: `leaf-${Date.now()}`,
      imageUri,
      criadoEm: new Date().toISOString(),
      indiceVerdePct: greenPct,
      amarelamentoPct: yellowPct,
      necrosePct: brownPct,
      status,
      titulo: 'Folha saudável (bom vigor)',
      diagnosticoAcessivel: `A folha está bem verdinha (${greenPct}% verde) e forte! A planta está puxando água e nutrientes direito da terra.`,
      diagnosticoTecnico: `Clorofila/verde foliar: ${greenPct}% | Amarelamento: ${yellowPct}% | Necrose: ${brownPct}%.`,
      acaoRecomendada:
        'Continue mantendo cobertura de palha no pé da planta para segurar a umidade.',
    };
  }

  if (status === 'estresse_leve') {
    return {
      id: `leaf-${Date.now()}`,
      imageUri,
      criadoEm: new Date().toISOString(),
      indiceVerdePct: greenPct,
      amarelamentoPct: yellowPct,
      necrosePct: brownPct,
      status,
      titulo: 'Início de amarelamento (atenção)',
      diagnosticoAcessivel: `A folha mostrou sinais iniciais de amarelamento (${yellowPct}%) ou pontas secas (${brownPct}%). Pode ser início de falta de água ou de adubo orgânico.`,
      diagnosticoTecnico: `Estresse leve: ${greenPct}% verde | ${yellowPct}% amarelamento | ${brownPct}% necrose.`,
      acaoRecomendada:
        'Cubra o solo ao redor da planta com palha seca ou esterco curtido e observe a umidade da terra.',
    };
  }

  if (brownPct >= 22 && brownPct > yellowPct) {
    return {
      id: `leaf-${Date.now()}`,
      imageUri,
      criadoEm: new Date().toISOString(),
      indiceVerdePct: greenPct,
      amarelamentoPct: yellowPct,
      necrosePct: brownPct,
      status,
      titulo: 'Manchas secas ou queima na folha',
      diagnosticoAcessivel: `Foram vistas partes secas ou queimadas na folha (${brownPct}%). Pode ser sol muito quente com pouca água ou mancha de fungo.`,
      diagnosticoTecnico: `Necrose/queima foliar predominante (${brownPct}% necrose | ${yellowPct}% clorose | ${greenPct}% verde).`,
      acaoRecomendada:
        'Retire folhas muito queimadas ou manchadas, reforce a cobertura morta e evite molhar as folhas no sol quente.',
    };
  }

  return {
    id: `leaf-${Date.now()}`,
    imageUri,
    criadoEm: new Date().toISOString(),
    indiceVerdePct: greenPct,
    amarelamentoPct: yellowPct,
    necrosePct: brownPct,
    status,
    titulo: 'Estresse forte ou clorose na folha',
    diagnosticoAcessivel: `A folha está bastante amarelada (${yellowPct}%). Isso mostra estresse de calor, falta de água ou deficiência de nitrogênio na terra.`,
    diagnosticoTecnico: `Clorose severa (${yellowPct}% amarelamento | ${brownPct}% necrose | ${greenPct}% verde).`,
    acaoRecomendada:
      'Reforce a cobertura morta, cheque se há pragas embaixo da folha e evite adubação química no sol quente.',
  };
}

/**
 * Analisa localmente (100% offline) a foto da folha capturada pela câmera.
 * Funciona com pixels reais tanto na Web (Canvas) quanto no Android/iOS (decodificando JPEG via base64).
 */
export async function analyzeLeafImageOffline(
  imageUri: string,
  simulatedProfile?: 'saudavel' | 'amarelada',
  base64Data?: string | null
): Promise<LeafAnalysisResult> {
  if (simulatedProfile === 'saudavel') {
    return buildResultFromMetrics(imageUri, 92, 5, 3);
  }
  if (simulatedProfile === 'amarelada') {
    return buildResultFromMetrics(imageUri, 34, 54, 12);
  }

  // 1) Se tiver base64 (Android/iOS/Web), decodifica os pixels JPEG reais offline
  if (base64Data) {
    try {
      const bytes = decodeBase64ToBytes(base64Data);
      // Assinatura JPEG começa com 0xFF 0xD8
      if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
        const decoded = jpeg.decode(bytes, {
          useTArray: true,
          formatAsRGBA: true,
          tolerantDecoding: true,
        });
        const metrics = analyzeRgbaPixels(
          decoded.data,
          decoded.width,
          decoded.height
        );
        return buildResultFromMetrics(
          imageUri,
          metrics.greenPct,
          metrics.yellowPct,
          metrics.brownPct
        );
      }
    } catch {
      // Se não for JPEG ou falhar na decodificação, tenta Canvas na Web abaixo
    }
  }

  // 2) Na Web (PNG/JPEG/WebP/Blob), usa Canvas 128x128 com segmentação HSV + ExG
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    try {
      const metrics = await new Promise<{
        greenPct: number;
        yellowPct: number;
        brownPct: number;
      }>((resolve, reject) => {
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
          const res = analyzeRgbaPixels(data, w, h);
          resolve({
            greenPct: res.greenPct,
            yellowPct: res.yellowPct,
            brownPct: res.brownPct,
          });
        };
        img.onerror = () => reject(new Error('img-load-err'));
        img.src = imageUri;
      });
      return buildResultFromMetrics(
        imageUri,
        metrics.greenPct,
        metrics.yellowPct,
        metrics.brownPct
      );
    } catch {
      // Fallback caso imagem não carregue no canvas
    }
  }

  return buildResultFromMetrics(imageUri, 0, 0, 0);
}
