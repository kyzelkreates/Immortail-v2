// ================================================================
// IMMORTAIL™ — TEXTURE ORCHESTRATION FOUNDATION
// Async loading, caching, mapping, mobile optimization, cleanup.
// NO RANDOM TEXTURE GENERATION. DATA-DRIVEN ONLY.
// ================================================================

import { SystemLogger } from '../utils/logger.js';
const TextureLogger = SystemLogger;

export const TEXTURE_SLOT = {
  COAT_ALBEDO:    'coat_albedo',
  COAT_NORMAL:    'coat_normal',
  COAT_ROUGHNESS: 'coat_roughness',
  COAT_AO:        'coat_ao',
  FUR_DETAIL:     'fur_detail',
  FACE_ALBEDO:    'face_albedo',
  FACE_NORMAL:    'face_normal',
  EYE_ALBEDO:     'eye_albedo',
  EYE_SPECULAR:   'eye_specular',
  NOSE_ALBEDO:    'nose_albedo',
  PAW_ALBEDO:     'paw_albedo',
  TONGUE_ALBEDO:  'tongue_albedo',
  ENV_MAP:        'env_map',
};

export const TEXTURE_STATUS = {
  PENDING: 'pending', LOADING: 'loading', LOADED: 'loaded',
  APPLIED: 'applied', FAILED: 'failed', UNLOADED: 'unloaded',
};

const SUPPORTED_EXTENSIONS = ['.jpg','.jpeg','.png','.webp','.ktx2','.basis','.hdr','.exr'];
const MOBILE_MAX_TEXTURE_SIZE  = 1024;
const DESKTOP_MAX_TEXTURE_SIZE = 4096;

const _textures     = new Map();
const _cache        = new Map();
const _slotMappings = new Map();
let _textureLoaderFn = null;
let _isMobile   = false;
let _maxTexSize = DESKTOP_MAX_TEXTURE_SIZE;

class TextureRecord {
  constructor({ id, url, slot, profileId, metadata }) {
    this.id = id; this.url = url; this.slot = slot;
    this.profileId = profileId || null; this.metadata = metadata || {};
    this.status    = TEXTURE_STATUS.PENDING; this.texture = null; this.error = null;
    this.createdAt = Date.now(); this.loadedAt = null; this.appliedAt = null;
  }
}

export function initializeTextureSystem(options = {}) {
  _isMobile   = options.isMobile ?? _detectMobile();
  _maxTexSize = _isMobile ? MOBILE_MAX_TEXTURE_SIZE : DESKTOP_MAX_TEXTURE_SIZE;
  if (options.loaderFn) _textureLoaderFn = options.loaderFn;
  TextureLogger.info(`[TextureSystem] Initialized — mobile: ${_isMobile}, maxTexSize: ${_maxTexSize}px`);
  return getTextureSystemStatus();
}

export function registerTextureLoader(loaderFn) {
  if (typeof loaderFn !== 'function')
    throw new TextureSystemError('[TextureSystem] loaderFn must be a function.');
  _textureLoaderFn = loaderFn;
}

export async function loadTexture(loadConfig) {
  const v = _validateLoadConfig(loadConfig);
  if (!v.valid) throw new TextureSystemError(`[TextureSystem] loadTexture: ${v.errors.join(' | ')}`);

  const { id, url, slot, profileId, metadata } = loadConfig;

  if (_textures.has(id)) {
    const ex = _textures.get(id);
    if (ex.status === TEXTURE_STATUS.LOADED || ex.status === TEXTURE_STATUS.APPLIED)
      return _snapshot(ex);
  }

  const record = new TextureRecord({ id, url, slot, profileId, metadata });
  record.status = TEXTURE_STATUS.LOADING;
  _textures.set(id, record);

  try {
    let texture;
    if (_cache.has(url)) {
      texture = _cache.get(url);
    } else {
      if (!_textureLoaderFn)
        throw new TextureSystemError('[TextureSystem] No texture loader registered.');
      texture = await _textureLoaderFn(url);
      _cache.set(url, texture);
    }
    record.texture  = texture;
    record.status   = TEXTURE_STATUS.LOADED;
    record.loadedAt = Date.now();
  } catch (err) {
    record.status = TEXTURE_STATUS.FAILED; record.error = err.message;
    throw new TextureSystemError(`[TextureSystem] Failed to load "${id}": ${err.message}`);
  }

  return _snapshot(record);
}

