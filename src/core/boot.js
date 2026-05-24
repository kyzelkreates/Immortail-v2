// ================================================================
// IMMORTAIL™ — BOOT SEQUENCE (Run 3 extension)
// 13-step deterministic boot. Emits SYSTEM::APP_READY on success.
// ================================================================

import storage, { DEFAULT_CONFIG } from './storage.js';
import { EventBus, EVENTS }        from './eventBus.js';
import { hydrateDog, applyIdleDecay as legacyDecay } from './dogService.js';
import { initCompanionCore, applyIdleDecay } from './companionCoreService.js';

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

    // ── Step 3: Hydrate system config ────────────────────────────
    const config = storage.getConfig();
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
        : `missing: [${missingFlags.join(',')}] ollama:${ollamaPresent} homeUrl:${homeUrlOk}`
    );

    // ── Step 5: HYDRATION CHECK log ──────────────────────────────
    console.log('IMMORTAIL HYDRATION CHECK:', {
      features:  config.features,
      providers: config.providers,
      routes:    config.routes,
      appConfig: config.appConfig,
    });
    log(5, true, 'hydration check logged');

    // ── Step 6: Load legacy dog state (Run 1–2 compat) ──────────
    const dog      = storage.getDog();
    const memories = storage.getMemories();
    log(6, true, `legacy dog=${!!dog} memories=${memories.length}`);

    // ── Step 7: Initialize EventBus ─────────────────────────────
    EventBus.clear();
    log(7, true, 'EventBus ready');

    // ── Step 8: Hydrate legacy dog (Run 1–2 hooks still active) ─
    const hydratedDog = hydrateDog();
    log(8, true,
      `name=${hydratedDog.name} emotion=${hydratedDog.emotion} bonding=${hydratedDog.bonding}`
    );

    // ── Step 9: Initialize Companion Core (Run 3) ────────────────
    const core = initCompanionCore();
    log(9, true,
      `core.identity.name=${core.identity.name} ` +
      `mood=${core.identity.mood} ` +
      `memory.length=${core.memory.length} ` +
      `mediaMemory.length=${core.mediaMemory.length}`
    );

    // ── Step 10: Validate companionCore SSOT ────────────────────
    const coreOk =
      !!core.identity?.name &&
      typeof core.identity?.trust === 'number' &&
      Array.isArray(core.memory) &&
      Array.isArray(core.mediaMemory) &&
      !!core.behaviourState &&
      !!core.emotionalState;
    log(10, coreOk, coreOk ? 'companionCore valid' : 'companionCore missing keys');
    if (!coreOk) throw new Error('Companion Core failed validation.');

    // ── Step 11: Initialize media registry ──────────────────────
    const mediaItems = storage.getMedia();
    log(11, true, `standalone media entries=${mediaItems.length}`);

    // ── Step 12: Start idle decay (Run 3 unified + Run 2 legacy) ─
    setInterval(() => { applyIdleDecay(); legacyDecay(); }, 5 * 60 * 1000);
    log(12, true, 'idle decay active (5min interval)');

    // ── Step 13: Emit SYSTEM::APP_READY ─────────────────────────
    const duration   = Date.now() - t0;
    const bootResult = {
      ok: true,
      duration,
      steps,
      dog:    hydratedDog,
      core,
      config,
    };
    EventBus.emit(EVENTS.APP_READY, bootResult);
    log(13, true, `SYSTEM::APP_READY emitted (${duration}ms)`);

    return bootResult;

  } catch (error) {
    const duration = Date.now() - t0;
    console.error('[IMMORTAIL Boot] FAILED:', error.message);
    return { ok: false, duration, error: error.message, steps };
  }
}

export default initializeApp;
