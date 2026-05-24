// ================================================================
// IMMORTAIL™ — SYSTEM HEALTH MONITOR
// Runtime health tracking across all subsystem layers.
// MONITORING ONLY. NO FEATURE LOGIC. NO STATE MUTATIONS.
// ================================================================

import { SystemLogger } from '../utils/logger.js';
const HealthLogger = SystemLogger;

// ----------------------------------------------------------------
// HEALTH STATUS LEVELS
// ----------------------------------------------------------------

export const HEALTH_STATUS = {
  HEALTHY:    'healthy',
  DEGRADED:   'degraded',
  CRITICAL:   'critical',
  UNKNOWN:    'unknown',
  OFFLINE:    'offline',
};

// ----------------------------------------------------------------
// SUBSYSTEM KEYS
// ----------------------------------------------------------------

export const SUBSYSTEM = {
  STORAGE:       'storage',
  STATE:         'state',
  EVENTS:        'events',
  AGENTS:        'agents',
  COMPANION:     'companion',
  MEDIA:         'media',
  RENDERING:     'rendering',
  UI:            'ui',
  INTEGRATION:   'integration',
  ORCHESTRATION: 'orchestration',
};

// ----------------------------------------------------------------
// HEALTH THRESHOLDS
// ----------------------------------------------------------------

const THRESHOLDS = {
  CHECK_INTERVAL_MS:      30_000,  // 30s between auto checks
  STALE_THRESHOLD_MS:     60_000,  // 60s without update = degraded
  CRITICAL_THRESHOLD_MS: 120_000,  // 120s without update = critical
  MAX_ERROR_RATE:         0.15,    // 15% error rate = degraded
  MAX_EVENT_LAG_MS:       5_000,   // 5s event lag = degraded
};

// ----------------------------------------------------------------
// INTERNAL STATE
// ----------------------------------------------------------------

let _initialized    = false;
let _checkInterval  = null;
let _subscribers    = new Set();
let _overallStatus  = HEALTH_STATUS.UNKNOWN;

/** @type {Map<string, SubsystemHealth>} */
const _subsystems = new Map();

class SubsystemHealth {
  constructor(id) {
    this.id            = id;
    this.status        = HEALTH_STATUS.UNKNOWN;
    this.lastCheckAt   = null;
    this.lastHealthyAt = null;
    this.errors        = [];
    this.metrics       = {};
    this.metadata      = {};
    this.updatedAt     = Date.now();
  }
}

// ----------------------------------------------------------------
// INITIALIZE SYSTEM HEALTH
// ----------------------------------------------------------------

/**
 * Initialize the system health monitor.
 * @param {Object} [options]
 * @param {boolean} [options.autoCheck=false]  — enable periodic checks
 * @param {number}  [options.intervalMs]
 * @returns {Object} initial health status
 */
export function initializeSystemHealth(options = {}) {
  if (_initialized) {
    HealthLogger.warn('[SystemHealth] Already initialized.');
    return getSystemHealthStatus();
  }

  // Register all subsystems
  for (const key of Object.values(SUBSYSTEM)) {
    _subsystems.set(key, new SubsystemHealth(key));
  }

  _initialized = true;

  if (options.autoCheck) {
    const interval = options.intervalMs || THRESHOLDS.CHECK_INTERVAL_MS;
    _checkInterval = setInterval(() => {
      try { runHealthCheck(); }
      catch (err) { HealthLogger.error(`[SystemHealth] Auto-check error: ${err.message}`); }
    }, interval);
  }

  HealthLogger.info(
    `[SystemHealth] Initialized — ${_subsystems.size} subsystems, ` +
    `autoCheck: ${!!options.autoCheck}`
  );

  return getSystemHealthStatus();
}

// ----------------------------------------------------------------
// RUN HEALTH CHECK
// ----------------------------------------------------------------

/**
 * Run a full health check across all subsystems.
 * Integrates with existing state/storage getters without importing them
 * directly (decoupled via passed probe functions).
 *
 * @param {Object} [probes]  — optional subsystem probe functions
 * @returns {Object} health status snapshot
 */
export function runHealthCheck(probes = {}) {
  if (!_initialized) {
    HealthLogger.warn('[SystemHealth] Not initialized.');
    return getSystemHealthStatus();
  }

  HealthLogger.debug('[SystemHealth] Running health check...');
  const now = Date.now();

  for (const [key, health] of _subsystems) {
    const probe = probes[key];

    if (typeof probe === 'function') {
      // External probe provided — run it
      try {
        const result = probe();
        _applyProbeResult(health, result, now);
      } catch (err) {
        _recordError(health, err.message, now);
      }
    } else {
      // No probe — check staleness
      if (health.lastCheckAt === null) {
        health.status = HEALTH_STATUS.UNKNOWN;
      } else {
        const age = now - health.lastCheckAt;
        if      (age > THRESHOLDS.CRITICAL_THRESHOLD_MS) health.status = HEALTH_STATUS.CRITICAL;
        else if (age > THRESHOLDS.STALE_THRESHOLD_MS)    health.status = HEALTH_STATUS.DEGRADED;
        // else keep current status
      }
    }

    health.lastCheckAt = now;
    health.updatedAt   = now;
  }

  _recomputeOverall();
  _notifySubscribers();

  return getSystemHealthStatus();
}

// ----------------------------------------------------------------
// REPORT SUBSYSTEM HEALTH
// ----------------------------------------------------------------

