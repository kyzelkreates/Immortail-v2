// ================================================================
// IMMORTAIL™ — UPLOAD PIPELINE (CENTRAL MEDIA INGESTION)
// Upload intake, validation, normalization, queue orchestration.
// NO AI GENERATION. NO COMPANION STATE MUTATION. PIPELINE ONLY.
// ================================================================

import { SystemLogger }    from '../utils/logger.js';
import { emit }             from '../events/eventBus.js';
import { MEDIA_EVENTS }     from '../events/eventTypes.js';
import {
  registerMediaAsset,
  validateMediaPayload,
} from '../services/mediaService.js';

const PipelineLogger = SystemLogger;

// ----------------------------------------------------------------
// CONSTANTS
// ----------------------------------------------------------------

export const UPLOAD_STATUS = {
  QUEUED:     'queued',
  VALIDATING: 'validating',
  PROCESSING: 'processing',
  COMPLETED:  'completed',
  FAILED:     'failed',
  CANCELLED:  'cancelled',
};

export const SUPPORTED_MIME = {
  image: [
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'image/heif', 'image/tiff', 'image/bmp',
  ],
  video: [
    'video/mp4', 'video/quicktime', 'video/x-msvideo',
    'video/webm', 'video/3gpp',
  ],
  audio: [
    'audio/mpeg', 'audio/wav', 'audio/ogg',
    'audio/flac', 'audio/aac', 'audio/webm',
  ],
};

const MAX_FILE_SIZE = {
  image: 50  * 1024 * 1024,   // 50 MB
  video: 500 * 1024 * 1024,   // 500 MB
  audio: 100 * 1024 * 1024,   // 100 MB
};

const MAX_QUEUE_SIZE = 50;
const MAX_RETRIES    = 3;

// ----------------------------------------------------------------
// UPLOAD RECORD
// ----------------------------------------------------------------

class UploadRecord {
  constructor({ id, profileId, mediaType, mimeType, fileName, fileSize, metadata }) {
    this.id          = id;
    this.profileId   = profileId;
    this.mediaType   = mediaType;   // 'image' | 'video' | 'audio'
    this.mimeType    = mimeType;
    this.fileName    = fileName   || 'unknown';
    this.fileSize    = fileSize   || 0;
    this.metadata    = metadata   || {};
    this.status      = UPLOAD_STATUS.QUEUED;
    this.retryCount  = 0;
    this.error       = null;
    this.queuedAt    = Date.now();
    this.startedAt   = null;
    this.completedAt = null;
    this.processingResult = null;
  }
}

// ----------------------------------------------------------------
// INTERNAL PIPELINE STATE
// ----------------------------------------------------------------

let _initialized = false;

/** @type {Map<string, UploadRecord>} uploadId → record */
const _queue = new Map();

/** @type {Set<string>} checksums of seen uploads (deduplication) */
const _seenChecksums = new Set();

/** @type {Map<string, Function>} uploadId → processor fn */
const _processors = new Map();

// ----------------------------------------------------------------
// INITIALIZE UPLOAD PIPELINE
// ----------------------------------------------------------------

export function initializeUploadPipeline() {
  if (_initialized) {
    PipelineLogger.warn('[UploadPipeline] Already initialized. Skipping.');
    return getPipelineStatus();
  }

  _initialized = true;
  PipelineLogger.info('[UploadPipeline] Media ingestion pipeline initialized.');
  return getPipelineStatus();
}

// ----------------------------------------------------------------
// REGISTER UPLOAD
// ----------------------------------------------------------------

/**
 * Register a new media upload into the pipeline.
 * Performs upfront validation and enqueues for processing.
 * @param {Object} uploadConfig
 * @param {string} uploadConfig.id
 * @param {string} uploadConfig.profileId
 * @param {string} uploadConfig.mediaType    — 'image' | 'video' | 'audio'
 * @param {string} uploadConfig.mimeType
 * @param {string} [uploadConfig.fileName]
 * @param {number} [uploadConfig.fileSize]
 * @param {string} [uploadConfig.checksum]   — optional deduplication hash
 * @param {Object} [uploadConfig.metadata]
 * @returns {Promise<Object>} upload record snapshot
 */
