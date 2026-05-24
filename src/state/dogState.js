// ================================================================
// IMMORTAIL™ — COMPANION STATE CONTAINER (FOUNDATION)
// Runtime dog state structure. Hydration-compatible container.
// NO PERSONALITY ENGINE. NO BEHAVIORS. NO AI EXECUTION.
// FOUNDATION ONLY — structure and synchronization safety only.
// ================================================================

import { SystemLogger } from '../utils/logger.js';

const DogStateLogger = SystemLogger;

// ----------------------------------------------------------------
// INITIAL DOG STATE
// ----------------------------------------------------------------

const INITIAL_DOG_STATE = {
  // Identity profile reference (populated by hydration)
  profileId:   null,
  profileName: null,
  profileLoaded: false,

  // Runtime emotional snapshot (populated by future emotion engine)
  emotion: {
    current:    null,
    intensity:  0,
    recordedAt: null,
  },

  // Runtime animation snapshot (populated by future animation engine)
  animation: {
    currentClip:  null,
    isPlaying:    false,
    looping:      false,
    startedAt:    null,
  },

  // Active state metadata
  activeState: {
    mode:        'idle',    // idle | active | sleeping | interacting
    lastActiveAt: null,
    isOnline:    false,
  },

  // Hydration tracking
  hydrated:    false,
  hydratedAt:  null,

  // Runtime synchronization flags
  sync: {
    isDirty:     false,
    lastSyncAt:  null,
    pendingSync: false,
  },
};

// ----------------------------------------------------------------
// INTERNAL STATE
// ----------------------------------------------------------------

let _dogState    = _deepClone(INITIAL_DOG_STATE);
let _subscribers = new Map();
let _idCounter   = 0;

// ----------------------------------------------------------------
// DEEP CLONE
// ----------------------------------------------------------------

function _deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ----------------------------------------------------------------
// NOTIFY SUBSCRIBERS
// ----------------------------------------------------------------

function _notifySubscribers(prev, next) {
  for (const [id, fn] of _subscribers) {
    try {
      fn(next, prev);
    } catch (err) {
      DogStateLogger.error(`[DogState] Subscriber ${id} threw: ${err.message}`);
    }
  }
}

// ----------------------------------------------------------------
// GET DOG STATE
// ----------------------------------------------------------------

/**
 * Returns a deep-cloned snapshot of dog state.
 * @returns {Object}
 */
export function getDogState() {
  return _deepClone(_dogState);
}

// ----------------------------------------------------------------
// UPDATE DOG STATE
// ----------------------------------------------------------------

/**
 * Immutable-safe patch. Triggers subscribers.
 * @param {Object} patch
 */
export function updateDogState(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    DogStateLogger.error('[DogState] updateDogState: patch must be a plain object.');
    return;
  }

  const prev = _deepClone(_dogState);

  _dogState = {
    ..._dogState,
    ...patch,
    emotion: {
      ..._dogState.emotion,
      ...(patch.emotion || {}),
    },
    animation: {
      ..._dogState.animation,
      ...(patch.animation || {}),
    },
    activeState: {
      ..._dogState.activeState,
      ...(patch.activeState || {}),
    },
    sync: {
      ..._dogState.sync,
      ...(patch.sync || {}),
    },
  };

  DogStateLogger.debug('[DogState] Dog state updated.');
  _notifySubscribers(prev, _deepClone(_dogState));
}

// ----------------------------------------------------------------
// SUBSCRIBE TO DOG STATE
// ----------------------------------------------------------------

/**
 * @param {Function} fn — (nextState, prevState) => void
 * @returns {Function} unsubscribe
 */
export function subscribeToDogState(fn) {
  if (typeof fn !== 'function') {
    DogStateLogger.error('[DogState] Subscriber must be a function.');
    return () => {};
  }

  const id = ++_idCounter;
  _subscribers.set(id, fn);
  DogStateLogger.debug(`[DogState] Subscriber added (id: ${id}). Total: ${_subscribers.size}`);

  return function unsubscribe() {
    _subscribers.delete(id);
    DogStateLogger.debug(`[DogState] Subscriber removed (id: ${id}).`);
  };
}

// ----------------------------------------------------------------
// HYDRATE DOG STATE
// Called by hydration system only — not by UI or components.
// ----------------------------------------------------------------

/**
 * Load a persisted dog profile snapshot into runtime dog state.
 * @param {Object} profileSnapshot — from storageService
 */
export function hydrateDogState(profileSnapshot) {
  if (!profileSnapshot || typeof profileSnapshot !== 'object') {
    DogStateLogger.warn('[DogState] hydrateDogState: no valid snapshot provided. Using defaults.');
    updateDogState({ hydrated: true, hydratedAt: Date.now() });
    return;
  }

  DogStateLogger.info(`[DogState] Hydrating dog state — profileId: ${profileSnapshot.id}`);

  updateDogState({
    profileId:     profileSnapshot.id     || null,
    profileName:   profileSnapshot.name   || null,
    profileLoaded: true,
    hydrated:      true,
    hydratedAt:    Date.now(),
  });
}

// ----------------------------------------------------------------
// RESET DOG STATE
// ----------------------------------------------------------------

export function resetDogState() {
  DogStateLogger.warn('[DogState] Resetting dog state to initial values.');
  const prev = _deepClone(_dogState);
  _dogState = _deepClone(INITIAL_DOG_STATE);
  _notifySubscribers(prev, _deepClone(_dogState));
}

// ----------------------------------------------------------------
// MARK SYNC
// ----------------------------------------------------------------

export function markDogStateSynced() {
  updateDogState({
    sync: { isDirty: false, lastSyncAt: Date.now(), pendingSync: false },
  });
}

export function markDogStateDirty() {
  updateDogState({
    sync: { isDirty: true, pendingSync: true },
  });
}
