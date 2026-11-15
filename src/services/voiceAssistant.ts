import { requireOptionalNativeModule } from 'expo';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Speech from 'expo-speech';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { EdiblePlantPANC, FarmProperty, FarmerProfile, LanguageLevel } from '../types/domain';
import { regionalizarTexto } from '../utils/regionalize';

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

interface ActiveSpeechSession {
  fullText: string;
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
    Speech.stop();
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
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

  try {
    Speech.speak(remaining, {
      language: 'pt-BR',
      rate: session.rate,
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

  const textoFinal = regionalizarTexto(rawText, languageLevel, tratamento).trim();
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

  if (wasSpeakingWeb) {
    // No Chrome/Edge, chamar speak() no mesmo tick de cancel() pode silenciar o áudio
    const token = session.utteranceId;
    speechStartTimer = setTimeout(() => {
      speechStartTimer = null;
      if (activeSpeechSession !== session || session.utteranceId !== token) return;
      startUtteranceFromSession(session);
    }, 35);
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
    norm.includes('repet') ||
    norm.includes('de novo') ||
    norm.includes('outra vez') ||
    norm.includes('ouvir')
  ) {
    return 'repetir';
  }

  if (
    /\bnao\b/.test(norm) ||
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
    /\bsim\b/.test(norm) ||
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

  if (q.includes('agua') || q.includes('falta') || q.includes('molh') || q.includes('irriga')) {
    const raw =
      level === 'acessivel' ? d.modeloA.resumoAcessivel : d.modeloA.resumoTecnico;
    return {
      intent: 'agua',
      titulo: 'Água para a roça',
      texto: regionalizarTexto(raw, level, farmer.tratamento),
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
      titulo: 'Janela de plantio',
      texto: regionalizarTexto(raw, level, farmer.tratamento),
    };
  }

  if (
    q.includes('seca') ||
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
      titulo: 'Risco de seca e chuva',
      texto: regionalizarTexto(raw, level, farmer.tratamento),
    };
  }

  if (q.includes('poco') || q.includes('furar') || q.includes('subterr') || q.includes('cacimba')) {
    const w = d.wellSummary;
    const raw = `Nos poços da região em até ${farm.raioBuscaKm} quilômetros, a profundidade varia de ${w.faixaProfundidadeMinM} a ${w.faixaProfundidadeMaxM} metros, com ${w.taxaSucessoPct}% de chance de dar água e risco ${w.riscoSalinidade} de água salobra. ${w.orientacaoBaixaRenda}`;
    return {
      intent: 'poco',
      titulo: 'Onde furar poço (SIAGAS + NASA)',
      texto: regionalizarTexto(raw, level, farmer.tratamento),
    };
  }

  if (q.includes('eros') || q.includes('lavar') || q.includes('enxurrada') || q.includes('solo') || q.includes('terra')) {
    const solo = d.soloSoilGrids;
    const raw = `${
      level === 'acessivel' ? d.modeloD.resumoAcessivel : d.modeloD.resumoTecnico
    } O solo da sua área tem textura ${solo.textura}, pH ${solo.ph} e carbono orgânico ${solo.carbonoOrganicoGKg} g/kg.`;
    return {
      intent: 'erosao',
      titulo: 'Solo e risco de erosão',
      texto: regionalizarTexto(raw, level, farmer.tratamento),
    };
  }

  if (q.includes('futuro') || q.includes('2030') || q.includes('2050') || q.includes('clima')) {
    const raw =
      level === 'acessivel' ? d.modeloE.resumoAcessivel : d.modeloE.resumoTecnico;
    return {
      intent: 'futuro',
      titulo: 'Projeção 2030–2050',
      texto: regionalizarTexto(raw, level, farmer.tratamento),
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
      .map((p) => p.nomePopular)
      .join(', ');
    const raw = `Para garantir comida forte mesmo na seca, o catálogo offline indica para o solo da sua terra: ${topNames}.`;
    return {
      intent: 'pancs',
      titulo: 'Plantas comestíveis resistentes',
      texto: regionalizarTexto(raw, level, farmer.tratamento),
    };
  }

  const fallback = `Hoje em ${farm.regiaoNome} faz até ${d.climaDia.tempMaxC} graus. ${d.modeloB.resumoAcessivel} Faltam ${d.rotacaoAtual.diasRestantes} dias para colher ${d.rotacaoAtual.culturas}.`;
  return {
    intent: 'resumo',
    titulo: 'Resumo geral da roça',
    texto: regionalizarTexto(fallback, level, farmer.tratamento),
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
  switch (errCode) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Permissão do microfone negada. Libere o microfone no navegador ou toque em um dos botões abaixo.';
    case 'no-speech':
      return 'Não ouvi nenhuma fala. Toque no microfone e fale "Sim" ou "Não" mais perto.';
    case 'audio-capture':
      return 'Nenhum microfone ativo foi detectado ou outro aplicativo está usando o microfone.';
    case 'network':
      return 'O navegador não conseguiu acessar o reconhecimento de voz online (rede ou bloqueio de privacidade). Tente no Chrome/Edge com internet ou toque nos botões abaixo.';
    case 'aborted':
      return 'A escuta foi interrompida antes de capturar a fala. Toque no microfone para tentar novamente.';
    case 'language-not-supported':
      return 'Idioma pt-BR não suportado pelo reconhecimento de voz deste navegador. Toque em um dos botões.';
    default:
      return `Não foi possível ouvir o microfone (${errCode || 'erro desconhecido'}). Tente novamente ou toque em um dos botões.`;
  }
}

export function startVoiceCapture(
  onResult: (transcript: string) => void,
  onError: (message: string) => void,
  options: {
    onEnd?: () => void;
    onExpoGoFallback?: () => void;
    unsupportedMessage?: string;
  } = {}
): () => void {
  const {
    onEnd,
    onExpoGoFallback,
    unsupportedMessage =
      'O Expo Go não inclui o motor de reconhecimento de voz nativo. Use o microfone (🎤) do teclado do celular abaixo, ou gere um Development Build (eas build).',
  } = options;

  stopSpeaking();

  // 1) Web (Chrome / Edge / Safari via Web Speech API)
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.isSecureContext === false) {
      onError('Para usar o microfone na Web, acesse por http://localhost ou HTTPS.');
      onEnd?.();
      return () => {};
    }

    const win = window as unknown as Record<string, unknown>;
    const SpeechRec = (win.SpeechRecognition || win.webkitSpeechRecognition) as
      | (new () => WebSpeechRecognitionInstance)
      | undefined;

    if (SpeechRec) {
      let cancelled = false;
      let finished = false;
      let deliveredResult = false;
      let latestTranscript = '';
      let activeRec: WebSpeechRecognitionInstance | null = null;
      let retryTimer: ReturnType<typeof setTimeout> | null = null;
      let startTimer: ReturnType<typeof setTimeout> | null = null;
      let retriedAudio = false;
      let retriedLang = false;

      const finish = () => {
        if (finished) return;
        finished = true;
        if (retryTimer) {
          clearTimeout(retryTimer);
          retryTimer = null;
        }
        if (startTimer) {
          clearTimeout(startTimer);
          startTimer = null;
        }
        onEnd?.();
      };

      const startAttempt = (langToUse: string) => {
        if (cancelled || finished) return;
        try {
          const rec = new SpeechRec();
          activeRec = rec;
          latestTranscript = '';
          if (langToUse) rec.lang = langToUse;
          rec.interimResults = true;
          rec.maxAlternatives = 3;
          rec.continuous = false;

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
            if (cleaned) latestTranscript = cleaned;
            if (hasFinal && cleaned) {
              deliveredResult = true;
              onResult(cleaned);
              try {
                rec.stop();
              } catch {
                // ignore
              }
              finish();
            }
          };

          rec.onerror = (event) => {
            if (cancelled || finished || deliveredResult) return;
            const errCode = event?.error ?? '';

            if (errCode === 'language-not-supported' && !retriedLang) {
              retriedLang = true;
              startAttempt(langToUse === 'pt-BR' ? 'pt' : '');
              return;
            }

            if ((errCode === 'aborted' || errCode === 'audio-capture') && !retriedAudio) {
              retriedAudio = true;
              retryTimer = setTimeout(() => {
                if (cancelled || finished) return;
                const mediaDevices = navigator.mediaDevices;
                if (mediaDevices?.getUserMedia) {
                  mediaDevices
                    .getUserMedia({ audio: true })
                    .then((stream) => {
                      stream.getTracks().forEach((t) => t.stop());
                      startAttempt(langToUse);
                    })
                    .catch((permErr: unknown) => {
                      const errName = (permErr as { name?: string })?.name ?? '';
                      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
                        onError(mapWebSpeechError('not-allowed'));
                      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
                        onError(mapWebSpeechError('audio-capture'));
                      } else {
                        onError(mapWebSpeechError(errCode));
                      }
                      finish();
                    });
                } else {
                  startAttempt(langToUse);
                }
              }, 200);
              return;
            }

            onError(mapWebSpeechError(errCode));
            finish();
          };

          rec.onend = () => {
            if (cancelled || finished) return;
            if (!deliveredResult && latestTranscript) {
              deliveredResult = true;
              onResult(latestTranscript);
            }
            finish();
          };

          rec.start();
        } catch {
          onError('Microfone indisponível neste navegador. Toque em uma das opções abaixo.');
          finish();
        }
      };

      // Aguarda breve liberação de áudio do speechSynthesis antes de abrir o microfone
      startTimer = setTimeout(() => startAttempt('pt-BR'), 150);

      return () => {
        cancelled = true;
        if (retryTimer) {
          clearTimeout(retryTimer);
          retryTimer = null;
        }
        if (startTimer) {
          clearTimeout(startTimer);
          startTimer = null;
        }
        try {
          activeRec?.abort?.();
          activeRec?.stop();
        } catch {
          // ignore
        }
        finish();
      };
    }
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
            onError('Serviço de voz do Android indisponível neste aparelho. Ative o Google/Digitação por voz ou toque nos botões.');
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
                onError('Não ouvi nenhuma fala. Tente novamente mais perto do microfone.');
              } else if (err === 'not-allowed' || err === 'permissions') {
                onError('Permissão do microfone negada. Libere nas configurações do aparelho.');
              } else if (err === 'audio' || err === 'audio-capture') {
                onError('Não foi possível acessar o microfone do aparelho agora. Verifique se outro app não está gravando.');
              } else if (err === 'network') {
                onError('Reconhecimento de voz sem conexão com o serviço de voz. Verifique a internet ou use os botões.');
              } else {
                onError('Não foi possível capturar a fala agora. Tente de novo ou use os botões.');
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
                lang: 'pt-BR',
                interimResults: true,
                maxAlternatives: 3,
                continuous: false,
              });
            } catch {
              onError('Falha ao iniciar o microfone nativo.');
              cleanup();
            }
          }, 180);
        } catch {
          onError('Falha ao iniciar o microfone nativo.');
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
