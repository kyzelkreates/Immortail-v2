// ================================================================
// IMMORTAIL™ Run 21 — EMOTIONAL TONE WORKER
// Maintains a rolling emotional tone profile from voice sessions.
// Feeds companion reaction engine — not UI directly.
// ================================================================

import { registerWorker, enqueueTask } from './orchestrator.js';
import storage  from '../core/storage.js';
import { EventBus } from '../core/eventBus.js';

export const WORKER_ID = 'emotionalToneWorker';

// Rolling window — keeps last 20 emotion readings
const WINDOW = 20;

export function boot() {
  registerWorker(WORKER_ID, {
    name:        'Emotional Tone',
    icon:        '🌡️',
    description: 'Maintains rolling emotional tone from voice',
    handler:     _handle,
  });

  EventBus.on('SYSTEM::VOICE_EMOTION_DETECTED', ({ result }) => {
    enqueueTask(WORKER_ID, 'update_tone', { result }, 60);
  });
}

async function _handle(taskType, payload) {
  switch (taskType) {
    case 'update_tone':    return _updateTone(payload);
    case 'compute_average': return _computeAverage();
    default: break;
  }
}

function _updateTone({ result } = {}) {
  if (!result?.detected) return;
  const emotions = storage.getVoiceEmotion().slice(-WINDOW);
  const avg      = _average(emotions);
  storage.patchVoiceSettings({ rollingEmotion: avg });
  EventBus.emit('SYSTEM::TONE_PROFILE_UPDATED', { avg });
}

function _computeAverage() {
  const emotions = storage.getVoiceEmotion().slice(-WINDOW);
  return _average(emotions);
}

function _average(emotions) {
  if (emotions.length === 0) return { detected: 'neutral', valence: 0.5, arousal: 30 };
  const valence = emotions.reduce((s, e) => s + (e.valence ?? 0.5), 0) / emotions.length;
  const arousal = emotions.reduce((s, e) => s + (e.arousal ?? 30), 0) / emotions.length;

  // Dominant emotion by frequency
  const counts = {};
  emotions.forEach(e => { counts[e.detected ?? 'neutral'] = (counts[e.detected ?? 'neutral'] ?? 0) + 1; });
  const detected = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'neutral';

  return { detected, valence: Math.round(valence * 100) / 100, arousal: Math.round(arousal) };
}

export function scheduleToneUpdate(result) {
  enqueueTask(WORKER_ID, 'update_tone', { result }, 60);
}
