// ================================================================
// IMMORTAIL™ — AUDIO ANALYSIS (FOUNDATION)
// Bark profile, tone mapping, vocal pattern tagging.
// NO SPEECH SYNTHESIS. NO VOICE GENERATION. STRUCTURED ONLY.
// ================================================================

import { SystemLogger } from '../utils/logger.js';

const AudioLogger = SystemLogger;

// ----------------------------------------------------------------
// AUDIO TRAIT KEYS
// ----------------------------------------------------------------

export const AUDIO_TRAIT = {
  BARK_PITCH:         'barkPitch',
  VOCAL_INTENSITY:    'vocalIntensity',
  RHYTHM_PATTERN:     'rhythmPattern',
  EMOTIONAL_MARKER:   'emotionalMarker',
  FREQUENCY_PROFILE:  'frequencyProfile',
  AMBIENT_LEVEL:      'ambientLevel',
  VOCALIZATION_RATE:  'vocalizationRate',
};

export const BARK_PITCH = {
  VERY_LOW:  'very_low',    // < 200 Hz
  LOW:       'low',         // 200–500 Hz
  MID:       'mid',         // 500–1000 Hz
  HIGH:      'high',        // 1000–2500 Hz
  VERY_HIGH: 'very_high',   // > 2500 Hz
  UNKNOWN:   'unknown',
};

export const VOCAL_INTENSITY = {
  WHISPER:  'whisper',
  SOFT:     'soft',
  MODERATE: 'moderate',
  LOUD:     'loud',
  INTENSE:  'intense',
  UNKNOWN:  'unknown',
};

export const RHYTHM_PATTERN = {
  SINGLE:      'single',     // isolated barks
  RAPID:       'rapid',      // fast repeated barks
  SUSTAINED:   'sustained',  // long continuous vocalization
  INTERMITTENT:'intermittent',
  UNKNOWN:     'unknown',
};

export const EMOTIONAL_VOCAL_MARKER = {
  PLAYFUL:   'playful',
  ALERT:     'alert',
  ANXIOUS:   'anxious',
  CONTENT:   'content',
  DISTRESS:  'distress',
  EXCITED:   'excited',
  UNKNOWN:   'unknown',
};

export const FREQUENCY_BAND = {
  SUB_BASS:   'sub_bass',    // < 80 Hz
  BASS:       'bass',        // 80–250 Hz
  LOW_MID:    'low_mid',     // 250–500 Hz
  MID:        'mid',         // 500–2000 Hz
  HIGH_MID:   'high_mid',    // 2000–4000 Hz
  PRESENCE:   'presence',    // 4000–6000 Hz
  BRILLIANCE: 'brilliance',  // > 6000 Hz
};

// ----------------------------------------------------------------
// BOUNDS
// ----------------------------------------------------------------

const CONFIDENCE_MIN = 0.0;
const CONFIDENCE_MAX = 1.0;

// ----------------------------------------------------------------
// ANALYZE AUDIO
// ----------------------------------------------------------------

/**
 * Analyze audio metadata and produce a structured audio analysis record.
 * Operates on declared/tagged audio descriptors — no real DSP in Run 7.
 * Future runs integrate waveform analysis and FFT data here.
 *
 * @param {Object} audioInput
 * @param {string} audioInput.mediaId
 * @param {string} audioInput.profileId
 * @param {number} [audioInput.durationSeconds]
 * @param {string} [audioInput.mimeType]
 * @param {number} [audioInput.fileSize]
 * @param {Object[]} [audioInput.vocalEvents]   — [{ timestampMs, eventType, durationMs }]
 * @param {Object}  [audioInput.declaredTraits]
 * @param {Object}  [audioInput.metadata]
 * @returns {Object} AudioAnalysisRecord
 */
