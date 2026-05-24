// ================================================================
// IMMORTAIL™ — PERSONALITY ENGINE (FOUNDATION)
// Trait management, state orchestration, deterministic evolution.
// NO AI INFERENCE. NO RENDERING. NO UI. DATA ONLY.
// ================================================================

import { SystemLogger }          from '../utils/logger.js';
import { emit }                   from '../events/eventBus.js';
import { DOG_EVENTS }             from '../events/eventTypes.js';

const PersonalityLogger = SystemLogger;

// ----------------------------------------------------------------
// TRAIT BOUNDS
// All personality traits are clamped to [0.0, 1.0]
// ----------------------------------------------------------------

const TRAIT_MIN = 0.0;
const TRAIT_MAX = 1.0;

// ----------------------------------------------------------------
// TRAIT KEYS
// ----------------------------------------------------------------

export const PERSONALITY_TRAIT = {
  TEMPERAMENT:        'temperament',       // 0=calm, 1=spirited
  AFFECTION:          'affection',         // 0=aloof, 1=very affectionate
  ENERGY:             'energy',            // 0=low, 1=high energy
  CURIOSITY:          'curiosity',         // 0=uninterested, 1=highly curious
  SOCIAL_COMFORT:     'socialComfort',     // 0=anxious, 1=very comfortable
  ROUTINE_PREFERENCE: 'routinePreference', // 0=spontaneous, 1=strongly routine
  BONDING_SENSITIVITY:'bondingSensitivity',// 0=independent, 1=deeply bonded
};

// ----------------------------------------------------------------
// DEFAULT PERSONALITY PROFILE
// ----------------------------------------------------------------

const DEFAULT_PERSONALITY = {
  [PERSONALITY_TRAIT.TEMPERAMENT]:         0.5,
  [PERSONALITY_TRAIT.AFFECTION]:           0.5,
  [PERSONALITY_TRAIT.ENERGY]:              0.5,
  [PERSONALITY_TRAIT.CURIOSITY]:           0.5,
  [PERSONALITY_TRAIT.SOCIAL_COMFORT]:      0.5,
  [PERSONALITY_TRAIT.ROUTINE_PREFERENCE]:  0.5,
  [PERSONALITY_TRAIT.BONDING_SENSITIVITY]: 0.5,
};

// ----------------------------------------------------------------
// INTERNAL STATE
// ----------------------------------------------------------------

/** @type {Map<string, PersonalityProfile>} profileId → profile */
const _profiles = new Map();

class PersonalityProfile {
  constructor(profileId, traits = {}) {
    this.profileId   = profileId;
    this.traits      = { ...DEFAULT_PERSONALITY, ...traits };
    this.version     = 1;
    this.createdAt   = Date.now();
    this.updatedAt   = Date.now();
    this.evolutionLog = [];
  }
}

// ----------------------------------------------------------------
// INITIALIZE PERSONALITY PROFILE
// ----------------------------------------------------------------

/**
 * Initialize or restore a personality profile.
 * @param {string} profileId
 * @param {Object} [initialTraits] — optional seed values (will be clamped)
 * @returns {Object} personality snapshot
 */
export function initializePersonalityProfile(profileId, initialTraits = {}) {
  if (!profileId || typeof profileId !== 'string') {
    throw new PersonalityError('[PersonalityEngine] initializePersonalityProfile: profileId required.');
  }

  if (_profiles.has(profileId)) {
    PersonalityLogger.warn(
      `[PersonalityEngine] Profile "${profileId}" already initialized. Returning existing.`
    );
    return getPersonalitySnapshot(profileId);
  }

  const clampedTraits = _clampTraits(initialTraits);
  const profile       = new PersonalityProfile(profileId, clampedTraits);

  _profiles.set(profileId, profile);

  PersonalityLogger.info(
    `[PersonalityEngine] Personality profile initialized — profileId: ${profileId}`
  );

  return getPersonalitySnapshot(profileId);
}

// ----------------------------------------------------------------
// UPDATE PERSONALITY STATE
// ----------------------------------------------------------------

/**
 * Apply a deterministic update to one or more personality traits.
 * All values are clamped. All updates are logged for evolution history.
 * @param {string} profileId
 * @param {Object} traitPatch — { [PERSONALITY_TRAIT]: number }
 * @param {string} [source='manual']
 * @returns {Object} updated snapshot
 */
export async function updatePersonalityState(profileId, traitPatch, source = 'manual') {
  const profile = _requireProfile(profileId);

  const validation = validatePersonalityProfile({ ...profile.traits, ...traitPatch });
  if (!validation.valid) {
    throw new PersonalityError(
      `[PersonalityEngine] updatePersonalityState validation failed: ${validation.errors.join(' | ')}`
    );
  }

  const prev  = { ...profile.traits };
  const patch = _clampTraits(traitPatch);

  profile.traits    = { ...profile.traits, ...patch };
  profile.updatedAt = Date.now();
  profile.version++;

  // Record evolution step
  profile.evolutionLog.push({
    version:   profile.version,
    source,
    patch,
    timestamp: Date.now(),
  });

  // Cap evolution log at 100 entries
  if (profile.evolutionLog.length > 100) profile.evolutionLog.shift();

  PersonalityLogger.debug(
    `[PersonalityEngine] Traits updated for "${profileId}" (source: ${source})`
  );

  await emit(DOG_EVENTS.DOG_STATE_UPDATED, {
    timestamp: Date.now(),
    dogId:     profileId,
    source:    'personalityEngine',
    runtimeState: getPersonalitySnapshot(profileId),
  });

  return getPersonalitySnapshot(profileId);
}

