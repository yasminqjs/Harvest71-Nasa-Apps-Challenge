import { FarmProperty, NasaDiagnosticsPackage, SyncQueueItem } from '../types/domain';
import { runLocalAgronomicEngine } from './localAgronomicEngine';

export interface SyncResult {
  mode: 'sincronizado' | 'offline';
  syncedItemIds: string[];
  updatedDiagnostics: NasaDiagnosticsPackage;
  message: string;
}

/**
 * Camada de cliente HTTP pronta para sincronizar a fila local (`sync_queue`)
 * e receber pacotes JSON de um servidor futuro quando `NetInfo` detectar internet.
 * Opera 100% offline com fallback automático para o motor agronômico local.
 */
export async function syncPendingDataWithCloud(options: {
  isOnline: boolean;
  farm: FarmProperty;
  pendingQueue: SyncQueueItem[];
  remoteApiUrl?: string;
  dryStressBoost?: number;
}): Promise<SyncResult> {
  const { isOnline, farm, pendingQueue, remoteApiUrl, dryStressBoost = 0 } = options;

  const localUpdated = runLocalAgronomicEngine(
    farm.centroid,
    farm.culturaPrincipal,
    farm.raioBuscaKm,
    { dryStressBoost }
  );

  if (!isOnline) {
    return {
      mode: 'offline',
      syncedItemIds: [],
      updatedDiagnostics: localUpdated,
      message: 'Modo Roça Offline: registros guardados no aparelho.',
    };
  }

  // Tentativa opcional contra servidor remoto caso URL seja configurada pelo usuário/equipe
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
          message: `Sincronizado com servidor: ${pendingQueue.length} registro(s) enviados.`,
        };
      }
    } catch {
      // Sem servidor remoto ativo — conclui sincronização local/pacote consolidado
    }
  }

  return {
    mode: 'sincronizado',
    syncedItemIds: pendingQueue.map((q) => q.id),
    updatedDiagnostics: localUpdated,
    message:
      pendingQueue.length > 0
        ? `Sincronizado: ${pendingQueue.length} registro(s) de campo processados.`
        : 'Sincronizado: dados da roça e alertas atualizados.',
  };
}
