// ================================================================
// IMMORTAIL™ Gen2 — PERSONALITY ENGINE
// Persistent companion identity. Emotional evolution. Continuity weighting.
// Reads/writes companionCore via storage SSOT ONLY.
// Prevents resets, drift, inconsistency, fragmentation.
// ================================================================

import storage  from '../../core/storage.js';
import { EventBus } from '../../core/eventBus.js';

const PERSONALITY_EVENTS = {
  TRAIT_EVOLVED:     'SYSTEM::PERSONALITY_TRAIT_EVOLVED',
  SNAPSHOT_SAVED:    'SYSTEM::PERSONALITY_SNAPSHOT_SAVED',
  DRIFT_DETECTED:    'SYSTEM::PERSONALITY_DRIFT_DETECTED',
  DRIFT_CORRECTED:   'SYSTEM::PERSONALITY_DRIFT_CORRECTED',
};

// Max safe change per evolution cycle (enforced from behaviourEvolutionEngine)
const MAX_DELTA_PER_CYCLE = 0.05;
const DRIFT_THRESHOLD     = 0.15;

// ── Read personality snapshot ──────────────────────────────────

export function getPersonalitySnapshot() {
  const core = storage.getCompanionCore();
  const be   = core?.behaviourEvolution ?? {};
  return {
    coreTraits:        be.coreTraits        ?? getDefaultTraits(),
    baselineTraits:    be.baselineTraits    ?? getDefaultTraits(),
    personalitySnapshot: be.personalitySnapshot ?? buildDefaultSnapshot(),
    stabilityController: be.stabilityController ?? buildDefaultStabilityController(),
    evolutionLog:      be.evolutionLog       ?? [],
    userInteractionProfile: be.userInteractionProfile ?? buildDefaultInteractionProfile(),
    adaptationMode:    be.adaptationMode     ?? 'safe',
    evolutionRate:     be.evolutionRate      ?? 'slow',
  };
}

export function getDefaultTraits() {
  return {
    curiosity:      0.5,
    playfulness:    0.5,
    calmness:       0.5,
    attachment:     0.7,
    responsiveness: 0.6,
    independence:   0.4,
  };
}

function buildDefaultSnapshot() {
  return {
    baselineIdentity: 'stable',
    emotionalTone:    'consistent',
    behaviourSignature: 'unique',
    driftIndex:       0.0,
    lastSnapshotAt:   null,
  };
}

function buildDefaultStabilityController() {
  return {
    driftDetection:        true,
    maxDeviationThreshold: DRIFT_THRESHOLD,
    correctionMode:        'auto',
    lockOnIdentityMismatch: true,
    frozenUntil:           null,
  };
}

function buildDefaultInteractionProfile() {
  return {
    preferredTone:             'balanced',
    interactionFrequency:      0,
    engagementType:            [],
    emotionalResponsePatterns: [],
    favouriteActivities:       [],
    environmentalPreferences:  [],
  };
}

// ── Trait evolution ─────────────────────────────────────────────

/**
 * Apply a safe incremental trait change.
 * Enforces MAX_DELTA_PER_CYCLE and drift protection.
 */
export function evolveTrait(traitName, observedPreference, reason = 'interaction') {
  const core = storage.getCompanionCore();
  const be   = core?.behaviourEvolution;
  if (!be?.evolutionEnabled) return null;
  if (be.adaptationMode !== 'safe') return null;

  // Check stability controller — frozen?
  const sc = be.stabilityController ?? buildDefaultStabilityController();
  if (sc.frozenUntil && Date.now() < sc.frozenUntil) return null;

  const current   = be.coreTraits?.[traitName];
  if (current === undefined) return null;

  const baseline  = be.baselineTraits?.[traitName] ?? current;
  const rawDelta  = (observedPreference - current) * MAX_DELTA_PER_CYCLE;
  const delta     = Math.max(-MAX_DELTA_PER_CYCLE, Math.min(MAX_DELTA_PER_CYCLE, rawDelta));
  const newValue  = Math.max(0, Math.min(1, current + delta));

  // Check drift against baseline
  const drift = Math.abs(newValue - baseline);
  if (drift > sc.maxDeviationThreshold) {
    _handleDrift(traitName, newValue, baseline, be, core);
    return null;
  }

  // Apply the change
  const updatedTraits = { ...be.coreTraits, [traitName]: newValue };
  const logEntry = {
    ts:           Date.now(),
    traitChanged: traitName,
    delta:        Number(delta.toFixed(4)),
    oldValue:     Number(current.toFixed(4)),
    newValue:     Number(newValue.toFixed(4)),
    reason,
    sourceEvent:  reason,
    reversible:   true,
  };

  const updatedLog = [...(be.evolutionLog ?? []).slice(-99), logEntry];

  storage.patchCompanionCore({
    behaviourEvolution: {
      ...be,
      coreTraits:   updatedTraits,
      evolutionLog: updatedLog,
    },
  });

  EventBus.emit(PERSONALITY_EVENTS.TRAIT_EVOLVED, { traitName, delta, newValue, reason });
  return { traitName, delta, newValue };
}

