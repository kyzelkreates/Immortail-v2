// ================================================================
// IMMORTAIL™ — SYSTEM-WIDE ORCHESTRATOR
// Cross-layer event routing, workflow coordination, rule enforcement.
// NO FEATURE LOGIC. NO STATE OWNERSHIP. ROUTING + COORDINATION ONLY.
// ================================================================

import { SystemLogger } from '../utils/logger.js';
const OrchLogger = SystemLogger;

// ----------------------------------------------------------------
// WORKFLOW STATUS
// ----------------------------------------------------------------

export const WORKFLOW_STATUS = {
  PENDING:    'pending',
  RUNNING:    'running',
  COMPLETED:  'completed',
  CANCELLED:  'cancelled',
  FAILED:     'failed',
};

// ----------------------------------------------------------------
// SAFE EVENT ROUTING MAP
// Maps source events to allowed target handlers.
// Prevents circular routing and boundary violations.
// ----------------------------------------------------------------

const EVENT_ROUTING_MAP = {
  // Storage events → state updates only
  'STORAGE_INITIALIZED':      ['state', 'integration'],
  'STORAGE_ERROR':            ['integration', 'recovery'],

  // Runtime events → UI + integration
  'RUNTIME_INITIALIZED':      ['ui', 'integration'],
  'APP_READY':                ['ui'],

  // Dog state events → UI + agents only
  'DOG_STATE_UPDATED':        ['ui', 'agents'],
  'BONDING_UPDATED':          ['ui', 'agents'],

  // Emotion events → UI + 3D visualization only
  'EMOTION_CHANGED':          ['ui', 'rendering'],

  // Memory events → UI + storage
  'MEMORY_CREATED':           ['ui', 'storage'],
  'MEMORY_UPDATED':           ['ui'],

  // Media events → reconstruction + companion engines
  'MEDIA_ANALYZED':           ['companion', 'reconstruction'],
  'RECONSTRUCTION_COMPLETE':  ['ui', 'companion'],

  // Agent events → supervisor only (never to UI directly)
  'AGENT_TASK_COMPLETE':      ['supervisor'],
  'AGENT_ERROR':              ['supervisor', 'recovery'],

  // System events → integration layer
  'HEALTH_DEGRADED':          ['integration', 'recovery'],
  'HEALTH_CRITICAL':          ['integration', 'recovery'],
  'BOOT_STEP_COMPLETE':       ['integration'],
};

// ----------------------------------------------------------------
// FORBIDDEN ROUTING PAIRS
// Source → target combinations that violate SSOT
// ----------------------------------------------------------------

const FORBIDDEN_ROUTES = new Set([
  'ui→storage',          // UI must never write directly to storage
  'ui→engines',          // UI must never call engines directly
  'ui→agents',           // UI actions go through services, not agents
  'agents→storage',      // Agents access storage only via storageService
  'rendering→state',     // 3D layer must not mutate state
  'rendering→storage',   // 3D layer must not touch storage
  'rendering→agents',    // 3D layer must not call agents
]);

// ----------------------------------------------------------------
// INTERNAL STATE
// ----------------------------------------------------------------

let _initialized       = false;
let _eventRouterFn     = null;   // injected external event emitter

/** @type {Map<string, WorkflowRecord>} workflowId → record */
const _workflows       = new Map();
let   _workflowCounter = 0;

/** @type {Map<string, WorkflowDefinition>} name → definition */
const _workflowDefs    = new Map();

class WorkflowRecord {
  constructor({ id, name, steps }) {
    this.id          = id;
    this.name        = name;
    this.steps       = [...steps];
    this.currentStep = 0;
    this.status      = WORKFLOW_STATUS.PENDING;
    this.results     = [];
    this.error       = null;
    this.startedAt   = null;
    this.completedAt = null;
    this.createdAt   = Date.now();
  }
}

// ----------------------------------------------------------------
// INITIALIZE ORCHESTRATION
// ----------------------------------------------------------------

