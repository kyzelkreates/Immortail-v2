// ================================================================
// IMMORTAIL™ Gen2 — VOICE WORKER
// Manages TTS/STT state transitions. Never calls AI providers directly.
// ================================================================

import { registerWorker, enqueueTask } from './orchestrator.js';
import storage  from '../core/storage.js';
import { EventBus } from '../core/eventBus.js';

export const WORKER_ID = 'voiceWorker';

export function boot() {
  registerWorker(WORKER_ID, {
    name:        'Voice Worker',
    icon:        '🎙️',
    description: 'TTS/STT state, speech emotion sync',
    handler:     _handle,
  });
}

async function _handle(taskType, payload) {
  switch (taskType) {
    case 'sync_speech_emotion': return _syncSpeechEmotion(payload);
    case 'update_voice_state':  return _updateVoiceState(payload);
    default: break;
  }
}

function _syncSpeechEmotion({ emotion } = {}) {
  if (!emotion?.detected) return;
  const core = storage.getCompanionCore();
  const vp   = core?.voicePresence ?? {};
  storage.patchCompanionCore({
    voicePresence: { ...vp, speechEmotion: emotion.detected, updatedAt: Date.now() }
  });
}

function _updateVoiceState({ key, value } = {}) {
  if (!key) return;
  const core = storage.getCompanionCore();
  const vp   = core?.voicePresence ?? {};
  storage.patchCompanionCore({
    voicePresence: { ...vp, [key]: value, updatedAt: Date.now() }
  });
  EventBus.emit('SYSTEM::VOICE_STATE_CHANGED', { key, value });
}

export function scheduleSpeechEmotionSync(emotion) {
  enqueueTask(WORKER_ID, 'sync_speech_emotion', { emotion }, 60);
}
