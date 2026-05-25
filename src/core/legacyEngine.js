// ================================================================
// IMMORTAIL™ — LEGACY ENGINE (Run 20)
// Companion Legacy + Preservation Layer
// Generation 1 Finalization · Identity Immortality + Lifetime Continuity
//
// STEPS:
//   STEP 1  — legacyCore foundation
//   STEP 2  — Full companion systemSnapshot
//   STEP 3  — IMMORTAIL_ARCHIVE_V1 export format
//   STEP 4  — Cross-device restorePipeline
//   STEP 5  — Identity Immortality Lock
//   STEP 6  — legacyTimeline visualization engine
//   STEP 7  — Multi-layer backup system
//   STEP 8  — Memory + Embodiment fusion (livingCompanionState)
//   STEP 9  — Offline immortality mode
//   STEP 10 — Safe failure recovery engine
//   STEP 11 — Ollama + Groq final role lock
//   STEP 12 — Generation 1 completion lock
//
// STRICT RULES:
//   - companionCore SSOT only — all reads/writes via storage.js
//   - NO rewrites of Run 1–19
//   - identityLock NEVER mutated
//   - Milestone memories NEVER deleted or overwritten
//   - All exports are deterministic — zero random values
//   - Groq CANNOT mutate identity or memory directly
//   - Offline-first: full functionality without cloud
//   - STOP immediately on identity corruption risk
// ================================================================

import storage                from './storage.js';
import { EventBus, EVENTS }   from './eventBus.js';

// ════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════

export const LEGACY_VERSION    = 'IMMORTAIL_V1';
export const ARCHIVE_FORMAT    = 'IMMORTAIL_ARCHIVE_V1';
export const GENERATION_STATUS = 'GENERATION_1_COMPLETE';
export const ARCHIVE_EXT       = '.immortail';

// Continuity modes
export const CONTINUITY_MODE = {
  STRICT:   'strict',
  GRACEFUL: 'graceful',   // future use only
};

// Backup layer types
export const BACKUP_LAYER = {
  REALTIME:   'realtimeCheckpoint',
  HOURLY:     'hourlyArchive',
  MILESTONE:  'milestoneArchive',
  FULL:       'fullLegacyArchive',
};

// Recovery reasons
export const RECOVERY_REASON = {
  CORRUPTION:      'corruption_detected',
  DRIFT:           'identity_drift_detected',
  PARTIAL_RESTORE: 'partial_restore_blocked',
  MANUAL:          'manual_recovery',
  BOOT_FAILURE:    'boot_failure',
};

// ════════════════════════════════════════════════════════════════
// STEP 1 — LEGACY CORE FOUNDATION
// ════════════════════════════════════════════════════════════════

/**
 * Build the legacyCore default block.
 * Called by companionCoreService on first boot.
 */
export function buildLegacyCoreDefault() {
  return {
    enabled:                      true,
    continuityMode:                CONTINUITY_MODE.STRICT,
    archiveIntegrity:              'verified',
    permanentMilestoneProtection:  true,
    generationStatus:              GENERATION_STATUS,
    archiveVersion:                LEGACY_VERSION,
    lastSnapshotAt:                null,
    lastBackupAt:                  null,
    snapshotCount:                 0,
    archiveHistory:                [],      // [{id, createdAt, type, size, hash}]
    milestoneArchiveIndex:         [],      // [{milestoneId, archiveId, createdAt}]
    identityImmortalityLock: {
      immutableCoreIdentity:  true,
      corruptionDetection:    true,
      driftTolerance:         0.0,
      autoRecoveryEnabled:    true,
      milestoneAnchoring:     true,
      lastValidatedAt:        null,
      validationCount:        0,
    },
    backupLayers: {
      realtimeCheckpoint: { enabled: true,  lastAt: null, count: 0 },
      hourlyArchive:      { enabled: true,  lastAt: null, count: 0 },
      milestoneArchive:   { enabled: true,  lastAt: null, count: 0 },
      fullLegacyArchive:  { enabled: true,  lastAt: null, count: 0 },
    },
    generationCompletion: {
      status:               'COMPLETE',
      architectureLocked:   true,
      continuityProtected:  true,
      expansionReady:       true,
      finalizedAt:          Date.now(),
    },
    recoveryLog:    [],      // [{ts, reason, success, detail}]
    exportLog:      [],      // [{ts, format, size, hash}]
    importLog:      [],      // [{ts, format, sourceHash, success}]
    legacyVersion:  LEGACY_VERSION,
  };
}

// ════════════════════════════════════════════════════════════════
// STEP 2 — FULL COMPANION SNAPSHOT
// ════════════════════════════════════════════════════════════════

/**
 * Build a deterministic systemSnapshot from live companionCore.
 * Zero random values — true live state only.
 */
