// ================================================================
// IMMORTAIL™ — TRAIT EXTRACTION ENGINE
// Combine analysis outputs, normalize traits, resolve conflicts,
// produce structured identity traits for reconstruction.
// NO RANDOMIZATION. DETERMINISTIC MERGE. IDENTITY PRESERVATION.
// ================================================================

import { SystemLogger }                 from '../utils/logger.js';
import { emit }                          from '../events/eventBus.js';
import { MEDIA_EVENTS }                  from '../events/eventTypes.js';
import { extractVisualTraits }           from './imageAnalysis.js';
import { extractMotionTraits }           from './motionAnalysis.js';
import { extractAudioTraits }            from './audioAnalysis.js';

const TraitLogger = SystemLogger;

// ----------------------------------------------------------------
// TRAIT PROFILE KEYS
// ----------------------------------------------------------------

export const TRAIT_CATEGORY = {
  PHYSICAL:   'physical',
  MOTION:     'motion',
  AUDIO:      'audio',
  BEHAVIORAL: 'behavioral',
};

export const EXTRACTION_CONFIDENCE = {
  HIGH:     'high',      // ≥ 0.7
  MEDIUM:   'medium',    // ≥ 0.4
  LOW:      'low',       // ≥ 0.2
  MINIMAL:  'minimal',   // > 0
  NONE:     'none',      // 0
};

// ----------------------------------------------------------------
// CONFLICT RESOLUTION STRATEGY
// ----------------------------------------------------------------

export const CONFLICT_STRATEGY = {
  HIGHEST_CONFIDENCE: 'highest_confidence',   // winner takes all
  MERGE_KNOWN:        'merge_known',           // prefer non-null values from either
  AVERAGE:            'average',               // for numeric fields
};

// ----------------------------------------------------------------
// CONFIDENCE THRESHOLDS
// ----------------------------------------------------------------

const THRESHOLD = {
  HIGH:   0.70,
  MEDIUM: 0.40,
  LOW:    0.20,
};

// ----------------------------------------------------------------
// EXTRACT IDENTITY TRAITS
// ----------------------------------------------------------------

/**
 * Merge outputs from image, motion, and audio analysis into a
 * unified, normalized identity trait profile.
 *
 * @param {Object}  extractionInput
 * @param {string}  extractionInput.profileId
 * @param {string}  extractionInput.extractionId   — unique ID for this extraction run
 * @param {Object}  [extractionInput.imageAnalysis] — output of analyzeImage()
 * @param {Object}  [extractionInput.motionAnalysis]— output of analyzeMotion()
 * @param {Object}  [extractionInput.audioAnalysis] — output of analyzeAudio()
 * @param {Object}  [extractionInput.metadata]
 * @returns {Promise<Object>} TraitProfile
 */
