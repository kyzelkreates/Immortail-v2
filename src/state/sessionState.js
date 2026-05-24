// ================================================================
// IMMORTAIL™ — SESSION RESTORATION STATE SYSTEM
// Active session lifecycle, restoration metadata, continuity flags.
// ================================================================

import { SystemLogger } from '../utils/logger.js';
import { STORE_NAMES } from '../storage/schemas.js';

const SessionStateLogger = SystemLogger;

// ----------------------------------------------------------------
// SESSION STATUS CONSTANTS
// ----------------------------------------------------------------

export const SESSION_STATUS = {
  NONE:       'none',
  ACTIVE:     'active',
  RESTORING:  'restoring',
  RESTORED:   'restored',
  INVALIDATED:'invalidated',
  FAILED:     'failed',
};

// ----------------------------------------------------------------
// INITIAL SESSION STATE
// ----------------------------------------------------------------

const INITIAL_SESSION_STATE = {
  sessionId:   null,
  status:      SESSION_STATUS.NONE,

  // Timestamps
  createdAt:      null,
  lastActiveAt:   null,
  restoredAt:     null,
  invalidatedAt:  null,

  // Restoration metadata
  restoration: {
    attempted:      false,
    succeeded:      false,
    failureReason:  null,
    restoredFrom:   null,   // 'storage' | 'fallback' | null
  },

  // Runtime continuity flags
  continuity: {
    hadPreviousSession: false,
    isFirstRun:         true,
    resumedFrom:        null,
  },

  // Recovery checkpoints
  checkpoints: [],

  // Session metadata
  metadata: {},
};

// ----------------------------------------------------------------
// INTERNAL STATE
// ----------------------------------------------------------------

let _sessionState = _deepClone(INITIAL_SESSION_STATE);
let _subscribers  = new Map();
let _idCounter    = 0;

// ----------------------------------------------------------------
// DEEP CLONE
// ----------------------------------------------------------------

function _deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ----------------------------------------------------------------
// GENERATE SESSION ID
// ----------------------------------------------------------------

function _generateSessionId() {
  const timestamp = Date.now().toString(36);
  const random    = Math.random().toString(36).slice(2, 8);
  return `sess_${timestamp}_${random}`;
}

// ----------------------------------------------------------------
// NOTIFY SUBSCRIBERS
// ----------------------------------------------------------------

function _notifySubscribers(prev, next) {
  for (const [id, fn] of _subscribers) {
    try {
      fn(next, prev);
    } catch (err) {
      SessionStateLogger.error(`[SessionState] Subscriber ${id} threw: ${err.message}`);
    }
  }
}

// ----------------------------------------------------------------
// INTERNAL STATE MUTATION
// ----------------------------------------------------------------

function _patchSessionState(patch) {
  const prev = _deepClone(_sessionState);

  _sessionState = {
    ..._sessionState,
    ...patch,
    restoration: {
      ..._sessionState.restoration,
      ...(patch.restoration || {}),
    },
    continuity: {
      ..._sessionState.continuity,
      ...(patch.continuity || {}),
    },
    metadata: {
      ..._sessionState.metadata,
      ...(patch.metadata || {}),
    },
    checkpoints: patch.checkpoints !== undefined
      ? patch.checkpoints
      : _sessionState.checkpoints,
  };

  _notifySubscribers(prev, _deepClone(_sessionState));
}

// ----------------------------------------------------------------
// GET SESSION STATE
// ----------------------------------------------------------------

/**
 * @returns {Object} deep-cloned session state snapshot
 */
export function getSessionState() {
  return _deepClone(_sessionState);
}

// ----------------------------------------------------------------
// CREATE SESSION
// ----------------------------------------------------------------

/**
 * Create a new runtime session.
 * Called at boot when no previous session is restored.
 * @param {Object} [metadata={}]
 * @returns {string} new sessionId
 */
export function createSession(metadata = {}) {
  const sessionId = _generateSessionId();
  const now       = Date.now();

  SessionStateLogger.info(`[SessionState] Creating new session: ${sessionId}`);

  _patchSessionState({
    sessionId,
    status:      SESSION_STATUS.ACTIVE,
    createdAt:   now,
    lastActiveAt: now,
    restoredAt:  null,
    continuity: {
      hadPreviousSession: false,
      isFirstRun:         true,
      resumedFrom:        null,
    },
    restoration: {
      attempted:     false,
      succeeded:     false,
      failureReason: null,
      restoredFrom:  null,
    },
    checkpoints: [],
    metadata,
  });

  return sessionId;
}

