// ================================================================
// IMMORTAIL™ Run 21 — LIVE TRANSCRIPT
// Scrolling conversation transcript with partial text indicator.
// ================================================================

import React, { useEffect, useRef } from 'react';

export default function LiveTranscript({
  transcript   = '',
  partialText  = '',
  aiResponse   = '',
  isThinking   = false,
  maxEntries   = 20,
  entries      = [],   // array of { role, text, emotion, ts }
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries, partialText, aiResponse]);

  return (
    <div className="live-transcript">
      <div className="live-transcript__header">
        <span className="live-transcript__title">Transcript</span>
        <span className="live-transcript__count">{entries.length} turns</span>
      </div>

      <div className="live-transcript__scroll">
        {entries.slice(-maxEntries).map((e, i) => (
          <div key={i} className={`live-transcript__entry live-transcript__entry--${e.role}`}>
            <div className="live-transcript__entry-header">
              <span className="live-transcript__role">
                {e.role === 'user' ? '🎙 You' : '🐾 Companion'}
              </span>
              {e.emotion && (
                <span className="live-transcript__emotion">{e.emotion}</span>
              )}
              <span className="live-transcript__ts">
                {e.ts ? new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            </div>
            <div className="live-transcript__text">{e.text}</div>
          </div>
        ))}

        {/* Partial (streaming) user text */}
        {partialText && (
          <div className="live-transcript__entry live-transcript__entry--user live-transcript__entry--partial">
            <div className="live-transcript__entry-header">
              <span className="live-transcript__role">🎙 You</span>
              <span className="live-transcript__partial-badge">live</span>
            </div>
            <div className="live-transcript__text">
              {partialText}
              <span className="live-transcript__cursor" />
            </div>
          </div>
        )}

        {/* AI thinking */}
        {isThinking && (
          <div className="live-transcript__thinking">
            <span className="live-transcript__dot" />
            <span className="live-transcript__dot" />
            <span className="live-transcript__dot" />
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
