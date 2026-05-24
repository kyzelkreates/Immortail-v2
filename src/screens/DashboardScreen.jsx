// ================================================================
// IMMORTAIL™ — DASHBOARD SCREEN
// Runtime state summary, system health view.
// READ-ONLY. NO ENGINE LOGIC.
// ================================================================

import React from 'react';
import { useRuntimeState } from '../hooks/useRuntimeState.js';
import { useAppState }     from '../hooks/useAppState.js';
import { useEventBus }     from '../hooks/useEventBus.js';
import { MainLayout }      from '../layouts/MainLayout.jsx';
import { DashboardLayout } from '../layouts/DashboardLayout.jsx';
import { formatRelativeTime, formatBootStage, formatLabel } from '../utils/formatters.js';
import { mapSystemHealth, cx } from '../utils/uiHelpers.js';

export function DashboardScreen({ onNavigate }) {
  const runtime    = useRuntimeState();
  const appState   = useAppState();
  const [lastEvent, setLastEvent] = React.useState(null);

  const systemStatus = mapSystemHealth(runtime);

  useEventBus(
    ['DOG_STATE_UPDATED', 'EMOTION_CHANGED', 'MEMORY_CREATED', 'RECONSTRUCTION_COMPLETE'],
    (payload) => setLastEvent({ type: payload?.type || 'event', timestamp: Date.now() })
  );

  const modules = appState?.activeModules || {};
  const moduleList = Object.entries(modules);

  return (
    <MainLayout screen="dashboard" onNavigate={onNavigate} systemStatus={systemStatus}>
      <DashboardLayout
        title="System Status"
        subtitle="Runtime state and health overview"
      >
        {/* System health */}
        <section style={styles.section}>
          <h4 style={styles.sectionTitle}>Runtime</h4>
          <div className="card" style={styles.infoGrid}>
            <InfoRow label="Status"    value={<span className={cx('status-pill', systemStatus)}>{systemStatus}</span>} />
            <InfoRow label="Boot stage" value={formatBootStage(runtime?.bootStage)} />
            <InfoRow label="Ready"      value={appState?.ready ? '✅ Yes' : '⏳ No'} />
            <InfoRow label="Boot time"  value={appState?.timestamps?.bootCompletedAt ? formatRelativeTime(appState.timestamps.bootCompletedAt) : '—'} />
            <InfoRow label="Version"    value={runtime?.version || '—'} />
            <InfoRow label="Build"      value={runtime?.build || '—'} />
          </div>
        </section>

        {/* Active modules */}
        {moduleList.length > 0 && (
          <section style={styles.section}>
            <h4 style={styles.sectionTitle}>Active Modules ({moduleList.length})</h4>
            <div className="card" style={{ padding: 'var(--space-3) var(--space-4)' }}>
              {moduleList.map(([name]) => (
                <div key={name} style={styles.moduleRow}>
                  <span style={styles.moduleDot} />
                  <span style={styles.moduleName}>{formatLabel(name)}</span>
                  <span className="status-pill ready" style={{ fontSize: '10px', padding: '1px 6px' }}>active</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Event feed */}
        <section style={styles.section}>
          <h4 style={styles.sectionTitle}>Last Event</h4>
          <div className="card">
            {lastEvent ? (
              <InfoRow label={lastEvent.type} value={formatRelativeTime(lastEvent.timestamp)} />
            ) : (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                No events received yet.
              </p>
            )}
          </div>
        </section>

        {/* Flags */}
        <section style={styles.section}>
          <h4 style={styles.sectionTitle}>Flags</h4>
          <div className="card" style={styles.infoGrid}>
            {Object.entries(appState?.flags || {}).map(([flag, val]) => (
              <InfoRow key={flag} label={formatLabel(flag)} value={val ? '✅' : '❌'} />
            ))}
            {!Object.keys(appState?.flags || {}).length && (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>No flags.</p>
            )}
          </div>
        </section>
      </DashboardLayout>
    </MainLayout>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={styles.infoValue}>{value}</span>
    </div>
  );
}

const styles = {
  section:      { marginBottom: 'var(--space-6)' },
  sectionTitle: {
    fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semi)',
    color: 'var(--color-text-muted)', letterSpacing: 'var(--letter-spacing-wide)',
    textTransform: 'uppercase', marginBottom: 'var(--space-2)',
  },
  infoGrid: { display: 'flex', flexDirection: 'column', gap: 0, padding: 'var(--space-2) var(--space-4)' },
  infoRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border-subtle)',
  },
  infoLabel: { fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' },
  infoValue: { fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)', textAlign: 'right' },
  moduleRow: {
    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
    padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border-subtle)',
  },
  moduleDot: {
    width: 6, height: 6, borderRadius: '50%',
    background: 'var(--color-success)', flexShrink: 0,
  },
  moduleName: { fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', flex: 1 },
};
