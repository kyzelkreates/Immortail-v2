// ================================================================
// IMMORTAIL™ — LIGHTWEIGHT INTERNAL SCHEDULER
// Deferred tasks, queued init tasks, intervals, cleanup registry.
// Prevents duplicates. Supports clean shutdown.
// ================================================================

import { SCHEDULER_STATUS, SCHEDULER_TASK_STATUS } from '../utils/constants.js';
import { SchedulerLogger } from '../utils/logger.js';
import { updateRuntimeState } from './runtime.js';

// ----------------------------------------------------------------
// INTERNAL SCHEDULER STATE
// ----------------------------------------------------------------

let _schedulerState = {
  status: SCHEDULER_STATUS.IDLE,
  tasks: {},
  intervals: {},
  initializedAt: null,
};

// ----------------------------------------------------------------
// INITIALIZE SCHEDULER
// ----------------------------------------------------------------

export function initializeScheduler() {
  SchedulerLogger.group('Scheduler Initialization');

  if (_schedulerState.status !== SCHEDULER_STATUS.IDLE) {
    SchedulerLogger.warn('Scheduler already initialized. Skipping.');
    SchedulerLogger.groupEnd();
    return;
  }

  _schedulerState.status = SCHEDULER_STATUS.RUNNING;
  _schedulerState.initializedAt = Date.now();

  updateRuntimeState({ flags: { schedulerReady: true } });

  SchedulerLogger.info('Scheduler RUNNING.');
  SchedulerLogger.groupEnd();
}

// ----------------------------------------------------------------
// REGISTER TASK
// ----------------------------------------------------------------

/**
 * Register a deferred or queued task.
 * @param {string} taskId - Unique identifier for the task.
 * @param {Function} fn - The async or sync task function.
 * @param {Object} options
 * @param {number} [options.delay=0] - Delay in ms before task runs.
 * @param {boolean} [options.repeat=false] - Whether to repeat the task.
 * @param {number} [options.interval=0] - Interval in ms (if repeat=true).
 */
export function registerTask(taskId, fn, options = {}) {
  if (_schedulerState.status !== SCHEDULER_STATUS.RUNNING) {
    SchedulerLogger.warn(`registerTask: Scheduler is not running. Cannot register "${taskId}".`);
    return;
  }

  if (_schedulerState.tasks[taskId]) {
    SchedulerLogger.warn(`registerTask: Task "${taskId}" is already registered. Use removeTask first.`);
    return;
  }

  if (typeof fn !== 'function') {
    SchedulerLogger.error(`registerTask: "${taskId}" — fn must be a function.`);
    return;
  }

  const { delay = 0, repeat = false, interval = 0 } = options;

  _schedulerState.tasks[taskId] = {
    id: taskId,
    status: SCHEDULER_TASK_STATUS.PENDING,
    registeredAt: Date.now(),
    repeat,
    interval,
    delay,
  };

  SchedulerLogger.info(`Task registered: "${taskId}" (delay: ${delay}ms, repeat: ${repeat})`);

  if (repeat && interval > 0) {
    const intervalId = setInterval(async () => {
      await _executeTask(taskId, fn);
    }, interval);
    _schedulerState.intervals[taskId] = intervalId;

    if (delay > 0) {
      setTimeout(async () => {
        await _executeTask(taskId, fn);
      }, delay);
    } else {
      _executeTask(taskId, fn);
    }
  } else {
    setTimeout(async () => {
      await _executeTask(taskId, fn);
    }, delay);
  }
}

// ----------------------------------------------------------------
// REMOVE TASK
// ----------------------------------------------------------------

export function removeTask(taskId) {
  if (!_schedulerState.tasks[taskId]) {
    SchedulerLogger.warn(`removeTask: Task "${taskId}" not found.`);
    return;
  }

  // Clear interval if it exists
  if (_schedulerState.intervals[taskId]) {
    clearInterval(_schedulerState.intervals[taskId]);
    delete _schedulerState.intervals[taskId];
  }

  _schedulerState.tasks[taskId].status = SCHEDULER_TASK_STATUS.REMOVED;
  delete _schedulerState.tasks[taskId];

  SchedulerLogger.info(`Task removed: "${taskId}"`);
}

// ----------------------------------------------------------------
// SHUTDOWN SCHEDULER
// ----------------------------------------------------------------

export function shutdownScheduler() {
  SchedulerLogger.group('Scheduler Shutdown');

  // Clear all intervals
  Object.keys(_schedulerState.intervals).forEach((taskId) => {
    clearInterval(_schedulerState.intervals[taskId]);
    SchedulerLogger.debug(`Cleared interval for task: "${taskId}"`);
  });

  _schedulerState.intervals = {};
  _schedulerState.tasks = {};
  _schedulerState.status = SCHEDULER_STATUS.SHUTDOWN;

  SchedulerLogger.info('Scheduler SHUTDOWN. All tasks and intervals cleared.');
  SchedulerLogger.groupEnd();
}

// ----------------------------------------------------------------
// GET SCHEDULER STATE
// ----------------------------------------------------------------

export function getSchedulerState() {
  return {
    status: _schedulerState.status,
    taskCount: Object.keys(_schedulerState.tasks).length,
    initializedAt: _schedulerState.initializedAt,
    tasks: Object.keys(_schedulerState.tasks).map((id) => ({
      id,
      ...(_schedulerState.tasks[id]),
    })),
  };
}

// ----------------------------------------------------------------
// INTERNAL: Execute a task
// ----------------------------------------------------------------

async function _executeTask(taskId, fn) {
  const task = _schedulerState.tasks[taskId];
  if (!task) return; // Task may have been removed

  task.status = SCHEDULER_TASK_STATUS.RUNNING;
  SchedulerLogger.debug(`Executing task: "${taskId}"`);

  try {
    await fn();
    if (!task.repeat) {
      task.status = SCHEDULER_TASK_STATUS.COMPLETE;
      delete _schedulerState.tasks[taskId];
    } else {
      task.status = SCHEDULER_TASK_STATUS.PENDING; // Reset for next run
    }
    SchedulerLogger.debug(`Task complete: "${taskId}"`);
  } catch (err) {
    task.status = SCHEDULER_TASK_STATUS.FAILED;
    SchedulerLogger.error(`Task "${taskId}" failed: ${err.message}`);
  }
}
