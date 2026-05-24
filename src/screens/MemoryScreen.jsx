import React from 'react';
import useMemories from '../hooks/useMemories.js';

const EMOTION_ICONS = {
  calm:    '😌',
  happy:   '😊',
  curious: '🤔',
  sleepy:  '😴',
};

const TYPE_ICONS = {
  pet:  '🐾',
  play: '🎾',
  talk: '💬',
  rest: '💤',
};

export default function MemoryScreen() {
  const { memories, formatMemoryDate } = useMemories(60);

  return (
    <div className="screen memory-screen">
      <header className="screen-header">
        <h1>Memory</h1>
        <p className="screen-subtitle">
          {memories.length > 0
            ? `${memories.length} moment${memories.length !== 1 ? 's' : ''} together`
            : 'Your story begins here'}
        </p>
      </header>

      <div className="memory-list">
        {memories.length === 0 ? (
          <div className="memory-empty">
            <span className="memory-empty-icon">🐾</span>
            <p>No memories yet.</p>
            <p className="memory-empty-sub">Go to Home and interact with your companion.</p>
          </div>
        ) : (
          memories.map((m) => (
            <div key={m.id} className="memory-card">
              <div className="memory-icon">
                {TYPE_ICONS[m.type] || '🌟'}
              </div>
              <div className="memory-content">
                <p className="memory-label">{m.label || m.type}</p>
                <p className="memory-meta">
                  <span className="memory-emotion">
                    {EMOTION_ICONS[m.emotion] || '🐾'} {m.emotion}
                  </span>
                  <span className="memory-time">{formatMemoryDate(m.ts)}</span>
                </p>
              </div>
              {m.bonding != null && (
                <div className="memory-bond" title={`Bond level: ${m.bonding}%`}>
                  {m.bonding}%
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
