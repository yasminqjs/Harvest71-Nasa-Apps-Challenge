import { requireOptionalNativeModule } from 'expo';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Speech from 'expo-speech';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { EdiblePlantPANC, FarmProperty, FarmerProfile, LanguageLevel } from '../types/domain';
import { regionalizarTexto } from '../utils/regionalize';

import { translate } from '../i18n/translate';
import type { Language } from '../i18n/Language';

export interface VoiceReply {
  intent:
    | 'agua'
    | 'plantar'
    | 'seca'
    | 'poco'
    | 'erosao'
    | 'futuro'
    | 'pancs'
    | 'resumo';
  titulo: string;
  texto: string;
}

let interfaceLanguage: Language = 'en';
export function setVoiceInterfaceLanguage(language: Language) {
  if (interfaceLanguage !== language) stopSpeaking();
  interfaceLanguage = language;
}

interface ActiveSpeechSession {
  fullText: string;
  language: string;
  baseOffset: number;
  lastCharIndex: number;
  rate: number;
  onDone?: () => void;
  startedAtMs: number;
  isSpeakingNow: boolean;
  pausedByBackground: boolean;
  utteranceId: number;
}

let activeSpeechSession: ActiveSpeechSession | null = null;
let speechResumeTimer: ReturnType<typeof setTimeout> | null = null;
let speechStartTimer: ReturnType<typeof setTimeout> | null = null;
let globalUtteranceCounter = 0;

let cachedNativeVoices: Speech.Voice[] = [];
let nativeVoicesLoaded = false;

if (Platform.OS !== 'web') {
  Speech.getAvailableVoicesAsync()
    .then((voices) => {
      cachedNativeVoices = voices;
      nativeVoicesLoaded = true;
    })
    .catch(() => {});
}

let cachedWebVoices: SpeechSynthesisVoice[] = [];

function refreshWebVoices(): SpeechSynthesisVoice[] {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return [];
  }
  try {
    const list = window.speechSynthesis.getVoices();
    if (list && list.length > 0) {
      cachedWebVoices = list;
    }
    return cachedWebVoices;
  } catch {
    return [];
  }
}

if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
  refreshWebVoices();
  try {
    window.speechSynthesis.addEventListener?.('voiceschanged', refreshWebVoices);
  } catch {
    // Some browsers only support property assignment or omit addEventListener
  }
}

function scoreVoiceQuality(nameRaw: string, langRaw: string, targetPrefix: 'en' | 'pt', isLocal?: boolean): number {
  const name = nameRaw.toLowerCase();
  const lang = langRaw.toLowerCase().replace('_', '-');
  let score = 0;

  if (targetPrefix === 'en') {
    if (lang === 'en-us') score += 45;
    else if (lang === 'en-gb') score += 30;
    else if (lang.startsWith('en-')) score += 20;
  } else {
    if (lang === 'pt-br') score += 45;
    else if (lang.startsWith('pt-')) score += 25;
  }

  if (/natural|online|neural|studio|enhanced|premium/.test(name)) score += 55;
  else if (/google/.test(name)) score += 32;
  if (/aria|jenny|guy|ava|andrew|emma|brian|samantha|allison|alex|karen|zira|david|mark/.test(name) && targetPrefix === 'en') score += 20;
  if (/francisca|antonio|thalita|fernanda|luciana|raquel|maria|daniel/.test(name) && targetPrefix === 'pt') score += 20;
  if (isLocal === true) score += 8;
  if (/espeak|compact|eloquence/.test(name)) score -= 40;

  return score;
}

function pickBestWebVoice(targetPrefix: 'en' | 'pt'): SpeechSynthesisVoice | null {
  const voices = refreshWebVoices();
  const matching = voices.filter((v) =>
    v.lang.toLowerCase().replace('_', '-').startsWith(targetPrefix)
  );
  if (matching.length === 0) return null;

  return [...matching].sort(
    (a, b) =>
      scoreVoiceQuality(b.name, b.lang, targetPrefix, b.localService) -
      scoreVoiceQuality(a.name, a.lang, targetPrefix, a.localService)
  )[0];
}

function pickBestNativeVoice(targetPrefix: 'en' | 'pt'): string | undefined {
  if (!nativeVoicesLoaded || cachedNativeVoices.length === 0) return undefined;
  const matching = cachedNativeVoices.filter((v) =>
    v.language.toLowerCase().replace('_', '-').startsWith(targetPrefix)
  );
  if (matching.length === 0) return undefined;
  const best = [...matching].sort(
    (a, b) =>
      scoreVoiceQuality(b.name || b.identifier, b.language, targetPrefix) -
      scoreVoiceQuality(a.name || a.identifier, a.language, targetPrefix)
  )[0];
  return best?.identifier;
}

function isLikelyPortugueseText(text: string): boolean {
  const ptMatches = text.match(
    /\b(não|você|para|com|pelo|pela|dos|das|uma|roça|chuva|plantação|fazenda|folha|umidade|hoje|ontem|amanhã|está|são|tem|foi|ser|mais|muito|entre|exibindo|relatos|milímetros|graus|quilômetros|agricultor|companheiro)\b/gi
  );
  const enMatches = text.match(
    /\b(the|and|with|for|your|crop|farm|plot|weather|today|rain|rainfall|soil|percent|humidity|millimeters|hectares|kilometers|degrees|overview|community|forecast|satellite|region)\b/gi
  );
  const ptCount = ptMatches?.length ?? 0;
  const enCount = enMatches?.length ?? 0;
  return ptCount >= 3 && ptCount > enCount * 1.5;
}

const PT_TO_EN_SPEECH_FALLBACKS: [RegExp, string][] = [
  [/\bmil[ií]metros\b/gi, 'millimeters'],
  [/\bquil[oô]metros\b/gi, 'kilometers'],
  [/\bhectares\b/gi, 'hectares'],
  [/\bhectare\b/gi, 'hectare'],
  [/\bsacas por hectare\b/gi, 'sacks per hectare'],
  [/\bquilos por hectare\b/gi, 'kilograms per hectare'],
  [/\bpor cento\b/gi, 'percent'],
  [/\bgraus Celsius\b/gi, 'degrees Celsius'],
  [/\bgraus\b/gi, 'degrees'],
  [/\bFeij[aã]o-[Cc]aupi\b/g, 'cowpea'],
  [/\bFeij[aã]o\b/g, 'beans'],
  [/\bMilho\b/g, 'corn'],
  [/\bMandioca\b/g, 'cassava'],
  [/\bSorgo\b/g, 'sorghum'],
  [/\bPalma\b/g, 'prickly pear'],
  [/\bSequeiro\b/gi, 'rainfed'],
  [/\bIrrigado\b/gi, 'irrigated'],
  [/\bpontos pretos\b/gi, 'black spots'],
  [/\bfolha verde\b/gi, 'green leaf'],
  [/\bfolha seca\b/gi, 'dry leaf'],
  [/\bamarelada\b/gi, 'yellowed'],
  [/\bsaud[aá]vel\b/gi, 'healthy'],
];

