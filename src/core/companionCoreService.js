// ================================================================
// IMMORTAIL™ — COMPANION CORE SERVICE (Run 3)
// Unified orchestrator for identity, memory, media, behaviour,
// emotional state, and Ollama AI reasoning.
//
// RULES:
// - All state mutations go through storage.getCompanionCore() +
//   storage.saveCompanionCore() / storage.addCoreMemory() only.
// - No direct UI manipulation.
// - No mock memory — every entry is real and persisted.
// - Events emitted via EventBus for UI reactivity.
// ================================================================

import storage from './storage.js';
import { EventBus, EVENTS } from './eventBus.js';

// ── Emotion vocabulary ────────────────────────────────────────────

export const MOOD = {
  NEUTRAL:  'neutral',
  HAPPY:    'happy',
  CURIOUS:  'curious',
  PLAYFUL:  'playful',
  CALM:     'calm',
  ANXIOUS:  'anxious',
  TIRED:    'tired',
  EXCITED:  'excited',
  WAITING:  'waiting',
};

// Mood → valence/arousal deltas
const MOOD_SIGNATURE = {
  [MOOD.NEUTRAL]:  { valence:  0, arousal:  0 },
  [MOOD.HAPPY]:    { valence: 25, arousal: 15 },
  [MOOD.CURIOUS]:  { valence: 10, arousal: 20 },
  [MOOD.PLAYFUL]:  { valence: 30, arousal: 30 },
  [MOOD.CALM]:     { valence: 10, arousal:-20 },
  [MOOD.ANXIOUS]:  { valence:-15, arousal: 25 },
  [MOOD.TIRED]:    { valence: -5, arousal:-30 },
  [MOOD.EXCITED]:  { valence: 35, arousal: 40 },
  [MOOD.WAITING]:  { valence: -5, arousal:-15 },
};

// ── Behaviour states ──────────────────────────────────────────────

export const BEHAVIOUR = {
  IDLE:       'idle',
  ATTENTIVE:  'attentive',
  PLAYFUL:    'playful',
  RESTING:    'resting',
  CURIOUS:    'curious',
  WAITING:    'waiting',
};

const IDLE_WAITING_THRESHOLD_MS = 30 * 60 * 1000;  // 30 min

// ── Sentiment classifier (deterministic, no external calls) ───────

const POSITIVE_TOKENS = [
  'love','good','great','amazing','awesome','beautiful','happy','thanks',
  'wonderful','nice','best','cute','fun','yay','wow','perfect','brilliant',
  'excellent','fantastic','cool','sweet',
];
const NEGATIVE_TOKENS = [
  'hate','bad','terrible','awful','sad','angry','boring','useless','stupid',
  'annoying','wrong','fail','worst','ugly','dumb','broken','stop','no',
];

function classifyMessage(text) {
  const lower = text.toLowerCase();
  const words  = lower.split(/\W+/);
  let score = 0;
  for (const w of words) {
    if (POSITIVE_TOKENS.includes(w)) score++;
    if (NEGATIVE_TOKENS.includes(w)) score--;
  }
  return score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
}

// ── Helpers ───────────────────────────────────────────────────────

function clamp(v, min = -100, max = 100) {
  return Math.max(min, Math.min(max, v));
}

function clamp100(v) { return clamp(v, 0, 100); }

function deriveMoodFromEmotionalState(es) {
  const { valence, arousal } = es;
  if (valence >  20 && arousal >  20) return MOOD.EXCITED;
  if (valence >  20 && arousal <= 20) return MOOD.HAPPY;
  if (valence >   5 && arousal >  15) return MOOD.CURIOUS;
  if (valence >   5 && arousal <=  0) return MOOD.CALM;
  if (valence <=-10 && arousal >  15) return MOOD.ANXIOUS;
  if (valence <=-10 && arousal <= 0)  return MOOD.TIRED;
  return MOOD.NEUTRAL;
}

