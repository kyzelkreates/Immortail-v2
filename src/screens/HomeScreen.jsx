// ================================================================
// IMMORTAIL™ — HOME SCREEN
// System overview, app status, quick navigation.
// NO ENGINE LOGIC. READ-ONLY FROM HOOKS.
// ================================================================

import React from 'react';
import { useAppState }     from '../hooks/useAppState.js';
import { useRuntimeState } from '../hooks/useRuntimeState.js';
import { useDogState }     from '../hooks/useDogState.js';
import { MainLayout }      from '../layouts/MainLayout.jsx';
import {
  formatRelativeTime,
  formatBondingTier,
  emotionToEmoji,
  formatLabel,
} from '../utils/formatters.js';
import { mapEmotionToDisplay, mapSystemHealth, cx } from '../utils/uiHelpers.js';

export function HomeScreen({ onNavigate }) {
  const appState     = useAppState();
  const runtimeState = useRuntimeState();
  const dogState     = useDogState();

  const systemStatus = mapSystemHealth(runtimeState);

  return (
    <MainLayout screen="home" onNavigate={onNavigate} systemStatus={systemStatus}>
      <div className="screen-content screen-enter">

        {/* Greeting */}
        <section style={styles.hero}>
          <h1 style={styles.heroTitle}>
            <span style={styles.heroAccent}>IMMORTAIL™</span>
          </h1>
          <p style={styles.heroSub}>Your companion lives here.</p>
        </section>

        {/* System status card */}
        <div className="card" style={styles.card}>
          <div style={styles.cardRow}>
            <span style={styles.cardLabel}>System</span>
            <span className={cx('status-pill', systemStatus)}>{systemStatus}</span>
          </div>
          <div style={styles.cardRow}>
            <span style={styles.cardLabel}>Boot time</span>
            <span style={styles.cardValue}>
              {appState?.timestamps?.bootCompletedAt
                ? formatRelativeTime(appState.timestamps.bootCompletedAt)
                : '—'}
            </span>
          </div>
          <div style={styles.cardRow}>
            <span style={styles.cardLabel}>Session</span>
            <span style={styles.cardValue} className="font-mono">
              {runtimeState?.sessionId?.slice(0, 8) || '—'}
            </span>
          </div>
        </div>

        {/* Companion quick-view */}
        {dogState?.profileId && (
          <div className="card" style={{ ...styles.card, marginTop: 'var(--space-4)' }}>
            <div style={styles.cardRow}>
              <span style={styles.cardLabel}>Companion</span>
              <button
                className="btn btn-ghost"
                style={styles.smallBtn}
                onClick={() => onNavigate?.('companion')}
              >
                View →
              </button>
            </div>
            <div style={styles.cardRow}>
              <span style={styles.cardLabel}>Bond tier</span>
              <span style={styles.cardValue}>
                {formatBondingTier(dogState?.bondingTier) || '—'}
              </span>
            </div>
            <div style={styles.cardRow}>
              <span style={styles.cardLabel}>Emotion</span>
              <span style={styles.cardValue}>
                {emotionToEmoji(dogState?.dominantEmotion)}
                {' '}
                {formatLabel(dogState?.dominantEmotion || 'neutral')}
              </span>
            </div>
          </div>
        )}

        {/* Quick nav grid */}
        <div className="grid-2" style={{ marginTop: 'var(--space-6)' }}>
          {QUICK_NAV.map((item) => (
            <button
              key={item.id}
              className="card"
              style={styles.navCard}
              onClick={() => onNavigate?.(item.id)}
            >
              <span style={styles.navCardIcon}>{item.icon}</span>
              <span style={styles.navCardLabel}>{item.label}</span>
              <span style={styles.navCardDesc}>{item.desc}</span>
            </button>
          ))}
        </div>

      </div>
    </MainLayout>
  );
}

const QUICK_NAV = [
  { id: 'companion', icon: '🐾', label: 'Companion', desc: 'View your dog' },
  { id: 'dashboard', icon: '📊', label: 'Dashboard', desc: 'System status' },
  { id: 'memory',    icon: '💭', label: 'Memory',    desc: 'Past moments' },
  { id: 'settings',  icon: '⚙️', label: 'Settings',  desc: 'Configuration' },
];

const styles = {
  hero: {
    marginBottom: 'var(--space-6)',
    paddingTop:   'var(--space-4)',
  },
  heroTitle: {
    fontSize:   'var(--font-size-3xl)',
    fontWeight: 'var(--font-weight-bold)',
    marginBottom: 'var(--space-2)',
  },
  heroAccent: { color: 'var(--color-accent-primary)' },
  heroSub:    { color: 'var(--color-text-muted)', fontSize: 'var(--font-size-base)' },
  card:       { marginTop: 0 },
  cardRow: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        'var(--space-2) 0',
    borderBottom:   '1px solid var(--color-border-subtle)',
  },
  cardLabel: { fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' },
  cardValue: { fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' },
  smallBtn:  { padding: '2px var(--space-2)', fontSize: 'var(--font-size-xs)' },
  navCard: {
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'flex-start',
    gap:           'var(--space-1)',
    cursor:        'pointer',
    textAlign:     'left',
    background:    'var(--color-bg-surface)',
    border:        '1px solid var(--color-border-subtle)',
    borderRadius:  'var(--radius-lg)',
    padding:       'var(--space-5)',
    width:         '100%',
    transition:    'border-color var(--transition-base), background var(--transition-base)',
  },
  navCardIcon:  { fontSize: 24 },
  navCardLabel: { fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semi)', color: 'var(--color-text-primary)' },
  navCardDesc:  { fontSize: 'var(--font-size-xs)',   color: 'var(--color-text-muted)' },
};
