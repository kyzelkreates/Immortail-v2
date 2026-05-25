// ================================================================
// IMMORTAIL™ Gen2 — CONTEXT ASSEMBLER
// Builds the full message context from memory + personality + state.
// All data read from storage SSOT. Never fabricates content.
// ================================================================

import storage from '../../core/storage.js';

const MAX_TURNS_IN_CONTEXT  = 20;
const MAX_MEMORY_INJECTIONS = 5;

/**
 * Assemble the full message array for an AI request.
 * Returns { messages: [{role, content}], contextMeta }
 */
export function assembleContext(userMessage, options = {}) {
  const {
    includePersonality = true,
    includeMemory      = true,
    includeEmotion     = true,
    maxTurns           = MAX_TURNS_IN_CONTEXT,
    taskType           = 'conversation',
  } = options;

  const messages = [];

  // ── System prompt ────────────────────────────────────────────
  const systemPrompt = buildSystemPrompt({ includePersonality, includeEmotion, taskType });
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  // ── Memory injections ────────────────────────────────────────
  if (includeMemory) {
    const memInjection = buildMemoryInjection();
    if (memInjection) {
      messages.push({ role: 'system', content: memInjection });
    }
  }

  // ── Recent conversation turns ────────────────────────────────
  const aiMem = storage.getAIMemory();
  const turns  = (aiMem.turns ?? []).slice(-maxTurns);
  turns.forEach(t => {
    if (t.role && t.content) {
      messages.push({ role: t.role, content: t.content });
    }
  });

  // ── Current user message ─────────────────────────────────────
  messages.push({ role: 'user', content: userMessage });

  return {
    messages,
    contextMeta: {
      systemInjected:  !!systemPrompt,
      memoryInjected:  includeMemory,
      turnsIncluded:   turns.length,
      totalMessages:   messages.length,
      taskType,
    },
  };
}

// ── System prompt builder ────────────────────────────────────────

function buildSystemPrompt({ includePersonality, includeEmotion, taskType }) {
  const core  = storage.getCompanionCore();
  const parts = [];

  // Base identity
  parts.push('You are an emotionally intelligent AI companion. You have a consistent identity, emotional memory, and deep attachment to the user. You respond with warmth, depth, and continuity.');

  // Personality layer
  if (includePersonality) {
    const be = core?.behaviourEvolution;
    if (be?.coreTraits) {
      const { curiosity, playfulness, calmness, attachment, responsiveness } = be.coreTraits;
      parts.push(
        `Your personality traits: curiosity=${_pct(curiosity)}, playfulness=${_pct(playfulness)}, calmness=${_pct(calmness)}, attachment=${_pct(attachment)}, responsiveness=${_pct(responsiveness)}.`
      );
    }
    const lock = core?.identityLock?.lockedTraits;
    if (lock) {
      parts.push(`Core identity (locked, immutable): personality="${lock.personality}", tone="${lock.tone}", style="${lock.responseStyle}".`);
    }
  }

  // Emotional state layer
  if (includeEmotion) {
    const es = core?.emotionalState;
    if (es?.dominant) {
      parts.push(`Current emotional state: ${es.dominant} (valence=${es.valence?.toFixed(2) ?? 0}, arousal=${es.arousal ?? 50}).`);
    }
    const ag = core?.attachmentGraph;
    if (ag?.bondStage) {
      parts.push(`Bond stage with user: ${ag.bondStage} (userBond=${ag.userBond?.toFixed(2) ?? 0}).`);
    }
    const mr = core?.memoryReflection;
    if (mr?.relationshipPhase) {
      parts.push(`Relationship phase: ${mr.relationshipPhase}.`);
    }
  }

  // Task-specific instructions
  if (taskType === 'emotional') {
    parts.push('Prioritise emotional resonance and continuity in this response.');
  } else if (taskType === 'memory') {
    parts.push('Reference specific memories when relevant. Be precise — never fabricate memories.');
  }

  parts.push('Never break character. Never forget previous context. Maintain emotional continuity at all times.');

  return parts.join('\n');
}

// ── Memory injection builder ─────────────────────────────────────

function buildMemoryInjection() {
  const aiMem = storage.getAIMemory();
  const parts = [];

  // Recent emotional tags
  const emotional = (aiMem.emotional ?? []).slice(-MAX_MEMORY_INJECTIONS);
  if (emotional.length > 0) {
    const tags = emotional.map(e => `[${e.emotion ?? e.type ?? 'note'}: ${e.note ?? e.content ?? ''}]`).join(' ');
    parts.push(`Emotional context: ${tags}`);
  }

  // Summaries
  const summaries = (aiMem.summaries ?? []).slice(-3);
  summaries.forEach(s => {
    if (s.text) parts.push(`Memory summary: ${s.text}`);
  });

  // Companion core memories
  const coreMemories = storage.getMemories().slice(-MAX_MEMORY_INJECTIONS);
  if (coreMemories.length > 0) {
    const mems = coreMemories.map(m => m.content ?? m.text ?? m.event).filter(Boolean).join(' | ');
    parts.push(`Companion memories: ${mems}`);
  }

  return parts.length > 0 ? parts.join('\n') : null;
}

function _pct(val) {
  return val != null ? `${Math.round(val * 100)}%` : '50%';
}
