// ================================================================
// IMMORTAIL™ — COMPANION SCREEN
// Visual companion container. 3D injected here later.
// Emotion/state display bridge. NO ENGINE LOGIC.
// ================================================================

import React from 'react';
import { useDogState }     from '../hooks/useDogState.js';
import { useEventBus }     from '../hooks/useEventBus.js';
import { CompanionLayout } from '../layouts/CompanionLayout.jsx';
import { MainLayout }      from '../layouts/MainLayout.jsx';
import {
  emotionToEmoji, formatBondingTier, formatLabel,
  formatPercent, formatRelativeTime,
} from '../utils/formatters.js';
import { mapEmotionToDisplay, toBarWidth } from '../utils/uiHelpers.js';

export function CompanionScreen({ onNavigate }) {
  const dogState = useDogState();
  const [emotionEvent, setEmotionEvent] = React.useState(null);

  useEventBus('EMOTION_CHANGED', (payload) => {
    setEmotionEvent(payload);
  });

  const emotionDisplay = mapEmotionToDisplay({
    dominantEmotion: dogState?.dominantEmotion || emotionEvent?.emotionType,
    intensity:       dogState?.intensity       || emotionEvent?.intensity || 0,
  });

  const infoPanel = (
    <CompanionInfoPanel
      dogState={dogState}
      emotionDisplay={emotionDisplay}
      onNavigate={onNavigate}
    />
  );

  return (
    <MainLayout screen="companion" onNavigate={onNavigate}>
      <CompanionLayout infoPanel={infoPanel}>
        {/* 3D Viewport placeholder — canvas injected by Run 10+ */}
        <div style={styles.canvasPlaceholder}>
          <div style={styles.placeholderInner} className="glass">
            <span style={styles.placeholderIcon}>🐾</span>
            <span style={styles.placeholderText}>
              Companion visualization initializing…
            </span>
            {dogState?.profileId && (
              <span style={styles.profileId} className="font-mono">
                Profile: {dogState.profileId.slice(0, 12)}…
              </span>
            )}
          </div>
        </div>
      </CompanionLayout>
    </MainLayout>
  );
}

// ── Companion Info Panel ─────────────────────────────────────────

function CompanionInfoPanel({ dogState, emotionDisplay, onNavigate }) {
  return (
    <div>
      {/* Emotion bar */}
      <div style={styles.emotionRow}>
        <span style={styles.emotionEmoji}>
          {emotionToEmoji(emotionDisplay.label)}
        </span>
        <div style={styles.emotionInfo}>
          <span style={{ ...styles.emotionLabel, color: emotionDisplay.color }}>
            {formatLabel(emotionDisplay.label)}
          </span>
          <div style={styles.emotionBarTrack}>
            <div style={{
              ...styles.emotionBarFill,
              width:      toBarWidth(emotionDisplay.intensity),
              background: emotionDisplay.color,
            }} />
          </div>
        </div>
        <span style={styles.emotionPercent}>
          {formatPercent(emotionDisplay.intensity)}
        </span>
      </div>

      {/* Divider */}
      <div className="divider" style={{ margin: 'var(--space-3) 0' }} />

      {/* Bond tier */}
      <div style={styles.bondRow}>
        <span style={styles.bondLabel}>Bond</span>
        <span style={styles.bondValue}>
          {formatBondingTier(dogState?.bondingTier || 'stranger')}
        </span>
      </div>

      {/* Memory button shortcut */}
      <button
        className="btn btn-ghost"
        style={styles.memoryBtn}
        onClick={() => onNavigate?.('memory')}
      >
        💭 View Memory
      </button>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────

const styles = {
  canvasPlaceholder: {
    width:  '100%',
    height: '100%',
    display: 'flex',
    alignItems:     'center',
    justifyContent: 'center',
  },
  placeholderInner: {
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    gap:           'var(--space-3)',
    padding:       'var(--space-8)',
    borderRadius:  'var(--radius-xl)',
    textAlign:     'center',
  },
  placeholderIcon: { fontSize: 48 },
  placeholderText: { color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' },
  profileId: { color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' },
  emotionRow: {
    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
  },
  emotionEmoji:   { fontSize: 24 },
  emotionInfo:    { flex: 1 },
  emotionLabel: {
    fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semi)',
    display: 'block', marginBottom: 4,
  },
  emotionBarTrack: {
    height: 4, borderRadius: 'var(--radius-full)',
    background: 'var(--color-bg-elevated)', overflow: 'hidden',
  },
  emotionBarFill: {
    height: '100%', borderRadius: 'var(--radius-full)',
    transition: 'width 0.6s ease',
  },
  emotionPercent: { fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' },
  bondRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 'var(--space-3)',
  },
  bondLabel: { fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' },
  bondValue: { fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semi)', color: 'var(--color-text-primary)' },
  memoryBtn: { width: '100%', justifyContent: 'center' },
};
