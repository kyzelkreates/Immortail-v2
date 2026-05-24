// ================================================================
// IMMORTAIL™ — ANIMATION MIXER FOUNDATION
// Animation state transitions, blending, playback, sync.
// DOES NOT OWN EMOTIONAL STATE. VISUALIZATION LAYER ONLY.
// ================================================================

import { SystemLogger } from '../utils/logger.js';
const AnimationLogger = SystemLogger;

export const ANIMATION_STATE = {
  IDLE: 'idle', WALK: 'walk', RUN: 'run', SIT: 'sit', LIE: 'lie',
  PLAY: 'play', GREET: 'greet', SHAKE: 'shake', LOOK: 'look',
  EAT: 'eat', SLEEP: 'sleep', ALERT: 'alert', WAG: 'wag',
  SNIFF: 'sniff', PANT: 'pant',
};

export const TRANSITION_TYPE = {
  INSTANT: 'instant', CROSSFADE: 'crossfade', BLEND: 'blend',
};

const ALLOWED_TRANSITIONS = {
  idle:        ['walk','sit','lie','alert','sniff','look','greet','pant','wag'],
  walk:        ['idle','run','sit','sniff'],
  run:         ['walk','idle','play'],
  sit:         ['idle','lie','shake','greet','eat','pant'],
  lie:         ['sit','idle','sleep','pant'],
  sleep:       ['lie','idle'],
  play:        ['idle','run','walk'],
  greet:       ['idle','wag','walk'],
  shake:       ['sit','idle'],
  look:        ['idle','alert','sniff'],
  eat:         ['sit','idle'],
  alert:       ['idle','walk','look'],
  wag:         ['idle','greet','sit'],
  sniff:       ['idle','walk'],
  pant:        ['idle','sit','lie'],
};

const DEFAULT_BLEND_DURATION = { instant: 0, crossfade: 0.3, blend: 0.5 };

const _mixers = new Map();

class MixerProfile {
  constructor(profileId) {
    this.profileId       = profileId;
    this.currentState    = ANIMATION_STATE.IDLE;
    this.previousState   = null;
    this.activeAction    = null;
    this.mixerInstance   = null;
    this.actions         = new Map();
    this.blendWeight     = 1.0;
    this.transitionQueue = [];
    this.speed           = 1.0;
    this.paused          = false;
    this.transitionCount = 0;
    this.updatedAt       = Date.now();
  }
}

export function initializeAnimationMixer(profileId, options = {}) {
  if (!profileId || typeof profileId !== 'string')
    throw new AnimationMixerError('[AnimationMixer] profileId required.');
  if (_mixers.has(profileId)) return getAnimationSnapshot(profileId);

  const profile = new MixerProfile(profileId);
  profile.mixerInstance = options.mixerInstance || null;
  if (options.initialState && Object.values(ANIMATION_STATE).includes(options.initialState))
    profile.currentState = options.initialState;

  _mixers.set(profileId, profile);
  AnimationLogger.info(`[AnimationMixer] Initialized — profileId: ${profileId}, state: ${profile.currentState}`);
  return getAnimationSnapshot(profileId);
}

export function playAnimation(profileId, stateName, options = {}) {
  const profile = _requireProfile(profileId);
  _assertValidState(stateName);
  if (typeof options.speed === 'number')       profile.speed       = Math.max(0, options.speed);
  if (typeof options.blendWeight === 'number') profile.blendWeight = _clamp01(options.blendWeight);

  const action = profile.actions.get(stateName);
  if (action && profile.mixerInstance) _activateAction(profile, action);

  profile.previousState = profile.currentState;
  profile.currentState  = stateName;
  profile.paused        = false;
  profile.updatedAt     = Date.now();
  AnimationLogger.info(`[AnimationMixer] Play — profileId: ${profileId}, state: ${stateName}`);
  return getAnimationSnapshot(profileId);
}

