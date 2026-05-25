// ================================================================
// IMMORTAIL™ Run 21 — REALTIME PRESENCE WORKER
// Drives companion's live presence state: breathing, idle, listening.
// Translates voice session states into companion animation triggers.
// ================================================================

import { registerWorker, enqueueTask } from './orchestrator.js';
import { EventBus }  from '../core/eventBus.js';
import storage       from '../core/storage.js';

export const WORKER_ID = 'realtimePresenceWorker';

const PRESENCE_ANIM = {
  idle:       { animation: 'breathe',       aura: 'ambient',   intensity: 0.3 },
  listening:  { animation: 'ears_up',       aura: 'listening', intensity: 0.7 },
  processing: { animation: 'head_tilt',     aura: 'thinking',  intensity: 0.5 },
  speaking:   { animation: 'mouth_sync',    aura: 'speaking',  intensity: 0.9 },
  happy:      { animation: 'wag_tail',      aura: 'warm',      intensity: 0.8 },
  sad:        { animation: 'lie_down',      aura: 'soft',      intensity: 0.4 },
  excited:    { animation: 'bounce',        aura: 'energetic', intensity: 1.0 },
  calm:       { animation: 'idle',          aura: 'peaceful',  intensity: 0.25 },
  anxious:    { animation: 'pacing',        aura: 'soft',      intensity: 0.6 },
};

export function boot() {
  registerWorker(WORKER_ID, {
    name:        'Realtime Presence',
    icon:        '✨',
    description: 'Companion presence animations from voice state',
    handler:     _handle,
  });

  // Subscribe to voice state transitions
  EventBus.on('SYSTEM::VOICE_STATE_CHANGED',  ({ state }) => {
    enqueueTask(WORKER_ID, 'sync_presence', { trigger: 'voice_state', state }, 90);
  });
  EventBus.on('SYSTEM::VOICE_EMOTION_DETECTED', ({ result }) => {
    enqueueTask(WORKER_ID, 'sync_presence', { trigger: 'emotion', state: result.detected }, 75);
  });
  EventBus.on('SYSTEM::MIC_LEVEL', ({ level }) => {
    if (level > 0.15) {
      enqueueTask(WORKER_ID, 'mic_pulse', { level }, 85);
    }
  });
}

async function _handle(taskType, payload) {
  switch (taskType) {
    case 'sync_presence': return _syncPresence(payload);
    case 'mic_pulse':     return _micPulse(payload);
    case 'idle_breathe':  return _idleBreathe();
    default: break;
  }
}

function _syncPresence({ trigger, state } = {}) {
  const key = state ?? 'idle';
  const anim = PRESENCE_ANIM[key] ?? PRESENCE_ANIM.idle;

  storage.patchCompanionCore({
    embodiment: {
      animation:   anim.animation,
      aura:        anim.aura,
      intensity:   anim.intensity,
      trigger,
      updatedAt:   Date.now(),
    },
  });

  EventBus.emit('SYSTEM::DOG_UPDATED', {
    animation:  anim.animation,
    aura:       anim.aura,
    intensity:  anim.intensity,
  });
}

function _micPulse({ level } = {}) {
  // Only emit a lightweight pulse event — no full storage write for every frame
  EventBus.emit('SYSTEM::COMPANION_MIC_PULSE', { level });
}

function _idleBreathe() {
  _syncPresence({ trigger: 'idle_timer', state: 'idle' });
}

export function schedulePresenceSync(state, trigger) {
  enqueueTask(WORKER_ID, 'sync_presence', { state, trigger }, 80);
}
