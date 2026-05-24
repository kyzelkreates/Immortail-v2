// ================================================================
// IMMORTAIL™ — IDENTITY PROFILE GENERATOR
// Stable identity profile, trait mapping, reconstruction references.
// IDENTITY PRESERVATION. NO RANDOM GENERATION. PERSISTENCE-SAFE.
// ================================================================

import { SystemLogger }          from '../utils/logger.js';
import { emit }                   from '../events/eventBus.js';
import { MEDIA_EVENTS }           from '../events/eventTypes.js';
import { validateTraitProfile }   from './traitExtraction.js';

const ProfileLogger = SystemLogger;

// ----------------------------------------------------------------
// PROFILE STATUS
// ----------------------------------------------------------------

export const IDENTITY_PROFILE_STATUS = {
  DRAFT:      'draft',      // created, not yet validated
  VALIDATED:  'validated',  // passed validation
  LOCKED:     'locked',     // finalized for reconstruction use
  DEPRECATED: 'deprecated', // superseded by newer version
};

// ----------------------------------------------------------------
// RECONSTRUCTION READINESS
// ----------------------------------------------------------------

export const RECONSTRUCTION_READINESS = {
  READY:          'ready',         // sufficient data for reconstruction
  PARTIAL:        'partial',       // can attempt with caveats
  INSUFFICIENT:   'insufficient',  // too little data
  NOT_ASSESSED:   'not_assessed',
};

// ----------------------------------------------------------------
// INTERNAL REGISTRY
// ----------------------------------------------------------------

/** @type {Map<string, IdentityProfileRecord>} profileId → latest record */
const _profiles = new Map();

/** @type {Map<string, IdentityProfileRecord[]>} profileId → version history */
const _history  = new Map();

// ----------------------------------------------------------------
// IDENTITY PROFILE RECORD
// ----------------------------------------------------------------

class IdentityProfileRecord {
  constructor({
    identityId, profileId, traitProfile, visualProfile,
    motionProfile, audioProfile, behavioralRefs,
    reconstructionMeta, extractionConfidence, metadata,
  }) {
    this.identityId           = identityId;
    this.profileId            = profileId;
    this.status               = IDENTITY_PROFILE_STATUS.DRAFT;
    this.version              = 1;

    // Sub-profiles (derived from trait extraction)
    this.visualProfile        = visualProfile    || {};
    this.motionProfile        = motionProfile    || {};
    this.audioProfile         = audioProfile     || {};
    this.behavioralRefs       = behavioralRefs   || {};

    // Reconstruction metadata
    this.reconstructionMeta   = reconstructionMeta   || {};
    this.reconstructionReadiness = RECONSTRUCTION_READINESS.NOT_ASSESSED;

    // Confidence
    this.extractionConfidence = extractionConfidence ?? 0;

    // Source trait profile reference
    this.traitProfileRef      = traitProfile
      ? { extractionId: traitProfile.extractionId, overallConfidence: traitProfile.overallConfidence }
      : null;

    // Timestamps
    this.createdAt            = Date.now();
    this.updatedAt            = Date.now();
    this.lockedAt             = null;

    // Metadata
    this.metadata             = metadata || {};
  }
}

// ----------------------------------------------------------------
// CREATE IDENTITY PROFILE
// ----------------------------------------------------------------

/**
 * Generate a stable identity profile from an extracted trait profile.
 * @param {Object} profileConfig
 * @param {string} profileConfig.identityId    — unique identity record ID
 * @param {string} profileConfig.profileId     — companion profile ID
 * @param {Object} profileConfig.traitProfile  — output of extractIdentityTraits()
 * @param {Object} [profileConfig.metadata]
 * @returns {Promise<Object>} identity profile snapshot
 */
