// ================================================================
// IMMORTAIL™ — EMOTION ANIMATION FOUNDATION
// Emotion → animation mapping, morph sync, visual synchronization.
// VISUALIZES EMOTIONS ONLY. DOES NOT OWN EMOTIONAL STATE.
// ALL EMOTION DATA FLOWS IN FROM RUNTIME STATE.
// ================================================================

import { SystemLogger }        from '../utils/logger.js';
import { ANIMATION_STATE }     from './animationMixer.js';
import { MORPH_KEY, MORPH_GROUP } from './morphTargets.js';

const EmotionAnimLogger = SystemLogger;

// ----------------------------------------------------------------
// EMOTION → ANIMATION MAPPING
// Maps dominant emotion labels to primary animation states.
// ----------------------------------------------------------------

export const EMOTION_ANIMATION_MAP = {
  joy:      { primary: ANIMATION_STATE.WAG,    secondary: ANIMATION_STATE.GREET,  intensity: 1.0 },
  calm:     { primary: ANIMATION_STATE.IDLE,   secondary: ANIMATION_STATE.LIE,    intensity: 0.3 },
  excited:  { primary: ANIMATION_STATE.PLAY,   secondary: ANIMATION_STATE.WAG,    intensity: 0.9 },
  anxious:  { primary: ANIMATION_STATE.IDLE,   secondary: ANIMATION_STATE.LOOK,   intensity: 0.4 },
  trusting: { primary: ANIMATION_STATE.GREET,  secondary: ANIMATION_STATE.SIT,    intensity: 0.6 },
  attached: { primary: ANIMATION_STATE.GREET,  secondary: ANIMATION_STATE.IDLE,   intensity: 0.7 },
  stressed: { primary: ANIMATION_STATE.PANT,   secondary: ANIMATION_STATE.LIE,    intensity: 0.5 },
  neutral:  { primary: ANIMATION_STATE.IDLE,   secondary: ANIMATION_STATE.SNIFF,  intensity: 0.3 },
};

// ----------------------------------------------------------------
// EMOTION → MORPH PRESET
// Maps dominant emotions to morph target presets.
// Each value in range [0..1].
// ----------------------------------------------------------------

