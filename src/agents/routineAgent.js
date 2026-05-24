// ================================================================
// IMMORTAIL™ — ROUTINE AGENT (FOUNDATION)
// Scheduled task coordination, routine orchestration,
// runtime scheduling hooks. NO EXECUTION ENGINE YET.
// ================================================================

import { SystemLogger }           from '../utils/logger.js';
import { subscribe }               from '../events/eventBus.js';
import { SYSTEM_EVENTS }           from '../events/eventTypes.js';
import { getAgentLifecycleState, LIFECYCLE_STATE } from './lifecycle.js';
import { AGENT_CAPABILITY } from './registry.js';

const RoutineAgentLogger = SystemLogger;

// ----------------------------------------------------------------
// AGENT IDENTITY
// ----------------------------------------------------------------

export const ROUTINE_AGENT_ID = 'routine_agent';

// ----------------------------------------------------------------
// TASK TYPES
// ----------------------------------------------------------------

export const ROUTINE_TASK_TYPE = {
  REGISTER_ROUTINE:  'routine.register',
  UNREGISTER_ROUTINE:'routine.unregister',
  TRIGGER_ROUTINE:   'routine.trigger',
  GET_SCHEDULE:      'routine.get_schedule',
};

// ----------------------------------------------------------------
// ROUTINE RECORD
// ----------------------------------------------------------------

class RoutineRecord {
  constructor({ id, profileId, type, schedule, active }) {
    this.id            = id;
    this.profileId     = profileId;
    this.type          = type;
    this.schedule      = schedule  || {};
    this.active        = active    ?? true;
    this.triggerCount  = 0;
    this.lastTriggered = null;
    this.registeredAt  = Date.now();
  }
}

// ----------------------------------------------------------------
// INTERNAL STATE
// ----------------------------------------------------------------

let _initialized = false;
let _agentState  = {
  processedCount:    0,
  errorCount:        0,
  lastActivityAt:    null,
  registeredRoutines: 0,
};

/** @type {Map<string, RoutineRecord>} */
const _routines      = new Map();
const _unsubscribers = [];

// ----------------------------------------------------------------
// AGENT DESCRIPTOR
// ----------------------------------------------------------------

export const ROUTINE_AGENT_DESCRIPTOR = {
  id:           ROUTINE_AGENT_ID,
  capabilities: [AGENT_CAPABILITY.ROUTINE],
  metadata:     {
    taskTypes:   Object.values(ROUTINE_TASK_TYPE),
    description: 'Scheduled routine coordination and orchestration agent.',
  },
};

// ----------------------------------------------------------------
// INITIALIZE ROUTINE AGENT
// ----------------------------------------------------------------

export async function initializeRoutineAgent() {
  if (_initialized) {
    RoutineAgentLogger.warn('[RoutineAgent] Already initialized. Skipping.');
    return getRoutineAgentState();
  }

  RoutineAgentLogger.info('[RoutineAgent] Initializing routine agent...');

  _bindSubscriptions();

  _initialized = true;
  RoutineAgentLogger.info('[RoutineAgent] Routine agent initialized.');
  return getRoutineAgentState();
}

// ----------------------------------------------------------------
// PROCESS ROUTINE TASK
// ----------------------------------------------------------------