export async function createIdentityProfile(profileConfig) {
  const validation = _validateCreateConfig(profileConfig);
  if (!validation.valid) {
    throw new IdentityProfileError(
      `[IdentityProfile] createIdentityProfile validation failed: ${validation.errors.join(' | ')}`
    );
  }

  const { identityId, profileId, traitProfile, metadata } = profileConfig;

  // Validate the incoming trait profile
  const traitValidation = validateTraitProfile(traitProfile);
  if (!traitValidation.valid) {
    throw new IdentityProfileError(
      `[IdentityProfile] Trait profile invalid: ${traitValidation.errors.join(' | ')}`
    );
  }

  ProfileLogger.info(
    `[IdentityProfile] Creating identity profile — identityId: ${identityId}, profileId: ${profileId}`
  );

  // Map trait profile into sub-profiles
  const visualProfile    = _buildVisualProfile(traitProfile);
  const motionProfile    = _buildMotionProfile(traitProfile);
  const audioProfile     = _buildAudioProfile(traitProfile);
  const behavioralRefs   = _buildBehavioralRefs(traitProfile);
  const reconstructionMeta = _buildReconstructionMeta(traitProfile);
  const readiness        = _assessReconstructionReadiness(traitProfile);

  const record = new IdentityProfileRecord({
    identityId,
    profileId,
    traitProfile,
    visualProfile,
    motionProfile,
    audioProfile,
    behavioralRefs,
    reconstructionMeta,
    extractionConfidence: traitProfile.overallConfidence,
    metadata,
  });

  record.status                  = IDENTITY_PROFILE_STATUS.VALIDATED;
  record.reconstructionReadiness = readiness;

  // Store
  _profiles.set(profileId, record);
  if (!_history.has(profileId)) _history.set(profileId, []);
  _history.get(profileId).push(record);

  ProfileLogger.info(
    `[IdentityProfile] Identity profile created — identityId: ${identityId}, ` +
    `readiness: ${readiness}, confidence: ${record.extractionConfidence.toFixed(2)}`
  );

  const snap = getIdentitySnapshot(profileId);

  await emit(MEDIA_EVENTS.RECONSTRUCTION_COMPLETE, {
    timestamp: Date.now(),
    mediaId:   identityId,
    profileId,
  });

  return snap;
}

// ----------------------------------------------------------------
// UPDATE IDENTITY PROFILE
// ----------------------------------------------------------------

/**
 * Update an existing identity profile with a new trait profile extraction.
 * Preserves identity continuity — does not destructively overwrite.
 * @param {string} profileId
 * @param {Object} newTraitProfile — updated extraction output
 * @param {Object} [patchMeta]
 * @returns {Object} updated snapshot
 */
export async function updateIdentityProfile(profileId, newTraitProfile, patchMeta = {}) {
  const existing = _profiles.get(profileId);
  if (!existing) {
    throw new IdentityProfileError(
      `[IdentityProfile] Profile "${profileId}" not found. Call createIdentityProfile() first.`
    );
  }

  if (existing.status === IDENTITY_PROFILE_STATUS.LOCKED) {
    throw new IdentityProfileError(
      `[IdentityProfile] Profile "${profileId}" is locked. Unlock before updating.`
    );
  }

  const traitValidation = validateTraitProfile(newTraitProfile);
  if (!traitValidation.valid) {
    throw new IdentityProfileError(
      `[IdentityProfile] updateIdentityProfile: trait profile invalid: ${traitValidation.errors.join(' | ')}`
    );
  }

  ProfileLogger.info(`[IdentityProfile] Updating identity profile — profileId: ${profileId}`);

  // Merge sub-profiles (preserve non-null existing values if new data has lower confidence)
  const newVisual   = _buildVisualProfile(newTraitProfile);
  const newMotion   = _buildMotionProfile(newTraitProfile);
  const newAudio    = _buildAudioProfile(newTraitProfile);
  const newBehav    = _buildBehavioralRefs(newTraitProfile);
  const newRecon    = _buildReconstructionMeta(newTraitProfile);

  existing.visualProfile     = _mergePreserving(existing.visualProfile, newVisual);
  existing.motionProfile     = _mergePreserving(existing.motionProfile, newMotion);
  existing.audioProfile      = _mergePreserving(existing.audioProfile, newAudio);
  existing.behavioralRefs    = _mergePreserving(existing.behavioralRefs, newBehav);
  existing.reconstructionMeta = _mergePreserving(existing.reconstructionMeta, newRecon);

  // Upgrade confidence if new extraction is better
  if (newTraitProfile.overallConfidence > existing.extractionConfidence) {
    existing.extractionConfidence = newTraitProfile.overallConfidence;
  }

  existing.traitProfileRef          = {
    extractionId:      newTraitProfile.extractionId,
    overallConfidence: newTraitProfile.overallConfidence,
  };
  existing.reconstructionReadiness  = _assessReconstructionReadiness(newTraitProfile);
  existing.version++;
  existing.updatedAt                = Date.now();
  existing.metadata                 = { ...existing.metadata, ...patchMeta };

  // Archive this version
  _history.get(profileId)?.push({ ...existing });

  ProfileLogger.info(
    `[IdentityProfile] Profile updated — profileId: ${profileId}, ` +
    `v${existing.version}, readiness: ${existing.reconstructionReadiness}`
  );

  return getIdentitySnapshot(profileId);
}

// ----------------------------------------------------------------
// VALIDATE IDENTITY PROFILE
// ----------------------------------------------------------------

