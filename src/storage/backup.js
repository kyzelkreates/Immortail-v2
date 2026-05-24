// ================================================================
// IMMORTAIL™ — LOCAL BACKUP FOUNDATION
// Snapshot exports, restore preparation, integrity validation.
// LOCAL-ONLY. NO CLOUD SYNC. NO REMOTE BACKUPS.
// ================================================================

import { getAllStoreNames, SCHEMA_VERSION } from './schemas.js';
import { readAll } from './storage.js';
import { checkPersistenceIntegrity } from './persistence.js';
import { SystemLogger } from '../utils/logger.js';
import { APP_METADATA } from '../utils/constants.js';

const BackupLogger = SystemLogger;

// ----------------------------------------------------------------
// BACKUP METADATA
// ----------------------------------------------------------------

function buildBackupMeta(storeNames) {
  return {
    appName:       APP_METADATA.name,
    appVersion:    APP_METADATA.version,
    schemaVersion: SCHEMA_VERSION,
    exportedAt:    Date.now(),
    exportedAtISO: new Date().toISOString(),
    stores:        storeNames,
    format:        'immortail-backup-v1',
  };
}

// ----------------------------------------------------------------
// EXPORT SNAPSHOT
// ----------------------------------------------------------------

/**
 * Export all data from all (or specified) stores as a JSON snapshot.
 * @param {string[]} [storeNames] — optional list; defaults to all stores
 * @returns {Promise<Object>} snapshot object
 */
export async function exportSnapshot(storeNames = null) {
  const targets = storeNames ?? getAllStoreNames();

  BackupLogger.info(`[BACKUP] Starting snapshot export for stores: ${targets.join(', ')}`);

  const snapshot = {
    meta: buildBackupMeta(targets),
    data: {},
  };

  for (const storeName of targets) {
    try {
      const records = await readAll(storeName);
      snapshot.data[storeName] = records;
      BackupLogger.info(`[BACKUP] Exported "${storeName}": ${records.length} record(s).`);
    } catch (err) {
      BackupLogger.error(`[BACKUP] Failed to export store "${storeName}": ${err.message}`);
      snapshot.data[storeName] = [];
      snapshot.meta.errors = snapshot.meta.errors || [];
      snapshot.meta.errors.push({ store: storeName, error: err.message });
    }
  }

  const totalRecords = Object.values(snapshot.data).reduce((sum, arr) => sum + arr.length, 0);
  snapshot.meta.totalRecords = totalRecords;

  BackupLogger.info(
    `[BACKUP] Snapshot complete — ${totalRecords} total record(s) across ${targets.length} store(s).`
  );

  return snapshot;
}

// ----------------------------------------------------------------
// EXPORT SNAPSHOT AS JSON STRING
// ----------------------------------------------------------------

/**
 * Export a full snapshot as a serialized JSON string.
 * @param {string[]} [storeNames]
 * @returns {Promise<string>}
 */
export async function exportSnapshotJSON(storeNames = null) {
  const snapshot = await exportSnapshot(storeNames);
  return JSON.stringify(snapshot, null, 2);
}

// ----------------------------------------------------------------
// VALIDATE BACKUP INTEGRITY
// ----------------------------------------------------------------

/**
 * Validate a backup snapshot object for structural integrity.
 * @param {Object} snapshot
 * @returns {{ valid: boolean, errors: string[], meta: Object }}
 */
export function validateBackupIntegrity(snapshot) {
  const errors = [];

  if (!snapshot || typeof snapshot !== 'object') {
    errors.push('Snapshot must be a non-null object.');
    return { valid: false, errors, meta: null };
  }

  // Check meta
  if (!snapshot.meta) {
    errors.push('Missing required field: meta.');
  } else {
    if (!snapshot.meta.appName)       errors.push('meta.appName is missing.');
    if (!snapshot.meta.schemaVersion) errors.push('meta.schemaVersion is missing.');
    if (!snapshot.meta.exportedAt)    errors.push('meta.exportedAt is missing.');
    if (!snapshot.meta.format)        errors.push('meta.format is missing.');
    if (snapshot.meta.format !== 'immortail-backup-v1') {
      errors.push(`Unrecognized backup format: "${snapshot.meta.format}".`);
    }
  }

  // Check data block
  if (!snapshot.data || typeof snapshot.data !== 'object') {
    errors.push('Missing or invalid "data" block.');
  } else {
    // Validate each store's record array
    for (const [storeName, records] of Object.entries(snapshot.data)) {
      if (!Array.isArray(records)) {
        errors.push(`Store "${storeName}": data must be an array.`);
        continue;
      }
      const corruptCount = records.filter((r) => !checkPersistenceIntegrity(r)).length;
      if (corruptCount > 0) {
        errors.push(
          `Store "${storeName}": ${corruptCount} record(s) failed integrity check.`
        );
      }
    }
  }

  const valid = errors.length === 0;

  if (valid) {
    BackupLogger.info('[BACKUP] Backup integrity validation PASSED.');
  } else {
    BackupLogger.error(`[BACKUP] Backup integrity validation FAILED: ${errors.join(' | ')}`);
  }

  return {
    valid,
    errors,
    meta: snapshot.meta || null,
  };
}

// ----------------------------------------------------------------
// PREPARE RESTORE (validation only — no write in Run 2)
// ----------------------------------------------------------------

/**
 * Validate a snapshot is ready for restoration.
 * Does NOT write to storage — persistence recovery is a future run.
 * @param {Object|string} snapshotOrJSON
 * @returns {{ ready: boolean, errors: string[], meta: Object }}
 */
export function prepareRestore(snapshotOrJSON) {
  BackupLogger.info('[BACKUP] Preparing restore validation...');

  let snapshot;
  if (typeof snapshotOrJSON === 'string') {
    try {
      snapshot = JSON.parse(snapshotOrJSON);
    } catch (err) {
      return {
        ready: false,
        errors: [`Failed to parse backup JSON: ${err.message}`],
        meta: null,
      };
    }
  } else {
    snapshot = snapshotOrJSON;
  }

  const integrity = validateBackupIntegrity(snapshot);

  if (!integrity.valid) {
    BackupLogger.warn('[BACKUP] Restore preparation failed — backup is not valid.');
    return { ready: false, errors: integrity.errors, meta: integrity.meta };
  }

  // Schema version compatibility check
  const backupSchemaVersion = snapshot.meta?.schemaVersion;
  if (backupSchemaVersion !== SCHEMA_VERSION) {
    BackupLogger.warn(
      `[BACKUP] Schema version mismatch: backup is v${backupSchemaVersion}, current is v${SCHEMA_VERSION}.`
    );
    return {
      ready: false,
      errors: [
        `Schema version mismatch — backup: v${backupSchemaVersion}, current: v${SCHEMA_VERSION}. Migration required.`,
      ],
      meta: integrity.meta,
    };
  }

  BackupLogger.info('[BACKUP] Restore preparation VALIDATED — snapshot is ready.');
  return { ready: true, errors: [], meta: integrity.meta };
}

// ----------------------------------------------------------------
// BACKUP STATUS
// ----------------------------------------------------------------

export function getBackupCapabilities() {
  return {
    exportJSON:      true,
    exportSnapshot:  true,
    validateBackup:  true,
    prepareRestore:  true,
    cloudSync:       false, // not implemented in Run 2
    remoteBackup:    false, // not implemented in Run 2
    autoBackup:      false, // not implemented in Run 2
  };
}