function translateAtom(segment: string): string {
  const trimmed = segment.trim();
  if (!trimmed) return '';

  const exact = translate(trimmed, 'en');
  if (exact !== trimmed) return exact;

  // Dictionary keys frequently omit trailing punctuation (e.g. alert titles joined with ". ")
  const m = trimmed.match(/^(.*?)([.!?]+)$/);
  if (m && m[1]) {
    const base = m[1].trim();
    const punct = m[2];
    const baseTranslated = translate(base, 'en');
    if (baseTranslated !== base) {
      const cleanedTarget = baseTranslated.replace(/[.!?]+$/, '');
      return `${cleanedTarget}${punct}`;
    }
  }

  let out = trimmed;
  for (const [pattern, replacement] of PT_TO_EN_SPEECH_FALLBACKS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function translateForSpeech(rawText: string): string {
  const direct = translate(rawText, 'en');
  if (direct !== rawText) return direct;

  const sentences = rawText
    .split(/(?<=[.!?])\s+|\s*\n+\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length === 0) return rawText;

  // Match multi-sentence dictionary entries (up to 3 sentences combined) before single sentences
  const translatedChunks: string[] = [];
  let i = 0;
  while (i < sentences.length) {
    let matched = false;
    const maxSpan = Math.min(3, sentences.length - i);
    for (let span = maxSpan; span >= 2; span--) {
      const combined = sentences.slice(i, i + span).join(' ');
      const t = translate(combined, 'en');
      if (t !== combined) {
        translatedChunks.push(t);
        i += span;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const seg = sentences[i];
    const single = translateAtom(seg);
    if (single !== seg) {
      translatedChunks.push(single);
    } else if (/[•|]/.test(seg)) {
      translatedChunks.push(
        seg
          .split(/\s*[•|]\s*/)
          .map((part) => translateAtom(part))
          .filter(Boolean)
          .join('. ')
      );
    } else {
      translatedChunks.push(single);
    }
    i += 1;
  }

  return translatedChunks.join(' ');
}

function prepareTextForSpeech(text: string, targetPrefix: 'en' | 'pt'): string {
  let out = text
    // Remove emojis and variation selectors so TTS doesn't spell symbol names awkwardly
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, ' ')
    .replace(/[•●▪▸►✓✔✕×]/g, ', ');

  if (targetPrefix === 'en') {
    out = out
      .replace(/(\d+),(\d+)/g, '$1.$2')
      .replace(/\bR\$\s*/g, 'Brazilian reais ')
      .replace(/\bsc\/ha\b/gi, 'sacks per hectare')
      .replace(/\bkg\/ha\b/gi, 'kilograms per hectare')
      .replace(/\bt\/ha\b/gi, 'tons per hectare')
      .replace(/\bg\/kg\b/gi, 'grams per kilogram')
      .replace(/°\s*C\b/g, ' degrees Celsius')
      .replace(/(\d+(?:\.\d+)?)\s*mm\b/gi, '$1 millimeters')
      .replace(/(\d+(?:\.\d+)?)\s*ha\b/gi, '$1 hectares')
      .replace(/(\d+(?:\.\d+)?)\s*km\b/gi, '$1 kilometers')
      .replace(/(\d+(?:\.\d+)?)\s*m\b/g, '$1 meters')
      .replace(/(\d+(?:\.\d+)?)\s*%/g, '$1 percent')
      .replace(/\bNASA\/FAO\b/g, 'NASA and FAO')
      .replace(/\bNASA\/USGS\b/g, 'NASA and USGS')
      .replace(/\bPOWER\/MERRA-2\b/g, 'POWER and MERRA 2')
      .replace(/\bIMERG\/POWER\/SMAP\b/g, 'IMERG, POWER, and SMAP')
      .replace(/\s*\/\s*/g, ', ');
  } else {
    out = out
      .replace(/\bsc\/ha\b/gi, 'sacas por hectare')
      .replace(/\bkg\/ha\b/gi, 'quilos por hectare')
      .replace(/\bt\/ha\b/gi, 'toneladas por hectare')
      .replace(/°\s*C\b/g, ' graus Celsius')
      .replace(/(\d+(?:[.,]\d+)?)\s*mm\b/gi, '$1 milímetros')
      .replace(/(\d+(?:[.,]\d+)?)\s*ha\b/gi, '$1 hectares')
      .replace(/(\d+(?:[.,]\d+)?)\s*km\b/gi, '$1 quilômetros')
      .replace(/(\d+(?:[.,]\d+)?)\s*m\b/g, '$1 metros');
  }

  return out
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/,{2,}/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function splitSpeechChunks(text: string, maxLen = 560): { text: string; offset: number }[] {
  const chunks: { text: string; offset: number }[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    while (cursor < text.length && /\s/.test(text[cursor])) cursor += 1;
    if (cursor >= text.length) break;

    if (text.length - cursor <= maxLen) {
      const tail = text.slice(cursor).trim();
      if (tail) chunks.push({ text: tail, offset: cursor });
      break;
    }

    const slice = text.slice(cursor, cursor + maxLen);
    let splitRel = -1;
    const punctMatch = slice.match(/.*[.!?](?=\s|$)/);
    if (punctMatch && punctMatch[0].length >= 40) {
      splitRel = punctMatch[0].length;
    } else {
      const commaIdx = slice.lastIndexOf(', ');
      if (commaIdx >= 50) {
        splitRel = commaIdx + 1;
      } else {
        const spaceIdx = slice.lastIndexOf(' ');
        splitRel = spaceIdx > 20 ? spaceIdx : maxLen;
      }
    }

    const chunkText = text.slice(cursor, cursor + splitRel).trim();
    if (chunkText) {
      chunks.push({ text: chunkText, offset: cursor });
    }
    cursor += Math.max(1, splitRel);
  }

  return chunks;
}

function snapToWordStart(text: string, idx: number): number {
  const clamped = Math.max(0, Math.min(idx, text.length));
  if (clamped === 0 || clamped >= text.length) return clamped;
  let pos = clamped;
  // Se parou no meio de uma palavra, volta para o início da palavra atual para retomar sem cortar sílaba
  while (pos > 0 && !/\s/.test(text[pos - 1])) {
    pos -= 1;
  }
  while (pos < text.length && /\s/.test(text[pos])) {
    pos += 1;
  }
  return pos;
}

function cancelEngineSpeech(): void {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    } else {
      Speech.stop();
    }
  } catch {
    // Ignora se TTS não estiver inicializado
  }
}

function startUtteranceFromSession(session: ActiveSpeechSession): void {
  const remaining = session.fullText.slice(session.baseOffset);
  if (!remaining.trim()) {
    const doneCb = session.onDone;
    if (activeSpeechSession === session) {
      activeSpeechSession = null;
    }
    doneCb?.();
    return;
  }

  const currentUtteranceId = ++globalUtteranceCounter;
  session.utteranceId = currentUtteranceId;
  session.lastCharIndex = session.baseOffset;
  session.startedAtMs = Date.now();
  session.isSpeakingNow = true;
  session.pausedByBackground = false;

  const isStale = () =>
    activeSpeechSession !== session ||
    session.utteranceId !== currentUtteranceId ||
    session.pausedByBackground;

  const targetPrefix: 'en' | 'pt' = session.language.toLowerCase().startsWith('en') ? 'en' : 'pt';
  // Web SAPI5 / browser TTS voices distort noticeably at rates slightly below 1.0 (e.g., 0.85 or 0.95).
  // Keep normal default cadence at native 1.0 on Web while still supporting explicit 0.75 slow mode.
  const effectiveRate =
    Platform.OS === 'web'
      ? session.rate >= 0.8 && session.rate <= 1.05
        ? 1.0
        : session.rate < 0.8
          ? 0.85
          : session.rate
      : session.rate;

  // On Web, drive window.speechSynthesis directly so we can pin a matching en-US / pt-BR voice
  // and read sentence-by-sentence instead of hitting Windows/Chrome default pt-BR fallback.
  if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      const synth = window.speechSynthesis;
      const pickedVoice = pickBestWebVoice(targetPrefix);
      const chunks = splitSpeechChunks(remaining);
      if (chunks.length === 0) {
        const doneCb = session.onDone;
        activeSpeechSession = null;
        doneCb?.();
        return;
      }

      const speakChunkAt = (chunkIdx: number) => {
        if (isStale()) return;
        if (chunkIdx >= chunks.length) {
          const doneCb = session.onDone;
          activeSpeechSession = null;
          doneCb?.();
          return;
        }

        const chunk = chunks[chunkIdx];
        const utt = new SpeechSynthesisUtterance(chunk.text);
        utt.lang = pickedVoice?.lang || session.language;
        if (pickedVoice) {
          utt.voice = pickedVoice;
        }
        utt.rate = effectiveRate;
        utt.pitch = 1.0;

        utt.onboundary = (ev) => {
          if (isStale()) return;
          if (typeof ev.charIndex === 'number' && ev.charIndex >= 0) {
            session.lastCharIndex = Math.max(
              session.lastCharIndex,
              session.baseOffset + chunk.offset + ev.charIndex
            );
          }
        };

        utt.onend = () => {
          if (isStale()) return;
          session.lastCharIndex = session.baseOffset + chunk.offset + chunk.text.length;
          speakChunkAt(chunkIdx + 1);
        };

        utt.onerror = () => {
          if (isStale()) return;
          const doneCb = session.onDone;
          activeSpeechSession = null;
          doneCb?.();
        };

        synth.speak(utt);
      };

      speakChunkAt(0);
      return;
    } catch {
      // Fallback to expo-speech below if SpeechSynthesisUtterance fails
    }
  }

  const nativeVoice = pickBestNativeVoice(targetPrefix);
  try {
    Speech.speak(remaining, {
      language: session.language,
      voice: nativeVoice,
      rate: effectiveRate,
      pitch: 1.0,
      onBoundary: (ev: { charIndex?: number }) => {
        if (isStale()) return;
        const idx = typeof ev?.charIndex === 'number' ? ev.charIndex : -1;
        if (idx >= 0) {
          session.lastCharIndex = Math.max(
            session.lastCharIndex,
            session.baseOffset + idx
          );
        }
      },
      onDone: () => {
        if (isStale()) return;
        const doneCb = session.onDone;
        activeSpeechSession = null;
        doneCb?.();
      },
      onStopped: () => {
        if (isStale()) return;
        activeSpeechSession = null;
      },
      onError: () => {
        if (isStale()) return;
        const doneCb = session.onDone;
        activeSpeechSession = null;
        doneCb?.();
      },
    });
  } catch {
    if (!isStale()) {
      const doneCb = session.onDone;
      activeSpeechSession = null;
      doneCb?.();
    }
  }
}