export const EMOTION_MORPH_PRESET = {
  joy: {
    [MORPH_KEY.EARS_ALERT]:    0.7,
    [MORPH_KEY.EARS_RELAXED]:  0.3,
    [MORPH_KEY.BROW_RAISE]:    0.5,
    [MORPH_KEY.MOUTH_OPEN]:    0.4,
    [MORPH_KEY.MOUTH_PANT]:    0.2,
    [MORPH_KEY.EYES_SOFT]:     0.7,
    [MORPH_KEY.TAIL_WAG]:      0.9,
    [MORPH_KEY.TAIL_RAISE]:    0.6,
    [MORPH_KEY.CHEST_PUFF]:    0.4,
  },
  calm: {
    [MORPH_KEY.EARS_RELAXED]:  0.8,
    [MORPH_KEY.EYES_SQUINT]:   0.3,
    [MORPH_KEY.EYES_SOFT]:     0.6,
    [MORPH_KEY.TAIL_TUCK]:     0.1,
    [MORPH_KEY.SPINE_LOWER]:   0.3,
    [MORPH_KEY.MOUTH_OPEN]:    0.0,
  },
  excited: {
    [MORPH_KEY.EARS_ALERT]:    1.0,
    [MORPH_KEY.BROW_RAISE]:    0.8,
    [MORPH_KEY.EYES_WIDE]:     0.8,
    [MORPH_KEY.MOUTH_OPEN]:    0.7,
    [MORPH_KEY.MOUTH_PANT]:    0.5,
    [MORPH_KEY.TAIL_WAG]:      1.0,
    [MORPH_KEY.TAIL_RAISE]:    0.8,
    [MORPH_KEY.CHEST_PUFF]:    0.6,
    [MORPH_KEY.SPINE_ARCH]:    0.4,
  },
  anxious: {
    [MORPH_KEY.EARS_DOWN]:     0.8,
    [MORPH_KEY.BROW_FURROW]:   0.6,
    [MORPH_KEY.EYES_WIDE]:     0.5,
    [MORPH_KEY.TAIL_TUCK]:     0.9,
    [MORPH_KEY.HAUNCHES_DOWN]: 0.7,
    [MORPH_KEY.SPINE_LOWER]:   0.5,
    [MORPH_KEY.MOUTH_OPEN]:    0.1,
  },
  trusting: {
    [MORPH_KEY.EARS_RELAXED]:  0.6,
    [MORPH_KEY.EYES_SOFT]:     0.8,
    [MORPH_KEY.BROW_RAISE]:    0.3,
    [MORPH_KEY.TAIL_RAISE]:    0.5,
    [MORPH_KEY.TAIL_WAG]:      0.4,
    [MORPH_KEY.MOUTH_OPEN]:    0.2,
  },
  attached: {
    [MORPH_KEY.EARS_ALERT]:    0.5,
    [MORPH_KEY.EYES_SOFT]:     0.9,
    [MORPH_KEY.BROW_RAISE]:    0.4,
    [MORPH_KEY.TAIL_WAG]:      0.6,
    [MORPH_KEY.MOUTH_OPEN]:    0.3,
    [MORPH_KEY.CHEST_PUFF]:    0.3,
  },
  stressed: {
    [MORPH_KEY.EARS_DOWN]:     0.9,
    [MORPH_KEY.BROW_FURROW]:   0.8,
    [MORPH_KEY.MOUTH_PANT]:    0.8,
    [MORPH_KEY.MOUTH_OPEN]:    0.5,
    [MORPH_KEY.TAIL_TUCK]:     0.7,
    [MORPH_KEY.HAUNCHES_DOWN]: 0.5,
  },
  neutral: {
    [MORPH_KEY.EARS_RELAXED]:  0.5,
    [MORPH_KEY.EYES_SOFT]:     0.3,
    [MORPH_KEY.TAIL_WAG]:      0.1,
    [MORPH_KEY.MOUTH_OPEN]:    0.0,
  },
};

// ----------------------------------------------------------------
// INTENSITY MODIFIER
// Scales morph values by emotion intensity (0..1).
// ----------------------------------------------------------------

function _applyIntensity(morphPreset, intensity) {
  const scaled = {};
  const i      = Math.min(1, Math.max(0, intensity));
  for (const [key, val] of Object.entries(morphPreset)) {
    scaled[key] = Math.min(1, val * i);
  }
  return scaled;
}

// ----------------------------------------------------------------
// INTERNAL STATE
// ----------------------------------------------------------------

/** @type {Map<string, EmotionAnimState>} profileId → state */
const _states = new Map();

class EmotionAnimState {
  constructor(profileId) {
    this.profileId          = profileId;
    this.currentEmotion     = 'neutral';
    this.currentIntensity   = 0.3;
    this.targetAnimState    = ANIMATION_STATE.IDLE;
    this.targetMorphPreset  = {};
    this.lastSyncedAt       = null;
    this.updatedAt          = Date.now();
  }
}

// ----------------------------------------------------------------
// INITIALIZE EMOTION ANIMATIONS
// ----------------------------------------------------------------

/**
 * Initialize the emotion animation system for a companion profile.
 * @param {string} profileId
 * @returns {Object} state snapshot
 */
export function initializeEmotionAnimations(profileId) {
  if (!profileId || typeof profileId !== 'string') {
    throw new EmotionAnimationError('[EmotionAnimations] initializeEmotionAnimations: profileId required.');
  }

  if (_states.has(profileId)) {
    EmotionAnimLogger.warn(`[EmotionAnimations] Profile "${profileId}" already initialized.`);
    return getEmotionAnimationState(profileId);
  }

  const state = new EmotionAnimState(profileId);
  _states.set(profileId, state);

  EmotionAnimLogger.info(`[EmotionAnimations] Initialized — profileId: ${profileId}`);
  return getEmotionAnimationState(profileId);
}