/**
 * Report health status for a specific subsystem.
 * Called by subsystem initializers after their boot step.
 *
 * @param {string} subsystemId   — SUBSYSTEM value
 * @param {string} status        — HEALTH_STATUS value
 * @param {Object} [metrics]
 * @param {string} [errorMsg]
 */
export function reportSubsystemHealth(subsystemId, status, metrics = {}, errorMsg = null) {
  const health = _subsystems.get(subsystemId);
  if (!health) {
    HealthLogger.warn(`[SystemHealth] Unknown subsystem: "${subsystemId}".`);
    return;
  }

  const validStatuses = Object.values(HEALTH_STATUS);
  if (!validStatuses.includes(status)) {
    HealthLogger.warn(`[SystemHealth] Invalid status "${status}" for "${subsystemId}".`);
    return;
  }

  const now = Date.now();
  health.status      = status;
  health.lastCheckAt = now;
  health.metrics     = { ...health.metrics, ...metrics };
  health.updatedAt   = now;

  if (status === HEALTH_STATUS.HEALTHY) health.lastHealthyAt = now;
  if (errorMsg) _recordError(health, errorMsg, now);

  _recomputeOverall();
  _notifySubscribers();

  HealthLogger.debug(`[SystemHealth] Reported: ${subsystemId} → ${status}`);
}

// ----------------------------------------------------------------
// SUBSCRIBE TO HEALTH UPDATES
// ----------------------------------------------------------------

/**
 * Subscribe to health status changes.
 * @param {Function} callback — (status: Object) => void
 * @returns {Function} unsubscribe
 */
export function subscribeHealthUpdates(callback) {
  if (typeof callback !== 'function') {
    throw new SystemHealthError('[SystemHealth] subscribeHealthUpdates: callback must be a function.');
  }
  _subscribers.add(callback);
  return () => _subscribers.delete(callback);
}

// ----------------------------------------------------------------
// GET SYSTEM HEALTH STATUS
// ----------------------------------------------------------------

export function getSystemHealthStatus() {
  const subsystemMap = {};
  for (const [key, health] of _subsystems) {
    subsystemMap[key] = {
      id:            health.id,
      status:        health.status,
      lastCheckAt:   health.lastCheckAt,
      lastHealthyAt: health.lastHealthyAt,
      errorCount:    health.errors.length,
      recentErrors:  health.errors.slice(-3),
      metrics:       { ...health.metrics },
    };
  }

  return {
    initialized:    _initialized,
    overallStatus:  _overallStatus,
    checkedAt:      Date.now(),
    subsystems:     subsystemMap,
    summary: {
      total:    _subsystems.size,
      healthy:  _countByStatus(HEALTH_STATUS.HEALTHY),
      degraded: _countByStatus(HEALTH_STATUS.DEGRADED),
      critical: _countByStatus(HEALTH_STATUS.CRITICAL),
      unknown:  _countByStatus(HEALTH_STATUS.UNKNOWN),
      offline:  _countByStatus(HEALTH_STATUS.OFFLINE),
    },
  };
}

// ----------------------------------------------------------------
// DESTROY
// ----------------------------------------------------------------

export function destroySystemHealth() {
  if (_checkInterval) { clearInterval(_checkInterval); _checkInterval = null; }
  _subscribers.clear();
  _subsystems.clear();
  _initialized   = false;
  _overallStatus = HEALTH_STATUS.UNKNOWN;
  HealthLogger.info('[SystemHealth] Destroyed.');
}

// ----------------------------------------------------------------
// INTERNAL: Apply probe result
// ----------------------------------------------------------------

function _applyProbeResult(health, result, now) {
  if (!result || typeof result !== 'object') {
    health.status = HEALTH_STATUS.UNKNOWN;
    return;
  }

  if (result.status) health.status = result.status;
  if (result.metrics) health.metrics = { ...health.metrics, ...result.metrics };
  if (result.error) _recordError(health, result.error, now);
  if (health.status === HEALTH_STATUS.HEALTHY) health.lastHealthyAt = now;
}

function _recordError(health, msg, now) {
  health.errors.push({ message: msg, at: now });
  if (health.errors.length > 20) health.errors = health.errors.slice(-20);
}

function _recomputeOverall() {
  const statuses = Array.from(_subsystems.values()).map(h => h.status);

  if (statuses.some(s => s === HEALTH_STATUS.CRITICAL)) {
    _overallStatus = HEALTH_STATUS.CRITICAL;
  } else if (statuses.some(s => s === HEALTH_STATUS.DEGRADED)) {
    _overallStatus = HEALTH_STATUS.DEGRADED;
  } else if (statuses.every(s => s === HEALTH_STATUS.HEALTHY)) {
    _overallStatus = HEALTH_STATUS.HEALTHY;
  } else if (statuses.some(s => s === HEALTH_STATUS.OFFLINE)) {
    _overallStatus = HEALTH_STATUS.DEGRADED;
  } else {
    _overallStatus = HEALTH_STATUS.UNKNOWN;
  }
}

function _countByStatus(status) {
  let count = 0;
  for (const h of _subsystems.values()) if (h.status === status) count++;
  return count;
}

function _notifySubscribers() {
  const status = getSystemHealthStatus();
  for (const cb of _subscribers) {
    try { cb(status); }
    catch (err) { HealthLogger.warn(`[SystemHealth] Subscriber error: ${err.message}`); }
  }
}

// ----------------------------------------------------------------
// ERROR
// ----------------------------------------------------------------

export class SystemHealthError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name      = 'SystemHealthError';
    this.context   = context;
    this.timestamp = Date.now();
  }
}