export function pauseSpeechForBackground(): void {
  if (speechResumeTimer) {
    clearTimeout(speechResumeTimer);
    speechResumeTimer = null;
  }
  if (speechStartTimer) {
    clearTimeout(speechStartTimer);
    speechStartTimer = null;
  }
  const session = activeSpeechSession;
  if (!session || session.pausedByBackground || !session.isSpeakingNow) return;

  // Invalida utterance atual ANTES do stop() para o callback assíncrono não descartar a sessão
  globalUtteranceCounter += 1;
  session.utteranceId = globalUtteranceCounter;
  session.pausedByBackground = true;
  session.isSpeakingNow = false;

  let nextOffset = session.lastCharIndex;
  if (nextOffset <= session.baseOffset) {
    const elapsedSec = Math.max(0, (Date.now() - session.startedAtMs) / 1000);
    const estChars = Math.floor(elapsedSec * (13.5 * Math.max(0.5, session.rate)));
    nextOffset = session.baseOffset + estChars;
  }

  session.baseOffset = snapToWordStart(session.fullText, nextOffset);
  cancelEngineSpeech();
}

export function resumeSpeechFromBackground(): void {
  const session = activeSpeechSession;
  if (!session || !session.pausedByBackground) return;
  if (speechResumeTimer) {
    clearTimeout(speechResumeTimer);
  }
  const resumeToken = session.utteranceId;
  speechResumeTimer = setTimeout(() => {
    speechResumeTimer = null;
    if (
      activeSpeechSession !== session ||
      !session.pausedByBackground ||
      session.utteranceId !== resumeToken
    ) {
      return;
    }
    startUtteranceFromSession(session);
  }, 140);
}

