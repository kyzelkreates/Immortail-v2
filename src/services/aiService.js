// ================================================================
// IMMORTAIL™ — AI ORCHESTRATION SERVICE (FOUNDATION)
// Runtime coordination, task routing prep. NO AI EXECUTION YET.
// ================================================================

import { SystemLogger }                              from '../utils/logger.js';
import { emit }                                       from '../events/eventBus.js';
import { AI_EVENTS }                                  from '../events/eventTypes.js';
import {
  getAIState,
  updateAIState,
  registerAgent,
  enqueueTask,
} from '../state/aiState.js';

const AIServiceLogger = SystemLogger;

// ----------------------------------------------------------------
// SERVICE STATE
// ----------------------------------------------------------------

let _initialized = false;

// ----------------------------------------------------------------
// INITIALIZE AI RUNTIME
// ----------------------------------------------------------------

/**
 * Initialize the AI service runtime.
 * @returns {Object} current AI state snapshot
 */
export async function initializeAIRuntime() {
  if (_initialized) {
    AIServiceLogger.warn('[AIService] Already initialized. Skipping.');
    return getAIState();
  }

  AIServiceLogger.info('[AIService] Initializing AI runtime coordination layer...');

  updateAIState({
    flags: { orchestratorReady: true },
    orchestration: { activeSince: Date.now() },
  });

  _initialized = true;

  AIServiceLogger.info('[AIService] AI runtime initialized (no agents active — foundation only).');
  return getAIState();
}

// ----------------------------------------------------------------
// REGISTER RUNTIME TASK
// ----------------------------------------------------------------

/**
 * Register a task for future AI dispatch.
 * No execution in Run 4 — structure only.
 * @param {Object} task
 * @param {string} task.id
 * @param {string} task.type
 * @param {Object} [task.payload]
 * @returns {string} task id
 */
export async function registerRuntimeTask(task) {
  if (!task || !task.id || !task.type) {
    AIServiceLogger.error('[AIService] registerRuntimeTask: task must have id and type.');
    throw new Error('[AIService] Task must have id and type.');
  }

  AIServiceLogger.info(`[AIService] Registering task: "${task.id}" (type: ${task.type})`);

  enqueueTask(task);

  await emit(AI_EVENTS.TASK_CREATED, {
    timestamp: Date.now(),
    taskId:    task.id,
    type:      task.type,
  });

  return task.id;
}

// ----------------------------------------------------------------
// UPDATE AI RUNTIME STATE
// ----------------------------------------------------------------

/**
 * Update AI orchestration state.
 * @param {Object} patch
 */
export async function updateAIRuntimeState(patch) {
  if (!patch || typeof patch !== 'object') {
    AIServiceLogger.error('[AIService] updateAIRuntimeState: patch must be an object.');
    return;
  }

  AIServiceLogger.debug('[AIService] Updating AI runtime state...');
  updateAIState(patch);
}

// ----------------------------------------------------------------
// REGISTER AGENT (FOUNDATION)
// ----------------------------------------------------------------

/**
 * Register a named agent slot in runtime.
 * @param {string} agentId
 * @param {Object} [metadata]
 */
export async function registerRuntimeAgent(agentId, metadata = {}) {
  if (!agentId || typeof agentId !== 'string') {
    AIServiceLogger.error('[AIService] registerRuntimeAgent: agentId required.');
    return;
  }

  registerAgent(agentId, metadata);

  await emit(AI_EVENTS.AGENT_REGISTERED, {
    timestamp: Date.now(),
    agentId,
    ...metadata,
  });

  AIServiceLogger.info(`[AIService] Agent registered: "${agentId}"`);
}

// ----------------------------------------------------------------
// SERVICE STATUS
// ----------------------------------------------------------------

export function getAIServiceStatus() {
  return {
    initialized: _initialized,
    aiState:     getAIState(),
  };
}
