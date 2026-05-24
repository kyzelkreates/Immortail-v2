import { useState, useEffect } from 'react';
import { EventBus, EVENTS } from '../core/eventBus.js';
import { getRecentMemories, formatMemoryDate } from '../core/memoryService.js';

export function useMemories(limit = 50) {
  const [memories, setMemories] = useState(() => getRecentMemories(limit));

  useEffect(() => {
    const unsub = EventBus.on(EVENTS.MEMORY_ADDED, () => {
      setMemories(getRecentMemories(limit));
    });
    return unsub;
  }, [limit]);

  return { memories, formatMemoryDate };
}

export default useMemories;
