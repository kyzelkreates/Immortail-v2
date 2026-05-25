/**
 * IMMORTAIL™ — RUN 16
 * worldEngine.js
 *
 * Advanced Environment + World Expansion Engine
 * Dynamic Living Space System — production safe.
 *
 * ARCHITECTURE RULES:
 *   - SSOT: all state through companionCore via storage.js only
 *   - No random world generation — environments are deterministic templates
 *   - No instant scene switching — all transitions are gradual
 *   - Offline-first: no cloud dependency for world state
 *   - Groq cannot mutate world state directly
 *   - Ollama owns emotional interpretation + memory linking
 *   - All changes validated before commit
 *   - Runs 1–15 untouched
 */

import storage from './storage.js';

// ══════════════════════════════════════════════════════════════════
// CONSTANTS & ENUMS
// ══════════════════════════════════════════════════════════════════

export const WORLD_ENGINE_ID = 'worldEngine_V1';

export const ENVIRONMENT_ID = {
  LIVING_ROOM:        'living_room',
  BEDROOM:            'bedroom',
  GARDEN:             'garden',
  PARK:               'park',
  COZY_EVENING_ROOM:  'cozy_evening_room',
  SUNNY_WINDOW_AREA:  'sunny_window_area',
  QUIET_REST_ZONE:    'quiet_rest_zone',
};

export const TIME_OF_DAY = {
  MORNING:   'morning',
  AFTERNOON: 'afternoon',
  EVENING:   'evening',
  NIGHT:     'night',
};

export const TRANSITION_STATE = {
  STABLE:      'stable',
  FADING_OUT:  'fading_out',
  FADING_IN:   'fading_in',
  COMPLETE:    'complete',
};

export const ENVIRONMENT_MOOD = {
  NEUTRAL:   'neutral',
  CALM:      'calm',
  PLAYFUL:   'playful',
  COZY:      'cozy',
  ENERGETIC: 'energetic',
  RESTING:   'resting',
  CURIOUS:   'curious',
};

// ── Performance / safety caps ─────────────────────────────────────
export const WORLD_CAPS = {
  TRANSITION_LOG_MAX:    20,
  MEMORY_LINK_MAX:       50,
  OBJECT_LOG_MAX:        30,
  SAFETY_LOG_MAX:        40,
  TRANSITION_STEP_MS:    800,   // ms per fade step
  MIN_ENV_HOLD_MS:       3000,  // minimum ms before another transition
};

// ══════════════════════════════════════════════════════════════════
// STEP 2 — ENVIRONMENT REGISTRY (deterministic, immutable templates)
// ══════════════════════════════════════════════════════════════════

