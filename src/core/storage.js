// ================================================================
// IMMORTAIL™ MVP — STORAGE SERVICE (SSOT)
// Single source of truth for all persistence.
// All reads/writes go through this module only.
// Uses localStorage for MVP (IndexedDB upgrade path preserved).
// ================================================================

const PREFIX = 'immortail_';

const KEYS = {
  DOG:      PREFIX + 'dog',
  MEMORIES: PREFIX + 'memories',
  SETTINGS: PREFIX + 'settings',
  SESSION:  PREFIX + 'session',
};

// ── Serialisation ────────────────────────────────────────────────

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

// ── Public API ────────────────────────────────────────────────────

export const storage = {
  // Dog profile
  getDog:     ()     => read(KEYS.DOG),
  saveDog:    (data) => write(KEYS.DOG, data),

  // Memories (array, capped at 200)
  getMemories: () => read(KEYS.MEMORIES) ?? [],
  saveMemories: (arr) => write(KEYS.MEMORIES, arr.slice(-200)),
  addMemory: (entry) => {
    const list = storage.getMemories();
    list.push({ ...entry, id: Date.now() + '_' + Math.random().toString(36).slice(2, 7) });
    return storage.saveMemories(list);
  },

  // Settings
  getSettings: ()     => read(KEYS.SETTINGS) ?? {},
  saveSettings: (data) => write(KEYS.SETTINGS, data),

  // Session (transient boot context)
  getSession: ()     => read(KEYS.SESSION) ?? {},
  saveSession: (data) => write(KEYS.SESSION, data),

  // Full reset
  clear: () => {
    Object.values(KEYS).forEach(k => remove(k));
  },

  isAvailable: () => {
    try { localStorage.setItem('__test__', '1'); localStorage.removeItem('__test__'); return true; }
    catch { return false; }
  },
};

export default storage;
