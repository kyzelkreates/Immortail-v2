// ================================================================
// IMMORTAIL™ Run 21 — SILENCE DETECTION
// Detects end-of-utterance from microphone level stream.
// Feeds voiceStreamManager — never accessed directly from UI.
// ================================================================

import { EventBus } from '../../core/eventBus.js';
import storage      from '../../core/storage.js';

export const SILENCE_EVENTS = {
  SPEECH_START:  'SYSTEM::VOICE_SPEECH_START',
  SPEECH_END:    'SYSTEM::VOICE_SPEECH_END',
  SILENCE_TICK:  'SYSTEM::VOICE_SILENCE_TICK',
};

const DEFAULTS = {
  silenceThreshold:  0.04,   // level below which we call it silence
  speechThreshold:   0.08,   // level above which speech is detected
  silenceDebounceMs: 900,     // must stay silent this long before declaring end
  minSpeechMs:       200,     // ignore sub-200ms bursts
  maxUtteranceMs:    30000,   // auto-end utterances after 30s
};

let _cfg        = { ...DEFAULTS };
let _isSpeaking = false;
let _silenceStart = null;
let _speechStart  = null;
let _silenceTimer  = null;
let _maxTimer      = null;
let _listening     = false;
let _unsubLevel    = null;

export function configure(overrides = {}) {
  _cfg = { ..._cfg, ...overrides };
  const s = storage.getVoiceSettings();
  if (s.silenceThreshold) _cfg.silenceThreshold = s.silenceThreshold;
  if (s.silenceDebounceMs) _cfg.silenceDebounceMs = s.silenceDebounceMs;
}

export function startListening() {
  if (_listening) return;
  _listening  = true;
  _isSpeaking = false;
  configure();
  _unsubLevel = EventBus.on('SYSTEM::MIC_LEVEL', ({ level }) => _handleLevel(level));
}

export function stopListening() {
  _listening = false;
  _clearTimers();
  if (_unsubLevel) { _unsubLevel(); _unsubLevel = null; }
  if (_isSpeaking) {
    _isSpeaking = false;
    EventBus.emit(SILENCE_EVENTS.SPEECH_END, { forced: true });
  }
}

export function isCurrentlySpeaking() { return _isSpeaking; }

// ── Core level handler ─────────────────────────────────────────

function _handleLevel(level) {
  if (!_listening) return;

  if (!_isSpeaking && level >= _cfg.speechThreshold) {
    // Speech just started
    _speechStart = Date.now();
    _silenceStart = null;
    _clearTimers();
    _maxTimer = setTimeout(() => {
      if (_isSpeaking) _declareSpeechEnd('max_duration');
    }, _cfg.maxUtteranceMs);

    // Only declare speech after minSpeechMs to avoid clicks/pops
    setTimeout(() => {
      if (level >= _cfg.speechThreshold) {
        _isSpeaking = true;
        EventBus.emit(SILENCE_EVENTS.SPEECH_START, { ts: _speechStart });
      }
    }, _cfg.minSpeechMs);

  } else if (_isSpeaking && level < _cfg.silenceThreshold) {
    // Potential end of speech
    if (!_silenceStart) {
      _silenceStart = Date.now();
    }
    const silenceDuration = Date.now() - _silenceStart;
    EventBus.emit(SILENCE_EVENTS.SILENCE_TICK, { duration: silenceDuration });

    if (!_silenceTimer) {
      _silenceTimer = setTimeout(() => {
        if (_isSpeaking) _declareSpeechEnd('silence_debounce');
      }, _cfg.silenceDebounceMs);
    }

  } else if (_isSpeaking && level >= _cfg.speechThreshold) {
    // Back above threshold — reset silence window
    _silenceStart = null;
    _clearSilenceTimer();
  }
}

function _declareSpeechEnd(reason) {
  if (!_isSpeaking) return;
  _isSpeaking   = false;
  _silenceStart = null;
  _clearTimers();
  EventBus.emit(SILENCE_EVENTS.SPEECH_END, {
    duration: _speechStart ? Date.now() - _speechStart : 0,
    reason,
  });
}

function _clearSilenceTimer() {
  if (_silenceTimer) { clearTimeout(_silenceTimer); _silenceTimer = null; }
}

function _clearTimers() {
  _clearSilenceTimer();
  if (_maxTimer) { clearTimeout(_maxTimer); _maxTimer = null; }
}
