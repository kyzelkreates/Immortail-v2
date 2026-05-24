// ================================================================
// IMMORTAIL™ — COMPANION INTELLIGENCE PIPELINE
// Connects all 5 intelligence engines into one ordered pipeline.
//
// FLOW:
// 1. Event arrives → meaning engine interprets
// 2. Memory engine calculates influence
// 3. Emotion engine updates state (causally)
// 4. Personality engine stabilises traits
// 5. Behaviour engine selects action
// 6. Identity engine validates continuity
// 7. Returns structured pipeline result for agent/service dispatch
//
// OUTPUT flows: engine → service → state → event → UI/3D
// NO DIRECT STATE MUTATION from within this pipeline.
// ================================================================

import Logger from '../utils/logger.js';
import { updateEmotionFromMeaning, getDominantEmotion, DEFAULT_EMOTION_STATE }
  from './emotionCausalityEngine.js';
import { decideBehaviorState, BEHAVIOR }
  from './behaviorDecisionEngine.js';
import { enforcePersonalityStability, DEFAULT_PERSONALITY_BASELINE }
  from './personalityConsistencyEngine.js';
import { calculateMemoryInfluence, classifyMemorySignificance }
  from './memoryWeightedResponseEngine.js';
import { validateIdentityContinuity, buildIdentitySignature }
  from './identityContinuityEngine.js';

const LOG = Logger.createScopedLogger('CompanionIntelligencePipeline');

// ----------------------------------------------------------------
// PIPELINE ENTRY POINT
// ----------------------------------------------------------------

/**
 * runCompanionPipeline()
 *
 * Executes the full 6-stage intelligence pipeline for one event.
 * Deterministic. No side effects. Returns structured result only.
 *
 * @param {object} params
 * @param {string}  params.eventKey          - System event identifier
 * @param {object}  params.previousState     - Full previous companion state
 * @param {Array}   params.memories          - Memory array
 * @param {number}  params.bondingLevel      - 0–100
 * @param {number}  params.timeSinceLastInteraction - seconds
 * @param {number}  params.recentEventCount  - Events in recent window
 * @param {number}  params.recentPositiveEvents
 *
 * @returns {{ newState: object, pipeline: object, valid: boolean }}
 */
