// ================================================================
// IMMORTAIL™ — SCENE MANAGER
// Scene lifecycle, object registry, lighting, camera coordination.
// DOES NOT OWN STATE. NO BUSINESS LOGIC. ORCHESTRATION ONLY.
// ================================================================

import { SystemLogger } from '../utils/logger.js';
const SceneLogger = SystemLogger;

export const SCENE_OBJECT_TYPE = {
  COMPANION: 'companion', ENVIRONMENT: 'environment', LIGHT: 'light',
  CAMERA: 'camera', HELPER: 'helper', EFFECT: 'effect', OVERLAY: 'overlay',
};

export const LIGHTING_PRESET = {
  NEUTRAL: 'neutral', WARM: 'warm', COOL: 'cool', DRAMATIC: 'dramatic', DARK: 'dark',
};

export const CAMERA_PRESET = {
  DEFAULT: 'default', PORTRAIT: 'portrait', FULL_BODY: 'full_body', OVERHEAD: 'overhead',
};

const LIGHTING_CONFIGS = {
  neutral:  { ambient: 0.6, directional: 0.8, ambientColor: 0xffffff, dirColor: 0xffffff, dirPosition: [5,10,7.5] },
  warm:     { ambient: 0.7, directional: 0.9, ambientColor: 0xffe8d0, dirColor: 0xffd580, dirPosition: [3,8,5]   },
  cool:     { ambient: 0.5, directional: 0.7, ambientColor: 0xd0e8ff, dirColor: 0xa8c8ff, dirPosition: [8,12,6]  },
  dramatic: { ambient: 0.2, directional: 1.2, ambientColor: 0x808080, dirColor: 0xffffff, dirPosition: [10,15,5] },
  dark:     { ambient: 0.1, directional: 0.3, ambientColor: 0x202030, dirColor: 0x6080ff, dirPosition: [2,5,3]   },
};

const CAMERA_CONFIGS = {
  default:   { fov: 45, near: 0.1, far: 100, position: [0,1.5,4],   target: [0,0.5,0] },
  portrait:  { fov: 35, near: 0.1, far: 50,  position: [0,1.8,2.2], target: [0,1.6,0] },
  full_body: { fov: 50, near: 0.1, far: 100, position: [0,1.0,5.5], target: [0,0.5,0] },
  overhead:  { fov: 60, near: 0.1, far: 100, position: [0,8.0,0.1], target: [0,0,0]   },
};

let _initialized = false, _sceneInstance = null, _cameraInstance = null;
let _lightingPreset = LIGHTING_PRESET.NEUTRAL, _cameraPreset = CAMERA_PRESET.DEFAULT;
let _lightingConfig = { ...LIGHTING_CONFIGS.neutral };
let _cameraConfig   = { ...CAMERA_CONFIGS.default };
let _environmentReady = false;
const _objects = new Map();

class SceneObjectRecord {
  constructor({ id, type, object3D, metadata }) {
    this.id = id; this.type = type; this.object3D = object3D || null;
    this.visible = true; this.metadata = metadata || {};
    this.addedAt = Date.now(); this.updatedAt = Date.now();
  }
}

export function initializeScene(options = {}) {
  if (_initialized) { SceneLogger.warn('[SceneManager] Already initialized.'); return getSceneState(); }
  if (options.sceneInstance)  _sceneInstance  = options.sceneInstance;
  if (options.cameraInstance) _cameraInstance = options.cameraInstance;
  _applyLightingPreset(options.lightingPreset || LIGHTING_PRESET.NEUTRAL);
  _applyCameraPreset(options.cameraPreset     || CAMERA_PRESET.DEFAULT);
  _environmentReady = true;
  _initialized      = true;
  SceneLogger.info(`[SceneManager] Initialized — lighting: ${_lightingPreset}, camera: ${_cameraPreset}`);
  return getSceneState();
}

export function registerSceneObject(config) {
  _assertInitialized();
  const v = _validateObjectConfig(config);
  if (!v.valid) throw new SceneManagerError(`[SceneManager] ${v.errors.join(' | ')}`);
  const { id, type, object3D, metadata } = config;
  if (_objects.has(id)) {
    const e = _objects.get(id);
    if (object3D) e.object3D = object3D;
    e.metadata = { ...e.metadata, ...(metadata||{}) }; e.updatedAt = Date.now();
    return _snapshot(e);
  }
  const rec = new SceneObjectRecord({ id, type, object3D, metadata });
  _objects.set(id, rec);
  SceneLogger.info(`[SceneManager] Object registered — id: ${id}, type: ${type}`);
  return _snapshot(rec);
}

