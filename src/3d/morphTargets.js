// ================================================================
// IMMORTAIL™ — MORPH TARGET ORCHESTRATION SYSTEM
// Registration, bounded values, interpolation, emotion mapping.
// NO RANDOM MORPH GENERATION. DETERMINISTIC ONLY. DATA-DRIVEN.
// ================================================================

import { SystemLogger } from '../utils/logger.js';
const MorphLogger = SystemLogger;

export const MORPH_KEY = {
  EARS_ALERT:       'ears_alert',
  EARS_DOWN:        'ears_down',
  EARS_RELAXED:     'ears_relaxed',
  BROW_RAISE:       'brow_raise',
  BROW_FURROW:      'brow_furrow',
  MOUTH_OPEN:       'mouth_open',
  MOUTH_PANT:       'mouth_pant',
  EYES_WIDE:        'eyes_wide',
  EYES_SQUINT:      'eyes_squint',
  EYES_SOFT:        'eyes_soft',
  JOWL_PULL:        'jowl_pull',
  TAIL_WAG:         'tail_wag',
  TAIL_TUCK:        'tail_tuck',
  TAIL_RAISE:       'tail_raise',
  SPINE_ARCH:       'spine_arch',
  SPINE_LOWER:      'spine_lower',
  HAUNCHES_DOWN:    'haunches_down',
  CHEST_PUFF:       'chest_puff',
  BODY_SCALE_SMALL: 'body_scale_small',
  BODY_SCALE_LARGE: 'body_scale_large',
  SNOUT_SHORT:      'snout_short',
  SNOUT_LONG:       'snout_long',
};

export const MORPH_GROUP = {
  FACE: [
    MORPH_KEY.EARS_ALERT, MORPH_KEY.EARS_DOWN, MORPH_KEY.EARS_RELAXED,
    MORPH_KEY.BROW_RAISE, MORPH_KEY.BROW_FURROW, MORPH_KEY.MOUTH_OPEN,
    MORPH_KEY.MOUTH_PANT, MORPH_KEY.EYES_WIDE, MORPH_KEY.EYES_SQUINT,
    MORPH_KEY.EYES_SOFT, MORPH_KEY.JOWL_PULL,
  ],
  BODY: [
    MORPH_KEY.TAIL_WAG, MORPH_KEY.TAIL_TUCK, MORPH_KEY.TAIL_RAISE,
    MORPH_KEY.SPINE_ARCH, MORPH_KEY.SPINE_LOWER, MORPH_KEY.HAUNCHES_DOWN, MORPH_KEY.CHEST_PUFF,
  ],
  PROPORTION: [
    MORPH_KEY.BODY_SCALE_SMALL, MORPH_KEY.BODY_SCALE_LARGE,
    MORPH_KEY.SNOUT_SHORT, MORPH_KEY.SNOUT_LONG,
  ],
};

const MORPH_MIN = 0.0;
const MORPH_MAX = 1.0;

const INTERP_SPEED = {
  INSTANT: 1.0, FAST: 0.15, NORMAL: 0.08, SLOW: 0.03,
};

const _states = new Map();

class MorphState {
  constructor(profileId) {
    this.profileId    = profileId;
    this.current      = {};
    this.target       = {};
    this.speed        = {};
    this.meshBindings = new Map();
    this.dirty        = false;
    this.updatedAt    = Date.now();
  }
}

export function initializeMorphTargets(profileId) {
  if (!profileId || typeof profileId !== 'string')
    throw new MorphTargetError('[MorphTargets] profileId required.');
  if (_states.has(profileId)) return getMorphSnapshot(profileId);

  const state = new MorphState(profileId);
  for (const key of Object.values(MORPH_KEY)) {
    state.current[key] = 0;
    state.target[key]  = 0;
    state.speed[key]   = INTERP_SPEED.NORMAL;
  }
  _states.set(profileId, state);
  MorphLogger.info(`[MorphTargets] Initialized — profileId: ${profileId}`);
  return getMorphSnapshot(profileId);
}

