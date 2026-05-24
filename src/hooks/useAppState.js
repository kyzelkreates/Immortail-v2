// ================================================================
// IMMORTAIL™ — useAppState Hook
// Read-only subscription to appState.
// NO DIRECT MUTATIONS. SUBSCRIPTION + CLEANUP ONLY.
// ================================================================

import { useState, useEffect, useRef } from 'react';
import { getAppState, subscribeToAppState } from '../state/appState.js';

/**
 * Subscribe to the IMMORTAIL™ app state.
 * @param {string[]} [fields]
 */
export function useAppState(fields = null) {
  const [state, setState] = useState(() => _project(getAppState(), fields));
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  useEffect(() => {
    let unsubscribe;

    if (typeof subscribeToAppState === 'function') {
      unsubscribe = subscribeToAppState((nextState) => {
        setState(_project(nextState, fieldsRef.current));
      });
    }

    setState(_project(getAppState(), fieldsRef.current));

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
