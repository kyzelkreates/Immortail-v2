// ================================================================
// IMMORTAIL™ — SUPERVISOR AGENT (CENTRAL ORCHESTRATOR)
// Task routing, priority handling, workload distribution,
// lifecycle supervision, conflict prevention, health monitoring.
// DOES NOT EXECUTE BUSINESS LOGIC ITSELF. COORDINATES ONLY.
// ================================================================

import { SystemLogger }  from '../utils/logger.js';
import { emit, subscribe } from '../events/eventBus.js';
import { AI_EVENTS }     from '../events/eventTypes.js';
import {
  registerRuntimeAgent,
  getAgent,
  getAllAgents,
  getRegistryStatus,
  updateAgentHealth,
  incrementAgentTaskCount,
  decrementAgentTaskCount,
  AGENT_CAPABILITY,
  AGENT_HEALTH,
} from './registry.js';
import {
  initializeAgentLifecycle,
  startAgent,
  shutdownAgent,
  recoverAgent,
  failAgent,
  isAgentActive,
  getAllLifecycleStates,
  LIFECYCLE_STATE,
} from './lifecycle.js';

const SupervisorLogger = SystemLogger;

// ----------------------------------------------------------------
// TASK PRIORITY
// ----------------------------------------------------------------

export const TASK_PRIORITY = {
  LOW:      0,
  NORMAL:   1,
  HIGH:     2,
  CRITICAL: 3,
};

// ----------------------------------------------------------------
// TASK STATUS
// ----------------------------------------------------------------

export const TASK_STATUS = {
  QUEUED:     'queued',
  ASSIGNED:   'assigned',
  PROCESSING: 'processing',
  COMPLETED:  'completed',
  FAILED:     'failed',
  CANCELLED:  'cancelled',
};

// ----------------------------------------------------------------
// TASK RECORD
// ----------------------------------------------------------------

class TaskRecord {
  constructor({ id, type, priority, source, payload }) {
    this.id              = id;
    this.type            = type;
    this.priority        = priority ?? TASK_PRIORITY.NORMAL;
    this.source          = source  || 'unknown';
    this.payload         = payload || {};
    this.assignedAgent   = null;
    this.status          = TASK_STATUS.QUEUED;
    this.createdAt       = Date.now();
    this.assignedAt      = null;
    this.completedAt     = null;
    this.retryCount      = 0;
    this.maxRetries      = 2;
    this.error           = null;
  }
}

// ----------------------------------------------------------------
// INTERNAL SUPERVISOR STATE
// ----------------------------------------------------------------

let _initialized = false;

/** @type {Map<string, TaskRecord>} */
const _taskQueue  = new Map();

/** @type {Map<string, Function>} — taskType → handler resolver */
const _routingTable = new Map();

let _supervisorStats = {
  tasksDispatched:  0,
  tasksCompleted:   0,
  tasksFailed:      0,
  tasksCancelled:   0,
  agentsRegistered: 0,
  startedAt:        null,
};

// ----------------------------------------------------------------
// INITIALIZE SUPERVISOR
// ----------------------------------------------------------------

/**
 * Initialize the supervisor agent and lifecycle controller.
 */
export async function initializeSupervisor() {
  if (_initialized) {
    SupervisorLogger.warn('[Supervisor] Already initialized. Skipping.');
    return getSupervisorState();
  }

  SupervisorLogger.group('[Supervisor] Initializing Supervisor Agent...');

  // Initialize lifecycle system
  initializeAgentLifecycle();

  // Register the supervisor itself in the registry
  registerRuntimeAgent({
    id:           'supervisor',
    capabilities: [AGENT_CAPABILITY.SUPERVISION],
    metadata:     { isSupervisor: true },
  });

  await startAgent('supervisor');

  _supervisorStats.startedAt = Date.now();
  _initialized               = true;

  // Subscribe to system events for health monitoring
  _bindSystemEventSubscriptions();

  SupervisorLogger.info('[Supervisor] Supervisor agent active.');
  SupervisorLogger.groupEnd();

  return getSupervisorState();
}

// ----------------------------------------------------------------
// REGISTER AGENT (via supervisor)
// ----------------------------------------------------------------

