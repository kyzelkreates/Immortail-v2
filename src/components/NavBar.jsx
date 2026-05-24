import React from 'react';

const TABS = [
  { id: 'home',     label: 'Home',     icon: '🐾' },
  { id: 'memory',   label: 'Memory',   icon: '📖' },
  { id: 'media',    label: 'Media',    icon: '📷' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export default function NavBar({ current, navigate }) {
  return (
    <nav className="navbar">
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={'nav-tab' + (current === tab.id ? ' active' : '')}
          onClick={() => navigate(tab.id)}
          aria-label={tab.label}
        >
          <span className="nav-icon">{tab.icon}</span>
          <span className="nav-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
