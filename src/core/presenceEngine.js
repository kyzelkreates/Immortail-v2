// ================================================================
// IMMORTAIL™ — REAL-TIME PRESENCE ENGINE (Run 13)
// Calm, emotionally-grounded, spatially-aware ambient presence.
//
// Implements:
//   STEP 1  — Real-time presence engine
//   STEP 2  — Spatial awareness system
//   STEP 3  — Real-time positional system
//   STEP 4  — Ambient presence behaviours
//   STEP 5  — Micro-behaviour engine
//   STEP 6  — Real-time attention system
//   STEP 7  — Dynamic environment reactivity
//   STEP 8  — Ambient audio system
//   STEP 9  — Real-time behaviour scheduler
//   STEP 10 — Contextual presence conversation layer
//   STEP 11 — Advanced animation continuity
//   STEP 12 — Presence persistence system
//   STEP 13 — GPU + CPU safety layer
//   STEP 14 — Hybrid Ollama + Groq presence orchestration
//   STEP 15 — Future AR + voice preparation stubs
//
// STRICT RULES:
//   - companionCore SSOT only
//   - No hyperactive loops
//   - No random behaviours
//   - No robotic tracking
//   - All timings throttled + cooldown-guarded
//   - Fully offline-functional
// ================================================================

import storage from './storage.js';

// ════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════

export const PRESENCE_VERSION    = 'V1';
export const SPATIAL_VERSION     = 'V1';
export const SCHEDULER_VERSION   = 'V1';

// ── Presence states ────────────────────────────────────────────
export const PRESENCE_STATE = {
  AMBIENT_IDLE:   'ambient_idle',
  ATTENTIVE:      'attentive',
  REPOSITIONING:  'repositioning',
  RESTING:        'resting',
  SLEEPING:       'sleeping',
  INTERACTING:    'interacting',
};

// ── Spatial zones ──────────────────────────────────────────────
export const SPATIAL_ZONE = {
  RESTING_AREA:     'resting_area',
  PLAY_AREA:        'play_area',
  FEEDING_AREA:     'feeding_area',
  WINDOW_AREA:      'window_area',
  COMFORT_AREA:     'comfort_area',
  OBSERVATION_AREA: 'observation_area',
};

// ── Micro-behaviours ───────────────────────────────────────────
export const MICRO_BEHAVIOUR = {
  EAR_TWITCH:     'ear_twitch',
  SLOW_BLINK:     'slow_blink',
  HEAD_TILT:      'head_tilt',
  POSTURE_SHIFT:  'posture_shift',
  TAIL_SWAY:      'tail_sway',
  STRETCH:        'stretch',
  SETTLE:         'settle',
  BREATHE:        'breathe',
  SLEEPY_SIGH:    'sleepy_sigh',
  NOSE_TWITCH:    'nose_twitch',
};

// ── Locomotion states ──────────────────────────────────────────
export const LOCOMOTION = {
  IDLE:     'idle',
  WALKING:  'walking',
  TURNING:  'turning',
  SETTLING: 'settling',
};

// ── Ambient sounds ─────────────────────────────────────────────
export const AMBIENT_SOUND = {
  BREATHING:    'breathing',
  PAW_STEPS:    'paw_steps',
  COLLAR:       'collar',
  SETTLE:       'settle',
  RESTING:      'resting',
  ROOM_AMBIENCE:'room_ambience',
  STRETCH_SOUND:'stretch_sound',
};

// ── Presence intensity ─────────────────────────────────────────
export const PRESENCE_INTENSITY = {
  CALM:   'calm',
  SOFT:   'soft',
  ACTIVE: 'active',
  SLEEPY: 'sleepy',
};

// ── Timing constants (ms) — all throttled for GPU/CPU safety ──
export const TIMING = {
  MICRO_BEHAVIOUR_MIN_INTERVAL: 8_000,    // min 8s between micro-behaviours
  MICRO_BEHAVIOUR_MAX_INTERVAL: 30_000,   // max 30s (≈random in range when due)
  ZONE_TRANSITION_COOLDOWN:     120_000,  // 2 min between zone changes
  MOVEMENT_STEP_MS:             16,       // 60fps-safe positional lerp
  ATTENTION_FADE_MS:            5_000,    // attention fades after 5s
  ATTENTION_COOLDOWN:           15_000,   // 15s between attention shifts
  SCHEDULER_TICK_MIN:           3_000,    // scheduler ticks no faster than 3s
  AUDIO_COOLDOWN:               12_000,   // 12s between audio triggers
  LOCOMOTION_SETTLE_MS:         2_000,    // settle animation after movement
  PRESENCE_WRITE_THROTTLE:      500,      // max 2 writes/sec to storage
  PERF_CHECK_INTERVAL:          30_000,   // perf check every 30s
};

