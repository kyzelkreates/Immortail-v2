// ================================================================
// IMMORTAIL™ MVP — COMPANION RENDERER
// Pure CSS/SVG companion. No Three.js. Emotion-driven animations.
// Lightweight, offline-first, mobile-ready.
// ================================================================

import React, { useEffect, useRef } from 'react';
import { EMOTION } from '../core/dogService.js';

// Emotion → visual config
const EMOTION_CONFIG = {
  [EMOTION.CALM]:    { eyeScale: 1.0, blinkRate: 3500, tailSpeed: 'slow',    bodyColor: '#e8d5b7', moodColor: '#7eb8c9', label: 'calm'    },
  [EMOTION.HAPPY]:   { eyeScale: 1.2, blinkRate: 2200, tailSpeed: 'fast',    bodyColor: '#f0d9b5', moodColor: '#f4a261', label: 'happy'   },
  [EMOTION.CURIOUS]: { eyeScale: 1.35,blinkRate: 4000, tailSpeed: 'medium',  bodyColor: '#e8d5b7', moodColor: '#a8dadc', label: 'curious' },
  [EMOTION.SLEEPY]:  { eyeScale: 0.4, blinkRate: 6000, tailSpeed: 'very-slow',bodyColor:'#d4c4a8', moodColor: '#b5838d', label: 'sleepy'  },
};

export default function CompanionRenderer({ emotion = EMOTION.CALM, name = 'Luna', bonding = 0 }) {
  const cfg = EMOTION_CONFIG[emotion] || EMOTION_CONFIG[EMOTION.CALM];
  const isSleepy  = emotion === EMOTION.SLEEPY;
  const isHappy   = emotion === EMOTION.HAPPY;
  const isCurious = emotion === EMOTION.CURIOUS;

  // Breathing animation ref
  const bodyRef = useRef(null);

  return (
    <div className="companion-wrap" style={{ '--mood-color': cfg.moodColor }}>
      {/* Mood aura */}
      <div className="companion-aura" style={{ background: cfg.moodColor }} />

      {/* SVG Dog */}
      <svg
        className={`companion-svg ${emotion}`}
        viewBox="0 0 200 220"
        xmlns="http://www.w3.org/2000/svg"
        aria-label={`${name} the companion`}
      >
        {/* Tail */}
        <g className={`tail tail--${cfg.tailSpeed}`}>
          <ellipse cx="155" cy="148" rx="12" ry="28"
            fill={cfg.bodyColor} transform="rotate(20 155 148)"
            style={{ transformOrigin: '155px 160px' }}
          />
        </g>

        {/* Body */}
        <ellipse ref={bodyRef} cx="100" cy="150" rx="55" ry="45"
          fill={cfg.bodyColor} className="companion-body" />

        {/* Head */}
        <circle cx="100" cy="88" r="42" fill={cfg.bodyColor} />

        {/* Ears */}
        <ellipse cx="70" cy="58" rx="14" ry="22" fill={cfg.bodyColor}
          transform="rotate(-15 70 58)" />
        <ellipse cx="130" cy="58" rx="14" ry="22" fill={cfg.bodyColor}
          transform="rotate(15 130 58)" />
        {/* Inner ears */}
        <ellipse cx="70"  cy="60" rx="8" ry="14" fill="#c4a882"
          transform="rotate(-15 70 60)" />
        <ellipse cx="130" cy="60" rx="8" ry="14" fill="#c4a882"
          transform="rotate(15 130 60)" />

        {/* Eyes */}
        <g className={`eyes eyes--${emotion}`}>
          {isSleepy ? (
            <>
              {/* Sleepy closed eyes */}
              <path d="M 80 88 Q 87 84 94 88" stroke="#2d1f0f" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <path d="M 106 88 Q 113 84 120 88" stroke="#2d1f0f" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              {/* Zzz */}
              <text x="128" y="72" fontSize="10" fill={cfg.moodColor} className="zzz-text">z</text>
              <text x="134" y="64" fontSize="12" fill={cfg.moodColor} className="zzz-text" style={{animationDelay:'0.4s'}}>z</text>
              <text x="141" y="55" fontSize="14" fill={cfg.moodColor} className="zzz-text" style={{animationDelay:'0.8s'}}>z</text>
            </>
          ) : (
            <>
              {/* Open eyes */}
              <circle cx="87" cy="88" r={8 * cfg.eyeScale} fill="#2d1f0f" />
              <circle cx="113" cy="88" r={8 * cfg.eyeScale} fill="#2d1f0f" />
              {/* Shine */}
              <circle cx="90" cy="85" r="2.5" fill="white" />
              <circle cx="116" cy="85" r="2.5" fill="white" />
              {/* Curious head tilt indicator */}
              {isCurious && (
                <path d="M 122 74 Q 128 70 134 74" stroke={cfg.moodColor}
                  strokeWidth="2" fill="none" strokeLinecap="round" />
              )}
            </>
          )}
        </g>

        {/* Nose */}
        <ellipse cx="100" cy="102" rx="7" ry="5" fill="#c4786e" />

        {/* Mouth */}
        {isHappy ? (
          <path d="M 88 112 Q 100 124 112 112" stroke="#8b5e3c"
            strokeWidth="2" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M 92 112 Q 100 118 108 112" stroke="#8b5e3c"
            strokeWidth="1.5" fill="none" strokeLinecap="round" />
        )}

        {/* Paws */}
        <ellipse cx="74"  cy="188" rx="16" ry="10" fill={cfg.bodyColor} />
        <ellipse cx="126" cy="188" rx="16" ry="10" fill={cfg.bodyColor} />
        <circle cx="68"  cy="186" r="4" fill="#c4a882" />
        <circle cx="80"  cy="190" r="4" fill="#c4a882" />
        <circle cx="120" cy="190" r="4" fill="#c4a882" />
        <circle cx="132" cy="186" r="4" fill="#c4a882" />

        {/* Happy sparkles */}
        {isHappy && (
          <g className="sparkles">
            <text x="40"  y="60" fontSize="14" className="sparkle s1">✨</text>
            <text x="148" y="68" fontSize="14" className="sparkle s2">✨</text>
            <text x="30"  y="110" fontSize="10" className="sparkle s3">⭐</text>
          </g>
        )}
      </svg>

      {/* Emotion label */}
      <div className="companion-emotion-label" style={{ color: cfg.moodColor }}>
        {cfg.label}
      </div>

      {/* Bonding indicator */}
      <div className="bonding-bar-wrap">
        <div className="bonding-bar">
          <div
            className="bonding-fill"
            style={{ width: `${bonding}%`, background: cfg.moodColor }}
          />
        </div>
        <span className="bonding-label">bond {bonding}%</span>
      </div>
    </div>
  );
}
