// ================================================================
// IMMORTAIL™ — CENTRALIZED DATA SCHEMA REGISTRY
// SSOT: All object store definitions, indexes, and versions here.
// NO LOOSE STRUCTURES. STRICT DEFINITIONS ONLY.
// ================================================================

// ----------------------------------------------------------------
// SCHEMA VERSION — increment when any schema changes
// ----------------------------------------------------------------
export const SCHEMA_VERSION = 1;

// ----------------------------------------------------------------
// STORE NAMES — centralized, no hardcoded strings elsewhere
// ----------------------------------------------------------------
export const STORE_NAMES = {
  RUNTIME:                 'runtime',
  SESSIONS:                'sessions',
  DOG_PROFILES:            'dogProfiles',
  MEMORIES:                'memories',
  EMOTIONS:                'emotions',
  ROUTINES:                'routines',
  CONVERSATIONS:           'conversations',
  MEDIA:                   'media',
  RECONSTRUCTION_PROFILES: 'reconstructionProfiles',
  SETTINGS:                'settings',
};

// ----------------------------------------------------------------
// SCHEMA DEFINITIONS
// Each schema defines: storeName, keyPath, autoIncrement,
// indexes, version, and a validationShape for payload checking.
// ----------------------------------------------------------------

export const SCHEMAS = {

  // ── RUNTIME ──────────────────────────────────────────────────
  [STORE_NAMES.RUNTIME]: {
    storeName:     STORE_NAMES.RUNTIME,
    keyPath:       'key',
    autoIncrement: false,
    version:       SCHEMA_VERSION,
    indexes: [
      { name: 'by_key',       keyPath: 'key',       unique: true },
      { name: 'by_updatedAt', keyPath: 'updatedAt', unique: false },
    ],
    validationShape: {
      required: ['key', 'value'],
      types: {
        key:       'string',
        value:     'any',
        updatedAt: 'number',
      },
    },
  },

  // ── SESSIONS ─────────────────────────────────────────────────
  [STORE_NAMES.SESSIONS]: {
    storeName:     STORE_NAMES.SESSIONS,
    keyPath:       'id',
    autoIncrement: false,
    version:       SCHEMA_VERSION,
    indexes: [
      { name: 'by_id',        keyPath: 'id',        unique: true  },
      { name: 'by_startedAt', keyPath: 'startedAt', unique: false },
      { name: 'by_status',    keyPath: 'status',    unique: false },
    ],
    validationShape: {
      required: ['id', 'startedAt', 'status'],
      types: {
        id:        'string',
        startedAt: 'number',
        endedAt:   'number',
        status:    'string',
        metadata:  'object',
      },
    },
  },

  // ── DOG PROFILES ─────────────────────────────────────────────
  [STORE_NAMES.DOG_PROFILES]: {
    storeName:     STORE_NAMES.DOG_PROFILES,
    keyPath:       'id',
    autoIncrement: false,
    version:       SCHEMA_VERSION,
    indexes: [
      { name: 'by_id',          keyPath: 'id',          unique: true  },
      { name: 'by_name',        keyPath: 'name',        unique: false },
      { name: 'by_createdAt',   keyPath: 'createdAt',   unique: false },
    ],
    validationShape: {
      required: ['id', 'name', 'createdAt'],
      types: {
        id:        'string',
        name:      'string',
        breed:     'string',
        createdAt: 'number',
        updatedAt: 'number',
        metadata:  'object',
      },
    },
  },

  // ── MEMORIES ─────────────────────────────────────────────────
  [STORE_NAMES.MEMORIES]: {
    storeName:     STORE_NAMES.MEMORIES,
    keyPath:       'id',
    autoIncrement: false,
    version:       SCHEMA_VERSION,
    indexes: [
      { name: 'by_id',         keyPath: 'id',         unique: true  },
      { name: 'by_profileId',  keyPath: 'profileId',  unique: false },
      { name: 'by_type',       keyPath: 'type',       unique: false },
      { name: 'by_createdAt',  keyPath: 'createdAt',  unique: false },
    ],
    validationShape: {
      required: ['id', 'profileId', 'type', 'content', 'createdAt'],
      types: {
        id:        'string',
        profileId: 'string',
        type:      'string',
        content:   'any',
        createdAt: 'number',
        updatedAt: 'number',
        tags:      'object',
      },
    },
  },

  // ── EMOTIONS ─────────────────────────────────────────────────
  [STORE_NAMES.EMOTIONS]: {
    storeName:     STORE_NAMES.EMOTIONS,
    keyPath:       'id',
    autoIncrement: false,
    version:       SCHEMA_VERSION,
    indexes: [
      { name: 'by_id',          keyPath: 'id',          unique: true  },
      { name: 'by_profileId',   keyPath: 'profileId',   unique: false },
      { name: 'by_type',        keyPath: 'type',        unique: false },
      { name: 'by_recordedAt',  keyPath: 'recordedAt',  unique: false },
    ],
    validationShape: {
      required: ['id', 'profileId', 'type', 'intensity', 'recordedAt'],
      types: {
        id:         'string',
        profileId:  'string',
        type:       'string',
        intensity:  'number',
        recordedAt: 'number',
        context:    'object',
      },
    },
  },

  // ── ROUTINES ─────────────────────────────────────────────────
  [STORE_NAMES.ROUTINES]: {
    storeName:     STORE_NAMES.ROUTINES,
    keyPath:       'id',
    autoIncrement: false,
    version:       SCHEMA_VERSION,
    indexes: [
      { name: 'by_id',         keyPath: 'id',         unique: true  },
      { name: 'by_profileId',  keyPath: 'profileId',  unique: false },
      { name: 'by_type',       keyPath: 'type',       unique: false },
      { name: 'by_active',     keyPath: 'active',     unique: false },
    ],
    validationShape: {
      required: ['id', 'profileId', 'type', 'active', 'createdAt'],
      types: {
        id:        'string',
        profileId: 'string',
        type:      'string',
        active:    'boolean',
        schedule:  'object',
        createdAt: 'number',
        updatedAt: 'number',
      },
    },
  },

  // ── CONVERSATIONS ─────────────────────────────────────────────
  [STORE_NAMES.CONVERSATIONS]: {
    storeName:     STORE_NAMES.CONVERSATIONS,
    keyPath:       'id',
    autoIncrement: false,
    version:       SCHEMA_VERSION,
    indexes: [
      { name: 'by_id',          keyPath: 'id',          unique: true  },
      { name: 'by_sessionId',   keyPath: 'sessionId',   unique: false },
      { name: 'by_profileId',   keyPath: 'profileId',   unique: false },
      { name: 'by_createdAt',   keyPath: 'createdAt',   unique: false },
    ],
    validationShape: {
      required: ['id', 'sessionId', 'profileId', 'messages', 'createdAt'],
      types: {
        id:        'string',
        sessionId: 'string',
        profileId: 'string',
        messages:  'object',
        createdAt: 'number',
        updatedAt: 'number',
      },
    },
  },

  // ── MEDIA ─────────────────────────────────────────────────────
  [STORE_NAMES.MEDIA]: {
    storeName:     STORE_NAMES.MEDIA,
    keyPath:       'id',
    autoIncrement: false,
    version:       SCHEMA_VERSION,
    indexes: [
      { name: 'by_id',         keyPath: 'id',         unique: true  },
      { name: 'by_profileId',  keyPath: 'profileId',  unique: false },
      { name: 'by_type',       keyPath: 'type',       unique: false },
      { name: 'by_uploadedAt', keyPath: 'uploadedAt', unique: false },
    ],
    validationShape: {
      required: ['id', 'profileId', 'type', 'uploadedAt'],
      types: {
        id:         'string',
        profileId:  'string',
        type:       'string',
        mimeType:   'string',
        size:       'number',
        uploadedAt: 'number',
        metadata:   'object',
      },
    },
  },

  // ── RECONSTRUCTION PROFILES ───────────────────────────────────
  [STORE_NAMES.RECONSTRUCTION_PROFILES]: {
    storeName:     STORE_NAMES.RECONSTRUCTION_PROFILES,
    keyPath:       'id',
    autoIncrement: false,
    version:       SCHEMA_VERSION,
    indexes: [
      { name: 'by_id',         keyPath: 'id',         unique: true  },
      { name: 'by_profileId',  keyPath: 'profileId',  unique: false },
      { name: 'by_status',     keyPath: 'status',     unique: false },
      { name: 'by_createdAt',  keyPath: 'createdAt',  unique: false },
    ],
    validationShape: {
      required: ['id', 'profileId', 'status', 'createdAt'],
      types: {
        id:        'string',
        profileId: 'string',
        status:    'string',
        config:    'object',
        createdAt: 'number',
        updatedAt: 'number',
      },
    },
  },

  // ── SETTINGS ──────────────────────────────────────────────────
  [STORE_NAMES.SETTINGS]: {
    storeName:     STORE_NAMES.SETTINGS,
    keyPath:       'key',
    autoIncrement: false,
    version:       SCHEMA_VERSION,
    indexes: [
      { name: 'by_key',       keyPath: 'key',       unique: true  },
      { name: 'by_updatedAt', keyPath: 'updatedAt', unique: false },
    ],
    validationShape: {
      required: ['key', 'value'],
      types: {
        key:       'string',
        value:     'any',
        updatedAt: 'number',
      },
    },
  },
};

// ----------------------------------------------------------------
// SCHEMA HELPERS
// ----------------------------------------------------------------

export function getSchema(storeName) {
  const schema = SCHEMAS[storeName];
  if (!schema) {
    throw new Error(`[SCHEMAS] Unknown store: "${storeName}". Not registered in SCHEMAS.`);
  }
  return schema;
}

export function getAllStoreNames() {
  return Object.values(STORE_NAMES);
}

export function getAllSchemas() {
  return { ...SCHEMAS };
}