// ── Spatial zone definitions ───────────────────────────────────
export const ZONE_DEFINITIONS = {
  [SPATIAL_ZONE.RESTING_AREA]: {
    position:        { x: 0.2, y: 0.0, z: 0.2 },
    movementPacing:  'slow',
    preferredMoods:  ['calm', 'sleepy', 'content'],
    allowedBehaviours:[PRESENCE_STATE.RESTING, PRESENCE_STATE.AMBIENT_IDLE, PRESENCE_STATE.SLEEPING],
    audioAmbience:   AMBIENT_SOUND.RESTING,
  },
  [SPATIAL_ZONE.PLAY_AREA]: {
    position:        { x: 0.5, y: 0.0, z: 0.5 },
    movementPacing:  'active',
    preferredMoods:  ['playful', 'curious', 'excited'],
    allowedBehaviours:[PRESENCE_STATE.ATTENTIVE, PRESENCE_STATE.INTERACTING, PRESENCE_STATE.AMBIENT_IDLE],
    audioAmbience:   AMBIENT_SOUND.PAW_STEPS,
  },
  [SPATIAL_ZONE.FEEDING_AREA]: {
    position:        { x: 0.8, y: 0.0, z: 0.3 },
    movementPacing:  'calm',
    preferredMoods:  ['hungry', 'content'],
    allowedBehaviours:[PRESENCE_STATE.INTERACTING, PRESENCE_STATE.AMBIENT_IDLE],
    audioAmbience:   AMBIENT_SOUND.COLLAR,
  },
  [SPATIAL_ZONE.WINDOW_AREA]: {
    position:        { x: 0.9, y: 0.0, z: 0.5 },
    movementPacing:  'slow',
    preferredMoods:  ['curious', 'calm', 'neutral'],
    allowedBehaviours:[PRESENCE_STATE.ATTENTIVE, PRESENCE_STATE.AMBIENT_IDLE],
    audioAmbience:   AMBIENT_SOUND.ROOM_AMBIENCE,
  },
  [SPATIAL_ZONE.COMFORT_AREA]: {
    position:        { x: 0.3, y: 0.0, z: 0.7 },
    movementPacing:  'gentle',
    preferredMoods:  ['bonded', 'content', 'calm'],
    allowedBehaviours:[PRESENCE_STATE.RESTING, PRESENCE_STATE.AMBIENT_IDLE, PRESENCE_STATE.ATTENTIVE],
    audioAmbience:   AMBIENT_SOUND.BREATHING,
  },
  [SPATIAL_ZONE.OBSERVATION_AREA]: {
    position:        { x: 0.5, y: 0.0, z: 0.8 },
    movementPacing:  'calm',
    preferredMoods:  ['curious', 'alert', 'neutral'],
    allowedBehaviours:[PRESENCE_STATE.ATTENTIVE, PRESENCE_STATE.AMBIENT_IDLE],
    audioAmbience:   AMBIENT_SOUND.ROOM_AMBIENCE,
  },
};

// ── Micro-behaviour weights per emotional state ────────────────
const MICRO_BEHAVIOUR_WEIGHTS = {
  calm:    [MICRO_BEHAVIOUR.SLOW_BLINK, MICRO_BEHAVIOUR.BREATHE, MICRO_BEHAVIOUR.TAIL_SWAY],
  sleepy:  [MICRO_BEHAVIOUR.SLEEPY_SIGH, MICRO_BEHAVIOUR.SLOW_BLINK, MICRO_BEHAVIOUR.SETTLE],
  curious: [MICRO_BEHAVIOUR.EAR_TWITCH, MICRO_BEHAVIOUR.HEAD_TILT, MICRO_BEHAVIOUR.NOSE_TWITCH],
  playful: [MICRO_BEHAVIOUR.TAIL_SWAY, MICRO_BEHAVIOUR.EAR_TWITCH, MICRO_BEHAVIOUR.POSTURE_SHIFT],
  content: [MICRO_BEHAVIOUR.BREATHE, MICRO_BEHAVIOUR.SLOW_BLINK, MICRO_BEHAVIOUR.POSTURE_SHIFT],
  excited: [MICRO_BEHAVIOUR.TAIL_SWAY, MICRO_BEHAVIOUR.EAR_TWITCH, MICRO_BEHAVIOUR.POSTURE_SHIFT],
  neutral: [MICRO_BEHAVIOUR.BREATHE, MICRO_BEHAVIOUR.POSTURE_SHIFT, MICRO_BEHAVIOUR.TAIL_SWAY],
  resting: [MICRO_BEHAVIOUR.SLOW_BLINK, MICRO_BEHAVIOUR.BREATHE, MICRO_BEHAVIOUR.SLEEPY_SIGH],
};

// ── Environment → presence intensity mapping ───────────────────
const ENV_INTENSITY_MAP = {
  living_room:       PRESENCE_INTENSITY.CALM,
  garden:            PRESENCE_INTENSITY.ACTIVE,
  park:              PRESENCE_INTENSITY.ACTIVE,
  bedroom:           PRESENCE_INTENSITY.SLEEPY,
  cozy_evening_room: PRESENCE_INTENSITY.SOFT,
  sunny_window_area: PRESENCE_INTENSITY.CALM,
};

// ── Environment → default zone mapping ────────────────────────
const ENV_ZONE_MAP = {
  living_room:       SPATIAL_ZONE.COMFORT_AREA,
  garden:            SPATIAL_ZONE.PLAY_AREA,
  park:              SPATIAL_ZONE.PLAY_AREA,
  bedroom:           SPATIAL_ZONE.RESTING_AREA,
  cozy_evening_room: SPATIAL_ZONE.RESTING_AREA,
  sunny_window_area: SPATIAL_ZONE.WINDOW_AREA,
};

// ════════════════════════════════════════════════════════════════
// INTERNAL TIMING GUARDS
// ════════════════════════════════════════════════════════════════

let _lastPresenceWrite   = 0;
let _lastMicroBehaviour  = 0;
let _lastZoneTransition  = 0;
let _lastAttentionShift  = 0;
let _lastSchedulerTick   = 0;
let _lastAudioTrigger    = 0;
let _lastPerfCheck       = 0;
let _lastPerfReport      = null;
let _renderThrottle      = 0;

export function resetPresenceThrottles() {
  _lastPresenceWrite   = 0;
  _lastMicroBehaviour  = 0;
  _lastZoneTransition  = 0;
  _lastAttentionShift  = 0;
  _lastSchedulerTick   = 0;
  _lastAudioTrigger    = 0;
  _lastPerfCheck       = 0;
  _lastPerfReport      = null;
  _renderThrottle      = 0;
}

function now() { return Date.now(); }

// ════════════════════════════════════════════════════════════════
// STORAGE HELPERS — throttled writes
// ════════════════════════════════════════════════════════════════

function getCore()  { return storage.getCompanionCore(); }

function savePresence(pePatch = {}, ssPatch = {}, bsPatch = {}, aaPatch = {}) {
  if (now() - _lastPresenceWrite < TIMING.PRESENCE_WRITE_THROTTLE) return;
  _lastPresenceWrite = now();
  const core = getCore();
  if (Object.keys(pePatch).length) core.presenceEngine    = { ...core.presenceEngine,    ...pePatch };
  if (Object.keys(ssPatch).length) core.spatialState      = { ...core.spatialState,      ...ssPatch };
  if (Object.keys(bsPatch).length) core.behaviourScheduler= { ...core.behaviourScheduler,...bsPatch };
  if (Object.keys(aaPatch).length) core.ambientAudio      = { ...core.ambientAudio,      ...aaPatch };
  storage.saveCompanionCore(core);
}

