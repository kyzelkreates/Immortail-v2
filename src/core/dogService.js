// ================================================================
// IMMORTAIL™ MVP — DOG SERVICE (Central Logic Hub)
// Owns all companion state transitions.
// Reads/writes only through storage. Emits only through EventBus.
// ================================================================

import storage from './storage.js';
import { EventBus, EVENTS } from './eventBus.js';

// ── Constants ─────────────────────────────────────────────────────

export const EMOTION = {
  CALM:    'calm',
  HAPPY:   'happy',
  CURIOUS: 'curious',
  SLEEPY:  'sleepy',
};

export const BEHAVIOUR = {
  IDLE:       'idle',
  ATTENTIVE:  'attentive',
  PLAYFUL:    'playful',
  RESTING:    'resting',
};

// Emotion → behaviour mapping
const EMOTION_BEHAVIOUR = {
  [EMOTION.CALM]:    BEHAVIOUR.IDLE,
  [EMOTION.HAPPY]:   BEHAVIOUR.PLAYFUL,
  [EMOTION.CURIOUS]: BEHAVIOUR.ATTENTIVE,
  [EMOTION.SLEEPY]:  BEHAVIOUR.RESTING,
};

// Default dog profile
const DEFAULT_DOG = {
  name:             'Luna',
  emotion:          EMOTION.CALM,
  behaviour:        BEHAVIOUR.IDLE,
  bonding:          20,           // 0–100
  lastInteraction:  null,
  totalInteractions:0,
  createdAt:        Date.now(),
};

// ── Internal state (runtime only — source of truth is storage) ────

let _dog = null;

// ── Helpers ───────────────────────────────────────────────────────

function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

function deriveBehaviour(emotion) {
  return EMOTION_BEHAVIOUR[emotion] || BEHAVIOUR.IDLE;
}

// ── Boot / hydration ─────────────────────────────────────────────

export function hydrateDog() {
  const persisted = storage.getDog();
  _dog = persisted ? { ...DEFAULT_DOG, ...persisted } : { ...DEFAULT_DOG };
  // Ensure bonding doesn't exceed 100 from old data
  _dog.bonding = clamp(_dog.bonding);
  return { ..._dog };
}

// ── Read ─────────────────────────────────────────────────────────

export function getDog() {
  return _dog ? { ..._dog } : hydrateDog();
}

// ── Persist + broadcast ──────────────────────────────────────────

function commit(patch = {}) {
  _dog = { ..._dog, ...patch };
  storage.saveDog(_dog);
  EventBus.emit(EVENTS.DOG_UPDATED, { ..._dog });
  return { ..._dog };
}

// ── Core interactions ────────────────────────────────────────────

/**
 * recordInteraction()
 * Called whenever the user taps/interacts with the companion.
 * Updates emotion, bonding, and records memory.
 */
export function recordInteraction(type = 'pet') {
  const now = Date.now();
  const timeSince = _dog?.lastInteraction
    ? (now - _dog.lastInteraction) / 1000
    : Infinity;

  // Emotion shift based on interaction type
  const emotionMap = {
    pet:  EMOTION.HAPPY,
    play: EMOTION.HAPPY,
    talk: EMOTION.CURIOUS,
    rest: EMOTION.SLEEPY,
  };
  const newEmotion = emotionMap[type] || EMOTION.CURIOUS;

  // Bonding: small increment per interaction, dampens at high values
  const bondGain = _dog.bonding >= 80 ? 1 : _dog.bonding >= 50 ? 2 : 3;

  const updated = commit({
    emotion:          newEmotion,
    behaviour:        deriveBehaviour(newEmotion),
    bonding:          clamp(_dog.bonding + bondGain),
    lastInteraction:  now,
    totalInteractions:(_dog.totalInteractions || 0) + 1,
  });

  // Memory entry
  addMemory({
    type,
    emotion:  newEmotion,
    bonding:  updated.bonding,
    label:    interactionLabel(type, newEmotion),
  });

  EventBus.emit(EVENTS.INTERACTION, { type, emotion: newEmotion });
  return updated;
}

/**
 * setEmotion()
 * Explicit emotion override (e.g. time-of-day routine).
 */
export function setEmotion(emotion) {
  if (!Object.values(EMOTION).includes(emotion)) return getDog();
  return commit({ emotion, behaviour: deriveBehaviour(emotion) });
}

/**
 * rename()
 * Update companion name.
 */
export function rename(name) {
  const clean = String(name).trim().slice(0, 24);
  if (!clean) return getDog();
  return commit({ name: clean });
}

/**
 * resetDog()
 * Full profile wipe (Settings → Reset).
 */
export function resetDog() {
  _dog = { ...DEFAULT_DOG, createdAt: Date.now() };
  storage.saveDog(_dog);
  storage.saveMemories([]);
  EventBus.emit(EVENTS.DOG_UPDATED, { ..._dog });
  return { ..._dog };
}

// ── Memory helpers ────────────────────────────────────────────────

function interactionLabel(type, emotion) {
  const labels = {
    pet:  ['A gentle pat 🐾', 'Soft pets 🐾', 'Head scratches 🐾'],
    play: ['Playtime! 🎾', 'So much fun 🎾', 'Energetic play 🎾'],
    talk: ['A chat 💬', 'Quiet conversation 💬', 'Listening closely 💬'],
    rest: ['Naptime 💤', 'Resting together 💤', 'Peaceful rest 💤'],
  };
  const pool = labels[type] || ['An interaction'];
  return pool[Math.floor(Date.now() / 1000) % pool.length];
}

function addMemory(data) {
  storage.addMemory({
    ...data,
    ts: Date.now(),
  });
  EventBus.emit(EVENTS.MEMORY_ADDED, data);
}

// ── Idle decay (call periodically from runtime) ────────────────────

/**
 * applyIdleDecay()
 * After 30+ min of no interaction, gently shift toward calm/sleepy.
 * Call from a setInterval in boot (every 5 min).
 */
export function applyIdleDecay() {
  if (!_dog) return;
  const now = Date.now();
  const last = _dog.lastInteraction || _dog.createdAt;
  const idleMins = (now - last) / 60000;

  if (idleMins > 60 && _dog.emotion !== EMOTION.SLEEPY) {
    commit({ emotion: EMOTION.SLEEPY, behaviour: BEHAVIOUR.RESTING });
  } else if (idleMins > 15 && _dog.emotion === EMOTION.HAPPY) {
    commit({ emotion: EMOTION.CALM, behaviour: BEHAVIOUR.IDLE });
  }
}
