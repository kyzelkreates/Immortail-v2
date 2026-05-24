// ================================================================
// IMMORTAIL™ — PERSONALITY CONSISTENCY ENGINE
// SSOT: Personality evolves slowly and resists abrupt drift.
// Trait boundaries, drift resistance, memory reinforcement.
// ================================================================

import Logger from '../utils/logger.js';

const LOG = Logger.createScopedLogger('PersonalityConsistencyEngine');

// ----------------------------------------------------------------
// TRAIT CATALOGUE
// (Maps to PERSONALITY_TRAIT constants from personalityEngine.js)
// ----------------------------------------------------------------

export const TRAIT = {
  PLAYFULNESS:    'playfulness',
  LOYALTY:        'loyalty',
  CURIOSITY:      'curiosity',
  GENTLENESS:     'gentleness',
  ENERGY:         'energy',
  AFFECTION:      'affection',
  INDEPENDENCE:   'independence',
};

// ----------------------------------------------------------------
// DEFAULT PERSONALITY BASELINE
// These are the initial trait values before any reinforcement.
// They form the "gravitational centre" of personality.
// ----------------------------------------------------------------

export const DEFAULT_PERSONALITY_BASELINE = {
  [TRAIT.PLAYFULNESS]:  0.65,
  [TRAIT.LOYALTY]:      0.70,
  [TRAIT.CURIOSITY]:    0.60,
  [TRAIT.GENTLENESS]:   0.65,
  [TRAIT.ENERGY]:       0.55,
  [TRAIT.AFFECTION]:    0.70,
  [TRAIT.INDEPENDENCE]: 0.35,
};

// ----------------------------------------------------------------
// TRAIT BOUNDARIES
// Hard clamps: traits cannot exceed these ranges ever.
// Prevents runaway drift to 0 or 1.
// ----------------------------------------------------------------

export const TRAIT_BOUNDS = {
  [TRAIT.PLAYFULNESS]:  { min: 0.20, max: 0.95 },
  [TRAIT.LOYALTY]:      { min: 0.30, max: 1.00 },
  [TRAIT.CURIOSITY]:    { min: 0.15, max: 0.95 },
  [TRAIT.GENTLENESS]:   { min: 0.20, max: 0.95 },
  [TRAIT.ENERGY]:       { min: 0.10, max: 0.95 },
  [TRAIT.AFFECTION]:    { min: 0.25, max: 1.00 },
  [TRAIT.INDEPENDENCE]: { min: 0.10, max: 0.80 },
};

// ----------------------------------------------------------------
// DRIFT RESISTANCE
// Max change allowed per single update cycle, per trait.
// Prevents sudden personality inversions.
// Lower = more stable / slower evolution.
// ----------------------------------------------------------------

const DRIFT_RESISTANCE = {
  [TRAIT.PLAYFULNESS]:  0.03,
  [TRAIT.LOYALTY]:      0.02,  // loyalty is the most stable
  [TRAIT.CURIOSITY]:    0.04,
  [TRAIT.GENTLENESS]:   0.03,
  [TRAIT.ENERGY]:       0.05,  // energy fluctuates more freely
  [TRAIT.AFFECTION]:    0.02,
  [TRAIT.INDEPENDENCE]: 0.03,
};

// ----------------------------------------------------------------
// BONDING STABILITY MODIFIER
// High bonding = trait evolution slows (stable relationship)
// Low bonding = trait evolution is slightly faster (unstable)
// bondingLevel: 0–100
// ----------------------------------------------------------------

function bondingStabilityFactor(bondingLevel) {
  // 0.6 (low bond) → 1.0 (max bond) — higher = more resistant to change
  return 0.6 + (bondingLevel / 100) * 0.4;
}

// ----------------------------------------------------------------
// MEMORY REINFORCEMENT WEIGHT
// Recurring interactions reinforce trait consistency.
// memoryCount: number of relevant memories
// ----------------------------------------------------------------

function memoryReinforcementFactor(memoryCount) {
  // 1.0 (no memories) → 0.5 (strong memory → resists change)
  const capped = Math.min(memoryCount, 50);
  return 1.0 - (capped / 50) * 0.5;
}

// ----------------------------------------------------------------
// BASELINE GRAVITY
// Slowly pulls traits back toward baseline if they drift.
// Applied every update cycle, after all other adjustments.
// ----------------------------------------------------------------

function applyBaselineGravity(currentTraits, baselineTraits, bondingLevel) {
  const GRAVITY_STRENGTH = 0.01 * bondingStabilityFactor(bondingLevel);
  const pulled = {};

  for (const [trait, current] of Object.entries(currentTraits)) {
    const baseline = baselineTraits[trait] ?? DEFAULT_PERSONALITY_BASELINE[trait] ?? 0.5;
    const diff = baseline - current;
    // Pull gently toward baseline
    pulled[trait] = current + diff * GRAVITY_STRENGTH;
  }

  return pulled;
}

// ----------------------------------------------------------------
// CORE PUBLIC API
// ----------------------------------------------------------------

