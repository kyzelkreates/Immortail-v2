// ================================================================
// IMMORTAIL™ — CENTRAL APPLICATION BOOTSTRAPPER
// Executes the locked boot pipeline in deterministic order.
// NO UI LOGIC. NO AI LOGIC. NO STORAGE BUSINESS LOGIC.
//
// BOOT ORDER (Run 2 — updated):
//  1.  validate environment
//  2.  initialize runtime
//  3.  validate runtime contracts
//  4.  initialize storage        ← NEW (Run 2)
//  5.  validate schemas          ← NEW (Run 2)
//  6.  run migrations            ← NEW (Run 2)
//  7.  initialize hydration system
//  8.  initialize recovery system
//  9.  initialize scheduler
//  10. emit runtime initialized
//  11. mount application
//  12. emit APP_READY
// ================================================================

import { BOOT_STAGES, RUNTIME_EVENTS, RUNTIME_STATUS } from '../utils/constants.js';
import { BootLogger } from '../utils/logger.js';
import { validateEnvironment, validateRuntimeContracts } from './validation.js';
import {
  initializeRuntime,
  getRuntimeState,
  updateRuntimeState,
  setRuntimeError,
  markRuntimeReady,
  registerModule,
} from './runtime.js';
import { initializeHydration }  from './hydration.js';
import { initializeRecovery }   from './recovery.js';
import { initializeScheduler }  from './scheduler.js';

// Run 2 — Storage layer integration
import { initializeStorage, validateMigrationState } from '../storage/storage.js';
import { runMigrations, getMigrationVersion }         from '../storage/migrations.js';
import { getAllSchemas, getAllStoreNames }              from '../storage/schemas.js';

// ----------------------------------------------------------------
// EXTENDED BOOT STAGES (Run 2 additions)
// ----------------------------------------------------------------

const EXTENDED_BOOT_STAGES = {
  ...BOOT_STAGES,
  INITIALIZING_STORAGE:       'INITIALIZING_STORAGE',
  VALIDATING_SCHEMAS:         'VALIDATING_SCHEMAS',
  RUNNING_MIGRATIONS:         'RUNNING_MIGRATIONS',
};

// ----------------------------------------------------------------
// INTERNAL BOOT STATE
// ----------------------------------------------------------------

let _bootState = {
  stage:       EXTENDED_BOOT_STAGES.IDLE,
  startedAt:   null,
  completedAt: null,
  error:       null,
  timings:     {},
};

// ----------------------------------------------------------------
// INTERNAL HELPERS
// ----------------------------------------------------------------

function setStage(stage) {
  _bootState.stage = stage;
  _bootState.timings[stage] = Date.now();
  BootLogger.info(`Boot stage: ${stage}`);
  updateRuntimeState({ bootStage: stage });
}

function emitRuntimeEvent(eventName, detail = {}) {
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
    BootLogger.info(`Event emitted: ${eventName}`);
  }
}

// ----------------------------------------------------------------
// BOOT PIPELINE
// ----------------------------------------------------------------

