import NetInfo from '@react-native-community/netinfo';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { MOCK_COMMUNITY_POSTS } from '../data/communityMockData';
import {
  DEFAULT_IRECE_FARM_POLYGON,
  NORDESTE_REGIONS,
} from '../data/seedData';
import { DEFAULT_ACCESSIBILITY, buildSeedSnapshot } from '../database/seedBuilder';
import { sqliteDb } from '../database/sqlite';
import { buildFarmArchitectureModel } from '../models/farmArchitecture';
import { runLocalAgronomicEngine } from '../services/localAgronomicEngine';
import { triggerLocalPreventiveAlert } from '../services/notificationService';
import { syncPendingDataWithCloud } from '../services/syncService';
import { initSpeechBackgroundSync, speakText, stopSpeaking } from '../services/voiceAssistant';
import {
  AccessibilityProfile,
  AppFeedbackItem,
  CommunityPost,
  CommunityTopic,
  CropHistoryRecord,
  EdiblePlantPANC,
  FarmArchitectureModel,
  FarmProperty,
  FarmerProfile,
  FieldValidationLog,
  GeoPoint,
  LeafAnalysisResult,
  PlantingLot,
  ProactiveAlertItem,
  SyncQueueItem,
  WellPoint,
} from '../types/domain';
import { createDefaultLotsForFarm } from '../utils/agronomyHelpers';
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
  feedbacks: AppFeedbackItem[];
  syncQueue: SyncQueueItem[];
  pendingSyncCount: number;
  lastLeafAnalysis: LeafAnalysisResult | null;
  isOnline: boolean;
  simulatedOffline: boolean;
  dryStressBoost: number;
  lastSyncMessage: string | null;
  nordesteMapCompleted: boolean;
  tutorialVisible: boolean;
  communityPosts: CommunityPost[];
  farmArchitecture: FarmArchitectureModel | null;

  setSimulatedOffline: (offline: boolean) => void;
  setNordesteMapCompleted: (done: boolean) => void;
  openTutorial: () => void;
  closeTutorial: (markDone?: boolean) => Promise<void>;
  completeVoiceOnboarding: (enableVoice: boolean) => Promise<void>;
  toggleVoiceGuidance: () => Promise<void>;
  updateAccessibility: (partial: Partial<AccessibilityProfile>) => Promise<void>;
  selectFarmer: (farmerId: string) => Promise<void>;
  saveFarmerProfile: (farmer: FarmerProfile) => Promise<void>;
  updateFarmVariables: (
    patch: Partial<
      Pick<
        FarmerProfile,
        'waterAccess' | 'armazenamentoAgua' | 'laborType' | 'financialTier' | 'objective'
      >
    >
  ) => Promise<void>;
  addCommunityPost: (input: {
    tipo: 'pergunta' | 'relato';
    topico: CommunityTopic;
    titulo: string;
    mensagem: string;
  }) => CommunityPost | null;
  toggleCommunityLike: (postId: string) => void;
  addCommunityReply: (postId: string, texto: string) => void;
  recordCropHistory: (
    input: Omit<CropHistoryRecord, 'id' | 'farmerId' | 'registradaEm'>
  ) => Promise<void>;
  applyRegistrationSetup: (
    farmer: FarmerProfile,
    options: {
      tamanhoEstimadoHa?: number;
      culturaPrincipal?: string;
      polygon?: GeoPoint[];
      lotes?: PlantingLot[];
    }
  ) => Promise<void>;
  updateFarmPolygon: (polygon: GeoPoint[], customName?: string) => Promise<void>;
  updateFarmLots: (lotes: PlantingLot[]) => Promise<void>;
  updateLotDetails: (lotId: string, patch: Partial<PlantingLot>) => Promise<void>;
  selectBahiaRegion: (regionId: string) => Promise<void>;
  updateFarmRadius: (raioKm: number) => Promise<void>;
  simulateDroughtLevel: (boost: number) => Promise<void>;
  simulateRotation: (rotacao: string) => Promise<void>;
  saveLeafAnalysis: (result: LeafAnalysisResult) => Promise<void>;
  markAlertRead: (alertId: string) => Promise<void>;
  registerFieldLog: (
    input: Omit<FieldValidationLog, 'id' | 'criadoEm' | 'sincronizado' | 'farmId'>
  ) => Promise<void>;
  submitAppFeedback: (
    input: Omit<AppFeedbackItem, 'id' | 'criadoEm' | 'sincronizado' | 'farmerId' | 'farmId'>
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
  const [feedbacks, setFeedbacks] = useState<AppFeedbackItem[]>([]);
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
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const [communityPosts, setCommunityPosts] =
    useState<CommunityPost[]>(MOCK_COMMUNITY_POSTS);

  const isOnline = realOnline && !simulatedOffline;

  useEffect(() => {
    let mounted = true;
    const applySnapshot = (snap: ReturnType<typeof buildSeedSnapshot>) => {
      const fallback = buildSeedSnapshot();
      const safeFarmers = snap.usuarios.length > 0 ? snap.usuarios : fallback.usuarios;
      const rawFarms = snap.fazendas.length > 0 ? snap.fazendas : fallback.fazendas;
      const safeFarms = rawFarms.map((f) => ({
        ...f,
        lotes:
          f.lotes && f.lotes.length > 0
            ? f.lotes
            : createDefaultLotsForFarm(
                f.centroid,
                f.areaHectares,
                f.culturaPrincipal,
                f.polygon
              ),
      }));
      setAccessibility(snap.accessibility);
      setFarmers(safeFarmers);
      setFarms(safeFarms);
      setPancs(
        snap.catalogoPancs.length > 0 ? snap.catalogoPancs : fallback.catalogoPancs
      );
      setWells(snap.pocosSiagas.length > 0 ? snap.pocosSiagas : fallback.pocosSiagas);
      setAlerts(snap.alertas);
      setFieldLogs(snap.fieldLogs);
      setFeedbacks(snap.feedbacks ?? []);
      setSyncQueue(snap.syncQueue);
      setActiveFarmerId(snap.activeFarmerId || safeFarmers[0]?.id || 'farmer-maria');
      setActiveFarmId(snap.activeFarmId || safeFarms[0]?.id || 'farm-maria');
      setNordesteMapCompleted(
        Boolean(
          snap.accessibility.registrationCompleted ??
            snap.accessibility.voiceOnboardingCompleted
        )
      );
      setReady(true);
    };

    sqliteDb
      .seedInitialData()
      .then((snap) => {
        if (!mounted) return;
        applySnapshot(snap);
      })
      .catch(() => {
        if (!mounted) return;
        applySnapshot(buildSeedSnapshot());
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        stopSpeaking();
      } else if (!ready || farmers.length === 0 || farms.length === 0) {
        sqliteDb
          .seedInitialData()
          .then((snap) => {
            const fallback = buildSeedSnapshot();
            setAccessibility(snap.accessibility);
            setFarmers(snap.usuarios.length > 0 ? snap.usuarios : fallback.usuarios);
            setFarms(snap.fazendas.length > 0 ? snap.fazendas : fallback.fazendas);
            setNordesteMapCompleted(
              Boolean(
                snap.accessibility.registrationCompleted ??
                  snap.accessibility.voiceOnboardingCompleted
              )
            );
            setReady(true);
          })
          .catch(() => {
            const fallback = buildSeedSnapshot();
            setFarmers((prev) => (prev.length > 0 ? prev : fallback.usuarios));
            setFarms((prev) => (prev.length > 0 ? prev : fallback.fazendas));
            setReady(true);
          });
      }
    });
    return () => sub.remove();
  }, [ready, farmers.length, farms.length]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const connected = Boolean(state.isConnected && state.isInternetReachable !== false);
      setRealOnline(connected);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    return initSpeechBackgroundSync();
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
      const cadastrado =
        accessibility.registrationCompleted &&
        activeFarmer?.tratamento &&
        activeFarmer.tratamento !== 'Agricultor(a)'
          ? activeFarmer.tratamento
          : undefined;
      speakText(text, {
        enabled: accessibility.voiceGuidanceEnabled,
        rate: accessibility.speechRate,
        languageLevel: accessibility.languageLevel,
        tratamento: cadastrado,
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
      setFeedbacks((prev) => prev.map((fb) => ({ ...fb, sincronizado: true })));
    }
    setLastSyncMessage(result.message);
  }, [activeFarm, syncQueue, isOnline, dryStressBoost]);

  useEffect(() => {
    if (ready && isOnline && pendingSyncCount > 0) {
      const timer = setTimeout(() => {
        void triggerSyncNow();
      }, 0);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [ready, isOnline, pendingSyncCount, triggerSyncNow]);

  const completeVoiceOnboarding = useCallback(
    async (enableVoice: boolean) => {
      const next: AccessibilityProfile = {
        ...accessibility,
        voiceOnboardingCompleted: true,
        registrationCompleted: accessibility.registrationCompleted ?? false,
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

  const recordCropHistory = useCallback(
    async (input: Omit<CropHistoryRecord, 'id' | 'farmerId' | 'registradaEm'>) => {
      if (!activeFarmer) return;
      const record: CropHistoryRecord = {
        ...input,
        id: `crop-history-${Date.now()}`,
        farmerId: activeFarmer.id,
        registradaEm: new Date().toISOString(),
      };
      const cropNames = activeFarmer.historicoCultivo ?? [];
      const alreadyListed = cropNames.some(
        (name) => name.trim().toLocaleLowerCase() === record.nomeCultura.trim().toLocaleLowerCase()
      );
      const updatedFarmer: FarmerProfile = {
        ...activeFarmer,
        historicoCultivo: alreadyListed ? cropNames : [...cropNames, record.nomeCultura],
        historicoCultivoDetalhado: [
          record,
          ...(activeFarmer.historicoCultivoDetalhado ?? []),
        ],
      };
      await sqliteDb.upsertUsuario(updatedFarmer);
      setFarmers((prev) => prev.map((farmer) =>
        farmer.id === updatedFarmer.id ? updatedFarmer : farmer
      ));
    },
    [activeFarmer]
  );

  const applyRegistrationSetup = useCallback(
    async (
      farmer: FarmerProfile,
      options: {
        tamanhoEstimadoHa?: number;
        culturaPrincipal?: string;
        polygon?: GeoPoint[];
        lotes?: PlantingLot[];
      }
    ) => {
      await sqliteDb.upsertUsuario(farmer);
      setFarmers((prev) => prev.map((f) => (f.id === farmer.id ? farmer : f)));

      if (activeFarm) {
        const polygon =
          options.polygon && options.polygon.length >= 3
            ? options.polygon
            : createMicroPlotAroundPoint(
                activeFarm.centroid,
                options.tamanhoEstimadoHa ?? activeFarm.areaHectares
              );
        const metrics = calculatePolygonMetrics(polygon);
        const lotsToSave =
          options.lotes && options.lotes.length > 0
            ? options.lotes
            : createDefaultLotsForFarm(
                metrics.centroid,
                metrics.areaHectares,
                options.culturaPrincipal ?? activeFarm.culturaPrincipal,
                polygon
              );
        const primaryLotCrop =
          lotsToSave[0]?.culturaAtual ||
          options.culturaPrincipal ||
          activeFarm.culturaPrincipal;

        const diag = runLocalAgronomicEngine(
          metrics.centroid,
          primaryLotCrop,
          activeFarm.raioBuscaKm,
          { dryStressBoost }
        );
        const updatedFarm: FarmProperty = {
          ...activeFarm,
          culturaPrincipal: primaryLotCrop,
          polygon,
          centroid: metrics.centroid,
          areaHectares: metrics.areaHectares,
          areaTarefasBa: metrics.areaTarefasBa,
          lotes: lotsToSave,
          diagnostico: diag,
        };
        await sqliteDb.upsertFazenda(updatedFarm);
        setFarms((prev) => prev.map((f) => (f.id === updatedFarm.id ? updatedFarm : f)));
      }

      const nextAcc: AccessibilityProfile = {
        ...accessibility,
        registrationCompleted: true,
      };
      setAccessibility(nextAcc);
      await sqliteDb.saveAccessibility(nextAcc);

      setNordesteMapCompleted(true);
      if (!accessibility.tutorialCompleted) {
        setTutorialVisible(true);
      }
    },
    [activeFarm, dryStressBoost, accessibility]
  );

  const openTutorial = useCallback(() => {
    setTutorialVisible(true);
  }, []);

  const closeTutorial = useCallback(
    async (markDone = true) => {
      setTutorialVisible(false);
      if (markDone && !accessibility.tutorialCompleted) {
        const next = { ...accessibility, tutorialCompleted: true };
        setAccessibility(next);
        await sqliteDb.saveAccessibility(next);
      }
    },
    [accessibility]
  );

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

  const updateFarmLots = useCallback(
    async (lotes: PlantingLot[]) => {
      if (!activeFarm) return;
      const primaryCrop = lotes[0]?.culturaAtual || activeFarm.culturaPrincipal;
      const diag = runLocalAgronomicEngine(
        activeFarm.centroid,
        primaryCrop,
        activeFarm.raioBuscaKm,
        { dryStressBoost }
      );
      const updated: FarmProperty = {
        ...activeFarm,
        culturaPrincipal: primaryCrop,
        lotes,
        diagnostico: diag,
      };
      await sqliteDb.upsertFazenda(updated);
      setFarms((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    },
    [activeFarm, dryStressBoost]
  );

  const updateLotDetails = useCallback(
    async (lotId: string, patch: Partial<PlantingLot>) => {
      if (!activeFarm) return;
      const existingLots =
        activeFarm.lotes && activeFarm.lotes.length > 0
          ? activeFarm.lotes
          : createDefaultLotsForFarm(
              activeFarm.centroid,
              activeFarm.areaHectares,
              activeFarm.culturaPrincipal,
              activeFarm.polygon
            );
      const nextLots = existingLots.map((lot) =>
        lot.id === lotId ? { ...lot, ...patch } : lot
      );
      await updateFarmLots(nextLots);
    },
    [activeFarm, updateFarmLots]
  );

  const selectBahiaRegion = useCallback(
    async (regionId: string) => {
      if (!activeFarm) return;
      const preset =
        NORDESTE_REGIONS.find((r) => r.id === regionId) ?? NORDESTE_REGIONS[0];
      const polygon =
        preset.id === 'irece-ba'
          ? DEFAULT_IRECE_FARM_POLYGON
          : createMicroPlotAroundPoint(
              preset.centroid,
              activeFarm.areaHectares || 6.85
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
        lotes: createDefaultLotsForFarm(
          metrics.centroid,
          metrics.areaHectares,
          activeFarm.culturaPrincipal,
          polygon
        ),
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
    const now = new Date().toISOString();
    await sqliteDb.markAlertRead(alertId);
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === alertId
          ? { ...a, lido: true, confirmadoCienteEm: a.confirmadoCienteEm ?? now }
          : a
      )
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

      const chuvaCampoMm =
        input.milimetrosEstimados ??
        (input.intensidadeChuva === 'temporal_forte'
          ? 42
          : input.intensidadeChuva === 'chuva_boa'
          ? 18
          : input.intensidadeChuva === 'garoa_fraca'
          ? 5
          : input.tipo === 'chuva_hoje' && input.choveuHoje
          ? 16
          : 0);

      const soloCampoSeco =
        input.umidadeSoloCampo === 'seca_rachando' ||
        input.umidadeSoloCampo === 'seca_solta' ||
        (input.tipo === 'terra_umida' && input.terraUmida === false);

      const soloEncharcado = input.umidadeSoloCampo === 'encharcada';
      const estressePlantaCampo =
        input.estadoLavoura === 'murcha_sol' ||
        input.estadoLavoura === 'amarelada' ||
        input.estadoLavoura === 'com_pragas';
      const sinaisErosaoCampo = Boolean(input.sinaisErosao);

      if (
        chuvaCampoMm > 0 ||
        soloCampoSeco ||
        soloEncharcado ||
        estressePlantaCampo ||
        sinaisErosaoCampo
      ) {
        const diag = runLocalAgronomicEngine(
          activeFarm.centroid,
          activeFarm.culturaPrincipal,
          activeFarm.raioBuscaKm,
          {
            dryStressBoost,
            chuvaCampoMm,
            soloCampoSeco,
            soloEncharcado,
            estressePlantaCampo,
            sinaisErosaoCampo,
          }
        );
        const updated: FarmProperty = { ...activeFarm, diagnostico: diag };
        await sqliteDb.upsertFazenda(updated);
        setFarms((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));

        if (sinaisErosaoCampo || input.estadoLavoura === 'com_pragas') {
          const alertItem: ProactiveAlertItem = {
            id: `alert-campo-${Date.now()}`,
            categoria: input.estadoLavoura === 'com_pragas' ? 'fitossanitario' : 'seca',
            severidade: 'atencao',
            titulo: sinaisErosaoCampo
              ? 'Sinais de enxurrada/erosão no terreno'
              : 'Praga ou doença observada na lavoura',
            mensagemAcessivel: sinaisErosaoCampo
              ? 'Você marcou água levando terra no campo. Proteja o solo com palha ou barreiras vivas de palma.'
              : `Atenção às plantas (${input.pragaOuDoenca || 'pragas/manchas'}). Use a câmera na aba Safra para examinar uma folha.`,
            mensagemTecnica: sinaisErosaoCampo
              ? 'Validação de campo indicou escoamento superficial erosivo. Recomenda-se plantio em contorno e cobertura morta.'
              : `Ocorrência fitossanitária registrada em campo: ${input.pragaOuDoenca || 'sintoma foliar'}.`,
            criadoEm: now,
            lido: false,
          };
          await sqliteDb.addAlert(alertItem);
          setAlerts((prev) => [alertItem, ...prev.slice(0, 8)]);
        }
      }

      setLastSyncMessage(
        isOnline
          ? 'Sincronizado: validação de campo salva e enviada.'
          : 'Modo Roça Offline: validação salva no aparelho para enviar quando houver sinal.'
      );
    },
    [activeFarm, isOnline, dryStressBoost]
  );

  const submitAppFeedback = useCallback(
    async (
      input: Omit<
        AppFeedbackItem,
        'id' | 'criadoEm' | 'sincronizado' | 'farmerId' | 'farmId'
      >
    ) => {
      if (!activeFarm || !activeFarmer) return;
      const now = new Date().toISOString();
      const feedbackItem: AppFeedbackItem = {
        ...input,
        id: `fb-${Date.now()}`,
        farmerId: activeFarmer.id,
        farmId: activeFarm.id,
        criadoEm: now,
        sincronizado: isOnline,
      };
      const queueItem: SyncQueueItem = {
        id: `sync-fb-${Date.now()}`,
        endpoint: '/api/app/feedback',
        payloadJson: JSON.stringify(feedbackItem),
        status: isOnline ? 'sincronizado' : 'pendente',
        criadoEm: now,
        tentativas: isOnline ? 1 : 0,
      };
      await sqliteDb.addFeedbackAndEnqueue(feedbackItem, queueItem);
      setFeedbacks((prev) => [feedbackItem, ...prev]);
      setSyncQueue((prev) => [queueItem, ...prev]);
      setLastSyncMessage(
        isOnline
          ? 'Obrigado! Sua opinião foi registrada e enviada.'
          : 'Obrigado! Sua opinião foi salva offline e será enviada quando houver sinal.'
      );
    },
    [activeFarm, activeFarmer, isOnline]
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
    setFeedbacks(snap.feedbacks ?? []);
    setSyncQueue(snap.syncQueue);
    setActiveFarmerId(snap.activeFarmerId);
    setActiveFarmId(snap.activeFarmId);
    setDryStressBoost(0);
    setLastLeafAnalysis(null);
    setNordesteMapCompleted(false);
    setTutorialVisible(false);
    setCommunityPosts(MOCK_COMMUNITY_POSTS);
    setLastSyncMessage(null);
  }, []);

  const updateFarmVariables = useCallback(
    async (
      patch: Partial<
        Pick<
          FarmerProfile,
          'waterAccess' | 'armazenamentoAgua' | 'laborType' | 'financialTier' | 'objective'
        >
      >
    ) => {
      if (!activeFarmer) return;
      await saveFarmerProfile({
        ...activeFarmer,
        ...patch,
      });
    },
    [activeFarmer, saveFarmerProfile]
  );

  const addCommunityPost = useCallback(
    (input: {
      tipo: 'pergunta' | 'relato';
      topico: CommunityTopic;
      titulo: string;
      mensagem: string;
    }): CommunityPost | null => {
      if (!activeFarm || !activeFarmer) return null;
      const newPost: CommunityPost = {
        id: `post-${Date.now()}`,
        autor: activeFarmer.tratamento || activeFarmer.nome || 'Agricultor(a)',
        regiaoNome: activeFarm.regiaoNome,
        municipio: activeFarm.municipio,
        estado: activeFarm.estado,
        bioma: activeFarm.bioma,
        centroid: activeFarm.centroid,
        topico: input.topico,
        tipo: input.tipo,
        titulo: input.titulo,
        mensagem: input.mensagem,
        curtidas: 1,
        curtidoPorMim: true,
        haQuantoTempo: 'agora mesmo',
        respostas: [],
      };
      setCommunityPosts((prev) => [newPost, ...prev]);
      return newPost;
    },
    [activeFarm, activeFarmer]
  );

  const toggleCommunityLike = useCallback((postId: string) => {
    setCommunityPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const liked = !p.curtidoPorMim;
        return {
          ...p,
          curtidoPorMim: liked,
          curtidas: Math.max(0, p.curtidas + (liked ? 1 : -1)),
        };
      })
    );
  }, []);

  const addCommunityReply = useCallback(
    (postId: string, texto: string) => {
      if (!activeFarm || !activeFarmer) return;
      setCommunityPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                respostas: [
                  ...p.respostas,
                  {
                    id: `rep-${Date.now()}`,
                    autor: activeFarmer.tratamento || activeFarmer.nome || 'Agricultor(a)',
                    regiaoNome: activeFarm.regiaoNome,
                    municipio: activeFarm.municipio,
                    texto,
                    criadoEm: 'agora mesmo',
                  },
                ],
              }
            : p
        )
      );
    },
    [activeFarm, activeFarmer]
  );

  const farmArchitecture = useMemo<FarmArchitectureModel | null>(() => {
    if (!activeFarm || !activeFarmer) return null;
    return buildFarmArchitectureModel(activeFarm, activeFarmer, communityPosts);
  }, [activeFarm, activeFarmer, communityPosts]);

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
      feedbacks,
      syncQueue,
      pendingSyncCount,
      lastLeafAnalysis,
      isOnline,
      simulatedOffline,
      dryStressBoost,
      lastSyncMessage,
      nordesteMapCompleted,
      tutorialVisible,
      communityPosts,
      farmArchitecture,
      setSimulatedOffline,
      setNordesteMapCompleted,
      openTutorial,
      closeTutorial,
      completeVoiceOnboarding,
      toggleVoiceGuidance,
      updateAccessibility,
      selectFarmer,
      saveFarmerProfile,
      updateFarmVariables,
      addCommunityPost,
      toggleCommunityLike,
      addCommunityReply,
      recordCropHistory,
      applyRegistrationSetup,
      updateFarmPolygon,
      updateFarmLots,
      updateLotDetails,
      selectBahiaRegion,
      updateFarmRadius,
      simulateDroughtLevel,
      simulateRotation,
      saveLeafAnalysis,
      markAlertRead,
      registerFieldLog,
      submitAppFeedback,
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
      feedbacks,
      syncQueue,
      pendingSyncCount,
      lastLeafAnalysis,
      isOnline,
      simulatedOffline,
      dryStressBoost,
      lastSyncMessage,
      nordesteMapCompleted,
      tutorialVisible,
      communityPosts,
      farmArchitecture,
      openTutorial,
      closeTutorial,
      completeVoiceOnboarding,
      toggleVoiceGuidance,
      updateAccessibility,
      selectFarmer,
      saveFarmerProfile,
      updateFarmVariables,
      addCommunityPost,
      toggleCommunityLike,
      addCommunityReply,
      recordCropHistory,
      applyRegistrationSetup,
      updateFarmPolygon,
      updateFarmLots,
      updateLotDetails,
      selectBahiaRegion,
      updateFarmRadius,
      simulateDroughtLevel,
      simulateRotation,
      saveLeafAnalysis,
      markAlertRead,
      registerFieldLog,
      submitAppFeedback,
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
