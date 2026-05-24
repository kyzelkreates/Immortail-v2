// ================================================================
// IMMORTAIL™ — CENTRAL STORAGE ENGINE (SSOT)
// IndexedDB lifecycle, CRUD, transactions, versioning.
//
// ALL STORAGE ACCESS FLOWS THROUGH THIS FILE.
// NO COMPONENT OR AGENT MAY BYPASS THIS MODULE.
// ================================================================

import { APP_METADATA } from '../utils/constants.js';
import { SystemLogger } from '../utils/logger.js';
import { SCHEMA_VERSION, getAllStoreNames } from './schemas.js';
import { runMigrations, validateMigrationState } from './migrations.js';
import {
  serializeData,
  deserializeData,
  checkPersistenceIntegrity,
} from './persistence.js';

const StorageLogger = SystemLogger;

// ----------------------------------------------------------------
// DATABASE CONFIGURATION
// ----------------------------------------------------------------

const DB_NAME    = `immortail_${APP_METADATA.name.toLowerCase()}`;
const DB_VERSION = SCHEMA_VERSION;

// ----------------------------------------------------------------
// INTERNAL STATE
// ----------------------------------------------------------------

/** @type {IDBDatabase|null} */
let _db = null;
let _initialized = false;
let _initializationPromise = null;

// ----------------------------------------------------------------
// STORAGE ERROR CLASS
// ----------------------------------------------------------------

export class StorageError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'StorageError';
    this.context = context;
    this.timestamp = Date.now();
  }
}

// ----------------------------------------------------------------
// INITIALIZE STORAGE
// ----------------------------------------------------------------

/**
 * Open the IndexedDB database, run migrations, validate stores.
 * Idempotent — safe to call multiple times.
 * @returns {Promise<IDBDatabase>}
 */
export function initializeStorage() {
  if (_initialized && _db) {
    StorageLogger.warn('[STORAGE] Already initialized. Returning existing database.');
    return Promise.resolve(_db);
  }

  // Prevent concurrent initialization races
  if (_initializationPromise) {
    return _initializationPromise;
  }

  _initializationPromise = new Promise((resolve, reject) => {
    StorageLogger.info(`[STORAGE] Opening IndexedDB: "${DB_NAME}" v${DB_VERSION}`);

    if (typeof indexedDB === 'undefined' || indexedDB === null) {
      const err = new StorageError('[STORAGE] IndexedDB is not available in this environment.');
      StorageLogger.error(err.message);
      reject(err);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // ── UPGRADE NEEDED ──────────────────────────────────────────
    request.onupgradeneeded = (event) => {
      const db          = event.target.result;
      const transaction = event.target.transaction;
      const oldVersion  = event.oldVersion;
      const newVersion  = event.newVersion;

      StorageLogger.info(`[STORAGE] Upgrade needed: v${oldVersion} → v${newVersion}`);

      try {
        runMigrations(db, transaction, oldVersion, newVersion);
      } catch (migrationErr) {
        StorageLogger.error(`[STORAGE] Migration failed during upgrade: ${migrationErr.message}`);
        transaction.abort();
        reject(migrationErr);
      }
    };

    // ── SUCCESS ─────────────────────────────────────────────────
    request.onsuccess = (event) => {
      _db = event.target.result;

      _db.onerror = (dbEvent) => {
        StorageLogger.error(`[STORAGE] Database error: ${dbEvent.target.error?.message}`);
      };

      _db.onversionchange = () => {
        StorageLogger.warn('[STORAGE] Database version change detected. Closing connection.');
        _db.close();
        _db = null;
        _initialized = false;
        _initializationPromise = null;
      };

      // Validate all stores were created
      const migrationState = validateMigrationState(_db);
      if (!migrationState.valid) {
        const err = new StorageError(
          `[STORAGE] Missing stores after migration: ${migrationState.missingStores.join(', ')}`
        );
        reject(err);
        return;
      }

      _initialized = true;
      StorageLogger.info('[STORAGE] Database initialized successfully.');
      resolve(_db);
    };

    // ── ERROR ────────────────────────────────────────────────────
    request.onerror = (event) => {
      const err = new StorageError(
        `[STORAGE] Failed to open database: ${event.target.error?.message || 'Unknown error'}`,
        { dbName: DB_NAME, version: DB_VERSION }
      );
      StorageLogger.error(err.message);
      _initializationPromise = null;
      reject(err);
    };

    // ── BLOCKED ──────────────────────────────────────────────────
    request.onblocked = () => {
      StorageLogger.warn(
        '[STORAGE] Database open blocked. Another tab may have an older version open. Waiting...'
      );
    };
  });

  return _initializationPromise;
}

// ----------------------------------------------------------------
// GET STORAGE (internal guard)
// ----------------------------------------------------------------

/**
 * Returns the initialized DB instance or throws.
 * @returns {IDBDatabase}
 */
export function getStorage() {
  if (!_db || !_initialized) {
    throw new StorageError(
      '[STORAGE] Storage not initialized. Call initializeStorage() first.'
    );
  }
  return _db;
}

// ----------------------------------------------------------------
// TRANSACTION HELPER
// ----------------------------------------------------------------

/**
 * Create a transaction and return the object store.
 * @param {string} storeName
 * @param {'readonly'|'readwrite'} mode
 * @returns {{ store: IDBObjectStore, transaction: IDBTransaction }}
 */
function _getStore(storeName, mode = 'readonly') {
  const db = getStorage();

  if (!db.objectStoreNames.contains(storeName)) {
    throw new StorageError(
      `[STORAGE] Object store "${storeName}" does not exist.`,
      { storeName }
    );
  }

  const transaction = db.transaction([storeName], mode);

  transaction.onerror = (event) => {
    StorageLogger.error(
      `[STORAGE] Transaction error on "${storeName}": ${event.target.error?.message}`
    );
  };

  transaction.onabort = () => {
    StorageLogger.warn(`[STORAGE] Transaction aborted on "${storeName}".`);
  };

  const store = transaction.objectStore(storeName);
  return { store, transaction };
}

// ----------------------------------------------------------------
// IDB REQUEST → PROMISE WRAPPER
// ----------------------------------------------------------------

function _requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror  = () =>
      reject(
        new StorageError(
          `[STORAGE] IDB request failed: ${request.error?.message || 'Unknown'}`,
          { error: request.error }
        )
      );
  });
}

