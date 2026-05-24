// ================================================================
// IMMORTAIL™ MVP — EVENT BUS
// Lightweight pub/sub. SYSTEM:: namespace. No contract overhead.
// ================================================================

const listeners = new Map();
let idSeq = 0;

export const EventBus = {
  emit(event, payload = {}) {
    const type = normalise(event);
    const handlers = listeners.get(type);
    if (!handlers) return;
    handlers.forEach(fn => {
      try { fn({ type, payload, ts: Date.now() }); }
      catch (e) { console.warn('[EventBus] handler error:', type, e); }
    });
  },

  on(event, fn) {
    const type = normalise(event);
    if (!listeners.has(type)) listeners.set(type, new Map());
    const id = ++idSeq;
    listeners.get(type).set(id, fn);
    return () => listeners.get(type)?.delete(id); // unsubscribe
  },

  once(event, fn) {
    const unsub = EventBus.on(event, (e) => { unsub(); fn(e); });
    return unsub;
  },

  clear() { listeners.clear(); },
};

// Normalise: 'DOG_STATE_UPDATED' or 'SYSTEM::DOG_STATE_UPDATED' → 'SYSTEM::DOG_STATE_UPDATED'
function normalise(event) {
  if (event.includes('::')) return event.toUpperCase();
  return 'SYSTEM::' + event.toUpperCase();
}

export const EVENTS = {
  APP_READY:         'SYSTEM::APP_READY',
  DOG_UPDATED:       'SYSTEM::DOG_UPDATED',
  EMOTION_CHANGED:   'SYSTEM::EMOTION_CHANGED',
  MEMORY_ADDED:      'SYSTEM::MEMORY_ADDED',
  SETTINGS_CHANGED:  'SYSTEM::SETTINGS_CHANGED',
  INTERACTION:       'SYSTEM::INTERACTION',
  SCREEN_CHANGED:    'SYSTEM::SCREEN_CHANGED',
};

export default EventBus;
