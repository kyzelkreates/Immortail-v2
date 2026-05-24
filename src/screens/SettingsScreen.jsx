// ================================================================
// IMMORTAIL™ — SETTINGS SCREEN
// System configuration UI. READ-ONLY display + service calls only.
// NO ENGINE LOGIC.
// ================================================================

import React from 'react';
import { useRuntimeState } from '../hooks/useRuntimeState.js';
import { useAppState }     from '../hooks/useAppState.js';
import { MainLayout }      from '../layouts/MainLayout.jsx';
import { DashboardLayout } from '../layouts/DashboardLayout.jsx';
import { formatLabel, formatRelativeTime } from '../utils/formatters.js';
import { mapSystemHealth, cx } from '../utils/uiHelpers.js';

export function SettingsScreen({ onNavigate, onServiceCall }) {
  const runtime  = useRuntimeState();
  const appState = useAppState();
  const status   = mapSystemHealth(runtime);

  return (
    <MainLayout screen="settings" onNavigate={onNavigate} systemStatus={status}>
      <DashboardLayout title="Settings" subtitle="System configuration">

        {/* Runtime info */}
        <section style={styles.section}>
          <h4 style={styles.sectionTitle}>Runtime Info</h4>
          <div className="card">
            <SettingRow label="Version"     value={runtime?.version     || '—'} />
            <SettingRow label="Build"       value={runtime?.build       || '—'} />
            <SettingRow label="Environment" value={runtime?.environment?.platform || '—'} />
            <SettingRow label="Mode"        value={runtime?.mode        || '—'} />
          </div>
        </section>

        {/* Storage info */}
        <section style={styles.section}>
          <h4 style={styles.sectionTitle}>Storage</h4>
          <div className="card">
            <SettingRow label="Schema version"    value={appState?.activeModules?.storage?.version    || '—'} />
            <SettingRow label="Storage ready"     value={appState?.flags?.storageReady     ? '✅' : '❌'} />
            <SettingRow label="Scheduler ready"   value={appState?.flags?.schedulerReady   ? '✅' : '❌'} />
            <SettingRow label="Recovery ready"    value={appState?.flags?.recoveryReady    ? '✅' : '❌'} />
          </div>
        </section>

        {/* System actions */}
        <section style={styles.section}>
          <h4 style={styles.sectionTitle}>Actions</h4>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <ActionButton
              label="Export System State"
              desc="Download a JSON snapshot of current runtime state"
              onClick={() => onServiceCall?.('exportState')}
            />
            <ActionButton
              label="Clear Session"
              desc="Reset the current session (will reboot)"
              danger
              onClick={() => onServiceCall?.('clearSession')}
            />
          </div>
        </section>

        {/* About */}
        <section style={styles.section}>
          <div className="card" style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              IMMORTAIL™ — Run 9 Build<br />
              Strict SSOT Architecture
            </p>
          </div>
        </section>

      </DashboardLayout>
    </MainLayout>
  );
}

function SettingRow({ label, value }) {
  return (
    <div style={styles.settingRow}>
      <span style={styles.settingLabel}>{label}</span>
      <span style={styles.settingValue}>{value}</span>
    </div>
  );
}

function ActionButton({ label, desc, onClick, danger }) {
  return (
    <button
      style={{
        ...styles.actionBtn,
        ...(danger ? styles.actionBtnDanger : {}),
      }}
      onClick={onClick}
    >
      <span style={styles.actionLabel}>{label}</span>
      <span style={styles.actionDesc}>{desc}</span>
    </button>
  );
}

const styles = {
  section:      { marginBottom: 'var(--space-6)' },
  sectionTitle: {
    fontSize:      'var(--font-size-xs)', fontWeight: 'var(--font-weight-semi)',
    color:         'var(--color-text-muted)', letterSpacing: 'var(--letter-spacing-wide)',
    textTransform: 'uppercase', marginBottom: 'var(--space-2)',
  },
  settingRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: 'var(--space-2) var(--space-4)',
    borderBottom: '1px solid var(--color-border-subtle)',
  },
  settingLabel: { fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' },
  settingValue: { fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' },
  actionBtn: {
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'flex-start',
    gap:           'var(--space-1)',
    width:         '100%',
    background:    'var(--color-bg-elevated)',
    border:        '1px solid var(--color-border-muted)',
    borderRadius:  'var(--radius-md)',
    padding:       'var(--space-3) var(--space-4)',
    cursor:        'pointer',
    textAlign:     'left',
    transition:    'border-color var(--transition-base)',
    fontFamily:    'inherit',
  },
  actionBtnDanger: { borderColor: 'rgba(248, 113, 113, 0.3)' },
  actionLabel: { fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semi)', color: 'var(--color-text-primary)' },
  actionDesc:  { fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' },
};
