// ================================================================
// IMMORTAIL™ — MAIN ENTRY POINT
// Initializes boot pipeline, mounts React safely.
// NO BUSINESS LOGIC INSIDE MAIN.
// ================================================================

import React from 'react';
import { createRoot } from 'react-dom/client';
import { initializeApp } from './core/boot.js';
import { BootLogger } from './utils/logger.js';
import App from './App.jsx';
import './index.css';

// ----------------------------------------------------------------
// MOUNT REACT
// ----------------------------------------------------------------

function mountApplication() {
  const rootElement = document.getElementById('root');

  if (!rootElement) {
    throw new Error('Root DOM element #root not found. Cannot mount application.');
  }

  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  BootLogger.info('React application mounted to #root.');
}

// ----------------------------------------------------------------
// ENTRY POINT — Run boot pipeline then mount
// ----------------------------------------------------------------

initializeApp(mountApplication).catch((fatalError) => {
  // Last-resort handler — boot.js already handles errors internally,
  // but this catches any unexpected throw that escapes the pipeline.
  console.error('[IMMORTAIL][MAIN][FATAL] Unhandled boot failure:', fatalError);

  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="
        min-height: 100vh;
        background: #020617;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: monospace;
        color: #ef4444;
        flex-direction: column;
        gap: 12px;
        padding: 24px;
        text-align: center;
      ">
        <div style="font-size: 18px; font-weight: bold; letter-spacing: 0.15em;">IMMORTAIL™</div>
        <div style="font-size: 12px; color: #64748b;">FATAL BOOT FAILURE</div>
        <div style="font-size: 11px; color: #ef4444; max-width: 400px; margin-top: 8px;">
          ${fatalError?.message || 'Unknown initialization error.'}
        </div>
      </div>
    `;
  }
});
