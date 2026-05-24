// ================================================================
// IMMORTAIL™ — EMOTION AGENT (FOUNDATION)
// Emotion orchestration structure, runtime synchronization.
// NO EMOTION ENGINE. NO SIMULATION. COORDINATION ONLY.
// ================================================================

import { SystemLogger }           from '../utils/logger.js';
import { emit, subscribe }         from '../events/eventBus.js';
import { EMOTION_EVENTS }          from '../events/eventTypes.js';
import {
  updateEmotionSnapshot,
  syncEmotionRuntime,
  validateEmotionState,
} from '../services/emotionService.js';
import { getAgentLifecycleState, LIFECYCLE_STATE } from './lifecycle.js';
import { AGENT_CAPABILITY } from './registry.js';

const EmotionAgentLogger = SystemLogger;

// ----------------------------------------------------------------
// AGENT IDENTITY
// ----------------------------------------------------------------

export const EMOTION_AGENT_ID = 'emotion_agent';

// ----------------------------------------------------------------
// TASK TYPES
// ----------------------------------------------------------------

export const EMOTION_TASK_TYPE = {
  UPDATE_SNAPSHOT:  'emotion.update_snapshot',
  SYNC_RUNTIME:     'emotion.sync_runtime',
  VALIDATE_STATE:   'emotion.validate_state',
};

// ----------------------------------------------------------------
// INTERNAL STATE
// ----------------------------------------------------------------

let _initialized = false;
let _agentState  = {
  processedCount: 0,
  errorCount:     0,
  lastActivityAt: null,
  lastEmotionType: null,
};
const _unsubscribers = [];

// ----------------------------------------------------------------
// AGENT DESCRIPTOR
// ----------------------------------------------------------------

export const EMOTION_AGENT_DESCRIPTOR = {
  id:           EMOTION_AGENT_ID,
  capabilities: [AGENT_CAPABILITY.EMOTION],
  metadata:     {
    taskTypes:   Object.values(EMOTION_TASK_TYPE),
    description: 'Emotion runtime synchronization and orchestration agent.',
  },
};

// ----------------------------------------------------------------
// INITIALIZE EMOTION AGENT
// ----------------------------------------------------------------

export async function initializeEmotionAgent() {
  if (_initialized) {
    EmotionAgentLogger.warn('[EmotionAgent] Already initialized. Skipping.');
    return getEmotionAgentState();
  }

  EmotionAgentLogger.info('[EmotionAgent] Initializing emotion agent...');

  _bindSubscriptions();

  _initialized = true;
  EmotionAgentLogger.info('[EmotionAgent] Emotion agent initialized.');
  return getEmotionAgentState();
}

// ----------------------------------------------------------------
// PROCESS EMOTION TASK
// ----------------------------------------------------------------

export async function processEmotionTask(task) {
  if (!task || !task.type) {
    throw new Error('[EmotionAgent] processEmotionTask: invalid task.');
  }

  EmotionAgentLogger.info(`[EmotionAgent] Processing task: "${task.id}" (type: ${task.type})`);
  _agentState.lastActivityAt = Date.now();

  let result;

  switch (task.type) {
    case EMOTION_TASK_TYPE.UPDATE_SNAPSHOT: {
      const { emotionData, persist } = task.payload;
      result = await updateEmotionSnapshot(emotionData, persist ?? false);
      _agentState.lastEmotionType = emotionData?.type || null;
      break;
    }

    case EMOTION_TASK_TYPE.SYNC_RUNTIME: {
      const { profileId } = task.payload;
      result = await syncEmotionRuntime(profileId);
      break;
    }

    case EMOTION_TASK_TYPE.VALIDATE_STATE: {
      const { state } = task.payload;
      result = validateEmotionState(state);
      break;
    }

    default:
      throw new Error(`[EmotionAgent] Unknown task type: "${task.type}".`);
  }

  _agentState.processedCount++;
  EmotionAgentLogger.info(`[EmotionAgent] Task "${task.id}" processed.`);
  return result;
}

// ----------------------------------------------------------------
// GET EMOTION AGENT STATE
// ----------------------------------------------------------------

export function getEmotionAgentState() {
  return {
    agentId:          EMOTION_AGENT_ID,
    initialized:      _initialized,
    processedCount:   _agentState.processedCount,
    errorCount:       _agentState.errorCount,
    lastActivityAt:   _agentState.lastActivityAt,
    lastEmotionType:  _agentState.lastEmotionType,
    lifecycleState:   getAgentLifecycleState(EMOTION_AGENT_ID)?.state || LIFECYCLE_STATE.IDLE,
  };
}

// ----------------------------------------------------------------
// SHUTDOWN
// ----------------------------------------------------------------

export function shutdownEmotionAgent() {
  for (const unsub of _unsubscribers) unsub();
  _unsubscribers.length = 0;
  _initialized = false;
  EmotionAgentLogger.info('[EmotionAgent] Emotion agent shut down.');
}

// ----------------------------------------------------------------
// TASK HANDLER (for supervisor routing table)
// ----------------------------------------------------------------

export async function emotionTaskHandler(task) {
  return processEmotionTask(task);
}

// ----------------------------------------------------------------
// INTERNAL: Bind subscriptions
// ----------------------------------------------------------------

function _bindSubscriptions() {
  const unsub = subscribe(EMOTION_EVENTS.EMOTION_CHANGED, (payload) => {
    EmotionAgentLogger.debug(
      `[EmotionAgent] Emotion changed — type: ${payload.emotionType}, ` +
      `intensity: ${payload.intensity}, profile: ${payload.profileId}`
    );
    _agentState.lastActivityAt   = Date.now();
    _agentState.lastEmotionType  = payload.emotionType;
  }, { subscriberId: EMOTION_AGENT_ID });

  _unsubscribers.push(unsub);
}
