// ================================================================
// IMMORTAIL™ — IMAGE ANALYSIS (FOUNDATION)
// Metadata extraction, visual trait mapping, feature references.
// NO AI GENERATION. NO RENDERING. STRUCTURED OUTPUTS ONLY.
// ================================================================

import { SystemLogger } from '../utils/logger.js';

const ImageLogger = SystemLogger;

// ----------------------------------------------------------------
// VISUAL TRAIT KEYS
// ----------------------------------------------------------------

export const VISUAL_TRAIT = {
  // Coat
  COAT_PRIMARY_COLOR:   'coatPrimaryColor',
  COAT_SECONDARY_COLOR: 'coatSecondaryColor',
  COAT_PATTERN:         'coatPattern',
  COAT_TEXTURE:         'coatTexture',
  COAT_LENGTH:          'coatLength',

  // Face
  FACE_PROPORTION:      'faceProportion',
  EYE_COLOR:            'eyeColor',
  EYE_SHAPE:            'eyeShape',
  EAR_SHAPE:            'earShape',
  EAR_POSITION:         'earPosition',
  MUZZLE_SHAPE:         'muzzleShape',
  NOSE_COLOR:           'noseColor',

  // Body
  BODY_SIZE_ESTIMATE:   'bodySizeEstimate',
  BODY_BUILD:           'bodyBuild',
  TAIL_SHAPE:           'tailShape',

  // General
  IMAGE_QUALITY:        'imageQuality',
  SUBJECT_COVERAGE:     'subjectCoverage',   // how much of frame subject occupies
};

export const COAT_PATTERN = {
  SOLID:     'solid',
  BRINDLE:   'brindle',
  MERLE:     'merle',
  SPOTTED:   'spotted',
  BICOLOR:   'bicolor',
  TRICOLOR:  'tricolor',
  SABLE:     'sable',
  TICKED:    'ticked',
  UNKNOWN:   'unknown',
};

export const COAT_TEXTURE = {
  SMOOTH:   'smooth',
  WAVY:     'wavy',
  CURLY:    'curly',
  WIRE:     'wire',
  DOUBLE:   'double',
  UNKNOWN:  'unknown',
};

export const BODY_SIZE = {
  TOY:        'toy',
  SMALL:      'small',
  MEDIUM:     'medium',
  LARGE:      'large',
  GIANT:      'giant',
  UNKNOWN:    'unknown',
};

export const IMAGE_QUALITY_LEVEL = {
  HIGH:        'high',
  MEDIUM:      'medium',
  LOW:         'low',
  UNUSABLE:    'unusable',
};

// ----------------------------------------------------------------
// CONFIDENCE BOUNDS
// ----------------------------------------------------------------

const CONFIDENCE_MIN = 0.0;
const CONFIDENCE_MAX = 1.0;

// ----------------------------------------------------------------
// ANALYZE IMAGE
// ----------------------------------------------------------------

/**
 * Analyze image metadata and produce a structured visual analysis record.
 * In Run 7 this operates on declared metadata — no pixel inference.
 * Future runs will integrate CV pipeline outputs here.
 *
 * @param {Object} imageInput
 * @param {string} imageInput.mediaId
 * @param {string} imageInput.profileId
 * @param {string} imageInput.mimeType
 * @param {number} imageInput.fileSize
 * @param {Object} [imageInput.declaredTraits]  — traits declared by uploader / CV stub
 * @param {Object} [imageInput.metadata]
 * @returns {Object} ImageAnalysisRecord
 */
export function analyzeImage(imageInput) {
  const validation = validateImageInput(imageInput);
  if (!validation.valid) {
    throw new ImageAnalysisError(
      `[ImageAnalysis] analyzeImage validation failed: ${validation.errors.join(' | ')}`
    );
  }

  const { mediaId, profileId, mimeType, fileSize, declaredTraits, metadata } = imageInput;

  ImageLogger.info(`[ImageAnalysis] Analyzing image — mediaId: ${mediaId}, profile: ${profileId}`);

  // Derive image quality from available signals
  const imageQuality = _estimateImageQuality(fileSize, mimeType, metadata);

  // Merge declared traits with defaults
  const rawTraits   = { ...(declaredTraits || {}) };
  const visualTraits = _buildVisualTraits(rawTraits, imageQuality);

  // Extract feature references
  const featureRefs = _extractFeatureReferences(rawTraits);

  const record = {
    mediaId,
    profileId,
    analysisType:   'image',
    imageQuality,
    visualTraits,
    featureRefs,
    confidence:     _computeConfidence(rawTraits, imageQuality),
    mimeType,
    fileSizeBytes:  fileSize,
    analysisVersion: 1,
    analyzedAt:     Date.now(),
    metadata:       { ...metadata },
  };

  ImageLogger.info(
    `[ImageAnalysis] Image analyzed — mediaId: ${mediaId}, ` +
    `quality: ${imageQuality}, confidence: ${record.confidence.toFixed(2)}`
  );

  return record;
}

