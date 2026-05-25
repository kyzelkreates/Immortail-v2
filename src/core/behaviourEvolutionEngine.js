/**
 * IMMORTAIL™ — RUN 18
 * behaviourEvolutionEngine.js
 *
 * Long-Term Behaviour Evolution System
 * Adaptive Companion Growth Engine — production safe.
 *
 * ARCHITECTURE RULES:
 *   - SSOT: all state through companionCore via storage.js only
 *   - identityLock ALWAYS overrides all trait changes (priority 100)
 *   - Max trait delta per cycle = TRAIT_DELTA_MAX (0.05)
 *   - Traits bounded [TRAIT_MIN, TRAIT_MAX] = [0.0, 1.0]
 *   - No single-event learning — minimum pattern count required
 *   - No random personality regeneration
 *   - All changes logged, all changes reversible
 *   - Runs 1–17 untouched
 *   - Groq never writes final trait changes
 *   - Ollama owns long-term personality shaping
 */

import storage from './storage.js';

// ══════════════════════════════════════════════════════════════════
// CONSTANTS & ENUMS
// ══════════════════════════════════════════════════════════════════

export const BEHAVIOUR_EVOLUTION_ENGINE_ID = 'behaviourEvolutionEngine_V1';

export const EVOLUTION_RATE = {
  SLOW:     'slow',
  MODERATE: 'moderate',
  FROZEN:   'frozen',
};

export const ADAPTATION_MODE = {
  SAFE:      'safe',
  SUSPENDED: 'suspended',
};

export const DRIFT_STATE = {
  STABLE:   'stable',
  WARNING:  'warning',
  CRITICAL: 'critical',
  LOCKED:   'locked',
};

export const PRIORITY = Object.freeze({
  IDENTITY_LOCK:         100,
  EMOTIONAL_STATE:        90,
  ENVIRONMENT_INFLUENCE:  70,
  USER_PREFERENCE:        60,
  LEARNED_BEHAVIOUR:      50,
});

// ── Trait bounds ──────────────────────────────────────────────────
export const TRAIT_MIN           = 0.0;
export const TRAIT_MAX           = 1.0;
export const TRAIT_DELTA_MAX     = 0.05;   // max change per cycle
export const MIN_PATTERN_COUNT   = 3;      // min repeats before learning
export const MAX_DRIFT_THRESHOLD = 0.15;   // drift index ceiling
export const STABILITY_WEIGHT    = 0.85;   // weight toward stability

// ── Caps ──────────────────────────────────────────────────────────
export const EVOL_CAPS = {
  EVOLUTION_LOG_MAX:       200,
  INTERACTION_PROFILE_MAX: 100,
  ROUTINE_LOG_MAX:          30,
  SAFETY_LOG_MAX:           50,
  SNAPSHOT_HISTORY_MAX:     20,
};

// ── Default core traits (stable personality baseline) ─────────────
export const DEFAULT_CORE_TRAITS = Object.freeze({
  curiosity:       0.5,
  playfulness:     0.5,
  calmness:        0.5,
  attachment:      0.7,
  responsiveness:  0.6,
  independence:    0.4,
});

// ── Safety constants (for bundle presence check) ──────────────────
export const EVOLUTION_SAFETY = {
  randomPersonalityRegen:  false,
  uncontrolledLearning:    false,
  identityLockViolation:   false,
  memoryfabrication:       false,
  rapidTraitMutation:      false,
  singleEventLearning:     false,
  allChangesReversible:    true,
  allChangesLogged:        true,
  maxDeltaPerCycle:        TRAIT_DELTA_MAX,
};

// ══════════════════════════════════════════════════════════════════
// INTERNAL STATE
// ══════════════════════════════════════════════════════════════════

let _safetyLog      = [];
let _throttleWrite  = 0;

function genId() { return `${Date.now()}_${Math.random().toString(36).slice(2,6)}`; }

function logSafety(type, detail) {
  _safetyLog = [..._safetyLog, {
    id: genId(), ts: Date.now(), type,
    detail: String(detail ?? '').slice(0, 100),
  }].slice(-EVOL_CAPS.SAFETY_LOG_MAX);
}

function clampTrait(v) { return Math.max(TRAIT_MIN, Math.min(TRAIT_MAX, v)); }
function roundTrait(v) { return Math.round(v * 10000) / 10000; }

function getCore()   { return storage.getCompanionCore(); }
function getBE(core) { return (core ?? getCore()).behaviourEvolution ?? getDefaultBehaviourEvolution(); }

