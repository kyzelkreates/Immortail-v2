// ================================================================
// IMMORTAIL™ — useEventBus Hook (Event Unification Patch)
// Safe event subscription with automatic cleanup.
// Auto-normalizes all event names to canonical SYSTEM:: namespace.
// UI RECEIVES EVENTS ONLY — NEVER EMITS STATE CHANGES.
// ================================================================

import { useState, useEffect, useRef } from 'react';
import { subscribe }       from '../events/eventBus.js';
import { normalizeEventType } from '../events/eventBridge.js';

/**
 * Subscribe to one or more event bus events.
 * Event names are auto-normalized via eventBridge — legacy raw keys
 * (e.g. "APP_READY") are transparently mapped to their canonical
 * namespaced form (e.g. "SYSTEM::APP_READY").
 * Handler is stable across renders via ref.
 *
 * @param {string | string[]} eventTypes  — raw or canonical event names
 * @param {Function}          handler     — (payload) => void
 */
export function useEventBus(eventTypes, handler) {
  const handlerRef = useRef(handler);

  // Keep handler ref fresh on every render without re-subscribing
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const rawTypes      = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
    const unsubscribers = [];

    for (const raw of rawTypes) {
      if (!raw) continue;

      // ── Normalize to canonical namespace ────────────────────────
      const type = normalizeEventType(raw);

      const stableHandler = (payload) => {
        try { handlerRef.current(payload); }
        catch (err) {
          console.warn(`[useEventBus] Handler error for "${type}" (raw: "${raw}"):`, err);
        }
      };

      if (typeof subscribe === 'function') {
        try {
          const unsub = subscribe(type, stableHandler, {
            subscriberId: `useEventBus:${type}`,
          });
          if (typeof unsub === 'function') unsubscribers.push(unsub);
        } catch (err) {
          console.warn(`[useEventBus] Could not subscribe to "${type}" (raw: "${raw}"):`, err.message);
        }
      }
    }

    return () => { for (const unsub of unsubscribers) unsub(); };
  }, [Array.isArray(eventTypes) ? eventTypes.join(',') : eventTypes]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Subscribe to a single event and return the latest payload.
 * Auto-normalizes the event name.
 * @param {string} eventType  — raw or canonical
 * @returns {any} last event payload, or null
 */
export function useLatestEvent(eventType) {
  const [payload, setPayload] = useState(null);
  useEventBus(eventType, setPayload);
  return payload;
}
