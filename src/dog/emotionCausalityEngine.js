// ================================================================
// IMMORTAIL™ — EMOTIONAL CAUSALITY ENGINE
// SSOT: Emotion changes by MEANING, not by random event assignment.
// Flow: event → meaning → emotional delta → service → state → event
// ================================================================

import Logger from '../utils/logger.js';

const LOG = Logger.createScopedLogger('EmotionCausalityEngine');

// ----------------------------------------------------------------
// MEANING REGISTRY
// Maps semantic event types to their emotional meaning contexts.
// Every meaning has deterministic weight rules.
// ----------------------------------------------------------------

export const MEANING = {
  // Positive reunion / social
  POSITIVE_REUNION:       'POSITIVE_REUNION',
  GENTLE_INTERACTION:     'GENTLE_INTERACTION',
  PLAY_INITIATED:         'PLAY_INITIATED',
  PRAISE_RECEIVED:        'PRAISE_RECEIVED',
  CONSISTENT_CARE:        'CONSISTENT_CARE',

  // Negative / absence / social pain
  SOCIAL_ABSENCE:         'SOCIAL_ABSENCE',
  PROLONGED_IGNORE:       'PROLONGED_IGNORE',
  INTERACTION_BROKEN:     'INTERACTION_BROKEN',
  ROUTINE_DISRUPTED:      'ROUTINE_DISRUPTED',

  // Memory triggers
  POSITIVE_RECALL:        'POSITIVE_RECALL',
  NEGATIVE_RECALL:        'NEGATIVE_RECALL',
  NEUTRAL_RECALL:         'NEUTRAL_RECALL',

  // Neutral / ambient
  AMBIENT_PRESENCE:       'AMBIENT_PRESENCE',
  UNKNOWN_STIMULUS:       'UNKNOWN_STIMULUS',
};

// ----------------------------------------------------------------
// EVENT → MEANING MAP
// Deterministic. All system events resolve to a meaning context.
// ----------------------------------------------------------------

const EVENT_MEANING_MAP = {
  'USER_RETURNED':          MEANING.POSITIVE_REUNION,
  'USER_INTERACTION':       MEANING.GENTLE_INTERACTION,
  'USER_PLAY':              MEANING.PLAY_INITIATED,
  'USER_PRAISE':            MEANING.PRAISE_RECEIVED,
  'USER_CONSISTENT_CARE':   MEANING.CONSISTENT_CARE,
  'USER_IGNORED':           MEANING.SOCIAL_ABSENCE,
  'USER_ABSENT_EXTENDED':   MEANING.PROLONGED_IGNORE,
  'USER_LEFT':              MEANING.INTERACTION_BROKEN,
  'ROUTINE_CHANGE':         MEANING.ROUTINE_DISRUPTED,
  'MEMORY_POSITIVE_RECALL': MEANING.POSITIVE_RECALL,
  'MEMORY_NEGATIVE_RECALL': MEANING.NEGATIVE_RECALL,
  'MEMORY_NEUTRAL_RECALL':  MEANING.NEUTRAL_RECALL,
  'USER_PRESENT':           MEANING.AMBIENT_PRESENCE,
};

// ----------------------------------------------------------------
// EMOTION DELTA RULES
// Each meaning maps to deterministic emotional deltas.
// Values are base multipliers on [-1, 1] scale.
// ----------------------------------------------------------------

const MEANING_EMOTION_RULES = {
  [MEANING.POSITIVE_REUNION]: {
    joy:        +0.35,
    trust:      +0.20,
    anticipation: +0.25,
    fear:       -0.15,
    sadness:    -0.20,
    anger:      -0.10,
  },
  [MEANING.GENTLE_INTERACTION]: {
    joy:        +0.15,
    trust:      +0.10,
    anticipation: +0.10,
    fear:       -0.10,
    sadness:    -0.10,
  },
  [MEANING.PLAY_INITIATED]: {
    joy:        +0.30,
    anticipation: +0.35,
    trust:      +0.10,
    fear:       -0.05,
    sadness:    -0.15,
  },
  [MEANING.PRAISE_RECEIVED]: {
    joy:        +0.25,
    trust:      +0.15,
    anticipation: +0.10,
    fear:       -0.10,
  },
  [MEANING.CONSISTENT_CARE]: {
    joy:        +0.10,
    trust:      +0.25,
    anticipation: +0.05,
    fear:       -0.20,
    sadness:    -0.15,
    anger:      -0.10,
  },
  [MEANING.SOCIAL_ABSENCE]: {
    fear:       +0.20,
    sadness:    +0.15,
    anticipation: -0.10,
    joy:        -0.15,
    trust:      -0.05,
  },
  [MEANING.PROLONGED_IGNORE]: {
    fear:       +0.30,
    sadness:    +0.25,
    anger:      +0.10,
    joy:        -0.25,
    trust:      -0.15,
    anticipation: -0.20,
  },
  [MEANING.INTERACTION_BROKEN]: {
    sadness:    +0.20,
    fear:       +0.15,
    joy:        -0.20,
    anticipation: -0.15,
  },
  [MEANING.ROUTINE_DISRUPTED]: {
    fear:       +0.15,
    anger:      +0.10,
    anticipation: +0.10,
    joy:        -0.05,
    trust:      -0.05,
  },
  [MEANING.POSITIVE_RECALL]: {
    joy:        +0.20,
    trust:      +0.10,
    anticipation: +0.15,
    sadness:    -0.10,
  },
  [MEANING.NEGATIVE_RECALL]: {
    fear:       +0.20,
    sadness:    +0.15,
    anger:      +0.05,
    joy:        -0.15,
    trust:      -0.05,
  },
  [MEANING.NEUTRAL_RECALL]: {
    anticipation: +0.05,
  },
  [MEANING.AMBIENT_PRESENCE]: {
    joy:        +0.05,
    fear:       -0.05,
  },
  [MEANING.UNKNOWN_STIMULUS]: {
    anticipation: +0.10,
    fear:       +0.05,
  },
};

