// ================================================================
// IMMORTAIL™ — RIG LOADER FOUNDATION
// GLTF/GLB rig loading, skeleton validation, morph-ready prep.
// NO RANDOM ANATOMY. NO MESH GENERATION. LOADING + VALIDATION ONLY.
// ================================================================

import { SystemLogger } from '../utils/logger.js';
const RigLogger = SystemLogger;

export const RIG_STATUS = {
  UNLOADED: 'unloaded', LOADING: 'loading', LOADED: 'loaded',
  VALIDATED: 'validated', FAILED: 'failed', UNLOADING: 'unloading',
};

export const REQUIRED_BONES = [
  'Root', 'Hips', 'Spine', 'Spine1', 'Spine2',
  'Head', 'Neck',
  'LeftFrontLeg', 'RightFrontLeg',
  'LeftBackLeg',  'RightBackLeg',
  'Tail',
];

export const REQUIRED_MORPH_MESHES = ['Body', 'Head', 'Tail'];

const DEFAULT_LOAD_CONFIG = {
  castShadow: true, receiveShadow: false, scale: 1.0,
  position: [0, 0, 0], rotation: [0, 0, 0],
  validateBones: true, validateMorphs: true,
};

const _rigs  = new Map();
const _cache = new Map();
let _loaderFn = null;

class RigRecord {
  constructor({ id, url, config }) {
    this.id = id; this.url = url;
    this.config      = { ...DEFAULT_LOAD_CONFIG, ...config };
    this.status      = RIG_STATUS.UNLOADED;
    this.gltf        = null; this.scene = null;
    this.bones       = []; this.morphMeshes = [];
    this.error       = null;
    this.registeredAt = Date.now(); this.loadedAt = null; this.validatedAt = null;
  }
}

export function registerGLTFLoader(loaderFn) {
  if (typeof loaderFn !== 'function')
    throw new RigError('[RigLoader] loaderFn must be a function.');
  _loaderFn = loaderFn;
  RigLogger.info('[RigLoader] GLTF loader registered.');
}

export async function loadRig(loadConfig) {
  const v = _validateLoadConfig(loadConfig);
  if (!v.valid) throw new RigError(`[RigLoader] loadRig: ${v.errors.join(' | ')}`);

  const { id, url, config } = loadConfig;

  if (_rigs.has(id)) {
    const ex = _rigs.get(id);
    if (ex.status === RIG_STATUS.LOADED || ex.status === RIG_STATUS.VALIDATED)
      return _snapshot(ex);
  }

  RigLogger.info(`[RigLoader] Loading rig — id: ${id}`);
  const record = new RigRecord({ id, url, config });
  record.status = RIG_STATUS.LOADING;
  _rigs.set(id, record);

  try {
    let gltf;
    if (_cache.has(url)) {
      gltf = _cache.get(url);
    } else {
      if (!_loaderFn) throw new RigError('[RigLoader] No GLTF loader registered.');
      gltf = await _loaderFn(url);
      _cache.set(url, gltf);
    }

    record.gltf        = gltf;
    record.scene       = gltf.scene || gltf;
    record.status      = RIG_STATUS.LOADED;
    record.loadedAt    = Date.now();
    record.bones       = _extractBoneNames(record.scene);
    record.morphMeshes = _extractMorphMeshNames(record.scene);

    RigLogger.info(`[RigLoader] Loaded — id: ${id}, bones: ${record.bones.length}`);

    if (record.config.validateBones || record.config.validateMorphs) {
      const rv = validateRig(id);
      if (rv.valid) { record.status = RIG_STATUS.VALIDATED; record.validatedAt = Date.now(); }
      else RigLogger.warn(`[RigLoader] Rig "${id}" warnings: ${rv.errors.join(' | ')}`);
    }
  } catch (err) {
    record.status = RIG_STATUS.FAILED; record.error = err.message;
    throw new RigError(`[RigLoader] Failed to load "${id}": ${err.message}`);
  }

  return _snapshot(record);
}