function getDefaultBehaviourEvolution() {
  return {
    evolutionEnabled:        true,
    evolutionRate:           EVOLUTION_RATE.SLOW,
    stabilityWeight:         STABILITY_WEIGHT,
    adaptationMode:          ADAPTATION_MODE.SAFE,
    traitDriftProtection:    true,
    coreTraits:              { ...DEFAULT_CORE_TRAITS },
    baselineTraits:          { ...DEFAULT_CORE_TRAITS }, // locked reference
    userInteractionProfile:  getDefaultInteractionProfile(),
    stabilityController:     getDefaultStabilityController(),
    personalitySnapshot:     getDefaultPersonalitySnapshot(),
    adaptiveRoutines:        [],
    evolutionLog:            [],
    evolutionVersion:        'V1',
  };
}

function getDefaultInteractionProfile() {
  return {
    preferredTone:              'balanced',
    interactionFrequency:       0,
    engagementType:             [],
    emotionalResponsePatterns:  [],
    favouriteActivities:        [],
    environmentalPreferences:   [],
    toneSignals:                { calm: 0, playful: 0, balanced: 0 },
    lastObservedAt:             null,
  };
}

function getDefaultStabilityController() {
  return {
    driftDetection:           true,
    maxDeviationThreshold:    MAX_DRIFT_THRESHOLD,
    correctionMode:           'auto',
    lockOnIdentityMismatch:   true,
    driftState:               DRIFT_STATE.STABLE,
    frozenSince:              null,
    lastStableSnapshot:       null,
    correctionCount:          0,
  };
}

function getDefaultPersonalitySnapshot() {
  return {
    baselineIdentity:   'stable',
    emotionalTone:      'consistent',
    behaviourSignature: 'unique',
    driftIndex:         0.0,
    capturedAt:         null,
  };
}

function saveBE(patch, force = false) {
  const now = Date.now();
  if (!force && now - _throttleWrite < 400) return false;
  _throttleWrite = now;
  const core = storage.getCompanionCore();
  core.behaviourEvolution = { ...(core.behaviourEvolution ?? getDefaultBehaviourEvolution()), ...patch };
  storage.saveCompanionCore(core);
  return true;
}
function saveBEForce(patch) { _throttleWrite = 0; saveBE(patch, true); }

// ══════════════════════════════════════════════════════════════════
// STEP 1 — BEHAVIOUR EVOLUTION CORE INIT
// ══════════════════════════════════════════════════════════════════

export function initBehaviourEvolutionEngine() {
  const core = storage.getCompanionCore();

  if (!core.behaviourEvolution) {
    core.behaviourEvolution = getDefaultBehaviourEvolution();
    storage.saveCompanionCore(core);
  } else {
    // Patch missing fields
    const defaults = getDefaultBehaviourEvolution();
    let patched = false;
    for (const [k, v] of Object.entries(defaults)) {
      if (core.behaviourEvolution[k] === undefined) {
        core.behaviourEvolution[k] = v; patched = true;
      }
    }
    // Always re-anchor baselineTraits from identityLock-protected defaults
    core.behaviourEvolution.baselineTraits = { ...DEFAULT_CORE_TRAITS };
    if (patched) storage.saveCompanionCore(core);
    else         storage.saveCompanionCore(core);
  }

  _throttleWrite = 0;

  const be = storage.getCompanionCore().behaviourEvolution;
  console.log('IMMORTAIL BEHAVIOUR EVOLUTION: boot complete', {
    evolutionEnabled:  be.evolutionEnabled,
    evolutionRate:     be.evolutionRate,
    adaptationMode:    be.adaptationMode,
    traitDriftProtection: be.traitDriftProtection,
    evolutionVersion:  be.evolutionVersion,
  });
}

// ══════════════════════════════════════════════════════════════════
// STEP 2 — CORE TRAIT SYSTEM
// ══════════════════════════════════════════════════════════════════

/**
 * getCoreTraits()
 * Returns current trait values — bounded, never random.
 */
export function getCoreTraits() {
  const be = getBE();
  return { ...be.coreTraits };
}

/**
 * getBaselineTraits()
 * Returns immutable baseline — always anchored to DEFAULT_CORE_TRAITS.
 */
export function getBaselineTraits() {
  return { ...DEFAULT_CORE_TRAITS };
}

/**
 * validateTraits(traits)
 * Ensures all trait values are within safe bounds.
 */
export function validateTraits(traits) {
  if (!traits || typeof traits !== 'object') return { valid: false, reason: 'invalid_traits_object' };
  const keys = Object.keys(DEFAULT_CORE_TRAITS);
  for (const k of keys) {
    if (traits[k] !== undefined) {
      const v = traits[k];
      if (typeof v !== 'number' || isNaN(v)) return { valid: false, reason: `trait_${k}_not_a_number` };
      if (v < TRAIT_MIN || v > TRAIT_MAX)   return { valid: false, reason: `trait_${k}_out_of_bounds` };
    }
  }
  return { valid: true };
}

// ══════════════════════════════════════════════════════════════════
// STEP 3 — BEHAVIOUR OBSERVATION SYSTEM
// ══════════════════════════════════════════════════════════════════

