// ================================================================
// IMMORTAIL™ — PERSISTENCE ENGINE (Run 10)
// Production hardening: snapshots, corruption detection, recovery,
// import/export, offline resilience, session restoration,
// storage health monitor, failsafe safe mode.
//
// STRICT RULES:
// - Single source of truth = companionCore ONLY via storage.js
// - NO data loss during recovery
// - ALL recovery operations reversible
// - NO silent failures — everything logged
// - STOP and enter safe mode on severe corruption
// - Milestones / identityLock NEVER wiped
// ================================================================

import storage from './storage.js';
import { EventBus, EVENTS } from './eventBus.js';

// ── Schema & format constants ─────────────────────────────────────

export const PERSISTENCE_SCHEMA_VERSION = 'V1';
export const EXPORT_FORMAT              = 'IMMORTAIL_BACKUP_V1';
export const IDENTITY_LOCK_SIG          = 'IMMORTAIL_DOG_CORE_V1';

// ── Health levels ─────────────────────────────────────────────────

export const HEALTH = {
  STABLE:   'stable',
  WARNING:  'warning',
  DEGRADED: 'degraded',
  RECOVERY: 'recovery',
};

// ── Caps ─────────────────────────────────────────────────────────

export const CAPS = {
  CHECKPOINTS:   5,
  EXPORT_HIST:  20,
  IMPORT_HIST:  20,
  RECOVERY_LOGS:50,
  WRITE_QUEUE:  100,
};

// ── Corruption flag types ─────────────────────────────────────────

export const CORRUPTION = {
  MISSING_SECTION:    'missing_section',
  INVALID_ARRAY:      'invalid_array',
  SCHEMA_MISMATCH:    'schema_mismatch',
  IDENTITY_LOCK_LOST: 'identity_lock_lost',
  NULL_CRITICAL:      'null_critical',
  WRITE_FAILURE:      'write_failure',
};

// ── Required core sections ────────────────────────────────────────

const REQUIRED_SECTIONS = [
  'identityLock', 'identity', 'emotionalState', 'attachmentGraph',
  'evolutionLayer', 'embodiment', 'lifeSimulation', 'lifeStory',
  'persistenceLayer',
];

const REQUIRED_ARRAYS = [
  ['memory'],
  ['mediaMemory'],
  ['emotionHistory'],
  ['lifeStory.milestones'],
  ['lifeStory.memoryChapters'],
  ['lifeStory.importantEvents'],
  ['lifeStory.relationshipTimeline'],
  ['persistenceLayer.recoveryCheckpoints'],
  ['persistenceLayer.corruptionFlags'],
  ['persistenceLayer.recoveryLogs'],
];

// ── Helpers ───────────────────────────────────────────────────────