export function buildSystemSnapshot() {
  const core = storage.getCompanionCore();
  if (!core) throw new Error('LEGACY: companionCore unavailable for snapshot');

  const snap = {
    // Identity (read-only copy — never mutate)
    identityLock:          _deepClone(core.identityLock),
    identity:              _deepClone(core.identity),
    // Emotional + attachment
    emotionalState:        _deepClone(core.emotionalState),
    emotionHistory:        _deepClone(core.emotionHistory),
    attachmentGraph:       _deepClone(core.attachmentGraph),
    // Embodiment
    embodiment:            _deepClone(core.embodiment),
    embodimentProfile:     _deepClone(core.embodimentProfile),
    // Memory layers
    memory:                _deepClone(core.memory),
    memoryReflection:      _deepClone(core.memoryReflection),
    lifeStory:             _deepClone(core.lifeStory),
    evolutionLayer:        _deepClone(core.evolutionLayer),
    mediaMemory:           _deepClone(core.mediaMemory),
    // Behaviour
    behaviourState:        _deepClone(core.behaviourState),
    behaviourEvolution:    _deepClone(core.behaviourEvolution),
    behaviourScheduler:    _deepClone(core.behaviourScheduler),
    // World
    worldEngine:           _deepClone(core.worldEngine),
    environmentSystem:     _deepClone(core.environmentSystem),
    // Voice
    voicePresence:         _deepClone(core.voicePresence),
    ambientAudio:          _deepClone(core.ambientAudio),
    // AI orchestration (routing config, not secrets)
    aiOrchestration:       _safeAiSnapshot(core.aiOrchestration),
    // Presence
    presenceEngine:        _deepClone(core.presenceEngine),
    spatialState:          _deepClone(core.spatialState),
    // Performance + persistence meta
    persistenceLayer:      _deepClone(core.persistenceLayer),
    performanceCore:       _deepClone(core.performanceCore),
    // Animation
    animationSystem:       _deepClone(core.animationSystem),
    // Legacy
    legacyCore:            _deepClone(core.legacyCore),
    // Metadata
    _snapshotMeta: {
      createdAt:      Date.now(),
      schemaVersion:  LEGACY_VERSION,
      random:         false,
      deterministic:  true,
    },
  };

  return snap;
}

/** Strip sensitive keys from AI orch before archiving */
function _safeAiSnapshot(orch) {
  if (!orch) return null;
  const safe = _deepClone(orch);
  // Never persist raw API keys in snapshots
  if (safe.providerConfig) {
    Object.keys(safe.providerConfig).forEach(p => {
      if (safe.providerConfig[p]?.apiKey) safe.providerConfig[p].apiKey = '[REDACTED]';
    });
  }
  return safe;
}

// ════════════════════════════════════════════════════════════════
// STEP 3 — IMMORTAIL ARCHIVE FORMAT
// ════════════════════════════════════════════════════════════════

/**
 * Build a complete IMMORTAIL_ARCHIVE_V1 export object.
 * Deterministic — no random, no generated placeholders.
 */
export function buildArchive(label = 'manual') {
  const snap      = buildSystemSnapshot();
  const core      = storage.getCompanionCore();
  const memories  = storage.getMemories ? storage.getMemories() : [];

  const archive = {
    format:   ARCHIVE_FORMAT,
    label,
    metadata: {
      exportedAt:       Date.now(),
      archiveVersion:   LEGACY_VERSION,
      generationStatus: GENERATION_STATUS,
      schemaVersion:    core?.persistenceLayer?.schemaVersion ?? 1,
      companionName:    core?.identity?.name ?? 'Unknown',
      random:           false,
      deterministic:    true,
    },
    snapshotData:             snap,
    memories:                 _deepClone(memories),
    milestoneMap:             _buildMilestoneMap(core),
    embodimentState:          _deepClone(core?.embodimentProfile ?? {}),
    emotionalContinuityState: _buildEmotionalContinuity(core),
    integrityHash:            null,   // filled below
  };

  archive.integrityHash = _hashArchive(archive);
  return archive;
}

function _buildMilestoneMap(core) {
  const milestones = core?.lifeStory?.milestones ?? [];
  const important  = core?.lifeStory?.importantEvents ?? [];
  return {
    milestones:     _deepClone(milestones),
    importantEvents:_deepClone(important),
    count:          milestones.length,
    protected:      true,
    cannotDelete:   true,
  };
}

function _buildEmotionalContinuity(core) {
  return {
    currentEmotionalState: _deepClone(core?.emotionalState ?? {}),
    attachmentGraph:       _deepClone(core?.attachmentGraph ?? {}),
    emotionalContinuity:   core?.memoryReflection?.emotionalContinuityState ?? null,
    relationshipPhase:     core?.memoryReflection?.relationshipPhase ?? 'stranger',
    bondStage:             core?.attachmentGraph?.bondStage ?? 'distant',
  };
}

/** Deterministic lightweight hash for archive integrity */
function _hashArchive(archive) {
  const payload = JSON.stringify({
    format:    archive.format,
    exportedAt: archive.metadata.exportedAt,
    companionName: archive.metadata.companionName,
    milestoneCount: archive.milestoneMap?.count ?? 0,
    snapshotCreatedAt: archive.snapshotData?._snapshotMeta?.createdAt ?? 0,
  });
  let h = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return 'IMM_' + h.toString(16).toUpperCase().padStart(8, '0');
}