/**
 * Register a specialized agent through the supervisor.
 * @param {Object} agentConfig — { id, capabilities, metadata }
 * @param {Function} [taskHandler] — optional task handler (agentId → (task) => Promise)
 */
export async function registerAgent(agentConfig, taskHandler = null) {
  _assertInitialized();

  const record = registerRuntimeAgent(agentConfig);

  // Register routing entry if handler provided
  if (typeof taskHandler === 'function') {
    _routingTable.set(agentConfig.id, taskHandler);
  }

  await startAgent(agentConfig.id);
  _supervisorStats.agentsRegistered++;

  await emit(AI_EVENTS.AGENT_REGISTERED, {
    timestamp: Date.now(),
    agentId:   agentConfig.id,
  });

  SupervisorLogger.info(
    `[Supervisor] Agent "${agentConfig.id}" registered and started. ` +
    `Capabilities: [${agentConfig.capabilities.join(', ')}]`
  );

  return record;
}

// ----------------------------------------------------------------
// DISPATCH TASK
// ----------------------------------------------------------------

/**
 * Create a task, route it to the appropriate agent, and execute.
 * @param {Object} taskConfig
 * @param {string} taskConfig.id
 * @param {string} taskConfig.type       — task type for routing
 * @param {number} [taskConfig.priority]
 * @param {string} [taskConfig.source]
 * @param {Object} [taskConfig.payload]
 * @param {string} [taskConfig.targetAgent] — explicit agent ID (optional; skips routing)
 * @returns {Promise<TaskRecord>}
 */
export async function dispatchTask(taskConfig) {
  _assertInitialized();

  const task = _validateAndCreateTask(taskConfig);
  _taskQueue.set(task.id, task);
  _supervisorStats.tasksDispatched++;

  SupervisorLogger.info(
    `[Supervisor] Task dispatched — id: ${task.id}, type: ${task.type}, ` +
    `priority: ${task.priority}, source: ${task.source}`
  );

  await emit(AI_EVENTS.TASK_CREATED, {
    timestamp: Date.now(),
    taskId:    task.id,
    type:      task.type,
  });

  // Resolve target agent
  const targetAgentId = taskConfig.targetAgent
    ? taskConfig.targetAgent
    : _resolveAgent(task.type);

  if (!targetAgentId) {
    task.status = TASK_STATUS.FAILED;
    task.error  = `No agent capable of handling task type "${task.type}".`;
    _supervisorStats.tasksFailed++;
    SupervisorLogger.error(`[Supervisor] ${task.error}`);
    return task;
  }

  if (!isAgentActive(targetAgentId)) {
    SupervisorLogger.warn(
      `[Supervisor] Agent "${targetAgentId}" not active — attempting recovery before dispatch.`
    );
    try {
      await recoverAgent(targetAgentId);
    } catch (err) {
      task.status = TASK_STATUS.FAILED;
      task.error  = `Agent "${targetAgentId}" could not be recovered: ${err.message}`;
      _supervisorStats.tasksFailed++;
      return task;
    }
  }

  // Assign task
  task.status        = TASK_STATUS.ASSIGNED;
  task.assignedAgent = targetAgentId;
  task.assignedAt    = Date.now();

  incrementAgentTaskCount(targetAgentId);

  // Execute via routing table
  const handler = _routingTable.get(targetAgentId);

  if (typeof handler === 'function') {
    task.status = TASK_STATUS.PROCESSING;

    try {
      await _executeWithRetry(task, handler, targetAgentId);
    } catch (err) {
      task.status = TASK_STATUS.FAILED;
      task.error  = err.message;
      _supervisorStats.tasksFailed++;
      await failAgent(targetAgentId, { taskId: task.id, error: err.message });
      SupervisorLogger.error(
        `[Supervisor] Task "${task.id}" FAILED on agent "${targetAgentId}": ${err.message}`
      );
    }
  } else {
    // No handler registered — mark assigned and allow agent to poll
    SupervisorLogger.info(
      `[Supervisor] Task "${task.id}" assigned to "${targetAgentId}" (no direct handler — polling mode).`
    );
  }

  decrementAgentTaskCount(targetAgentId);

  return task;
}