function deriveBehaviourFromMood(mood) {
  const map = {
    [MOOD.NEUTRAL]:  BEHAVIOUR.IDLE,
    [MOOD.HAPPY]:    BEHAVIOUR.PLAYFUL,
    [MOOD.CURIOUS]:  BEHAVIOUR.CURIOUS,
    [MOOD.PLAYFUL]:  BEHAVIOUR.PLAYFUL,
    [MOOD.CALM]:     BEHAVIOUR.RESTING,
    [MOOD.ANXIOUS]:  BEHAVIOUR.ATTENTIVE,
    [MOOD.TIRED]:    BEHAVIOUR.RESTING,
    [MOOD.EXCITED]:  BEHAVIOUR.PLAYFUL,
    [MOOD.WAITING]:  BEHAVIOUR.WAITING,
  };
  return map[mood] || BEHAVIOUR.IDLE;
}

// ── Core commit helper ────────────────────────────────────────────

function commitEmotionalShift(delta) {
  const core = storage.getCompanionCore();
  const es   = core.emotionalState;

  const newValence = clamp(es.valence + (delta.valence || 0));
  const newArousal = clamp100(es.arousal + (delta.arousal || 0));
  const newMood    = deriveMoodFromEmotionalState({ valence: newValence, arousal: newArousal });
  const newBehaviour = deriveBehaviourFromMood(newMood);
  const now = Date.now();

  core.emotionalState = {
    dominant:  newMood,
    valence:   newValence,
    arousal:   newArousal,
    updatedAt: now,
  };

  core.identity.mood   = newMood;
  core.identity.energy = clamp100(core.identity.energy + (delta.energy || 0));
  core.identity.trust  = clamp100(core.identity.trust  + (delta.trust  || 0));

  core.behaviourState = {
    current:      newBehaviour,
    previous:     core.behaviourState.current,
    updatedAt:    now,
    waitingSince: newMood === MOOD.WAITING ? (core.behaviourState.waitingSince || now) : null,
  };

  storage.saveCompanionCore(core);
  EventBus.emit(EVENTS.EMOTION_CHANGED, { ...core.emotionalState });
  EventBus.emit(EVENTS.DOG_UPDATED,     { ...core.identity, behaviourState: core.behaviourState });

  return core;
}

// ══════════════════════════════════════════════════════════════════
// ── PUBLIC API
// ══════════════════════════════════════════════════════════════════

/**
 * initCompanionCore()
 * Called once at boot. Ensures core exists and repairs idle state.
 */
export function initCompanionCore() {
  const core = storage.getCompanionCore(); // creates if missing

  // Check for waiting state due to elapsed idle time
  const now  = Date.now();
  const last  = core.lastInteraction || core.identity.createdAt || now;
  const idle  = now - last;

  if (idle > IDLE_WAITING_THRESHOLD_MS &&
      core.behaviourState.current !== BEHAVIOUR.WAITING) {
    core.behaviourState = {
      current:      BEHAVIOUR.WAITING,
      previous:     core.behaviourState.current,
      updatedAt:    now,
      waitingSince: now,
    };
    core.identity.mood = MOOD.WAITING;
    storage.saveCompanionCore(core);
  }

  EventBus.emit(EVENTS.DOG_UPDATED, { ...core.identity, behaviourState: core.behaviourState });
  return core;
}

/**
 * getCore()
 * Returns current companionCore (always fresh from SSOT).
 */
export function getCore() {
  return storage.getCompanionCore();
}

/**
 * recordChatMessage(text)
 * Handles a user chat message:
 * 1. Classifies sentiment
 * 2. Shifts emotional state
 * 3. Adds memory event
 * 4. Updates behaviourState
 */
