// ================================================================
// IMMORTAIL™ — BONDING ENGINE (Run 5)
// Attachment graph, bond stage calculation, memory emotional
// weighting, absence/return response, reunion event generation.
//
// RULES:
// - All reads/writes through storage.getCompanionCore() +
//   storage.saveCompanionCore() / storage.addCoreMemory() only.
// - Extends companionCoreService — never replaces it.
// - No direct UI manipulation.
// - All values clamped [0–100].
// ================================================================

import storage from './storage.js';
import { EventBus, EVENTS } from './eventBus.js';

// ── Bond stage thresholds ─────────────────────────────────────────

export const BOND_STAGE = {
  DISTANT:       'distant',        // 0–10
  FAMILIAR:      'familiar',       // 11–30
  TRUSTED:       'trusted',        // 31–60
  BONDED:        'bonded',         // 61–85
  DEEPLY_BONDED: 'deeply_bonded',  // 86–100
};

const BOND_THRESHOLDS = [
  { max: 10,  stage: BOND_STAGE.DISTANT       },
  { max: 30,  stage: BOND_STAGE.FAMILIAR      },
  { max: 60,  stage: BOND_STAGE.TRUSTED       },
  { max: 85,  stage: BOND_STAGE.BONDED        },
  { max: 100, stage: BOND_STAGE.DEEPLY_BONDED },
];

// ── Absence thresholds (ms) ───────────────────────────────────────

export const ABSENCE_TIER = {
  NONE:         { min: 0,                max: 60 * 60_000,         label: 'none'         }, // 0–1h
  SLIGHT:       { min: 60 * 60_000,      max: 6 * 60 * 60_000,    label: 'slight'       }, // 1–6h
  NOTICEABLE:   { min: 6 * 60 * 60_000,  max: 24 * 60 * 60_000,   label: 'noticeable'   }, // 6–24h
  LONGING:      { min: 24 * 60 * 60_000, max: 72 * 60 * 60_000,   label: 'longing'      }, // 24–72h
  REINFORCEMENT:{ min: 72 * 60 * 60_000, max: Infinity,            label: 'reinforcement'}, // 72h+
};

// ── Memory weight calculator ──────────────────────────────────────

export const WEIGHT = {
  NEUTRAL:            2,  // neutral chat / idle event
  POSITIVE_CHAT:      4,  // positive sentiment message
  NEGATIVE_CHAT:      3,  // negative sentiment message
  EMOTIONAL_CHAT:     6,  // high-emotion message (detected by resonance score)
  INTERACTION_BASIC:  3,  // pet / talk / rest
  INTERACTION_PLAY:   5,  // play (high energy)
  MEDIA:              5,  // media event (image/audio/video)
  MEDIA_EMOTIONAL:    8,  // media + high emotional resonance
  REUNION:            9,  // reunion event
  MILESTONE:          7,  // milestone event
};

// ── Helpers ───────────────────────────────────────────────────────

function clamp100(v) { return Math.max(0, Math.min(100, Math.round(v))); }

function deriveBondStage(userBond) {
  for (const { max, stage } of BOND_THRESHOLDS) {
    if (userBond <= max) return stage;
  }
  return BOND_STAGE.DEEPLY_BONDED;
}

function classifyAbsence(idleMs) {
  if (idleMs < ABSENCE_TIER.NONE.max)         return ABSENCE_TIER.NONE;
  if (idleMs < ABSENCE_TIER.SLIGHT.max)       return ABSENCE_TIER.SLIGHT;
  if (idleMs < ABSENCE_TIER.NOTICEABLE.max)   return ABSENCE_TIER.NOTICEABLE;
  if (idleMs < ABSENCE_TIER.LONGING.max)      return ABSENCE_TIER.LONGING;
  return ABSENCE_TIER.REINFORCEMENT;
}

// ── Internal commit ───────────────────────────────────────────────

