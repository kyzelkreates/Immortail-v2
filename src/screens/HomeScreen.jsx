// ================================================================
// IMMORTAIL™ — HOME SCREEN (Run 3 upgrade)
// Uses useCompanionCore for all state. Bridges companion interactions
// into the unified core (identity + memory + emotional state).
// ================================================================

import React from 'react';
import CompanionRenderer from '../components/CompanionRenderer.jsx';
import useCompanionCore, { MOOD }  from '../hooks/useCompanionCore.js';
import { EMOTION }                 from '../core/dogService.js';

// Map unified core MOOD → CompanionRenderer EMOTION keys
const MOOD_TO_EMOTION = {
  [MOOD.NEUTRAL]:  EMOTION.CALM,
  [MOOD.HAPPY]:    EMOTION.HAPPY,
  [MOOD.CURIOUS]:  EMOTION.CURIOUS,
  [MOOD.PLAYFUL]:  EMOTION.HAPPY,
  [MOOD.CALM]:     EMOTION.CALM,
  [MOOD.ANXIOUS]:  EMOTION.CURIOUS,
  [MOOD.TIRED]:    EMOTION.SLEEPY,
  [MOOD.EXCITED]:  EMOTION.HAPPY,
  [MOOD.WAITING]:  EMOTION.SLEEPY,
};

const INTERACTION_BUTTONS = [
  { type: 'pet',  icon: '🐾', label: 'Pet'  },
  { type: 'play', icon: '🎾', label: 'Play' },
  { type: 'talk', icon: '💬', label: 'Talk' },
  { type: 'rest', icon: '💤', label: 'Rest' },
];

export default function HomeScreen() {
  const { identity, memory, interact } = useCompanionCore();

  const emotion = MOOD_TO_EMOTION[identity.mood] || EMOTION.CALM;

  return (
    <div className="screen home-screen">
      <header className="screen-header">
        <h1 className="companion-name">{identity.name}</h1>
        <p className="companion-meta">
          {memory.length > 0
            ? `${memory.length} moment${memory.length !== 1 ? 's' : ''} together`
            : 'Say hello 👋'}
        </p>
      </header>

      <div className="companion-stage">
        <CompanionRenderer
          emotion={emotion}
          name={identity.name}
          bonding={Math.max(0, Math.min(100, identity.trust || 0))}
        />
      </div>

      <div className="interaction-grid">
        {INTERACTION_BUTTONS.map(btn => (
          <button
            key={btn.type}
            className="interaction-btn"
            onClick={() => interact(btn.type)}
            aria-label={btn.label}
          >
            <span className="btn-icon">{btn.icon}</span>
            <span className="btn-label">{btn.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
