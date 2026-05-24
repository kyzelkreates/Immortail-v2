// ================================================================
// IMMORTAIL™ — DASHBOARD LAYOUT
// Two-panel layout for status/debug screens.
// NO STATE LOGIC. STRUCTURE ONLY.
// ================================================================

import React from 'react';

/**
 * DashboardLayout — header + scrollable content area.
 * Used by DashboardScreen and SettingsScreen.
 */
export function DashboardLayout({ title, subtitle, children, headerAction }) {
  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          {title    && <h2 style={styles.title}>{title}</h2>}
          {subtitle && <p  style={styles.subtitle}>{subtitle}</p>}
        </div>
        {headerAction && <div>{headerAction}</div>}
      </div>

      {/* Divider */}
      <div className="divider" />

      {/* Scrollable content */}
      <div style={styles.body}>
        {children}
      </div>
    </div>
  );
}

const styles = {
  root: {
    display:       'flex',
    flexDirection: 'column',
    flex:           1,
    padding:       'var(--space-6) var(--space-4)',
    maxWidth:      'var(--content-max-width)',
    margin:        '0 auto',
    width:         '100%',
  },
  header: {
    display:        'flex',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    marginBottom:   'var(--space-4)',
  },
  title: {
    fontSize:      'var(--font-size-2xl)',
    fontWeight:    'var(--font-weight-semi)',
    color:         'var(--color-text-primary)',
    letterSpacing: 'var(--letter-spacing-tight)',
    marginBottom:  'var(--space-1)',
  },
  subtitle: {
    fontSize: 'var(--font-size-sm)',
    color:    'var(--color-text-muted)',
  },
  body: {
    flex:      1,
    overflowY: 'auto',
  },
};
