import {
  AccessibilityProfile,
  AppFeedbackItem,
  EdiblePlantPANC,
  FarmProperty,
  FarmerProfile,
  FieldValidationLog,
  ProactiveAlertItem,
  SyncQueueItem,
  WellPoint,
} from '../types/domain';
import { LocalDatabaseSnapshot, buildSeedSnapshot } from './seedBuilder';

const STORAGE_KEY = 'rocaviva_sqlite_web_v3';
let memoryStore: LocalDatabaseSnapshot | null = null;

function readStore(): LocalDatabaseSnapshot {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LocalDatabaseSnapshot;
        return {
          ...parsed,
          feedbacks: parsed.feedbacks ?? [],
          fieldLogs: parsed.fieldLogs ?? [],
          syncQueue: parsed.syncQueue ?? [],
        };
      }
    } catch {
      // Fallback em memória
    }
  }
  if (!memoryStore) memoryStore = buildSeedSnapshot();
  return memoryStore;
}

function writeStore(snapshot: LocalDatabaseSnapshot): void {
  memoryStore = snapshot;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Ignora erro de cota
    }
  }
}

export interface SqliteRepository {
  seedInitialData(): Promise<LocalDatabaseSnapshot>;
  saveAccessibility(prefs: AccessibilityProfile): Promise<void>;
  setActiveSelection(farmerId: string, farmId: string): Promise<void>;
  upsertUsuario(farmer: FarmerProfile): Promise<void>;
  upsertFazenda(farm: FarmProperty): Promise<void>;
  addAlert(alert: ProactiveAlertItem): Promise<void>;
  markAlertRead(alertId: string): Promise<void>;
  addFieldLogAndEnqueue(log: FieldValidationLog, queueItem: SyncQueueItem): Promise<void>;
  addFeedbackAndEnqueue(feedback: AppFeedbackItem, queueItem: SyncQueueItem): Promise<void>;
  markQueueSynced(queueIds: string[]): Promise<void>;
  queryPancsByBiomeAndPh(bioma: string, ph: number): Promise<EdiblePlantPANC[]>;
  getAllWells(): Promise<WellPoint[]>;
  resetDatabase(): Promise<LocalDatabaseSnapshot>;
}

export const sqliteDb: SqliteRepository = {
  async seedInitialData() {
    const snap = readStore();
    writeStore(snap);
    return snap;
  },

  async saveAccessibility(prefs) {
    const snap = readStore();
    snap.accessibility = prefs;
    writeStore(snap);
  },

  async setActiveSelection(farmerId, farmId) {
    const snap = readStore();
    snap.activeFarmerId = farmerId;
    snap.activeFarmId = farmId;
    writeStore(snap);
  },

  async upsertUsuario(farmer) {
    const snap = readStore();
    const idx = snap.usuarios.findIndex((u) => u.id === farmer.id);
    if (idx >= 0) snap.usuarios[idx] = farmer;
    else snap.usuarios.push(farmer);
    writeStore(snap);
  },

  async upsertFazenda(farm) {
    const snap = readStore();
    const idx = snap.fazendas.findIndex((f) => f.id === farm.id);
    if (idx >= 0) snap.fazendas[idx] = farm;
    else snap.fazendas.push(farm);
    writeStore(snap);
  },

  async addAlert(alert) {
    const snap = readStore();
    snap.alertas = [alert, ...snap.alertas.filter((a) => a.id !== alert.id)];
    writeStore(snap);
  },

  async markAlertRead(alertId) {
    const snap = readStore();
    const now = new Date().toISOString();
    snap.alertas = snap.alertas.map((a) =>
      a.id === alertId
        ? { ...a, lido: true, confirmadoCienteEm: a.confirmadoCienteEm ?? now }
        : a
    );
    writeStore(snap);
  },

  async addFieldLogAndEnqueue(log, queueItem) {
    const snap = readStore();
    snap.fieldLogs = [log, ...snap.fieldLogs];
    snap.syncQueue = [queueItem, ...snap.syncQueue];
    writeStore(snap);
  },

  async addFeedbackAndEnqueue(feedback, queueItem) {
    const snap = readStore();
    snap.feedbacks = [feedback, ...(snap.feedbacks ?? [])];
    snap.syncQueue = [queueItem, ...snap.syncQueue];
    writeStore(snap);
  },

  async markQueueSynced(queueIds) {
    const snap = readStore();
    const ids = new Set(queueIds);
    snap.syncQueue = snap.syncQueue.map((q) =>
      ids.has(q.id) ? { ...q, status: 'sincronizado' } : q
    );
    snap.fieldLogs = snap.fieldLogs.map((l) => ({ ...l, sincronizado: true }));
    snap.feedbacks = (snap.feedbacks ?? []).map((fb) => ({ ...fb, sincronizado: true }));
    writeStore(snap);
  },

  async queryPancsByBiomeAndPh(bioma, ph) {
    const snap = readStore();
    return snap.catalogoPancs.filter(
      (p) => p.biomas.includes(bioma) && ph >= p.phMin - 0.5 && ph <= p.phMax + 0.5
    );
  },

  async getAllWells() {
    return readStore().pocosSiagas;
  },

  async resetDatabase() {
    const fresh = buildSeedSnapshot();
    writeStore(fresh);
    return fresh;
  },
};
