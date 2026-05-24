// ================================================================
// IMMORTAIL™ — MOTION ANALYSIS (FOUNDATION)
// Movement pattern analysis, posture extraction, gait references.
// NO ANIMATION GENERATION. STRUCTURED MOTION REFERENCES ONLY.
// ================================================================

import { SystemLogger } from '../utils/logger.js';

const MotionLogger = SystemLogger;

// ----------------------------------------------------------------
// MOTION TRAIT KEYS
// ----------------------------------------------------------------

export const MOTION_TRAIT = {
  MOVEMENT_RHYTHM:    'movementRhythm',
  POSTURE_SIGNATURE:  'postureSignature',
  GAIT_TENDENCY:      'gaitTendency',
  ENERGY_LEVEL:       'energyLevel',
  INTERACTION_MOTION: 'interactionMotion',
  RESTING_POSTURE:    'restingPosture',
  TAIL_MOTION:        'tailMotion',
  HEAD_CARRIAGE:      'headCarriage',
};

export const GAIT_TYPE = {
  WALK:      'walk',
  TROT:      'trot',
  CANTER:    'canter',
  RUN:       'run',
  BOUND:     'bound',
  UNKNOWN:   'unknown',
};

export const POSTURE = {
  UPRIGHT:   'upright',
  RELAXED:   'relaxed',
  ALERT:     'alert',
  CROUCHED:  'crouched',
  SPRAWLED:  'sprawled',
  UNKNOWN:   'unknown',
};

export const ENERGY_LEVEL = {
  LOW:     'low',
  CALM:    'calm',
  MODERATE:'moderate',
  ACTIVE:  'active',
  HIGH:    'high',
  UNKNOWN: 'unknown',
};

// ----------------------------------------------------------------
// FRAME SEQUENCE DESCRIPTOR
// Describes a temporal slice of video for motion analysis.
// ----------------------------------------------------------------

export const FRAME_TAG = {
  IDLE:        'idle',
  MOVING:      'moving',
  INTERACTING: 'interacting',
  RESTING:     'resting',
  PLAYING:     'playing',
  GROOMING:    'grooming',
};

// ----------------------------------------------------------------
// CONFIDENCE BOUNDS
// ----------------------------------------------------------------

const CONFIDENCE_MIN = 0.0;
const CONFIDENCE_MAX = 1.0;

// ----------------------------------------------------------------
// ANALYZE MOTION
// ----------------------------------------------------------------

/**
 * Analyze motion metadata from a video upload.
 * Operates on declared/tagged frame data — no real-time CV.
 * Future runs integrate frame-by-frame pose estimation here.
 *
 * @param {Object} motionInput
 * @param {string} motionInput.mediaId
 * @param {string} motionInput.profileId
 * @param {number} [motionInput.durationSeconds]
 * @param {number} [motionInput.frameCount]
 * @param {string} [motionInput.mimeType]
 * @param {Object[]} [motionInput.frameTags]    — [{ timestamp, tag }]
 * @param {Object}  [motionInput.declaredTraits]
 * @param {Object}  [motionInput.metadata]
 * @returns {Object} MotionAnalysisRecord
 */
export function analyzeMotion(motionInput) {
  const validation = validateMotionInput(motionInput);
  if (!validation.valid) {
    throw new MotionAnalysisError(
      `[MotionAnalysis] analyzeMotion validation failed: ${validation.errors.join(' | ')}`
    );
  }

  const {
    mediaId, profileId, durationSeconds, frameCount,
    mimeType, frameTags, declaredTraits, metadata,
  } = motionInput;

  MotionLogger.info(`[MotionAnalysis] Analyzing motion — mediaId: ${mediaId}, profile: ${profileId}`);

  // Derive energy level from frame tag distribution
  const energyLevel = _deriveEnergyLevel(frameTags || []);

  // Build motion trait map
  const motionTraits = _buildMotionTraits(declaredTraits || {}, energyLevel, frameTags || []);

  // Build temporal motion map from frame tags
  const temporalMap  = _buildTemporalMap(frameTags || [], durationSeconds);

  // Compute motion confidence
  const confidence = _computeMotionConfidence(frameTags || [], declaredTraits || {}, durationSeconds);

  const record = {
    mediaId,
    profileId,
    analysisType:      'motion',
    durationSeconds:   durationSeconds || 0,
    frameCount:        frameCount      || 0,
    energyLevel,
    motionTraits,
    temporalMap,
    confidence,
    mimeType,
    analysisVersion:   1,
    analyzedAt:        Date.now(),
    metadata:          { ...metadata },
  };

  MotionLogger.info(
    `[MotionAnalysis] Motion analyzed — mediaId: ${mediaId}, ` +
    `energy: ${energyLevel}, confidence: ${confidence.toFixed(2)}`
  );

  return record;
}

