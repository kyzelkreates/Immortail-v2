// ================================================================
// IMMORTAIL™ — STORAGE SERVICE (SSOT)
// Single source of truth for ALL persistence.
// All reads/writes route through this module only.
// IndexedDB upgrade path preserved — localStorage for MVP.
// ================================================================

const PREFIX = 'immortail_';

export const KEYS = {
  DOG:            PREFIX + 'dog',
  MEMORIES:       PREFIX + 'memories',
  SETTINGS:       PREFIX + 'settings',
  SESSION:        PREFIX + 'session',
  CONFIG:         PREFIX + 'config',
  MEDIA:          PREFIX + 'media',
  COMPANION_CORE: PREFIX + 'companion_core',   // Run 3: unified entity state
};

// ── Default system config ─────────────────────────────────────────

export const DEFAULT_CONFIG = {
  features: {
    mediaInput:  true,
    audioInput:  true,
    videoInput:  true,
    imageInput:  true,
    ollama:      true,
  },
  providers: {
    openai: {
      enabled:  false,
      apiKey:   '',
      model:    'gpt-4o',
      status:   'inactive',
    },
    ollama: {
      enabled:  true,
      baseUrl:  'http://localhost:11434',
      model:    'llama3',
      status:   'active',
    },
  },
  routes: {
    home:      '/',
    memory:    '/memory',
    settings:  '/settings',
    media:     '/media',
  },
  appConfig: {
    homeUrl:   '/',
    version:   '1.0.0',
    buildDate: new Date().toISOString().split('T')[0],
  },
};

// ── Default companionCore (Run 3 — SSOT unified entity) ───────────

