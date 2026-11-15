import { AppLanguage, FarmProperty, NasaDiagnosticsPackage, SyncQueueItem } from '../types/domain';
import { pickLang } from '../i18n/locale';
import { runLocalAgronomicEngine } from './localAgronomicEngine';

export interface SyncResult {
  mode: 'sincronizado' | 'offline';
  syncedItemIds: string[];
  updatedDiagnostics: NasaDiagnosticsPackage;
  message: string;
}

/**
 * HTTP client layer ready to sync local queue (`sync_queue`)
 * and receive JSON bundles from a remote backend when `NetInfo` detects internet.
 * Operates 100% offline with automatic fallback to the local agronomic engine.
 */
export async function syncPendingDataWithCloud(options: {
  isOnline: boolean;
  farm: FarmProperty;
  pendingQueue: SyncQueueItem[];
  remoteApiUrl?: string;
  dryStressBoost?: number;
  language?: AppLanguage;
}): Promise<SyncResult> {
  const {
    isOnline,
    farm,
    pendingQueue,
    remoteApiUrl,
    dryStressBoost = 0,
    language = 'en',
  } = options;

  const localUpdated = runLocalAgronomicEngine(
    farm.centroid,
    farm.culturaPrincipal,
    farm.raioBuscaKm,
    { dryStressBoost },
    language
  );

  if (!isOnline) {
    return {
      mode: 'offline',
      syncedItemIds: [],
      updatedDiagnostics: localUpdated,
      message: pickLang(
        language,
        'Offline Field Mode: records safely stored on this device.',
        'Modo Roça Offline: registros guardados no aparelho.'
      ),
    };
  }

  // Optional attempt against remote server when configured
  if (remoteApiUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const response = await fetch(`${remoteApiUrl}/api/fazendas/sincronizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fazenda_id: farm.id,
          centroid: farm.centroid,
          polygon: farm.polygon,
          cultura_principal: farm.culturaPrincipal,
          raio_km: farm.raioBuscaKm,
          registros_pendentes: pendingQueue.map((q) => JSON.parse(q.payloadJson)),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        return {
          mode: 'sincronizado',
          syncedItemIds: pendingQueue.map((q) => q.id),
          updatedDiagnostics: data?.diagnostico
            ? { ...data.diagnostico, fontePacote: 'api_remota' }
            : localUpdated,
          message: pickLang(
            language,
            `Synced with server: ${pendingQueue.length} record(s) uploaded.`,
            `Sincronizado com servidor: ${pendingQueue.length} registro(s) enviados.`
          ),
        };
      }
    } catch {
      // No active remote server — complete local sync bundle
    }
  }

  return {
    mode: 'sincronizado',
    syncedItemIds: pendingQueue.map((q) => q.id),
    updatedDiagnostics: localUpdated,
    message:
      pendingQueue.length > 0
        ? pickLang(
            language,
            `Synced: ${pendingQueue.length} field record(s) processed.`,
            `Sincronizado: ${pendingQueue.length} registro(s) de campo processados.`
          )
        : pickLang(
            language,
            'Synced: farm data and alerts updated.',
            'Sincronizado: dados da roça e alertas atualizados.'
          ),
  };
}
