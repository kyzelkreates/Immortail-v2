// ================================================================
// IMMORTAIL™ — DOG AGENT (FOUNDATION)
// Dog runtime orchestration, state coordination, task management.
// NO PERSONALITY ENGINE. NO INTELLIGENCE. COORDINATION ONLY.
// ================================================================

import { SystemLogger }           from '../utils/logger.js';
import { emit, subscribe }         from '../events/eventBus.js';
import { DOG_EVENTS }              from '../events/eventTypes.js';
import {
  updateDogRuntimeState,
  syncDogState,
  loadDogProfile,
} from '../services/dogService.js';
import { getDogState } from '../state/dogState.js';
import { getAgentLifecycleState, LIFECYCLE_STATE } from './lifecycle.js';
import { AGENT_CAPABILITY } from './registry.js';

const DogAgentLogger = SystemLogger;

// ----------------------------------------------------------------
// AGENT IDENTITY
// ----------------------------------------------------------------

export const DOG_AGENT_ID = 'dog_agent';

// ----------------------------------------------------------------
// TASK TYPES
// ----------------------------------------------------------------

export const DOG_TASK_TYPE = {
  UPDATE_RUNTIME_STATE: 'dog.update_runtime_state',
  SYNC_STATE:           'dog.sync_state',
  LOAD_PROFILE:         'dog.load_profile',
  SET_ACTIVE_STATE:     'dog.set_active_state',
};

// ----------------------------------------------------------------
// INTERNAL STATE
// ----------------------------------------------------------------

let _initialized = false;
let _agentState  = {
  processedCount:    0,
  errorCount:        0,
  lastActivityAt:    null,
  currentActiveMode: 'idle',
};
const _unsubscribers = [];

// ----------------------------------------------------------------
// AGENT DESCRIPTOR
// ----------------------------------------------------------------

export const DOG_AGENT_DESCRIPTOR = {
  id:           DOG_AGENT_ID,
  capabilities: [AGENT_CAPABILITY.DOG_RUNTIME],
  metadata:     {
    taskTypes:   Object.values(DOG_TASK_TYPE),
    description: 'Dog runtime state coordination agent.',
  },
};

// ----------------------------------------------------------------
// INITIALIZE DOG AGENT
// ----------------------------------------------------------------

export async function initializeDogAgent() {
  if (_initialized) {
    DogAgentLogger.warn('[DogAgent] Already initialized. Skipping.');
    return getDogAgentState();
  }

  DogAgentLogger.info('[DogAgent] Initializing dog agent...');

  _bindSubscriptions();

  _initialized = true;
  DogAgentLogger.info('[DogAgent] Dog agent initialized.');
  return getDogAgentState();
}

// ----------------------------------------------------------------
// PROCESS DOG TASK
// ----------------------------------------------------------------

export async function processDogTask(task) {
  if (!task || !task.type) {
    throw new Error('[DogAgent] processDogTask: invalid task.');
  }

  DogAgentLogger.info(`[DogAgent] Processing task: "${task.id}" (type: ${task.type})`);
  _agentState.lastActivityAt = Date.now();

  let result;

  switch (task.type) {
    case DOG_TASK_TYPE.UPDATE_RUNTIME_STATE: {
      const { dogId, patch, source } = task.payload;
      await updateDogRuntimeState(dogId, patch, source || DOG_AGENT_ID);
      result = getDogState();
      break;
    }

    case DOG_TASK_TYPE.SYNC_STATE: {
      const { dogId, profileData } = task.payload;
      await syncDogState(dogId, profileData);
      result = { synced: true, dogId };
      break;
    }

    case DOG_TASK_TYPE.LOAD_PROFILE: {
      const { dogId } = task.payload;
      result = await loadDogProfile(dogId);
      break;
    }

    case DOG_TASK_TYPE.SET_ACTIVE_STATE: {
      const { dogId, mode } = task.payload;

      const validModes = ['idle', 'active', 'sleeping', 'interacting'];
      if (!validModes.includes(mode)) {
        throw new Error(`[DogAgent] Invalid active state mode: "${mode}". Valid: ${validModes.join(', ')}.`);
      }

      await updateDogRuntimeState(
        dogId,
        { activeState: { mode, lastActiveAt: Date.now() } },
        DOG_AGENT_ID
      );

      _agentState.currentActiveMode = mode;

      await emit(DOG_EVENTS.DOG_RUNTIME_CHANGED, {
        timestamp: Date.now(),
        dogId,
        mode,
      });

      result = { mode, dogId };
      break;
    }

    default:
      throw new Error(`[DogAgent] Unknown task type: "${task.type}".`);
  }

  _agentState.processedCount++;
  DogAgentLogger.info(`[DogAgent] Task "${task.id}" processed.`);
  return result;
}

// ----------------------------------------------------------------
// GET DOG AGENT STATE
// ----------------------------------------------------------------

export function getDogAgentState() {
  return {
    agentId:           DOG_AGENT_ID,
    initialized:       _initialized,
    processedCount:    _agentState.processedCount,
    errorCount:        _agentState.errorCount,
    lastActivityAt:    _agentState.lastActivityAt,
    currentActiveMode: _agentState.currentActiveMode,
    lifecycleState:    getAgentLifecycleState(DOG_AGENT_ID)?.state || LIFECYCLE_STATE.IDLE,
    dogState:          getDogState(),
  };
}

// ----------------------------------------------------------------
// SHUTDOWN
// ----------------------------------------------------------------

export function shutdownDogAgent() {
  for (const unsub of _unsubscribers) unsub();
  _unsubscribers.length = 0;
  _initialized = false;
  DogAgentLogger.info('[DogAgent] Dog agent shut down.');
}

// ----------------------------------------------------------------
// TASK HANDLER
// ----------------------------------------------------------------

export async function dogTaskHandler(task) {
  return processDogTask(task);
}

// ----------------------------------------------------------------
// INTERNAL: Bind subscriptions
// ----------------------------------------------------------------

function _bindSubscriptions() {
  const unsub = subscribe(DOG_EVENTS.DOG_STATE_UPDATED, (payload) => {
    DogAgentLogger.debug(
      `[DogAgent] Dog state updated — dogId: ${payload.dogId}, source: ${payload.source}`
    );
    _agentState.lastActivityAt = Date.now();
  }, { subscriberId: DOG_AGENT_ID });

  _unsubscribers.push(unsub);
}