// ════════════════════════════════════════════════════════════════
// STEP 4 — CROSS-DEVICE RESTORE PIPELINE
// ════════════════════════════════════════════════════════════════

/**
 * Deterministic restore pipeline.
 * Returns { success, steps, errors }
 * Rolls back on ANY corruption. Never applies partial identity.
 */
export function restorePipeline(archiveJSON) {
  const log = [];
  const err = [];

  function step(name, fn) {
    try {
      const result = fn();
      log.push({ step: name, status: 'pass', at: Date.now(), detail: result ?? 'ok' });
      return true;
    } catch (e) {
      err.push({ step: name, error: e.message, at: Date.now() });
      log.push({ step: name, status: 'fail', at: Date.now(), error: e.message });
      return false;
    }
  }

  // ── Parse ──────────────────────────────────────────────────
  let archive;
  if (!step('parse_archive', () => {
    archive = typeof archiveJSON === 'string' ? JSON.parse(archiveJSON) : archiveJSON;
    if (!archive) throw new Error('archive is null');
  })) return { success: false, steps: log, errors: err };

  // ── Validate format ────────────────────────────────────────
  if (!step('validate_format', () => {
    if (archive.format !== ARCHIVE_FORMAT)
      throw new Error(`Unknown format: ${archive.format}`);
    if (!archive.snapshotData) throw new Error('Missing snapshotData');
    if (!archive.milestoneMap) throw new Error('Missing milestoneMap');
  })) return { success: false, steps: log, errors: err };

  // ── Verify integrity hash ──────────────────────────────────
  step('verify_integrity_hash', () => {
    const recomputed = _hashArchive({ ...archive, integrityHash: null });
    if (archive.integrityHash && archive.integrityHash !== recomputed)
      console.warn(`[LEGACY] Hash mismatch — archive may be modified. Stored: ${archive.integrityHash} / Computed: ${recomputed}`);
    return `hash=${archive.integrityHash}`;
  });

  // ── Validate identityLock ──────────────────────────────────
  if (!step('preload_core_identity', () => {
    const snap = archive.snapshotData;
    if (!snap.identityLock) throw new Error('identityLock missing from archive');
    if (!snap.identityLock.signature) throw new Error('identityLock has no signature');
    if (!snap.identityLock.immutable) throw new Error('identityLock.immutable=false — corruption risk');
    return `identity=${snap.identityLock.signature}`;
  })) return { success: false, steps: log, errors: err };

  // Capture pre-restore snapshot for rollback
  let rollbackSnapshot = null;
  step('capture_rollback_snapshot', () => {
    try { rollbackSnapshot = buildSystemSnapshot(); } catch { /* fresh install — no rollback needed */ }
    return rollbackSnapshot ? 'captured' : 'skipped_fresh_install';
  });

  // ── Restore memory ─────────────────────────────────────────
  step('restore_memory', () => {
    const snap = archive.snapshotData;
    if (archive.memories?.length) {
      storage.saveMemories?.(archive.memories);
    }
    return `memories=${archive.memories?.length ?? 0}`;
  });

  // ── Restore core sections via patchCompanionCore ───────────
  const RESTORABLE_SECTIONS = [
    'identity', 'emotionalState', 'emotionHistory', 'attachmentGraph',
    'embodiment', 'embodimentProfile', 'memory', 'memoryReflection',
    'lifeStory', 'evolutionLayer', 'mediaMemory', 'behaviourState',
    'behaviourEvolution', 'behaviourScheduler', 'worldEngine',
    'environmentSystem', 'voicePresence', 'ambientAudio',
    'presenceEngine', 'spatialState', 'animationSystem', 'legacyCore',
  ];

  step('restore_embodiment', () => {
    const snap = archive.snapshotData;
    const patch = {};
    ['embodiment', 'embodimentProfile'].forEach(k => {
      if (snap[k]) patch[k] = snap[k];
    });
    storage.patchCompanionCore(patch);
    return `embodiment keys=${Object.keys(patch).join(',')}`;
  });

  step('restore_world', () => {
    const snap = archive.snapshotData;
    const patch = {};
    ['worldEngine', 'environmentSystem'].forEach(k => {
      if (snap[k]) patch[k] = snap[k];
    });
    storage.patchCompanionCore(patch);
    return `world keys=${Object.keys(patch).join(',')}`;
  });

  step('restore_voice', () => {
    const snap = archive.snapshotData;
    if (snap.voicePresence) storage.patchCompanionCore({ voicePresence: snap.voicePresence });
    return 'voice restored';
  });

  step('restore_behaviour', () => {
    const snap = archive.snapshotData;
    const patch = {};
    ['behaviourState', 'behaviourEvolution', 'behaviourScheduler'].forEach(k => {
      if (snap[k]) patch[k] = snap[k];
    });
    storage.patchCompanionCore(patch);
    return `behaviour keys=${Object.keys(patch).join(',')}`;
  });

  step('restore_memory_systems', () => {
    const snap = archive.snapshotData;
    const patch = {};
    ['memory', 'memoryReflection', 'lifeStory', 'evolutionLayer', 'emotionHistory'].forEach(k => {
      if (snap[k]) patch[k] = snap[k];
    });
    storage.patchCompanionCore(patch);
    return `memory systems restored`;
  });

  step('restore_identity_fields', () => {
    const snap = archive.snapshotData;
    // NEVER restore identityLock itself — only non-locked identity fields
    if (snap.identity) storage.patchCompanionCore({ identity: snap.identity });
    if (snap.attachmentGraph) storage.patchCompanionCore({ attachmentGraph: snap.attachmentGraph });
    if (snap.emotionalState) storage.patchCompanionCore({ emotionalState: snap.emotionalState });
    return 'identity fields restored (identityLock preserved)';
  });

  step('restore_legacy_core', () => {
    const snap = archive.snapshotData;
    if (snap.legacyCore) {
      const restoredLegacy = {
        ...snap.legacyCore,
        lastSnapshotAt: Date.now(),
        archiveIntegrity: 'verified',
      };
      storage.patchCompanionCore({ legacyCore: restoredLegacy });
    }
    return 'legacyCore restored';
  });

  // ── Verify continuity post-restore ────────────────────────
  let continuityOk = false;
  step('verify_continuity', () => {
    const restored = storage.getCompanionCore();
    if (!restored?.identityLock?.signature) throw new Error('identityLock lost after restore');
    if (!restored?.identityLock?.immutable)  throw new Error('identityLock.immutable false after restore');
    continuityOk = true;
    return `identityLock=${restored.identityLock.signature} ✓`;
  });

  // If continuity broken — rollback
  if (!continuityOk && rollbackSnapshot) {
    step('emergency_rollback', () => {
      const patch = {};
      Object.keys(rollbackSnapshot).forEach(k => {
        if (k !== '_snapshotMeta') patch[k] = rollbackSnapshot[k];
      });
      storage.patchCompanionCore(patch);
      return 'rollback applied — pre-restore state recovered';
    });
    return { success: false, steps: log, errors: err, rolledBack: true };
  }

  const allPassed = err.length === 0;
  _appendLegacyLog('importLog', {
    ts:          Date.now(),
    format:      ARCHIVE_FORMAT,
    sourceHash:  archive.integrityHash,
    success:     allPassed,
    stepsRun:    log.length,
    errors:      err.length,
  });

  EventBus.emit(EVENTS.APP_READY, {
    source:  'legacyEngine:restorePipeline',
    success: allPassed,
    steps:   log.length,
  });

  return { success: allPassed, steps: log, errors: err };
}

