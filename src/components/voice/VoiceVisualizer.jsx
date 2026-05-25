// ================================================================
// IMMORTAIL™ Run 21 — VOICE VISUALIZER
// Combined orb + ring + waveform + presence canvas.
// Central cinematic hero element of VoiceCompanionPage.
// ================================================================

import React from 'react';
import VoiceOrb           from './VoiceOrb.jsx';
import EmotionalStateRing from './EmotionalStateRing.jsx';
import AudioWaveform      from './AudioWaveform.jsx';

export default function VoiceVisualizer({
  sessionState = 'idle',
  micLevel     = 0,
  emotion      = 'neutral',
  onOrbClick,
}) {
  const isActive = sessionState !== 'idle' && sessionState !== 'error';

  return (
    <div className="voice-visualizer">
      {/* Ambient background pulse */}
      <div className={`voice-visualizer__bg-pulse voice-visualizer__bg-pulse--${emotion}`} />

      {/* Main orb + ring stack */}
      <div className="voice-visualizer__orb-wrap">
        <EmotionalStateRing emotion={emotion} size={160}>
          <VoiceOrb
            state={sessionState}
            micLevel={micLevel}
            size={160}
            onClick={onOrbClick}
          />
        </EmotionalStateRing>
      </div>

      {/* Waveform below orb */}
      <div className="voice-visualizer__waveform">
        <AudioWaveform
          active={sessionState === 'listening'}
          height={40}
          color={sessionState === 'listening' ? '#3b82f6' : '#7c3aed'}
        />
      </div>

      {/* State text badge */}
      <div className={`voice-visualizer__state-badge voice-visualizer__state-badge--${sessionState}`}>
        {sessionState === 'idle'       && 'Tap to start'}
        {sessionState === 'listening'  && '🎙 Listening…'}
        {sessionState === 'processing' && '⚙️ Thinking…'}
        {sessionState === 'speaking'   && '💬 Speaking…'}
        {sessionState === 'paused'     && '⏸ Paused'}
        {sessionState === 'error'      && '⚠️ Error — tap to retry'}
      </div>
    </div>
  );
}
