// ================================================================
// IMMORTAIL™ — IDENTITY CONTINUITY ENGINE
// SSOT: The dog is ONE consistent entity across time.
// Monitors trait drift, behaviour consistency, and identity coherence.
// ================================================================

import Logger from '../utils/logger.js';
import { getEmotionSignature } from './emotionCausalityEngine.js';
import { getPersonalitySignature, detectPersonalityDrift } from './personalityConsistencyEngine.js';

const LOG = Logger.createScopedLogger('IdentityContinuityEngine');

// ----------------------------------------------------------------
// IDENTITY SIGNATURE SCHEMA
// ----------------------------------------------------------------

/**
 * buildIdentitySignature()
 *
 * Creates a stable fingerprint of the dog's current identity state.
 * Used to detect drift across time.
 *
 * @param {object} emotionState
 * @param {object} personalityTraits
 * @param {string} dominantBehavior
 * @param {number} bondingLevel
 * @returns {{ signature: string, components: object }}
 */
export function buildIdentitySignature(emotionState, personalityTraits, dominantBehavior, bondingLevel) {
  const emoSig  = getEmotionSignature(emotionState);
  const persSig = getPersonalitySignature(personalityTraits);
  const bondSig = `bond:${bondingLevel.toFixed(0)}`;
  const behSig  = `beh:${dominantBehavior}`;

  // Simple deterministic hash (not crypto — just a comparison key)
  const raw = `${emoSig}||${persSig}||${bondSig}||${behSig}`;
  const hashCode = raw.split('').reduce((acc, ch) => {
    return ((acc << 5) - acc) + ch.charCodeAt(0) | 0;
  }, 0);

  return {
    signature:  Math.abs(hashCode).toString(16).padStart(8, '0'),
    components: { emoSig, persSig, bondSig, behSig, raw },
  };
}

// ----------------------------------------------------------------
// CONTINUITY SCORING
// Produces a 0–1 score measuring identity stability between two states.
// ----------------------------------------------------------------

/**
 * scoreContinuity()
 *
 * Compares two identity snapshots and returns a continuity score.
 * 1.0 = identical  /  0.0 = completely inconsistent
 *
 * @param {object} snapshotA - { emotionState, personalityTraits, behavior, bondingLevel }
 * @param {object} snapshotB
 * @returns {{ continuityScore: number, breakdown: object }}
 */
export function scoreContinuity(snapshotA, snapshotB) {
  const scores = {};

  // ── Emotion continuity (cosine-like distance) ─────────────────
  const emotionKeys = ['joy','trust','fear','sadness','anger','anticipation'];
  let emoSimilarity = 0;
  let emoCount = 0;
  for (const key of emotionKeys) {
    const a = snapshotA.emotionState[key] ?? 0;
    const b = snapshotB.emotionState[key] ?? 0;
    const diff = Math.abs(a - b);
    emoSimilarity += Math.max(0, 1 - diff * 2); // 0.5 diff = 0 score
    emoCount++;
  }
  scores.emotion = emoSimilarity / emoCount;

  // ── Personality continuity ─────────────────────────────────────
  const traitKeys = Object.keys(snapshotA.personalityTraits || {});
  let persSimilarity = 0;
  let persCount = 0;
  for (const key of traitKeys) {
    const a = snapshotA.personalityTraits[key] ?? 0.5;
    const b = snapshotB.personalityTraits[key] ?? 0.5;
    const diff = Math.abs(a - b);
    persSimilarity += Math.max(0, 1 - diff * 3); // 0.33 diff = 0 score
    persCount++;
  }
  scores.personality = persCount > 0 ? persSimilarity / persCount : 1.0;

  // ── Behaviour continuity ───────────────────────────────────────
  scores.behavior = snapshotA.behavior === snapshotB.behavior ? 1.0 : 0.3;

  // ── Bonding continuity ─────────────────────────────────────────
  const bondDiff = Math.abs(snapshotA.bondingLevel - snapshotB.bondingLevel) / 100;
  scores.bonding = Math.max(0, 1 - bondDiff * 5);

  // ── Weighted average ──────────────────────────────────────────
  const continuityScore =
    scores.emotion     * 0.30 +
    scores.personality * 0.40 +
    scores.behavior    * 0.15 +
    scores.bonding     * 0.15;

  return {
    continuityScore: parseFloat(continuityScore.toFixed(3)),
    breakdown: {
      emotion:     parseFloat(scores.emotion.toFixed(3)),
      personality: parseFloat(scores.personality.toFixed(3)),
      behavior:    parseFloat(scores.behavior.toFixed(3)),
      bonding:     parseFloat(scores.bonding.toFixed(3)),
    },
  };
}

// ----------------------------------------------------------------
// BEHAVIOURAL CONSISTENCY VALIDATION
// ----------------------------------------------------------------

// Valid behaviour transition table.
// Some transitions are natural; others are flags for inconsistency.
const VALID_TRANSITIONS = {
  idle:              ['approach_user', 'observe', 'rest', 'idle', 'seek_attention'],
  approach_user:     ['play', 'seek_attention', 'idle', 'observe', 'approach_user'],
  seek_attention:    ['play', 'approach_user', 'idle', 'rest', 'observe'],
  play:              ['idle', 'seek_attention', 'rest', 'observe', 'approach_user'],
  rest:              ['idle', 'observe', 'approach_user'],
  observe:           ['idle', 'approach_user', 'seek_attention', 'rest', 'avoid_interaction'],
  avoid_interaction: ['observe', 'rest', 'idle'],
};

