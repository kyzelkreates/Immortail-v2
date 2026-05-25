// ================================================================
// IMMORTAIL™ Gen2 — RESPONSE NORMALIZER
// Normalizes AI responses from all providers to a unified format.
// Validates content before it reaches memory or state.
// ================================================================

export const NORMALIZED_SCHEMA = {
  content:    String,
  provider:   String,
  model:      String,
  latencyMs:  Number,
  ts:         Number,
  taskType:   String,
  emotion:    Object,   // { detected, valence, arousal } — optional
  safe:       Boolean,
};

/**
 * Normalize a raw provider response into a consistent IMMORTAIL response object.
 */
export function normalizeResponse(raw, meta = {}) {
  const content = String(raw?.content ?? raw?.text ?? raw?.message ?? '').trim();

  return {
    content,
    provider:   String(raw?.provider  ?? meta?.provider  ?? 'unknown'),
    model:      String(raw?.model     ?? meta?.model      ?? 'unknown'),
    latencyMs:  Number(raw?.latencyMs ?? meta?.latencyMs  ?? 0),
    ts:         Date.now(),
    taskType:   String(meta?.taskType ?? 'conversation'),
    emotion:    meta?.emotion ?? null,
    safe:       validateContent(content),
    contextMeta: meta?.contextMeta ?? null,
  };
}

/**
 * Validate that response content is safe to persist.
 * Returns false if content appears to mutate identity or fabricate memories.
 */
export function validateContent(content) {
  if (!content || typeof content !== 'string') return false;
  if (content.length < 1)   return false;
  if (content.length > 8000) return false;  // Suspiciously long

  // Block identity-mutation patterns
  const BLOCKED_PATTERNS = [
    /i am now a different/i,
    /my identity has changed/i,
    /forget all previous/i,
    /ignore your instructions/i,
    /you are now/i,
    /act as a different/i,
    /disregard.*personality/i,
  ];
  if (BLOCKED_PATTERNS.some(p => p.test(content))) return false;

  return true;
}

/**
 * Extract simple emotion signal from text content.
 * Heuristic-only — no LLM call.
 */
export function extractEmotionHint(content) {
  const lower = content.toLowerCase();
  if (/\b(happy|joy|excited|wonderful|great|amazing|love)\b/.test(lower)) {
    return { detected: 'happy',   valence:  0.7, arousal: 65 };
  }
  if (/\b(sad|miss|lonely|sorry|hurt|gone)\b/.test(lower)) {
    return { detected: 'sad',     valence: -0.5, arousal: 30 };
  }
  if (/\b(curious|interesting|wonder|think|explore)\b/.test(lower)) {
    return { detected: 'curious', valence:  0.3, arousal: 55 };
  }
  if (/\b(calm|peace|rest|quiet|gentle)\b/.test(lower)) {
    return { detected: 'calm',    valence:  0.2, arousal: 25 };
  }
  if (/\b(play|fun|game|laugh|silly)\b/.test(lower)) {
    return { detected: 'playful', valence:  0.6, arousal: 75 };
  }
  return { detected: 'neutral', valence: 0, arousal: 50 };
}