/**
 * Sincroniza leitura de voz com segundo/primeiro plano tanto no APK (AppState)
 * quanto na Web (AppState + visibilitychange / pagehide).
 */
export function initSpeechBackgroundSync(): () => void {
  const handleAppState = (nextState: AppStateStatus) => {
    if (nextState === 'background' || nextState === 'inactive') {
      pauseSpeechForBackground();
    } else if (nextState === 'active') {
      resumeSpeechFromBackground();
    }
  };

  const appSub = AppState.addEventListener('change', handleAppState);

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const handleVisibility = () => {
      if (document.hidden || document.visibilityState === 'hidden') {
        pauseSpeechForBackground();
      } else if (document.visibilityState === 'visible') {
        resumeSpeechFromBackground();
      }
    };
    const handlePageHide = () => {
      pauseSpeechForBackground();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      appSub.remove();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }

  return () => {
    appSub.remove();
  };
}

export function stopSpeaking(): void {
  if (speechResumeTimer) {
    clearTimeout(speechResumeTimer);
    speechResumeTimer = null;
  }
  if (speechStartTimer) {
    clearTimeout(speechStartTimer);
    speechStartTimer = null;
  }
  globalUtteranceCounter += 1;
  activeSpeechSession = null;
  cancelEngineSpeech();
}

export function speakText(
  rawText: string,
  options: {
    enabled?: boolean;
    rate?: number;
    languageLevel?: LanguageLevel;
    tratamento?: string;
    force?: boolean;
    onDone?: () => void;
  } = {}
): void {
  const {
    enabled = true,
    rate = 0.85,
    languageLevel = 'acessivel',
    tratamento,
    force = false,
    onDone,
  } = options;

  if (!enabled && !force) return;

  const translatedOrRegional = (
    interfaceLanguage === 'en'
      ? translateForSpeech(rawText)
      : regionalizarTexto(rawText, languageLevel, tratamento)
  ).trim();

  const resolvedPrefix: 'en' | 'pt' =
    interfaceLanguage === 'en' && isLikelyPortugueseText(translatedOrRegional)
      ? 'pt'
      : interfaceLanguage === 'en'
        ? 'en'
        : 'pt';

  const textoFinal = prepareTextForSpeech(translatedOrRegional, resolvedPrefix);
  if (!textoFinal) {
    onDone?.();
    return;
  }

  const wasSpeakingWeb =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    (window.speechSynthesis.speaking || window.speechSynthesis.pending);

  stopSpeaking();

  const session: ActiveSpeechSession = {
    fullText: textoFinal,
    language: resolvedPrefix === 'en' ? 'en-US' : 'pt-BR',
    baseOffset: 0,
    lastCharIndex: 0,
    rate,
    onDone,
    startedAtMs: Date.now(),
    isSpeakingNow: false,
    pausedByBackground: false,
    utteranceId: ++globalUtteranceCounter,
  };
  activeSpeechSession = session;

  if (Platform.OS === 'web' || wasSpeakingWeb) {
    // Allow Chrome/Edge speechSynthesis.cancel() a brief tick to flush audio buffers cleanly
    const token = session.utteranceId;
    speechStartTimer = setTimeout(() => {
      speechStartTimer = null;
      if (activeSpeechSession !== session || session.utteranceId !== token) return;
      startUtteranceFromSession(session);
    }, 55);
    return;
  }

  startUtteranceFromSession(session);
}

export type YesNoVoiceIntent = 'sim' | 'nao' | 'repetir' | 'desconhecido';

export function interpretYesNoVoiceReply(transcript: string): YesNoVoiceIntent {
  const norm = transcript
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!norm) return 'desconhecido';

  if (
    norm.includes('nao entendi') ||
    /\b(repeat|again|pardon|sorry|what)\b|say it again/.test(norm) ||
    norm.includes('repet') ||
    norm.includes('de novo') ||
    norm.includes('outra vez') ||
    norm.includes('ouvir')
  ) {
    return 'repetir';
  }

  if (
    /\b(nao|no|nope|nah|never|not|skip|mute|disable|off)\b|without voice|keep reading|turn off/.test(norm) ||
    norm.includes('sem voz') ||
    norm.includes('silencioso') ||
    norm.includes('so ler') ||
    norm.includes('apenas ler') ||
    norm.includes('apenas lendo') ||
    norm.includes('continuar lendo') ||
    norm.includes('mudo') ||
    norm.includes('dispenso') ||
    norm.includes('desativar') ||
    norm.includes('negativo')
  ) {
    return 'nao';
  }

  if (
    /\b(sim|yes|yeah|yep|yup|yea|sure|ok|okay|aye|enable|on)\b|enable voice|turn on|go ahead|of course/.test(norm) ||
    /\bquero\b/.test(norm) ||
    /\bpode\b/.test(norm) ||
    norm.includes('ativar') ||
    norm.includes('ativa') ||
    norm.includes('liga') ||
    norm.includes('aceito') ||
    norm.includes('claro') ||
    norm.includes('com certeza') ||
    norm.includes('uhum') ||
    norm.includes('positivo') ||
    norm.includes('beleza') ||
    norm.includes('ajuda') ||
    norm.includes('leitura') ||
    /\bvoz\b/.test(norm)
  ) {
    return 'sim';
  }

  return 'desconhecido';
}