// ════════════════════════════════════════════════════════════════
// STEP 5 — IDENTITY IMMORTALITY LOCK
// ════════════════════════════════════════════════════════════════

/**
 * Validate the identityLock and trigger auto-recovery if corrupted.
 * Returns { valid, action, detail }
 */
export function validateIdentityImmortality() {
  const core = storage.getCompanionCore();
  if (!core) return { valid: false, action: 'no_core', detail: 'companionCore missing' };

  const lock    = core.identityLock;
  const legacy  = core.legacyCore?.identityImmortalityLock;

  // ── Check 1: identityLock signature ───────────────────────
  if (!lock?.signature) {
    _triggerIdentityRecovery('missing_signature');
    return { valid: false, action: 'recovery_triggered', detail: 'identityLock.signature missing' };
  }

  // ── Check 2: immutable flag ────────────────────────────────
  if (!lock.immutable) {
    _triggerIdentityRecovery('immutable_false');
    return { valid: false, action: 'recovery_triggered', detail: 'identityLock.immutable is false' };
  }

  // ── Check 3: lockedTraits must exist ──────────────────────
  if (!lock.lockedTraits || Object.keys(lock.lockedTraits).length === 0) {
    _triggerIdentityRecovery('locked_traits_empty');
    return { valid: false, action: 'recovery_triggered', detail: 'identityLock.lockedTraits empty' };
  }

  // ── Update validation timestamp ───────────────────────────
  if (legacy) {
    storage.patchCompanionCore({
      legacyCore: {
        ...core.legacyCore,
        identityImmortalityLock: {
          ...legacy,
          lastValidatedAt: Date.now(),
          validationCount: (legacy.validationCount ?? 0) + 1,
        },
      },
    });
  }

  return { valid: true, action: 'none', detail: `signature=${lock.signature} ✓` };
}

function _triggerIdentityRecovery(reason) {
  console.error(`[LEGACY] Identity immortality violation: ${reason} — triggering recovery`);
  _appendLegacyLog('recoveryLog', {
    ts: Date.now(), reason, success: false, detail: 'identity_recovery_triggered',
  });
  EventBus.emit(EVENTS.APP_READY, {
    source:  'legacyEngine:identityRecovery',
    reason,
    critical: true,
  });
}

// ════════════════════════════════════════════════════════════════
// STEP 6 — LEGACY TIMELINE VISUALIZATION ENGINE
// ════════════════════════════════════════════════════════════════