// ----------------------------------------------------------------
// APPLY EMOTION VISUALS
// ----------------------------------------------------------------

/**
 * Compute the animation state and morph targets for a given emotion.
 * Returns the computed visual mapping — does NOT mutate dog state.
 * Consumers pass the result to animationMixer and morphTargets.
 *
 * @param {string} profileId
 * @param {string} dominantEmotion   — emotion label from emotionEngine
 * @param {number} [intensity=0.5]   — emotion intensity from emotionEngine
 * @returns {Object} { animationState, morphMap, preset }
 */
export function applyEmotionVisuals(profileId, dominantEmotion, intensity = 0.5) {
  const state = _requireState(profileId);

  const validEmotions = Object.keys(EMOTION_ANIMATION_MAP);
  const emotion       = validEmotions.includes(dominantEmotion) ? dominantEmotion : 'neutral';

  if (emotion !== dominantEmotion) {
    EmotionAnimLogger.warn(
      `[EmotionAnimations] Unknown emotion "${dominantEmotion}" — falling back to "neutral".`
    );
  }

  const animMapping  = EMOTION_ANIMATION_MAP[emotion];
  const morphPreset  = EMOTION_MORPH_PRESET[emotion] || EMOTION_MORPH_PRESET.neutral;
  const scaledMorphs = _applyIntensity(morphPreset, intensity);

  state.currentEmotion    = emotion;
  state.currentIntensity  = intensity;
  state.targetAnimState   = animMapping.primary;
  state.targetMorphPreset = scaledMorphs;
  state.updatedAt         = Date.now();

  EmotionAnimLogger.debug(
    `[EmotionAnimations] Emotion visuals computed — profileId: ${profileId}, ` +
    `emotion: ${emotion}, intensity: ${intensity.toFixed(2)}, ` +
    `animState: ${animMapping.primary}`
  );

  return {
    animationState:   animMapping.primary,
    secondaryState:   animMapping.secondary,
    baseIntensity:    animMapping.intensity,
    emotionIntensity: intensity,
    morphMap:         { ...scaledMorphs },
    emotion,
  };
}

// ----------------------------------------------------------------
// SYNCHRONIZE EMOTION ANIMATION
// ----------------------------------------------------------------

/**
 * Synchronize emotion visuals to the active animation/morph systems.
 * Calls playAnimation and applyMorphState via the passed references.
 * All mutations go through the mixer and morph systems — not direct.
 *
 * @param {string}   profileId
 * @param {string}   dominantEmotion
 * @param {number}   [intensity=0.5]
 * @param {Function} [onAnimationState]  — callback(profileId, animState)
 * @param {Function} [onMorphMap]        — callback(profileId, morphMap)
 * @returns {Object} sync result
 */
export function synchronizeEmotionAnimation(
  profileId,
  dominantEmotion,
  intensity = 0.5,
  onAnimationState = null,
  onMorphMap = null
) {
  const state    = _requireState(profileId);
  const visuals  = applyEmotionVisuals(profileId, dominantEmotion, intensity);

  // Delegate to animation mixer via callback (decoupled — no direct import loop)
  if (typeof onAnimationState === 'function') {
    try {
      onAnimationState(profileId, visuals.animationState);
    } catch (err) {
      EmotionAnimLogger.error(
        `[EmotionAnimations] onAnimationState callback error: ${err.message}`
      );
    }
  }

  // Delegate to morph targets via callback
  if (typeof onMorphMap === 'function') {
    try {
      onMorphMap(profileId, visuals.morphMap);
    } catch (err) {
      EmotionAnimLogger.error(
        `[EmotionAnimations] onMorphMap callback error: ${err.message}`
      );
    }
  }

  state.lastSyncedAt = Date.now();
  state.updatedAt    = Date.now();

  EmotionAnimLogger.info(
    `[EmotionAnimations] Synchronized — profileId: ${profileId}, ` +
    `emotion: ${visuals.emotion}, animState: ${visuals.animationState}`
  );

  return {
    profileId,
    emotion:          visuals.emotion,
    animationState:   visuals.animationState,
    secondaryState:   visuals.secondaryState,
    morphMap:         visuals.morphMap,
    syncedAt:         state.lastSyncedAt,
  };
}

