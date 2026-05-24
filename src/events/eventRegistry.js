// ================================================================
// IMMORTAIL™ — CENTRAL EVENT CONTRACT REGISTRY
// Every emitted event must have a registered contract.
// Contracts define payload shape, allowed emitters, subscribers.
// ================================================================

import { ALL_EVENTS, assertKnownEvent } from './eventTypes.js';
import { SystemLogger } from '../utils/logger.js';

const RegistryLogger = SystemLogger;

// ----------------------------------------------------------------
// CONTRACT STORE
// ----------------------------------------------------------------

/** @type {Map<string, EventContract>} */
const _contracts = new Map();

// ----------------------------------------------------------------
// CONTRACT CLASS
// ----------------------------------------------------------------

class EventContract {
  /**
   * @param {Object} config
   * @param {string}   config.eventType
   * @param {string}   config.description
   * @param {string[]} config.requiredFields   — must be present in payload
   * @param {Object}   config.fieldTypes       — field → 'string'|'number'|'boolean'|'object'|'any'
   * @param {string[]} [config.allowedEmitters] — symbolic emitter IDs (informational)
   * @param {string[]} [config.allowedSubscribers] — symbolic subscriber IDs (informational)
   */
  constructor({ eventType, description, requiredFields = [], fieldTypes = {}, allowedEmitters = ['*'], allowedSubscribers = ['*'] }) {
    this.eventType         = eventType;
    this.description       = description;
    this.requiredFields    = requiredFields;
    this.fieldTypes        = fieldTypes;
    this.allowedEmitters   = allowedEmitters;
    this.allowedSubscribers = allowedSubscribers;
    this.registeredAt      = Date.now();
  }
}

// ----------------------------------------------------------------
// REGISTER EVENT CONTRACT
// ----------------------------------------------------------------

/**
 * Register a contract for an event type.
 * Throws if event type is unknown or already registered.
 * @param {Object} contractConfig
 */
export function registerEventContract(contractConfig) {
  const { eventType } = contractConfig;

  assertKnownEvent(eventType);

  if (_contracts.has(eventType)) {
    RegistryLogger.warn(`[EventRegistry] Contract for "${eventType}" already registered. Skipping.`);
    return;
  }

  const contract = new EventContract(contractConfig);
  _contracts.set(eventType, contract);
  RegistryLogger.debug(`[EventRegistry] Contract registered: "${eventType}"`);
}

// ----------------------------------------------------------------
// GET EVENT CONTRACT
// ----------------------------------------------------------------

/**
 * @param {string} eventType
 * @returns {EventContract}
 * @throws if not registered
 */
export function getEventContract(eventType) {
  const contract = _contracts.get(eventType);
  if (!contract) {
    throw new Error(
      `[EventRegistry] No contract registered for event: "${eventType}". Register it first.`
    );
  }
  return contract;
}

/**
 * Returns null instead of throwing — safe for optional checks.
 */
export function findEventContract(eventType) {
  return _contracts.get(eventType) || null;
}

// ----------------------------------------------------------------
// VALIDATE EVENT PAYLOAD
// ----------------------------------------------------------------