function commitAttachmentPatch(patch) {
  const core = storage.getCompanionCore();
  const ag   = core.attachmentGraph ?? {};

  const userBond           = clamp100((ag.userBond           ?? 0) + (patch.userBond           ?? 0));
  const familiarity        = clamp100((ag.familiarity        ?? 0) + (patch.familiarity        ?? 0));
  const emotionalResonance = clamp100((ag.emotionalResonance ?? 0) + (patch.emotionalResonance ?? 0));
  const interactionCount   = (ag.interactionCount ?? 0) + (patch.interactionCount ?? 0);
  const lastSeen           = patch.lastSeen ?? ag.lastSeen ?? null;
  const bondStage          = deriveBondStage(userBond);

  core.attachmentGraph = {
    userBond,
    familiarity,
    emotionalResonance,
    interactionCount,
    lastSeen,
    bondStage,
  };

  storage.saveCompanionCore(core);
  EventBus.emit(EVENTS.DOG_UPDATED, {
    ...core.identity,
    attachmentGraph: core.attachmentGraph,
  });

  return core;
}

// ══════════════════════════════════════════════════════════════════
// ── PUBLIC API
// ══════════════════════════════════════════════════════════════════

/**
 * computeMemoryWeight(eventMeta)
 * Returns a memoryWeight value 1–10 for any event.
 * eventMeta: { type, sentiment?, isMedia?, emotionalScore? }
 */
export function computeMemoryWeight(eventMeta) {
  const { type, sentiment, isMedia, emotionalScore } = eventMeta ?? {};

  // Reunion always highest
  if (type === 'reunion_event') return WEIGHT.REUNION;

  // Media
  if (isMedia || ['image','audio','video'].includes(type)) {
    return (emotionalScore ?? 0) >= 3 ? WEIGHT.MEDIA_EMOTIONAL : WEIGHT.MEDIA;
  }

  // Milestone
  if (type === 'milestone') return WEIGHT.MILESTONE;

  // Chat sentiment
  if (type === 'chat') {
    if ((emotionalScore ?? 0) >= 3) return WEIGHT.EMOTIONAL_CHAT;
    if (sentiment === 'positive')   return WEIGHT.POSITIVE_CHAT;
    if (sentiment === 'negative')   return WEIGHT.NEGATIVE_CHAT;
    return WEIGHT.NEUTRAL;
  }

  // Physical interactions
  if (type === 'play') return WEIGHT.INTERACTION_PLAY;
  if (['pet','talk','rest'].includes(type)) return WEIGHT.INTERACTION_BASIC;

  return WEIGHT.NEUTRAL;
}

/**
 * updateBondingOnInteraction(interactionMeta)
 * Called after every user interaction to update attachmentGraph.
 * interactionMeta: { type, sentiment?, isMedia?, emotionalScore? }
 */
export function updateBondingOnInteraction(interactionMeta) {
  const { type, sentiment, isMedia, emotionalScore } = interactionMeta ?? {};

  const patch = { interactionCount: 1, lastSeen: Date.now() };

  // userBond increments
  if (sentiment === 'positive' || ['pet','play'].includes(type)) {
    patch.userBond = (type === 'play') ? 5 : 3;
  } else if (type === 'talk' || type === 'chat') {
    patch.userBond = sentiment === 'negative' ? 1 : 2;
  } else if (type === 'rest') {
    patch.userBond = 1;
  } else {
    patch.userBond = 1;
  }

  // emotionalResonance — triggered by emotional content
  const eScore = emotionalScore ?? 0;
  if (eScore >= 5) {
    patch.emotionalResonance = 7;
  } else if (eScore >= 3) {
    patch.emotionalResonance = 4;
  } else if (sentiment === 'positive') {
    patch.emotionalResonance = 2;
  }

  // familiarity — media sharing raises it
  if (isMedia || ['image','audio','video'].includes(type)) {
    patch.familiarity = 4;
  }

  return commitAttachmentPatch(patch);
}

/**
 * processAbsenceReturn()
 * Called at boot (initCompanionCore). Detects elapsed absence,
 * applies appropriate emotional response, fires reunion event if needed.
 * Returns { tier, idleMs, reunionFired, patch }
 */
