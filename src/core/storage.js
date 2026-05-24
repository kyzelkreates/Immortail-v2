// ================================================================
// IMMORTAIL™ — STORAGE SERVICE (SSOT)
// Single source of truth for ALL persistence.
// All reads/writes route through this module only.
// IndexedDB upgrade path preserved — localStorage for MVP.
// ================================================================

const PREFIX = 'immortail_';

export const KEYS = {
  DOG:           PREFIX + 'dog',
  MEMORIES:      PREFIX + 'memories',
  SETTINGS:      PREFIX + 'settings',
  SESSION:       PREFIX + 'session',
  CONFIG:        PREFIX + 'config',
  MEDIA:         PREFIX + 'media',
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
  identity: {
    name:     'Immortail Dog',
    mood:     'neutral',
    energy:   50,
    trust:    0,
    createdAt: null,   // set on first boot
  },
  memory:         [],        // all timeline events (chat + media + emotional)
  mediaMemory:    [],        // media-specific subset (images, audio, video)
  behaviourState: {
    current:        'idle',
    previous:       null,
    updatedAt:      null,
    waitingSince:   null,    // set when idle > threshold
  },
  emotionalState: {
    dominant:   'neutral',
    valence:    0,           // -100 (negative) → +100 (positive)
    arousal:    50,          // 0 (calm) → 100 (excited)
    updatedAt:  null,
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
  // ── COMPANION CORE (Run 3) ────────────────────────────────────────
  // Single unified entity. ALL companion state lives here.
  // Arrays use .slice(-500) cap. No external writes allowed.
  // ══════════════════════════════════════════════════════════════════

  /**
   * getCompanionCore()
   * Deep-merges persisted state onto defaults.
   * Arrays from storage take precedence (not overwritten by defaults).
   */
  getCompanionCore: () => {
    const persisted = read(KEYS.COMPANION_CORE);
    if (!persisted) {
      // First boot — initialise with timestamp
      const initial = deepMerge(DEFAULT_COMPANION_CORE, {
        identity: { createdAt: Date.now() },
      });
      write(KEYS.COMPANION_CORE, initial);
      return initial;
    }
    // Merge: preserve persisted arrays, merge scalar defaults
    return {
      identity:       deepMerge(DEFAULT_COMPANION_CORE.identity, persisted.identity ?? {}),
      memory:         persisted.memory         ?? [],
      mediaMemory:    persisted.mediaMemory     ?? [],
      behaviourState: deepMerge(DEFAULT_COMPANION_CORE.behaviourState, persisted.behaviourState ?? {}),
      emotionalState: deepMerge(DEFAULT_COMPANION_CORE.emotionalState, persisted.emotionalState ?? {}),
      lastInteraction: persisted.lastInteraction ?? null,
    };
  },

  /**
   * saveCompanionCore(core)
   * Full save. Called only by companionCoreService.
   */
  saveCompanionCore: (core) => write(KEYS.COMPANION_CORE, core),

  /**
   * patchCompanionCore(patch)
   * Shallow-merges a patch object onto the current core.
   * For identity/behaviourState/emotionalState patches use patchCoreSection.
   */
  patchCompanionCore: (patch) => {
    const current = storage.getCompanionCore();
    const updated = { ...current, ...patch };
    return write(KEYS.COMPANION_CORE, updated);
  },

  /**
   * patchCoreSection(section, patch)
   * Deep-merges a patch into a named section of the core.
   * section: 'identity' | 'behaviourState' | 'emotionalState'
   */
  patchCoreSection: (section, patch) => {
    const core = storage.getCompanionCore();
    core[section] = deepMerge(core[section] ?? {}, patch);
    return write(KEYS.COMPANION_CORE, core);
  },

  /**
   * addCoreMemory(event)
   * Appends to companionCore.memory timeline. Max 500 entries.
   * If event is media-type, also pushes to mediaMemory. Max 100.
   */
  addCoreMemory: (event) => {
    const core = storage.getCompanionCore();
    const entry = {
      ...event,
      id:  genId(),
      ts:  event.ts ?? Date.now(),
    };

    core.memory = [...core.memory, entry].slice(-500);

    if (['image', 'audio', 'video'].includes(event.type)) {
      core.mediaMemory = [...core.mediaMemory, entry].slice(-100);
    }

    // Update lastInteraction
    core.lastInteraction = entry.ts;

    return write(KEYS.COMPANION_CORE, core);
  },

  // ── Full reset ───────────────────────────────────────────────────
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