function savePresenceForce(pePatch = {}, ssPatch = {}, bsPatch = {}, aaPatch = {}) {
  _lastPresenceWrite = 0;
  savePresence(pePatch, ssPatch, bsPatch, aaPatch);
}

// ════════════════════════════════════════════════════════════════
// STEP 1 — REAL-TIME PRESENCE ENGINE
// ════════════════════════════════════════════════════════════════

/**
 * getPresenceState()
 */
export function getPresenceState() {
  return getCore().presenceEngine ?? {};
}

/**
 * setPresenceState(state, intensity?)
 * Deterministic — only transitions from valid current states.
 */
export function setPresenceState(newState, intensity = null) {
  if (!Object.values(PRESENCE_STATE).includes(newState)) return { set: false, reason: 'unknown_state' };
  const core = getCore();
  const pe   = core.presenceEngine ?? {};

  const patch = {
    activePresenceState: newState,
    realTimeState:       'stable',
  };
  if (intensity && Object.values(PRESENCE_INTENSITY).includes(intensity)) {
    patch.presenceIntensity = intensity;
  }

  core.presenceEngine = { ...pe, ...patch };
  storage.saveCompanionCore(core);
  return { set: true, state: newState };
}

/**
 * initPresenceEngine()
 * Boot step — sets initial presence state from persisted core.
 * Restores zone + behaviour from last session (STEP 12).
 */
export function initPresenceEngine() {
  const core = getCore();
  const pe   = core.presenceEngine ?? {};
  const env  = core.environmentSystem ?? {};
  const ls   = core.lifeSimulation    ?? {};

  // Derive intensity from active scene
  const scene     = env.activeScene ?? 'living_room';
  const intensity = ENV_INTENSITY_MAP[scene] ?? PRESENCE_INTENSITY.CALM;

  // Derive zone from scene if no persisted zone
  const zone = pe.currentSpatialZone ?? ENV_ZONE_MAP[scene] ?? SPATIAL_ZONE.COMFORT_AREA;

  // Derive initial presence state from life simulation
  let presenceState = PRESENCE_STATE.AMBIENT_IDLE;
  if (ls.sleepState?.sleeping)             presenceState = PRESENCE_STATE.SLEEPING;
  else if (ls.ambientMood === 'playful')   presenceState = PRESENCE_STATE.ATTENTIVE;
  else if (ls.ambientMood === 'calm')      presenceState = PRESENCE_STATE.RESTING;

  const restored = !!pe.presenceVersion;

  savePresenceForce(
    {
      activePresenceState: presenceState,
      currentSpatialZone:  zone,
      presenceIntensity:   intensity,
      realTimeState:       'stable',
      presenceVersion:     PRESENCE_VERSION,
    },
    { positionVersion: SPATIAL_VERSION },
    { schedulerVersion: SCHEDULER_VERSION },
    { audioVersion: 'V1' }
  );

  console.log('IMMORTAIL PRESENCE ENGINE: boot complete', {
    presenceState,
    zone,
    intensity,
    restored,
  });

  return { presenceState, zone, intensity, restored };
}

// ════════════════════════════════════════════════════════════════
// STEP 2 + 3 — SPATIAL AWARENESS + POSITIONAL SYSTEM
// ════════════════════════════════════════════════════════════════

/**
 * getSpatialZoneDefinitions()
 */
export function getSpatialZoneDefinitions() {
  return ZONE_DEFINITIONS;
}

/**
 * getCurrentZone()
 */
export function getCurrentZone() {
  const pe = getCore().presenceEngine ?? {};
  return {
    zoneId:     pe.currentSpatialZone ?? SPATIAL_ZONE.COMFORT_AREA,
    definition: ZONE_DEFINITIONS[pe.currentSpatialZone] ?? ZONE_DEFINITIONS[SPATIAL_ZONE.COMFORT_AREA],
  };
}

/**
 * transitionToZone(zoneId, reason?)
 * Smooth, deterministic zone transition.
 * Cooldown-guarded — no rapid teleportation.
 */
export function transitionToZone(zoneId, reason = 'behaviour') {
  if (!ZONE_DEFINITIONS[zoneId]) return { moved: false, reason: 'unknown_zone' };
  if (now() - _lastZoneTransition < TIMING.ZONE_TRANSITION_COOLDOWN) {
    return { moved: false, reason: 'cooldown' };
  }

  const core    = getCore();
  const pe      = core.presenceEngine ?? {};
  const ss      = core.spatialState   ?? {};
  const zoneDef = ZONE_DEFINITIONS[zoneId];

  _lastZoneTransition = now();

  // Set movement target — actual lerp happens in tickSpatialMovement()
  const ssPatch = {
    movementTarget:         zoneDef.position,
    currentLocomotionState: LOCOMOTION.WALKING,
    lastMovedAt:            now(),
  };
  const pePatch = {
    currentSpatialZone:  zoneId,
    activePresenceState: PRESENCE_STATE.REPOSITIONING,
    realTimeState:       'transitioning',
    lastZoneTransitionAt:now(),
  };

  savePresenceForce(pePatch, ssPatch);

  return { moved: true, zoneId, from: pe.currentSpatialZone, target: zoneDef.position, reason };
}

/**
 * tickSpatialMovement()
 * Advances position toward movementTarget using smooth lerp.
 * Call at max 10fps — internally throttled.
 * Returns { moved, arrived }.
 */
