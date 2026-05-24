// ================================================================
// IMMORTAIL™ — HYDRATION FOUNDATION
// Hydration lifecycle, state tracking, and hooks.
// NO STORAGE ACCESS. MOCK-SAFE STRUCTURE ONLY.
// ================================================================

import { HYDRATION_STATUS } from '../utils/constants.js';
import { HydrationLogger } from '../utils/logger.js';
import { updateRuntimeState } from './runtime.js';

// ----------------------------------------------------------------
// INTERNAL HYDRATION STATE
// ----------------------------------------------------------------

let _hydrationState = {
  status: HYDRATION_STATUS.IDLE,
  startedAt: null,
  completedAt: null,
  error: null,
  hooks: [],
};

// ----------------------------------------------------------------
// INITIALIZE HYDRATION
// ----------------------------------------------------------------

export async function initializeHydration() {
  HydrationLogger.group('Hydration Initialization');

  if (_hydrationState.status !== HYDRATION_STATUS.IDLE) {
    HydrationLogger.warn('Hydration already initialized. Skipping.');
    HydrationLogger.groupEnd();
    return _hydrationState;
  }

  _hydrationState.status = HYDRATION_STATUS.PENDING;
  _hydrationState.startedAt = Date.now();

  HydrationLogger.info('Hydration pipeline started.');

  try {
    // Run registered pre-hydration hooks
    await _runHooks('pre');

    // Hydration logic placeholder — storage not implemented in Run 1.
    HydrationLogger.info('Hydration: no storage source active (Run 1 — placeholder).');

    // Run registered post-hydration hooks
    await _runHooks('post');

    _hydrationState.status = HYDRATION_STATUS.COMPLETE;
    _hydrationState.completedAt = Date.now();

    const duration = _hydrationState.completedAt - _hydrationState.startedAt;
    HydrationLogger.info(`Hydration COMPLETE. Duration: ${duration}ms`);

    updateRuntimeState({ flags: { hydrationReady: true } });

  } catch (err) {
    _hydrationState.status = HYDRATION_STATUS.FAILED;
    _hydrationState.error = err.message;
    HydrationLogger.error(`Hydration FAILED: ${err.message}`);
  }

  HydrationLogger.groupEnd();
  return _hydrationState;
}

// ----------------------------------------------------------------
// GET HYDRATION STATE
// ----------------------------------------------------------------

export function getHydrationState() {
  return { ..._hydrationState };
}

// ----------------------------------------------------------------
// REGISTER HYDRATION HOOKS
// ----------------------------------------------------------------

export function registerHydrationHook(phase, fn) {
  if (phase !== 'pre' && phase !== 'post') {
    HydrationLogger.warn(`registerHydrationHook: Invalid phase "${phase}". Use "pre" or "post".`);
    return;
  }
  if (typeof fn !== 'function') {
    HydrationLogger.warn('registerHydrationHook: Hook must be a function.');
    return;
  }

  _hydrationState.hooks.push({ phase, fn });
  HydrationLogger.debug(`Hydration hook registered for phase: ${phase}`);
}

// ----------------------------------------------------------------
// INTERNAL: Run hooks for a given phase
// ----------------------------------------------------------------

async function _runHooks(phase) {
  const hooks = _hydrationState.hooks.filter((h) => h.phase === phase);
  HydrationLogger.info(`Running ${hooks.length} "${phase}" hydration hook(s).`);

  for (const hook of hooks) {
    try {
      await hook.fn();
    } catch (err) {
      HydrationLogger.error(`Hydration hook error [${phase}]: ${err.message}`);
      throw err;
    }
  }
}
