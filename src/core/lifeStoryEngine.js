// ================================================================
// IMMORTAIL™ — LIFE STORY ENGINE (Run 9)
// Long-term memory + life story architecture:
// importance scoring, milestone detection, safe compression,
// chapter generation, relationship timeline, long-term summary,
// memory safety validator, performance controls.
//
// STRICT RULES:
// - All reads/writes exclusively through storage SSOT
// - NO random memory deletion
// - ALL compression is reversible (index retained)
// - Milestones are NEVER compressed
// - NO fake or hallucinated memories
// - All events are stamped with source + timestamp
// - identityLock is never touched
// ================================================================

import storage from './storage.js';
import { EventBus, EVENTS } from './eventBus.js';

// ── Importance score constants ────────────────────────────────────

export const IMPORTANCE = {
  MIN:                 1,
  MAX:                 100,
  THRESHOLD_HIGH:      70,   // preserved in importantEvents
  THRESHOLD_MILESTONE: 85,   // auto-detected milestone
  THRESHOLD_COMPRESS:  30,   // eligible for compression below this
};

// ── Milestone type catalogue ──────────────────────────────────────

export const MILESTONE_TYPE = {
  FIRST_PHOTO:          'first_photo',
  FIRST_CONVERSATION:   'first_conversation',
  FIRST_REUNION:        'first_reunion',
  BOND_STAGE_CHANGE:    'bond_stage_change',
  INTERACTION_STREAK:   'interaction_streak_10',
  GROWTH_LEVEL_10:      'growth_level_10',
  GROWTH_LEVEL_50:      'growth_level_50',
  EMOTIONAL_PEAK:       'emotional_peak',
  HIGH_TRUST_MILESTONE: 'high_trust_milestone',
};

// ── Chapter definitions ───────────────────────────────────────────

export const CHAPTER_LABEL = {
  EARLY_BONDING:   'Early Bonding',
  FAMILIARITY:     'Familiarity Growth',
  DEEP_ATTACHMENT: 'Deep Attachment',
  REUNION_PERIODS: 'Reunion Periods',
  SHARED_MEDIA:    'Shared Media Moments',
  LONG_TERM:       'Long-Term Companionship',
};

// ── Relationship phases ───────────────────────────────────────────

export const REL_PHASE = {
  STRANGER:   'stranger',
  ACQUAINTED: 'acquainted',
  FAMILIAR:   'familiar',
  TRUSTED:    'trusted',
  BONDED:     'bonded',
  DEVOTED:    'devoted',
};

// ── Caps ──────────────────────────────────────────────────────────

export const CAPS = {
  MILESTONES:                 50,
  IMPORTANT_EVENTS:           50,
  COMPRESSED_INDEX:           100,
  CHAPTERS:                   20,
  TIMELINE:                   30,
  IMPORTANT_MEMORIES_SUMMARY: 10,
};

// ── Performance throttle ──────────────────────────────────────────

export const LIFE_STORY_THROTTLE_MS = 30_000;
let _lastFullUpdate = 0;

// ── Helpers ───────────────────────────────────────────────────────

