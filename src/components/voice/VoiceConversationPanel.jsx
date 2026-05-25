// ================================================================
// IMMORTAIL™ Run 21 — VOICE CONVERSATION PANEL
// Merges all voice UI: orb, transcript, controls, emotion ring.
// The primary surface inside VoiceCompanionPage.
// ================================================================

import React, { useState, useCallback, useReducer, useEffect } from 'react';
import VoiceVisualizer    from './VoiceVisualizer.jsx';
import LiveTranscript     from './LiveTranscript.jsx';
import RealtimeMicButton  from './RealtimeMicButton.jsx';
import ListeningIndicator from './ListeningIndicator.jsx';
import SpeakingIndicator  from './SpeakingIndicator.jsx';
import VoiceSettingsPanel from './VoiceSettingsPanel.jsx';
import { useVoiceConversation } from '../../hooks/useVoiceConversation.js';
import { useSpeechSynthesis }   from '../../hooks/useSpeechSynthesis.js';
import { useEmotionAnalysis }   from '../../hooks/useEmotionAnalysis.js';
import { EventBus }             from '../../core/eventBus.js';

// Transcript entry accumulator
function transcriptReducer(state, action) {
  switch (action.type) {
    case 'ADD_USER':
      return [...state, { role: 'user', text: action.text, emotion: action.emotion?.detected, ts: Date.now() }].slice(-50);
    case 'ADD_ASSISTANT':
      return [...state, { role: 'assistant', text: action.text, emotion: action.emotion?.detected, ts: Date.now() }].slice(-50);
    case 'CLEAR':
      return [];
    default:
      return state;
  }
}

export default function VoiceConversationPanel() {
  const voice = useVoiceConversation();
  const tts   = useSpeechSynthesis();
  const emo   = useEmotionAnalysis();

  const [entries,      dispatch]      = useReducer(transcriptReducer, []);
  const [showSettings, setSettings]   = useState(false);
  const [isFullscreen, setFullscreen] = useState(false);

  // Wire TURN_END → transcript entries
  useEffect(() => {
    const u1 = EventBus.on('SYSTEM::VOICE_TURN_END', ({ transcript, response, emotion }) => {
      if (transcript) dispatch({ type: 'ADD_USER',      text: transcript, emotion });
      if (response)   dispatch({ type: 'ADD_ASSISTANT', text: response,   emotion });
    });
    return () => u1();
  }, []);

  const handleOrbClick = useCallback(() => {
    if (voice.isIdle) voice.start({ mode: voice.mode });
    else if (voice.isSpeakingNow) voice.interruptSpeaking();
  }, [voice]);

  const toggleFullscreen = () => {
    setFullscreen(v => !v);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.();
    }
  };

  const emotionDetected = emo.currentEmotion?.detected ?? 'neutral';

  return (
    <div className={`voice-panel ${isFullscreen ? 'voice-panel--fullscreen' : ''}`}>
      {/* Top bar */}
      <div className="voice-panel__topbar">
        <div className="voice-panel__session-info">
          {voice.sessionState !== 'idle' && (
            <span className="voice-panel__session-badge">
              ● Session active
            </span>
          )}
        </div>
        <div className="voice-panel__topbar-actions">
          <button className="voice-panel__icon-btn" onClick={() => setSettings(v => !v)} title="Settings">⚙️</button>
          <button className="voice-panel__icon-btn" onClick={toggleFullscreen} title="Fullscreen">⛶</button>
        </div>
      </div>

      {/* Settings overlay */}
      {showSettings && (
        <div className="voice-panel__settings-overlay">
          <VoiceSettingsPanel onClose={() => setSettings(false)} />
        </div>
      )}

      {/* Central visualizer */}
      <div className="voice-panel__center">
        <VoiceVisualizer
          sessionState={voice.sessionState}
          micLevel={voice.micLevel}
          emotion={emotionDetected}
          onOrbClick={handleOrbClick}
        />
      </div>

      {/* Status row */}
      <div className="voice-panel__status-row">
        <ListeningIndicator  active={voice.isListening}  micLevel={voice.micLevel} />
        <SpeakingIndicator   active={voice.isSpeakingNow} word={tts.word} />
      </div>

      {/* Transcript */}
      <div className="voice-panel__transcript">
        <LiveTranscript
          transcript={voice.transcript}
          partialText={voice.partialText}
          aiResponse={voice.aiResponse}
          isThinking={voice.isThinking}
          entries={entries}
        />
      </div>

      {/* Controls */}
      <div className="voice-panel__controls">
        <RealtimeMicButton
          sessionState={voice.sessionState}
          mode={voice.mode}
          onStart={() => voice.start({ mode: voice.mode })}
          onStop={voice.stop}
          onPTTStart={voice.pushStart}
          onPTTEnd={voice.pushEnd}
          onInterrupt={voice.interruptSpeaking}
        />

        {/* Mode toggle */}
        <div className="voice-panel__mode-toggle">
          <button
            className={`voice-panel__mode-btn ${voice.mode === 'auto' ? 'active' : ''}`}
            onClick={() => voice.setMode('auto')}
          >
            Auto
          </button>
          <button
            className={`voice-panel__mode-btn ${voice.mode === 'push' ? 'active' : ''}`}
            onClick={() => voice.setMode('push')}
          >
            Push
          </button>
        </div>

        {/* Clear transcript */}
        <button className="voice-panel__clear-btn" onClick={() => dispatch({ type: 'CLEAR' })}>
          🗑
        </button>
      </div>

      {/* Error banner */}
      {voice.error && (
        <div className="voice-panel__error-banner">
          ⚠️ {voice.error}
          <button onClick={voice.clearError}>✕</button>
        </div>
      )}
    </div>
  );
}