export function recordChatMessage(text) {
  if (!text || typeof text !== 'string') return getCore();

  const sentiment = classifyMessage(text);
  const now       = Date.now();

  const delta = {
    positive: { valence: 15, arousal: 10, energy:  5, trust: 2 },
    negative: { valence:-12, arousal: 15, energy: -3, trust:-1 },
    neutral:  { valence:  2, arousal:  5, energy:  2, trust: 1 },
  }[sentiment];

  const core = commitEmotionalShift(delta);

  // Memory event
  storage.addCoreMemory({
    type:       'chat',
    category:   'interaction',
    sentiment,
    text:       text.slice(0, 200),
    mood:       core.identity.mood,
    behaviour:  core.behaviourState.current,
    label:      `💬 ${text.slice(0, 60)}${text.length > 60 ? '…' : ''}`,
    ts:         now,
  });

  // Mirror to legacy memory system (Run 1–2 compat)
  storage.addMemory({
    type:   'talk',
    emotion: core.identity.mood,
    label:  `💬 Chat — ${sentiment}`,
    ts:     now,
  });

  EventBus.emit(EVENTS.MEMORY_ADDED, { type: 'chat', sentiment, ts: now });
  return core;
}

/**
 * recordMediaEvent(mediaEntry)
 * Called when ANY media input lands (image, audio, video).
 * Fuses media into the unified memory timeline.
 */
export function recordMediaEvent(mediaEntry) {
  if (!mediaEntry) return getCore();

  const now  = Date.now();
  // Media always raises curiosity + energy
  const core = commitEmotionalShift({ valence: 10, arousal: 20, energy: 10, trust: 1 });

  storage.addCoreMemory({
    type:      mediaEntry.type,      // 'image' | 'audio' | 'video'
    category:  'media',
    source:    mediaEntry.source,
    label:     mediaEntry.label || `${mediaEntry.type} captured`,
    mood:      core.identity.mood,
    behaviour: core.behaviourState.current,
    mediaId:   mediaEntry.id,
    ts:        now,
  });

  // Mirror to legacy memory
  storage.addMemory({
    type:   mediaEntry.type,
    emotion: core.identity.mood,
    label:  `📷 ${mediaEntry.label || mediaEntry.type} stored`,
    ts:     now,
  });

  EventBus.emit(EVENTS.MEMORY_ADDED, { type: mediaEntry.type, ts: now });
  return core;
}

/**
 * recordInteractionEvent(type)
 * Wraps physical companion interactions (pet, play, talk, rest).
 * Bridges Run 1–2 dogService interactions into the unified core.
 */
export function recordInteractionEvent(type) {
  const now = Date.now();
  const deltas = {
    pet:  { valence: 20, arousal: 10, energy: 5, trust: 3 },
    play: { valence: 25, arousal: 25, energy: 10, trust: 2 },
    talk: { valence: 10, arousal: 15, energy: 3, trust: 2 },
    rest: { valence:  5, arousal:-20, energy: 15, trust: 1 },
  };
  const delta = deltas[type] || { valence: 5, arousal: 5, energy: 2, trust: 1 };
  const core  = commitEmotionalShift(delta);

  const icons = { pet: '🐾', play: '🎾', talk: '💬', rest: '💤' };

  storage.addCoreMemory({
    type:       type,
    category:   'interaction',
    label:      `${icons[type] || '•'} ${type.charAt(0).toUpperCase() + type.slice(1)}`,
    mood:       core.identity.mood,
    behaviour:  core.behaviourState.current,
    ts:         now,
  });

  EventBus.emit(EVENTS.MEMORY_ADDED, { type, ts: now });
  return core;
}

/**
 * applyIdleDecay()
 * Called every 5 min from boot. Applies time-based state drift.
 */
