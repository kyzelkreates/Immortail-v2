// ================================================================
// IMMORTAIL™ — MEMORY-WEIGHTED RESPONSE ENGINE
// SSOT: All reactions depend on past interaction history.
// Response = f(memory history + bonding + emotion baseline)
// ================================================================

import Logger from '../utils/logger.js';

const LOG = Logger.createScopedLogger('MemoryWeightedResponseEngine');

// ----------------------------------------------------------------
// MEMORY SIGNIFICANCE TIERS
// Memories carry different weights based on emotional charge.
// ----------------------------------------------------------------

export const MEMORY_SIGNIFICANCE = {
  CORE:     'core',     // foundational moments (first interaction, trauma, peak joy)
  HIGH:     'high',     // strong emotional charge
  MEDIUM:   'medium',   // typical interactions
  LOW:      'low',      // background/ambient interactions
  FADING:   'fading',   // old memories approaching decay
};

// Significance weight multipliers
const SIGNIFICANCE_WEIGHTS = {
  [MEMORY_SIGNIFICANCE.CORE]:   3.0,
  [MEMORY_SIGNIFICANCE.HIGH]:   2.0,
  [MEMORY_SIGNIFICANCE.MEDIUM]: 1.0,
  [MEMORY_SIGNIFICANCE.LOW]:    0.5,
  [MEMORY_SIGNIFICANCE.FADING]: 0.2,
};

// ----------------------------------------------------------------
// MEMORY DECAY MODEL
// Older memories carry less weight. Decay is logarithmic.
// ageDays: number of days since memory was created
// ----------------------------------------------------------------

function memoryDecayFactor(ageDays) {
  if (ageDays <= 0)   return 1.0;
  if (ageDays <= 1)   return 0.95;
  if (ageDays <= 7)   return 0.85;
  if (ageDays <= 30)  return 0.65;
  if (ageDays <= 90)  return 0.40;
  if (ageDays <= 180) return 0.20;
  return 0.10; // very old memories — faint echoes
}

// ----------------------------------------------------------------
// INTERACTION HISTORY SCORING
// Scores the overall interaction history for quality + volume.
// ----------------------------------------------------------------

/**
 * scoreInteractionHistory()
 *
 * @param {Array}  memories      - Array of memory objects
 * @param {string} currentEvent  - Event key being processed
 * @returns {{ score: number, positiveCount: number, negativeCount: number,
 *             totalWeight: number, significantMemories: Array }}
 */
export function scoreInteractionHistory(memories = [], currentEvent = '') {
  if (!memories.length) {
    return {
      score: 0.5,           // neutral baseline — no history
      positiveCount: 0,
      negativeCount: 0,
      totalWeight: 0,
      significantMemories: [],
      historyDepth: 0,
    };
  }

  let positiveWeight = 0;
  let negativeWeight = 0;
  let totalWeight    = 0;
  const significantMemories = [];

  for (const memory of memories) {
    const sigWeight   = SIGNIFICANCE_WEIGHTS[memory.significance] ?? 1.0;
    const decayFactor = memoryDecayFactor(memory.ageDays ?? 0);
    const memWeight   = sigWeight * decayFactor;

    totalWeight += memWeight;

    if (memory.valence === 'positive') {
      positiveWeight += memWeight;
      if (sigWeight >= 2.0) significantMemories.push({ ...memory, weight: memWeight });
    } else if (memory.valence === 'negative') {
      negativeWeight += memWeight;
      if (sigWeight >= 2.0) significantMemories.push({ ...memory, weight: memWeight });
    }
  }

  // Score: 0 (all negative) → 1 (all positive), 0.5 (neutral)
  const score = totalWeight > 0
    ? 0.5 + ((positiveWeight - negativeWeight) / (totalWeight * 2))
    : 0.5;

  return {
    score: Math.max(0, Math.min(1, score)),
    positiveCount: memories.filter(m => m.valence === 'positive').length,
    negativeCount: memories.filter(m => m.valence === 'negative').length,
    totalWeight: parseFloat(totalWeight.toFixed(3)),
    significantMemories,
    historyDepth: memories.length,
  };
}

// ----------------------------------------------------------------
// MEMORY INFLUENCE CALCULATION
// ----------------------------------------------------------------

/**
 * calculateMemoryInfluence()
 *
 * Returns a single influence scalar 0–1 representing how strongly
 * the dog's memory context should affect its current reaction.
 *
 * High influence = past experience heavily colours current response.
 * Low influence  = current event is processed more neutrally.
 *
 * @param {object} params
 * @param {Array}  params.memories           - Memory array
 * @param {number} params.bondingLevel        - 0–100
 * @param {object} params.currentEmotion      - Current emotion snapshot
 * @param {string} params.currentEventKey     - Event being processed
 * @param {number} params.recentInteractions  - Count in recent window
 * @returns {{ influence: number, historyScore: number, breakdown: object }}
 */