export function answerFarmerVoiceQuery(
  query: string,
  farm: FarmProperty,
  farmer: FarmerProfile,
  pancs: EdiblePlantPANC[],
  level: LanguageLevel
): VoiceReply {
  const q = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const d = farm.diagnostico;
  const en = interfaceLanguage === 'en';
  const formatReply = (text: string) => {
    if (!en) return regionalizarTexto(text, level, farmer.tratamento);
    const translated = translate(text, 'en');
    return translated !== text ? translated : text.split(/(?<=[.!?])\s+/).map((part) => translate(part, 'en')).join(' ');
  };

  if (q.includes('water') || q.includes('agua') || q.includes('falta') || q.includes('molh') || q.includes('irriga')) {
    const raw =
      level === 'acessivel' ? d.modeloA.resumoAcessivel : d.modeloA.resumoTecnico;
    return {
      intent: 'agua',
      titulo: en ? 'Water for the field' : 'Água para a roça',
      texto: formatReply(raw),
    };
  }

  if (
    q.includes('plant') ||
    q.includes('seme') ||
    q.includes('quando') ||
    q.includes('veranico') ||
    q.includes('rotacao') ||
    q.includes('colh')
  ) {
    const raw = `${d.modeloC.titulo}. ${
      level === 'acessivel'
        ? d.modeloC.explicacaoAcessivel
        : d.modeloC.explicacaoTecnica
    }`;
    return {
      intent: 'plantar',
      titulo: en ? 'Planting window' : 'Janela de plantio',
      texto: formatReply(raw),
    };
  }

  if (
    q.includes('drought') || q.includes('seca') ||
    q.includes('estiagem') ||
    q.includes('alerta') ||
    q.includes('chuv') ||
    q.includes('tempo') ||
    q.includes('previs')
  ) {
    const raw =
      level === 'acessivel' ? d.modeloB.resumoAcessivel : d.modeloB.resumoTecnico;
    return {
      intent: 'seca',
      titulo: en ? 'Drought & rainfall risk' : 'Risco de seca e chuva',
      texto: formatReply(raw),
    };
  }

  if (q.includes('well') || q.includes('poco') || q.includes('furar') || q.includes('subterr') || q.includes('cacimba')) {
    const w = d.wellSummary;
    if (en) {
      return {
        intent: 'poco',
        titulo: 'Where to drill a well (SIAGAS + NASA)',
        texto: `In wells within ${farm.raioBuscaKm} kilometers, depth ranges from ${w.faixaProfundidadeMinM} to ${w.faixaProfundidadeMaxM} meters, with a ${w.taxaSucessoPct}% chance of water and ${translate(w.riscoSalinidade, 'en')} brackish-water risk. ${translate(w.orientacaoBaixaRenda, 'en')}`,
      };
    }
    const raw = `Nos poços da região em até ${farm.raioBuscaKm} quilômetros, a profundidade varia de ${w.faixaProfundidadeMinM} a ${w.faixaProfundidadeMaxM} metros, com ${w.taxaSucessoPct}% de chance de dar água e risco ${w.riscoSalinidade} de água salobra. ${w.orientacaoBaixaRenda}`;
    return {
      intent: 'poco',
      titulo: 'Onde furar poço (SIAGAS + NASA)',
      texto: formatReply(raw),
    };
  }

  if (q.includes('eros') || q.includes('lavar') || q.includes('enxurrada') || q.includes('soil') || q.includes('solo') || q.includes('terra')) {
    const solo = d.soloSoilGrids;
    if (en) {
      return {
        intent: 'erosao',
        titulo: 'Soil & erosion risk',
        texto: `${formatReply(level === 'acessivel' ? d.modeloD.resumoAcessivel : d.modeloD.resumoTecnico)} Your plot soil has ${translate(solo.textura, 'en')} texture, pH ${solo.ph}, and organic carbon ${solo.carbonoOrganicoGKg} g/kg.`,
      };
    }
    const raw = `${
      level === 'acessivel' ? d.modeloD.resumoAcessivel : d.modeloD.resumoTecnico
    } O solo da sua área tem textura ${solo.textura}, pH ${solo.ph} e carbono orgânico ${solo.carbonoOrganicoGKg} g/kg.`;
    return {
      intent: 'erosao',
      titulo: 'Solo e risco de erosão',
      texto: formatReply(raw),
    };
  }

  if (q.includes('future') || q.includes('climate') || q.includes('futuro') || q.includes('2030') || q.includes('2050') || q.includes('clima')) {
    const raw =
      level === 'acessivel' ? d.modeloE.resumoAcessivel : d.modeloE.resumoTecnico;
    return {
      intent: 'futuro',
      titulo: en ? '2030–2050 climate outlook' : 'Projeção 2030–2050',
      texto: formatReply(raw),
    };
  }

  if (
    q.includes('comer') ||
    q.includes('panc') ||
    q.includes('alimento') ||
    q.includes('fome') ||
    q.includes('palma') ||
    q.includes('umbu') ||
    q.includes('mandacaru') ||
    q.includes('sorgo') ||
    q.includes('resistent')
  ) {
    const topNames = pancs
      .slice(0, 3)
      .map((p) => (en ? translate(p.nomePopular, 'en') : p.nomePopular))
      .join(', ');
    if (en) {
      return {
        intent: 'pancs',
        titulo: 'Drought-resilient food crops',
        texto: `To help secure reliable food even during dry spells, the offline catalog recommends for your soil: ${topNames}.`,
      };
    }
    const raw = `Para garantir comida forte mesmo na seca, o catálogo offline indica para o solo da sua terra: ${topNames}.`;
    return {
      intent: 'pancs',
      titulo: 'Plantas comestíveis resistentes',
      texto: formatReply(raw),
    };
  }

  if (en) {
    return {
      intent: 'resumo',
      titulo: 'Overall farm summary',
      texto: `Today in ${farm.regiaoNome} temperatures reach up to ${d.climaDia.tempMaxC} degrees. ${formatReply(d.modeloB.resumoAcessivel)} ${d.rotacaoAtual.diasRestantes} days remaining until harvest of ${translate(d.rotacaoAtual.culturas, 'en')}.`,
    };
  }
  const fallback = `Hoje em ${farm.regiaoNome} faz até ${d.climaDia.tempMaxC} graus. ${d.modeloB.resumoAcessivel} Faltam ${d.rotacaoAtual.diasRestantes} dias para colher ${d.rotacaoAtual.culturas}.`;
  return {
    intent: 'resumo',
    titulo: 'Resumo geral da roça',
    texto: formatReply(fallback),
  };
}

export function isRunningInExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

function getOptionalSpeechRecognitionLib(): typeof import('expo-speech-recognition') | null {
  if (Platform.OS === 'web') return null;
  try {
    const nativeMod = requireOptionalNativeModule('ExpoSpeechRecognition');
    if (!nativeMod) return null;
    // Carregamento dinâmico apenas quando o módulo nativo existe (Development Build / APK)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-speech-recognition') as typeof import('expo-speech-recognition');
  } catch {
    return null;
  }
}

