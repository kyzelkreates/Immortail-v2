// ================================================================
// IMMORTAIL™ — COMPANION SCREEN (Run 3 rebuild)
// Unified companion interface: companion view + chat + media feed.
// Reads exclusively from useCompanionCore (→ storage.getCompanionCore()).
// NO hardcoded state. NO mock data.
// ================================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import useCompanionCore, { MOOD, BEHAVIOUR } from '../hooks/useCompanionCore.js';
import CompanionRenderer from '../components/CompanionRenderer.jsx';
import { EMOTION }       from '../core/dogService.js';

// Map core moods → CompanionRenderer EMOTION keys
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

export default function CompanionScreen() {
  const {
    identity, emotionalState, behaviourState,
    aiStatus, interact, sendMessage,
  } = useCompanionCore();

  const [chatInput, setChatInput] = useState('');
  const [chatLog,   setChatLog]   = useState([]); // session-only display log
  const inputRef = useRef(null);

  const rendererEmotion = MOOD_TO_EMOTION[identity.mood] || EMOTION.CALM;

  const handleSend = useCallback(async () => {
    const text = chatInput.trim();
    if (!text) return;

    setChatInput('');
    setChatLog(prev => [...prev, { role: 'user', text, ts: Date.now() }]);

    const result = await sendMessage(text);
    if (result?.ok && result?.text) {
      setChatLog(prev => [...prev, { role: 'companion', text: result.text, ts: Date.now() }]);
    } else if (result && !result.ok) {
      setChatLog(prev => [...prev, {
        role:   'companion',
        text:   `*${identity.name} tilts their head quietly…* (Ollama unavailable — ${result.error || 'no connection'})`,
        ts:     Date.now(),
        system: true,
      }]);
    }

    inputRef.current?.focus();
  }, [chatInput, sendMessage, identity.name]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="screen companion-screen">
      {/* ── Header ───────────────────────────────────────────── */}
      <header className="screen-header">
        <h1 className="companion-name">{identity.name}</h1>
        <p className="companion-meta">
          <span className={`mood-chip mood-${identity.mood}`}>{identity.mood}</span>
          <span className="meta-sep">·</span>
          <span>{behaviourState.current}</span>
          <span className="meta-sep">·</span>
          <span>trust {identity.trust}</span>
        </p>
      </header>

      {/* ── Companion visual ─────────────────────────────────── */}
      <div className="companion-stage">
        <CompanionRenderer
          emotion={rendererEmotion}
          name={identity.name}
          bonding={clamp100(identity.trust)}
        />
        {/* Emotional state bar */}
        <div className="emotional-state-bar">
          <div className="es-row">
            <span className="es-label">valence</span>
            <div className="es-track">
              <div
                className="es-fill"
                style={{
                  width: `${((emotionalState.valence + 100) / 200) * 100}%`,
                  background: emotionalState.valence >= 0 ? '#5cb85c' : '#e05050',
                }}
              />
            </div>
            <span className="es-val">{emotionalState.valence}</span>
          </div>
          <div className="es-row">
            <span className="es-label">arousal</span>
            <div className="es-track">
              <div
                className="es-fill"
                style={{
                  width: `${emotionalState.arousal}%`,
                  background: '#7eb8c9',
                }}
              />
            </div>
            <span className="es-val">{emotionalState.arousal}</span>
          </div>
        </div>
      </div>

      {/* ── Interaction buttons ───────────────────────────────── */}
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

      {/* ── Chat panel ───────────────────────────────────────── */}
      <div className="chat-panel">
        <div className="chat-log">
          {chatLog.length === 0 && (
            <p className="chat-empty">Say something to {identity.name}…</p>
          )}
          {chatLog.map((msg, i) => (
            <div key={i} className={`chat-bubble chat-${msg.role}${msg.system ? ' chat-system' : ''}`}>
              {msg.role === 'companion' && (
                <span className="chat-avatar">🐾</span>
              )}
              <div className="chat-text">{msg.text}</div>
            </div>
          ))}
          {aiStatus === 'thinking' && (
            <div className="chat-bubble chat-companion">
              <span className="chat-avatar">🐾</span>
              <div className="chat-thinking">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
        </div>

        <div className="chat-input-row">
          <textarea
            ref={inputRef}
            className="chat-input"
            rows={1}
            placeholder={`Talk to ${identity.name}…`}
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={!chatInput.trim() || aiStatus === 'thinking'}
            aria-label="Send"
          >
            {aiStatus === 'thinking' ? '⏳' : '➤'}
          </button>
        </div>
      </div>
    </div>
  );
}

function clamp100(v) { return Math.max(0, Math.min(100, v || 0)); }
