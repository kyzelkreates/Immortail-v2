// ================================================================
// IMMORTAIL™ — DATABASE MIGRATION SYSTEM
// Deterministic, versioned, non-destructive schema migrations.
// ================================================================

import { SCHEMA_VERSION, STORE_NAMES, SCHEMAS, getAllStoreNames } from './schemas.js';
import { SystemLogger } from '../utils/logger.js';

const MigrationLogger = SystemLogger;

// ----------------------------------------------------------------
// MIGRATION REGISTRY
// Each migration has a version number and an upgrade function.
// Migrations run in ascending version order, exactly once.
// ----------------------------------------------------------------

const MIGRATIONS = [
  {
    version: 1,
    description: 'Initial schema — create all Run 2 object stores.',
    /**
     * @param {IDBDatabase} db
     * @param {IDBTransaction} transaction
     */
    upgrade(db, transaction) {
      for (const storeName of getAllStoreNames()) {
        const schema = SCHEMAS[storeName];

        if (db.objectStoreNames.contains(storeName)) {
          MigrationLogger.warn(`[MIGRATIONS] Store "${storeName}" already exists — skipping creation.`);
          continue;
        }

        const store = db.createObjectStore(storeName, {
          keyPath:       schema.keyPath,
          autoIncrement: schema.autoIncrement,
        });

        for (const idx of schema.indexes) {
          store.createIndex(idx.name, idx.keyPath, { unique: idx.unique });
        }

        MigrationLogger.info(`[MIGRATIONS] Created store: "${storeName}" with ${schema.indexes.length} index(es).`);
      }
    },
  },

  // Future migrations go here:
  // {
  //   version: 2,
  //   description: 'Add xyz field to dogProfiles.',
  //   upgrade(db, transaction) { ... }
  // },
];

// ----------------------------------------------------------------
// MIGRATION METADATA STORE KEY
// ----------------------------------------------------------------

const MIGRATION_META_KEY = '__immortail_migration_version__';

// ----------------------------------------------------------------
// RUN MIGRATIONS
// Called during IDBOpenDBRequest.onupgradeneeded.
// ----------------------------------------------------------------

/**
 * Execute all pending migrations against the database.
 * @param {IDBDatabase} db
 * @param {IDBTransaction} transaction
 * @param {number} oldVersion — previous DB version
 * @param {number} newVersion — target DB version
 */
export function runMigrations(db, transaction, oldVersion, newVersion) {
  MigrationLogger.info(
    `[MIGRATIONS] Running migrations: v${oldVersion} → v${newVersion}`
  );

  const pending = MIGRATIONS.filter(
    (m) => m.version > oldVersion && m.version <= newVersion
  );

  if (pending.length === 0) {
    MigrationLogger.info('[MIGRATIONS] No pending migrations.');
    return;
  }

  // Sort ascending — always deterministic
  pending.sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    MigrationLogger.info(
      `[MIGRATIONS] Applying migration v${migration.version}: ${migration.description}`
    );

    try {
      migration.upgrade(db, transaction);
      MigrationLogger.info(`[MIGRATIONS] Migration v${migration.version} applied successfully.`);
    } catch (err) {
      MigrationLogger.error(
        `[MIGRATIONS] Migration v${migration.version} FAILED: ${err.message}`
      );
      throw new MigrationError(
        `Migration v${migration.version} failed: ${err.message}`,
        { version: migration.version, description: migration.description }
      );
    }
  }

  MigrationLogger.info('[MIGRATIONS] All migrations complete.');
}

// ----------------------------------------------------------------
// GET MIGRATION VERSION
// Returns the current schema version constant.
// ----------------------------------------------------------------

export function getMigrationVersion() {
  return SCHEMA_VERSION;
}

// ----------------------------------------------------------------
// VALIDATE MIGRATION STATE
// Checks that all expected stores are present in the database.
// ----------------------------------------------------------------

/**
 * @param {IDBDatabase} db
 * @returns {{ valid: boolean, missingStores: string[], presentStores: string[] }}
 */
export function validateMigrationState(db) {
  const expected = getAllStoreNames();
  const present = Array.from(db.objectStoreNames);
  const missingStores = expected.filter((name) => !present.includes(name));
  const valid = missingStores.length === 0;

  if (valid) {
    MigrationLogger.info('[MIGRATIONS] Migration state validated — all stores present.');
  } else {
    MigrationLogger.error(
      `[MIGRATIONS] Migration state INVALID — missing stores: ${missingStores.join(', ')}`
    );
  }

  return {
    valid,
    missingStores,
    presentStores: present,
    expectedStores: expected,
    version: SCHEMA_VERSION,
  };
}

// ----------------------------------------------------------------
// MIGRATION ERROR CLASS
// ----------------------------------------------------------------

export class MigrationError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'MigrationError';
    this.context = context;
    this.timestamp = Date.now();
  }
}