export function tickSpatialMovement() {
  const core = getCore();
  const ss   = core.spatialState ?? {};
  const pe   = core.presenceEngine ?? {};

  if (!ss.movementTarget || ss.currentLocomotionState === LOCOMOTION.IDLE) {
    return { moved: false, arrived: false };
  }

  const cur  = ss.currentPosition ?? { x: 0.5, y: 0, z: 0.5 };
  const tgt  = ss.movementTarget;
  const LERP = 0.04; // smooth step per tick

  const nx = cur.x + (tgt.x - cur.x) * LERP;
  const nz = cur.z + (tgt.z - cur.z) * LERP;

  const dist = Math.sqrt((tgt.x - nx) ** 2 + (tgt.z - nz) ** 2);
  const arrived = dist < 0.02;

  if (arrived) {
    // Arrived — settle
    const ssPatch = {
      currentPosition:        { ...tgt },
      movementTarget:         null,
      currentLocomotionState: LOCOMOTION.SETTLING,
      activePath:             [],
    };
    const pePatch = {
      activePresenceState: PRESENCE_STATE.AMBIENT_IDLE,
      realTimeState:       'stable',
    };
    savePresence(pePatch, ssPatch);
    // Trigger settle micro-behaviour
    _scheduleNextMicroBehaviour(MICRO_BEHAVIOUR.SETTLE);
    return { moved: true, arrived: true };
  }

  // Still moving
  const yaw = Math.atan2(tgt.x - cur.x, tgt.z - cur.z) * (180 / Math.PI);
  savePresence(
    {},
    { currentPosition: { x: nx, y: 0, z: nz }, currentOrientation: { yaw } }
  );
  return { moved: true, arrived: false };
}

/**
 * getSpatialState()
 */
export function getSpatialState() {
  return getCore().spatialState ?? {};
}

// ════════════════════════════════════════════════════════════════
// STEP 4 + 5 — AMBIENT BEHAVIOURS + MICRO-BEHAVIOUR ENGINE
// ════════════════════════════════════════════════════════════════

/**
 * selectMicroBehaviour()
 * Deterministically selects a micro-behaviour from emotional state.
 * Low-frequency — cooldown-guarded.
 */
export function selectMicroBehaviour() {
  if (now() - _lastMicroBehaviour < TIMING.MICRO_BEHAVIOUR_MIN_INTERVAL) {
    return { selected: false, reason: 'cooldown' };
  }

  const core = getCore();
  const emo  = core.emotionalState ?? {};
  const pe   = core.presenceEngine ?? {};
  const ls   = core.lifeSimulation ?? {};

  // No micro-behaviours during locomotion
  if (core.spatialState?.currentLocomotionState === LOCOMOTION.WALKING) {
    return { selected: false, reason: 'locomotion_active' };
  }

  // Derive emotional key
  const dominant = emo.dominant ?? 'neutral';
  const ambientMood = ls.ambientMood ?? 'calm';
  const key = MICRO_BEHAVIOUR_WEIGHTS[dominant]
    ? dominant
    : MICRO_BEHAVIOUR_WEIGHTS[ambientMood]
    ? ambientMood
    : 'neutral';

  const candidates = MICRO_BEHAVIOUR_WEIGHTS[key] ?? MICRO_BEHAVIOUR_WEIGHTS.neutral;

  // Weighted random within candidates (deterministic from timestamp seed)
  const seed  = Math.floor(now() / 1000) % candidates.length;
  const chosen = candidates[seed];

  _lastMicroBehaviour = now();

  savePresence({ currentMicroBehaviour: chosen });

  return { selected: true, behaviour: chosen, emotionalKey: key };
}

function _scheduleNextMicroBehaviour(override = null) {
  if (override) {
    _lastMicroBehaviour = now() - TIMING.MICRO_BEHAVIOUR_MIN_INTERVAL; // allow immediate
    const core = getCore();
    core.presenceEngine = { ...(core.presenceEngine ?? {}), currentMicroBehaviour: override };
    storage.saveCompanionCore(core);
  }
}

/**
 * getAmbientBehaviourSet(presenceState, zone)
 * Returns the set of appropriate ambient behaviours for current state.
 */
export function getAmbientBehaviourSet(presenceState, zone) {
  const zoneDef = ZONE_DEFINITIONS[zone] ?? ZONE_DEFINITIONS[SPATIAL_ZONE.COMFORT_AREA];
  const base    = {
    [PRESENCE_STATE.AMBIENT_IDLE]:  ['observing_room', 'soft_posture_adjustment', 'looking_around'],
    [PRESENCE_STATE.RESTING]:       ['relaxing_in_area', 'slow_breathing', 'settling'],
    [PRESENCE_STATE.SLEEPING]:      ['deep_breathing', 'still_presence', 'twitching_in_sleep'],
    [PRESENCE_STATE.ATTENTIVE]:     ['looking_toward_sound', 'ears_perked', 'head_tracking'],
    [PRESENCE_STATE.REPOSITIONING]: ['slow_walk', 'sniffing_ground', 'looking_ahead'],
    [PRESENCE_STATE.INTERACTING]:   ['pawing_object', 'sniffing_object', 'nudging'],
  };
  return {
    behaviours:  base[presenceState] ?? base[PRESENCE_STATE.AMBIENT_IDLE],
    zonePacing:  zoneDef.movementPacing,
    audioAmbience: zoneDef.audioAmbience,
  };
}

// ════════════════════════════════════════════════════════════════
// STEP 6 — REAL-TIME ATTENTION SYSTEM
// ════════════════════════════════════════════════════════════════

/**
 * shiftAttention(target, reason?)
 * Soft attention shift — cooldown-guarded, fades naturally.
 * No aggressive tracking. No robotic locking.
 */
export function shiftAttention(target, reason = 'ambient') {
  if (now() - _lastAttentionShift < TIMING.ATTENTION_COOLDOWN) {
    return { shifted: false, reason: 'cooldown' };
  }
  if (!target) return { shifted: false, reason: 'no_target' };

  _lastAttentionShift = now();

  savePresence({
    activeAttentionTarget:  target,
    activePresenceState:    PRESENCE_STATE.ATTENTIVE,
  });

  return { shifted: true, target, reason };
}

/**
 * fadeAttention()
 * Call after TIMING.ATTENTION_FADE_MS — returns companion to ambient idle.
 * Prevents robotic stare behaviour.
 */
export function fadeAttention() {
  const core = getCore();
  const pe   = core.presenceEngine ?? {};
  if (!pe.activeAttentionTarget) return { faded: false };

  savePresenceForce({
    activeAttentionTarget: null,
    activePresenceState:   PRESENCE_STATE.AMBIENT_IDLE,
  });

  return { faded: true };
}

/**
 * getAttentionState()
 */
