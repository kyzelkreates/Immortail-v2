// ================================================================
// IMMORTAIL™ — DOG SERVICE (FOUNDATION)
// Runtime dog state coordination, synchronization, event emission.
// NO PERSONALITY ENGINE. NO BEHAVIORS. NO AI. FOUNDATION ONLY.
// ================================================================

import { SystemLogger }                         from '../utils/logger.js';
import { emit }                                  from '../events/eventBus.js';
import { DOG_EVENTS }                            from '../events/eventTypes.js';
import { getDogState, updateDogState, markDogStateSynced, markDogStateDirty } from '../state/dogState.js';
import { saveEntity, updateEntity, loadEntity }  from './storageService.js';
import { STORE_NAMES }                           from '../storage/schemas.js';

const DogServiceLogger = SystemLogger;

// ----------------------------------------------------------------
// SERVICE STATE
// ----------------------------------------------------------------

let _initialized = false;

// ----------------------------------------------------------------
// INITIALIZE DOG RUNTIME
// ----------------------------------------------------------------

/**
 * Initialize the dog service runtime.
 * Called during boot service registration.
 * @returns {Object} current dog state snapshot
 */
export async function initializeDogRuntime() {
  if (_initialized) {
    DogServiceLogger.warn('[DogService] Already initialized. Skipping.');
    return getDogState();
  }

  DogServiceLogger.info('[DogService] Initializing dog runtime...');

  _initialized = true;

  DogServiceLogger.info('[DogService] Dog runtime initialized.');
  return getDogState();
}

// ----------------------------------------------------------------
// UPDATE DOG RUNTIME STATE
// ----------------------------------------------------------------

/**
 * Update dog runtime state and emit DOG_STATE_UPDATED event.
 * @param {string} dogId
 * @param {Object} patch — partial dog state update
 * @param {string} [source='dogService']
 */
export async function updateDogRuntimeState(dogId, patch, source = 'dogService') {
  if (!dogId || typeof dogId !== 'string') {
    DogServiceLogger.error('[DogService] updateDogRuntimeState: dogId must be a non-empty string.');
    return;
  }
  if (!patch || typeof patch !== 'object') {
    DogServiceLogger.error('[DogService] updateDogRuntimeState: patch must be an object.');
    return;
  }

  DogServiceLogger.info(`[DogService] Updating dog runtime state — id: ${dogId}`);

  updateDogState(patch);
  markDogStateDirty();

  await emit(DOG_EVENTS.DOG_STATE_UPDATED, {
    timestamp: Date.now(),
    dogId,
    source,
    runtimeState: getDogState(),
  });
}

// ----------------------------------------------------------------
// SYNC DOG STATE
// ----------------------------------------------------------------

/**
 * Persist current dog state to storage and emit sync event.
 * @param {string} dogId
 * @param {Object} profileData — full profile to persist
 */
export async function syncDogState(dogId, profileData) {
  if (!dogId || typeof dogId !== 'string') {
    DogServiceLogger.error('[DogService] syncDogState: dogId required.');
    return;
  }
  if (!profileData || typeof profileData !== 'object') {
    DogServiceLogger.error('[DogService] syncDogState: profileData required.');
    return;
  }

  DogServiceLogger.info(`[DogService] Syncing dog state — id: ${dogId}`);

  try {
    const existing = await loadEntity(STORE_NAMES.DOG_PROFILES, dogId);
    const payload  = {
      ...profileData,
      id:        dogId,
      updatedAt: Date.now(),
    };

    if (existing) {
      await updateEntity(STORE_NAMES.DOG_PROFILES, payload);
    } else {
      await saveEntity(STORE_NAMES.DOG_PROFILES, {
        ...payload,
        createdAt: Date.now(),
      });
    }

    markDogStateSynced();

    await emit(DOG_EVENTS.DOG_STATE_UPDATED, {
      timestamp: Date.now(),
      dogId,
      source:       'syncDogState',
      runtimeState: getDogState(),
    });

    DogServiceLogger.info(`[DogService] Dog state synced — id: ${dogId}`);

  } catch (err) {
    DogServiceLogger.error(`[DogService] syncDogState failed: ${err.message}`);
    throw err;
  }
}

// ----------------------------------------------------------------
// LOAD DOG PROFILE
// ----------------------------------------------------------------

/**
 * Load a dog profile from storage and emit DOG_PROFILE_LOADED.
 * @param {string} dogId
 * @returns {Object|null}
 */
export async function loadDogProfile(dogId) {
  if (!dogId) {
    DogServiceLogger.error('[DogService] loadDogProfile: dogId required.');
    return null;
  }

  DogServiceLogger.info(`[DogService] Loading dog profile — id: ${dogId}`);

  try {
    const profile = await loadEntity(STORE_NAMES.DOG_PROFILES, dogId);

    if (profile) {
      await emit(DOG_EVENTS.DOG_PROFILE_LOADED, {
        timestamp: Date.now(),
        dogId,
        name:      profile.name || 'unknown',
      });
    }

    return profile;
  } catch (err) {
    DogServiceLogger.error(`[DogService] loadDogProfile failed: ${err.message}`);
    return null;
  }
}

// ----------------------------------------------------------------
// SERVICE STATUS
// ----------------------------------------------------------------

export function getDogServiceStatus() {
  return {
    initialized: _initialized,
    dogState:    getDogState(),
  };
}
