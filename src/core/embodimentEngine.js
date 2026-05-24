// ================================================================
// IMMORTAIL™ — EMBODIMENT ENGINE (Run 7)
// 3D presence layer: animation state derivation, media-to-appearance
// pipeline, sound reaction system, spatial idle behaviours,
// environment awareness, and embodiment persistence.
//
// STRICT RULES:
// - All reads/writes exclusively through storage SSOT
// - Animation states are DETERMINISTIC — derived from emotionalState,
//   attachmentGraph, evolutionLayer, and absence data only
// - No random breed/appearance generation
// - No biometric extraction from audio
// - No runaway render loops — all behaviours throttled
// - identityLock is never touched
// ================================================================

import storage from './storage.js';
import { EventBus, EVENTS } from './eventBus.js';

// ── Animation state catalogue ─────────────────────────────────────

export const ANIM_STATE = {
  IDLE:        'idle',
  ATTENTIVE:   'attentive',
  PLAYFUL:     'playful',
  RESTING:     'resting',
  CURIOUS:     'curious',
  EXCITED:     'excited',
  WAITING:     'waiting',
  REUNION:     'reunion',
};

// ── Posture catalogue ─────────────────────────────────────────────

export const POSTURE = {
  NEUTRAL:  'neutral',
  SITTING:  'sitting',
  LYING:    'lying',
  STANDING: 'standing',
  ALERT:    'alert',
};

// ── Idle behaviour states ─────────────────────────────────────────

export const IDLE_BEHAVIOUR = {
  BREATHING:  'breathing',
  HEAD_TURN:  'head_turn',
  TAIL_WAG:   'tail_wag',
  STRETCH:    'stretch',
  EAR_FLICK:  'ear_flick',
  SETTLE:     'settle',
};

// ── Environment scenes ────────────────────────────────────────────

export const ENV_SCENE = {
  HOME:    'home',
  PARK:    'park',
  EVENING: 'evening',
  NIGHT:   'night',
};

export const LIGHTING_MODE = {
  SOFT:   'soft',
  WARM:   'warm',
  COOL:   'cool',
  DIM:    'dim',
};

// ── Throttle: minimum ms between animation state writes ──────────
const ANIM_THROTTLE_MS     = 500;   // no more than 1 state change per 500ms
const IDLE_THROTTLE_MS     = 8000;  // idle behaviour rotates every 8s
const APPEARANCE_CAP       = 50;    // max appearanceMemory entries
const SOUND_REACTION_CAP   = 30;    // max soundReactions entries

// ── Internal timing guards (in-memory, reset on module reload) ────
let _lastAnimWrite   = 0;
let _lastIdleRotate  = 0;

// ── Helpers ───────────────────────────────────────────────────────

