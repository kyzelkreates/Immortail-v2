// ================================================================
// IMMORTAIL™ Gen2 — WORKER ORCHESTRATOR
// Coordinates all workers. Synchronizes state. Prevents conflicts.
// Workers communicate only through the orchestrator — never directly.
// ================================================================

import storage      from '../core/storage.js';
import { EventBus } from '../core/eventBus.js';

export const ORCH_EVENTS = {
  WORKER_REGISTERED: 'SYSTEM::WORKER_REGISTERED',
  WORKER_STARTED:    'SYSTEM::WORKER_STARTED',
  WORKER_STOPPED:    'SYSTEM::WORKER_STOPPED',
  WORKER_ERROR:      'SYSTEM::WORKER_ERROR',
  TASK_QUEUED:       'SYSTEM::WORKER_TASK_QUEUED',
  TASK_COMPLETE:     'SYSTEM::WORKER_TASK_COMPLETE',
};

export const WORKER_STATUS = {
  IDLE:     'idle',
  ACTIVE:   'active',
  PAUSED:   'paused',
  ERROR:    'error',
  STOPPED:  'stopped',
};

// Runtime worker registry
const _workers    = new Map();  // workerId → WorkerDef
const _taskQueue  = [];
let   _processing = false;

// ── Registration ─────────────────────────────────────────────────

export function registerWorker(id, def) {
  if (_workers.has(id)) return;
  _workers.set(id, {
    id,
    name:        def.name    ?? id,
    icon:        def.icon    ?? '⚙️',
    description: def.description ?? '',
    status:      WORKER_STATUS.IDLE,
    tasksRun:    0,
    errors:      0,
    lastRunAt:   null,
    lastError:   null,
    handler:     def.handler,
  });
  _persistWorkerState();
  EventBus.emit(ORCH_EVENTS.WORKER_REGISTERED, { id, name: def.name });
}

export function getAllWorkers() {
  return [..._workers.values()].map(w => ({ ...w, handler: undefined }));
}

export function getWorkerStatus(id) {
  const w = _workers.get(id);
  if (!w) return null;
  return { id: w.id, name: w.name, status: w.status, tasksRun: w.tasksRun, errors: w.errors, lastRunAt: w.lastRunAt };
}

// ── Task queue ───────────────────────────────────────────────────

/**
 * Enqueue a task for a specific worker.
 * @param {string} workerId
 * @param {string} taskType
 * @param {object} payload
 * @param {number} priority 0-100 (higher = runs sooner)
 */
export function enqueueTask(workerId, taskType, payload = {}, priority = 50) {
  const task = {
    id:        `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    workerId,
    taskType,
    payload,
    priority,
    queuedAt:  Date.now(),
  };
  _taskQueue.push(task);
  _taskQueue.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  EventBus.emit(ORCH_EVENTS.TASK_QUEUED, { workerId, taskType, taskId: task.id });
  _processTasks();
  return task.id;
}

async function _processTasks() {
  if (_processing) return;
  _processing = true;
  while (_taskQueue.length > 0) {
    const task   = _taskQueue.shift();
    const worker = _workers.get(task.workerId);
    if (!worker || !worker.handler) continue;
    _setWorkerStatus(task.workerId, WORKER_STATUS.ACTIVE);
    try {
      await worker.handler(task.taskType, task.payload);
      worker.tasksRun++;
      worker.lastRunAt = Date.now();
      EventBus.emit(ORCH_EVENTS.TASK_COMPLETE, { workerId: task.workerId, taskType: task.taskType });
    } catch (err) {
      worker.errors++;
      worker.lastError = err.message;
      _setWorkerStatus(task.workerId, WORKER_STATUS.ERROR);
      EventBus.emit(ORCH_EVENTS.WORKER_ERROR, { workerId: task.workerId, error: err.message });
      console.error(`[Orchestrator] Worker "${task.workerId}" error:`, err.message);
    } finally {
      _setWorkerStatus(task.workerId, WORKER_STATUS.IDLE);
    }
  }
  _processing = false;
  _persistWorkerState();
}

function _setWorkerStatus(id, status) {
  const w = _workers.get(id);
  if (w) w.status = status;
}

function _persistWorkerState() {
  const state = {};
  _workers.forEach((w, id) => {
    state[id] = { id: w.id, name: w.name, status: w.status, tasksRun: w.tasksRun, errors: w.errors, lastRunAt: w.lastRunAt, lastError: w.lastError };
  });
  storage.patchWorkerState(state);
}

export function resetWorkerErrors(id) {
  const w = _workers.get(id);
  if (w) { w.errors = 0; w.lastError = null; w.status = WORKER_STATUS.IDLE; }
}
