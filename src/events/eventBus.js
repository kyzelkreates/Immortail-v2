// ================================================================
// IMMORTAIL™ — CENTRAL EVENT BUS (Event Unification Patch)
// SSOT: All cross-system communication flows through here.
// All event types normalized to canonical namespace via eventBridge.
// NO BUSINESS LOGIC. NO STORAGE ACCESS. NO STATE MUTATION.
// ================================================================

import { SystemLogger }                       from '../utils/logger.js';
import { isKnownEvent }                       from './eventTypes.js';
import { validateEventPayload, findEventContract } from './eventRegistry.js';
import { normalizeEventType }                 from './eventBridge.js';

const BusLogger = SystemLogger;

// ----------------------------------------------------------------
// CONFIGURATION
// ----------------------------------------------------------------

const CONFIG = {
  debugMode:       false,
  maxListeners:    50,    // per event type
  historySize:     100,   // emission history buffer
  warnOnNoListeners: false,
};

// ----------------------------------------------------------------
// INTERNAL BUS STATE
// ----------------------------------------------------------------

/** Map<eventType, Map<listenerId, ListenerEntry>> */
const _listeners = new Map();

/** Set<string> — one-time listener IDs pending removal */
const _onceIds = new Set();

/** Emission history ring buffer */
const _history = [];

let _listenerIdCounter = 0;
let _initialized       = false;

// ----------------------------------------------------------------
// LISTENER ENTRY
// ----------------------------------------------------------------

class ListenerEntry {
  constructor(id, eventType, fn, once, subscriberId) {
    this.id           = id;
    this.eventType    = eventType;
    this.fn           = fn;
    this.once         = once;
    this.subscriberId = subscriberId || `anonymous_${id}`;
    this.registeredAt = Date.now();
    this.callCount    = 0;
  }
}

// ----------------------------------------------------------------
// INITIALIZE EVENT BUS
// ----------------------------------------------------------------

export function initializeEventBus(options = {}) {
  if (_initialized) {
    BusLogger.warn('[EventBus] Already initialized. Skipping.');
    return;
  }

  if (options.debugMode !== undefined) CONFIG.debugMode = options.debugMode;

  _initialized = true;
  BusLogger.info('[EventBus] Event bus initialized.');
}

// ----------------------------------------------------------------
// SUBSCRIBE
// ----------------------------------------------------------------

/**
 * Subscribe to an event type.
 * @param {string}   eventType   — must be a registered event string
 * @param {Function} fn          — listener function (payload) => void|Promise
 * @param {Object}   [options]
 * @param {string}   [options.subscriberId] — human-readable ID for debugging
 * @returns {Function} unsubscribe function
 */
export function subscribe(eventType, fn, options = {}) {
  eventType = normalizeEventType(eventType);
  _assertKnown(eventType);
  _assertFunction(fn, 'subscribe');
  _assertInitialized();

  // Prevent exceeding max listeners per event
  const eventListeners = _getOrCreateListenerMap(eventType);
  if (eventListeners.size >= CONFIG.maxListeners) {
    BusLogger.warn(
      `[EventBus] Max listeners (${CONFIG.maxListeners}) reached for "${eventType}". ` +
      `Listener for "${options.subscriberId || 'anonymous'}" not added.`
    );
    return () => {};
  }

  const id    = ++_listenerIdCounter;
  const entry = new ListenerEntry(id, eventType, fn, false, options.subscriberId);

  eventListeners.set(id, entry);

  if (CONFIG.debugMode) {
    BusLogger.debug(
      `[EventBus] Subscribed to "${eventType}" (id: ${id}, subscriber: ${entry.subscriberId}). ` +
      `Total: ${eventListeners.size}`
    );
  }

  return function unsubscribe() {
    _removeListener(eventType, id);
  };
}

// ----------------------------------------------------------------
// UNSUBSCRIBE (by return value of subscribe)
// subscribe() returns the unsubscribe fn directly — this is the
// manual form for cases where the ID is tracked externally.
// ----------------------------------------------------------------

export function unsubscribe(eventType, listenerId) {
  _removeListener(eventType, listenerId);
}

// ----------------------------------------------------------------
// ONCE
// ----------------------------------------------------------------

/**
 * Subscribe for a single emission only. Auto-removes after first call.
 * @param {string}   eventType
 * @param {Function} fn
 * @param {Object}   [options]
 * @returns {Function} unsubscribe (if you want to cancel early)
 */
export function once(eventType, fn, options = {}) {
  eventType = normalizeEventType(eventType);
  _assertKnown(eventType);
  _assertFunction(fn, 'once');
  _assertInitialized();

  const eventListeners = _getOrCreateListenerMap(eventType);

  const id    = ++_listenerIdCounter;
  const entry = new ListenerEntry(id, eventType, fn, true, options.subscriberId);

  eventListeners.set(id, entry);
  _onceIds.add(id);

  if (CONFIG.debugMode) {
    BusLogger.debug(`[EventBus] once() registered for "${eventType}" (id: ${id}).`);
  }

  return function unsubscribe() {
    _removeListener(eventType, id);
    _onceIds.delete(id);
  };
}

// ----------------------------------------------------------------
// EMIT
// ----------------------------------------------------------------

/**
 * Emit an event to all subscribers.
 * Payload is validated against the registered contract (if any).
 * Async listeners are executed concurrently.
 * @param {string} eventType
 * @param {Object} payload
 * @returns {Promise<void>}
 */