export async function extractIdentityTraits(extractionInput) {
  const validation = _validateExtractionInput(extractionInput);
  if (!validation.valid) {
    throw new TraitExtractionError(
      `[TraitExtraction] extractIdentityTraits validation failed: ${validation.errors.join(' | ')}`
    );
  }

  const { profileId, extractionId, imageAnalysis, motionAnalysis, audioAnalysis, metadata } = extractionInput;

  TraitLogger.info(
    `[TraitExtraction] Extracting identity traits — profileId: ${profileId}, id: ${extractionId}`
  );

  // Extract from each analysis source
  const visualResult = imageAnalysis  ? _safeExtractVisual(imageAnalysis)  : null;
  const motionResult = motionAnalysis ? _safeExtractMotion(motionAnalysis) : null;
  const audioResult  = audioAnalysis  ? _safeExtractAudio(audioAnalysis)   : null;

  // Normalize and merge all trait categories
  const physicalTraits   = _mergePhysicalTraits(visualResult);
  const motionTraits     = _mergeMotionTraits(motionResult);
  const audioTraits      = _mergeAudioTraits(audioResult);
  const behavioralTraits = _inferBehavioralTraits(motionResult, audioResult, visualResult);

  // Compute per-category and overall confidence
  const categoryConfidence = {
    [TRAIT_CATEGORY.PHYSICAL]:   visualResult?.confidence || 0,
    [TRAIT_CATEGORY.MOTION]:     motionResult?.confidence || 0,
    [TRAIT_CATEGORY.AUDIO]:      audioResult?.confidence  || 0,
    [TRAIT_CATEGORY.BEHAVIORAL]: _computeBehavioralConfidence(motionResult, audioResult),
  };

  const overallConfidence = _computeOverallConfidence(categoryConfidence);
  const consistencyScore  = _computeConsistencyScore(physicalTraits, motionTraits, audioTraits);

  const profile = {
    extractionId,
    profileId,
    traits: {
      [TRAIT_CATEGORY.PHYSICAL]:   physicalTraits,
      [TRAIT_CATEGORY.MOTION]:     motionTraits,
      [TRAIT_CATEGORY.AUDIO]:      audioTraits,
      [TRAIT_CATEGORY.BEHAVIORAL]: behavioralTraits,
    },
    categoryConfidence,
    overallConfidence,
    confidenceLabel:  _confidenceLabel(overallConfidence),
    consistencyScore,
    sourceMediaCount: [imageAnalysis, motionAnalysis, audioAnalysis].filter(Boolean).length,
    extractionVersion: 1,
    extractedAt:      Date.now(),
    metadata:         { ...metadata },
  };

  TraitLogger.info(
    `[TraitExtraction] Traits extracted — profileId: ${profileId}, ` +
    `overall confidence: ${overallConfidence.toFixed(2)} (${profile.confidenceLabel}), ` +
    `consistency: ${consistencyScore.toFixed(2)}`
  );

  await emit(MEDIA_EVENTS.MEDIA_ANALYZED, {
    timestamp: Date.now(),
    mediaId:   extractionId,
  });

  return profile;
}

// ----------------------------------------------------------------
// NORMALIZE TRAIT PROFILES
// ----------------------------------------------------------------

/**
 * Normalize a raw trait profile: clamp numeric fields,
 * resolve nulls, ensure required structure is present.
 * @param {Object} traitProfile — output of extractIdentityTraits()
 * @returns {Object} normalized profile
 */
export function normalizeTraitProfiles(traitProfile) {
  if (!traitProfile?.traits) {
    throw new TraitExtractionError('[TraitExtraction] normalizeTraitProfiles: invalid trait profile.');
  }

  const normalized = {
    ...traitProfile,
    traits: {},
    normalizedAt: Date.now(),
  };

  for (const [category, traits] of Object.entries(traitProfile.traits)) {
    normalized.traits[category] = _normalizeTraitMap(traits);
  }

  // Ensure all confidence values are bounded [0, 1]
  const boundedCategory = {};
  for (const [cat, conf] of Object.entries(traitProfile.categoryConfidence || {})) {
    boundedCategory[cat] = Math.min(1, Math.max(0, conf || 0));
  }

  normalized.categoryConfidence = boundedCategory;
  normalized.overallConfidence  = Math.min(1, Math.max(0, traitProfile.overallConfidence || 0));

  return normalized;
}

// ----------------------------------------------------------------
// VALIDATE TRAIT PROFILE
// ----------------------------------------------------------------