export async function registerUpload(uploadConfig) {
  _assertInitialized();

  if (_queue.size >= MAX_QUEUE_SIZE) {
    throw new UploadPipelineError(
      `[UploadPipeline] Queue full (${MAX_QUEUE_SIZE}). Cannot register new upload.`
    );
  }

  // Validate the upload
  const validation = validateMediaUpload(uploadConfig);
  if (!validation.valid) {
    throw new UploadPipelineError(
      `[UploadPipeline] registerUpload validation failed: ${validation.errors.join(' | ')}`
    );
  }

  // Deduplication check
  if (uploadConfig.checksum) {
    if (_seenChecksums.has(uploadConfig.checksum)) {
      PipelineLogger.warn(
        `[UploadPipeline] Duplicate upload detected (checksum: ${uploadConfig.checksum}). ` +
        `Returning existing record reference.`
      );
      const existing = Array.from(_queue.values()).find(
        (r) => r.metadata?.checksum === uploadConfig.checksum
      );
      if (existing) return _snapshotRecord(existing);
    }
    _seenChecksums.add(uploadConfig.checksum);
  }

  const record = new UploadRecord({
    ...uploadConfig,
    metadata: {
      ...uploadConfig.metadata,
      ...(uploadConfig.checksum ? { checksum: uploadConfig.checksum } : {}),
    },
  });

  _queue.set(record.id, record);

  PipelineLogger.info(
    `[UploadPipeline] Upload registered — id: ${record.id}, ` +
    `type: ${record.mediaType}, size: ${_formatSize(record.fileSize)}`
  );

  await emit(MEDIA_EVENTS.MEDIA_UPLOADED, {
    timestamp: Date.now(),
    mediaId:   record.id,
    profileId: record.profileId,
    type:      record.mediaType,
  });

  return _snapshotRecord(record);
}

// ----------------------------------------------------------------
// VALIDATE MEDIA UPLOAD
// ----------------------------------------------------------------

/**
 * Full validation of an upload config before queueing.
 * @param {Object} config
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateMediaUpload(config) {
  const errors = [];

  if (!config || typeof config !== 'object') {
    errors.push('Upload config must be a plain object.');
    return { valid: false, errors };
  }

  if (!config.id || typeof config.id !== 'string') {
    errors.push('Field "id" must be a non-empty string.');
  }
  if (!config.profileId || typeof config.profileId !== 'string') {
    errors.push('Field "profileId" must be a non-empty string.');
  }

  const validTypes = Object.keys(SUPPORTED_MIME);
  if (!config.mediaType || !validTypes.includes(config.mediaType)) {
    errors.push(`Field "mediaType" must be one of: ${validTypes.join(', ')}.`);
  }

  if (config.mediaType && validTypes.includes(config.mediaType)) {
    const allowed = SUPPORTED_MIME[config.mediaType] || [];
    if (!config.mimeType || !allowed.includes(config.mimeType)) {
      errors.push(
        `Field "mimeType" "${config.mimeType}" not supported for type "${config.mediaType}". ` +
        `Supported: ${allowed.join(', ')}.`
      );
    }

    const maxSize = MAX_FILE_SIZE[config.mediaType];
    if (config.fileSize !== undefined && config.fileSize > maxSize) {
      errors.push(
        `File size ${_formatSize(config.fileSize)} exceeds max ` +
        `${_formatSize(maxSize)} for type "${config.mediaType}".`
      );
    }
    if (config.fileSize !== undefined && config.fileSize <= 0) {
      errors.push('File size must be greater than 0.');
    }
  }

  return { valid: errors.length === 0, errors };
}

// ----------------------------------------------------------------
// QUEUE MEDIA PROCESSING
// ----------------------------------------------------------------

/**
 * Advance an upload into the processing pipeline.
 * Registers a processing handler and begins async execution.
 * @param {string}   uploadId
 * @param {Function} processorFn — async (record) => processingResult
 * @returns {Promise<Object>} final upload record snapshot
 */
export async function queueMediaProcessing(uploadId, processorFn) {
  _assertInitialized();

  const record = _requireRecord(uploadId);

  if (record.status === UPLOAD_STATUS.COMPLETED) {
    PipelineLogger.warn(`[UploadPipeline] Upload "${uploadId}" already completed.`);
    return _snapshotRecord(record);
  }
  if (record.status === UPLOAD_STATUS.CANCELLED) {
    throw new UploadPipelineError(`[UploadPipeline] Upload "${uploadId}" has been cancelled.`);
  }
  if (typeof processorFn !== 'function') {
    throw new UploadPipelineError('[UploadPipeline] queueMediaProcessing: processorFn must be a function.');
  }

  _processors.set(uploadId, processorFn);
  record.status    = UPLOAD_STATUS.VALIDATING;
  record.startedAt = Date.now();

  PipelineLogger.info(`[UploadPipeline] Processing queued — id: ${uploadId}`);

  // Execute async (non-blocking)
  _executeProcessing(record).catch((err) => {
    PipelineLogger.error(`[UploadPipeline] Processing error for "${uploadId}": ${err.message}`);
  });

  return _snapshotRecord(record);
}

// ----------------------------------------------------------------
// CANCEL MEDIA PROCESSING
// ----------------------------------------------------------------

/**
 * Cancel a queued or in-progress upload.
 * @param {string} uploadId
 * @returns {boolean}
 */
