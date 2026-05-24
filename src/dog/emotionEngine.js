// ================================================================
// IMMORTAIL™ — EMOTION ENGINE (FOUNDATION)
// Runtime emotional state, deterministic transitions, decay/recovery.
// NO AI INFERENCE. NO RENDERING. DATA + SYNCHRONIZATION ONLY.
// ================================================================

import { SystemLogger }   from '../utils/logger.js';
import { emit }            from '../events/eventBus.js';
import { EMOTION_EVENTS }  from '../events/eventTypes.js';

const EmotionLogger = SystemLogger;

// ----------------------------------------------------------------
// EMOTION DIMENSION KEYS
// All values bounded to [0.0, 1.0]
// ----------------------------------------------------------------

export const EMOTION_DIM = {
  HAPPINESS:  'happiness',
  COMFORT:    'comfort',
  EXCITEMENT: 'excitement',
  ANXIETY:    'anxiety',
  TRUST:      'trust',
  ATTACHMENT: 'attachment',
  STRESS:     'stress',
  CALMNESS:   'calmness',
};

// ----------------------------------------------------------------
// DOMINANT EMOTION LABELS
// Derived from the emotional state vector — no direct assignment.
// ----------------------------------------------------------------

export const DOMINANT_EMOTION = {
  JOY:       'joy',
  CALM:      'calm',
  EXCITED:   'excited',
  ANXIOUS:   'anxious',
  TRUSTING:  'trusting',
  ATTACHED:  'attached',
  STRESSED:  'stressed',
  NEUTRAL:   'neutral',
};

// ----------------------------------------------------------------
// BOUNDS + DEFAULTS
// ----------------------------------------------------------------

const EMOTION_MIN        = 0.0;
const EMOTION_MAX        = 1.0;
const DECAY_RATE_DEFAULT = 0.005;   // per regulation tick
const RECOVERY_RATE      = 0.003;

const DEFAULT_EMOTION_STATE = {
  [EMOTION_DIM.HAPPINESS]:  0.5,
  [EMOTION_DIM.COMFORT]:    0.5,
  [EMOTION_DIM.EXCITEMENT]: 0.3,
  [EMOTION_DIM.ANXIETY]:    0.1,
  [EMOTION_DIM.TRUST]:      0.5,
  [EMOTION_DIM.ATTACHMENT]: 0.4,
  [EMOTION_DIM.STRESS]:     0.1,
  [EMOTION_DIM.CALMNESS]:   0.6,
};

// Antagonist pairs — raising one applies gentle pressure on the other
const ANTAGONIST_PAIRS = [
  [EMOTION_DIM.ANXIETY,    EMOTION_DIM.CALMNESS],
  [EMOTION_DIM.STRESS,     EMOTION_DIM.HAPPINESS],
  [EMOTION_DIM.EXCITEMENT, EMOTION_DIM.CALMNESS],
];

// ----------------------------------------------------------------
// INTERNAL STATE
// ----------------------------------------------------------------

/** @type {Map<string, EmotionState>} profileId → state */
const _states = new Map();

class EmotionState {
  constructor(profileId, dimensions = {}) {
    this.profileId      = profileId;
    this.dimensions     = { ...DEFAULT_EMOTION_STATE, ...dimensions };
    this.dominantEmotion = DOMINANT_EMOTION.NEUTRAL;
    this.transitionLog  = [];
    this.decayRate      = DECAY_RATE_DEFAULT;
    this.createdAt      = Date.now();
    this.updatedAt      = Date.now();
    this.version        = 1;
  }
}

// ----------------------------------------------------------------
// INITIALIZE EMOTION STATE
// ----------------------------------------------------------------

/**
 * Initialize emotion state for a companion profile.
 * @param {string} profileId
 * @param {Object} [initialDimensions]
 * @returns {Object} emotion snapshot
 */
export function initializeEmotionState(profileId, initialDimensions = {}) {
  if (!profileId || typeof profileId !== 'string') {
    throw new EmotionError('[EmotionEngine] initializeEmotionState: profileId required.');
  }

  if (_states.has(profileId)) {
    EmotionLogger.warn(`[EmotionEngine] State for "${profileId}" already exists. Returning current.`);
    return getEmotionSnapshot(profileId);
  }

  const clamped = _clampDimensions(initialDimensions);
  const state   = new EmotionState(profileId, clamped);
  state.dominantEmotion = _deriveDominant(state.dimensions);

  _states.set(profileId, state);

  EmotionLogger.info(`[EmotionEngine] Emotion state initialized — profileId: ${profileId}`);
  return getEmotionSnapshot(profileId);
}

// ----------------------------------------------------------------
// UPDATE EMOTION STATE
// ----------------------------------------------------------------

