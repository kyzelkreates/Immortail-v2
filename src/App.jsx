// ================================================================
// IMMORTAIL™ — APPLICATION SHELL (Run 3 — State Layer Visualization)
// Foundation visualization: runtime, state, hydration, session.
// NO DASHBOARD. NO DOG UI. NO CHAT. NO FEATURES.
// ================================================================

import React, { useState, useEffect } from 'react';

// Core
import { getRuntimeState as getCoreRuntimeState } from './core/runtime.js';
import { getBootState }                           from './core/boot.js';
import { getHydrationState }                      from './core/hydration.js';
import { getRecoveryState }                       from './core/recovery.js';

// State layer
import { getAppState, subscribeToAppState }         from './state/appState.js';
import { getRuntimeState, subscribeToRuntimeState } from './state/runtimeState.js';
import { getSessionState, subscribeToSessionState } from './state/sessionState.js';

import { BOOT_STAGES, RUNTIME_STATUS } from './utils/constants.js';

// ----------------------------------------------------------------
// STATUS BADGE COMPONENT
// ----------------------------------------------------------------

function StatusBadge({ label, value, type = 'default' }) {
  const colors = {
    success: '#22c55e',
    error:   '#ef4444',
    warn:    '#f59e0b',
    info:    '#60a5fa',
    default: '#94a3b8',
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '5px 0', borderBottom: '1px solid #1e293b',
    }}>
      <span style={{ color: '#64748b', fontSize: '11px', minWidth: '170px', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <span style={{ color: colors[type], fontSize: '11px', fontFamily: 'monospace', fontWeight: 600 }}>
        {String(value ?? '—')}
      </span>
    </div>
  );
}

function SectionLabel({ label, color = '#334155' }) {
  return (
    <p style={{
      fontSize: '9px', color, letterSpacing: '0.12em',
      fontWeight: 700, margin: '16px 0 6px 0',
    }}>
      {label}
    </p>
  );
}

const Divider = () => (
  <div style={{ height: '1px', background: '#1e293b', margin: '12px 0 4px 0' }} />
);

// ----------------------------------------------------------------
// APP COMPONENT
// ----------------------------------------------------------------