/**
 * Initialize the orchestration system.
 * @param {Object} [options]
 * @param {Function} [options.eventRouterFn]  — (event, payload) => void — external event bridge
 * @returns {Object} orchestration status
 */
export function initializeOrchestration(options = {}) {
  if (_initialized) {
    OrchLogger.warn('[Orchestration] Already initialized.');
    return getOrchestrationStatus();
  }

  if (typeof options.eventRouterFn === 'function') {
    _eventRouterFn = options.eventRouterFn;
  }

  _initialized = true;
  OrchLogger.info('[Orchestration] Initialized.');
  return getOrchestrationStatus();
}

// ----------------------------------------------------------------
// ROUTE SYSTEM EVENT
// ----------------------------------------------------------------

/**
 * Route a system event through the safe routing map.
 * Validates source→target rules before dispatching.
 *
 * @param {string} eventType   — event name from EVENT_ROUTING_MAP
 * @param {Object} payload
 * @param {string} source      — originating layer
 * @returns {{ routed: boolean, targets: string[], blocked: string[] }}
 */
export function routeSystemEvent(eventType, payload = {}, source = 'unknown') {
  if (!_initialized) {
    OrchLogger.warn('[Orchestration] Not initialized — event routing skipped.');
    return { routed: false, targets: [], blocked: [] };
  }

  const allowedTargets = EVENT_ROUTING_MAP[eventType] || [];
  const routed  = [];
  const blocked = [];

  for (const target of allowedTargets) {
    const routeKey = `${source}→${target}`;
    if (FORBIDDEN_ROUTES.has(routeKey)) {
      OrchLogger.warn(`[Orchestration] Blocked forbidden route: ${routeKey} for "${eventType}"`);
      blocked.push(target);
      continue;
    }
    routed.push(target);
  }

  if (routed.length > 0 && typeof _eventRouterFn === 'function') {
    try {
      _eventRouterFn(eventType, { ...payload, _routedBy: 'orchestrator', _source: source, _targets: routed });
    } catch (err) {
      OrchLogger.error(`[Orchestration] Event router error for "${eventType}": ${err.message}`);
    }
  }

  OrchLogger.debug(
    `[Orchestration] Routed "${eventType}" from "${source}" → [${routed.join(', ')}]` +
    (blocked.length ? ` | blocked: [${blocked.join(', ')}]` : '')
  );

  return { routed, blocked, eventType, source };
}

// ----------------------------------------------------------------
// VALIDATE ROUTE
// ----------------------------------------------------------------

/**
 * Check whether a source→target route is allowed without executing it.
 * @param {string} source
 * @param {string} target
 * @returns {boolean}
 */
export function isRouteAllowed(source, target) {
  return !FORBIDDEN_ROUTES.has(`${source}→${target}`);
}

// ----------------------------------------------------------------
// REGISTER WORKFLOW
// ----------------------------------------------------------------

/**
 * Register a reusable workflow definition.
 * @param {string}   name
 * @param {Function[]} steps  — array of async step functions
 * @returns {string} workflow name
 */
export function registerWorkflow(name, steps) {
  if (!name || typeof name !== 'string') {
    throw new OrchestrationError('[Orchestration] registerWorkflow: name required.');
  }
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new OrchestrationError('[Orchestration] registerWorkflow: steps must be a non-empty array.');
  }
  for (const [i, step] of steps.entries()) {
    if (typeof step !== 'function') {
      throw new OrchestrationError(`[Orchestration] registerWorkflow: step[${i}] must be a function.`);
    }
  }

  _workflowDefs.set(name, { name, steps });
  OrchLogger.info(`[Orchestration] Workflow registered: "${name}" (${steps.length} steps)`);
  return name;
}

// ----------------------------------------------------------------
// RUN WORKFLOW
// ----------------------------------------------------------------

/**
 * Execute a registered workflow by name.
 * @param {string} name
 * @param {Object} [context]
 * @returns {Promise<Object>} workflow record snapshot
 */