function genId() {
  return Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

function getLifeStory() {
  return storage.getCompanionCore().lifeStory ?? {};
}

function patchLifeStory(patch) {
  const core = storage.getCompanionCore();
  const ls   = core.lifeStory ?? {};
  core.lifeStory = { ...ls, ...patch };
  storage.saveCompanionCore(core);
  return core.lifeStory;
}

// ════════════════════════════════════════════════════════════════
// STEP 2 — MEMORY IMPORTANCE SCORING
// ════════════════════════════════════════════════════════════════

export function scoreImportance(entry, context = {}) {
  if (!entry) return IMPORTANCE.MIN;

  let score = 0;

  // Base weight contribution (0–40)
  const w = clamp(entry.memoryWeight ?? 1, 0, 10);
  score += (w / 10) * 40;

  // Type bonuses
  const typeBonus = {
    reunion_event: 35, image: 25, video: 25, audio: 20,
    pet: 15, play: 12, talk: 10, chat: 8, rest: 4,
  };
  score += typeBonus[entry.type] ?? 5;

  // Sentiment bonus
  if (entry.sentiment === 'positive')      score += 8;
  if (entry.sentiment === 'very_positive') score += 15;
  if (entry.sentiment === 'negative')      score += 5;

  // Media involvement
  if (entry.category === 'media') score += 12;
  if (entry.mediaId)              score += 5;

  // Emotional resonance from context
  const resonance = context.emotionalResonance ?? 0;
  score += clamp(resonance / 100, 0, 1) * 15;

  // Attachment impact
  const bond = context.userBond ?? 0;
  score += clamp(bond / 100, 0, 1) * 10;

  // Recurrence: repetitive low-value events score lower
  const typeCount = context.typeCount ?? 0;
  if (typeCount > 20 && !['reunion_event','image','video'].includes(entry.type)) {
    score -= Math.min(typeCount / 5, 10);
  }

  return clamp(Math.round(score));
}

// ════════════════════════════════════════════════════════════════
// STEP 10 — MEMORY SAFETY VALIDATOR
// ════════════════════════════════════════════════════════════════

const SAFETY_REJECTION_LOG = [];

export function validateCompression(batch, lifeStory) {
  if (!Array.isArray(batch) || batch.length === 0) {
    return { safe: false, reason: 'empty or invalid batch' };
  }

  const milestoneIds = new Set((lifeStory?.milestones ?? []).map(m => m.sourceId));

  // Rule 1: no milestone entry in batch
  const hasMilestone = batch.some(e => milestoneIds.has(e.id) || e.isMilestone);
  if (hasMilestone) {
    const reason = 'batch contains milestone entry — compression rejected';
    SAFETY_REJECTION_LOG.push({ ts: Date.now(), reason, batchSize: batch.length });
    return { safe: false, reason };
  }

  // Rule 2: no high-importance entry
  const hasHighImportance = batch.some(e => (e.importanceScore ?? 0) >= IMPORTANCE.THRESHOLD_HIGH);
  if (hasHighImportance) {
    const reason = 'batch contains high-importance entry — compression rejected';
    SAFETY_REJECTION_LOG.push({ ts: Date.now(), reason, batchSize: batch.length });
    return { safe: false, reason };
  }

  // Rule 3: all entries have timestamps (reversibility anchor)
  const missingTs = batch.some(e => !e.ts);
  if (missingTs) {
    const reason = 'batch contains entry without timestamp — reversibility compromised';
    SAFETY_REJECTION_LOG.push({ ts: Date.now(), reason, batchSize: batch.length });
    return { safe: false, reason };
  }

  // Rule 4: emotional continuity — at least 1 entry with mood/sentiment
  const withMood = batch.filter(e => e.mood || e.sentiment);
  if (withMood.length === 0 && batch.length > 5) {
    const reason = 'no emotional data in large batch — emotional continuity cannot be preserved';
    SAFETY_REJECTION_LOG.push({ ts: Date.now(), reason, batchSize: batch.length });
    return { safe: false, reason };
  }

  return { safe: true };
}

export function getSafetyRejectionLog() {
  return [...SAFETY_REJECTION_LOG];
}

// ════════════════════════════════════════════════════════════════
// STEP 3 — MILESTONE DETECTION
// ════════════════════════════════════════════════════════════════

export function detectMilestones(coreMemories, core) {
  if (!Array.isArray(coreMemories)) return [];

  const ls            = core?.lifeStory          ?? {};
  const existing      = new Set((ls.milestones ?? []).map(m => m.type + '_' + (m.sourceId ?? '')));
  const ag            = core?.attachmentGraph     ?? {};
  const el            = core?.evolutionLayer      ?? {};
  const newMilestones = [];

  const add = (type, label, sourceId, meta = {}) => {
    const key = type + '_' + (sourceId ?? '');
    if (!existing.has(key)) {
      newMilestones.push({
        id: genId(), type, label,
        sourceId: sourceId ?? null,
        ts: Date.now(),
        isMilestone: true,
        ...meta,
      });
      existing.add(key);
    }
  };

  const firstPhoto   = coreMemories.find(m => m.type === 'image');
  const firstConv    = coreMemories.find(m => m.type === 'chat' || m.type === 'talk');
  const firstReunion = coreMemories.find(m => m.type === 'reunion_event');
  const emotPeak     = coreMemories.find(m => (m.memoryWeight ?? 0) >= 8 &&
    (m.type === 'chat' || m.type === 'talk'));

  if (firstPhoto)   add(MILESTONE_TYPE.FIRST_PHOTO,        '📸 First uploaded photo',      firstPhoto.id);
  if (firstConv)    add(MILESTONE_TYPE.FIRST_CONVERSATION, '💬 First conversation',         firstConv.id);
  if (firstReunion) add(MILESTONE_TYPE.FIRST_REUNION,      '🐾 First reunion',              firstReunion.id);
  if (emotPeak)     add(MILESTONE_TYPE.EMOTIONAL_PEAK,     '💖 Emotional peak moment',      emotPeak.id);

  if ((core?.identity?.trust ?? 0) >= 60)
    add(MILESTONE_TYPE.HIGH_TRUST_MILESTONE, '🤝 High trust achieved', 'trust_60');

  const growth = el.growthLevel ?? 0;
  if (growth >= 10) add(MILESTONE_TYPE.GROWTH_LEVEL_10, '🌱 Growth level 10 reached', 'growth_10');
  if (growth >= 50) add(MILESTONE_TYPE.GROWTH_LEVEL_50, '🌳 Growth level 50 reached', 'growth_50');

  const count = ag.interactionCount ?? 0;
  if (count >= 10) add(MILESTONE_TYPE.INTERACTION_STREAK, '🎯 10 interactions reached', 'streak_10');

  const bondStage = ag.bondStage ?? 'distant';
  if (['familiar','trusted','bonded','devoted'].includes(bondStage))
    add(MILESTONE_TYPE.BOND_STAGE_CHANGE, `🔗 Bond stage: ${bondStage}`, `bond_${bondStage}`);

  return newMilestones;
}

export function processMilestones(coreMemories, core) {
  if (!core) core = storage.getCompanionCore();
  const newMs = detectMilestones(coreMemories, core);
  if (newMs.length === 0) return [];

  const freshCore     = storage.getCompanionCore();
  const ls            = freshCore.lifeStory ?? {};
  ls.milestones       = [...(ls.milestones ?? []), ...newMs].slice(-CAPS.MILESTONES);
  freshCore.lifeStory = ls;
  storage.saveCompanionCore(freshCore);
  return newMs;
}

// ════════════════════════════════════════════════════════════════
// STEP 4 — MEMORY COMPRESSION ENGINE
// ════════════════════════════════════════════════════════════════

export function compressMemoryBatch(entries, core) {
  if (!core) core = storage.getCompanionCore();
  const ls = core.lifeStory ?? {};

  const validation = validateCompression(entries, ls);
  if (!validation.safe) return { compressed: false, reason: validation.reason };

  const moods      = entries.map(e => e.mood).filter(Boolean);
  const sentiments = entries.map(e => e.sentiment).filter(Boolean);
  const weights    = entries.map(e => e.memoryWeight ?? 1);
  const avgWeight  = weights.length > 0 ? weights.reduce((a,b)=>a+b,0) / weights.length : 1;

  const sentFreq = {};
  for (const s of sentiments) sentFreq[s] = (sentFreq[s] ?? 0) + 1;
  const dominantSentiment = Object.entries(sentFreq).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? 'neutral';

  const typeFreq = {};
  for (const e of entries) typeFreq[e.type] = (typeFreq[e.type] ?? 0) + 1;

  const indexEntry = {
    id:                genId(),
    compressedAt:      Date.now(),
    entryCount:        entries.length,
    entryIds:          entries.map(e => e.id).filter(Boolean),
    typeFrequency:     typeFreq,
    dominantSentiment,
    avgMemoryWeight:   Math.round(avgWeight * 10) / 10,
    dominantMoods:     [...new Set(moods)].slice(0, 3),
    timeSpan: {
      earliest: Math.min(...entries.map(e => e.ts)),
      latest:   Math.max(...entries.map(e => e.ts)),
    },
    label:      `Compressed: ${entries.length} memories (${Object.keys(typeFreq).join(', ')})`,
    reversible: true,
  };

  const freshCore = storage.getCompanionCore();
  const freshLs   = freshCore.lifeStory ?? {};
  freshLs.compressedMemoryIndex = [
    ...(freshLs.compressedMemoryIndex ?? []), indexEntry,
  ].slice(-CAPS.COMPRESSED_INDEX);
  freshCore.lifeStory = freshLs;
  storage.saveCompanionCore(freshCore);

  return { compressed: true, indexEntry };
}

export function runCompressionPass(coreMemories, core) {
  if (!core) core = storage.getCompanionCore();
  if (!Array.isArray(coreMemories) || coreMemories.length < 10)
    return { batchesCompressed: 0, entriesCompressed: 0, skipped: coreMemories?.length ?? 0 };

  const ls           = core.lifeStory ?? {};
  const milestoneIds = new Set((ls.milestones ?? []).map(m => m.sourceId));
  const importantIds = new Set((ls.importantEvents ?? []).map(e => e.id));

  const typeCount = {};
  for (const e of coreMemories) typeCount[e.type] = (typeCount[e.type] ?? 0) + 1;

  const scored = coreMemories.map(e => ({
    ...e,
    importanceScore: scoreImportance(e, {
      typeCount: typeCount[e.type] ?? 0,
      userBond:  core.attachmentGraph?.userBond ?? 0,
    }),
  }));

  const eligible = scored.filter(e =>
    (e.importanceScore ?? 0) < IMPORTANCE.THRESHOLD_COMPRESS &&
    !milestoneIds.has(e.id) &&
    !importantIds.has(e.id) &&
    !e.isMilestone
  );

  let batchesCompressed = 0;
  let entriesCompressed = 0;
  const batchSize = 5;

  for (let i = 0; i + batchSize <= eligible.length; i += batchSize) {
    const batch  = eligible.slice(i, i + batchSize);
    const result = compressMemoryBatch(batch, storage.getCompanionCore());
    if (result.compressed) {
      batchesCompressed++;
      entriesCompressed += batch.length;
    }
  }

  return { batchesCompressed, entriesCompressed, skipped: coreMemories.length - entriesCompressed };
}

// ════════════════════════════════════════════════════════════════
// STEP 5 — MEMORY CHAPTER SYSTEM
// ════════════════════════════════════════════════════════════════

export function generateMemoryChapters(coreMemories, core) {
  if (!core) core = storage.getCompanionCore();
  if (!Array.isArray(coreMemories) || coreMemories.length === 0) return [];

  const ag      = core.attachmentGraph ?? {};
  const bond    = ag.userBond          ?? 0;
  const count   = ag.interactionCount  ?? 0;
  const sorted  = [...coreMemories].sort((a,b) => (a.ts??0) - (b.ts??0));
  const total   = sorted.length;
  const chapters = [];

  // Chapter 1: Early Bonding (first 10%)
  const earlySlice = sorted.slice(0, Math.max(1, Math.ceil(total * 0.1)));
  chapters.push({
    id: genId(), label: CHAPTER_LABEL.EARLY_BONDING, order: 1,
    entryIds:   earlySlice.map(e=>e.id).filter(Boolean),
    entryCount: earlySlice.length,
    timeSpan:   { start: earlySlice[0]?.ts ?? null, end: earlySlice.at(-1)?.ts ?? null },
    summary:    `The beginning — ${earlySlice.length} early interaction${earlySlice.length!==1?'s':''}.`,
  });

  // Chapter 2: Shared Media
  const mediaEntries = sorted.filter(m => ['image','video','audio'].includes(m.type));
  if (mediaEntries.length > 0) {
    chapters.push({
      id: genId(), label: CHAPTER_LABEL.SHARED_MEDIA, order: 2,
      entryIds:   mediaEntries.map(e=>e.id).filter(Boolean),
      entryCount: mediaEntries.length,
      timeSpan:   { start: mediaEntries[0]?.ts ?? null, end: mediaEntries.at(-1)?.ts ?? null },
      summary:    `${mediaEntries.length} media moment${mediaEntries.length!==1?'s':''} shared.`,
    });
  }

  // Chapter 3: Familiarity Growth (mid 10–40%)
  if (count >= 5 || total >= 5) {
    const midSlice = sorted.slice(Math.ceil(total*0.1), Math.ceil(total*0.4));
    if (midSlice.length > 0) {
      chapters.push({
        id: genId(), label: CHAPTER_LABEL.FAMILIARITY, order: 3,
        entryIds:   midSlice.map(e=>e.id).filter(Boolean),
        entryCount: midSlice.length,
        timeSpan:   { start: midSlice[0]?.ts ?? null, end: midSlice.at(-1)?.ts ?? null },
        summary:    `Growing familiarity — ${midSlice.length} interaction${midSlice.length!==1?'s':''}.`,
      });
    }
  }

  // Chapter 4: Deep Attachment (40–70%)
  if (bond >= 30 || count >= 20) {
    const deepSlice = sorted.slice(Math.ceil(total*0.4), Math.ceil(total*0.7));
    if (deepSlice.length > 0) {
      chapters.push({
        id: genId(), label: CHAPTER_LABEL.DEEP_ATTACHMENT, order: 4,
        entryIds:   deepSlice.map(e=>e.id).filter(Boolean),
        entryCount: deepSlice.length,
        timeSpan:   { start: deepSlice[0]?.ts ?? null, end: deepSlice.at(-1)?.ts ?? null },
        summary:    `Deep attachment — ${deepSlice.length} meaningful moment${deepSlice.length!==1?'s':''}.`,
      });
    }
  }

  // Chapter 5: Reunion Periods
  const reunionEntries = sorted.filter(m => m.type === 'reunion_event');
  if (reunionEntries.length > 0) {
    chapters.push({
      id: genId(), label: CHAPTER_LABEL.REUNION_PERIODS, order: 5,
      entryIds:   reunionEntries.map(e=>e.id).filter(Boolean),
      entryCount: reunionEntries.length,
      timeSpan:   { start: reunionEntries[0]?.ts ?? null, end: reunionEntries.at(-1)?.ts ?? null },
      summary:    `${reunionEntries.length} joyful reunion${reunionEntries.length!==1?'s':''}.`,
    });
  }

  // Chapter 6: Long-Term (final 30%)
  if (total >= 10) {
    const lateSlice = sorted.slice(Math.ceil(total*0.7));
    if (lateSlice.length > 0) {
      chapters.push({
        id: genId(), label: CHAPTER_LABEL.LONG_TERM, order: 6,
        entryIds:   lateSlice.map(e=>e.id).filter(Boolean),
        entryCount: lateSlice.length,
        timeSpan:   { start: lateSlice[0]?.ts ?? null, end: lateSlice.at(-1)?.ts ?? null },
        summary:    `Long-term companionship — ${lateSlice.length} recent moment${lateSlice.length!==1?'s':''}.`,
      });
    }
  }

  return chapters.slice(0, CAPS.CHAPTERS);
}

// ════════════════════════════════════════════════════════════════
// STEP 6 — RELATIONSHIP TIMELINE ENGINE
// ════════════════════════════════════════════════════════════════

export function buildRelationshipTimeline(coreMemories, core) {
  if (!core) core = storage.getCompanionCore();

  const ag     = core.attachmentGraph ?? {};
  const ls     = core.lifeStory       ?? {};
  const sorted = [...(coreMemories ?? [])].sort((a,b) => (a.ts??0) - (b.ts??0));
  const bond   = ag.userBond          ?? 0;

  const phaseMap = [
    { phase: REL_PHASE.STRANGER,   threshold: 0,  label: 'First contact' },
    { phase: REL_PHASE.ACQUAINTED, threshold: 5,  label: 'Getting acquainted' },
    { phase: REL_PHASE.FAMILIAR,   threshold: 20, label: 'Familiar companion' },
    { phase: REL_PHASE.TRUSTED,    threshold: 40, label: 'Trusted friend' },
    { phase: REL_PHASE.BONDED,     threshold: 65, label: 'Deeply bonded' },
    { phase: REL_PHASE.DEVOTED,    threshold: 85, label: 'Devoted companion' },
  ];

  const reachedPhases = phaseMap.filter(p => bond >= p.threshold);
  if (reachedPhases.length === 0) reachedPhases.push(phaseMap[0]);

  const phases = [];
  for (let i = 0; i < reachedPhases.length; i++) {
    const p    = reachedPhases[i];
    const next = reachedPhases[i+1];

    const startIdx = Math.floor((i / reachedPhases.length) * sorted.length);
    const endIdx   = next
      ? Math.floor(((i+1) / reachedPhases.length) * sorted.length)
      : sorted.length;

    const slice  = sorted.slice(startIdx, endIdx);
    const avgW   = slice.length > 0
      ? slice.reduce((a,e)=>a+(e.memoryWeight??1),0) / slice.length : 1;

    const emotionalTrend =
      avgW >= 7 ? 'intensely positive' :
      avgW >= 5 ? 'strongly positive'  :
      avgW >= 3 ? 'moderately positive': 'neutral';

    const milestoneLabels = (ls.milestones ?? [])
      .filter(m => slice.some(e => e.id === m.sourceId))
      .map(m => m.label).slice(0, 3);

    phases.push({
      id:               genId(),
      phase:            p.phase,
      label:            p.label,
      startTs:          slice[0]?.ts   ?? null,
      endTs:            slice.at(-1)?.ts ?? null,
      emotionalTrend,
      keyEvents:        milestoneLabels,
      interactionCount: slice.length,
    });
  }

  return phases.slice(0, CAPS.TIMELINE);
}

// ════════════════════════════════════════════════════════════════
// STEP 7 — LONG-TERM SUMMARY ENGINE
// ════════════════════════════════════════════════════════════════

export function buildLongTermSummary(coreMemories, core) {
  if (!core) core = storage.getCompanionCore();

  const ag  = core.attachmentGraph ?? {};
  const el  = core.evolutionLayer  ?? {};
  const ls  = core.lifeStory       ?? {};
  const mem = coreMemories ?? [];

  const totalInteractions = ag.interactionCount ?? mem.length;

  const favActivities = el.favouriteActivities?.length > 0
    ? el.favouriteActivities
    : (() => {
        const freq = {};
        for (const e of mem) freq[e.type] = (freq[e.type] ?? 0) + 1;
        return Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([t])=>t);
      })();

  const sentFreq = {};
  const moodFreq = {};
  for (const e of mem) {
    if (e.sentiment) sentFreq[e.sentiment] = (sentFreq[e.sentiment] ?? 0) + 1;
    if (e.mood)      moodFreq[e.mood]      = (moodFreq[e.mood]      ?? 0) + 1;
  }

  const emotionalPatterns = {
    dominantSentiment: Object.entries(sentFreq).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? 'neutral',
    dominantMood:      Object.entries(moodFreq).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? 'calm',
    sentimentFrequency: sentFreq,
  };

  const importantMemories = [...mem]
    .sort((a,b) => (b.memoryWeight??0) - (a.memoryWeight??0))
    .slice(0, CAPS.IMPORTANT_MEMORIES_SUMMARY)
    .map(e => ({
      id: e.id, type: e.type, label: e.label,
      memoryWeight: e.memoryWeight, ts: e.ts,
    }));

  const timeline = ls.relationshipTimeline ?? [];
  const strongestBondPeriods = [...timeline]
    .filter(p => p.emotionalTrend?.includes('positive'))
    .slice(0, 3)
    .map(p => ({ phase: p.phase, label: p.label, trend: p.emotionalTrend }));

  return {
    totalInteractions,
    strongestBondPeriods,
    favouriteActivities: favActivities,
    emotionalPatterns,
    importantMemories,
    generatedAt: Date.now(),
  };
}

