// ================================================================
// IMMORTAIL™ — RECOVERY AGENT (FOUNDATION)
// Runtime failure monitoring, recovery workflow coordination,
// degraded state management. NO DIRECT STORAGE ACCESS.
// ================================================================

import { SystemLogger }           from '../utils/logger.js';
import { emit, subscribe }         from '../events/eventBus.js';
import { SYSTEM_EVENTS }           from '../events/eventTypes.js';
import {
  recoverRuntime,
  enterSafeMode,
  getRecoveryState,
  RECOVERY_MODE,
} from '../core/recovery.js';
import { getAgentLifecycleState, LIFECYCLE_STATE } from './lifecycle.js';
import { AGENT_CAPABILITY } from './registry.js';

const RecoveryAgentLogger = SystemLogger;

// ----------------------------------------------------------------
// AGENT IDENTITY
// ----------------------------------------------------------------

export const RECOVERY_AGENT_ID = 'recovery_agent';

// ----------------------------------------------------------------
// TASK TYPES
// ----------------------------------------------------------------

export const RECOVERY_TASK_TYPE = {
  TRIGGER_RECOVERY:  'recovery.trigger_recovery',
  ENTER_SAFE_MODE:   'recovery.enter_safe_mode',
  GET_RECOVERY_STATE:'recovery.get_state',
  MONITOR_HEALTH:    'recovery.monitor_health',
};

// ----------------------------------------------------------------
// INTERNAL STATE
// ----------------------------------------------------------------

let _initialized = false;
let _agentState  = {
  processedCount:      0,
  errorCount:          0,
  lastActivityAt:      null,
  recoveryAttempts:    0,
  lastRecoveryReason:  null,
  monitoringActive:    false,
};
const _unsubscribers = [];

// ----------------------------------------------------------------
// AGENT DESCRIPTOR
// ----------------------------------------------------------------

export const RECOVERY_AGENT_DESCRIPTOR = {
  id:           RECOVERY_AGENT_ID,
  capabilities: [AGENT_CAPABILITY.RECOVERY],
  metadata:     {
    taskTypes:   Object.values(RECOVERY_TASK_TYPE),
    description: 'Runtime failure monitoring and recovery coordination agent.',
  },
};

// ----------------------------------------------------------------
// INITIALIZE RECOVERY AGENT
// ----------------------------------------------------------------

export async function initializeRecoveryAgent() {
  if (_initialized) {
    RecoveryAgentLogger.warn('[RecoveryAgent] Already initialized. Skipping.');
    return getRecoveryAgentState();
  }

  RecoveryAgentLogger.info('[RecoveryAgent] Initializing recovery agent...');

  _bindSubscriptions();

  _agentState.monitoringActive = true;
  _initialized                 = true;

  RecoveryAgentLogger.info('[RecoveryAgent] Recovery agent initialized — runtime monitoring active.');
  return getRecoveryAgentState();
}

// ----------------------------------------------------------------
// PROCESS RECOVERY TASK
// ----------------------------------------------------------------

export async function processRecoveryTask(task) {
  if (!task || !task.type) {
    throw new Error('[RecoveryAgent] processRecoveryTask: invalid task.');
  }

  RecoveryAgentLogger.info(
    `[RecoveryAgent] Processing task: "${task.id}" (type: ${task.type})`
  );
  _agentState.lastActivityAt = Date.now();

  let result;

  switch (task.type) {
    case RECOVERY_TASK_TYPE.TRIGGER_RECOVERY: {
      const { reason, error } = task.payload;
      if (!reason) throw new Error('[RecoveryAgent] TRIGGER_RECOVERY: reason required.');

      RecoveryAgentLogger.warn(`[RecoveryAgent] Triggering runtime recovery — reason: ${reason}`);

      _agentState.recoveryAttempts++;
      _agentState.lastRecoveryReason = reason;

      result = await recoverRuntime(reason, error ? new Error(error) : null);
      break;
    }

    case RECOVERY_TASK_TYPE.ENTER_SAFE_MODE: {
      const { reason } = task.payload;
      RecoveryAgentLogger.warn(`[RecoveryAgent] Entering safe mode — reason: ${reason}`);
      await enterSafeMode(reason || 'recovery_agent_request');
      result = getRecoveryState();
      break;
    }

    case RECOVERY_TASK_TYPE.GET_RECOVERY_STATE: {
      result = getRecoveryState();
      break;
    }

    case RECOVERY_TASK_TYPE.MONITOR_HEALTH: {
      // Returns current monitoring report — no side effects
      result = {
        monitoring:          _agentState.monitoringActive,
        recoveryAttempts:    _agentState.recoveryAttempts,
        lastRecoveryReason:  _agentState.lastRecoveryReason,
        engineState:         getRecoveryState(),
      };
      break;
    }

    default:
      throw new Error(`[RecoveryAgent] Unknown task type: "${task.type}".`);
  }

  _agentState.processedCount++;
  RecoveryAgentLogger.info(`[RecoveryAgent] Task "${task.id}" processed.`);
  return result;
}

// ----------------------------------------------------------------
// GET RECOVERY AGENT STATE
// ----------------------------------------------------------------

export function getRecoveryAgentState() {
  return {
    agentId:             RECOVERY_AGENT_ID,
    initialized:         _initialized,
    processedCount:      _agentState.processedCount,
    errorCount:          _agentState.errorCount,
    lastActivityAt:      _agentState.lastActivityAt,
    recoveryAttempts:    _agentState.recoveryAttempts,
    lastRecoveryReason:  _agentState.lastRecoveryReason,
    monitoringActive:    _agentState.monitoringActive,
    engineState:         getRecoveryState(),
    lifecycleState:      getAgentLifecycleState(RECOVERY_AGENT_ID)?.state || LIFECYCLE_STATE.IDLE,
  };
}

// ----------------------------------------------------------------
// SHUTDOWN
// ----------------------------------------------------------------

export function shutdownRecoveryAgent() {
  for (const unsub of _unsubscribers) unsub();
  _unsubscribers.length = 0;
  _agentState.monitoringActive = false;
  _initialized = false;
  RecoveryAgentLogger.info('[RecoveryAgent] Recovery agent shut down.');
}

// ----------------------------------------------------------------
// TASK HANDLER
// ----------------------------------------------------------------

export async function recoveryTaskHandler(task) {
  return processRecoveryTask(task);
}

// ----------------------------------------------------------------
// INTERNAL: Bind subscriptions
// ----------------------------------------------------------------

function _bindSubscriptions() {
  // Monitor safe mode events
  const unsubSafe = subscribe(SYSTEM_EVENTS.SAFE_MODE_ENTERED, (payload) => {
    RecoveryAgentLogger.warn(
      `[RecoveryAgent] Safe mode entered — reason: ${payload.reason}`
    );
    _agentState.lastActivityAt    = Date.now();
    _agentState.lastRecoveryReason = payload.reason;
  }, { subscriberId: `${RECOVERY_AGENT_ID}_safe_mode` });

  // Monitor recovery complete events
  const unsubRecover = subscribe(SYSTEM_EVENTS.RECOVERY_COMPLETE, (payload) => {
    RecoveryAgentLogger.info(
      `[RecoveryAgent] Recovery complete — reason: ${payload.reason}`
    );
    _agentState.lastActivityAt = Date.now();
  }, { subscriberId: `${RECOVERY_AGENT_ID}_recovery_complete` });

  _unsubscribers.push(unsubSafe, unsubRecover);
}
