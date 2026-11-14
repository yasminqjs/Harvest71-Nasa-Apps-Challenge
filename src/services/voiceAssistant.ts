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
  } = {}
): void {
  const {
    enabled = true,
    rate = 0.85,
    languageLevel = 'acessivel',
    tratamento,
    force = false,
  } = options;

  if (!enabled && !force) return;

  const textoFinal = regionalizarTexto(rawText, languageLevel, tratamento);
  try {
    Speech.stop();
    Speech.speak(textoFinal, {
      language: 'pt-BR',
      rate,
      pitch: 1.0,
    });
  } catch {
    // Fallback silencioso
  }
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

export function startVoiceCapture(
  onResult: (transcript: string) => void,
  onError: (message: string) => void
): () => void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const win = window as unknown as Record<string, unknown>;
    const SpeechRec = (win.SpeechRecognition || win.webkitSpeechRecognition) as
      | (new () => {
          lang: string;
          interimResults: boolean;
          maxAlternatives: number;
          onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
          onerror: (e: { error: string }) => void;
          start: () => void;
          stop: () => void;
        })
      | undefined;

    if (SpeechRec) {
      try {
        const rec = new SpeechRec();
        rec.lang = 'pt-BR';
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        rec.onresult = (event) => {
          const text = event.results?.[0]?.[0]?.transcript;
          if (text) onResult(text);
        };
        rec.onerror = () => {
          onError('Não foi possível ouvir o microfone agora. Use os botões de pergunta rápida.');
        };
        rec.start();
        return () => {
          try {
            rec.stop();
          } catch {
            // ignore
          }
        };
      } catch {
        onError('Microfone indisponível neste navegador. Use as perguntas prontas abaixo.');
        return () => {};
      }
    }
  }

  onError(
    'Para usar o microfone direto no celular use o build nativo, ou no notebook use Chrome/Edge. Você pode tocar em qualquer pergunta rápida abaixo para ouvir a resposta.'
  );
  return () => {};
}
