import { useCallback, useEffect, useState } from 'react';
import {
  friendlyMessage,
  getCapabilities,
  getClimateProjectionOptions,
  getCrops,
} from '../services/dssatApi';
import type { Capabilities, CatalogCrop, ClimateProjectionOptions } from '../types/dssat';

/** Catálogo de culturas, capacidades de rotação e opções de clima futuro (cache em memória no cliente). */
export function useDssatCatalog({ includeCapabilities = true } = {}) {
  const [crops, setCrops] = useState<CatalogCrop[]>([]);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [projection, setProjection] = useState<ClimateProjectionOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    const reportError = (e: unknown) => { if (alive) setError(friendlyMessage(e)); };
    const catalog = getCrops().then((c) => { if (alive) setCrops(c); }).catch(reportError);
    const capabilities = includeCapabilities
      ? getCapabilities().then((k) => { if (alive) setCaps(k); }).catch(reportError)
      : Promise.resolve();
    void Promise.all([catalog, capabilities]).finally(() => { if (alive) setLoading(false); });
    // Clima futuro é opcional: falha aqui não bloqueia o resto.
    getClimateProjectionOptions()
      .then((p) => alive && setProjection(p))
      .catch(() => alive && setProjection(null));
    return () => {
      alive = false;
    };
  }, [attempt, includeCapabilities]);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setAttempt((n) => n + 1);
  }, []);
  const cropName = useCallback(
    (code: string) => crops.find((c) => c.code === code)?.name ?? code,
    [crops]
  );

  return { crops, caps, projection, loading, error, reload, cropName };
}
