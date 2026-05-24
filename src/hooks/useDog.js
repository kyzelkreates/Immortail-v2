// ================================================================
// IMMORTAIL™ MVP — useDog hook
// Subscribes to DOG_UPDATED events and exposes dog state + actions.
// ================================================================

import { useState, useEffect, useCallback } from 'react';
import { EventBus, EVENTS } from '../core/eventBus.js';
import {
  getDog, recordInteraction, setEmotion, rename, resetDog,
  EMOTION, BEHAVIOUR,
} from '../core/dogService.js';

export { EMOTION, BEHAVIOUR };

export function useDog() {
  const [dog, setDog] = useState(() => getDog());

  useEffect(() => {
    // Sync with any update from dogService
    const unsub = EventBus.on(EVENTS.DOG_UPDATED, ({ payload }) => {
      setDog({ ...payload });
    });
    return unsub;
  }, []);

  const interact = useCallback((type) => {
    return recordInteraction(type);
  }, []);

  const changeEmotion = useCallback((emotion) => {
    return setEmotion(emotion);
  }, []);

  const changeName = useCallback((name) => {
    return rename(name);
  }, []);

  const reset = useCallback(() => {
    return resetDog();
  }, []);

  return { dog, interact, changeEmotion, changeName, reset };
}

export default useDog;
