// ================================================================
// IMMORTAIL™ — STORAGE SERVICE LAYER (SSOT ACCESS POINT)
//
// THIS IS THE ONLY SYSTEM ALLOWED TO CALL STORAGE.JS.
//
// ALL persistence flows through this service.
// UI, agents, and all other systems must use this service.
// NO DIRECT STORAGE ACCESS OUTSIDE THIS FILE.
// ================================================================

import {
  read,
  readAll,
  readByIndex,
  write,
  update,
  remove,
  clearStore,
  getStorageStatus,
} from '../storage/storage.js';

import {
  validatePersistencePayload,
  sanitizePayload,
  serializeData,
  PersistenceError,
} from '../storage/persistence.js';

import { getSchema, getAllStoreNames } from '../storage/schemas.js';
import { SystemLogger } from '../utils/logger.js';

const ServiceLogger = SystemLogger;

// ----------------------------------------------------------------
// SERVICE ERROR CLASS
// ----------------------------------------------------------------

export class StorageServiceError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'StorageServiceError';
    this.context = context;
    this.timestamp = Date.now();
  }
}

// ----------------------------------------------------------------
// INTERNAL: PRE-WRITE PIPELINE
// Sanitize → Validate → pass to storage.js
// ----------------------------------------------------------------

function _prepareWrite(storeName, data) {
  // 1. Sanitize
  let sanitized;
  try {
    sanitized = sanitizePayload(data);
  } catch (err) {
    throw new StorageServiceError(
      `[StorageService] Sanitization failed for "${storeName}": ${err.message}`,
      { storeName }
    );
  }

  // 2. Validate against schema
  const validation = validatePersistencePayload(storeName, sanitized);
  if (!validation.valid) {
    throw new StorageServiceError(
      `[StorageService] Schema validation failed for "${storeName}": ${validation.errors.join(' | ')}`,
      { storeName, errors: validation.errors, data: sanitized }
    );
  }

  return sanitized;
}

// ----------------------------------------------------------------
// SAVE ENTITY (create — rejects if key already exists)
// ----------------------------------------------------------------

/**
 * Save a new entity record to storage.
 * @param {string} storeName
 * @param {Object} data — must include the store's keyPath field
 * @returns {Promise<string|number>} — inserted key
 */
export async function saveEntity(storeName, data) {
  ServiceLogger.info(`[StorageService] saveEntity — store: "${storeName}"`);

  const prepared = _prepareWrite(storeName, data);

  try {
    const key = await write(storeName, prepared);
    ServiceLogger.info(`[StorageService] saveEntity SUCCESS — key: ${key}`);
    return key;
  } catch (err) {
    ServiceLogger.error(`[StorageService] saveEntity FAILED — ${storeName}: ${err.message}`);
    throw new StorageServiceError(err.message, { storeName, operation: 'saveEntity' });
  }
}

// ----------------------------------------------------------------
// LOAD ENTITY (read by primary key)
// ----------------------------------------------------------------

/**
 * Load a single entity by its primary key.
 * @param {string} storeName
 * @param {string|number} key
 * @returns {Promise<Object|null>}
 */
export async function loadEntity(storeName, key) {
  ServiceLogger.info(`[StorageService] loadEntity — store: "${storeName}", key: ${key}`);

  _assertValidStoreName(storeName);

  try {
    const record = await read(storeName, key);
    if (!record) {
      ServiceLogger.info(`[StorageService] loadEntity — no record found for key: ${key}`);
    }
    return record;
  } catch (err) {
    ServiceLogger.error(`[StorageService] loadEntity FAILED — ${storeName}/${key}: ${err.message}`);
    throw new StorageServiceError(err.message, { storeName, key, operation: 'loadEntity' });
  }
}

// ----------------------------------------------------------------
// UPDATE ENTITY (put — create or overwrite)
// ----------------------------------------------------------------

/**
 * Update (upsert) an entity record.
 * @param {string} storeName
 * @param {Object} data
 * @returns {Promise<string|number>} — upserted key
 */
