// ================================================================
// IMMORTAIL™ — useCompanionCore hook (Run 3)
// Reactive bridge between companionCoreService and UI.
// Subscribes to DOG_UPDATED + EMOTION_CHANGED + MEMORY_ADDED.
// All reads come from companionCoreService (which reads storage).
// ================================================================

import { useState, useEffect, useCallback } from 'react';
import { EventBus, EVENTS } from '../core/eventBus.js';
import {
  getCore,
  recordChatMessage,
  recordMediaEvent,
  recordInteractionEvent,
  renameCompanion,
  resetCompanionCore,
  sendToOllama,
  buildOllamaPrompt,
  MOOD,
  BEHAVIOUR,
} from '../core/companionCoreService.js';

export { MOOD, BEHAVIOUR };

export function useCompanionCore() {
  const [core,     setCore]     = useState(() => getCore());
  const [aiStatus, setAiStatus] = useState('idle'); // idle | thinking | done | error

  // ── Sync on any companion event ───────────────────────────────

  useEffect(() => {
    const refresh = () => setCore(getCore());

    const subs = [
      EventBus.on(EVENTS.DOG_UPDATED,     refresh),
      EventBus.on(EVENTS.EMOTION_CHANGED, refresh),
      EventBus.on(EVENTS.MEMORY_ADDED,    refresh),
    ];

    return () => subs.forEach(unsub => unsub());
  }, []);

  // ── Chat message (sentiment → emotion → memory) ───────────────

  const sendMessage = useCallback(async (text) => {
    if (!text?.trim()) return null;

    // 1. Record locally first (deterministic, instant)
    recordChatMessage(text);

    // 2. Attempt Ollama response
    const config = getCore(); // re-read after mutation
    setAiStatus('thinking');

    const result = await sendToOllama(text);
    setAiStatus(result.ok ? 'done' : 'error');

    // 3. Refresh core after AI call
    setCore(getCore());

    return result;
  }, []);

  // ── Media event (fuse into unified memory) ────────────────────

  const ingestMedia = useCallback((mediaEntry) => {
    recordMediaEvent(mediaEntry);
    setCore(getCore());
  }, []);

  // ── Physical interaction ──────────────────────────────────────

  const interact = useCallback((type) => {
    recordInteractionEvent(type);
    setCore(getCore());
  }, []);

  // ── Identity ──────────────────────────────────────────────────

  const rename = useCallback((name) => {
    renameCompanion(name);
    setCore(getCore());
  }, []);

  const reset = useCallback(() => {
    resetCompanionCore();
    setCore(getCore());
  }, []);

  // ── Derived selectors ─────────────────────────────────────────

  const identity       = core.identity;
  const emotionalState = core.emotionalState;
  const behaviourState = core.behaviourState;
  const memory         = core.memory;
  const mediaMemory    = core.mediaMemory;
  const lastInteraction = core.lastInteraction;

  return {
    core,
    identity,
    emotionalState,
    behaviourState,
    memory,
    mediaMemory,
    lastInteraction,
    aiStatus,
    sendMessage,
    ingestMedia,
    interact,
    rename,
    reset,
  };
}

export default useCompanionCore;
