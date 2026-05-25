// ================================================================
// IMMORTAIL™ Run 21 — VOICE ORB
// Central animated orb. Reacts to session state + mic level.
// CSS-only animations — no canvas, no external libs.
// ================================================================

import React, { useMemo } from 'react';

const STATE_STYLES = {
  idle:       { color1: '#2d1b69', color2: '#4c2a85', glow: '#7c3aed33', pulse: false },
  listening:  { color1: '#1e3a5f', color2: '#2563eb', glow: '#3b82f699', pulse: true  },
  processing: { color1: '#3d2906', color2: '#92400e', glow: '#f59e0b66', pulse: true  },
  speaking:   { color1: '#1a3a1a', color2: '#166534', glow: '#22c55e88', pulse: true  },
  paused:     { color1: '#1c1c2e', color2: '#312e81', glow: '#6366f133', pulse: false },
  error:      { color1: '#3b0f0f', color2: '#7f1d1d', glow: '#ef444466', pulse: false },
};

export default function VoiceOrb({ state = 'idle', micLevel = 0, size = 160, onClick }) {
  const style  = STATE_STYLES[state] ?? STATE_STYLES.idle;
  const scale  = 1 + micLevel * 0.12;
  const glowSize = 16 + micLevel * 40;

  const dynamicStyle = useMemo(() => ({
    width:  size,
    height: size,
    transform: `scale(${scale})`,
    boxShadow: `0 0 ${glowSize}px ${glowSize / 2}px ${style.glow}, 0 0 60px 20px ${style.glow}55`,
    background: `radial-gradient(circle at 35% 35%, ${style.color2}, ${style.color1})`,
    transition: 'transform 0.08s ease-out, box-shadow 0.15s ease-out, background 0.5s ease',
    willChange: 'transform, box-shadow',
  }), [state, micLevel, size]);

  return (
    <div
      className={`voice-orb ${style.pulse ? 'voice-orb--pulse' : ''} voice-orb--${state}`}
      style={dynamicStyle}
      onClick={onClick}
      role="button"
      aria-label={`Voice orb — ${state}`}
    >
      {/* Inner ring layers */}
      <div className="voice-orb__ring voice-orb__ring--1" />
      <div className="voice-orb__ring voice-orb__ring--2" />
      <div className="voice-orb__ring voice-orb__ring--3" />

      {/* State icon */}
      <div className="voice-orb__icon">
        {state === 'idle'       && <span>🐾</span>}
        {state === 'listening'  && <span>👂</span>}
        {state === 'processing' && <span className="voice-orb__spin">⚙️</span>}
        {state === 'speaking'   && <span>💬</span>}
        {state === 'paused'     && <span>⏸</span>}
        {state === 'error'      && <span>⚠️</span>}
      </div>

      {/* Particle layer */}
      {style.pulse && (
        <div className="voice-orb__particles">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="voice-orb__particle" style={{ '--i': i }} />
          ))}
        </div>
      )}
    </div>
  );
}