// ════════════════════════════════════════════════════════════════
// MAIN TICK — updateLifeStory()
// ════════════════════════════════════════════════════════════════

export function updateLifeStory() {
  const now = Date.now();
  if (now - _lastFullUpdate < LIFE_STORY_THROTTLE_MS) {
    return getLifeStorySnapshot();
  }
  _lastFullUpdate = now;

  const core        = storage.getCompanionCore();
  const coreMemories = storage.getCoreMemories?.() ?? storage.getMemories();

  // Score and classify
  const ag        = core.attachmentGraph ?? {};
  const typeCount = {};
  for (const m of coreMemories) typeCount[m.type] = (typeCount[m.type] ?? 0) + 1;

  const scoredMemories = coreMemories.map(e => ({
    ...e,
    importanceScore: scoreImportance(e, {
      typeCount:          typeCount[e.type] ?? 0,
      userBond:           ag.userBond       ?? 0,
      emotionalResonance: ag.emotionalResonance ?? 0,
    }),
  }));

  const highImportance = scoredMemories
    .filter(e => (e.importanceScore ?? 0) >= IMPORTANCE.THRESHOLD_HIGH)
    .slice(0, CAPS.IMPORTANT_EVENTS);

  // Detect milestones
  processMilestones(scoredMemories, core);

  // Generate chapters
  const chapters = generateMemoryChapters(scoredMemories, storage.getCompanionCore());

  // Build timeline
  const freshCore = storage.getCompanionCore();
  const timeline  = buildRelationshipTimeline(scoredMemories, freshCore);

  // Persist timeline so summary can use it
  freshCore.lifeStory = { ...(freshCore.lifeStory ?? {}), relationshipTimeline: timeline };
  storage.saveCompanionCore(freshCore);

  // Build summary
  const freshCore2 = storage.getCompanionCore();
  const summary    = buildLongTermSummary(scoredMemories, freshCore2);

  // Compression pass (only if > 20 memories)
  if (scoredMemories.length > 20) {
    runCompressionPass(scoredMemories, freshCore2);
  }

  // Write all
  const finalCore = storage.getCompanionCore();
  finalCore.lifeStory = {
    ...(finalCore.lifeStory ?? {}),
    importantEvents:      highImportance,
    memoryChapters:       chapters,
    relationshipTimeline: timeline,
    longTermSummary:      summary,
    lifeStoryVersion:     'V1',
  };
  storage.saveCompanionCore(finalCore);

  EventBus.emit(EVENTS.MEMORY_ADDED ?? 'MEMORY::UPDATED', {
    type: 'life_story_update', ts: now,
  });

  return getLifeStorySnapshot();
}

