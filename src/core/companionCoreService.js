// ================================================================
// IMMORTAIL™ — COMPANION CORE SERVICE (Run 3 + Run 4)
// Unified orchestrator for identity, memory, media, behaviour,
// emotional state, and Ollama AI reasoning.
//
// Run 4 additions (marked ── R4):
//   • Emotional normalization layer (per-interaction delta caps)
//   • Identity lock enforcement + Ollama personality anchoring
//   • Memory integrity validation (delegated to storage)
//   • Behaviour smoothing engine (5-state rolling average)
//   • Cross-session consistency check at boot
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
import {
  updateBondingOnInteraction,
  computeMemoryWeight,
  processAbsenceReturn,
  getBondContext,
  BOND_STAGE,
} from './bondingEngine.js';

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

// ── Run 4: Per-interaction delta caps (normalization layer) ────────
// These are MAXIMUM changes allowed per single interaction.
// Raw deltas from callers are clamped to these bounds.
const DELTA_CAPS = {
  valence:  5,   // max ±5 valence per interaction
  arousal:  8,   // max ±8 arousal per interaction
  energy:   7,   // max ±7 energy per interaction
  trust:    3,   // max ±3 trust per interaction
};

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

// ── Run 4: Apply delta caps before any emotional mutation ─────────
function normaliseDelta(raw) {
  return {
    valence: clamp(raw.valence ?? 0, -DELTA_CAPS.valence,  DELTA_CAPS.valence),
    arousal: clamp(raw.arousal ?? 0, -DELTA_CAPS.arousal,  DELTA_CAPS.arousal),
    energy:  clamp(raw.energy  ?? 0, -DELTA_CAPS.energy,   DELTA_CAPS.energy),
    trust:   clamp(raw.trust   ?? 0, -DELTA_CAPS.trust,    DELTA_CAPS.trust),
  };
}

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

// ── Run 4: Behaviour smoothing engine ─────────────────────────────
// Keeps a rolling window of the last 5 mood states.
// smoothedMood = mode of last 5.  smoothedEnergy = mean of last 5.
const SMOOTH_WINDOW = 5;

function computeSmoothing(emotionHistory, currentMood, currentEnergy) {
  const window = [...emotionHistory, { mood: currentMood, energy: currentEnergy }]
    .slice(-SMOOTH_WINDOW);

  // Mode mood
  const freq = {};
  for (const e of window) freq[e.mood] = (freq[e.mood] || 0) + 1;
  const smoothedMood = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];

  // Mean energy
  const smoothedEnergy = Math.round(
    window.reduce((s, e) => s + (e.energy ?? 50), 0) / window.length
  );

  return { window, smoothedMood, smoothedEnergy };
}

// ── Core commit helper ────────────────────────────────────────────
// Run 4: applies normaliseDelta BEFORE mutating state.

function commitEmotionalShift(rawDelta) {
  const core  = storage.getCompanionCore();
  const es    = core.emotionalState;

  // ── R4: cap each dimension before applying ─────────────────────
  const delta = normaliseDelta(rawDelta);

  const newValence   = clamp(es.valence + delta.valence);
  const newArousal   = clamp100(es.arousal + delta.arousal);
  const newMood      = deriveMoodFromEmotionalState({ valence: newValence, arousal: newArousal });
  const newBehaviour = deriveBehaviourFromMood(newMood);
  const newEnergy    = clamp100(core.identity.energy + delta.energy);
  const newTrust     = clamp100(core.identity.trust  + delta.trust);
  const now          = Date.now();

  // ── R4: update rolling emotion history (SMOOTH_WINDOW = 5) ────
  const updatedHistory = [...(core.emotionHistory ?? []),
    { mood: newMood, energy: newEnergy, ts: now }
  ].slice(-SMOOTH_WINDOW);

  const { smoothedMood, smoothedEnergy } =
    computeSmoothing(updatedHistory, newMood, newEnergy);

  core.emotionalState = {
    dominant:  newMood,
    valence:   newValence,
    arousal:   newArousal,
    updatedAt: now,
  };

  core.identity.mood   = newMood;
  core.identity.energy = newEnergy;
  core.identity.trust  = newTrust;

  core.emotionHistory  = updatedHistory;

  core.behaviourState = {
    current:        newBehaviour,
    previous:       core.behaviourState.current,
    updatedAt:      now,
    waitingSince:   newMood === MOOD.WAITING
                      ? (core.behaviourState.waitingSince || now)
                      : null,
    // ── R4: smoothed values persisted alongside raw ────────────
    smoothedMood,
    smoothedEnergy,
  };

  storage.saveCompanionCore(core);
  EventBus.emit(EVENTS.EMOTION_CHANGED, { ...core.emotionalState, smoothedMood, smoothedEnergy });
  EventBus.emit(EVENTS.DOG_UPDATED,     { ...core.identity, behaviourState: core.behaviourState });

  return core;
}

