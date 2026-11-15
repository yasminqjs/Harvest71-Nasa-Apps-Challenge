/**
 * Regras puras da integração DSSAT (sem React, sem rede) — testadas em scripts/tests/dssatLogic.test.mjs.
 * Só `import type` aqui: o teste roda o arquivo direto no Node.
 */
import type { CatalogCrop, Capabilities, RotationCycle, SoilLayer } from '../types/dssat';

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Apelidos usados no front/na roça para os códigos do catálogo DSSAT. */
const ALIASES: Record<string, string> = {
  milho: 'MZ', 'milho verde': 'SW', 'milho-verde': 'SW', feijao: 'BN', 'feijao carioca': 'BN',
  'feijao de corda': 'CP', 'feijao-de-corda': 'CP', caupi: 'CP', 'feijao caupi': 'CP', 'feijao-caupi': 'CP',
  macacar: 'CP', 'feijao macacar': 'CP', soja: 'SB', amendoim: 'PN', mandioca: 'CS', macaxeira: 'CS', aipim: 'CS',
  sorgo: 'SG', milheto: 'ML', arroz: 'RI', girassol: 'SU', algodao: 'CO', guandu: 'PP', 'feijao guandu': 'PP',
  'feijao-guandu': 'PP', cana: 'SC', 'cana-de-acucar': 'SC', 'cana de acucar': 'SC', abacaxi: 'PI', inhame: 'TR',
  taro: 'TR', taioba: 'TN', tomate: 'TM', pimentao: 'PR', 'feijao vagem': 'GB', 'feijao-vagem': 'GB',
  repolho: 'CB', batata: 'PT', 'grao de bico': 'CH', 'grao-de-bico': 'CH',
};

/** Código do catálogo para um nome livre ("Feijão de corda", "Milho crioulo"), ou null (ex.: palma). */
export function cropCodeFromName(name: string, catalog: CatalogCrop[]): string | null {
  const n = normalize(name);
  if (!n) return null;
  const byCode = catalog.find((c) => c.code.toLowerCase() === n);
  if (byCode) return byCode.code;
  const exact = catalog.find((c) => normalize(c.name) === n);
  if (exact) return exact.code;
  if (ALIASES[n]) return catalog.some((c) => c.code === ALIASES[n]) ? ALIASES[n] : null;
  // Primeiro termo reconhecido: "milho crioulo" -> milho, "feijao de corda verde" -> feijao de corda
  const keys = Object.keys(ALIASES).sort((a, b) => b.length - a.length);
  const hit = keys.find((k) => n === k || n.startsWith(k + ' '));
  if (hit && catalog.some((c) => c.code === ALIASES[hit])) return ALIASES[hit];
  return null;
}

/** Sugestões (códigos únicos) a partir dos nomes do perfil e do histórico. O usuário confirma. */
export function suggestKnownCrops(names: (string | undefined | null)[], catalog: CatalogCrop[]): string[] {
  const out: string[] = [];
  for (const name of names) {
    if (!name) continue;
    for (const part of name.split(/[,;/+]| e /)) {
      const code = cropCodeFromName(part, catalog);
      if (code && !out.includes(code)) out.push(code);
    }
  }
  return out;
}

export function pairKey(a: string, b: string): string {
  return [a, b].sort().join('+');
}

/** Culturas da seleção que têm pelo menos um par habilitado com outra cultura da mesma seleção. */
export function eligibleInSelection(selected: string[], caps: Capabilities): Set<string> {
  const pairs = new Set(caps.sequence_pairs.map(([a, b]) => pairKey(a, b)));
  const ok = new Set<string>();
  for (let i = 0; i < selected.length; i++) {
    for (let j = i + 1; j < selected.length; j++) {
      if (pairs.has(pairKey(selected[i], selected[j]))) {
        ok.add(selected[i]);
        ok.add(selected[j]);
      }
    }
  }
  return ok;
}

/** Todos os pares do conjunto habilitados? (exigência de POST /rotations, que tenta todas as permutações) */
export function allPairsEnabled(crops: string[], caps: Capabilities): boolean {
  const pairs = new Set(caps.sequence_pairs.map(([a, b]) => pairKey(a, b)));
  for (let i = 0; i < crops.length; i++) {
    for (let j = i + 1; j < crops.length; j++) {
      if (!pairs.has(pairKey(crops[i], crops[j]))) return false;
    }
  }
  return crops.length >= 2 && new Set(crops).size === crops.length;
}