/**
 * Validate a payload against a registered contract.
 * @param {string} eventType
 * @param {Object} payload
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateEventPayload(eventType, payload) {
  const errors = [];

  // Contract must exist
  const contract = findEventContract(eventType);
  if (!contract) {
    errors.push(`No contract registered for event "${eventType}".`);
    return { valid: false, errors };
  }

  // Payload must be an object
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    errors.push('Payload must be a plain object.');
    return { valid: false, errors };
  }

  // Required fields
  for (const field of contract.requiredFields) {
    if (!(field in payload) || payload[field] === undefined || payload[field] === null) {
      errors.push(`Missing required field: "${field}".`);
    }
  }

  // Type checks
  for (const [field, expectedType] of Object.entries(contract.fieldTypes)) {
    if (expectedType === 'any') continue;
    if (!(field in payload)) continue;

    const val        = payload[field];
    const actualType = Array.isArray(val) ? 'object' : typeof val;

    if (actualType !== expectedType) {
      errors.push(
        `Field "${field}": expected "${expectedType}", got "${actualType}".`
      );
    }
  }

  const valid = errors.length === 0;

  if (!valid) {
    RegistryLogger.warn(
      `[EventRegistry] Payload validation FAILED for "${eventType}": ${errors.join(' | ')}`
    );
  }

  return { valid, errors };
}

// ----------------------------------------------------------------
// REGISTRY STATUS
// ----------------------------------------------------------------

export function getRegisteredContracts() {
  const result = {};
  for (const [type, contract] of _contracts) {
    result[type] = {
      eventType:       contract.eventType,
      description:     contract.description,
      requiredFields:  contract.requiredFields,
      allowedEmitters: contract.allowedEmitters,
      registeredAt:    contract.registeredAt,
    };
  }
  return result;
}

export function isContractRegistered(eventType) {
  return _contracts.has(eventType);
}

// ----------------------------------------------------------------
// REGISTER ALL BUILT-IN CONTRACTS
// ----------------------------------------------------------------

export function registerAllContracts() {
  RegistryLogger.info('[EventRegistry] Registering all built-in event contracts...');

  // ── SYSTEM ──────────────────────────────────────────────────
  registerEventContract({
    eventType:    ALL_EVENTS.APP_READY,
    description:  'Emitted when the full boot pipeline completes successfully.',
    requiredFields: ['timestamp', 'duration'],
    fieldTypes:   { timestamp: 'number', duration: 'number' },
    allowedEmitters: ['boot'],
  });

  registerEventContract({
    eventType:    ALL_EVENTS.APP_SHUTDOWN,
    description:  'Emitted when the application begins shutdown.',
    requiredFields: ['timestamp', 'reason'],
    fieldTypes:   { timestamp: 'number', reason: 'string' },
    allowedEmitters: ['boot', 'runtime'],
  });

  registerEventContract({
    eventType:    ALL_EVENTS.RUNTIME_INITIALIZED,
    description:  'Emitted when the core runtime completes initialization.',
    requiredFields: ['timestamp'],
    fieldTypes:   { timestamp: 'number' },
    allowedEmitters: ['boot'],
  });

  registerEventContract({
    eventType:    ALL_EVENTS.HYDRATION_COMPLETE,
    description:  'Emitted when hydration orchestration finishes.',
    requiredFields: ['timestamp', 'partial'],
    fieldTypes:   { timestamp: 'number', partial: 'boolean' },
    allowedEmitters: ['hydration'],
  });

  registerEventContract({
    eventType:    ALL_EVENTS.RECOVERY_COMPLETE,
    description:  'Emitted when a recovery cycle resolves.',
    requiredFields: ['timestamp', 'reason'],
    fieldTypes:   { timestamp: 'number', reason: 'string' },
    allowedEmitters: ['recovery'],
  });

  registerEventContract({
    eventType:    ALL_EVENTS.SAFE_MODE_ENTERED,
    description:  'Emitted when the runtime enters safe mode.',
    requiredFields: ['timestamp', 'reason'],
    fieldTypes:   { timestamp: 'number', reason: 'string' },
    allowedEmitters: ['recovery'],
  });

  // ── STORAGE ──────────────────────────────────────────────────
  registerEventContract({
    eventType:    ALL_EVENTS.STORAGE_INITIALIZED,
    description:  'Emitted when IndexedDB is opened and migrated.',
    requiredFields: ['timestamp', 'version'],
    fieldTypes:   { timestamp: 'number', version: 'number' },
    allowedEmitters: ['storageService'],
  });

  registerEventContract({
    eventType:    ALL_EVENTS.STORAGE_WRITE,
    description:  'Emitted after a successful entity write.',
    requiredFields: ['timestamp', 'storeName', 'key'],
    fieldTypes:   { timestamp: 'number', storeName: 'string', key: 'any' },
    allowedEmitters: ['storageService'],
  });

  registerEventContract({
    eventType:    ALL_EVENTS.STORAGE_UPDATE,
    description:  'Emitted after a successful entity update.',
    requiredFields: ['timestamp', 'storeName', 'key'],
    fieldTypes:   { timestamp: 'number', storeName: 'string', key: 'any' },
    allowedEmitters: ['storageService'],
  });

  registerEventContract({
    eventType:    ALL_EVENTS.STORAGE_ERROR,
    description:  'Emitted when a storage operation fails.',
    requiredFields: ['timestamp', 'storeName', 'error'],
    fieldTypes:   { timestamp: 'number', storeName: 'string', error: 'string' },
    allowedEmitters: ['storageService'],
  });

  // ── STATE ────────────────────────────────────────────────────
  registerEventContract({
    eventType:    ALL_EVENTS.STATE_UPDATED,
    description:  'Emitted when any top-level state container updates.',
    requiredFields: ['timestamp', 'source'],
    fieldTypes:   { timestamp: 'number', source: 'string' },
    allowedEmitters: ['*'],
  });

  registerEventContract({
    eventType:    ALL_EVENTS.SESSION_RESTORED,
    description:  'Emitted when a session is restored from storage.',
    requiredFields: ['timestamp', 'sessionId', 'source'],
    fieldTypes:   { timestamp: 'number', sessionId: 'string', source: 'string' },
    allowedEmitters: ['sessionState', 'hydration'],
  });

  registerEventContract({
    eventType:    ALL_EVENTS.RUNTIME_STATE_CHANGED,
    description:  'Emitted when runtime state lifecycle flags change.',
    requiredFields: ['timestamp', 'field'],
    fieldTypes:   { timestamp: 'number', field: 'string' },
    allowedEmitters: ['runtimeState'],
  });

  // ── DOG ──────────────────────────────────────────────────────
  registerEventContract({
    eventType:    ALL_EVENTS.DOG_STATE_UPDATED,
    description:  'Emitted when dog runtime state is updated.',
    requiredFields: ['timestamp', 'dogId', 'source'],
    fieldTypes:   { timestamp: 'number', dogId: 'string', source: 'string' },
    allowedEmitters: ['dogService'],
  });

  registerEventContract({
    eventType:    ALL_EVENTS.DOG_PROFILE_LOADED,
    description:  'Emitted when a dog profile is loaded from storage.',
    requiredFields: ['timestamp', 'dogId', 'name'],
    fieldTypes:   { timestamp: 'number', dogId: 'string', name: 'string' },
    allowedEmitters: ['dogService'],
  });

  registerEventContract({
    eventType:    ALL_EVENTS.DOG_RUNTIME_CHANGED,
    description:  'Emitted when dog active state mode changes.',
    requiredFields: ['timestamp', 'dogId', 'mode'],
    fieldTypes:   { timestamp: 'number', dogId: 'string', mode: 'string' },
    allowedEmitters: ['dogService'],
  });

  // ── EMOTION ──────────────────────────────────────────────────
  registerEventContract({
    eventType:    ALL_EVENTS.EMOTION_CHANGED,
    description:  'Emitted when the active emotion snapshot changes.',
    requiredFields: ['timestamp', 'profileId', 'emotionType'],
    fieldTypes:   { timestamp: 'number', profileId: 'string', emotionType: 'string' },
    allowedEmitters: ['emotionService'],
  });

  registerEventContract({
    eventType:    ALL_EVENTS.EMOTION_SYNCED,
    description:  'Emitted after emotion state is synced to storage.',
    requiredFields: ['timestamp', 'profileId'],
    fieldTypes:   { timestamp: 'number', profileId: 'string' },
    allowedEmitters: ['emotionService'],
  });

  // ── MEMORY ───────────────────────────────────────────────────
  registerEventContract({
    eventType:    ALL_EVENTS.MEMORY_CREATED,
    description:  'Emitted when a new memory reference is created.',
    requiredFields: ['timestamp', 'memoryId', 'profileId'],
    fieldTypes:   { timestamp: 'number', memoryId: 'string', profileId: 'string' },
    allowedEmitters: ['memoryService'],
  });

  registerEventContract({
    eventType:    ALL_EVENTS.MEMORY_UPDATED,
    description:  'Emitted when an existing memory is updated.',
    requiredFields: ['timestamp', 'memoryId', 'profileId'],
    fieldTypes:   { timestamp: 'number', memoryId: 'string', profileId: 'string' },
    allowedEmitters: ['memoryService'],
  });

  registerEventContract({
    eventType:    ALL_EVENTS.MEMORY_RESTORED,
    description:  'Emitted when memories are restored from persistence.',
    requiredFields: ['timestamp', 'profileId', 'count'],
    fieldTypes:   { timestamp: 'number', profileId: 'string', count: 'number' },
    allowedEmitters: ['memoryService', 'hydration'],
  });

  // ── MEDIA ────────────────────────────────────────────────────
  registerEventContract({
    eventType:    ALL_EVENTS.MEDIA_UPLOADED,
    description:  'Emitted when a media asset is registered.',
    requiredFields: ['timestamp', 'mediaId', 'profileId', 'type'],
    fieldTypes:   { timestamp: 'number', mediaId: 'string', profileId: 'string', type: 'string' },
    allowedEmitters: ['mediaService'],
  });

  registerEventContract({
    eventType:    ALL_EVENTS.MEDIA_ANALYZED,
    description:  'Emitted when media analysis completes.',
    requiredFields: ['timestamp', 'mediaId'],
    fieldTypes:   { timestamp: 'number', mediaId: 'string' },
    allowedEmitters: ['mediaService'],
  });

  registerEventContract({
    eventType:    ALL_EVENTS.RECONSTRUCTION_COMPLETE,
    description:  'Emitted when a reconstruction job finishes.',
    requiredFields: ['timestamp', 'jobId', 'profileId'],
    fieldTypes:   { timestamp: 'number', jobId: 'string', profileId: 'string' },
    allowedEmitters: ['reconstructionService'],
  });

  // ── AI ───────────────────────────────────────────────────────
  registerEventContract({
    eventType:    ALL_EVENTS.AGENT_REGISTERED,
    description:  'Emitted when an AI agent is registered in runtime.',
    requiredFields: ['timestamp', 'agentId'],
    fieldTypes:   { timestamp: 'number', agentId: 'string' },
    allowedEmitters: ['aiService'],
  });

  registerEventContract({
    eventType:    ALL_EVENTS.AGENT_REMOVED,
    description:  'Emitted when an AI agent is removed from runtime.',
    requiredFields: ['timestamp', 'agentId'],
    fieldTypes:   { timestamp: 'number', agentId: 'string' },
    allowedEmitters: ['aiService'],
  });

  registerEventContract({
    eventType:    ALL_EVENTS.TASK_CREATED,
    description:  'Emitted when a task is enqueued for AI dispatch.',
    requiredFields: ['timestamp', 'taskId'],
    fieldTypes:   { timestamp: 'number', taskId: 'string' },
    allowedEmitters: ['aiService'],
  });

  registerEventContract({
    eventType:    ALL_EVENTS.TASK_COMPLETED,
    description:  'Emitted when an AI task resolves.',
    requiredFields: ['timestamp', 'taskId', 'success'],
    fieldTypes:   { timestamp: 'number', taskId: 'string', success: 'boolean' },
    allowedEmitters: ['aiService'],
  });

  // ── NOTIFICATION ─────────────────────────────────────────────
  registerEventContract({
    eventType:    ALL_EVENTS.NOTIFICATION_QUEUED,
    description:  'Emitted when a notification is added to the queue.',
    requiredFields: ['timestamp', 'notificationId', 'type'],
    fieldTypes:   { timestamp: 'number', notificationId: 'string', type: 'string' },
    allowedEmitters: ['notificationService'],
  });

  registerEventContract({
    eventType:    ALL_EVENTS.NOTIFICATION_DELIVERED,
    description:  'Emitted when a notification is delivered.',
    requiredFields: ['timestamp', 'notificationId'],
    fieldTypes:   { timestamp: 'number', notificationId: 'string' },
    allowedEmitters: ['notificationService'],
  });

  registerEventContract({
    eventType:    ALL_EVENTS.NOTIFICATION_DISMISSED,
    description:  'Emitted when a notification is dismissed.',
    requiredFields: ['timestamp', 'notificationId'],
    fieldTypes:   { timestamp: 'number', notificationId: 'string' },
    allowedEmitters: ['notificationService'],
  });

  // ── RECONSTRUCTION ───────────────────────────────────────────
  registerEventContract({
    eventType:    ALL_EVENTS.JOB_REGISTERED,
    description:  'Emitted when a reconstruction job is registered.',
    requiredFields: ['timestamp', 'jobId', 'profileId'],
    fieldTypes:   { timestamp: 'number', jobId: 'string', profileId: 'string' },
    allowedEmitters: ['reconstructionService'],
  });

  registerEventContract({
    eventType:    ALL_EVENTS.JOB_STARTED,
    description:  'Emitted when a reconstruction job begins processing.',
    requiredFields: ['timestamp', 'jobId'],
    fieldTypes:   { timestamp: 'number', jobId: 'string' },
    allowedEmitters: ['reconstructionService'],
  });

  registerEventContract({
    eventType:    ALL_EVENTS.JOB_COMPLETE,
    description:  'Emitted when a reconstruction job completes.',
    requiredFields: ['timestamp', 'jobId', 'success'],
    fieldTypes:   { timestamp: 'number', jobId: 'string', success: 'boolean' },
    allowedEmitters: ['reconstructionService'],
  });

  registerEventContract({
    eventType:    ALL_EVENTS.JOB_FAILED,
    description:  'Emitted when a reconstruction job fails.',
    requiredFields: ['timestamp', 'jobId', 'error'],
    fieldTypes:   { timestamp: 'number', jobId: 'string', error: 'string' },
    allowedEmitters: ['reconstructionService'],
  });

  const count = _contracts.size;
  RegistryLogger.info(`[EventRegistry] ${count} event contracts registered.`);
  return count;
}