// ----------------------------------------------------------------
// READ
// ----------------------------------------------------------------

/**
 * Read a single record by primary key.
 * @param {string} storeName
 * @param {string|number} key
 * @returns {Promise<Object|null>}
 */
export async function read(storeName, key) {
  try {
    const { store } = _getStore(storeName, 'readonly');
    const raw = await _requestToPromise(store.get(key));

    if (!raw) return null;

    if (!checkPersistenceIntegrity(raw)) {
      StorageLogger.warn(`[STORAGE] Integrity check failed for key "${key}" in "${storeName}".`);
      return null;
    }

    return deserializeData(raw);
  } catch (err) {
    StorageLogger.error(`[STORAGE] read() failed — ${storeName}/${key}: ${err.message}`);
    throw err instanceof StorageError ? err : new StorageError(err.message, { storeName, key });
  }
}

// ----------------------------------------------------------------
// READ ALL (index-based or full store scan)
// ----------------------------------------------------------------

/**
 * Read all records from a store.
 * @param {string} storeName
 * @returns {Promise<Object[]>}
 */
export async function readAll(storeName) {
  try {
    const { store } = _getStore(storeName, 'readonly');
    const raws = await _requestToPromise(store.getAll());

    return raws
      .filter(checkPersistenceIntegrity)
      .map(deserializeData);
  } catch (err) {
    StorageLogger.error(`[STORAGE] readAll() failed — ${storeName}: ${err.message}`);
    throw err instanceof StorageError ? err : new StorageError(err.message, { storeName });
  }
}

// ----------------------------------------------------------------
// READ BY INDEX
// ----------------------------------------------------------------

/**
 * Read records by index value.
 * @param {string} storeName
 * @param {string} indexName
 * @param {*} indexValue
 * @returns {Promise<Object[]>}
 */
