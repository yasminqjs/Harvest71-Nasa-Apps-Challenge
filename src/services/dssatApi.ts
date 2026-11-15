/**
 * Cliente HTTP da API Field Shift (DSSAT). Única porta para o DSSAT: o app nunca acessa o bucket.
 * Base: EXPO_PUBLIC_DSSAT_API_URL (vai para o bundle — não coloque segredo aqui).
 */
import type {
  AnyJobResult,
  Capabilities,
  CatalogCrop,
  ClimateProjectionOptions,
  JobAccepted,
  RotationCompareRequest,
  RotationSearchRequest,
  SimulationRequest,
} from '../types/dssat';

export const DSSAT_API_URL = (
  process.env.EXPO_PUBLIC_DSSAT_API_URL || 'https://fieldshift-api-avshjoa6eq-uc.a.run.app'
).replace(/\/+$/, '');

const REQUEST_TIMEOUT_MS = 30_000;

export type DssatErrorKind =
  | 'validation'   // 422
  | 'rate_limit'   // 429
  | 'access'       // 401/403
  | 'not_found'    // 404
  | 'unavailable'  // 5xx
  | 'network'      // sem conexão / timeout
  | 'invalid';     // resposta inesperada

export class DssatApiError extends Error {
  kind: DssatErrorKind;
  status?: number;
  fields?: { field: string; message: string }[];

  constructor(kind: DssatErrorKind, message: string, status?: number,
              fields?: { field: string; message: string }[]) {
    super(message);
    this.kind = kind;
    this.status = status;
    this.fields = fields;
  }
}

function kindForStatus(status: number): DssatErrorKind {
  if (status === 422 || status === 400) return 'validation';
  if (status === 429) return 'rate_limit';
  if (status === 401 || status === 403) return 'access';
  if (status === 404) return 'not_found';
  return 'unavailable';
}

const FRIENDLY: Record<DssatErrorKind, string> = {
  validation: 'Alguns dados do pedido não foram aceitos.',
  rate_limit: 'Limite de simulações atingido. Tente de novo em alguns minutos.',
  access: 'Acesso à simulação não autorizado.',
  not_found: 'Simulação não encontrada.',
  unavailable: 'Serviço de simulação indisponível no momento.',
  network: 'Sem conexão com o serviço de simulação.',
  invalid: 'Resposta inesperada do serviço de simulação.',
};

function parseDetail(detail: unknown): { message?: string; fields?: { field: string; message: string }[] } {
  if (typeof detail === 'string') return { message: detail };
  if (Array.isArray(detail)) {
    const fields = detail.map((d: { loc?: unknown[]; msg?: string }) => ({
      field: Array.isArray(d?.loc) ? d.loc.slice(1).join('.') : '',
      message: String(d?.msg ?? '').replace(/^Value error, /, ''),
    }));
    return { message: fields.map((f) => (f.field ? `${f.field}: ${f.message}` : f.message)).join('; '), fields };
  }
  return {};
}

/** Resolve `path` contra a base e recusa endereço de outra origem (o `poll` vem do servidor). */
function resolve(path: string): string {
  // `poll` vem como "/simulations/{id}": junta à base (que pode ter caminho, ex.: proxy "/api").
  const url = /^https?:\/\//.test(path) ? new URL(path) : new URL(DSSAT_API_URL + (path.startsWith('/') ? path : `/${path}`));
  if (url.origin !== new URL(DSSAT_API_URL).origin) {
    throw new DssatApiError('invalid', 'Endereço fora da API configurada.');
  }
  return url.toString();
}

async function request<T>(path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  let response: Response;
  try {
    response = await fetch(resolve(path), { ...init, signal: controller.signal });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new DssatApiError('network', FRIENDLY.network);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const kind = kindForStatus(response.status);
    const { message, fields } = parseDetail((body as { detail?: unknown } | null)?.detail);
    throw new DssatApiError(kind, message || FRIENDLY[kind], response.status, fields);
  }
  if (body === null || typeof body !== 'object') {
    throw new DssatApiError('invalid', FRIENDLY.invalid, response.status);
  }
  return body as T;
}

function post<T>(path: string, payload: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ----------------------------------------------------------------------------- leitura (com cache em memória)

const cache = new Map<string, Promise<unknown>>();

function cachedGet<T>(path: string): Promise<T> {
  let p = cache.get(path) as Promise<T> | undefined;
  if (!p) {
    p = request<T>(path);
    cache.set(path, p);
    p.catch(() => cache.delete(path));   // erro não fica em cache
  }
  return p;
}

export async function getCrops(): Promise<CatalogCrop[]> {
  const body = await cachedGet<{ crops?: CatalogCrop[] }>('/crops');
  if (!Array.isArray(body.crops)) throw new DssatApiError('invalid', FRIENDLY.invalid);
  return body.crops;
}

export function getCrop(code: string): Promise<CatalogCrop> {
  return cachedGet<CatalogCrop>(`/crops/${encodeURIComponent(code)}`);
}

export async function getCapabilities(): Promise<Capabilities> {
  const body = await cachedGet<Capabilities>('/planning/capabilities');
  if (!Array.isArray(body.crops) || !Array.isArray(body.sequence_pairs)) {
    throw new DssatApiError('invalid', FRIENDLY.invalid);
  }
  return body;
}

export function getClimateProjectionOptions(): Promise<ClimateProjectionOptions> {
  return cachedGet<ClimateProjectionOptions>('/climate-projections');
}

// ----------------------------------------------------------------------------- jobs

export function createSimulation(req: SimulationRequest): Promise<JobAccepted> {
  return post<JobAccepted>('/simulations', req);
}

export function createRotationSearch(req: RotationSearchRequest): Promise<JobAccepted> {
  return post<JobAccepted>('/rotations/search', req);
}

export function createRotationCompare(req: RotationCompareRequest): Promise<JobAccepted> {
  return post<JobAccepted>('/rotations', req);
}

export function pollJob(poll: string, signal?: AbortSignal): Promise<AnyJobResult> {
  return request<AnyJobResult>(poll, {}, signal);
}

export function friendlyMessage(e: unknown): string {
  if (e instanceof DssatApiError) return e.message;
  return FRIENDLY.network;
}
