// ================================================================
// IMMORTAIL™ — LIFE SIMULATION ENGINE (Run 8)
// Deterministic daily cycle, passive activity engine, ambient mood
// system, autonomous state machine, performance throttling, and
// full persistence for life continuity across sessions.
//
// STRICT RULES:
// - All reads/writes exclusively through storage SSOT
// - All transitions are deterministic + cooldown-guarded
// - No unsupervised self-generating actions
// - No emotional manipulation patterns
// - All state changes logged to routineHistory
// - No runaway loops — every update path is throttled
// ================================================================

import storage from './storage.js';
import { EventBus, EVENTS } from './eventBus.js';

// ── Daily cycle states ────────────────────────────────────────────

export const DAILY_CYCLE = {
  MORNING:  'morning',   // 05:00–09:59
  ACTIVE:   'active',    // 10:00–17:59
  RELAXED:  'relaxed',   // 18:00–20:59
  SLEEPY:   'sleepy',    // 21:00–22:59
  SLEEPING: 'sleeping',  // 23:00–04:59
};

// ── Routine states ────────────────────────────────────────────────

export const ROUTINE = {
  IDLE:     'idle',
  MORNING:  'morning',
  ACTIVE:   'active',
  RELAXED:  'relaxed',
  SLEEPY:   'sleepy',
  SLEEPING: 'sleeping',
};

// ── Ambient mood catalogue ────────────────────────────────────────

export const AMBIENT_MOOD = {
  CALM:      'calm',
  PLAYFUL:   'playful',
  SLEEPY:    'sleepy',
  CURIOUS:   'curious',
  RELAXED:   'relaxed',
  ATTENTIVE: 'attentive',
};

// ── Autonomous modes ──────────────────────────────────────────────

export const AUTONOMOUS_MODE = {
  PASSIVE:    'passive',
  OBSERVING:  'observing',
  RESTING:    'resting',
  SLEEPING:   'sleeping',
  EXCITED:    'excited',
};

// ── Passive activity catalogue ────────────────────────────────────

export const PASSIVE_ACTIVITY = {
  RESTING:          { id: 'resting',          label: 'Resting quietly',          moodFit: ['calm','relaxed','sleepy'] },
  LOOKING_AROUND:   { id: 'looking_around',   label: 'Looking around',            moodFit: ['curious','attentive'] },
  LYING_DOWN:       { id: 'lying_down',       label: 'Lying down',               moodFit: ['calm','sleepy','relaxed'] },
  STRETCHING:       { id: 'stretching',       label: 'Stretching',               moodFit: ['morning','active','relaxed'] },
  OBSERVING:        { id: 'observing',        label: 'Observing the environment', moodFit: ['curious','attentive'] },
  TAIL_MOVEMENT:    { id: 'tail_movement',    label: 'Gentle tail movement',      moodFit: ['calm','playful','relaxed'] },
  YAWNING:          { id: 'yawning',          label: 'Yawning',                  moodFit: ['sleepy','relaxed'] },
  EAR_PERKING:      { id: 'ear_perking',      label: 'Ears perking up',           moodFit: ['curious','attentive','playful'] },
  SLOW_BREATHING:   { id: 'slow_breathing',   label: 'Slow calm breathing',       moodFit: ['calm','relaxed','sleepy'] },
  SLEEPING_DEEPLY:  { id: 'sleeping_deeply',  label: 'Sleeping deeply',           moodFit: ['sleeping','sleepy'] },
  GENTLE_BREATHING: { id: 'gentle_breathing', label: 'Gentle breathing',           moodFit: ['sleeping','sleepy','calm'] },
  SNIFFING_AIR:     { id: 'sniffing_air',     label: 'Sniffing the air',          moodFit: ['curious','attentive'] },
};

// ── Performance constants ─────────────────────────────────────────

export const LIFE_SIM_THROTTLE_MS        = 10_000;  // min ms between full updates
export const AUTONOMOUS_COOLDOWN_MS      = 30_000;  // min ms between auto state changes
export const PASSIVE_ACTIVITY_COOLDOWN_MS = 15_000; // min ms between passive activity logs
export const ROUTINE_HISTORY_CAP         = 100;
export const PASSIVE_ACTIVITY_CAP        = 20;
export const SLEEP_RENDER_INTERVAL_MS    = 60_000;  // update interval during sleep