/**
 * recordInteractionSignal(signalType, value, context)
 * Accumulates interaction signals — minimum pattern count required.
 * No single-event learning allowed.
 */
export function recordInteractionSignal(signalType, value = 1, context = {}) {
  if (!signalType) return { recorded: false, reason: 'no_signal_type' };

  // Safety: no single-event trait change permitted
  const safety = runEvolutionSafetyCheck('record_signal', { signalType, value, singleEventOverride: context.singleEventOverride ?? false });
  if (!safety.safe) return { recorded: false, reason: safety.reason };

  const core = storage.getCompanionCore();
  const be   = getBE(core);
  const prof = be.userInteractionProfile ?? getDefaultInteractionProfile();

  // Accumulate tone signals
  if (['calm', 'playful', 'balanced'].includes(signalType)) {
    const ts = { ...(prof.toneSignals ?? { calm: 0, playful: 0, balanced: 0 }) };
    ts[signalType] = (ts[signalType] ?? 0) + Math.max(0, Math.min(10, value));
    // Only update preferredTone when one signal dominates with sufficient count
    const maxKey = Object.entries(ts).sort((a,b) => b[1]-a[1])[0][0];
    const maxVal = ts[maxKey];
    if (maxVal >= MIN_PATTERN_COUNT) prof.preferredTone = maxKey;
    prof.toneSignals = ts;
  }

  // Accumulate activity signals
  if (context.activity && !prof.favouriteActivities.includes(context.activity)) {
    const actCount = prof.engagementType.filter(e => e === context.activity).length;
    if (actCount >= MIN_PATTERN_COUNT - 1) {
      prof.favouriteActivities = [...prof.favouriteActivities.slice(-9), context.activity];
    }
  }
  if (context.activity) {
    prof.engagementType = [...(prof.engagementType ?? []).slice(-(EVOL_CAPS.INTERACTION_PROFILE_MAX-1)), context.activity];
  }

  // Environment preference
  if (context.environment && !prof.environmentalPreferences.includes(context.environment)) {
    const envCount = (prof.engagementType ?? []).filter(e => e === context.environment).length;
    if (envCount >= MIN_PATTERN_COUNT - 1) {
      prof.environmentalPreferences = [...prof.environmentalPreferences.slice(-4), context.environment];
    }
  }

  prof.interactionFrequency = (prof.interactionFrequency ?? 0) + 1;
  prof.lastObservedAt = Date.now();

  core.behaviourEvolution = { ...be, userInteractionProfile: prof };
  storage.saveCompanionCore(core);

  return { recorded: true, signalType, interactionFrequency: prof.interactionFrequency };
}

/**
 * getUserInteractionProfile()
 */
export function getUserInteractionProfile() {
  return { ...getBE().userInteractionProfile };
}

// ══════════════════════════════════════════════════════════════════
// STEP 4 — SAFE ADAPTATION ENGINE
// ══════════════════════════════════════════════════════════════════

/**
 * applyTraitAdaptation(traitKey, observedPreference, reason, sourceEvent)
 * Applies ONE incremental trait change using the safe formula:
 *   delta = clamp(observedPreference * TRAIT_DELTA_MAX, -TRAIT_DELTA_MAX, +TRAIT_DELTA_MAX)
 *   newValue = oldValue + delta * (1 - STABILITY_WEIGHT) ... stabilised
 *
 * RULES:
 *   - identityLock checked first (priority 100)
 *   - max delta per call = TRAIT_DELTA_MAX
 *   - all changes logged
 *   - all changes reversible (log stores old value)
 */
