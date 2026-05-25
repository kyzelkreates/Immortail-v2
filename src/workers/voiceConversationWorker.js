// ================================================================
// IMMORTAIL™ Run 21 — VOICE CONVERSATION WORKER
// Processes completed voice turns: emotion analysis → memory tag.
// Registered with orchestrator — never called directly from UI.
// ================================================================

import { registerWorker, enqueueTask } from './orchestrator.js';
import storage from '../core/storage.js';
import { analyseUtterance } from '../services/voice/emotionAnalysis.js';
import { recordMilestone, MEMORY_TYPES } from '../services/ai/memoryEngine.js';
import { EventBus } from '../core/eventBus.js';

export const WORKER_ID = 'voiceConversationWorker';

export function boot() {
  registerWorker(WORKER_ID, {
    name:        'Voice Conversation',
    icon:        '🎙️',
    description: 'Processes voice turns, emotion, memory tagging',
    handler:     _handle,
  });

  // Auto-wire to voice turn events
  EventBus.on('SYSTEM::VOICE_TURN_END', ({ transcript, response, emotion }) => {
    enqueueTask(WORKER_ID, 'process_turn', { transcript, response, emotion }, 70);
  });
}

async function _handle(taskType, payload) {
  switch (taskType) {
    case 'process_turn':     return _processTurn(payload);
    case 'tag_attachment':   return _tagAttachment(payload);
    case 'log_interaction':  return _logInteraction(payload);
    default: break;
  }
}

function _processTurn({ transcript, response, emotion } = {}) {
  if (!transcript) return;

  // Re-analyse if emotion wasn't pre-computed
  const finalEmotion = emotion ?? analyseUtterance(transcript, {});

  // Tag repeated phrases (simple frequency check)
  _checkRepeatedPhrases(transcript);

  // Log the interaction
  _logInteraction({ transcript, response, emotion: finalEmotion });

  // Attachment milestone — first 10 voice conversations
  const transcripts = storage.getVoiceTranscripts();
  const userTurns   = transcripts.filter(t => t.role === 'user').length;
  if (userTurns === 1) {
    recordMilestone('First voice conversation', transcript.slice(0, 80));
    storage.appendVoiceMemory({ type: 'milestone', title: 'First voice conversation' });
  } else if (userTurns === 10) {
    recordMilestone('10 voice conversations', `"${transcript.slice(0, 60)}"`);
  }
}

function _logInteraction({ transcript, response, emotion } = {}) {
  const core = storage.getCompanionCore();
  const interactions = core?.interactionLog ?? [];
  const entry = {
    ts:        Date.now(),
    channel:   'voice',
    transcript: transcript?.slice(0, 200),
    emotion:    emotion?.detected ?? 'neutral',
    valence:    emotion?.valence  ?? 0.5,
  };
  if (interactions.length < 500) interactions.push(entry);
  else interactions.splice(0, 50); // rolling window
}

function _checkRepeatedPhrases(transcript) {
  if (!transcript) return;
  const memories = storage.getVoiceMemories();
  const lower    = transcript.toLowerCase().slice(0, 60);
  const existing = memories.find(m => m.type === 'repeated_phrase' && m.snippet === lower);
  if (existing) {
    existing.count = (existing.count ?? 1) + 1;
  } else if (lower.length > 10) {
    storage.appendVoiceMemory({ type: 'repeated_phrase', snippet: lower, count: 1 });
  }
}

function _tagAttachment({ title, detail } = {}) {
  if (!title) return;
  recordMilestone(title, detail, MEMORY_TYPES.MILESTONE);
  storage.appendVoiceMemory({ type: 'attachment_milestone', title, detail });
}

export function scheduleVoiceTurn(transcript, response, emotion) {
  enqueueTask(WORKER_ID, 'process_turn', { transcript, response, emotion }, 70);
}
