// ================================================================
// IMMORTAIL™ Gen2 — MEMORY WORKER
// Handles async memory compression, summarization, tagging.
// Routes AI calls through aiRouter — never directly.
// ================================================================

import { registerWorker, enqueueTask } from './orchestrator.js';
import { send as aiSend }              from '../services/ai/aiRouter.js';
import { getRecentTurns, recordMilestone, MEMORY_TYPES } from '../services/ai/memoryEngine.js';
import storage from '../core/storage.js';

export const WORKER_ID = 'memoryWorker';

export function boot() {
  registerWorker(WORKER_ID, {
    name:        'Memory Worker',
    icon:        '🧠',
    description: 'Compresses turns, generates summaries, tags milestones',
    handler:     _handle,
  });
}

async function _handle(taskType, payload) {
  switch (taskType) {
    case 'summarize':    return _summarizeTurns(payload);
    case 'tag_emotion':  return _tagEmotion(payload);
    case 'milestone':    return _recordMilestone(payload);
    default: break;
  }
}

async function _summarizeTurns({ turns, turnCount } = {}) {
  const recent = turns ?? getRecentTurns(turnCount ?? 10);
  if (recent.length < 3) return;
  const text   = recent.map(t => `${t.role}: ${(t.content ?? '').slice(0, 80)}`).join('\n');
  const result = await aiSend(
    `Summarize this conversation in one sentence: ${text}`,
    { skipMemory: true, skipPersonality: true, taskType: 'memory' }
  );
  if (result.content && result.safe) {
    const mem = storage.getAIMemory();
    mem.summaries = [...(mem.summaries ?? []), { id: `s_${Date.now()}`, ts: Date.now(), text: result.content, turnCount: recent.length }];
    storage.saveAIMemory(mem);
  }
}

async function _tagEmotion({ content, context } = {}) {
  if (!content) return;
  // Emotion extraction is sync via responseNormalizer — no AI call needed
  const { extractEmotionHint } = await import('../services/ai/responseNormalizer.js');
  const emotion = extractEmotionHint(content);
  storage.appendAIEmotional({ ...emotion, note: content.slice(0, 100), context });
}

async function _recordMilestone({ title, detail } = {}) {
  if (!title) return;
  recordMilestone(title, detail, MEMORY_TYPES.MILESTONE);
}

export function scheduleSummarize(turnCount = 10) {
  enqueueTask(WORKER_ID, 'summarize', { turnCount }, 30);
}

export function scheduleEmotionTag(content, context) {
  enqueueTask(WORKER_ID, 'tag_emotion', { content, context }, 20);
}
