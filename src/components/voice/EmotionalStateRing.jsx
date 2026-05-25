// ================================================================
// IMMORTAIL™ Run 21 — EMOTIONAL STATE RING
// Glowing ring that changes colour based on detected emotion.
// Wraps VoiceOrb for the outer aura effect.
// ================================================================

import React, { useMemo } from 'react';

const EMOTION_RING = {
  happy:      { color: '#fbbf24', glow: '#fbbf2466', label: '😊 Happy'    },
  excited:    { color: '#f97316', glow: '#f9731666', label: '🔥 Excited'  },
  sad:        { color: '#60a5fa', glow: '#60a5fa55', label: '💙 Sad'      },
  anxious:    { color: '#a78bfa', glow: '#a78bfa55', label: '😰 Anxious'  },
  angry:      { color: '#f87171', glow: '#f8717166', label: '😤 Tense'    },
  calm:       { color: '#4ade80', glow: '#4ade8055', label: '🌿 Calm'     },
  curious:    { color: '#34d399', glow: '#34d39955', label: '🔭 Curious'  },
  comforting: { color: '#f9a8d4', glow: '#f9a8d455', label: '🤗 Comfort'  },
  urgent:     { color: '#fb923c', glow: '#fb923c66', label: '⚡ Urgent'   },
  neutral:    { color: '#6b7280', glow: '#6b728033', label: '○ Neutral'   },
};

export default function EmotionalStateRing({ emotion = 'neutral', size = 200, children }) {
  const ring    = EMOTION_RING[emotion] ?? EMOTION_RING.neutral;
  const ringSize = size + 24;

  const ringStyle = useMemo(() => ({
    width:        ringSize,
    height:       ringSize,
    borderRadius: '50%',
    border:       `2px solid ${ring.color}44`,
    boxShadow:    `0 0 24px 6px ${ring.glow}, inset 0 0 16px 4px ${ring.glow}`,
    background:   `radial-gradient(ellipse at center, ${ring.glow} 0%, transparent 70%)`,
    transition:   'border-color 0.8s ease, box-shadow 0.8s ease, background 0.8s ease',
    display:      'flex',
    alignItems:   'center',
    justifyContent: 'center',
    position:     'relative',
  }), [emotion, size]);

  return (
    <div className="emotion-ring" style={ringStyle}>
      {children}
      <div className="emotion-ring__label" style={{ color: ring.color }}>
        {ring.label}
      </div>
    </div>
  );
}
