import NetInfo from '@react-native-community/netinfo';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { NORDESTE_REGIONS } from '../data/seedData';
import { DEFAULT_ACCESSIBILITY } from '../database/seedBuilder';
import { sqliteDb } from '../database/sqlite';
import { runLocalAgronomicEngine } from '../services/localAgronomicEngine';
import { triggerLocalPreventiveAlert } from '../services/notificationService';
import { syncPendingDataWithCloud } from '../services/syncService';
import { speakText, stopSpeaking } from '../services/voiceAssistant';
import {
  AccessibilityProfile,
  EdiblePlantPANC,
  FarmProperty,
  FarmerProfile,
  FieldValidationLog,
  GeoPoint,
  LeafAnalysisResult,
  ProactiveAlertItem,
  SyncQueueItem,
  WellPoint,
} from '../types/domain';
import { calculatePolygonMetrics, createMicroPlotAroundPoint } from '../utils/geoprocessing';

interface AccessibilityContextValue {
  ready: boolean;
  accessibility: AccessibilityProfile;
  farmers: FarmerProfile[];
  activeFarmer: FarmerProfile;
  farms: FarmProperty[];
  activeFarm: FarmProperty;
  compatiblePancs: EdiblePlantPANC[];
  wells: WellPoint[];
  alerts: ProactiveAlertItem[];
  unreadAlertsCount: number;
  fieldLogs: FieldValidationLog[];
  syncQueue: SyncQueueItem[];
  pendingSyncCount: number;
  lastLeafAnalysis: LeafAnalysisResult | null;
  isOnline: boolean;
  simulatedOffline: boolean;
  dryStressBoost: number;
  lastSyncMessage: string | null;
  nordesteMapCompleted: boolean;

