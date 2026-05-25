// ================================================================
// IMMORTAIL™ — EMBODIMENT EXPANSION ENGINE (Run 11)
// Safe Animation + Environment Interaction Upgrade.
//
// Implements:
//   STEP 1  — Environment system core
//   STEP 2  — Environment object registry
//   STEP 3  — Needs + motivation system
//   STEP 4  — Behaviour decision engine
//   STEP 5  — Advanced animation state machine
//   STEP 6  — Procedural idle motion
//   STEP 7  — Object interaction animations
//   STEP 8  — Emotional posture system
//   STEP 9  — Gaze + attention system
//   STEP 10 — Performance safety layer
//   STEP 11 — Ollama embodiment context upgrade
//   STEP 12 — Persistence + recovery
//
// STRICT RULES:
// - companionCore SSOT only — all reads/writes via storage.js
// - NO random animation or random behaviour selection
// - NO game-like survival mechanics
// - ALL transitions deterministic and cooldown-gated
// - NO runaway loops — all ticks throttled
// - identityLock NEVER touched
// ================================================================

import storage from './storage.js';
import { EventBus, EVENTS } from './eventBus.js';

// ════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════

export const ENV_VERSION       = 'V1';
export const NEEDS_VERSION     = 'V1';
export const ANIM_SYS_VERSION  = 'V1';

// ── Environment scenes & lighting ─────────────────────────────────

export const SCENE = {
  LIVING_ROOM: 'living_room',
  BEDROOM:     'bedroom',
  GARDEN:      'garden',
  EVENING:     'evening',
  NIGHT:       'night',
};

export const LIGHTING = {
  WARM_SOFT: 'warm_soft',
  BRIGHT:    'bright',
  DIM:       'dim',
  EVENING:   'evening',
  NIGHT:     'night',
};

export const AMBIENT_STATE = {
  CALM:    'calm',
  ACTIVE:  'active',
  QUIET:   'quiet',
  EVENING: 'evening',
  NIGHT:   'night',
};

// ── Object types & interaction types ──────────────────────────────

export const OBJ_TYPE = {
  WATER: 'water',
  FOOD:  'food',
  TOY:   'toy',
  REST:  'rest',
};

export const INTERACT_TYPE = {
  DRINK: 'drink',
  EAT:   'eat',
  PLAY:  'play',
  SLEEP: 'sleep',
};

// ── Animation layers ───────────────────────────────────────────────

export const ANIM_LAYER = {
  IDLE:        'idle',
  ATTENTIVE:   'attentive',
  CURIOUS:     'curious',
  PLAYFUL:     'playful',
  DRINKING:    'drinking',
  EATING:      'eating',
  RESTING:     'resting',
  SLEEPING:    'sleeping',
  REUNION:     'reunion',
  OBSERVING:   'observing',
};

// ── Posture states ─────────────────────────────────────────────────

export const POSTURE = {
  RELAXED:  'relaxed',
  ALERT:    'alert',
  CURIOUS:  'curious',
  PLAYFUL:  'playful',
  SLEEPY:   'sleepy',
  BONDED:   'bonded',
};

// ── Head tracking targets ──────────────────────────────────────────

export const GAZE = {
  FORWARD:       'forward',
  TOWARD_USER:   'toward_user',
  TOWARD_OBJECT: 'toward_object',
  SCANNING:      'scanning',
};

// ── Tail movement states ───────────────────────────────────────────

export const TAIL = {
  STILL:        'still',
  SLOW_SWAY:    'slow_sway',
  WAG:          'wag',
  EXCITED_WAG:  'excited_wag',
};

// ── Behaviour action types ─────────────────────────────────────────

export const BEHAVIOUR = {
  IDLE:          'idle',
  SEEK_WATER:    'seek_water',
  SEEK_FOOD:     'seek_food',
  SEEK_TOY:      'seek_toy',
  SEEK_REST:     'seek_rest',
  OBSERVE:       'observe',
  ATTEND_USER:   'attend_user',
};

// ── Caps & throttles ───────────────────────────────────────────────

export const CAPS = {
  OBJ_LOG:        50,
  TRANSITION_LOG: 20,
  MAX_OBJECTS:    20,
};

export const THROTTLE = {
  NEEDS_UPDATE_MS:    60_000,   // needs tick every 60s
  ANIM_TRANSITION_MS:    500,   // min ms between animation state writes
  IDLE_ROTATE_MS:      8_000,   // procedural idle behaviour rotates every 8s
  GAZE_SHIFT_MS:       3_000,   // min ms between gaze target changes
  OBJ_INTERACT_MS:    30_000,   // min ms between interactions with same object
  BEHAVIOUR_TICK_MS:  10_000,   // behaviour decision tick
  HEALTH_TICK_MS:     30_000,   // performance health check
};

// ── In-memory timing guards (reset on module reload) ──────────────

let _lastNeedsTick       = 0;
let _lastAnimWrite       = 0;
let _lastIdleRotate      = 0;
let _lastGazeShift       = 0;
let _lastBehaviourTick   = 0;
let _lastHealthTick      = 0;

/**
 * resetThrottles()
 * Resets all in-memory timing guards to zero.
 * For testing only — not called in production flows.
 */
export function resetThrottles() {
  _lastNeedsTick     = 0;
  _lastAnimWrite     = 0;
  _lastIdleRotate    = 0;
  _lastGazeShift     = 0;
  _lastBehaviourTick = 0;
  _lastHealthTick    = 0;
}

// ── Helpers ───────────────────────────────────────────────────────