// ----------------------------------------------------------------
// VALIDATE PERSONALITY PROFILE
// ----------------------------------------------------------------

/**
 * Validate a full or partial personality trait set.
 * @param {Object} traits
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePersonalityProfile(traits) {
  const errors = [];

  if (!traits || typeof traits !== 'object') {
    errors.push('Traits must be a plain object.');
    return { valid: false, errors };
  }

  const validKeys = Object.values(PERSONALITY_TRAIT);

  for (const [key, val] of Object.entries(traits)) {
    if (!validKeys.includes(key)) {
      errors.push(`Unknown trait key: "${key}".`);
      continue;
    }
    if (typeof val !== 'number' || val < TRAIT_MIN || val > TRAIT_MAX) {
      errors.push(`Trait "${key}" must be a number in [${TRAIT_MIN}, ${TRAIT_MAX}]. Got: ${val}.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ----------------------------------------------------------------
// GET PERSONALITY SNAPSHOT
// ----------------------------------------------------------------

/**
 * @param {string} profileId
 * @returns {Object} deep-cloned personality snapshot
 */
export function getPersonalitySnapshot(profileId) {
  const profile = _requireProfile(profileId);
  return {
    profileId:      profile.profileId,
    traits:         { ...profile.traits },
    version:        profile.version,
    createdAt:      profile.createdAt,
    updatedAt:      profile.updatedAt,
    evolutionSteps: profile.evolutionLog.length,
  };
}

// ----------------------------------------------------------------
// GET DOMINANT TRAIT
// ----------------------------------------------------------------

/**
 * Return the trait with the highest value for a given profile.
 * @param {string} profileId
 * @returns {{ trait: string, value: number }}
 */
export function getDominantTrait(profileId) {
  const profile = _requireProfile(profileId);
  let dominant  = null;
  let max       = -Infinity;

  for (const [key, val] of Object.entries(profile.traits)) {
    if (val > max) { max = val; dominant = key; }
  }

  return { trait: dominant, value: max };
}

// ----------------------------------------------------------------
// RESTORE PERSONALITY FROM PERSISTENCE
// ----------------------------------------------------------------

/**
 * Restore a personality profile from a persisted record.
 * @param {Object} persistedProfile — from storageService
 */
export function restorePersonalityProfile(persistedProfile) {
  if (!persistedProfile?.profileId) {
    throw new PersonalityError('[PersonalityEngine] restorePersonalityProfile: invalid record.');
  }

  const { profileId, traits, version, createdAt, evolutionLog } = persistedProfile;

  const validation = validatePersonalityProfile(traits || {});
  if (!validation.valid) {
    PersonalityLogger.warn(
      `[PersonalityEngine] Restoring profile "${profileId}" with trait errors — using defaults for invalid fields.`
    );
  }

  const profile        = new PersonalityProfile(profileId, _clampTraits(traits || {}));
  profile.version      = version     || 1;
  profile.createdAt    = createdAt   || Date.now();
  profile.evolutionLog = Array.isArray(evolutionLog) ? evolutionLog.slice(-100) : [];

  _profiles.set(profileId, profile);

  PersonalityLogger.info(`[PersonalityEngine] Personality profile restored — profileId: ${profileId}`);
  return getPersonalitySnapshot(profileId);
}

// ----------------------------------------------------------------
// INTERNAL: Clamp all traits in a patch to [TRAIT_MIN, TRAIT_MAX]
// ----------------------------------------------------------------

function _clampTraits(traits) {
  const clamped = {};
  for (const [key, val] of Object.entries(traits)) {
    if (typeof val === 'number') {
      clamped[key] = Math.min(TRAIT_MAX, Math.max(TRAIT_MIN, val));
    }
  }
  return clamped;
}

// ----------------------------------------------------------------
// INTERNAL: Require profile or throw
// ----------------------------------------------------------------

function _requireProfile(profileId) {
  const profile = _profiles.get(profileId);
  if (!profile) {
    throw new PersonalityError(
      `[PersonalityEngine] Profile "${profileId}" not found. Call initializePersonalityProfile() first.`
    );
  }
  return profile;
}

// ----------------------------------------------------------------
// ENGINE STATUS
// ----------------------------------------------------------------

export function getPersonalityEngineStatus() {
  return {
    totalProfiles: _profiles.size,
    profileIds:    Array.from(_profiles.keys()),
  };
}

// ----------------------------------------------------------------
// PERSONALITY ERROR
// ----------------------------------------------------------------

export class PersonalityError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name      = 'PersonalityError';
    this.context   = context;
    this.timestamp = Date.now();
  }
}