/**
 * Apply a deterministic delta to one or more emotion dimensions.
 * Automatically handles antagonist pressure and emits event.
 * @param {string} profileId
 * @param {Object} deltas      — { [EMOTION_DIM]: number } — additive deltas
 * @param {string} [trigger]   — semantic trigger label
 * @returns {Promise<Object>}  updated snapshot
 */
export async function updateEmotionState(profileId, deltas, trigger = 'manual') {
  const state = _requireState(profileId);

  if (!deltas || typeof deltas !== 'object') {
    throw new EmotionError('[EmotionEngine] updateEmotionState: deltas must be an object.');
  }

  const validation = _validateDeltas(deltas);
  if (!validation.valid) {
    throw new EmotionError(
      `[EmotionEngine] updateEmotionState validation failed: ${validation.errors.join(' | ')}`
    );
  }

  const prev = { ...state.dimensions };

  // Apply deltas with clamping
  for (const [dim, delta] of Object.entries(deltas)) {
    if (dim in state.dimensions && typeof delta === 'number') {
      state.dimensions[dim] = _clamp(state.dimensions[dim] + delta);
    }
  }

  // Apply antagonist pressure
  _applyAntagonistPressure(state.dimensions);

  state.dominantEmotion = _deriveDominant(state.dimensions);
  state.updatedAt       = Date.now();
  state.version++;

  // Log transition
  state.transitionLog.push({
    version:  state.version,
    trigger,
    deltas,
    dominant: state.dominantEmotion,
    timestamp: Date.now(),
  });
  if (state.transitionLog.length > 200) state.transitionLog.shift();

  EmotionLogger.debug(
    `[EmotionEngine] Emotion updated — profileId: ${profileId}, dominant: ${state.dominantEmotion}`
  );

  const snap = getEmotionSnapshot(profileId);

  await emit(EMOTION_EVENTS.EMOTION_CHANGED, {
    timestamp:   Date.now(),
    profileId,
    emotionType: state.dominantEmotion,
    intensity:   _dominantIntensity(state.dimensions),
  });

  return snap;
}

// ----------------------------------------------------------------
// REGULATE EMOTION LEVELS
// ----------------------------------------------------------------

/**
 * Apply natural decay/recovery to emotion dimensions.
 * Excited/anxious/stressed decay toward neutral; comfort/happiness recover gently.
 * Called periodically by the scheduler — no external trigger needed.
 * @param {string} profileId
 * @returns {Object} snapshot after regulation
 */
export async function regulateEmotionLevels(profileId) {
  const state = _requireState(profileId);
  const rate  = state.decayRate;

  // Dimensions that decay toward lower values
  const decayTargets = [EMOTION_DIM.EXCITEMENT, EMOTION_DIM.ANXIETY, EMOTION_DIM.STRESS];
  for (const dim of decayTargets) {
    if (state.dimensions[dim] > 0) {
      state.dimensions[dim] = _clamp(state.dimensions[dim] - rate);
    }
  }

  // Dimensions that recover toward mid values
  const recoveryTargets = [EMOTION_DIM.HAPPINESS, EMOTION_DIM.COMFORT, EMOTION_DIM.CALMNESS];
  for (const dim of recoveryTargets) {
    if (state.dimensions[dim] < 0.5) {
      state.dimensions[dim] = _clamp(state.dimensions[dim] + RECOVERY_RATE);
    }
  }

  state.dominantEmotion = _deriveDominant(state.dimensions);
  state.updatedAt       = Date.now();
  state.version++;

  await emit(EMOTION_EVENTS.EMOTION_SYNCED, {
    timestamp: Date.now(),
    profileId,
  });

  return getEmotionSnapshot(profileId);
}

// ----------------------------------------------------------------
// GET EMOTION SNAPSHOT
// ----------------------------------------------------------------

/**
 * @param {string} profileId
 * @returns {Object} deep-cloned emotion snapshot
 */
export function getEmotionSnapshot(profileId) {
  const state = _requireState(profileId);
  return {
    profileId:       state.profileId,
    dimensions:      { ...state.dimensions },
    dominantEmotion: state.dominantEmotion,
    intensity:       _dominantIntensity(state.dimensions),
    version:         state.version,
    updatedAt:       state.updatedAt,
  };
}

// ----------------------------------------------------------------
// RESTORE FROM PERSISTENCE
// ----------------------------------------------------------------

