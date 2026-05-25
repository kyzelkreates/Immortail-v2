// ================================================================
// IMMORTAIL™ Gen2 — useMemoryEngine hook
// Reads AI memory state. Exposes search and export.
// ================================================================

import { useState, useEffect, useCallback } from 'react';
import storage from '../core/storage.js';
import { EventBus } from '../core/eventBus.js';
import {
  getMemoryStats, searchMemory, exportMemory,
  clearConversationHistory, recordMilestone,
} from '../services/ai/memoryEngine.js';

export function useMemoryEngine() {
  const [stats,   setStats]   = useState(() => getMemoryStats());
  const [results, setResults] = useState(null);
  const [query,   setQuery]   = useState('');

  const refresh = useCallback(() => setStats(getMemoryStats()), []);

  useEffect(() => {
    const u1 = EventBus.on('SYSTEM::MEMORY_TURN_SAVED',    refresh);
    const u2 = EventBus.on('SYSTEM::MEMORY_MILESTONE_SAVED', refresh);
    const u3 = EventBus.on('SYSTEM::MEMORY_COMPRESSED',    refresh);
    return () => { u1(); u2(); u3(); };
  }, [refresh]);

  const search = useCallback((q) => {
    setQuery(q);
    setResults(searchMemory(q));
  }, []);

  const doExport = useCallback(() => exportMemory(), []);
  const clearHistory = useCallback(() => { clearConversationHistory(); refresh(); }, [refresh]);
  const addMilestone = useCallback((title, detail) => { recordMilestone(title, detail); refresh(); }, [refresh]);

  const recentTurns = (storage.getAIMemory().turns ?? []).slice(-10);

  return { stats, results, query, search, doExport, clearHistory, addMilestone, recentTurns, refresh };
}

export default useMemoryEngine;
