// ================================================================
// IMMORTAIL™ Run 21 — SPEECH RECOGNITION
// Realtime STT using browser Web Speech API (primary)
// + provider API fallback (Groq Whisper / OpenAI Whisper).
// Routes via aiRouter for provider calls — never direct.
// ================================================================

import { EventBus }         from '../../core/eventBus.js';
import storage              from '../../core/storage.js';
import { getStream }        from './microphoneManager.js';
import { buildWavBlob, concatenateFloat32, trimSilence, normalizeGain } from './audioNormalizer.js';
import { getProvidersByPriority } from '../ai/providerRegistry.js';

export const STT_EVENTS = {
  PARTIAL:      'SYSTEM::STT_PARTIAL',
  FINAL:        'SYSTEM::STT_FINAL',
  ERROR:        'SYSTEM::STT_ERROR',
  STARTED:      'SYSTEM::STT_STARTED',
  STOPPED:      'SYSTEM::STT_STOPPED',
};

let _recognition  = null;   // WebSpeech instance
let _recorder     = null;   // MediaRecorder instance
let _audioChunks  = [];     // collected chunks for API STT
let _isRunning    = false;
let _mode         = 'web';  // 'web' | 'api'
let _lang         = 'en-US';
let _partialText  = '';
let _confidence   = 0;

// ─── Initialise / detect capabilities ──────────────────────────

export function detectSTTMode() {
  const hasWeb = typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);
  const settings = storage.getVoiceSettings();
  if (settings.forceAPITranscription) return 'api';
  return hasWeb ? 'web' : 'api';
}

export function isRunning() { return _isRunning; }
export function getMode()   { return _mode; }

// ─── Start ─────────────────────────────────────────────────────

export function startRecognition(options = {}) {
  if (_isRunning) return;
  _lang    = options.lang ?? storage.getVoiceSettings().language ?? 'en-US';
  _mode    = options.mode ?? detectSTTMode();
  _isRunning = true;

  if (_mode === 'web') {
    _startWebSpeech();
  } else {
    _startRecorder();
  }

  EventBus.emit(STT_EVENTS.STARTED, { mode: _mode });
}

export function stopRecognition(options = {}) {
  if (!_isRunning) return;
  _isRunning = false;

  if (_mode === 'web') {
    if (_recognition) { _recognition.stop(); _recognition = null; }
  } else {
    if (_recorder && _recorder.state !== 'inactive') {
      _recorder.stop();
    }
  }

  EventBus.emit(STT_EVENTS.STOPPED, {});
}

export function getPartialTranscript() { return _partialText; }

// ─── Web Speech (browser-native, zero-cost) ────────────────────

function _startWebSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { _mode = 'api'; _startRecorder(); return; }

  const r = new SpeechRecognition();
  r.lang               = _lang;
  r.continuous         = true;
  r.interimResults     = true;
  r.maxAlternatives    = 1;
  _recognition         = r;

  r.onresult = (event) => {
    let partial = '', final = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const txt = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        final      += txt;
        _confidence = event.results[i][0].confidence ?? 0.9;
      } else {
        partial += txt;
      }
    }
    if (partial) {
      _partialText = partial;
      EventBus.emit(STT_EVENTS.PARTIAL, { text: partial, confidence: 0 });
    }
    if (final.trim()) {
      _partialText = '';
      const corrected = _applyCorrections(final.trim());
      _persistTranscript(corrected, _confidence);
      EventBus.emit(STT_EVENTS.FINAL, { text: corrected, confidence: _confidence, raw: final });
    }
  };

  r.onerror = (event) => {
    console.warn('[STT] Web Speech error:', event.error);
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      EventBus.emit(STT_EVENTS.ERROR, { code: event.error, fatal: true });
    } else {
      // Non-fatal — restart
      if (_isRunning) { setTimeout(() => _startWebSpeech(), 500); }
    }
  };

  r.onend = () => {
    if (_isRunning) setTimeout(() => _startWebSpeech(), 300); // auto-restart
  };

  try { r.start(); } catch {}
}

// ─── API-based STT (MediaRecorder → WAV → Whisper) ────────────

function _startRecorder() {
  const stream = getStream();
  if (!stream) { EventBus.emit(STT_EVENTS.ERROR, { code: 'no_stream', fatal: true }); return; }

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus' : 'audio/webm';

  _audioChunks = [];
  _recorder    = new MediaRecorder(stream, { mimeType });

  _recorder.ondataavailable = (e) => {
    if (e.data.size > 0) _audioChunks.push(e.data);
  };

  _recorder.onstop = async () => {
    if (_audioChunks.length > 0) {
      await _sendToWhisper(_audioChunks);
      _audioChunks = [];
    }
    if (_isRunning) _startRecorder(); // loop
  };

  _recorder.start();
  // Stop every 5s to batch-send — gives ~5s latency segments
  setTimeout(() => {
    if (_recorder && _recorder.state === 'recording') _recorder.stop();
  }, 5000);
}

async function _sendToWhisper(chunks) {
  const blob = new Blob(chunks, { type: 'audio/webm' });

  // Find an API provider that supports audio
  const providers = getProvidersByPriority().filter(p =>
    p.enabled && ['groq', 'openai'].includes(p.typeId) && p.apiKey
  );

  if (providers.length === 0) {
    EventBus.emit(STT_EVENTS.ERROR, { code: 'no_provider', fatal: false });
    return;
  }

  const provider = providers[0];
  const endpoint = provider.typeId === 'groq'
    ? 'https://api.groq.com/openai/v1/audio/transcriptions'
    : `${provider.baseUrl}/audio/transcriptions`;

  try {
    const formData = new FormData();
    formData.append('file', blob, 'audio.webm');
    formData.append('model', provider.typeId === 'groq' ? 'whisper-large-v3' : 'whisper-1');
    formData.append('language', _lang.split('-')[0]);
    formData.append('response_format', 'json');

    const resp = await fetch(endpoint, {
      method:  'POST',
      headers: { Authorization: `Bearer ${provider.apiKey}` },
      body:    formData,
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (data.text?.trim()) {
      const corrected = _applyCorrections(data.text.trim());
      _persistTranscript(corrected, 0.95);
      EventBus.emit(STT_EVENTS.FINAL, { text: corrected, confidence: 0.95, provider: provider.name });
    }
  } catch (err) {
    console.warn('[STT] Whisper API error:', err.message);
    EventBus.emit(STT_EVENTS.ERROR, { code: 'api_error', error: err.message, fatal: false });
  }
}

// ─── Helpers ───────────────────────────────────────────────────

function _applyCorrections(text) {
  // Basic punctuation restoration — capitalise first char
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function _persistTranscript(text, confidence) {
  storage.appendVoiceTranscript({ text, confidence, lang: _lang, role: 'user' });
}