/**
 * @param {Object} record — snapshot or IdentityProfileRecord
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateIdentityProfile(record) {
  const errors = [];

  if (!record || typeof record !== 'object') {
    errors.push('Identity profile must be a plain object.');
    return { valid: false, errors };
  }

  if (!record.identityId  || typeof record.identityId  !== 'string') errors.push('Missing "identityId".');
  if (!record.profileId   || typeof record.profileId   !== 'string') errors.push('Missing "profileId".');
  if (!record.visualProfile  || typeof record.visualProfile  !== 'object') errors.push('Missing "visualProfile".');
  if (!record.motionProfile  || typeof record.motionProfile  !== 'object') errors.push('Missing "motionProfile".');
  if (!record.audioProfile   || typeof record.audioProfile   !== 'object') errors.push('Missing "audioProfile".');
  if (!record.behavioralRefs || typeof record.behavioralRefs !== 'object') errors.push('Missing "behavioralRefs".');

  const validStatuses = Object.values(IDENTITY_PROFILE_STATUS);
  if (!validStatuses.includes(record.status)) {
    errors.push(`"status" must be one of: ${validStatuses.join(', ')}.`);
  }

  if (
    typeof record.extractionConfidence !== 'number' ||
    record.extractionConfidence < 0 ||
    record.extractionConfidence > 1
  ) {
    errors.push('"extractionConfidence" must be a number in [0, 1].');
  }

  if (!record.createdAt) errors.push('Missing "createdAt".');
  if (!record.version || typeof record.version !== 'number') errors.push('Missing valid "version".');

  return { valid: errors.length === 0, errors };
}

// ----------------------------------------------------------------
// GET IDENTITY SNAPSHOT
// ----------------------------------------------------------------

/**
 * @param {string} profileId
 * @returns {Object} deep-safe snapshot
 */
export function getIdentitySnapshot(profileId) {
  const record = _profiles.get(profileId);
  if (!record) {
    throw new IdentityProfileError(
      `[IdentityProfile] Profile "${profileId}" not found.`
    );
  }

  return {
    identityId:              record.identityId,
    profileId:               record.profileId,
    status:                  record.status,
    version:                 record.version,
    visualProfile:           { ...record.visualProfile },
    motionProfile:           { ...record.motionProfile },
    audioProfile:            { ...record.audioProfile },
    behavioralRefs:          { ...record.behavioralRefs },
    reconstructionMeta:      { ...record.reconstructionMeta },
    reconstructionReadiness: record.reconstructionReadiness,
    extractionConfidence:    record.extractionConfidence,
    traitProfileRef:         record.traitProfileRef ? { ...record.traitProfileRef } : null,
    createdAt:               record.createdAt,
    updatedAt:               record.updatedAt,
    lockedAt:                record.lockedAt,
    metadata:                { ...record.metadata },
  };
}

// ----------------------------------------------------------------
// LOCK IDENTITY PROFILE
// ----------------------------------------------------------------

export function lockIdentityProfile(profileId) {
  const record = _profiles.get(profileId);
  if (!record) {
    throw new IdentityProfileError(`[IdentityProfile] Profile "${profileId}" not found.`);
  }
  record.status   = IDENTITY_PROFILE_STATUS.LOCKED;
  record.lockedAt = Date.now();
  ProfileLogger.info(`[IdentityProfile] Profile locked — profileId: ${profileId}`);
  return getIdentitySnapshot(profileId);
}

// ----------------------------------------------------------------
// GET PROFILE VERSION HISTORY
// ----------------------------------------------------------------

export function getProfileHistory(profileId) {
  return (_history.get(profileId) || []).map((r) => ({
    version:    r.version,
    status:     r.status,
    updatedAt:  r.updatedAt,
    confidence: r.extractionConfidence,
  }));
}

// ----------------------------------------------------------------
// ENGINE STATUS
// ----------------------------------------------------------------

export function getIdentityProfileEngineStatus() {
  return {
    totalProfiles: _profiles.size,
    profileIds:    Array.from(_profiles.keys()),
  };
}

// ----------------------------------------------------------------
// INTERNAL: Build sub-profiles from trait profile
// ----------------------------------------------------------------

