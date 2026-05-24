// ================================================================
// IMMORTAIL™ — MEMORY ENGINE (FOUNDATION)
// Memory runtime structures, references, categorization, indexing.
// NO LLM. NO VECTORS. NO EMBEDDINGS. RUNTIME REFERENCES ONLY.
// ================================================================

import { SystemLogger }   from '../utils/logger.js';
import { emit }            from '../events/eventBus.js';
import { MEMORY_EVENTS }   from '../events/eventTypes.js';

const MemoryLogger = SystemLogger;

// ----------------------------------------------------------------
// MEMORY CATEGORIES
// ----------------------------------------------------------------

export const MEMORY_CATEGORY = {
  INTERACTION:   'interaction',    // general interaction references
  EMOTIONAL:     'emotional',      // emotionally significant moments
  BONDING:       'bonding',        // bonding-linked events
  ROUTINE:       'routine',        // routine-linked patterns
  SIGNIFICANT:   'significant',    // high-impact milestone events
};

// ----------------------------------------------------------------
// MEMORY VALENCE
// ----------------------------------------------------------------

export const MEMORY_VALENCE = {
  POSITIVE: 'positive',
  NEUTRAL:  'neutral',
  NEGATIVE: 'negative',
};

// ----------------------------------------------------------------
// ASSOCIATION TYPES
// ----------------------------------------------------------------

export const ASSOCIATION_TYPE = {
  EMOTION:  'emotion',    // linked to an emotion snapshot
  BONDING:  'bonding',    // linked to a bonding event
  ROUTINE:  'routine',    // linked to a routine cycle
  PERSON:   'person',     // linked to a person/interaction partner
  LOCATION: 'location',   // future spatial reference
};

// ----------------------------------------------------------------
// INTERNAL STATE
// ----------------------------------------------------------------

/** @type {Map<string, MemoryIndex>} profileId → index */
const _indexes = new Map();

class MemoryIndex {
  constructor(profileId) {
    this.profileId    = profileId;
    this.references   = new Map();   // memoryId → MemoryReference
    this.categoryIndex = {};          // category → Set<memoryId>
    this.valenceIndex  = {};          // valence → Set<memoryId>
    this.associations  = new Map();  // memoryId → Association[]
    this.createdAt     = Date.now();
    this.updatedAt     = Date.now();

    // Pre-populate category/valence buckets
    for (const cat of Object.values(MEMORY_CATEGORY)) {
      this.categoryIndex[cat] = new Set();
    }
    for (const val of Object.values(MEMORY_VALENCE)) {
      this.valenceIndex[val] = new Set();
    }
  }
}

class MemoryReference {
  constructor({ id, profileId, category, valence, label, emotionSnapshot, metadata }) {
    this.id              = id;
    this.profileId       = profileId;
    this.category        = category;
    this.valence         = valence || MEMORY_VALENCE.NEUTRAL;
    this.label           = label   || '';
    this.emotionSnapshot = emotionSnapshot || null;
    this.metadata        = metadata        || {};
    this.weight          = 1.0;            // relevance weight (0–1)
    this.accessCount     = 0;
    this.createdAt       = Date.now();
    this.lastAccessedAt  = null;
  }
}

// ----------------------------------------------------------------
// INITIALIZE MEMORY STATE
// ----------------------------------------------------------------

/**
 * Initialize the memory index for a companion profile.
 * @param {string} profileId
 * @returns {Object} memory snapshot
 */
export function initializeMemoryState(profileId) {
  if (!profileId || typeof profileId !== 'string') {
    throw new MemoryError('[MemoryEngine] initializeMemoryState: profileId required.');
  }

  if (_indexes.has(profileId)) {
    MemoryLogger.warn(`[MemoryEngine] Memory index for "${profileId}" already initialized.`);
    return getMemorySnapshot(profileId);
  }

  _indexes.set(profileId, new MemoryIndex(profileId));

  MemoryLogger.info(`[MemoryEngine] Memory state initialized — profileId: ${profileId}`);
  return getMemorySnapshot(profileId);
}

// ----------------------------------------------------------------
// REGISTER MEMORY REFERENCE
// ----------------------------------------------------------------

/**
 * Register a new memory reference in the runtime index.
 * @param {string} profileId
 * @param {Object} memoryConfig
 * @param {string} memoryConfig.id
 * @param {string} memoryConfig.category     — MEMORY_CATEGORY value
 * @param {string} [memoryConfig.valence]    — MEMORY_VALENCE value
 * @param {string} [memoryConfig.label]
 * @param {Object} [memoryConfig.emotionSnapshot]
 * @param {Object} [memoryConfig.metadata]
 * @returns {Promise<Object>} memory reference snapshot
 */