export async function processRoutineTask(task) {
  if (!task || !task.type) {
    throw new Error('[RoutineAgent] processRoutineTask: invalid task.');
  }

  RoutineAgentLogger.info(`[RoutineAgent] Processing task: "${task.id}" (type: ${task.type})`);
  _agentState.lastActivityAt = Date.now();

  let result;

  switch (task.type) {
    case ROUTINE_TASK_TYPE.REGISTER_ROUTINE: {
      const { id, profileId, type, schedule, active } = task.payload;

      if (!id || !profileId || !type) {
        throw new Error('[RoutineAgent] REGISTER_ROUTINE: id, profileId, and type required.');
      }

      if (_routines.has(id)) {
        RoutineAgentLogger.warn(`[RoutineAgent] Routine "${id}" already registered. Skipping.`);
        result = _routines.get(id);
        break;
      }

      const record = new RoutineRecord({ id, profileId, type, schedule, active });
      _routines.set(id, record);
      _agentState.registeredRoutines = _routines.size;

      RoutineAgentLogger.info(`[RoutineAgent] Routine registered: "${id}" (type: ${type})`);
      result = record;
      break;
    }

    case ROUTINE_TASK_TYPE.UNREGISTER_ROUTINE: {
      const { id } = task.payload;
      if (!id) throw new Error('[RoutineAgent] UNREGISTER_ROUTINE: id required.');

      const deleted = _routines.delete(id);
      _agentState.registeredRoutines = _routines.size;

      result = { unregistered: deleted, id };
      RoutineAgentLogger.info(`[RoutineAgent] Routine "${id}" unregistered: ${deleted}`);
      break;
    }

    case ROUTINE_TASK_TYPE.TRIGGER_ROUTINE: {
      const { id } = task.payload;
      const routine = _routines.get(id);

      if (!routine) {
        throw new Error(`[RoutineAgent] Routine "${id}" not found.`);
      }
      if (!routine.active) {
        RoutineAgentLogger.warn(`[RoutineAgent] Routine "${id}" is inactive. Skipping trigger.`);
        result = { triggered: false, id, reason: 'inactive' };
        break;
      }

      routine.triggerCount++;
      routine.lastTriggered = Date.now();

      RoutineAgentLogger.info(
        `[RoutineAgent] Routine "${id}" triggered (count: ${routine.triggerCount}).`
      );

      // Future run: this will dispatch to the appropriate handler
      result = {
        triggered:    true,
        id,
        triggerCount: routine.triggerCount,
        triggeredAt:  routine.lastTriggered,
      };
      break;
    }

    case ROUTINE_TASK_TYPE.GET_SCHEDULE: {
      const { profileId } = task.payload;

      const schedule = profileId
        ? Array.from(_routines.values()).filter((r) => r.profileId === profileId)
        : Array.from(_routines.values());

      result = {
        count:    schedule.length,
        routines: schedule.map((r) => ({
          id:            r.id,
          type:          r.type,
          active:        r.active,
          triggerCount:  r.triggerCount,
          lastTriggered: r.lastTriggered,
          schedule:      r.schedule,
        })),
      };
      break;
    }

    default:
      throw new Error(`[RoutineAgent] Unknown task type: "${task.type}".`);
  }

  _agentState.processedCount++;
  return result;
}

// ----------------------------------------------------------------
// GET ROUTINE AGENT STATE
// ----------------------------------------------------------------

export function getRoutineAgentState() {
  return {
    agentId:             ROUTINE_AGENT_ID,
    initialized:         _initialized,
    processedCount:      _agentState.processedCount,
    errorCount:          _agentState.errorCount,
    lastActivityAt:      _agentState.lastActivityAt,
    registeredRoutines:  _routines.size,
    activeRoutines:      Array.from(_routines.values()).filter((r) => r.active).length,
    lifecycleState:      getAgentLifecycleState(ROUTINE_AGENT_ID)?.state || LIFECYCLE_STATE.IDLE,
  };
}

// ----------------------------------------------------------------
// SHUTDOWN
// ----------------------------------------------------------------

export function shutdownRoutineAgent() {
  for (const unsub of _unsubscribers) unsub();
  _unsubscribers.length = 0;
  _routines.clear();
  _initialized = false;
  RoutineAgentLogger.info('[RoutineAgent] Routine agent shut down.');
}

// ----------------------------------------------------------------
// TASK HANDLER
// ----------------------------------------------------------------

export async function routineTaskHandler(task) {
  return processRoutineTask(task);
}

// ----------------------------------------------------------------
// INTERNAL: Bind subscriptions
// ----------------------------------------------------------------

function _bindSubscriptions() {
  const unsub = subscribe(SYSTEM_EVENTS.APP_SHUTDOWN, () => {
    RoutineAgentLogger.info('[RoutineAgent] App shutdown — deactivating all routines.');
    for (const r of _routines.values()) r.active = false;
  }, { subscriberId: ROUTINE_AGENT_ID });

  _unsubscribers.push(unsub);
}
