// ================================================================
// IMMORTAIL™ — ROUTINE ENGINE (FOUNDATION)
// Routine scheduling structures, habit framework, state tracking.
// DETERMINISTIC TIMING. PERSISTENCE-SAFE. NO RANDOM SCHEDULING.
// ================================================================

import { SystemLogger } from '../utils/logger.js';
import { emit }          from '../events/eventBus.js';
import { DOG_EVENTS }    from '../events/eventTypes.js';

const RoutineLogger = SystemLogger;

// ----------------------------------------------------------------
// ROUTINE TYPES
// ----------------------------------------------------------------

export const ROUTINE_TYPE = {
  FEEDING:     'feeding',
  INTERACTION: 'interaction',
  REST:        'rest',
  PLAY:        'play',
  ENGAGEMENT:  'engagement',   // general engagement / attention session
};

// ----------------------------------------------------------------
// ROUTINE STATUS
// ----------------------------------------------------------------

export const ROUTINE_STATUS = {
  PENDING:   'pending',    // due soon or overdue
  ACTIVE:    'active',     // currently in progress
  COMPLETED: 'completed',  // cycle completed
  SKIPPED:   'skipped',    // missed this cycle
  PAUSED:    'paused',     // intentionally paused
};

// ----------------------------------------------------------------
// SCHEDULE FREQUENCY
// ----------------------------------------------------------------

export const SCHEDULE_FREQUENCY = {
  HOURLY:    'hourly',
  DAILY:     'daily',
  WEEKLY:    'weekly',
  CUSTOM:    'custom',     // custom interval in milliseconds
};

// ----------------------------------------------------------------
// DEFAULTS
// ----------------------------------------------------------------

const FREQUENCY_INTERVAL_MS = {
  [SCHEDULE_FREQUENCY.HOURLY]:  60 * 60 * 1000,
  [SCHEDULE_FREQUENCY.DAILY]:   24 * 60 * 60 * 1000,
  [SCHEDULE_FREQUENCY.WEEKLY]:  7 * 24 * 60 * 60 * 1000,
};

const MAX_LOG_ENTRIES = 200;

// ----------------------------------------------------------------
// INTERNAL STATE
// ----------------------------------------------------------------

/** @type {Map<string, RoutineIndex>} profileId → index */
const _indexes = new Map();

class RoutineIndex {
  constructor(profileId) {
    this.profileId  = profileId;
    this.routines   = new Map();   // routineId → RoutineRecord
    this.updatedAt  = Date.now();
    this.createdAt  = Date.now();
  }
}

class RoutineRecord {
  constructor({ id, profileId, type, frequency, customIntervalMs, label, active }) {
    this.id               = id;
    this.profileId        = profileId;
    this.type             = type;
    this.frequency        = frequency;
    this.customIntervalMs = customIntervalMs || null;
    this.label            = label || type;
    this.active           = active ?? true;
    this.status           = ROUTINE_STATUS.PENDING;
    this.cycleCount       = 0;
    this.skippedCount     = 0;
    this.lastCompletedAt  = null;
    this.nextDueAt        = _computeNextDue(frequency, customIntervalMs, null);
    this.registeredAt     = Date.now();
    this.updatedAt        = Date.now();
    this.log              = [];
  }
}

// ----------------------------------------------------------------
// INITIALIZE ROUTINE STATE
// ----------------------------------------------------------------

/**
 * @param {string} profileId
 * @returns {Object} routine snapshot
 */
export function initializeRoutineState(profileId) {
  if (!profileId || typeof profileId !== 'string') {
    throw new RoutineError('[RoutineEngine] initializeRoutineState: profileId required.');
  }

  if (_indexes.has(profileId)) {
    RoutineLogger.warn(`[RoutineEngine] Routine state for "${profileId}" already initialized.`);
    return getRoutineSnapshot(profileId);
  }

  _indexes.set(profileId, new RoutineIndex(profileId));

  RoutineLogger.info(`[RoutineEngine] Routine state initialized — profileId: ${profileId}`);
  return getRoutineSnapshot(profileId);
}

// ----------------------------------------------------------------
// REGISTER ROUTINE
// ----------------------------------------------------------------

/**
 * Register a new routine for a companion profile.
 * @param {string} profileId
 * @param {Object} routineConfig
 * @param {string} routineConfig.id
 * @param {string} routineConfig.type             — ROUTINE_TYPE value
 * @param {string} routineConfig.frequency        — SCHEDULE_FREQUENCY value
 * @param {number} [routineConfig.customIntervalMs] — required if frequency === CUSTOM
 * @param {string} [routineConfig.label]
 * @param {boolean} [routineConfig.active]
 * @returns {Object} routine record snapshot
 */