// ── Snapshot + context getters ────────────────────────────────────

export function getLifeStorySnapshot() {
  const ls = getLifeStory();
  return {
    milestonesCount:      (ls.milestones            ?? []).length,
    chaptersCount:        (ls.memoryChapters        ?? []).length,
    compressedIndexCount: (ls.compressedMemoryIndex ?? []).length,
    importantEventsCount: (ls.importantEvents       ?? []).length,
    timelinePhases:       (ls.relationshipTimeline  ?? []).length,
    longTermSummary:       ls.longTermSummary        ?? {},
    lifeStoryVersion:      ls.lifeStoryVersion       ?? 'V1',
  };
}

export function getLifeStoryContext() {
  const ls  = getLifeStory();
  const sum = ls.longTermSummary ?? {};

  const recentMilestone = (ls.milestones ?? []).at(-1);
  const currentPhase    = (ls.relationshipTimeline ?? []).at(-1);
  const topMemories     = (sum.importantMemories ?? []).slice(0, 3)
    .map(m => m.label).filter(Boolean);

  return {
    milestonesCount:     (ls.milestones ?? []).length,
    recentMilestone:     recentMilestone?.label  ?? null,
    currentPhase:        currentPhase?.label     ?? 'Beginning',
    emotionalTrend:      currentPhase?.emotionalTrend ?? 'neutral',
    totalInteractions:   sum.totalInteractions   ?? 0,
    favouriteActivities: (sum.favouriteActivities ?? []).slice(0, 3),
    dominantMood:        sum.emotionalPatterns?.dominantMood ?? 'calm',
    importantMemories:   topMemories,
    chaptersCount:       (ls.memoryChapters ?? []).length,
  };
}

export function getMilestones(limit = 10) {
  return (getLifeStory().milestones ?? []).slice(-limit);
}

export function getMemoryChapters() {
  return getLifeStory().memoryChapters ?? [];
}

export function getCompressedIndex(limit = 10) {
  return (getLifeStory().compressedMemoryIndex ?? []).slice(-limit);
}

export function getImportantEvents(limit = 10) {
  return (getLifeStory().importantEvents ?? []).slice(-limit);
}

export function getRelationshipTimeline() {
  return getLifeStory().relationshipTimeline ?? [];
}