export async function initializeApp(onReady) {
  BootLogger.group('IMMORTAIL™ Boot Pipeline (Run 2)');

  _bootState.startedAt = Date.now();
  BootLogger.info(`Boot started at: ${new Date(_bootState.startedAt).toISOString()}`);

  try {
    // ────────────────────────────────────────
    // STEP 1 — Validate Environment
    // ────────────────────────────────────────
    setStage(BOOT_STAGES.VALIDATING_ENVIRONMENT);
    const envValidation = validateEnvironment();

    if (!envValidation.passed) {
      throw new Error(
        `Environment validation failed. Critical failures: ${envValidation.criticalFailed.join(', ')}`
      );
    }
    if (envValidation.warnings.length > 0) {
      BootLogger.warn(`Environment warnings: ${envValidation.warnings.join(', ')}`);
    }

    // ────────────────────────────────────────
    // STEP 2 — Initialize Runtime
    // ────────────────────────────────────────
    setStage(BOOT_STAGES.INITIALIZING_RUNTIME);
    await initializeRuntime();

    // ────────────────────────────────────────
    // STEP 3 — Validate Runtime Contracts
    // ────────────────────────────────────────
    setStage(BOOT_STAGES.VALIDATING_RUNTIME_CONTRACTS);
    const runtimeState = getRuntimeState();
    const contractValidation = validateRuntimeContracts(runtimeState);

    if (!contractValidation.passed) {
      throw new Error(
        `Runtime contract validation failed: ${contractValidation.failed.join(', ')}`
      );
    }

    // ────────────────────────────────────────
    // STEP 4 — Initialize Storage           (Run 2)
    // ────────────────────────────────────────
    setStage(EXTENDED_BOOT_STAGES.INITIALIZING_STORAGE);
    BootLogger.info('Initializing IndexedDB storage engine...');
    await initializeStorage();
    registerModule('storage', { version: getMigrationVersion() });
    BootLogger.info('Storage engine initialized.');

    // ────────────────────────────────────────
    // STEP 5 — Validate Schemas              (Run 2)
    // ────────────────────────────────────────
    setStage(EXTENDED_BOOT_STAGES.VALIDATING_SCHEMAS);
    BootLogger.info('Validating schema registry...');
    const schemas = getAllSchemas();
    const storeNames = getAllStoreNames();

    if (storeNames.length === 0) {
      throw new Error('Schema validation failed: no stores registered.');
    }

    for (const storeName of storeNames) {
      const schema = schemas[storeName];
      if (!schema.keyPath || !schema.storeName || !schema.validationShape) {
        throw new Error(
          `Schema validation failed for store "${storeName}": missing required schema fields.`
        );
      }
    }

    BootLogger.info(`Schema validation passed — ${storeNames.length} store(s) registered.`);

    // ────────────────────────────────────────
    // STEP 6 — Migrations already ran       (Run 2)
    // (migrations execute inside initializeStorage via onupgradeneeded)
    // This step validates the final migration state.
    // ────────────────────────────────────────
    setStage(EXTENDED_BOOT_STAGES.RUNNING_MIGRATIONS);
    BootLogger.info('Validating migration completion...');

    // We import getStorage lazily here to avoid circular issues at boot
    const { getStorage } = await import('../storage/storage.js');
    const db = getStorage();
    const migrationState = validateMigrationState(db);

    if (!migrationState.valid) {
      throw new Error(
        `Migration validation failed. Missing stores: ${migrationState.missingStores.join(', ')}`
      );
    }

    BootLogger.info(
      `Migrations validated — schema v${getMigrationVersion()}, ` +
      `${migrationState.presentStores.length} store(s) present.`
    );

    // ────────────────────────────────────────
    // STEP 7 — Initialize Hydration System
    // ────────────────────────────────────────
    setStage(BOOT_STAGES.INITIALIZING_HYDRATION);
    await initializeHydration();

    // ────────────────────────────────────────
    // STEP 8 — Initialize Recovery System
    // ────────────────────────────────────────
    setStage(BOOT_STAGES.INITIALIZING_RECOVERY);
    initializeRecovery();

    // ────────────────────────────────────────
    // STEP 9 — Initialize Scheduler
    // ────────────────────────────────────────
    setStage(BOOT_STAGES.INITIALIZING_SCHEDULER);
    initializeScheduler();

    // ────────────────────────────────────────
    // STEP 10 — Emit RUNTIME_INITIALIZED
    // ────────────────────────────────────────
    setStage(BOOT_STAGES.EMITTING_RUNTIME_INITIALIZED);
    markRuntimeReady();
    emitRuntimeEvent(RUNTIME_EVENTS.RUNTIME_INITIALIZED, {
      runtimeState: getRuntimeState(),
    });

    // ────────────────────────────────────────
    // STEP 11 — Mount Application (caller)
    // ────────────────────────────────────────
    setStage(BOOT_STAGES.MOUNTING_APPLICATION);
    BootLogger.info('Handing off to application mount...');

    if (typeof onReady === 'function') {
      await onReady();
    }

    // ────────────────────────────────────────
    // STEP 12 — Emit APP_READY
    // ────────────────────────────────────────
    setStage(BOOT_STAGES.APP_READY);
    _bootState.completedAt = Date.now();

    emitRuntimeEvent(RUNTIME_EVENTS.APP_READY, {
      duration: _bootState.completedAt - _bootState.startedAt,
    });

    BootLogger.info(
      `Boot COMPLETE. Total duration: ${_bootState.completedAt - _bootState.startedAt}ms`
    );
    BootLogger.info('Stage timings:', _bootState.timings);

  } catch (err) {
    _bootState.stage = BOOT_STAGES.FATAL_ERROR;
    _bootState.error = { message: err.message, stack: err.stack };

    setRuntimeError(err);
    emitRuntimeEvent(RUNTIME_EVENTS.BOOT_FAILED, { error: err.message });

    BootLogger.error(
      `FATAL BOOT ERROR at stage [${_bootState.stage}]: ${err.message}`
    );
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