// ----------------------------------------------------------------
// CANCEL TASK
// ----------------------------------------------------------------

/**
 * Cancel a queued or assigned task.
 * @param {string} taskId
 * @returns {boolean}
 */
export function cancelTask(taskId) {
  const task = _taskQueue.get(taskId);
  if (!task) {
    SupervisorLogger.warn(`[Supervisor] cancelTask: task "${taskId}" not found.`);
    return false;
  }

  if ([TASK_STATUS.COMPLETED, TASK_STATUS.FAILED, TASK_STATUS.CANCELLED].includes(task.status)) {
    SupervisorLogger.warn(
      `[Supervisor] cancelTask: task "${taskId}" already in terminal state: ${task.status}.`
    );
    return false;
  }

  task.status      = TASK_STATUS.CANCELLED;
  task.completedAt = Date.now();
  _supervisorStats.tasksCancelled++;

  if (task.assignedAgent) {
    decrementAgentTaskCount(task.assignedAgent);
  }

  SupervisorLogger.info(`[Supervisor] Task "${taskId}" cancelled.`);
  return true;
}

// ----------------------------------------------------------------
// REGISTER TASK HANDLER
// ----------------------------------------------------------------

/**
 * Register a routing handler for an agent ID.
 * Handler receives the task and returns a Promise.
 * @param {string}   agentId
 * @param {Function} fn — (task: TaskRecord) => Promise<any>
 */
export function registerTaskHandler(agentId, fn) {
  if (typeof fn !== 'function') {
    SupervisorLogger.error('[Supervisor] registerTaskHandler: fn must be a function.');
    return;
  }
  _routingTable.set(agentId, fn);
  SupervisorLogger.debug(`[Supervisor] Task handler registered for agent "${agentId}".`);
}

// ----------------------------------------------------------------
// GET SUPERVISOR STATE
// ----------------------------------------------------------------

export function getSupervisorState() {
  return {
    initialized:   _initialized,
    stats:         { ..._supervisorStats },
    queueSize:     _taskQueue.size,
    activeAgents:  getAllAgents().filter((a) => a.lifecycleStatus === LIFECYCLE_STATE.ACTIVE).length,
    registry:      getRegistryStatus(),
    lifecycle:     getAllLifecycleStates(),
    taskSummary:   _getTaskSummary(),
  };
}

// ----------------------------------------------------------------
// HEALTH REPORT
// ----------------------------------------------------------------

export function getSupervisorHealthReport() {
  const agents = getAllAgents();
  return {
    timestamp:    Date.now(),
    totalAgents:  agents.length,
    healthBreakdown: {
      healthy:  agents.filter((a) => a.health === AGENT_HEALTH.HEALTHY).length,
      degraded: agents.filter((a) => a.health === AGENT_HEALTH.DEGRADED).length,
      failed:   agents.filter((a) => a.health === AGENT_HEALTH.FAILED).length,
      unknown:  agents.filter((a) => a.health === AGENT_HEALTH.UNKNOWN).length,
    },
    tasksInQueue: _taskQueue.size,
    taskBreakdown: _getTaskSummary(),
    agentLoad: agents.map((a) => ({
      id:            a.id,
      activeTasks:   a.activeTaskCount,
      totalHandled:  a.totalTasksHandled,
      health:        a.health,
      lifecycle:     a.lifecycleStatus,
    })),
  };
}

// ----------------------------------------------------------------
// SHUTDOWN ALL AGENTS
// ----------------------------------------------------------------

export async function shutdownAllAgents() {
  SupervisorLogger.warn('[Supervisor] Shutting down all agents...');
  const agents = getAllAgents();

  for (const agent of agents) {
    try {
      await shutdownAgent(agent.id);
    } catch (err) {
      SupervisorLogger.error(`[Supervisor] Error shutting down "${agent.id}": ${err.message}`);
    }
  }

  SupervisorLogger.info('[Supervisor] All agents shut down.');
}

// ----------------------------------------------------------------
// INTERNAL: Validate and create task
// ----------------------------------------------------------------