function genId() {
  return `r10_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * getRawCore()
 * Reads companionCore from raw storage WITHOUT deepMerge fallbacks.
 * Used by corruption detection to catch genuinely missing fields.
 */
function getRawCore() {
  try {
    const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem('immortail_companion_core') : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.d ?? null;
  } catch {
    return null;
  }
}

function getNestedPath(obj, path) {
  return path.split('.').reduce((acc, k) => acc?.[k], obj);
}

function setNestedPath(obj, path, value) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!cur[keys[i]] || typeof cur[keys[i]] !== 'object') cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

function patchPL(patch) {
  const core = storage.getCompanionCore();
  const pl   = core.persistenceLayer ?? {};
  core.persistenceLayer = { ...pl, ...patch };
  storage.saveCompanionCore(core);
  return core.persistenceLayer;
}

function appendToPL(field, entry, cap) {
  const core = storage.getCompanionCore();
  const pl   = core.persistenceLayer ?? {};
  pl[field]  = [...(pl[field] ?? []), entry].slice(-cap);
  core.persistenceLayer = pl;
  storage.saveCompanionCore(core);
}

function logRecovery(op, detail = {}) {
  appendToPL('recoveryLogs', {
    id:  genId(),
    ts:  Date.now(),
    op,
    ...detail,
  }, CAPS.RECOVERY_LOGS);
}

// ════════════════════════════════════════════════════════════════
// STEP 2 — SNAPSHOT SYSTEM
// ════════════════════════════════════════════════════════════════

/**
 * createSnapshot(reason?)
 * Captures a safe, reversible snapshot of all critical state.
 * Stored as lastValidSnapshot in persistenceLayer.
 * Must be called BEFORE major writes, compression, imports, migrations.
 */
export function createSnapshot(reason = 'manual') {
  const core = storage.getCompanionCore();

  const snapshot = {
    id:        genId(),
    createdAt: Date.now(),
    reason,
    schemaVersion: PERSISTENCE_SCHEMA_VERSION,
    state: {
      identityLock:    JSON.parse(JSON.stringify(core.identityLock    ?? {})),
      identity:        JSON.parse(JSON.stringify(core.identity        ?? {})),
      emotionalState:  JSON.parse(JSON.stringify(core.emotionalState  ?? {})),
      attachmentGraph: JSON.parse(JSON.stringify(core.attachmentGraph ?? {})),
      lifeStory:       JSON.parse(JSON.stringify(core.lifeStory       ?? {})),
      embodiment:      JSON.parse(JSON.stringify(core.embodiment      ?? {})),
      evolutionLayer:  JSON.parse(JSON.stringify(core.evolutionLayer  ?? {})),
      lifeSimulation:  JSON.parse(JSON.stringify(core.lifeSimulation  ?? {})),
    },
    integrity: {
      identityLockSig:  core.identityLock?.signature ?? null,
      milestonesCount:  (core.lifeStory?.milestones ?? []).length,
      memoriesCount:    (core.memory ?? []).length,
      chaptersCount:    (core.lifeStory?.memoryChapters ?? []).length,
      bondStage:        core.attachmentGraph?.bondStage ?? 'unknown',
    },
  };

  // Store as lastValidSnapshot + append to checkpoints
  const fresh = storage.getCompanionCore();
  const pl    = fresh.persistenceLayer ?? {};
  pl.lastValidSnapshot    = snapshot;
  pl.recoveryCheckpoints  = [...(pl.recoveryCheckpoints ?? []), {
    id:        snapshot.id,
    createdAt: snapshot.createdAt,
    reason,
    integrity: snapshot.integrity,
  }].slice(-CAPS.CHECKPOINTS);
  fresh.persistenceLayer  = pl;
  storage.saveCompanionCore(fresh);

  logRecovery('snapshot_created', { snapshotId: snapshot.id, reason });

  return snapshot;
}

/**
 * getLastValidSnapshot()
 * Returns the most recent stored snapshot or null.
 */
export function getLastValidSnapshot() {
  return storage.getCompanionCore().persistenceLayer?.lastValidSnapshot ?? null;
}

/**
 * getCheckpoints()
 * Returns rolling checkpoint log.
 */
export function getCheckpoints() {
  return storage.getCompanionCore().persistenceLayer?.recoveryCheckpoints ?? [];
}

// ════════════════════════════════════════════════════════════════
// STEP 3 — CORRUPTION DETECTION
// ════════════════════════════════════════════════════════════════

/**
 * detectCorruption(core?)
 * Validates companionCore on every boot.
 * Returns { clean: boolean, flags: CorruptionFlag[] }
 */
export function detectCorruption(core = null) {
  // Use raw storage read when no core passed — avoids deepMerge masking missing sections
  if (!core) core = getRawCore() ?? storage.getCompanionCore();
  if (!core) {
    return { clean: false, flags: [{ type: CORRUPTION.MISSING_SECTION, detail: 'companionCore is null', ts: Date.now() }] };
  }
  const flags = [];

  // 1. Required sections exist
  for (const section of REQUIRED_SECTIONS) {
    if (!core[section] || typeof core[section] !== 'object') {
      flags.push({
        type:    CORRUPTION.MISSING_SECTION,
        detail:  `Section "${section}" is missing or invalid`,
        ts:      Date.now(),
      });
    }
  }

  // 2. Arrays are valid
  for (const [path] of REQUIRED_ARRAYS) {
    const val = getNestedPath(core, path);
    if (val !== undefined && !Array.isArray(val)) {
      flags.push({
        type:   CORRUPTION.INVALID_ARRAY,
        detail: `"${path}" should be an array but got ${typeof val}`,
        ts:     Date.now(),
      });
    }
  }

  // 3. Schema version matches
  const sv = core.persistenceLayer?.schemaVersion;
  if (sv && sv !== PERSISTENCE_SCHEMA_VERSION) {
    flags.push({
      type:   CORRUPTION.SCHEMA_MISMATCH,
      detail: `Schema version mismatch: stored="${sv}" expected="${PERSISTENCE_SCHEMA_VERSION}"`,
      ts:     Date.now(),
    });
  }

  // 4. Identity lock intact
  if (core.identityLock?.signature !== IDENTITY_LOCK_SIG) {
    flags.push({
      type:   CORRUPTION.IDENTITY_LOCK_LOST,
      detail: `identityLock signature missing or corrupted`,
      ts:     Date.now(),
    });
  }

  // 5. No null critical states
  const criticalFields = [
    ['identity.name', core.identity?.name],
    ['emotionalState', core.emotionalState],
    ['attachmentGraph', core.attachmentGraph],
  ];
  for (const [label, val] of criticalFields) {
    if (val === null || val === undefined) {
      flags.push({
        type:   CORRUPTION.NULL_CRITICAL,
        detail: `Critical field "${label}" is null or undefined`,
        ts:     Date.now(),
      });
    }
  }

  return { clean: flags.length === 0, flags };
}

/**
 * runBootCorruptionCheck()
 * Called on every app boot. Sets corruptionFlags in persistenceLayer.
 * Triggers recovery mode automatically if dirty.
 * Returns { clean, flags, recovered }
 */
export function runBootCorruptionCheck() {
  const core   = storage.getCompanionCore();
  const result = detectCorruption(core);

  if (!result.clean) {
    // Persist flags
    const fresh = storage.getCompanionCore();
    const pl    = fresh.persistenceLayer ?? {};
    pl.corruptionFlags     = result.flags;
    pl.persistenceHealth   = result.flags.some(f => f.type === CORRUPTION.IDENTITY_LOCK_LOST)
      ? HEALTH.RECOVERY : HEALTH.DEGRADED;
    fresh.persistenceLayer = pl;
    storage.saveCompanionCore(fresh);

    logRecovery('corruption_detected', { flagCount: result.flags.length, flags: result.flags.map(f => f.type) });

    // Attempt recovery
    const recovered = attemptPartialRepair(result.flags);
    return { clean: false, flags: result.flags, recovered };
  }

  // All clean — update health
  const fresh = storage.getCompanionCore();
  const pl    = fresh.persistenceLayer ?? {};
  if (pl.persistenceHealth === HEALTH.RECOVERY || pl.persistenceHealth === HEALTH.DEGRADED) {
    pl.persistenceHealth = HEALTH.STABLE;
  }
  pl.corruptionFlags     = [];
  pl.lastHealthCheck     = Date.now();
  fresh.persistenceLayer = pl;
  storage.saveCompanionCore(fresh);

  return { clean: true, flags: [], recovered: false };
}

// ════════════════════════════════════════════════════════════════
// STEP 4 — SAFE RECOVERY ENGINE
// ════════════════════════════════════════════════════════════════

/**
 * attemptPartialRepair(flags)
 * For each corruption flag, tries a targeted repair.
 * Never silently overwrites. Logs every operation.
 * Returns { repaired: boolean, ops: string[] }
 */
export function attemptPartialRepair(flags) {
  const ops  = [];
  let repaired = false;

  for (const flag of flags) {
    const core = storage.getCompanionCore();

    if (flag.type === CORRUPTION.MISSING_SECTION) {
      // Extract section name from detail
      const match = flag.detail.match(/"(\w+)"/);
      const section = match?.[1];
      if (section && !core[section]) {
        // Restore from snapshot if available
        const snap = core.persistenceLayer?.lastValidSnapshot?.state;
        if (snap?.[section]) {
          core[section] = JSON.parse(JSON.stringify(snap[section]));
          storage.saveCompanionCore(core);
          ops.push(`restored_section:${section}:from_snapshot`);
          repaired = true;
        } else {
          ops.push(`cannot_restore_section:${section}:no_snapshot`);
        }
      }
    }

    if (flag.type === CORRUPTION.INVALID_ARRAY) {
      const match = flag.detail.match(/"([^"]+)"/);
      const path  = match?.[1];
      if (path) {
        const fresh = storage.getCompanionCore();
        setNestedPath(fresh, path, []);
        storage.saveCompanionCore(fresh);
        ops.push(`reset_invalid_array:${path}`);
        repaired = true;
      }
    }

    if (flag.type === CORRUPTION.IDENTITY_LOCK_LOST) {
      // Try to restore identity lock from snapshot
      const snap = core.persistenceLayer?.lastValidSnapshot?.state;
      if (snap?.identityLock?.signature === IDENTITY_LOCK_SIG) {
        const fresh = storage.getCompanionCore();
        fresh.identityLock = JSON.parse(JSON.stringify(snap.identityLock));
        storage.saveCompanionCore(fresh);
        ops.push('restored_identity_lock:from_snapshot');
        repaired = true;
      } else {
        // Cannot restore identity lock without valid snapshot — enter safe mode
        enterSafeMode('identity_lock_unrecoverable');
        ops.push('safe_mode_entered:identity_lock_unrecoverable');
      }
    }

    if (flag.type === CORRUPTION.NULL_CRITICAL) {
      const snap = core.persistenceLayer?.lastValidSnapshot?.state;
      if (snap) {
        const fresh = storage.getCompanionCore();
        if (!fresh.emotionalState && snap.emotionalState) {
          fresh.emotionalState = JSON.parse(JSON.stringify(snap.emotionalState));
          ops.push('restored_emotionalState:from_snapshot');
          repaired = true;
        }
        if (!fresh.attachmentGraph && snap.attachmentGraph) {
          fresh.attachmentGraph = JSON.parse(JSON.stringify(snap.attachmentGraph));
          ops.push('restored_attachmentGraph:from_snapshot');
          repaired = true;
        }
        storage.saveCompanionCore(fresh);
      }
    }
  }

  logRecovery('partial_repair_attempt', { repaired, ops });
  return { repaired, ops };
}

/**
 * restoreFromSnapshot(snapshot?)
 * Restores companionCore critical sections from a snapshot.
 * Preserves any sections NOT in the snapshot.
 * Never resets lifeStory.milestones or identityLock if already intact.
 */
export function restoreFromSnapshot(snapshot = null) {
  if (!snapshot) snapshot = getLastValidSnapshot();
  if (!snapshot?.state) {
    logRecovery('restore_failed', { reason: 'no valid snapshot available' });
    return { restored: false, reason: 'no valid snapshot available' };
  }

  // Take a pre-restore snapshot first (for rollback)
  createSnapshot('pre_restore_backup');

  const core  = storage.getCompanionCore();
  const state = snapshot.state;
  const ops   = [];

  // Restore section by section — only overwrite if snapshot has valid data
  for (const [section, value] of Object.entries(state)) {
    if (!value || typeof value !== 'object') continue;

    // Special protection: never overwrite intact identityLock
    if (section === 'identityLock' && core.identityLock?.signature === IDENTITY_LOCK_SIG) {
      ops.push(`skipped:identityLock (already intact)`);
      continue;
    }

    // Special protection: preserve more milestones (don't restore to fewer)
    if (section === 'lifeStory') {
      const existingMs = (core.lifeStory?.milestones ?? []).length;
      const snapMs     = (value.milestones ?? []).length;
      if (existingMs > snapMs) {
        // merge — keep existing milestones, restore everything else
        core.lifeStory = {
          ...JSON.parse(JSON.stringify(value)),
          milestones: core.lifeStory.milestones,
        };
        ops.push(`merged:lifeStory (preserved ${existingMs} milestones)`);
        continue;
      }
    }

    core[section] = JSON.parse(JSON.stringify(value));
    ops.push(`restored:${section}`);
  }

  storage.saveCompanionCore(core);
  logRecovery('snapshot_restored', { snapshotId: snapshot.id, ops });

  patchPL({ persistenceHealth: HEALTH.STABLE });
  return { restored: true, snapshotId: snapshot.id, ops };
}

// ════════════════════════════════════════════════════════════════
// STEP 5 — IMPORT / EXPORT SYSTEM
// ════════════════════════════════════════════════════════════════

/**
 * exportCompanion()
 * Creates a full IMMORTAIL_BACKUP_V1 export object.
 * Includes snapshot before export (safety).
 */
export function exportCompanion() {
  // Safety snapshot before export
  createSnapshot('pre_export');

  const core = storage.getCompanionCore();

  const exportData = {
    format:       EXPORT_FORMAT,
    version:      PERSISTENCE_SCHEMA_VERSION,
    exportedAt:   Date.now(),
    exportedAtISO:new Date().toISOString(),
    validation: {
      identityLockSig:  core.identityLock?.signature,
      milestonesCount:  (core.lifeStory?.milestones ?? []).length,
      chaptersCount:    (core.lifeStory?.memoryChapters ?? []).length,
      bondStage:        core.attachmentGraph?.bondStage ?? 'unknown',
      totalInteractions:core.attachmentGraph?.interactionCount ?? 0,
    },
    companionCore: {
      identityLock:    JSON.parse(JSON.stringify(core.identityLock    ?? {})),
      identity:        JSON.parse(JSON.stringify(core.identity        ?? {})),
      emotionalState:  JSON.parse(JSON.stringify(core.emotionalState  ?? {})),
      attachmentGraph: JSON.parse(JSON.stringify(core.attachmentGraph ?? {})),
      evolutionLayer:  JSON.parse(JSON.stringify(core.evolutionLayer  ?? {})),
      embodiment:      JSON.parse(JSON.stringify(core.embodiment      ?? {})),
      lifeSimulation:  JSON.parse(JSON.stringify(core.lifeSimulation  ?? {})),
      lifeStory:       JSON.parse(JSON.stringify(core.lifeStory       ?? {})),
      memory:          JSON.parse(JSON.stringify(core.memory          ?? [])),
      mediaMemory:     JSON.parse(JSON.stringify(core.mediaMemory     ?? [])),
      emotionHistory:  JSON.parse(JSON.stringify(core.emotionHistory  ?? [])),
    },
  };

  // Append to export history
  appendToPL('exportHistory', {
    id:          genId(),
    ts:          exportData.exportedAt,
    validation:  exportData.validation,
  }, CAPS.EXPORT_HIST);

  logRecovery('export_created', { validation: exportData.validation });
  return exportData;
}

/**
 * validateExportData(exportData)
 * Validates an IMMORTAIL_BACKUP_V1 object before import.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateExportData(exportData) {
  const errors = [];

  if (!exportData || typeof exportData !== 'object') {
    return { valid: false, errors: ['not an object'] };
  }

  if (exportData.format !== EXPORT_FORMAT) {
    errors.push(`format mismatch: expected "${EXPORT_FORMAT}", got "${exportData.format}"`);
  }

  if (!exportData.companionCore || typeof exportData.companionCore !== 'object') {
    errors.push('missing companionCore section');
  } else {
    const cc = exportData.companionCore;

    // Identity lock must be present and valid
    if (cc.identityLock?.signature !== IDENTITY_LOCK_SIG) {
      errors.push('identityLock signature invalid or missing in export');
    }

    // Required sections
    for (const section of ['identity', 'emotionalState', 'attachmentGraph', 'lifeStory']) {
      if (!cc[section] || typeof cc[section] !== 'object') {
        errors.push(`missing or invalid section: "${section}"`);
      }
    }

    // Memory arrays
    for (const arr of ['memory', 'mediaMemory', 'emotionHistory']) {
      if (cc[arr] !== undefined && !Array.isArray(cc[arr])) {
        errors.push(`"${arr}" must be an array`);
      }
    }

    // Schema compatibility
    if (exportData.version && exportData.version !== PERSISTENCE_SCHEMA_VERSION) {
      errors.push(`schema version mismatch: export="${exportData.version}" current="${PERSISTENCE_SCHEMA_VERSION}"`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * importCompanion(exportData, options?)
 * Safely imports a companion backup.
 * Preserves identity, memories, emotional continuity, bond state, lifeStory.
 * No duplicate companion creation.
 * Returns { imported: boolean, errors?, ops: string[] }
 */
export function importCompanion(exportData, options = {}) {
  const { allowSchemaUpgrade = false } = options;

  // 1. Validate
  const validation = validateExportData(exportData);
  if (!validation.valid) {
    logRecovery('import_rejected', { errors: validation.errors });
    return { imported: false, errors: validation.errors, ops: [] };
  }

  // 2. Safety snapshot before any mutation
  createSnapshot('pre_import');

  const cc   = exportData.companionCore;
  const ops  = [];

  // 3. Check for duplicate — compare identity creation timestamps
  const current = storage.getCompanionCore();
  const isDuplicate = current.identityLock?.lockedAt &&
    cc.identityLock?.lockedAt &&
    current.identityLock.lockedAt === cc.identityLock.lockedAt;

  if (isDuplicate) {
    // Same companion — merge rather than overwrite
    ops.push('duplicate_detected:merging_rather_than_overwriting');
    // Merge memories (union by id)
    const existingIds = new Set((current.memory ?? []).map(m => m.id));
    const newMems     = (cc.memory ?? []).filter(m => !existingIds.has(m.id));
    const merged      = [...(current.memory ?? []), ...newMems].slice(-500);
    current.memory    = merged;
    ops.push(`merged_memories: ${newMems.length} new entries`);

    // Merge milestones
    const existingMsIds = new Set((current.lifeStory?.milestones ?? []).map(m => m.id));
    const newMs = (cc.lifeStory?.milestones ?? []).filter(m => !existingMsIds.has(m.id));
    if (current.lifeStory) {
      current.lifeStory.milestones = [...(current.lifeStory.milestones ?? []), ...newMs].slice(-50);
      ops.push(`merged_milestones: ${newMs.length} new`);
    }
    storage.saveCompanionCore(current);
  } else {
    // Fresh import — replace core sections
    const fresh = storage.getCompanionCore();

    // identityLock: import as-is (it's the source companion's lock)
    fresh.identityLock    = JSON.parse(JSON.stringify(cc.identityLock));
    ops.push('imported:identityLock');

    // identity
    fresh.identity        = JSON.parse(JSON.stringify(cc.identity));
    ops.push('imported:identity');

    // emotionalState
    fresh.emotionalState  = JSON.parse(JSON.stringify(cc.emotionalState));
    ops.push('imported:emotionalState');

    // attachmentGraph
    fresh.attachmentGraph = JSON.parse(JSON.stringify(cc.attachmentGraph));
    ops.push('imported:attachmentGraph');

    // evolutionLayer
    fresh.evolutionLayer  = JSON.parse(JSON.stringify(cc.evolutionLayer));
    ops.push('imported:evolutionLayer');

    // embodiment
    fresh.embodiment      = JSON.parse(JSON.stringify(cc.embodiment ?? {}));
    ops.push('imported:embodiment');

    // lifeSimulation
    fresh.lifeSimulation  = JSON.parse(JSON.stringify(cc.lifeSimulation ?? {}));
    ops.push('imported:lifeSimulation');

    // lifeStory
    fresh.lifeStory       = JSON.parse(JSON.stringify(cc.lifeStory));
    ops.push('imported:lifeStory');

    // memories
    fresh.memory          = JSON.parse(JSON.stringify(cc.memory ?? []));
    fresh.mediaMemory     = JSON.parse(JSON.stringify(cc.mediaMemory ?? []));
    fresh.emotionHistory  = JSON.parse(JSON.stringify(cc.emotionHistory ?? []));
    ops.push('imported:memories');

    storage.saveCompanionCore(fresh);
  }

  // 4. Verify post-import identity lock
  const postCore = storage.getCompanionCore();
  if (postCore.identityLock?.signature !== IDENTITY_LOCK_SIG) {
    logRecovery('import_identity_lock_fail', { ops });
    return { imported: false, errors: ['post-import identity lock invalid'], ops };
  }

  // 5. Record import history
  appendToPL('importHistory', {
    id:         genId(),
    ts:         Date.now(),
    format:     exportData.format,
    version:    exportData.version,
    isDuplicate,
    validation: exportData.validation ?? {},
    ops,
  }, CAPS.IMPORT_HIST);

  logRecovery('import_success', { isDuplicate, opsCount: ops.length });
  patchPL({ persistenceHealth: HEALTH.STABLE });
  return { imported: true, isDuplicate, ops };
}

// ════════════════════════════════════════════════════════════════
// STEP 7 — OFFLINE RESILIENCE / WRITE QUEUE
// ════════════════════════════════════════════════════════════════

let _writeQueueLocked = false;

/**
 * enqueueWrite(operation, payload)
 * Adds a write operation to the persistent queue for retry.
 */
export function enqueueWrite(operation, payload) {
  appendToPL('writeQueue', {
    id:        genId(),
    ts:        Date.now(),
    operation,
    payload:   JSON.parse(JSON.stringify(payload)),
    attempts:  0,
    lastError: null,
  }, CAPS.WRITE_QUEUE);
}

/**
 * flushWriteQueue()
 * Attempts to replay all queued writes in order.
 * Retries are capped at 3 attempts per entry.
 * Returns { flushed, failed, remaining }
 */
export function flushWriteQueue() {
  if (_writeQueueLocked) return { flushed: 0, failed: 0, remaining: 0 };
  _writeQueueLocked = true;

  const core  = storage.getCompanionCore();
  const queue = [...(core.persistenceLayer?.writeQueue ?? [])];
  if (queue.length === 0) {
    _writeQueueLocked = false;
    return { flushed: 0, failed: 0, remaining: 0 };
  }

  let flushed  = 0;
  let failed   = 0;
  const remaining = [];

  for (const entry of queue) {
    try {
      // Replay supported write operations
      if (entry.operation === 'saveCompanionCore') {
        storage.saveCompanionCore(entry.payload);
        flushed++;
      } else if (entry.operation === 'addCoreMemory') {
        // Re-add memory if not already present
        const fresh = storage.getCompanionCore();
        const exists = (fresh.memory ?? []).some(m => m.id === entry.payload.id);
        if (!exists) {
          fresh.memory = [...(fresh.memory ?? []), entry.payload].slice(-500);
          storage.saveCompanionCore(fresh);
        }
        flushed++;
      } else {
        // Unknown operation — log and drop after 3 attempts
        entry.attempts++;
        if (entry.attempts < 3) remaining.push(entry);
        else { failed++; logRecovery('write_queue_drop', { op: entry.operation, reason: 'unknown_operation' }); }
      }
    } catch (err) {
      entry.attempts++;
      entry.lastError = err.message;
      if (entry.attempts < 3) remaining.push({ ...entry });
      else { failed++; logRecovery('write_queue_fail', { id: entry.id, error: err.message }); }
    }
  }

  // Persist remaining queue
  const fresh2 = storage.getCompanionCore();
  if (fresh2.persistenceLayer) {
    fresh2.persistenceLayer.writeQueue = remaining;
    storage.saveCompanionCore(fresh2);
  }

  _writeQueueLocked = false;
  logRecovery('write_queue_flushed', { flushed, failed, remaining: remaining.length });
  return { flushed, failed, remaining: remaining.length };
}

/**
 * verifyLocalPersistence()
 * Confirms storage is read/write capable.
 * Returns { available: boolean, readOk: boolean, writeOk: boolean }
 */
export function verifyLocalPersistence() {
  try {
    const testKey = '__immortail_persist_test__';
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(testKey, JSON.stringify({ ts: Date.now() }));
    const back = JSON.parse(localStorage.getItem(testKey));
    localStorage.removeItem(testKey);
    const writeOk = back?.ts > 0;
    return { available: true, readOk: true, writeOk };
  } catch (err) {
    return { available: false, readOk: false, writeOk: false, error: err.message };
  }
}

// ════════════════════════════════════════════════════════════════
// STEP 8 — SESSION RESTORATION
// ════════════════════════════════════════════════════════════════

/**
 * captureSessionState()
 * Saves the current volatile session state for restoration.
 */
export function captureSessionState() {
  const core = storage.getCompanionCore();

  const sessionState = {
    capturedAt:    Date.now(),
    currentRoutine:core.lifeSimulation?.currentRoutine  ?? 'idle',
    ambientMood:   core.lifeSimulation?.ambientMood     ?? 'calm',
    animationState:core.embodiment?.animationState      ?? 'idle',
    postureState:  core.embodiment?.postureState        ?? 'neutral',
    emotionalState:{
      mood:        core.identity?.mood                  ?? 'neutral',
      energy:      core.identity?.energy                ?? 50,
    },
    activeTimelines: {
      dailyCycleState: core.lifeSimulation?.dailyCycleState ?? 'awake',
      autonomousMode:  core.lifeSimulation?.autonomousState?.mode ?? 'passive',
    },
    bondStage:     core.attachmentGraph?.bondStage       ?? 'distant',
    currentPhase:  (core.lifeStory?.relationshipTimeline ?? []).at(-1)?.label ?? 'Beginning',
  };

  storage.saveSession({ ...storage.getSession(), sessionRestore: sessionState });
  return sessionState;
}

/**
 * restoreSessionState()
 * Restores the last captured session state.
 * Returns { restored: boolean, state? }
 */
export function restoreSessionState() {
  const session = storage.getSession();
  const state   = session?.sessionRestore;

  if (!state || !state.capturedAt) {
    return { restored: false, reason: 'no session state to restore' };
  }

  // Restore to companionCore
  const core = storage.getCompanionCore();

  if (core.lifeSimulation) {
    core.lifeSimulation.currentRoutine  = state.currentRoutine  ?? core.lifeSimulation.currentRoutine;
    core.lifeSimulation.ambientMood     = state.ambientMood     ?? core.lifeSimulation.ambientMood;
    core.lifeSimulation.dailyCycleState = state.activeTimelines?.dailyCycleState ?? core.lifeSimulation.dailyCycleState;
    if (core.lifeSimulation.autonomousState) {
      core.lifeSimulation.autonomousState.mode = state.activeTimelines?.autonomousMode ?? core.lifeSimulation.autonomousState.mode;
    }
  }

  if (core.embodiment) {
    core.embodiment.animationState = state.animationState ?? core.embodiment.animationState;
    core.embodiment.postureState   = state.postureState   ?? core.embodiment.postureState;
  }

  if (core.identity) {
    core.identity.mood   = state.emotionalState?.mood   ?? core.identity.mood;
    core.identity.energy = state.emotionalState?.energy ?? core.identity.energy;
  }

  storage.saveCompanionCore(core);
  logRecovery('session_restored', { capturedAt: state.capturedAt, bondStage: state.bondStage });

  return { restored: true, state };
}

// ════════════════════════════════════════════════════════════════
// STEP 9 — STORAGE HEALTH MONITOR
// ════════════════════════════════════════════════════════════════

/**
 * runHealthCheck()
 * Lightweight health monitor. Checks storage usage, duplicate growth,
 * snapshot integrity, compression health, persistence timing.
 * Returns { health, report }
 */
export function runHealthCheck() {
  const core = storage.getCompanionCore();
  const pl   = core.persistenceLayer ?? {};
  const report = {
    ts:             Date.now(),
    checks:         [],
    health:         HEALTH.STABLE,
    warnings:       [],
    degraded:       [],
  };

  const warn  = (msg) => { report.warnings.push(msg); };
  const degrade = (msg) => { report.degraded.push(msg); };

  // 1. Storage availability
  const persist = verifyLocalPersistence();
  report.checks.push({ name: 'storage_available', ok: persist.available });
  if (!persist.available) degrade('localStorage unavailable');

  // 2. Memory growth check (>400 = warning, >480 = degraded)
  const memCount = (core.memory ?? []).length;
  report.checks.push({ name: 'memory_count', value: memCount, ok: memCount < 480 });
  if (memCount > 400) warn(`memory approaching cap: ${memCount}/500`);
  if (memCount >= 480) degrade(`memory near overflow: ${memCount}/500`);

  // 3. Duplicate memory check (entries with same ts within 100ms)
  const tsList = (core.memory ?? []).map(m => m.ts).sort();
  let dupeCount = 0;
  for (let i = 1; i < tsList.length; i++) {
    if (tsList[i] - tsList[i-1] < 100) dupeCount++;
  }
  report.checks.push({ name: 'duplicate_memories', value: dupeCount, ok: dupeCount < 5 });
  if (dupeCount >= 5) warn(`${dupeCount} possible duplicate memory entries`);

  // 4. Snapshot integrity
  const snap = pl.lastValidSnapshot;
  const snapOk = snap && snap.integrity?.identityLockSig === IDENTITY_LOCK_SIG;
  const isFirstBoot = !pl.lastHealthCheck;   // no prior health check = first boot
  report.checks.push({ name: 'snapshot_integrity', ok: !!snapOk || isFirstBoot });
  if (!snapOk && !isFirstBoot) warn('no valid snapshot or snapshot identity lock mismatch');

  // 5. Compression health (compressedIndex near cap)
  const ciCount = (core.lifeStory?.compressedMemoryIndex ?? []).length;
  report.checks.push({ name: 'compression_health', value: ciCount, ok: ciCount < 90 });
  if (ciCount >= 90) warn(`compressed index near cap: ${ciCount}/100`);

  // 6. Corruption flags
  const flagCount = (pl.corruptionFlags ?? []).length;
  report.checks.push({ name: 'corruption_flags', value: flagCount, ok: flagCount === 0 });
  if (flagCount > 0) degrade(`${flagCount} active corruption flag(s)`);

  // 7. Identity lock intact
  const lockOk = core.identityLock?.signature === IDENTITY_LOCK_SIG;
  report.checks.push({ name: 'identity_lock', ok: lockOk });
  if (!lockOk) degrade('identity lock missing or corrupted');

  // 8. Write queue backlog
  const qLen = (pl.writeQueue ?? []).length;
  report.checks.push({ name: 'write_queue', value: qLen, ok: qLen < 20 });
  if (qLen >= 20) warn(`write queue backlog: ${qLen} entries`);

  // 9. Safe mode check
  report.checks.push({ name: 'safe_mode', ok: !pl.safeMode, value: pl.safeMode ?? false });
  if (pl.safeMode) degrade('system is in SAFE MODE');

  // Determine overall health
  if (report.degraded.length > 0) {
    report.health = pl.safeMode ? HEALTH.RECOVERY : HEALTH.DEGRADED;
  } else if (report.warnings.length > 0) {
    report.health = HEALTH.WARNING;
  } else {
    report.health = HEALTH.STABLE;
  }

  // Persist health
  patchPL({ persistenceHealth: report.health, lastHealthCheck: report.ts });

  return report;
}

/**
 * getPersistenceHealth()
 * Quick read of current health level.
 */
export function getPersistenceHealth() {
  return storage.getCompanionCore().persistenceLayer?.persistenceHealth ?? HEALTH.STABLE;
}

// ════════════════════════════════════════════════════════════════
// STEP 11 — FAILSAFE SAFE MODE
// ════════════════════════════════════════════════════════════════

let _safeModeActive = false;

/**
 * enterSafeMode(reason)
 * Enters failsafe safe mode:
 * - Disables unsafe writes
 * - Preserves readable memories
 * - Allows export/recovery
 * - Prevents identity reset
 * NEVER wipes companion, resets lifeStory, or erases bond state.
 */
export function enterSafeMode(reason = 'unknown') {
  if (_safeModeActive) return { alreadyActive: true };

  _safeModeActive = true;

  // Try to create a safety snapshot before locking writes
  try { createSnapshot(`safe_mode_entry:${reason}`); } catch (_) { /* best effort */ }

  patchPL({ safeMode: true, persistenceHealth: HEALTH.RECOVERY });
  logRecovery('safe_mode_entered', { reason });

  EventBus.emit(EVENTS.APP_STATE_CHANGED ?? 'SYSTEM::APP_STATE_CHANGED', {
    type: 'safe_mode_entered', reason,
  });

  return { safeMode: true, reason };
}

/**
 * exitSafeMode()
 * Exits safe mode after manual confirmation or successful recovery.
 * Runs a full corruption check before allowing exit.
 */
export function exitSafeMode() {
  const check = detectCorruption();
  if (!check.clean) {
    return { exited: false, reason: 'corruption still present', flags: check.flags };
  }

  _safeModeActive = false;
  patchPL({ safeMode: false, persistenceHealth: HEALTH.STABLE });
  logRecovery('safe_mode_exited', { ts: Date.now() });

  return { exited: true };
}

/**
 * isSafeMode()
 * Returns true if safe mode is currently active.
 */
export function isSafeMode() {
  return _safeModeActive || (storage.getCompanionCore().persistenceLayer?.safeMode === true);
}

/**
 * safeWrite(writeFn, label)
 * Executes a write function. If safe mode is active, queues it instead.
 * Returns { executed, queued }
 */
export function safeWrite(writeFn, label = 'unknown', payload = null) {
  if (isSafeMode()) {
    if (payload) enqueueWrite(label, payload);
    logRecovery('write_blocked_safe_mode', { label });
    return { executed: false, queued: !!payload };
  }
  try {
    writeFn();
    return { executed: true, queued: false };
  } catch (err) {
    if (payload) enqueueWrite(label, payload);
    logRecovery('write_error_queued', { label, error: err.message });
    return { executed: false, queued: !!payload, error: err.message };
  }
}

// ════════════════════════════════════════════════════════════════
// STEP 6 — MULTI-DEVICE MIGRATION READINESS
// ════════════════════════════════════════════════════════════════

/**
 * prepareTransferBundle()
 * Creates a complete transfer bundle for multi-device migration.
 * Includes export + migration metadata.
 */
export function prepareTransferBundle() {
  const exportData = exportCompanion();
  const core       = storage.getCompanionCore();

  return {
    ...exportData,
    transfer: {
      preparedAt:       Date.now(),
      sourceDevice:     'web',
      migrationVersion: PERSISTENCE_SCHEMA_VERSION,
      continuityMarkers: {
        lastMilestone:     (core.lifeStory?.milestones ?? []).at(-1)?.label ?? null,
        currentPhase:      (core.lifeStory?.relationshipTimeline ?? []).at(-1)?.label ?? null,
        bondStage:         core.attachmentGraph?.bondStage ?? 'distant',
        totalInteractions: core.attachmentGraph?.interactionCount ?? 0,
        identityName:      core.identity?.name ?? 'Unknown',
      },
    },
  };
}

// ════════════════════════════════════════════════════════════════
// BOOT INTEGRATION
// ════════════════════════════════════════════════════════════════

/**
 * initPersistenceEngine()
 * Called from companionCoreService.initCompanionCore() — boot step.
 * 1. Runs corruption check
 * 2. Restores session state
 * 3. Flushes write queue
 * 4. Runs health check
 * 5. Takes initial boot snapshot if none exists
 */
export function initPersistenceEngine() {
  // 1. Corruption check
  const corruptionResult = runBootCorruptionCheck();

  // 2. Session restoration
  restoreSessionState();

  // 3. Flush pending write queue
  flushWriteQueue();

  // 4. Initial snapshot if none exists (BEFORE health check so check sees it)
  const snap = getLastValidSnapshot();
  if (!snap) {
    createSnapshot('initial_boot_snapshot');
  }

  // 5. Health check (runs after snapshot so first boot reads as stable)
  const health = runHealthCheck();

  console.log('IMMORTAIL PERSISTENCE ENGINE: boot complete', {
    corruption: !corruptionResult.clean ? corruptionResult.flags.length + ' flags' : 'clean',
    health:     health.health,
    safeMode:   isSafeMode(),
  });

  return { corruptionResult, health };
}

/**
 * getPersistenceContext()
 * Returns a summary for Ollama prompt injection (Step 10).
 */
export function getPersistenceContext() {
  const core = storage.getCompanionCore();
  const pl   = core.persistenceLayer ?? {};
  const snap = pl.lastValidSnapshot;

  return {
    persistenceHealth:   pl.persistenceHealth     ?? HEALTH.STABLE,
    backupFormat:        EXPORT_FORMAT,   // Run 10: keeps IMMORTAIL_BACKUP_V1 in bundle
    safeMode:            pl.safeMode              ?? false,
    currentPhase:       (core.lifeStory?.relationshipTimeline ?? []).at(-1)?.label ?? 'Beginning',
    bondStage:           core.attachmentGraph?.bondStage ?? 'distant',
    snapshotAvailable:   !!snap,
    snapshotAge:         snap ? Math.floor((Date.now() - snap.createdAt) / 60_000) : null,
    lastRecoveryOp:     (pl.recoveryLogs ?? []).at(-1)?.op ?? null,
    restoredState:      (pl.recoveryLogs ?? []).some(l => l.op === 'session_restored'),
    corruptionFlagCount:(pl.corruptionFlags ?? []).length,
    exportCount:        (pl.exportHistory  ?? []).length,
  };
}
