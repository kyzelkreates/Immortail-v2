import React from 'react';
import CompanionRenderer from '../components/CompanionRenderer.jsx';
import useDog from '../hooks/useDog.js';

const INTERACTION_BUTTONS = [
  { type: 'pet',  icon: '🐾', label: 'Pet'  },
  { type: 'play', icon: '🎾', label: 'Play' },
  { type: 'talk', icon: '💬', label: 'Talk' },
  { type: 'rest', icon: '💤', label: 'Rest' },
];

export default function HomeScreen() {
  const { dog, interact } = useDog();

  return (
    <div className="screen home-screen">
      <header className="screen-header">
        <h1 className="companion-name">{dog.name}</h1>
        <p className="companion-meta">
          {dog.totalInteractions > 0
            ? `${dog.totalInteractions} interaction${dog.totalInteractions !== 1 ? 's' : ''}`
            : 'Say hello 👋'}
        </p>
      </header>

      <div className="companion-stage">
        <CompanionRenderer
          emotion={dog.emotion}
          name={dog.name}
          bonding={dog.bonding}
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