export async function registerMemoryReference(profileId, memoryConfig) {
  const index = _requireIndex(profileId);

  const validation = _validateMemoryConfig(memoryConfig);
  if (!validation.valid) {
    throw new MemoryError(
      `[MemoryEngine] registerMemoryReference validation failed: ${validation.errors.join(' | ')}`
    );
  }

  const { id, category, valence, label, emotionSnapshot, metadata } = memoryConfig;

  if (index.references.has(id)) {
    MemoryLogger.warn(`[MemoryEngine] Memory "${id}" already registered for "${profileId}". Skipping.`);
    return _snapshotReference(index.references.get(id));
  }

  const ref = new MemoryReference({ id, profileId, category, valence, label, emotionSnapshot, metadata });

  index.references.set(id, ref);
  index.categoryIndex[category].add(id);
  index.valenceIndex[ref.valence].add(id);
  index.updatedAt = Date.now();

  MemoryLogger.info(
    `[MemoryEngine] Memory reference registered — id: ${id}, category: ${category}, valence: ${ref.valence}`
  );

  await emit(MEMORY_EVENTS.MEMORY_CREATED, {
    timestamp: Date.now(),
    memoryId:  id,
    profileId,
  });

  return _snapshotReference(ref);
}

// ----------------------------------------------------------------
// LINK MEMORY ASSOCIATION
// ----------------------------------------------------------------

/**
 * Link an existing memory to an association (emotion, bonding, routine, etc.)
 * @param {string} profileId
 * @param {string} memoryId
 * @param {Object} association
 * @param {string} association.type   — ASSOCIATION_TYPE value
 * @param {string} association.refId  — ID of the linked entity
 * @param {Object} [association.metadata]
 * @returns {Object} association record
 */
export function linkMemoryAssociation(profileId, memoryId, association) {
  const index = _requireIndex(profileId);

  if (!index.references.has(memoryId)) {
    throw new MemoryError(
      `[MemoryEngine] linkMemoryAssociation: memory "${memoryId}" not found for "${profileId}".`
    );
  }

  const validTypes = Object.values(ASSOCIATION_TYPE);
  if (!association?.type || !validTypes.includes(association.type)) {
    throw new MemoryError(
      `[MemoryEngine] linkMemoryAssociation: invalid type. Valid: ${validTypes.join(', ')}.`
    );
  }
  if (!association?.refId) {
    throw new MemoryError('[MemoryEngine] linkMemoryAssociation: refId required.');
  }

  const assocList = index.associations.get(memoryId) || [];
  const entry     = {
    type:      association.type,
    refId:     association.refId,
    metadata:  association.metadata || {},
    linkedAt:  Date.now(),
  };

  assocList.push(entry);
  index.associations.set(memoryId, assocList);
  index.updatedAt = Date.now();

  MemoryLogger.debug(
    `[MemoryEngine] Association linked — memoryId: ${memoryId}, type: ${association.type}, refId: ${association.refId}`
  );

  return { memoryId, ...entry };
}

// ----------------------------------------------------------------
// QUERY MEMORIES BY CATEGORY
// ----------------------------------------------------------------

/**
 * @param {string} profileId
 * @param {string} category — MEMORY_CATEGORY value
 * @returns {Object[]} array of memory reference snapshots
 */
export function queryByCategory(profileId, category) {
  const index = _requireIndex(profileId);

  if (!index.categoryIndex[category]) {
    return [];
  }

  return Array.from(index.categoryIndex[category])
    .map((id) => index.references.get(id))
    .filter(Boolean)
    .map(_snapshotReference);
}

// ----------------------------------------------------------------
// QUERY MEMORIES BY VALENCE
// ----------------------------------------------------------------

/**
 * @param {string} profileId
 * @param {string} valence — MEMORY_VALENCE value
 * @returns {Object[]}
 */
export function queryByValence(profileId, valence) {
  const index = _requireIndex(profileId);

  if (!index.valenceIndex[valence]) return [];

  return Array.from(index.valenceIndex[valence])
    .map((id) => index.references.get(id))
    .filter(Boolean)
    .map(_snapshotReference);
}

// ----------------------------------------------------------------
// ACCESS MEMORY REFERENCE (increments access count)
// ----------------------------------------------------------------

/**
 * @param {string} profileId
 * @param {string} memoryId
 * @returns {Object|null}
 */
export function accessMemoryReference(profileId, memoryId) {
  const index = _requireIndex(profileId);
  const ref   = index.references.get(memoryId);

  if (!ref) return null;

  ref.accessCount++;
  ref.lastAccessedAt = Date.now();

  return _snapshotReference(ref);
}

