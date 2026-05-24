// ================================================================
// IMMORTAIL™ — RECONSTRUCTION SERVICE (FOUNDATION)
// Orchestration workflow, pipeline contracts, state coordination.
// NO RECONSTRUCTION ENGINE. FOUNDATION ONLY.
// ================================================================

import { SystemLogger }                        from '../utils/logger.js';
import { emit }                                 from '../events/eventBus.js';
import { RECONSTRUCTION_EVENTS }                from '../events/eventTypes.js';
import { saveEntity, updateEntity, loadEntity } from './storageService.js';
import { STORE_NAMES }                          from '../storage/schemas.js';

const ReconstructionLogger = SystemLogger;

// ----------------------------------------------------------------
// JOB STATUS
// ----------------------------------------------------------------

export const JOB_STATUS = {
  REGISTERED: 'registered',
  PENDING:    'pending',
  PROCESSING: 'processing',
  COMPLETE:   'complete',
  FAILED:     'failed',
  CANCELLED:  'cancelled',
};

// ----------------------------------------------------------------
// INTERNAL RUNTIME JOB REGISTRY
// ----------------------------------------------------------------

/** @type {Map<string, JobRecord>} */
const _runtimeJobs = new Map();
let _initialized   = false;

// ----------------------------------------------------------------
// INITIALIZE RECONSTRUCTION RUNTIME
// ----------------------------------------------------------------

/**
 * Initialize the reconstruction service runtime.
 * @returns {{ initialized: boolean }}
 */
export async function initializeReconstructionRuntime() {
  if (_initialized) {
    ReconstructionLogger.warn('[ReconstructionService] Already initialized. Skipping.');
    return { initialized: true };
  }

  ReconstructionLogger.info('[ReconstructionService] Initializing reconstruction runtime...');

  _initialized = true;

  ReconstructionLogger.info(
    '[ReconstructionService] Reconstruction runtime initialized (foundation — no engine active).'
  );
  return { initialized: true };
}

// ----------------------------------------------------------------
// REGISTER RECONSTRUCTION JOB
// ----------------------------------------------------------------

/**
 * Register a new reconstruction job in runtime and persist it.
 * @param {Object} jobConfig
 * @param {string} jobConfig.id
 * @param {string} jobConfig.profileId
 * @param {Object} [jobConfig.config]    — pipeline config (structure only)
 * @param {Object} [jobConfig.metadata]
 * @returns {string} jobId
 */
export async function registerReconstructionJob(jobConfig) {
  const validation = _validateJobConfig(jobConfig);
  if (!validation.valid) {
    const err = `[ReconstructionService] registerReconstructionJob failed: ${validation.errors.join(' | ')}`;
    ReconstructionLogger.error(err);
    throw new Error(err);
  }

  const { id, profileId, config, metadata } = jobConfig;
  const now = Date.now();

  ReconstructionLogger.info(
    `[ReconstructionService] Registering reconstruction job — id: ${id}, profile: ${profileId}`
  );

  const record = {
    id,
    profileId,
    status:    JOB_STATUS.REGISTERED,
    config:    config    || {},
    createdAt: now,
    updatedAt: now,
  };

  // Persist job record
  await saveEntity(STORE_NAMES.RECONSTRUCTION_PROFILES, record);

  // Register in runtime map
  _runtimeJobs.set(id, {
    ...record,
    metadata: metadata || {},
    runtimeRegisteredAt: now,
  });

  await emit(RECONSTRUCTION_EVENTS.JOB_REGISTERED, {
    timestamp: now,
    jobId:     id,
    profileId,
  });

  ReconstructionLogger.info(`[ReconstructionService] Job registered — id: ${id}`);
  return id;
}

// ----------------------------------------------------------------
// UPDATE RECONSTRUCTION STATE
// ----------------------------------------------------------------

/**
 * Update the status and metadata of an existing reconstruction job.
 * @param {string} jobId
 * @param {Object} patch
 * @param {string} [patch.status]  — must be in JOB_STATUS
 * @param {Object} [patch.config]
 * @returns {Object} updated record
 */
export async function updateReconstructionState(jobId, patch) {
  if (!jobId || typeof jobId !== 'string') {
    throw new Error('[ReconstructionService] updateReconstructionState: jobId required.');
  }

  const existing = await loadEntity(STORE_NAMES.RECONSTRUCTION_PROFILES, jobId);
  if (!existing) {
    throw new Error(`[ReconstructionService] Job "${jobId}" not found.`);
  }

  // Validate status if provided
  if (patch.status && !Object.values(JOB_STATUS).includes(patch.status)) {
    throw new Error(
      `[ReconstructionService] Invalid job status: "${patch.status}". ` +
      `Valid: ${Object.values(JOB_STATUS).join(', ')}.`
    );
  }

  const now     = Date.now();
  const updated = { ...existing, ...patch, id: jobId, updatedAt: now };

  await updateEntity(STORE_NAMES.RECONSTRUCTION_PROFILES, updated);

  // Update runtime map
  const runtimeEntry = _runtimeJobs.get(jobId) || {};
  _runtimeJobs.set(jobId, { ...runtimeEntry, ...updated });

  // Emit appropriate event based on new status
  if (patch.status === JOB_STATUS.PROCESSING) {
    await emit(RECONSTRUCTION_EVENTS.JOB_STARTED, {
      timestamp: now,
      jobId,
    });
  } else if (patch.status === JOB_STATUS.COMPLETE) {
    await emit(RECONSTRUCTION_EVENTS.JOB_COMPLETE, {
      timestamp: now,
      jobId,
      success:   true,
    });
  } else if (patch.status === JOB_STATUS.FAILED) {
    await emit(RECONSTRUCTION_EVENTS.JOB_FAILED, {
      timestamp: now,
      jobId,
      error:     patch.error || 'unknown_failure',
    });
  }

  ReconstructionLogger.info(
    `[ReconstructionService] Job state updated — id: ${jobId}, status: ${updated.status}`
  );
  return updated;
}

// ----------------------------------------------------------------
// GET RUNTIME JOB
// ----------------------------------------------------------------

export function getRuntimeJob(jobId) {
  return _runtimeJobs.get(jobId) || null;
}

export function getAllRuntimeJobs() {
  return Array.from(_runtimeJobs.values());
}

// ----------------------------------------------------------------
// SERVICE STATUS
// ----------------------------------------------------------------

export function getReconstructionServiceStatus() {
  return {
    initialized: _initialized,
    runtimeJobs: _runtimeJobs.size,
    jobStatusBreakdown: _getStatusBreakdown(),
  };
}

// ----------------------------------------------------------------
// INTERNAL HELPERS
// ----------------------------------------------------------------

function _validateJobConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object') {
    errors.push('Job config must be a plain object.');
    return { valid: false, errors };
  }
  if (!config.id || typeof config.id !== 'string') {
    errors.push('Field "id" is required and must be a string.');
  }
  if (!config.profileId || typeof config.profileId !== 'string') {
    errors.push('Field "profileId" is required and must be a string.');
  }
  return { valid: errors.length === 0, errors };
}

function _getStatusBreakdown() {
  const breakdown = {};
  for (const job of _runtimeJobs.values()) {
    breakdown[job.status] = (breakdown[job.status] || 0) + 1;
  }
  return breakdown;
}