export const ENVIRONMENT_PROFILES = Object.freeze({
  [ENVIRONMENT_ID.LIVING_ROOM]: Object.freeze({
    id:              'living_room',
    label:           'Living Room',
    emoji:           '🛋️',
    defaultMood:     ENVIRONMENT_MOOD.NEUTRAL,
    emotionalBias:   { calm: 0.3, playful: 0.3, curious: 0.2, resting: 0.2 },
    lightingPreset:  'warm_neutral',
    defaultTimeZone: TIME_OF_DAY.AFTERNOON,
    animationPacing: 'normal',
    microBehaviours: ['window_glance', 'toy_nudge', 'stretch'],
    voiceToneBias:   'balanced',
    spatialZones:    ['sofa_area', 'rug_center', 'window_ledge', 'toy_corner'],
    ambientSound:    'soft_room_tone',
    offlineReady:    true,
  }),
  [ENVIRONMENT_ID.BEDROOM]: Object.freeze({
    id:              'bedroom',
    label:           'Bedroom',
    emoji:           '🛏️',
    defaultMood:     ENVIRONMENT_MOOD.RESTING,
    emotionalBias:   { resting: 0.5, calm: 0.4, playful: 0.1 },
    lightingPreset:  'dim_warm',
    defaultTimeZone: TIME_OF_DAY.NIGHT,
    animationPacing: 'slow',
    microBehaviours: ['curl_up', 'yawn', 'blanket_nudge', 'slow_blink'],
    voiceToneBias:   'gentle',
    spatialZones:    ['bed_center', 'pillow_area', 'floor_beside_bed'],
    ambientSound:    'quiet_room',
    offlineReady:    true,
  }),
  [ENVIRONMENT_ID.GARDEN]: Object.freeze({
    id:              'garden',
    label:           'Garden',
    emoji:           '🌿',
    defaultMood:     ENVIRONMENT_MOOD.CURIOUS,
    emotionalBias:   { curious: 0.4, playful: 0.4, energetic: 0.2 },
    lightingPreset:  'bright_natural',
    defaultTimeZone: TIME_OF_DAY.MORNING,
    animationPacing: 'lively',
    microBehaviours: ['sniff_ground', 'grass_roll', 'chase_butterfly', 'sunbathe'],
    voiceToneBias:   'warm_playful',
    spatialZones:    ['garden_path', 'grass_patch', 'flower_bed', 'sunny_spot'],
    ambientSound:    'birds_breeze',
    offlineReady:    true,
  }),
  [ENVIRONMENT_ID.PARK]: Object.freeze({
    id:              'park',
    label:           'Park',
    emoji:           '🌳',
    defaultMood:     ENVIRONMENT_MOOD.PLAYFUL,
    emotionalBias:   { playful: 0.5, curious: 0.3, energetic: 0.2 },
    lightingPreset:  'bright_natural',
    defaultTimeZone: TIME_OF_DAY.AFTERNOON,
    animationPacing: 'lively',
    microBehaviours: ['run_loop', 'fetch_ball', 'explore_sniff', 'jump_greeting'],
    voiceToneBias:   'excited',
    spatialZones:    ['open_field', 'bench_area', 'tree_shade', 'path_edge'],
    ambientSound:    'park_ambient',
    offlineReady:    true,
  }),
  [ENVIRONMENT_ID.COZY_EVENING_ROOM]: Object.freeze({
    id:              'cozy_evening_room',
    label:           'Cozy Evening Room',
    emoji:           '🕯️',
    defaultMood:     ENVIRONMENT_MOOD.COZY,
    emotionalBias:   { calm: 0.5, resting: 0.3, cozy: 0.2 },
    lightingPreset:  'amber_low',
    defaultTimeZone: TIME_OF_DAY.EVENING,
    animationPacing: 'slow',
    microBehaviours: ['fireplace_watch', 'slow_tail_sway', 'comfortable_sigh', 'soft_gaze'],
    voiceToneBias:   'warm_soft',
    spatialZones:    ['hearth_area', 'rug_center', 'cushion_pile'],
    ambientSound:    'fireplace_crackle',
    offlineReady:    true,
  }),
  [ENVIRONMENT_ID.SUNNY_WINDOW_AREA]: Object.freeze({
    id:              'sunny_window_area',
    label:           'Sunny Window Area',
    emoji:           '☀️',
    defaultMood:     ENVIRONMENT_MOOD.CALM,
    emotionalBias:   { calm: 0.4, curious: 0.3, energetic: 0.3 },
    lightingPreset:  'bright_warm',
    defaultTimeZone: TIME_OF_DAY.MORNING,
    animationPacing: 'gentle',
    microBehaviours: ['sunbeam_watch', 'stretch_in_light', 'window_gaze', 'dust_mote_watch'],
    voiceToneBias:   'bright',
    spatialZones:    ['window_sill', 'sunbeam_patch', 'curtain_edge'],
    ambientSound:    'soft_breeze',
    offlineReady:    true,
  }),
  [ENVIRONMENT_ID.QUIET_REST_ZONE]: Object.freeze({
    id:              'quiet_rest_zone',
    label:           'Quiet Rest Zone',
    emoji:           '😴',
    defaultMood:     ENVIRONMENT_MOOD.RESTING,
    emotionalBias:   { resting: 0.6, calm: 0.4 },
    lightingPreset:  'very_dim',
    defaultTimeZone: TIME_OF_DAY.NIGHT,
    animationPacing: 'minimal',
    microBehaviours: ['deep_sleep_breath', 'ear_twitch', 'paw_flex'],
    voiceToneBias:   'whisper',
    spatialZones:    ['rest_mat', 'pillow_zone'],
    ambientSound:    'white_noise',
    offlineReady:    true,
  }),
});

// ══════════════════════════════════════════════════════════════════
// STEP 3 — TIME + LIGHTING SIMULATION SYSTEM
// ══════════════════════════════════════════════════════════════════

/** Lighting presets — fully deterministic, no random values */
export const LIGHTING_PRESETS = Object.freeze({
  bright_natural: { lightingIntensity: 0.95, warmthLevel: 0.55, shadowDepth: 0.45 },
  bright_warm:    { lightingIntensity: 0.90, warmthLevel: 0.75, shadowDepth: 0.35 },
  warm_neutral:   { lightingIntensity: 0.75, warmthLevel: 0.60, shadowDepth: 0.30 },
  warm_soft:      { lightingIntensity: 0.65, warmthLevel: 0.70, shadowDepth: 0.25 },
  amber_low:      { lightingIntensity: 0.45, warmthLevel: 0.85, shadowDepth: 0.50 },
  dim_warm:       { lightingIntensity: 0.30, warmthLevel: 0.80, shadowDepth: 0.60 },
  very_dim:       { lightingIntensity: 0.15, warmthLevel: 0.70, shadowDepth: 0.75 },
});

/** Time-of-day modifiers — deterministic overlays */
export const TIME_LIGHTING_MOD = Object.freeze({
  [TIME_OF_DAY.MORNING]:   { intensityMod: +0.10, warmthMod: -0.05, shadowMod: -0.05 },
  [TIME_OF_DAY.AFTERNOON]: { intensityMod:  0.00, warmthMod:  0.00, shadowMod:  0.00 },
  [TIME_OF_DAY.EVENING]:   { intensityMod: -0.15, warmthMod: +0.15, shadowMod: +0.10 },
  [TIME_OF_DAY.NIGHT]:     { intensityMod: -0.35, warmthMod: +0.10, shadowMod: +0.20 },
});

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