export function transitionAnimation(profileId, targetState, transitionType = TRANSITION_TYPE.CROSSFADE, blendDuration = null) {
  const profile = _requireProfile(profileId);
  _assertValidState(targetState);

  const allowed = ALLOWED_TRANSITIONS[profile.currentState] || [];
  if (!allowed.includes(targetState)) {
    AnimationLogger.warn(`[AnimationMixer] Transition blocked: "${profile.currentState}" → "${targetState}".`);
    return getAnimationSnapshot(profileId);
  }

  const duration = blendDuration ?? DEFAULT_BLEND_DURATION[transitionType] ?? 0.3;
  profile.transitionQueue.push({ from: profile.currentState, to: targetState, type: transitionType, duration, queuedAt: Date.now() });
  if (profile.transitionQueue.length > 20) profile.transitionQueue.shift();

  if (profile.mixerInstance) {
    const fromAction = profile.actions.get(profile.currentState);
    const toAction   = profile.actions.get(targetState);
    if (fromAction && toAction) {
      if (transitionType === TRANSITION_TYPE.INSTANT) {
        fromAction.stop?.();
        _activateAction(profile, toAction);
      } else {
        toAction.reset?.();
        toAction.setEffectiveTimeScale?.(profile.speed);
        toAction.setEffectiveWeight?.(1);
        toAction.play?.();
        fromAction.crossFadeTo?.(toAction, duration, true);
      }
    }
  }

  profile.previousState = profile.currentState;
  profile.currentState  = targetState;
  profile.transitionCount++; profile.updatedAt = Date.now();
  AnimationLogger.info(`[AnimationMixer] Transition: "${profile.previousState}" → "${targetState}"`);
  return getAnimationSnapshot(profileId);
}

export function stopAnimation(profileId, returnToIdle = true) {
  const profile = _requireProfile(profileId);
  profile.actions.get(profile.currentState)?.stop?.();
  if (returnToIdle) {
    profile.previousState = profile.currentState;
    profile.currentState  = ANIMATION_STATE.IDLE;
    const idleAction = profile.actions.get(ANIMATION_STATE.IDLE);
    if (idleAction && profile.mixerInstance) _activateAction(profile, idleAction);
  }
  profile.paused = false; profile.updatedAt = Date.now();
  return getAnimationSnapshot(profileId);
}

export function pauseAnimation(profileId) {
  const profile = _requireProfile(profileId);
  profile.paused = true;
  if (profile.activeAction) profile.activeAction.paused = true;
  profile.updatedAt = Date.now();
  return getAnimationSnapshot(profileId);
}

export function resumeAnimation(profileId) {
  const profile = _requireProfile(profileId);
  profile.paused = false;
  if (profile.activeAction) profile.activeAction.paused = false;
  profile.updatedAt = Date.now();
  return getAnimationSnapshot(profileId);
}

export function resetAnimationMixer(profileId) {
  const profile = _requireProfile(profileId);
  for (const [, action] of profile.actions) action.stop?.();
  profile.currentState = ANIMATION_STATE.IDLE; profile.previousState = null;
  profile.activeAction = null; profile.blendWeight = 1.0; profile.speed = 1.0;
  profile.paused = false; profile.transitionQueue = []; profile.updatedAt = Date.now();
  AnimationLogger.info(`[AnimationMixer] Reset — profileId: ${profileId}`);
  return getAnimationSnapshot(profileId);
}

export function setMixerInstance(profileId, mixerInstance) {
  _requireProfile(profileId).mixerInstance = mixerInstance;
}
export function registerAnimationAction(profileId, stateName, action) {
  const profile = _requireProfile(profileId);
  _assertValidState(stateName);
  profile.actions.set(stateName, action);
}

export function getAnimationSnapshot(profileId) {
  const profile = _requireProfile(profileId);
  return {
    profileId:        profile.profileId,
    currentState:     profile.currentState,
    previousState:    profile.previousState,
    paused:           profile.paused,
    speed:            profile.speed,
    blendWeight:      profile.blendWeight,
    transitionCount:  profile.transitionCount,
    registeredStates: Array.from(profile.actions.keys()),
    allowedNext:      ALLOWED_TRANSITIONS[profile.currentState] || [],
    hasMixer:         !!profile.mixerInstance,
    updatedAt:        profile.updatedAt,
  };
}

export function getAnimationEngineStatus() {
  return { totalProfiles: _mixers.size, profileIds: Array.from(_mixers.keys()) };
}

function _activateAction(profile, action) {
  profile.activeAction?.stop?.();
  action.reset?.();
  action.setEffectiveTimeScale?.(profile.speed);
  action.setEffectiveWeight?.(profile.blendWeight);
  action.clampWhenFinished = false;
  action.play?.();
  profile.activeAction = action;
}

function _clamp01(v) { return Math.min(1, Math.max(0, v)); }

function _assertValidState(state) {
  if (!Object.values(ANIMATION_STATE).includes(state))
    throw new AnimationMixerError(`[AnimationMixer] Invalid state: "${state}".`);
}

function _requireProfile(profileId) {
  const p = _mixers.get(profileId);
  if (!p) throw new AnimationMixerError(`[AnimationMixer] Profile "${profileId}" not found.`);
  return p;
}

export class AnimationMixerError extends Error {
  constructor(message, context = {}) {
    super(message); this.name = 'AnimationMixerError';
    this.context = context; this.timestamp = Date.now();
  }
}
