// ================================================================
// IMMORTAIL™ — COMPANION PRESENCE LAYER
// Emotional comfort + perceptual deepening upgrade.
// TUNING ONLY — no new systems, no architecture changes.
//
// Covers:
//   Phase 1 — Gentle Response Delay System
//   Phase 2 — Emotional Soft Curve Enhancement
//   Phase 3 — Micro-Behaviour Layer
//   Phase 4 — Attention Priority Model
//   Phase 5 — Bonding Soft Presence Enhancement
//   Phase 6 — Emotional Subtlety Gradient System
//   Phase 7 — Perceptual UI + 3D Alignment
//   Phase 8 — Consistent Personality Presence
// ================================================================

import Logger from '../utils/logger.js';

const LOG = Logger.createScopedLogger('CompanionPresence');

// ================================================================
// PHASE 1 — GENTLE RESPONSE DELAY SYSTEM
// Shapes response timing to feel "thoughtful", not mechanical.
// No blocking logic — pure timing metadata for UI/3D schedulers.
// ================================================================

export const INTERACTION_CLASS = {
  NEUTRAL:    'neutral',
  EMOTIONAL:  'emotional',
  MEMORY:     'memory',
  REACTIVATION: 'reactivation', // first event after inactivity
};

/** Base delay ranges (ms) per interaction class */
const DELAY_RANGES = {
  [INTERACTION_CLASS.NEUTRAL]:      { min: 100, max: 250 },
  [INTERACTION_CLASS.EMOTIONAL]:    { min: 300, max: 700 },
  [INTERACTION_CLASS.MEMORY]:       { min: 600, max: 1200 },
  [INTERACTION_CLASS.REACTIVATION]: { min: 200, max: 500 }, // additive
};

/**
 * classifyInteraction()
 * Maps an event key + context to an interaction class.
 */
export function classifyInteraction(eventKey = '', timeSinceLastInteraction = 0) {
  const MEMORY_EVENTS = [
    'MEMORY_POSITIVE_RECALL', 'MEMORY_NEGATIVE_RECALL', 'MEMORY_NEUTRAL_RECALL',
  ];
  const EMOTIONAL_EVENTS = [
    'USER_RETURNED', 'USER_ABSENT_EXTENDED', 'USER_PRAISED', 'USER_PLAY',
    'USER_IGNORED', 'INTERACTION_BROKEN', 'ROUTINE_DISRUPTED',
  ];

  if (MEMORY_EVENTS.includes(eventKey))   return INTERACTION_CLASS.MEMORY;
  if (EMOTIONAL_EVENTS.includes(eventKey)) return INTERACTION_CLASS.EMOTIONAL;
  return INTERACTION_CLASS.NEUTRAL;
}

/**
 * calculateResponseDelay()
 *
 * Returns a deterministic delay value (ms) within the appropriate range.
 * Uses a stable seed derived from event key — no Math.random().
 * Optionally adds reactivation pause if returning after inactivity.
 *
 * @param {string}  eventKey
 * @param {number}  timeSinceLastInteraction  - seconds
 * @param {number}  bondingLevel              - 0–100 (higher = slightly faster warm response)
 * @returns {{ delayMs: number, class: string, reactivation: boolean }}
 */
export function calculateResponseDelay(eventKey = '', timeSinceLastInteraction = 0, bondingLevel = 50) {
  const interactionClass = classifyInteraction(eventKey, timeSinceLastInteraction);
  const { min, max } = DELAY_RANGES[interactionClass];

  // Deterministic position within range — seeded by event key length + bonding
  const seed = (eventKey.length * 7 + bondingLevel * 3) % 100;
  const position = seed / 100; // 0.0–1.0
  let delayMs = Math.round(min + (max - min) * position);

  // Reactivation bonus: first response after long absence feels more "waking up"
  const isReactivation = timeSinceLastInteraction > 300; // 5 min
  if (isReactivation) {
    const reRange = DELAY_RANGES[INTERACTION_CLASS.REACTIVATION];
    const reExtra = Math.round(reRange.min + (reRange.max - reRange.min) * (1 - position));
    delayMs += reExtra;
  }

  // Bonding modifier: very high bonding = slightly warmer/faster (-10%)
  if (bondingLevel >= 80) delayMs = Math.round(delayMs * 0.90);

  return {
    delayMs,
    class: interactionClass,
    reactivation: isReactivation,
  };
}

