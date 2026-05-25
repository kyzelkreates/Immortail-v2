// ================================================================
// IMMORTAIL™ Run 21 — LISTENING INDICATOR
// Animated dots + mic level bar shown when companion is listening.
// ================================================================

import React from 'react';

export default function ListeningIndicator({ active = false, micLevel = 0 }) {
  if (!active) return null;
  const fillPct = Math.round(micLevel * 100);
  return (
    <div className="listening-indicator">
      <div className="listening-indicator__dots">
        <span className="listening-indicator__dot" style={{ '--d': '0s' }} />
        <span className="listening-indicator__dot" style={{ '--d': '0.15s' }} />
        <span className="listening-indicator__dot" style={{ '--d': '0.3s' }} />
      </div>
      <div className="listening-indicator__level">
        <div className="listening-indicator__level-fill" style={{ width: `${fillPct}%` }} />
      </div>
      <span className="listening-indicator__label">Listening</span>
    </div>
  );
}
