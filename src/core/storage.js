// ================================================================
// IMMORTAIL™ — STORAGE SERVICE (SSOT)
// Single source of truth for ALL persistence.
// All reads/writes route through this module only.
// IndexedDB upgrade path preserved — localStorage for MVP.
// ================================================================

const PREFIX = 'immortail_';

export const KEYS = {
  DOG:      PREFIX + 'dog',
  MEMORIES: PREFIX + 'memories',
  SETTINGS: PREFIX + 'settings',
  SESSION:  PREFIX + 'session',
  CONFIG:   PREFIX + 'config',
  MEDIA:    PREFIX + 'media',
};

// ── Default system config (SSOT for all flags + providers + routes) ──

export const DEFAULT_CONFIG = {
  // Feature flags
  features: {
    mediaInput:  true,
    audioInput:  true,
    videoInput:  true,
    imageInput:  true,
    ollama:      true,
  },

  // AI provider registry
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

  // Routing
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

function deepMerge(base, override) {
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

// ── Public API ────────────────────────────────────────────────────

export const storage = {

  // ── Dog profile ─────────────────────────────────────────────────
  getDog:     ()     => read(KEYS.DOG),
  saveDog:    (data) => write(KEYS.DOG, data),

  // ── Memories (array, capped at 200) ─────────────────────────────
  getMemories:  ()    => read(KEYS.MEMORIES) ?? [],
  saveMemories: (arr) => write(KEYS.MEMORIES, arr.slice(-200)),
  addMemory: (entry) => {
    const list = storage.getMemories();
    list.push({
      ...entry,
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    });
    return storage.saveMemories(list);
  },

  // ── Settings (raw companion prefs) ──────────────────────────────
  getSettings:  ()     => read(KEYS.SETTINGS) ?? {},
  saveSettings: (data) => write(KEYS.SETTINGS, data),

  // ── System config (features + providers + routes) ────────────────
  // Always deep-merges persisted overrides onto DEFAULT_CONFIG.
  // Guarantees all default keys exist even after a partial save.
  getConfig: () => {
    const persisted = read(KEYS.CONFIG);
    return deepMerge(DEFAULT_CONFIG, persisted ?? {});
  },
  saveConfig: (data) => {
    // Merge incoming patch onto current config before saving
    const current = storage.getConfig();
    const merged  = deepMerge(current, data);
    return write(KEYS.CONFIG, merged);
  },
  // Granular config patch helper
  patchConfig: (path, value) => {
    // path: 'features.ollama' → sets config.features.ollama = value
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

  // ── Media registry (captured/uploaded media references) ─────────
  getMedia:  ()    => read(KEYS.MEDIA) ?? [],
  saveMedia: (arr) => write(KEYS.MEDIA, arr),
  addMedia: (entry) => {
    const list = storage.getMedia();
    list.push({
      ...entry,
      id:        Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      createdAt: Date.now(),
    });
    // Cap at 100 media entries
    return write(KEYS.MEDIA, list.slice(-100));
  },
  removeMedia: (id) => {
    const list = storage.getMedia().filter(m => m.id !== id);
    return storage.saveMedia(list);
  },

  // ── Session (transient boot context) ────────────────────────────
  getSession:  ()     => read(KEYS.SESSION) ?? {},
  saveSession: (data) => write(KEYS.SESSION, data),

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
