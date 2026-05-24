// ================================================================
// IMMORTAIL™ — BEHAVIOURAL DECISION ENGINE
// SSOT: Behaviour is DECISION-based, not state-based.
// All decisions are deterministic, weighted, and traceable.
// ================================================================

import Logger from '../utils/logger.js';

const LOG = Logger.createScopedLogger('BehaviorDecisionEngine');

// ----------------------------------------------------------------
// BEHAVIOUR CATALOGUE
// ----------------------------------------------------------------

export const BEHAVIOR = {
  IDLE:             'idle',
  APPROACH_USER:    'approach_user',
  SEEK_ATTENTION:   'seek_attention',
  PLAY:             'play',
  REST:             'rest',
  OBSERVE:          'observe',
  AVOID_INTERACTION:'avoid_interaction',
};

// Behaviour descriptions (for trace + UI)
export const BEHAVIOR_DESCRIPTION = {
  [BEHAVIOR.IDLE]:              'Resting comfortably, no strong drive',
  [BEHAVIOR.APPROACH_USER]:     'Moving toward user with positive expectation',
  [BEHAVIOR.SEEK_ATTENTION]:    'Nudging, pawing, vocalising for attention',
  [BEHAVIOR.PLAY]:              'Actively engaging in play behaviour',
  [BEHAVIOR.REST]:              'Sleeping or deeply resting, low arousal',
  [BEHAVIOR.OBSERVE]:           'Watching user carefully, alert but cautious',
  [BEHAVIOR.AVOID_INTERACTION]: 'Withdrawing, seeking distance',
};

// ----------------------------------------------------------------
// DECISION SCORING RULES
// Each behaviour has a scoring function based on inputs.
// Inputs: emotion state (0–1), bondingLevel (0–100),
//         recentEventCount, timeSinceLastInteraction (seconds)
// Score range: 0–100 (higher = more likely to select)
// ----------------------------------------------------------------

const SCORING_RULES = {
  [BEHAVIOR.APPROACH_USER]: (inputs) => {
    const { joy, trust, anticipation, bondingLevel, timeSinceLastInteraction } = inputs;
    let score = 0;
    score += joy * 30;
    score += trust * 20;
    score += anticipation * 25;
    score += (bondingLevel / 100) * 20;
    // More likely to approach after absence
    if (timeSinceLastInteraction > 300) score += 15;
    if (timeSinceLastInteraction > 1800) score += 10;
    return score;
  },

  [BEHAVIOR.SEEK_ATTENTION]: (inputs) => {
    const { fear, sadness, joy, trust, bondingLevel, timeSinceLastInteraction } = inputs;
    let score = 0;
    score += fear * 20;       // anxiety drives attention-seeking
    score += sadness * 25;    // sadness drives attention-seeking
    score += joy * 10;        // mild joy also triggers approach
    score += (bondingLevel / 100) * 15;
    // Stronger if ignored for a long time
    if (timeSinceLastInteraction > 600) score += 20;
    if (timeSinceLastInteraction > 3600) score += 15;
    // Less if trust is very low (withdrawn instead)
    score -= (1 - trust) * 15;
    return score;
  },

  [BEHAVIOR.PLAY]: (inputs) => {
    const { joy, anticipation, bondingLevel, recentPositiveEvents } = inputs;
    let score = 0;
    score += joy * 40;
    score += anticipation * 35;
    score += (bondingLevel / 100) * 15;
    score += Math.min(recentPositiveEvents, 5) * 5;
    return score;
  },

  [BEHAVIOR.REST]: (inputs) => {
    const { joy, fear, anger, sadness, recentEventCount } = inputs;
    let score = 0;
    // Rest when low arousal
    score += (1 - joy) * 15;
    score += (1 - fear) * 20;
    score += (1 - anger) * 10;
    score += sadness * 10;
    // High event volume → fatigue → rest
    if (recentEventCount > 50) score += 20;
    if (recentEventCount > 100) score += 15;
    return score;
  },

  [BEHAVIOR.OBSERVE]: (inputs) => {
    const { fear, anticipation, trust, timeSinceLastInteraction } = inputs;
    let score = 0;
    score += fear * 20;           // mild fear → watchful
    score += anticipation * 25;   // curious anticipation
    score += (1 - trust) * 15;    // lower trust → more watchful
    // After long absence → observe before approach
    if (timeSinceLastInteraction > 600) score += 10;
    return score;
  },

  [BEHAVIOR.AVOID_INTERACTION]: (inputs) => {
    const { fear, anger, trust, sadness, bondingLevel } = inputs;
    let score = 0;
    score += fear * 35;
    score += anger * 30;
    score += sadness * 10;
    score -= trust * 30;          // high trust strongly suppresses avoidance
    score -= (bondingLevel / 100) * 25;
    return Math.max(0, score);
  },

  [BEHAVIOR.IDLE]: (inputs) => {
    const { joy, fear, anger, anticipation, sadness } = inputs;
    // Idle is the "resting" option — chosen when no strong drives
    const arousal = joy * 0.4 + fear * 0.3 + anger * 0.2 + anticipation * 0.3 + sadness * 0.2;
    return Math.max(0, 40 - (arousal * 60));
  },
};

