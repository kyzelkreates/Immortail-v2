// ================================================================
// IMMORTAIL™ — AGENT LIFECYCLE CONTROLLER
// Deterministic state transitions for agent lifecycle management.
// NO BUSINESS LOGIC. NO STORAGE ACCESS. COORDINATION ONLY.
// ================================================================

import { SystemLogger } from '../utils/logger.js';
import {
  updateAgentLifecycleStatus,
  updateAgentHealth,
  getAgent,
  AGENT_HEALTH,
} from './registry.js';

const LifecycleLogger = SystemLogger;

// ----------------------------------------------------------------
// LIFECYCLE STATES
// ----------------------------------------------------------------

export const LIFECYCLE_STATE = {
  IDLE:         'idle',
  INITIALIZING: 'initializing',
  ACTIVE:       'active',
  PAUSED:       'paused',
  RECOVERING:   'recovering',
  FAILED:       'failed',
  SHUTDOWN:     'shutdown',
};

// ----------------------------------------------------------------
// ALLOWED TRANSITIONS
// Defines which states can legally move to which next state.
// ----------------------------------------------------------------

const ALLOWED_TRANSITIONS = {
  [LIFECYCLE_STATE.IDLE]:         [LIFECYCLE_STATE.INITIALIZING, LIFECYCLE_STATE.SHUTDOWN],
  [LIFECYCLE_STATE.INITIALIZING]: [LIFECYCLE_STATE.ACTIVE, LIFECYCLE_STATE.FAILED],
  [LIFECYCLE_STATE.ACTIVE]:       [LIFECYCLE_STATE.PAUSED, LIFECYCLE_STATE.RECOVERING, LIFECYCLE_STATE.FAILED, LIFECYCLE_STATE.SHUTDOWN],
  [LIFECYCLE_STATE.PAUSED]:       [LIFECYCLE_STATE.ACTIVE, LIFECYCLE_STATE.SHUTDOWN, LIFECYCLE_STATE.FAILED],
  [LIFECYCLE_STATE.RECOVERING]:   [LIFECYCLE_STATE.ACTIVE, LIFECYCLE_STATE.FAILED, LIFECYCLE_STATE.SHUTDOWN],
  [LIFECYCLE_STATE.FAILED]:       [LIFECYCLE_STATE.RECOVERING, LIFECYCLE_STATE.SHUTDOWN],
  [LIFECYCLE_STATE.SHUTDOWN]:     [],
};

// ----------------------------------------------------------------
// INTERNAL LIFECYCLE STATE
// ----------------------------------------------------------------

/** @type {Map<string, LifecycleEntry>} */
const _lifecycles  = new Map();
let _initialized   = false;

class LifecycleEntry {
  constructor(agentId) {
    this.agentId      = agentId;
    this.state        = LIFECYCLE_STATE.IDLE;
    this.previousState = null;
    this.history      = [];
    this.hooks        = { onStart: [], onPause: [], onResume: [], onShutdown: [], onRecover: [], onFail: [] };
    this.createdAt    = Date.now();
    this.updatedAt    = Date.now();
  }
}

// ----------------------------------------------------------------
// INITIALIZE AGENT LIFECYCLE SYSTEM
// ----------------------------------------------------------------

export function initializeAgentLifecycle() {
  if (_initialized) {
    LifecycleLogger.warn('[Lifecycle] Already initialized. Skipping.');
    return;
  }
  _initialized = true;
  LifecycleLogger.info('[Lifecycle] Agent lifecycle controller initialized.');
}

// ----------------------------------------------------------------
// GET OR CREATE LIFECYCLE ENTRY
// ----------------------------------------------------------------

function _entry(agentId) {
  if (!_lifecycles.has(agentId)) {
    _lifecycles.set(agentId, new LifecycleEntry(agentId));
  }
  return _lifecycles.get(agentId);
}

// ----------------------------------------------------------------
// TRANSITION HELPER
// ----------------------------------------------------------------