export function analyzeAudio(audioInput) {
  const validation = validateAudioInput(audioInput);
  if (!validation.valid) {
    throw new AudioAnalysisError(
      `[AudioAnalysis] analyzeAudio validation failed: ${validation.errors.join(' | ')}`
    );
  }

  const {
    mediaId, profileId, durationSeconds, mimeType,
    fileSize, vocalEvents, declaredTraits, metadata,
  } = audioInput;

  AudioLogger.info(`[AudioAnalysis] Analyzing audio — mediaId: ${mediaId}, profile: ${profileId}`);

  const events = vocalEvents || [];

  // Derive vocalization rate (events per second)
  const vocalizationRate = durationSeconds && durationSeconds > 0
    ? events.length / durationSeconds
    : null;

  // Build audio trait map
  const audioTraits = _buildAudioTraits(declaredTraits || {}, events, vocalizationRate);

  // Build frequency profile
  const frequencyProfile = _buildFrequencyProfile(declaredTraits || {});

  // Build vocal event summary
  const vocalSummary = _summarizeVocalEvents(events);

  // Compute confidence
  const confidence = _computeAudioConfidence(events, declaredTraits || {}, durationSeconds);

  const record = {
    mediaId,
    profileId,
    analysisType:      'audio',
    durationSeconds:   durationSeconds || 0,
    mimeType,
    fileSizeBytes:     fileSize || 0,
    audioTraits,
    frequencyProfile,
    vocalSummary,
    vocalizationRate,
    confidence,
    analysisVersion:   1,
    analyzedAt:        Date.now(),
    metadata:          { ...metadata },
  };

  AudioLogger.info(
    `[AudioAnalysis] Audio analyzed — mediaId: ${mediaId}, ` +
    `pitch: ${audioTraits[AUDIO_TRAIT.BARK_PITCH]}, confidence: ${confidence.toFixed(2)}`
  );

  return record;
}

// ----------------------------------------------------------------
// EXTRACT AUDIO TRAITS
// ----------------------------------------------------------------

/**
 * @param {Object} analysisRecord — output of analyzeAudio()
 * @returns {Object} normalized audio trait map
 */
export function extractAudioTraits(analysisRecord) {
  if (!analysisRecord?.audioTraits) {
    throw new AudioAnalysisError('[AudioAnalysis] extractAudioTraits: invalid analysis record.');
  }

  const { audioTraits, confidence, frequencyProfile, vocalSummary } = analysisRecord;

  if (confidence < 0.15) {
    AudioLogger.warn(
      `[AudioAnalysis] extractAudioTraits: low confidence (${confidence}). Returning partial.`
    );
    return { _partial: true, confidence, traits: {} };
  }

  return {
    _partial:        false,
    confidence,
    traits:          { ...audioTraits },
    frequencyProfile: { ...frequencyProfile },
    vocalSummary:    { ...vocalSummary },
    extractedAt:     Date.now(),
  };
}

// ----------------------------------------------------------------
// VALIDATE AUDIO PROFILE
// ----------------------------------------------------------------

