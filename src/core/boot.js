// ================================================================
// IMMORTAIL™ — BOOT SEQUENCE
// 11-step deterministic boot. Emits SYSTEM::APP_READY on success.
// ================================================================

import storage, { DEFAULT_CONFIG } from './storage.js';
import { EventBus, EVENTS } from './eventBus.js';
import { hydrateDog, applyIdleDecay } from './dogService.js';

export async function initializeApp() {
  const t0    = Date.now();
  const steps = [];
  const log   = (step, ok, note = '') => steps.push({ step, ok, note });

  try {
    // ── Step 1: Validate environment ────────────────────────────
    const storageOk = storage.isAvailable();
    log(1, storageOk, storageOk ? 'localStorage OK' : 'localStorage unavailable');
    if (!storageOk) throw new Error('Storage unavailable — cannot boot.');

    // ── Step 2: Initialize + validate storage I/O ───────────────
    const testWrite = storage.saveSettings({ _bootTest: true });
    const testRead  = storage.getSettings();
    const ioOk      = testWrite && testRead?._bootTest === true;
    log(2, ioOk, 'R/W cycle ' + (ioOk ? 'OK' : 'FAILED'));
    if (!ioOk) throw new Error('Storage I/O failed.');

    // ── Step 3: Hydrate system config (features + providers + routes)
    const config = storage.getConfig(); // deep-merges defaults → persisted
    log(3, true,
      `features=${JSON.stringify(config.features)} ` +
      `ollama=${config.providers?.ollama?.enabled} ` +
      `homeUrl=${config.appConfig?.homeUrl}`
    );

    // ── Step 4: Validate required config keys ───────────────────
    const missingFlags = Object.entries(DEFAULT_CONFIG.features)
      .filter(([k]) => config.features?.[k] === undefined)
      .map(([k]) => k);
    const ollamaPresent = !!config.providers?.ollama;
    const homeUrlOk     = !!config.appConfig?.homeUrl;
    const configValid   = missingFlags.length === 0 && ollamaPresent && homeUrlOk;
    log(4, configValid,
      configValid
        ? 'config valid'
        : `missing flags: [${missingFlags.join(',')}] ` +
          `ollama: ${ollamaPresent} homeUrl: ${homeUrlOk}`
    );

    // ── Step 5: HYDRATION CHECK log (mandatory per spec) ────────
    console.log('IMMORTAIL HYDRATION CHECK:', {
      features:  config.features,
      providers: config.providers,
      routes:    config.routes,
      appConfig: config.appConfig,
    });
    log(5, true, 'hydration check logged');

    // ── Step 6: Load persisted companion state ───────────────────
    const dog      = storage.getDog();
    const memories = storage.getMemories();
    log(6, true, `dog=${!!dog} memories=${memories.length}`);

    // ── Step 7: Initialize EventBus ─────────────────────────────
    EventBus.clear();
    log(7, true, 'EventBus ready');

    // ── Step 8: Hydrate dog runtime state ───────────────────────
    const hydratedDog = hydrateDog();
    log(8, true,
      `name=${hydratedDog.name} ` +
      `emotion=${hydratedDog.emotion} ` +
      `bonding=${hydratedDog.bonding}`
    );

    // ── Step 9: Initialize media registry ───────────────────────
    const mediaItems = storage.getMedia();
    log(9, true, `media entries=${mediaItems.length}`);

    // ── Step 10: Start idle decay ────────────────────────────────
    setInterval(applyIdleDecay, 5 * 60 * 1000);
    log(10, true, 'idle decay active (5min interval)');

    // ── Step 11: Emit SYSTEM::APP_READY ─────────────────────────
    const duration   = Date.now() - t0;
    const bootResult = {
      ok: true,
      duration,
      steps,
      dog:    hydratedDog,
      config,
    };
    EventBus.emit(EVENTS.APP_READY, bootResult);
    log(11, true, `SYSTEM::APP_READY emitted (${duration}ms)`);

    return bootResult;

  } catch (error) {
    const duration = Date.now() - t0;
    console.error('[IMMORTAIL Boot] FAILED:', error.message);
    return { ok: false, duration, error: error.message, steps };
  }
}

export default initializeApp;
