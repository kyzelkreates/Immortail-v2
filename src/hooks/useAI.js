// ================================================================
// IMMORTAIL™ Gen2 — useAI hook
// Sends messages through aiRouter. Manages loading/error state.
// NEVER calls providers directly from UI.
// ================================================================

import { useState, useCallback, useRef } from 'react';
import { send as aiSend }                from '../services/ai/aiRouter.js';
import { scheduleEmotionUpdate }          from '../workers/emotionWorker.js';
import { scheduleAnimationSync }           from '../workers/animationWorker.js';
import { EventBus }                       from '../core/eventBus.js';

export function useAI() {
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [lastResponse, setLast]   = useState(null);
  const abortRef = useRef(null);

  const send = useCallback(async (message, options = {}) => {
    if (!message?.trim() || loading) return null;
    setLoading(true);
    setError(null);

    try {
      const response = await aiSend(message, options);
      setLast(response);

      // Kick off side-effect workers
      if (response.emotion) {
        scheduleEmotionUpdate(response.emotion);
        scheduleAnimationSync(response.emotion);
      }

      return response;
    } catch (err) {
      setError(err.message ?? 'AI request failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const clearError = useCallback(() => setError(null), []);

  return { send, loading, error, lastResponse, clearError };
}

export default useAI;
