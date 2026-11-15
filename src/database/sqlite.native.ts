import * as SQLite from 'expo-sqlite';
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
import { SqliteRepository } from './sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('rocaviva.db');
  }
  return dbPromise;
}

async function createTables(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY NOT NULL,
      payload_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS fazendas (
      id TEXT PRIMARY KEY NOT NULL,
      farmer_id TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS diagnosticos_nasa (
      farm_id TEXT PRIMARY KEY NOT NULL,
      atualizado_em TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pocos_siagas_local (
      id TEXT PRIMARY KEY NOT NULL,
      payload_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS catalogo_pancs (
      id TEXT PRIMARY KEY NOT NULL,
      ph_min REAL NOT NULL,
      ph_max REAL NOT NULL,
      payload_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS alertas (
      id TEXT PRIMARY KEY NOT NULL,
      criado_em TEXT NOT NULL,
      lido INTEGER NOT NULL,
      payload_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS field_logs (
      id TEXT PRIMARY KEY NOT NULL,
      criado_em TEXT NOT NULL,
      sincronizado INTEGER NOT NULL,
      payload_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_feedbacks (
      id TEXT PRIMARY KEY NOT NULL,
      criado_em TEXT NOT NULL,
      sincronizado INTEGER NOT NULL,
      payload_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY NOT NULL,
      status TEXT NOT NULL,
      criado_em TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );
  `);
}

async function seedIfEmpty(db: SQLite.SQLiteDatabase): Promise<void> {
  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM usuarios'
  );
  if (existing && existing.count > 0) return;

  const seed = buildSeedSnapshot();

  await db.runAsync(
    'INSERT OR REPLACE INTO app_meta (key, value_json) VALUES (?, ?)',
    ['accessibility', JSON.stringify(seed.accessibility)]
  );
  await db.runAsync(
    'INSERT OR REPLACE INTO app_meta (key, value_json) VALUES (?, ?)',
    [
      'active_selection',
      JSON.stringify({ farmerId: seed.activeFarmerId, farmId: seed.activeFarmId }),
    ]
  );

  for (const u of seed.usuarios) {
    await db.runAsync('INSERT OR REPLACE INTO usuarios (id, payload_json) VALUES (?, ?)', [
      u.id,
      JSON.stringify(u),
    ]);
  }
  for (const farm of seed.fazendas) {
    await db.runAsync(
      'INSERT OR REPLACE INTO fazendas (id, farmer_id, payload_json) VALUES (?, ?, ?)',
      [farm.id, farm.farmerId, JSON.stringify(farm)]
    );
    await db.runAsync(
      'INSERT OR REPLACE INTO diagnosticos_nasa (farm_id, atualizado_em, payload_json) VALUES (?, ?, ?)',
      [farm.id, farm.diagnostico.atualizadoEm, JSON.stringify(farm.diagnostico)]
    );
  }
  for (const p of seed.catalogoPancs) {
    await db.runAsync(
      'INSERT OR REPLACE INTO catalogo_pancs (id, ph_min, ph_max, payload_json) VALUES (?, ?, ?, ?)',
      [p.id, p.phMin, p.phMax, JSON.stringify(p)]
    );
  }
  for (const w of seed.pocosSiagas) {
    await db.runAsync(
      'INSERT OR REPLACE INTO pocos_siagas_local (id, payload_json) VALUES (?, ?)',
      [w.id, JSON.stringify(w)]
    );
  }
  for (const a of seed.alertas) {
    await db.runAsync(
      'INSERT OR REPLACE INTO alertas (id, criado_em, lido, payload_json) VALUES (?, ?, ?, ?)',
      [a.id, a.criadoEm, a.lido ? 1 : 0, JSON.stringify(a)]
    );
  }
}

export const sqliteDb: SqliteRepository = {
  async seedInitialData(): Promise<LocalDatabaseSnapshot> {
    const db = await getDb();
    await createTables(db);
    await seedIfEmpty(db);

    const accRow = await db.getFirstAsync<{ value_json: string }>(
      "SELECT value_json FROM app_meta WHERE key = 'accessibility'"
    );
    const selRow = await db.getFirstAsync<{ value_json: string }>(
      "SELECT value_json FROM app_meta WHERE key = 'active_selection'"
    );
    const userRows = await db.getAllAsync<{ payload_json: string }>(
      'SELECT payload_json FROM usuarios'
    );
    const farmRows = await db.getAllAsync<{ payload_json: string }>(
      'SELECT payload_json FROM fazendas'
    );
    const pancRows = await db.getAllAsync<{ payload_json: string }>(
      'SELECT payload_json FROM catalogo_pancs'
    );
    const wellRows = await db.getAllAsync<{ payload_json: string }>(
      'SELECT payload_json FROM pocos_siagas_local'
    );
    const alertRows = await db.getAllAsync<{ payload_json: string }>(
      'SELECT payload_json FROM alertas ORDER BY criado_em DESC'
    );
    const logRows = await db.getAllAsync<{ payload_json: string }>(
      'SELECT payload_json FROM field_logs ORDER BY criado_em DESC'
    );
    const feedbackRows = await db.getAllAsync<{ payload_json: string }>(
      'SELECT payload_json FROM app_feedbacks ORDER BY criado_em DESC'
    );
    const queueRows = await db.getAllAsync<{ payload_json: string }>(
      'SELECT payload_json FROM sync_queue ORDER BY criado_em DESC'
    );

    const fallback = buildSeedSnapshot();
    const sel = selRow
      ? (JSON.parse(selRow.value_json) as { farmerId: string; farmId: string })
      : { farmerId: fallback.activeFarmerId, farmId: fallback.activeFarmId };

    return {
      accessibility: accRow
        ? (JSON.parse(accRow.value_json) as AccessibilityProfile)
        : fallback.accessibility,
      activeFarmerId: sel.farmerId,
      activeFarmId: sel.farmId,
      usuarios: userRows.map((r) => JSON.parse(r.payload_json) as FarmerProfile),
      fazendas: farmRows.map((r) => JSON.parse(r.payload_json) as FarmProperty),
      catalogoPancs: pancRows.map((r) => JSON.parse(r.payload_json) as EdiblePlantPANC),
      pocosSiagas: wellRows.map((r) => JSON.parse(r.payload_json) as WellPoint),
      alertas: alertRows.map((r) => JSON.parse(r.payload_json) as ProactiveAlertItem),
      fieldLogs: logRows.map((r) => JSON.parse(r.payload_json) as FieldValidationLog),
      feedbacks: feedbackRows.map((r) => JSON.parse(r.payload_json) as AppFeedbackItem),
      syncQueue: queueRows.map((r) => JSON.parse(r.payload_json) as SyncQueueItem),
    };
  },

  async saveAccessibility(prefs) {
    const db = await getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO app_meta (key, value_json) VALUES (?, ?)',
      ['accessibility', JSON.stringify(prefs)]
    );
  },

  async setActiveSelection(farmerId, farmId) {
    const db = await getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO app_meta (key, value_json) VALUES (?, ?)',
      ['active_selection', JSON.stringify({ farmerId, farmId })]
    );
  },

  async upsertUsuario(farmer) {
    const db = await getDb();
    await db.runAsync('INSERT OR REPLACE INTO usuarios (id, payload_json) VALUES (?, ?)', [
      farmer.id,
      JSON.stringify(farmer),
    ]);
  },

  async upsertFazenda(farm) {
    const db = await getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO fazendas (id, farmer_id, payload_json) VALUES (?, ?, ?)',
      [farm.id, farm.farmerId, JSON.stringify(farm)]
    );
    await db.runAsync(
      'INSERT OR REPLACE INTO diagnosticos_nasa (farm_id, atualizado_em, payload_json) VALUES (?, ?, ?)',
      [farm.id, farm.diagnostico.atualizadoEm, JSON.stringify(farm.diagnostico)]
    );
  },

  async addAlert(alert) {
    const db = await getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO alertas (id, criado_em, lido, payload_json) VALUES (?, ?, ?, ?)',
      [alert.id, alert.criadoEm, alert.lido ? 1 : 0, JSON.stringify(alert)]
    );
  },

  async markAlertRead(alertId) {
    const db = await getDb();
    const row = await db.getFirstAsync<{ payload_json: string }>(
      'SELECT payload_json FROM alertas WHERE id = ?',
      [alertId]
    );
    if (row) {
      const parsed = JSON.parse(row.payload_json) as ProactiveAlertItem;
      parsed.lido = true;
      parsed.confirmadoCienteEm = parsed.confirmadoCienteEm ?? new Date().toISOString();
      await db.runAsync('UPDATE alertas SET lido = 1, payload_json = ? WHERE id = ?', [
        JSON.stringify(parsed),
        alertId,
      ]);
    }
  },

  async addFieldLogAndEnqueue(log, queueItem) {
    const db = await getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO field_logs (id, criado_em, sincronizado, payload_json) VALUES (?, ?, ?, ?)',
      [log.id, log.criadoEm, log.sincronizado ? 1 : 0, JSON.stringify(log)]
    );
    await db.runAsync(
      'INSERT OR REPLACE INTO sync_queue (id, status, criado_em, payload_json) VALUES (?, ?, ?, ?)',
      [queueItem.id, queueItem.status, queueItem.criadoEm, JSON.stringify(queueItem)]
    );
  },

  async addFeedbackAndEnqueue(feedback, queueItem) {
    const db = await getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO app_feedbacks (id, criado_em, sincronizado, payload_json) VALUES (?, ?, ?, ?)',
      [feedback.id, feedback.criadoEm, feedback.sincronizado ? 1 : 0, JSON.stringify(feedback)]
    );
    await db.runAsync(
      'INSERT OR REPLACE INTO sync_queue (id, status, criado_em, payload_json) VALUES (?, ?, ?, ?)',
      [queueItem.id, queueItem.status, queueItem.criadoEm, JSON.stringify(queueItem)]
    );
  },

  async markQueueSynced(queueIds) {
    const db = await getDb();
    for (const id of queueIds) {
      const row = await db.getFirstAsync<{ payload_json: string }>(
        'SELECT payload_json FROM sync_queue WHERE id = ?',
        [id]
      );
      if (row) {
        const parsed = JSON.parse(row.payload_json) as SyncQueueItem;
        parsed.status = 'sincronizado';
        await db.runAsync(
          'UPDATE sync_queue SET status = ?, payload_json = ? WHERE id = ?',
          ['sincronizado', JSON.stringify(parsed), id]
        );
      }
    }
    const logRows = await db.getAllAsync<{ id: string; payload_json: string }>(
      'SELECT id, payload_json FROM field_logs WHERE sincronizado = 0'
    );
    for (const row of logRows) {
      const parsed = JSON.parse(row.payload_json) as FieldValidationLog;
      parsed.sincronizado = true;
      await db.runAsync(
        'UPDATE field_logs SET sincronizado = 1, payload_json = ? WHERE id = ?',
        [JSON.stringify(parsed), row.id]
      );
    }
    const fbRows = await db.getAllAsync<{ id: string; payload_json: string }>(
      'SELECT id, payload_json FROM app_feedbacks WHERE sincronizado = 0'
    );
    for (const row of fbRows) {
      const parsed = JSON.parse(row.payload_json) as AppFeedbackItem;
      parsed.sincronizado = true;
      await db.runAsync(
        'UPDATE app_feedbacks SET sincronizado = 1, payload_json = ? WHERE id = ?',
        [JSON.stringify(parsed), row.id]
      );
    }
  },

  async queryPancsByBiomeAndPh(bioma, ph) {
    const db = await getDb();
    const rows = await db.getAllAsync<{ payload_json: string }>(
      'SELECT payload_json FROM catalogo_pancs WHERE ph_min <= ? AND ph_max >= ?',
      [ph + 0.5, ph - 0.5]
    );
    return rows
      .map((r) => JSON.parse(r.payload_json) as EdiblePlantPANC)
      .filter((p) => p.biomas.includes(bioma));
  },

  async getAllWells() {
    const db = await getDb();
    const rows = await db.getAllAsync<{ payload_json: string }>(
      'SELECT payload_json FROM pocos_siagas_local'
    );
    return rows.map((r) => JSON.parse(r.payload_json) as WellPoint);
  },

  async resetDatabase() {
    const db = await getDb();
    await db.execAsync(`
      DELETE FROM app_meta;
      DELETE FROM usuarios;
      DELETE FROM fazendas;
      DELETE FROM diagnosticos_nasa;
      DELETE FROM pocos_siagas_local;
      DELETE FROM catalogo_pancs;
      DELETE FROM alertas;
      DELETE FROM field_logs;
      DELETE FROM app_feedbacks;
      DELETE FROM sync_queue;
    `);
    await seedIfEmpty(db);
    return this.seedInitialData();
  },
};
