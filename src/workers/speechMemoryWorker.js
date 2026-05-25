// ================================================================
// IMMORTAIL™ Run 21 — SPEECH MEMORY WORKER
// Persists significant voice memories. Tags emotional moments.
// Feeds into companionCore attachment graph.
// NEVER creates a second memory system — integrates with memoryEngine.
// ================================================================

import { registerWorker, enqueueTask } from './orchestrator.js';
import storage       from '../core/storage.js';
import { recordMilestone, MEMORY_TYPES } from '../services/ai/memoryEngine.js';
import { EventBus }  from '../core/eventBus.js';

export const WORKER_ID = 'speechMemoryWorker';

export function boot() {
  registerWorker(WORKER_ID, {
    name:        'Speech Memory',
    icon:        '💬',
    description: 'Tags emotional voice memories and attachment milestones',
    handler:     _handle,
  });

  EventBus.on('SYSTEM::VOICE_EMOTION_SPIKE',  ({ emotion, valence }) => {
    enqueueTask(WORKER_ID, 'tag_spike',        { emotion, valence }, 80);
  });
  EventBus.on('SYSTEM::VOICE_EMOTION_CALM',   ({ emotion }) => {
    enqueueTask(WORKER_ID, 'tag_calm',         { emotion }, 60);
  });
  EventBus.on('SYSTEM::VOICE_TURN_END',       ({ transcript, emotion }) => {
    enqueueTask(WORKER_ID, 'tag_turn',         { transcript, emotion }, 50);
  });
  EventBus.on('SYSTEM::VOICE_SESSION_ENDED',  ({ turns }) => {
    enqueueTask(WORKER_ID, 'session_summary',  { turns }, 30);
  });
}

async function _handle(taskType, payload) {
  switch (taskType) {
    case 'tag_spike':       return _tagSpike(payload);
    case 'tag_calm':        return _tagCalm(payload);
    case 'tag_turn':        return _tagTurn(payload);
    case 'session_summary': return _sessionSummary(payload);
    default: break;
  }
}

function _tagSpike({ emotion, valence } = {}) {
  const snippet = `High-intensity ${emotion} moment (valence ${valence?.toFixed(2)})`;
  storage.appendVoiceMemory({ type: 'emotional_spike', emotion, valence, snippet });
  // Mirror into global memory engine for cross-system continuity
  recordMilestone(`Voice spike: ${emotion}`, snippet);
  // Strengthen attachment bond
  _progressBond(0.8);
}

function _tagCalm({ emotion } = {}) {
  storage.appendVoiceMemory({ type: 'calming_moment', emotion });
  _progressBond(0.3);
}

function _tagTurn({ transcript, emotion } = {}) {
  if (!transcript?.trim() || !emotion?.detected) return;

  // Only keep turns with notable emotion
  const notable = emotion.valence > 0.7 || emotion.arousal > 70 || emotion.hesitation > 2;
  if (!notable) return;

  storage.appendVoiceMemory({
    type:      'notable_turn',
    emotion:   emotion.detected,
    valence:   emotion.valence,
    snippet:   transcript.slice(0, 120),
  });
}

function _sessionSummary({ turns } = {}) {
  if ((turns ?? 0) >= 5) {
    _progressBond(1.0);
    storage.appendVoiceMemory({
      type:  'session_completed',
      turns,
      ts:    Date.now(),
    });
  }
}

function _progressBond(strength) {
  const core = storage.getCompanionCore();
  const ag   = core?.attachmentGraph ?? {};
  const bump = Math.min(10, (ag.voiceInteractions ?? 0) + strength);
  storage.patchCompanionCore({
    attachmentGraph: {
      ...ag,
      voiceInteractions: bump,
      lastVoiceAt:       Date.now(),
    },
  });
}

export function scheduleSpike(emotion, valence) {
  enqueueTask(WORKER_ID, 'tag_spike', { emotion, valence }, 80);
}
