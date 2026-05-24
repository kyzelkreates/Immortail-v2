// ================================================================
// IMMORTAIL™ — BEHAVIOR ENGINE (FOUNDATION)
// Behavior state framework, deterministic transitions,
// runtime orchestration. NO AI. NO ANIMATION CONTROL. DATA ONLY.
// ================================================================

import { SystemLogger } from '../utils/logger.js';
import { emit }          from '../events/eventBus.js';
import { DOG_EVENTS }    from '../events/eventTypes.js';

const BehaviorLogger = SystemLogger;

// ----------------------------------------------------------------
// BEHAVIOR STATES
// ----------------------------------------------------------------

export const BEHAVIOR_STATE = {
  IDLE:         'idle',
  ATTENTION:    'attention',
  INTERACTION:  'interaction',
  PLAY:         'play',
  REST:         'rest',
  OBSERVATION:  'observation',
};

// ----------------------------------------------------------------
// ALLOWED BEHAVIOR TRANSITIONS
// Deterministic — no illegal jumps.
// ----------------------------------------------------------------

const ALLOWED_TRANSITIONS = {
  [BEHAVIOR_STATE.IDLE]:        [BEHAVIOR_STATE.ATTENTION, BEHAVIOR_STATE.REST, BEHAVIOR_STATE.OBSERVATION],
  [BEHAVIOR_STATE.ATTENTION]:   [BEHAVIOR_STATE.INTERACTION, BEHAVIOR_STATE.IDLE, BEHAVIOR_STATE.OBSERVATION],
  [BEHAVIOR_STATE.INTERACTION]: [BEHAVIOR_STATE.PLAY, BEHAVIOR_STATE.ATTENTION, BEHAVIOR_STATE.IDLE],
  [BEHAVIOR_STATE.PLAY]:        [BEHAVIOR_STATE.INTERACTION, BEHAVIOR_STATE.REST, BEHAVIOR_STATE.ATTENTION],
  [BEHAVIOR_STATE.REST]:        [BEHAVIOR_STATE.IDLE, BEHAVIOR_STATE.OBSERVATION],
  [BEHAVIOR_STATE.OBSERVATION]: [BEHAVIOR_STATE.ATTENTION, BEHAVIOR_STATE.IDLE, BEHAVIOR_STATE.REST],
};

// Emotion-behavior tendency map: what states a dominant emotion biases toward
const EMOTION_BEHAVIOR_BIAS = {
  joy:      [BEHAVIOR_STATE.PLAY, BEHAVIOR_STATE.INTERACTION],
  calm:     [BEHAVIOR_STATE.REST, BEHAVIOR_STATE.OBSERVATION],
  excited:  [BEHAVIOR_STATE.PLAY, BEHAVIOR_STATE.ATTENTION],
  anxious:  [BEHAVIOR_STATE.OBSERVATION, BEHAVIOR_STATE.REST],
  trusting: [BEHAVIOR_STATE.INTERACTION, BEHAVIOR_STATE.ATTENTION],
  attached: [BEHAVIOR_STATE.ATTENTION, BEHAVIOR_STATE.INTERACTION],
  stressed: [BEHAVIOR_STATE.REST, BEHAVIOR_STATE.IDLE],
  neutral:  [BEHAVIOR_STATE.IDLE, BEHAVIOR_STATE.OBSERVATION],
};

// ----------------------------------------------------------------
// INTERNAL STATE
// ----------------------------------------------------------------

/** @type {Map<string, BehaviorProfile>} profileId → profile */
const _profiles = new Map();

class BehaviorProfile {
  constructor(profileId) {
    this.profileId       = profileId;
    this.currentState    = BEHAVIOR_STATE.IDLE;
    this.previousState   = null;
    this.enteredAt       = Date.now();
    this.transitionCount = 0;
    this.stateHistory    = [];
    this.interactionReady = true;
    this.updatedAt       = Date.now();
  }
}

// ----------------------------------------------------------------
// INITIALIZE BEHAVIOR STATE
// ----------------------------------------------------------------

/**
 * @param {string} profileId
 * @param {string} [initialState] — BEHAVIOR_STATE value
 * @returns {Object} behavior snapshot
 */
export function initializeBehaviorState(profileId, initialState = BEHAVIOR_STATE.IDLE) {
  if (!profileId || typeof profileId !== 'string') {
    throw new BehaviorError('[BehaviorEngine] initializeBehaviorState: profileId required.');
  }

  if (_profiles.has(profileId)) {
    BehaviorLogger.warn(`[BehaviorEngine] Profile "${profileId}" already initialized.`);
    return getBehaviorSnapshot(profileId);
  }

  if (!Object.values(BEHAVIOR_STATE).includes(initialState)) {
    throw new BehaviorError(
      `[BehaviorEngine] Invalid initial state: "${initialState}". ` +
      `Valid: ${Object.values(BEHAVIOR_STATE).join(', ')}.`
    );
  }

  const profile = new BehaviorProfile(profileId);
  profile.currentState = initialState;

  _profiles.set(profileId, profile);

  BehaviorLogger.info(
    `[BehaviorEngine] Behavior state initialized — profileId: ${profileId}, state: ${initialState}`
  );

  return getBehaviorSnapshot(profileId);
}

// ----------------------------------------------------------------
// TRANSITION BEHAVIOR STATE
// ----------------------------------------------------------------

/**
 * Transition the companion to a new behavior state.
 * Validates against allowed transitions and emits event.
 * @param {string} profileId
 * @param {string} targetState  — BEHAVIOR_STATE value
 * @param {string} [trigger]
 * @returns {Promise<Object>} updated snapshot
 */
