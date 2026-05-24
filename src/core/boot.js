// ================================================================
// IMMORTAIL™ — CENTRAL APPLICATION BOOTSTRAPPER (Run 4)
// Deterministic 18-step boot pipeline.
// NO UI LOGIC. NO AI LOGIC. NO STORAGE BUSINESS LOGIC.
//
// BOOT ORDER:
//  1.  validate environment
//  2.  initialize runtime
//  3.  validate runtime contracts
//  4.  initialize storage
//  5.  validate schemas
//  6.  run migrations (validate state)
//  7.  initialize state layer
//  8.  initialize event system
//  9.  register event contracts
//  10. initialize hydration system
//  11. hydrate runtime state
//  12. initialize recovery engine
//  13. restore active sessions
//  14. register services
//  15. initialize scheduler
//  16. emit runtime initialized
//  17. mount application
//  18. emit APP_READY
// ================================================================

import { BOOT_STAGES, RUNTIME_EVENTS, RUNTIME_STATUS } from '../utils/constants.js';
import { BootLogger } from '../utils/logger.js';

// Core
import { validateEnvironment, validateRuntimeContracts }   from './validation.js';
import {
  initializeRuntime,
  getRuntimeState       as getCoreRuntimeState,
  updateRuntimeState    as updateCoreRuntimeState,
  setRuntimeError,
  markRuntimeReady,
  registerModule,
}                                                           from './runtime.js';
import { initializeHydration, hydrateRuntime }             from './hydration.js';
import { initializeRecovery }                              from './recovery.js';
import { initializeScheduler }                             from './scheduler.js';

// Storage (Run 2)
import { initializeStorage, getStorage, validateMigrationState } from '../storage/storage.js';
import { getMigrationVersion }                             from '../storage/migrations.js';
import { getAllSchemas, getAllStoreNames }                  from '../storage/schemas.js';

// State layer (Run 3)
import { updateAppState, registerActiveModule }            from '../state/appState.js';
import { updateRuntimeState, markBootComplete }            from '../state/runtimeState.js';
import { getSessionState, createSession }                  from '../state/sessionState.js';

// Event system (Run 4)
import { initializeEventBus }                             from '../events/eventBus.js';
import { registerAllContracts }                           from '../events/eventRegistry.js';
import { ALL_EVENTS }                                     from '../events/eventTypes.js';

// Services (Run 4)
import { initializeDogRuntime }                           from '../services/dogService.js';
import { initializeAIRuntime }                            from '../services/aiService.js';
import { initializeMediaRuntime }                         from '../services/mediaService.js';
import { initializeNotificationRuntime }                  from '../services/notificationService.js';
import { initializeReconstructionRuntime }                from '../services/reconstructionService.js';

// ----------------------------------------------------------------
// EXTENDED BOOT STAGES
// ----------------------------------------------------------------

const BOOT = {
  ...BOOT_STAGES,
  INITIALIZING_STORAGE:       'INITIALIZING_STORAGE',
  VALIDATING_SCHEMAS:         'VALIDATING_SCHEMAS',
  RUNNING_MIGRATIONS:         'RUNNING_MIGRATIONS',
  INITIALIZING_STATE_LAYER:   'INITIALIZING_STATE_LAYER',
  INITIALIZING_EVENT_SYSTEM:  'INITIALIZING_EVENT_SYSTEM',
  REGISTERING_EVENT_CONTRACTS:'REGISTERING_EVENT_CONTRACTS',
  HYDRATING_RUNTIME:          'HYDRATING_RUNTIME',
  RESTORING_SESSIONS:         'RESTORING_SESSIONS',
  REGISTERING_SERVICES:       'REGISTERING_SERVICES',
};

// ----------------------------------------------------------------
// INTERNAL BOOT STATE
// ----------------------------------------------------------------

let _bootState = {
  stage:       BOOT.IDLE,
  startedAt:   null,
  completedAt: null,
  error:       null,
  timings:     {},
};

// ----------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------

function setStage(stage) {
  _bootState.stage = stage;
  _bootState.timings[stage] = Date.now();
  BootLogger.info(`Boot stage: ${stage}`);
  updateCoreRuntimeState({ bootStage: stage });
}

