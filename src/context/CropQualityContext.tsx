import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLanguage } from '../i18n/Language';
import {
  PILOT_AREAS_AUDITED,
  analyzeCropQualityRemoteOrFallback,
  buildOfflineAuditedCropQuality,
} from '../services/cropQualityService';
import { speakText, stopSpeaking } from '../services/voiceAssistant';
import { CropQualityAnalysisResponse } from '../types/cropQuality';
import { GeoPoint } from '../types/domain';
import { calculatePolygonMetrics } from '../utils/geoprocessing';
import { useAccessibility } from './AccessibilityContext';

export const SATELLITE_LOADING_STAGES_PT = [
  'Conectando ao Planetary Computer STAC (Sentinel-2 L2A 10m)...',
  'Processando sensor térmico Landsat C2 TIRS (Banda lwir11 30m)...',
  'Consultando NASA POWER Agroclimatologia (GWETROOT, ET0, Chuva)...',
  'Cruzando ISRIC SoilGrids, NASADEM & FAO EcoCrop/GAEZ v4...',
];

export const SATELLITE_LOADING_STAGES_EN = [
  'Connecting to Planetary Computer STAC (Sentinel-2 L2A 10m)...',
  'Processing Landsat C2 TIRS thermal sensor (lwir11 30m band)...',
  'Querying NASA POWER Agroclimatology (GWETROOT, ET0, Rain)...',
  'Cross-referencing ISRIC SoilGrids, NASADEM & FAO EcoCrop/GAEZ v4...',
];

export const SATELLITE_LOADING_STAGES = SATELLITE_LOADING_STAGES_EN;

export interface CropQualityTarget {
  key: string;
  label: string;
  polygon: GeoPoint[];
  centroid: GeoPoint;
  cropName: string;
  waterRegime: 'RAINFED' | 'IRRIGATED';
}

interface CropQualityContextValue {
  target: CropQualityTarget | null;
  analysis: CropQualityAnalysisResponse | null;
  selectedPilotId: string | null;
  isAnalyzing: boolean;
  loadingProgressPct: number;
  loadingStage: string;
  elapsedSec: number;
  lastCompletedAt: string | null;
  communityPestAlert: boolean;
  isPlayingAudio: boolean;
  openQualityRequested: boolean;
  setTarget: (target: CropQualityTarget) => void;
  selectPilotArea: (pilotId: string) => void;
  clearPilotArea: () => void;
  refreshAnalysis: (options?: { liveSatellite?: boolean; communityPestAlert?: boolean }) => Promise<void>;
  toggleCommunityPestAlert: () => Promise<void>;
  dismissCompleted: () => void;
  requestOpenQualityView: () => void;
  clearOpenQualityRequest: () => void;
  playVoice: (script: string) => void;
  stopVoice: () => void;
}

const CropQualityContext = createContext<CropQualityContextValue | null>(null);

function pilotToTarget(pilotId: string, en: boolean): CropQualityTarget {
  const pilot = PILOT_AREAS_AUDITED.find((p) => p.id === pilotId) ?? PILOT_AREAS_AUDITED[0];
  const uniqueCoords =
    pilot.polygon_coordinates.length > 3
      ? pilot.polygon_coordinates.slice(0, -1)
      : pilot.polygon_coordinates;
  const polygon: GeoPoint[] = uniqueCoords.map(([lon, lat]) => ({
    latitude: lat,
    longitude: lon,
  }));
  return {
    key: `pilot:${pilot.id}`,
    label: en
      ? `${pilot.municipality}-${pilot.state} (Pilot area)`
      : `${pilot.municipality}-${pilot.state} (Área piloto)`,
    polygon,
    centroid: { latitude: pilot.centroid.lat, longitude: pilot.centroid.lon },
    cropName: pilot.crop_name,
    waterRegime: pilot.water_regime,
  };
}

