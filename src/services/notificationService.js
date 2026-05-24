// ================================================================
// IMMORTAIL™ — NOTIFICATION SERVICE (FOUNDATION)
// Runtime notification queue. Event-driven structure.
// NO UI NOTIFICATIONS. NO PUSH. NO REMOTE. FOUNDATION ONLY.
// ================================================================

import { SystemLogger }   from '../utils/logger.js';
import { emit }            from '../events/eventBus.js';
import { NOTIFICATION_EVENTS } from '../events/eventTypes.js';

const NotificationLogger = SystemLogger;

// ----------------------------------------------------------------
// NOTIFICATION TYPES
// ----------------------------------------------------------------

export const NOTIFICATION_TYPE = {
  INFO:    'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR:   'error',
  SYSTEM:  'system',
};

// ----------------------------------------------------------------
// NOTIFICATION PRIORITY
// ----------------------------------------------------------------

export const NOTIFICATION_PRIORITY = {
  LOW:      0,
  NORMAL:   1,
  HIGH:     2,
  CRITICAL: 3,
};

// ----------------------------------------------------------------
// INTERNAL QUEUE
// ----------------------------------------------------------------

/** @type {Map<string, NotificationRecord>} */
const _queue         = new Map();
let _idCounter       = 0;
let _initialized     = false;

class NotificationRecord {
  constructor({ id, type, priority, message, metadata }) {
    this.id         = id;
    this.type       = type;
    this.priority   = priority;
    this.message    = message;
    this.metadata   = metadata || {};
    this.status     = 'queued';
    this.queuedAt   = Date.now();
    this.deliveredAt = null;
    this.dismissedAt = null;
  }
}

// ----------------------------------------------------------------
// INITIALIZE NOTIFICATION RUNTIME
// ----------------------------------------------------------------

export function initializeNotificationRuntime() {
  if (_initialized) {
    NotificationLogger.warn('[NotificationService] Already initialized. Skipping.');
    return;
  }
  _initialized = true;
  NotificationLogger.info('[NotificationService] Notification runtime initialized.');
}

// ----------------------------------------------------------------
// QUEUE NOTIFICATION
// ----------------------------------------------------------------

/**
 * Add a notification to the runtime queue and emit NOTIFICATION_QUEUED.
 * @param {Object} config
 * @param {string} config.type       — NOTIFICATION_TYPE value
 * @param {string} config.message
 * @param {number} [config.priority] — NOTIFICATION_PRIORITY value
 * @param {Object} [config.metadata]
 * @returns {string} notificationId
 */
export async function queueNotification({ type, message, priority = NOTIFICATION_PRIORITY.NORMAL, metadata = {} }) {
  const validation = _validateNotificationConfig({ type, message, priority });
  if (!validation.valid) {
    NotificationLogger.error(
      `[NotificationService] queueNotification invalid: ${validation.errors.join(' | ')}`
    );
    throw new Error(`[NotificationService] ${validation.errors.join(' | ')}`);
  }

  const id     = `notif_${Date.now()}_${++_idCounter}`;
  const record = new NotificationRecord({ id, type, priority, message, metadata });

  _queue.set(id, record);

  await emit(NOTIFICATION_EVENTS.NOTIFICATION_QUEUED, {
    timestamp:      Date.now(),
    notificationId: id,
    type,
    priority,
  });

  NotificationLogger.info(
    `[NotificationService] Notification queued — id: ${id}, type: ${type}, priority: ${priority}`
  );

  return id;
}

// ----------------------------------------------------------------
// DELIVER NOTIFICATION
// ----------------------------------------------------------------

/**
 * Mark a notification as delivered and emit NOTIFICATION_DELIVERED.
 * @param {string} notificationId
 */
export async function deliverNotification(notificationId) {
  const record = _queue.get(notificationId);
  if (!record) {
    NotificationLogger.warn(
      `[NotificationService] deliverNotification: "${notificationId}" not found.`
    );
    return false;
  }

  record.status      = 'delivered';
  record.deliveredAt = Date.now();

  await emit(NOTIFICATION_EVENTS.NOTIFICATION_DELIVERED, {
    timestamp:      Date.now(),
    notificationId,
  });

  NotificationLogger.info(`[NotificationService] Notification delivered — id: ${notificationId}`);
  return true;
}

// ----------------------------------------------------------------
// DISMISS NOTIFICATION
// ----------------------------------------------------------------

/**
 * Dismiss a notification and emit NOTIFICATION_DISMISSED.
 * @param {string} notificationId
 */
export async function dismissNotification(notificationId) {
  const record = _queue.get(notificationId);
  if (!record) {
    NotificationLogger.warn(
      `[NotificationService] dismissNotification: "${notificationId}" not found.`
    );
    return false;
  }

  record.status      = 'dismissed';
  record.dismissedAt = Date.now();
  _queue.delete(notificationId);

  await emit(NOTIFICATION_EVENTS.NOTIFICATION_DISMISSED, {
    timestamp:      Date.now(),
    notificationId,
  });

  NotificationLogger.info(`[NotificationService] Notification dismissed — id: ${notificationId}`);
  return true;
}

// ----------------------------------------------------------------
// GET QUEUE
// ----------------------------------------------------------------

export function getNotificationQueue(filterStatus = null) {
  const all = Array.from(_queue.values());
  if (!filterStatus) return all;
  return all.filter((n) => n.status === filterStatus);
}

export function getNotification(notificationId) {
  return _queue.get(notificationId) || null;
}

export function getQueueLength() {
  return _queue.size;
}

// ----------------------------------------------------------------
// CLEAR QUEUE
// ----------------------------------------------------------------

export function clearNotificationQueue() {
  _queue.clear();
  NotificationLogger.info('[NotificationService] Notification queue cleared.');
}

// ----------------------------------------------------------------
// SERVICE STATUS
// ----------------------------------------------------------------

export function getNotificationServiceStatus() {
  return {
    initialized: _initialized,
    queueLength: _queue.size,
    queued:      getNotificationQueue('queued').length,
    delivered:   getNotificationQueue('delivered').length,
  };
}

// ----------------------------------------------------------------
// INTERNAL VALIDATION
// ----------------------------------------------------------------

function _validateNotificationConfig({ type, message, priority }) {
  const errors = [];
  const validTypes = Object.values(NOTIFICATION_TYPE);
  const validPriorities = Object.values(NOTIFICATION_PRIORITY);

  if (!type || !validTypes.includes(type)) {
    errors.push(`"type" must be one of: ${validTypes.join(', ')}.`);
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    errors.push('"message" must be a non-empty string.');
  }
  if (!validPriorities.includes(priority)) {
    errors.push(`"priority" must be one of: ${validPriorities.join(', ')}.`);
  }

  return { valid: errors.length === 0, errors };
}
