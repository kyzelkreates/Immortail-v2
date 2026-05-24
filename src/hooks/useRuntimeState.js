// ================================================================
// IMMORTAIL™ — useRuntimeState Hook
// Read-only subscription to runtimeState.
// NO DIRECT MUTATIONS. SUBSCRIPTION + CLEANUP ONLY.
// ================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { getRuntimeState, subscribeToRuntimeState } from '../state/runtimeState.js';

/**
 * Subscribe to the IMMORTAIL™ runtime state.
 * Returns a read-only snapshot that updates on state changes.
 * @param {string[]} [fields] — optional field subset to watch
 */
export function useRuntimeState(fields = null) {
  const [state, setState] = useState(() => _project(getRuntimeState(), fields));
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  useEffect(() => {
    let unsubscribe;

    // subscribeToRuntimeState may not exist in all builds — guard gracefully
    if (typeof subscribeToRuntimeState === 'function') {
      unsubscribe = subscribeToRuntimeState((nextState) => {
        setState(_project(nextState, fieldsRef.current));
      });
    }

    // Sync on mount regardless
    setState(_project(getRuntimeState(), fieldsRef.current));

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}

function _project(state, fields) {
  if (!state) return {};
  if (!fields || !fields.length) return { ...state };
  const out = {};
  for (const f of fields) out[f] = state[f];
  return out;
}
