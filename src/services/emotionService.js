// ================================================================
// IMMORTAIL™ — EMOTION SERVICE (FOUNDATION)
// Emotion synchronization layer. Runtime-safe emotion workflows.
// NO EMOTION ENGINE. EVENT COORDINATION FOUNDATION ONLY.
// ================================================================

import { SystemLogger }                        from '../utils/logger.js';
import { emit }                                 from '../events/eventBus.js';
import { EMOTION_EVENTS }                       from '../events/eventTypes.js';
import { getDogState, updateDogState }          from '../state/dogState.js';
import { saveEntity, updateEntity, loadEntity } from './storageService.js';
import { STORE_NAMES }                          from '../storage/schemas.js';

const EmotionServiceLogger = SystemLogger;

// ----------------------------------------------------------------
// ALLOWED EMOTION TYPES
// ----------------------------------------------------------------

const EMOTION_TYPES = [
  'joy', 'calm', 'curious', 'playful', 'anxious',
  'lonely', 'tired', 'excited', 'loving', 'neutral',
];

// ----------------------------------------------------------------
// UPDATE EMOTION SNAPSHOT
// ----------------------------------------------------------------

/**
 * Update the runtime emotion snapshot and optionally persist it.
 * @param {Object} emotionData
 * @param {string} emotionData.id
 * @param {string} emotionData.profileId
 * @param {string} emotionData.type          — must be in EMOTION_TYPES
 * @param {number} emotionData.intensity     — 0.0–1.0
 * @param {Object} [emotionData.context]
 * @param {boolean} [persist=false]          — whether to write to storage
 * @returns {Object} persisted or runtime record
 */
export async function updateEmotionSnapshot(emotionData, persist = false) {
  const validation = validateEmotionState(emotionData);
  if (!validation.valid) {
    const err = `[EmotionService] updateEmotionSnapshot validation failed: ${validation.errors.join(' | ')}`;
    EmotionServiceLogger.error(err);
    throw new Error(err);
  }

  const { id, profileId, type, intensity, context } = emotionData;
  const now = Date.now();

  EmotionServiceLogger.info(
    `[EmotionService] Updating emotion snapshot — type: ${type}, intensity: ${intensity}`
  );

  // Update runtime dog state emotion snapshot
  updateDogState({
    emotion: {
      current:    type,
      intensity,
      recordedAt: now,
    },
  });

  const record = {
    id,
    profileId,
    type,
    intensity,
    recordedAt: now,
    context:    context || {},
  };

  // Persist only if requested
  if (persist) {
    try {
      const existing = await loadEntity(STORE_NAMES.EMOTIONS, id);
      if (existing) {
        await updateEntity(STORE_NAMES.EMOTIONS, record);
      } else {
        await saveEntity(STORE_NAMES.EMOTIONS, record);
      }
      EmotionServiceLogger.info(`[EmotionService] Emotion persisted — id: ${id}`);
    } catch (err) {
      EmotionServiceLogger.error(`[EmotionService] Failed to persist emotion: ${err.message}`);
    }
  }

  await emit(EMOTION_EVENTS.EMOTION_CHANGED, {
    timestamp:   now,
    profileId,
    emotionType: type,
    intensity,
  });

  return record;
}

// ----------------------------------------------------------------
// SYNC EMOTION RUNTIME
// ----------------------------------------------------------------

/**
 * Sync the current runtime emotion snapshot to storage.
 * @param {string} profileId
 * @returns {boolean} success
 */
export async function syncEmotionRuntime(profileId) {
  if (!profileId || typeof profileId !== 'string') {
    EmotionServiceLogger.error('[EmotionService] syncEmotionRuntime: profileId required.');
    return false;
  }

  const dogState = getDogState();
  const emotion  = dogState.emotion;

  if (!emotion.current) {
    EmotionServiceLogger.info('[EmotionService] No active emotion to sync.');
    return false;
  }

  EmotionServiceLogger.info(`[EmotionService] Syncing emotion runtime for profile: ${profileId}`);

  try {
    const syncId = `${profileId}_emotion_sync`;
    const record = {
      id:         syncId,
      profileId,
      type:       emotion.current,
      intensity:  emotion.intensity,
      recordedAt: emotion.recordedAt || Date.now(),
      context:    {},
    };

    const existing = await loadEntity(STORE_NAMES.EMOTIONS, syncId);
    if (existing) {
      await updateEntity(STORE_NAMES.EMOTIONS, record);
    } else {
      await saveEntity(STORE_NAMES.EMOTIONS, record);
    }

    await emit(EMOTION_EVENTS.EMOTION_SYNCED, {
      timestamp: Date.now(),
      profileId,
    });

    EmotionServiceLogger.info(`[EmotionService] Emotion synced for profile: ${profileId}`);
    return true;

  } catch (err) {
    EmotionServiceLogger.error(`[EmotionService] syncEmotionRuntime failed: ${err.message}`);
    return false;
  }
}

// ----------------------------------------------------------------
// VALIDATE EMOTION STATE
// ----------------------------------------------------------------

/**
 * @param {Object} state
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateEmotionState(state) {
  const errors = [];

  if (!state || typeof state !== 'object') {
    errors.push('Emotion state must be a plain object.');
    return { valid: false, errors };
  }

  if (!state.id || typeof state.id !== 'string') {
    errors.push('Field "id" is required and must be a string.');
  }
  if (!state.profileId || typeof state.profileId !== 'string') {
    errors.push('Field "profileId" is required and must be a string.');
  }
  if (!state.type || !EMOTION_TYPES.includes(state.type)) {
    errors.push(
      `Field "type" must be one of: ${EMOTION_TYPES.join(', ')}. Got: "${state.type}".`
    );
  }
  if (
    typeof state.intensity !== 'number' ||
    state.intensity < 0 ||
    state.intensity > 1
  ) {
    errors.push('Field "intensity" must be a number between 0.0 and 1.0.');
  }

  return { valid: errors.length === 0, errors };
}

// ----------------------------------------------------------------
// SERVICE STATUS
// ----------------------------------------------------------------

export function getEmotionServiceStatus() {
  const dogState = getDogState();
  return {
    currentEmotion: dogState.emotion?.current   || null,
    intensity:      dogState.emotion?.intensity || 0,
    recordedAt:     dogState.emotion?.recordedAt || null,
  };
}