// ══════════════════════════════════════════════════════════════════
// ── PUBLIC API
// ══════════════════════════════════════════════════════════════════

/**
 * initCompanionCore()
 * Called once at boot.
 * Run 4: runs cross-session consistency check before returning.
 */
export function initCompanionCore() {
  // ── R4: Cross-session consistency check ───────────────────────
  const check = crossSessionConsistencyCheck();
  if (!check.ok) {
    console.warn('[IMMORTAIL] Boot consistency issues repaired:', check.repairs);
  }

  // Run 5: process absence/return before idle check
  const absenceResult = processAbsenceReturn();

  const core = storage.getCompanionCore();  // re-read after absenceReturn may have mutated
  const now  = Date.now();
  const last = core.lastInteraction || core.identity.createdAt || now;
  const idle = now - last;

  if (idle > IDLE_WAITING_THRESHOLD_MS &&
      core.behaviourState.current !== BEHAVIOUR.WAITING) {
    core.behaviourState = {
      ...core.behaviourState,
      current:      BEHAVIOUR.WAITING,
      previous:     core.behaviourState.current,
      updatedAt:    now,
      waitingSince: now,
    };
    core.identity.mood = MOOD.WAITING;
    storage.saveCompanionCore(core);
  }

  EventBus.emit(EVENTS.DOG_UPDATED, { ...core.identity, behaviourState: core.behaviourState });
  return storage.getCompanionCore();
}

/**
 * crossSessionConsistencyCheck()
 * Run 4: validates companionCore integrity on boot.
 * Repairs what it can; never reinitialises randomly.
 * Returns { ok, repairs[] }
 */