export async function emit(eventType, payload = {}) {
  eventType = normalizeEventType(eventType);
  _assertKnown(eventType);
  _assertInitialized();

  // Stamp timestamp if not present
  const stamped = { ...payload, timestamp: payload.timestamp ?? Date.now() };

  // Validate against contract
  const contract = findEventContract(eventType);
  if (contract) {
    const validation = validateEventPayload(eventType, stamped);
    if (!validation.valid) {
      BusLogger.error(
        `[EventBus] Payload validation FAILED for "${eventType}": ${validation.errors.join(' | ')}. ` +
        `Emission blocked.`
      );
      return;
    }
  } else {
    BusLogger.warn(`[EventBus] No contract registered for "${eventType}". Emitting without validation.`);
  }

  // Record in history
  _recordHistory(eventType, stamped);

  const eventListeners = _listeners.get(eventType);

  if (!eventListeners || eventListeners.size === 0) {
    if (CONFIG.warnOnNoListeners) {
      BusLogger.warn(`[EventBus] No listeners for "${eventType}".`);
    }
    return;
  }

  if (CONFIG.debugMode) {
    BusLogger.debug(
      `[EventBus] Emitting "${eventType}" to ${eventListeners.size} listener(s).`, stamped
    );
  }

  // Collect once-IDs to remove after this tick
  const toRemove = [];

  // Execute all listeners (concurrently for async safety)
  const promises = [];

  for (const [id, entry] of eventListeners) {
    entry.callCount++;

    if (entry.once) {
      toRemove.push(id);
    }

    promises.push(
      Promise.resolve()
        .then(() => entry.fn(stamped))
        .catch((err) => {
          BusLogger.error(
            `[EventBus] Listener error (id: ${id}, subscriber: ${entry.subscriberId}) ` +
            `for "${eventType}": ${err.message}`
          );
        })
    );
  }

  await Promise.all(promises);

  // Clean up once listeners
  for (const id of toRemove) {
    _removeListener(eventType, id);
    _onceIds.delete(id);
  }
}

// ----------------------------------------------------------------
// EMIT SYNC (fire-and-forget, no await)
// ----------------------------------------------------------------

/**
 * Fire-and-forget emission. Errors are caught and logged.
 * Prefer emit() for async workflows.
 */
export function emitSync(eventType, payload = {}) {
  emit(eventType, payload).catch((err) => {
    BusLogger.error(`[EventBus] emitSync error for "${eventType}": ${err.message}`);
  });
}

// ----------------------------------------------------------------
// CLEAR LISTENERS
// ----------------------------------------------------------------

/**
 * Remove all listeners for a specific event type, or all events.
 * @param {string} [eventType] — if omitted, clears ALL listeners
 */
export function clearListeners(eventType) {
  if (eventType) {
    eventType = normalizeEventType(eventType);
    _assertKnown(eventType);
    const map = _listeners.get(eventType);
    if (map) {
      map.clear();
      BusLogger.info(`[EventBus] All listeners cleared for "${eventType}".`);
    }
  } else {
    _listeners.clear();
    _onceIds.clear();
    BusLogger.warn('[EventBus] ALL listeners cleared.');
  }
}

// ----------------------------------------------------------------
// DEBUGGING
// ----------------------------------------------------------------

/**
 * Enable or disable debug logging.
 */
export function setDebugMode(enabled) {
  CONFIG.debugMode = !!enabled;
  BusLogger.info(`[EventBus] Debug mode: ${CONFIG.debugMode ? 'ON' : 'OFF'}`);
}

/**
 * Get current subscription counts per event type.
 */
export function getSubscriberReport() {
  const report = {};
  for (const [eventType, map] of _listeners) {
    report[eventType] = {
      count:       map.size,
      subscribers: Array.from(map.values()).map((e) => ({
        id:           e.id,
        subscriberId: e.subscriberId,
        once:         e.once,
        callCount:    e.callCount,
      })),
    };
  }
  return report;
}

/**
 * Get emission history (last N events).
 * @param {number} [limit=20]
 */
export function getEmissionHistory(limit = 20) {
  return _history.slice(-limit);
}

/**
 * Inspect the payload of the last emission of a given type.
 */
export function getLastEmission(eventType) {
  for (let i = _history.length - 1; i >= 0; i--) {
    if (_history[i].eventType === eventType) return _history[i];
  }
  return null;
}

/**
 * Returns total listeners across all event types.
 */
export function getTotalListenerCount() {
  let count = 0;
  for (const map of _listeners.values()) count += map.size;
  return count;
}

export function isInitialized() {
  return _initialized;
}

// ----------------------------------------------------------------
// INTERNAL HELPERS
// ----------------------------------------------------------------

function _getOrCreateListenerMap(eventType) {
  if (!_listeners.has(eventType)) {
    _listeners.set(eventType, new Map());
  }
  return _listeners.get(eventType);
}

function _removeListener(eventType, id) {
  const map = _listeners.get(eventType);
  if (!map) return;
  const deleted = map.delete(id);
  if (deleted && CONFIG.debugMode) {
    BusLogger.debug(`[EventBus] Listener removed (id: ${id}) from "${eventType}". Remaining: ${map.size}`);
  }
}

function _recordHistory(eventType, payload) {
  _history.push({
    eventType,
    payload,
    emittedAt: Date.now(),
  });
  // Trim to max history size
  if (_history.length > CONFIG.historySize) {
    _history.shift();
  }
}

function _assertKnown(eventType) {
  if (!isKnownEvent(eventType)) {
    throw new Error(
      `[EventBus] Unknown event type: "${eventType}". Register in eventTypes.js first.`
    );
  }
}

function _assertFunction(fn, context) {
  if (typeof fn !== 'function') {
    throw new Error(`[EventBus] ${context}: listener must be a function.`);
  }
}

function _assertInitialized() {
  if (!_initialized) {
    throw new Error('[EventBus] Event bus not initialized. Call initializeEventBus() first.');
  }
}