function emitRuntimeEvent(eventName, detail = {}) {
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
    BootLogger.info(`DOM event emitted: ${eventName}`);
  }
}

// ----------------------------------------------------------------
// BOOT PIPELINE
// ----------------------------------------------------------------

export async function initializeApp(onReady) {
  BootLogger.group('IMMORTAIL™ Boot Pipeline (Run 4 — 18 Steps)');

  _bootState.startedAt = Date.now();
  BootLogger.info(`Boot started at: ${new Date(_bootState.startedAt).toISOString()}`);

  try {
    // ── STEP 1: Validate Environment ─────────────────────────────
    setStage(BOOT.VALIDATING_ENVIRONMENT);
    const envValidation = validateEnvironment();
    if (!envValidation.passed) {
      throw new Error(`Environment validation failed: ${envValidation.criticalFailed.join(', ')}`);
    }
    if (envValidation.warnings.length > 0) {
      BootLogger.warn(`Environment warnings: ${envValidation.warnings.join(', ')}`);
    }

    // ── STEP 2: Initialize Runtime ───────────────────────────────
    setStage(BOOT.INITIALIZING_RUNTIME);
    await initializeRuntime();

    // ── STEP 3: Validate Runtime Contracts ───────────────────────
    setStage(BOOT.VALIDATING_RUNTIME_CONTRACTS);
    const runtimeSnapshot = getCoreRuntimeState();
    const contractValidation = validateRuntimeContracts(runtimeSnapshot);
    if (!contractValidation.passed) {
      throw new Error(`Runtime contracts failed: ${contractValidation.failed.join(', ')}`);
    }

    // ── STEP 4: Initialize Storage ───────────────────────────────
    setStage(BOOT.INITIALIZING_STORAGE);
    await initializeStorage();
    registerModule('storage', { version: getMigrationVersion() });

    // ── STEP 5: Validate Schemas ─────────────────────────────────
    setStage(BOOT.VALIDATING_SCHEMAS);
    const storeNames = getAllStoreNames();
    if (storeNames.length === 0) {
      throw new Error('Schema validation failed: no stores registered.');
    }
    const schemas = getAllSchemas();
    for (const storeName of storeNames) {
      const schema = schemas[storeName];
      if (!schema.keyPath || !schema.storeName || !schema.validationShape) {
        throw new Error(`Schema invalid for store "${storeName}".`);
      }
    }
    BootLogger.info(`Schema validation passed — ${storeNames.length} store(s).`);

    // ── STEP 6: Validate Migration State ─────────────────────────
    setStage(BOOT.RUNNING_MIGRATIONS);
    const db = getStorage();
    const migrationState = validateMigrationState(db);
    if (!migrationState.valid) {
      throw new Error(`Migration state invalid. Missing: ${migrationState.missingStores.join(', ')}`);
    }
    BootLogger.info(`Migration state valid — v${getMigrationVersion()}.`);

    // ── STEP 7: Initialize State Layer ───────────────────────────
    setStage(BOOT.INITIALIZING_STATE_LAYER);
    updateAppState({
      initialized: true,
      timestamps: { bootStartedAt: _bootState.startedAt },
      meta: {
        version:     runtimeSnapshot.version,
        build:       runtimeSnapshot.build,
        environment: runtimeSnapshot.environment?.platform || 'unknown',
      },
    });
    registerActiveModule('stateLayer', { initializedAt: Date.now() });
    BootLogger.info('State layer initialized.');

    // ── STEP 8: Initialize Event System ──────────────────────────
    setStage(BOOT.INITIALIZING_EVENT_SYSTEM);
    initializeEventBus({ debugMode: runtimeSnapshot.mode === 'development' });
    registerModule('eventBus', { initializedAt: Date.now() });
    BootLogger.info('Event bus initialized.');

    // ── STEP 9: Register Event Contracts ─────────────────────────
    setStage(BOOT.REGISTERING_EVENT_CONTRACTS);
    const contractCount = registerAllContracts();
    BootLogger.info(`${contractCount} event contracts registered.`);

    // ── STEP 10: Initialize Hydration System ─────────────────────
    setStage(BOOT.INITIALIZING_HYDRATION);
    await initializeHydration();

    // ── STEP 11: Hydrate Runtime State ───────────────────────────
    setStage(BOOT.HYDRATING_RUNTIME);
    await hydrateRuntime();

    // ── STEP 12: Initialize Recovery Engine ──────────────────────
    setStage(BOOT.INITIALIZING_RECOVERY);
    initializeRecovery();
    updateAppState({ flags: { recoveryReady: true } });

    // ── STEP 13: Restore Active Sessions ─────────────────────────
    setStage(BOOT.RESTORING_SESSIONS);
    const sessionState = getSessionState();
    if (sessionState.status === 'none' || sessionState.status === 'failed') {
      createSession({ bootRestored: true });
      BootLogger.warn('[Boot] Session not restored by hydration — created fresh session.');
    } else {
      BootLogger.info(`[Boot] Session active: ${sessionState.sessionId} (${sessionState.status})`);
    }
    updateAppState({ flags: { sessionReady: true } });
    updateRuntimeState({ sessionRestored: true });

    // ── STEP 14: Register Services ───────────────────────────────
    setStage(BOOT.REGISTERING_SERVICES);
    await initializeDogRuntime();
    registerActiveModule('dogService', { initializedAt: Date.now() });

    await initializeAIRuntime();
    registerActiveModule('aiService', { initializedAt: Date.now() });

    await initializeMediaRuntime();
    registerActiveModule('mediaService', { initializedAt: Date.now() });

    initializeNotificationRuntime();
    registerActiveModule('notificationService', { initializedAt: Date.now() });

    await initializeReconstructionRuntime();
    registerActiveModule('reconstructionService', { initializedAt: Date.now() });

    BootLogger.info('All services registered.');

    // ── STEP 15: Initialize Scheduler ────────────────────────────
    setStage(BOOT.INITIALIZING_SCHEDULER);
    initializeScheduler();
    updateAppState({ flags: { schedulerReady: true } });

    // ── STEP 16: Emit RUNTIME_INITIALIZED ────────────────────────
    setStage(BOOT.EMITTING_RUNTIME_INITIALIZED);
    markRuntimeReady();
    markBootComplete();
    updateAppState({
      ready:  true,
      flags:  { storageReady: true },
      timestamps: { bootCompletedAt: Date.now() },
    });

    emitRuntimeEvent(RUNTIME_EVENTS.RUNTIME_INITIALIZED, {
      runtimeState: getCoreRuntimeState(),
    });

    // ── STEP 17: Mount Application ───────────────────────────────
    setStage(BOOT.MOUNTING_APPLICATION);
    BootLogger.info('Handing off to application mount...');
    if (typeof onReady === 'function') {
      await onReady();
    }

    // ── STEP 18: Emit APP_READY ───────────────────────────────────
    setStage(BOOT.APP_READY);
    _bootState.completedAt = Date.now();

    emitRuntimeEvent(RUNTIME_EVENTS.APP_READY, {
      duration: _bootState.completedAt - _bootState.startedAt,
    });

    BootLogger.info(
      `Boot COMPLETE — total: ${_bootState.completedAt - _bootState.startedAt}ms`
    );
    BootLogger.info('Stage timings:', _bootState.timings);

  } catch (err) {
    _bootState.stage = BOOT.FATAL_ERROR;
    _bootState.error = { message: err.message, stack: err.stack };

    setRuntimeError(err);
    emitRuntimeEvent(RUNTIME_EVENTS.BOOT_FAILED, { error: err.message });

    BootLogger.error(`FATAL BOOT ERROR at [${_bootState.stage}]: ${err.message}`);
    BootLogger.error(err.stack || '(no stack)');
  } finally {
    BootLogger.groupEnd();
  }

  return _bootState;
}

// ----------------------------------------------------------------
// GET BOOT STATE
// ----------------------------------------------------------------

export function getBootState() {
  return { ..._bootState };
}
