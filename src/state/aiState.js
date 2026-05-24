// ================================================================
// IMMORTAIL™ — AI ORCHESTRATION STATE (FOUNDATION)
// Runtime AI tracking, agent registration stubs, orchestration flags.
// NO ACTUAL AI EXECUTION. NO AGENT LOGIC. FOUNDATION ONLY.
// ================================================================

import { SystemLogger } from '../utils/logger.js';

const AIStateLogger = SystemLogger;

// ----------------------------------------------------------------
// INITIAL AI STATE
// ----------------------------------------------------------------

const INITIAL_AI_STATE = {
  // Active agent registry (populated by future AI engine)
  activeAgents: {},

  // Pending task queue
  pendingTasks: [],

  // Orchestration metadata
  orchestration: {
    isRunning:        false,
    queueLength:      0,
    lastDispatchedAt: null,
    activeSince:      null,
  },

  // AI runtime flags
  flags: {
    engineReady:       false,
    orchestratorReady: false,
    agentsLoaded:      false,
    tasksQueued:       false,
  },

  // Hydration tracking
  hydrated:   false,
  hydratedAt: null,

  // Runtime error context
  lastError: null,
};

// ----------------------------------------------------------------
// INTERNAL STATE
// ----------------------------------------------------------------

let _aiState     = _deepClone(INITIAL_AI_STATE);
let _subscribers = new Map();
let _idCounter   = 0;

// ----------------------------------------------------------------
// DEEP CLONE
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
      AIStateLogger.error(`[AIState] Subscriber ${id} threw: ${err.message}`);
    }
  }
}

// ----------------------------------------------------------------
// GET AI STATE
// ----------------------------------------------------------------

/**
 * Returns a deep-cloned snapshot of AI runtime state.
 * @returns {Object}
 */
export function getAIState() {
  return _deepClone(_aiState);
}

// ----------------------------------------------------------------
// UPDATE AI STATE
// ----------------------------------------------------------------

/**
 * Immutable-safe patch. Triggers subscribers.
 * @param {Object} patch
 */
export function updateAIState(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    AIStateLogger.error('[AIState] updateAIState: patch must be a plain object.');
    return;
  }

  const prev = _deepClone(_aiState);

  _aiState = {
    ..._aiState,
    ...patch,
    flags: {
      ..._aiState.flags,
      ...(patch.flags || {}),
    },
    orchestration: {
      ..._aiState.orchestration,
      ...(patch.orchestration || {}),
    },
    activeAgents: {
      ..._aiState.activeAgents,
      ...(patch.activeAgents || {}),
    },
    pendingTasks: patch.pendingTasks !== undefined
      ? patch.pendingTasks
      : _aiState.pendingTasks,
  };

  AIStateLogger.debug('[AIState] AI state updated.');
  _notifySubscribers(prev, _deepClone(_aiState));
}

// ----------------------------------------------------------------
// SUBSCRIBE
// ----------------------------------------------------------------

/**
 * @param {Function} fn — (nextState, prevState) => void
 * @returns {Function} unsubscribe
 */
export function subscribeToAIState(fn) {
  if (typeof fn !== 'function') {
    AIStateLogger.error('[AIState] Subscriber must be a function.');
    return () => {};
  }

  const id = ++_idCounter;
  _subscribers.set(id, fn);
  AIStateLogger.debug(`[AIState] Subscriber added (id: ${id}). Total: ${_subscribers.size}`);

  return function unsubscribe() {
    _subscribers.delete(id);
    AIStateLogger.debug(`[AIState] Subscriber removed (id: ${id}).`);
  };
}

// ----------------------------------------------------------------
// REGISTER AGENT PLACEHOLDER
// ----------------------------------------------------------------

/**
 * Register a named agent slot in the runtime registry.
 * Does not execute any AI logic — foundation structure only.
 * @param {string} agentId
 * @param {Object} metadata
 */
export function registerAgent(agentId, metadata = {}) {
  if (!agentId || typeof agentId !== 'string') {
    AIStateLogger.error('[AIState] registerAgent: agentId must be a non-empty string.');
    return;
  }

  if (_aiState.activeAgents[agentId]) {
    AIStateLogger.warn(`[AIState] Agent "${agentId}" already registered.`);
    return;
  }

  updateAIState({
    activeAgents: {
      [agentId]: {
        id:           agentId,
        status:       'registered',
        registeredAt: Date.now(),
        ...metadata,
      },
    },
  });

  AIStateLogger.info(`[AIState] Agent registered: "${agentId}"`);
}

// ----------------------------------------------------------------
// ENQUEUE TASK PLACEHOLDER
// ----------------------------------------------------------------

/**
 * Enqueue a task reference for future AI dispatch.
 * No execution occurs in Run 3 — structure only.
 * @param {Object} task
 */
export function enqueueTask(task) {
  if (!task || !task.id) {
    AIStateLogger.error('[AIState] enqueueTask: task must have an id field.');
    return;
  }

  const updated = [
    ..._aiState.pendingTasks,
    { ...task, enqueuedAt: Date.now(), status: 'pending' },
  ];

  updateAIState({
    pendingTasks: updated,
    orchestration: { queueLength: updated.length },
    flags: { tasksQueued: updated.length > 0 },
  });

  AIStateLogger.info(`[AIState] Task enqueued: "${task.id}"`);
}

// ----------------------------------------------------------------
// HYDRATE AI STATE
// Called by hydration system only.
// ----------------------------------------------------------------

export function hydrateAIState(snapshot = {}) {
  AIStateLogger.info('[AIState] Hydrating AI state...');
  updateAIState({
    hydrated:   true,
    hydratedAt: Date.now(),
    flags: {
      engineReady:       false, // not live yet
      orchestratorReady: false, // not live yet
      agentsLoaded:      false,
    },
  });
}

// ----------------------------------------------------------------
// RESET AI STATE
// ----------------------------------------------------------------

export function resetAIState() {
  AIStateLogger.warn('[AIState] Resetting AI state.');
  const prev = _deepClone(_aiState);
  _aiState = _deepClone(INITIAL_AI_STATE);
  _notifySubscribers(prev, _deepClone(_aiState));
}
