// ================================================================
// IMMORTAIL™ Run 21 — useSpeechRecognition hook
// Exposes STT state + transcript stream to UI components.
// ================================================================

import { useState, useEffect } from 'react';
import { EventBus }    from '../core/eventBus.js';
import { detectSTTMode } from '../services/voice/speechRecognition.js';

export function useSpeechRecognition() {
  const [partial,    setPartial]    = useState('');
  const [finalText,  setFinal]      = useState('');
  const [confidence, setConfidence] = useState(0);
  const [running,    setRunning]    = useState(false);
  const [mode,       setMode]       = useState(() => detectSTTMode());
  const [error,      setError]      = useState(null);

  useEffect(() => {
    const unsubs = [
      EventBus.on('SYSTEM::STT_STARTED',   () => { setRunning(true); setError(null); }),
      EventBus.on('SYSTEM::STT_STOPPED',   () => { setRunning(false); setPartial(''); }),
      EventBus.on('SYSTEM::STT_PARTIAL',   ({ text }) => setPartial(text)),
      EventBus.on('SYSTEM::STT_FINAL',     ({ text, confidence: c }) => {
        setFinal(text);
        setConfidence(c ?? 0);
        setPartial('');
      }),
      EventBus.on('SYSTEM::STT_ERROR',     ({ code, fatal }) => {
        setError(code);
        if (fatal) setRunning(false);
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  return { partial, finalText, confidence, running, mode, error };
}

export default useSpeechRecognition;
