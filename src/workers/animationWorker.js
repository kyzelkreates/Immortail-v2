// ================================================================
// IMMORTAIL™ Gen2 — ANIMATION WORKER
// Syncs companion animation state from AI emotional context.
// Never calls providers directly.
// ================================================================

import { registerWorker, enqueueTask } from './orchestrator.js';
import storage  from '../core/storage.js';
import { EventBus } from '../core/eventBus.js';

export const WORKER_ID = 'animationWorker';

const EMOTION_TO_ANIM = {
  happy:   { animation: 'wag_tail',    posture: 'excited'  },
  sad:     { animation: 'lie_down',    posture: 'drooped'  },
  curious: { animation: 'head_tilt',   posture: 'alert'    },
  calm:    { animation: 'idle',        posture: 'relaxed'  },
  playful: { animation: 'bounce',      posture: 'excited'  },
  neutral: { animation: 'idle',        posture: 'neutral'  },
};

export function boot() {
  registerWorker(WORKER_ID, {
    name:        'Animation Worker',
    icon:        '✨',
    description: 'Syncs companion animation from emotional state',
    handler:     _handle,
  });
}

async function _handle(taskType, payload) {
  switch (taskType) {
    case 'sync_animation': return _syncAnimation(payload);
    default: break;
  }
}

function _syncAnimation({ emotion } = {}) {
  const detected = emotion?.detected ?? 'neutral';
  const mapping  = EMOTION_TO_ANIM[detected] ?? EMOTION_TO_ANIM.neutral;
  const core     = storage.getCompanionCore();
  const emb      = core?.embodiment ?? {};
  storage.patchCompanionCore({
    embodiment: { ...emb, animation: mapping.animation, posture: mapping.posture, updatedAt: Date.now() }
  });
  EventBus.emit('SYSTEM::DOG_UPDATED', { animation: mapping.animation, posture: mapping.posture });
}

export function scheduleAnimationSync(emotion) {
  enqueueTask(WORKER_ID, 'sync_animation', { emotion }, 70);
}
