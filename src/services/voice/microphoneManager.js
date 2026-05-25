// ================================================================
// IMMORTAIL™ Run 21 — MICROPHONE MANAGER
// Single source of truth for microphone state + stream.
// All voice systems obtain the stream ONLY from here.
// Prevents duplicate getUserMedia calls.
// ================================================================

import { EventBus } from '../../core/eventBus.js';
import storage      from '../../core/storage.js';

export const MIC_EVENTS = {
  GRANTED:   'SYSTEM::MIC_GRANTED',
  DENIED:    'SYSTEM::MIC_DENIED',
  STOPPED:   'SYSTEM::MIC_STOPPED',
  ERROR:     'SYSTEM::MIC_ERROR',
  LEVEL:     'SYSTEM::MIC_LEVEL',
};

const _state = {
  stream:      null,
  context:     null,
  analyser:    null,
  source:      null,
  levelTimer:  null,
  permitted:   false,
  active:      false,
  sensitivity: 1.0,
  deviceId:    null,
};

export function getMicState() {
  return {
    active:    _state.active,
    permitted: _state.permitted,
    deviceId:  _state.deviceId,
  };
}

export function getStream() { return _state.stream; }
export function getAnalyser() { return _state.analyser; }
export function getAudioContext() { return _state.context; }

// ── Request + start ─────────────────────────────────────────────

export async function requestMicrophone(options = {}) {
  if (_state.active && _state.stream) return _state.stream;

  const settings = storage.getVoiceSettings();
  const deviceId = options.deviceId ?? settings.preferredDeviceId ?? undefined;

  const constraints = {
    audio: {
      channelCount:       1,
      sampleRate:         16000,
      echoCancellation:   true,
      noiseSuppression:   true,
      autoGainControl:    true,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    },
  };

  try {
    const stream  = await navigator.mediaDevices.getUserMedia(constraints);
    _state.stream = stream;
    _state.active = true;
    _state.permitted = true;
    _state.deviceId  = deviceId ?? null;

    _buildAnalyser(stream);
    _startLevelMonitor();

    EventBus.emit(MIC_EVENTS.GRANTED, { deviceId: _state.deviceId });
    return stream;

  } catch (err) {
    _state.permitted = false;
    _state.active    = false;
    EventBus.emit(MIC_EVENTS.DENIED, { error: err.message });
    throw err;
  }
}

export function stopMicrophone() {
  if (_state.levelTimer) { clearInterval(_state.levelTimer); _state.levelTimer = null; }
  if (_state.source)   { try { _state.source.disconnect();   } catch {} _state.source   = null; }
  if (_state.analyser) { try { _state.analyser.disconnect(); } catch {} _state.analyser = null; }
  if (_state.context)  { try { _state.context.close();       } catch {} _state.context  = null; }
  if (_state.stream) {
    _state.stream.getTracks().forEach(t => t.stop());
    _state.stream = null;
  }
  _state.active = false;
  EventBus.emit(MIC_EVENTS.STOPPED, {});
}

export function setSensitivity(val) {
  _state.sensitivity = Math.max(0.1, Math.min(3.0, val));
  storage.patchVoiceSettings({ sensitivity: _state.sensitivity });
}

// ── Audio level analysis ────────────────────────────────────────

function _buildAnalyser(stream) {
  try {
    const ctx     = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    const source  = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    _state.context  = ctx;
    _state.source   = source;
    _state.analyser = analyser;
  } catch (e) {
    console.warn('[MicManager] Analyser build failed:', e.message);
  }
}

function _startLevelMonitor() {
  if (_state.levelTimer) clearInterval(_state.levelTimer);
  _state.levelTimer = setInterval(() => {
    if (!_state.analyser) return;
    const buf = new Uint8Array(_state.analyser.frequencyBinCount);
    _state.analyser.getByteFrequencyData(buf);
    const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);
    const level = Math.min(1, (rms / 128) * _state.sensitivity);
    EventBus.emit(MIC_EVENTS.LEVEL, { level });
  }, 80);
}

// ── Device enumeration ──────────────────────────────────────────

export async function listAudioDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'audioinput');
  } catch {
    return [];
  }
}