/**
 * @param {Object} profile
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateTraitProfile(profile) {
  const errors = [];

  if (!profile || typeof profile !== 'object') {
    errors.push('Trait profile must be a plain object.');
    return { valid: false, errors };
  }

  if (!profile.extractionId || typeof profile.extractionId !== 'string') {
    errors.push('Missing "extractionId".');
  }
  if (!profile.profileId || typeof profile.profileId !== 'string') {
    errors.push('Missing "profileId".');
  }
  if (!profile.traits || typeof profile.traits !== 'object') {
    errors.push('Missing "traits" object.');
  }
  if (typeof profile.overallConfidence !== 'number' ||
      profile.overallConfidence < 0 || profile.overallConfidence > 1) {
    errors.push('"overallConfidence" must be a number in [0, 1].');
  }
  if (!profile.extractedAt) {
    errors.push('Missing "extractedAt".');
  }

  const requiredCategories = Object.values(TRAIT_CATEGORY);
  if (profile.traits) {
    for (const cat of requiredCategories) {
      if (!(cat in profile.traits)) {
        errors.push(`Missing trait category: "${cat}".`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ----------------------------------------------------------------
// INTERNAL: Safe wrappers for extraction calls
// ----------------------------------------------------------------

function _safeExtractVisual(analysis) {
  try { return extractVisualTraits(analysis); }
  catch (err) { TraitLogger.warn(`[TraitExtraction] Visual extraction failed: ${err.message}`); return null; }
}

function _safeExtractMotion(analysis) {
  try { return extractMotionTraits(analysis); }
  catch (err) { TraitLogger.warn(`[TraitExtraction] Motion extraction failed: ${err.message}`); return null; }
}

function _safeExtractAudio(analysis) {
  try { return extractAudioTraits(analysis); }
  catch (err) { TraitLogger.warn(`[TraitExtraction] Audio extraction failed: ${err.message}`); return null; }
}

// ----------------------------------------------------------------
// INTERNAL: Merge physical traits from visual extraction
// ----------------------------------------------------------------

function _mergePhysicalTraits(visual) {
  if (!visual || visual._partial) {
    return {
      coatPrimaryColor:   null,
      coatPattern:        null,
      coatTexture:        null,
      coatLength:         null,
      eyeColor:           null,
      earShape:           null,
      bodySizeEstimate:   null,
      bodyBuild:          null,
      confidence:         visual?.confidence || 0,
      isPartial:          true,
    };
  }

  const t = visual.traits || {};
  return {
    coatPrimaryColor:   t.coatPrimaryColor   || null,
    coatSecondaryColor: t.coatSecondaryColor || null,
    coatPattern:        t.coatPattern        || null,
    coatTexture:        t.coatTexture        || null,
    coatLength:         t.coatLength         || null,
    eyeColor:           t.eyeColor           || null,
    eyeShape:           t.eyeShape           || null,
    earShape:           t.earShape           || null,
    earPosition:        t.earPosition        || null,
    muzzleShape:        t.muzzleShape        || null,
    noseColor:          t.noseColor          || null,
    bodySizeEstimate:   t.bodySizeEstimate   || null,
    bodyBuild:          t.bodyBuild          || null,
    tailShape:          t.tailShape          || null,
    featureRefs:        { ...(visual.featureRefs || {}) },
    confidence:         visual.confidence,
    isPartial:          false,
  };
}

// ----------------------------------------------------------------
// INTERNAL: Merge motion traits
// ----------------------------------------------------------------

function _mergeMotionTraits(motion) {
  if (!motion || motion._partial) {
    return {
      movementRhythm:   null,
      postureSignature: null,
      gaitTendency:     null,
      energyLevel:      null,
      confidence:       motion?.confidence || 0,
      isPartial:        true,
    };
  }

  const t = motion.traits || {};
  return {
    movementRhythm:    t.movementRhythm    || null,
    postureSignature:  t.postureSignature  || null,
    gaitTendency:      t.gaitTendency      || null,
    energyLevel:       motion.energyLevel  || null,
    interactionMotion: t.interactionMotion ?? null,
    restingPosture:    t.restingPosture    || null,
    tailMotion:        t.tailMotion        || null,
    headCarriage:      t.headCarriage      || null,
    temporalMap:       { ...(motion.temporalMap || {}) },
    confidence:        motion.confidence,
    isPartial:         false,
  };
}

// ----------------------------------------------------------------
// INTERNAL: Merge audio traits
// ----------------------------------------------------------------

function _mergeAudioTraits(audio) {
  if (!audio || audio._partial) {
    return {
      barkPitch:       null,
      vocalIntensity:  null,
      rhythmPattern:   null,
      emotionalMarker: null,
      confidence:      audio?.confidence || 0,
      isPartial:       true,
    };
  }

  const t = audio.traits || {};
  return {
    barkPitch:         t.barkPitch        || null,
    vocalIntensity:    t.vocalIntensity   || null,
    rhythmPattern:     t.rhythmPattern    || null,
    emotionalMarker:   t.emotionalMarker  || null,
    vocalizationRate:  t.vocalizationRate ?? null,
    frequencyProfile:  { ...(audio.frequencyProfile || {}) },
    vocalSummary:      { ...(audio.vocalSummary || {}) },
    confidence:        audio.confidence,
    isPartial:         false,
  };
}

// ----------------------------------------------------------------
// INTERNAL: Infer behavioral tendencies from cross-modal signals
// ----------------------------------------------------------------

function _inferBehavioralTraits(motion, audio, visual) {
  const energyLevel   = motion?.energyLevel      || null;
  const emotionMarker = audio?.traits?.emotionalMarker || null;
  const coatPattern   = visual?.traits?.coatPattern    || null;

  return {
    estimatedEnergyLevel:    energyLevel,
    estimatedEmotionalTone:  emotionMarker,
    dominantMotionSignature: motion?.traits?.movementRhythm || null,
    dominantVocalSignature:  audio?.traits?.rhythmPattern   || null,
    coatPresence:            !!coatPattern,
    crossModalConsistency:   _assessCrossModalConsistency(motion, audio),
  };
}

// ----------------------------------------------------------------
// INTERNAL: Confidence computations
// ----------------------------------------------------------------

function _computeBehavioralConfidence(motion, audio) {
  const mc = motion?.confidence || 0;
  const ac = audio?.confidence  || 0;
  return (mc + ac) / 2;
}

function _computeOverallConfidence(categoryConfidence) {
  const weights = {
    [TRAIT_CATEGORY.PHYSICAL]:   0.40,
    [TRAIT_CATEGORY.MOTION]:     0.30,
    [TRAIT_CATEGORY.AUDIO]:      0.15,
    [TRAIT_CATEGORY.BEHAVIORAL]: 0.15,
  };
  let total = 0;
  for (const [cat, weight] of Object.entries(weights)) {
    total += (categoryConfidence[cat] || 0) * weight;
  }
  return Math.min(1, Math.max(0, total));
}

function _computeConsistencyScore(physical, motion, audio) {
  // Score based on how many categories have non-partial, non-null data
  let score = 0;
  if (!physical.isPartial && physical.coatPrimaryColor) score += 0.35;
  if (!motion.isPartial && motion.energyLevel)           score += 0.35;
  if (!audio.isPartial && audio.barkPitch)               score += 0.30;
  return Math.min(1, score);
}

function _assessCrossModalConsistency(motion, audio) {
  if (!motion || !audio) return null;
  // High energy motion + excited/alert audio = consistent
  const highEnergyMotion = ['active', 'high'].includes(motion.energyLevel);
  const alertAudio       = ['excited', 'alert', 'playful'].includes(
    audio.traits?.emotionalMarker
  );
  if (highEnergyMotion && alertAudio)  return 'consistent_high_energy';
  const lowEnergyMotion  = ['low', 'calm'].includes(motion.energyLevel);
  const contentAudio     = ['content'].includes(audio.traits?.emotionalMarker);
  if (lowEnergyMotion && contentAudio) return 'consistent_low_energy';
  return 'mixed';
}

function _confidenceLabel(conf) {
  if (conf >= THRESHOLD.HIGH)   return EXTRACTION_CONFIDENCE.HIGH;
  if (conf >= THRESHOLD.MEDIUM) return EXTRACTION_CONFIDENCE.MEDIUM;
  if (conf >= THRESHOLD.LOW)    return EXTRACTION_CONFIDENCE.LOW;
  if (conf > 0)                 return EXTRACTION_CONFIDENCE.MINIMAL;
  return EXTRACTION_CONFIDENCE.NONE;
}

// ----------------------------------------------------------------
// INTERNAL: Validate extraction input
// ----------------------------------------------------------------

function _validateExtractionInput(input) {
  const errors = [];
  if (!input?.profileId    || typeof input.profileId    !== 'string') errors.push('Field "profileId" required.');
  if (!input?.extractionId || typeof input.extractionId !== 'string') errors.push('Field "extractionId" required.');
  const hasSources = !!(input?.imageAnalysis || input?.motionAnalysis || input?.audioAnalysis);
  if (!hasSources) errors.push('At least one analysis source (image, motion, or audio) must be provided.');
  return { valid: errors.length === 0, errors };
}

// ----------------------------------------------------------------
// INTERNAL: Normalize a trait map (remove undefined, clamp numbers)
// ----------------------------------------------------------------

function _normalizeTraitMap(traits) {
  if (!traits || typeof traits !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(traits)) {
    if (v === undefined) continue;
    if (typeof v === 'number') {
      out[k] = Math.min(1, Math.max(0, v));
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ----------------------------------------------------------------
// TRAIT EXTRACTION ERROR
// ----------------------------------------------------------------

export class TraitExtractionError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name      = 'TraitExtractionError';
    this.context   = context;
    this.timestamp = Date.now();
  }
}
