import { requireOptionalNativeModule } from 'expo';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
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

export function stopSpeaking(): void {
  try {
    Speech.stop();
  } catch {
    // Ignora se TTS não estiver inicializado
  }
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

  const textoFinal = regionalizarTexto(rawText, languageLevel, tratamento);
  try {
    Speech.stop();
    Speech.speak(textoFinal, {
      language: 'pt-BR',
      rate,
      pitch: 1.0,
      onDone,
      onError: () => onDone?.(),
    });
  } catch {
    onDone?.();
  }
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
  const q = query.toLowerCase();
  const d = farm.diagnostico;

  if (q.includes('água') || q.includes('agua') || q.includes('falta') || q.includes('molh')) {
    const raw =
      level === 'acessivel' ? d.modeloA.resumoAcessivel : d.modeloA.resumoTecnico;
    return {
      intent: 'agua',
      titulo: 'Água para a roça',
      texto: regionalizarTexto(raw, level, farmer.tratamento),
    };
  }

  if (q.includes('plantar') || q.includes('seme') || q.includes('quando') || q.includes('veranico')) {
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

  if (q.includes('seca') || q.includes('estiagem') || q.includes('alerta')) {
    const raw =
      level === 'acessivel' ? d.modeloB.resumoAcessivel : d.modeloB.resumoTecnico;
    return {
      intent: 'seca',
      titulo: 'Risco de seca',
      texto: regionalizarTexto(raw, level, farmer.tratamento),
    };
  }

  if (q.includes('poço') || q.includes('poco') || q.includes('furar') || q.includes('subterr')) {
    const w = d.wellSummary;
    const raw = `Nos poços da região em até ${farm.raioBuscaKm} quilômetros, a profundidade varia de ${w.faixaProfundidadeMinM} a ${w.faixaProfundidadeMaxM} metros, com ${w.taxaSucessoPct}% de chance de dar água e risco ${w.riscoSalinidade} de água salobra. ${w.orientacaoBaixaRenda}`;
    return {
      intent: 'poco',
      titulo: 'Onde furar poço (SIAGAS + NASA)',
      texto: regionalizarTexto(raw, level, farmer.tratamento),
    };
  }

  if (q.includes('eros') || q.includes('lavar') || q.includes('enxurrada')) {
    const raw =
      level === 'acessivel' ? d.modeloD.resumoAcessivel : d.modeloD.resumoTecnico;
    return {
      intent: 'erosao',
      titulo: 'Risco de erosão',
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

  if (q.includes('comer') || q.includes('panc') || q.includes('alimento') || q.includes('fome')) {
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

  // 1) Web (Chrome / Edge via Web Speech API)
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const win = window as unknown as Record<string, unknown>;
    const SpeechRec = (win.SpeechRecognition || win.webkitSpeechRecognition) as
      | (new () => {
          lang: string;
          interimResults: boolean;
          maxAlternatives: number;
          onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
          onerror: (e: { error: string }) => void;
          onend?: () => void;
          start: () => void;
          stop: () => void;
        })
      | undefined;

    if (SpeechRec) {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        onEnd?.();
      };

      try {
        const rec = new SpeechRec();
        rec.lang = 'pt-BR';
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        rec.onresult = (event) => {
          const text = event.results?.[0]?.[0]?.transcript;
          if (text) onResult(text);
          finish();
        };
        rec.onerror = (event) => {
          if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
            onError(
              'Permissão do microfone negada. Libere o microfone no navegador ou toque em um dos botões abaixo.'
            );
          } else if (event?.error === 'no-speech') {
            onError('Não ouvi nenhuma fala. Toque no microfone e fale "Sim" ou "Não".');
          } else {
            onError(
              'Não foi possível ouvir o microfone agora. Tente novamente ou toque em um dos botões.'
            );
          }
          finish();
        };
        rec.onend = () => {
          finish();
        };
        rec.start();
        return () => {
          try {
            rec.stop();
          } catch {
            // ignore
          }
          finish();
        };
      } catch {
        onError('Microfone indisponível neste navegador. Toque em uma das opções abaixo.');
        onEnd?.();
        return () => {};
      }
    }
  }

  // 2) Nativo Android/iOS quando compilado em Development Build / APK (expo-speech-recognition)
  if (Platform.OS !== 'web') {
    const speechLib = getOptionalSpeechRecognitionLib();
    if (speechLib?.ExpoSpeechRecognitionModule) {
      const mod = speechLib.ExpoSpeechRecognitionModule;
      let cancelled = false;
      let finished = false;
      const subscriptions: { remove: () => void }[] = [];

      const cleanup = () => {
        if (finished) return;
        finished = true;
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

          subscriptions.push(
            mod.addListener('result', (event) => {
              const text = event.results?.[0]?.transcript;
              if (text && event.isFinal) {
                onResult(text);
                cleanup();
              }
            }),
            mod.addListener('error', (event) => {
              onError(
                event.error === 'no-speech'
                  ? 'Não ouvi nenhuma fala. Tente novamente perto do microfone.'
                  : 'Não foi possível capturar a fala agora. Tente de novo ou use os botões.'
              );
              cleanup();
            }),
            mod.addListener('end', () => {
              cleanup();
            })
          );

          mod.start({
            lang: 'pt-BR',
            interimResults: false,
            maxAlternatives: 1,
            continuous: false,
          });
        } catch {
          onError('Falha ao iniciar o microfone nativo.');
          cleanup();
        }
      })();

      return () => {
        cancelled = true;
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
