// ================================================================
// IMMORTAIL™ — MEDIA SERVICE (FOUNDATION)
// Media orchestration structure. Upload workflow prep.
// NO ANALYSIS. NO UPLOAD PIPELINE. FOUNDATION ONLY.
// ================================================================

import { SystemLogger }              from '../utils/logger.js';
import { emit }                       from '../events/eventBus.js';
import { MEDIA_EVENTS }               from '../events/eventTypes.js';
import { saveEntity, loadEntity }     from './storageService.js';
import { STORE_NAMES }                from '../storage/schemas.js';

const MediaServiceLogger = SystemLogger;

// ----------------------------------------------------------------
// SERVICE STATE
// ----------------------------------------------------------------

let _initialized    = false;
let _runtimeAssets  = new Map(); // mediaId → asset metadata (runtime only)

// ----------------------------------------------------------------
// ALLOWED MEDIA TYPES
// ----------------------------------------------------------------

const ALLOWED_MEDIA_TYPES = ['image', 'video', 'audio', 'document', 'model'];

// ----------------------------------------------------------------
// INITIALIZE MEDIA RUNTIME
// ----------------------------------------------------------------

/**
 * Initialize the media service runtime coordination layer.
 * @returns {{ initialized: boolean }}
 */
export async function initializeMediaRuntime() {
  if (_initialized) {
    MediaServiceLogger.warn('[MediaService] Already initialized. Skipping.');
    return { initialized: true };
  }

  MediaServiceLogger.info('[MediaService] Initializing media runtime...');

  _initialized = true;

  MediaServiceLogger.info('[MediaService] Media runtime initialized (foundation — no pipeline active).');
  return { initialized: true };
}

// ----------------------------------------------------------------
// REGISTER MEDIA ASSET
// ----------------------------------------------------------------

/**
 * Register a media asset reference in runtime and persist metadata.
 * Does NOT handle uploads or binary data — structure only.
 * @param {Object} assetMeta
 * @param {string} assetMeta.id
 * @param {string} assetMeta.profileId
 * @param {string} assetMeta.type        — must be in ALLOWED_MEDIA_TYPES
 * @param {string} assetMeta.mimeType
 * @param {number} [assetMeta.size]
 * @param {Object} [assetMeta.metadata]
 * @returns {string} mediaId
 */
export async function registerMediaAsset(assetMeta) {
  const validation = validateMediaPayload(assetMeta);
  if (!validation.valid) {
    const err = `[MediaService] registerMediaAsset validation failed: ${validation.errors.join(' | ')}`;
    MediaServiceLogger.error(err);
    throw new Error(err);
  }

  const { id, profileId, type, mimeType, size, metadata } = assetMeta;
  const now = Date.now();

  MediaServiceLogger.info(`[MediaService] Registering media asset — id: ${id}, type: ${type}`);

  const record = {
    id,
    profileId,
    type,
    mimeType:   mimeType || 'application/octet-stream',
    size:       size || 0,
    uploadedAt: now,
    metadata:   metadata || {},
  };

  // Persist to storage
  await saveEntity(STORE_NAMES.MEDIA, record);

  // Register in runtime map
  _runtimeAssets.set(id, { ...record, registeredAt: now });

  await emit(MEDIA_EVENTS.MEDIA_UPLOADED, {
    timestamp: now,
    mediaId:   id,
    profileId,
    type,
  });

  MediaServiceLogger.info(`[MediaService] Media asset registered — id: ${id}`);
  return id;
}

// ----------------------------------------------------------------
// VALIDATE MEDIA PAYLOAD
// ----------------------------------------------------------------

/**
 * Validate a media asset payload before registration.
 * @param {Object} payload
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateMediaPayload(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object') {
    errors.push('Payload must be a plain object.');
    return { valid: false, errors };
  }

  if (!payload.id || typeof payload.id !== 'string') {
    errors.push('Field "id" is required and must be a string.');
  }
  if (!payload.profileId || typeof payload.profileId !== 'string') {
    errors.push('Field "profileId" is required and must be a string.');
  }
  if (!payload.type || !ALLOWED_MEDIA_TYPES.includes(payload.type)) {
    errors.push(
      `Field "type" must be one of: ${ALLOWED_MEDIA_TYPES.join(', ')}. Got: "${payload.type}".`
    );
  }

  return { valid: errors.length === 0, errors };
}

// ----------------------------------------------------------------
// GET RUNTIME ASSET
// ----------------------------------------------------------------

export function getRuntimeAsset(mediaId) {
  return _runtimeAssets.get(mediaId) || null;
}

export function getAllRuntimeAssets() {
  return Array.from(_runtimeAssets.values());
}

// ----------------------------------------------------------------
// SERVICE STATUS
// ----------------------------------------------------------------

export function getMediaServiceStatus() {
  return {
    initialized:  _initialized,
    runtimeAssets: _runtimeAssets.size,
  };
}