export function registerRoutine(profileId, routineConfig) {
  const index = _requireIndex(profileId);

  const validation = _validateRoutineConfig(routineConfig);
  if (!validation.valid) {
    throw new RoutineError(
      `[RoutineEngine] registerRoutine validation failed: ${validation.errors.join(' | ')}`
    );
  }

  const { id } = routineConfig;

  if (index.routines.has(id)) {
    RoutineLogger.warn(`[RoutineEngine] Routine "${id}" already registered for "${profileId}". Skipping.`);
    return _snapshotRoutine(index.routines.get(id));
  }

  const record = new RoutineRecord({ ...routineConfig, profileId });
  index.routines.set(id, record);
  index.updatedAt = Date.now();

  RoutineLogger.info(
    `[RoutineEngine] Routine registered — id: ${id}, type: ${routineConfig.type}, ` +
    `frequency: ${routineConfig.frequency}`
  );

  return _snapshotRoutine(record);
}

// ----------------------------------------------------------------
// UPDATE ROUTINE STATE
// ----------------------------------------------------------------

/**
 * Update the status of a routine cycle (complete, skip, pause, etc.)
 * @param {string} profileId
 * @param {string} routineId
 * @param {string} newStatus     — ROUTINE_STATUS value
 * @param {Object} [meta]
 * @returns {Promise<Object>} updated snapshot
 */
export async function updateRoutineState(profileId, routineId, newStatus, meta = {}) {
  const index   = _requireIndex(profileId);
  const routine = index.routines.get(routineId);

  if (!routine) {
    throw new RoutineError(
      `[RoutineEngine] Routine "${routineId}" not found for profile "${profileId}".`
    );
  }

  if (!Object.values(ROUTINE_STATUS).includes(newStatus)) {
    throw new RoutineError(
      `[RoutineEngine] Invalid status: "${newStatus}". Valid: ${Object.values(ROUTINE_STATUS).join(', ')}.`
    );
  }

  const prevStatus = routine.status;
  routine.status   = newStatus;
  routine.updatedAt = Date.now();

  if (newStatus === ROUTINE_STATUS.COMPLETED) {
    routine.cycleCount++;
    routine.lastCompletedAt = Date.now();
    routine.nextDueAt       = _computeNextDue(
      routine.frequency,
      routine.customIntervalMs,
      routine.lastCompletedAt
    );
  }

  if (newStatus === ROUTINE_STATUS.SKIPPED) {
    routine.skippedCount++;
    routine.nextDueAt = _computeNextDue(
      routine.frequency,
      routine.customIntervalMs,
      Date.now()
    );
  }

  routine.log.push({
    from:      prevStatus,
    to:        newStatus,
    timestamp: Date.now(),
    meta,
  });
  if (routine.log.length > MAX_LOG_ENTRIES) routine.log.shift();

  index.updatedAt = Date.now();

  RoutineLogger.info(
    `[RoutineEngine] Routine "${routineId}" status: ${prevStatus} → ${newStatus}`
  );

  await emit(DOG_EVENTS.DOG_STATE_UPDATED, {
    timestamp: Date.now(),
    dogId:     profileId,
    source:    'routineEngine',
    runtimeState: getRoutineSnapshot(profileId),
  });

  return _snapshotRoutine(routine);
}

// ----------------------------------------------------------------
// GET OVERDUE ROUTINES
// ----------------------------------------------------------------

/**
 * Return all routines for a profile that are past their nextDueAt.
 * @param {string} profileId
 * @returns {Object[]}
 */
export function getOverdueRoutines(profileId) {
  const index = _requireIndex(profileId);
  const now   = Date.now();

  return Array.from(index.routines.values())
    .filter((r) => r.active && r.nextDueAt !== null && r.nextDueAt <= now)
    .map(_snapshotRoutine);
}

// ----------------------------------------------------------------
// GET ROUTINE SNAPSHOT
// ----------------------------------------------------------------

/**
 * @param {string} profileId
 * @returns {Object}
 */
export function getRoutineSnapshot(profileId) {
  const index = _requireIndex(profileId);
  const all   = Array.from(index.routines.values());

  return {
    profileId:        index.profileId,
    totalRoutines:    all.length,
    activeRoutines:   all.filter((r) => r.active).length,
    overdueRoutines:  getOverdueRoutines(profileId).length,
    routines:         all.map(_snapshotRoutine),
    updatedAt:        index.updatedAt,
  };
}

