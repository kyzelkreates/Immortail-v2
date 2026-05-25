// ================================================================
// IMMORTAIL™ Gen2 — MEMORY ENGINE
// Persistent conversation memory. Emotional tagging. Contextual recall.
// Local-first. No cloud dependency. Full export/import support.
// All persistence through storage SSOT.
// ================================================================

import storage  from '../../core/storage.js';
import { EventBus } from '../../core/eventBus.js';
import { extractEmotionHint } from './responseNormalizer.js';

export const MEMORY_EVENTS = {
  TURN_SAVED:        'SYSTEM::MEMORY_TURN_SAVED',
  MILESTONE_SAVED:   'SYSTEM::MEMORY_MILESTONE_SAVED',
  COMPRESSED:        'SYSTEM::MEMORY_COMPRESSED',
  EXPORTED:          'SYSTEM::MEMORY_EXPORTED',
  IMPORTED:          'SYSTEM::MEMORY_IMPORTED',
};

export const MEMORY_TYPES = {
  EMOTIONAL:         'emotional',
  CONVERSATIONAL:    'conversational',
  BEHAVIORAL:        'behavioral',
  ATTACHMENT:        'attachment',
  MILESTONE:         'milestone',
  EVOLUTION:         'evolution',
  SUMMARY:           'summary',
};

const SHORT_TERM_LIMIT  = 50;   // turns kept in full
const LONG_TERM_LIMIT   = 200;  // total summaries kept
const COMPRESSION_EVERY = 20;   // compress every N turns

// ── Turn management ─────────────────────────────────────────────

/**
 * Record a user message turn.
 */
export function recordUserTurn(content) {
  const turn = { role: 'user', content, emotion: extractEmotionHint(content) };
  storage.appendAITurn(turn);
  _maybeCompress();
  EventBus.emit(MEMORY_EVENTS.TURN_SAVED, { role: 'user', length: content.length });
  return turn;
}

/**
 * Record an assistant response turn.
 */
export function recordAssistantTurn(normalizedResponse) {
  const turn = {
    role:      'assistant',
    content:   normalizedResponse.content,
    provider:  normalizedResponse.provider,
    model:     normalizedResponse.model,
    latencyMs: normalizedResponse.latencyMs,
    emotion:   normalizedResponse.emotion,
    taskType:  normalizedResponse.taskType,
  };
  storage.appendAITurn(turn);

  // Tag emotional memory if significant
  if (normalizedResponse.emotion && normalizedResponse.emotion.detected !== 'neutral') {
    recordEmotionalMemory(normalizedResponse.emotion, normalizedResponse.content.slice(0, 200));
  }

  _maybeCompress();
  EventBus.emit(MEMORY_EVENTS.TURN_SAVED, { role: 'assistant', provider: normalizedResponse.provider });
  return turn;
}

// ── Emotional memory ─────────────────────────────────────────────

export function recordEmotionalMemory(emotion, note = '') {
  storage.appendAIEmotional({ ...emotion, note });
}

// ── Milestone memory ─────────────────────────────────────────────

/**
 * Record a significant milestone — permanently protected.
 */
export function recordMilestone(title, detail = '', type = MEMORY_TYPES.MILESTONE) {
  const milestone = { title, detail, type, protected: true };
  storage.appendAIMilestone(milestone);

  // Also add to companionCore lifeStory
  const core = storage.getCompanionCore();
  const ls   = core?.lifeStory ?? {};
  const milestones = [...(ls.milestones ?? []), { ...milestone, id: `m_${Date.now()}`, ts: Date.now() }];
  storage.patchCompanionCore({ lifeStory: { ...ls, milestones } });

  EventBus.emit(MEMORY_EVENTS.MILESTONE_SAVED, { title, type });
  return milestone;
}

// ── Recall / search ──────────────────────────────────────────────

export function getRecentTurns(limit = 20) {
  const mem = storage.getAIMemory();
  return (mem.turns ?? []).slice(-limit);
}