  setSimulatedOffline: (offline: boolean) => void;
  setNordesteMapCompleted: (done: boolean) => void;
  completeVoiceOnboarding: (enableVoice: boolean) => Promise<void>;
  toggleVoiceGuidance: () => Promise<void>;
  updateAccessibility: (partial: Partial<AccessibilityProfile>) => Promise<void>;
  selectFarmer: (farmerId: string) => Promise<void>;
  saveFarmerProfile: (farmer: FarmerProfile) => Promise<void>;
  updateFarmPolygon: (polygon: GeoPoint[], customName?: string) => Promise<void>;
  selectBahiaRegion: (regionId: string) => Promise<void>;
  updateFarmRadius: (raioKm: number) => Promise<void>;
  simulateDroughtLevel: (boost: number) => Promise<void>;
  simulateRotation: (rotacao: string) => Promise<void>;
  saveLeafAnalysis: (result: LeafAnalysisResult) => Promise<void>;
  markAlertRead: (alertId: string) => Promise<void>;
  registerFieldLog: (
    input: Omit<FieldValidationLog, 'id' | 'criadoEm' | 'sincronizado' | 'farmId'>
  ) => Promise<void>;
  triggerSyncNow: () => Promise<void>;
  speak: (text: string, force?: boolean) => void;
  stopVoice: () => void;
  resetDemoData: () => Promise<void>;
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [ready, setReady] = useState(false);
  const [accessibility, setAccessibility] =
    useState<AccessibilityProfile>(DEFAULT_ACCESSIBILITY);
  const [farmers, setFarmers] = useState<FarmerProfile[]>([]);
  const [farms, setFarms] = useState<FarmProperty[]>([]);
  const [pancs, setPancs] = useState<EdiblePlantPANC[]>([]);
  const [wells, setWells] = useState<WellPoint[]>([]);
  const [alerts, setAlerts] = useState<ProactiveAlertItem[]>([]);
  const [fieldLogs, setFieldLogs] = useState<FieldValidationLog[]>([]);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const [lastLeafAnalysis, setLastLeafAnalysis] = useState<LeafAnalysisResult | null>(
    null
  );
  const [activeFarmerId, setActiveFarmerId] = useState('');
  const [activeFarmId, setActiveFarmId] = useState('');
  const [realOnline, setRealOnline] = useState(true);
  const [simulatedOffline, setSimulatedOffline] = useState(false);
  const [dryStressBoost, setDryStressBoost] = useState(0);
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null);
  const [nordesteMapCompleted, setNordesteMapCompleted] = useState(false);

  const isOnline = realOnline && !simulatedOffline;

  useEffect(() => {
    let mounted = true;
    sqliteDb.seedInitialData().then((snap) => {
      if (!mounted) return;
      setAccessibility(snap.accessibility);
      setFarmers(snap.usuarios);
      setFarms(snap.fazendas);
      setPancs(snap.catalogoPancs);
      setWells(snap.pocosSiagas);
      setAlerts(snap.alertas);
      setFieldLogs(snap.fieldLogs);
      setSyncQueue(snap.syncQueue);
      setActiveFarmerId(snap.activeFarmerId);
      setActiveFarmId(snap.activeFarmId);
      setNordesteMapCompleted(snap.accessibility.voiceOnboardingCompleted);
      setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const connected = Boolean(state.isConnected && state.isInternetReachable !== false);
      setRealOnline(connected);
    });
    return () => unsub();
  }, []);

  const activeFarmer = useMemo(
    () => farmers.find((f) => f.id === activeFarmerId) ?? farmers[0],
    [farmers, activeFarmerId]
  );

  const activeFarm = useMemo(
    () =>
      farms.find((f) => f.id === activeFarmId) ??
      farms.find((f) => f.farmerId === activeFarmer?.id) ??
      farms[0],
    [farms, activeFarmId, activeFarmer]
  );

  const compatiblePancs = useMemo(() => {
    if (!activeFarm) return pancs;
    const ph = activeFarm.diagnostico.soloSoilGrids.ph;
    const filtered = pancs.filter(
      (p) =>
        p.biomas.includes(activeFarm.bioma) &&
        ph >= p.phMin - 0.5 &&
        ph <= p.phMax + 0.5
    );
    return filtered.length > 0 ? filtered : pancs;
  }, [pancs, activeFarm]);

  const pendingSyncCount = useMemo(
    () => syncQueue.filter((q) => q.status === 'pendente').length,
    [syncQueue]
  );

  const unreadAlertsCount = useMemo(
    () => alerts.filter((a) => !a.lido).length,
    [alerts]
  );

  const speak = useCallback(
    (text: string, force = false) => {
      speakText(text, {
        enabled: accessibility.voiceGuidanceEnabled,
        rate: accessibility.speechRate,
        languageLevel: accessibility.languageLevel,
        tratamento: activeFarmer?.tratamento,
        force,
      });
    },
    [accessibility, activeFarmer]
  );

  const stopVoice = useCallback(() => {
    stopSpeaking();
  }, []);

  const triggerSyncNow = useCallback(async () => {
    if (!activeFarm) return;
    const pendingItems = syncQueue.filter((q) => q.status === 'pendente');
    const result = await syncPendingDataWithCloud({
      isOnline,
      farm: activeFarm,
      pendingQueue: pendingItems,
      dryStressBoost,
    });

    if (result.mode === 'offline') {
      setLastSyncMessage(result.message);
      return;
    }

    const updatedFarm: FarmProperty = {
      ...activeFarm,
      diagnostico: result.updatedDiagnostics,
    };
    await sqliteDb.upsertFazenda(updatedFarm);
    setFarms((prev) => prev.map((f) => (f.id === updatedFarm.id ? updatedFarm : f)));

    if (result.syncedItemIds.length > 0) {
      await sqliteDb.markQueueSynced(result.syncedItemIds);
      const idSet = new Set(result.syncedItemIds);
      setSyncQueue((prev) =>
        prev.map((q) => (idSet.has(q.id) ? { ...q, status: 'sincronizado' } : q))
      );
      setFieldLogs((prev) => prev.map((l) => ({ ...l, sincronizado: true })));
    }
    setLastSyncMessage(result.message);
  }, [activeFarm, syncQueue, isOnline, dryStressBoost]);

  useEffect(() => {
    if (ready && isOnline && pendingSyncCount > 0) {
      triggerSyncNow();
    }
  }, [ready, isOnline, pendingSyncCount, triggerSyncNow]);

  const completeVoiceOnboarding = useCallback(
    async (enableVoice: boolean) => {
      const next: AccessibilityProfile = {
        ...accessibility,
        voiceOnboardingCompleted: true,
        voiceGuidanceEnabled: enableVoice,
      };
      setAccessibility(next);
      await sqliteDb.saveAccessibility(next);
      if (enableVoice) {
        speakText(
          'Guia por voz ativado. Escolha sua região na Bahia ou Nordeste no mapa.',
          { enabled: true, rate: next.speechRate, languageLevel: next.languageLevel }
        );
      } else {
        stopSpeaking();
      }
    },
    [accessibility]
  );

  const toggleVoiceGuidance = useCallback(async () => {
    const nextEnabled = !accessibility.voiceGuidanceEnabled;
    const next = { ...accessibility, voiceGuidanceEnabled: nextEnabled };
    setAccessibility(next);
    await sqliteDb.saveAccessibility(next);
    if (nextEnabled) {
      speakText('Leitura em voz alta ligada.', {
        enabled: true,
        rate: next.speechRate,
        languageLevel: next.languageLevel,
      });
    } else {
      stopSpeaking();
    }
  }, [accessibility]);

  const updateAccessibility = useCallback(
    async (partial: Partial<AccessibilityProfile>) => {
      const next = { ...accessibility, ...partial };
      setAccessibility(next);
      await sqliteDb.saveAccessibility(next);
    },
    [accessibility]
  );

  const selectFarmer = useCallback(
    async (farmerId: string) => {
      const targetFarm = farms.find((f) => f.farmerId === farmerId) ?? farms[0];
      setActiveFarmerId(farmerId);
      if (targetFarm) {
        setActiveFarmId(targetFarm.id);
        await sqliteDb.setActiveSelection(farmerId, targetFarm.id);
      }
    },
    [farms]
  );

  const saveFarmerProfile = useCallback(async (farmer: FarmerProfile) => {
    await sqliteDb.upsertUsuario(farmer);
    setFarmers((prev) => prev.map((f) => (f.id === farmer.id ? farmer : f)));
  }, []);

  const updateFarmPolygon = useCallback(
    async (polygon: GeoPoint[], customName?: string) => {
      if (!activeFarm) return;
      const metrics = calculatePolygonMetrics(polygon);
      const diag = runLocalAgronomicEngine(
        metrics.centroid,
        activeFarm.culturaPrincipal,
        activeFarm.raioBuscaKm,
        { dryStressBoost }
      );
      const updated: FarmProperty = {
        ...activeFarm,
        nome: customName ?? activeFarm.nome,
        polygon,
        centroid: metrics.centroid,
        areaHectares: metrics.areaHectares,
        areaTarefasBa: metrics.areaTarefasBa,
        diagnostico: diag,
      };
      await sqliteDb.upsertFazenda(updated);
      setFarms((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    },
    [activeFarm, dryStressBoost]
  );

  const selectBahiaRegion = useCallback(
    async (regionId: string) => {
      if (!activeFarm) return;
      const preset =
        NORDESTE_REGIONS.find((r) => r.id === regionId) ?? NORDESTE_REGIONS[0];
      const polygon = createMicroPlotAroundPoint(
        preset.centroid,
        activeFarm.areaHectares || 4.2
      );
      const metrics = calculatePolygonMetrics(polygon);
      const diag = runLocalAgronomicEngine(
        metrics.centroid,
        activeFarm.culturaPrincipal,
        activeFarm.raioBuscaKm,
        { dryStressBoost }
      );
      const updated: FarmProperty = {
        ...activeFarm,
        municipio: preset.municipio,
        estado: preset.estado,
        regiaoNome: preset.nome,
        bioma: preset.bioma,
        centroid: metrics.centroid,
        polygon,
        areaHectares: metrics.areaHectares,
        areaTarefasBa: metrics.areaTarefasBa,
        diagnostico: diag,
      };
      await sqliteDb.upsertFazenda(updated);
      setFarms((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    },
    [activeFarm, dryStressBoost]
  );

  const updateFarmRadius = useCallback(
    async (raioKm: number) => {
      if (!activeFarm) return;
      const diag = runLocalAgronomicEngine(
        activeFarm.centroid,
        activeFarm.culturaPrincipal,
        raioKm,
        { dryStressBoost }
      );
      const updated: FarmProperty = { ...activeFarm, raioBuscaKm: raioKm, diagnostico: diag };
      await sqliteDb.upsertFazenda(updated);
      setFarms((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    },
    [activeFarm, dryStressBoost]
  );

  const simulateDroughtLevel = useCallback(
    async (boost: number) => {
      setDryStressBoost(boost);
      if (!activeFarm) return;
      const diag = runLocalAgronomicEngine(
        activeFarm.centroid,
        activeFarm.culturaPrincipal,
        activeFarm.raioBuscaKm,
        { dryStressBoost: boost }
      );
      const updated: FarmProperty = { ...activeFarm, diagnostico: diag };
      await sqliteDb.upsertFazenda(updated);
      setFarms((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));

      if (diag.modeloB.nivel === 'alerta' || diag.modeloB.nivel === 'seca_confirmada') {
        const alertItem: ProactiveAlertItem = {
          id: `alert-seca-${Date.now()}`,
          categoria: 'seca',
          severidade: diag.modeloB.nivel === 'seca_confirmada' ? 'urgente' : 'atencao',
          titulo:
            diag.modeloB.nivel === 'seca_confirmada'
              ? 'Seca confirmada: ative plantas resistentes (PANCs)'
              : 'Alerta de seca na roça (2+ sinais)',
          mensagemAcessivel: diag.modeloB.resumoAcessivel,
          mensagemTecnica: diag.modeloB.resumoTecnico,
          criadoEm: new Date().toISOString(),
          lido: false,
        };
        await sqliteDb.addAlert(alertItem);
        setAlerts((prev) => [alertItem, ...prev.slice(0, 8)]);
        await triggerLocalPreventiveAlert(alertItem.titulo, alertItem.mensagemAcessivel);
        if (accessibility.voiceGuidanceEnabled) {
          speak(diag.modeloB.resumoAcessivel);
        }
      }
    },
    [activeFarm, accessibility.voiceGuidanceEnabled, speak]
  );

  const simulateRotation = useCallback(
    async (rotacao: string) => {
      if (!activeFarm) return;
      const diag = runLocalAgronomicEngine(
        activeFarm.centroid,
        rotacao,
        activeFarm.raioBuscaKm,
        { dryStressBoost, rotacaoSelecionada: rotacao }
      );
      const updated: FarmProperty = {
        ...activeFarm,
        culturaPrincipal: rotacao,
        diagnostico: diag,
      };
      await sqliteDb.upsertFazenda(updated);
      setFarms((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    },
    [activeFarm, dryStressBoost]
  );

  const saveLeafAnalysis = useCallback(
    async (result: LeafAnalysisResult) => {
      setLastLeafAnalysis(result);
      if (!activeFarm) return;
      const now = new Date().toISOString();
      const log: FieldValidationLog = {
        id: `log-leaf-${Date.now()}`,
        farmId: activeFarm.id,
        tipo: 'analise_foliar',
        observacao: `${result.titulo} (Verde ${result.indiceVerdePct}% / Amarelo ${result.amarelamentoPct}%)`,
        criadoEm: now,
        sincronizado: isOnline,
      };
      const queueItem: SyncQueueItem = {
        id: `sync-leaf-${Date.now()}`,
        endpoint: '/api/fazendas/analise-foliar',
        payloadJson: JSON.stringify(log),
        status: isOnline ? 'sincronizado' : 'pendente',
        criadoEm: now,
        tentativas: isOnline ? 1 : 0,
      };
      await sqliteDb.addFieldLogAndEnqueue(log, queueItem);
      setFieldLogs((prev) => [log, ...prev]);
      setSyncQueue((prev) => [queueItem, ...prev]);
    },
    [activeFarm, isOnline]
  );

  const markAlertRead = useCallback(async (alertId: string) => {
    await sqliteDb.markAlertRead(alertId);
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, lido: true } : a))
    );
  }, []);

  const registerFieldLog = useCallback(
    async (
      input: Omit<FieldValidationLog, 'id' | 'criadoEm' | 'sincronizado' | 'farmId'>
    ) => {
      if (!activeFarm) return;
      const now = new Date().toISOString();
      const log: FieldValidationLog = {
        ...input,
        id: `log-${Date.now()}`,
        farmId: activeFarm.id,
        criadoEm: now,
        sincronizado: isOnline,
      };
      const queueItem: SyncQueueItem = {
        id: `sync-${Date.now()}`,
        endpoint: '/api/fazendas/validacao-campo',
        payloadJson: JSON.stringify(log),
        status: isOnline ? 'sincronizado' : 'pendente',
        criadoEm: now,
        tentativas: isOnline ? 1 : 0,
      };
      await sqliteDb.addFieldLogAndEnqueue(log, queueItem);
      setFieldLogs((prev) => [log, ...prev]);
      setSyncQueue((prev) => [queueItem, ...prev]);

      if (input.tipo === 'chuva_hoje' && input.choveuHoje) {
        const diag = runLocalAgronomicEngine(
          activeFarm.centroid,
          activeFarm.culturaPrincipal,
          activeFarm.raioBuscaKm,
          { dryStressBoost, chuvaCampoMm: 16 }
        );
        const updated: FarmProperty = { ...activeFarm, diagnostico: diag };
        await sqliteDb.upsertFazenda(updated);
        setFarms((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      }

      setLastSyncMessage(
        isOnline
          ? 'Sincronizado: registro enviado automaticamente.'
          : 'Modo Roça Offline: salvo no aparelho para enviar quando houver sinal.'
      );
    },
    [activeFarm, isOnline, dryStressBoost]
  );

  const resetDemoData = useCallback(async () => {
    const snap = await sqliteDb.resetDatabase();
    setAccessibility(snap.accessibility);
    setFarmers(snap.usuarios);
    setFarms(snap.fazendas);
    setPancs(snap.catalogoPancs);
    setWells(snap.pocosSiagas);
    setAlerts(snap.alertas);
    setFieldLogs(snap.fieldLogs);
    setSyncQueue(snap.syncQueue);
    setActiveFarmerId(snap.activeFarmerId);
    setActiveFarmId(snap.activeFarmId);
    setDryStressBoost(0);
    setLastLeafAnalysis(null);
    setNordesteMapCompleted(false);
    setLastSyncMessage(null);
  }, []);

  const value = useMemo<AccessibilityContextValue>(
    () => ({
      ready,
      accessibility,
      farmers,
      activeFarmer,
      farms,
      activeFarm,
      compatiblePancs,
      wells,
      alerts,
      unreadAlertsCount,
      fieldLogs,
      syncQueue,
      pendingSyncCount,
      lastLeafAnalysis,
      isOnline,
      simulatedOffline,
      dryStressBoost,
      lastSyncMessage,
      nordesteMapCompleted,
      setSimulatedOffline,
      setNordesteMapCompleted,
      completeVoiceOnboarding,
      toggleVoiceGuidance,
      updateAccessibility,
      selectFarmer,
      saveFarmerProfile,
      updateFarmPolygon,
      selectBahiaRegion,
      updateFarmRadius,
      simulateDroughtLevel,
      simulateRotation,
      saveLeafAnalysis,
      markAlertRead,
      registerFieldLog,
      triggerSyncNow,
      speak,
      stopVoice,
      resetDemoData,
    }),
    [
      ready,
      accessibility,
      farmers,
      activeFarmer,
      farms,
      activeFarm,
      compatiblePancs,
      wells,
      alerts,
      unreadAlertsCount,
      fieldLogs,
      syncQueue,
      pendingSyncCount,
      lastLeafAnalysis,
      isOnline,
      simulatedOffline,
      dryStressBoost,
      lastSyncMessage,
      nordesteMapCompleted,
      completeVoiceOnboarding,
      toggleVoiceGuidance,
      updateAccessibility,
      selectFarmer,
      saveFarmerProfile,
      updateFarmPolygon,
      selectBahiaRegion,
      updateFarmRadius,
      simulateDroughtLevel,
      simulateRotation,
      saveLeafAnalysis,
      markAlertRead,
      registerFieldLog,
      triggerSyncNow,
      speak,
      stopVoice,
      resetDemoData,
    ]
  );

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export function useAccessibility(): AccessibilityContextValue {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error('useAccessibility deve ser usado dentro de AccessibilityProvider');
  return ctx;
}
