// ================================================================
// IMMORTAIL™ — ERROR SCREEN
// Fatal error display. No engine logic.
// ================================================================

import React from 'react';

export function ErrorScreen({ error, onRetry }) {
  const message = error?.message || error || 'An unknown error occurred.';

  return (
    <div className="screen flex-center screen-enter" style={styles.root}>
      <div style={styles.card} className="glass">
        <div style={styles.icon}>⚠️</div>
        <h3 style={styles.title}>System Error</h3>
        <p style={styles.message}>{message}</p>

        {onRetry && (
          <button className="btn btn-ghost" onClick={onRetry} style={styles.retry}>
            Retry Boot
          </button>
        )}

        <p style={styles.hint}>
          If this persists, check the browser console for details.
        </p>
      </div>
    </div>
  );
}

const styles = {
  root: {
    flexDirection: 'column',
    minHeight:     '100dvh',
    background:    'var(--color-bg-deep)',
  },
  card: {
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    gap:           'var(--space-4)',
    padding:       'var(--space-10) var(--space-8)',
    borderRadius:  'var(--radius-xl)',
    maxWidth:      360,
    width:         '90%',
    textAlign:     'center',
    borderColor:   'rgba(248, 113, 113, 0.2)',
  },
  icon:    { fontSize: 40 },
  title: {
    fontSize:   'var(--font-size-xl)',
    fontWeight: 'var(--font-weight-semi)',
    color:      'var(--color-error)',
  },
  message: {
    fontSize:  'var(--font-size-sm)',
    color:     'var(--color-text-secondary)',
    lineHeight: 'var(--line-height-base)',
    fontFamily: 'var(--font-mono)',
    background: 'var(--color-bg-elevated)',
    padding:   'var(--space-3)',
    borderRadius: 'var(--radius-md)',
    width:     '100%',
    wordBreak: 'break-word',
  },
  retry: { marginTop: 'var(--space-2)' },
  hint: {
    fontSize: 'var(--font-size-xs)',
    color:    'var(--color-text-muted)',
  },
};
