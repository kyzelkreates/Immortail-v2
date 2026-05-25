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
      enabled:             true,
      baseUrl:             'http://localhost:11434',
      model:               'llama3',
      status:              'active',
      role:                'primary_persistent_brain',
      multimodalEnabled:   true,
      persistencePriority: true,
      offlineCritical:     true,
    },
    groq: {
      enabled:              false,
      apiKey:               '',
      model:                'meta-llama/llama-4-scout-17b-16e-instruct',
      visionModel:          'meta-llama/llama-4-scout-17b-16e-instruct',
      status:               'inactive',
      role:                 'multimodal_acceleration_layer',
      orchestrationEnabled: true,
      multimodalSupport:    true,
      fallbackToOllama:     true,
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
  // Run 13: real-time presence engine
  presenceEngine: {
    activePresenceState: 'ambient_idle',   // ambient_idle | attentive | repositioning | resting | sleeping | interacting
    currentSpatialZone:  'resting_area',   // resting_area | play_area | feeding_area | window_area | comfort_area | observation_area
    activeAttentionTarget: null,           // object id or null
    currentMicroBehaviour: null,           // ear_twitch | slow_blink | head_tilt | posture_shift | tail_sway | stretch | settle | breathe
    presenceIntensity: 'calm',             // calm | soft | active | sleepy
    realTimeState:     'stable',           // stable | transitioning | recovering
    lastMicroBehaviourAt: null,
    lastZoneTransitionAt: null,
    presenceVersion: 'V1',
  },
  // Run 13: spatial state — smooth deterministic positioning
  spatialState: {
    currentPosition:     { x: 0.5, y: 0.0, z: 0.5 },  // normalised 0-1
    currentOrientation:  { yaw: 0 },                    // degrees
    movementTarget:      null,                           // { x, y, z } or null
    activePath:          [],                             // waypoints
    currentLocomotionState: 'idle',                      // idle | walking | turning | settling
    lastMovedAt:         null,
    positionVersion:     'V1',
  },
  // Run 13: behaviour scheduler — prevents spam + rapid switching
  behaviourScheduler: {
    activeBehaviour:   null,
    cooldowns:         {},           // behaviourId → expiry timestamp
    transitionQueue:   [],           // pending behaviour transitions (capped 5)
    behaviourPriority: {
      reunion:         100,
      interacting:     90,
      attentive:       70,
      playful:         60,
      curious:         50,
      repositioning:   40,
      ambient_idle:    30,
      resting:         20,
      sleeping:        10,
    },
    schedulerState:    'stable',     // stable | processing | cooldown
    lastSchedulerTick: null,
    schedulerVersion:  'V1',
  },
  // Run 13: ambient audio state
  ambientAudio: {
    activeSound:         null,       // breathing | paw_steps | collar | settle | resting | room_ambience
    soundIntensity:      'low',      // low | medium
    lastSoundAt:         null,
    soundCooldownUntil:  null,
    audioVersion:        'V1',
  },
  // Run 13: AR/voice future preparation stubs
  futureExpansion: {
    arEnabled:           false,
    arPlacementReady:    false,
    voiceInteractionReady: false,
    roomMappingReady:    false,
    webcamAwarenessReady: false,
    spatialAudioExpanded: false,
    expansionVersion:    'V1',
  },

  // ── Run 14: voice presence engine ─────────────────────────────
  voicePresence: {
    voiceEnabled:        true,
    listeningState:      'inactive',
    speakingState:       'idle',
    activeVoiceProfile:  'warm_calm',
    speechEmotionState:  'neutral',
    interruptionState:   'stable',
    ambientVoiceMode:    'soft',
    ttsProvider:         'piper',
    sttProvider:         'whisper',
    streamingEnabled:    true,
    offlineFallback:     true,
    lastSpeechAt:        null,
    lastListenAt:        null,
    ambientSoundHistory: [],
    voiceMemoryCount:    0,
    voiceVersion:        'V1',
  },

  // ── Run 15: memory reflection engine ───────────────────────────
  memoryReflection: {
    activeRecallMode:         false,
    reflectionState:          'idle',
    emotionalRecallIntensity: 'medium',
    lastReflectedMemory:      null,
    reflectionQueue:          [],
    memoryFocusMode:          'balanced',
    memoryCategories: {
      milestones:           [],
      emotionalMoments:     [],
      routineInteractions:  [],
      mediaLinkedEvents:    [],
      bondingEvents:        [],
      environmentalEvents:  [],
    },
    anniversaryLog:           [],
    relationshipPhase:        'stranger',
    attachmentTrend:          'stable',
    emotionalContinuityState: 'grounded',
    lastMeaningfulMemory:     null,
    lastAnniversaryCheckAt:   null,
    reflectionVersion:        'V1',
  },

  // ── Run 16: world engine ─────────────────────────────────────────
  worldEngine: {
    activeEnvironment:    'living_room',
    previousEnvironment:  null,
    transitionState:      'stable',
    environmentMood:      'neutral',
    timeOfDay:            'afternoon',
    lightingState: {
      lightingIntensity: 0.75,
      warmthLevel:       0.60,
      shadowDepth:       0.30,
      preset:            'warm_neutral',
      timeOfDay:         'afternoon',
      computed:          true,
      random:            false,
    },
    worldObjects: {
      toys:              [],
      foodBowl:          { id:'food_bowl',  label:'Food Bowl',  position:'kitchen_corner', state:'empty',    stable:true },
      waterBowl:         { id:'water_bowl', label:'Water Bowl', position:'kitchen_corner', state:'full',     stable:true },
      bed:               { id:'bed',        label:'Dog Bed',    position:'bedroom_floor',  state:'available',stable:true },
      blanket:           { id:'blanket',    label:'Blanket',    position:'sofa_area',       state:'available',stable:true },
      windowZone:        { id:'window',     label:'Window',     position:'living_room_wall',state:'open',    stable:true },
      interactionPoints: [],
    },
    transitionEngine: {
      activeTransition:   false,
      fromEnvironment:    null,
      toEnvironment:      null,
      transitionProgress: 0.0,
      startedAt:          null,
    },
    environmentMemoryMap: [],
    transitionLog:        [],
    worldVersion:         'V1',
  },
  // Run 12: hybrid AI orchestration
  aiOrchestration: {
    activeProviders:      [],
    activeAgents:         [],
    routingEngine:        {},
    mediaProcessingQueue: [],
    embodimentPipeline:   {},
    orchestrationState:   'stable',
    orchestrationVersion: 'V1',
    providerStatus: {
      ollama: 'unknown',
      groq:   'unknown',
    },
    lastFallbackAt: null,
    fallbackLog:    [],
    validationLog:  [],
    agentRegistry:  {},
  },
  // Run 12: persistent embodiment profile
  embodimentProfile: {
    appearanceTraits:          {},
    motionTraits:              {},
    emotionalMovementTraits:   {},
    postureTraits:             {},
    favouriteBehaviours:       {},
    environmentPreferences:    {},
    audioProfile:              {},
    embodimentConsistencyHash: '',
    traitVersion:              0,
    lastUpdated:               null,
    profileVersion:            'V1',
  },
  // Run 12: media library
  mediaLibrary: [],
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
      // Run 13: real-time presence engine
      presenceEngine:     deepMerge(DEFAULT_COMPANION_CORE.presenceEngine,     persisted.presenceEngine     ?? {}),
      spatialState:       deepMerge(DEFAULT_COMPANION_CORE.spatialState,       persisted.spatialState       ?? {}),
      behaviourScheduler: deepMerge(DEFAULT_COMPANION_CORE.behaviourScheduler, persisted.behaviourScheduler ?? {}),
      ambientAudio:       deepMerge(DEFAULT_COMPANION_CORE.ambientAudio,       persisted.ambientAudio       ?? {}),
      futureExpansion:    deepMerge(DEFAULT_COMPANION_CORE.futureExpansion,    persisted.futureExpansion    ?? {}),
      // Run 12: AI orchestration + embodiment profile + media library
      aiOrchestration:   deepMerge(DEFAULT_COMPANION_CORE.aiOrchestration,   persisted.aiOrchestration   ?? {}),
      embodimentProfile: deepMerge(DEFAULT_COMPANION_CORE.embodimentProfile, persisted.embodimentProfile ?? {}),
      mediaLibrary:      persisted.mediaLibrary ?? [],
      // Run 11: environment system
      environmentSystem: deepMerge(DEFAULT_COMPANION_CORE.environmentSystem, persisted.environmentSystem ?? {}),
      // Run 11: needs state
      needsState:        deepMerge(DEFAULT_COMPANION_CORE.needsState,        persisted.needsState        ?? {}),
      // Run 11: animation system
      animationSystem:   deepMerge(DEFAULT_COMPANION_CORE.animationSystem,   persisted.animationSystem   ?? {}),
      // Run 10: persistence hardening layer
      persistenceLayer: deepMerge(DEFAULT_COMPANION_CORE.persistenceLayer, persisted.persistenceLayer ?? {}),
      // Run 14: voice presence engine
      voicePresence:     deepMerge(DEFAULT_COMPANION_CORE.voicePresence,     persisted.voicePresence     ?? {}),
      // Run 15: memory reflection engine
      memoryReflection:  deepMerge(DEFAULT_COMPANION_CORE.memoryReflection,  persisted.memoryReflection  ?? {}),
      // Run 16: world engine
      worldEngine:       deepMerge(DEFAULT_COMPANION_CORE.worldEngine,       persisted.worldEngine       ?? {}),
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