// ----------------------------------------------------------------
// INPUT BUILDER
// Normalises raw state into decision inputs
// ----------------------------------------------------------------

/**
 * buildDecisionInputs()
 * Converts raw state objects into normalised decision input vector.
 *
 * @param {object} emotionState   - {joy, trust, fear, sadness, anger, anticipation}
 * @param {number} bondingLevel   - 0–100
 * @param {number} recentEventCount - total events in recent window
 * @param {number} recentPositiveEvents - positive events in recent window
 * @param {number} timeSinceLastInteraction - seconds
 * @returns {object} decision inputs
 */
export function buildDecisionInputs({
  emotionState = {},
  bondingLevel = 50,
  recentEventCount = 0,
  recentPositiveEvents = 0,
  timeSinceLastInteraction = 0,
}) {
  return {
    joy:          emotionState.joy          ?? 0.3,
    trust:        emotionState.trust        ?? 0.4,
    fear:         emotionState.fear         ?? 0.1,
    sadness:      emotionState.sadness      ?? 0.1,
    anger:        emotionState.anger        ?? 0.0,
    anticipation: emotionState.anticipation ?? 0.2,
    bondingLevel,
    recentEventCount,
    recentPositiveEvents,
    timeSinceLastInteraction,
  };
}

// ----------------------------------------------------------------
// CORE PUBLIC API
// ----------------------------------------------------------------

/**
 * decideBehaviorState()
 *
 * Deterministically selects the highest-scoring behaviour based
 * on current system state. No randomness. Fully traceable.
 *
 * @param {object} params - see buildDecisionInputs()
 * @returns {{ behavior: string, score: number, allScores: object, inputs: object }}
 */
export function decideBehaviorState(params) {
  const inputs = buildDecisionInputs(params);
  const allScores = {};

  for (const [behavior, scoreFn] of Object.entries(SCORING_RULES)) {
    allScores[behavior] = Math.max(0, scoreFn(inputs));
  }

  // Select highest score
  let winner = BEHAVIOR.IDLE;
  let maxScore = -Infinity;
  for (const [behavior, score] of Object.entries(allScores)) {
    if (score > maxScore) {
      maxScore = score;
      winner = behavior;
    }
  }

  LOG.debug(
    `[BehaviorDecision] winner=${winner} score=${maxScore.toFixed(1)} | joy=${inputs.joy.toFixed(2)} trust=${inputs.trust.toFixed(2)} fear=${inputs.fear.toFixed(2)} bonding=${inputs.bondingLevel}`
  );

  return {
    behavior: winner,
    score: maxScore,
    description: BEHAVIOR_DESCRIPTION[winner],
    allScores,
    inputs,
  };
}

/**
 * rankBehaviors()
 * Returns all behaviours ranked by score descending.
 * Useful for trace/debug.
 */
export function rankBehaviors(params) {
  const result = decideBehaviorState(params);
  const ranked = Object.entries(result.allScores)
    .sort(([, a], [, b]) => b - a)
    .map(([behavior, score]) => ({ behavior, score: parseFloat(score.toFixed(2)) }));
  return { ranked, winner: result.behavior, inputs: result.inputs };
}

/**
 * validateBehaviorDecision()
 * Asserts that the decision is consistent with the inputs.
 * Used in test pipeline.
 */
export function validateBehaviorDecision(behavior, inputs, expectation) {
  const result = decideBehaviorState(inputs);
  const actual = result.behavior;
  const pass = actual === expectation;

  return {
    pass,
    expected: expectation,
    actual,
    score: result.allScores[expectation],
    winnerScore: result.score,
    gap: result.score - (result.allScores[expectation] ?? 0),
    allScores: result.allScores,
  };
}