function genId() {
  return `r11_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function clamp(val, min = 0, max = 100) {
  return Math.max(min, Math.min(max, val));
}

function now() { return Date.now(); }

// ════════════════════════════════════════════════════════════════
// STEP 2 — ENVIRONMENT OBJECT REGISTRY
// ════════════════════════════════════════════════════════════════

/**
 * DEFAULT_OBJECTS
 * The canonical deterministic set of environment objects.
 * No random spawning. No duplicates.
 */
export const DEFAULT_OBJECTS = [
  {
    id:              'water_bowl',
    type:            OBJ_TYPE.WATER,
    interactionType: INTERACT_TYPE.DRINK,
    label:           'Water Bowl',
    position:        { x: -1.2, y: 0, z: 0.5 },
    enabled:         true,
    cooldownMs:      THROTTLE.OBJ_INTERACT_MS,
    lastInteractedAt:null,
  },
  {
    id:              'food_bowl',
    type:            OBJ_TYPE.FOOD,
    interactionType: INTERACT_TYPE.EAT,
    label:           'Food Bowl',
    position:        { x: -1.0, y: 0, z: 0.3 },
    enabled:         true,
    cooldownMs:      THROTTLE.OBJ_INTERACT_MS * 2,  // food less frequent than water
    lastInteractedAt:null,
  },
  {
    id:              'tennis_ball',
    type:            OBJ_TYPE.TOY,
    interactionType: INTERACT_TYPE.PLAY,
    label:           'Tennis Ball',
    position:        { x: 0.8, y: 0, z: 0.6 },
    enabled:         true,
    cooldownMs:      THROTTLE.OBJ_INTERACT_MS,
    lastInteractedAt:null,
  },
  {
    id:              'dog_bed',
    type:            OBJ_TYPE.REST,
    interactionType: INTERACT_TYPE.SLEEP,
    label:           'Dog Bed',
    position:        { x: 1.5, y: 0, z: -0.5 },
    enabled:         true,
    cooldownMs:      0,   // no cooldown on resting
    lastInteractedAt:null,
  },
];

/**
 * initEnvironmentObjects()
 * Seeds DEFAULT_OBJECTS into environmentSystem if empty.
 * De-duplicates by id — never adds a second copy.
 */
export function initEnvironmentObjects() {
  const core  = storage.getCompanionCore();
  const es    = core.environmentSystem ?? {};
  const existing = es.environmentObjects ?? [];

  const existingIds = new Set(existing.map(o => o.id));
  const toAdd       = DEFAULT_OBJECTS.filter(o => !existingIds.has(o.id));

  if (toAdd.length === 0) return existing;

  core.environmentSystem = {
    ...es,
    environmentObjects: [...existing, ...toAdd].slice(0, CAPS.MAX_OBJECTS),
  };
  storage.saveCompanionCore(core);
  return core.environmentSystem.environmentObjects;
}

/**
 * getEnvironmentObjects()
 * Returns the registered object list.
 */
export function getEnvironmentObjects() {
  return storage.getCompanionCore().environmentSystem?.environmentObjects ?? DEFAULT_OBJECTS;
}

/**
 * getObjectById(id)
 */
export function getObjectById(id) {
  return getEnvironmentObjects().find(o => o.id === id) ?? null;
}

/**
 * setObjectEnabled(id, enabled)
 */
export function setObjectEnabled(id, enabled) {
  const core = storage.getCompanionCore();
  const es   = core.environmentSystem ?? {};
  es.environmentObjects = (es.environmentObjects ?? []).map(o =>
    o.id === id ? { ...o, enabled } : o
  );
  core.environmentSystem = es;
  storage.saveCompanionCore(core);
}

// ════════════════════════════════════════════════════════════════
// STEP 1 — ENVIRONMENT SYSTEM CORE
// ════════════════════════════════════════════════════════════════

/**
 * initEnvironmentSystem()
 * Ensures environmentSystem exists with defaults. Seeds objects.
 * Called from boot sequence.
 */
export function initEnvironmentSystem() {
  const core = storage.getCompanionCore();
  const es   = core.environmentSystem ?? {};

  // Ensure required fields exist (deepMerge handles this but be explicit)
  const merged = {
    activeScene:          es.activeScene          ?? SCENE.LIVING_ROOM,
    lightingMode:         es.lightingMode         ?? LIGHTING.WARM_SOFT,
    interactionZones:     es.interactionZones      ?? [],
    environmentObjects:   es.environmentObjects    ?? [],
    ambientState:         es.ambientState          ?? AMBIENT_STATE.CALM,
    environmentVersion:   ENV_VERSION,
    objectInteractionLog: es.objectInteractionLog  ?? [],
    lastObjectInteraction:es.lastObjectInteraction ?? null,
  };

  core.environmentSystem = merged;
  storage.saveCompanionCore(core);

  // Seed default objects
  initEnvironmentObjects();

  return storage.getCompanionCore().environmentSystem;
}

/**
 * setScene(scene, lightingMode?)
 * Changes the active environment scene deterministically.
 */
export function setScene(scene, lightingMode = null) {
  const core = storage.getCompanionCore();
  const es   = core.environmentSystem ?? {};

  es.activeScene   = Object.values(SCENE).includes(scene) ? scene : SCENE.LIVING_ROOM;
  es.lightingMode  = lightingMode ?? deriveLighting(scene);
  core.environmentSystem = es;
  storage.saveCompanionCore(core);

  return { scene: es.activeScene, lighting: es.lightingMode };
}

function deriveLighting(scene) {
  const map = {
    [SCENE.LIVING_ROOM]: LIGHTING.WARM_SOFT,
    [SCENE.BEDROOM]:     LIGHTING.DIM,
    [SCENE.GARDEN]:      LIGHTING.BRIGHT,
    [SCENE.EVENING]:     LIGHTING.EVENING,
    [SCENE.NIGHT]:       LIGHTING.NIGHT,
  };
  return map[scene] ?? LIGHTING.WARM_SOFT;
}

/**
 * setAmbientState(state)
 */
export function setAmbientState(state) {
  const core = storage.getCompanionCore();
  const es   = core.environmentSystem ?? {};
  es.ambientState = Object.values(AMBIENT_STATE).includes(state) ? state : AMBIENT_STATE.CALM;
  core.environmentSystem = es;
  storage.saveCompanionCore(core);
  return es.ambientState;
}

/**
 * getEnvironmentContext()
 * Returns a flat summary for Ollama injection.
 */
export function getEnvironmentContext() {
  const core = storage.getCompanionCore();
  const es   = core.environmentSystem ?? {};
  const as   = core.animationSystem   ?? {};
  const ns   = core.needsState        ?? {};

  return {
    activeScene:           es.activeScene          ?? SCENE.LIVING_ROOM,
    lightingMode:          es.lightingMode         ?? LIGHTING.WARM_SOFT,
    ambientState:          es.ambientState         ?? AMBIENT_STATE.CALM,
    currentAnimationState: as.primaryLayer         ?? ANIM_LAYER.IDLE,
    postureState:          as.emotionalPosture     ?? POSTURE.RELAXED,
    headTracking:          as.headTracking         ?? GAZE.FORWARD,
    tailMovement:          as.tailMovement         ?? TAIL.SLOW_SWAY,
    activeObjectInteraction: as.interactionLayer   ?? null,
    gazeTarget:            as.gazeTarget           ?? null,
    needsSummary: {
      hunger:  ns.hunger  ?? 25,
      thirst:  ns.thirst  ?? 20,
      boredom: ns.boredom ?? 30,
      energy:  ns.energy  ?? 70,
    },
    lastObjectInteraction: es.lastObjectInteraction ?? null,
  };
}

// ════════════════════════════════════════════════════════════════
// STEP 3 — NEEDS + MOTIVATION SYSTEM
// ════════════════════════════════════════════════════════════════

/**
 * Needs tick rates per minute — very slow, emotional realism only.
 * All values clamped [0–100]. NOT survival gameplay.
 */
const NEEDS_TICK_RATES = {
  hunger:  { rate: 0.4,  direction: +1 },   // rises slowly (hungrier over time)
  thirst:  { rate: 0.3,  direction: +1 },   // rises slowly
  boredom: { rate: 0.5,  direction: +1 },   // rises without stimulation
  comfort: { rate: 0.1,  direction: -1 },   // slightly falls without rest
  energy:  { rate: 0.15, direction: -1 },   // very slowly depletes
};

/**
 * tickNeeds()
 * Called at THROTTLE.NEEDS_UPDATE_MS intervals.
 * Slow deterministic change — no aggressive depletion.
 */
export function tickNeeds() {
  if (now() - _lastNeedsTick < THROTTLE.NEEDS_UPDATE_MS) {
    return storage.getCompanionCore().needsState ?? {};
  }
  _lastNeedsTick = now();

  const core = storage.getCompanionCore();
  const ns   = { ...(core.needsState ?? {}) };
  const ls   = core.lifeSimulation ?? {};

  // Scale rates by routine (sleeping = very slow depletion)
  const routineScale = ls.currentRoutine === 'sleeping' ? 0.1
    : ls.currentRoutine === 'relaxed'   ? 0.4
    : ls.currentRoutine === 'active'    ? 1.2 : 1.0;

  for (const [need, { rate, direction }] of Object.entries(NEEDS_TICK_RATES)) {
    const delta = rate * routineScale * direction;
    ns[need] = clamp((ns[need] ?? 50) + delta);
  }

  ns.lastUpdated  = now();
  ns.needsVersion = NEEDS_VERSION;

  core.needsState = ns;
  storage.saveCompanionCore(core);
  return ns;
}

/**
 * satisfyNeed(need, amount)
 * Called when companion interacts with an object (drink, eat, play, rest).
 */
export function satisfyNeed(need, amount) {
  const core = storage.getCompanionCore();
  const ns   = { ...(core.needsState ?? {}) };

  const reductions = {
    hunger:  { hunger:  -amount,              comfort: +amount * 0.3 },
    thirst:  { thirst:  -amount,              comfort: +amount * 0.2 },
    boredom: { boredom: -amount,              energy:  -amount * 0.1 },
    rest:    { energy:  +amount,              comfort: +amount * 0.5, boredom: +amount * 0.1 },
  };

  const deltas = reductions[need] ?? { [need]: -amount };
  const NEED_FIELDS = new Set(['hunger','thirst','boredom','comfort','energy']);
  for (const [k, delta] of Object.entries(deltas)) {
    if (k in ns && NEED_FIELDS.has(k)) ns[k] = clamp((ns[k] ?? 50) + delta);
  }

  ns.lastUpdated = now();
  core.needsState = ns;
  storage.saveCompanionCore(core);
  return ns;
}

/**
 * getNeedsContext()
 * Returns needs + motivation summary.
 */
export function getNeedsContext() {
  const ns = storage.getCompanionCore().needsState ?? {};
  return {
    hunger:  ns.hunger  ?? 25,
    thirst:  ns.thirst  ?? 20,
    boredom: ns.boredom ?? 30,
    comfort: ns.comfort ?? 80,
    energy:  ns.energy  ?? 70,
    dominantNeed: computeDominantNeed(ns),
  };
}

function computeDominantNeed(ns) {
  // Only flag needs above meaningful thresholds — not hair-trigger
  const checks = [
    { need: 'thirst',  val: ns.thirst  ?? 20, threshold: 65 },
    { need: 'hunger',  val: ns.hunger  ?? 25, threshold: 70 },
    { need: 'boredom', val: ns.boredom ?? 30, threshold: 60 },
    { need: 'energy',  val: ns.energy  ?? 70, threshold: 25, invert: true },
  ];
  // Invert: energy is low (not high) when it needs rest
  const active = checks.filter(c => c.invert ? c.val < c.threshold : c.val > c.threshold);
  if (active.length === 0) return null;
  // Return highest urgency
  return active.sort((a, b) => {
    const ua = a.invert ? (a.threshold - a.val) : (a.val - a.threshold);
    const ub = b.invert ? (b.threshold - b.val) : (b.val - b.threshold);
    return ub - ua;
  })[0].need;
}

// ════════════════════════════════════════════════════════════════
// STEP 4 — BEHAVIOUR DECISION ENGINE
// ════════════════════════════════════════════════════════════════

/**
 * selectBehaviour()
 * Deterministic behaviour selection. Derives from:
 *   needsState + emotionalState + attachmentGraph + ambientMood + currentRoutine
 * NO random spam actions. Cooldown-gated.
 */
export function selectBehaviour(force = false) {
  if (!force && now() - _lastBehaviourTick < THROTTLE.BEHAVIOUR_TICK_MS) {
    return null;  // not ready for next decision
  }
  _lastBehaviourTick = now();

  const core = storage.getCompanionCore();
  const ns   = core.needsState        ?? {};
  const es   = core.emotionalState    ?? {};
  const ag   = core.attachmentGraph   ?? {};
  const ls   = core.lifeSimulation    ?? {};
  const as   = core.animationSystem   ?? {};

  const mood      = ls.ambientMood ?? 'calm';
  const routine   = ls.currentRoutine ?? 'idle';
  const dominant  = computeDominantNeed(ns);
  const bondLevel = ag.userBond ?? 0;

  // Sleeping override — nothing else happens
  if (routine === 'sleeping' || ls.sleepState?.isSleeping) {
    return BEHAVIOUR.IDLE;
  }

  // High priority: thirst
  if (dominant === 'thirst' && isObjectAvailable('water_bowl')) {
    return BEHAVIOUR.SEEK_WATER;
  }

  // High priority: hunger
  if (dominant === 'hunger' && isObjectAvailable('food_bowl')) {
    return BEHAVIOUR.SEEK_FOOD;
  }

  // Low energy → seek rest
  if (dominant === 'energy' && isObjectAvailable('dog_bed')) {
    return BEHAVIOUR.SEEK_REST;
  }

  // Boredom → toy if bonded enough or playful mood
  if ((dominant === 'boredom' || mood === 'playful') && isObjectAvailable('tennis_ball') && bondLevel >= 10) {
    return BEHAVIOUR.SEEK_TOY;
  }

  // Bond-driven attention
  if (bondLevel >= 30 && (mood === 'calm' || mood === 'attentive')) {
    return BEHAVIOUR.ATTEND_USER;
  }

  // Default: observe environment
  if (as.primaryLayer !== ANIM_LAYER.OBSERVING) {
    return BEHAVIOUR.OBSERVE;
  }

  return BEHAVIOUR.IDLE;
}

function isObjectAvailable(objectId) {
  const obj = getObjectById(objectId);
  if (!obj || !obj.enabled) return false;
  if (!obj.cooldownMs || !obj.lastInteractedAt) return true;
  return (now() - (obj.lastInteractedAt ?? 0)) >= obj.cooldownMs;
}

// ════════════════════════════════════════════════════════════════
// STEP 5 — ADVANCED ANIMATION STATE MACHINE
// ════════════════════════════════════════════════════════════════

/**
 * Transition cooldown map (ms) — prevents rapid state snapping.
 */
const TRANSITION_COOLDOWN = {
  [ANIM_LAYER.IDLE]:      300,
  [ANIM_LAYER.ATTENTIVE]: 400,
  [ANIM_LAYER.CURIOUS]:   600,
  [ANIM_LAYER.PLAYFUL]:   800,
  [ANIM_LAYER.DRINKING]:  1200,
  [ANIM_LAYER.EATING]:    1500,
  [ANIM_LAYER.RESTING]:   2000,
  [ANIM_LAYER.SLEEPING]:  3000,
  [ANIM_LAYER.REUNION]:   1000,
  [ANIM_LAYER.OBSERVING]: 500,
};

/**
 * transitionAnimation(targetState, reason?)
 * Blended, cooldown-gated state transition.
 * Returns { transitioned, from, to, reason }
 */
export function transitionAnimation(targetState, reason = 'behaviour') {
  if (!Object.values(ANIM_LAYER).includes(targetState)) {
    return { transitioned: false, reason: 'invalid_target_state' };
  }

  // Read current state FIRST — same-state check takes priority over all throttles
  const core = storage.getCompanionCore();
  const as   = core.animationSystem ?? {};
  const from = as.primaryLayer ?? ANIM_LAYER.IDLE;

  if (from === targetState) {
    return { transitioned: false, reason: 'already_in_state', state: from };
  }

  // Global anim write throttle (prevents render spam)
  const elapsed = now() - _lastAnimWrite;
  if (elapsed < THROTTLE.ANIM_TRANSITION_MS) {
    return { transitioned: false, reason: 'cooldown_active', remainingMs: THROTTLE.ANIM_TRANSITION_MS - elapsed };
  }

  // Per-state cooldown (smooth blending, prevents rapid state cycling)
  const stateCooldown = TRANSITION_COOLDOWN[targetState] ?? 500;
  const timeSinceLast = as.lastTransitionAt ? (now() - as.lastTransitionAt) : Infinity;
  if (timeSinceLast < stateCooldown) {
    return { transitioned: false, reason: 'state_cooldown', remainingMs: stateCooldown - timeSinceLast };
  }

  _lastAnimWrite = now();

  // Record transition
  const entry = { id: genId(), from, to: targetState, reason, ts: now() };
  as.primaryLayer    = targetState;
  as.lastTransitionAt= now();
  as.blendCooldown   = stateCooldown;
  as.transitionLog   = [...(as.transitionLog ?? []), entry].slice(-CAPS.TRANSITION_LOG);

  // Derive emotional posture from new state
  as.emotionalPosture = derivePosture(targetState, core);

  // Derive tail movement
  as.tailMovement = deriveTail(targetState, core);

  core.animationSystem = as;
  storage.saveCompanionCore(core);

  // Sync to embodiment layer (Run 7 compatibility)
  syncToEmbodiment(targetState, as.emotionalPosture);

  EventBus.emit(EVENTS.APP_STATE_CHANGED ?? 'SYSTEM::APP_STATE_CHANGED', {
    type: 'animation_transition', from, to: targetState, reason,
  });

  return { transitioned: true, from, to: targetState, reason };
}

function derivePosture(animState, core) {
  const mood = core.lifeSimulation?.ambientMood ?? 'calm';
  const bond = core.attachmentGraph?.userBond ?? 0;

  const map = {
    [ANIM_LAYER.IDLE]:      POSTURE.RELAXED,
    [ANIM_LAYER.ATTENTIVE]: bond >= 40 ? POSTURE.BONDED : POSTURE.ALERT,
    [ANIM_LAYER.CURIOUS]:   POSTURE.CURIOUS,
    [ANIM_LAYER.PLAYFUL]:   POSTURE.PLAYFUL,
    [ANIM_LAYER.DRINKING]:  POSTURE.RELAXED,
    [ANIM_LAYER.EATING]:    POSTURE.RELAXED,
    [ANIM_LAYER.RESTING]:   POSTURE.SLEEPY,
    [ANIM_LAYER.SLEEPING]:  POSTURE.SLEEPY,
    [ANIM_LAYER.REUNION]:   POSTURE.BONDED,
    [ANIM_LAYER.OBSERVING]: POSTURE.CURIOUS,
  };
  return map[animState] ?? POSTURE.RELAXED;
}

function deriveTail(animState, core) {
  const bond = core.attachmentGraph?.userBond ?? 0;
  if (animState === ANIM_LAYER.REUNION || animState === ANIM_LAYER.PLAYFUL) {
    return bond >= 50 ? TAIL.EXCITED_WAG : TAIL.WAG;
  }
  if (animState === ANIM_LAYER.SLEEPING || animState === ANIM_LAYER.RESTING) {
    return TAIL.STILL;
  }
  if (animState === ANIM_LAYER.ATTENTIVE) return TAIL.WAG;
  return TAIL.SLOW_SWAY;
}

function syncToEmbodiment(animState, posture) {
  try {
    const core = storage.getCompanionCore();
    if (core.embodiment) {
      core.embodiment.animationState = animState;
      core.embodiment.postureState   = posture;
      storage.saveCompanionCore(core);
    }
  } catch (_) { /* non-fatal */ }
}

/**
 * getAnimationState()
 */
export function getAnimationState() {
  const as = storage.getCompanionCore().animationSystem ?? {};
  return {
    primaryLayer:      as.primaryLayer      ?? ANIM_LAYER.IDLE,
    emotionalPosture:  as.emotionalPosture  ?? POSTURE.RELAXED,
    headTracking:      as.headTracking      ?? GAZE.FORWARD,
    tailMovement:      as.tailMovement      ?? TAIL.SLOW_SWAY,
    interactionLayer:  as.interactionLayer  ?? null,
    gazeTarget:        as.gazeTarget        ?? null,
    lastTransitionAt:  as.lastTransitionAt  ?? null,
    transitionLog:     as.transitionLog     ?? [],
  };
}

/**
 * deriveAnimationFromMood(ambientMood, bondStage)
 * Maps compound state to animation layer without randomness.
 */
export function deriveAnimationFromMood(ambientMood, bondStage = 'distant') {
  if (ambientMood === 'sleepy')   return ANIM_LAYER.RESTING;
  if (ambientMood === 'playful')  return ANIM_LAYER.PLAYFUL;
  if (ambientMood === 'curious')  return ANIM_LAYER.CURIOUS;
  if (ambientMood === 'attentive') {
    return bondStage === 'deeply_bonded' || bondStage === 'bonded'
      ? ANIM_LAYER.REUNION : ANIM_LAYER.ATTENTIVE;
  }
  return ANIM_LAYER.IDLE;
}

// ════════════════════════════════════════════════════════════════
// STEP 6 — PROCEDURAL IDLE MOTION
// ════════════════════════════════════════════════════════════════

/**
 * Procedural motion tick rates (per call, called on IDLE_ROTATE_MS intervals).
 * Very low frequency — calming, life-like, NOT robotic loops.
 */
const PROCEDURAL_SEQUENCES = [
  { name: 'breathing',    label: 'Slow chest rise',      emotionFilter: null,        weight: 10 },
  { name: 'blink',        label: 'Natural blink',         emotionFilter: null,        weight:  6 },
  { name: 'ear_twitch',   label: 'Ear flick',             emotionFilter: null,        weight:  3 },
  { name: 'posture_shift',label: 'Subtle weight shift',   emotionFilter: null,        weight:  2 },
  { name: 'head_tilt',    label: 'Slow head tilt',        emotionFilter: 'curious',   weight:  4 },
  { name: 'tail_sway',    label: 'Gentle tail sway',      emotionFilter: null,        weight:  5 },
  { name: 'yawn',         label: 'Soft yawn',             emotionFilter: 'sleepy',    weight:  3 },
  { name: 'nose_sniff',   label: 'Sniff air',             emotionFilter: null,        weight:  2 },
];

/**
 * tickProceduralIdle()
 * Advances procedural idle state. Throttled to IDLE_ROTATE_MS.
 * Returns the selected micro-behaviour or null if not ready.
 */
export function tickProceduralIdle() {
  if (now() - _lastIdleRotate < THROTTLE.IDLE_ROTATE_MS) return null;
  _lastIdleRotate = now();

  const core  = storage.getCompanionCore();
  const as    = core.animationSystem ?? {};
  const mood  = core.lifeSimulation?.ambientMood ?? 'calm';
  const layer = as.primaryLayer ?? ANIM_LAYER.IDLE;

  // Procedural motion only applies during non-active interactions
  if ([ANIM_LAYER.DRINKING, ANIM_LAYER.EATING, ANIM_LAYER.SLEEPING].includes(layer)) {
    return null;
  }

  // Filter sequences by emotional context
  const eligible = PROCEDURAL_SEQUENCES.filter(s =>
    s.emotionFilter === null || s.emotionFilter === mood
  );

  // Weighted deterministic selection based on phase (not random)
  const totalWeight = eligible.reduce((s, e) => s + e.weight, 0);
  const ps    = as.proceduralState ?? {};
  const phase = ps.breathPhase ?? 0;
  // Use phase as deterministic selector (cycles 0→1)
  const selector = (phase * totalWeight) % totalWeight;
  let acc = 0;
  let selected = eligible[0];
  for (const seq of eligible) {
    acc += seq.weight;
    if (selector < acc) { selected = seq; break; }
  }

  // Advance phase
  const newPhase = (phase + 0.137) % 1;  // irrational increment → non-repeating cycle

  as.proceduralState = {
    ...ps,
    breathPhase:          newPhase,
    blinkCooldown:        selected.name === 'blink'        ? 4000 : Math.max(0, (ps.blinkCooldown        ?? 0) - THROTTLE.IDLE_ROTATE_MS),
    earTwitchCooldown:    selected.name === 'ear_twitch'   ? 6000 : Math.max(0, (ps.earTwitchCooldown    ?? 0) - THROTTLE.IDLE_ROTATE_MS),
    postureShiftCooldown: selected.name === 'posture_shift'? 8000 : Math.max(0, (ps.postureShiftCooldown ?? 0) - THROTTLE.IDLE_ROTATE_MS),
    tailSwayPhase:        (ps.tailSwayPhase ?? 0 + 0.05) % 1,
  };

  core.animationSystem = as;
  storage.saveCompanionCore(core);

  return { name: selected.name, label: selected.label, phase: newPhase };
}

/**
 * getProceduralState()
 */
export function getProceduralState() {
  return storage.getCompanionCore().animationSystem?.proceduralState ?? {};
}

// ════════════════════════════════════════════════════════════════
// STEP 7 — OBJECT INTERACTION ANIMATIONS
// ════════════════════════════════════════════════════════════════

/**
 * Object interaction sequences — deterministic, no randomness.
 * Each defines: animLayer, needSatisfied, satisfyAmount, duration, emotional response.
 */
const OBJECT_INTERACTIONS = {
  [INTERACT_TYPE.DRINK]: {
    animLayer:      ANIM_LAYER.DRINKING,
    needSatisfied:  'thirst',
    satisfyAmount:  20,
    durationMs:     3000,
    emotionalShift: { comfort: +5 },
    label:          'Drinking from water bowl',
  },
  [INTERACT_TYPE.EAT]: {
    animLayer:      ANIM_LAYER.EATING,
    needSatisfied:  'hunger',
    satisfyAmount:  25,
    durationMs:     4000,
    emotionalShift: { comfort: +8 },
    label:          'Eating from food bowl',
  },
  [INTERACT_TYPE.PLAY]: {
    animLayer:      ANIM_LAYER.PLAYFUL,
    needSatisfied:  'boredom',
    satisfyAmount:  30,
    durationMs:     5000,
    emotionalShift: { energy: -5, comfort: +3 },
    label:          'Playing with tennis ball',
  },
  [INTERACT_TYPE.SLEEP]: {
    animLayer:      ANIM_LAYER.RESTING,
    needSatisfied:  'rest',
    satisfyAmount:  20,
    durationMs:     8000,
    emotionalShift: { energy: +15, comfort: +5 },
    label:          'Resting on dog bed',
  },
};

/**
 * startObjectInteraction(objectId)
 * Initiates an object interaction sequence.
 * Returns { started, objectId, interaction } or { started: false, reason }
 */
export function startObjectInteraction(objectId) {
  const obj = getObjectById(objectId);
  if (!obj) return { started: false, reason: 'object_not_found' };
  if (!obj.enabled) return { started: false, reason: 'object_disabled' };
  if (!isObjectAvailable(objectId)) return { started: false, reason: 'on_cooldown' };

  const interaction = OBJECT_INTERACTIONS[obj.interactionType];
  if (!interaction) return { started: false, reason: 'no_interaction_defined' };

  // Transition animation — object interactions bypass all cooldowns
  _lastAnimWrite = 0;
  {
    // Also clear the per-state cooldown from storage so object interactions always proceed
    const _cc = storage.getCompanionCore();
    if (_cc.animationSystem) { _cc.animationSystem.lastTransitionAt = null; storage.saveCompanionCore(_cc); }
  }
  const trans = transitionAnimation(interaction.animLayer, `object_interact:${objectId}`);
  if (!trans.transitioned && trans.reason !== 'already_in_state') {
    return { started: false, reason: `animation_blocked:${trans.reason}` };
  }

  // Set interaction layer
  const core = storage.getCompanionCore();
  const as   = core.animationSystem ?? {};
  as.interactionLayer = interaction.label;
  as.gazeTarget       = objectId;
  core.animationSystem = as;

  // Mark object last interacted + log
  const es = core.environmentSystem ?? {};
  es.environmentObjects = (es.environmentObjects ?? []).map(o =>
    o.id === objectId ? { ...o, lastInteractedAt: now() } : o
  );
  es.lastObjectInteraction = { objectId, action: obj.interactionType, ts: now() };
  es.objectInteractionLog = [...(es.objectInteractionLog ?? []), {
    id: genId(), objectId, action: obj.interactionType,
    label: interaction.label, ts: now(),
  }].slice(-CAPS.OBJ_LOG);
  core.environmentSystem = es;

  storage.saveCompanionCore(core);

  // Satisfy the relevant need
  satisfyNeed(interaction.needSatisfied, interaction.satisfyAmount);

  // Apply emotional shifts
  if (interaction.emotionalShift) {
    const fresh = storage.getCompanionCore();
    const ns = fresh.needsState ?? {};
    for (const [k, delta] of Object.entries(interaction.emotionalShift)) {
      if (k in ns) ns[k] = clamp((ns[k] ?? 50) + delta);
    }
    fresh.needsState = ns;
    storage.saveCompanionCore(fresh);
  }

  return {
    started:     true,
    objectId,
    interaction: {
      type:       obj.interactionType,
      layer:      interaction.animLayer,
      label:      interaction.label,
      durationMs: interaction.durationMs,
    },
  };
}

/**
 * completeObjectInteraction()
 * Called after interaction duration elapses.
 * Clears interactionLayer, returns to idle.
 */
export function completeObjectInteraction() {
  const core = storage.getCompanionCore();
  const as   = core.animationSystem ?? {};
  const prevLayer = as.interactionLayer;

  as.interactionLayer = null;
  as.gazeTarget       = null;
  core.animationSystem = as;
  storage.saveCompanionCore(core);

  transitionAnimation(ANIM_LAYER.IDLE, 'interaction_complete');
  return { completed: true, previousInteraction: prevLayer };
}

/**
 * getObjectInteractionLog(limit)
 */
export function getObjectInteractionLog(limit = 10) {
  return (storage.getCompanionCore().environmentSystem?.objectInteractionLog ?? []).slice(-limit);
}

// ════════════════════════════════════════════════════════════════
// STEP 8 — EMOTIONAL POSTURE SYSTEM
// ════════════════════════════════════════════════════════════════

/**
 * derivePostureFromEmotionalState()
 * Maps current companion emotional state → posture + animation pacing.
 * Called on mood changes, attachment changes, energy updates.
 */
export function derivePostureFromEmotionalState() {
  const core  = storage.getCompanionCore();
  const mood  = core.lifeSimulation?.ambientMood ?? 'calm';
  const bond  = core.attachmentGraph?.userBond   ?? 0;
  const energy= core.needsState?.energy          ?? 70;
  const trust = core.identity?.trust             ?? 0;
  const layer = core.animationSystem?.primaryLayer ?? ANIM_LAYER.IDLE;

  // Don't override active interaction postures
  if ([ANIM_LAYER.DRINKING, ANIM_LAYER.EATING, ANIM_LAYER.SLEEPING].includes(layer)) {
    return null;
  }

  let posture = POSTURE.RELAXED;
  let pacing  = 1.0;  // 1.0 = normal, <1 = slower, >1 = faster

  if (energy < 25) {
    posture = POSTURE.SLEEPY;
    pacing  = 0.6;
  } else if (mood === 'playful') {
    posture = POSTURE.PLAYFUL;
    pacing  = 1.3;
  } else if (mood === 'curious') {
    posture = POSTURE.CURIOUS;
    pacing  = 1.1;
  } else if (mood === 'attentive' && (bond >= 40 || trust >= 60)) {
    posture = POSTURE.BONDED;
    pacing  = 0.9;
  } else if (mood === 'calm') {
    posture = POSTURE.RELAXED;
    pacing  = 0.8;
  }

  const fresh = storage.getCompanionCore();
  const as    = fresh.animationSystem ?? {};
  const changed = as.emotionalPosture !== posture;

  as.emotionalPosture = posture;
  fresh.animationSystem = as;
  storage.saveCompanionCore(fresh);

  // Sync embodiment layer
  syncToEmbodiment(as.primaryLayer ?? ANIM_LAYER.IDLE, posture);

  return { posture, pacing, mood, changed };
}

/**
 * getPostureContext()
 */
export function getPostureContext() {
  const as   = storage.getCompanionCore().animationSystem ?? {};
  const ns   = storage.getCompanionCore().needsState ?? {};
  const ls   = storage.getCompanionCore().lifeSimulation ?? {};
  return {
    emotionalPosture: as.emotionalPosture ?? POSTURE.RELAXED,
    tailMovement:     as.tailMovement     ?? TAIL.SLOW_SWAY,
    idleBreathing:    as.idleBreathing    ?? true,
    energy:           ns.energy           ?? 70,
    ambientMood:      ls.ambientMood      ?? 'calm',
  };
}

// ════════════════════════════════════════════════════════════════
// STEP 9 — GAZE + ATTENTION SYSTEM
// ════════════════════════════════════════════════════════════════

/**
 * updateGaze(target, reason?)
 * Shifts gaze target with cooldown enforcement.
 * NO rapid snapping — smooth attention movement only.
 * target: 'user' | objectId | null (= idle scan)
 */
export function updateGaze(target, reason = 'behaviour') {
  // Read current gaze FIRST — same-target check takes priority over cooldown
  const core = storage.getCompanionCore();
  const as   = core.animationSystem ?? {};
  const prev = as.gazeTarget;

  const prevNorm = prev ?? 'none';
  const targNorm = target ?? 'none';
  if (prevNorm === targNorm) {
    return { shifted: false, reason: 'same_target' };
  }

  const elapsed = now() - _lastGazeShift;
  if (elapsed < THROTTLE.GAZE_SHIFT_MS) {
    return { shifted: false, reason: 'gaze_cooldown', remainingMs: THROTTLE.GAZE_SHIFT_MS - elapsed };
  }

  _lastGazeShift = now();

  // Derive head tracking from target
  let headTracking = GAZE.FORWARD;
  if (target === 'user')  headTracking = GAZE.TOWARD_USER;
  else if (target === null) headTracking = GAZE.SCANNING;
  else                      headTracking = GAZE.TOWARD_OBJECT;

  as.gazeTarget   = target;
  as.headTracking = headTracking;
  core.animationSystem = as;
  storage.saveCompanionCore(core);

  return { shifted: true, from: prev ?? 'none', to: target ?? 'none', headTracking, reason };
}

/**
 * performIdleGazeScan()
 * Companion softly scans environment during idle — not user-triggered.
 * Runs on IDLE_ROTATE_MS cadence, only during idle animation.
 */
export function performIdleGazeScan() {
  const core  = storage.getCompanionCore();
  const layer = core.animationSystem?.primaryLayer ?? ANIM_LAYER.IDLE;

  if (![ANIM_LAYER.IDLE, ANIM_LAYER.OBSERVING].includes(layer)) return null;

  const objects   = getEnvironmentObjects().filter(o => o.enabled);
  const gazeSeq   = ['user', ...objects.map(o => o.id), null];
  const phaseIdx  = Math.floor(
    ((core.animationSystem?.proceduralState?.breathPhase ?? 0) * gazeSeq.length)
  ) % gazeSeq.length;

  return updateGaze(gazeSeq[phaseIdx], 'idle_scan');
}

/**
 * getGazeContext()
 */
export function getGazeContext() {
  const as = storage.getCompanionCore().animationSystem ?? {};
  return {
    gazeTarget:  as.gazeTarget  ?? null,
    headTracking:as.headTracking ?? GAZE.FORWARD,
    gazeCooldown:as.gazeCooldown ?? 0,
  };
}

// ════════════════════════════════════════════════════════════════
// STEP 10 — PERFORMANCE SAFETY LAYER
// ════════════════════════════════════════════════════════════════

let _renderThrottleCount = 0;
let _lastHealthReport    = null;

/**
 * runPerformanceCheck()
 * Throttled health check. Returns performance report.
 * Detects: runaway transitions, excessive object interactions, memory growth.
 */
export function runPerformanceCheck() {
  if (now() - _lastHealthTick < THROTTLE.HEALTH_TICK_MS) {
    return _lastHealthReport ?? { status: 'stable' };
  }
  _lastHealthTick = now();

  const core = storage.getCompanionCore();
  const as   = core.animationSystem ?? {};
  const es   = core.environmentSystem ?? {};
  const warnings = [];

  // 1. Transition rate
  const recentTrans = (as.transitionLog ?? []).filter(t => now() - t.ts < 10_000);
  if (recentTrans.length > 5) warnings.push(`high transition rate: ${recentTrans.length} in 10s`);

  // 2. Object interaction log growth
  const objLog = es.objectInteractionLog ?? [];
  if (objLog.length >= CAPS.OBJ_LOG - 5) warnings.push(`object log near cap: ${objLog.length}/${CAPS.OBJ_LOG}`);

  // 3. Blend cooldown stuck
  if ((as.blendCooldown ?? 0) > 5000) warnings.push(`blend cooldown elevated: ${as.blendCooldown}ms`);

  // 4. Needs all at extremes
  const ns = core.needsState ?? {};
  const extremes = Object.entries(ns)
    .filter(([k, v]) => typeof v === 'number' && (v <= 2 || v >= 98))
    .map(([k]) => k);
  if (extremes.length >= 3) warnings.push(`multiple needs at extremes: ${extremes.join(', ')}`);

  const report = {
    ts:          now(),
    status:      warnings.length > 0 ? 'warning' : 'stable',
    warnings,
    checks: {
      transitionRate:    recentTrans.length,
      objLogSize:        objLog.length,
      blendCooldown:     as.blendCooldown ?? 0,
      needsExtremes:     extremes.length,
    },
  };

  _lastHealthReport = report;
  return report;
}

/**
 * throttleRenderUpdate()
 * Call before each render update — returns true if update should proceed.
 * Implements LOD (Level of Detail) reduction under load.
 */
export function throttleRenderUpdate() {
  _renderThrottleCount++;
  // Allow every update unless we're in a known high-load state
  const core = storage.getCompanionCore();
  const layer = core.animationSystem?.primaryLayer ?? ANIM_LAYER.IDLE;

  // During sleep/rest — lowest update frequency (every 4th frame)
  if (layer === ANIM_LAYER.SLEEPING) return _renderThrottleCount % 4 === 0;
  // During resting — every 2nd frame
  if (layer === ANIM_LAYER.RESTING)  return _renderThrottleCount % 2 === 0;
  // Otherwise — every frame
  return true;
}

// ════════════════════════════════════════════════════════════════
// STEP 12 — PERSISTENCE + RECOVERY
// ════════════════════════════════════════════════════════════════

/**
 * captureEmbodimentSession()
 * Saves current embodiment state for session restoration.
 */
export function captureEmbodimentSession() {
  const core = storage.getCompanionCore();
  const as   = core.animationSystem   ?? {};
  const es   = core.environmentSystem ?? {};
  const ns   = core.needsState        ?? {};

  const sessionState = {
    capturedAt:       now(),
    animationSystem: {
      primaryLayer:    as.primaryLayer    ?? ANIM_LAYER.IDLE,
      emotionalPosture:as.emotionalPosture?? POSTURE.RELAXED,
      headTracking:    as.headTracking    ?? GAZE.FORWARD,
      tailMovement:    as.tailMovement    ?? TAIL.SLOW_SWAY,
      gazeTarget:      as.gazeTarget      ?? null,
    },
    environmentSystem: {
      activeScene:  es.activeScene  ?? SCENE.LIVING_ROOM,
      lightingMode: es.lightingMode ?? LIGHTING.WARM_SOFT,
      ambientState: es.ambientState ?? AMBIENT_STATE.CALM,
    },
    needsState: {
      hunger:  ns.hunger  ?? 25,
      thirst:  ns.thirst  ?? 20,
      boredom: ns.boredom ?? 30,
      comfort: ns.comfort ?? 80,
      energy:  ns.energy  ?? 70,
    },
  };

  storage.saveSession({ ...storage.getSession(), embodimentRestore: sessionState });
  return sessionState;
}

/**
 * restoreEmbodimentSession()
 * Restores embodiment continuity on reload.
 * NO default reset — companion continues where it left off.
 */
export function restoreEmbodimentSession() {
  const session = storage.getSession();
  const state   = session?.embodimentRestore;

  if (!state || !state.capturedAt) {
    return { restored: false, reason: 'no_embodiment_session' };
  }

  const core = storage.getCompanionCore();
  const ops  = [];

  // Restore animation system
  if (state.animationSystem) {
    core.animationSystem = {
      ...(core.animationSystem ?? {}),
      ...state.animationSystem,
      interactionLayer: null,   // never restore mid-interaction
      transitionLog:    [],
    };
    ops.push('restored:animationSystem');
  }

  // Restore environment
  if (state.environmentSystem) {
    core.environmentSystem = {
      ...(core.environmentSystem ?? {}),
      ...state.environmentSystem,
    };
    ops.push('restored:environmentSystem');
  }

  // Restore needs (with decay for time elapsed)
  if (state.needsState) {
    const elapsedMinutes = (now() - state.capturedAt) / 60_000;
    const ns = { ...state.needsState };
    // Apply gentle time decay during absence
    ns.hunger  = clamp(ns.hunger  + elapsedMinutes * 0.4 * 0.5);
    ns.thirst  = clamp(ns.thirst  + elapsedMinutes * 0.3 * 0.5);
    ns.boredom = clamp(ns.boredom + elapsedMinutes * 0.5 * 0.3);
    ns.energy  = clamp(ns.energy  - elapsedMinutes * 0.1 * 0.3);
    ns.lastUpdated = now();
    core.needsState = ns;
    ops.push('restored:needsState (with time decay)');
  }

  // Sync embodiment layer
  if (state.animationSystem) {
    syncToEmbodiment(
      state.animationSystem.primaryLayer ?? ANIM_LAYER.IDLE,
      state.animationSystem.emotionalPosture ?? POSTURE.RELAXED,
    );
    ops.push('synced:embodiment');
  }

  storage.saveCompanionCore(core);
  return { restored: true, capturedAt: state.capturedAt, ops };
}

// ════════════════════════════════════════════════════════════════
// BOOT INTEGRATION
// ════════════════════════════════════════════════════════════════

/**
 * initEmbodimentExpansion()
 * Called from companionCoreService.initCompanionCore() — boot step.
 * 1. Init environment system
 * 2. Seed environment objects
 * 3. Restore embodiment session
 * 4. Derive posture from current emotional state
 * 5. Run performance check
 */
export function initEmbodimentExpansion() {
  // 1. Environment system
  initEnvironmentSystem();

  // 2. Restore session continuity
  const restoration = restoreEmbodimentSession();

  // 3. Posture sync
  derivePostureFromEmotionalState();

  // 4. Performance baseline
  const perf = runPerformanceCheck();

  console.log('IMMORTAIL EMBODIMENT EXPANSION: boot complete', {
    scene:    storage.getCompanionCore().environmentSystem?.activeScene,
    anim:     storage.getCompanionCore().animationSystem?.primaryLayer,
    posture:  storage.getCompanionCore().animationSystem?.emotionalPosture,
    restored: restoration.restored,
    perf:     perf.status,
  });

  return { restoration, perf };
}

// ════════════════════════════════════════════════════════════════
// STEP 11 — OLLAMA EMBODIMENT CONTEXT UPGRADE
// ════════════════════════════════════════════════════════════════

/**
 * getEmbodimentExpansionContext()
 * Returns full embodiment context for Ollama prompt injection.
 * Covers: scene, animation, needs, posture, gaze, object interaction.
 */
export function getEmbodimentExpansionContext() {
  const env    = getEnvironmentContext();
  const needs  = getNeedsContext();
  const posture= getPostureContext();
  const gaze   = getGazeContext();
  const perf   = _lastHealthReport ?? { status: 'stable' };

  return {
    // Environment
    activeScene:             env.activeScene,
    lightingMode:            env.lightingMode,
    ambientState:            env.ambientState,
    // Animation
    currentAnimationState:   env.currentAnimationState,
    postureState:            env.postureState,
    headTracking:            env.headTracking,
    tailMovement:            env.tailMovement,
    interactionLayer:        env.activeObjectInteraction,
    gazeTarget:              env.gazeTarget,
    // Needs
    hunger:                  needs.hunger,
    thirst:                  needs.thirst,
    boredom:                 needs.boredom,
    energy:                  needs.energy,
    dominantNeed:            needs.dominantNeed,
    // Performance
    performanceStatus:       perf.status,
    // Last object
    lastObjectInteraction:   env.lastObjectInteraction,
  };
}