interface WebSpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous?: boolean;
  onstart?: () => void;
  onaudiostart?: () => void;
  onsoundstart?: () => void;
  onspeechstart?: () => void;
  onnomatch?: () => void;
  onresult: (e: {
    results: ArrayLike<{
      isFinal?: boolean;
      length: number;
      [idx: number]: { transcript: string } | undefined;
    }>;
  }) => void;
  onerror: (e: { error?: string }) => void;
  onend?: () => void;
  start: () => void;
  stop: () => void;
  abort?: () => void;
}

function mapWebSpeechError(errCode: string): string {
  const en = interfaceLanguage === 'en';
  switch (errCode) {
    case 'not-allowed':
    case 'service-not-allowed':
      return en
        ? 'Microphone permission denied. Allow microphone access in your browser or tap one of the buttons below.'
        : 'Permissão do microfone negada. Libere o microfone no navegador ou toque em um dos botões abaixo.';
    case 'no-speech':
      return en
        ? 'No speech heard. Tap the microphone and say "Yes" or "No" closer to the mic.'
        : 'Não ouvi nenhuma fala. Toque no microfone e fale "Sim" ou "Não" mais perto.';
    case 'audio-capture':
      return en
        ? 'No active microphone detected, or another app is using the microphone.'
        : 'Nenhum microfone ativo foi detectado ou outro aplicativo está usando o microfone.';
    case 'network':
      return en
        ? 'Your browser could not reach online speech recognition (network or privacy block). Try Chrome or Edge with internet, or tap the buttons below.'
        : 'O navegador não conseguiu acessar o reconhecimento de voz online (rede ou bloqueio de privacidade). Tente no Chrome/Edge com internet ou toque nos botões abaixo.';
    case 'aborted':
      return en
        ? 'Listening was interrupted before capturing speech. Tap the microphone to try again.'
        : 'A escuta foi interrompida antes de capturar a fala. Toque no microfone para tentar novamente.';
    case 'language-not-supported':
      return en
        ? 'Speech recognition in this browser does not support the selected language. Use the on-screen controls.'
        : 'O reconhecimento de voz deste navegador não oferece o idioma selecionado. Use os controles na tela.';
    default:
      return en
        ? `Could not access the microphone (${errCode || 'unknown error'}). Try again or tap the buttons below.`
        : `Não foi possível ouvir o microfone (${errCode || 'erro desconhecido'}). Tente novamente ou toque em um dos botões.`;
  }
}

