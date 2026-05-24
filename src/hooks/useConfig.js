// ================================================================
// IMMORTAIL™ — useConfig hook
// Reads system config from storage SSOT. Provides patch helper.
// All consumers read from storage — no prop drilling.
// ================================================================

import { useState, useCallback } from 'react';
import storage from '../core/storage.js';
import { EventBus } from '../core/eventBus.js';

export function useConfig() {
  const [config, setConfig] = useState(() => storage.getConfig());

  // Patch a nested key and re-read from storage (SSOT re-read ensures consistency)
  const patch = useCallback((path, value) => {
    storage.patchConfig(path, value);
    const updated = storage.getConfig();
    setConfig(updated);
    EventBus.emit('SYSTEM::CONFIG_CHANGED', { path, value, config: updated });
    return updated;
  }, []);

  // Full config save (merges onto current)
  const save = useCallback((partial) => {
    storage.saveConfig(partial);
    const updated = storage.getConfig();
    setConfig(updated);
    EventBus.emit('SYSTEM::CONFIG_CHANGED', { config: updated });
    return updated;
  }, []);

  // Re-read from storage (useful after external mutations)
  const refresh = useCallback(() => {
    setConfig(storage.getConfig());
  }, []);

  return { config, patch, save, refresh };
}

export default useConfig;
