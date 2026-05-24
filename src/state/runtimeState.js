// ================================================================
// IMMORTAIL™ — ACTIVE RUNTIME STATE MANAGER
// Transient runtime metadata, lifecycle tracking, timestamps.
// MEMORY-ONLY. NOT PERSISTED. NOT SHARED WITH UI DIRECTLY.
// ================================================================

import { SystemLogger } from '../utils/logger.js';

const RuntimeStateLogger = SystemLogger;

// ----------------------------------------------------------------
// INITIAL RUNTIME STATE
// ----------------------------------------------------------------

const INITIAL_RUNTIME_STATE = {
  // Lifecycle completion flags
  bootComplete:      false,
  hydrationComplete: false,
  recoveryComplete:  false,
  sessionRestored:   false,

  // Active runtime modules
  activeModules: {},

  // Timestamps
  timestamps: {
    bootStartedAt:         null,
    bootCompletedAt:       null,
    hydrationStartedAt:    null,
    hydrationCompletedAt:  null,
    recoveryStartedAt:     null,
    recoveryCompletedAt:   null,
    sessionRestoredAt:     null,
    lastUpdatedAt:         null,
  },

  // Runtime error tracking (non-fatal)
  warnings: [],
  errors:   [],

  // Transient execution references
  activeTaskCount: 0,
  pendingOps:      [],
};

// ----------------------------------------------------------------
// INTERNAL STATE
// ----------------------------------------------------------------

let _runtimeState = _deepClone(INITIAL_RUNTIME_STATE);
let _subscribers  = new Map();
let _idCounter    = 0;

// ----------------------------------------------------------------
// DEEP CLONE UTILITY
// ----------------------------------------------------------------

function _deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ----------------------------------------------------------------
// NOTIFY SUBSCRIBERS
// ----------------------------------------------------------------

function _notifySubscribers(prev, next) {
  for (const [id, fn] of _subscribers) {
    try {
      fn(next, prev);
    } catch (err) {
      RuntimeStateLogger.error(`[RuntimeState] Subscriber ${id} threw: ${err.message}`);
    }
  }
}

// ----------------------------------------------------------------
// GET RUNTIME STATE
// ----------------------------------------------------------------

/**
 * Returns a deep-cloned snapshot of current runtime state.
 * @returns {Object}
 */
export function getRuntimeState() {
  return _deepClone(_runtimeState);
}

// ----------------------------------------------------------------
// UPDATE RUNTIME STATE
// ----------------------------------------------------------------

/**
 * Immutable-safe patch merge. Triggers subscribers.
 * @param {Object} patch
 */
export function updateRuntimeState(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    RuntimeStateLogger.error('[RuntimeState] updateRuntimeState: patch must be a plain object.');
    return;
  }

  const prev = _deepClone(_runtimeState);

  _runtimeState = {
    ..._runtimeState,
    ...patch,
    timestamps: {
      ..._runtimeState.timestamps,
      ...(patch.timestamps || {}),
      lastUpdatedAt: Date.now(),
    },
    activeModules: {
      ..._runtimeState.activeModules,
      ...(patch.activeModules || {}),
    },
    warnings: patch.warnings !== undefined ? patch.warnings : _runtimeState.warnings,
    errors:   patch.errors   !== undefined ? patch.errors   : _runtimeState.errors,
    pendingOps: patch.pendingOps !== undefined ? patch.pendingOps : _runtimeState.pendingOps,
  };

  RuntimeStateLogger.debug('[RuntimeState] Runtime state updated.');
  _notifySubscribers(prev, _deepClone(_runtimeState));
}

// ----------------------------------------------------------------
// SUBSCRIBE TO RUNTIME STATE
// ----------------------------------------------------------------

/**
 * @param {Function} fn — (nextState, prevState) => void
 * @returns {Function} unsubscribe
 */
export function subscribeToRuntimeState(fn) {
  if (typeof fn !== 'function') {
    RuntimeStateLogger.error('[RuntimeState] Subscriber must be a function.');
    return () => {};
  }

  const id = ++_idCounter;
  _subscribers.set(id, fn);
  RuntimeStateLogger.debug(`[RuntimeState] Subscriber added (id: ${id}). Total: ${_subscribers.size}`);

  return function unsubscribe() {
    _subscribers.delete(id);
    RuntimeStateLogger.debug(`[RuntimeState] Subscriber removed (id: ${id}).`);
  };
}

// ----------------------------------------------------------------
// PUSH WARNING / ERROR
// ----------------------------------------------------------------

export function pushRuntimeWarning(message) {
  const entry = { message, timestamp: Date.now() };
  _runtimeState.warnings = [..._runtimeState.warnings, entry];
  RuntimeStateLogger.warn(`[RuntimeState] Warning: ${message}`);
}

export function pushRuntimeError(message) {
  const entry = { message, timestamp: Date.now() };
  _runtimeState.errors = [..._runtimeState.errors, entry];
  RuntimeStateLogger.error(`[RuntimeState] Error logged: ${message}`);
}

// ----------------------------------------------------------------
// MARK LIFECYCLE MILESTONES
// ----------------------------------------------------------------

export function markBootComplete() {
  updateRuntimeState({
    bootComplete: true,
    timestamps: { bootCompletedAt: Date.now() },
  });
  RuntimeStateLogger.info('[RuntimeState] Boot marked complete.');
}

export function markHydrationComplete() {
  updateRuntimeState({
    hydrationComplete: true,
    timestamps: { hydrationCompletedAt: Date.now() },
  });
  RuntimeStateLogger.info('[RuntimeState] Hydration marked complete.');
}

export function markRecoveryComplete() {
  updateRuntimeState({
    recoveryComplete: true,
    timestamps: { recoveryCompletedAt: Date.now() },
  });
  RuntimeStateLogger.info('[RuntimeState] Recovery marked complete.');
}

export function markSessionRestored() {
  updateRuntimeState({
    sessionRestored: true,
    timestamps: { sessionRestoredAt: Date.now() },
  });
  RuntimeStateLogger.info('[RuntimeState] Session marked restored.');
}

// ----------------------------------------------------------------
// RESET
// ----------------------------------------------------------------

export function resetRuntimeState() {
  RuntimeStateLogger.warn('[RuntimeState] Resetting runtime state.');
  const prev = _deepClone(_runtimeState);
  _runtimeState = _deepClone(INITIAL_RUNTIME_STATE);
  _notifySubscribers(prev, _deepClone(_runtimeState));
}
