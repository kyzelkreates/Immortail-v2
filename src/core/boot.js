// ================================================================
// IMMORTAIL™ MVP — BOOT SEQUENCE
// 9-step deterministic boot. Emits SYSTEM::APP_READY on success.
// ================================================================

import storage from './storage.js';
import { EventBus, EVENTS } from './eventBus.js';
import { hydrateDog, applyIdleDecay } from './dogService.js';

const BOOT_TIMEOUT_MS = 8000;

export async function initializeApp() {
  const t0 = Date.now();
  const steps = [];
  const log = (step, ok, note = '') => steps.push({ step, ok, note });

  try {
    // ── Step 1: Validate environment ─────────────────────────────
    const storageOk = storage.isAvailable();
    log(1, storageOk, storageOk ? 'localStorage OK' : 'localStorage unavailable');
    if (!storageOk) throw new Error('Storage unavailable — cannot boot.');

    // ── Step 2: Initialize storage ───────────────────────────────
    // Storage is localStorage — already ready. Verify read/write cycle.
    const testWrite = storage.saveSettings({ _bootTest: true });
    const testRead  = storage.getSettings();
    const ioOk = testWrite && testRead?._bootTest === true;
    log(2, ioOk, 'R/W cycle ' + (ioOk ? 'OK' : 'FAILED'));
    if (!ioOk) throw new Error('Storage I/O failed.');

    // ── Step 3: Load persisted state ─────────────────────────────
    const dog      = storage.getDog();
    const memories = storage.getMemories();
    const settings = storage.getSettings();
    log(3, true, `dog=${!!dog} memories=${memories.length} settings=${Object.keys(settings).length}`);

    // ── Step 4: Initialize EventBus ──────────────────────────────
    EventBus.clear();
    log(4, true, 'EventBus ready');

    // ── Step 5: Initialize services ──────────────────────────────
    // dogService is lazy (no explicit init needed) — just register decay
    log(5, true, 'services ready');

    // ── Step 6: Hydrate dog state ─────────────────────────────────
    const hydratedDog = hydrateDog();
    log(6, true, `name=${hydratedDog.name} emotion=${hydratedDog.emotion} bonding=${hydratedDog.bonding}`);

    // ── Step 7: Mount UI ─────────────────────────────────────────
    // Handled by React root in main.jsx — boot just signals readiness
    log(7, true, 'UI mount pending (React root)');

    // ── Step 8: Start idle decay interval ────────────────────────
    setInterval(applyIdleDecay, 5 * 60 * 1000); // every 5 min
    log(8, true, 'idle decay active (5min interval)');

    // ── Step 9: Emit SYSTEM::APP_READY ────────────────────────────
    const duration = Date.now() - t0;
    const bootResult = {
      ok: true,
      duration,
      steps,
      dog: hydratedDog,
    };
    EventBus.emit(EVENTS.APP_READY, bootResult);
    log(9, true, `SYSTEM::APP_READY emitted (${duration}ms)`);

    return bootResult;

  } catch (error) {
    const duration = Date.now() - t0;
    console.error('[IMMORTAIL Boot] FAILED:', error.message);
    return {
      ok:       false,
      duration,
      error:    error.message,
      steps,
    };
  }
}

export default initializeApp;