export const CropQualityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeFarm, accessibility, isOnline, simulatedOffline, setSimulatedOffline } =
    useAccessibility();
  const { language } = useLanguage();
  const en = language === 'en';

  const [userTarget, setUserTarget] = useState<CropQualityTarget | null>(null);
  const [selectedPilotId, setSelectedPilotId] = useState<string | null>(null);
  const [analysisByKey, setAnalysisByKey] = useState<Record<string, CropQualityAnalysisResponse>>(
    {}
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingProgressPct, setLoadingProgressPct] = useState(0);
  const [loadingStage, setLoadingStage] = useState(SATELLITE_LOADING_STAGES[0]);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [lastCompletedAt, setLastCompletedAt] = useState<string | null>(null);
  const [communityPestAlert, setCommunityPestAlert] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [openQualityRequested, setOpenQualityRequested] = useState(false);

  const analyzingRef = useRef(false);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Alvo padrão: a roça ativa do agricultor (polígono demarcado no onboarding).
  const farmTarget = useMemo<CropQualityTarget | null>(() => {
    if (!activeFarm || activeFarm.polygon.length < 3) return null;
    return {
      key: `farm:${activeFarm.id}`,
      label: activeFarm.nome,
      polygon: activeFarm.polygon,
      centroid: activeFarm.centroid,
      cropName: activeFarm.culturaPrincipal,
      waterRegime: 'RAINFED',
    };
  }, [activeFarm]);

  const target = useMemo<CropQualityTarget | null>(() => {
    if (selectedPilotId) return pilotToTarget(selectedPilotId, en);
    return userTarget ?? farmTarget;
  }, [selectedPilotId, userTarget, farmTarget, en]);

  // Diagnóstico instantâneo (< 300 ms) a partir do Cache Auditado NASA quando ainda não há
  // análise ao vivo para o alvo atual.
  const analysis = useMemo<CropQualityAnalysisResponse | null>(() => {
    if (!target) return null;
    const cached = analysisByKey[target.key];
    if (cached) return cached;
    if (selectedPilotId) {
      const pilot = PILOT_AREAS_AUDITED.find((p) => p.id === selectedPilotId);
      if (pilot) {
        const snapshot = JSON.parse(
          JSON.stringify(pilot.audited_diagnosis)
        ) as CropQualityAnalysisResponse;
        snapshot.cache_metadata = {
          ...(snapshot.cache_metadata ?? {}),
          fallback_used: true,
          pilot_area_id: pilot.id,
          reason: 'pilot_audited_snapshot',
          latency_ms: 2,
        };
        return snapshot;
      }
    }
    return buildOfflineAuditedCropQuality(
      target.centroid,
      target.polygon,
      target.cropName,
      target.waterRegime
    );
  }, [target, analysisByKey, selectedPilotId]);

  useEffect(
    () => () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    },
    []
  );

  const setTarget = useCallback((next: CropQualityTarget) => {
    setSelectedPilotId(null);
    setUserTarget(next);
  }, []);

  const selectPilotArea = useCallback((pilotId: string) => {
    setSelectedPilotId(pilotId);
  }, []);

  const clearPilotArea = useCallback(() => {
    setSelectedPilotId(null);
  }, []);

  const refreshAnalysis = useCallback(
    async (options: { liveSatellite?: boolean; communityPestAlert?: boolean } = {}) => {
      if (!target || analyzingRef.current) return;
      const isLive = Boolean(options.liveSatellite);
      const nextPestAlert = options.communityPestAlert ?? communityPestAlert;
      if (options.communityPestAlert !== undefined) {
        setCommunityPestAlert(options.communityPestAlert);
      }
      if (isLive && simulatedOffline) {
        setSimulatedOffline(false);
      }

      const requestTarget = target;
      analyzingRef.current = true;
      setIsAnalyzing(true);
      setLastCompletedAt(null);
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }

      const stages = en ? SATELLITE_LOADING_STAGES_EN : SATELLITE_LOADING_STAGES_PT;
      const startMs = Date.now();
      setElapsedSec(0);
      setLoadingProgressPct(isLive ? 10 : 50);
      setLoadingStage(stages[0]);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (isLive) {
        let tick = 0;
        progressTimerRef.current = setInterval(() => {
          tick += 1;
          setElapsedSec(Math.floor((Date.now() - startMs) / 1000));
          const stageIdx = Math.min(stages.length - 1, Math.floor(tick / 3));
          setLoadingStage(stages[stageIdx]);
          setLoadingProgressPct((prev) => Math.min(94, prev + 7));
        }, 300);
      }

      try {
        const [result] = await Promise.all([
          analyzeCropQualityRemoteOrFallback({
            polygon: requestTarget.polygon,
            centroid: requestTarget.centroid,
            cropName: requestTarget.cropName,
            waterRegime: requestTarget.waterRegime,
            communityPestAlert: nextPestAlert,
            preferAuditedCache: !isLive,
            isOnline: isLive ? true : isOnline,
          }),
          // Tempo mínimo visual para o agricultor perceber as etapas do satélite.
          isLive ? new Promise<void>((res) => setTimeout(res, 3600)) : Promise.resolve(),
        ]);
        setAnalysisByKey((prev) => ({ ...prev, [requestTarget.key]: result }));
        setLoadingProgressPct(100);
        setLoadingStage(
          en
            ? 'NASA & Copernicus diagnosis complete!'
            : 'Diagnóstico NASA & Copernicus concluído!'
        );
        if (isLive) {
          setLastCompletedAt(new Date().toISOString());
          dismissTimerRef.current = setTimeout(() => setLastCompletedAt(null), 8000);
        }
      } finally {
        if (progressTimerRef.current) {
          clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
        analyzingRef.current = false;
        setIsAnalyzing(false);
      }
    },
    [target, communityPestAlert, simulatedOffline, setSimulatedOffline, isOnline, en]
  );

  const toggleCommunityPestAlert = useCallback(async () => {
    await refreshAnalysis({ liveSatellite: false, communityPestAlert: !communityPestAlert });
  }, [communityPestAlert, refreshAnalysis]);

  const dismissCompleted = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setLastCompletedAt(null);
  }, []);

  const requestOpenQualityView = useCallback(() => setOpenQualityRequested(true), []);
  const clearOpenQualityRequest = useCallback(() => setOpenQualityRequested(false), []);

  const playVoice = useCallback(
    (script: string) => {
      setIsPlayingAudio(true);
      speakText(script, {
        force: true,
        rate: 0.95,
        languageLevel: accessibility.languageLevel,
        onDone: () => setIsPlayingAudio(false),
      });
    },
    [accessibility.languageLevel]
  );

  const stopVoice = useCallback(() => {
    stopSpeaking();
    setIsPlayingAudio(false);
  }, []);

  const value = useMemo<CropQualityContextValue>(
    () => ({
      target,
      analysis,
      selectedPilotId,
      isAnalyzing,
      loadingProgressPct,
      loadingStage,
      elapsedSec,
      lastCompletedAt,
      communityPestAlert,
      isPlayingAudio,
      openQualityRequested,
      setTarget,
      selectPilotArea,
      clearPilotArea,
      refreshAnalysis,
      toggleCommunityPestAlert,
      dismissCompleted,
      requestOpenQualityView,
      clearOpenQualityRequest,
      playVoice,
      stopVoice,
    }),
    [
      target,
      analysis,
      selectedPilotId,
      isAnalyzing,
      loadingProgressPct,
      loadingStage,
      elapsedSec,
      lastCompletedAt,
      communityPestAlert,
      isPlayingAudio,
      openQualityRequested,
      setTarget,
      selectPilotArea,
      clearPilotArea,
      refreshAnalysis,
      toggleCommunityPestAlert,
      dismissCompleted,
      requestOpenQualityView,
      clearOpenQualityRequest,
      playVoice,
      stopVoice,
    ]
  );

  return <CropQualityContext.Provider value={value}>{children}</CropQualityContext.Provider>;
};

export function useCropQuality(): CropQualityContextValue {
  const ctx = useContext(CropQualityContext);
  if (!ctx) throw new Error('useCropQuality deve ser usado dentro de CropQualityProvider');
  return ctx;
}

/** Converte um lote/plantação em alvo de análise de satélite. */
export function buildLotTarget(input: {
  id: string;
  nome: string;
  polygon: GeoPoint[];
  cropName: string;
}): CropQualityTarget | null {
  if (input.polygon.length < 3) return null;
  const metrics = calculatePolygonMetrics(input.polygon);
  return {
    key: `lot:${input.id}`,
    label: input.nome,
    polygon: input.polygon,
    centroid: metrics.centroid,
    cropName: input.cropName,
    waterRegime: 'RAINFED',
  };
}
