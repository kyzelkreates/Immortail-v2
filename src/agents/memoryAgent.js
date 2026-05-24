// ================================================================
// IMMORTAIL™ — MEMORY AGENT (FOUNDATION)
// Memory task handling, workflow coordination, event orchestration.
// NO MEMORY ENGINE. NO GENERATION. COORDINATION ONLY.
// ================================================================

import { SystemLogger }              from '../utils/logger.js';
import { emit, subscribe }            from '../events/eventBus.js';
import { MEMORY_EVENTS }              from '../events/eventTypes.js';
import {
  createMemoryReference,
  loadMemoryReference,
  restoreMemoriesForProfile,
  validateMemoryPayload,
} from '../services/memoryService.js';
import {
  getAgentLifecycleState,
  LIFECYCLE_STATE,
} from './lifecycle.js';
import { AGENT_CAPABILITY } from './registry.js';

const MemoryAgentLogger = SystemLogger;

// ----------------------------------------------------------------
// AGENT IDENTITY
// ----------------------------------------------------------------

export const MEMORY_AGENT_ID = 'memory_agent';

// ----------------------------------------------------------------
// TASK TYPES THIS AGENT HANDLES
// ----------------------------------------------------------------

export const MEMORY_TASK_TYPE = {
  CREATE_REFERENCE:  'memory.create_reference',
  LOAD_REFERENCE:    'memory.load_reference',
  RESTORE_PROFILE:   'memory.restore_profile',
};

// ----------------------------------------------------------------
// INTERNAL STATE
// ----------------------------------------------------------------

let _initialized = false;
let _agentState  = {
  processedCount: 0,
  errorCount:     0,
  lastActivityAt: null,
};
const _unsubscribers = [];

// ----------------------------------------------------------------
// AGENT DESCRIPTOR (for supervisor registration)
// ----------------------------------------------------------------

export const MEMORY_AGENT_DESCRIPTOR = {
  id:           MEMORY_AGENT_ID,
  capabilities: [AGENT_CAPABILITY.MEMORY],
  metadata:     {
    taskTypes:   Object.values(MEMORY_TASK_TYPE),
    description: 'Memory workflow coordination agent.',
  },
};

// ----------------------------------------------------------------
// INITIALIZE MEMORY AGENT
// ----------------------------------------------------------------

/**
 * Initialize the memory agent and bind event subscriptions.
 * Called by the supervisor during registration.
 */
export async function initializeMemoryAgent() {
  if (_initialized) {
    MemoryAgentLogger.warn('[MemoryAgent] Already initialized. Skipping.');
    return getMemoryAgentState();
  }

  MemoryAgentLogger.info('[MemoryAgent] Initializing memory agent...');

  _bindSubscriptions();

  _initialized = true;
  MemoryAgentLogger.info('[MemoryAgent] Memory agent initialized.');
  return getMemoryAgentState();
}

// ----------------------------------------------------------------
// PROCESS MEMORY TASK
// ----------------------------------------------------------------

/**
 * Process an incoming task dispatched by the supervisor.
 * @param {Object} task — TaskRecord from supervisor
 * @returns {Promise<Object>} result
 */
export async function processMemoryTask(task) {
  if (!task || !task.type) {
    throw new Error('[MemoryAgent] processMemoryTask: invalid task — missing type.');
  }

  MemoryAgentLogger.info(`[MemoryAgent] Processing task: "${task.id}" (type: ${task.type})`);

  _agentState.lastActivityAt = Date.now();
  let result;

  switch (task.type) {
    case MEMORY_TASK_TYPE.CREATE_REFERENCE: {
      const { memoryData } = task.payload;
      result = await createMemoryReference(memoryData);
      break;
    }

    case MEMORY_TASK_TYPE.LOAD_REFERENCE: {
      const { memoryId } = task.payload;
      result = await loadMemoryReference(memoryId);
      break;
    }

    case MEMORY_TASK_TYPE.RESTORE_PROFILE: {
      const { profileId } = task.payload;
      result = await restoreMemoriesForProfile(profileId);
      break;
    }

    default:
      throw new Error(`[MemoryAgent] Unknown task type: "${task.type}".`);
  }

  _agentState.processedCount++;
  MemoryAgentLogger.info(`[MemoryAgent] Task "${task.id}" processed successfully.`);
  return result;
}

// ----------------------------------------------------------------
// GET MEMORY AGENT STATE
// ----------------------------------------------------------------

export function getMemoryAgentState() {
  return {
    agentId:        MEMORY_AGENT_ID,
    initialized:    _initialized,
    processedCount: _agentState.processedCount,
    errorCount:     _agentState.errorCount,
    lastActivityAt: _agentState.lastActivityAt,
    lifecycleState: getAgentLifecycleState(MEMORY_AGENT_ID)?.state || LIFECYCLE_STATE.IDLE,
  };
}

// ----------------------------------------------------------------
// SHUTDOWN MEMORY AGENT
// ----------------------------------------------------------------

export function shutdownMemoryAgent() {
  for (const unsub of _unsubscribers) unsub();
  _unsubscribers.length = 0;
  _initialized = false;
  MemoryAgentLogger.info('[MemoryAgent] Memory agent shut down.');
}

// ----------------------------------------------------------------
// TASK HANDLER (for supervisor routing table)
// ----------------------------------------------------------------

export async function memoryTaskHandler(task) {
  return processMemoryTask(task);
}

// ----------------------------------------------------------------
// INTERNAL: Bind subscriptions
// ----------------------------------------------------------------

function _bindSubscriptions() {
  // React to MEMORY_RESTORED events for logging/metrics
  const unsub = subscribe(MEMORY_EVENTS.MEMORY_RESTORED, (payload) => {
    MemoryAgentLogger.info(
      `[MemoryAgent] Memory restore event — profileId: ${payload.profileId}, count: ${payload.count}`
    );
    _agentState.lastActivityAt = Date.now();
  }, { subscriberId: MEMORY_AGENT_ID });

  _unsubscribers.push(unsub);
}