export const DEFAULT_COMPANION_CORE = {
  // Run 4: identity lock — written once, never overwritten
  identityLock: {
    signature:    'IMMORTAIL_DOG_CORE_V1',
    lockedAt:     null,           // timestamp of first lock
    immutable:    true,
    lockedTraits: {
      personality:   'stable_companion',
      tone:          'calm_emotional_support',
      responseStyle: 'consistent_entity_voice',
    },
  },
  identity: {
    name:      'Immortail Dog',
    mood:      'neutral',
    energy:    50,
    trust:     0,
    createdAt: null,
  },
  // Run 4: rolling window for smoothing (last 5 states)
  emotionHistory: [],
  memory:         [],
  mediaMemory:    [],
  behaviourState: {
    current:      'idle',
    previous:     null,
    updatedAt:    null,
    waitingSince: null,
    // Run 4: smoothed averages
    smoothedMood:   'neutral',
    smoothedEnergy: 50,
  },
  emotionalState: {
    dominant:  'neutral',
    valence:   0,
    arousal:   50,
    updatedAt: null,
  },
  // Run 5: attachment graph — persists across all sessions
  attachmentGraph: {
    userBond:            0,    // 0-100: accumulated bonding score
    familiarity:         0,    // 0-100: media + presence score
    emotionalResonance:  0,    // 0-100: emotional event score
    interactionCount:    0,    // total lifetime interaction count
    lastSeen:            null, // timestamp of last session
    bondStage:           'distant', // distant|familiar|trusted|bonded|deeply_bonded
  },
  // Run 6: evolution layer — safe preference + pattern learning
  evolutionLayer: {
    learnedPreferences:           {},   // keyed preference signals
    recurringPatterns:            {},   // detected behavioural patterns
    favouriteActivities:          [],   // top-N activity types by frequency
    communicationStyleAdaptation: {},   // chat style signals
    growthLevel:                  0,    // 0-100 gradual growth
    evolutionHistory:             [],   // adaptation event log (capped 200)
  },
  // Run 7: embodiment layer — 3D presence persistence
  embodiment: {
    visualProfile:        {},    // safe derived appearance descriptors
    animationState:       'idle',// current animation state label
    postureState:         'neutral', // sitting|standing|lying|neutral
    environmentAwareness: {
      currentScene:     'home',
      lightingMode:     'soft',
      interactionZone:  'center',
    },
    movementStyle:        {},    // movement tendency descriptors
    appearanceMemory:     [],    // derived visual trait log (capped 50)
    soundReactions:       [],    // sound event reaction log (capped 30)
    idleBehaviourState:   'breathing', // breathing|head_turn|tail_wag|stretch
    embodimentVersion:    'V1',
  },
  // Run 8: life simulation — daily cycle, passive behaviours, ambient mood
  lifeSimulation: {
    currentRoutine:              'idle',   // idle|morning|active|relaxed|sleepy|sleeping
    dailyCycleState:             'awake',  // awake|morning|active|relaxed|sleepy|sleeping
    passiveActivities:           [],       // capped-20 log of passive behaviour events
    routineHistory:              [],       // capped-100 log of autonomous state entries
    autonomousState:             {
      mode:           'passive',           // passive|observing|resting|sleeping|excited
      enteredAt:      null,               // timestamp of last mode entry
      cooldownUntil:  null,               // no transition allowed before this ts
    },
    sleepState: {
      isSleeping:     false,
      enteredSleepAt: null,
      sleepDuration:  0,                  // ms
    },
    ambientMood:                 'calm',  // calm|playful|sleepy|curious|relaxed|attentive
    lastAutonomousTransition:    null,    // timestamp
  },
  // Run 9: life story — long-term memory + narrative continuity
  lifeStory: {
    milestones:            [],
    memoryChapters:        [],
    compressedMemoryIndex: [],
    importantEvents:       [],
    relationshipTimeline:  [],
    longTermSummary:       {
      totalInteractions:    0,
      strongestBondPeriods: [],
      favouriteActivities:  [],
      emotionalPatterns:    {},
      importantMemories:    [],
    },
    lifeStoryVersion:      'V1',
  },
  // Run 11: environment system
  environmentSystem: {
    activeScene:         'living_room',
    lightingMode:        'warm_soft',
    interactionZones:    [],        // spatial zones companion can enter
    environmentObjects:  [],        // object registry (deterministic, no duplicates)
    ambientState:        'calm',    // calm|active|quiet|evening|night
    environmentVersion:  'V1',
    objectInteractionLog:[],        // capped 50 — recent object interactions
    lastObjectInteraction: null,    // { objectId, action, ts }
  },
  // Run 11: needs state — slow deterministic change, clamped [0–100]
  needsState: {
    hunger:  25,
    thirst:  20,
    boredom: 30,
    comfort: 80,
    energy:  70,
    lastUpdated: null,
    needsVersion: 'V1',
  },
  // Run 11: advanced animation system
  animationSystem: {
    primaryLayer:       'idle',     // locomotion|idle|interaction|resting|sleeping|reunion
    emotionalPosture:   'relaxed',  // relaxed|alert|curious|playful|sleepy|bonded
    headTracking:       'forward',  // forward|toward_user|toward_object|scanning
    tailMovement:       'slow_sway',// still|slow_sway|wag|excited_wag
    interactionLayer:   null,       // current object interaction label or null
    idleBreathing:      true,
    blendCooldown:      0,          // ms remaining in transition cooldown
    lastTransitionAt:   null,       // timestamp of last state change
    transitionLog:      [],         // capped 20 — recent transitions
    gazeTarget:         null,       // null|'user'|object_id
    gazeCooldown:       0,          // ms until gaze can shift again
    proceduralState: {
      breathPhase:      0,          // 0-1 breathing cycle position
      blinkCooldown:    0,          // ms until next blink
      earTwitchCooldown:0,          // ms until next ear twitch
      postureShiftCooldown: 0,      // ms until next subtle posture shift
      tailSwayPhase:    0,          // 0-1 tail sway position
    },
    animSystemVersion:  'V1',
  },
  // Run 10: persistence hardening layer
  persistenceLayer: {
    schemaVersion:       'V1',
    lastValidSnapshot:   null,    // serialised snapshot object
    recoveryCheckpoints: [],      // capped 5 — rolling checkpoint log
    corruptionFlags:     [],      // detected corruption events
    exportHistory:       [],      // capped 20 — export audit trail
    importHistory:       [],      // capped 20 — import audit trail
    recoveryLogs:        [],      // capped 50 — all recovery operations
    persistenceHealth:   'stable',// stable|warning|degraded|recovery
    writeQueue:          [],      // queued writes for offline retry
    lastHealthCheck:     null,    // timestamp of last health check
    safeMode:            false,   // failsafe safe-mode flag
  },
  lastInteraction: null,
};

