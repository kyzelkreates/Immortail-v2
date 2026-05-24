// ================================================================
// IMMORTAIL™ — useDogState Hook
// Read-only subscription to dog/companion state.
// NO MUTATIONS. SUBSCRIPTION + CLEANUP ONLY.
// ================================================================

import { useState, useEffect, useRef } from 'react';
import { getDogState, subscribeToDogState } from '../state/dogState.js';

/**
 * Subscribe to the IMMORTAIL™ dog/companion runtime state.
 * @param {string[]} [fields] — optional field subset
 */
export function useDogState(fields = null) {
  const [state, setState] = useState(() => _project(getDogState(), fields));
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  useEffect(() => {
    let unsubscribe;

    if (typeof subscribeToDogState === 'function') {
      unsubscribe = subscribeToDogState((nextState) => {
        setState(_project(nextState, fieldsRef.current));
      });
    }

    setState(_project(getDogState(), fieldsRef.current));

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
