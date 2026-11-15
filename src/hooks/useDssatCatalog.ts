import { useCallback, useEffect, useState } from 'react';
import {
  friendlyMessage,
  getCapabilities,
  getClimateProjectionOptions,
  getCrops,
} from '../services/dssatApi';
import type { Capabilities, CatalogCrop, ClimateProjectionOptions } from '../types/dssat';

/** Catálogo de culturas, capacidades de rotação e opções de clima futuro (cache em memória no cliente). */
export function useDssatCatalog() {
  const [crops, setCrops] = useState<CatalogCrop[]>([]);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [projection, setProjection] = useState<ClimateProjectionOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.all([getCrops(), getCapabilities()])
      .then(([c, k]) => {
        if (!alive) return;
        setCrops(c);
        setCaps(k);
      })
      .catch((e) => alive && setError(friendlyMessage(e)))
      .finally(() => alive && setLoading(false));
    // Clima futuro é opcional: falha aqui não bloqueia o resto.
    getClimateProjectionOptions()
      .then((p) => alive && setProjection(p))
      .catch(() => alive && setProjection(null));
    return () => {
      alive = false;
    };
  }, [attempt]);

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