// ----------------------------------------------------------------
// EXTRACT MOTION TRAITS
// ----------------------------------------------------------------

/**
 * @param {Object} analysisRecord — output of analyzeMotion()
 * @returns {Object} normalized motion trait map
 */
export function extractMotionTraits(analysisRecord) {
  if (!analysisRecord?.motionTraits) {
    throw new MotionAnalysisError('[MotionAnalysis] extractMotionTraits: invalid analysis record.');
  }

  const { motionTraits, confidence, temporalMap, energyLevel } = analysisRecord;

  if (confidence < 0.15) {
    MotionLogger.warn(
      `[MotionAnalysis] extractMotionTraits: low confidence (${confidence}). Returning partial.`
    );
    return { _partial: true, confidence, energyLevel, traits: {} };
  }

  return {
    _partial:      false,
    confidence,
    energyLevel,
    traits:        { ...motionTraits },
    temporalMap:   { ...temporalMap },
    extractedAt:   Date.now(),
  };
}

// ----------------------------------------------------------------
// VALIDATE MOTION PROFILE
// ----------------------------------------------------------------

/**
 * @param {Object} record
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateMotionProfile(record) {
  const errors = [];

  if (!record || typeof record !== 'object') {
    errors.push('Motion profile must be a plain object.');
    return { valid: false, errors };
  }

  if (!record.mediaId    || typeof record.mediaId    !== 'string') errors.push('Missing "mediaId".');
  if (!record.profileId  || typeof record.profileId  !== 'string') errors.push('Missing "profileId".');
  if (!record.motionTraits || typeof record.motionTraits !== 'object') errors.push('Missing "motionTraits".');
  if (
    typeof record.confidence !== 'number' ||
    record.confidence < CONFIDENCE_MIN ||
    record.confidence > CONFIDENCE_MAX
  ) {
    errors.push(`"confidence" must be a number in [${CONFIDENCE_MIN}, ${CONFIDENCE_MAX}].`);
  }
  if (!record.analyzedAt) errors.push('Missing "analyzedAt".');

  const validEnergy = Object.values(ENERGY_LEVEL);
  if (!validEnergy.includes(record.energyLevel)) {
    errors.push(`"energyLevel" must be one of: ${validEnergy.join(', ')}.`);
  }

  return { valid: errors.length === 0, errors };
}

// ----------------------------------------------------------------
// INTERNAL: Validate motion input
// ----------------------------------------------------------------

function validateMotionInput(input) {
  const errors = [];
  if (!input?.mediaId   || typeof input.mediaId   !== 'string') errors.push('Field "mediaId" required.');
  if (!input?.profileId || typeof input.profileId !== 'string') errors.push('Field "profileId" required.');
  if (input?.frameTags  && !Array.isArray(input.frameTags)) {
    errors.push('Field "frameTags" must be an array if provided.');
  }
  return { valid: errors.length === 0, errors };
}

// ----------------------------------------------------------------
// INTERNAL: Derive energy level from frame tag distribution
// ----------------------------------------------------------------

function _deriveEnergyLevel(frameTags) {
  if (!frameTags.length) return ENERGY_LEVEL.UNKNOWN;

  const tagCounts = {};
  for (const ft of frameTags) {
    tagCounts[ft.tag] = (tagCounts[ft.tag] || 0) + 1;
  }

  const total     = frameTags.length;
  const movingRatio = ((tagCounts[FRAME_TAG.MOVING] || 0) + (tagCounts[FRAME_TAG.PLAYING] || 0)) / total;
  const restRatio  = ((tagCounts[FRAME_TAG.RESTING] || 0) + (tagCounts[FRAME_TAG.IDLE] || 0)) / total;

  if (movingRatio > 0.7)  return ENERGY_LEVEL.HIGH;
  if (movingRatio > 0.45) return ENERGY_LEVEL.ACTIVE;
  if (movingRatio > 0.25) return ENERGY_LEVEL.MODERATE;
  if (restRatio > 0.7)    return ENERGY_LEVEL.LOW;
  return ENERGY_LEVEL.CALM;
}

// ----------------------------------------------------------------
// INTERNAL: Build motion trait map
// ----------------------------------------------------------------

function _buildMotionTraits(declared, energyLevel, frameTags) {
  const dominantTag = _dominantFrameTag(frameTags);

  return {
    [MOTION_TRAIT.MOVEMENT_RHYTHM]:    declared.movementRhythm    || _inferRhythm(energyLevel),
    [MOTION_TRAIT.POSTURE_SIGNATURE]:  declared.postureSignature  || _inferPosture(energyLevel, dominantTag),
    [MOTION_TRAIT.GAIT_TENDENCY]:      declared.gaitTendency      || _inferGait(energyLevel),
    [MOTION_TRAIT.ENERGY_LEVEL]:       energyLevel,
    [MOTION_TRAIT.INTERACTION_MOTION]: declared.interactionMotion || _hasTag(frameTags, FRAME_TAG.INTERACTING),
    [MOTION_TRAIT.RESTING_POSTURE]:    declared.restingPosture    || POSTURE.UNKNOWN,
    [MOTION_TRAIT.TAIL_MOTION]:        declared.tailMotion        || null,
    [MOTION_TRAIT.HEAD_CARRIAGE]:      declared.headCarriage      || null,
  };
}

// ----------------------------------------------------------------
// INTERNAL: Build temporal map from frame tags
// ----------------------------------------------------------------

function _buildTemporalMap(frameTags, duration) {
  if (!frameTags.length) return { segments: [], dominantTag: null };

  const segments   = [];
  let   current    = null;

  for (const ft of frameTags) {
    if (!current || current.tag !== ft.tag) {
      if (current) {
        current.endTimestamp = ft.timestamp;
        segments.push({ ...current });
      }
      current = { tag: ft.tag, startTimestamp: ft.timestamp, endTimestamp: null };
    }
  }
  if (current) {
    current.endTimestamp = duration ? duration * 1000 : null;
    segments.push(current);
  }

  return {
    segments,
    dominantTag: _dominantFrameTag(frameTags),
    totalSegments: segments.length,
  };
}

// ----------------------------------------------------------------
// INTERNAL: Compute motion confidence
// ----------------------------------------------------------------

function _computeMotionConfidence(frameTags, declared, duration) {
  let score = 0;

  if (frameTags.length > 30)       score += 0.3;
  else if (frameTags.length > 10)  score += 0.15;
  else if (frameTags.length > 0)   score += 0.05;

  if (duration && duration > 5)    score += 0.2;
  else if (duration && duration > 2) score += 0.1;

  const traitCount = Object.keys(declared).filter((k) => declared[k] != null).length;
  score += Math.min(0.5, traitCount * 0.08);

  return Math.min(CONFIDENCE_MAX, Math.max(CONFIDENCE_MIN, score));
}

function _dominantFrameTag(frameTags) {
  const counts = {};
  for (const ft of frameTags) counts[ft.tag] = (counts[ft.tag] || 0) + 1;
  let max = -1, dom = null;
  for (const [t, c] of Object.entries(counts)) { if (c > max) { max = c; dom = t; } }
  return dom;
}

function _hasTag(frameTags, tag) {
  return frameTags.some((ft) => ft.tag === tag);
}

function _inferRhythm(energyLevel) {
  const map = {
    [ENERGY_LEVEL.HIGH]:    'fast',
    [ENERGY_LEVEL.ACTIVE]:  'brisk',
    [ENERGY_LEVEL.MODERATE]:'steady',
    [ENERGY_LEVEL.CALM]:    'gentle',
    [ENERGY_LEVEL.LOW]:     'slow',
  };
  return map[energyLevel] || 'unknown';
}

function _inferPosture(energyLevel, dominantTag) {
  if (dominantTag === FRAME_TAG.RESTING || dominantTag === FRAME_TAG.IDLE) return POSTURE.RELAXED;
  if (energyLevel === ENERGY_LEVEL.HIGH || energyLevel === ENERGY_LEVEL.ACTIVE) return POSTURE.ALERT;
  return POSTURE.UNKNOWN;
}

function _inferGait(energyLevel) {
  const map = {
    [ENERGY_LEVEL.HIGH]:    GAIT_TYPE.RUN,
    [ENERGY_LEVEL.ACTIVE]:  GAIT_TYPE.TROT,
    [ENERGY_LEVEL.MODERATE]:GAIT_TYPE.WALK,
    [ENERGY_LEVEL.CALM]:    GAIT_TYPE.WALK,
    [ENERGY_LEVEL.LOW]:     GAIT_TYPE.WALK,
  };
  return map[energyLevel] || GAIT_TYPE.UNKNOWN;
}

// ----------------------------------------------------------------
// MOTION ANALYSIS ERROR
// ----------------------------------------------------------------

export class MotionAnalysisError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name      = 'MotionAnalysisError';
    this.context   = context;
    this.timestamp = Date.now();
  }
}
