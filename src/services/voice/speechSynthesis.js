// ================================================================
// IMMORTAIL™ Run 21 — SPEECH SYNTHESIS (TTS)
// Emotional voice synthesis. Browser SpeechSynthesis primary.
// Provider TTS (OpenAI/Groq) as premium fallback.
// Mood-aware: warmth, cadence, pause, whisper, comfort modes.
// ================================================================

import { EventBus } from '../../core/eventBus.js';
import storage      from '../../core/storage.js';
import { getProvidersByPriority } from '../ai/providerRegistry.js';

export const TTS_EVENTS = {
  STARTED:    'SYSTEM::TTS_STARTED',
  ENDED:      'SYSTEM::TTS_ENDED',
  PAUSED:     'SYSTEM::TTS_PAUSED',
  RESUMED:    'SYSTEM::TTS_RESUMED',
  INTERRUPTED:'SYSTEM::TTS_INTERRUPTED',
  ERROR:      'SYSTEM::TTS_ERROR',
  WORD:       'SYSTEM::TTS_WORD',
};

const EMOTION_VOICE_MAP = {
  happy:    { rate: 1.05, pitch: 1.10, volume: 0.95 },
  excited:  { rate: 1.15, pitch: 1.15, volume: 1.00 },
  sad:      { rate: 0.88, pitch: 0.90, volume: 0.80 },
  calm:     { rate: 0.92, pitch: 0.98, volume: 0.88 },
  curious:  { rate: 1.00, pitch: 1.05, volume: 0.90 },
  comfort:  { rate: 0.85, pitch: 0.95, volume: 0.82 },
  whisper:  { rate: 0.80, pitch: 0.90, volume: 0.60 },
  neutral:  { rate: 0.95, pitch: 1.00, volume: 0.90 },
};

const BREATHING_PAUSE_RE = /([.!?])\s+/g;
const MAX_CHUNK_LEN      = 200; // SpeechSynthesis struggles with long strings

let _speaking    = false;
let _interrupted = false;
let _queue       = [];
let _currentUtterance = null;
let _audioEl     = null; // for provider TTS audio

export function isSpeaking()    { return _speaking; }
export function isInterrupted() { return _interrupted; }

// ─── Primary speak entry ────────────────────────────────────────

export async function speak(text, options = {}) {
  if (!text?.trim()) return;
  const settings = storage.getVoiceSettings();
  const emotion  = options.emotion ?? settings.currentEmotion ?? 'neutral';
  const mode     = settings.ttsMode ?? 'browser'; // 'browser' | 'openai' | 'groq'

  if (mode !== 'browser') {
    return _speakProvider(text, emotion, options, mode);
  }
  return _speakBrowser(text, emotion, options);
}

export function interrupt() {
  _interrupted  = true;
  _speaking     = false;
  _queue        = [];
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  if (_audioEl) { _audioEl.pause(); _audioEl = null; }
  _currentUtterance = null;
  EventBus.emit(TTS_EVENTS.INTERRUPTED, {});
}

export function pause() {
  if (typeof window !== 'undefined' && window.speechSynthesis?.speaking) {
    window.speechSynthesis.pause();
    EventBus.emit(TTS_EVENTS.PAUSED, {});
  }
}

export function resume() {
  if (typeof window !== 'undefined' && window.speechSynthesis?.paused) {
    window.speechSynthesis.resume();
    EventBus.emit(TTS_EVENTS.RESUMED, {});
  }
}

// ─── Browser TTS ───────────────────────────────────────────────