export async function readByIndex(storeName, indexName, indexValue) {
  try {
    const { store } = _getStore(storeName, 'readonly');
    const index     = store.index(indexName);
    const raws      = await _requestToPromise(index.getAll(indexValue));

    return raws
      .filter(checkPersistenceIntegrity)
      .map(deserializeData);
  } catch (err) {
    StorageLogger.error(
      `[STORAGE] readByIndex() failed — ${storeName}[${indexName}=${indexValue}]: ${err.message}`
    );
    throw err instanceof StorageError ? err : new StorageError(err.message, { storeName, indexName, indexValue });
  }
}

// ----------------------------------------------------------------
// WRITE (create — fails if key already exists)
// ----------------------------------------------------------------

/**
 * Write a new record. Rejects if key already exists.
 * @param {string} storeName
 * @param {Object} data — must include keyPath field
 * @returns {Promise<string|number>} — inserted key
 */
export async function write(storeName, data) {
  try {
    const serialized = serializeData(data);
    const { store }  = _getStore(storeName, 'readwrite');
    const key        = await _requestToPromise(store.add(serialized));
    StorageLogger.info(`[STORAGE] write() — "${storeName}" key: ${key}`);
    return key;
  } catch (err) {
    StorageLogger.error(`[STORAGE] write() failed — ${storeName}: ${err.message}`);
    throw err instanceof StorageError ? err : new StorageError(err.message, { storeName });
  }
}

// ----------------------------------------------------------------
// UPDATE (put — create or overwrite)
// ----------------------------------------------------------------

/**
 * Put a record (create or overwrite by key).
 * @param {string} storeName
 * @param {Object} data
 * @returns {Promise<string|number>} — upserted key
 */
export async function update(storeName, data) {
  try {
    const serialized = serializeData(data);
    const { store }  = _getStore(storeName, 'readwrite');
    const key        = await _requestToPromise(store.put(serialized));
    StorageLogger.info(`[STORAGE] update() — "${storeName}" key: ${key}`);
    return key;
  } catch (err) {
    StorageLogger.error(`[STORAGE] update() failed — ${storeName}: ${err.message}`);
    throw err instanceof StorageError ? err : new StorageError(err.message, { storeName });
  }
}

// ----------------------------------------------------------------
// REMOVE
// ----------------------------------------------------------------

/**
 * Delete a record by primary key.
 * @param {string} storeName
 * @param {string|number} key
 * @returns {Promise<void>}
 */
export async function remove(storeName, key) {
  try {
    const { store } = _getStore(storeName, 'readwrite');
    await _requestToPromise(store.delete(key));
    StorageLogger.info(`[STORAGE] remove() — "${storeName}" key: ${key}`);
  } catch (err) {
    StorageLogger.error(`[STORAGE] remove() failed — ${storeName}/${key}: ${err.message}`);
    throw err instanceof StorageError ? err : new StorageError(err.message, { storeName, key });
  }
}

// ----------------------------------------------------------------
// CLEAR STORE
// ----------------------------------------------------------------

/**
 * Remove all records from a store. Does NOT delete the store itself.
 * @param {string} storeName
 * @returns {Promise<void>}
 */
export async function clearStore(storeName) {
  try {
    const { store } = _getStore(storeName, 'readwrite');
    await _requestToPromise(store.clear());
    StorageLogger.info(`[STORAGE] clearStore() — "${storeName}" cleared.`);
  } catch (err) {
    StorageLogger.error(`[STORAGE] clearStore() failed — ${storeName}: ${err.message}`);
    throw err instanceof StorageError ? err : new StorageError(err.message, { storeName });
  }
}

// ----------------------------------------------------------------
// SHUTDOWN STORAGE
// ----------------------------------------------------------------

/**
 * Close the database connection gracefully.
 */
export function shutdownStorage() {
  if (_db) {
    _db.close();
    _db = null;
    _initialized = false;
    _initializationPromise = null;
    StorageLogger.info('[STORAGE] Database connection closed.');
  } else {
    StorageLogger.warn('[STORAGE] shutdownStorage() called but no database was open.');
  }
}

// ----------------------------------------------------------------
// STORAGE STATUS
// ----------------------------------------------------------------

export function getStorageStatus() {
  return {
    initialized: _initialized,
    dbName:      DB_NAME,
    dbVersion:   DB_VERSION,
    isOpen:      _db !== null,
  };
}