// ================================================================
// PHASE 2 — EMOTIONAL SOFT CURVE ENHANCEMENT
// Emotions drift gradually — never snap. Easing curves applied.
// ================================================================

/**
 * EASING FUNCTIONS
 * All produce output in [0, 1] for t in [0, 1].
 */
const Easing = {
  /** Smooth ease-in-out: slow start, slow end */
  easeInOut: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  /** Ease out: fast start, slow end (settling into emotion) */
  easeOut:   (t) => 1 - Math.pow(1 - t, 2),
  /** Ease in: slow start (reluctant shift, e.g. after ignore) */
  easeIn:    (t) => t * t,
};

/**
 * EMOTION TRANSITION CAPS
 * Maximum change per single update cycle (regardless of bonding/meaning).
 * Enforces "drifting into a mood" rather than switching.
 */
const EMOTION_MAX_DELTA_PER_CYCLE = {
  joy:          0.18,
  trust:        0.12,  // trust changes most slowly
  fear:         0.15,
  sadness:      0.14,
  anger:        0.10,  // anger is heavily damped
  anticipation: 0.20,
  disgust:      0.08,
  surprise:     0.22,
};

/**
 * applyEmotionSoftCurve()
 *
 * Takes a raw emotion delta and returns a smoothed, capped version.
 * Positive deltas use easeOut (settling in).
 * Negative deltas use easeIn (reluctant release).
 *
 * @param {object} rawDelta   - { joy: +0.35, trust: +0.20, ... }
 * @param {number} progress   - 0–1 position in the transition cycle
 * @returns {object}          - smoothed, capped delta
 */
export function applyEmotionSoftCurve(rawDelta, progress = 1.0) {
  const smoothed = {};
  const t = Math.max(0, Math.min(1, progress));

  for (const [emotion, delta] of Object.entries(rawDelta)) {
    const maxDelta = EMOTION_MAX_DELTA_PER_CYCLE[emotion] ?? 0.15;

    // Choose easing based on direction
    const eased = delta >= 0
      ? Easing.easeOut(t)   // positive: warm settling
      : Easing.easeIn(t);   // negative: reluctant shift

    // Apply easing to the delta magnitude, then cap
    let smoothedDelta = delta * eased;
    smoothedDelta = Math.max(-maxDelta, Math.min(maxDelta, smoothedDelta));

    smoothed[emotion] = smoothedDelta;
  }

  return smoothed;
}

/**
 * getEmotionTransitionSteps()
 *
 * Returns a sequence of intermediate emotion states between
 * `from` and `to`, using a soft curve.
 * Used by UI/3D to animate gradual transitions.
 *
 * @param {object} from  - current emotion state
 * @param {object} to    - target emotion state
 * @param {number} steps - number of intermediate frames (e.g. 5)
 * @returns {Array}      - array of emotion state snapshots
 */
export function getEmotionTransitionSteps(from, to, steps = 5) {
  const frames = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const easedT = Easing.easeInOut(t);
    const frame = {};
    for (const key of Object.keys(from)) {
      const a = from[key] ?? 0;
      const b = to[key]   ?? 0;
      frame[key] = Math.max(0, Math.min(1, a + (b - a) * easedT));
    }
    frames.push(frame);
  }
  return frames;
}

// ================================================================
// PHASE 3 — MICRO-BEHAVIOUR LAYER
// Subtle presence signals per emotional state.
// Returns timing/motion metadata — no new state or systems.
// ================================================================

