// ================================================================
// IMMORTAIL™ Run 21 — REALTIME MIC BUTTON
// Toggle + push-to-talk control. Mode-aware.
// ================================================================

import React from 'react';

export default function RealtimeMicButton({
  sessionState = 'idle',
  mode         = 'auto',
  onStart,
  onStop,
  onPTTStart,
  onPTTEnd,
  onInterrupt,
}) {
  const isActive = sessionState !== 'idle' && sessionState !== 'error';
  const isSpeaking = sessionState === 'speaking';

  if (mode === 'push') {
    return (
      <button
        className="mic-btn mic-btn--ptt"
        onPointerDown={onPTTStart}
        onPointerUp={onPTTEnd}
        onPointerLeave={onPTTEnd}
        aria-label="Hold to talk"
      >
        <span className="mic-btn__icon">🎙</span>
        <span className="mic-btn__label">Hold to talk</span>
      </button>
    );
  }

  if (isSpeaking) {
    return (
      <button className="mic-btn mic-btn--interrupt" onClick={onInterrupt} aria-label="Interrupt">
        <span className="mic-btn__icon">✋</span>
        <span className="mic-btn__label">Interrupt</span>
      </button>
    );
  }

  return (
    <button
      className={`mic-btn ${isActive ? 'mic-btn--active' : 'mic-btn--idle'}`}
      onClick={isActive ? onStop : onStart}
      aria-label={isActive ? 'Stop listening' : 'Start listening'}
    >
      <span className="mic-btn__icon">{isActive ? '⏹' : '🎙'}</span>
      <span className="mic-btn__label">{isActive ? 'Stop' : 'Start'}</span>
    </button>
  );
}
