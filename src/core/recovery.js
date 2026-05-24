// ================================================================
// IMMORTAIL™ — ACTIVE RECOVERY ENGINE (Run 3 — Full Implementation)
// Crash recovery, failed hydration recovery, safe mode, resets.
// NO STORAGE DIRECT ACCESS — routes through storageService.
// ================================================================

import { RECOVERY_STATUS, SYSTEM_EVENTS } from '../utils/constants.js';
import { RecoveryLogger } from '../utils/logger.js';
import { updateRuntimeState as updateCoreRuntime, setRuntimeDegraded } from './runtime.js';
import { updateAppState }      from '../state/appState.js';
import { updateRuntimeState, markRecoveryComplete, pushRuntimeError, resetRuntimeState } from '../state/runtimeState.js';
import { resetDogState }       from '../state/dogState.js';
import { resetAIState }        from '../state/aiState.js';
import { invalidateSession, createSession } from '../state/sessionState.js';

// ----------------------------------------------------------------
// RECOVERY MODES
// ----------------------------------------------------------------

export const RECOVERY_MODE = {
  NORMAL:   'normal',
  SAFE:     'safe',
  RECOVERY: 'recovery',
  DEGRADED: 'degraded',
};

// ----------------------------------------------------------------
// RECOVERY EVENTS
// ----------------------------------------------------------------

const RECOVERY_EVENT       = 'IMMORTAIL_RECOVERY_TRIGGERED';
const SAFE_MODE_EVENT      = 'IMMORTAIL_SAFE_MODE_ENTERED';
const RECOVERY_DONE_EVENT  = 'IMMORTAIL_RECOVERY_COMPLETE';

// ----------------------------------------------------------------
// INTERNAL RECOVERY STATE
// ----------------------------------------------------------------

let _recoveryState = {
  status:       RECOVERY_STATUS.IDLE,
  mode:         RECOVERY_MODE.NORMAL,
  triggeredAt:  null,
  resolvedAt:   null,
  reason:       null,
  error:        null,
  attemptCount: 0,
  hooks: {
    onCrash:    [],
    onRecover:  [],
    onFallback: [],
    onSafeMode: [],
  },
};

// ----------------------------------------------------------------
// INITIALIZE RECOVERY
// ----------------------------------------------------------------

/**
 * Boot step 10 — bind global handlers, register recovery system.
 */
export function initializeRecovery() {
  RecoveryLogger.group('Recovery Engine Initialization');

  _bindGlobalErrorHandlers();
  updateCoreRuntime({ flags: { recoveryReady: true } });
  updateAppState({ flags: { recoveryReady: true } });

  RecoveryLogger.info('[Recovery] Recovery engine active. Global handlers bound.');
  RecoveryLogger.groupEnd();

  return getRecoveryState();
}

// ----------------------------------------------------------------
// GET RECOVERY STATE
// ----------------------------------------------------------------

export function getRecoveryState() {
  return {
    status:       _recoveryState.status,
    mode:         _recoveryState.mode,
    triggeredAt:  _recoveryState.triggeredAt,
    resolvedAt:   _recoveryState.resolvedAt,
    reason:       _recoveryState.reason,
    error:        _recoveryState.error,
    attemptCount: _recoveryState.attemptCount,
  };
}

// ----------------------------------------------------------------
// RECOVER RUNTIME
// ----------------------------------------------------------------

/**
 * Execute the full recovery pipeline after a crash or failed hydration.
 * @param {string} reason
 * @param {Error|null} error
 * @returns {Promise<Object>} recovery state
 */
export async function recoverRuntime(reason, error = null) {
  RecoveryLogger.group('Runtime Recovery Pipeline');

  _recoveryState.status      = RECOVERY_STATUS.TRIGGERED;
  _recoveryState.triggeredAt = Date.now();
  _recoveryState.reason      = reason;
  _recoveryState.error       = error
    ? { message: error.message, stack: error.stack }
    : null;
  _recoveryState.attemptCount++;

  RecoveryLogger.warn(`[Recovery] Recovery triggered — reason: ${reason}, attempt: ${_recoveryState.attemptCount}`);

  pushRuntimeError(`Recovery triggered: ${reason}`);

  _emitEvent(RECOVERY_EVENT, { reason, error: _recoveryState.error, attempt: _recoveryState.attemptCount });

  // Run crash hooks
  await _runHooks('onCrash', { reason, error });

  _recoveryState.status = RECOVERY_STATUS.RECOVERING;
  RecoveryLogger.info('[Recovery] Executing recovery steps...');

  try {
    // ── Step 1: Invalidate current session ──────────────────────
    invalidateSession(reason);
    RecoveryLogger.info('[Recovery] Session invalidated.');

    // ── Step 2: Evaluate recovery mode ──────────────────────────
    if (_recoveryState.attemptCount >= 3) {
      RecoveryLogger.warn('[Recovery] Multiple attempts — entering DEGRADED mode.');
      await enterSafeMode('max_recovery_attempts_reached');
      return getRecoveryState();
    }

    // ── Step 3: Reset volatile state containers ──────────────────
    resetDogState();
    resetAIState();
    RecoveryLogger.info('[Recovery] Volatile state containers reset.');

    // ── Step 4: Restore a fresh session ─────────────────────────
    createSession({ recoveredFrom: reason });
    RecoveryLogger.info('[Recovery] Fresh session created post-recovery.');

    // ── Step 5: Run recovery hooks ───────────────────────────────
    await _runHooks('onRecover', { reason });

    // ── Step 6: Mark recovery complete ───────────────────────────
    _recoveryState.status     = RECOVERY_STATUS.RESOLVED;
    _recoveryState.resolvedAt = Date.now();

    markRecoveryComplete();
    updateAppState({
      recovered: true,
      timestamps: { recoveredAt: _recoveryState.resolvedAt },
    });

    _emitEvent(RECOVERY_DONE_EVENT, {
      reason,
      duration: _recoveryState.resolvedAt - _recoveryState.triggeredAt,
    });

    RecoveryLogger.info('[Recovery] Runtime recovery RESOLVED.');

  } catch (recoveryErr) {
    _recoveryState.status = RECOVERY_STATUS.UNRESOLVABLE;
    RecoveryLogger.error(`[Recovery] Recovery pipeline FAILED: ${recoveryErr.message}`);

    await _runHooks('onFallback', { reason, error: recoveryErr });
    await enterSafeMode(`recovery_pipeline_error: ${recoveryErr.message}`);
  } finally {
    RecoveryLogger.groupEnd();
  }

  return getRecoveryState();
}