export const MICRO_BEHAVIOUR = {
  IDLE: {
    name: 'idle_presence',
    motions: [
      { id: 'head_shift',    period: 8000,  amplitude: 0.04, description: 'slight head settle side to side' },
      { id: 'breathe',       period: 3200,  amplitude: 0.02, description: 'gentle breathing rhythm' },
      { id: 'gaze_drift',    period: 12000, amplitude: 0.06, description: 'slow gaze shift' },
      { id: 'micro_pause',   period: 20000, amplitude: 0.0,  description: 'occasional stillness beat' },
    ],
    blinkRate: 3500,  // ms between blinks
    calmness: 0.90,
  },
  HAPPY: {
    name: 'happy_presence',
    motions: [
      { id: 'tail_sway',     period: 1800,  amplitude: 0.12, description: 'soft tail movement' },
      { id: 'body_sway',     period: 5000,  amplitude: 0.05, description: 'gentle body lean toward user' },
      { id: 'head_lift',     period: 6000,  amplitude: 0.06, description: 'light head raise' },
    ],
    blinkRate: 2800,
    calmness: 0.85,
  },
  CURIOUS: {
    name: 'curious_presence',
    motions: [
      { id: 'head_tilt',     period: 4000,  amplitude: 0.08, description: 'curious head tilt' },
      { id: 'pre_pause',     period: 1500,  amplitude: 0.0,  description: 'brief pause before response' },
      { id: 'attention_pan', period: 9000,  amplitude: 0.07, description: 'slow attention shift' },
    ],
    blinkRate: 4000,  // slower blink = more focused
    calmness: 0.75,
  },
  CALM: {
    name: 'calm_presence',
    motions: [
      { id: 'breathe_slow',  period: 4500,  amplitude: 0.015, description: 'slow calm breath' },
      { id: 'settle',        period: 15000, amplitude: 0.02,  description: 'gentle settling posture' },
    ],
    blinkRate: 4500,
    calmness: 1.00,
  },
  ANXIOUS: {
    name: 'anxious_presence',
    motions: [
      { id: 'ear_flick',     period: 2500,  amplitude: 0.04, description: 'slight ear movement' },
      { id: 'weight_shift',  period: 3500,  amplitude: 0.03, description: 'subtle weight redistribution' },
    ],
    blinkRate: 2200,  // faster blinking = stress signal
    calmness: 0.40,
  },
};

/**
 * getMicroBehaviour()
 * Returns the micro-behaviour profile for the current dominant emotion.
 */
export function getMicroBehaviour(dominantEmotion = 'calm') {
  const map = {
    joy:          MICRO_BEHAVIOUR.HAPPY,
    trust:        MICRO_BEHAVIOUR.CALM,
    fear:         MICRO_BEHAVIOUR.ANXIOUS,
    anticipation: MICRO_BEHAVIOUR.CURIOUS,
    sadness:      MICRO_BEHAVIOUR.IDLE,
    anger:        MICRO_BEHAVIOUR.ANXIOUS,
    calm:         MICRO_BEHAVIOUR.CALM,
    happy:        MICRO_BEHAVIOUR.HAPPY,
    curious:      MICRO_BEHAVIOUR.CURIOUS,
  };
  return map[dominantEmotion] || MICRO_BEHAVIOUR.IDLE;
}

/**
 * getMicroMotionValue()
 *
 * Returns a deterministic motion value at a given timestamp for
 * a specific motion definition. Uses cosine wave — no randomness.
 *
 * @param {object} motion   - { period, amplitude }
 * @param {number} timeMs   - current timestamp in ms
 * @param {number} phaseOffset - 0–1, per-motion offset to desync waves
 * @returns {number}         - motion value in [-amplitude, +amplitude]
 */
export function getMicroMotionValue(motion, timeMs, phaseOffset = 0) {
  const phase = (timeMs / motion.period + phaseOffset) * Math.PI * 2;
  return Math.sin(phase) * motion.amplitude;
}

// ================================================================
// PHASE 4 — ATTENTION PRIORITY MODEL
// Filters events by perceptual significance.
// Only high-priority events produce visible companion response.
// ================================================================

export const ATTENTION_PRIORITY = {
  HIGH:       'high',
  MEDIUM:     'medium',
  LOW:        'low',
  BACKGROUND: 'background',
};

