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
import type { SavedRotationPlan } from '../types/rotationPlan';
import { ROTATION_PLAN_KEY_PREFIX, rotationPlanKey } from './rotationPlanKey';

const STORAGE_KEY = 'rocaviva_sqlite_web_v1';
const LANGUAGE_KEY = 'rocaviva.interface-language';
let memoryStore: LocalDatabaseSnapshot | null = null;

export async function readInterfaceLanguage() {
  const value = window.localStorage.getItem(LANGUAGE_KEY);
  return value === 'pt' || value === 'en' ? value : null;
}

export async function writeInterfaceLanguage(language: 'en' | 'pt') {
  window.localStorage.setItem(LANGUAGE_KEY, language);
}

export async function loadRotationPlan(farmId: string, lotId: string): Promise<SavedRotationPlan | null> {
  const raw = window.localStorage.getItem(rotationPlanKey(farmId, lotId));
  return raw === null ? null : JSON.parse(raw) as SavedRotationPlan;
}

export async function saveRotationPlan(farmId: string, lotId: string, plan: SavedRotationPlan): Promise<void> {
  window.localStorage.setItem(rotationPlanKey(farmId, lotId), JSON.stringify(plan));
}

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
    if (typeof window !== 'undefined') {
      try {
        const storage = window.localStorage;
        for (let i = storage.length - 1; i >= 0; i--) {
          const key = storage.key(i);
          if (key?.startsWith(ROTATION_PLAN_KEY_PREFIX)) storage.removeItem(key);
        }
      } catch {
        // Em ambientes sem armazenamento, o restante do app usa memória.
      }
    }
    const fresh = buildSeedSnapshot();
    writeStore(fresh);
    return fresh;
  },
};