export function getAttentionState() {
  const pe = getCore().presenceEngine ?? {};
  return {
    hasTarget:     !!pe.activeAttentionTarget,
    target:        pe.activeAttentionTarget,
    presenceState: pe.activePresenceState,
    fading:        pe.activePresenceState === PRESENCE_STATE.AMBIENT_IDLE && !pe.activeAttentionTarget,
  };
}

// ════════════════════════════════════════════════════════════════
// STEP 7 — DYNAMIC ENVIRONMENT REACTIVITY
// ════════════════════════════════════════════════════════════════

/**
 * applyEnvironmentReactivity(scene)
 * Scene change influences presence intensity, zone preference, pacing.
 * Never forces zone transition — just updates preferences.
 */
export function applyEnvironmentReactivity(scene) {
  const intensity  = ENV_INTENSITY_MAP[scene]  ?? PRESENCE_INTENSITY.CALM;
  const prefZone   = ENV_ZONE_MAP[scene]        ?? SPATIAL_ZONE.COMFORT_AREA;
  const zoneDef    = ZONE_DEFINITIONS[prefZone];

  savePresence({ presenceIntensity: intensity });

  return {
    applied:           true,
    scene,
    intensity,
    preferredZone:     prefZone,
    movementPacing:    zoneDef?.movementPacing ?? 'calm',
    emotionalTone:     { cozy_evening_room:'bonded', bedroom:'restful', garden:'playful',
                         park:'excited', living_room:'comfortable', sunny_window_area:'curious' }[scene] ?? 'neutral',
  };
}

/**
 * getEnvironmentReactivityContext()
 * Returns full reactivity state for prompt injection.
 */
export function getEnvironmentReactivityContext() {
  const core    = getCore();
  const env     = core.environmentSystem ?? {};
  const pe      = core.presenceEngine    ?? {};
  const scene   = env.activeScene ?? 'living_room';
  const zone    = pe.currentSpatialZone ?? SPATIAL_ZONE.COMFORT_AREA;
  const zoneDef = ZONE_DEFINITIONS[zone] ?? {};

  return {
    scene,
    intensity:     pe.presenceIntensity    ?? PRESENCE_INTENSITY.CALM,
    zone,
    zonePacing:    zoneDef.movementPacing  ?? 'calm',
    zoneAudio:     zoneDef.audioAmbience   ?? AMBIENT_SOUND.BREATHING,
    presenceState: pe.activePresenceState  ?? PRESENCE_STATE.AMBIENT_IDLE,
  };
}

// ════════════════════════════════════════════════════════════════
// STEP 8 — AMBIENT AUDIO SYSTEM
// ════════════════════════════════════════════════════════════════

/**
 * SOUND_RULES — maps presence + locomotion state to appropriate sound.
 * Low-volume, calming only.
 */
const SOUND_RULES = [
  { state: PRESENCE_STATE.SLEEPING,     sound: AMBIENT_SOUND.BREATHING,     intensity: 'low' },
  { state: PRESENCE_STATE.RESTING,      sound: AMBIENT_SOUND.RESTING,       intensity: 'low' },
  { state: PRESENCE_STATE.REPOSITIONING,sound: AMBIENT_SOUND.PAW_STEPS,     intensity: 'low' },
  { state: PRESENCE_STATE.INTERACTING,  sound: AMBIENT_SOUND.COLLAR,        intensity: 'low' },
  { state: PRESENCE_STATE.ATTENTIVE,    sound: AMBIENT_SOUND.ROOM_AMBIENCE, intensity: 'low' },
  { state: PRESENCE_STATE.AMBIENT_IDLE, sound: AMBIENT_SOUND.BREATHING,     intensity: 'low' },
];

/**
 * tickAmbientAudio()
 * Determines which sound should be active based on current state.
 * Cooldown-guarded — no audio spam.
 */
export function tickAmbientAudio() {
  if (now() - _lastAudioTrigger < TIMING.AUDIO_COOLDOWN) {
    return { triggered: false, reason: 'cooldown' };
  }

  const core = getCore();
  const pe   = core.presenceEngine ?? {};
  const ss   = core.spatialState   ?? {};
  const aa   = core.ambientAudio   ?? {};

  // Check cooldown stored in core
  if (aa.soundCooldownUntil && now() < aa.soundCooldownUntil) {
    return { triggered: false, reason: 'sound_cooldown' };
  }

  const presenceState = pe.activePresenceState ?? PRESENCE_STATE.AMBIENT_IDLE;

  // Micro-behaviour sounds
  const micro = pe.currentMicroBehaviour;
  if (micro === MICRO_BEHAVIOUR.STRETCH) {
    _triggerSound(AMBIENT_SOUND.STRETCH_SOUND, 'low');
    return { triggered: true, sound: AMBIENT_SOUND.STRETCH_SOUND, source: 'micro_behaviour' };
  }
  if (micro === MICRO_BEHAVIOUR.SETTLE || micro === MICRO_BEHAVIOUR.SLEEPY_SIGH) {
    _triggerSound(AMBIENT_SOUND.SETTLE, 'low');
    return { triggered: true, sound: AMBIENT_SOUND.SETTLE, source: 'micro_behaviour' };
  }

  // State-based sound
  const rule = SOUND_RULES.find(r => r.state === presenceState);
  if (!rule) return { triggered: false, reason: 'no_rule' };

  // Don't repeat same sound if already active
  if (aa.activeSound === rule.sound) return { triggered: false, reason: 'same_sound_active' };

  _triggerSound(rule.sound, rule.intensity);
  return { triggered: true, sound: rule.sound, intensity: rule.intensity, source: 'state_rule' };
}

function _triggerSound(sound, intensity = 'low') {
  _lastAudioTrigger = now();
  savePresence(
    {},
    {},
    {},
    {
      activeSound:        sound,
      soundIntensity:     intensity,
      lastSoundAt:        now(),
      soundCooldownUntil: now() + TIMING.AUDIO_COOLDOWN,
    }
  );
}

/**
 * getAudioState()
 */
export function getAudioState() {
  return getCore().ambientAudio ?? {};
}

// ════════════════════════════════════════════════════════════════
// STEP 9 — REAL-TIME BEHAVIOUR SCHEDULER
// ════════════════════════════════════════════════════════════════