export default function App() {
  const [coreRuntime, setCoreRuntime]   = useState(() => getCoreRuntimeState());
  const [bootState, setBootState]       = useState(() => getBootState());
  const [appState, setAppState]         = useState(() => getAppState());
  const [runtimeState, setRuntimeState] = useState(() => getRuntimeState());
  const [sessionState, setSessionState] = useState(() => getSessionState());
  const [hydrationState, setHydrationState] = useState(() => getHydrationState());

  useEffect(() => {
    // Subscribe to reactive state updates
    const unsubApp     = subscribeToAppState((next)     => setAppState(next));
    const unsubRuntime = subscribeToRuntimeState((next) => setRuntimeState(next));
    const unsubSession = subscribeToSessionState((next) => setSessionState(next));

    // Poll core + hydration (no subscription API on core.runtime.js)
    const poll = setInterval(() => {
      setCoreRuntime(getCoreRuntimeState());
      setBootState(getBootState());
      setHydrationState(getHydrationState());
    }, 750);

    return () => {
      unsubApp();
      unsubRuntime();
      unsubSession();
      clearInterval(poll);
    };
  }, []);

  const isCrashed = coreRuntime?.status === RUNTIME_STATUS.CRASHED;
  const isReady   = coreRuntime?.status === RUNTIME_STATUS.READY;
  const isBooting = coreRuntime?.status === RUNTIME_STATUS.BOOTING;
  const stage     = bootState?.stage || 'IDLE';

  // ── FATAL ERROR ──────────────────────────────────────────────
  if (isCrashed) {
    return (
      <div style={styles.container}>
        <div style={styles.panel}>
          <div style={{ ...styles.dot, background: '#ef4444' }} />
          <h1 style={{ ...styles.title, color: '#ef4444' }}>FATAL ERROR</h1>
          <p style={styles.subtitle}>Boot pipeline failed.</p>
          <Divider />
          <StatusBadge label="STAGE"   value={stage}                            type="error" />
          <StatusBadge label="ERROR"   value={bootState?.error?.message}        type="error" />
          <StatusBadge label="STATUS"  value={coreRuntime?.status}              type="error" />
        </div>
      </div>
    );
  }

  // ── BOOTING ──────────────────────────────────────────────────
  if (isBooting || !coreRuntime || coreRuntime.status === 'UNINITIALIZED') {
    return (
      <div style={styles.container}>
        <div style={styles.panel}>
          <div style={{ ...styles.dot, background: '#f59e0b' }} />
          <h1 style={{ ...styles.title, color: '#f59e0b' }}>INITIALIZING</h1>
          <p style={styles.subtitle}>Boot pipeline running...</p>
          <Divider />
          <StatusBadge label="STAGE"   value={stage}                type="warn" />
          <StatusBadge label="STATUS"  value={coreRuntime?.status}  type="warn" />
        </div>
      </div>
    );
  }

  // ── READY ─────────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      <div style={styles.panel}>
        <div style={{ ...styles.dot, background: '#22c55e' }} />
        <h1 style={styles.title}>IMMORTAIL™</h1>
        <p style={styles.subtitle}>Core Platform — Run 3: State + Hydration + Recovery</p>

        {/* CORE RUNTIME */}
        <Divider />
        <SectionLabel label="CORE RUNTIME" />
        <StatusBadge label="STATUS"   value={coreRuntime.status}  type="success" />
        <StatusBadge label="VERSION"  value={coreRuntime.version} type="info" />
        <StatusBadge label="BUILD"    value={coreRuntime.build}   type="info" />
        <StatusBadge label="MODE"     value={coreRuntime.mode}    type="default" />
        <StatusBadge label="PLATFORM" value={coreRuntime.environment?.platform} type="default" />

        {/* APP STATE */}
        <Divider />
        <SectionLabel label="APP STATE" />
        <StatusBadge label="INITIALIZED" value={String(appState.initialized)} type={appState.initialized ? 'success' : 'warn'} />
        <StatusBadge label="HYDRATED"    value={String(appState.hydrated)}    type={appState.hydrated    ? 'success' : 'warn'} />
        <StatusBadge label="RECOVERED"   value={String(appState.recovered)}   type={appState.recovered   ? 'success' : 'default'} />
        <StatusBadge label="READY"       value={String(appState.ready)}       type={appState.ready       ? 'success' : 'warn'} />

        {/* RUNTIME STATE LIFECYCLE */}
        <Divider />
        <SectionLabel label="RUNTIME LIFECYCLE" />
        <StatusBadge label="BOOT COMPLETE"      value={String(runtimeState.bootComplete)}      type={runtimeState.bootComplete      ? 'success' : 'warn'} />
        <StatusBadge label="HYDRATION COMPLETE" value={String(runtimeState.hydrationComplete)} type={runtimeState.hydrationComplete ? 'success' : 'warn'} />
        <StatusBadge label="RECOVERY COMPLETE"  value={String(runtimeState.recoveryComplete)}  type={runtimeState.recoveryComplete  ? 'success' : 'default'} />
        <StatusBadge label="SESSION RESTORED"   value={String(runtimeState.sessionRestored)}   type={runtimeState.sessionRestored   ? 'success' : 'warn'} />

        {/* SUBSYSTEMS */}
        <Divider />
        <SectionLabel label="SUBSYSTEMS" />
        <StatusBadge label="STORAGE"   value={appState.flags.storageReady   ? 'READY' : 'PENDING'} type={appState.flags.storageReady   ? 'success' : 'warn'} />
        <StatusBadge label="HYDRATION" value={appState.flags.hydrationReady ? 'READY' : 'PENDING'} type={appState.flags.hydrationReady ? 'success' : 'warn'} />
        <StatusBadge label="RECOVERY"  value={appState.flags.recoveryReady  ? 'READY' : 'PENDING'} type={appState.flags.recoveryReady  ? 'success' : 'warn'} />
        <StatusBadge label="SCHEDULER" value={appState.flags.schedulerReady ? 'READY' : 'PENDING'} type={appState.flags.schedulerReady ? 'success' : 'warn'} />
        <StatusBadge label="SESSION"   value={appState.flags.sessionReady   ? 'READY' : 'PENDING'} type={appState.flags.sessionReady   ? 'success' : 'warn'} />

        {/* HYDRATION */}
        <Divider />
        <SectionLabel label="HYDRATION" />
        <StatusBadge label="STATUS"  value={hydrationState.status}          type={hydrationState.status === 'complete' ? 'success' : 'warn'} />
        <StatusBadge label="PARTIAL" value={String(hydrationState.partial)} type={hydrationState.partial ? 'warn' : 'success'} />

        {/* SESSION */}
        <Divider />
        <SectionLabel label="SESSION" />
        <StatusBadge label="SESSION ID"  value={sessionState.sessionId || 'none'} type={sessionState.sessionId ? 'info' : 'default'} />
        <StatusBadge label="STATUS"      value={sessionState.status}               type={sessionState.status === 'active' || sessionState.status === 'restored' ? 'success' : 'warn'} />
        <StatusBadge label="FIRST RUN"   value={String(sessionState.continuity.isFirstRun)}    type="default" />
        <StatusBadge label="HAD SESSION" value={String(sessionState.continuity.hadPreviousSession)} type="default" />
        <StatusBadge label="CHECKPOINTS" value={sessionState.checkpoints.length}  type="default" />

        <Divider />
        <SectionLabel label="ALL SYSTEMS NOMINAL — RUN 3 COMPLETE" color="#22c55e" />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// STYLES
// ----------------------------------------------------------------

const styles = {
  container: {
    minHeight: '100vh',
    background: '#020617',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '32px 16px',
    fontFamily: "'Courier New', Courier, monospace",
  },
  panel: {
    width: '100%',
    maxWidth: '500px',
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: '4px',
    padding: '32px',
  },
  dot: {
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
    fontSize: '10px',
    color: '#475569',
    margin: 0,
    letterSpacing: '0.05em',
  },
};
