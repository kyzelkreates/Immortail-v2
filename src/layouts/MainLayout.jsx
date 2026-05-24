// ================================================================
// IMMORTAIL™ — MAIN LAYOUT
// Base shell layout. Navigation + content area.
// NO STATE LOGIC. PRESENTATION STRUCTURE ONLY.
// ================================================================

import React from 'react';
import { cx } from '../utils/uiHelpers.js';

/**
 * MainLayout — wraps all primary screens.
 * Composes top bar, bottom mobile nav, and content slot.
 */
export function MainLayout({ children, screen, onNavigate, systemStatus }) {
  return (
    <div className="main-layout" style={styles.root}>
      {/* Top bar */}
      <header className="glass" style={styles.topBar}>
        <div style={styles.topBarInner}>
          <span style={styles.wordmark}>IMMORTAIL™</span>
          <div style={styles.statusArea}>
            {systemStatus && (
              <span className={cx('status-pill', systemStatus)}>
                {systemStatus}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Content area */}
      <main className="has-bottom-nav" style={styles.content}>
        {children}
      </main>

      {/* Bottom navigation — mobile first */}
      <BottomNav active={screen} onNavigate={onNavigate} />
    </div>
  );
}

// ── Bottom Nav ───────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'home',      label: 'Home',      icon: '🏠' },
  { id: 'companion', label: 'Companion', icon: '🐾' },
  { id: 'dashboard', label: 'Status',    icon: '📊' },
  { id: 'memory',    label: 'Memory',    icon: '💭' },
  { id: 'settings',  label: 'Settings',  icon: '⚙️' },
];

function BottomNav({ active, onNavigate }) {
  return (
    <nav className="glass" style={styles.bottomNav} role="navigation" aria-label="Main navigation">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          style={{
            ...styles.navItem,
            ...(active === item.id ? styles.navItemActive : {}),
          }}
          onClick={() => onNavigate?.(item.id)}
          aria-current={active === item.id ? 'page' : undefined}
          aria-label={item.label}
        >
          <span style={styles.navIcon}>{item.icon}</span>
          <span style={{
            ...styles.navLabel,
            color: active === item.id
              ? 'var(--color-accent-primary)'
              : 'var(--color-text-muted)',
          }}>
            {item.label}
          </span>
        </button>
      ))}
    </nav>
  );
}

// ── Styles ───────────────────────────────────────────────────────

const styles = {
  root: {
    display:       'flex',
    flexDirection: 'column',
    minHeight:     '100dvh',
    background:    'var(--color-bg-deep)',
  },
  topBar: {
    position:   'sticky',
    top:        0,
    zIndex:     'var(--z-raised)',
    borderBottom: '1px solid var(--color-border-subtle)',
    borderRadius: 0,
  },
  topBarInner: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '0 var(--space-4)',
    height:         'var(--nav-height)',
    maxWidth:       'var(--content-max-width)',
    margin:         '0 auto',
    width:          '100%',
  },
  wordmark: {
    fontFamily:    'var(--font-mono)',
    fontSize:      'var(--font-size-sm)',
    fontWeight:    'var(--font-weight-bold)',
    letterSpacing: 'var(--letter-spacing-wide)',
    color:         'var(--color-accent-primary)',
  },
  statusArea: {
    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
  },
  content: {
    flex:    1,
    display: 'flex',
    flexDirection: 'column',
  },
  bottomNav: {
    position:      'fixed',
    bottom:        0,
    left:          0,
    right:         0,
    display:       'flex',
    alignItems:    'center',
    justifyContent:'space-around',
    height:        'var(--nav-height)',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    borderTop:     '1px solid var(--color-border-subtle)',
    borderRadius:  0,
    zIndex:        'var(--z-raised)',
  },
  navItem: {
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    justifyContent:'center',
    gap:           '2px',
    flex:          1,
    height:        '100%',
    background:    'none',
    border:        'none',
    cursor:        'pointer',
    padding:       'var(--space-1)',
    transition:    'opacity var(--transition-fast)',
  },
  navItemActive: {
    background: 'rgba(79, 156, 249, 0.07)',
  },
  navIcon: {
    fontSize: '18px',
    lineHeight: 1,
  },
  navLabel: {
    fontSize:    'var(--font-size-xs)',
    fontWeight:  'var(--font-weight-medium)',
    transition:  'color var(--transition-fast)',
  },
};