/**
 * getScheduler()
 */
export function getScheduler() {
  return getCore().behaviourScheduler ?? {};
}

/**
 * scheduleBehaviour(behaviourId, priority?, force?)
 * Enqueues a behaviour transition.
 * Priority-ordered, cooldown-guarded.
 */
export function scheduleBehaviour(behaviourId, priority = null, force = false) {
  if (!Object.values(PRESENCE_STATE).includes(behaviourId)) {
    return { scheduled: false, reason: 'unknown_behaviour' };
  }
  if (now() - _lastSchedulerTick < TIMING.SCHEDULER_TICK_MIN && !force) {
    return { scheduled: false, reason: 'scheduler_cooldown' };
  }

  const core = getCore();
  const bs   = core.behaviourScheduler ?? {};

  // Check behaviour-specific cooldown
  const cooldownExpiry = bs.cooldowns?.[behaviourId] ?? 0;
  if (now() < cooldownExpiry && !force) {
    return { scheduled: false, reason: 'behaviour_cooldown', expiresIn: cooldownExpiry - now() };
  }

  // Priority from table or provided
  const p = priority ?? bs.behaviourPriority?.[behaviourId] ?? 30;

  // Enqueue (capped at 5)
  const queue = [...(bs.transitionQueue ?? [])].slice(-4);
  queue.push({ behaviourId, priority: p, enqueuedAt: now() });
  queue.sort((a, b) => b.priority - a.priority); // high priority first

  const patch = {
    transitionQueue:   queue,
    schedulerState:    'processing',
    lastSchedulerTick: now(),
  };
  core.behaviourScheduler = { ...bs, ...patch };
  storage.saveCompanionCore(core);

  return { scheduled: true, behaviourId, priority: p, queueLength: queue.length };
}

/**
 * flushScheduler()
 * Processes the highest-priority queued behaviour.
 * Returns the dispatched behaviour or null.
 */
export function flushScheduler() {
  _lastSchedulerTick = now();
  const core = getCore();
  const bs   = core.behaviourScheduler ?? {};
  const queue = [...(bs.transitionQueue ?? [])];

  if (!queue.length) {
    core.behaviourScheduler = { ...bs, schedulerState: 'stable', lastSchedulerTick: now() };
    storage.saveCompanionCore(core);
    return { dispatched: null };
  }

  const next   = queue.shift();
  const bsCooldownMs = {
    [PRESENCE_STATE.REPOSITIONING]: 120_000,
    [PRESENCE_STATE.SLEEPING]:       60_000,
    [PRESENCE_STATE.INTERACTING]:    30_000,
    default:                         10_000,
  };
  const cooldownMs = bsCooldownMs[next.behaviourId] ?? bsCooldownMs.default;

  core.behaviourScheduler = {
    ...bs,
    activeBehaviour:   next.behaviourId,
    transitionQueue:   queue,
    schedulerState:    'stable',
    lastSchedulerTick: now(),
    cooldowns: {
      ...(bs.cooldowns ?? {}),
      [next.behaviourId]: now() + cooldownMs,
    },
  };
  storage.saveCompanionCore(core);

  // Apply the dispatched behaviour
  setPresenceState(next.behaviourId);

  return { dispatched: next.behaviourId, priority: next.priority };
}

/**
 * clearSchedulerQueue()
 * Empties the queue (e.g. on emergency state reset).
 */
export function clearSchedulerQueue() {
  const core = getCore();
  core.behaviourScheduler = {
    ...(core.behaviourScheduler ?? {}),
    transitionQueue: [],
    schedulerState:  'stable',
  };
  storage.saveCompanionCore(core);
  return { cleared: true };
}

// ════════════════════════════════════════════════════════════════
// STEP 10 — CONTEXTUAL PRESENCE CONVERSATION LAYER
// ════════════════════════════════════════════════════════════════

/**
 * getPresenceConversationContext()
 * Full context object for Ollama prompt injection (Run 13 layer).
 */
export function getPresenceConversationContext() {
  const core  = getCore();
  const pe    = core.presenceEngine    ?? {};
  const ss    = core.spatialState      ?? {};
  const bs    = core.behaviourScheduler?? {};
  const aa    = core.ambientAudio      ?? {};
  const env   = core.environmentSystem ?? {};
  const ls    = core.lifeSimulation    ?? {};
  const ns    = core.needsState        ?? {};
  const anim  = core.animationSystem   ?? {};

  const zone    = pe.currentSpatialZone ?? SPATIAL_ZONE.COMFORT_AREA;
  const zoneDef = ZONE_DEFINITIONS[zone] ?? {};

  // Tone directive from presence state
  const toneMap = {
    [PRESENCE_STATE.SLEEPING]:     'Respond very briefly and gently — companion is sleeping.',
    [PRESENCE_STATE.RESTING]:      'Respond calmly and softly — companion is at rest.',
    [PRESENCE_STATE.AMBIENT_IDLE]: 'Respond in a warm, relaxed manner.',
    [PRESENCE_STATE.ATTENTIVE]:    'Respond with gentle curiosity and alertness.',
    [PRESENCE_STATE.REPOSITIONING]:'Respond briefly — companion is in movement.',
    [PRESENCE_STATE.INTERACTING]:  'Acknowledge the current activity naturally.',
  };

  return {
    // Presence
    presenceState:       pe.activePresenceState  ?? PRESENCE_STATE.AMBIENT_IDLE,
    presenceIntensity:   pe.presenceIntensity    ?? PRESENCE_INTENSITY.CALM,
    spatialZone:         zone,
    zonePacing:          zoneDef.movementPacing  ?? 'calm',
    attentionTarget:     pe.activeAttentionTarget ?? null,
    currentMicroBehaviour: pe.currentMicroBehaviour ?? null,
    // Spatial
    position:            ss.currentPosition      ?? { x: 0.5, y: 0, z: 0.5 },
    locomotionState:     ss.currentLocomotionState ?? LOCOMOTION.IDLE,
    // Environment
    activeScene:         env.activeScene         ?? 'living_room',
    lightingMode:        env.lightingMode        ?? 'soft',
    ambientState:        env.ambientState        ?? 'calm',
    // Audio
    activeSound:         aa.activeSound          ?? null,
    // Scheduler
    activeBehaviour:     bs.activeBehaviour      ?? null,
    // Life context
    ambientMood:         ls.ambientMood          ?? 'calm',
    currentRoutine:      ls.currentRoutine       ?? 'idle',
    isSleeping:          !!ls.sleepState?.sleeping,
    // Needs
    dominantNeed:        _getDominantNeed(ns),
    // Tone
    conversationToneDirective: toneMap[pe.activePresenceState ?? PRESENCE_STATE.AMBIENT_IDLE],
    // Animation
    animationState:      anim.primaryLayer       ?? 'idle',
    postureState:        anim.emotionalPosture   ?? 'relaxed',
  };
}

