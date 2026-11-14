import { LanguageLevel } from '../types/domain';

interface JargonEntry {
  pattern: RegExp;
  popular: string;
}

const NORDESTE_JARGON_MAP: JargonEntry[] = [
  {
    pattern: /déficit hídrico/gi,
    popular: 'a terra está perdendo mais água pro sol do que recebendo de chuva',
  },
  {
    pattern: /balanço hídrico negativo/gi,
    popular: 'saiu mais água da roça do que entrou de chuva',
  },
  {
    pattern: /balanço hídrico/gi,
    popular: 'conta da água que entra pela chuva e sai pelo sol e pela planta',
  },
  {
    pattern: /evapotranspiração/gi,
    popular: 'água que o sol puxa da terra e das folhas',
  },
  {
    pattern: /\bveranico\b/gi,
    popular: 'estiagem no meio das chuvas / falso começo de inverno',
  },
  {
    pattern: /risco de erosão/gi,
    popular: 'perigo da chuva forte lavar a terra boa',
  },
  {
    pattern: /erodibilidade/gi,
    popular: 'facilidade da terra ser levada pela enxurrada',
  },
  {
    pattern: /umidade radicular/gi,
    popular: 'terra molhada lá no fundo onde fica a raiz',
  },
  {
    pattern: /salinidade/gi,
    popular: 'água salgada ou salobra no poço',
  },
  {
    pattern: /recarga aquífera/gi,
    popular: 'água da chuva descendo pra encher o lençol de baixo da terra',
  },
  {
    pattern: /anomalia térmica/gi,
    popular: 'calor mais forte que o normal pra essa época do ano',
  },
  {
    pattern: /curvas de nível/gi,
    popular: 'plantar acompanhando o caimento do terreno pra segurar a chuva',
  },
  {
    pattern: /cobertura morta/gi,
    popular: 'palha ou mato seco cobrindo a terra pra guardar umidade',
  },
  {
    pattern: /vigor vegetativo/gi,
    popular: 'força e verdura das folhas na roça',
  },
  {
    pattern: /clorose/gi,
    popular: 'folha amarelada por falta de água ou de vitamina na terra',
  },
];

export function regionalizarTexto(
  texto: string,
  level: LanguageLevel = 'acessivel',
  tratamento?: string
): string {
  let resultado = texto;

  if (level === 'acessivel') {
    for (const item of NORDESTE_JARGON_MAP) {
      resultado = resultado.replace(item.pattern, item.popular);
    }
  }

  if (tratamento && !resultado.toLowerCase().includes(tratamento.toLowerCase())) {
    return `${tratamento}, ${resultado.charAt(0).toLowerCase()}${resultado.slice(1)}`;
  }

  return resultado;
}

export function formatArea(hectares: number, tarefasBa: number): string {
  return `${hectares.toFixed(2)} ha (${tarefasBa.toFixed(1)} tarefas)`;
}

export function formatCurrencyBRL(value: number): string {
  return `R$ ${value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}
