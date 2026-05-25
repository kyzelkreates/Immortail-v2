// ================================================================
// IMMORTAIL™ Run 21 — useSpeechSynthesis hook
// TTS state, voice list, speak/interrupt controls for UI.
// ================================================================

import { useState, useEffect, useCallback } from 'react';
import { EventBus }      from '../core/eventBus.js';
import { speak, interrupt, pause, resume, isSpeaking, getAvailableVoices } from '../services/voice/speechSynthesis.js';
import { updateVoiceSettings } from '../services/voice/voiceRouter.js';

export function useSpeechSynthesis() {
  const [speaking,   setSpeaking]   = useState(false);
  const [paused,     setPaused]     = useState(false);
  const [word,       setWord]       = useState('');
  const [voices,     setVoices]     = useState(() => getAvailableVoices());
  const [error,      setError]      = useState(null);

  useEffect(() => {
    // Refresh voice list once loaded (async in some browsers)
    const onVoicesChanged = () => setVoices(getAvailableVoices());
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
    }

    const unsubs = [
      EventBus.on('SYSTEM::TTS_STARTED',     () => { setSpeaking(true); setPaused(false); setError(null); }),
      EventBus.on('SYSTEM::TTS_ENDED',       () => { setSpeaking(false); setPaused(false); }),
      EventBus.on('SYSTEM::TTS_INTERRUPTED', () => { setSpeaking(false); setPaused(false); }),
      EventBus.on('SYSTEM::TTS_PAUSED',      () => setPaused(true)),
      EventBus.on('SYSTEM::TTS_RESUMED',     () => setPaused(false)),
      EventBus.on('SYSTEM::TTS_WORD',        ({ word: w }) => setWord(w)),
      EventBus.on('SYSTEM::TTS_ERROR',       ({ code }) => { setError(code); setSpeaking(false); }),
    ];

    return () => {
      unsubs.forEach(u => u());
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      }
    };
  }, []);

  const doSpeak     = useCallback((text, opts) => speak(text, opts), []);
  const doInterrupt = useCallback(() => interrupt(), []);
  const doPause     = useCallback(() => pause(), []);
  const doResume    = useCallback(() => resume(), []);

  const setVoice    = useCallback((name) => updateVoiceSettings({ preferredVoiceName: name }), []);
  const setTTSMode  = useCallback((mode) => updateVoiceSettings({ ttsMode: mode }), []);

  return {
    speaking, paused, word, voices, error,
    speak: doSpeak, interrupt: doInterrupt,
    pause: doPause, resume: doResume,
    setVoice, setTTSMode,
  };
}

export default useSpeechSynthesis;