async function _transition(agentId, targetState, hookKey, hookPayload = {}) {
  const entry       = _entry(agentId);
  const currentState = entry.state;

  const allowed = ALLOWED_TRANSITIONS[currentState] || [];
  if (!allowed.includes(targetState)) {
    const err = new LifecycleError(
      `[Lifecycle] Illegal transition for "${agentId}": ${currentState} → ${targetState}. ` +
      `Allowed from ${currentState}: [${allowed.join(', ')}]`
    );
    LifecycleLogger.error(err.message);
    throw err;
  }

  entry.previousState = currentState;
  entry.state         = targetState;
  entry.updatedAt     = Date.now();

  entry.history.push({
    from:      currentState,
    to:        targetState,
    timestamp: Date.now(),
  });

  // Cap history to last 50 transitions
  if (entry.history.length > 50) entry.history.shift();

  // Sync to registry
  updateAgentLifecycleStatus(agentId, targetState);

  // Update health based on new state
  if (targetState === LIFECYCLE_STATE.ACTIVE) {
    updateAgentHealth(agentId, AGENT_HEALTH.HEALTHY);
  } else if (targetState === LIFECYCLE_STATE.RECOVERING) {
    updateAgentHealth(agentId, AGENT_HEALTH.DEGRADED);
  } else if (targetState === LIFECYCLE_STATE.FAILED) {
    updateAgentHealth(agentId, AGENT_HEALTH.FAILED);
  }

  LifecycleLogger.info(`[Lifecycle] Agent "${agentId}": ${currentState} → ${targetState}`);

  // Run hooks for this transition
  if (hookKey && entry.hooks[hookKey]) {
    for (const fn of entry.hooks[hookKey]) {
      try {
        await fn({ agentId, from: currentState, to: targetState, ...hookPayload });
      } catch (err) {
        LifecycleLogger.error(`[Lifecycle] Hook error [${hookKey}] for "${agentId}": ${err.message}`);
      }
    }
  }

  return entry.state;
}

// ----------------------------------------------------------------
// START AGENT
// ----------------------------------------------------------------

/**
 * Transition idle → initializing → active.
 * @param {string} agentId
 * @param {Object} [context]
 */
export async function startAgent(agentId, context = {}) {
  const entry = _entry(agentId);

  // Two-step: IDLE → INITIALIZING → ACTIVE
  if (entry.state === LIFECYCLE_STATE.IDLE) {
    await _transition(agentId, LIFECYCLE_STATE.INITIALIZING, null);
  }

  return _transition(agentId, LIFECYCLE_STATE.ACTIVE, 'onStart', context);
}

// ----------------------------------------------------------------
// PAUSE AGENT
// ----------------------------------------------------------------

/**
 * Transition active → paused.
 * @param {string} agentId
 * @param {Object} [context]
 */
export async function pauseAgent(agentId, context = {}) {
  return _transition(agentId, LIFECYCLE_STATE.PAUSED, 'onPause', context);
}

// ----------------------------------------------------------------
// RESUME AGENT
// ----------------------------------------------------------------

/**
 * Transition paused → active.
 * @param {string} agentId
 * @param {Object} [context]
 */
export async function resumeAgent(agentId, context = {}) {
  return _transition(agentId, LIFECYCLE_STATE.ACTIVE, 'onResume', context);
}

// ----------------------------------------------------------------
// SHUTDOWN AGENT
// ----------------------------------------------------------------

/**
 * Transition to shutdown from any valid state.
 * @param {string} agentId
 * @param {Object} [context]
 */
export async function shutdownAgent(agentId, context = {}) {
  return _transition(agentId, LIFECYCLE_STATE.SHUTDOWN, 'onShutdown', context);
}

// ----------------------------------------------------------------
// RECOVER AGENT
// ----------------------------------------------------------------

/**
 * Transition failed → recovering → active.
 * @param {string} agentId
 * @param {Object} [context]
 */