export function processAbsenceReturn() {
  const core    = storage.getCompanionCore();
  const ag      = core.attachmentGraph ?? {};
  const now     = Date.now();

  // lastSeen = last time user was present (set on every interaction)
  const lastSeen = ag.lastSeen ?? core.lastInteraction ?? core.identity.createdAt ?? now;
  const idleMs   = now - lastSeen;
  const tier     = classifyAbsence(idleMs);

  if (tier.label === 'none') {
    // Update lastSeen without any emotional change
    commitAttachmentPatch({ lastSeen: now });
    return { tier, idleMs, reunionFired: false, patch: null };
  }

  // ── Emotional patch per absence tier ────────────────────────────
  // These are raw deltas; companionCoreService.commitEmotionalShift
  // will cap them via DELTA_CAPS. We apply them through a targeted
  // patchCoreSection to avoid circular imports.
  const ABSENCE_EMOTION = {
    slight:        { moodHint: 'curious',  bondBoost: 1, resonanceBoost: 1 },
    noticeable:    { moodHint: 'happy',    bondBoost: 2, resonanceBoost: 2 },
    longing:       { moodHint: 'anxious',  bondBoost: 3, resonanceBoost: 4 },
    reinforcement: { moodHint: 'excited',  bondBoost: 5, resonanceBoost: 6 },
  };

  const aem = ABSENCE_EMOTION[tier.label];

  // Apply bond boost
  commitAttachmentPatch({
    userBond:           aem.bondBoost,
    emotionalResonance: aem.resonanceBoost,
    lastSeen:           now,
    interactionCount:   0,  // don't count boot as interaction
  });

  // Update identity mood hint (surface level — full emotional commit
  // happens in companionCoreService.initCompanionCore which runs after this)
  const coreAfter = storage.getCompanionCore();
  coreAfter.identity.mood = aem.moodHint;
  storage.saveCompanionCore(coreAfter);

  // ── Reunion event (24h+ absences only) ──────────────────────────
  let reunionFired = false;
  if (['longing','reinforcement'].includes(tier.label)) {
    const idleHours = Math.round(idleMs / 3_600_000);
    const weight    = computeMemoryWeight({ type: 'reunion_event' });

    storage.addCoreMemory({
      type:        'reunion_event',
      category:    'milestone',
      label:       `🫶 Reunion after ${idleHours}h away`,
      mood:        aem.moodHint,
      behaviour:   'attentive',
      absenceTier: tier.label,
      idleHours,
      memoryWeight: weight,
      ts:          now,
    });

    // Boost trust and resonance on reunion
    const coreReunion = storage.getCompanionCore();
    coreReunion.identity.trust = Math.min(100, (coreReunion.identity.trust ?? 0) + 5);
    storage.saveCompanionCore(coreReunion);

    EventBus.emit(EVENTS.MEMORY_ADDED, { type: 'reunion_event', tier: tier.label, ts: now });
    reunionFired = true;
  }

  EventBus.emit(EVENTS.EMOTION_CHANGED, {
    absence: tier.label,
    moodHint: aem.moodHint,
    ts: now,
  });

  return { tier, idleMs, reunionFired, patch: aem };
}

/**
 * getBondContext()
 * Returns a snapshot of the current attachmentGraph for Ollama injection.
 */
export function getBondContext() {
  const ag = storage.getCompanionCore().attachmentGraph ?? {};
  return {
    userBond:            ag.userBond            ?? 0,
    familiarity:         ag.familiarity         ?? 0,
    emotionalResonance:  ag.emotionalResonance  ?? 0,
    interactionCount:    ag.interactionCount     ?? 0,
    bondStage:           ag.bondStage           ?? BOND_STAGE.DISTANT,
    lastSeen:            ag.lastSeen,
  };
}

/**
 * getAttachmentGraph()
 * Full attachment graph read from SSOT.
 */
export function getAttachmentGraph() {
  return storage.getCompanionCore().attachmentGraph ?? {};
}
