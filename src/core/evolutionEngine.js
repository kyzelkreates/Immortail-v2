// ================================================================
// IMMORTAIL™ — EVOLUTION ENGINE (Run 6)
// Safe preference learning, behaviour adaptation, pattern detection,
// growth level system, and evolution safety validator.
//
// STRICT RULES:
// - identityLock is NEVER modified (enforced by storage.saveCompanionCore)
// - All changes are state-driven, clamped, and safety-validated
// - MAX adaptation intensity: ±10% of any numeric dimension
// - No sensitive/private attribute inference
// - All writes via storage.getCompanionCore() + storage.saveCompanionCore()
// ================================================================

import storage from './storage.js';
import { EventBus, EVENTS } from './eventBus.js';

// ── Constants ─────────────────────────────────────────────────────

// Interaction types that can be learned as preferences
const LEARNABLE_TYPES = [
  'chat', 'pet', 'play', 'talk', 'rest',
  'image', 'audio', 'video', 'reunion_event',
];

// Minimum occurrences before a pattern is stored as learned preference
const PREFERENCE_THRESHOLD = 3;

// Max adaptation intensity per event (±10 out of 100 = 10%)
const MAX_ADAPT_INTENSITY = 10;

// growthLevel formula weights
const GROWTH_WEIGHTS = {
  interactionCount:   0.05,   // +0.05 per interaction (capped contribution)
  emotionalResonance: 0.15,   // scaled 0-100 → 0-15 contribution
  trust:              0.20,   // scaled 0-100 → 0-20 contribution
  consistency:        0.10,   // bonus for long-term use
};

// Safe adaptation types
export const ADAPT_TYPE = {
  PLAYFULNESS:    'playfulness',    // slight increase in playful tone
  WARMTH:         'warmth',         // increased warmth expression
  RECALL:         'contextual_recall', // richer memory referencing
  TONE_FAMILIARITY: 'tone_familiarity', // more familiar conversational tone
  ACTIVITY_BIAS:  'activity_bias',  // bias toward favourite activities
};

// Unsafe patterns — if detected, adaptation is rejected
const UNSAFE_PATTERNS = [
  'aggressive', 'manipulative', 'obsessive', 'dependent',
  'unstable', 'coercive', 'threatening', 'harmful',
];

// ── Helpers ───────────────────────────────────────────────────────

function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

function nowHourBucket() {
  // Group by 4-hour buckets: 0,4,8,12,16,20
  const h = new Date().getHours();
  return Math.floor(h / 4) * 4;
}