function _speakBrowser(text, emotion, options = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    EventBus.emit(TTS_EVENTS.ERROR, { code: 'no_browser_tts' });
    return;
  }

  // Insert subtle breathing pauses
  const withPauses = text.replace(BREATHING_PAUSE_RE, '$1 ');
  const chunks     = _chunkText(withPauses, MAX_CHUNK_LEN);
  const params     = EMOTION_VOICE_MAP[emotion] ?? EMOTION_VOICE_MAP.neutral;
  const settings   = storage.getVoiceSettings();

  _interrupted = false;
  _speaking    = true;

  const allVoices  = window.speechSynthesis.getVoices();
  const voice      = _selectVoice(allVoices, settings);

  EventBus.emit(TTS_EVENTS.STARTED, { emotion, chunks: chunks.length });
  _persistTranscript(text, emotion);

  let chunkIdx = 0;
  const speakNext = () => {
    if (_interrupted || chunkIdx >= chunks.length) {
      _speaking = false;
      if (!_interrupted) EventBus.emit(TTS_EVENTS.ENDED, { emotion });
      return;
    }
    const utt = new SpeechSynthesisUtterance(chunks[chunkIdx]);
    utt.rate   = (params.rate   * (options.rateMultiplier   ?? 1));
    utt.pitch  = (params.pitch  * (options.pitchMultiplier  ?? 1));
    utt.volume = (params.volume * (options.volumeMultiplier ?? 1));
    utt.lang   = settings.language ?? 'en-US';
    if (voice) utt.voice = voice;

    utt.onboundary = (e) => {
      if (e.name === 'word') EventBus.emit(TTS_EVENTS.WORD, { word: e.target.text.slice(e.charIndex) });
    };

    utt.onend = () => { chunkIdx++; speakNext(); };
    utt.onerror = (e) => {
      if (e.error !== 'interrupted') {
        EventBus.emit(TTS_EVENTS.ERROR, { code: e.error });
      }
      _speaking = false;
    };

    _currentUtterance = utt;
    window.speechSynthesis.speak(utt);
  };

  // iOS Safari fix — speak() must be after resuming
  if (window.speechSynthesis.paused) window.speechSynthesis.resume();
  speakNext();
}

// ─── Provider TTS (OpenAI/Groq) ────────────────────────────────

async function _speakProvider(text, emotion, options, mode) {
  const providers = getProvidersByPriority().filter(p =>
    p.enabled && p.typeId === mode && p.apiKey
  );
  if (providers.length === 0) {
    // Fallback to browser
    return _speakBrowser(text, emotion, options);
  }

  const provider = providers[0];
  const endpoint = `${provider.baseUrl}/audio/speech`;
  const settings = storage.getVoiceSettings();

  const VOICE_MAP = { calm: 'nova', happy: 'shimmer', sad: 'onyx', neutral: 'nova', comfort: 'nova' };
  const voice = settings.preferredProviderVoice ?? VOICE_MAP[emotion] ?? 'nova';

  _speaking    = true;
  _interrupted = false;
  EventBus.emit(TTS_EVENTS.STARTED, { emotion, mode });
  _persistTranscript(text, emotion);

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice,
        response_format: 'mp3',
      }),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob  = await resp.blob();
    const url   = URL.createObjectURL(blob);
    const audio = new Audio(url);
    _audioEl    = audio;

    audio.onended = () => {
      _speaking = false;
      URL.revokeObjectURL(url);
      _audioEl = null;
      EventBus.emit(TTS_EVENTS.ENDED, { emotion, mode });
    };

    audio.onerror = () => {
      _speaking = false;
      EventBus.emit(TTS_EVENTS.ERROR, { code: 'audio_playback' });
    };

    if (!_interrupted) audio.play();

  } catch (err) {
    console.warn('[TTS] Provider error, falling back to browser:', err.message);
    _speaking = false;
    _speakBrowser(text, emotion, options);
  }
}

// ─── Voice selection ────────────────────────────────────────────

function _selectVoice(allVoices, settings) {
  if (!allVoices || allVoices.length === 0) return null;

  // 1. User's explicitly preferred voice
  if (settings.preferredVoiceName) {
    const preferred = allVoices.find(v => v.name === settings.preferredVoiceName);
    if (preferred) return preferred;
  }

  // 2. Prefer female en voices — warmer for companion
  const femaleEn = allVoices.filter(v =>
    v.lang?.startsWith('en') &&
    /samantha|victoria|fiona|karen|moira|ava|zoe|female/i.test(v.name)
  );
  if (femaleEn.length > 0) return femaleEn[0];

  // 3. Any English voice
  const anyEn = allVoices.filter(v => v.lang?.startsWith('en'));
  if (anyEn.length > 0) return anyEn[0];

  return allVoices[0];
}

// ─── Helpers ───────────────────────────────────────────────────

function _chunkText(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  const chunks = [];
  let current  = '';
  for (const s of sentences) {
    if (current.length + s.length > maxLen) {
      if (current.trim()) chunks.push(current.trim());
      current = s;
    } else {
      current += ' ' + s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function _persistTranscript(text, emotion) {
  storage.appendVoiceTranscript({ text, emotion, role: 'assistant' });
}

export function getAvailableVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
}