export function applyMorphState(profileId, morphMap, speed = null) {
  const state = _requireState(profileId);
  if (!morphMap || typeof morphMap !== 'object')
    throw new MorphTargetError('[MorphTargets] morphMap must be an object.');

  const v = _validateMorphMap(morphMap);
  if (!v.valid) throw new MorphTargetError(`[MorphTargets] applyMorphState: ${v.errors.join(' | ')}`);

  for (const [key, value] of Object.entries(morphMap)) {
    state.target[key] = _clamp(value);
    if (speed !== null && typeof speed === 'number') state.speed[key] = _clamp(speed);
  }
  state.dirty = true; state.updatedAt = Date.now();
  return getMorphSnapshot(profileId);
}

export function interpolateMorphTargets(profileId, deltaFactor = 1) {
  const state = _states.get(profileId);
  if (!state || !state.dirty) return false;

  let moved = false;
  for (const key of Object.keys(state.current)) {
    const current = state.current[key] ?? 0;
    const target  = state.target[key]  ?? 0;

    if (Math.abs(target - current) < 0.0001) { state.current[key] = target; continue; }

    const speed = state.speed[key] ?? INTERP_SPEED.NORMAL;
    state.current[key] = _clamp(current + (target - current) * speed * deltaFactor);
    moved = true;

    const binding = state.meshBindings.get(key);
    if (binding?.mesh?.morphTargetInfluences && binding.morphIndex !== undefined)
      binding.mesh.morphTargetInfluences[binding.morphIndex] = state.current[key];
  }

  if (!moved) state.dirty = false;
  state.updatedAt = Date.now();
  return moved;
}

export function resetMorphTargets(profileId, group = null, instant = false) {
  const state = _requireState(profileId);
  const keys  = group ? group : Object.keys(state.current);

  for (const key of keys) {
    state.target[key] = 0;
    if (instant) {
      state.current[key] = 0;
      const binding = state.meshBindings.get(key);
      if (binding?.mesh?.morphTargetInfluences && binding.morphIndex !== undefined)
        binding.mesh.morphTargetInfluences[binding.morphIndex] = 0;
    }
  }
  state.dirty = !instant; state.updatedAt = Date.now();
  return getMorphSnapshot(profileId);
}

export function registerMeshBinding(profileId, morphKey, mesh, morphIndex) {
  const state = _requireState(profileId);
  if (!Object.values(MORPH_KEY).includes(morphKey))
    throw new MorphTargetError(`[MorphTargets] Unknown morph key: "${morphKey}".`);
  if (!mesh || !Array.isArray(mesh.morphTargetInfluences))
    throw new MorphTargetError('[MorphTargets] Invalid mesh or no morphTargetInfluences.');
  if (typeof morphIndex !== 'number' || morphIndex < 0 || morphIndex >= mesh.morphTargetInfluences.length)
    throw new MorphTargetError(`[MorphTargets] morphIndex ${morphIndex} out of range.`);
  state.meshBindings.set(morphKey, { mesh, morphIndex });
}

export function getMorphSnapshot(profileId) {
  const state = _requireState(profileId);
  return {
    profileId:    state.profileId,
    current:      { ...state.current },
    target:       { ...state.target },
    dirty:        state.dirty,
    bindingCount: state.meshBindings.size,
    updatedAt:    state.updatedAt,
  };
}

export function getMorphEngineStatus() {
  return { totalProfiles: _states.size, profileIds: Array.from(_states.keys()) };
}

function _clamp(v)   { return Math.min(MORPH_MAX, Math.max(MORPH_MIN, v)); }

function _validateMorphMap(map) {
  const errors = [], validKeys = Object.values(MORPH_KEY);
  for (const [key, val] of Object.entries(map)) {
    if (!validKeys.includes(key)) errors.push(`Unknown morph key: "${key}".`);
    else if (typeof val !== 'number' || val < MORPH_MIN || val > MORPH_MAX)
      errors.push(`Morph "${key}" must be in [0,1]. Got: ${val}.`);
  }
  return { valid: errors.length === 0, errors };
}

function _requireState(profileId) {
  const s = _states.get(profileId);
  if (!s) throw new MorphTargetError(`[MorphTargets] Profile "${profileId}" not initialized.`);
  return s;
}

export class MorphTargetError extends Error {
  constructor(message, context = {}) {
    super(message); this.name = 'MorphTargetError';
    this.context = context; this.timestamp = Date.now();
  }
}