const EVENT_PRIORITY_MAP = {
  // High — always produce visible response
  'USER_RETURNED':          ATTENTION_PRIORITY.HIGH,
  'USER_INTERACTION':       ATTENTION_PRIORITY.HIGH,
  'USER_PLAY':              ATTENTION_PRIORITY.HIGH,
  'USER_PRAISE':            ATTENTION_PRIORITY.HIGH,
  'USER_ABSENT_EXTENDED':   ATTENTION_PRIORITY.HIGH,

  // Medium — produce soft response
  'MEMORY_POSITIVE_RECALL': ATTENTION_PRIORITY.MEDIUM,
  'MEMORY_NEGATIVE_RECALL': ATTENTION_PRIORITY.MEDIUM,
  'USER_PRESENT':           ATTENTION_PRIORITY.MEDIUM,
  'ROUTINE_CHANGE':         ATTENTION_PRIORITY.MEDIUM,

  // Low — subtle internal update only
  'MEMORY_NEUTRAL_RECALL':  ATTENTION_PRIORITY.LOW,
  'USER_CONSISTENT_CARE':   ATTENTION_PRIORITY.LOW,

  // Background — no visible response
  'SYSTEM_TICK':            ATTENTION_PRIORITY.BACKGROUND,
  'STORAGE_SYNC':           ATTENTION_PRIORITY.BACKGROUND,
};

/**
 * getEventAttentionPriority()
 * @returns {string} ATTENTION_PRIORITY value
 */
export function getEventAttentionPriority(eventKey = '') {
  return EVENT_PRIORITY_MAP[eventKey] || ATTENTION_PRIORITY.LOW;
}

/**
 * shouldProduceVisibleResponse()
 * Returns true if this event should trigger a visible companion reaction.
 */
export function shouldProduceVisibleResponse(eventKey = '') {
  const priority = getEventAttentionPriority(eventKey);
  return priority === ATTENTION_PRIORITY.HIGH || priority === ATTENTION_PRIORITY.MEDIUM;
}

// ================================================================
// PHASE 5 — BONDING SOFT PRESENCE ENHANCEMENT
// Bonding shapes warmth + calmness — not intensity.
// ================================================================

/**
 * getBondingPresenceProfile()
 *
 * Returns a presence profile shaped by current bonding level.
 * Higher bonding = warmer, calmer, closer — not more reactive.
 *
 * @param {number} bondingLevel - 0–100
 * @returns {object}
 */
export function getBondingPresenceProfile(bondingLevel = 50) {
  const b = bondingLevel / 100; // 0–1

  return {
    // Warmth: 0.4 (stranger) → 0.9 (deeply bonded)
    warmth: 0.4 + b * 0.5,

    // Proximity bias: how close the companion naturally positions
    // 0.3 (cautious distance) → 0.8 (comfortable closeness)
    proximityBias: 0.3 + b * 0.5,

    // Attention frequency: how often the companion checks in
    // Low bond = 1 check/30s, High bond = 1 check/8s
    attentionIntervalMs: Math.round(30000 - b * 22000),

    // Calmness baseline: high bonding = more settled
    // 0.5 (uncertain) → 0.95 (deeply calm)
    calmnessBaseline: 0.5 + b * 0.45,

    // Response dampening: high bonding = no extreme swings
    // 0.7 (normal) → 0.3 (very damped at high bonding)
    emotionDampening: 0.7 - b * 0.4,

    // Tail wag intensity for happy states
    // Low bond = small, High bond = warm and sustained
    tailWagIntensity: 0.2 + b * 0.6,

    bondingLevel,
    tier: bondingLevel >= 80 ? 'deep'
        : bondingLevel >= 50 ? 'established'
        : bondingLevel >= 25 ? 'developing'
        : 'early',
  };
}

// ================================================================
// PHASE 6 — EMOTIONAL SUBTLETY GRADIENT SYSTEM
// Replaces strong jumps with in-family gradient progressions.
// ================================================================

/**
 * EMOTION FAMILIES
 * Emotions are grouped into families.
 * Transitions stay within families unless a strong event justifies crossing.
 */
export const EMOTION_FAMILY = {
  POSITIVE_WARM:  ['joy', 'trust', 'anticipation'],
  NEGATIVE_TENSE: ['fear', 'sadness', 'anger'],
  CURIOUS_OPEN:   ['anticipation', 'surprise'],
  SETTLED:        ['trust', 'calm'],
};

/**
 * GRADIENT LABELS
 * Each emotion has a named gradient scale (for UI display / logging).
 */
