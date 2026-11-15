/**
 * Envio e acompanhamento de um Job DSSAT, por talhão e por tipo de fluxo.
 *
 * - Cada POST cria um Job: o envio fica bloqueado enquanto há um em andamento (sem clique duplo).
 * - Guarda id/poll em memória (por talhão + fluxo): sair da tela e voltar retoma o acompanhamento.
 * - Consulta `poll` a cada ~5 s até "done"/"failed" (a API dá ~15 min de prazo).
 * - Resposta de outro talhão nunca aparece: o estado é indexado pelo id do talhão.
 * - Falha de rede no meio do polling não perde o Job: mostra erro com "Tentar de novo" (retoma o GET).
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { DssatApiError, friendlyMessage, pollJob } from '../services/dssatApi';
import type { AnyJobResult, JobAccepted, JobKind } from '../types/dssat';

export type JobPhase = 'idle' | 'submitting' | 'queued' | 'running' | 'done' | 'failed' | 'error';

export interface JobState<R extends AnyJobResult = AnyJobResult> {
  phase: JobPhase;
  job?: JobAccepted;
  result?: R;                 // resultado terminal ou parcial ("running" com dados)
  error?: string;
  errorFields?: { field: string; message: string }[];
  errorKind?: string;
  submittedAt?: number;
  farmId: string;
  kind: JobKind;
}

const POLL_MS = 5_000;
const MAX_WAIT_MS = 16 * 60_000;

const states = new Map<string, JobState>();
const listeners = new Map<string, Set<() => void>>();
const loops = new Map<string, AbortController>();

const keyOf = (farmId: string, kind: JobKind) => `${farmId}::${kind}`;

function getState(key: string, farmId: string, kind: JobKind): JobState {
  let s = states.get(key);
  if (!s) {
    s = { phase: 'idle', farmId, kind };
    states.set(key, s);
  }
  return s;
}

function setState(key: string, patch: Partial<JobState>) {
  const prev = states.get(key);
  if (!prev) return;
  states.set(key, { ...prev, ...patch });
  listeners.get(key)?.forEach((fn) => fn());
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(t);
      resolve();
    });
  });

async function follow(key: string) {
  loops.get(key)?.abort();
  const controller = new AbortController();
  loops.set(key, controller);
  const s = states.get(key);
  if (!s?.job) return;
  const deadline = (s.submittedAt ?? Date.now()) + MAX_WAIT_MS;
  try {
    while (!controller.signal.aborted) {
      const result = await pollJob(s.job.poll, controller.signal);
      if (controller.signal.aborted) return;
      if (result.status === 'done' || result.status === 'failed') {
        setState(key, { phase: result.status, result, error: result.status === 'failed' ? result.error : undefined });
        return;
      }
      // "running" pode já trazer o resultado atual (ex.: clima futuro ainda calculando)
      const partial = 'scenario_summary' in result && result.scenario_summary ? result : undefined;
      setState(key, { phase: result.status === 'running' ? 'running' : 'queued', ...(partial ? { result: partial } : {}) });
      if (Date.now() > deadline) {
        setState(key, { phase: 'error', error: 'A simulação demorou mais que o esperado. Toque em "Tentar de novo" para consultar outra vez.' });
        return;
      }
      await sleep(POLL_MS, controller.signal);
    }
  } catch (e) {
    if (controller.signal.aborted) return;
    setState(key, { phase: 'error', error: friendlyMessage(e), errorKind: e instanceof DssatApiError ? e.kind : 'network' });
  } finally {
    if (loops.get(key) === controller) loops.delete(key);
  }
}

export function useDssatJob<R extends AnyJobResult = AnyJobResult>(farmId: string, kind: JobKind) {
  const key = keyOf(farmId, kind);
  const subscribe = useCallback(
    (fn: () => void) => {
      let set = listeners.get(key);
      if (!set) listeners.set(key, (set = new Set()));
      set.add(fn);
      return () => set!.delete(fn);
    },
    [key]
  );
  const state = useSyncExternalStore(subscribe, () => getState(key, farmId, kind)) as JobState<R>;

  // Ao abrir a tela: se havia Job em andamento para este talhão, retoma o acompanhamento.
  useEffect(() => {
    const s = states.get(key);
    if (s?.job && (s.phase === 'queued' || s.phase === 'running') && !loops.has(key)) {
      void follow(key);
    }
  }, [key]);

  const busy = state.phase === 'submitting' || state.phase === 'queued' || state.phase === 'running';

  /** Cria o Job. Ignorado se já houver um em andamento. */
  const submit = useCallback(
    async (create: () => Promise<JobAccepted>) => {
      const s = getState(key, farmId, kind);
      if (s.phase === 'submitting' || s.phase === 'queued' || s.phase === 'running') return;
      setState(key, { phase: 'submitting', error: undefined, errorFields: undefined, result: undefined, job: undefined });
      try {
        const job = await create();
        setState(key, { phase: 'queued', job, submittedAt: Date.now() });
        void follow(key);
      } catch (e) {
        const err = e instanceof DssatApiError ? e : undefined;
        // Erro de rede depois do POST: o Job pode ter sido criado. Não reenvia sozinho.
        setState(key, {
          phase: 'error',
          error: err?.kind === 'network'
            ? 'A conexão caiu durante o envio. O pedido pode ter sido registrado; confira antes de enviar de novo.'
            : friendlyMessage(e),
          errorFields: err?.fields,
          errorKind: err?.kind ?? 'network',
        });
      }
    },
    [key, farmId, kind]
  );

  /** Retoma a consulta do Job atual (depois de falha de rede ou prazo). */
  const retry = useCallback(() => {
    const s = states.get(key);
    if (s?.job) {
      setState(key, { phase: 'running', error: undefined });
      void follow(key);
    }
  }, [key]);

  /** Para de esperar aqui (o Job continua no servidor) e limpa a tela. */
  const reset = useCallback(() => {
    loops.get(key)?.abort();
    loops.delete(key);
    setState(key, { phase: 'idle', job: undefined, result: undefined, error: undefined, errorFields: undefined });
  }, [key]);

  return { state, busy, submit, retry, reset };
}

/** Só para testes. */
export function __resetDssatJobs() {
  loops.forEach((c) => c.abort());
  loops.clear();
  states.clear();
  listeners.clear();
}