// ----------------------------------------------------------------
// RESTORE SESSION
// ----------------------------------------------------------------

/**
 * Restore a session from a persisted storage record.
 * @param {Object} persistedSession — record from storage
 * @returns {{ success: boolean, sessionId: string|null }}
 */
export function restoreSession(persistedSession) {
  SessionStateLogger.info('[SessionState] Attempting session restoration...');

  _patchSessionState({
    status:      SESSION_STATUS.RESTORING,
    restoration: { attempted: true },
  });

  // Validate the persisted session
  if (
    !persistedSession ||
    typeof persistedSession !== 'object' ||
    !persistedSession.id ||
    !persistedSession.startedAt
  ) {
    SessionStateLogger.warn('[SessionState] No valid persisted session — creating fresh session.');

    _patchSessionState({
      status:      SESSION_STATUS.FAILED,
      restoration: {
        attempted:     true,
        succeeded:     false,
        failureReason: 'invalid_persisted_session',
        restoredFrom:  null,
      },
    });

    // Auto-create a fresh session as fallback
    const newId = createSession({ fallback: true });
    return { success: false, sessionId: newId };
  }

  const now = Date.now();

  _patchSessionState({
    sessionId:    persistedSession.id,
    status:       SESSION_STATUS.RESTORED,
    createdAt:    persistedSession.startedAt,
    lastActiveAt: now,
    restoredAt:   now,
    continuity: {
      hadPreviousSession: true,
      isFirstRun:         false,
      resumedFrom:        'storage',
    },
    restoration: {
      attempted:    true,
      succeeded:    true,
      failureReason: null,
      restoredFrom: 'storage',
    },
    metadata: persistedSession.metadata || {},
  });

  SessionStateLogger.info(`[SessionState] Session restored: ${persistedSession.id}`);
  return { success: true, sessionId: persistedSession.id };
}

// ----------------------------------------------------------------
// INVALIDATE SESSION
// ----------------------------------------------------------------

/**
 * Mark the current session as invalidated (e.g. after recovery reset).
 * @param {string} [reason]
 */
export function invalidateSession(reason = 'manual') {
  SessionStateLogger.warn(`[SessionState] Invalidating session. Reason: ${reason}`);

  _patchSessionState({
    status:        SESSION_STATUS.INVALIDATED,
    invalidatedAt: Date.now(),
    metadata: { invalidationReason: reason },
  });
}

// ----------------------------------------------------------------
// ADD CHECKPOINT
// ----------------------------------------------------------------

/**
 * Add a recovery checkpoint to the current session.
 * @param {string} label
 * @param {Object} [data={}]
 */
export function addSessionCheckpoint(label, data = {}) {
  if (!label) return;

  const checkpoint = {
    label,
    timestamp: Date.now(),
    data,
  };

  _patchSessionState({
    checkpoints: [..._sessionState.checkpoints, checkpoint],
  });

  SessionStateLogger.debug(`[SessionState] Checkpoint added: "${label}"`);
}

// ----------------------------------------------------------------
// TOUCH ACTIVE TIMESTAMP
// ----------------------------------------------------------------

export function touchSession() {
  if (!_sessionState.sessionId) return;
  _patchSessionState({ lastActiveAt: Date.now() });
}

// ----------------------------------------------------------------
// SUBSCRIBE
// ----------------------------------------------------------------

/**
 * @param {Function} fn — (nextState, prevState) => void
 * @returns {Function} unsubscribe
 */
export function subscribeToSessionState(fn) {
  if (typeof fn !== 'function') {
    SessionStateLogger.error('[SessionState] Subscriber must be a function.');
    return () => {};
  }

  const id = ++_idCounter;
  _subscribers.set(id, fn);
  SessionStateLogger.debug(`[SessionState] Subscriber added (id: ${id}).`);

  return function unsubscribe() {
    _subscribers.delete(id);
    SessionStateLogger.debug(`[SessionState] Subscriber removed (id: ${id}).`);
  };
}

// ----------------------------------------------------------------
// RESET
// ----------------------------------------------------------------

export function resetSessionState() {
  SessionStateLogger.warn('[SessionState] Resetting session state.');
  const prev = _deepClone(_sessionState);
  _sessionState = _deepClone(INITIAL_SESSION_STATE);
  _notifySubscribers(prev, _deepClone(_sessionState));
}