export async function transitionBehaviorState(profileId, targetState, trigger = 'manual') {
  const profile = _requireProfile(profileId);

  const validation = validateBehaviorTransition(profile.currentState, targetState);
  if (!validation.valid) {
    throw new BehaviorError(
      `[BehaviorEngine] Transition blocked for "${profileId}": ${validation.errors.join(' | ')}`
    );
  }

  const prev           = profile.currentState;
  profile.previousState = prev;
  profile.currentState  = targetState;
  profile.enteredAt     = Date.now();
  profile.updatedAt     = Date.now();
  profile.transitionCount++;

  profile.stateHistory.push({
    from:      prev,
    to:        targetState,
    trigger,
    timestamp: Date.now(),
  });
  if (profile.stateHistory.length > 100) profile.stateHistory.shift();

  // Update interaction readiness
  profile.interactionReady = [
    BEHAVIOR_STATE.IDLE,
    BEHAVIOR_STATE.ATTENTION,
    BEHAVIOR_STATE.INTERACTION,
  ].includes(targetState);

  BehaviorLogger.info(
    `[BehaviorEngine] Behavior transition — "${profileId}": ${prev} → ${targetState} (trigger: ${trigger})`
  );

  await emit(DOG_EVENTS.DOG_RUNTIME_CHANGED, {
    timestamp: Date.now(),
    dogId:     profileId,
    mode:      targetState,
  });

  return getBehaviorSnapshot(profileId);
}

// ----------------------------------------------------------------
// VALIDATE BEHAVIOR TRANSITION
// ----------------------------------------------------------------

/**
 * @param {string} fromState
 * @param {string} toState
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateBehaviorTransition(fromState, toState) {
  const errors = [];
  const validStates = Object.values(BEHAVIOR_STATE);

  if (!validStates.includes(fromState)) {
    errors.push(`Unknown source state: "${fromState}".`);
  }
  if (!validStates.includes(toState)) {
    errors.push(`Unknown target state: "${toState}".`);
  }

  if (errors.length === 0) {
    const allowed = ALLOWED_TRANSITIONS[fromState] || [];
    if (!allowed.includes(toState)) {
      errors.push(
        `Transition "${fromState}" → "${toState}" is not allowed. ` +
        `Valid from "${fromState}": [${allowed.join(', ')}].`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

// ----------------------------------------------------------------
// GET SUGGESTED STATE FROM EMOTION
// ----------------------------------------------------------------

/**
 * Return behavior states biased by the companion's current dominant emotion.
 * Does NOT automatically transition — returns suggestions only.
 * @param {string} dominantEmotion
 * @returns {string[]} ordered behavior state suggestions
 */
export function getSuggestedBehaviorStates(dominantEmotion) {
  return EMOTION_BEHAVIOR_BIAS[dominantEmotion] || [BEHAVIOR_STATE.IDLE];
}

// ----------------------------------------------------------------
// GET BEHAVIOR SNAPSHOT
// ----------------------------------------------------------------

/**
 * @param {string} profileId
 * @returns {Object}
 */
export function getBehaviorSnapshot(profileId) {
  const profile = _requireProfile(profileId);
  return {
    profileId:        profile.profileId,
    currentState:     profile.currentState,
    previousState:    profile.previousState,
    interactionReady: profile.interactionReady,
    transitionCount:  profile.transitionCount,
    enteredAt:        profile.enteredAt,
    updatedAt:        profile.updatedAt,
    allowedTransitions: ALLOWED_TRANSITIONS[profile.currentState] || [],
  };
}

// ----------------------------------------------------------------
// RESTORE FROM PERSISTENCE
// ----------------------------------------------------------------

export function restoreBehaviorState(persistedProfile) {
  if (!persistedProfile?.profileId) {
    throw new BehaviorError('[BehaviorEngine] restoreBehaviorState: invalid record.');
  }

  const { profileId, currentState, transitionCount } = persistedProfile;
  const validStates = Object.values(BEHAVIOR_STATE);

  const profile = new BehaviorProfile(profileId);
  profile.currentState    = validStates.includes(currentState) ? currentState : BEHAVIOR_STATE.IDLE;
  profile.transitionCount = transitionCount || 0;
  profile.interactionReady = [
    BEHAVIOR_STATE.IDLE, BEHAVIOR_STATE.ATTENTION, BEHAVIOR_STATE.INTERACTION
  ].includes(profile.currentState);

  _profiles.set(profileId, profile);

  BehaviorLogger.info(
    `[BehaviorEngine] Behavior state restored — profileId: ${profileId}, state: ${profile.currentState}`
  );
  return getBehaviorSnapshot(profileId);
}

// ----------------------------------------------------------------
// ENGINE STATUS
// ----------------------------------------------------------------

export function getBehaviorEngineStatus() {
  return {
    totalProfiles: _profiles.size,
    profileIds:    Array.from(_profiles.keys()),
  };
}

// ----------------------------------------------------------------
// INTERNAL: Require profile or throw
// ----------------------------------------------------------------

function _requireProfile(profileId) {
  const profile = _profiles.get(profileId);
  if (!profile) {
    throw new BehaviorError(
      `[BehaviorEngine] Profile "${profileId}" not found. Call initializeBehaviorState() first.`
    );
  }
  return profile;
}

// ----------------------------------------------------------------
// BEHAVIOR ERROR
// ----------------------------------------------------------------

export class BehaviorError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name      = 'BehaviorError';
    this.context   = context;
    this.timestamp = Date.now();
  }
}