export function cancelMediaProcessing(uploadId) {
  const record = _queue.get(uploadId);
  if (!record) {
    PipelineLogger.warn(`[UploadPipeline] cancelMediaProcessing: "${uploadId}" not found.`);
    return false;
  }

  const terminalStates = [UPLOAD_STATUS.COMPLETED, UPLOAD_STATUS.FAILED, UPLOAD_STATUS.CANCELLED];
  if (terminalStates.includes(record.status)) {
    PipelineLogger.warn(
      `[UploadPipeline] Upload "${uploadId}" already in terminal state: ${record.status}.`
    );
    return false;
  }

  record.status      = UPLOAD_STATUS.CANCELLED;
  record.completedAt = Date.now();

  _processors.delete(uploadId);

  PipelineLogger.info(`[UploadPipeline] Upload "${uploadId}" cancelled.`);
  return true;
}

// ----------------------------------------------------------------
// GET UPLOAD RECORD
// ----------------------------------------------------------------

export function getUploadRecord(uploadId) {
  const record = _queue.get(uploadId);
  return record ? _snapshotRecord(record) : null;
}

export function getAllUploadRecords(filterStatus = null) {
  const all = Array.from(_queue.values());
  if (!filterStatus) return all.map(_snapshotRecord);
  return all.filter((r) => r.status === filterStatus).map(_snapshotRecord);
}

// ----------------------------------------------------------------
// PIPELINE STATUS
// ----------------------------------------------------------------

export function getPipelineStatus() {
  const records = Array.from(_queue.values());
  const summary  = {};
  for (const s of Object.values(UPLOAD_STATUS)) {
    summary[s] = records.filter((r) => r.status === s).length;
  }
  return {
    initialized:    _initialized,
    queueSize:      _queue.size,
    seenChecksums:  _seenChecksums.size,
    statusBreakdown: summary,
  };
}

// ----------------------------------------------------------------
// INTERNAL: Execute processing with retry
// ----------------------------------------------------------------

async function _executeProcessing(record) {
  const processorFn = _processors.get(record.id);
  if (!processorFn) return;

  record.status = UPLOAD_STATUS.PROCESSING;
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (record.status === UPLOAD_STATUS.CANCELLED) return;

    try {
      if (attempt > 0) {
        PipelineLogger.warn(
          `[UploadPipeline] Retry ${attempt}/${MAX_RETRIES} for upload "${record.id}".`
        );
        record.retryCount = attempt;
      }

      const result = await processorFn(record);

      record.status           = UPLOAD_STATUS.COMPLETED;
      record.completedAt      = Date.now();
      record.processingResult = result || {};
      _processors.delete(record.id);

      PipelineLogger.info(
        `[UploadPipeline] Upload "${record.id}" COMPLETED ` +
        `(${record.completedAt - record.startedAt}ms, attempt ${attempt + 1}).`
      );

      await emit(MEDIA_EVENTS.MEDIA_ANALYZED, {
        timestamp: Date.now(),
        mediaId:   record.id,
      });

      return;

    } catch (err) {
      lastError = err;
      PipelineLogger.warn(
        `[UploadPipeline] Attempt ${attempt + 1} failed for "${record.id}": ${err.message}`
      );
    }
  }

  // All retries exhausted
  record.status      = UPLOAD_STATUS.FAILED;
  record.error       = lastError?.message || 'unknown';
  record.completedAt = Date.now();
  _processors.delete(record.id);

  PipelineLogger.error(
    `[UploadPipeline] Upload "${record.id}" FAILED after ${MAX_RETRIES + 1} attempts: ${record.error}`
  );
}

// ----------------------------------------------------------------
// INTERNAL HELPERS
// ----------------------------------------------------------------

function _snapshotRecord(record) {
  return {
    id:               record.id,
    profileId:        record.profileId,
    mediaType:        record.mediaType,
    mimeType:         record.mimeType,
    fileName:         record.fileName,
    fileSize:         record.fileSize,
    status:           record.status,
    retryCount:       record.retryCount,
    error:            record.error,
    queuedAt:         record.queuedAt,
    startedAt:        record.startedAt,
    completedAt:      record.completedAt,
    processingResult: record.processingResult,
    metadata:         { ...record.metadata },
  };
}

function _requireRecord(uploadId) {
  const record = _queue.get(uploadId);
  if (!record) {
    throw new UploadPipelineError(
      `[UploadPipeline] Upload "${uploadId}" not found. Call registerUpload() first.`
    );
  }
  return record;
}

function _formatSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(1)} ${units[i]}`;
}

function _assertInitialized() {
  if (!_initialized) {
    throw new UploadPipelineError(
      '[UploadPipeline] Not initialized. Call initializeUploadPipeline() first.'
    );
  }
}

// ----------------------------------------------------------------
// UPLOAD PIPELINE ERROR
// ----------------------------------------------------------------

export class UploadPipelineError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name      = 'UploadPipelineError';
    this.context   = context;
    this.timestamp = Date.now();
  }
}
