// ================================================================
// IMMORTAIL™ Run 21 — VOICE ROUTER
// Thin public façade for all voice operations.
// UI and agents call ONLY this module — never sub-services directly.
// Mirrors aiRouter pattern for consistency.
// ================================================================

import storage from '../../core/storage.js';
import { EventBus } from '../../core/eventBus.js';
import {
  startVoiceSession,  stopVoiceSession,
  pauseVoiceSession,  resumeVoiceSession,
  pushToTalkStart,    pushToTalkEnd,
  getSessionState,    isSessionActive,
  SESSION_STATE,
} from './voiceStreamManager.js';
import { speak, interrupt, isSpeaking, getAvailableVoices } from './speechSynthesis.js';
import { requestMicrophone, getMicState, listAudioDevices } from './microphoneManager.js';
import { detectSTTMode } from './speechRecognition.js';
import { analyseText }   from './emotionAnalysis.js';

// ── Session control ──────────────────────────────────────────

export const startSession  = (opts)  => startVoiceSession(opts);
export const stopSession   = ()      => stopVoiceSession();
export const pauseSession  = ()      => pauseVoiceSession();
export const resumeSession = ()      => resumeVoiceSession();

// ── Push-to-talk ─────────────────────────────────────────────

export const pttStart = () => pushToTalkStart();
export const pttEnd   = () => pushToTalkEnd();

// ── TTS direct (non-conversation speak) ─────────────────────

export { speak, interrupt, isSpeaking };

// ── Status ────────────────────────────────────────────────────

export function getVoiceStatus() {
  const session  = getSessionState();
  const mic      = getMicState();
  const sttMode  = detectSTTMode();
  const settings = storage.getVoiceSettings();
  return { session, mic, sttMode, settings };
}

export function isActive() { return isSessionActive(); }

// ── Settings ──────────────────────────────────────────────────

export function updateVoiceSettings(patch) {
  storage.patchVoiceSettings(patch);
  EventBus.emit('SYSTEM::VOICE_SETTINGS_CHANGED', { patch });
}

export function getVoiceSettings() {
  return storage.getVoiceSettings();
}

// ── Device helpers ────────────────────────────────────────────

export async function getMicrophoneDevices()    { return listAudioDevices(); }
export function       getAvailableTTSVoices()   { return getAvailableVoices(); }

// ── Emotion analysis (for external callers) ──────────────────

export { analyseText as analyseTranscriptEmotion };

// ── Data helpers ─────────────────────────────────────────────

export function getTranscriptHistory(limit = 50) {
  return storage.getVoiceTranscripts().slice(-limit);
}

export function getVoiceMemories(limit = 30) {
  return storage.getVoiceMemories().slice(-limit);
}

export function clearTranscripts() {
  storage.clearVoiceTranscripts();
}