export function removeSceneObject(objectId, dispose = true) {
  const rec = _objects.get(objectId);
  if (!rec) { SceneLogger.warn(`[SceneManager] "${objectId}" not found.`); return false; }
  if (dispose && rec.object3D) _disposeObject3D(rec.object3D);
  _objects.delete(objectId);
  SceneLogger.info(`[SceneManager] Object removed — id: ${objectId}`);
  return true;
}

export function updateSceneState(patch) {
  _assertInitialized();
  if (patch.lightingPreset) _applyLightingPreset(patch.lightingPreset);
  if (patch.cameraPreset)   _applyCameraPreset(patch.cameraPreset);
  if (patch.environmentReady !== undefined) _environmentReady = !!patch.environmentReady;
  return getSceneState();
}

export function setObjectVisibility(objectId, visible) {
  const rec = _objects.get(objectId); if (!rec) return false;
  rec.visible = !!visible; rec.updatedAt = Date.now();
  if (rec.object3D && 'visible' in rec.object3D) rec.object3D.visible = rec.visible;
  return true;
}

export function getSceneState() {
  return {
    initialized: _initialized, environmentReady: _environmentReady,
    objectCount: _objects.size, lightingPreset: _lightingPreset, cameraPreset: _cameraPreset,
    lightingConfig: { ..._lightingConfig }, cameraConfig: { ..._cameraConfig },
    objects: Array.from(_objects.values()).map(_snapshot),
  };
}

export function destroyScene() {
  SceneLogger.info('[SceneManager] Destroying...');
  for (const [, rec] of _objects) { if (rec.object3D) _disposeObject3D(rec.object3D); }
  _objects.clear(); _sceneInstance = null; _cameraInstance = null;
  _initialized = false; _environmentReady = false;
  SceneLogger.info('[SceneManager] Destroyed.');
}

export function setSceneInstance(s)  { _sceneInstance  = s; }
export function setCameraInstance(c) { _cameraInstance = c; }
export function getSceneInstance()   { return _sceneInstance; }
export function getCameraInstance()  { return _cameraInstance; }
export function getCameraConfig()    { return { ..._cameraConfig }; }
export function getLightingConfig()  { return { ..._lightingConfig }; }

function _applyLightingPreset(preset) {
  if (!Object.values(LIGHTING_PRESET).includes(preset)) return;
  _lightingPreset = preset; _lightingConfig = { ...LIGHTING_CONFIGS[preset] };
}
function _applyCameraPreset(preset) {
  if (!Object.values(CAMERA_PRESET).includes(preset)) return;
  _cameraPreset = preset; _cameraConfig = { ...CAMERA_CONFIGS[preset] };
}
function _disposeObject3D(obj) {
  if (!obj) return;
  try {
    obj.geometry?.dispose?.();
    const mats = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
    for (const m of mats) { m.map?.dispose?.(); m.normalMap?.dispose?.(); m.dispose?.(); }
    obj.children?.forEach?.(_disposeObject3D);
  } catch (err) { SceneLogger.warn(`[SceneManager] Disposal: ${err.message}`); }
}
function _validateObjectConfig(c) {
  const errors = [], validTypes = Object.values(SCENE_OBJECT_TYPE);
  if (!c?.id   || typeof c.id   !== 'string') errors.push('"id" required.');
  if (!c?.type || !validTypes.includes(c.type)) errors.push(`"type" must be one of: ${validTypes.join(', ')}.`);
  return { valid: errors.length === 0, errors };
}
function _snapshot(rec) {
  return { id: rec.id, type: rec.type, visible: rec.visible,
           hasObject: !!rec.object3D, metadata: { ...rec.metadata },
           addedAt: rec.addedAt, updatedAt: rec.updatedAt };
}
function _assertInitialized() {
  if (!_initialized) throw new SceneManagerError('[SceneManager] Not initialized.');
}

export class SceneManagerError extends Error {
  constructor(message, context = {}) {
    super(message); this.name = 'SceneManagerError';
    this.context = context; this.timestamp = Date.now();
  }
}