/**
 * enforcePersonalityStability()
 *
 * Given a proposed trait delta (from emotion/event processing),
 * applies drift resistance, bonding modifier, memory reinforcement,
 * and hard bounds. Returns a stable updated trait set.
 *
 * @param {object} currentTraits   - Current trait values {playfulness: 0.65, ...}
 * @param {object} proposedDelta   - Raw proposed change {playfulness: +0.2, ...}
 * @param {object} baselineTraits  - Locked baseline (loaded from profile storage)
 * @param {number} bondingLevel    - 0–100
 * @param {number} memoryCount     - Count of reinforcing memories
 * @returns {{ newTraits: object, appliedDelta: object, violations: string[] }}
 */
export function enforcePersonalityStability({
  currentTraits,
  proposedDelta = {},
  baselineTraits = DEFAULT_PERSONALITY_BASELINE,
  bondingLevel = 50,
  memoryCount = 0,
}) {
  const stabilityFactor  = bondingStabilityFactor(bondingLevel);
  const memoryFactor     = memoryReinforcementFactor(memoryCount);
  const violations       = [];
  const appliedDelta     = {};
  const newTraits        = { ...DEFAULT_PERSONALITY_BASELINE, ...currentTraits };

  for (const [trait, rawDelta] of Object.entries(proposedDelta)) {
    if (!(trait in DRIFT_RESISTANCE)) {
      violations.push(`Unknown trait "${trait}" — skipped`);
      continue;
    }

    const maxDelta    = DRIFT_RESISTANCE[trait];
    const resistance  = maxDelta * stabilityFactor * memoryFactor;

    // Clamp the delta to drift resistance limit
    const clampedDelta = Math.max(-resistance, Math.min(resistance, rawDelta));
    appliedDelta[trait] = clampedDelta;

    // Apply clamped delta
    let newValue = (newTraits[trait] ?? 0.5) + clampedDelta;

    // Apply hard bounds
    const bounds = TRAIT_BOUNDS[trait] || { min: 0, max: 1 };
    if (newValue < bounds.min) {
      violations.push(`${trait} hit lower bound (${bounds.min})`);
      newValue = bounds.min;
    } else if (newValue > bounds.max) {
      violations.push(`${trait} hit upper bound (${bounds.max})`);
      newValue = bounds.max;
    }

    // Flag abrupt inversion (proposed > 2× resistance)
    if (Math.abs(rawDelta) > maxDelta * 3) {
      violations.push(`${trait} abrupt inversion blocked: raw=${rawDelta.toFixed(3)} limit=${maxDelta}`);
    }

    newTraits[trait] = newValue;
  }

  // Apply baseline gravity after all deltas
  const withGravity = applyBaselineGravity(newTraits, baselineTraits, bondingLevel);

  // Final hard-bound pass after gravity
  for (const [trait, value] of Object.entries(withGravity)) {
    const bounds = TRAIT_BOUNDS[trait] || { min: 0, max: 1 };
    withGravity[trait] = Math.max(bounds.min, Math.min(bounds.max, value));
  }

  LOG.debug(
    `[PersonalityConsistency] bonding=${bondingLevel} memory=${memoryCount} violations=${violations.length}`
  );

  return { newTraits: withGravity, appliedDelta, violations };
}

/**
 * detectPersonalityDrift()
 *
 * Compares current traits to baseline and flags significant drift.
 * Used by identity continuity engine.
 *
 * @param {object} currentTraits
 * @param {object} baselineTraits
 * @returns {{ drifted: boolean, driftMap: object, maxDrift: number }}
 */
export function detectPersonalityDrift(currentTraits, baselineTraits = DEFAULT_PERSONALITY_BASELINE) {
  const DRIFT_THRESHOLD = 0.25; // > 25% drift from baseline = flagged
  const driftMap = {};
  let maxDrift = 0;

  for (const [trait, baseline] of Object.entries(baselineTraits)) {
    const current = currentTraits[trait] ?? baseline;
    const drift = Math.abs(current - baseline);
    driftMap[trait] = { baseline, current, drift, flagged: drift > DRIFT_THRESHOLD };
    if (drift > maxDrift) maxDrift = drift;
  }

  return {
    drifted: maxDrift > DRIFT_THRESHOLD,
    driftMap,
    maxDrift: parseFloat(maxDrift.toFixed(3)),
  };
}

/**
 * getPersonalitySignature()
 * Returns a stable string fingerprint of the current trait set.
 */
export function getPersonalitySignature(traits) {
  return Object.entries(traits)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v.toFixed(2)}`)
    .join('|');
}

/**
 * validatePersonalityConsistency()
 * Ensures proposed change didn't result in abrupt inversion.
 */
export function validatePersonalityConsistency(before, after) {
  const violations = [];
  for (const [trait, afterVal] of Object.entries(after)) {
    const beforeVal = before[trait] ?? DEFAULT_PERSONALITY_BASELINE[trait] ?? 0.5;
    const delta = Math.abs(afterVal - beforeVal);
    const limit = DRIFT_RESISTANCE[trait] ?? 0.05;

    if (delta > limit * 5) {
      violations.push(`${trait}: delta=${delta.toFixed(3)} exceeds 5× drift limit (${(limit*5).toFixed(3)})`);
    }
  }
  return { consistent: violations.length === 0, violations };
}