// ----------------------------------------------------------------
// ENTER SAFE MODE
// ----------------------------------------------------------------

/**
 * Place the runtime into safe mode — minimal functionality.
 * State containers are reset. Storage is preserved.
 * @param {string} reason
 */
export async function enterSafeMode(reason = 'unknown') {
  RecoveryLogger.group('Safe Mode Entry');
  RecoveryLogger.warn(`[Recovery] Entering SAFE MODE — reason: ${reason}`);

  _recoveryState.mode   = RECOVERY_MODE.SAFE;
  _recoveryState.status = RECOVERY_STATUS.TRIGGERED;

  // Degrade runtime — storage is NOT touched
  resetRuntimeState();
  resetDogState();
  resetAIState();
  invalidateSession('safe_mode');

  setRuntimeDegraded(`Safe mode entered: ${reason}`);

  updateAppState({
    flags: {
      hydrationReady: false,
      sessionReady:   false,
    },
    meta: { safeMode: true, safeModeReason: reason },
  });

  _emitEvent(SAFE_MODE_EVENT, { reason });

  await _runHooks('onSafeMode', { reason });

  RecoveryLogger.warn('[Recovery] Safe mode active. Minimal runtime only.');
  RecoveryLogger.groupEnd();
}

// ----------------------------------------------------------------
// RESET RUNTIME RECOVERY
// ----------------------------------------------------------------

/**
 * Reset the recovery state after a successful recovery cycle.
 * Does not reset storage or session — state containers only.
 */
export function resetRuntimeRecovery() {
  RecoveryLogger.info('[Recovery] Resetting recovery state.');

  _recoveryState = {
    ..._recoveryState,
    status:       RECOVERY_STATUS.IDLE,
    mode:         RECOVERY_MODE.NORMAL,
    triggeredAt:  null,
    resolvedAt:   null,
    reason:       null,
    error:        null,
    attemptCount: 0,
    // hooks remain registered
  };
}

// ----------------------------------------------------------------
// SAFE FALLBACK STATE
// ----------------------------------------------------------------

export function getSafeFallbackState() {
  return {
    isFallback:  true,
    mode:        _recoveryState.mode,
    reason:      _recoveryState.reason,
    timestamp:   Date.now(),
  };
}

// ----------------------------------------------------------------
// HOOK REGISTRATION
// ----------------------------------------------------------------

export function onCrash(fn) {
  _registerHook('onCrash', fn);
}

export function onRecover(fn) {
  _registerHook('onRecover', fn);
}

export function onFallback(fn) {
  _registerHook('onFallback', fn);
}

export function onSafeMode(fn) {
  _registerHook('onSafeMode', fn);
}

function _registerHook(type, fn) {
  if (typeof fn !== 'function') {
    RecoveryLogger.warn(`[Recovery] Hook [${type}] must be a function.`);
    return;
  }
  _recoveryState.hooks[type].push(fn);
  RecoveryLogger.debug(`[Recovery] Hook registered: ${type}`);
}

// ----------------------------------------------------------------
// INTERNAL: Run hooks
// ----------------------------------------------------------------

async function _runHooks(type, payload = {}) {
  const hooks = _recoveryState.hooks[type] || [];
  RecoveryLogger.debug(`[Recovery] Running ${hooks.length} hook(s): ${type}`);

  for (const fn of hooks) {
    try {
      await fn(payload);
    } catch (err) {
      RecoveryLogger.error(`[Recovery] Hook error [${type}]: ${err.message}`);
    }
  }
}

// ----------------------------------------------------------------
// INTERNAL: Emit DOM event
// ----------------------------------------------------------------

function _emitEvent(eventName, detail = {}) {
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
    RecoveryLogger.debug(`[Recovery] Event emitted: ${eventName}`);
  }
}

// ----------------------------------------------------------------
// BIND GLOBAL ERROR HANDLERS
// ----------------------------------------------------------------

function _bindGlobalErrorHandlers() {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    RecoveryLogger.error(`[Recovery] Unhandled error: ${event.message}`);
    recoverRuntime('unhandled_error', event.error);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = typeof event.reason === 'string'
      ? event.reason
      : event.reason?.message || 'unknown_rejection';
    RecoveryLogger.error(`[Recovery] Unhandled rejection: ${reason}`);
    recoverRuntime('unhandled_rejection', { message: reason, stack: event.reason?.stack });
  });

  RecoveryLogger.debug('[Recovery] Global error handlers bound.');
}