// ----------------------------------------------------------------
// EXTRACT VISUAL TRAITS
// ----------------------------------------------------------------

/**
 * Extract normalized visual traits from a raw analysis record.
 * @param {Object} analysisRecord — output of analyzeImage()
 * @returns {Object} normalized visual trait map
 */
export function extractVisualTraits(analysisRecord) {
  if (!analysisRecord?.visualTraits) {
    throw new ImageAnalysisError('[ImageAnalysis] extractVisualTraits: invalid analysis record.');
  }

  const { visualTraits, confidence, imageQuality, featureRefs } = analysisRecord;

  // Only extract traits above minimum usable confidence
  if (confidence < 0.2 || imageQuality === IMAGE_QUALITY_LEVEL.UNUSABLE) {
    ImageLogger.warn(
      `[ImageAnalysis] extractVisualTraits: low confidence (${confidence}) or unusable quality. ` +
      `Returning partial traits only.`
    );
    return { _partial: true, confidence, imageQuality, traits: {} };
  }

  return {
    _partial:     false,
    confidence,
    imageQuality,
    traits:       { ...visualTraits },
    featureRefs:  { ...featureRefs },
    extractedAt:  Date.now(),
  };
}

// ----------------------------------------------------------------
// VALIDATE IMAGE ANALYSIS
// ----------------------------------------------------------------