function genId() {
  return Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

function patchEmbodiment(patch) {
  const core = storage.getCompanionCore();
  const em   = core.embodiment ?? {};
  core.embodiment = { ...em, ...patch };
  storage.saveCompanionCore(core);
  return core.embodiment;
}

function getEmbodiment() {
  return storage.getCompanionCore().embodiment ?? {};
}

// ── Animation state derivation (deterministic) ───────────────────

/**
 * deriveAnimationState(core)
 * Returns the correct ANIM_STATE based on current companionCore.
 * Deterministic — no randomness.
 */
export function deriveAnimationState(core) {
  if (!core) core = storage.getCompanionCore();

  const ag  = core.attachmentGraph  ?? {};
  const es  = core.emotionalState   ?? {};
  const beh = core.behaviourState   ?? {};
  const em  = core.embodiment        ?? {};

  // ── Reunion: absence-driven override (highest priority) ──────────
  const recentReunion = (core.memory ?? [])
    .filter(m => m.type === 'reunion_event')
    .sort((a, b) => b.ts - a.ts)[0];
  const reunionFresh  = recentReunion &&
    (Date.now() - recentReunion.ts) < 5 * 60_000; // within 5 minutes
  if (reunionFresh) return ANIM_STATE.REUNION;

  // ── Resting: deep low energy overrides recency — check first ────────
  // (arousal < 30 = true rest state; behaviourState override always wins)
  if (es.arousal < 30 || beh.current === 'resting') return ANIM_STATE.RESTING;

  // ── Excited: high valence + high bond ────────────────────────────
  if (es.valence >= 60 && ag.userBond >= 40) return ANIM_STATE.EXCITED;

  // ── Playful: playful behaviour or medium-high energy ─────────────
  if (beh.current === 'playful' || (es.valence >= 30 && es.arousal >= 65))
    return ANIM_STATE.PLAYFUL;

  // ── Attentive: recent interaction (within 2 min) ─────────────────
  const lastInteract = core.lastInteraction ?? 0;
  const secsSince    = (Date.now() - lastInteract) / 1000;
  if (secsSince < 120 && es.valence >= 0) return ANIM_STATE.ATTENTIVE;

  // ── Curious: moderate arousal, neutral/positive valence ──────────
  if (es.arousal >= 50 && es.valence >= -10) return ANIM_STATE.CURIOUS;

  // ── Waiting: familiar+ bond but idle for >5 min ──────────────────
  if (ag.bondStage !== 'distant' && secsSince > 300) return ANIM_STATE.WAITING;

  // ── Resting: moderate low arousal (35-29 caught above; 30-35 here) ─
  if (es.arousal < 35) return ANIM_STATE.RESTING;

  return ANIM_STATE.IDLE;
}

/**
 * derivePostureState(animState, core)
 * Returns the correct POSTURE for the given animation state.
 */
export function derivePostureState(animState, core) {
  const es = (core ?? storage.getCompanionCore()).emotionalState ?? {};
  switch (animState) {
    case ANIM_STATE.RESTING:  return POSTURE.LYING;
    case ANIM_STATE.WAITING:  return POSTURE.SITTING;
    case ANIM_STATE.ATTENTIVE:return POSTURE.ALERT;
    case ANIM_STATE.REUNION:  return POSTURE.STANDING;
    case ANIM_STATE.EXCITED:  return POSTURE.STANDING;
    case ANIM_STATE.PLAYFUL:  return POSTURE.STANDING;
    case ANIM_STATE.CURIOUS:  return es.arousal >= 60 ? POSTURE.ALERT : POSTURE.STANDING;
    default:                  return POSTURE.NEUTRAL;
  }
}

// ── Idle behaviour rotation ────────────────────────────────────────

const IDLE_SEQUENCE = [
  IDLE_BEHAVIOUR.BREATHING,
  IDLE_BEHAVIOUR.HEAD_TURN,
  IDLE_BEHAVIOUR.TAIL_WAG,
  IDLE_BEHAVIOUR.EAR_FLICK,
  IDLE_BEHAVIOUR.BREATHING,
  IDLE_BEHAVIOUR.SETTLE,
  IDLE_BEHAVIOUR.STRETCH,
  IDLE_BEHAVIOUR.BREATHING,
  IDLE_BEHAVIOUR.HEAD_TURN,
  IDLE_BEHAVIOUR.TAIL_WAG,
];

let _idleSeqIndex = 0;

/**
 * tickIdleBehaviour()
 * Advances the idle behaviour sequence. Throttled — safe to call often.
 * Returns { changed: boolean, behaviour: string }
 */
export function tickIdleBehaviour() {
  const now = Date.now();
  if (now - _lastIdleRotate < IDLE_THROTTLE_MS) {
    return { changed: false, behaviour: getEmbodiment().idleBehaviourState ?? IDLE_BEHAVIOUR.BREATHING };
  }

  _lastIdleRotate = now;
  _idleSeqIndex   = (_idleSeqIndex + 1) % IDLE_SEQUENCE.length;

  const core = storage.getCompanionCore();
  const em   = core.embodiment ?? {};
  const animState = em.animationState ?? ANIM_STATE.IDLE;

  // Only rotate idle behaviours when actually idle/waiting/curious
  const idleEligible = [ANIM_STATE.IDLE, ANIM_STATE.WAITING, ANIM_STATE.CURIOUS].includes(animState);
  if (!idleEligible) {
    return { changed: false, behaviour: em.idleBehaviourState ?? IDLE_BEHAVIOUR.BREATHING };
  }

  // Mood-weight: wag more when happy, breathe more when resting
  const es     = core.emotionalState ?? {};
  let nextBeh  = IDLE_SEQUENCE[_idleSeqIndex];
  if (es.valence >= 30 && nextBeh === IDLE_BEHAVIOUR.BREATHING)
    nextBeh = IDLE_BEHAVIOUR.TAIL_WAG;  // swap toward positive
  if (es.valence < -20 && nextBeh === IDLE_BEHAVIOUR.TAIL_WAG)
    nextBeh = IDLE_BEHAVIOUR.BREATHING; // muted when negative

  patchEmbodiment({ idleBehaviourState: nextBeh });
  return { changed: true, behaviour: nextBeh };
}

// ── Environment awareness ─────────────────────────────────────────

/**
 * updateEnvironmentAwareness(patch)
 * Only writes safe, non-tracking environmental signals.
 */
export function updateEnvironmentAwareness(patch = {}) {
  const allowed = ['currentScene', 'lightingMode', 'interactionZone'];
  const safe    = {};
  for (const key of allowed) {
    if (patch[key] !== undefined) safe[key] = patch[key];
  }
  const em  = getEmbodiment();
  const env = { ...(em.environmentAwareness ?? {}), ...safe };
  patchEmbodiment({ environmentAwareness: env });
  return env;
}

// ── Media-to-appearance pipeline ─────────────────────────────────

// Safe, non-random visual descriptors derivable from media metadata
const SAFE_COLOUR_DESCRIPTORS = [
  'warm_brown', 'golden', 'cream', 'black', 'white',
  'grey', 'brindle', 'spotted', 'mixed',
];
const SAFE_SIZE_CATEGORIES   = ['small', 'medium', 'large'];
const SAFE_COAT_TYPES        = ['short', 'medium', 'long', 'wiry', 'curly'];
const SAFE_EAR_SHAPES        = ['upright', 'floppy', 'semi_erect'];
const SAFE_TAIL_STYLES       = ['long', 'short', 'curled', 'docked'];

/**
 * processMediaAppearance(mediaEntry)
 * Derives SAFE visual descriptors from image/video metadata.
 * NEVER generates random breeds. NEVER hallucinates.
 * Uses only what is explicitly provided in mediaEntry.meta.
 */
export function processMediaAppearance(mediaEntry) {
  if (!mediaEntry || !['image', 'video'].includes(mediaEntry.type)) return null;

  const meta    = mediaEntry.meta ?? {};
  const derived = {};

  // Validate and store only known-safe descriptor values
  if (meta.colourDescriptor && SAFE_COLOUR_DESCRIPTORS.includes(meta.colourDescriptor))
    derived.colourDescriptor = meta.colourDescriptor;

  if (meta.sizeCategory && SAFE_SIZE_CATEGORIES.includes(meta.sizeCategory))
    derived.sizeCategory = meta.sizeCategory;

  if (meta.coatType && SAFE_COAT_TYPES.includes(meta.coatType))
    derived.coatType = meta.coatType;

  if (meta.earShape && SAFE_EAR_SHAPES.includes(meta.earShape))
    derived.earShape = meta.earShape;

  if (meta.tailStyle && SAFE_TAIL_STYLES.includes(meta.tailStyle))
    derived.tailStyle = meta.tailStyle;

  if (meta.movementTendency && typeof meta.movementTendency === 'string')
    derived.movementTendency = meta.movementTendency.slice(0, 40); // length-cap

  if (Object.keys(derived).length === 0) return null; // nothing safe to store

  const entry = {
    id:         genId(),
    ts:         Date.now(),
    mediaId:    mediaEntry.id ?? null,
    mediaType:  mediaEntry.type,
    derived,
  };

  const core = storage.getCompanionCore();
  const em   = core.embodiment ?? {};
  em.appearanceMemory = [...(em.appearanceMemory ?? []), entry].slice(-APPEARANCE_CAP);

  // Merge into visualProfile (last write wins per key, capped value)
  em.visualProfile = { ...(em.visualProfile ?? {}), ...derived, updatedAt: Date.now() };

  core.embodiment = em;
  storage.saveCompanionCore(core);

  EventBus.emit(EVENTS.MEDIA_PROCESSED ?? 'MEDIA::ANALYZED', {
    mediaId: entry.mediaId,
    derived,
    ts: Date.now(),
  });

  return entry;
}

// ── Sound reaction system ─────────────────────────────────────────

export const SOUND_REACTION = {
  FAMILIAR_VOICE: 'familiar_voice',
  DOG_SOUNDS:     'dog_sounds',
  AMBIENT_CALM:   'ambient_calm',
  STARTLING:      'startling',
  UNKNOWN:        'unknown',
};

// Reaction effects (no biometric extraction — classification only)
const SOUND_EFFECTS = {
  [SOUND_REACTION.FAMILIAR_VOICE]: { trustDelta: 3,  excitementDelta: 2,  animHint: ANIM_STATE.ATTENTIVE },
  [SOUND_REACTION.DOG_SOUNDS]:     { trustDelta: 0,  excitementDelta: 4,  animHint: ANIM_STATE.CURIOUS   },
  [SOUND_REACTION.AMBIENT_CALM]:   { trustDelta: 1,  excitementDelta: -1, animHint: ANIM_STATE.RESTING   },
  [SOUND_REACTION.STARTLING]:      { trustDelta: -1, excitementDelta: 3,  animHint: ANIM_STATE.ATTENTIVE },
  [SOUND_REACTION.UNKNOWN]:        { trustDelta: 0,  excitementDelta: 1,  animHint: ANIM_STATE.CURIOUS   },
};

/**
 * processSoundReaction(audioEntry)
 * Classifies audio event and applies safe emotional effects.
 * NO biometric extraction. Classification = provided label only.
 * audioEntry: { id, type:'audio', reactionType, label }
 */
export function processSoundReaction(audioEntry) {
  if (!audioEntry || audioEntry.type !== 'audio') return null;

  const reactionType = audioEntry.reactionType ?? SOUND_REACTION.UNKNOWN;
  const effects      = SOUND_EFFECTS[reactionType] ?? SOUND_EFFECTS[SOUND_REACTION.UNKNOWN];

  const core  = storage.getCompanionCore();

  // Apply trust delta (clamped)
  if (effects.trustDelta) {
    core.identity.trust = Math.max(0, Math.min(100,
      (core.identity.trust ?? 0) + effects.trustDelta
    ));
  }

  // Log sound reaction (no raw audio data stored)
  const entry = {
    id:           genId(),
    ts:           Date.now(),
    audioId:      audioEntry.id ?? null,
    reactionType,
    label:        audioEntry.label ?? 'audio event',
    animHint:     effects.animHint,
    trustDelta:   effects.trustDelta,
    exciteDelta:  effects.excitementDelta,
  };

  core.embodiment = core.embodiment ?? {};
  core.embodiment.soundReactions = [
    ...(core.embodiment.soundReactions ?? []), entry
  ].slice(-SOUND_REACTION_CAP);

  storage.saveCompanionCore(core);

  EventBus.emit(EVENTS.EMOTION_CHANGED ?? 'EMOTION::CHANGED', {
    trigger: 'sound_reaction',
    reactionType,
    animHint: effects.animHint,
    ts: Date.now(),
  });

  return entry;
}

// ── Main update tick ──────────────────────────────────────────────

/**
 * updateEmbodimentState()
 * Primary tick — derives and persists animation + posture state.
 * Throttled: at most 1 write per ANIM_THROTTLE_MS.
 * Returns { animationState, postureState, idleBehaviour, changed }
 */
export function updateEmbodimentState() {
  const now  = Date.now();
  const core = storage.getCompanionCore();
  const em   = core.embodiment ?? {};

  const newAnim    = deriveAnimationState(core);
  const newPosture = derivePostureState(newAnim, core);

  const animChanged    = newAnim    !== em.animationState;
  const postureChanged = newPosture !== em.postureState;
  const needsWrite     = (animChanged || postureChanged) &&
                         (now - _lastAnimWrite >= ANIM_THROTTLE_MS);

  let idleBeh = em.idleBehaviourState ?? IDLE_BEHAVIOUR.BREATHING;

  if (needsWrite) {
    _lastAnimWrite = now;

    // Derive lighting from environment + emotion
    const es         = core.emotionalState ?? {};
    const lightingMode =
      es.valence < -20  ? LIGHTING_MODE.DIM  :
      es.valence >= 40  ? LIGHTING_MODE.WARM :
      (new Date().getHours() >= 20 || new Date().getHours() < 6)
                        ? LIGHTING_MODE.COOL : LIGHTING_MODE.SOFT;

    const envPatch = { lightingMode };
    const env      = { ...(em.environmentAwareness ?? {}), ...envPatch };

    core.embodiment = {
      ...em,
      animationState:       newAnim,
      postureState:         newPosture,
      environmentAwareness: env,
      idleBehaviourState:   idleBeh,
    };
    storage.saveCompanionCore(core);

    EventBus.emit(EVENTS.DOG_UPDATED ?? 'DOG::STATE_UPDATED', {
      animationState: newAnim,
      postureState:   newPosture,
      ts:             now,
    });
  }

  // Tick idle behaviour (separately throttled)
  const idleTick = tickIdleBehaviour();
  if (idleTick.changed) idleBeh = idleTick.behaviour;

  return {
    animationState:   newAnim,
    postureState:     newPosture,
    idleBehaviour:    idleBeh,
    changed:          needsWrite,
  };
}

// ── Snapshot getters ──────────────────────────────────────────────

export function getEmbodimentState() {
  const em = getEmbodiment();
  return {
    animationState:       em.animationState       ?? ANIM_STATE.IDLE,
    postureState:         em.postureState          ?? POSTURE.NEUTRAL,
    idleBehaviourState:   em.idleBehaviourState    ?? IDLE_BEHAVIOUR.BREATHING,
    environmentAwareness: em.environmentAwareness  ?? {},
    visualProfile:        em.visualProfile         ?? {},
    movementStyle:        em.movementStyle          ?? {},
    appearanceMemoryCount: (em.appearanceMemory    ?? []).length,
    soundReactionCount:   (em.soundReactions       ?? []).length,
    embodimentVersion:    em.embodimentVersion     ?? 'V1',
  };
}

export function getEmbodimentContext() {
  return getEmbodimentState();
}

export function getAppearanceMemory(limit = 10) {
  const em = getEmbodiment();
  return (em.appearanceMemory ?? []).slice(-limit);
}

export function getSoundReactions(limit = 10) {
  const em = getEmbodiment();
  return (em.soundReactions ?? []).slice(-limit);
}

export function getVisualProfile() {
  return getEmbodiment().visualProfile ?? {};
}

// ── Performance: low-power mode ───────────────────────────────────

let _lowPowerMode = false;

export function setLowPowerMode(enabled) {
  _lowPowerMode = !!enabled;
  // In low-power mode, idle throttle increases 4×
  // (read by tickIdleBehaviour callers via isLowPowerMode)
}
export function isLowPowerMode() { return _lowPowerMode; }

// ── Exported constants ────────────────────────────────────────────
export {
  ANIM_THROTTLE_MS, IDLE_THROTTLE_MS, APPEARANCE_CAP, SOUND_REACTION_CAP,
};
