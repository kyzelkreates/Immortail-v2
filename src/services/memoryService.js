// ================================================================
// IMMORTAIL™ — MEMORY SERVICE (FOUNDATION)
// Memory orchestration layer. Persistence coordination.
// NO MEMORY ENGINE. EVENT-SAFE FOUNDATION ONLY.
// ================================================================

import { SystemLogger }                        from '../utils/logger.js';
import { emit }                                 from '../events/eventBus.js';
import { MEMORY_EVENTS }                        from '../events/eventTypes.js';
import { saveEntity, updateEntity, loadEntity, queryEntities } from './storageService.js';
import { STORE_NAMES }                          from '../storage/schemas.js';

const MemoryServiceLogger = SystemLogger;

// ----------------------------------------------------------------
// ALLOWED MEMORY TYPES
// ----------------------------------------------------------------

const MEMORY_TYPES = ['experience', 'behavioral', 'contextual', 'emotional', 'routine', 'manual'];

// ----------------------------------------------------------------
// CREATE MEMORY REFERENCE
// ----------------------------------------------------------------

/**
 * Create and persist a new memory reference.
 * @param {Object} memoryData
 * @param {string} memoryData.id
 * @param {string} memoryData.profileId
 * @param {string} memoryData.type       — must be in MEMORY_TYPES
 * @param {*}      memoryData.content
 * @param {string[]} [memoryData.tags]
 * @returns {string} memoryId
 */
export async function createMemoryReference(memoryData) {
  const validation = validateMemoryPayload(memoryData);
  if (!validation.valid) {
    const err = `[MemoryService] createMemoryReference validation failed: ${validation.errors.join(' | ')}`;
    MemoryServiceLogger.error(err);
    throw new Error(err);
  }

  const { id, profileId, type, content, tags } = memoryData;
  const now = Date.now();

  MemoryServiceLogger.info(`[MemoryService] Creating memory reference — id: ${id}, type: ${type}`);

  const record = {
    id,
    profileId,
    type,
    content,
    tags:      tags || [],
    createdAt: now,
    updatedAt: now,
  };

  await saveEntity(STORE_NAMES.MEMORIES, record);

  await emit(MEMORY_EVENTS.MEMORY_CREATED, {
    timestamp: now,
    memoryId:  id,
    profileId,
  });

  MemoryServiceLogger.info(`[MemoryService] Memory reference created — id: ${id}`);
  return id;
}

// ----------------------------------------------------------------
// LOAD MEMORY REFERENCE
// ----------------------------------------------------------------

/**
 * Load a single memory record by id.
 * @param {string} memoryId
 * @returns {Object|null}
 */
export async function loadMemoryReference(memoryId) {
  if (!memoryId || typeof memoryId !== 'string') {
    MemoryServiceLogger.error('[MemoryService] loadMemoryReference: memoryId required.');
    return null;
  }

  MemoryServiceLogger.info(`[MemoryService] Loading memory reference — id: ${memoryId}`);

  try {
    const record = await loadEntity(STORE_NAMES.MEMORIES, memoryId);
    return record;
  } catch (err) {
    MemoryServiceLogger.error(`[MemoryService] loadMemoryReference failed: ${err.message}`);
    return null;
  }
}

// ----------------------------------------------------------------
// UPDATE MEMORY REFERENCE
// ----------------------------------------------------------------

/**
 * Update an existing memory record.
 * @param {string} memoryId
 * @param {Object} patch
 * @returns {string} memoryId
 */
export async function updateMemoryReference(memoryId, patch) {
  if (!memoryId || typeof memoryId !== 'string') {
    throw new Error('[MemoryService] updateMemoryReference: memoryId required.');
  }

  const existing = await loadMemoryReference(memoryId);
  if (!existing) {
    throw new Error(`[MemoryService] Memory "${memoryId}" not found.`);
  }

  const now = Date.now();
  const updated = { ...existing, ...patch, id: memoryId, updatedAt: now };

  await updateEntity(STORE_NAMES.MEMORIES, updated);

  await emit(MEMORY_EVENTS.MEMORY_UPDATED, {
    timestamp: now,
    memoryId,
    profileId: existing.profileId,
  });

  MemoryServiceLogger.info(`[MemoryService] Memory updated — id: ${memoryId}`);
  return memoryId;
}

// ----------------------------------------------------------------
// RESTORE MEMORIES FOR PROFILE
// ----------------------------------------------------------------

/**
 * Load all memories for a profile from storage and emit restore event.
 * @param {string} profileId
 * @returns {Object[]}
 */
export async function restoreMemoriesForProfile(profileId) {
  if (!profileId) {
    MemoryServiceLogger.error('[MemoryService] restoreMemoriesForProfile: profileId required.');
    return [];
  }

  MemoryServiceLogger.info(`[MemoryService] Restoring memories for profile: ${profileId}`);

  try {
    const records = await queryEntities(STORE_NAMES.MEMORIES, {
      indexName:  'by_profileId',
      indexValue: profileId,
    });

    await emit(MEMORY_EVENTS.MEMORY_RESTORED, {
      timestamp: Date.now(),
      profileId,
      count:     records.length,
    });

    MemoryServiceLogger.info(
      `[MemoryService] ${records.length} memories restored for profile: ${profileId}`
    );
    return records;
  } catch (err) {
    MemoryServiceLogger.error(`[MemoryService] restoreMemoriesForProfile failed: ${err.message}`);
    return [];
  }
}

// ----------------------------------------------------------------
// VALIDATE MEMORY PAYLOAD
// ----------------------------------------------------------------

/**
 * @param {Object} payload
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateMemoryPayload(payload) {
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
  if (!payload.type || !MEMORY_TYPES.includes(payload.type)) {
    errors.push(
      `Field "type" must be one of: ${MEMORY_TYPES.join(', ')}. Got: "${payload.type}".`
    );
  }
  if (payload.content === undefined || payload.content === null) {
    errors.push('Field "content" is required.');
  }

  return { valid: errors.length === 0, errors };
}