function _validateAndCreateTask(config) {
  if (!config?.id || typeof config.id !== 'string') {
    throw new Error('[Supervisor] Task must have a string "id".');
  }
  if (!config?.type || typeof config.type !== 'string') {
    throw new Error('[Supervisor] Task must have a string "type".');
  }
  if (_taskQueue.has(config.id)) {
    throw new Error(`[Supervisor] Duplicate task id: "${config.id}".`);
  }
  return new TaskRecord(config);
}

// ----------------------------------------------------------------
// INTERNAL: Resolve agent for task type
// ----------------------------------------------------------------

function _resolveAgent(taskType) {
  // The routing table maps agentId → handler.
  // We also support capability-based routing by task type prefix.
  const typeCapabilityMap = {
    'memory':         AGENT_CAPABILITY.MEMORY,
    'emotion':        AGENT_CAPABILITY.EMOTION,
    'dog':            AGENT_CAPABILITY.DOG_RUNTIME,
    'conversation':   AGENT_CAPABILITY.CONVERSATION,
    'routine':        AGENT_CAPABILITY.ROUTINE,
    'recovery':       AGENT_CAPABILITY.RECOVERY,
  };

  // Match by task type prefix
  for (const [prefix, capability] of Object.entries(typeCapabilityMap)) {
    if (taskType.startsWith(prefix)) {
      // Find first active agent with this capability
      const agents = getAllAgents().filter(
        (a) =>
          a.capabilities.includes(capability) &&
          a.lifecycleStatus === LIFECYCLE_STATE.ACTIVE
      );
      if (agents.length > 0) return agents[0].id;
    }
  }

  // Fallback: first registered handler key
  for (const agentId of _routingTable.keys()) {
    if (isAgentActive(agentId)) return agentId;
  }

  return null;
}

// ----------------------------------------------------------------
// INTERNAL: Execute with retry
// ----------------------------------------------------------------

async function _executeWithRetry(task, handler, agentId) {
  let lastError;

  for (let attempt = 0; attempt <= task.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        SupervisorLogger.warn(
          `[Supervisor] Retry ${attempt}/${task.maxRetries} for task "${task.id}" on "${agentId}".`
        );
        task.retryCount = attempt;
      }

      await handler(task);

      task.status      = TASK_STATUS.COMPLETED;
      task.completedAt = Date.now();
      _supervisorStats.tasksCompleted++;

      await emit(AI_EVENTS.TASK_COMPLETED, {
        timestamp: Date.now(),
        taskId:    task.id,
        success:   true,
      });

      SupervisorLogger.info(
        `[Supervisor] Task "${task.id}" COMPLETED by "${agentId}" ` +
        `(attempt ${attempt + 1}, ${task.completedAt - task.assignedAt}ms).`
      );
      return;

    } catch (err) {
      lastError = err;
      SupervisorLogger.warn(
        `[Supervisor] Task "${task.id}" attempt ${attempt + 1} failed: ${err.message}`
      );
    }
  }

  throw lastError;
}

// ----------------------------------------------------------------
// INTERNAL: Bind system event subscriptions
// ----------------------------------------------------------------

function _bindSystemEventSubscriptions() {
  // Monitor for agent failures via AI events
  subscribe(AI_EVENTS.AGENT_REMOVED, async (payload) => {
    SupervisorLogger.warn(`[Supervisor] Agent removed event: ${payload.agentId}`);
    updateAgentHealth(payload.agentId, AGENT_HEALTH.FAILED);
  }, { subscriberId: 'supervisor_agent_removed_monitor' });
}

// ----------------------------------------------------------------
// INTERNAL: Task summary
// ----------------------------------------------------------------

function _getTaskSummary() {
  const tasks = Array.from(_taskQueue.values());
  const summary = {};
  for (const s of Object.values(TASK_STATUS)) {
    summary[s] = tasks.filter((t) => t.status === s).length;
  }
  return summary;
}

// ----------------------------------------------------------------
// INTERNAL: Assert initialized
// ----------------------------------------------------------------

function _assertInitialized() {
  if (!_initialized) {
    throw new Error('[Supervisor] Not initialized. Call initializeSupervisor() first.');
  }
}