export function validateRig(rigId) {
  const record = _rigs.get(rigId);
  if (!record) return { valid: false, errors: [`Rig "${rigId}" not found.`], warnings: [] };
  if (record.status === RIG_STATUS.UNLOADED || record.status === RIG_STATUS.LOADING)
    return { valid: false, errors: [`Rig "${rigId}" not yet loaded.`], warnings: [] };
  if (record.status === RIG_STATUS.FAILED)
    return { valid: false, errors: [`Rig "${rigId}" failed: ${record.error}`], warnings: [] };

  const errors = [], warnings = [];

  if (record.config.validateBones) {
    for (const b of REQUIRED_BONES)
      if (!record.bones.includes(b)) errors.push(`Missing bone: "${b}".`);
  }
  if (record.config.validateMorphs) {
    for (const m of REQUIRED_MORPH_MESHES)
      if (!record.morphMeshes.includes(m)) warnings.push(`Missing morph mesh: "${m}".`);
  }
  if (!record.scene) errors.push('No scene graph.');

  return { valid: errors.length === 0, errors, warnings };
}

export function unloadRig(rigId, clearCache = false) {
  const record = _rigs.get(rigId);
  if (!record) return false;
  record.status = RIG_STATUS.UNLOADING;
  if (record.scene) { _disposeSceneGraph(record.scene); record.scene = null; record.gltf = null; }
  if (clearCache && record.url) _cache.delete(record.url);
  _rigs.delete(rigId);
  RigLogger.info(`[RigLoader] Rig "${rigId}" unloaded.`);
  return true;
}

export function getLoadedRig(rigId) {
  const r = _rigs.get(rigId); return r ? _snapshot(r) : null;
}
export function getRigScene(rigId) {
  const r = _rigs.get(rigId);
  if (!r || !r.scene) return null;
  if (r.status === RIG_STATUS.FAILED || r.status === RIG_STATUS.UNLOADED) return null;
  return r.scene;
}
export function getAllLoadedRigs() { return Array.from(_rigs.values()).map(_snapshot); }
export function clearRigCache()   { _cache.clear(); }

function _extractBoneNames(scene) {
  const names = [];
  if (!scene) return names;
  const traverse = (obj) => {
    if (obj?.isBone || obj?.type === 'Bone') names.push(obj.name);
    obj?.children?.forEach(traverse);
  };
  traverse(scene); return names;
}
function _extractMorphMeshNames(scene) {
  const names = [];
  if (!scene) return names;
  const traverse = (obj) => {
    if (obj?.isMesh && obj?.morphTargetInfluences?.length > 0) names.push(obj.name);
    obj?.children?.forEach(traverse);
  };
  traverse(scene); return names;
}
function _disposeSceneGraph(obj) {
  if (!obj) return;
  try {
    obj.geometry?.dispose?.();
    const mats = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
    for (const m of mats) { m.map?.dispose?.(); m.dispose?.(); }
    obj.children?.forEach(_disposeSceneGraph);
  } catch (err) { RigLogger.warn(`[RigLoader] Disposal: ${err.message}`); }
}
function _validateLoadConfig(config) {
  const errors = [];
  if (!config?.id  || typeof config.id  !== 'string') errors.push('"id" required.');
  if (!config?.url || typeof config.url !== 'string') errors.push('"url" required.');
  if (config?.url && !config.url.match(/\.(gltf|glb)(\?.*)?$/i))
    errors.push('"url" must be .gltf or .glb.');
  return { valid: errors.length === 0, errors };
}
function _snapshot(r) {
  return {
    id: r.id, url: r.url, status: r.status,
    bones: [...r.bones], morphMeshes: [...r.morphMeshes],
    error: r.error, hasScene: !!r.scene, config: { ...r.config },
    registeredAt: r.registeredAt, loadedAt: r.loadedAt, validatedAt: r.validatedAt,
  };
}

export class RigError extends Error {
  constructor(message, context = {}) {
    super(message); this.name = 'RigError';
    this.context = context; this.timestamp = Date.now();
  }
}