export const EMOTION_GRADIENT = {
  joy: {
    0.0:  'absent',
    0.20: 'faint warmth',
    0.40: 'calm happy',
    0.60: 'warm happy',
    0.75: 'gently excited',
    0.90: 'joyful',
    1.0:  'peak joy',
  },
  trust: {
    0.0:  'none',
    0.20: 'tentative',
    0.40: 'developing',
    0.60: 'comfortable',
    0.80: 'established',
    1.0:  'deep trust',
  },
  fear: {
    0.0:  'none',
    0.20: 'slight unease',
    0.40: 'wary',
    0.60: 'anxious',
    0.80: 'fearful',
    1.0:  'distressed',
  },
  sadness: {
    0.0:  'none',
    0.20: 'subdued',
    0.40: 'low',
    0.60: 'sad',
    0.80: 'heavy',
    1.0:  'deep sadness',
  },
  anticipation: {
    0.0:  'none',
    0.20: 'faint curiosity',
    0.40: 'interested',
    0.60: 'alert',
    0.80: 'eager',
    1.0:  'high anticipation',
  },
};

/**
 * getEmotionGradientLabel()
 * Returns the gradient label for a given emotion + intensity.
 */
export function getEmotionGradientLabel(emotion, intensity) {
  const gradients = EMOTION_GRADIENT[emotion];
  if (!gradients) return `${emotion}:${intensity.toFixed(2)}`;

  const thresholds = Object.keys(gradients).map(Number).sort((a, b) => b - a);
  for (const threshold of thresholds) {
    if (intensity >= threshold) return gradients[threshold];
  }
  return gradients[0] || 'unknown';
}

/**
 * isCrossFamilyJump()
 * Checks whether an emotion transition crosses family boundaries.
 * Cross-family jumps should only happen on strong event triggers.
 */
export function isCrossFamilyJump(fromEmotion, toEmotion) {
  for (const family of Object.values(EMOTION_FAMILY)) {
    if (family.includes(fromEmotion) && family.includes(toEmotion)) {
      return false; // same family — safe
    }
  }
  return true; // different families — needs justification
}

/**
 * safeEmotionTransition()
 *
 * Validates and adjusts a proposed emotion transition to keep it
 * within the subtlety gradient system.
 *
 * If a cross-family jump is proposed without a strong trigger,
 * the delta is dampened to prevent jarring shifts.
 *
 * @param {string} fromDominant  - Current dominant emotion
 * @param {string} toDominant    - Proposed dominant emotion after delta
 * @param {object} proposedDelta - Raw emotion deltas
 * @param {boolean} strongTrigger - Whether event justifies cross-family jump
 * @returns {{ adjustedDelta: object, dampened: boolean, crossFamily: boolean }}
 */
export function safeEmotionTransition(fromDominant, toDominant, proposedDelta, strongTrigger = false) {
  const crossFamily = isCrossFamilyJump(fromDominant, toDominant);
  let dampened = false;
  let adjustedDelta = { ...proposedDelta };

  if (crossFamily && !strongTrigger) {
    // Dampen cross-family jump by 60% — emotion acknowledges but doesn't fully cross
    dampened = true;
    for (const [emotion, delta] of Object.entries(adjustedDelta)) {
      adjustedDelta[emotion] = delta * 0.40;
    }
  }

  return { adjustedDelta, dampened, crossFamily };
}

// ================================================================
// PHASE 7 — PERCEPTUAL UI + 3D ALIGNMENT
// State → delay → animation → UI settle sequence.
// Returns timing metadata for the render pipeline.
// ================================================================

/**
 * STATE → UI SETTLING SEQUENCE
 *
 * UI/3D should lag slightly behind state for natural feel.
 *
 * Sequence:
 *   t=0ms      → state updates (internal)
 *   t=delayMs  → animation begins (3D layer)
 *   t=delayMs + animMs → UI reflects settled state
 */

const ANIMATION_SETTLE_TIMES = {
  [INTERACTION_CLASS.NEUTRAL]:      { animMs: 300,  settleMs: 500  },
  [INTERACTION_CLASS.EMOTIONAL]:    { animMs: 600,  settleMs: 900  },
  [INTERACTION_CLASS.MEMORY]:       { animMs: 900,  settleMs: 1400 },
  [INTERACTION_CLASS.REACTIVATION]: { animMs: 800,  settleMs: 1200 },
};