export async function updateEntity(storeName, data) {
  ServiceLogger.info(`[StorageService] updateEntity — store: "${storeName}"`);

  const prepared = _prepareWrite(storeName, data);

  try {
    const key = await update(storeName, prepared);
    ServiceLogger.info(`[StorageService] updateEntity SUCCESS — key: ${key}`);
    return key;
  } catch (err) {
    ServiceLogger.error(`[StorageService] updateEntity FAILED — ${storeName}: ${err.message}`);
    throw new StorageServiceError(err.message, { storeName, operation: 'updateEntity' });
  }
}

// ----------------------------------------------------------------
// DELETE ENTITY
// ----------------------------------------------------------------

/**
 * Delete an entity record by primary key.
 * @param {string} storeName
 * @param {string|number} key
 * @returns {Promise<void>}
 */
export async function deleteEntity(storeName, key) {
  ServiceLogger.info(`[StorageService] deleteEntity — store: "${storeName}", key: ${key}`);

  _assertValidStoreName(storeName);

  try {
    await remove(storeName, key);
    ServiceLogger.info(`[StorageService] deleteEntity SUCCESS — key: ${key}`);
  } catch (err) {
    ServiceLogger.error(`[StorageService] deleteEntity FAILED — ${storeName}/${key}: ${err.message}`);
    throw new StorageServiceError(err.message, { storeName, key, operation: 'deleteEntity' });
  }
}

// ----------------------------------------------------------------
// QUERY ENTITIES
// ----------------------------------------------------------------

/**
 * Query entities — by index or all records.
 * @param {string} storeName
 * @param {Object} [query={}]
 * @param {string} [query.indexName] — index to query by
 * @param {*}      [query.indexValue] — value to match
 * @returns {Promise<Object[]>}
 */
export async function queryEntities(storeName, query = {}) {
  ServiceLogger.info(
    `[StorageService] queryEntities — store: "${storeName}", query: ${JSON.stringify(query)}`
  );

  _assertValidStoreName(storeName);

  try {
    const { indexName, indexValue } = query;

    if (indexName !== undefined && indexValue !== undefined) {
      const results = await readByIndex(storeName, indexName, indexValue);
      ServiceLogger.info(
        `[StorageService] queryEntities — ${results.length} record(s) via index "${indexName}".`
      );
      return results;
    }

    // Full store read
    const results = await readAll(storeName);
    ServiceLogger.info(`[StorageService] queryEntities — ${results.length} total record(s).`);
    return results;

  } catch (err) {
    ServiceLogger.error(`[StorageService] queryEntities FAILED — ${storeName}: ${err.message}`);
    throw new StorageServiceError(err.message, { storeName, query, operation: 'queryEntities' });
  }
}

// ----------------------------------------------------------------
// CLEAR STORE (admin-level operation)
// ----------------------------------------------------------------

/**
 * Clear all records from a store.
 * Intended for admin/reset flows only — use carefully.
 * @param {string} storeName
 * @returns {Promise<void>}
 */
export async function clearEntityStore(storeName) {
  ServiceLogger.warn(`[StorageService] clearEntityStore — store: "${storeName}"`);

  _assertValidStoreName(storeName);

  try {
    await clearStore(storeName);
    ServiceLogger.info(`[StorageService] clearEntityStore SUCCESS — "${storeName}" cleared.`);
  } catch (err) {
    ServiceLogger.error(`[StorageService] clearEntityStore FAILED — ${storeName}: ${err.message}`);
    throw new StorageServiceError(err.message, { storeName, operation: 'clearEntityStore' });
  }
}

// ----------------------------------------------------------------
// STORAGE SERVICE STATUS
// ----------------------------------------------------------------

export function getStorageServiceStatus() {
  return {
    ...getStorageStatus(),
    serviceReady: getStorageStatus().initialized,
  };
}

// ----------------------------------------------------------------
// INTERNAL GUARDS
// ----------------------------------------------------------------

function _assertValidStoreName(storeName) {
  if (!storeName || typeof storeName !== 'string') {
    throw new StorageServiceError('[StorageService] storeName must be a non-empty string.');
  }
  const validNames = getAllStoreNames();
  if (!validNames.includes(storeName)) {
    throw new StorageServiceError(
      `[StorageService] Unknown store: "${storeName}". Valid stores: ${validNames.join(', ')}.`
    );
  }
}