/**
 * Validate an ImageAnalysisRecord for schema compliance.
 * @param {Object} record
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateImageAnalysis(record) {
  const errors = [];

  if (!record || typeof record !== 'object') {
    errors.push('Analysis record must be a plain object.');
    return { valid: false, errors };
  }

  if (!record.mediaId    || typeof record.mediaId    !== 'string') errors.push('Missing "mediaId".');
  if (!record.profileId  || typeof record.profileId  !== 'string') errors.push('Missing "profileId".');
  if (!record.analysisType)                                         errors.push('Missing "analysisType".');
  if (!record.visualTraits || typeof record.visualTraits !== 'object') errors.push('Missing "visualTraits".');
  if (
    typeof record.confidence !== 'number' ||
    record.confidence < CONFIDENCE_MIN ||
    record.confidence > CONFIDENCE_MAX
  ) {
    errors.push(`"confidence" must be a number in [${CONFIDENCE_MIN}, ${CONFIDENCE_MAX}].`);
  }
  if (!record.analyzedAt || typeof record.analyzedAt !== 'number') {
    errors.push('Missing "analyzedAt" timestamp.');
  }

  const validQualities = Object.values(IMAGE_QUALITY_LEVEL);
  if (!validQualities.includes(record.imageQuality)) {
    errors.push(`"imageQuality" must be one of: ${validQualities.join(', ')}.`);
  }

  return { valid: errors.length === 0, errors };
}

// ----------------------------------------------------------------
// INTERNAL: Validate image input
// ----------------------------------------------------------------

function validateImageInput(input) {
  const errors = [];
  if (!input?.mediaId   || typeof input.mediaId   !== 'string') errors.push('Field "mediaId" required.');
  if (!input?.profileId || typeof input.profileId !== 'string') errors.push('Field "profileId" required.');
  if (!input?.mimeType  || typeof input.mimeType  !== 'string') errors.push('Field "mimeType" required.');
  return { valid: errors.length === 0, errors };
}

// ----------------------------------------------------------------
// INTERNAL: Estimate image quality from file signals
// ----------------------------------------------------------------

function _estimateImageQuality(fileSize, mimeType, metadata = {}) {
  // Large files + high-quality MIME → high quality
  if (fileSize >= 2 * 1024 * 1024 && ['image/jpeg', 'image/png', 'image/tiff', 'image/heic', 'image/heif'].includes(mimeType)) {
    return IMAGE_QUALITY_LEVEL.HIGH;
  }
  if (fileSize >= 512 * 1024) return IMAGE_QUALITY_LEVEL.MEDIUM;
  if (fileSize >= 50  * 1024) return IMAGE_QUALITY_LEVEL.LOW;
  return IMAGE_QUALITY_LEVEL.UNUSABLE;
}

// ----------------------------------------------------------------
// INTERNAL: Build visual trait map from declared traits
// ----------------------------------------------------------------

function _buildVisualTraits(declared, imageQuality) {
  const isUsable = imageQuality !== IMAGE_QUALITY_LEVEL.UNUSABLE;

  return {
    [VISUAL_TRAIT.COAT_PRIMARY_COLOR]:   declared.coatPrimaryColor   || (isUsable ? 'undetermined' : null),
    [VISUAL_TRAIT.COAT_SECONDARY_COLOR]: declared.coatSecondaryColor || null,
    [VISUAL_TRAIT.COAT_PATTERN]:         declared.coatPattern        || COAT_PATTERN.UNKNOWN,
    [VISUAL_TRAIT.COAT_TEXTURE]:         declared.coatTexture        || COAT_TEXTURE.UNKNOWN,
    [VISUAL_TRAIT.COAT_LENGTH]:          declared.coatLength         || null,
    [VISUAL_TRAIT.FACE_PROPORTION]:      declared.faceProportion     || null,
    [VISUAL_TRAIT.EYE_COLOR]:            declared.eyeColor           || null,
    [VISUAL_TRAIT.EYE_SHAPE]:            declared.eyeShape           || null,
    [VISUAL_TRAIT.EAR_SHAPE]:            declared.earShape           || null,
    [VISUAL_TRAIT.EAR_POSITION]:         declared.earPosition        || null,
    [VISUAL_TRAIT.MUZZLE_SHAPE]:         declared.muzzleShape        || null,
    [VISUAL_TRAIT.NOSE_COLOR]:           declared.noseColor          || null,
    [VISUAL_TRAIT.BODY_SIZE_ESTIMATE]:   declared.bodySizeEstimate   || BODY_SIZE.UNKNOWN,
    [VISUAL_TRAIT.BODY_BUILD]:           declared.bodyBuild          || null,
    [VISUAL_TRAIT.TAIL_SHAPE]:           declared.tailShape          || null,
    [VISUAL_TRAIT.IMAGE_QUALITY]:        imageQuality,
    [VISUAL_TRAIT.SUBJECT_COVERAGE]:     declared.subjectCoverage    || null,
  };
}

// ----------------------------------------------------------------
// INTERNAL: Extract feature reference map for reconstruction
// ----------------------------------------------------------------

function _extractFeatureReferences(declared) {
  return {
    hasCoatData:  !!(declared.coatPrimaryColor || declared.coatPattern),
    hasFaceData:  !!(declared.eyeColor || declared.earShape || declared.muzzleShape),
    hasBodyData:  !!(declared.bodySizeEstimate || declared.bodyBuild),
    coatSummary:  [declared.coatPrimaryColor, declared.coatPattern, declared.coatTexture]
                    .filter(Boolean).join(' / ') || 'undetermined',
    faceSummary:  [declared.eyeColor, declared.earShape].filter(Boolean).join(' / ') || 'undetermined',
  };
}

// ----------------------------------------------------------------
// INTERNAL: Compute confidence score from trait coverage
// ----------------------------------------------------------------

function _computeConfidence(declared, imageQuality) {
  const qualityScore = {
    [IMAGE_QUALITY_LEVEL.HIGH]:     0.4,
    [IMAGE_QUALITY_LEVEL.MEDIUM]:   0.25,
    [IMAGE_QUALITY_LEVEL.LOW]:      0.1,
    [IMAGE_QUALITY_LEVEL.UNUSABLE]: 0.0,
  }[imageQuality] || 0;

  const traitKeys      = Object.keys(declared).filter((k) => declared[k] !== undefined && declared[k] !== null);
  const traitCoverage  = Math.min(0.6, traitKeys.length * 0.06);  // up to 0.6 from traits

  return Math.min(CONFIDENCE_MAX, Math.max(CONFIDENCE_MIN, qualityScore + traitCoverage));
}

// ----------------------------------------------------------------
// IMAGE ANALYSIS ERROR
// ----------------------------------------------------------------

export class ImageAnalysisError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name      = 'ImageAnalysisError';
    this.context   = context;
    this.timestamp = Date.now();
  }
}