// ----------------------------------------------------------------
// GET MEMORY SNAPSHOT
// ----------------------------------------------------------------

/**
 * @param {string} profileId
 * @returns {Object}
 */
export function getMemorySnapshot(profileId) {
  const index = _requireIndex(profileId);

  const categoryCounts = {};
  for (const [cat, set] of Object.entries(index.categoryIndex)) {
    categoryCounts[cat] = set.size;
  }

  const valenceCounts = {};
  for (const [val, set] of Object.entries(index.valenceIndex)) {
    valenceCounts[val] = set.size;
  }

  return {
    profileId:        index.profileId,
    totalReferences:  index.references.size,
    totalAssociations: Array.from(index.associations.values()).reduce((s, a) => s + a.length, 0),
    categoryCounts,
    valenceCounts,
    updatedAt:        index.updatedAt,
  };
}

// ----------------------------------------------------------------
// RESTORE FROM PERSISTENCE
// ----------------------------------------------------------------

/**
 * Restore memory references from a persisted record array.
 * @param {string} profileId
 * @param {Object[]} persistedRefs
 * @returns {Object} snapshot
 */
export async function restoreMemoryState(profileId, persistedRefs) {
  if (!_indexes.has(profileId)) {
    initializeMemoryState(profileId);
  }

  const index = _indexes.get(profileId);
  let restored = 0;

  for (const ref of persistedRefs) {
    if (!ref?.id || !ref?.category) continue;

    const validation = _validateMemoryConfig(ref);
    if (!validation.valid) {
      MemoryLogger.warn(`[MemoryEngine] Skipping invalid persisted memory "${ref.id}".`);
      continue;
    }

    const record = new MemoryReference(ref);
    index.references.set(ref.id, record);
    index.categoryIndex[ref.category]?.add(ref.id);
    index.valenceIndex[ref.valence || MEMORY_VALENCE.NEUTRAL]?.add(ref.id);
    restored++;
  }

  index.updatedAt = Date.now();

  await emit(MEMORY_EVENTS.MEMORY_RESTORED, {
    timestamp: Date.now(),
    profileId,
    count:     restored,
  });

  MemoryLogger.info(`[MemoryEngine] Memory state restored — ${restored} references for "${profileId}".`);
  return getMemorySnapshot(profileId);
}

// ----------------------------------------------------------------
// ENGINE STATUS
// ----------------------------------------------------------------

export function getMemoryEngineStatus() {
  const status = {};
  for (const [pid, index] of _indexes) {
    status[pid] = { totalReferences: index.references.size };
  }
  return { totalProfiles: _indexes.size, profiles: status };
}

// ----------------------------------------------------------------
// INTERNAL: Snapshot a reference (no internal Map/Set exposure)
// ----------------------------------------------------------------

function _snapshotReference(ref) {
  return {
    id:              ref.id,
    profileId:       ref.profileId,
    category:        ref.category,
    valence:         ref.valence,
    label:           ref.label,
    weight:          ref.weight,
    accessCount:     ref.accessCount,
    createdAt:       ref.createdAt,
    lastAccessedAt:  ref.lastAccessedAt,
    hasEmotionSnap:  !!ref.emotionSnapshot,
    metadata:        { ...ref.metadata },
  };
}

// ----------------------------------------------------------------
// INTERNAL: Validate memory config
// ----------------------------------------------------------------

function _validateMemoryConfig(config) {
  const errors    = [];
  const validCats = Object.values(MEMORY_CATEGORY);
  const validVals = Object.values(MEMORY_VALENCE);

  if (!config?.id || typeof config.id !== 'string') {
    errors.push('Field "id" must be a non-empty string.');
  }
  if (!config?.category || !validCats.includes(config.category)) {
    errors.push(`Field "category" must be one of: ${validCats.join(', ')}.`);
  }
  if (config?.valence && !validVals.includes(config.valence)) {
    errors.push(`Field "valence" must be one of: ${validVals.join(', ')}.`);
  }

  return { valid: errors.length === 0, errors };
}

// ----------------------------------------------------------------
// INTERNAL: Require index or throw
// ----------------------------------------------------------------

function _requireIndex(profileId) {
  const index = _indexes.get(profileId);
  if (!index) {
    throw new MemoryError(
      `[MemoryEngine] Index for "${profileId}" not found. Call initializeMemoryState() first.`
    );
  }
  return index;
}

// ----------------------------------------------------------------
// MEMORY ERROR
// ----------------------------------------------------------------

export class MemoryError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name      = 'MemoryError';
    this.context   = context;
    this.timestamp = Date.now();
  }
}