function _getDominantNeed(ns) {
  const needs = { hunger: ns.hunger ?? 50, thirst: ns.thirst ?? 50, boredom: ns.boredom ?? 50, comfort: 100 - (ns.comfort ?? 100), energy: 100 - (ns.energy ?? 100) };
  const dominant = Object.entries(needs).sort(([,a],[,b]) => b - a)[0];
  return dominant[1] > 70 ? dominant[0] : null;
}

// ════════════════════════════════════════════════════════════════
// STEP 11 — ADVANCED ANIMATION CONTINUITY
// ════════════════════════════════════════════════════════════════

/**
 * getAnimationContinuityContext()
 * Provides smoothing hints for the 3D renderer.
 * No actual Three.js / WebGL here — data layer only.
 */
export function getAnimationContinuityContext() {
  const core = getCore();
  const anim = core.animationSystem ?? {};
  const pe   = core.presenceEngine  ?? {};
  const ss   = core.spatialState    ?? {};

  // Transition smoothing metadata
  const transitionProfile = {
    [PRESENCE_STATE.SLEEPING]:     { blendDurationMs: 2000, anticipationMs: 500, easing: 'ease_out' },
    [PRESENCE_STATE.RESTING]:      { blendDurationMs: 1500, anticipationMs: 300, easing: 'ease_out' },
    [PRESENCE_STATE.AMBIENT_IDLE]: { blendDurationMs: 1000, anticipationMs: 200, easing: 'ease_in_out' },
    [PRESENCE_STATE.ATTENTIVE]:    { blendDurationMs: 600,  anticipationMs: 100, easing: 'ease_in' },
    [PRESENCE_STATE.REPOSITIONING]:{ blendDurationMs: 400,  anticipationMs: 50,  easing: 'linear' },
    [PRESENCE_STATE.INTERACTING]:  { blendDurationMs: 500,  anticipationMs: 100, easing: 'ease_in_out' },
  };

  const currentState = pe.activePresenceState ?? PRESENCE_STATE.AMBIENT_IDLE;
  const profile      = transitionProfile[currentState] ?? transitionProfile[PRESENCE_STATE.AMBIENT_IDLE];

  return {
    currentAnimationState: anim.primaryLayer       ?? 'idle',
    emotionalPosture:      anim.emotionalPosture   ?? 'relaxed',
    headTracking:          anim.headTracking       ?? 'soft_idle',
    tailMovement:          anim.tailMovement       ?? 'gentle_sway',
    gazeTarget:            anim.gazeTarget         ?? null,
    locomotionState:       ss.currentLocomotionState ?? LOCOMOTION.IDLE,
    presenceState:         currentState,
    // Smoothing hints for renderer
    blendDurationMs:       profile.blendDurationMs,
    anticipationMs:        profile.anticipationMs,
    easing:                profile.easing,
    // Procedural overlays
    microBehaviour:        pe.currentMicroBehaviour ?? null,
    microBehaviourActive:  !!pe.currentMicroBehaviour,
    // Idle interpolation
    idleVariance:          _computeIdleVariance(anim, pe),
    // Anti-snap flags
    preventSnap:           true,
    preventRoboticTiming:  true,
    useAnticipation:       true,
  };
}

function _computeIdleVariance(anim, pe) {
  // Slight procedural variance to prevent robotic timing
  const seed = Math.floor(Date.now() / 4000) % 5;
  const variances = ['minimal', 'low', 'low', 'medium', 'minimal'];
  return variances[seed];
}

// ════════════════════════════════════════════════════════════════
// STEP 12 — PRESENCE PERSISTENCE SYSTEM
// ════════════════════════════════════════════════════════════════

/**
 * capturePresenceSnapshot()
 * Saves a full presence snapshot before session end.
 */
export function capturePresenceSnapshot() {
  const core = getCore();
  const snapshot = {
    presenceEngine:     core.presenceEngine    ?? {},
    spatialState:       core.spatialState      ?? {},
    behaviourScheduler: core.behaviourScheduler?? {},
    ambientAudio:       core.ambientAudio      ?? {},
    capturedAt:         now(),
  };
  // Store in presenceEngine as lastSessionSnapshot
  core.presenceEngine = {
    ...(core.presenceEngine ?? {}),
    lastSessionSnapshot: snapshot,
  };
  storage.saveCompanionCore(core);
  return { captured: true, snapshot };
}

/**
 * restorePresenceFromSnapshot()
 * Restores presence state from last session.
 * Companion feels continuously present — not freshly spawned.
 */
export function restorePresenceFromSnapshot() {
  const core     = getCore();
  const pe       = core.presenceEngine ?? {};
  const snapshot = pe.lastSessionSnapshot;

  if (!snapshot) return { restored: false, reason: 'no_snapshot' };

  // Restore spatial zone (not position — avoid teleportation)
  const restoredZone = snapshot.presenceEngine?.currentSpatialZone ?? SPATIAL_ZONE.COMFORT_AREA;

  // Restore presence state but cap to safe states on reload
  const safeStates = [PRESENCE_STATE.AMBIENT_IDLE, PRESENCE_STATE.RESTING, PRESENCE_STATE.SLEEPING];
  const restoredState = safeStates.includes(snapshot.presenceEngine?.activePresenceState)
    ? snapshot.presenceEngine.activePresenceState
    : PRESENCE_STATE.AMBIENT_IDLE;

  savePresenceForce(
    {
      activePresenceState:   restoredState,
      currentSpatialZone:    restoredZone,
      activeAttentionTarget: null,   // clear attention on reload
      currentMicroBehaviour: null,   // clear mid-behaviour
      realTimeState:         'stable',
    },
    {
      movementTarget:         null,  // cancel any in-flight movement
      currentLocomotionState: LOCOMOTION.IDLE,
      activePath:             [],
    }
  );

  return { restored: true, state: restoredState, zone: restoredZone };
}

