// ================================================================
// IMMORTAIL™ Run 21 — VOICE EMOTION ANALYSIS
// Analyses transcript text + voice energy signals to detect emotion.
// Integrates results into memoryEngine + personalityEngine.
// NEVER calls AI providers directly — routes via aiRouter.
// ================================================================

import { EventBus }        from '../../core/eventBus.js';
import storage             from '../../core/storage.js';
import { recordMilestone } from '../ai/memoryEngine.js';
import { applyEmotionNudge } from '../ai/personalityEngine.js';
import { scheduleEmotionTag } from '../../workers/memoryWorker.js';
import { scheduleEmotionUpdate } from '../../workers/emotionWorker.js';

export const EMOTION_EVENTS = {
  DETECTED:  'SYSTEM::VOICE_EMOTION_DETECTED',
  SPIKE:     'SYSTEM::VOICE_EMOTION_SPIKE',
  CALM:      'SYSTEM::VOICE_EMOTION_CALM',
};

// ── Keyword-based emotion lexicon ─────────────────────────────

const EMOTION_LEXICON = {
  sad:       /\b(sad|crying|miss|lonely|hurt|broken|empty|lost|grief|tears|tired|exhausted|hopeless)\b/i,
  happy:     /\b(happy|excited|great|amazing|love|wonderful|joyful|fantastic|thrilled|awesome|grateful|laugh)\b/i,
  anxious:   /\b(anxious|worried|scared|nervous|afraid|panic|stress|overwhelmed|fear|terrified|dread)\b/i,
  angry:     /\b(angry|mad|frustrated|upset|furious|annoyed|hate|rage|irritated|infuriated)\b/i,
  calm:      /\b(calm|peaceful|relax|content|still|quiet|serene|ok|fine|alright|breathe|gentle)\b/i,
  curious:   /\b(curious|wonder|interesting|tell me|how|why|what if|explore|learn|question|fascinating)\b/i,
  comforting:/\b(thank you|thanks|help|please|appreciate|understand|feel better|safe|here)\b/i,
  urgent:    /\b(help|now|quickly|hurry|emergency|asap|immediately|urgent|fast|please hurry)\b/i,
};

const HESITATION_RE = /\b(um|uh|er|hmm|like|you know|i mean|sort of|kind of)\b/gi;

// ── Energy thresholds ──────────────────────────────────────────

const SPIKE_VALENCE_THRESHOLD  = 0.75;
const CALM_VALENCE_THRESHOLD   = 0.2;
const SPIKE_COOLDOWN_MS        = 30000;
let _lastSpikeTs               = 0;

// ── Public API ─────────────────────────────────────────────────

/**
 * Analyse text + optional voice energy metrics.
 * @param {string} transcript
 * @param {object} voiceMeta { level, speechRate, pauseCount, duration }
 * @returns {EmotionResult}
 */
export function analyseText(transcript, voiceMeta = {}) {
  if (!transcript?.trim()) return _neutral();

  const scores = _scoreEmotions(transcript);
  const topEmotion = _topEmotion(scores);
  const hesitation = _countHesitation(transcript);
  const valence    = _computeValence(scores, voiceMeta);
  const arousal    = _computeArousal(scores, voiceMeta, hesitation);

  const result = {
    detected:   topEmotion,
    scores,
    valence,
    arousal,
    hesitation,
    voiceMeta,
    confidence: scores[topEmotion] ?? 0,
    ts:         Date.now(),
  };

  _persistAndPropagate(result, transcript);
  return result;
}

/**
 * Analyse a completed voice utterance.
 * Called by voiceConversationWorker after each user turn.
 */
export function analyseUtterance(transcript, voiceMeta = {}) {
  const result = analyseText(transcript, voiceMeta);

  // Check for emotional spikes — create memory milestone if significant
  if (result.valence >= SPIKE_VALENCE_THRESHOLD || result.arousal >= 80) {
    const now = Date.now();
    if (now - _lastSpikeTs > SPIKE_COOLDOWN_MS) {
      _lastSpikeTs = now;
      EventBus.emit(EMOTION_EVENTS.SPIKE, { emotion: result.detected, valence: result.valence });
      recordMilestone(
        `Emotional moment: ${result.detected}`,
        transcript.slice(0, 100),
      );
      storage.appendVoiceMemory({
        type:      'emotional_spike',
        emotion:   result.detected,
        valence:   result.valence,
        arousal:   result.arousal,
        snippet:   transcript.slice(0, 120),
      });
    }
  }

  // Calm / comforting interaction tagging
  if (result.detected === 'calm' || result.detected === 'comforting') {
    if (result.valence < CALM_VALENCE_THRESHOLD) {
      EventBus.emit(EMOTION_EVENTS.CALM, { emotion: result.detected });
      storage.appendVoiceMemory({
        type:    'calming_moment',
        emotion: result.detected,
        snippet: transcript.slice(0, 120),
      });
    }
  }

  return result;
}

// ── Scoring ────────────────────────────────────────────────────

function _scoreEmotions(text) {
  const scores = {};
  for (const [emotion, pattern] of Object.entries(EMOTION_LEXICON)) {
    const matches = text.match(pattern);
    scores[emotion] = matches ? Math.min(1, matches.length * 0.25) : 0;
  }
  return scores;
}

function _topEmotion(scores) {
  let top = 'neutral', best = 0;
  for (const [e, s] of Object.entries(scores)) {
    if (s > best) { best = s; top = e; }
  }
  return top;
}

function _countHesitation(text) {
  const matches = text.match(HESITATION_RE);
  return matches ? matches.length : 0;
}

function _computeValence(scores, voiceMeta) {
  const positive = (scores.happy ?? 0) + (scores.calm ?? 0) + (scores.comforting ?? 0);
  const negative = (scores.sad ?? 0) + (scores.anxious ?? 0) + (scores.angry ?? 0);
  const base     = Math.max(-1, Math.min(1, positive - negative));
  // Boost from mic energy if available
  const energyBoost = voiceMeta.level ? (voiceMeta.level - 0.5) * 0.2 : 0;
  return Math.max(0, Math.min(1, (base + 1) / 2 + energyBoost));
}

function _computeArousal(scores, voiceMeta, hesitation) {
  const high = (scores.excited ?? 0) + (scores.urgent ?? 0) + (scores.angry ?? 0);
  const low  = (scores.calm ?? 0) + (scores.sad ?? 0);
  const base = Math.max(0, Math.min(1, high - low));
  // Speaking rate boost
  const rateBoost = voiceMeta.speechRate ? Math.min(0.2, (voiceMeta.speechRate - 130) / 500) : 0;
  // Hesitation lowers arousal
  const hesitationPenalty = Math.min(0.15, hesitation * 0.03);
  return Math.round(Math.max(5, Math.min(100, (base + rateBoost - hesitationPenalty) * 100)));
}

function _neutral() {
  return { detected: 'neutral', scores: {}, valence: 0.5, arousal: 30, hesitation: 0, confidence: 0, ts: Date.now() };
}

// ── Persist + propagate to worker systems ─────────────────────

function _persistAndPropagate(result, transcript) {
  storage.appendVoiceEmotion(result);

  // Feed into memory worker for tagging
  scheduleEmotionTag(transcript, 'voice_utterance');

  // Feed into emotion worker for companion state update
  scheduleEmotionUpdate(result);

  // Personality engine nudge
  applyEmotionNudge({ emotion: result });

  EventBus.emit(EMOTION_EVENTS.DETECTED, { result });
}