/**
 * getPerceptualTimingSequence()
 *
 * Returns the full timing map for a given event.
 * UI/3D layers consume this to coordinate "catching up" feel.
 *
 * @param {string} eventKey
 * @param {number} timeSinceLastInteraction
 * @param {number} bondingLevel
 * @returns {{ stateAt: 0, animStartAt: number, uiSettleAt: number, totalMs: number }}
 */
export function getPerceptualTimingSequence(eventKey, timeSinceLastInteraction = 0, bondingLevel = 50) {
  const delay = calculateResponseDelay(eventKey, timeSinceLastInteraction, bondingLevel);
  const interactionClass = delay.class;
  const settle = ANIMATION_SETTLE_TIMES[interactionClass] || ANIMATION_SETTLE_TIMES[INTERACTION_CLASS.NEUTRAL];

  // High bonding = slightly faster settle (familiar = comfortable)
  const bondingSpeedBoost = bondingLevel >= 70 ? 0.85 : 1.0;
  const animMs   = Math.round(settle.animMs   * bondingSpeedBoost);
  const settleMs = Math.round(settle.settleMs * bondingSpeedBoost);

  return {
    stateAt:    0,                        // immediate — state is always first
    animStartAt: delay.delayMs,            // 3D animation begins after presence delay
    uiSettleAt:  delay.delayMs + settleMs, // UI reaches final settled state
    totalMs:     delay.delayMs + settleMs + animMs,
    delayMs:     delay.delayMs,
    animMs,
    settleMs,
    class:       interactionClass,
    reactivation: delay.reactivation,
  };
}

// ================================================================
// PHASE 8 — CONSISTENT PERSONALITY PRESENCE LAYER
// One core feeling, every session. Gentle. Stable. Familiar.
// ================================================================

/**
 * CORE PERSONALITY CONSTANTS
 * These never change. They define what IMMORTAIL™ always feels like.
 */
export const CORE_PRESENCE = {
  // Emotional ceiling: no emotion should spike above this without recovery
  EMOTIONAL_CEILING: 0.85,

  // Emotional floor: no positive emotion should drop below this (maintains warmth)
  JOY_FLOOR: 0.10,
  TRUST_FLOOR: 0.15,

  // Recovery pull: after extreme events, emotions drift back toward these
  EQUILIBRIUM: {
    joy:          0.38,
    trust:        0.45,
    fear:         0.08,
    sadness:      0.08,
    anger:        0.02,
    anticipation: 0.22,
  },

  // Equilibrium pull strength per update cycle
  // Lower = slower, gentler return to baseline
  EQUILIBRIUM_PULL: 0.012,

  // Personality anchor words (for documentation / UI tone)
  CHARACTER: ['gentle', 'stable', 'familiar', 'warm', 'present'],
};

/**
 * applyEquilibriumPull()
 *
 * Gently draws all emotion values toward equilibrium each cycle.
 * Ensures no emotion remains at extreme values indefinitely.
 * Creates the "settling back to self" feel.
 *
 * @param {object} currentEmotion - current emotion state
 * @returns {object}              - adjusted emotion state
 */
export function applyEquilibriumPull(currentEmotion) {
  const result = {};
  for (const [emotion, value] of Object.entries(currentEmotion)) {
    const eq     = CORE_PRESENCE.EQUILIBRIUM[emotion] ?? 0.3;
    const diff   = eq - value;
    const pull   = diff * CORE_PRESENCE.EQUILIBRIUM_PULL;
    result[emotion] = Math.max(0, Math.min(1, value + pull));
  }
  return result;
}

/**
 * enforceEmotionalCeiling()
 *
 * Caps all emotions at EMOTIONAL_CEILING.
 * Prevents spikes. Always applied after any emotional update.
 *
 * @param {object} emotionState
 * @returns {object}
 */
export function enforceEmotionalCeiling(emotionState) {
  const result = {};
  for (const [emotion, value] of Object.entries(emotionState)) {
    let v = Math.min(CORE_PRESENCE.EMOTIONAL_CEILING, value);
    // Maintain floors
    if (emotion === 'joy')   v = Math.max(CORE_PRESENCE.JOY_FLOOR,   v);
    if (emotion === 'trust') v = Math.max(CORE_PRESENCE.TRUST_FLOOR,  v);
    result[emotion] = v;
  }
  return result;
}