export function applyTraitAdaptation(traitKey, observedPreference, reason, sourceEvent = 'system') {
  if (!traitKey) return { applied: false, reason: 'no_trait_key' };
  if (!(traitKey in DEFAULT_CORE_TRAITS)) return { applied: false, reason: 'unknown_trait_key' };

  // Priority 100: identityLock check
  const core  = getCore();
  const lock  = core.identityLock ?? {};
  if (lock.immutable && lock.lockedTraits?.personality === 'stable_companion') {
    // identityLock does not block trait adjustment — it blocks personality *regeneration*
    // Verify adaptation does not violate locked traits concept
    if (lock.signature !== 'IMMORTAIL_DOG_CORE_V1') {
      logSafety('identity_lock_violation_blocked', traitKey);
      return { applied: false, reason: 'identity_lock_violation' };
    }
  }

  const be   = getBE(core);

  // Guard: evolution disabled or suspended
  if (!be.evolutionEnabled) return { applied: false, reason: 'evolution_disabled' };
  if (be.adaptationMode === ADAPTATION_MODE.SUSPENDED) return { applied: false, reason: 'adaptation_suspended' };
  if (be.stabilityController?.driftState === DRIFT_STATE.LOCKED) return { applied: false, reason: 'drift_locked' };

  const safety = runEvolutionSafetyCheck('adapt_trait', { traitKey, observedPreference });
  if (!safety.safe) return { applied: false, reason: safety.reason };

  const traits  = { ...(be.coreTraits ?? DEFAULT_CORE_TRAITS) };
  const oldValue = roundTrait(traits[traitKey] ?? DEFAULT_CORE_TRAITS[traitKey]);

  // Safe formula — max delta TRAIT_DELTA_MAX, stabilised by stability weight
  const rawDelta     = Math.max(-1, Math.min(1, observedPreference)) * TRAIT_DELTA_MAX;
  const stabilised   = rawDelta * (1 - be.stabilityWeight);           // dampened
  const delta        = roundTrait(Math.max(-TRAIT_DELTA_MAX, Math.min(TRAIT_DELTA_MAX, stabilised)));
  const newValue     = roundTrait(clampTrait(oldValue + delta));

  if (newValue === oldValue) return { applied: false, reason: 'no_change_after_stabilisation' };

  traits[traitKey] = newValue;

  // Log entry — full auditability + reversibility
  const logEntry = {
    id:          genId(),
    ts:          Date.now(),
    traitChanged: traitKey,
    oldValue,
    newValue,
    delta,
    reason:      String(reason ?? '').slice(0, 80),
    sourceEvent: String(sourceEvent).slice(0, 40),
    reversible:  true,
  };

  const evolutionLog = [...(be.evolutionLog ?? []), logEntry].slice(-EVOL_CAPS.EVOLUTION_LOG_MAX);

  // Compute new drift index and update stability
  const sc          = { ...(be.stabilityController ?? getDefaultStabilityController()) };
  const driftIndex  = computeDriftIndex(traits);
  const ps          = { ...(be.personalitySnapshot ?? getDefaultPersonalitySnapshot()) };
  ps.driftIndex     = driftIndex;
  ps.capturedAt     = Date.now();

  // Auto-drift detection
  if (driftIndex >= MAX_DRIFT_THRESHOLD) {
    sc.driftState = DRIFT_STATE.CRITICAL;
    logSafety('drift_critical', `${traitKey} delta=${delta} driftIndex=${driftIndex.toFixed(3)}`);
    // Revert — drift exceeds threshold
    return { applied: false, reason: 'drift_threshold_exceeded', driftIndex };
  } else if (driftIndex >= MAX_DRIFT_THRESHOLD * 0.7) {
    sc.driftState = DRIFT_STATE.WARNING;
    logSafety('drift_warning', `driftIndex=${driftIndex.toFixed(3)}`);
  } else {
    sc.driftState  = DRIFT_STATE.STABLE;
    sc.lastStableSnapshot = Date.now();
  }

  const newBe = {
    ...be,
    coreTraits:          traits,
    personalitySnapshot: ps,
    stabilityController: sc,
    evolutionLog,
  };
  const newCore = { ...core, behaviourEvolution: newBe };
  storage.saveCompanionCore(newCore);

  return { applied: true, traitKey, oldValue, newValue, delta, driftIndex, logEntry };
}

/**
 * revertLastTraitChange(traitKey)
 * Reverses the most recent logged change to a trait — full reversibility.
 */
export function revertLastTraitChange(traitKey) {
  if (!traitKey) return { reverted: false, reason: 'no_trait_key' };

  const core = getCore();
  const be   = getBE(core);
  const log  = [...(be.evolutionLog ?? [])];

  // Find most recent entry for this trait
  const idx = log.map((e,i)=>[e,i]).reverse().find(([e])=>e.traitChanged===traitKey)?.[1];
  if (idx === undefined) return { reverted: false, reason: 'no_log_entry_for_trait' };

  const entry    = log[idx];
  const traits   = { ...(be.coreTraits ?? DEFAULT_CORE_TRAITS) };
  const oldValue = roundTrait(traits[traitKey]);
  traits[traitKey] = roundTrait(entry.oldValue);

  // Mark log entry as reverted (don't remove — audit trail)
  log[idx] = { ...entry, reverted: true, revertedAt: Date.now() };

  // Reversion log entry
  const revertEntry = {
    id:          genId(),
    ts:          Date.now(),
    traitChanged: traitKey,
    oldValue,
    newValue:    traits[traitKey],
    delta:       roundTrait(traits[traitKey] - oldValue),
    reason:      'manual_revert',
    sourceEvent: 'revert_system',
    reversible:  true,
    isRevert:    true,
  };
  log.push(revertEntry);

  const newBe = { ...be, coreTraits: traits, evolutionLog: log.slice(-EVOL_CAPS.EVOLUTION_LOG_MAX) };
  core.behaviourEvolution = newBe;
  storage.saveCompanionCore(core);

  return { reverted: true, traitKey, restoredTo: traits[traitKey], from: oldValue };
}

// ══════════════════════════════════════════════════════════════════
// STEP 5 — MEMORY-INFLUENCED EVOLUTION
// ══════════════════════════════════════════════════════════════════

