// ================================================================
// IMMORTAIL™ — MEMORY SCREEN (Run 3 upgrade)
// /companion/memoryTimeline
// Reads ONLY from companionCore.memory (storage SSOT).
// Shows chat events, media events, emotional shifts, timestamps.
// ================================================================

import React, { useState } from 'react';
import useCompanionCore from '../hooks/useCompanionCore.js';
import { formatMemoryDate } from '../core/memoryService.js';

// ── Category config ───────────────────────────────────────────────

const CATEGORY_TABS = [
  { id: 'all',         label: 'All',       icon: '🕰️' },
  { id: 'interaction', label: 'Interact',  icon: '🐾' },
  { id: 'chat',        label: 'Chat',      icon: '💬' },
  { id: 'media',       label: 'Media',     icon: '📷' },
  { id: 'emotion',     label: 'Emotion',   icon: '❤️' },
];

const TYPE_ICONS = {
  pet:       '🐾',
  play:      '🎾',
  talk:      '💬',
  rest:      '💤',
  chat:      '💬',
  image:     '📸',
  audio:     '🎙️',
  video:     '🎬',
  emotion:   '❤️',
  milestone: '🌟',
  system:    '⚙️',
};

const MOOD_COLORS = {
  neutral:  '#7eb8c9',
  happy:    '#f4a261',
  curious:  '#a8dadc',
  playful:  '#f4a261',
  calm:     '#7eb8c9',
  anxious:  '#e8a87c',
  tired:    '#b5838d',
  excited:  '#ffd166',
  waiting:  '#8b8b9e',
};

export default function MemoryScreen() {
  const { memory, mediaMemory, identity, emotionalState } = useCompanionCore();

  const [activeTab, setActiveTab] = useState('all');

  // Filter from companionCore.memory — SSOT only
  const filtered = activeTab === 'all'
    ? [...memory].reverse()
    : [...memory].reverse().filter(m =>
        activeTab === 'media'
          ? ['image', 'audio', 'video'].includes(m.type)
          : m.category === activeTab
      );

  const moodColor = MOOD_COLORS[identity.mood] || '#7eb8c9';

  return (
    <div className="screen memory-screen">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="screen-header">
        <h1>Memory Timeline</h1>
        <p className="screen-subtitle">
          {memory.length > 0
            ? `${memory.length} moment${memory.length !== 1 ? 's' : ''} · ${mediaMemory.length} media`
            : 'Your story begins here'}
        </p>
      </header>

      {/* ── Identity summary card ────────────────────────────── */}
      <div className="core-summary-card" style={{ borderColor: moodColor + '44' }}>
        <div className="core-summary-row">
          <span className="core-summary-label">Identity</span>
          <span className="core-summary-val">{identity.name}</span>
        </div>
        <div className="core-summary-row">
          <span className="core-summary-label">Mood</span>
          <span className="core-summary-val" style={{ color: moodColor }}>{identity.mood}</span>
        </div>
        <div className="core-summary-row">
          <span className="core-summary-label">Energy</span>
          <span className="core-summary-val">{identity.energy}/100</span>
        </div>
        <div className="core-summary-row">
          <span className="core-summary-label">Trust</span>
          <span className="core-summary-val">{identity.trust}/100</span>
        </div>
        <div className="core-summary-row">
          <span className="core-summary-label">Valence</span>
          <span className="core-summary-val" style={{
            color: emotionalState.valence >= 0 ? '#5cb85c' : '#e05050',
          }}>{emotionalState.valence > 0 ? '+' : ''}{emotionalState.valence}</span>
        </div>
        <div className="core-summary-row">
          <span className="core-summary-label">Arousal</span>
          <span className="core-summary-val">{emotionalState.arousal}/100</span>
        </div>
      </div>

      {/* ── Timeline tab bar ─────────────────────────────────── */}
      <div className="memory-tabs">
        {CATEGORY_TABS.map(t => (
          <button
            key={t.id}
            className={'media-tab' + (activeTab === t.id ? ' active' : '')}
            onClick={() => setActiveTab(t.id)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Timeline events ───────────────────────────────────── */}
      <div className="memory-list">
        {filtered.length === 0 ? (
          <div className="memory-empty">
            <span className="memory-empty-icon">🐾</span>
            <p>No {activeTab === 'all' ? '' : activeTab + ' '}events yet.</p>
            {activeTab === 'all' && (
              <p className="memory-empty-sub">Interact, chat, or upload media to build your timeline.</p>
            )}
          </div>
        ) : (
          filtered.map((m) => (
            <TimelineCard key={m.id} event={m} />
          ))
        )}
      </div>
    </div>
  );
}

// ── Individual timeline card ──────────────────────────────────────

function TimelineCard({ event }) {
  const icon     = TYPE_ICONS[event.type] || '•';
  const moodClr  = MOOD_COLORS[event.mood] || '#5a5570';
  const isMood   = event.category === 'emotion';
  const isMedia  = ['image', 'audio', 'video'].includes(event.type);

  return (
    <div className={`memory-card timeline-card ${isMedia ? 'timeline-media' : ''}`}>
      {/* Left: icon + type stripe */}
      <div className="memory-icon" style={{ color: moodClr }}>
        {icon}
      </div>

      {/* Content */}
      <div className="memory-content">
        <p className="memory-label">{event.label || event.type}</p>

        <p className="memory-meta">
          {event.mood && (
            <span className="meta-mood" style={{ color: moodClr }}>
              {event.mood}
            </span>
          )}
          {event.mood && event.behaviour && <span className="meta-sep"> · </span>}
          {event.behaviour && (
            <span className="meta-behaviour">{event.behaviour}</span>
          )}
          {event.sentiment && (
            <span className={`meta-sentiment sentiment-${event.sentiment}`}>
              {' '}· {event.sentiment}
            </span>
          )}
        </p>

        {/* Chat preview */}
        {event.type === 'chat' && event.text && (
          <p className="memory-chat-preview">
            "{event.text.slice(0, 80)}{event.text.length > 80 ? '…' : ''}"
          </p>
        )}
      </div>

      {/* Timestamp */}
      <div className="memory-time">
        {formatMemoryDate(event.ts)}
      </div>
    </div>
  );
}