export function calculateMemoryInfluence({
  memories = [],
  bondingLevel = 50,
  currentEmotion = {},
  currentEventKey = '',
  recentInteractions = 0,
}) {
  // Step 1: Score history
  const history = scoreInteractionHistory(memories, currentEventKey);

  // Step 2: Bonding amplification
  // High bonding = memories matter MORE (trusted relationship)
  const bondingAmplifier = 0.5 + (bondingLevel / 100) * 0.5; // 0.5–1.0

  // Step 3: Emotional sensitivity
  // Fear and sadness increase memory influence (heightened state)
  const emotionalSensitivity = 1.0 +
    (currentEmotion.fear    ?? 0.1) * 0.3 +
    (currentEmotion.sadness ?? 0.1) * 0.2;

  // Step 4: Recent interaction volume modifier
  // More recent interactions = more context = higher influence
  const recencyBoost = Math.min(0.2, recentInteractions * 0.01);

  // Step 5: Combine
  const rawInfluence = (history.score * bondingAmplifier * emotionalSensitivity) + recencyBoost;

  const influence = Math.max(0, Math.min(1, rawInfluence));

  LOG.debug(
    `[MemoryWeightedResponse] influence=${influence.toFixed(3)} ` +
    `histScore=${history.score.toFixed(3)} bonding=${bondingLevel} ` +
    `depth=${history.historyDepth}`
  );

  return {
    influence,
    historyScore: history.score,
    breakdown: {
      historyScore:      history.score,
      bondingAmplifier,
      emotionalSensitivity: parseFloat(emotionalSensitivity.toFixed(3)),
      recencyBoost,
      rawInfluence:      parseFloat(rawInfluence.toFixed(3)),
      positiveCount:     history.positiveCount,
      negativeCount:     history.negativeCount,
      totalWeight:       history.totalWeight,
      historyDepth:      history.historyDepth,
    },
  };
}

// ----------------------------------------------------------------
// MEMORY SIGNIFICANCE CLASSIFIER
// Determines the significance of a new memory being created.
// ----------------------------------------------------------------

/**
 * classifyMemorySignificance()
 *
 * Given the emotional context at time of memory creation,
 * returns the appropriate significance tier.
 *
 * @param {object} emotionState - Current emotion at memory creation time
 * @param {boolean} isFirstInteraction
 * @param {boolean} isReunionEvent
 * @returns {string} MEMORY_SIGNIFICANCE tier
 */
export function classifyMemorySignificance(emotionState = {}, isFirstInteraction = false, isReunionEvent = false) {
  if (isFirstInteraction) return MEMORY_SIGNIFICANCE.CORE;
  if (isReunionEvent)     return MEMORY_SIGNIFICANCE.HIGH;

  const maxEmotion = Math.max(
    emotionState.joy          ?? 0,
    emotionState.fear         ?? 0,
    emotionState.sadness      ?? 0,
    emotionState.anticipation ?? 0,
  );

  if (maxEmotion > 0.80) return MEMORY_SIGNIFICANCE.HIGH;
  if (maxEmotion > 0.55) return MEMORY_SIGNIFICANCE.MEDIUM;
  if (maxEmotion > 0.30) return MEMORY_SIGNIFICANCE.LOW;
  return MEMORY_SIGNIFICANCE.FADING;
}

// ----------------------------------------------------------------
// PRIORITISATION — selects most relevant memories for context
// ----------------------------------------------------------------

/**
 * prioritiseMemories()
 *
 * Returns top-N most relevant memories for the current event context.
 * Relevance = significance × decay × event-type match.
 *
 * @param {Array}  memories     - Full memory array
 * @param {string} eventKey     - Current event
 * @param {number} topN         - Max memories to return
 * @returns {Array}
 */
export function prioritiseMemories(memories = [], eventKey = '', topN = 10) {
  const scored = memories.map(m => {
    const sigWeight   = SIGNIFICANCE_WEIGHTS[m.significance] ?? 1.0;
    const decayFactor = memoryDecayFactor(m.ageDays ?? 0);
    const eventMatch  = m.eventKey === eventKey ? 1.5 : 1.0;
    return { ...m, _relevanceScore: sigWeight * decayFactor * eventMatch };
  });

  return scored
    .sort((a, b) => b._relevanceScore - a._relevanceScore)
    .slice(0, topN);
}

// ----------------------------------------------------------------
// VALIDATION
// ----------------------------------------------------------------

/**
 * validateMemoryInfluence()
 * Asserts that memory influence is within valid range and non-null.
 */
export function validateMemoryInfluence(result) {
  const violations = [];
  if (result.influence === null || result.influence === undefined) {
    violations.push('influence is null/undefined');
  }
  if (result.influence < 0 || result.influence > 1) {
    violations.push(`influence out of range: ${result.influence}`);
  }
  if (result.historyScore < 0 || result.historyScore > 1) {
    violations.push(`historyScore out of range: ${result.historyScore}`);
  }
  return { valid: violations.length === 0, violations };
}
