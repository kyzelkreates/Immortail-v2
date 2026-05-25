// ================================================================
// IMMORTAIL™ Run 21 — useVoiceConversation hook
// Top-level voice hook for VoiceCompanionPage.
// Wraps voiceRouter — no direct service access from UI.
// ================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { EventBus } from '../core/eventBus.js';
import {
  startSession, stopSession, pauseSession, resumeSession,
  pttStart, pttEnd, speak, interrupt, isSpeaking,
  getVoiceStatus, updateVoiceSettings,
} from '../services/voice/voiceRouter.js';
import { SESSION_STATE } from '../services/voice/voiceStreamManager.js';

export function useVoiceConversation() {
  const [sessionState, setSessionState]    = useState(SESSION_STATE.IDLE);
  const [transcript,   setTranscript]      = useState('');
  const [partialText,  setPartialText]     = useState('');
  const [aiResponse,   setAIResponse]      = useState('');
  const [emotion,      setEmotion]         = useState(null);
  const [error,        setError]           = useState(null);
  const [micLevel,     setMicLevel]        = useState(0);
  const [isThinking,   setIsThinking]      = useState(false);
  const [mode,         setModeState]       = useState('auto');

  const isMountedRef = useRef(true);
  useEffect(() => { return () => { isMountedRef.current = false; }; }, []);

  const safe = (fn) => (...args) => { if (isMountedRef.current) fn(...args); };

  useEffect(() => {
    const unsubs = [
      EventBus.on('SYSTEM::VOICE_STATE_CHANGED',   safe(({ state }) => setSessionState(state))),
      EventBus.on('SYSTEM::STT_PARTIAL',           safe(({ text }) => setPartialText(text))),
      EventBus.on('SYSTEM::STT_FINAL',             safe(({ text }) => { setTranscript(text); setPartialText(''); })),
      EventBus.on('SYSTEM::VOICE_AI_THINKING',     safe(() => setIsThinking(true))),
      EventBus.on('SYSTEM::VOICE_AI_RESPONDING',   safe(({ text, emotion: e }) => {
        setIsThinking(false);
        setAIResponse(text ?? '');
        if (e) setEmotion(e);
      })),
      EventBus.on('SYSTEM::VOICE_EMOTION_DETECTED', safe(({ result }) => setEmotion(result))),
      EventBus.on('SYSTEM::VOICE_STREAM_ERROR',    safe(({ code }) => setError(code))),
      EventBus.on('SYSTEM::MIC_LEVEL',             safe(({ level }) => setMicLevel(level))),
      EventBus.on('SYSTEM::VOICE_TURN_END',        safe(({ transcript: t }) => setTranscript(t ?? ''))),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  const start = useCallback(async (options = {}) => {
    setError(null);
    const m = options.mode ?? mode;
    setModeState(m);
    await startSession({ mode: m });
  }, [mode]);

  const stop = useCallback(() => {
    stopSession();
    setPartialText('');
    setIsThinking(false);
  }, []);

  const pause   = useCallback(pauseSession, []);
  const resume  = useCallback(resumeSession, []);

  const pushStart = useCallback(() => pttStart(), []);
  const pushEnd   = useCallback(() => pttEnd(), []);

  const interruptSpeaking = useCallback(() => interrupt(), []);

  const setMode = useCallback((m) => {
    setModeState(m);
    updateVoiceSettings({ conversationMode: m });
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const isListening   = sessionState === SESSION_STATE.LISTENING;
  const isProcessing  = sessionState === SESSION_STATE.PROCESSING;
  const isSpeakingNow = sessionState === SESSION_STATE.SPEAKING;
  const isIdle        = sessionState === SESSION_STATE.IDLE;

  return {
    sessionState, transcript, partialText, aiResponse,
    emotion, error, micLevel, isThinking, mode,
    isListening, isProcessing, isSpeakingNow, isIdle,
    start, stop, pause, resume,
    pushStart, pushEnd, interruptSpeaking,
    setMode, clearError,
  };
}

export default useVoiceConversation;