export async function recoverAgent(agentId, context = {}) {
  const entry = _entry(agentId);

  if (entry.state !== LIFECYCLE_STATE.FAILED && entry.state !== LIFECYCLE_STATE.ACTIVE) {
    // Transition to recovering first if needed
    if (ALLOWED_TRANSITIONS[entry.state]?.includes(LIFECYCLE_STATE.RECOVERING)) {
      await _transition(agentId, LIFECYCLE_STATE.RECOVERING, null);
    }
  }

  return _transition(agentId, LIFECYCLE_STATE.ACTIVE, 'onRecover', context);
}

// ----------------------------------------------------------------
// FAIL AGENT
// ----------------------------------------------------------------

/**
 * Transition to failed state (for internal error handling).
 * @param {string} agentId
 * @param {Object} [context]
 */
export async function failAgent(agentId, context = {}) {
  const entry = _entry(agentId);
  // Can transition to FAILED from multiple states
  if (!ALLOWED_TRANSITIONS[entry.state]?.includes(LIFECYCLE_STATE.FAILED)) {
    LifecycleLogger.warn(
      `[Lifecycle] Cannot transition "${agentId}" to FAILED from ${entry.state}. Forcing entry.`
    );
    entry.state = LIFECYCLE_STATE.FAILED;
    updateAgentLifecycleStatus(agentId, LIFECYCLE_STATE.FAILED);
    updateAgentHealth(agentId, AGENT_HEALTH.FAILED);
    return LIFECYCLE_STATE.FAILED;
  }
  return _transition(agentId, LIFECYCLE_STATE.FAILED, 'onFail', context);
}

// ----------------------------------------------------------------
// REGISTER LIFECYCLE HOOK
// ----------------------------------------------------------------

/**
 * @param {string}   agentId
 * @param {string}   hookKey — 'onStart'|'onPause'|'onResume'|'onShutdown'|'onRecover'|'onFail'
 * @param {Function} fn
 */
export function registerLifecycleHook(agentId, hookKey, fn) {
  const validHooks = ['onStart', 'onPause', 'onResume', 'onShutdown', 'onRecover', 'onFail'];

  if (!validHooks.includes(hookKey)) {
    LifecycleLogger.error(`[Lifecycle] Invalid hook key: "${hookKey}". Valid: ${validHooks.join(', ')}`);
    return;
  }
  if (typeof fn !== 'function') {
    LifecycleLogger.error('[Lifecycle] Hook must be a function.');
    return;
  }

  const entry = _entry(agentId);
  entry.hooks[hookKey].push(fn);
  LifecycleLogger.debug(`[Lifecycle] Hook registered: "${agentId}" → ${hookKey}`);
}

// ----------------------------------------------------------------
// GET AGENT LIFECYCLE STATE
// ----------------------------------------------------------------

export function getAgentLifecycleState(agentId) {
  const entry = _lifecycles.get(agentId);
  if (!entry) return null;

  return {
    agentId:       entry.agentId,
    state:         entry.state,
    previousState: entry.previousState,
    history:       [...entry.history],
    createdAt:     entry.createdAt,
    updatedAt:     entry.updatedAt,
  };
}

// ----------------------------------------------------------------
// GET ALL LIFECYCLE STATES
// ----------------------------------------------------------------

export function getAllLifecycleStates() {
  return Array.from(_lifecycles.values()).map((e) => ({
    agentId: e.agentId,
    state:   e.state,
    updatedAt: e.updatedAt,
  }));
}

// ----------------------------------------------------------------
// IS AGENT ACTIVE
// ----------------------------------------------------------------

export function isAgentActive(agentId) {
  const entry = _lifecycles.get(agentId);
  return entry?.state === LIFECYCLE_STATE.ACTIVE;
}

// ----------------------------------------------------------------
// LIFECYCLE ERROR
// ----------------------------------------------------------------

export class LifecycleError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name      = 'LifecycleError';
    this.context   = context;
    this.timestamp = Date.now();
  }
}