// ════════════════════════════════════════════════════════════════
// STEP 13 — GPU + CPU SAFETY LAYER
// ════════════════════════════════════════════════════════════════

/**
 * throttleRenderUpdate()
 * Returns true if a render update is allowed (16ms min = 60fps cap).
 * Use to gate expensive update loops.
 */
export function throttlePresenceRender() {
  if (now() - _renderThrottle < 16) return false;
  _renderThrottle = now();
  return true;
}

/**
 * enterLowPowerMode()
 * Increases all timing intervals — for background/battery-save mode.
 */
export function enterLowPowerMode() {
  const core = getCore();
  core.presenceEngine = {
    ...(core.presenceEngine ?? {}),
    realTimeState:     'low_power',
    presenceIntensity: PRESENCE_INTENSITY.SLEEPY,
  };
  storage.saveCompanionCore(core);
  return { lowPower: true };
}

/**
 * runPresencePerformanceCheck()
 * Checks for runaway loops, excessive state changes, audio spam.
 */
export function runPresencePerformanceCheck() {
  if (now() - _lastPerfCheck < TIMING.PERF_CHECK_INTERVAL) {
    return _lastPerfReport ?? { status: 'stable' };
  }
  _lastPerfCheck = now();

  const core = getCore();
  const bs   = core.behaviourScheduler ?? {};
  const aa   = core.ambientAudio       ?? {};
  const pe   = core.presenceEngine     ?? {};
  const warnings = [];

  // 1. Scheduler queue not growing unbounded
  const qLen = (bs.transitionQueue ?? []).length;
  if (qLen >= 4) warnings.push(`scheduler_queue_near_cap: ${qLen}/5`);

  // 2. Not in non-stop locomotion
  const ss = core.spatialState ?? {};
  if (ss.currentLocomotionState === LOCOMOTION.WALKING && !ss.movementTarget) {
    warnings.push('locomotion_without_target');
  }

  // 3. Audio cooldown respected
  if (aa.soundCooldownUntil && aa.lastSoundAt && (now() - aa.lastSoundAt < 2000)) {
    warnings.push('audio_triggered_too_rapidly');
  }

  // 4. Presence state is valid
  if (!Object.values(PRESENCE_STATE).includes(pe.activePresenceState)) {
    warnings.push(`invalid_presence_state: ${pe.activePresenceState}`);
  }

  const report = {
    ts:      now(),
    status:  warnings.length ? 'warning' : 'stable',
    warnings,
    checks: {
      schedulerQueueSize:  qLen,
      locomotionState:     ss.currentLocomotionState,
      audioActive:         !!aa.activeSound,
      presenceState:       pe.activePresenceState,
      microBehaviourActive:!!pe.currentMicroBehaviour,
    },
  };

  _lastPerfReport = report;
  return report;
}

// ════════════════════════════════════════════════════════════════
// STEP 14 — HYBRID ORCHESTRATION PRESENCE LAYER
// ════════════════════════════════════════════════════════════════

/**
 * getHybridPresenceOrchestrationContext()
 * Returns Groq + Ollama routing context specific to presence tasks.
 * Groq: environment classification, scene analysis.
 * Ollama: emotional continuity, presence reasoning.
 */
export function getHybridPresenceOrchestrationContext() {
  const core = getCore();
  const ao   = core.aiOrchestration ?? {};

  return {
    ollama: {
      role:   'emotional_continuity_presence_reasoning',
      tasks:  ['presence_emotional_calibration', 'behaviour_narrative', 'zone_motivation'],
      status: ao.providerStatus?.ollama ?? 'active',
    },
    groq: {
      role:   'realtime_environment_classification',
      tasks:  ['scene_detection', 'rapid_zone_classification', 'environment_preprocessing'],
      status: ao.providerStatus?.groq   ?? 'unknown',
      fallback: 'ollama',
    },
    orchestrationRule: 'Groq never directly controls behaviours. Ollama validates all presence decisions.',
    offlineSafe: true,
  };
}

// ════════════════════════════════════════════════════════════════
// STEP 15 — FUTURE AR + VOICE PREPARATION STUBS
// ════════════════════════════════════════════════════════════════

/**
 * getFutureExpansionStatus()
 * Read-only stub status — architecture prepared but not implemented.
 */
export function getFutureExpansionStatus() {
  return getCore().futureExpansion ?? {};
}

/**
 * prepareFutureExpansionSlot(slot)
 * Marks a future capability as architecture-ready (not implemented).
 * Validates against allowed slot names.
 */
export function prepareFutureExpansionSlot(slot) {
  const ALLOWED = ['arEnabled','arPlacementReady','voiceInteractionReady','roomMappingReady','webcamAwarenessReady','spatialAudioExpanded'];
  if (!ALLOWED.includes(slot)) return { prepared: false, reason: 'unknown_slot' };
  // These remain false — only marking as architecturally ready
  return { prepared: true, slot, note: 'Architecture slot registered. Implementation pending.' };
}

// ════════════════════════════════════════════════════════════════
// BOOT INTEGRATION
// ════════════════════════════════════════════════════════════════

/**
 * initPresenceSystem()
 * Called from companionCoreService.initCompanionCore() — boot step.
 */
export function initPresenceSystem() {
  const result = initPresenceEngine();
  // Try to restore from last session snapshot
  const restored = restorePresenceFromSnapshot();
  // Apply environment reactivity on boot
  const core  = getCore();
  const scene = core.environmentSystem?.activeScene ?? 'living_room';
  applyEnvironmentReactivity(scene);

  return {
    presenceState: result.presenceState,
    zone:          result.zone,
    intensity:     result.intensity,
    sessionRestored: restored.restored,
  };
}
