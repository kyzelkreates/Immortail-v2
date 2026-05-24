// ================================================================
// IMMORTAIL™ — APP SHELL (Run 9)
// Central application shell. Screen routing, layout composition,
// global state subscription, event listening bridge.
//
// SSOT RULES:
// - UI never owns state
// - UI never accesses storage directly
// - All actions go through services
// - State flows in via hooks only
// ================================================================

import React, { useState, useEffect, useCallback } from 'react';

// Hooks — read-only state access
import { useAppState }     from './hooks/useAppState.js';
import { useRuntimeState } from './hooks/useRuntimeState.js';
import { useEventBus }     from './hooks/useEventBus.js';

// Screens
import { LoadingScreen }   from './screens/LoadingScreen.jsx';
import { ErrorScreen }     from './screens/ErrorScreen.jsx';
import { HomeScreen }      from './screens/HomeScreen.jsx';
import { DashboardScreen } from './screens/DashboardScreen.jsx';
import { CompanionScreen } from './screens/CompanionScreen.jsx';
import { MemoryScreen }    from './screens/MemoryScreen.jsx';
import { SettingsScreen }  from './screens/SettingsScreen.jsx';

// UI helpers
import { mapBootStateToUI } from './utils/uiHelpers.js';

// ----------------------------------------------------------------
// SCREEN REGISTRY
// ----------------------------------------------------------------

const SCREENS = {
  home:      HomeScreen,
  dashboard: DashboardScreen,
  companion: CompanionScreen,
  memory:    MemoryScreen,
  settings:  SettingsScreen,
};

const DEFAULT_SCREEN = 'home';

// ----------------------------------------------------------------
// APP SHELL
// ----------------------------------------------------------------

export default function App() {
  const appState     = useAppState();
  const runtimeState = useRuntimeState();

  const [activeScreen, setActiveScreen] = useState(DEFAULT_SCREEN);
  const [bootState,    setBootState]    = useState(null);
  const [fatalError,   setFatalError]   = useState(null);
  const [appReady,     setAppReady]     = useState(false);

  // ── Event subscriptions (read-only) ─────────────────────────

  useEventBus('APP_READY', () => {
    setAppReady(true);
    setBootState(null);
  });

  useEventBus('RUNTIME_INITIALIZED', (payload) => {
    // runtime state update handled by hook — no direct mutation
  });

  useEventBus('DOG_STATE_UPDATED',      () => {});  // triggers hook re-render
  useEventBus('EMOTION_CHANGED',        () => {});
  useEventBus('MEMORY_CREATED',         () => {});
  useEventBus('MEDIA_ANALYZED',         () => {});
  useEventBus('RECONSTRUCTION_COMPLETE',() => {});

  // Catch global CustomEvent boot signals from DOM
  useEffect(() => {
    const onReady = () => setAppReady(true);
    const onError = (e) => setFatalError(e.detail?.error || 'Boot failed.');
    const onInit  = () => {};

    window.addEventListener('immortail:renderer:renderer_initialized', onInit);
    window.addEventListener('immortailapp:boot_failed', onError);
    window.addEventListener('immortailapp:app_ready',   onReady);

    return () => {
      window.removeEventListener('immortail:renderer:renderer_initialized', onInit);
      window.removeEventListener('immortailapp:boot_failed', onError);
      window.removeEventListener('immortailapp:app_ready',   onReady);
    };
  }, []);

  // Sync ready state from appState
  useEffect(() => {
    if (appState?.ready) setAppReady(true);
    if (appState?.fatalError) setFatalError(appState.fatalError);
  }, [appState?.ready, appState?.fatalError]);

  // ── Navigation handler ───────────────────────────────────────

  const handleNavigate = useCallback((screen) => {
    if (screen in SCREENS) setActiveScreen(screen);
  }, []);

  // ── Service call dispatcher (goes through services, not state) ─

  const handleServiceCall = useCallback(async (action, payload) => {
    // All actions route through services — never direct state mutation
    try {
      if (action === 'exportState') {
        const data = {
          appState:     appState,
          runtimeState: runtimeState,
          exportedAt:   Date.now(),
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `immortail-state-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
      // Additional service calls dispatched in future runs
    } catch (err) {
      console.error('[App] Service call failed:', err.message);
    }
  }, [appState, runtimeState]);

  // ── Render: fatal error ──────────────────────────────────────

  if (fatalError) {
    return (
      <ErrorScreen
        error={fatalError}
        onRetry={() => window.location.reload()}
      />
    );
  }

  // ── Render: booting ──────────────────────────────────────────

  if (!appReady) {
    return (
      <LoadingScreen bootState={bootState || { stage: runtimeState?.bootStage }} />
    );
  }

  // ── Render: active screen ────────────────────────────────────

  const ScreenComponent = SCREENS[activeScreen] || HomeScreen;

  return (
    <ScreenComponent
      onNavigate={handleNavigate}
      onServiceCall={handleServiceCall}
    />
  );
}
