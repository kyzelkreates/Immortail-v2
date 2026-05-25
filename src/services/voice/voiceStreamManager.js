// ================================================================
// IMMORTAIL™ Run 21 — VOICE STREAM MANAGER
// Orchestrates the full realtime conversation loop:
//   mic → STT → aiRouter → TTS → companion reaction
// Single state machine — prevents duplicate loops.
// ================================================================

import { EventBus }        from '../../core/eventBus.js';
import storage             from '../../core/storage.js';
import { requestMicrophone, stopMicrophone } from './microphoneManager.js';
import { startRecognition, stopRecognition } from './speechRecognition.js';
import { startListening as startSilence, stopListening as stopSilence } from './silenceDetection.js';
import { speak, interrupt as interruptTTS, isSpeaking } from './speechSynthesis.js';
import { analyseUtterance }                              from './emotionAnalysis.js';
import { send as aiSend }                                from '../ai/aiRouter.js';

export const STREAM_EVENTS = {
  SESSION_STARTED:  'SYSTEM::VOICE_SESSION_STARTED',
  SESSION_ENDED:    'SYSTEM::VOICE_SESSION_ENDED',
  TURN_START:       'SYSTEM::VOICE_TURN_START',
  TURN_END:         'SYSTEM::VOICE_TURN_END',
  AI_THINKING:      'SYSTEM::VOICE_AI_THINKING',
  AI_RESPONDING:    'SYSTEM::VOICE_AI_RESPONDING',
  INTERRUPTED:      'SYSTEM::VOICE_INTERRUPTED',
  ERROR:            'SYSTEM::VOICE_STREAM_ERROR',
};

export const SESSION_STATE = {
  IDLE:       'idle',
  LISTENING:  'listening',
  PROCESSING: 'processing',
  SPEAKING:   'speaking',
  PAUSED:     'paused',
  ERROR:      'error',
};

const _session = {
  state:       SESSION_STATE.IDLE,
  id:          null,
  startedAt:   null,
  turnCount:   0,
  mode:        'auto',   // 'auto' | 'push'
  unsubs:      [],
  activeTranscript: '',
  voiceMetaAccum:   { level: 0, pauseCount: 0, speechRate: 140 },
};

export function getSessionState()  { return { ..._session, unsubs: undefined }; }
export function isSessionActive()  { return _session.state !== SESSION_STATE.IDLE && _session.state !== SESSION_STATE.ERROR; }

// ─── Start / Stop session ──────────────────────────────────────

export async function startVoiceSession(options = {}) {
  if (isSessionActive()) return;

  _session.id        = `vs_${Date.now()}`;
  _session.startedAt = Date.now();
  _session.turnCount = 0;
  _session.mode      = options.mode ?? 'auto';

  try {
    await requestMicrophone();
  } catch (err) {
    _setError('mic_denied');
    return;
  }

  _setState(SESSION_STATE.LISTENING);
  _subscribeEvents();

  if (_session.mode === 'auto') {
    startRecognition();
    startSilence();
  }

  storage.patchVoiceSession({
    id: _session.id, startedAt: _session.startedAt, state: SESSION_STATE.LISTENING,
  });

  EventBus.emit(STREAM_EVENTS.SESSION_STARTED, { id: _session.id, mode: _session.mode });
}

export function stopVoiceSession() {
  _cleanup();
  _setState(SESSION_STATE.IDLE);
  storage.patchVoiceSession({ state: SESSION_STATE.IDLE, endedAt: Date.now() });
  EventBus.emit(STREAM_EVENTS.SESSION_ENDED, { id: _session.id, turns: _session.turnCount });
}

export function pauseVoiceSession() {
  if (!isSessionActive()) return;
  stopSilence();
  stopRecognition();
  _setState(SESSION_STATE.PAUSED);
}

export function resumeVoiceSession() {
  if (_session.state !== SESSION_STATE.PAUSED) return;
  startRecognition();
  startSilence();
  _setState(SESSION_STATE.LISTENING);
}

// ─── Push-to-talk ──────────────────────────────────────────────

