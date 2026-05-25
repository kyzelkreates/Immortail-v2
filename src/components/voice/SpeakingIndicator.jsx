// ================================================================
// IMMORTAIL™ Run 21 — SPEAKING INDICATOR
// Animated equaliser bars shown when companion is speaking.
// ================================================================

import React from 'react';

export default function SpeakingIndicator({ active = false, word = '' }) {
  if (!active) return null;
  return (
    <div className="speaking-indicator">
      <div className="speaking-indicator__bars">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="speaking-indicator__bar" style={{ '--i': i }} />
        ))}
      </div>
      {word && <span className="speaking-indicator__word">{word}</span>}
      <span className="speaking-indicator__label">Speaking</span>
    </div>
  );
}