export function applyTextureMap(textureId, material, materialSlot) {
  const record = _textures.get(textureId);
  if (!record) return false;
  if (record.status !== TEXTURE_STATUS.LOADED && record.status !== TEXTURE_STATUS.APPLIED) return false;
  if (!material || typeof material !== 'object') return false;
  if (!record.texture) return false;

  try {
    material[materialSlot] = record.texture;
    if (material.needsUpdate !== undefined) material.needsUpdate = true;
    record.status = TEXTURE_STATUS.APPLIED; record.appliedAt = Date.now();

    if (record.profileId && record.slot) {
      if (!_slotMappings.has(record.profileId)) _slotMappings.set(record.profileId, new Map());
      _slotMappings.get(record.profileId).set(record.slot, record);
    }
    return true;
  } catch (err) {
    TextureLogger.error(`[TextureSystem] applyTextureMap failed: ${err.message}`);
    return false;
  }
}

export function unloadTexture(textureId, clearCache = false) {
  const record = _textures.get(textureId);
  if (!record) return false;
  try { record.texture?.dispose?.(); } catch {}
  if (clearCache && record.url) _cache.delete(record.url);
  if (record.profileId && record.slot) _slotMappings.get(record.profileId)?.delete(record.slot);
  _textures.delete(textureId);
  return true;
}

export function getTextureRecord(textureId) {
  const r = _textures.get(textureId); return r ? _snapshot(r) : null;
}
export function getRawTexture(textureId) {
  return _textures.get(textureId)?.texture || null;
}
export function getProfileSlotMapping(profileId) {
  const slotMap = _slotMappings.get(profileId);
  if (!slotMap) return {};
  const out = {};
  for (const [slot, record] of slotMap)
    out[slot] = { id: record.id, status: record.status, url: record.url };
  return out;
}

export function getTextureSystemStatus() {
  const records = Array.from(_textures.values());
  const summary = {};
  for (const s of Object.values(TEXTURE_STATUS)) summary[s] = records.filter(r => r.status === s).length;
  return { totalTextures: _textures.size, cacheSize: _cache.size, isMobile: _isMobile, maxTexSize: _maxTexSize, statusBreakdown: summary };
}

export function destroyTextureSystem() {
  for (const [, record] of _textures) { try { record.texture?.dispose?.(); } catch {} }
  _textures.clear(); _cache.clear(); _slotMappings.clear();
  TextureLogger.info('[TextureSystem] Destroyed.');
}

function _detectMobile() {
  if (typeof navigator === 'undefined') return false;
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
}

function _validateLoadConfig(config) {
  const errors = [], validSlots = Object.values(TEXTURE_SLOT);
  if (!config?.id  || typeof config.id  !== 'string') errors.push('"id" required.');
  if (!config?.url || typeof config.url !== 'string') errors.push('"url" required.');
  if (config?.url) {
    const lower = config.url.toLowerCase().split('?')[0];
    if (!SUPPORTED_EXTENSIONS.some(ext => lower.endsWith(ext)))
      errors.push(`Unsupported texture format. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}.`);
  }
  if (!config?.slot || !validSlots.includes(config.slot))
    errors.push(`"slot" must be one of: ${validSlots.join(', ')}.`);
  return { valid: errors.length === 0, errors };
}

function _snapshot(r) {
  return {
    id: r.id, url: r.url, slot: r.slot, profileId: r.profileId,
    status: r.status, hasTexture: !!r.texture, error: r.error,
    createdAt: r.createdAt, loadedAt: r.loadedAt, appliedAt: r.appliedAt,
    metadata: { ...r.metadata },
  };
}

export class TextureSystemError extends Error {
  constructor(message, context = {}) {
    super(message); this.name = 'TextureSystemError';
    this.context = context; this.timestamp = Date.now();
  }
}