export function pushToTalkStart() {
  if (_session.mode !== 'push') return;
  if (isSpeaking()) interruptTTS();
  startRecognition();
  _setState(SESSION_STATE.LISTENING);
}

export function pushToTalkEnd() {
  if (_session.mode !== 'push') return;
  stopRecognition();
  // Give 500ms for final STT event to arrive
  setTimeout(() => {
    if (_session.activeTranscript.trim()) {
      _handleUtteranceEnd(_session.activeTranscript);
    }
  }, 500);
}

// ─── Event wiring ──────────────────────────────────────────────

function _subscribeEvents() {
  _session.unsubs = [
    EventBus.on('SYSTEM::STT_PARTIAL',    ({ text }) => { _session.activeTranscript = text; }),
    EventBus.on('SYSTEM::STT_FINAL',      ({ text }) => _handleFinalTranscript(text)),
    EventBus.on('SYSTEM::VOICE_SPEECH_END', () => {
      if (_session.mode === 'auto' && _session.activeTranscript.trim()) {
        _handleUtteranceEnd(_session.activeTranscript);
      }
    }),
    EventBus.on('SYSTEM::MIC_LEVEL', ({ level }) => {
      _session.voiceMetaAccum.level = level;
    }),
    EventBus.on('SYSTEM::TTS_ENDED', () => {
      if (isSessionActive()) {
        _setState(SESSION_STATE.LISTENING);
        if (_session.mode === 'auto') {
          startRecognition();
          startSilence();
        }
      }
    }),
    EventBus.on('SYSTEM::TTS_INTERRUPTED', () => {
      EventBus.emit(STREAM_EVENTS.INTERRUPTED, {});
    }),
  ];
}

function _handleFinalTranscript(text) {
  _session.activeTranscript = text;
}

async function _handleUtteranceEnd(transcript) {
  if (_session.state !== SESSION_STATE.LISTENING) return;
  if (!transcript?.trim()) return;

  _session.activeTranscript = '';
  _session.turnCount++;

  stopRecognition();
  stopSilence();

  // Analyse emotion BEFORE sending to AI (so context is enriched)
  const emotion = analyseUtterance(transcript, _session.voiceMetaAccum);
  _session.voiceMetaAccum = { level: 0, pauseCount: 0, speechRate: 140 };

  _setState(SESSION_STATE.PROCESSING);
  EventBus.emit(STREAM_EVENTS.TURN_START,    { transcript, emotion });
  EventBus.emit(STREAM_EVENTS.AI_THINKING,   {});

  try {
    const response = await aiSend(transcript, {
      taskType:      'conversation',
      includeEmotion: true,
      includeMemory:  true,
      voiceEmotion:   emotion,
    });

    if (!isSessionActive()) return; // stopped while waiting

    _setState(SESSION_STATE.SPEAKING);
    EventBus.emit(STREAM_EVENTS.AI_RESPONDING, { text: response.content, emotion: response.emotion });

    await speak(response.content, {
      emotion: response.emotion?.detected ?? emotion.detected ?? 'neutral',
    });

    EventBus.emit(STREAM_EVENTS.TURN_END, {
      transcript,
      response: response.content,
      emotion,
    });

  } catch (err) {
    console.error('[VoiceStream] Turn failed:', err.message);
    _setError('turn_failed');
    // Recover — go back to listening
    setTimeout(() => {
      if (isSessionActive()) {
        _setState(SESSION_STATE.LISTENING);
        startRecognition();
        startSilence();
      }
    }, 1500);
  }
}

// ─── Helpers ───────────────────────────────────────────────────

function _setState(state) {
  _session.state = state;
  storage.patchVoiceSession({ state });
  EventBus.emit('SYSTEM::VOICE_STATE_CHANGED', { state });
}

function _setError(code) {
  _session.state = SESSION_STATE.ERROR;
  storage.patchVoiceSession({ state: SESSION_STATE.ERROR, errorCode: code });
  EventBus.emit(STREAM_EVENTS.ERROR, { code });
}

function _cleanup() {
  _session.unsubs.forEach(u => u());
  _session.unsubs = [];
  stopSilence();
  stopRecognition();
  stopMicrophone();
  if (isSpeaking()) interruptTTS();
}
