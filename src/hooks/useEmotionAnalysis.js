// ================================================================
// IMMORTAIL™ Run 21 — useEmotionAnalysis hook
// Live emotion state from voice sessions + history.
// ================================================================

import { useState, useEffect, useCallback } from 'react';
import { EventBus } from '../core/eventBus.js';
import storage      from '../core/storage.js';

export function useEmotionAnalysis() {
  const [currentEmotion,  setCurrent]  = useState(null);
  const [rollingEmotion,  setRolling]  = useState(() => storage.getVoiceSettings().rollingEmotion ?? null);
  const [emotionHistory,  setHistory]  = useState(() => storage.getVoiceEmotion().slice(-20));
  const [spike,           setSpike]    = useState(null);

  useEffect(() => {
    const unsubs = [
      EventBus.on('SYSTEM::VOICE_EMOTION_DETECTED', ({ result }) => {
        setCurrent(result);
        setHistory(storage.getVoiceEmotion().slice(-20));
      }),
      EventBus.on('SYSTEM::TONE_PROFILE_UPDATED', ({ avg }) => {
        setRolling(avg);
      }),
      EventBus.on('SYSTEM::VOICE_EMOTION_SPIKE', ({ emotion, valence }) => {
        setSpike({ emotion, valence, ts: Date.now() });
        setTimeout(() => setSpike(null), 5000);
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  const clearHistory = useCallback(() => {
    storage.patchVoiceSettings({ rollingEmotion: null });
    setHistory([]);
    setCurrent(null);
  }, []);

  return { currentEmotion, rollingEmotion, emotionHistory, spike, clearHistory };
}

export default useEmotionAnalysis;