// ----------------------------------------------------------------
// RESET EMOTION VISUALS
// ----------------------------------------------------------------

/**
 * Reset emotion animation state to neutral.
 * @param {string}   profileId
 * @param {Function} [onAnimationState]
 * @param {Function} [onMorphMap]
 */
export function resetEmotionVisuals(profileId, onAnimationState = null, onMorphMap = null) {
  const state = _requireState(profileId);

  state.currentEmotion    = 'neutral';
  state.currentIntensity  = 0.3;
  state.targetAnimState   = ANIMATION_STATE.IDLE;
  state.targetMorphPreset = {};
  state.updatedAt         = Date.now();

  // Neutral morph (all relaxed)
  const neutralMorph = _applyIntensity(
    EMOTION_MORPH_PRESET.neutral,
    0.3
  );

  if (typeof onAnimationState === 'function') {
    try { onAnimationState(profileId, ANIMATION_STATE.IDLE); } catch {}
  }
  if (typeof onMorphMap === 'function') {
    try { onMorphMap(profileId, neutralMorph); } catch {}
  }

  EmotionAnimLogger.info(`[EmotionAnimations] Emotion visuals reset — profileId: ${profileId}`);
  return getEmotionAnimationState(profileId);
}

// ----------------------------------------------------------------
// GET EMOTION ANIMATION STATE
// ----------------------------------------------------------------

export function getEmotionAnimationState(profileId) {
  const state = _requireState(profileId);
  return {
    profileId:         state.profileId,
    currentEmotion:    state.currentEmotion,
    currentIntensity:  state.currentIntensity,
    targetAnimState:   state.targetAnimState,
    targetMorphCount:  Object.keys(state.targetMorphPreset).length,
    lastSyncedAt:      state.lastSyncedAt,
    updatedAt:         state.updatedAt,
  };
}

// ----------------------------------------------------------------
// GET MORPH PRESET FOR EMOTION
// ----------------------------------------------------------------

/**
 * Returns the raw morph preset for a given emotion label.
 * @param {string} emotion
 * @param {number} [intensity=1.0]
 * @returns {Object} morphMap
 */
export function getMorphPresetForEmotion(emotion, intensity = 1.0) {
  const preset = EMOTION_MORPH_PRESET[emotion] || EMOTION_MORPH_PRESET.neutral;
  return _applyIntensity(preset, intensity);
}

// ----------------------------------------------------------------
// ENGINE STATUS
// ----------------------------------------------------------------

export function getEmotionAnimationEngineStatus() {
  return {
    totalProfiles: _states.size,
    profileIds:    Array.from(_states.keys()),
  };
}

// ----------------------------------------------------------------
// INTERNAL: Require state or throw
// ----------------------------------------------------------------

function _requireState(profileId) {
  const state = _states.get(profileId);
  if (!state) {
    throw new EmotionAnimationError(
      `[EmotionAnimations] Profile "${profileId}" not found. Call initializeEmotionAnimations() first.`
    );
  }
  return state;
}

// ----------------------------------------------------------------
// EMOTION ANIMATION ERROR
// ----------------------------------------------------------------

export class EmotionAnimationError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name      = 'EmotionAnimationError';
    this.context   = context;
    this.timestamp = Date.now();
  }
}