export function startVoiceCapture(
  onResult: (transcript: string) => void,
  onError: (message: string) => void,
  options: {
    onEnd?: () => void;
    onInterim?: (transcript: string) => void;
    onStatus?: (status: string) => void;
    onExpoGoFallback?: () => void;
    unsupportedMessage?: string;
  } = {}
): () => void {
  const en = interfaceLanguage === 'en';
  const {
    onEnd,
    onInterim,
    onStatus,
    onExpoGoFallback,
    unsupportedMessage = en
      ? 'Expo Go does not include the native speech recognition engine. Use your phone keyboard microphone below, or build a Development Build (eas build).'
      : 'O Expo Go não inclui o motor de reconhecimento de voz nativo. Use o microfone (🎤) do teclado do celular abaixo, ou gere um Development Build (eas build).',
  } = options;

  stopSpeaking();
  const recognitionLocale = interfaceLanguage === 'en' ? 'en-US' : 'pt-BR';

  // 1) Web (Chrome / Edge / Safari via Web Speech API)
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.isSecureContext === false) {
      onError(
        en
          ? 'To use the microphone on the web, open this app over http://localhost or HTTPS.'
          : 'Para usar o microfone na Web, acesse por http://localhost ou HTTPS.'
      );
      onEnd?.();
      return () => {};
    }

    const win = window as unknown as Record<string, unknown>;
    const SpeechRec = (win.SpeechRecognition || win.webkitSpeechRecognition) as
      | (new () => WebSpeechRecognitionInstance)
      | undefined;

    if (!SpeechRec) {
      onError(
        en
          ? 'Speech recognition is not supported in this browser. Use Google Chrome or Microsoft Edge, or tap an option below.'
          : 'O reconhecimento de voz não é suportado neste navegador. Use Google Chrome ou Microsoft Edge, ou toque em uma opção abaixo.'
      );
      onEnd?.();
      return () => {};
    }

    let cancelled = false;
    let finished = false;
    let deliveredResult = false;
    let recStarted = false;
    let audioStarted = false;
    let speechStarted = false;
    let latestTranscript = '';
    let activeRec: WebSpeechRecognitionInstance | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let startTimer: ReturnType<typeof setTimeout> | null = null;
    let audioWatchdog: ReturnType<typeof setTimeout> | null = null;
    let listenTimeout: ReturnType<typeof setTimeout> | null = null;
    let silenceCommitTimer: ReturnType<typeof setTimeout> | null = null;
    let retriedAudio = false;
    let retriedLang = false;

    const clearTimers = () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (startTimer) {
        clearTimeout(startTimer);
        startTimer = null;
      }
      if (audioWatchdog) {
        clearTimeout(audioWatchdog);
        audioWatchdog = null;
      }
      if (listenTimeout) {
        clearTimeout(listenTimeout);
        listenTimeout = null;
      }
      if (silenceCommitTimer) {
        clearTimeout(silenceCommitTimer);
        silenceCommitTimer = null;
      }
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimers();
      onEnd?.();
    };

    const deliverFinal = (text: string, recToStop?: WebSpeechRecognitionInstance | null) => {
      const cleaned = text.trim();
      if (!cleaned || cancelled || deliveredResult) return;
      deliveredResult = true;
      clearTimers();
      onResult(cleaned);
      try {
        recToStop?.stop();
      } catch {
        // ignore
      }
      finish();
    };

    const diagnoseMicrophoneFailure = async () => {
      const nav = typeof navigator !== 'undefined'
        ? (navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } })
        : undefined;
      let isBrave = false;
      try {
        if (nav?.brave?.isBrave) {
          isBrave = await nav.brave.isBrave();
        }
      } catch {
        isBrave = false;
      }

      let micLabel = '';
      if (nav?.mediaDevices?.getUserMedia) {
        try {
          const stream = await nav.mediaDevices.getUserMedia({ audio: true });
          const tracks = stream.getAudioTracks();
          micLabel = tracks.find((t) => t.label)?.label ?? '';
          const hasLiveTrack = tracks.some((t) => t.readyState === 'live' && t.enabled);
          tracks.forEach((t) => t.stop());
          if (cancelled || finished) return;

          if (!hasLiveTrack) {
            onError(mapWebSpeechError('audio-capture'));
            finish();
            return;
          }

          if (isBrave) {
            onError(
              en
                ? `Microphone "${micLabel || 'default'}" works, but Brave blocks the browser Speech-to-Text service (Web Speech API). Open in Google Chrome or Microsoft Edge, or tap a button below.`
                : `O microfone "${micLabel || 'padrão'}" funciona, mas o Brave bloqueia o serviço de voz do navegador (Web Speech API). Abra no Google Chrome ou Microsoft Edge, ou toque em um botão abaixo.`
            );
            finish();
            return;
          }

          onError(
            en
              ? `Microphone "${micLabel || 'default'}" is permitted and connected, but this browser's speech engine did not start capture${recStarted ? '' : ' (onstart did not fire)'}. Try Chrome/Edge with internet or tap a button below.`
              : `O microfone "${micLabel || 'padrão'}" está conectado e liberado, mas o motor de voz deste navegador não iniciou a captura${recStarted ? '' : ' (sem resposta)'}. Use Chrome/Edge com internet ou toque em um botão abaixo.`
          );
          finish();
          return;
        } catch (permErr: unknown) {
          if (cancelled || finished) return;
          const errName = (permErr as { name?: string })?.name ?? '';
          if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
            onError(mapWebSpeechError('not-allowed'));
          } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
            onError(mapWebSpeechError('audio-capture'));
          } else {
            onError(
              en
                ? 'Could not activate browser microphone for speech recognition. Check browser permissions or use Chrome/Edge over localhost/HTTPS.'
                : 'Não foi possível ativar o microfone no navegador para reconhecimento de voz. Confira as permissões ou use Chrome/Edge em localhost/HTTPS.'
            );
          }
          finish();
          return;
        }
      }

      if (!cancelled && !finished) {
        onError(
          en
            ? 'Browser speech recognition could not open the microphone. Try Chrome or Edge, or tap an option below.'
            : 'O reconhecimento de voz do navegador não conseguiu abrir o microfone. Use Chrome ou Edge, ou toque em uma opção abaixo.'
        );
        finish();
      }
    };

    const startAttempt = (langToUse: string) => {
      if (cancelled || finished) return;
      clearTimers();
      recStarted = false;
      audioStarted = false;
      speechStarted = false;
      try {
        const rec = new SpeechRec();
        activeRec = rec;
        latestTranscript = '';
        if (langToUse) rec.lang = langToUse;
        rec.interimResults = true;
        rec.maxAlternatives = 3;
        rec.continuous = false;

        rec.onstart = () => {
          if (cancelled || finished) return;
          recStarted = true;
          onStatus?.(
            en
              ? 'Connecting microphone...'
              : 'Conectando ao microfone...'
          );
        };

        rec.onaudiostart = () => {
          if (cancelled || finished) return;
          audioStarted = true;
          if (audioWatchdog) {
            clearTimeout(audioWatchdog);
            audioWatchdog = null;
          }
          onStatus?.(
            en
              ? 'Microphone active — speak now...'
              : 'Microfone ativo — pode falar agora...'
          );
        };

        rec.onsoundstart = () => {
          if (cancelled || finished) return;
          audioStarted = true;
        };

        rec.onspeechstart = () => {
          if (cancelled || finished) return;
          speechStarted = true;
          onStatus?.(
            en ? 'Voice detected — listening...' : 'Voz detectada — ouvindo...'
          );
        };

        rec.onnomatch = () => {
          if (cancelled || finished || deliveredResult) return;
          if (latestTranscript) {
            deliverFinal(latestTranscript, rec);
            return;
          }
          onError(mapWebSpeechError('no-speech'));
          finish();
        };

        rec.onresult = (event) => {
          if (cancelled || deliveredResult) return;
          let combined = '';
          let hasFinal = false;
          for (let i = 0; i < event.results.length; i++) {
            const item = event.results[i];
            const part = item?.[0]?.transcript ?? '';
            if (part) combined = combined ? `${combined} ${part}` : part;
            if (item?.isFinal) hasFinal = true;
          }
          const cleaned = combined.trim();
          if (cleaned) {
            latestTranscript = cleaned;
            onInterim?.(cleaned);
          }
          if (hasFinal && cleaned) {
            deliverFinal(cleaned, rec);
            return;
          }
          if (cleaned) {
            if (silenceCommitTimer) clearTimeout(silenceCommitTimer);
            silenceCommitTimer = setTimeout(() => {
              if (!cancelled && !finished && !deliveredResult && latestTranscript) {
                deliverFinal(latestTranscript, rec);
              }
            }, 1100);
          }
        };

        rec.onerror = (event) => {
          if (cancelled || finished || deliveredResult) return;
          const errCode = event?.error ?? '';

          if (errCode === 'language-not-supported' && !retriedLang) {
            retriedLang = true;
            startAttempt(langToUse === recognitionLocale ? recognitionLocale.split('-')[0] : '');
            return;
          }

          if ((errCode === 'aborted' || errCode === 'audio-capture') && !retriedAudio) {
            retriedAudio = true;
            retryTimer = setTimeout(() => {
              if (!cancelled && !finished) startAttempt(langToUse);
            }, 250);
            return;
          }

          onError(mapWebSpeechError(errCode));
          finish();
        };

        rec.onend = () => {
          if (cancelled || finished) return;
          if (!deliveredResult && latestTranscript) {
            deliverFinal(latestTranscript, null);
            return;
          }
          if (!deliveredResult) {
            onError(
              speechStarted
                ? en
                  ? 'Voice was detected, but the browser could not transcribe it. Try Chrome/Edge with internet or tap an option below.'
                  : 'O áudio foi detectado, mas o navegador não conseguiu transcrever. Use Chrome/Edge com internet ou toque em uma opção abaixo.'
                : en
                ? 'No voice detected from the microphone. Check your browser/Windows default microphone or tap an option below.'
                : 'Nenhuma voz foi captada pelo microfone. Confira o microfone padrão do navegador/Windows ou toque em uma opção abaixo.'
            );
          }
          finish();
        };

        audioWatchdog = setTimeout(() => {
          if (cancelled || finished || deliveredResult || audioStarted) return;
          try {
            rec.abort?.();
          } catch {
            // ignore
          }
          void diagnoseMicrophoneFailure();
        }, 3200);

        listenTimeout = setTimeout(() => {
          if (cancelled || finished || deliveredResult) return;
          if (latestTranscript) {
            deliverFinal(latestTranscript, rec);
            return;
          }
          try {
            rec.stop();
          } catch {
            // ignore
          }
          onError(
            speechStarted
              ? en
                ? 'Audio reached the microphone, but speech recognition did not return text. Try Chrome/Edge or tap a button below.'
                : 'O áudio chegou ao microfone, mas o reconhecimento não retornou texto. Tente Chrome/Edge ou toque em um botão abaixo.'
              : en
              ? 'Microphone is active, but no sound was recognized. Check your default input device or speak closer.'
              : 'Microfone ativo, mas nenhum som foi reconhecido. Confira seu microfone padrão ou fale mais perto.'
          );
          finish();
        }, 10500);

        rec.start();
      } catch {
        onError(
          en
            ? 'Microphone unavailable in this browser. Tap one of the options below.'
            : 'Microfone indisponível neste navegador. Toque em uma das opções abaixo.'
        );
        finish();
      }
    };

    // Inicia de forma síncrona dentro do clique para manter ativação de usuário e não conflitar com getUserMedia
    startAttempt(recognitionLocale);

    return () => {
      cancelled = true;
      clearTimers();
      try {
        activeRec?.abort?.();
        activeRec?.stop();
      } catch {
        // ignore
      }
      finish();
    };
  }

  // 2) Nativo Android/iOS quando compilado em Development Build / APK (expo-speech-recognition)
  if (Platform.OS !== 'web') {
    const speechLib = getOptionalSpeechRecognitionLib();
    if (speechLib?.ExpoSpeechRecognitionModule) {
      const mod = speechLib.ExpoSpeechRecognitionModule;
      let cancelled = false;
      let finished = false;
      let deliveredResult = false;
      let latestTranscript = '';
      let startTimer: ReturnType<typeof setTimeout> | null = null;
      const subscriptions: { remove: () => void }[] = [];

      const cleanup = () => {
        if (finished) return;
        finished = true;
        if (startTimer) {
          clearTimeout(startTimer);
          startTimer = null;
        }
        for (const sub of subscriptions) {
          try {
            sub.remove();
          } catch {
            // ignore
          }
        }
        subscriptions.length = 0;
        onEnd?.();
      };

      void (async () => {
        try {
          const perm = await mod.requestPermissionsAsync();
          if (cancelled) return;
          if (!perm.granted) {
            onError('Permissão de microfone negada no aparelho. Libere nas configurações ou toque nos botões.');
            cleanup();
            return;
          }

          if (typeof mod.isRecognitionAvailable === 'function' && !mod.isRecognitionAvailable()) {
            onError(
              en
                ? 'Android voice service is unavailable on this device. Enable Google voice typing or tap the buttons.'
                : 'Serviço de voz do Android indisponível neste aparelho. Ative o Google/Digitação por voz ou toque nos botões.'
            );
            cleanup();
            return;
          }

          subscriptions.push(
            mod.addListener('result', (event) => {
              if (cancelled || deliveredResult) return;
              const text = event.results?.[0]?.transcript?.trim();
              if (text) latestTranscript = text;
              if (text && event.isFinal) {
                deliveredResult = true;
                onResult(text);
                cleanup();
              }
            }),
            mod.addListener('error', (event) => {
              if (cancelled || finished) return;
              if (!deliveredResult && latestTranscript) {
                deliveredResult = true;
                onResult(latestTranscript);
                cleanup();
                return;
              }
              const err = String(event.error ?? '');
              if (err === 'no-speech') {
                onError(
                  en
                    ? 'No speech heard. Try again closer to the microphone.'
                    : 'Não ouvi nenhuma fala. Tente novamente mais perto do microfone.'
                );
              } else if (err === 'not-allowed' || err === 'permissions') {
                onError(
                  en
                    ? 'Microphone permission denied. Enable it in device settings.'
                    : 'Permissão do microfone negada. Libere nas configurações do aparelho.'
                );
              } else if (err === 'audio' || err === 'audio-capture') {
                onError(
                  en
                    ? 'Could not access the device microphone right now. Check if another app is recording.'
                    : 'Não foi possível acessar o microfone do aparelho agora. Verifique se outro app não está gravando.'
                );
              } else if (err === 'network') {
                onError(
                  en
                    ? 'Voice recognition cannot reach the speech service. Check your connection or use the buttons.'
                    : 'Reconhecimento de voz sem conexão com o serviço de voz. Verifique a internet ou use os botões.'
                );
              } else {
                onError(
                  en
                    ? 'Could not capture speech right now. Try again or use the buttons.'
                    : 'Não foi possível capturar a fala agora. Tente de novo ou use os botões.'
                );
              }
              cleanup();
            }),
            mod.addListener('end', () => {
              if (cancelled || finished) return;
              if (!deliveredResult && latestTranscript) {
                deliveredResult = true;
                onResult(latestTranscript);
              }
              cleanup();
            })
          );

          startTimer = setTimeout(() => {
            if (cancelled || finished) return;
            try {
              mod.start({
                lang: recognitionLocale,
                interimResults: true,
                maxAlternatives: 3,
                continuous: false,
              });
            } catch {
              onError(en ? 'Failed to start native microphone.' : 'Falha ao iniciar o microfone nativo.');
              cleanup();
            }
          }, 180);
        } catch {
          onError(en ? 'Failed to start native microphone.' : 'Falha ao iniciar o microfone nativo.');
          cleanup();
        }
      })();

      return () => {
        cancelled = true;
        if (startTimer) {
          clearTimeout(startTimer);
          startTimer = null;
        }
        try {
          mod.stop();
        } catch {
          // ignore
        }
        cleanup();
      };
    }

    // Expo Go (StoreClient): o app padrão da loja não inclui o módulo nativo ExpoSpeechRecognition
    onExpoGoFallback?.();
    onError(unsupportedMessage);
    onEnd?.();
    return () => {};
  }

  onError(unsupportedMessage);
  onEnd?.();
  return () => {};
}
