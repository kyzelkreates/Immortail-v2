import React, { useState } from 'react';

const PRIMARY_TABS = [
  { id: 'home',        label: 'Home',      icon: '🐾' },
  { id: 'companion',   label: 'Companion', icon: '🧠' },
  { id: 'memory',      label: 'Timeline',  icon: '🕰️' },
  { id: 'media',       label: 'Media',     icon: '📷' },
  { id: 'settings',    label: 'Settings',  icon: '⚙️' },
  { id: 'voice',       label: 'Voice',     icon: '🎙️' },
];

const AI_TABS = [
  { id: 'ai_settings',  label: 'Providers', icon: '⚡' },
  { id: 'ai_dashboard', label: 'Monitor',   icon: '📊' },
];

export default function NavBar({ current, navigate }) {
  const [showAI, setShowAI] = useState(false);

  const isAIScreen = current === 'ai_settings' || current === 'ai_dashboard';

  return (
    <nav className="navbar">
      {PRIMARY_TABS.map(tab => (
        <button
          key={tab.id}
          className={'nav-tab' + (current === tab.id ? ' active' : '')}
          onClick={() => { navigate(tab.id); setShowAI(false); }}
          aria-label={tab.label}
        >
          <span className="nav-icon">{tab.icon}</span>
          <span className="nav-label">{tab.label}</span>
        </button>
      ))}

      {/* AI toggle button */}
      <button
        className={'nav-tab nav-tab--ai' + (isAIScreen ? ' active' : '')}
        onClick={() => setShowAI(v => !v)}
        aria-label="AI"
      >
        <span className="nav-icon">🤖</span>
        <span className="nav-label">AI</span>
      </button>

      {/* AI sub-menu */}
      {showAI && (
        <div className="navbar__ai-menu">
          {AI_TABS.map(tab => (
            <button
              key={tab.id}
              className={'navbar__ai-tab' + (current === tab.id ? ' active' : '')}
              onClick={() => { navigate(tab.id); setShowAI(false); }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}
