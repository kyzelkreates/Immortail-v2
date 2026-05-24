// ================================================================
// IMMORTAIL™ — RECOVERY FOUNDATION
// Runtime crash recovery hooks, safe fallbacks, restoration prep.
// NO STORAGE RECOVERY. FOUNDATION ONLY.
// ================================================================

import { RECOVERY_STATUS, RUNTIME_EVENTS } from '../utils/constants.js';
import { RecoveryLogger } from '../utils/logger.js';
import { updateRuntimeState } from './runtime.js';

// ----------------------------------------------------------------
// INTERNAL RECOVERY STATE
// ----------------------------------------------------------------

let _recoveryState = {
  status: RECOVERY_STATUS.IDLE,
  triggeredAt: null,
  resolvedAt: null,
  reason: null,
  error: null,
  hooks: {
    onCrash: [],
    onRecover: [],
    onFallback: [],
  },
};

// ----------------------------------------------------------------
// INITIALIZE RECOVERY SYSTEM
// ----------------------------------------------------------------

export function initializeRecovery() {
  RecoveryLogger.group('Recovery Initialization');

  _bindGlobalErrorHandlers();

  updateRuntimeState({ flags: { recoveryReady: true } });

  RecoveryLogger.info('Recovery system initialized. Global handlers bound.');
  RecoveryLogger.groupEnd();

  return _recoveryState;
}

// ----------------------------------------------------------------
// GET RECOVERY STATE
// ----------------------------------------------------------------

export function getRecoveryState() {
  return { ..._recoveryState, hooks: undefined };
}

// ----------------------------------------------------------------
// REGISTER RECOVERY HOOKS
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

function _registerHook(type, fn) {
  if (typeof fn !== 'function') {
    RecoveryLogger.warn(`registerHook [${type}]: Must be a function.`);
    return;
  }
  _recoveryState.hooks[type].push(fn);
  RecoveryLogger.debug(`Recovery hook registered: ${type}`);
}

// ----------------------------------------------------------------
// TRIGGER RECOVERY
// ----------------------------------------------------------------

export async function triggerRecovery(reason, error = null) {
  RecoveryLogger.group('Recovery Triggered');

  _recoveryState.status = RECOVERY_STATUS.TRIGGERED;
  _recoveryState.triggeredAt = Date.now();
  _recoveryState.reason = reason;
  _recoveryState.error = error ? { message: error.message, stack: error.stack } : null;

  RecoveryLogger.warn(`Recovery triggered — reason: ${reason}`);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(RUNTIME_EVENTS.RECOVERY_TRIGGERED, {
        detail: { reason, error: _recoveryState.error },
      })
    );
  }

  // Run crash hooks
  await _runHooks('onCrash', { reason, error });

  _recoveryState.status = RECOVERY_STATUS.RECOVERING;
  RecoveryLogger.info('Attempting runtime recovery...');

  try {
    // Restoration placeholder — persistence recovery not implemented in Run 1.
    RecoveryLogger.info('Recovery: no persistence to restore (Run 1 — placeholder).');

    await _runHooks('onRecover', { reason });

    _recoveryState.status = RECOVERY_STATUS.RESOLVED;
    _recoveryState.resolvedAt = Date.now();
    RecoveryLogger.info('Recovery RESOLVED.');

  } catch (recoveryError) {
    _recoveryState.status = RECOVERY_STATUS.UNRESOLVABLE;
    RecoveryLogger.error(`Recovery FAILED: ${recoveryError.message}`);

    await _runHooks('onFallback', { reason, recoveryError });
  }

  RecoveryLogger.groupEnd();
  return _recoveryState;
}

// ----------------------------------------------------------------
// SAFE FALLBACK STATE
// ----------------------------------------------------------------

export function getSafeFallbackState() {
  return {
    isFallback: true,
    reason: _recoveryState.reason,
    timestamp: Date.now(),
  };
}

// ----------------------------------------------------------------
// INTERNAL: Run hooks for a recovery phase
// ----------------------------------------------------------------

async function _runHooks(type, payload = {}) {
  const hooks = _recoveryState.hooks[type] || [];
  RecoveryLogger.debug(`Running ${hooks.length} recovery hook(s): ${type}`);

  for (const fn of hooks) {
    try {
      await fn(payload);
    } catch (err) {
      RecoveryLogger.error(`Recovery hook error [${type}]: ${err.message}`);
    }
  }
}

// ----------------------------------------------------------------
// BIND GLOBAL ERROR HANDLERS
// ----------------------------------------------------------------

function _bindGlobalErrorHandlers() {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    RecoveryLogger.error(`Unhandled error: ${event.message}`);
    triggerRecovery('unhandled_error', event.error);
  });

  window.addEventListener('unhandledrejection', (event) => {
    RecoveryLogger.error(`Unhandled promise rejection: ${event.reason}`);
    triggerRecovery('unhandled_rejection', { message: String(event.reason), stack: null });
  });

  RecoveryLogger.debug('Global error handlers bound.');
}
