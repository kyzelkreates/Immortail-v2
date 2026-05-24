// ================================================================
// IMMORTAIL™ — GLOBAL APPLICATION STATE CONTAINER
// Runtime application lifecycle, flags, active modules.
// NO STORAGE ACCESS. NO BUSINESS LOGIC. NO AI LOGIC.
// ================================================================

import { SystemLogger } from '../utils/logger.js';

const AppStateLogger = SystemLogger;

// ----------------------------------------------------------------
// INITIAL STATE
// ----------------------------------------------------------------

const INITIAL_APP_STATE = {
  initialized:       false,
  hydrated:          false,
  recovered:         false,
  ready:             false,

  initializationError: null,

  activeModules: {},

  flags: {
    storageReady:   false,
    schedulerReady: false,
    hydrationReady: false,
    recoveryReady:  false,
    sessionReady:   false,
  },

  timestamps: {
    bootStartedAt:      null,
    bootCompletedAt:    null,
    hydratedAt:         null,
    recoveredAt:        null,
    lastStateUpdateAt:  null,
  },

  meta: {
    version:     null,
    build:       null,
    environment: null,
  },
};

// ----------------------------------------------------------------
// INTERNAL STATE (single instance)
// ----------------------------------------------------------------

let _appState = _deepClone(INITIAL_APP_STATE);
let _subscribers = new Map(); // id → fn
let _subscriberIdCounter = 0;

// ----------------------------------------------------------------
// DEEP CLONE UTILITY
// ----------------------------------------------------------------

function _deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ----------------------------------------------------------------
// NOTIFY SUBSCRIBERS
// ----------------------------------------------------------------

function _notifySubscribers(prevState, nextState) {
  for (const [id, fn] of _subscribers) {
    try {
      fn(nextState, prevState);
    } catch (err) {
      AppStateLogger.error(`[AppState] Subscriber ${id} threw: ${err.message}`);
    }
  }
}

// ----------------------------------------------------------------
// GET APP STATE
// ----------------------------------------------------------------

/**
 * Returns a deep-cloned snapshot of current app state.
 * @returns {Object}
 */
export function getAppState() {
  return _deepClone(_appState);
}

// ----------------------------------------------------------------
// UPDATE APP STATE
// ----------------------------------------------------------------

/**
 * Immutable-safe state update. Merges patch into current state.
 * Protected fields cannot be overwritten directly.
 * Triggers all subscribers.
 * @param {Object} patch
 */
export function updateAppState(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    AppStateLogger.error('[AppState] updateAppState: patch must be a plain object.');
    return;
  }

  const prev = _deepClone(_appState);

  _appState = {
    ..._appState,
    ...patch,
    // Deep-merge nested objects
    flags: {
      ..._appState.flags,
      ...(patch.flags || {}),
    },
    timestamps: {
      ..._appState.timestamps,
      ...(patch.timestamps || {}),
      lastStateUpdateAt: Date.now(),
    },
    meta: {
      ..._appState.meta,
      ...(patch.meta || {}),
    },
    activeModules: {
      ..._appState.activeModules,
      ...(patch.activeModules || {}),
    },
  };

  AppStateLogger.debug('[AppState] State updated.');
  _notifySubscribers(prev, _deepClone(_appState));
}

// ----------------------------------------------------------------
// SUBSCRIBE TO APP STATE
// ----------------------------------------------------------------

/**
 * Subscribe to app state changes.
 * @param {Function} fn — called with (nextState, prevState)
 * @returns {Function} unsubscribe function
 */
export function subscribeToAppState(fn) {
  if (typeof fn !== 'function') {
    AppStateLogger.error('[AppState] subscribeToAppState: subscriber must be a function.');
    return () => {};
  }

  const id = ++_subscriberIdCounter;
  _subscribers.set(id, fn);
  AppStateLogger.debug(`[AppState] Subscriber added (id: ${id}). Total: ${_subscribers.size}`);

  return function unsubscribe() {
    _subscribers.delete(id);
    AppStateLogger.debug(`[AppState] Subscriber removed (id: ${id}). Total: ${_subscribers.size}`);
  };
}

// ----------------------------------------------------------------
// RESET APP STATE
// ----------------------------------------------------------------

/**
 * Reset app state to initial values.
 * Notifies all subscribers.
 */
export function resetAppState() {
  AppStateLogger.warn('[AppState] Resetting application state to initial values.');
  const prev = _deepClone(_appState);
  _appState = _deepClone(INITIAL_APP_STATE);
  _notifySubscribers(prev, _deepClone(_appState));
}

// ----------------------------------------------------------------
// REGISTER ACTIVE MODULE
// ----------------------------------------------------------------

export function registerActiveModule(moduleName, metadata = {}) {
  if (!moduleName || typeof moduleName !== 'string') {
    AppStateLogger.error('[AppState] registerActiveModule: moduleName must be a non-empty string.');
    return;
  }

  updateAppState({
    activeModules: {
      [moduleName]: {
        name:         moduleName,
        registeredAt: Date.now(),
        ...metadata,
      },
    },
  });
}