function _buildVisualProfile(tp) {
  const physical = tp.traits?.physical || {};
  return {
    coatPrimaryColor:   physical.coatPrimaryColor   || null,
    coatSecondaryColor: physical.coatSecondaryColor || null,
    coatPattern:        physical.coatPattern        || null,
    coatTexture:        physical.coatTexture        || null,
    coatLength:         physical.coatLength         || null,
    eyeColor:           physical.eyeColor           || null,
    eyeShape:           physical.eyeShape           || null,
    earShape:           physical.earShape           || null,
    earPosition:        physical.earPosition        || null,
    muzzleShape:        physical.muzzleShape        || null,
    noseColor:          physical.noseColor          || null,
    bodySizeEstimate:   physical.bodySizeEstimate   || null,
    bodyBuild:          physical.bodyBuild          || null,
    tailShape:          physical.tailShape          || null,
    featureRefs:        { ...(physical.featureRefs || {}) },
    confidence:         physical.confidence         || 0,
  };
}

function _buildMotionProfile(tp) {
  const motion = tp.traits?.motion || {};
  return {
    movementRhythm:   motion.movementRhythm   || null,
    postureSignature: motion.postureSignature || null,
    gaitTendency:     motion.gaitTendency     || null,
    energyLevel:      motion.energyLevel      || null,
    restingPosture:   motion.restingPosture   || null,
    tailMotion:       motion.tailMotion       || null,
    headCarriage:     motion.headCarriage     || null,
    confidence:       motion.confidence       || 0,
  };
}

function _buildAudioProfile(tp) {
  const audio = tp.traits?.audio || {};
  return {
    barkPitch:        audio.barkPitch        || null,
    vocalIntensity:   audio.vocalIntensity   || null,
    rhythmPattern:    audio.rhythmPattern    || null,
    emotionalMarker:  audio.emotionalMarker  || null,
    vocalizationRate: audio.vocalizationRate ?? null,
    frequencyProfile: { ...(audio.frequencyProfile || {}) },
    confidence:       audio.confidence       || 0,
  };
}

function _buildBehavioralRefs(tp) {
  const behavioral = tp.traits?.behavioral || {};
  return {
    estimatedEnergyLevel:    behavioral.estimatedEnergyLevel    || null,
    estimatedEmotionalTone:  behavioral.estimatedEmotionalTone  || null,
    dominantMotionSignature: behavioral.dominantMotionSignature || null,
    dominantVocalSignature:  behavioral.dominantVocalSignature  || null,
    crossModalConsistency:   behavioral.crossModalConsistency   || null,
  };
}

function _buildReconstructionMeta(tp) {
  return {
    sourceMediaCount:    tp.sourceMediaCount    || 0,
    overallConfidence:   tp.overallConfidence   || 0,
    confidenceLabel:     tp.confidenceLabel     || 'none',
    consistencyScore:    tp.consistencyScore    || 0,
    categoryConfidence:  { ...(tp.categoryConfidence || {}) },
    extractionVersion:   tp.extractionVersion   || 1,
    extractedAt:         tp.extractedAt         || Date.now(),
  };
}

// ----------------------------------------------------------------
// INTERNAL: Assess reconstruction readiness
// ----------------------------------------------------------------

function _assessReconstructionReadiness(tp) {
  const conf     = tp.overallConfidence || 0;
  const physical = tp.traits?.physical  || {};
  const hasVisual = !!(physical.coatPrimaryColor || physical.eyeColor || physical.bodySizeEstimate);

  if (conf >= 0.6 && hasVisual) return RECONSTRUCTION_READINESS.READY;
  if (conf >= 0.3 || hasVisual) return RECONSTRUCTION_READINESS.PARTIAL;
  return RECONSTRUCTION_READINESS.INSUFFICIENT;
}

// ----------------------------------------------------------------
// INTERNAL: Merge while preserving non-null existing values
// ----------------------------------------------------------------

function _mergePreserving(existing, incoming) {
  const merged = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    // Override only if incoming has a non-null, non-undefined value
    if (v !== null && v !== undefined) {
      merged[k] = v;
    }
  }
  return merged;
}

// ----------------------------------------------------------------
// INTERNAL: Validate create config
// ----------------------------------------------------------------

function _validateCreateConfig(config) {
  const errors = [];
  if (!config?.identityId || typeof config.identityId !== 'string') {
    errors.push('Field "identityId" must be a non-empty string.');
  }
  if (!config?.profileId || typeof config.profileId !== 'string') {
    errors.push('Field "profileId" must be a non-empty string.');
  }
  if (!config?.traitProfile || typeof config.traitProfile !== 'object') {
    errors.push('Field "traitProfile" is required.');
  }
  return { valid: errors.length === 0, errors };
}

// ----------------------------------------------------------------
// IDENTITY PROFILE ERROR
// ----------------------------------------------------------------

export class IdentityProfileError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name      = 'IdentityProfileError';
    this.context   = context;
    this.timestamp = Date.now();
  }
}