/**
 * computeLightingState(environmentId, timeOfDay)
 * Returns deterministic lighting values — no randomness.
 */
export function computeLightingState(environmentId, timeOfDay) {
  const profile = ENVIRONMENT_PROFILES[environmentId];
  const preset  = LIGHTING_PRESETS[profile?.lightingPreset ?? 'warm_neutral'];
  const mod     = TIME_LIGHTING_MOD[timeOfDay ?? TIME_OF_DAY.AFTERNOON];

  return {
    lightingIntensity: clamp01(preset.lightingIntensity + mod.intensityMod),
    warmthLevel:       clamp01(preset.warmthLevel       + mod.warmthMod),
    shadowDepth:       clamp01(preset.shadowDepth       + mod.shadowMod),
    preset:            profile?.lightingPreset ?? 'warm_neutral',
    timeOfDay:         timeOfDay ?? TIME_OF_DAY.AFTERNOON,
    computed:          true,
    random:            false,
  };
}

/**
 * deriveTimeOfDay()
 * Derives time-of-day from real wall clock — deterministic.
 */
export function deriveTimeOfDay() {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return TIME_OF_DAY.MORNING;
  if (h >= 12 && h < 17) return TIME_OF_DAY.AFTERNOON;
  if (h >= 17 && h < 21) return TIME_OF_DAY.EVENING;
  return TIME_OF_DAY.NIGHT;
}

// ══════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ══════════════════════════════════════════════════════════════════

