// ================================================================
// IMMORTAIL™ — APPLICATION ENTRY POINT (Run 9)
// Boot sequence invocation + React mount.
// NO UI LOGIC HERE. PURE ORCHESTRATION.
// ================================================================

import React       from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App         from './App.jsx';
import { initializeApp } from './core/boot.js';

// ----------------------------------------------------------------
// PWA — Viewport meta enforcement
// ----------------------------------------------------------------

if (typeof document !== 'undefined') {
  let viewportMeta = document.querySelector('meta[name="viewport"]');
  if (!viewportMeta) {
    viewportMeta = document.createElement('meta');
    viewportMeta.name = 'viewport';
    document.head.appendChild(viewportMeta);
  }
  viewportMeta.content =
    'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1';
}

// ----------------------------------------------------------------
// REACT MOUNT
// ----------------------------------------------------------------

const container = document.getElementById('root');

if (!container) {
  console.error('[IMMORTAIL] Fatal: #root element not found in DOM.');
} else {
  const root = createRoot(container);

  // Mount immediately — App handles loading/boot states internally
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  // ── Boot sequence ──────────────────────────────────────────────
  // Run after first render so the loading screen is visible
  initializeApp(async () => {
    // onReady callback — boot complete, app transitions to ready state
    // DOM CustomEvent dispatched by boot.js → App picks it up
    window.dispatchEvent(new CustomEvent('immortailapp:app_ready'));
  }).catch((err) => {
    console.error('[IMMORTAIL] Fatal boot error:', err);
    window.dispatchEvent(
      new CustomEvent('immortailapp:boot_failed', { detail: { error: err.message } })
    );
  });
}