export function restoreEmotionState(persistedState) {
  if (!persistedState?.profileId) {
    throw new EmotionError('[EmotionEngine] restoreEmotionState: invalid record.');
  }

  const { profileId, dimensions, version, createdAt } = persistedState;
  const clamped = _clampDimensions(dimensions || {});
  const state   = new EmotionState(profileId, clamped);

  state.version          = version   || 1;
  state.createdAt        = createdAt || Date.now();
  state.dominantEmotion  = _deriveDominant(state.dimensions);

  _states.set(profileId, state);

  EmotionLogger.info(`[EmotionEngine] Emotion state restored — profileId: ${profileId}`);
  return getEmotionSnapshot(profileId);
}

// ----------------------------------------------------------------
// ENGINE STATUS
// ----------------------------------------------------------------

export function getEmotionEngineStatus() {
  return {
    totalProfiles: _states.size,
    profileIds:    Array.from(_states.keys()),
  };
}

// ----------------------------------------------------------------
// INTERNAL: Clamp a single value
// ----------------------------------------------------------------

function _clamp(val) {
  return Math.min(EMOTION_MAX, Math.max(EMOTION_MIN, val));
}

// ----------------------------------------------------------------
// INTERNAL: Clamp all dimensions in a record
// ----------------------------------------------------------------

function _clampDimensions(dims) {
  const out = {};
  for (const [k, v] of Object.entries(dims)) {
    if (typeof v === 'number') out[k] = _clamp(v);
  }
  return out;
}

// ----------------------------------------------------------------
// INTERNAL: Validate deltas (must be numbers, dimension keys valid)
// ----------------------------------------------------------------

function _validateDeltas(deltas) {
  const errors   = [];
  const validDims = Object.values(EMOTION_DIM);

  for (const [dim, delta] of Object.entries(deltas)) {
    if (!validDims.includes(dim)) {
      errors.push(`Unknown emotion dimension: "${dim}".`);
    } else if (typeof delta !== 'number') {
      errors.push(`Delta for "${dim}" must be a number. Got: ${typeof delta}.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ----------------------------------------------------------------
// INTERNAL: Apply antagonist pressure
// e.g., high anxiety gently suppresses calmness
// ----------------------------------------------------------------

function _applyAntagonistPressure(dims) {
  const pressure = 0.5; // antagonist coupling strength

  for (const [source, target] of ANTAGONIST_PAIRS) {
    if (dims[source] > 0.6) {
      const excess     = dims[source] - 0.6;
      dims[target]     = _clamp(dims[target] - excess * pressure * 0.1);
    }
  }
}

// ----------------------------------------------------------------
// INTERNAL: Derive dominant emotion label from dimension vector
// ----------------------------------------------------------------

function _deriveDominant(dims) {
  const score = (pos, neg) => (dims[pos] || 0) - (dims[neg] || 0);

  const candidates = [
    { label: DOMINANT_EMOTION.JOY,      score: score(EMOTION_DIM.HAPPINESS,  EMOTION_DIM.STRESS)   },
    { label: DOMINANT_EMOTION.CALM,     score: score(EMOTION_DIM.CALMNESS,   EMOTION_DIM.ANXIETY)  },
    { label: DOMINANT_EMOTION.EXCITED,  score: score(EMOTION_DIM.EXCITEMENT, EMOTION_DIM.CALMNESS) },
    { label: DOMINANT_EMOTION.ANXIOUS,  score: score(EMOTION_DIM.ANXIETY,    EMOTION_DIM.COMFORT)  },
    { label: DOMINANT_EMOTION.TRUSTING, score: score(EMOTION_DIM.TRUST,      EMOTION_DIM.ANXIETY)  },
    { label: DOMINANT_EMOTION.ATTACHED, score: score(EMOTION_DIM.ATTACHMENT, EMOTION_DIM.STRESS)   },
    { label: DOMINANT_EMOTION.STRESSED, score: score(EMOTION_DIM.STRESS,     EMOTION_DIM.HAPPINESS)},
  ];

  const top = candidates.reduce((best, c) => c.score > best.score ? c : best, candidates[0]);
  return top.score > 0.05 ? top.label : DOMINANT_EMOTION.NEUTRAL;
}

// ----------------------------------------------------------------
// INTERNAL: Dominant emotion intensity (0–1)
// ----------------------------------------------------------------

function _dominantIntensity(dims) {
  const maxVal = Math.max(...Object.values(dims));
  return _clamp(maxVal);
}

// ----------------------------------------------------------------
// INTERNAL: Require state or throw
// ----------------------------------------------------------------

function _requireState(profileId) {
  const state = _states.get(profileId);
  if (!state) {
    throw new EmotionError(
      `[EmotionEngine] State for "${profileId}" not found. Call initializeEmotionState() first.`
    );
  }
  return state;
}

// ----------------------------------------------------------------
// EMOTION ERROR
// ----------------------------------------------------------------

export class EmotionError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name      = 'EmotionError';
    this.context   = context;
    this.timestamp = Date.now();
  }
}