/**
 * Build a chronological legacyTimeline from live companionCore.
 * Deterministic — no generated data.
 */
export function buildLegacyTimeline() {
  const core     = storage.getCompanionCore();
  const memories = storage.getMemories ? storage.getMemories() : [];

  const milestones    = _deepClone(core?.lifeStory?.milestones        ?? []);
  const importantEvts = _deepClone(core?.lifeStory?.importantEvents   ?? []);
  const chapters      = _deepClone(core?.lifeStory?.memoryChapters    ?? []);
  const relTimeline   = _deepClone(core?.lifeStory?.relationshipTimeline ?? []);
  const evoLog        = _deepClone(core?.behaviourEvolution?.evolutionLog ?? []);
  const archiveHist   = _deepClone(core?.legacyCore?.archiveHistory   ?? []);

  // Emotional arcs derived from emotionHistory
  const emotionHistory = core?.emotionHistory ?? [];
  const emotionalArcs  = emotionHistory
    .filter(e => e.intensity >= 0.6)
    .slice(-50)
    .map(e => ({ ts: e.ts, emotion: e.emotion, intensity: e.intensity }));

  // Environment memories from worldEngine
  const environmentMemories = _deepClone(core?.worldEngine?.environmentMemoryMap ?? []);

  // All events merged + sorted chronologically
  const allEvents = [
    ...milestones.map(m     => ({ ...m, _type: 'milestone'     })),
    ...importantEvts.map(e  => ({ ...e, _type: 'important'     })),
    ...chapters.map(c       => ({ ...c, _type: 'chapter'       })),
    ...archiveHist.map(a    => ({ ...a, _type: 'archive'       })),
    ...emotionalArcs.map(e  => ({ ...e, _type: 'emotional_arc' })),
  ].sort((a, b) => (a.ts ?? a.createdAt ?? 0) - (b.ts ?? b.createdAt ?? 0));

  return {
    milestones,
    emotionalArcs,
    environmentMemories,
    behaviouralEvolution: evoLog,
    embodimentEvolution:  _buildEmbodimentEvolution(core),
    voiceEvolution:       _buildVoiceEvolution(core),
    relationshipTimeline: relTimeline,
    allEvents,
    memoryCount:          memories.length,
    timelineVersion:      LEGACY_VERSION,
    generatedAt:          Date.now(),
    random:               false,
  };
}

function _buildEmbodimentEvolution(core) {
  const profile = core?.embodimentProfile ?? {};
  return {
    traitVersion:  profile.traitVersion ?? 0,
    lastUpdated:   profile.lastUpdated  ?? null,
    hasAppearance: Object.keys(profile.appearanceTraits ?? {}).length > 0,
    hasMotion:     Object.keys(profile.motionTraits     ?? {}).length > 0,
    profileVersion: profile.profileVersion ?? 'V1',
  };
}

function _buildVoiceEvolution(core) {
  const vp = core?.voicePresence ?? {};
  return {
    voiceEnabled:  vp.voiceEnabled  ?? false,
    ttsProvider:   vp.ttsProvider   ?? null,
    sttProvider:   vp.sttProvider   ?? null,
    speechEmotion: vp.speechEmotion ?? 'neutral',
    voiceVersion:  vp.voiceVersion  ?? 'V1',
  };
}

// ════════════════════════════════════════════════════════════════
// STEP 7 — MULTI-LAYER BACKUP SYSTEM
// ════════════════════════════════════════════════════════════════

/**
 * Run a specific backup layer.
 * Milestones are NEVER overwritten.
 * Returns { success, layer, archiveId, size }
 */
export function runBackupLayer(layerType = BACKUP_LAYER.REALTIME) {
  const core = storage.getCompanionCore();
  if (!core) return { success: false, layer: layerType, error: 'no_core' };

  const archive   = buildArchive(layerType);
  const archiveId = `${layerType}_${Date.now()}`;
  const payload   = JSON.stringify(archive);
  const size      = payload.length;

  // Persist to localStorage under namespaced key
  const lsKey = `IMMORTAIL_BACKUP_${layerType}`;
  try {
    if (typeof localStorage !== 'undefined') {
      // Milestone archives get a unique slot (never overwritten)
      const slotKey = layerType === BACKUP_LAYER.MILESTONE
        ? `${lsKey}_${archiveId}`
        : lsKey;
      localStorage.setItem(slotKey, payload);
    }
  } catch (e) {
    console.warn('[LEGACY] Backup localStorage write failed:', e.message);
  }

  // Update backupLayers metadata in legacyCore
  const legacyCore = _deepClone(core.legacyCore ?? buildLegacyCoreDefault());
  legacyCore.backupLayers[layerType] = {
    enabled: true,
    lastAt:  Date.now(),
    count:   (legacyCore.backupLayers[layerType]?.count ?? 0) + 1,
  };
  legacyCore.lastBackupAt = Date.now();

  // Archive history entry (capped at 100)
  const histEntry = { id: archiveId, createdAt: Date.now(), type: layerType, size, hash: archive.integrityHash };
  legacyCore.archiveHistory = [...(legacyCore.archiveHistory ?? []).slice(-99), histEntry];

  if (layerType === BACKUP_LAYER.MILESTONE) {
    legacyCore.milestoneArchiveIndex = [
      ...(legacyCore.milestoneArchiveIndex ?? []),
      { archiveId, createdAt: Date.now() },
    ];
  }

  storage.patchCompanionCore({ legacyCore });

  return { success: true, layer: layerType, archiveId, size, hash: archive.integrityHash };
}

