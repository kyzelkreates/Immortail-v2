// ================================================================
// IMMORTAIL™ Gen2 — EMOTION WORKER
// Updates emotional state from AI responses. Logs emotional arcs.
// Never mutates identity. Works through companionCore SSOT.
// ================================================================

import { registerWorker, enqueueTask } from './orchestrator.js';
import storage  from '../core/storage.js';
import { EventBus } from '../core/eventBus.js';

export const WORKER_ID = 'emotionWorker';

export function boot() {
  registerWorker(WORKER_ID, {
    name:        'Emotion Worker',
    icon:        '💫',
    description: 'Updates emotional state from interactions',
    handler:     _handle,
  });
}

async function _handle(taskType, payload) {
  switch (taskType) {
    case 'update_emotion': return _updateEmotion(payload);
    case 'log_arc':        return _logArc(payload);
    default: break;
  }
}

function _updateEmotion({ emotion } = {}) {
  if (!emotion?.detected) return;
  const core = storage.getCompanionCore();
  const curr = core?.emotionalState ?? {};
  const VALENCE_SMOOTH  = 0.7;
  const AROUSAL_SMOOTH  = 0.8;
  const newState = {
    dominant:  emotion.detected,
    valence:   curr.valence  * VALENCE_SMOOTH + emotion.valence  * (1 - VALENCE_SMOOTH),
    arousal:   curr.arousal  * AROUSAL_SMOOTH + emotion.arousal  * (1 - AROUSAL_SMOOTH),
    updatedAt: Date.now(),
  };
  storage.patchCompanionCore({ emotionalState: newState });
  EventBus.emit('SYSTEM::EMOTION_CHANGED', { emotion: newState });
}

function _logArc({ emotion, source } = {}) {
  if (!emotion?.detected) return;
  const core = storage.getCompanionCore();
  const history = [...(core?.emotionHistory ?? []).slice(-99), {
    ts:        Date.now(),
    emotion:   emotion.detected,
    intensity: Math.abs(emotion.valence ?? 0),
    source:    source ?? 'ai_response',
  }];
  storage.patchCompanionCore({ emotionHistory: history });
}

export function scheduleEmotionUpdate(emotion) {
  enqueueTask(WORKER_ID, 'update_emotion', { emotion }, 80);
  enqueueTask(WORKER_ID, 'log_arc',        { emotion }, 40);
}