// ----------------------------------------------------------------
// DEFAULT EMOTION STATE
// ----------------------------------------------------------------

export const DEFAULT_EMOTION_STATE = {
  joy:          0.3,
  trust:        0.4,
  fear:         0.1,
  sadness:      0.1,
  anger:        0.0,
  anticipation: 0.2,
  disgust:      0.0,
  surprise:     0.0,
};

// ----------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------

function clamp(v, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Resolve the MEANING of an event string.
 */
export function resolveEventMeaning(eventKey) {
  return EVENT_MEANING_MAP[eventKey] || MEANING.UNKNOWN_STIMULUS;
}

/**
 * Apply bonding modifier to delta strength.
 * High bonding amplifies positive emotions, dampens negative.
 * Low bonding inverts: weakens positive, amplifies negative.
 *
 * bondingLevel: 0–100
 */
function applyBondingModifier(delta, bondingLevel) {
  // bondingFactor: 0.5 (no bond) → 1.5 (maximum bond)
  const bondingFactor = 0.5 + (bondingLevel / 100);

  const modified = {};
  for (const [emotion, value] of Object.entries(delta)) {
    if (value > 0) {
      // Positive deltas amplified by bonding
      modified[emotion] = value * bondingFactor;
    } else {
      // Negative deltas dampened by bonding (higher bond = less negative impact)
      modified[emotion] = value / bondingFactor;
    }
  }
  return modified;
}

/**
 * Apply memory influence scalar to the delta.
 * memoryInfluence: 0–1 (from memoryWeightedResponseEngine)
 * High memory influence makes reactions more pronounced.
 */
function applyMemoryInfluence(delta, memoryInfluence) {
  // Scale: 0.8 (no memory) → 1.3 (strong memory context)
  const scale = 0.8 + (memoryInfluence * 0.5);
  const modified = {};
  for (const [emotion, value] of Object.entries(delta)) {
    modified[emotion] = value * scale;
  }
  return modified;
}

// ----------------------------------------------------------------
// CORE PUBLIC API
// ----------------------------------------------------------------

/**
 * updateEmotionFromMeaning()
 *
 * Given an event key, current emotion state, bonding level, and
 * memory influence, returns the new deterministic emotion state.
 *
 * This is the ONLY way emotions should change in IMMORTAIL™.
 *
 * @param {string} eventKey       - EVENT_MEANING_MAP key
 * @param {object} currentEmotion - Current emotion snapshot {joy, trust, ...}
 * @param {number} bondingLevel   - 0–100
 * @param {number} memoryInfluence - 0–1 from memoryWeightedResponseEngine
 * @returns {{ newEmotion: object, meaning: string, appliedDelta: object }}
 */
export function updateEmotionFromMeaning({
  eventKey,
  currentEmotion,
  bondingLevel   = 50,
  memoryInfluence = 0.5,
}) {
  const meaning = resolveEventMeaning(eventKey);
  const baseRules = MEANING_EMOTION_RULES[meaning] || {};

  // Step 1: Apply bonding modifier to base delta
  let delta = applyBondingModifier(baseRules, bondingLevel);

  // Step 2: Apply memory influence scalar
  delta = applyMemoryInfluence(delta, memoryInfluence);

  // Step 3: Apply delta to current emotion state (clamped)
  const newEmotion = { ...DEFAULT_EMOTION_STATE, ...currentEmotion };
  for (const [emotion, dv] of Object.entries(delta)) {
    if (newEmotion[emotion] !== undefined) {
      newEmotion[emotion] = clamp(newEmotion[emotion] + dv);
    }
  }

  // Step 4: Normalise (emotions are relative, not absolute)
  // Keep them clamped — no forced normalisation that erases state

  LOG.debug(`[EmotionCausality] ${eventKey} → meaning=${meaning} | bonding=${bondingLevel} | memInfl=${memoryInfluence.toFixed(2)}`);

  return {
    newEmotion,
    meaning,
    appliedDelta: delta,
    eventKey,
  };
}

/**
 * getDominantEmotion()
 * Returns the emotion with the highest current value.
 */
export function getDominantEmotion(emotionState) {
  let dominant = 'joy';
  let max = -Infinity;
  for (const [k, v] of Object.entries(emotionState)) {
    if (v > max) { max = v; dominant = k; }
  }
  return { emotion: dominant, intensity: max };
}

/**
 * getEmotionSignature()
 * Returns a stable string fingerprint of the current emotion state.
 * Used by identity continuity engine.
 */
export function getEmotionSignature(emotionState) {
  return Object.entries(emotionState)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v.toFixed(2)}`)
    .join('|');
}

/**
 * validateEmotionCausality()
 * Ensures no emotion change happened without a causal meaning.
 * Used in test validation pipeline.
 */
export function validateEmotionCausality(before, after, meaning) {
  if (meaning === MEANING.UNKNOWN_STIMULUS) return { valid: true, warning: 'unknown stimulus' };

  const rules = MEANING_EMOTION_RULES[meaning] || {};
  const violations = [];

  for (const [emotion, expectedDir] of Object.entries(rules)) {
    const delta = after[emotion] - before[emotion];
    if (Math.abs(delta) < 0.001) continue; // negligible — skip
    if (expectedDir > 0 && delta < -0.001) {
      violations.push(`${emotion} moved DOWN but rule says UP`);
    } else if (expectedDir < 0 && delta > 0.001) {
      violations.push(`${emotion} moved UP but rule says DOWN`);
    }
  }

  return { valid: violations.length === 0, violations };
}