/**
 * validateBehaviourTransition()
 * Checks whether a behaviour change is contextually valid.
 *
 * @param {string} fromBehavior
 * @param {string} toBehavior
 * @returns {{ valid: boolean, reason: string }}
 */
export function validateBehaviourTransition(fromBehavior, toBehavior) {
  if (fromBehavior === toBehavior) {
    return { valid: true, reason: 'same behavior — no transition' };
  }
  const allowed = VALID_TRANSITIONS[fromBehavior] || [];
  if (allowed.includes(toBehavior)) {
    return { valid: true, reason: `${fromBehavior} → ${toBehavior} is a valid transition` };
  }
  return {
    valid: false,
    reason: `${fromBehavior} → ${toBehavior} is an abrupt/invalid transition`,
  };
}

// ----------------------------------------------------------------
// TRAIT DRIFT DETECTION
// ----------------------------------------------------------------

/**
 * detectTraitDrift()
 * Wraps personalityConsistencyEngine.detectPersonalityDrift
 * and adds identity-level severity classification.
 */
export function detectTraitDrift(currentTraits, baselineTraits) {
  const driftResult = detectPersonalityDrift(currentTraits, baselineTraits);

  let severity = 'none';
  if (driftResult.maxDrift > 0.40) severity = 'critical';
  else if (driftResult.maxDrift > 0.25) severity = 'moderate';
  else if (driftResult.maxDrift > 0.10) severity = 'minor';

  return { ...driftResult, severity };
}

// ----------------------------------------------------------------
// CORE PUBLIC API
// ----------------------------------------------------------------

/**
 * validateIdentityContinuity()
 *
 * Full identity check — runs all consistency validations
 * and returns a structured continuity report.
 *
 * @param {object} currentSnapshot   - { emotionState, personalityTraits, behavior, bondingLevel }
 * @param {object} previousSnapshot  - Previous identity state
 * @param {object} baselineTraits    - Original personality baseline from profile
 * @returns {{ continuous: boolean, continuityScore: number, report: object }}
 */
export function validateIdentityContinuity(currentSnapshot, previousSnapshot, baselineTraits) {
  const report = {};

  // ── Signature ────────────────────────────────────────────────
  const currentSig  = buildIdentitySignature(
    currentSnapshot.emotionState,
    currentSnapshot.personalityTraits,
    currentSnapshot.behavior,
    currentSnapshot.bondingLevel,
  );
  const previousSig = buildIdentitySignature(
    previousSnapshot.emotionState,
    previousSnapshot.personalityTraits,
    previousSnapshot.behavior,
    previousSnapshot.bondingLevel,
  );

  report.currentSignature  = currentSig.signature;
  report.previousSignature = previousSig.signature;
  report.signatureChanged  = currentSig.signature !== previousSig.signature;

  // ── Continuity score ─────────────────────────────────────────
  const continuity = scoreContinuity(previousSnapshot, currentSnapshot);
  report.continuityScore = continuity.continuityScore;
  report.continuityBreakdown = continuity.breakdown;

  // ── Behaviour transition ─────────────────────────────────────
  const transition = validateBehaviourTransition(
    previousSnapshot.behavior,
    currentSnapshot.behavior,
  );
  report.behaviorTransition = transition;

  // ── Trait drift ──────────────────────────────────────────────
  const drift = detectTraitDrift(currentSnapshot.personalityTraits, baselineTraits);
  report.traitDrift = drift;

  // ── Overall verdict ──────────────────────────────────────────
  const CONTINUITY_THRESHOLD = 0.50; // minimum score for "continuous" identity
  const continuous =
    continuity.continuityScore >= CONTINUITY_THRESHOLD &&
    transition.valid &&
    drift.severity !== 'critical';

  LOG.debug(
    `[IdentityContinuity] score=${continuity.continuityScore} ` +
    `transition=${transition.valid} drift=${drift.severity} ` +
    `continuous=${continuous}`
  );

  return {
    continuous,
    continuityScore: continuity.continuityScore,
    report: {
      ...report,
      continuous,
      recommendations: buildRecommendations(continuity, transition, drift),
    },
  };
}

// ----------------------------------------------------------------
// RECOMMENDATIONS
// ----------------------------------------------------------------

function buildRecommendations(continuity, transition, drift) {
  const recs = [];
  if (continuity.continuityScore < 0.5) {
    recs.push('Apply stronger personality stability constraints to resist rapid change.');
  }
  if (!transition.valid) {
    recs.push(`Behaviour transition issue: ${transition.reason}`);
  }
  if (drift.severity === 'critical') {
    recs.push('Critical trait drift detected — memory reinforcement needed to restore baseline.');
  } else if (drift.severity === 'moderate') {
    recs.push('Moderate drift — increase baseline gravity strength or reduce event intensity.');
  }
  if (recs.length === 0) recs.push('Identity is stable — no action required.');
  return recs;
}
