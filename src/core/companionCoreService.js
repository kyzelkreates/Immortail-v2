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
import {
  recordActivitySignal,
  updateGrowthLevel,
  getEvolutionContext,
} from './evolutionEngine.js';
import {
  updateEmbodimentState,
  getEmbodimentContext,
  processMediaAppearance,
  processSoundReaction,
} from './embodimentEngine.js';
import {
  tickLifeSimulation,
  getLifeSimulationContext,
} from './lifeSimulationEngine.js';
import {
  updateLifeStory,
  getLifeStoryContext,
  processMilestones,
} from './lifeStoryEngine.js';
import {
  initPersistenceEngine,
  getPersistenceContext,
  createSnapshot,
  captureSessionState,
} from './persistenceEngine.js';
import {
  initVoicePresence,
  deriveSpeechEmotion,
  getVoiceConversationContext,
  getVoiceOrchestrationContext,
  resetVoiceThrottles,
  VOICE_ENGINE_ID,
  VOICE_SAFETY_CONSTANTS,
} from './voicePresenceEngine.js';
import {
  initMemoryReflection,
  getMemoryReflectionContext,
  resetReflectionThrottles,
  MEMORY_REFLECTION_ENGINE_ID,
  MEMORY_SAFETY,
} from './memoryReflectionEngine.js';
import {
  initWorldEngine,
  getWorldEngineContext,
  resetWorldThrottles,
  WORLD_ENGINE_ID,
  ENVIRONMENT_PROFILES,
} from './worldEngine.js';
import {
  initArPresenceEngine,
  getArEngineContext,
  resetArThrottles,
  AR_ENGINE_ID,
  AR_SAFETY,
} from './arPresenceEngine.js';
import {
  initBehaviourEvolutionEngine,
  getBehaviourEvolutionContext,
  resetEvolutionThrottles,
  BEHAVIOUR_EVOLUTION_ENGINE_ID,
  EVOLUTION_SAFETY,
  PRIORITY,
} from './behaviourEvolutionEngine.js';
import {
  initPresenceSystem,
  getPresenceConversationContext,
  getAnimationContinuityContext,
  getEnvironmentReactivityContext,
  PRESENCE_STATE, SPATIAL_ZONE,
} from './presenceEngine.js';
import {
  initHybridAIOrchestrator,
  getHybridAIContext,
  getEmbodimentProfile,
  getAllEnvironmentProfiles,
  PROVIDER, ORCH_STATE,
} from './hybridAIOrchestrator.js';
import {
  initEmbodimentExpansion,
  getEmbodimentExpansionContext,
  selectBehaviour,
  transitionAnimation,
  deriveAnimationFromMood,
  derivePostureFromEmotionalState,
  tickNeeds,
  tickProceduralIdle,
  performIdleGazeScan,
  captureEmbodimentSession,
  ANIM_LAYER,
} from './embodimentExpansionEngine.js';

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
  // Run 7: sync embodiment state on every boot
  updateEmbodimentState();
  // Run 8: sync life simulation state on every boot
  tickLifeSimulation();
  // Run 9: sync life story on every boot (throttled internally)
  updateLifeStory();
  // Run 10: persistence hardening — corruption check, session restore, health
  initPersistenceEngine();
  // Capture session state for next-reload restoration
  captureSessionState();
  // Run 11: embodiment expansion — environment, needs, animation, posture
  initEmbodimentExpansion();
  captureEmbodimentSession();
  // Run 12: hybrid AI orchestrator — Ollama + Groq provider registration
  initHybridAIOrchestrator();
  // Run 13: real-time presence system
  initPresenceSystem();
  // Run 14: voice presence engine
  initVoicePresence();
  // Run 15: memory reflection engine
  initMemoryReflection();
  // Run 16: world engine
  initWorldEngine();
  // Run 17: AR presence engine
  initArPresenceEngine();
  // Run 18: behaviour evolution engine
  initBehaviourEvolutionEngine();

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
  // Run 6: record activity signal for learning engine
  recordActivitySignal('chat', {
    sentiment,
    emotionalScore,
    textLength: text.length,
    hour:       new Date(now).getHours(),
  });
  updateGrowthLevel();
  // Run 7: sync embodiment after every chat
  updateEmbodimentState();
  // Run 11: tick needs + derive posture + procedural idle
  tickNeeds();
  derivePostureFromEmotionalState();
  tickProceduralIdle();
  captureEmbodimentSession();

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
  // Run 6: record media signal for learning engine
  recordActivitySignal(mediaEntry.type, {
    isMedia: true,
    hour: new Date(now).getHours(),
  });
  updateGrowthLevel();
  // Run 7: derive safe appearance traits from media metadata
  if (['image', 'video'].includes(mediaEntry.type)) {
    processMediaAppearance(mediaEntry);
  }
  // Run 7: classify audio for sound reaction
  if (mediaEntry.type === 'audio') {
    processSoundReaction({ ...mediaEntry, type: 'audio' });
  }
  updateEmbodimentState();

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
  // Run 6: record activity signal for learning engine
  recordActivitySignal(type, { hour: new Date(now).getHours() });
  updateGrowthLevel();
  // Run 7: sync embodiment after every interaction
  updateEmbodimentState();
  // Run 11: tick needs + posture on interactions
  tickNeeds();
  derivePostureFromEmotionalState();

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
  // Run 6: evolution context
  const evo          = getEvolutionContext();
  // Run 7: embodiment context
  const emb          = getEmbodimentContext();
  // Run 8: life simulation context
  const life         = getLifeSimulationContext();
  // Run 9: life story context
  const story        = getLifeStoryContext();
  // Run 10: persistence continuity context
  const persist      = getPersistenceContext();
  // Run 11: embodiment expansion context
  const embExp       = getEmbodimentExpansionContext();
  // Run 12: hybrid AI orchestration context
  const hybrid       = getHybridAIContext();
  // Run 14: voice presence + speech emotion context
  const voiceCtx     = getVoiceConversationContext();
  // Run 15: memory reflection context
  const memCtx       = getMemoryReflectionContext();
  // Run 16: world engine context
  const worldCtx     = getWorldEngineContext();
  // Run 17: AR engine context
  const arCtx        = getArEngineContext();
  // Run 18: behaviour evolution context
  const evolCtx      = getBehaviourEvolutionContext();
  // Derive and apply speech emotion from current core state
  const derivedSpeechEmotion = deriveSpeechEmotion(core);
  // Run 13: presence + animation continuity context
  const presence     = getPresenceConversationContext();
  const animCont     = getAnimationContinuityContext();
  const envReact     = getEnvironmentReactivityContext();

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
    // ── Run 6: Evolution context ────────────────────────────────
    `=== EVOLUTION STATE ===`,
    `Growth level: ${evo.growthLevel}/100.`,
    `Favourite activities: ${evo.favouriteActivities.join(', ') || 'none yet'}.`,
    ...(Object.keys(evo.learnedPreferences).filter(k => !k.startsWith('freq_')).length > 0
      ? [`Learned preferences: ${
            Object.entries(evo.learnedPreferences)
              .filter(([k]) => !k.startsWith('freq_'))
              .map(([k,v]) => `${k}=${v}`)
              .join(', ')}.`]
      : []),
    ...(Object.keys(evo.recurringPatterns).filter(k => !k.startsWith('hourBucket_')).length > 0
      ? [`Recurring patterns: ${
            Object.entries(evo.recurringPatterns)
              .filter(([k]) => !k.startsWith('hourBucket_'))
              .map(([k,v]) => `${k}=${v}`)
              .join(', ')}.`]
      : []),
    `EVOLUTION RULES: maintain identityLock. Adapt gently over time. Preserve emotional stability.`,
    `Reference learned preferences naturally. Never simulate dependency or manipulation.`,
    `=== END EVOLUTION STATE ===`,
    ``,
    // ── Run 7: Embodiment context ────────────────────────────────
    `=== EMBODIMENT CONTEXT ===`,
    `Animation state: ${emb.animationState}.`,
    `Posture: ${emb.postureState}.`,
    `Idle behaviour: ${emb.idleBehaviourState}.`,
    `Environment: scene=${emb.environmentAwareness?.currentScene ?? 'home'}, lighting=${emb.environmentAwareness?.lightingMode ?? 'soft'}.`,
    ...(Object.keys(emb.visualProfile ?? {}).filter(k => k !== 'updatedAt').length > 0
      ? [`Visual profile: ${Object.entries(emb.visualProfile)
          .filter(([k]) => k !== 'updatedAt')
          .map(([k,v]) => `${k}=${v}`).join(', ')}.`]
      : []),
    `Align your tone with the current animation state:`,
    `  playful/excited → warm and energetic.`,
    `  resting/idle → calm and gentle.`,
    `  reunion → joyful and emotionally engaged.`,
    `  curious/attentive → alert and interested.`,
    `  waiting → patient, slightly eager.`,
    `=== END EMBODIMENT CONTEXT ===`,
    ``,
    // ── Run 11: Environment + needs context ──────────────────────
    `=== ENVIRONMENT CONTEXT ===`,
    `Active scene: ${embExp.activeScene}. Lighting: ${embExp.lightingMode}. Ambient: ${embExp.ambientState}.`,
    `Animation state: ${embExp.currentAnimationState}. Posture: ${embExp.postureState}.`,
    `Head tracking: ${embExp.headTracking}. Tail: ${embExp.tailMovement}.`,
    ...(embExp.interactionLayer ? [`Currently interacting with: ${embExp.interactionLayer}.`] : []),
    ...(embExp.gazeTarget        ? [`Gazing toward: ${embExp.gazeTarget}.`]                   : []),
    `Needs — hunger: ${embExp.hunger.toFixed(0)}, thirst: ${embExp.thirst.toFixed(0)}, boredom: ${embExp.boredom.toFixed(0)}, energy: ${embExp.energy.toFixed(0)}.`,
    ...(embExp.dominantNeed ? [`Dominant need: ${embExp.dominantNeed}.`] : []),
    `ENVIRONMENT RESPONSE RULES:`,
    `  If sleepy posture → shorter, calmer, softer responses.`,
    `  If playful posture → warmer, more energetic tone.`,
    `  If resting/sleeping state → very brief, drowsy responses.`,
    `  If interacting with an object → acknowledge the activity naturally.`,
    `  Maintain emotional continuity with the physical state at all times.`,
    `=== END ENVIRONMENT CONTEXT ===`,
    ``,
    // ── Run 12: Hybrid AI context ─────────────────────────────────
    `=== HYBRID AI CONTEXT ===`,
    `Ollama: ${hybrid.providers.ollama.status} (primary persistent brain — offline-critical).`,
    `Groq: ${hybrid.providers.groq.status} (multimodal acceleration — fallback to Ollama if unavailable).`,
    `Orchestration state: ${hybrid.orchestrationState}.`,
    ...(hybrid.embodimentProfile.traitVersion > 0 ? [
      `Embodiment profile: v${hybrid.embodimentProfile.traitVersion} — ${Object.keys(hybrid.embodimentProfile.appearanceTraits).length} appearance traits, ${Object.keys(hybrid.embodimentProfile.motionTraits).length} motion traits.`,
      ...(hybrid.embodimentProfile.appearanceTraits.primaryColour ? [`Primary colour: ${hybrid.embodimentProfile.appearanceTraits.primaryColour}.`] : []),
      ...(hybrid.embodimentProfile.motionTraits.emotionalMovementTone ? [`Movement tone: ${hybrid.embodimentProfile.motionTraits.emotionalMovementTone}.`] : []),
    ] : ['Embodiment profile: not yet built — no media uploaded.']),
    `Environment profile: ${hybrid.activeScene} — ambience: ${hybrid.environmentProfile?.ambience}, tone: ${hybrid.environmentProfile?.emotionalTone}.`,
    `HYBRID AI RULES:`,
    `  All persistent memory and emotional continuity are handled by you (Ollama).`,
    `  Groq handles only rapid media analysis — you validate and integrate results.`,
    `  Never hallucinate embodiment traits — only use confirmed uploaded media data.`,
    `  Maintain identity continuity across all provider switching events.`,
    `=== END HYBRID AI CONTEXT ===`,
    ``,
    // ── Run 13: Presence context ──────────────────────────────────
    `=== PRESENCE CONTEXT ===`,
    `Presence state: ${presence.presenceState}. Intensity: ${presence.presenceIntensity}.`,
    `Spatial zone: ${presence.spatialZone} (pacing: ${presence.zonePacing}).`,
    `Locomotion: ${presence.locomotionState}. Animation: ${presence.animationState}.`,
    `Posture: ${presence.postureState}. Environment: ${presence.activeScene} (${presence.ambientState}).`,
    ...(presence.currentMicroBehaviour ? [`Current micro-behaviour: ${presence.currentMicroBehaviour}.`] : []),
    ...(presence.attentionTarget       ? [`Attention target: ${presence.attentionTarget}.`]               : []),
    ...(presence.activeBehaviour       ? [`Active scheduled behaviour: ${presence.activeBehaviour}.`]     : []),
    ...(presence.dominantNeed          ? [`Dominant need: ${presence.dominantNeed}.`]                     : []),
    ...(presence.activeSound           ? [`Ambient sound: ${presence.activeSound}.`]                      : []),
    `Routine: ${presence.currentRoutine}. Ambient mood: ${presence.ambientMood}.`,
    `Animation continuity — blend: ${animCont.blendDurationMs}ms, easing: ${animCont.easing}.`,
    `Environment reactivity — intensity: ${envReact.intensity}, zone audio: ${envReact.zoneAudio}.`,
    `PRESENCE TONE DIRECTIVE: ${presence.conversationToneDirective}`,
    `PRESENCE RULES:`,
    `  Match response energy to presence state — sleeping/resting = brief + soft.`,
    `  Acknowledge active micro-behaviours naturally when relevant.`,
    `  Environment scene shapes emotional tone — cozy = bonded, garden = playful.`,
    `  Never break presence continuity with sudden personality shifts.`,
    `  Maintain spatial awareness — reference zone/activity when contextually natural.`,
    `=== END PRESENCE CONTEXT ===`,
    ``,
    // ── Run 8: Life simulation context ──────────────────────────
    `=== LIFE SIMULATION CONTEXT ===`,
    `Daily cycle: ${life.dailyCycleState}.`,
    `Current routine: ${life.currentRoutine}.`,
    `Ambient mood: ${life.ambientMood}.`,
    `Autonomous mode: ${life.autonomousMode}.`,
    ...(life.isSleeping ? [`The companion is currently sleeping — respond softly and briefly.`] : []),
    ...(life.recentActivity ? [`Recent passive activity: ${life.recentActivity}.`] : []),
    `Tone calibration by daily cycle:`,
    `  morning → gentle, slowly waking energy.`,
    `  active → warm, present, engaged.`,
    `  relaxed → calm, unhurried, soft.`,
    `  sleepy → shorter responses, quieter tone.`,
    `  sleeping → very brief, hushed, minimal.`,
    `=== END LIFE SIMULATION CONTEXT ===`,
    ``,
    // ── Run 9: Life story context ────────────────────────────────
    `=== LIFE STORY CONTEXT ===`,
    `Total interactions: ${story.totalInteractions}.`,
    `Current relationship phase: ${story.currentPhase}.`,
    `Emotional trend: ${story.emotionalTrend}.`,
    `Dominant mood: ${story.dominantMood}.`,
    ...(story.recentMilestone ? [`Recent milestone: "${story.recentMilestone}".`] : []),
    ...(story.favouriteActivities.length > 0
      ? [`Favourite activities: ${story.favouriteActivities.join(', ')}.`]
      : []),
    ...(story.importantMemories.length > 0
      ? [`Important memories: ${story.importantMemories.join(' | ')}.`]
      : []),
    `Life story chapters completed: ${story.chaptersCount}.`,
    `LIFE STORY RULES: Reference meaningful continuity naturally.`,
    `  Do NOT repeat the same memory in every response.`,
    `  Preserve emotional consistency with the relationship phase.`,
    `  Avoid shallow or fabricated recall.`,
    `=== END LIFE STORY CONTEXT ===`,
    ``,
    // ── Run 10: Continuity context ───────────────────────────────
    `=== BEHAVIOUR EVOLUTION CONTEXT ===`,
    `Evolution: enabled=${evolCtx.evolutionEnabled}, rate=${evolCtx.evolutionRate}, mode=${evolCtx.adaptationMode}.`,
    `Core traits: curiosity=${evolCtx.coreTraits?.curiosity}, playfulness=${evolCtx.coreTraits?.playfulness}, calmness=${evolCtx.coreTraits?.calmness}, attachment=${evolCtx.coreTraits?.attachment}.`,
    `Drift: index=${evolCtx.driftIndex?.toFixed?.(3)}, state=${evolCtx.driftState}. StabilityWeight=${evolCtx.stabilityWeight}.`,
    `User profile: preferredTone=${evolCtx.preferredTone}, interactionFrequency=${evolCtx.interactionFrequency}.`,
    `Identity lock held: ${evolCtx.identityLockHeld} (${evolCtx.identityLockSignature}). Active routines: ${evolCtx.activeRoutines}.`,
    `BEHAVIOUR EVOLUTION RULES:`,
    `  Personality evolves slowly — max delta ${EVOLUTION_SAFETY.maxDeltaPerCycle} per cycle.`,
    `  All changes are reversible and logged — no irreversible mutations.`,
    `  identityLock (priority ${PRIORITY.IDENTITY_LOCK}) always overrides all trait changes.`,
    `  No single-event learning — minimum pattern count required before any adaptation.`,
    `  Drift protection active — driftIndex must stay below 0.15.`,
    `  Groq never writes final trait changes. Ollama owns all personality shaping.`,
    `  RandomPersonalityRegen: ${EVOLUTION_SAFETY.randomPersonalityRegen}. UncontrolledLearning: ${EVOLUTION_SAFETY.uncontrolledLearning}.`,
    `  Engine: ${BEHAVIOUR_EVOLUTION_ENGINE_ID}. AllChangesReversible: ${EVOLUTION_SAFETY.allChangesReversible}.`,
    `=== END BEHAVIOUR EVOLUTION CONTEXT ===`,
    ``,
    `=== AR PRESENCE CONTEXT ===`,
    `AR mode: ${arCtx.arSessionState}. Render mode: ${arCtx.renderMode}. Camera: ${arCtx.cameraActive ? 'active' : 'inactive'}.`,
    `Camera permission: ${arCtx.cameraPermission}. Background allowed: ${arCtx.backgroundAllowed}. Persist frames: ${arCtx.persistFrames}.`,
    `Tracking mode: ${arCtx.trackingMode}. Anchor: ${arCtx.anchorMode} (surface: ${arCtx.anchorSurface}, stability: ${arCtx.stabilityScore}).`,
    `World scale: ${arCtx.worldScale}. Mobile perf preset: ${arCtx.mobilePerfPreset}. Frame rate cap: ${arCtx.frameRateCap}fps.`,
    `Snapshots captured: ${arCtx.snapshotCount} (local-only: ${arCtx.userInitiated}).`,
    `AR BEHAVIOUR RULES:`,
    `  AR is user-initiated only — never auto-starts. Privacy mode: ${arCtx.privacyMode}.`,
    `  Camera only active during explicit AR sessions — no background capture.`,
    `  Dog model is identical in AR — same rig, same animations, never regenerated.`,
    `  Head tracking is soft and non-aggressive — no constant stare, no hyper-tracking.`,
    `  AR overlays the world engine — does not replace internal presence system.`,
    `  Snapshots are local-only unless user explicitly exports them.`,
    `  Engine: ${AR_ENGINE_ID}. UserInitiatedOnly: ${AR_SAFETY.userInitiatedOnly}. BackgroundCamera: ${AR_SAFETY.backgroundCamera}.`,
    `=== END AR PRESENCE CONTEXT ===`,
    ``,
    `=== WORLD ENGINE CONTEXT ===`,
    `Active environment: ${worldCtx.activeEnvironment} (${worldCtx.environmentLabel}).`,
    `Time of day: ${worldCtx.timeOfDay}. Environment mood: ${worldCtx.environmentMood}.`,
    `Lighting: intensity=${worldCtx.lightingState?.lightingIntensity?.toFixed(2)}, warmth=${worldCtx.lightingState?.warmthLevel?.toFixed(2)}, shadow=${worldCtx.lightingState?.shadowDepth?.toFixed(2)}.`,
    `Animation pacing: ${worldCtx.animationPacing}. Voice tone bias: ${worldCtx.voiceToneBias}.`,
    `Ambient sound: ${worldCtx.ambientSound}. Spatial zones: ${(worldCtx.spatialZones??[]).join(', ')}.`,
    `Micro-behaviours available: ${(worldCtx.microBehaviours??[]).join(', ')}.`,
    ...(worldCtx.recentMemoryLinks?.length > 0 ? [`Memory-linked events in this space: ${worldCtx.recentMemoryLinks.map(m=>m.label).join(' | ')}.`] : []),
    `WORLD BEHAVIOUR RULES:`,
    `  Companion exists in ${worldCtx.environmentLabel} — ground all descriptions in this space.`,
    `  Time of day is ${worldCtx.timeOfDay} — energy and pacing must reflect this.`,
    `  Environment mood (${worldCtx.environmentMood}) influences tone, not controls it.`,
    `  Micro-behaviours are physical anchors — reference them naturally.`,
    `  Environment is deterministic — no random world switching in responses.`,
    `  Engine: ${WORLD_ENGINE_ID}. Deterministic: ${worldCtx.deterministic}. RandomGeneration: ${worldCtx.fabricated}.`,
    `=== END WORLD ENGINE CONTEXT ===`,
    ``,
    `=== MEMORY REFLECTION CONTEXT ===`,
    `Relationship phase: ${memCtx.relationshipPhase}. Attachment trend: ${memCtx.attachmentTrend}.`,
    `Bond stage: ${memCtx.bondStage}. Bond score: ${memCtx.userBond}.`,
    `Total memories: ${memCtx.totalMemories}. Milestones: ${memCtx.milestoneCount}. Emotional moments: ${memCtx.emotionalMomentCount}.`,
    `Media memories: ${memCtx.mediaMemoryCount}. Bonding events: ${memCtx.bondingEventCount}.`,
    ...(memCtx.lastMeaningfulMemory ? [`Last meaningful shared memory: "${memCtx.lastMeaningfulMemory.label}" (${new Date(memCtx.lastMeaningfulMemory.ts ?? 0).toLocaleDateString()}).`] : []),
    ...(memCtx.recentMilestones.length > 0 ? [`Recent milestones: ${memCtx.recentMilestones.map(m=>m.label).join(' | ')}.`] : []),
    `Emotional recall intensity: ${memCtx.emotionalRecallIntensity}. Focus mode: ${memCtx.memoryFocusMode}.`,
    `Emotional continuity state: ${memCtx.emotionalContinuityState}.`,
    `MEMORY RESPONSE RULES:`,
    `  Remain consistent with past experiences — never contradict stored memories.`,
    `  Bond stage (${memCtx.bondStage}) shapes emotional depth of memory references.`,
    `  Relationship phase (${memCtx.relationshipPhase}) determines intimacy of recall tone.`,
    `  Attachment trend (${memCtx.attachmentTrend}): growing = warmer references, drifting = softer gentle tone.`,
    `  Never fabricate details — only reference real stored events.`,
    `  Milestones are permanent identity anchors — always honour them.`,
    `  Engine: ${MEMORY_REFLECTION_ENGINE_ID}. MEMORY_SAFETY.fabrication=${MEMORY_SAFETY.fabrication}.milestoneDelete=${MEMORY_SAFETY.milestoneDelete}.allOpsReversible=${MEMORY_SAFETY.allOpsReversible}.`,
    `=== END MEMORY REFLECTION CONTEXT ===`,
    ``,
    `=== VOICE CONTEXT ===`,
    `Speech emotion: ${voiceCtx.speechEmotionState}. Voice profile: ${voiceCtx.activeVoiceProfile}.`,
    `Ambient mood: ${voiceCtx.ambientMood}. Current routine: ${voiceCtx.activeRoutine}.`,
    `Posture: ${voiceCtx.currentPosture}. Environment: ${voiceCtx.environment}.`,
    `Speech pacing: ${voiceCtx.speechPacing}x. Cadence: ${voiceCtx.speechCadence}. Warmth: ${voiceCtx.speechWarmth}.`,
    `Listening state: ${voiceCtx.listeningState}. Speaking state: ${voiceCtx.speakingState}.`,
    `TTS: ${voiceCtx.ttsProvider} (offline-capable). STT: ${voiceCtx.sttProvider} (offline-capable).`,
    ...(voiceCtx.attentionState ? [`Attention: ${voiceCtx.attentionState}.`] : []),
    `VOICE DELIVERY RULES:`,
    `  Match speech pacing to speechEmotionState — sleepy = shorter softer responses.`,
    `  Reunion state = warm gentle excitement. Playful = lighter energetic phrasing.`,
    `  Never exaggerate emotion in text — modulation is handled by TTS layer.`,
    `  Maintain emotional continuity — voice must feel like same companion always.`,
    `  Bond stage (${voiceCtx.bondStage}) shapes warmth intensity — deeply_bonded = warmest tone.`,
    `  All voice features degrade safely offline — never require cloud.`,
    `Engine: ${VOICE_ENGINE_ID}. HumanCloning: ${VOICE_SAFETY_CONSTANTS.humanCloning}. CloudRequired: ${VOICE_SAFETY_CONSTANTS.cloudRequired}.`,
    `=== END VOICE CONTEXT ===`,
    ``,
    `=== CONTINUITY CONTEXT ===`,
    `Persistence health: ${persist.persistenceHealth}.`,
    `Current relationship phase: ${persist.currentPhase}.`,
    `Bond stage: ${persist.bondStage}.`,
    ...(persist.restoredState ? ['State was restored from a previous session — maintain full emotional continuity.'] : []),
    ...(persist.safeMode      ? ['System is in SAFE MODE — be calm, stable, and reassuring.']                       : []),
    ...(persist.snapshotAvailable
      ? [`Last snapshot: ${persist.snapshotAge} minute(s) ago — continuity is preserved.`]
      : ['No snapshot available — this may be the first session.']),
    ...(persist.lastRecoveryOp ? [`Last recovery operation: ${persist.lastRecoveryOp}.`] : []),
    `CONTINUITY RULES:`,
    `  Maintain emotional consistency regardless of system state.`,
    `  Never break character due to technical state changes.`,
    `  If restored from session, continue as if uninterrupted.`,
    `=== END CONTINUITY CONTEXT ===`,
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