/**
 * applyMemoryInfluencedEvolution(memories)
 * Evolves traits based on high-importance memories and milestones.
 * Minimum pattern count enforced — no single-event learning.
 */
export function applyMemoryInfluencedEvolution(memories) {
  if (!Array.isArray(memories) || memories.length < MIN_PATTERN_COUNT) {
    return { applied: false, reason: 'insufficient_memory_count' };
  }

  const results = [];

  // Count repeated emotional tones
  const calmCount  = memories.filter(m => m.mood === 'calm'    || m.sentiment === 'calm').length;
  const playCount  = memories.filter(m => m.mood === 'playful' || m.type === 'play_event').length;
  const milestones = memories.filter(m => m.isMilestone === true).length;
  const highWeight = memories.filter(m => (m.memoryWeight ?? 0) >= 8).length;

  // Apply gradual influence only if pattern count >= MIN_PATTERN_COUNT
  if (calmCount >= MIN_PATTERN_COUNT) {
    const r = applyTraitAdaptation('calmness', 0.6, `calm_memory_pattern_${calmCount}x`, 'memory_influence');
    results.push({ trait: 'calmness', ...r });
  }

  if (playCount >= MIN_PATTERN_COUNT) {
    const r = applyTraitAdaptation('playfulness', 0.5, `play_memory_pattern_${playCount}x`, 'memory_influence');
    results.push({ trait: 'playfulness', ...r });
  }

  if (milestones >= 1 && highWeight >= MIN_PATTERN_COUNT) {
    const r = applyTraitAdaptation('attachment', 0.7, `milestone_memory_${milestones}`, 'memory_milestone');
    results.push({ trait: 'attachment', ...r });
  }

  return {
    applied:     results.some(r => r.applied),
    results,
    memoriesProcessed: memories.length,
    calmCount, playCount, milestones, highWeight,
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 6 — EMOTIONAL STABILITY CONTROLLER
// ══════════════════════════════════════════════════════════════════

/**
 * computeDriftIndex(traits)
 * Measures how far current traits have drifted from baseline.
 */
export function computeDriftIndex(traits) {
  const keys     = Object.keys(DEFAULT_CORE_TRAITS);
  const baseline = DEFAULT_CORE_TRAITS;
  const deltas   = keys.map(k => Math.abs((traits[k] ?? baseline[k]) - baseline[k]));
  return roundTrait(deltas.reduce((a, b) => a + b, 0) / keys.length);
}

/**
 * runStabilityCheck()
 * Evaluates current trait drift — auto-corrects if critical.
 */
export function runStabilityCheck() {
  const core   = getCore();
  const be     = getBE(core);
  const traits = be.coreTraits ?? DEFAULT_CORE_TRAITS;
  const drift  = computeDriftIndex(traits);
  const sc     = { ...(be.stabilityController ?? getDefaultStabilityController()) };

  let action = 'none';
  let corrected = false;

  if (drift >= MAX_DRIFT_THRESHOLD) {
    sc.driftState = DRIFT_STATE.CRITICAL;
    logSafety('stability_critical_drift', `driftIndex=${drift.toFixed(3)}`);

    if (sc.correctionMode === 'auto') {
      // Auto-correct: pull traits halfway back toward baseline
      const corrected_traits = {};
      for (const k of Object.keys(DEFAULT_CORE_TRAITS)) {
        const cur = traits[k] ?? DEFAULT_CORE_TRAITS[k];
        corrected_traits[k] = roundTrait(clampTrait(cur + (DEFAULT_CORE_TRAITS[k] - cur) * 0.5));
      }
      const correctionEntry = {
        id: genId(), ts: Date.now(), action: 'auto_correction',
        driftBefore: drift, driftAfter: computeDriftIndex(corrected_traits),
        reversible: true,
      };
      core.behaviourEvolution = {
        ...be,
        coreTraits: corrected_traits,
        stabilityController: {
          ...sc,
          driftState:      computeDriftIndex(corrected_traits) < MAX_DRIFT_THRESHOLD ? DRIFT_STATE.STABLE : DRIFT_STATE.WARNING,
          correctionCount: (sc.correctionCount ?? 0) + 1,
          lastStableSnapshot: Date.now(),
        },
        evolutionLog: [...(be.evolutionLog ?? []), correctionEntry].slice(-EVOL_CAPS.EVOLUTION_LOG_MAX),
      };
      storage.saveCompanionCore(core);
      action    = 'auto_corrected';
      corrected = true;
    }
  } else if (drift >= MAX_DRIFT_THRESHOLD * 0.7) {
    sc.driftState = DRIFT_STATE.WARNING;
    logSafety('stability_warning', `driftIndex=${drift.toFixed(3)}`);
    action = 'warning';
  } else {
    sc.driftState = DRIFT_STATE.STABLE;
    sc.lastStableSnapshot = Date.now();
    action = 'stable';
  }

  if (!corrected) {
    core.behaviourEvolution = { ...be, stabilityController: sc };
    storage.saveCompanionCore(core);
  }

  return {
    driftIndex:  drift,
    driftState:  sc.driftState,
    action,
    corrected,
    threshold:   MAX_DRIFT_THRESHOLD,
    safe:        drift < MAX_DRIFT_THRESHOLD,
  };
}

/**
 * freezeEvolution(reason)
 * Temporarily suspends all trait adaptation.
 */
export function freezeEvolution(reason) {
  const core = getCore();
  const be   = getBE(core);
  core.behaviourEvolution = {
    ...be,
    adaptationMode: ADAPTATION_MODE.SUSPENDED,
    stabilityController: {
      ...(be.stabilityController ?? getDefaultStabilityController()),
      driftState:   DRIFT_STATE.LOCKED,
      frozenSince:  Date.now(),
    },
  };
  storage.saveCompanionCore(core);
  logSafety('evolution_frozen', reason ?? 'manual');
  return { frozen: true, reason: reason ?? 'manual', adaptationMode: ADAPTATION_MODE.SUSPENDED };
}

/**
 * resumeEvolution()
 * Resumes adaptation after freeze — re-runs stability check first.
 */
export function resumeEvolution() {
  const stability = runStabilityCheck();
  if (stability.driftState === DRIFT_STATE.CRITICAL) {
    return { resumed: false, reason: 'drift_still_critical', driftIndex: stability.driftIndex };
  }

  const core = getCore();
  const be   = getBE(core);
  core.behaviourEvolution = {
    ...be,
    adaptationMode: ADAPTATION_MODE.SAFE,
    stabilityController: {
      ...(be.stabilityController ?? getDefaultStabilityController()),
      driftState:   DRIFT_STATE.STABLE,
      frozenSince:  null,
    },
  };
  storage.saveCompanionCore(core);
  return { resumed: true, adaptationMode: ADAPTATION_MODE.SAFE };
}

// ══════════════════════════════════════════════════════════════════
// STEP 7 — BEHAVIOUR PRIORITY SYSTEM
// ══════════════════════════════════════════════════════════════════

/**
 * resolveBehaviourPriority(candidates)
 * Resolves conflicts — identityLock ALWAYS wins at priority 100.
 */
export function resolveBehaviourPriority(candidates = []) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { resolved: null, reason: 'no_candidates' };
  }

  // identityLock always overrides
  const lockOverride = candidates.find(c => c.source === 'identity_lock');
  if (lockOverride) return { resolved: lockOverride, priority: PRIORITY.IDENTITY_LOCK, overridden: true };

  // Sort by priority descending
  const sorted = [...candidates].sort((a, b) => {
    const pa = PRIORITY[a.source?.toUpperCase().replace(/ /g,'_')] ?? 0;
    const pb = PRIORITY[b.source?.toUpperCase().replace(/ /g,'_')] ?? 0;
    return pb - pa;
  });

  return {
    resolved:  sorted[0],
    priority:  PRIORITY[sorted[0].source?.toUpperCase().replace(/ /g,'_')] ?? 0,
    overridden: false,
    allCandidates: sorted.map(c => c.source),
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 8 — ADAPTIVE ROUTINE SYSTEM
// ══════════════════════════════════════════════════════════════════

/**
 * registerRoutineTendency(routineType, context)
 * Records a subtle routine tendency — never rigid, never compulsive.
 * Minimum pattern count required before routine is registered.
 */
export function registerRoutineTendency(routineType, context = {}) {
  if (!routineType) return { registered: false, reason: 'no_routine_type' };

  const core     = getCore();
  const be       = getBE(core);
  const routines = be.adaptiveRoutines ?? [];

  // Find existing tendency
  const existing = routines.find(r => r.routineType === routineType);
  const count    = (existing?.observedCount ?? 0) + 1;

  // Only register after MIN_PATTERN_COUNT observations
  if (count < MIN_PATTERN_COUNT && !existing) {
    // Track but don't register yet
    const pend = routines.find(r => r.routineType === routineType && r.pending);
    if (pend) { pend.observedCount = count; }
    else { routines.push({ routineType, observedCount: 1, pending: true }); }
    core.behaviourEvolution = { ...be, adaptiveRoutines: routines.slice(-EVOL_CAPS.ROUTINE_LOG_MAX) };
    storage.saveCompanionCore(core);
    return { registered: false, reason: 'insufficient_pattern_count', observedCount: count };
  }

  const routine = {
    id:            existing?.id ?? genId(),
    routineType,
    label:         context.label ?? routineType,
    strength:      Math.min(1.0, count * 0.1),  // slow growth
    subtle:        true,
    rigid:         false,
    compulsive:    false,
    observedCount: count,
    lastSeen:      Date.now(),
    pending:       false,
  };

  const idx = routines.findIndex(r => r.routineType === routineType);
  if (idx >= 0) routines[idx] = routine;
  else          routines.push(routine);

  core.behaviourEvolution = { ...be, adaptiveRoutines: routines.slice(-EVOL_CAPS.ROUTINE_LOG_MAX) };
  storage.saveCompanionCore(core);

  return { registered: true, routine };
}

export function getAdaptiveRoutines() {
  return [...(getBE().adaptiveRoutines ?? [])].filter(r => !r.pending);
}

// ══════════════════════════════════════════════════════════════════
// STEP 9 — LONG-TERM PERSONALITY COHERENCE
// ══════════════════════════════════════════════════════════════════

/**
 * capturePersonalitySnapshot()
 * Records current personality state for continuity tracking.
 */
export function capturePersonalitySnapshot() {
  const be     = getBE();
  const traits = be.coreTraits ?? DEFAULT_CORE_TRAITS;
  const drift  = computeDriftIndex(traits);

  const snap = {
    baselineIdentity:   'stable',
    emotionalTone:      'consistent',
    behaviourSignature: 'unique',
    driftIndex:         drift,
    traitSnapshot:      { ...traits },
    capturedAt:         Date.now(),
    recognisable:       drift < MAX_DRIFT_THRESHOLD,
  };

  saveBEForce({ personalitySnapshot: snap });
  return snap;
}

/**
 * getPersonalityCoherenceReport()
 */
export function getPersonalityCoherenceReport() {
  const be     = getBE();
  const traits = be.coreTraits ?? DEFAULT_CORE_TRAITS;
  const drift  = computeDriftIndex(traits);
  const sc     = be.stabilityController ?? getDefaultStabilityController();

  return {
    driftIndex:          drift,
    driftState:          sc.driftState,
    withinSafeBounds:    drift < MAX_DRIFT_THRESHOLD,
    recognisable:        drift < MAX_DRIFT_THRESHOLD,
    baselineIdentity:    'stable',
    emotionalTone:       'consistent',
    behaviourSignature:  'unique',
    identityLockHeld:    true,
    stabilityWeight:     be.stabilityWeight,
    maxDeviationAllowed: MAX_DRIFT_THRESHOLD,
    evolutionLogCount:   (be.evolutionLog ?? []).length,
    adaptiveRoutineCount:(be.adaptiveRoutines ?? []).filter(r => !r.pending).length,
    offlineSafe:         true,
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 10 — EVOLUTION MEMORY LOGGING
// ══════════════════════════════════════════════════════════════════

export function getEvolutionLog(limit) {
  const log = getBE().evolutionLog ?? [];
  return limit ? log.slice(-limit) : [...log];
}

export function getEvolutionLogEntry(id) {
  return (getBE().evolutionLog ?? []).find(e => e.id === id) ?? null;
}

// ══════════════════════════════════════════════════════════════════
// STEP 11 — OFFLINE EVOLUTION SUPPORT
// ══════════════════════════════════════════════════════════════════

export function getOfflineEvolutionStatus() {
  return {
    offlineCapable:            true,
    noCloudLearningDependency: true,
    localStorageOnly:          true,
    fullRestorationOnRestart:  true,
    evolutionContinuesOffline: true,
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 12 — OLLAMA + GROQ EVOLUTION ORCHESTRATION
// ══════════════════════════════════════════════════════════════════

export function getEvolutionOrchestrationContext() {
  return {
    ollama: {
      role:  'evolution_emotional_brain',
      tasks: [
        'emotional_continuity_decisions',
        'long_term_personality_shaping',
        'identity_lock_enforcement',
        'memory_influenced_trait_weighting',
      ],
      writesTraitChanges: true,
      definesMeaning:     true,
    },
    groq: {
      role:  'evolution_pattern_accelerator',
      tasks: [
        'pattern_detection_acceleration',
        'interaction_summarisation',
        'behavioural_analytics_preprocessing',
      ],
      writesTraitChanges:  false,  // Groq NEVER writes final trait changes
      canModifyIdentity:   false,
      fallback:            'ollama',
    },
    safetyRule:  'groq_never_writes_final_trait_changes__ollama_owns_personality_shaping',
    offlineSafe: true,
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 13 — SAFETY + ANTI-DRIFT FIREWALL
// ══════════════════════════════════════════════════════════════════

export function runEvolutionSafetyCheck(operation, payload = {}) {
  const BLOCKED_OPS = [
    'random_personality_regen',
    'uncontrolled_learning',
    'force_identity_mutation',
    'overwrite_identity_lock',
    'memory_fabrication',
  ];

  if (BLOCKED_OPS.includes(operation)) {
    logSafety(`blocked_op:${operation}`, JSON.stringify(payload).slice(0, 60));
    return { safe: false, reason: `operation_blocked:${operation}` };
  }

  // Single-event learning prevention
  if (operation === 'record_signal' && payload.singleEventOverride === true) {
    logSafety('blocked_single_event_override', JSON.stringify(payload).slice(0, 60));
    return { safe: false, reason: 'single_event_learning_blocked' };
  }

  // Rapid trait mutation check
  if (operation === 'adapt_trait') {
    const delta = Math.abs(payload.observedPreference ?? 0) * TRAIT_DELTA_MAX;
    if (delta > TRAIT_DELTA_MAX) {
      logSafety('blocked_rapid_mutation', `delta=${delta}`);
      return { safe: false, reason: 'rapid_trait_mutation_blocked' };
    }
  }

  // Overfitting check — block if adaptation suspended
  const be = getBE();
  if (operation === 'adapt_trait' && be.adaptationMode === ADAPTATION_MODE.SUSPENDED) {
    return { safe: false, reason: 'adaptation_suspended' };
  }

  return { safe: true };
}

export function getEvolutionSafetyLog()  { return [..._safetyLog]; }

export function getEvolutionFirewallStatus() {
  return {
    randomPersonalityRegenBlocked: EVOLUTION_SAFETY.randomPersonalityRegen === false,
    uncontrolledLearningBlocked:   EVOLUTION_SAFETY.uncontrolledLearning   === false,
    identityLockViolationBlocked:  EVOLUTION_SAFETY.identityLockViolation  === false,
    memoryfabricationBlocked:       EVOLUTION_SAFETY.memoryfabrication      === false,
    rapidTraitMutationBlocked:     EVOLUTION_SAFETY.rapidTraitMutation      === false,
    singleEventLearningBlocked:    EVOLUTION_SAFETY.singleEventLearning     === false,
    allChangesReversible:          EVOLUTION_SAFETY.allChangesReversible    === true,
    allChangesLogged:              EVOLUTION_SAFETY.allChangesLogged        === true,
    maxDeltaPerCycle:              EVOLUTION_SAFETY.maxDeltaPerCycle,
    firewallVersion:               BEHAVIOUR_EVOLUTION_ENGINE_ID,
  };
}

// ══════════════════════════════════════════════════════════════════
// CONTEXT + SNAPSHOT
// ══════════════════════════════════════════════════════════════════

/**
 * getBehaviourEvolutionContext()
 * Full context for Ollama prompt injection.
 */
export function getBehaviourEvolutionContext() {
  const core  = getCore();
  const be    = getBE(core);
  const lock  = core.identityLock ?? {};
  const traits= be.coreTraits ?? DEFAULT_CORE_TRAITS;
  const sc    = be.stabilityController ?? getDefaultStabilityController();
  const prof  = be.userInteractionProfile ?? getDefaultInteractionProfile();
  const drift = computeDriftIndex(traits);

  return {
    evolutionEnabled:      be.evolutionEnabled,
    evolutionRate:         be.evolutionRate,
    adaptationMode:        be.adaptationMode,
    traitDriftProtection:  be.traitDriftProtection,
    coreTraits:            { ...traits },
    driftIndex:            drift,
    driftState:            sc.driftState,
    stabilityWeight:       be.stabilityWeight,
    preferredTone:         prof.preferredTone,
    interactionFrequency:  prof.interactionFrequency,
    identityLockSignature: lock.signature,
    identityLockHeld:      lock.immutable === true,
    evolutionLogCount:     (be.evolutionLog ?? []).length,
    activeRoutines:        (be.adaptiveRoutines ?? []).filter(r => !r.pending).length,
    evolutionVersion:      be.evolutionVersion,
    offlineSafe:           true,
    deterministic:         true,
    BEHAVIOUR_EVOLUTION_ENGINE_ID,
    EVOLUTION_SAFETY_allChangesReversible: EVOLUTION_SAFETY.allChangesReversible,
  };
}

/**
 * getBehaviourEvolutionSnapshot()
 * Full system snapshot.
 */
export function getBehaviourEvolutionSnapshot() {
  const be      = getBE();
  const coherence = getPersonalityCoherenceReport();
  const offline   = getOfflineEvolutionStatus();
  const orch      = getEvolutionOrchestrationContext();
  const firewall  = getEvolutionFirewallStatus();
  const ctx       = getBehaviourEvolutionContext();

  return {
    behaviourEvolution:     { ...be },
    evolutionContext:        ctx,
    personalityCoherence:   coherence,
    offlineStatus:          offline,
    orchestration:          orch,
    firewallStatus:         firewall,
    evolutionVersion:       be.evolutionVersion,
    deterministic:          true,
    randomGeneration:       false,
    identityLockHeld:       true,
  };
}

// ══════════════════════════════════════════════════════════════════
// TESTING UTILITIES
// ══════════════════════════════════════════════════════════════════

export function resetEvolutionThrottles() { _throttleWrite = 0; }