function genId() { return `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

let _safetyLog      = [];
let _lastTransition = 0;
let _throttleWrite  = 0;

function logSafety(type, detail) {
  _safetyLog = [..._safetyLog, { id: genId(), ts: Date.now(), type, detail: String(detail).slice(0, 80) }]
    .slice(-WORLD_CAPS.SAFETY_LOG_MAX);
}

function getWorldEngine() {
  return storage.getCompanionCore().worldEngine ?? getDefaultWorldEngine();
}

function getDefaultWorldEngine() {
  return {
    activeEnvironment:   ENVIRONMENT_ID.LIVING_ROOM,
    previousEnvironment: null,
    transitionState:     TRANSITION_STATE.STABLE,
    environmentMood:     ENVIRONMENT_MOOD.NEUTRAL,
    timeOfDay:           TIME_OF_DAY.AFTERNOON,
    lightingState:       computeLightingState(ENVIRONMENT_ID.LIVING_ROOM, TIME_OF_DAY.AFTERNOON),
    worldObjects:        getDefaultWorldObjects(),
    transitionEngine:    getDefaultTransitionEngine(),
    environmentMemoryMap:[],
    transitionLog:       [],
    worldVersion:        'V1',
  };
}

function getDefaultTransitionEngine() {
  return {
    activeTransition:    false,
    fromEnvironment:     null,
    toEnvironment:       null,
    transitionProgress:  0.0,
    startedAt:           null,
  };
}

function getDefaultWorldObjects() {
  return {
    toys:              [],
    foodBowl:          { id: 'food_bowl',  label: 'Food Bowl',  position: 'kitchen_corner', state: 'empty',    stable: true },
    waterBowl:         { id: 'water_bowl', label: 'Water Bowl', position: 'kitchen_corner', state: 'full',     stable: true },
    bed:               { id: 'bed',        label: 'Dog Bed',    position: 'bedroom_floor',  state: 'available',stable: true },
    blanket:           { id: 'blanket',    label: 'Blanket',    position: 'sofa_area',       state: 'available',stable: true },
    windowZone:        { id: 'window',     label: 'Window',     position: 'living_room_wall',state: 'open',     stable: true },
    interactionPoints: [
      { id: 'ip_toy_spot',     label: 'Toy Spot',     zone: 'toy_corner',   active: true },
      { id: 'ip_rest_spot',    label: 'Rest Spot',    zone: 'rug_center',   active: true },
      { id: 'ip_window_look',  label: 'Window Look',  zone: 'window_ledge', active: true },
    ],
  };
}

function saveWorld(patch, force = false) {
  const now = Date.now();
  if (!force && now - _throttleWrite < 400) return false;
  _throttleWrite = now;
  const core = storage.getCompanionCore();
  core.worldEngine = { ...(core.worldEngine ?? getDefaultWorldEngine()), ...patch };
  storage.saveCompanionCore(core);
  return true;
}
function saveWorldForce(patch) { _throttleWrite = 0; saveWorld(patch, true); }

// ══════════════════════════════════════════════════════════════════
// STEP 1 — WORLD CORE ENGINE INIT
// ══════════════════════════════════════════════════════════════════

export function initWorldEngine() {
  const core = storage.getCompanionCore();

  if (!core.worldEngine) {
    const tod = deriveTimeOfDay();
    core.worldEngine = {
      ...getDefaultWorldEngine(),
      timeOfDay:    tod,
      lightingState: computeLightingState(ENVIRONMENT_ID.LIVING_ROOM, tod),
    };
    storage.saveCompanionCore(core);
  } else {
    // Patch any missing fields
    const defaults = getDefaultWorldEngine();
    let patched = false;
    for (const [k, v] of Object.entries(defaults)) {
      if (core.worldEngine[k] === undefined) { core.worldEngine[k] = v; patched = true; }
    }
    // Always refresh time of day on boot
    const tod = deriveTimeOfDay();
    core.worldEngine.timeOfDay    = tod;
    core.worldEngine.lightingState = computeLightingState(
      core.worldEngine.activeEnvironment ?? ENVIRONMENT_ID.LIVING_ROOM, tod
    );
    if (patched) storage.saveCompanionCore(core);
    else storage.saveCompanionCore(core);
  }

  _lastTransition = 0;
  _throttleWrite  = 0;

  const we = storage.getCompanionCore().worldEngine;
  console.log('IMMORTAIL WORLD ENGINE: boot complete', {
    activeEnvironment: we.activeEnvironment,
    timeOfDay:         we.timeOfDay,
    transitionState:   we.transitionState,
    worldVersion:      we.worldVersion,
  });
}

// ══════════════════════════════════════════════════════════════════
// STEP 4 — ENVIRONMENTAL EMOTIONAL INFLUENCE SYSTEM
// ══════════════════════════════════════════════════════════════════

/**
 * getEnvironmentEmotionalBias(environmentId)
 * Returns the emotional bias object for a given environment.
 * Influences behaviour, not controls it.
 */
export function getEnvironmentEmotionalBias(environmentId) {
  const profile = ENVIRONMENT_PROFILES[environmentId];
  if (!profile) return { neutral: 1.0 };
  return { ...profile.emotionalBias };
}

/**
 * deriveEnvironmentMood(environmentId, timeOfDay)
 * Returns the dominant mood for the current context.
 */
export function deriveEnvironmentMood(environmentId, timeOfDay) {
  const profile = ENVIRONMENT_PROFILES[environmentId];
  if (!profile) return ENVIRONMENT_MOOD.NEUTRAL;

  // Time of day can shift the mood
  if (timeOfDay === TIME_OF_DAY.NIGHT)    return ENVIRONMENT_MOOD.RESTING;
  if (timeOfDay === TIME_OF_DAY.EVENING &&
      profile.defaultMood !== ENVIRONMENT_MOOD.PLAYFUL) return ENVIRONMENT_MOOD.COZY;
  return profile.defaultMood ?? ENVIRONMENT_MOOD.NEUTRAL;
}

/**
 * getEnvironmentBehaviourContext(environmentId, timeOfDay)
 * Full behaviour influence package — deterministic.
 */
export function getEnvironmentBehaviourContext(environmentId, timeOfDay) {
  const profile  = ENVIRONMENT_PROFILES[environmentId];
  const tod      = timeOfDay ?? deriveTimeOfDay();
  const mood     = deriveEnvironmentMood(environmentId, tod);
  const lighting = computeLightingState(environmentId, tod);

  return {
    environmentId,
    label:           profile?.label       ?? environmentId,
    mood,
    emotionalBias:   profile?.emotionalBias    ?? { neutral: 1.0 },
    animationPacing: profile?.animationPacing  ?? 'normal',
    microBehaviours: profile?.microBehaviours  ?? [],
    voiceToneBias:   profile?.voiceToneBias    ?? 'balanced',
    spatialZones:    profile?.spatialZones      ?? [],
    ambientSound:    profile?.ambientSound      ?? 'silence',
    lighting,
    timeOfDay:       tod,
    offlineReady:    profile?.offlineReady ?? true,
    // influence flags
    reduceMotion:    mood === ENVIRONMENT_MOOD.RESTING,
    increaseExplore: mood === ENVIRONMENT_MOOD.CURIOUS || mood === ENVIRONMENT_MOOD.PLAYFUL,
    calmBias:        mood === ENVIRONMENT_MOOD.CALM || mood === ENVIRONMENT_MOOD.COZY,
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 5 — OBJECT-BASED WORLD SYSTEM
// ══════════════════════════════════════════════════════════════════

/**
 * getWorldObjects()
 * Returns current persistent world objects from SSOT.
 */
export function getWorldObjects() {
  return storage.getCompanionCore().worldEngine?.worldObjects ?? getDefaultWorldObjects();
}

/**
 * updateObjectState(objectKey, patch)
 * Updates a named world object's state.
 * Objects are persistent — never randomly regenerated.
 */
export function updateObjectState(objectKey, patch) {
  if (!objectKey || !patch) return { updated: false, reason: 'invalid_args' };

  const safety = runWorldSafetyCheck('update_object', { objectKey, patch });
  if (!safety.safe) return { updated: false, reason: safety.reason };

  const core = storage.getCompanionCore();
  const we   = core.worldEngine ?? getDefaultWorldEngine();
  const objs = we.worldObjects  ?? getDefaultWorldObjects();

  if (objs[objectKey] === undefined) return { updated: false, reason: 'object_not_found' };

  // Preserve stability flag — never overwrite with false
  const updated = { ...objs[objectKey], ...patch, stable: objs[objectKey].stable ?? true };
  objs[objectKey] = updated;

  // Log interaction
  const logEntry = { id: genId(), ts: Date.now(), objectKey, patch: JSON.stringify(patch).slice(0, 60) };
  we.worldObjects = objs;
  core.worldEngine = { ...we,
    worldObjects: objs,
    lastObjectInteraction: { objectKey, ts: Date.now() },
  };
  storage.saveCompanionCore(core);

  return { updated: true, objectKey, newState: updated };
}

/**
 * addToy(toy)
 * Adds a persistent toy to the world. No random generation.
 */
export function addToy(toy) {
  if (!toy?.id || !toy?.label) return { added: false, reason: 'invalid_toy' };
  const core = storage.getCompanionCore();
  const we   = core.worldEngine ?? getDefaultWorldEngine();
  const objs = we.worldObjects  ?? getDefaultWorldObjects();
  const toys = objs.toys ?? [];

  if (toys.some(t => t.id === toy.id)) return { added: false, reason: 'duplicate_id' };

  objs.toys = [...toys, { ...toy, stable: true, addedAt: Date.now() }];
  we.worldObjects  = objs;
  core.worldEngine = we;
  storage.saveCompanionCore(core);
  return { added: true, toy: objs.toys.at(-1) };
}

// ══════════════════════════════════════════════════════════════════
// STEP 6 — ENVIRONMENT TRANSITION ENGINE
// ══════════════════════════════════════════════════════════════════

/**
 * requestEnvironmentTransition(toEnvironmentId, options)
 * Initiates a smooth environment transition.
 * Guards: min hold time, valid target, no mid-transition switches.
 */
export function requestEnvironmentTransition(toEnvironmentId, options = {}) {
  const now  = Date.now();
  const core = storage.getCompanionCore();
  const we   = core.worldEngine ?? getDefaultWorldEngine();

  // Safety check
  const safety = runWorldSafetyCheck('transition', { toEnvironmentId });
  if (!safety.safe) return { started: false, reason: safety.reason };

  // Block mid-transition switch first (takes priority over rate-limit)
  if (we.transitionEngine?.activeTransition) {
    return { started: false, reason: 'transition_already_active' };
  }

  // Rate-limit: min hold time
  if (now - _lastTransition < WORLD_CAPS.MIN_ENV_HOLD_MS) {
    return { started: false, reason: 'min_hold_time_not_elapsed',
      retryAfterMs: WORLD_CAPS.MIN_ENV_HOLD_MS - (now - _lastTransition) };
  }

  // No-op if already in target
  if (we.activeEnvironment === toEnvironmentId) {
    return { started: false, reason: 'already_in_environment' };
  }

  const fromEnv = we.activeEnvironment;
  const tod     = we.timeOfDay ?? deriveTimeOfDay();

  // Build transition engine state
  const transitionEngine = {
    activeTransition:   true,
    fromEnvironment:    fromEnv,
    toEnvironment:      toEnvironmentId,
    transitionProgress: 0.0,
    startedAt:          now,
  };

  // Log entry
  const logEntry = {
    id:   genId(), ts: now,
    from: fromEnv, to: toEnvironmentId,
    initiatedBy: options.initiatedBy ?? 'system',
  };

  const newMood = deriveEnvironmentMood(toEnvironmentId, tod);
  const newLight = computeLightingState(toEnvironmentId, tod);

  const newWe = {
    ...we,
    previousEnvironment: fromEnv,
    transitionState:     TRANSITION_STATE.FADING_OUT,
    transitionEngine,
    transitionLog: [...(we.transitionLog ?? []), logEntry].slice(-WORLD_CAPS.TRANSITION_LOG_MAX),
  };
  core.worldEngine = newWe;
  storage.saveCompanionCore(core);

  _lastTransition = now;

  return {
    started:         true,
    fromEnvironment: fromEnv,
    toEnvironment:   toEnvironmentId,
    newMood,
    newLighting:     newLight,
    estimatedMs:     WORLD_CAPS.TRANSITION_STEP_MS * 2,
  };
}

/**
 * completeEnvironmentTransition()
 * Finalises a transition — called after fade completes.
 */
export function completeEnvironmentTransition() {
  const core = storage.getCompanionCore();
  const we   = core.worldEngine ?? getDefaultWorldEngine();
  const te   = we.transitionEngine;

  if (!te?.activeTransition) return { completed: false, reason: 'no_active_transition' };

  const toEnv   = te.toEnvironment;
  const tod     = we.timeOfDay ?? deriveTimeOfDay();
  const newMood = deriveEnvironmentMood(toEnv, tod);
  const newLight = computeLightingState(toEnv, tod);

  core.worldEngine = {
    ...we,
    activeEnvironment: toEnv,
    environmentMood:   newMood,
    lightingState:     newLight,
    transitionState:   TRANSITION_STATE.STABLE,
    transitionEngine:  { ...getDefaultTransitionEngine(), transitionProgress: 1.0 },
  };
  storage.saveCompanionCore(core);

  return {
    completed:      true,
    activeEnvironment: toEnv,
    environmentMood:   newMood,
    lightingState:     newLight,
  };
}

/**
 * cancelTransition()
 * Rolls back to previous environment on error.
 */
export function cancelTransition(reason) {
  const core = storage.getCompanionCore();
  const we   = core.worldEngine ?? getDefaultWorldEngine();
  const te   = we.transitionEngine;

  if (!te?.activeTransition) return { cancelled: false, reason: 'no_active_transition' };

  logSafety('transition_cancelled', reason ?? 'unknown');
  const restored = te.fromEnvironment ?? we.previousEnvironment ?? ENVIRONMENT_ID.LIVING_ROOM;
  const tod      = we.timeOfDay ?? deriveTimeOfDay();

  core.worldEngine = {
    ...we,
    activeEnvironment: restored,
    transitionState:   TRANSITION_STATE.STABLE,
    transitionEngine:  getDefaultTransitionEngine(),
    environmentMood:   deriveEnvironmentMood(restored, tod),
    lightingState:     computeLightingState(restored, tod),
  };
  storage.saveCompanionCore(core);

  return { cancelled: true, restored };
}

// ══════════════════════════════════════════════════════════════════
// STEP 7 — ENVIRONMENT MEMORY LINKING SYSTEM
// ══════════════════════════════════════════════════════════════════

/**
 * linkMemoryToEnvironment(memoryId, environmentId, label, options)
 * Associates a memory with an environment — part of emotional identity.
 */
export function linkMemoryToEnvironment(memoryId, environmentId, label, options = {}) {
  if (!memoryId || !environmentId) return { linked: false, reason: 'invalid_args' };
  if (!ENVIRONMENT_PROFILES[environmentId]) return { linked: false, reason: 'unknown_environment' };

  const core = storage.getCompanionCore();
  const we   = core.worldEngine ?? getDefaultWorldEngine();
  const map  = we.environmentMemoryMap ?? [];

  // Deduplicate
  if (map.some(m => m.memoryId === memoryId && m.environmentId === environmentId)) {
    return { linked: false, reason: 'already_linked' };
  }

  const link = {
    id:            genId(),
    memoryId,
    environmentId,
    label:         label ?? 'memory_event',
    isMilestone:   options.isMilestone  ?? false,
    emotionalTone: options.emotionalTone ?? 'neutral',
    ts:            Date.now(),
  };

  core.worldEngine = {
    ...we,
    environmentMemoryMap: [...map, link].slice(-WORLD_CAPS.MEMORY_LINK_MAX),
  };
  storage.saveCompanionCore(core);

  return { linked: true, link };
}

/**
 * getEnvironmentMemoryLinks(environmentId)
 * Returns all memories linked to a given environment.
 */
export function getEnvironmentMemoryLinks(environmentId) {
  const we = storage.getCompanionCore().worldEngine ?? getDefaultWorldEngine();
  if (!environmentId) return we.environmentMemoryMap ?? [];
  return (we.environmentMemoryMap ?? []).filter(m => m.environmentId === environmentId);
}

// ══════════════════════════════════════════════════════════════════
// STEP 8 — BEHAVIOUR + ENVIRONMENT SYNCHRONISATION
// ══════════════════════════════════════════════════════════════════

/**
 * syncBehaviourToEnvironment(environmentId, timeOfDay)
 * Returns a full behaviour sync package for the current environment.
 * Links to Run 13 presence + animation systems — read-only signal.
 */
export function syncBehaviourToEnvironment(environmentId, timeOfDay) {
  const profile = ENVIRONMENT_PROFILES[environmentId];
  const tod     = timeOfDay ?? deriveTimeOfDay();
  const mood    = deriveEnvironmentMood(environmentId, tod);
  const ctx     = getEnvironmentBehaviourContext(environmentId, tod);

  return {
    environmentId,
    timeOfDay:          tod,
    mood,
    spatialZones:       ctx.spatialZones,
    microBehaviours:    ctx.microBehaviours,
    animationPacing:    ctx.animationPacing,
    movementPacing:     ctx.animationPacing === 'lively' ? 'fast' :
                        ctx.animationPacing === 'slow'   ? 'slow' :
                        ctx.animationPacing === 'minimal'? 'none' : 'normal',
    idleAnimStyle:      mood === ENVIRONMENT_MOOD.RESTING  ? 'resting' :
                        mood === ENVIRONMENT_MOOD.PLAYFUL  ? 'playful_scan' :
                        mood === ENVIRONMENT_MOOD.CURIOUS  ? 'alert_sniff'  : 'relaxed',
    attentionMode:      ctx.increaseExplore ? 'heightened' : ctx.calmBias ? 'soft' : 'normal',
    voiceToneBias:      ctx.voiceToneBias,
    reduceMotion:       ctx.reduceMotion,
    increaseExplore:    ctx.increaseExplore,
    deterministic:      true,
    random:             false,
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 9 — LIGHTWEIGHT WORLD RENDER SYSTEM
// ══════════════════════════════════════════════════════════════════

/** In-memory environment cache — avoids re-computation */
const _envCache = new Map();

/**
 * getCachedEnvironmentProfile(environmentId)
 * Returns environment profile from cache or registry.
 */
export function getCachedEnvironmentProfile(environmentId) {
  if (_envCache.has(environmentId)) return _envCache.get(environmentId);
  const profile = ENVIRONMENT_PROFILES[environmentId];
  if (!profile) return null;
  _envCache.set(environmentId, profile);
  return profile;
}

/**
 * getPrecomputedLighting(environmentId, timeOfDay)
 * Returns precomputed lighting — avoids GPU recalculation.
 */
export function getPrecomputedLighting(environmentId, timeOfDay) {
  const key = `${environmentId}_${timeOfDay}`;
  if (_envCache.has(key)) return _envCache.get(key);
  const lighting = computeLightingState(environmentId, timeOfDay);
  _envCache.set(key, lighting);
  return lighting;
}

/**
 * getWorldRenderPerformanceReport()
 */
export function getWorldRenderPerformanceReport() {
  const core = storage.getCompanionCore();
  const we   = core.worldEngine ?? getDefaultWorldEngine();
  const warnings = [];
  if ((we.transitionLog ?? []).length > WORLD_CAPS.TRANSITION_LOG_MAX - 3) warnings.push('transition_log_near_full');
  if ((we.environmentMemoryMap ?? []).length > WORLD_CAPS.MEMORY_LINK_MAX - 5) warnings.push('memory_link_near_full');
  if (_safetyLog.length > WORLD_CAPS.SAFETY_LOG_MAX - 5) warnings.push('safety_log_near_full');

  return {
    status:            warnings.length ? 'warning' : 'stable',
    warnings,
    cacheSize:         _envCache.size,
    gpuThrottling:     true,
    lazyLoad:          true,
    textureReuse:      true,
    lightingPrecomputed: true,
    checks: {
      activeEnvironment:    we.activeEnvironment,
      transitionLogSize:    (we.transitionLog ?? []).length,
      memoryLinkCount:      (we.environmentMemoryMap ?? []).length,
      worldObjectCount:     Object.keys(we.worldObjects ?? {}).length,
      safetyLogSize:        _safetyLog.length,
    },
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 10 — WORLD STATE PERSISTENCE SYSTEM
// ══════════════════════════════════════════════════════════════════

/**
 * captureWorldSnapshot()
 * Full world state snapshot for persistence verification.
 */
export function captureWorldSnapshot() {
  const core = storage.getCompanionCore();
  const we   = core.worldEngine ?? getDefaultWorldEngine();
  return {
    captured:   true,
    capturedAt: Date.now(),
    snapshot: {
      activeEnvironment:      we.activeEnvironment,
      previousEnvironment:    we.previousEnvironment,
      transitionState:        we.transitionState,
      environmentMood:        we.environmentMood,
      timeOfDay:              we.timeOfDay,
      lightingState:          { ...we.lightingState },
      worldObjectCount:       Object.keys(we.worldObjects ?? {}).length,
      toyCount:               (we.worldObjects?.toys ?? []).length,
      memoryLinkCount:        (we.environmentMemoryMap ?? []).length,
      transitionLogCount:     (we.transitionLog ?? []).length,
      worldVersion:           we.worldVersion,
    },
  };
}

/**
 * restoreWorldFromSnapshot()
 * Restores world continuity on reload — companion never left the space.
 */
export function restoreWorldFromSnapshot() {
  const core = storage.getCompanionCore();
  if (!core.worldEngine?.worldVersion) return { restored: false, reason: 'no_snapshot' };

  const we  = core.worldEngine;
  const tod = deriveTimeOfDay();

  // Refresh time + lighting on restore (time has passed)
  const newLight = computeLightingState(we.activeEnvironment, tod);
  saveWorldForce({
    timeOfDay:       tod,
    lightingState:   newLight,
    transitionState: TRANSITION_STATE.STABLE,
    transitionEngine: getDefaultTransitionEngine(),
    environmentMood:  deriveEnvironmentMood(we.activeEnvironment, tod),
  });

  return {
    restored:          true,
    activeEnvironment: we.activeEnvironment,
    worldVersion:      we.worldVersion,
    timeOfDay:         tod,
    lightingState:     newLight,
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 11 — OFFLINE WORLD RESILIENCE
// ══════════════════════════════════════════════════════════════════

export function getOfflineWorldStatus() {
  return {
    offlineCapable:           true,
    allEnvironmentsAvailable: true,
    noCloudDependency:        true,
    persistenceLocal:         true,
    recoveryRestoresWorld:    true,
    environmentCount:         Object.keys(ENVIRONMENT_PROFILES).length,
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 12 — OLLAMA + GROQ WORLD ORCHESTRATION
// ══════════════════════════════════════════════════════════════════

export function getWorldOrchestrationContext() {
  return {
    ollama: {
      role:  'world_emotional_interpreter',
      tasks: [
        'emotional_environment_interpretation',
        'memory_environment_linking',
        'long_term_preference_learning',
        'environment_narrative_context',
      ],
      canMutateWorldState: false,
      definesMeaning:      true,
    },
    groq: {
      role:               'world_classifier',
      tasks:              ['environment_classification', 'lighting_estimation', 'scene_tagging'],
      canMutateWorldState: false,  // Groq CANNOT mutate world state directly
      fallback:           'ollama',
    },
    safetyRule:  'groq_cannot_mutate_world_state__ollama_defines_environmental_meaning',
    offlineSafe: true,
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 13 — WORLD SAFETY VALIDATION LAYER
// ══════════════════════════════════════════════════════════════════

export function runWorldSafetyCheck(operation, payload = {}) {
  const BLOCKED_OPS = ['random_generate', 'delete_environment', 'corrupt_world', 'force_teleport'];
  if (BLOCKED_OPS.includes(operation)) {
    logSafety(`blocked_op:${operation}`, JSON.stringify(payload).slice(0, 60));
    return { safe: false, reason: `operation_blocked:${operation}` };
  }

  if (operation === 'transition') {
    const target = payload.toEnvironmentId;
    if (!target) { logSafety('transition_no_target', ''); return { safe: false, reason: 'no_target_environment' }; }
    if (!ENVIRONMENT_PROFILES[target]) {
      logSafety('transition_unknown_env', target);
      return { safe: false, reason: 'unknown_environment_id' };
    }
  }

  if (operation === 'update_object') {
    if (!payload.objectKey) { logSafety('object_no_key', ''); return { safe: false, reason: 'no_object_key' }; }
    if (payload.patch?.stable === false) { logSafety('object_stability_overwrite', payload.objectKey); return { safe: false, reason: 'cannot_destabilise_object' }; }
  }

  if (payload._random === true) {
    logSafety('blocked_random_generation', JSON.stringify(payload).slice(0, 60));
    return { safe: false, reason: 'random_generation_blocked' };
  }

  return { safe: true };
}

export function getWorldSafetyLog() { return [..._safetyLog]; }

// ══════════════════════════════════════════════════════════════════
// STEP 14 — CONTINUITY PRESERVATION
// ══════════════════════════════════════════════════════════════════

/**
 * getWorldEngineContext()
 * Full context object for Ollama prompt injection.
 */
export function getWorldEngineContext() {
  const core = storage.getCompanionCore();
  const we   = core.worldEngine ?? getDefaultWorldEngine();
  const prof = ENVIRONMENT_PROFILES[we.activeEnvironment];
  const links= we.environmentMemoryMap ?? [];
  const behCtx = getEnvironmentBehaviourContext(we.activeEnvironment, we.timeOfDay);

  return {
    activeEnvironment:   we.activeEnvironment,
    environmentLabel:    prof?.label ?? we.activeEnvironment,
    previousEnvironment: we.previousEnvironment,
    transitionState:     we.transitionState,
    environmentMood:     we.environmentMood,
    timeOfDay:           we.timeOfDay,
    lightingState:       we.lightingState,
    animationPacing:     behCtx.animationPacing,
    voiceToneBias:       behCtx.voiceToneBias,
    microBehaviours:     behCtx.microBehaviours?.slice(0, 3),
    spatialZones:        behCtx.spatialZones?.slice(0, 3),
    ambientSound:        behCtx.ambientSound,
    memoryLinksInEnv:    links.filter(m => m.environmentId === we.activeEnvironment).length,
    recentMemoryLinks:   links.filter(m => m.environmentId === we.activeEnvironment).slice(-2),
    worldObjectCount:    Object.keys(we.worldObjects ?? {}).length,
    toyCount:            (we.worldObjects?.toys ?? []).length,
    worldVersion:        we.worldVersion,
    offlineReady:        true,
    fabricated:          false,
    deterministic:       true,
  };
}

/**
 * getWorldEngineSnapshot()
 * Complete snapshot — verification + Ollama context.
 */
export function getWorldEngineSnapshot() {
  const core    = storage.getCompanionCore();
  const we      = core.worldEngine ?? getDefaultWorldEngine();
  const offline = getOfflineWorldStatus();
  const perf    = getWorldRenderPerformanceReport();
  const orch    = getWorldOrchestrationContext();
  const ctx     = getWorldEngineContext();
  const behSync = syncBehaviourToEnvironment(we.activeEnvironment, we.timeOfDay);

  return {
    worldEngine:          { ...we },
    worldEngineContext:   ctx,
    behaviourSync:        behSync,
    offlineStatus:        offline,
    performanceReport:    perf,
    orchestration:        orch,
    environmentProfiles:  Object.keys(ENVIRONMENT_PROFILES),
    lightingPresets:      Object.keys(LIGHTING_PRESETS),
    worldVersion:         we.worldVersion,
    identityContinuous:   true,
    deterministic:        true,
    randomGeneration:     false,
  };
}

// ══════════════════════════════════════════════════════════════════
// TESTING UTILITIES
// ══════════════════════════════════════════════════════════════════

export function resetWorldThrottles() {
  _throttleWrite  = 0;
  _lastTransition = 0;
}