// ----------------------------------------------------------------
// RESTORE FROM PERSISTENCE
// ----------------------------------------------------------------

/**
 * @param {string} profileId
 * @param {Object[]} persistedRoutines
 * @returns {Object} snapshot
 */
export function restoreRoutineState(profileId, persistedRoutines) {
  if (!_indexes.has(profileId)) {
    initializeRoutineState(profileId);
  }

  const index   = _indexes.get(profileId);
  let restored  = 0;

  for (const r of persistedRoutines) {
    const validation = _validateRoutineConfig(r);
    if (!validation.valid) {
      RoutineLogger.warn(`[RoutineEngine] Skipping invalid routine "${r?.id}".`);
      continue;
    }

    const record           = new RoutineRecord({ ...r, profileId });
    record.cycleCount      = r.cycleCount      || 0;
    record.skippedCount    = r.skippedCount    || 0;
    record.lastCompletedAt = r.lastCompletedAt || null;
    record.status          = r.status          || ROUTINE_STATUS.PENDING;
    record.nextDueAt       = r.nextDueAt
      || _computeNextDue(r.frequency, r.customIntervalMs, r.lastCompletedAt);

    index.routines.set(record.id, record);
    restored++;
  }

  index.updatedAt = Date.now();

  RoutineLogger.info(
    `[RoutineEngine] Routine state restored — ${restored} routines for "${profileId}".`
  );
  return getRoutineSnapshot(profileId);
}

// ----------------------------------------------------------------
// ENGINE STATUS
// ----------------------------------------------------------------

export function getRoutineEngineStatus() {
  return {
    totalProfiles: _indexes.size,
    profileIds:    Array.from(_indexes.keys()),
  };
}

// ----------------------------------------------------------------
// INTERNAL: Compute next due timestamp
// ----------------------------------------------------------------

function _computeNextDue(frequency, customIntervalMs, fromTimestamp) {
  const base    = fromTimestamp || Date.now();
  const interval = frequency === SCHEDULE_FREQUENCY.CUSTOM
    ? (customIntervalMs || 0)
    : (FREQUENCY_INTERVAL_MS[frequency] || FREQUENCY_INTERVAL_MS[SCHEDULE_FREQUENCY.DAILY]);

  return base + interval;
}

// ----------------------------------------------------------------
// INTERNAL: Snapshot a routine record
// ----------------------------------------------------------------

function _snapshotRoutine(r) {
  return {
    id:              r.id,
    profileId:       r.profileId,
    type:            r.type,
    frequency:       r.frequency,
    label:           r.label,
    active:          r.active,
    status:          r.status,
    cycleCount:      r.cycleCount,
    skippedCount:    r.skippedCount,
    lastCompletedAt: r.lastCompletedAt,
    nextDueAt:       r.nextDueAt,
    registeredAt:    r.registeredAt,
    updatedAt:       r.updatedAt,
  };
}

// ----------------------------------------------------------------
// INTERNAL: Validate routine config
// ----------------------------------------------------------------

function _validateRoutineConfig(config) {
  const errors       = [];
  const validTypes   = Object.values(ROUTINE_TYPE);
  const validFreqs   = Object.values(SCHEDULE_FREQUENCY);

  if (!config?.id || typeof config.id !== 'string') {
    errors.push('Field "id" must be a non-empty string.');
  }
  if (!config?.type || !validTypes.includes(config.type)) {
    errors.push(`Field "type" must be one of: ${validTypes.join(', ')}.`);
  }
  if (!config?.frequency || !validFreqs.includes(config.frequency)) {
    errors.push(`Field "frequency" must be one of: ${validFreqs.join(', ')}.`);
  }
  if (config?.frequency === SCHEDULE_FREQUENCY.CUSTOM &&
      (!config?.customIntervalMs || typeof config.customIntervalMs !== 'number')) {
    errors.push('Field "customIntervalMs" required when frequency is "custom".');
  }

  return { valid: errors.length === 0, errors };
}

// ----------------------------------------------------------------
// INTERNAL: Require index or throw
// ----------------------------------------------------------------

function _requireIndex(profileId) {
  const index = _indexes.get(profileId);
  if (!index) {
    throw new RoutineError(
      `[RoutineEngine] Index for "${profileId}" not found. Call initializeRoutineState() first.`
    );
  }
  return index;
}

// ----------------------------------------------------------------
// ROUTINE ERROR
// ----------------------------------------------------------------

export class RoutineError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name      = 'RoutineError';
    this.context   = context;
    this.timestamp = Date.now();
  }
}