/**
 * Apply emotion-derived personality nudge from an AI response.
 */
export function applyEmotionNudge(normalizedResponse) {
  const emotion = normalizedResponse?.emotion;
  if (!emotion) return;

  const EMOTION_TRAIT_MAP = {
    happy:   { playfulness: 0.7, calmness: 0.4 },
    sad:     { calmness: 0.6,    attachment: 0.8 },
    curious: { curiosity: 0.8,   responsiveness: 0.7 },
    calm:    { calmness: 0.8,    independence: 0.5 },
    playful: { playfulness: 0.9, curiosity: 0.6 },
    neutral: {},
  };

  const nudges = EMOTION_TRAIT_MAP[emotion.detected] ?? {};
  Object.entries(nudges).forEach(([trait, pref]) => {
    evolveTrait(trait, pref, `emotion_nudge:${emotion.detected}`);
  });
}

// ── Drift detection + correction ────────────────────────────────

function _handleDrift(traitName, newValue, baseline, be, core) {
  console.warn(`[PersonalityEngine] Drift detected on "${traitName}" — correcting`);

  const sc  = be.stabilityController ?? buildDefaultStabilityController();
  const corrected = baseline; // Revert to baseline on drift

  const updatedTraits = { ...be.coreTraits, [traitName]: corrected };
  const frozenUntil   = Date.now() + 30000; // Freeze evolution for 30s

  storage.patchCompanionCore({
    behaviourEvolution: {
      ...be,
      coreTraits: updatedTraits,
      stabilityController: { ...sc, frozenUntil },
      personalitySnapshot: {
        ...be.personalitySnapshot,
        driftIndex: Math.abs(newValue - baseline),
        lastDriftAt: Date.now(),
      },
    },
  });

  EventBus.emit(PERSONALITY_EVENTS.DRIFT_DETECTED, { traitName, newValue, baseline });
  EventBus.emit(PERSONALITY_EVENTS.DRIFT_CORRECTED, { traitName, corrected });
}

// ── Attachment progression ───────────────────────────────────────

export function progressAttachment(interactionQuality = 0.5) {
  const core = storage.getCompanionCore();
  const ag   = core?.attachmentGraph;
  if (!ag) return;

  const STAGE_THRESHOLDS = {
    distant:        0.15,
    acquainted:     0.35,
    bonded:         0.60,
    closely_bonded: 0.80,
    deeply_bonded:  1.00,
  };

  const increment = interactionQuality * 0.01;
  const newBond   = Math.min(1, (ag.userBond ?? 0) + increment);

  let newStage = 'distant';
  for (const [stage, threshold] of Object.entries(STAGE_THRESHOLDS)) {
    if (newBond >= threshold * 0.9) newStage = stage;
  }
  // Map final
  if (newBond >= 0.80) newStage = 'deeply_bonded';
  else if (newBond >= 0.60) newStage = 'closely_bonded';
  else if (newBond >= 0.35) newStage = 'bonded';
  else if (newBond >= 0.15) newStage = 'acquainted';
  else newStage = 'distant';

  storage.patchCompanionCore({
    attachmentGraph: {
      ...ag,
      userBond:   newBond,
      bondStage:  newStage,
      lastInteractionAt: Date.now(),
      totalInteractions: (ag.totalInteractions ?? 0) + 1,
    },
  });
}

// ── Consistency check ────────────────────────────────────────────

export function verifyPersonalityConsistency() {
  const snap = getPersonalitySnapshot();
  const checks = {
    traitsValid:    Object.values(snap.coreTraits).every(v => v >= 0 && v <= 1),
    identityLocked: !!storage.getCompanionCore()?.identityLock?.signature,
    driftSafe:      (snap.personalitySnapshot?.driftIndex ?? 0) < DRIFT_THRESHOLD,
    evolutionSafe:  snap.adaptationMode === 'safe',
  };
  return {
    consistent: Object.values(checks).every(Boolean),
    checks,
    snapshot:   snap.personalitySnapshot,
  };
}
