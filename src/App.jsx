// ================================================================
// IMMORTAIL™ — APPLICATION SHELL
// Minimal foundation visualization only.
// NO DASHBOARD. NO DOG UI. NO CHAT. NO FEATURES.
// ================================================================

import React, { useState, useEffect } from 'react';
import { getRuntimeState } from './core/runtime.js';
import { getBootState } from './core/boot.js';
import { BOOT_STAGES, RUNTIME_STATUS } from './utils/constants.js';

// ----------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------

function StatusBadge({ label, value, type = 'default' }) {
  const colors = {
    success: '#22c55e',
    error: '#ef4444',
    warn: '#f59e0b',
    default: '#94a3b8',
    info: '#60a5fa',
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 0',
      borderBottom: '1px solid #1e293b',
    }}>
      <span style={{ color: '#64748b', fontSize: '11px', minWidth: '160px', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <span style={{
        color: colors[type],
        fontSize: '12px',
        fontFamily: 'monospace',
        fontWeight: 600,
      }}>
        {value}
      </span>
    </div>
  );
}

// ----------------------------------------------------------------
// APP COMPONENT
// ----------------------------------------------------------------

export default function App() {
  const [runtimeState, setRuntimeState] = useState(null);
  const [bootState, setBootState] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // Poll runtime/boot state — lightweight, foundation only.
    const interval = setInterval(() => {
      setRuntimeState(getRuntimeState());
      setBootState(getBootState());
      setTick((t) => t + 1);
    }, 500);

    // Initial read
    setRuntimeState(getRuntimeState());
    setBootState(getBootState());

    return () => clearInterval(interval);
  }, []);

  const isCrashed = runtimeState?.status === RUNTIME_STATUS.CRASHED;
  const isReady = runtimeState?.status === RUNTIME_STATUS.READY;
  const isBooting = runtimeState?.status === RUNTIME_STATUS.BOOTING;
  const currentStage = bootState?.stage || BOOT_STAGES.IDLE;

  // ── FATAL ERROR STATE ──
  if (isCrashed) {
    return (
      <div style={styles.container}>
        <div style={styles.panel}>
          <div style={{ ...styles.statusIndicator, background: '#ef4444' }} />
          <h1 style={{ ...styles.title, color: '#ef4444' }}>FATAL ERROR</h1>
          <p style={styles.subtitle}>Runtime initialization failed.</p>
          <div style={styles.divider} />
          <StatusBadge label="STAGE" value={currentStage} type="error" />
          <StatusBadge
            label="ERROR"
            value={bootState?.error?.message || 'Unknown error'}
            type="error"
          />
          <StatusBadge label="STATUS" value={runtimeState?.status} type="error" />
        </div>
      </div>
    );
  }

  // ── BOOTING STATE ──
  if (isBooting || !runtimeState) {
    return (
      <div style={styles.container}>
        <div style={styles.panel}>
          <div style={{ ...styles.statusIndicator, background: '#f59e0b', animation: 'pulse 1.2s infinite' }} />
          <h1 style={{ ...styles.title, color: '#f59e0b' }}>INITIALIZING</h1>
          <p style={styles.subtitle}>Runtime boot pipeline running...</p>
          <div style={styles.divider} />
          <StatusBadge label="STAGE" value={currentStage} type="warn" />
          <StatusBadge label="STATUS" value={runtimeState?.status || 'PENDING'} type="warn" />
        </div>
      </div>
    );
  }

  // ── READY STATE ──
  return (
    <div style={styles.container}>
      <div style={styles.panel}>
        <div style={{ ...styles.statusIndicator, background: '#22c55e' }} />
        <h1 style={styles.title}>IMMORTAIL™</h1>
        <p style={styles.subtitle}>Core Platform Foundation — Run 1</p>

        <div style={styles.divider} />
        <p style={styles.sectionLabel}>RUNTIME</p>
        <StatusBadge label="STATUS" value={runtimeState.status} type="success" />
        <StatusBadge label="VERSION" value={runtimeState.version} type="info" />
        <StatusBadge label="BUILD" value={runtimeState.build} type="info" />
        <StatusBadge label="MODE" value={runtimeState.mode} type="default" />
        <StatusBadge
          label="INITIALIZED AT"
          value={runtimeState.initializedAt ? new Date(runtimeState.initializedAt).toISOString() : '—'}
          type="default"
        />
        <StatusBadge
          label="READY AT"
          value={runtimeState.readyAt ? new Date(runtimeState.readyAt).toISOString() : '—'}
          type="default"
        />

        <div style={styles.divider} />
        <p style={styles.sectionLabel}>SUBSYSTEMS</p>
        <StatusBadge
          label="HYDRATION"
          value={runtimeState.flags?.hydrationReady ? 'READY' : 'PENDING'}
          type={runtimeState.flags?.hydrationReady ? 'success' : 'warn'}
        />
        <StatusBadge
          label="RECOVERY"
          value={runtimeState.flags?.recoveryReady ? 'READY' : 'PENDING'}
          type={runtimeState.flags?.recoveryReady ? 'success' : 'warn'}
        />
        <StatusBadge
          label="SCHEDULER"
          value={runtimeState.flags?.schedulerReady ? 'READY' : 'PENDING'}
          type={runtimeState.flags?.schedulerReady ? 'success' : 'warn'}
        />

        <div style={styles.divider} />
        <p style={styles.sectionLabel}>BOOT</p>
        <StatusBadge label="FINAL STAGE" value={currentStage} type="success" />
        <StatusBadge label="PLATFORM" value={runtimeState.environment?.platform || '—'} type="default" />
        <StatusBadge label="BROWSER" value={runtimeState.environment?.browserType || '—'} type="default" />
        <StatusBadge
          label="MOBILE"
          value={runtimeState.environment?.isMobile ? 'YES' : 'NO'}
          type="default"
        />

        <div style={styles.divider} />
        <p style={{ ...styles.sectionLabel, color: '#22c55e' }}>
          ALL SYSTEMS NOMINAL — RUN 1 COMPLETE
        </p>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// INLINE STYLES
// ----------------------------------------------------------------

const styles = {
  container: {
    minHeight: '100vh',
    background: '#020617',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    fontFamily: "'Courier New', Courier, monospace",
  },
  panel: {
    width: '100%',
    maxWidth: '480px',
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: '4px',
    padding: '32px',
  },
  statusIndicator: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    marginBottom: '16px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#f8fafc',
    margin: '0 0 4px 0',
    letterSpacing: '0.15em',
  },
  subtitle: {
    fontSize: '11px',
    color: '#475569',
    margin: '0 0 0 0',
    letterSpacing: '0.05em',
  },
  divider: {
    height: '1px',
    background: '#1e293b',
    margin: '20px 0 12px 0',
  },
  sectionLabel: {
    fontSize: '10px',
    color: '#334155',
    letterSpacing: '0.1em',
    fontWeight: 700,
    marginBottom: '8px',
    marginTop: '0',
  },
};