// ── Serialisation ─────────────────────────────────────────────────

function write(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ v: 1, t: Date.now(), d: data }));
    return true;
  } catch {
    return false;
  }
}

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.d ?? null;
  } catch {
    return null;
  }
}

function remove(key) {
  try { localStorage.removeItem(key); return true; }
  catch { return false; }
}

// ── Deep merge utility ────────────────────────────────────────────

export function deepMerge(base, override) {
  const result = { ...base };
  for (const key of Object.keys(override ?? {})) {
    if (
      override[key] !== null &&
      typeof override[key] === 'object' &&
      !Array.isArray(override[key]) &&
      typeof base[key] === 'object' &&
      base[key] !== null
    ) {
      result[key] = deepMerge(base[key], override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

// ── ID generator ──────────────────────────────────────────────────

function genId() {
  return Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

// ── Public API ────────────────────────────────────────────────────

export const storage = {

  // ── Dog profile (Run 1–2 compat) ────────────────────────────────
  getDog:     ()     => read(KEYS.DOG),
  saveDog:    (data) => write(KEYS.DOG, data),

  // ── Legacy Memories (Run 1–2 compat — capped at 200) ────────────
  getMemories:  ()    => read(KEYS.MEMORIES) ?? [],
  saveMemories: (arr) => write(KEYS.MEMORIES, arr.slice(-200)),
  addMemory: (entry) => {
    const list = storage.getMemories();
    list.push({ ...entry, id: genId() });
    return storage.saveMemories(list);
  },

  // ── Settings ────────────────────────────────────────────────────
  getSettings:  ()     => read(KEYS.SETTINGS) ?? {},
  saveSettings: (data) => write(KEYS.SETTINGS, data),

  // ── System config (features + providers + routes) ────────────────
  getConfig: () => {
    const persisted = read(KEYS.CONFIG);
    return deepMerge(DEFAULT_CONFIG, persisted ?? {});
  },
  saveConfig: (data) => {
    const merged = deepMerge(storage.getConfig(), data);
    return write(KEYS.CONFIG, merged);
  },
  patchConfig: (path, value) => {
    const config = storage.getConfig();
    const parts  = path.split('.');
    let obj = config;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof obj[parts[i]] !== 'object') obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    return write(KEYS.CONFIG, config);
  },

  // ── Media registry (Run 2 compat) ───────────────────────────────
  getMedia:  ()    => read(KEYS.MEDIA) ?? [],
  saveMedia: (arr) => write(KEYS.MEDIA, arr),
  addMedia: (entry) => {
    const list = storage.getMedia();
    list.push({ ...entry, id: genId(), createdAt: Date.now() });
    return write(KEYS.MEDIA, list.slice(-100));
  },
  removeMedia: (id) => {
    return storage.saveMedia(storage.getMedia().filter(m => m.id !== id));
  },

  // ── Session ─────────────────────────────────────────────────────
  getSession:  ()     => read(KEYS.SESSION) ?? {},
  saveSession: (data) => write(KEYS.SESSION, data),

  // ══════════════════════════════════════════════════════════════════
  // ── COMPANION CORE (Run 3 + Run 4 extensions) ─────────────────────
  // Single unified entity. ALL companion state lives here.
  // ══════════════════════════════════════════════════════════════════

  /**
   * getCompanionCore()
   * Deep-merges persisted state onto defaults.
   * identityLock is NEVER overwritten — once locked it is read-only.
   */
  getCompanionCore: () => {
    const persisted = read(KEYS.COMPANION_CORE);
    if (!persisted) {
      const initial = deepMerge(DEFAULT_COMPANION_CORE, {
        identity:     { createdAt: Date.now() },
        identityLock: { lockedAt:  Date.now() },
      });
      write(KEYS.COMPANION_CORE, initial);
      return initial;
    }
    return {
      // Run 4: identityLock always merged from default (so it exists)
      // but lockedAt + lockedTraits are preserved from persisted (never reset)
      identityLock:   persisted.identityLock
                        ?? deepMerge(DEFAULT_COMPANION_CORE.identityLock, { lockedAt: Date.now() }),
      identity:       deepMerge(DEFAULT_COMPANION_CORE.identity,       persisted.identity       ?? {}),
      emotionHistory: persisted.emotionHistory ?? [],
      memory:         persisted.memory         ?? [],
      mediaMemory:    persisted.mediaMemory     ?? [],
      behaviourState:  deepMerge(DEFAULT_COMPANION_CORE.behaviourState,  persisted.behaviourState  ?? {}),
      emotionalState:  deepMerge(DEFAULT_COMPANION_CORE.emotionalState,  persisted.emotionalState  ?? {}),
      // Run 5: attachment graph — deepMerge preserves all accumulated values
      attachmentGraph: deepMerge(DEFAULT_COMPANION_CORE.attachmentGraph, persisted.attachmentGraph ?? {}),
      // Run 6: evolution layer — deepMerge so all nested keys survive upgrades
      evolutionLayer:  deepMerge(DEFAULT_COMPANION_CORE.evolutionLayer,  persisted.evolutionLayer  ?? {}),
      // Run 7: embodiment — deepMerge preserves all visual state
      embodiment:      deepMerge(DEFAULT_COMPANION_CORE.embodiment,      persisted.embodiment      ?? {}),
      // Run 8: life simulation — deepMerge preserves all routine/mood state
      lifeSimulation:  deepMerge(DEFAULT_COMPANION_CORE.lifeSimulation,  persisted.lifeSimulation  ?? {}),
      // Run 9: life story — deepMerge preserves all narrative state
      lifeStory:        deepMerge(DEFAULT_COMPANION_CORE.lifeStory,        persisted.lifeStory        ?? {}),
      // Run 11: environment system
      environmentSystem: deepMerge(DEFAULT_COMPANION_CORE.environmentSystem, persisted.environmentSystem ?? {}),
      // Run 11: needs state
      needsState:        deepMerge(DEFAULT_COMPANION_CORE.needsState,        persisted.needsState        ?? {}),
      // Run 11: animation system
      animationSystem:   deepMerge(DEFAULT_COMPANION_CORE.animationSystem,   persisted.animationSystem   ?? {}),
      // Run 10: persistence hardening layer
      persistenceLayer: deepMerge(DEFAULT_COMPANION_CORE.persistenceLayer, persisted.persistenceLayer ?? {}),
      lastInteraction:  persisted.lastInteraction ?? null,
    };
  },

  /**
   * saveCompanionCore(core)
   * Full save. ENFORCES identityLock immutability before write.
   */
  saveCompanionCore: (core) => {
    // Run 4 HARD RULE: identityLock.lockedTraits + signature can never be
    // changed. Re-inject from defaults before every write.
    const persisted = read(KEYS.COMPANION_CORE);
    const safeLock  = persisted?.identityLock
      ?? deepMerge(DEFAULT_COMPANION_CORE.identityLock, { lockedAt: Date.now() });

    const safeCore = {
      ...core,
      identityLock: {
        ...safeLock,
        // These three fields are permanently immutable
        signature:    DEFAULT_COMPANION_CORE.identityLock.signature,
        immutable:    true,
        lockedTraits: DEFAULT_COMPANION_CORE.identityLock.lockedTraits,
      },
    };
    return write(KEYS.COMPANION_CORE, safeCore);
  },

  /**
   * patchCompanionCore(patch)
   * Shallow-merges a patch. identityLock is always protected.
   */
  patchCompanionCore: (patch) => {
    const current = storage.getCompanionCore();
    const updated = { ...current, ...patch };
    return storage.saveCompanionCore(updated);  // routes through lock guard
  },

  /**
   * patchCoreSection(section, patch)
   * Deep-merges a patch into a named section.
   * 'identityLock' section is rejected silently.
   */
  patchCoreSection: (section, patch) => {
    if (section === 'identityLock') {
      console.warn('[IMMORTAIL] identityLock is immutable — patch rejected.');
      return false;
    }
    const core = storage.getCompanionCore();
    core[section] = deepMerge(core[section] ?? {}, patch);
    return storage.saveCompanionCore(core);   // routes through lock guard
  },

  /**
   * addCoreMemory(event)
   * Validates event before appending to companionCore.memory.
   * Invalid events are rejected without crashing.
   * Also pushes to mediaMemory for media types.
   */
  addCoreMemory: (event) => {
    // ── Run 4: Memory Integrity Validation ─────────────────────
    const validation = storage.memoryIntegrityCheck(event);
    if (!validation.valid) {
      console.warn('[IMMORTAIL] Memory rejected:', validation.reason, event);
      return false;
    }

    const core = storage.getCompanionCore();

    const entry = {
      ...event,
      id:          event.id ?? genId(),
      ts:          event.ts ?? Date.now(),
      memoryWeight: event.memoryWeight ?? 1,   // Run 5: emotional weight 1-10
    };

    // Duplicate ID guard
    if (core.memory.some(m => m.id === entry.id)) {
      console.warn('[IMMORTAIL] Memory rejected: duplicate id', entry.id);
      return false;
    }

    core.memory = [...core.memory, entry].slice(-500);

    if (['image', 'audio', 'video'].includes(event.type)) {
      core.mediaMemory = [...core.mediaMemory, entry].slice(-100);
    }

    core.lastInteraction = entry.ts;

    return storage.saveCompanionCore(core);
  },

  /**
   * memoryIntegrityCheck(event)
   * Run 4: Validates a memory event before it is stored.
   * Returns { valid: boolean, reason?: string }
   */
  memoryIntegrityCheck: (event) => {
    if (!event || typeof event !== 'object') {
      return { valid: false, reason: 'event is null or not an object' };
    }
    if (!event.ts || typeof event.ts !== 'number') {
      return { valid: false, reason: 'missing or invalid timestamp' };
    }
    if (!event.type || typeof event.type !== 'string') {
      return { valid: false, reason: 'missing or invalid event type' };
    }
    const VALID_TYPES = [
      'chat','pet','play','talk','rest',
      'image','audio','video',
      'emotion','milestone','system','interaction',
      'reunion_event',   // Run 5: absence-return event
    ];
    if (!VALID_TYPES.includes(event.type)) {
      return { valid: false, reason: `unknown event type: "${event.type}"` };
    }
    // companionCore exists check
    const core = read(KEYS.COMPANION_CORE);
    if (!core) {
      return { valid: false, reason: 'companionCore not initialised' };
    }
    return { valid: true };
  },

  // ── Full reset (preserves identityLock.lockedAt from first boot) ─
  clear: () => {
    Object.values(KEYS).forEach(k => remove(k));
  },

  isAvailable: () => {
    try {
      localStorage.setItem('__immortail_test__', '1');
      localStorage.removeItem('__immortail_test__');
      return true;
    } catch {
      return false;
    }
  },
};

export default storage;