/**
 * @param {Object} record
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateAudioProfile(record) {
  const errors = [];

  if (!record || typeof record !== 'object') {
    errors.push('Audio profile must be a plain object.');
    return { valid: false, errors };
  }

  if (!record.mediaId   || typeof record.mediaId   !== 'string') errors.push('Missing "mediaId".');
  if (!record.profileId || typeof record.profileId !== 'string') errors.push('Missing "profileId".');
  if (!record.audioTraits || typeof record.audioTraits !== 'object') errors.push('Missing "audioTraits".');
  if (
    typeof record.confidence !== 'number' ||
    record.confidence < CONFIDENCE_MIN ||
    record.confidence > CONFIDENCE_MAX
  ) {
    errors.push(`"confidence" must be in [${CONFIDENCE_MIN}, ${CONFIDENCE_MAX}].`);
  }
  if (!record.analyzedAt) errors.push('Missing "analyzedAt".');

  return { valid: errors.length === 0, errors };
}

// ----------------------------------------------------------------
// INTERNAL: Validate audio input
// ----------------------------------------------------------------

function validateAudioInput(input) {
  const errors = [];
  if (!input?.mediaId   || typeof input.mediaId   !== 'string') errors.push('Field "mediaId" required.');
  if (!input?.profileId || typeof input.profileId !== 'string') errors.push('Field "profileId" required.');
  if (input?.vocalEvents && !Array.isArray(input.vocalEvents)) {
    errors.push('Field "vocalEvents" must be an array if provided.');
  }
  return { valid: errors.length === 0, errors };
}

// ----------------------------------------------------------------
// INTERNAL: Build audio trait map
// ----------------------------------------------------------------

function _buildAudioTraits(declared, events, vocalizationRate) {
  const intensityFromRate = vocalizationRate !== null
    ? vocalizationRate > 3  ? VOCAL_INTENSITY.LOUD
    : vocalizationRate > 1  ? VOCAL_INTENSITY.MODERATE
    : vocalizationRate > 0  ? VOCAL_INTENSITY.SOFT
    : VOCAL_INTENSITY.UNKNOWN
    : VOCAL_INTENSITY.UNKNOWN;

  const rhythmFromEvents = events.length > 0
    ? _inferRhythm(events)
    : RHYTHM_PATTERN.UNKNOWN;

  return {
    [AUDIO_TRAIT.BARK_PITCH]:        declared.barkPitch        || BARK_PITCH.UNKNOWN,
    [AUDIO_TRAIT.VOCAL_INTENSITY]:   declared.vocalIntensity   || intensityFromRate,
    [AUDIO_TRAIT.RHYTHM_PATTERN]:    declared.rhythmPattern    || rhythmFromEvents,
    [AUDIO_TRAIT.EMOTIONAL_MARKER]:  declared.emotionalMarker  || EMOTIONAL_VOCAL_MARKER.UNKNOWN,
    [AUDIO_TRAIT.AMBIENT_LEVEL]:     declared.ambientLevel     || null,
    [AUDIO_TRAIT.VOCALIZATION_RATE]: vocalizationRate,
    [AUDIO_TRAIT.FREQUENCY_PROFILE]: declared.frequencyBand    || null,
  };
}

// ----------------------------------------------------------------
// INTERNAL: Build frequency profile
// ----------------------------------------------------------------

function _buildFrequencyProfile(declared) {
  return {
    dominantBand:    declared.dominantBand   || null,
    peakFrequencyHz: declared.peakFrequencyHz !== undefined ? declared.peakFrequencyHz : null,
    bandPresence: {
      [FREQUENCY_BAND.BASS]:      declared.hasBass      ?? null,
      [FREQUENCY_BAND.LOW_MID]:   declared.hasLowMid    ?? null,
      [FREQUENCY_BAND.MID]:       declared.hasMid       ?? null,
      [FREQUENCY_BAND.HIGH_MID]:  declared.hasHighMid   ?? null,
      [FREQUENCY_BAND.PRESENCE]:  declared.hasPresence  ?? null,
    },
  };
}

// ----------------------------------------------------------------
// INTERNAL: Summarize vocal events
// ----------------------------------------------------------------

function _summarizeVocalEvents(events) {
  if (!events.length) {
    return { totalEvents: 0, avgDurationMs: null, uniqueTypes: [] };
  }

  const durations    = events.map((e) => e.durationMs).filter((d) => d !== undefined && d !== null);
  const avgDuration  = durations.length
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : null;
  const uniqueTypes  = [...new Set(events.map((e) => e.eventType).filter(Boolean))];

  return {
    totalEvents:   events.length,
    avgDurationMs: avgDuration !== null ? Math.round(avgDuration) : null,
    uniqueTypes,
  };
}

// ----------------------------------------------------------------
// INTERNAL: Compute audio confidence
// ----------------------------------------------------------------

function _computeAudioConfidence(events, declared, duration) {
  let score = 0;

  if (events.length > 20)      score += 0.3;
  else if (events.length > 5)  score += 0.15;
  else if (events.length > 0)  score += 0.05;

  if (duration && duration > 10)  score += 0.2;
  else if (duration && duration > 3) score += 0.1;

  const traitCount = Object.keys(declared).filter((k) => declared[k] != null).length;
  score += Math.min(0.5, traitCount * 0.07);

  return Math.min(CONFIDENCE_MAX, Math.max(CONFIDENCE_MIN, score));
}

// ----------------------------------------------------------------
// INTERNAL: Infer rhythm from event timing
// ----------------------------------------------------------------

function _inferRhythm(events) {
  if (events.length < 2) return RHYTHM_PATTERN.SINGLE;

  const sorted   = events.slice().sort((a, b) => a.timestampMs - b.timestampMs);
  const gaps     = [];

  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i].timestampMs - sorted[i - 1].timestampMs);
  }

  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

  if (avgGap < 400)   return RHYTHM_PATTERN.RAPID;
  if (avgGap < 1500)  return RHYTHM_PATTERN.INTERMITTENT;
  return RHYTHM_PATTERN.SINGLE;
}

// ----------------------------------------------------------------
// AUDIO ANALYSIS ERROR
// ----------------------------------------------------------------

export class AudioAnalysisError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name      = 'AudioAnalysisError';
    this.context   = context;
    this.timestamp = Date.now();
  }
}