export async function runWorkflow(name, context = {}) {
  const def = _workflowDefs.get(name);
  if (!def) {
    throw new OrchestrationError(`[Orchestration] Workflow "${name}" not registered.`);
  }

  _workflowCounter++;
  const id     = `wf_${_workflowCounter}_${Date.now()}`;
  const record = new WorkflowRecord({ id, name, steps: def.steps });
  _workflows.set(id, record);

  record.status    = WORKFLOW_STATUS.RUNNING;
  record.startedAt = Date.now();

  OrchLogger.info(`[Orchestration] Workflow running: "${name}" (id: ${id})`);

  try {
    for (let i = 0; i < record.steps.length; i++) {
      if (record.status === WORKFLOW_STATUS.CANCELLED) break;
      record.currentStep = i;

      const stepResult = await record.steps[i](context);
      record.results.push({ step: i, result: stepResult || null, at: Date.now() });
    }

    if (record.status !== WORKFLOW_STATUS.CANCELLED) {
      record.status      = WORKFLOW_STATUS.COMPLETED;
      record.completedAt = Date.now();
      OrchLogger.info(
        `[Orchestration] Workflow completed: "${name}" in ${record.completedAt - record.startedAt}ms`
      );
    }
  } catch (err) {
    record.status      = WORKFLOW_STATUS.FAILED;
    record.error       = err.message;
    record.completedAt = Date.now();
    OrchLogger.error(`[Orchestration] Workflow "${name}" failed: ${err.message}`);
    throw new OrchestrationError(`[Orchestration] Workflow "${name}" failed: ${err.message}`);
  }

  return _snapshotWorkflow(record);
}

// ----------------------------------------------------------------
// CANCEL WORKFLOW
// ----------------------------------------------------------------

/**
 * Cancel a running workflow by ID.
 * @param {string} workflowId
 * @returns {boolean}
 */
export function cancelWorkflow(workflowId) {
  const record = _workflows.get(workflowId);
  if (!record) return false;
  if (record.status !== WORKFLOW_STATUS.RUNNING && record.status !== WORKFLOW_STATUS.PENDING) return false;

  record.status      = WORKFLOW_STATUS.CANCELLED;
  record.completedAt = Date.now();
  OrchLogger.info(`[Orchestration] Workflow cancelled: ${workflowId}`);
  return true;
}

// ----------------------------------------------------------------
// GET STATUS
// ----------------------------------------------------------------

export function getOrchestrationStatus() {
  const workflowList = Array.from(_workflows.values()).map(_snapshotWorkflow);
  return {
    initialized:       _initialized,
    registeredWorkflows: _workflowDefs.size,
    totalWorkflows:    _workflows.size,
    running:           workflowList.filter(w => w.status === WORKFLOW_STATUS.RUNNING).length,
    completed:         workflowList.filter(w => w.status === WORKFLOW_STATUS.COMPLETED).length,
    failed:            workflowList.filter(w => w.status === WORKFLOW_STATUS.FAILED).length,
    forbiddenRoutes:   FORBIDDEN_ROUTES.size,
    routingMapSize:    Object.keys(EVENT_ROUTING_MAP).length,
  };
}

// ----------------------------------------------------------------
// INTERNAL: Snapshot workflow (no function refs)
// ----------------------------------------------------------------

function _snapshotWorkflow(record) {
  return {
    id:          record.id,
    name:        record.name,
    status:      record.status,
    currentStep: record.currentStep,
    stepCount:   record.steps.length,
    error:       record.error,
    startedAt:   record.startedAt,
    completedAt: record.completedAt,
    createdAt:   record.createdAt,
  };
}

// ----------------------------------------------------------------
// ERROR
// ----------------------------------------------------------------

export class OrchestrationError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name      = 'OrchestrationError';
    this.context   = context;
    this.timestamp = Date.now();
  }
}