export function targetMetric(code: string, caps: Capabilities | null): 'yield_kg_ha' | 'biomass_kg_ha' {
  const m = caps?.crops.find((c) => c.code === code)?.rotation_target_metric;
  return m === 'biomass_kg_ha' ? 'biomass_kg_ha' : 'yield_kg_ha';
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Data civil válida (sem fuso): "1992-02-30" é inválida. */
export function isValidIsoDate(s: string): boolean {
  const m = ISO.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** Erros do formulário de busca (lista vazia = pode enviar). Espelha as regras da API. */
export function validateSearchForm(input: {
  selected: string[];
  eligible: Set<string>;
  dates: string[];
  years: number[];
  targets: Record<string, string>;
}): string[] {
  const errs: string[] = [];
  if (input.eligible.size < 2) errs.push('Escolha pelo menos duas culturas que possam formar par.');
  if (input.dates.length !== 3 || !input.dates.every(isValidIsoDate)) {
    errs.push('Informe as três datas de plantio no formato AAAA-MM-DD.');
  } else {
    const sorted = [...input.dates].sort();
    if (sorted.join() !== input.dates.join() || new Set(input.dates).size !== 3) {
      errs.push('As datas de plantio precisam estar em ordem crescente e ser diferentes.');
    }
    const y0 = Number(input.dates[0].slice(0, 4));
    const y2 = Number(input.dates[2].slice(0, 4));
    if (y2 - y0 > 1) errs.push('As três datas precisam caber em até dois anos seguidos.');
  }
  const ys = input.years;
  if (ys.length < 2 || ys.length > 3 || new Set(ys).size !== ys.length || ys.some((y) => !Number.isInteger(y) || y < 1992 || y > 2023)) {
    errs.push('Escolha 2 ou 3 anos históricos diferentes entre 1992 e 2023.');
  } else if (input.dates.every(isValidIsoDate)) {
    // As datas são reaplicadas a cada ano: 29/02 pode não existir no ano escolhido.
    const base = Number(input.dates[0].slice(0, 4));
    for (const y of ys) {
      for (const d of input.dates) {
        const shifted = `${y + Number(d.slice(0, 4)) - base}${d.slice(4)}`;
        if (!isValidIsoDate(shifted)) {
          errs.push(`A data ${d.slice(5)} não existe no ano ${shifted.slice(0, 4)}. Troque a data ou o ano.`);
        }
      }
    }
  }
  for (const code of input.eligible) {
    const raw = (input.targets[code] ?? '').replace(',', '.').trim();
    const v = Number(raw);
    if (!raw || !Number.isFinite(v) || v <= 0) errs.push(`Informe a meta (kg/ha) de ${code}.`);
  }
  return [...new Set(errs)];
}

/** "1992015" (AAAADDD) -> "15/01/1992". null/0 -> null. */
export function yyyydddToBr(v: number | null | undefined): string | null {
  if (!v || v < 1000000) return null;
  const y = Math.floor(v / 1000);
  const doy = v % 1000;
  const dt = new Date(Date.UTC(y, 0, doy));
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${dt.getUTCFullYear()}`;
}

/** Número em kg/ha; null fica "sem dado" (zero continua zero). */
export function fmtKg(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return 'sem dado';
  return `${Math.round(v).toLocaleString('pt-BR')} kg/ha`;
}

export function fmtPct(fraction: number | null | undefined, digits = 0): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return 'sem dado';
  return `${(fraction * 100).toFixed(digits).replace('.', ',')}%`;
}

export function fmtSignedPct(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return 'sem dado';
  const r = Math.round(pct);
  return `${r > 0 ? '+' : ''}${r}%`;
}

export function cycleValue(c: RotationCycle, metric: string): number | null {
  return metric === 'biomass_kg_ha' ? c.biomass_kg_ha : c.yield_kg_ha;
}

const TEXTURE: Record<string, string> = {
  S: 'arenoso', LS: 'areia franca', SL: 'franco-arenoso', L: 'franco', SIL: 'franco-siltoso', SI: 'siltoso',
  SCL: 'franco-argilo-arenoso', CL: 'franco-argiloso', SICL: 'franco-argilo-siltoso', SC: 'argilo-arenoso',
  SIC: 'argilo-siltoso', C: 'argiloso',
};

/** Resumo do solo para leigo: textura, água disponível até 1 m, pH e matéria orgânica da superfície. */
export function soilSummary(layers: SoilLayer[] | undefined, textureTop?: string) {
  if (!layers || layers.length === 0) return null;
  let top = 0;
  let awcMm = 0;
  for (const L of layers) {
    const bottom = Math.min(L.SLB, 100);
    if (bottom > top && L.SDUL !== undefined && L.SLLL !== undefined) {
      awcMm += (L.SDUL - L.SLLL) * (bottom - top) * 10;
    }
    top = L.SLB;
    if (top >= 100) break;
  }
  const s = layers[0];
  return {
    texture: (textureTop && TEXTURE[textureTop]) || textureTop || 'não informado',
    waterMm1m: Math.round(awcMm),
    ph: s.SLHW ?? null,
    organicCarbonPct: s.SLOC ?? null,
    clayPct: s.SLCL ?? null,
    depthCm: layers[layers.length - 1].SLB,
    measured: layers.some((L) => (L.origem ?? '').startsWith('medido')),
  };
}