/**
 * enforcePersonalityPresence()
 *
 * Full Phase 8 guard — applies ceiling, equilibrium pull, and
 * validates the result feels consistent with core character.
 *
 * Call this as the FINAL step of every pipeline update.
 *
 * @param {object} emotionState
 * @returns {{ emotion: object, presenceScore: number, stable: boolean }}
 */
export function enforcePersonalityPresence(emotionState) {
  // Step 1: Apply ceiling
  let emotion = enforceEmotionalCeiling(emotionState);

  // Step 2: Apply equilibrium pull
  emotion = applyEquilibriumPull(emotion);

  // Step 3: Score presence stability
  // Presence score = how close the state is to the equilibrium signature
  let totalDeviation = 0;
  let count = 0;
  for (const [key, eq] of Object.entries(CORE_PRESENCE.EQUILIBRIUM)) {
    const current = emotion[key] ?? eq;
    totalDeviation += Math.abs(current - eq);
    count++;
  }
  const avgDeviation = totalDeviation / count;
  const presenceScore = Math.max(0, Math.min(1, 1 - avgDeviation * 2));
  const stable = presenceScore >= 0.5;

  return { emotion, presenceScore: parseFloat(presenceScore.toFixed(3)), stable };
}

// ================================================================
// PRESENCE LAYER SUMMARY
// Unified entry point — returns all presence metadata for one event.
// ================================================================

/**
 * getCompanionPresenceContext()
 *
 * Single call to get all presence layer outputs for an event.
 * No side effects. Returns metadata for UI/3D/pipeline consumers.
 *
 * @param {string}  eventKey
 * @param {object}  currentEmotion
 * @param {number}  bondingLevel
 * @param {number}  timeSinceLastInteraction - seconds
 * @param {object}  rawEmotionDelta          - from emotionCausalityEngine
 * @returns {object} Full presence context
 */
export function getCompanionPresenceContext({
  eventKey,
  currentEmotion,
  bondingLevel = 50,
  timeSinceLastInteraction = 0,
  rawEmotionDelta = {},
}) {
  // Phase 1 — timing
  const timing = getPerceptualTimingSequence(eventKey, timeSinceLastInteraction, bondingLevel);

  // Phase 2 — soft curve
  const smoothedDelta = applyEmotionSoftCurve(rawEmotionDelta, 1.0);

  // Phase 4 — attention priority
  const priority     = getEventAttentionPriority(eventKey);
  const visibleResponse = shouldProduceVisibleResponse(eventKey);

  // Phase 5 — bonding profile
  const bondingProfile = getBondingPresenceProfile(bondingLevel);

  // Phase 6 — gradient labels for current emotion
  const gradientLabels = {};
  for (const [emotion, value] of Object.entries(currentEmotion)) {
    gradientLabels[emotion] = getEmotionGradientLabel(emotion, value);
  }

  // Phase 7 — UI settle sequence (already in timing)

  // Phase 8 — personality presence guard
  const presenceGuard = enforcePersonalityPresence(currentEmotion);

  // Phase 3 — micro-behaviour
  const dominant = Object.entries(presenceGuard.emotion)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'calm';
  const microBehaviour = getMicroBehaviour(dominant);

  LOG.debug(
    `[PresenceLayer] ${eventKey} | priority=${priority} | delay=${timing.delayMs}ms | ` +
    `visible=${visibleResponse} | presence=${presenceGuard.presenceScore} | micro=${microBehaviour.name}`
  );

  return {
    // Timing (Phase 1 + 7)
    timing,

    // Emotion smoothing (Phase 2)
    smoothedDelta,
    transitionSteps: getEmotionTransitionSteps(
      currentEmotion,
      presenceGuard.emotion,
      5,
    ),

    // Micro-behaviour (Phase 3)
    microBehaviour,

    // Attention priority (Phase 4)
    priority,
    visibleResponse,

    // Bonding profile (Phase 5)
    bondingProfile,

    // Gradient labels (Phase 6)
    gradientLabels,

    // Personality presence guard (Phase 8)
    presenceGuard,

    // Dominant emotion after guard
    dominantEmotion: dominant,
  };
}