function genId() {
  return Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

// ── Safety validator ──────────────────────────────────────────────

/**
 * validateAdaptation(adaptationType, intensity, core)
 * Run 6 safety gate — called before applying any adaptation.
 * Returns { safe: boolean, reason?: string }
 */
export function validateAdaptation(adaptationType, intensity, core) {
  // 1. identityLock must be intact
  const lock = core?.identityLock;
  if (!lock || lock.signature !== 'IMMORTAIL_DOG_CORE_V1' || !lock.immutable) {
    return { safe: false, reason: 'identityLock compromised — adaptation blocked' };
  }

  // 2. adaptation type must be known safe type
  const knownTypes = Object.values(ADAPT_TYPE);
  if (!knownTypes.includes(adaptationType)) {
    return { safe: false, reason: `unknown adaptation type: "${adaptationType}"` };
  }

  // 3. intensity must be within ±MAX_ADAPT_INTENSITY
  if (Math.abs(intensity) > MAX_ADAPT_INTENSITY) {
    return {
      safe: false,
      reason: `intensity ${intensity} exceeds MAX_ADAPT_INTENSITY (${MAX_ADAPT_INTENSITY})`,
    };
  }

  // 4. emotionalState must not be in crisis (valence < -80 or arousal > 95)
  const es = core?.emotionalState;
  if (es && (es.valence < -80 || es.arousal > 95)) {
    return { safe: false, reason: 'emotionalState unstable — adaptation deferred' };
  }

  // 5. check for unsafe pattern names in the adaptationType string
  for (const unsafe of UNSAFE_PATTERNS) {
    if (adaptationType.toLowerCase().includes(unsafe)) {
      return { safe: false, reason: `unsafe pattern detected: "${unsafe}"` };
    }
  }

  return { safe: true };
}

// ── Internal: log evolution event ─────────────────────────────────

function logEvolutionEvent(trigger, adaptationType, previousState, newState) {
  const core = storage.getCompanionCore();
  const el   = core.evolutionLayer ?? {};

  const entry = {
    id:              genId(),
    timestamp:       Date.now(),
    trigger,
    adaptationType,
    previousState,
    newState,
  };

  el.evolutionHistory = [...(el.evolutionHistory ?? []), entry].slice(-200);
  core.evolutionLayer = el;
  storage.saveCompanionCore(core);

  return entry;
}

// ── Internal: commit evolutionLayer section ───────────────────────

function patchEvolutionLayer(patch) {
  const core = storage.getCompanionCore();
  const el   = core.evolutionLayer ?? {};
  core.evolutionLayer = { ...el, ...patch };
  storage.saveCompanionCore(core);
  return storage.getCompanionCore().evolutionLayer;
}

// ══════════════════════════════════════════════════════════════════
// ── PUBLIC API
// ══════════════════════════════════════════════════════════════════

/**
 * recordActivitySignal(type, meta)
 * Called after every interaction. Updates frequency counters for
 * preference learning and recurring pattern detection.
 * meta: { sentiment?, hour?, isMedia? }
 */
export function recordActivitySignal(type, meta = {}) {
  if (!LEARNABLE_TYPES.includes(type)) return;

  const core = storage.getCompanionCore();
  const el   = core.evolutionLayer ?? {};
  const prefs = { ...(el.learnedPreferences ?? {}) };
  const pats  = { ...(el.recurringPatterns  ?? {}) };
  const styleMap = { ...(el.communicationStyleAdaptation ?? {}) };

  // ── Preference frequency counter ────────────────────────────────
  const prefKey = `freq_${type}`;
  prefs[prefKey] = (prefs[prefKey] ?? 0) + 1;

  // Promote to named preference once threshold crossed
  if (prefs[prefKey] === PREFERENCE_THRESHOLD) {
    const prefNames = {
      image:  'frequentPhotoSharing',
      audio:  'frequentAudioSharing',
      video:  'frequentVideoSharing',
      play:   'enjoysPlay',
      pet:    'enjoysPetting',
      chat:   'enjoysConversation',
      rest:   'enjoysQuietTime',
      talk:   'enjoysTalking',
    };
    const named = prefNames[type];
    if (named) {
      prefs[named] = true;
      logEvolutionEvent(
        `freq_${type}_reached_threshold`,
        ADAPT_TYPE.ACTIVITY_BIAS,
        { [named]: false },
        { [named]: true }
      );
    }
  }

  // ── Recurring pattern: time of day ──────────────────────────────
  const hourBucket = meta.hour ?? nowHourBucket();
  const timeKey    = `hourBucket_${hourBucket}`;
  pats[timeKey]    = (pats[timeKey] ?? 0) + 1;

  // Name common time patterns once established
  if (pats[timeKey] >= PREFERENCE_THRESHOLD) {
    const timeNames = {
      0:  'lateNightInteraction',
      4:  'earlyMorningInteraction',
      8:  'morningInteraction',
      12: 'afternoonInteraction',
      16: 'eveningInteraction',
      20: 'nightInteraction',
    };
    const tn = timeNames[hourBucket];
    if (tn && !pats[tn]) {
      pats[tn] = true;
      logEvolutionEvent(
        `time_pattern_${hourBucket}h`,
        ADAPT_TYPE.TONE_FAMILIARITY,
        { [tn]: false },
        { [tn]: true }
      );
    }
  }

  // ── Recurring pattern: media frequency ─────────────────────────
  if (meta.isMedia || ['image','audio','video'].includes(type)) {
    pats['mediaSharing'] = (pats['mediaSharing'] ?? 0) + 1;
    if (pats['mediaSharing'] >= PREFERENCE_THRESHOLD && !pats['frequentMediaSharer']) {
      pats['frequentMediaSharer'] = true;
      logEvolutionEvent(
        'media_frequency_threshold',
        ADAPT_TYPE.RECALL,
        { frequentMediaSharer: false },
        { frequentMediaSharer: true }
      );
    }
  }

  // ── Communication style: positive chat tendency ─────────────────
  if (type === 'chat') {
    if (meta.sentiment === 'positive') {
      styleMap['positiveLanguageCount'] = (styleMap['positiveLanguageCount'] ?? 0) + 1;
    }
    const msgLen = meta.textLength ?? 0;
    if (msgLen > 0) {
      const prev = styleMap['avgMessageLength'] ?? msgLen;
      styleMap['avgMessageLength'] = Math.round((prev * 0.8) + (msgLen * 0.2)); // EWMA
      if (msgLen < 30) {
        styleMap['prefersBriefMessages'] = (styleMap['prefersBriefMessages'] ?? 0) + 1;
      }
    }
  }

  // ── Favourite activities list (top-5 by frequency) ──────────────
  const actFreqs = LEARNABLE_TYPES
    .filter(t => t !== 'reunion_event')
    .map(t => ({ type: t, count: prefs[`freq_${t}`] ?? 0 }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(x => x.type);

  // ── Write back ──────────────────────────────────────────────────
  // Re-read core from storage to pick up any evolutionHistory entries
  // that logEvolutionEvent() may have written during this call.
  const freshCore = storage.getCompanionCore();
  const freshEl   = freshCore.evolutionLayer ?? {};
  freshCore.evolutionLayer = {
    ...freshEl,
    learnedPreferences:           prefs,
    recurringPatterns:            pats,
    favouriteActivities:          actFreqs,
    communicationStyleAdaptation: styleMap,
    growthLevel:                  freshEl.growthLevel ?? 0,
    // Preserve history written by logEvolutionEvent during this call
    evolutionHistory:             freshEl.evolutionHistory ?? [],
  };
  storage.saveCompanionCore(freshCore);
}

/**
 * updateGrowthLevel()
 * Recalculates growthLevel from current companionCore state.
 * Called after significant interactions.
 */
export function updateGrowthLevel() {
  const core = storage.getCompanionCore();
  const ag   = core.attachmentGraph ?? {};
  const el   = core.evolutionLayer  ?? {};
  const prev = el.growthLevel ?? 0;

  // Component contributions (all clamped to their max contribution)
  const interactionContrib  = Math.min(ag.interactionCount * GROWTH_WEIGHTS.interactionCount, 25);
  const resonanceContrib    = Math.min((ag.emotionalResonance / 100) * (GROWTH_WEIGHTS.emotionalResonance * 100), 15);
  const trustContrib        = Math.min((core.identity.trust  / 100) * (GROWTH_WEIGHTS.trust * 100), 20);

  // Consistency bonus: earned if emotionHistory has ≥5 entries (long-term use)
  const consistencyBonus    = (core.emotionHistory?.length ?? 0) >= 5
    ? GROWTH_WEIGHTS.consistency * 100
    : 0;

  const computed = clamp(
    Math.round(interactionContrib + resonanceContrib + trustContrib + consistencyBonus)
  );

  if (computed !== prev) {
    logEvolutionEvent(
      'growth_level_update',
      ADAPT_TYPE.RECALL,
      { growthLevel: prev },
      { growthLevel: computed }
    );
    patchEvolutionLayer({ growthLevel: computed });
  }

  return computed;
}

/**
 * applyPersonalityAdaptation(adaptationType, intensity)
 * Applies a safe, bounded personality shift.
 * Runs through validateAdaptation before committing.
 * Returns { applied: boolean, reason?, entry? }
 */
export function applyPersonalityAdaptation(adaptationType, intensity) {
  const core       = storage.getCompanionCore();
  const validation = validateAdaptation(adaptationType, intensity, core);

  if (!validation.safe) {
    // Log safety rejection
    logEvolutionEvent(
      'safety_rejection',
      adaptationType,
      { intensity },
      { rejected: true, reason: validation.reason }
    );
    console.warn('[IMMORTAIL][Evolution] Adaptation rejected:', validation.reason);
    return { applied: false, reason: validation.reason };
  }

  // Clamp intensity to safe range
  const safeIntensity = clamp(intensity, -MAX_ADAPT_INTENSITY, MAX_ADAPT_INTENSITY);
  const el = core.evolutionLayer ?? {};
  const styleMap = { ...(el.communicationStyleAdaptation ?? {}) };

  // Apply adaptation effect
  const prev = { ...styleMap };
  switch (adaptationType) {
    case ADAPT_TYPE.PLAYFULNESS:
      styleMap['playfulnessScore'] = clamp((styleMap['playfulnessScore'] ?? 50) + safeIntensity);
      break;
    case ADAPT_TYPE.WARMTH:
      styleMap['warmthScore'] = clamp((styleMap['warmthScore'] ?? 50) + safeIntensity);
      break;
    case ADAPT_TYPE.RECALL:
      styleMap['recallDepth'] = clamp((styleMap['recallDepth'] ?? 0) + safeIntensity);
      break;
    case ADAPT_TYPE.TONE_FAMILIARITY:
      styleMap['familiarityScore'] = clamp((styleMap['familiarityScore'] ?? 50) + safeIntensity);
      break;
    case ADAPT_TYPE.ACTIVITY_BIAS:
      styleMap['activityBiasScore'] = clamp((styleMap['activityBiasScore'] ?? 50) + safeIntensity);
      break;
  }

  core.evolutionLayer = { ...el, communicationStyleAdaptation: styleMap };
  storage.saveCompanionCore(core);

  const entry = logEvolutionEvent(
    `manual_adaptation`,
    adaptationType,
    prev,
    styleMap
  );

  EventBus.emit(EVENTS.DOG_UPDATED, {
    evolutionLayer: core.evolutionLayer,
  });

  return { applied: true, entry };
}

/**
 * getEvolutionContext()
 * Returns a safe snapshot for Ollama injection and UI display.
 */
export function getEvolutionContext() {
  const el = storage.getCompanionCore().evolutionLayer ?? {};
  return {
    learnedPreferences:           el.learnedPreferences           ?? {},
    recurringPatterns:            el.recurringPatterns            ?? {},
    favouriteActivities:          el.favouriteActivities          ?? [],
    communicationStyleAdaptation: el.communicationStyleAdaptation ?? {},
    growthLevel:                  el.growthLevel                  ?? 0,
    evolutionHistoryCount:        (el.evolutionHistory ?? []).length,
  };
}

/**
 * getEvolutionLayer()
 * Full layer read from SSOT.
 */
export function getEvolutionLayer() {
  return storage.getCompanionCore().evolutionLayer ?? {};
}

/**
 * getEvolutionHistory()
 * Returns the last N evolution events.
 */
export function getEvolutionHistory(limit = 20) {
  const el = storage.getCompanionCore().evolutionLayer ?? {};
  return (el.evolutionHistory ?? []).slice(-limit);
}

// ── Exported constants for tests ──────────────────────────────────
export { PREFERENCE_THRESHOLD, MAX_ADAPT_INTENSITY, GROWTH_WEIGHTS, UNSAFE_PATTERNS };
