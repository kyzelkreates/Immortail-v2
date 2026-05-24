// ================================================================
// IMMORTAIL™ — LOADING SCREEN
// Boot state visualization. No engine logic.
// ================================================================

import React from 'react';
import { formatBootStage } from '../utils/formatters.js';
import { mapBootStateToUI } from '../utils/uiHelpers.js';

export function LoadingScreen({ bootState }) {
  const ui = mapBootStateToUI(bootState);

  return (
    <div className="screen flex-center screen-enter" style={styles.root}>
      <div style={styles.card} className="glass">
        {/* Logo */}
        <div style={styles.logoWrap}>
          <div style={styles.logoPulse} className="glow-pulse" />
          <span style={styles.logoText}>IMMORTAIL™</span>
        </div>

        {/* Status label */}
        <p style={styles.stage}>{ui.label}</p>

        {/* Progress bar */}
        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressFill,
              width: `${ui.progress}%`,
              background: ui.status === 'error'
                ? 'var(--color-error)'
                : 'var(--color-accent-primary)',
            }}
          />
        </div>

        <p style={styles.percent}>{ui.progress}%</p>
      </div>
    </div>
  );
}

const styles = {
  root: {
    flexDirection: 'column',
    background:    'var(--color-bg-deep)',
    minHeight:     '100dvh',
  },
  card: {
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    gap:           'var(--space-5)',
    padding:       'var(--space-10) var(--space-8)',
    borderRadius:  'var(--radius-xl)',
    minWidth:      280,
    maxWidth:      340,
    width:         '90%',
  },
  logoWrap: {
    display:    'flex',
    alignItems: 'center',
    gap:        'var(--space-3)',
  },
  logoPulse: {
    width:        12,
    height:       12,
    borderRadius: '50%',
    background:   'var(--color-accent-primary)',
  },
  logoText: {
    fontFamily:    'var(--font-mono)',
    fontSize:      'var(--font-size-lg)',
    fontWeight:    'var(--font-weight-bold)',
    color:         'var(--color-accent-primary)',
    letterSpacing: 'var(--letter-spacing-wide)',
  },
  stage: {
    fontSize:  'var(--font-size-sm)',
    color:     'var(--color-text-secondary)',
    textAlign: 'center',
    minHeight: '1.5em',
  },
  progressTrack: {
    width:        '100%',
    height:       4,
    borderRadius: 'var(--radius-full)',
    background:   'var(--color-bg-elevated)',
    overflow:     'hidden',
  },
  progressFill: {
    height:       '100%',
    borderRadius: 'var(--radius-full)',
    transition:   'width 0.4s ease, background 0.3s ease',
  },
  percent: {
    fontSize: 'var(--font-size-xs)',
    color:    'var(--color-text-muted)',
    fontFamily: 'var(--font-mono)',
  },
};
