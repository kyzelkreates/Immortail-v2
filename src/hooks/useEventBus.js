// ================================================================
// IMMORTAIL™ — useEventBus Hook
// Safe event subscription with automatic cleanup.
// UI RECEIVES EVENTS ONLY — NEVER EMITS STATE CHANGES.
// ================================================================

import { useState, useEffect, useRef } from 'react';
import { subscribe } from '../events/eventBus.js';

/**
 * Subscribe to one or more event bus events.
 * Handler is stable across renders via ref.
 *
 * @param {string | string[]} eventTypes
 * @param {Function}          handler    — (payload) => void
 */
export function useEventBus(eventTypes, handler) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const types         = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
    const unsubscribers = [];

    for (const type of types) {
      if (!type) continue;
      const stableHandler = (payload) => {
        try { handlerRef.current(payload); }
        catch (err) { console.warn(`[useEventBus] Handler error for "${type}":`, err); }
      };

      if (typeof subscribe === 'function') {
        const unsub = subscribe(type, stableHandler);
        if (typeof unsub === 'function') unsubscribers.push(unsub);
      }
    }

    return () => { for (const unsub of unsubscribers) unsub(); };
  }, [Array.isArray(eventTypes) ? eventTypes.join(',') : eventTypes]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Subscribe to a single event and return the latest payload.
 * @param {string} eventType
 * @returns {any} last event payload, or null
 */
export function useLatestEvent(eventType) {
  const [payload, setPayload] = useState(null);
  useEventBus(eventType, setPayload);
  return payload;
}
