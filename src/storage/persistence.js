// ================================================================
// IMMORTAIL™ — PERSISTENCE CONTROLLER
// Serialization, deserialization, validation, sanitization.
// ALL data passes through here before being written or read.
// ================================================================

import { SystemLogger } from '../utils/logger.js';
import { getSchema } from './schemas.js';

const PersistenceLogger = SystemLogger; // reuse scoped pattern

// ----------------------------------------------------------------
// SERIALIZATION
// ----------------------------------------------------------------

/**
 * Serialize a data object for storage.
 * Attaches timestamps, converts to a clean storable structure.
 * @param {Object} data
 * @returns {Object} serialized payload
 */
export function serializeData(data) {
  if (data === null || data === undefined) {
    throw new PersistenceError('serializeData: Cannot serialize null or undefined.');
  }
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new PersistenceError('serializeData: Payload must be a plain object.');
  }

  try {
    const serialized = {
      ...data,
      _serializedAt: Date.now(),
      _version: 1,
    };

    // Deep-clone via JSON to catch non-serializable values
    const validated = JSON.parse(JSON.stringify(serialized));
    return validated;
  } catch (err) {
    throw new PersistenceError(`serializeData: Failed to serialize — ${err.message}`);
  }
}

// ----------------------------------------------------------------
// DESERIALIZATION
// ----------------------------------------------------------------

/**
 * Deserialize a stored payload back to a clean data object.
 * Strips internal persistence metadata fields.
 * @param {Object} raw — raw stored record
 * @returns {Object} clean deserialized data
 */
export function deserializeData(raw) {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw !== 'object') {
    throw new PersistenceError('deserializeData: Raw payload must be an object.');
  }

  try {
    const clean = { ...raw };
    // Strip internal metadata
    delete clean._serializedAt;
    delete clean._version;
    return clean;
  } catch (err) {
    throw new PersistenceError(`deserializeData: Failed to deserialize — ${err.message}`);
  }
}

// ----------------------------------------------------------------
// PAYLOAD VALIDATION
// ----------------------------------------------------------------

/**
 * Validate a data payload against a registered schema before write.
 * @param {string} storeName — target store
 * @param {Object} data — data to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePersistencePayload(storeName, data) {
  const errors = [];

  if (!storeName || typeof storeName !== 'string') {
    errors.push('storeName must be a non-empty string.');
    return { valid: false, errors };
  }

  let schema;
  try {
    schema = getSchema(storeName);
  } catch (err) {
    errors.push(err.message);
    return { valid: false, errors };
  }

  if (data === null || data === undefined || typeof data !== 'object' || Array.isArray(data)) {
    errors.push('Payload must be a plain object.');
    return { valid: false, errors };
  }

  const { validationShape } = schema;

  // Required fields
  for (const field of validationShape.required) {
    if (!(field in data) || data[field] === undefined || data[field] === null) {
      errors.push(`Missing required field: "${field}".`);
    }
  }

  // Type checks (skip 'any')
  for (const [field, expectedType] of Object.entries(validationShape.types)) {
    if (expectedType === 'any') continue;
    if (!(field in data)) continue; // not present, will be caught by required check if needed

    const actualType = Array.isArray(data[field]) ? 'object' : typeof data[field];

    if (actualType !== expectedType) {
      errors.push(
        `Field "${field}": expected type "${expectedType}", got "${actualType}".`
      );
    }
  }

  const valid = errors.length === 0;

  if (!valid) {
    PersistenceLogger.warn(
      `[PERSISTENCE] Validation failed for store "${storeName}": ${errors.join(' | ')}`
    );
  }

  return { valid, errors };
}

// ----------------------------------------------------------------
// SANITIZATION
// ----------------------------------------------------------------

/**
 * Sanitize a data object — removes undefined fields,
 * strips dangerous prototype keys, coerces timestamps.
 * @param {Object} data
 * @returns {Object} sanitized data
 */
export function sanitizePayload(data) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new PersistenceError('sanitizePayload: Input must be a plain object.');
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    // Skip undefined values
    if (value === undefined) continue;
    // Skip prototype-dangerous keys
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    sanitized[key] = value;
  }

  return sanitized;
}

// ----------------------------------------------------------------
// INTEGRITY CHECK
// ----------------------------------------------------------------

/**
 * Check that a read record is structurally intact.
 * @param {Object} record
 * @returns {boolean}
 */
export function checkPersistenceIntegrity(record) {
  if (record === null || record === undefined) return false;
  if (typeof record !== 'object' || Array.isArray(record)) return false;
  // Must be JSON-round-trippable
  try {
    JSON.parse(JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------
// PERSISTENCE ERROR CLASS
// ----------------------------------------------------------------

export class PersistenceError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'PersistenceError';
    this.context = context;
    this.timestamp = Date.now();
  }
}