export function searchMemory(query) {
  const q   = query.toLowerCase();
  const mem = storage.getAIMemory();
  const turns    = (mem.turns ?? []).filter(t => t.content?.toLowerCase().includes(q));
  const summaries= (mem.summaries ?? []).filter(s => s.text?.toLowerCase().includes(q));
  const milestones=(mem.milestones ?? []).filter(m =>
    m.title?.toLowerCase().includes(q) || m.detail?.toLowerCase().includes(q)
  );
  const companion= storage.getMemories().filter(m =>
    (m.content ?? m.text ?? m.event ?? '').toLowerCase().includes(q)
  );
  return { turns, summaries, milestones, companion, query };
}

export function getMemoryStats() {
  const mem = storage.getAIMemory();
  return {
    totalTurns:       (mem.turns      ?? []).length,
    totalSummaries:   (mem.summaries  ?? []).length,
    totalEmotional:   (mem.emotional  ?? []).length,
    totalMilestones:  (mem.milestones ?? []).length,
    companionMemories: storage.getMemories().length,
  };
}

// ── Compression ──────────────────────────────────────────────────

function _maybeCompress() {
  const mem = storage.getAIMemory();
  const turns = mem.turns ?? [];
  if (turns.length >= SHORT_TERM_LIMIT + COMPRESSION_EVERY) {
    _compressOldTurns(mem, turns);
  }
}

function _compressOldTurns(mem, turns) {
  // Take the oldest half, create a summary entry, keep recent half
  const half     = Math.floor(turns.length / 2);
  const toCompress = turns.slice(0, half);
  const toKeep     = turns.slice(half);

  const summaryText = toCompress
    .map(t => `${t.role === 'user' ? 'User' : 'Assistant'}: ${(t.content ?? '').slice(0, 80)}`)
    .join(' | ');

  const summary = {
    id:        `sum_${Date.now()}`,
    ts:        Date.now(),
    type:      MEMORY_TYPES.SUMMARY,
    text:      summaryText.slice(0, 500),
    turnCount: toCompress.length,
    compressed: true,
  };

  const updatedSummaries = [...(mem.summaries ?? []).slice(-(LONG_TERM_LIMIT - 1)), summary];
  storage.saveAIMemory({ ...mem, turns: toKeep, summaries: updatedSummaries });

  EventBus.emit(MEMORY_EVENTS.COMPRESSED, {
    compressedTurns: toCompress.length,
    keptTurns:       toKeep.length,
    totalSummaries:  updatedSummaries.length,
  });
}

// ── Export / Import ──────────────────────────────────────────────

export function exportMemory() {
  const mem  = storage.getAIMemory();
  const snap = {
    format:      'IMMORTAIL_MEMORY_V1',
    exportedAt:  Date.now(),
    ...mem,
  };
  EventBus.emit(MEMORY_EVENTS.EXPORTED, { turns: mem.turns?.length ?? 0 });
  return snap;
}

export function importMemory(snapshot) {
  if (snapshot?.format !== 'IMMORTAIL_MEMORY_V1') {
    throw new Error('Invalid memory snapshot format');
  }
  // Merge milestones — never overwrite existing
  const existing  = storage.getAIMemory();
  const merged = {
    turns:      snapshot.turns      ?? existing.turns,
    summaries:  snapshot.summaries  ?? existing.summaries,
    emotional:  snapshot.emotional  ?? existing.emotional,
    milestones: [
      ...(existing.milestones ?? []),
      ...(snapshot.milestones ?? []).filter(m =>
        !(existing.milestones ?? []).some(e => e.title === m.title)
      ),
    ],
  };
  storage.saveAIMemory(merged);
  EventBus.emit(MEMORY_EVENTS.IMPORTED, { turns: merged.turns?.length ?? 0 });
  return true;
}

export function clearConversationHistory() {
  const mem = storage.getAIMemory();
  // Never delete milestones
  storage.saveAIMemory({ ...mem, turns: [], summaries: [] });
}