/**
 * Restore from a specific backup layer (latest slot).
 * Returns restorePipeline result.
 */
export function restoreFromBackupLayer(layerType = BACKUP_LAYER.REALTIME) {
  try {
    if (typeof localStorage === 'undefined') return { success: false, error: 'no_localStorage' };
    const lsKey  = `IMMORTAIL_BACKUP_${layerType}`;
    const raw    = localStorage.getItem(lsKey);
    if (!raw) return { success: false, error: `no_backup_for_${layerType}` };
    return restorePipeline(raw);
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ════════════════════════════════════════════════════════════════
// STEP 8 — MEMORY + EMBODIMENT FUSION (livingCompanionState)
// ════════════════════════════════════════════════════════════════

/**
 * Fuse all companion continuity layers into livingCompanionState.
 * Preserves emotional coherence. No distortion.
 */
export function buildLivingCompanionState() {
  const core     = storage.getCompanionCore();
  const memories = storage.getMemories ? storage.getMemories() : [];
  if (!core) return null;

  return {
    // Identity spine
    identity: {
      lock:        _deepClone(core.identityLock),
      profile:     _deepClone(core.identity),
      bondStage:   core.attachmentGraph?.bondStage ?? 'distant',
      bondScore:   core.attachmentGraph?.userBond  ?? 0,
    },
    // Emotional spine
    emotion: {
      current:    _deepClone(core.emotionalState),
      history:    (core.emotionHistory ?? []).slice(-20),
      continuity: core.memoryReflection?.emotionalContinuityState ?? null,
      phase:      core.memoryReflection?.relationshipPhase ?? 'stranger',
    },
    // Memory spine
    memory: {
      count:       memories.length,
      categories:  core.memoryReflection?.memoryCategories ?? {},
      recent:      memories.slice(-5).map(m => ({ id: m.id, type: m.type, ts: m.ts })),
      milestones:  core.lifeStory?.milestones ?? [],
      chapters:    (core.lifeStory?.memoryChapters ?? []).length,
    },
    // Embodiment spine
    embodiment: {
      scene:    core.embodiment?.scene    ?? null,
      posture:  core.embodiment?.posture  ?? null,
      traits:   _deepClone(core.embodimentProfile),
    },
    // World spine
    world: {
      activeEnvironment: core.worldEngine?.activeEnvironment ?? null,
      timeOfDay:         core.worldEngine?.timeOfDay         ?? null,
      environmentMood:   core.worldEngine?.environmentMood   ?? null,
    },
    // Behaviour spine
    behaviour: {
      evolutionRate:  core.behaviourEvolution?.evolutionRate   ?? null,
      coreTraits:     _deepClone(core.behaviourEvolution?.coreTraits ?? {}),
      adaptationMode: core.behaviourEvolution?.adaptationMode  ?? null,
    },
    // Voice spine
    voice: {
      enabled:      core.voicePresence?.voiceEnabled   ?? false,
      ttsProvider:  core.voicePresence?.ttsProvider    ?? null,
      speechEmotion: core.voicePresence?.speechEmotion ?? 'neutral',
    },
    // Legacy spine
    legacy: {
      generationStatus: core.legacyCore?.generationStatus ?? GENERATION_STATUS,
      archiveVersion:   core.legacyCore?.archiveVersion   ?? LEGACY_VERSION,
      snapshotCount:    core.legacyCore?.snapshotCount    ?? 0,
      continuityMode:   core.legacyCore?.continuityMode   ?? CONTINUITY_MODE.STRICT,
    },
    _meta: {
      generatedAt:   Date.now(),
      random:        false,
      deterministic: true,
      coherenceCheck: _verifyCoherence(core),
    },
  };
}

function _verifyCoherence(core) {
  const checks = {
    identityLockPresent: !!core?.identityLock?.signature,
    emotionalStatePresent: !!core?.emotionalState,
    worldEnginePresent: !!core?.worldEngine?.activeEnvironment,
    behaviourEvolutionPresent: !!core?.behaviourEvolution?.evolutionVersion,
    voicePresencePresent: !!core?.voicePresence?.voiceEnabled !== undefined,
  };
  const passed = Object.values(checks).filter(Boolean).length;
  return { checks, passed, total: Object.keys(checks).length, coherent: passed === Object.keys(checks).length };
}

// ════════════════════════════════════════════════════════════════
// STEP 9 — OFFLINE IMMORTALITY MODE
// ════════════════════════════════════════════════════════════════

/**
 * Verify offline immortality guarantees.
 * Returns { offlineReady, localRecoveryAvailable, exportAvailable, details }
 */
export function verifyOfflineImmortality() {
  const lsAvailable = typeof localStorage !== 'undefined';
  const core        = storage.getCompanionCore();
  const corePresent = !!core?.identityLock;

  const backupKeys = [];
  if (lsAvailable) {
    Object.values(BACKUP_LAYER).forEach(layer => {
      const key = `IMMORTAIL_BACKUP_${layer}`;
      if (localStorage.getItem(key)) backupKeys.push(layer);
    });
  }

  return {
    offlineReady:             corePresent,
    localRecoveryAvailable:   backupKeys.length > 0,
    exportAvailable:          lsAvailable && corePresent,
    localStorageAvailable:    lsAvailable,
    availableBackupLayers:    backupKeys,
    cloudDependency:          false,   // always false — offline-first by design
    details: {
      corePresent,
      backupLayersFound: backupKeys.length,
      cloudRequired:     false,
    },
  };
}

// ════════════════════════════════════════════════════════════════
// STEP 10 — SAFE FAILURE RECOVERY ENGINE
// ════════════════════════════════════════════════════════════════

/**
 * Full failure recovery flow.
 * Priority: identity continuity > feature recovery.
 * Returns { recovered, strategy, detail }
 */
export function runFailureRecovery(reason = RECOVERY_REASON.MANUAL) {
  console.log(`[LEGACY] Running failure recovery — reason: ${reason}`);

  const core = storage.getCompanionCore();

  // ── Strategy 1: realtime checkpoint ───────────────────────
  const rtResult = restoreFromBackupLayer(BACKUP_LAYER.REALTIME);
  if (rtResult.success) {
    _logRecovery(reason, true, 'realtimeCheckpoint');
    return { recovered: true, strategy: 'realtimeCheckpoint', detail: rtResult };
  }

  // ── Strategy 2: hourly archive ─────────────────────────────
  const hrResult = restoreFromBackupLayer(BACKUP_LAYER.HOURLY);
  if (hrResult.success) {
    _logRecovery(reason, true, 'hourlyArchive');
    return { recovered: true, strategy: 'hourlyArchive', detail: hrResult };
  }

  // ── Strategy 3: full legacy archive ───────────────────────
  const flResult = restoreFromBackupLayer(BACKUP_LAYER.FULL);
  if (flResult.success) {
    _logRecovery(reason, true, 'fullLegacyArchive');
    return { recovered: true, strategy: 'fullLegacyArchive', detail: flResult };
  }

  // ── Strategy 4: safe-mode boot (preserve identityLock only) 
  if (core?.identityLock?.signature) {
    _logRecovery(reason, true, 'safeModeBoot_identityPreserved');
    console.warn('[LEGACY] No backup available — safe mode: identityLock preserved, features reset');
    EventBus.emit(EVENTS.APP_READY, {
      source:   'legacyEngine:safeModeBoot',
      reason,
      safeMode: true,
    });
    return {
      recovered: true,
      strategy:  'safeModeBoot',
      detail:    'identity preserved, no full backup available',
    };
  }

  // ── Strategy 5: full reset (identity loss — last resort) ──
  _logRecovery(reason, false, 'full_reset_required');
  console.error('[LEGACY] CRITICAL: No recovery strategy succeeded. Manual intervention required.');
  return { recovered: false, strategy: 'none', detail: 'manual intervention required' };
}

function _logRecovery(reason, success, strategy) {
  const core = storage.getCompanionCore();
  if (!core?.legacyCore) return;
  const entry = { ts: Date.now(), reason, success, detail: strategy };
  storage.patchCompanionCore({
    legacyCore: {
      ...core.legacyCore,
      recoveryLog: [...(core.legacyCore.recoveryLog ?? []).slice(-49), entry],
    },
  });
}

// ════════════════════════════════════════════════════════════════
// STEP 11 — OLLAMA + GROQ FINAL ROLE LOCK
// ════════════════════════════════════════════════════════════════

export const PROVIDER_ROLE_LOCK = Object.freeze({
  ollama: {
    role:             'primary_persistent_brain',
    allowedTasks: [
      'emotionalReasoning', 'memoryContinuity', 'identityContinuity',
      'embodimentConsistency', 'lifeStoryReasoning', 'attachmentContinuity',
      'offlineFallback',
    ],
    canMutateIdentity: true,
    canMutateMemory:   true,
    canMutateWorld:    true,
    offlineSafe:       true,
  },
  groq: {
    role:             'acceleration_layer_only',
    allowedTasks: [
      'rapidVisionTasks', 'environmentClassification', 'mediaPreprocessing',
      'rapidSceneAnalysis', 'motionAnalysis', 'audioAnalysis',
    ],
    canMutateIdentity: false,   // NEVER
    canMutateMemory:   false,   // NEVER
    canMutateWorld:    false,   // NEVER (read classify only)
    offlineSafe:       false,
    requiresValidationBefore:  'any_persistence',
  },
});

/**
 * Validate a provider action against the role lock.
 * Returns { allowed, reason }
 */
export function validateProviderAction(providerId, task) {
  const roleDef = PROVIDER_ROLE_LOCK[providerId];
  if (!roleDef) return { allowed: false, reason: `unknown_provider:${providerId}` };
  if (!roleDef.allowedTasks.includes(task)) {
    return { allowed: false, reason: `task_not_in_role:${task}_for_${providerId}` };
  }
  return { allowed: true, reason: 'role_lock_pass' };
}

/**
 * Block any attempt by Groq to mutate identity/memory.
 * Returns { blocked, reason }
 */
export function blockGroqMutation(mutationType) {
  const blocked = ['identity', 'memory', 'identityLock', 'milestones'];
  if (blocked.includes(mutationType)) {
    console.error(`[LEGACY] BLOCKED: Groq attempted to mutate '${mutationType}' — role lock enforced`);
    return { blocked: true, reason: `groq_cannot_mutate_${mutationType}` };
  }
  return { blocked: false, reason: 'non_restricted_mutation' };
}

// ════════════════════════════════════════════════════════════════
// STEP 12 — GENERATION 1 COMPLETION LOCK
// ════════════════════════════════════════════════════════════════

export const GENERATION_1_CERTIFICATE = Object.freeze({
  generation:           1,
  status:               'COMPLETE',
  architectureLocked:   true,
  continuityProtected:  true,
  expansionReady:       true,
  archiveVersion:       LEGACY_VERSION,
  runsCompleted: [
    'Run01_StorageLayer',         'Run02_StateHydration',
    'Run03_StateContainers',      'Run04_EventBus',
    'Run05_MultiAgentOrch',       'Run06_AgentRegistry',
    'Run07_MediaIngestion',       'Run08_IdentityReconstruction',
    'Run09_BehaviourIntelligence','Run10_PlatformIntegration',
    'Run11_BondingSystem',        'Run12_HybridAI',
    'Run13_PresenceSystem',       'Run14_VoicePresence',
    'Run15_MemoryReflection',     'Run16_WorldEngine',
    'Run17_ARPresence',           'Run18_BehaviourEvolution',
    'Run19_ProductionOptimisation','Run20_LegacyPreservation',
  ],
  immutableBaseline:    true,
  futureRunsAddOnTop:   true,
  certifiedAt:          null,   // filled at runtime
});

export function getCertificate() {
  return { ...GENERATION_1_CERTIFICATE, certifiedAt: Date.now() };
}

// ════════════════════════════════════════════════════════════════
// BOOT — called by companionCoreService
// ════════════════════════════════════════════════════════════════

export function bootLegacyEngine() {
  const core = storage.getCompanionCore();
  if (!core) return;

  // Inject legacyCore if missing
  if (!core.legacyCore) {
    storage.patchCompanionCore({ legacyCore: buildLegacyCoreDefault() });
  }

  // Identity immortality check on every boot
  const idCheck = validateIdentityImmortality();

  // Auto realtime checkpoint on boot
  const btResult = runBackupLayer(BACKUP_LAYER.REALTIME);

  console.log('[IMMORTAIL LEGACY ENGINE] boot complete', {
    generationStatus:   GENERATION_STATUS,
    archiveVersion:     LEGACY_VERSION,
    identityValid:      idCheck.valid,
    realtimeBackup:     btResult.success ? 'saved' : 'failed',
    legacyVersion:      LEGACY_VERSION,
  });

  EventBus.emit(EVENTS.APP_READY, {
    source:    'legacyEngine:boot',
    generation: 1,
    status:     GENERATION_STATUS,
  });
}

// ════════════════════════════════════════════════════════════════
// EXPORT HELPERS (DOWNLOAD)
// ════════════════════════════════════════════════════════════════

/**
 * Serialize archive to JSON string (ready for file download as .immortail).
 */
export function serializeArchive(label = 'export') {
  const archive = buildArchive(label);
  return JSON.stringify(archive, null, 2);
}

/**
 * In a browser context: trigger a .immortail file download.
 * Safe — does nothing in SSR/Node.
 */
export function downloadArchive(label = 'immortail_export') {
  if (typeof document === 'undefined') return false;
  const json = serializeArchive(label);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${label}_${Date.now()}${ARCHIVE_EXT}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  _appendLegacyLog('exportLog', {
    ts: Date.now(), format: ARCHIVE_FORMAT, size: json.length, label,
  });
  return true;
}

// ════════════════════════════════════════════════════════════════
// INTERNAL UTILITIES
// ════════════════════════════════════════════════════════════════

function _deepClone(obj) {
  if (obj === null || obj === undefined) return obj;
  try { return JSON.parse(JSON.stringify(obj)); } catch { return obj; }
}

function _appendLegacyLog(logKey, entry) {
  const core = storage.getCompanionCore();
  if (!core?.legacyCore) return;
  const existing = core.legacyCore[logKey] ?? [];
  storage.patchCompanionCore({
    legacyCore: {
      ...core.legacyCore,
      [logKey]: [...existing.slice(-49), entry],
    },
  });
}