export function runCompanionPipeline({
  eventKey,
  previousState,
  memories = [],
  bondingLevel = 50,
  timeSinceLastInteraction = 0,
  recentEventCount = 0,
  recentPositiveEvents = 0,
}) {
  const trace = [];
  const pipelineStart = Date.now();

  // ── Resolve previous state with defaults ─────────────────────
  const prevEmotion    = { ...DEFAULT_EMOTION_STATE, ...(previousState.emotionState || {}) };
  const prevTraits     = { ...DEFAULT_PERSONALITY_BASELINE, ...(previousState.personalityTraits || {}) };
  const prevBehavior   = previousState.behavior || BEHAVIOR.IDLE;
  const baselineTraits = previousState.baselineTraits || DEFAULT_PERSONALITY_BASELINE;

  // ================================================================
  // STAGE 1 — MEMORY INFLUENCE
  // ================================================================
  const memoryResult = calculateMemoryInfluence({
    memories,
    bondingLevel,
    currentEmotion: prevEmotion,
    currentEventKey: eventKey,
    recentInteractions: recentEventCount,
  });
  trace.push({
    stage: 1, name: 'MEMORY_INFLUENCE',
    output: { influence: memoryResult.influence, historyScore: memoryResult.historyScore },
  });

  // ================================================================
  // STAGE 2 — EMOTIONAL CAUSALITY
  // ================================================================
  const emotionResult = updateEmotionFromMeaning({
    eventKey,
    currentEmotion: prevEmotion,
    bondingLevel,
    memoryInfluence: memoryResult.influence,
  });
  trace.push({
    stage: 2, name: 'EMOTION_CAUSALITY',
    output: {
      meaning:  emotionResult.meaning,
      dominant: getDominantEmotion(emotionResult.newEmotion),
    },
  });

  // ================================================================
  // STAGE 3 — PERSONALITY STABILITY
  // ================================================================
  // Derive personality delta from emotion shift
  // (strong emotional events subtly reinforce related traits)
  const personalityDelta = derivePersonalityDelta(emotionResult.appliedDelta, bondingLevel);

  const personalityResult = enforcePersonalityStability({
    currentTraits: prevTraits,
    proposedDelta: personalityDelta,
    baselineTraits,
    bondingLevel,
    memoryCount: memories.length,
  });
  trace.push({
    stage: 3, name: 'PERSONALITY_STABILITY',
    output: {
      violations: personalityResult.violations.length,
      applied: Object.keys(personalityResult.appliedDelta).length,
    },
  });

  // ================================================================
  // STAGE 4 — BEHAVIOUR DECISION
  // ================================================================
  const behaviorResult = decideBehaviorState({
    emotionState: emotionResult.newEmotion,
    bondingLevel,
    recentEventCount,
    recentPositiveEvents,
    timeSinceLastInteraction,
  });
  trace.push({
    stage: 4, name: 'BEHAVIOR_DECISION',
    output: {
      behavior: behaviorResult.behavior,
      score:    parseFloat(behaviorResult.score.toFixed(2)),
    },
  });

  // ================================================================
  // STAGE 5 — MEMORY SIGNIFICANCE CLASSIFICATION
  // ================================================================
  const isFirstInteraction = memories.length === 0;
  const isReunionEvent     = eventKey === 'USER_RETURNED';
  const memorySig = classifyMemorySignificance(
    emotionResult.newEmotion,
    isFirstInteraction,
    isReunionEvent,
  );
  trace.push({
    stage: 5, name: 'MEMORY_CLASSIFY',
    output: { significance: memorySig },
  });

  // ================================================================
  // STAGE 6 — IDENTITY CONTINUITY VALIDATION
  // ================================================================
  const currentSnapshot = {
    emotionState:      emotionResult.newEmotion,
    personalityTraits: personalityResult.newTraits,
    behavior:          behaviorResult.behavior,
    bondingLevel,
  };
  const previousSnapshot = {
    emotionState:      prevEmotion,
    personalityTraits: prevTraits,
    behavior:          prevBehavior,
    bondingLevel,
  };

  const identityResult = validateIdentityContinuity(
    currentSnapshot,
    previousSnapshot,
    baselineTraits,
  );
  trace.push({
    stage: 6, name: 'IDENTITY_CONTINUITY',
    output: {
      continuous:       identityResult.continuous,
      continuityScore:  identityResult.continuityScore,
      driftSeverity:    identityResult.report.traitDrift.severity,
      transitionValid:  identityResult.report.behaviorTransition.valid,
    },
  });

  // ================================================================
  // ASSEMBLE OUTPUT
  // ================================================================
  const newState = {
    emotionState:        emotionResult.newEmotion,
    personalityTraits:   personalityResult.newTraits,
    behavior:            behaviorResult.behavior,
    behaviorDescription: behaviorResult.description,
    behaviorScore:       behaviorResult.score,
    dominantEmotion:     getDominantEmotion(emotionResult.newEmotion),
    meaning:             emotionResult.meaning,
    memoryInfluence:     memoryResult.influence,
    memorySig,
    continuityScore:     identityResult.continuityScore,
    identityContinuous:  identityResult.continuous,
    baselineTraits,
    bondingLevel,
    processedAt:         pipelineStart,
  };

  const valid =
    identityResult.continuous &&
    personalityResult.violations.filter(v => v.includes('abrupt')).length === 0;

  LOG.info(
    `[CompanionPipeline] ${eventKey} → meaning=${emotionResult.meaning} ` +
    `behavior=${behaviorResult.behavior} continuity=${identityResult.continuityScore} ` +
    `valid=${valid}`
  );

  return {
    newState,
    pipeline: {
      eventKey,
      stages: trace,
      durationMs: Date.now() - pipelineStart,
      valid,
      identityReport: identityResult.report,
      behaviorAllScores: behaviorResult.allScores,
      memoryBreakdown: memoryResult.breakdown,
    },
    valid,
  };
}

// ----------------------------------------------------------------
// PERSONALITY DELTA DERIVATION
// Maps emotion deltas to subtle personality reinforcement.
// Strong positive emotion → slight boost to affection/playfulness.
// Strong negative emotion → slight boost to independence/caution.
// ----------------------------------------------------------------

function derivePersonalityDelta(emotionDelta, bondingLevel) {
  const delta = {};
  const strength = bondingLevel / 100;

  const joyDelta   = emotionDelta.joy         ?? 0;
  const trustDelta = emotionDelta.trust        ?? 0;
  const fearDelta  = emotionDelta.fear         ?? 0;
  const sadDelta   = emotionDelta.sadness      ?? 0;
  const anticDelta = emotionDelta.anticipation ?? 0;

  if (joyDelta > 0.05) {
    delta.playfulness = joyDelta * 0.1 * strength;
    delta.affection   = joyDelta * 0.08 * strength;
  }
  if (trustDelta > 0.05) {
    delta.loyalty  = trustDelta * 0.12 * strength;
    delta.gentleness = trustDelta * 0.08 * strength;
  }
  if (anticDelta > 0.05) {
    delta.curiosity = anticDelta * 0.10 * strength;
    delta.energy    = anticDelta * 0.06 * strength;
  }
  if (fearDelta > 0.05) {
    delta.independence = fearDelta * 0.05 * strength;
    delta.affection    = (delta.affection ?? 0) - fearDelta * 0.05;
  }
  if (sadDelta > 0.05) {
    delta.energy = (delta.energy ?? 0) - sadDelta * 0.04 * strength;
  }

  return delta;
}