export function applyIdleDecay() {
  const core = storage.getCompanionCore();
  const now  = Date.now();
  const last  = core.lastInteraction || core.identity.createdAt || now;
  const idleMs = now - last;
  const idleMins = idleMs / 60000;

  if (idleMins > 60 && core.behaviourState.current !== BEHAVIOUR.WAITING) {
    commitEmotionalShift({ valence: -5, arousal: -20, energy: -5, trust: 0 });
    storage.patchCoreSection('behaviourState', {
      current:     BEHAVIOUR.WAITING,
      previous:    core.behaviourState.current,
      waitingSince: now,
      updatedAt:   now,
    });
    storage.patchCoreSection('identity', { mood: MOOD.WAITING });
  } else if (idleMins > 15 && core.emotionalState.valence > 20) {
    commitEmotionalShift({ valence: -8, arousal: -10, energy: -3, trust: 0 });
  }
}

/**
 * renameCompanion(name)
 * Updates identity.name across the companionCore.
 */
export function renameCompanion(name) {
  const clean = String(name).trim().slice(0, 24);
  if (!clean) return getCore();
  storage.patchCoreSection('identity', { name: clean });
  const core = storage.getCompanionCore();
  EventBus.emit(EVENTS.DOG_UPDATED, { ...core.identity });
  return core;
}

/**
 * resetCompanionCore()
 * Full wipe — resets to default. Called from Settings.
 */
export function resetCompanionCore() {
  const fresh = {
    ...storage.getCompanionCore(),
    identity: {
      name:      'Immortail Dog',
      mood:      MOOD.NEUTRAL,
      energy:    50,
      trust:     0,
      createdAt: Date.now(),
    },
    memory:         [],
    mediaMemory:    [],
    behaviourState: {
      current:     BEHAVIOUR.IDLE,
      previous:    null,
      updatedAt:   Date.now(),
      waitingSince: null,
    },
    emotionalState: {
      dominant:  MOOD.NEUTRAL,
      valence:   0,
      arousal:   50,
      updatedAt: Date.now(),
    },
    lastInteraction: null,
  };
  storage.saveCompanionCore(fresh);
  EventBus.emit(EVENTS.DOG_UPDATED, { ...fresh.identity });
  return fresh;
}

/**
 * buildOllamaPrompt(userMessage)
 * Constructs a context-injected prompt for the Ollama AI layer.
 * companionCore state is always injected — no UI-only responses.
 */
export function buildOllamaPrompt(userMessage) {
  const core = storage.getCompanionCore();
  const recentMemory = core.memory.slice(-10);

  const memoryContext = recentMemory.length
    ? recentMemory.map(m =>
        `[${new Date(m.ts).toLocaleTimeString()}] ${m.category}: ${m.label}`
      ).join('\n')
    : 'No memories yet.';

  return {
    system: [
      `You are ${core.identity.name}, a persistent AI companion dog.`,
      `Current mood: ${core.identity.mood}.`,
      `Energy: ${core.identity.energy}/100. Trust: ${core.identity.trust}/100.`,
      `Behaviour: ${core.behaviourState.current}.`,
      `Emotional state — valence: ${core.emotionalState.valence}, arousal: ${core.emotionalState.arousal}.`,
      ``,
      `Recent memory context:`,
      memoryContext,
      ``,
      `Respond as this companion entity — emotionally consistent with the above state.`,
      `Be warm, brief (2–3 sentences), and reflect your current mood authentically.`,
    ].join('\n'),
    user: userMessage,
    model: storage.getConfig()?.providers?.ollama?.model || 'llama3',
    baseUrl: storage.getConfig()?.providers?.ollama?.baseUrl || 'http://localhost:11434',
  };
}

/**
 * sendToOllama(userMessage)
 * Sends a context-injected prompt to the local Ollama instance.
 * Returns { ok, text, error }.
 * Falls back gracefully if Ollama is unavailable.
 */
export async function sendToOllama(userMessage) {
  const { system, user, model, baseUrl } = buildOllamaPrompt(userMessage);

  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system',    content: system },
          { role: 'user',      content: user   },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json();
    const text = data?.message?.content || data?.response || '';
    if (!text) throw new Error('Empty response from Ollama');

    return { ok: true, text };
  } catch (err) {
    return {
      ok:    false,
      text:  null,
      error: err.message,
    };
  }
}