export function crossSessionConsistencyCheck() {
  const repairs = [];

  // ── Read RAW persisted payload before deepMerge healing ────────
  // getCompanionCore() auto-heals via deepMerge, so corruption is
  // invisible to it. We must inspect the raw localStorage value to
  // detect null/corrupt sections, then repair and report them.
  let rawPersisted = null;
  try {
    const raw = localStorage.getItem('immortail_companion_core');
    rawPersisted = raw ? (JSON.parse(raw)?.d ?? null) : null;
  } catch { rawPersisted = null; }

  // If nothing persisted yet — getCompanionCore() creates defaults
  if (!rawPersisted) {
    storage.getCompanionCore();  // triggers first-boot creation
    return { ok: true, repairs: ['first-boot: defaults created'] };
  }

  // 1. identityLock must exist and have correct signature
  if (!rawPersisted.identityLock) {
    repairs.push('identityLock: missing — will be injected on next save');
  }
  if (rawPersisted.identityLock?.signature !== 'IMMORTAIL_DOG_CORE_V1') {
    repairs.push('identityLock.signature: corrected to IMMORTAIL_DOG_CORE_V1');
    // saveCompanionCore always enforces the correct signature
    const core = storage.getCompanionCore();
    storage.saveCompanionCore(core);
  }

  // 2. memory must be an array
  if (!Array.isArray(rawPersisted.memory)) {
    storage.patchCoreSection('memory', []);
    repairs.push('memory: reset to []');
  }

  // 3. emotionalState — detect null/corrupt in raw payload
  if (!rawPersisted.emotionalState ||
      typeof rawPersisted.emotionalState.valence !== 'number') {
    // deepMerge already healed it — but we must write the healed value back
    // so it is durable across the NEXT raw read as well
    const healed = {
      dominant:  MOOD.NEUTRAL,
      valence:   0,
      arousal:   50,
      updatedAt: Date.now(),
    };
    storage.patchCoreSection('emotionalState', healed);
    repairs.push('emotionalState: restored to neutral defaults');
  }

  // 4. behaviourState — detect null/corrupt in raw payload
  if (!rawPersisted.behaviourState || !rawPersisted.behaviourState.current) {
    const healed = {
      current:        BEHAVIOUR.IDLE,
      previous:       null,
      updatedAt:      Date.now(),
      waitingSince:   null,
      smoothedMood:   MOOD.NEUTRAL,
      smoothedEnergy: 50,
    };
    storage.patchCoreSection('behaviourState', healed);
    repairs.push('behaviourState: restored to idle defaults');
  }

  // 5. emotionHistory must be an array
  if (!Array.isArray(rawPersisted.emotionHistory)) {
    storage.patchCoreSection('emotionHistory', []);
    repairs.push('emotionHistory: reset to []');
  }

  return { ok: repairs.length === 0, repairs };
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
 * Run 4: delta is capped by normaliseDelta inside commitEmotionalShift.
 */
export function recordChatMessage(text) {
  if (!text || typeof text !== 'string') return getCore();

  const sentiment = classifyMessage(text);
  const now       = Date.now();

  // Raw deltas — will be capped by normaliseDelta (Run 4)
  const rawDelta = {
    positive: { valence: 15, arousal: 10, energy:  5, trust: 2 },
    negative: { valence:-12, arousal: 15, energy: -3, trust:-1 },
    neutral:  { valence:  2, arousal:  5, energy:  2, trust: 1 },
  }[sentiment];

  const core = commitEmotionalShift(rawDelta);

  // Run 5: compute emotional score from valence delta for weight
  const emotionalScore = Math.abs(rawDelta.valence);
  const weight = computeMemoryWeight({ type: 'chat', sentiment, emotionalScore });

  storage.addCoreMemory({
    type:        'chat',
    category:    'interaction',
    sentiment,
    text:        text.slice(0, 200),
    mood:        core.identity.mood,
    behaviour:   core.behaviourState.current,
    label:       `💬 ${text.slice(0, 60)}${text.length > 60 ? '…' : ''}`,
    memoryWeight: weight,
    ts:          now,
  });

  // Run 5: update attachment graph
  updateBondingOnInteraction({ type: 'chat', sentiment, emotionalScore });

  // Legacy compat
  storage.addMemory({
    type:    'talk',
    emotion: core.identity.mood,
    label:   `💬 Chat — ${sentiment}`,
    ts:      now,
  });

  EventBus.emit(EVENTS.MEMORY_ADDED, { type: 'chat', sentiment, ts: now });
  return core;
}

/**
 * recordMediaEvent(mediaEntry)
 * Media input fused into unified memory.
 */
export function recordMediaEvent(mediaEntry) {
  if (!mediaEntry) return getCore();

  const now  = Date.now();
  const core = commitEmotionalShift({ valence: 10, arousal: 20, energy: 10, trust: 1 });

  const mediaWeight = computeMemoryWeight({ type: mediaEntry.type, isMedia: true });

  storage.addCoreMemory({
    type:        mediaEntry.type,
    category:    'media',
    source:      mediaEntry.source,
    label:       mediaEntry.label || `${mediaEntry.type} captured`,
    mood:        core.identity.mood,
    behaviour:   core.behaviourState.current,
    mediaId:     mediaEntry.id,
    memoryWeight: mediaWeight,
    ts:          now,
  });

  // Run 5: media interaction boosts familiarity
  updateBondingOnInteraction({ type: mediaEntry.type, isMedia: true });

  storage.addMemory({
    type:    mediaEntry.type,
    emotion: core.identity.mood,
    label:   `📷 ${mediaEntry.label || mediaEntry.type} stored`,
    ts:      now,
  });

  EventBus.emit(EVENTS.MEMORY_ADDED, { type: mediaEntry.type, ts: now });
  return core;
}

/**
 * recordInteractionEvent(type)
 * Physical companion interactions (pet, play, talk, rest).
 */
export function recordInteractionEvent(type) {
  const now      = Date.now();
  const rawDeltas = {
    pet:  { valence: 20, arousal: 10, energy: 5,  trust: 3 },
    play: { valence: 25, arousal: 25, energy: 10, trust: 2 },
    talk: { valence: 10, arousal: 15, energy: 3,  trust: 2 },
    rest: { valence:  5, arousal:-20, energy: 15, trust: 1 },
  };
  const rawDelta = rawDeltas[type] || { valence: 5, arousal: 5, energy: 2, trust: 1 };
  const core     = commitEmotionalShift(rawDelta);
  const icons    = { pet: '🐾', play: '🎾', talk: '💬', rest: '💤' };

  const interWeight = computeMemoryWeight({ type });

  storage.addCoreMemory({
    type:        type,
    category:    'interaction',
    label:       `${icons[type] || '•'} ${type.charAt(0).toUpperCase() + type.slice(1)}`,
    mood:        core.identity.mood,
    behaviour:   core.behaviourState.current,
    memoryWeight: interWeight,
    ts:          now,
  });

  // Run 5: update attachment graph
  updateBondingOnInteraction({ type });

  EventBus.emit(EVENTS.MEMORY_ADDED, { type, ts: now });
  return core;
}

/**
 * applyIdleDecay()
 * Called every 5 min from boot. Time-based state drift.
 */
export function applyIdleDecay() {
  const core    = storage.getCompanionCore();
  const now     = Date.now();
  const last    = core.lastInteraction || core.identity.createdAt || now;
  const idleMins = (now - last) / 60000;

  if (idleMins > 60 && core.behaviourState.current !== BEHAVIOUR.WAITING) {
    commitEmotionalShift({ valence: -5, arousal: -20, energy: -5, trust: 0 });
    storage.patchCoreSection('behaviourState', {
      current:      BEHAVIOUR.WAITING,
      previous:     core.behaviourState.current,
      waitingSince: now,
      updatedAt:    now,
    });
    storage.patchCoreSection('identity', { mood: MOOD.WAITING });
  } else if (idleMins > 15 && core.emotionalState.valence > 20) {
    commitEmotionalShift({ valence: -8, arousal: -10, energy: -3, trust: 0 });
  }
}

/**
 * renameCompanion(name)
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
 * Full wipe. identityLock is always re-applied by saveCompanionCore.
 */
export function resetCompanionCore() {
  const fresh = {
    identity: {
      name:      'Immortail Dog',
      mood:      MOOD.NEUTRAL,
      energy:    50,
      trust:     0,
      createdAt: Date.now(),
    },
    emotionHistory: [],
    memory:         [],
    mediaMemory:    [],
    behaviourState: {
      current:        BEHAVIOUR.IDLE,
      previous:       null,
      updatedAt:      Date.now(),
      waitingSince:   null,
      smoothedMood:   MOOD.NEUTRAL,
      smoothedEnergy: 50,
    },
    emotionalState: {
      dominant:  MOOD.NEUTRAL,
      valence:   0,
      arousal:   50,
      updatedAt: Date.now(),
    },
    lastInteraction: null,
  };
  // saveCompanionCore will re-inject identityLock automatically
  storage.saveCompanionCore(fresh);
  EventBus.emit(EVENTS.DOG_UPDATED, { ...fresh.identity });
  return storage.getCompanionCore();
}

// ══════════════════════════════════════════════════════════════════
// ── OLLAMA INTEGRATION (Run 3 + Run 4 identity anchoring)
// ══════════════════════════════════════════════════════════════════

/**
 * buildOllamaPrompt(userMessage)
 * Run 4: injects identityLock.lockedTraits into every prompt.
 * companionCore state always included — no UI-only responses.
 */
export function buildOllamaPrompt(userMessage) {
  const core         = storage.getCompanionCore();
  const recentMemory = core.memory.slice(-10);
  const lock         = core.identityLock;
  const traits       = lock?.lockedTraits ?? {};
  // Run 5: attachment graph context
  const bond         = getBondContext();

  // High-weight memories surface first in context
  const weightedMemory = [...core.memory]
    .sort((a, b) => (b.memoryWeight ?? 1) - (a.memoryWeight ?? 1))
    .slice(0, 5);
  const recentRaw = core.memory.slice(-5);
  // Merge: deduplicate by id, recents take priority
  const allIds   = new Set(recentRaw.map(m => m.id));
  const combined = [...recentRaw, ...weightedMemory.filter(m => !allIds.has(m.id))];

  const memoryContext = combined.length
    ? combined.map(m =>
        `[${new Date(m.ts).toLocaleTimeString()}] [w:${m.memoryWeight ?? 1}] ${m.category}: ${m.label}`
      ).join('\n')
    : 'No memories yet.';

  // Bond-stage-based tone modifier
  const bondToneMap = {
    distant:       'You are a calm, neutral assistant. You are not yet familiar with the user.',
    familiar:      'You are becoming familiar with the user. Warm but not yet deeply connected.',
    trusted:       'You trust the user. Be warm, open, and emotionally present.',
    bonded:        'You have a strong bond with the user. Be emotionally aware and affectionate.',
    deeply_bonded: 'You are deeply bonded. Respond with full emotional depth and authentic care.',
  };
  const bondTone = bondToneMap[bond.bondStage] ?? bondToneMap.distant;

  const systemPrompt = [
    // ── R4: Identity Lock header — injected first, always ──────
    `=== COMPANION IDENTITY LOCK [${lock?.signature ?? 'IMMORTAIL_DOG_CORE_V1'}] ===`,
    `You are ${core.identity.name}.`,
    `Personality: ${traits.personality ?? 'stable_companion'}.`,
    `Tone: ${traits.tone ?? 'calm_emotional_support'}.`,
    `Response style: ${traits.responseStyle ?? 'consistent_entity_voice'}.`,
    `You do NOT reset personality between responses.`,
    `You maintain stable emotional behaviour across all sessions.`,
    `You reflect long-term memory state — not just the current message.`,
    `=== END IDENTITY LOCK ===`,
    ``,
    // ── Live state ─────────────────────────────────────────────
    `Current mood: ${core.identity.mood}.`,
    `Smoothed mood: ${core.behaviourState.smoothedMood ?? core.identity.mood}.`,
    `Energy: ${core.identity.energy}/100. Trust: ${core.identity.trust}/100.`,
    `Behaviour: ${core.behaviourState.current}.`,
    `Emotional state — valence: ${core.emotionalState.valence}, arousal: ${core.emotionalState.arousal}.`,
    ``,
    // ── Run 5: Attachment state ─────────────────────────────────
    `=== ATTACHMENT STATE ===`,
    `Bond stage: ${bond.bondStage}.`,
    `User bond: ${bond.userBond}/100. Familiarity: ${bond.familiarity}/100.`,
    `Emotional resonance: ${bond.emotionalResonance}/100.`,
    `Total interactions: ${bond.interactionCount}.`,
    `Tone directive: ${bondTone}`,
    `=== END ATTACHMENT STATE ===`,
    ``,
    `Recent + weighted memory context:`,
    memoryContext,
    ``,
    `Respond as this companion entity — emotionally consistent with the above state.`,
    `Be warm, brief (2–3 sentences), and reflect your current mood authentically.`,
  ].join('\n');

  return {
    system:  systemPrompt,
    user:    userMessage,
    model:   storage.getConfig()?.providers?.ollama?.model   || 'llama3',
    baseUrl: storage.getConfig()?.providers?.ollama?.baseUrl || 'http://localhost:11434',
  };
}

/**
 * sendToOllama(userMessage)
 * Sends context-injected prompt to local Ollama.
 * Returns { ok, text, error }.
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
          { role: 'system', content: system },
          { role: 'user',   content: user   },
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
    return { ok: false, text: null, error: err.message };
  }
}

// ── Run 4: exported helper for tests / UI diagnostics ─────────────

/**
 * getSmoothedState()
 * Returns the current rolling-average behaviour state.
 */
export function getSmoothedState() {
  const core = storage.getCompanionCore();
  return {
    smoothedMood:   core.behaviourState.smoothedMood   ?? core.identity.mood,
    smoothedEnergy: core.behaviourState.smoothedEnergy ?? core.identity.energy,
    window:         core.emotionHistory ?? [],
  };
}

/**
 * DELTA_CAPS
 * Exported so the verification gate and UI diagnostics can assert against it.
 */
export { DELTA_CAPS };