// ── In-memory timing guards ───────────────────────────────────────

let _lastFullUpdate          = 0;
let _lastPassiveActivityLog  = 0;
let _lowPowerMode            = false;

// ── Helpers ───────────────────────────────────────────────────────

function genId() {
  return Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

function getLifeSim() {
  return storage.getCompanionCore().lifeSimulation ?? {};
}

function patchLifeSim(patch) {
  const core = storage.getCompanionCore();
  const ls   = core.lifeSimulation ?? {};
  core.lifeSimulation = { ...ls, ...patch };
  storage.saveCompanionCore(core);
  return core.lifeSimulation;
}

function appendRoutineHistory(entry) {
  const core = storage.getCompanionCore();
  const ls   = core.lifeSimulation ?? {};
  ls.routineHistory = [...(ls.routineHistory ?? []), {
    id: genId(),
    ts: Date.now(),
    ...entry,
  }].slice(-ROUTINE_HISTORY_CAP);
  core.lifeSimulation = ls;
  storage.saveCompanionCore(core);
}

function appendPassiveActivity(entry) {
  const core = storage.getCompanionCore();
  const ls   = core.lifeSimulation ?? {};
  ls.passiveActivities = [...(ls.passiveActivities ?? []), {
    id: genId(),
    ts: Date.now(),
    ...entry,
  }].slice(-PASSIVE_ACTIVITY_CAP);
  core.lifeSimulation = ls;
  storage.saveCompanionCore(core);
}

// ══════════════════════════════════════════════════════════════════
// STEP 2 — DAILY CYCLE SYSTEM
// ══════════════════════════════════════════════════════════════════

/**
 * deriveDailyCycleState(hourOfDay?)
 * Deterministically maps local hour to a daily cycle state.
 * @param {number} hourOfDay - 0-23, defaults to current hour
 */
export function deriveDailyCycleState(hourOfDay = new Date().getHours()) {
  if (hourOfDay >= 5  && hourOfDay <= 9)  return DAILY_CYCLE.MORNING;
  if (hourOfDay >= 10 && hourOfDay <= 14) return DAILY_CYCLE.ACTIVE;
  if (hourOfDay >= 15 && hourOfDay <= 16) return DAILY_CYCLE.RELAXED;
  if (hourOfDay >= 17 && hourOfDay <= 20) return DAILY_CYCLE.RELAXED;
  if (hourOfDay >= 21 && hourOfDay <= 22) return DAILY_CYCLE.SLEEPY;
  return DAILY_CYCLE.SLEEPING; // 23:00–04:59
}

/**
 * getCurrentDailyCycle()
 * Returns derived cycle + stored state for comparison.
 */
export function getCurrentDailyCycle() {
  const derived = deriveDailyCycleState();
  const stored  = getLifeSim().dailyCycleState ?? DAILY_CYCLE.MORNING;
  return { cycle: derived, derived, stored, hour: new Date().getHours() };
}

// ══════════════════════════════════════════════════════════════════
// STEP 5 — AMBIENT MOOD SYSTEM
// ══════════════════════════════════════════════════════════════════

/**
 * deriveAmbientMood(core?)
 * Calculates ambientMood from emotionalState, attachmentGraph,
 * recent interactions, absence, and dailyCycleState.
 * Fully deterministic — no randomness.
 */
export function deriveAmbientMood(core) {
  if (!core) core = storage.getCompanionCore();

  const es    = core.emotionalState   ?? {};
  const ag    = core.attachmentGraph  ?? {};
  const ls    = core.lifeSimulation   ?? {};
  const cycle = ls.dailyCycleState    ?? DAILY_CYCLE.MORNING;

  const valence  = es.valence  ?? 0;
  const arousal  = es.arousal  ?? 50;
  const bond     = ag.userBond ?? 0;
  const lastInter = core.lastInteraction ?? 0;
  const sinceLastMs = Date.now() - lastInter;

  // Sleeping/sleepy cycle overrides everything
  if (cycle === DAILY_CYCLE.SLEEPING) return AMBIENT_MOOD.SLEEPY;
  if (cycle === DAILY_CYCLE.SLEEPY && arousal < 50) return AMBIENT_MOOD.SLEEPY;

  // High energy + positive + bonded → playful
  if (valence >= 40 && arousal >= 65 && bond >= 30) return AMBIENT_MOOD.PLAYFUL;

  // Recent interaction + moderate positive → attentive
  if (sinceLastMs < 120_000 && valence >= 0) return AMBIENT_MOOD.ATTENTIVE;

  // Morning energy
  if (cycle === DAILY_CYCLE.MORNING && valence >= -10) return AMBIENT_MOOD.ATTENTIVE;

  // Curious: moderate arousal + not post-activity rest
  if (arousal >= 50 && valence >= -20 && sinceLastMs > 300_000) return AMBIENT_MOOD.CURIOUS;

  // Relaxed evening
  if (cycle === DAILY_CYCLE.RELAXED) return AMBIENT_MOOD.RELAXED;

  // Calm default for trusted+ bond
  if (bond >= 20) return AMBIENT_MOOD.CALM;

  return AMBIENT_MOOD.CALM;
}

// ══════════════════════════════════════════════════════════════════
// STEP 3 — PASSIVE ACTIVITY ENGINE
// ══════════════════════════════════════════════════════════════════

/**
 * selectPassiveActivity(ambientMood, dailyCycle)
 * Deterministically selects an emotionally-appropriate passive activity.
 * Uses deterministic selection — seeded by current minute, no Math.random().
 */
export function selectPassiveActivity(ambientMood = AMBIENT_MOOD.CALM, dailyCycle = DAILY_CYCLE.ACTIVE) {
  // Filter activities that fit the current mood
  let candidates = Object.values(PASSIVE_ACTIVITY)
    .filter(a => a.moodFit.includes(ambientMood));

  // Add cycle-appropriate fallbacks
  if (dailyCycle === DAILY_CYCLE.MORNING)  candidates.push(PASSIVE_ACTIVITY.STRETCHING);
  if (dailyCycle === DAILY_CYCLE.SLEEPING || dailyCycle === DAILY_CYCLE.SLEEPY) {
    candidates = [PASSIVE_ACTIVITY.SLOW_BREATHING, PASSIVE_ACTIVITY.LYING_DOWN, PASSIVE_ACTIVITY.YAWNING];
  }

  if (candidates.length === 0) candidates = [PASSIVE_ACTIVITY.RESTING];

  // Deduplicate
  const seen = new Set();
  candidates = candidates.filter(c => seen.has(c.id) ? false : seen.add(c.id));

  // Sleeping/sleepy cycle bias — always return a rest activity
  if (dailyCycle === 'sleeping' || ambientMood === 'sleepy' || ambientMood === 'sleeping') {
    const restIds = ['lying_down','resting','gentle_breathing','sleeping_deeply'];
    const restCandidates = candidates.filter(c => restIds.includes(c.id));
    if (restCandidates.length) {
      const seed2 = new Date().getMinutes() % restCandidates.length;
      const r = restCandidates[seed2];
      return { ...r, activityId: r.activityId ?? r.id };
    }
  }

  // Deterministic pick: seeded by current minute
  const seed  = new Date().getMinutes() % candidates.length;
  const picked = candidates[seed];
  // Normalise: always expose `activityId` (alias for `id`) for SSOT compatibility
  return picked ? { ...picked, activityId: picked.activityId ?? picked.id } : null;
}

/**
 * tickPassiveActivity()
 * Logs a passive activity if cooldown has elapsed.
 * Throttled — safe to call frequently.
 * Returns { logged: boolean, activity? }
 */
export function tickPassiveActivity() {
  const now = Date.now();
  const interval = _lowPowerMode ? PASSIVE_ACTIVITY_COOLDOWN_MS * 4 : PASSIVE_ACTIVITY_COOLDOWN_MS;

  if (now - _lastPassiveActivityLog < interval) {
    return { logged: false, activity: null };
  }
  _lastPassiveActivityLog = now;

  const core    = storage.getCompanionCore();
  const ls      = core.lifeSimulation ?? {};
  const mood    = ls.ambientMood      ?? AMBIENT_MOOD.CALM;
  const cycle   = ls.dailyCycleState  ?? DAILY_CYCLE.ACTIVE;

  // No passive activities during active interaction (within 60s)
  const sinceLastMs = now - (core.lastInteraction ?? 0);
  if (sinceLastMs < 60_000) return { logged: false, activity: null };

  const activity = selectPassiveActivity(mood, cycle);

  appendPassiveActivity({
    activityId:   activity.id,
    label:        activity.label,
    ambientMood:  mood,
    dailyCycle:   cycle,
  });

  return { logged: true, activity };
}

// ══════════════════════════════════════════════════════════════════
// STEP 4 — ROUTINE MEMORY SYSTEM
// ══════════════════════════════════════════════════════════════════

/**
 * logRoutineState(trigger, state)
 * Records current life state to routineHistory.
 * Called on every autonomous transition.
 */
export function logRoutineState(trigger, state) {
  appendRoutineHistory({
    trigger,
    currentRoutine:   state.currentRoutine   ?? 'idle',
    dailyCycleState:  state.dailyCycleState  ?? 'awake',
    ambientMood:      state.ambientMood      ?? 'calm',
    autonomousMode:   state.autonomousMode   ?? 'passive',
  });
}

/**
 * getRoutineInsights()
 * Analyses routineHistory to find recurring patterns.
 * Used to bias future idle behaviour (lightly).
 */
export function getRoutineInsights() {
  const ls   = getLifeSim();
  const hist = ls.routineHistory ?? [];

  if (hist.length < 3) return { patterns: [], totalEntries: hist.length, mostCommonCycle: null, mostCommonMood: null };

  // Count mood frequency
  const moodFreq = {};
  const cycleFreq = {};
  for (const entry of hist) {
    moodFreq[entry.ambientMood]     = (moodFreq[entry.ambientMood]     ?? 0) + 1;
    cycleFreq[entry.dailyCycleState] = (cycleFreq[entry.dailyCycleState] ?? 0) + 1;
  }

  const dominantMood  = Object.entries(moodFreq).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const dominantCycle = Object.entries(cycleFreq).sort((a,b)=>b[1]-a[1])[0]?.[0];

  const patterns = [];
  if (dominantMood)  patterns.push({ type: 'dominant_mood',  value: dominantMood  });
  if (dominantCycle) patterns.push({ type: 'dominant_cycle', value: dominantCycle });

  return { patterns, totalEntries: hist.length, mostCommonCycle: dominantCycle ?? null, mostCommonMood: dominantMood ?? null, moodFreq, cycleFreq };
}

// ══════════════════════════════════════════════════════════════════
// STEP 6 — AUTONOMOUS STATE TRANSITIONS
// ══════════════════════════════════════════════════════════════════

/**
 * deriveAutonomousMode(core?)
 * Deterministically maps current state to an autonomous mode.
 * No randomness. Cooldown-enforced.
 */
export function deriveAutonomousMode(core) {
  if (!core) core = storage.getCompanionCore();

  const ls    = core.lifeSimulation  ?? {};
  const es    = core.emotionalState  ?? {};
  const cycle = ls.dailyCycleState   ?? DAILY_CYCLE.ACTIVE;

  // Sleeping → sleeping mode always
  if (ls.sleepState?.isSleeping || cycle === DAILY_CYCLE.SLEEPING) return AUTONOMOUS_MODE.SLEEPING;

  // Reunion event within 5 min → excited
  const recentReunion = (core.memory ?? [])
    .filter(m => m.type === 'reunion_event')
    .sort((a, b) => b.ts - a.ts)[0];
  if (recentReunion && (Date.now() - recentReunion.ts) < 5 * 60_000) return AUTONOMOUS_MODE.EXCITED;

  // Low arousal → resting
  if (es.arousal < 30 || cycle === DAILY_CYCLE.SLEEPY) return AUTONOMOUS_MODE.RESTING;

  // High arousal, recent activity → observing
  const sinceLastMs = Date.now() - (core.lastInteraction ?? 0);
  if (es.arousal >= 50 && sinceLastMs < 300_000) return AUTONOMOUS_MODE.OBSERVING;

  return AUTONOMOUS_MODE.PASSIVE;
}

/**
 * transitionAutonomousState(newMode, trigger)
 * Applies an autonomous mode transition with cooldown enforcement.
 * Returns { transitioned: boolean, mode: string, cooldownBlocked: boolean }
 */
export function transitionAutonomousState(newMode, trigger = 'system') {
  const now  = Date.now();
  const core = storage.getCompanionCore();
  const ls   = core.lifeSimulation ?? {};
  const auto = ls.autonomousState  ?? {};

  const prevMode = auto.mode ?? AUTONOMOUS_MODE.PASSIVE;
  // Same-state is always a clean no-op — no cooldown interaction
  if (prevMode === newMode) {
    return { transitioned: false, mode: newMode, cooldownBlocked: false };
  }

  // Cooldown guard — prevents rapid state flipping between DIFFERENT states
  if (auto.cooldownUntil && now < auto.cooldownUntil) {
    return { transitioned: false, mode: prevMode, cooldownBlocked: true };
  }

  // Compute cooldown — sleeping transitions have longer cooldowns
  const cooldownMs = newMode === AUTONOMOUS_MODE.SLEEPING
    ? AUTONOMOUS_COOLDOWN_MS * 4
    : AUTONOMOUS_COOLDOWN_MS;

  const updatedAuto = {
    mode:          newMode,
    enteredAt:     now,
    cooldownUntil: now + cooldownMs,
  };

  // Update sleep state
  const sleepState = { ...ls.sleepState };
  if (newMode === AUTONOMOUS_MODE.SLEEPING && !sleepState.isSleeping) {
    sleepState.isSleeping     = true;
    sleepState.enteredSleepAt = now;
    sleepState.sleepDuration  = 0;
  } else if (prevMode === AUTONOMOUS_MODE.SLEEPING && newMode !== AUTONOMOUS_MODE.SLEEPING) {
    sleepState.isSleeping    = false;
    sleepState.sleepDuration = sleepState.enteredSleepAt
      ? now - sleepState.enteredSleepAt
      : 0;
  }

  const newLs = {
    ...ls,
    autonomousState:          updatedAuto,
    sleepState,
    lastAutonomousTransition: now,
  };
  core.lifeSimulation = newLs;
  storage.saveCompanionCore(core);

  // Log to routine history
  logRoutineState(trigger, {
    currentRoutine:  ls.currentRoutine ?? 'idle',
    dailyCycleState: ls.dailyCycleState ?? 'awake',
    ambientMood:     ls.ambientMood    ?? 'calm',
    autonomousMode:  newMode,
  });

  EventBus.emit(EVENTS.DOG_UPDATED ?? 'DOG::STATE_UPDATED', {
    autonomousMode: newMode,
    prevMode,
    trigger,
    ts: now,
  });

  return { transitioned: true, mode: newMode, cooldownBlocked: false, prevMode };
}

// ══════════════════════════════════════════════════════════════════
// STEP 2 + 6 combined — MAIN LIFE SIMULATION TICK
// ══════════════════════════════════════════════════════════════════

/**
 * tickLifeSimulation()
 * Primary update — derives and persists all life state.
 * Throttled: at most 1 full write per LIFE_SIM_THROTTLE_MS.
 * Sleep mode further increases interval to SLEEP_RENDER_INTERVAL_MS.
 * Returns full lifeSimulation snapshot.
 */
export function tickLifeSimulation() {
  const now  = Date.now();
  const core = storage.getCompanionCore();
  const ls   = core.lifeSimulation ?? {};

  // Determine throttle interval based on sleep state
  const isSleeping = ls.sleepState?.isSleeping || ls.dailyCycleState === DAILY_CYCLE.SLEEPING;
  const interval   = _lowPowerMode
    ? LIFE_SIM_THROTTLE_MS * 6
    : isSleeping
      ? SLEEP_RENDER_INTERVAL_MS
      : LIFE_SIM_THROTTLE_MS;

  if (now - _lastFullUpdate < interval) {
    return getLifeSimulationState();
  }
  _lastFullUpdate = now;

  // ── Step 1: Derive daily cycle ────────────────────────────────
  const newCycle = deriveDailyCycleState();

  // ── Step 2: Derive ambient mood ───────────────────────────────
  // Temporarily write the new cycle so deriveAmbientMood sees it
  const coreForMood = storage.getCompanionCore();
  coreForMood.lifeSimulation = { ...coreForMood.lifeSimulation, dailyCycleState: newCycle };
  const newMood = deriveAmbientMood(coreForMood);

  // ── Step 3: Derive autonomous mode ───────────────────────────
  const newAutoMode = deriveAutonomousMode(coreForMood);

  // ── Step 4: Determine current routine ────────────────────────
  const newRoutine = newCycle; // routine mirrors cycle for clean semantics

  // ── Step 5: Build updated lifeSimulation ─────────────────────
  const prevCycle   = ls.dailyCycleState ?? '';
  const prevMood    = ls.ambientMood     ?? '';
  const cycleChanged = newCycle !== prevCycle;
  const moodChanged  = newMood  !== prevMood;

  const freshCore = storage.getCompanionCore();
  const prevAuto  = freshCore.lifeSimulation?.autonomousState?.mode ?? AUTONOMOUS_MODE.PASSIVE;
  const autoNeedsChange = newAutoMode !== prevAuto;

  // Write base life state
  freshCore.lifeSimulation = {
    ...(freshCore.lifeSimulation ?? {}),
    currentRoutine:   newRoutine,
    dailyCycleState:  newCycle,
    ambientMood:      newMood,
  };
  storage.saveCompanionCore(freshCore);

  // Autonomous transition (cooldown-guarded internally)
  if (autoNeedsChange) {
    const trigger = cycleChanged ? `cycle_change_${newCycle}` : `mood_change_${newMood}`;
    transitionAutonomousState(newAutoMode, trigger);
  }

  // Log if cycle or mood changed
  if (cycleChanged || moodChanged) {
    logRoutineState('tick_update', {
      currentRoutine:  newRoutine,
      dailyCycleState: newCycle,
      ambientMood:     newMood,
      autonomousMode:  newAutoMode,
    });
  }

  // Tick passive activity
  tickPassiveActivity();

  return getLifeSimulationState();
}

// ── Snapshot getters ──────────────────────────────────────────────

export function getLifeSimulationState() {
  const ls = getLifeSim();
  const recentActivity = (ls.passiveActivities ?? []).slice(-1)[0] ?? null;
  return {
    cycle:                    ls.dailyCycleState             ?? 'awake',   // alias
    currentRoutine:           ls.currentRoutine              ?? 'idle',
    dailyCycleState:          ls.dailyCycleState             ?? 'awake',
    ambientMood:              ls.ambientMood                 ?? 'calm',
    autonomousState:          ls.autonomousState             ?? { mode: 'passive' },
    sleepState:               ls.sleepState                  ?? { isSleeping: false },
    passiveActivity:          recentActivity,
    passiveActivitiesCount:   (ls.passiveActivities          ?? []).length,
    routineHistoryCount:      (ls.routineHistory             ?? []).length,
    lastAutonomousTransition: ls.lastAutonomousTransition    ?? null,
  };
}

export function getLifeSimulationContext() {
  const ls = getLifeSim();
  return {
    currentRoutine:   ls.currentRoutine   ?? 'idle',
    dailyCycleState:  ls.dailyCycleState  ?? 'awake',
    ambientMood:      ls.ambientMood      ?? 'calm',
    autonomousMode:   ls.autonomousState?.mode ?? 'passive',
    isSleeping:       ls.sleepState?.isSleeping ?? false,
    recentActivity:   (ls.passiveActivities ?? []).slice(-1)[0]?.label ?? null,
  };
}

export function getPassiveActivities(limit = 10) {
  return (getLifeSim().passiveActivities ?? []).slice(-limit);
}

export function getRoutineHistory(limit = 20) {
  return (getLifeSim().routineHistory ?? []).slice(-limit);
}

// ── Performance controls ──────────────────────────────────────────

export function setLifeSimLowPowerMode(enabled) {
  _lowPowerMode = !!enabled;
}
export function isLifeSimLowPowerMode() { return _lowPowerMode; }

export function resetLifeSimThrottles() {
  _lastPassiveActivityLog = 0;
  _lastFullUpdate         = 0;
}

// ── Constants already exported as `export const` above ──────────
