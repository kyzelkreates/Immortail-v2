// ================================================================
// IMMORTAIL™ — CENTRAL APPLICATION BOOTSTRAPPER
// Executes the locked boot pipeline in deterministic order.
// NO STORAGE ACCESS. NO UI LOGIC. NO AI LOGIC.
// ================================================================

import { BOOT_STAGES, RUNTIME_EVENTS, RUNTIME_STATUS } from '../utils/constants.js';
import { BootLogger } from '../utils/logger.js';
import { validateEnvironment, validateRuntimeContracts } from './validation.js';
import { initializeRuntime, getRuntimeState, updateRuntimeState, setRuntimeError, markRuntimeReady } from './runtime.js';
import { initializeHydration } from './hydration.js';
import { initializeRecovery } from './recovery.js';
import { initializeScheduler } from './scheduler.js';

// ----------------------------------------------------------------
// INTERNAL BOOT STATE
// ----------------------------------------------------------------

let _bootState = {
  stage: BOOT_STAGES.IDLE,
  startedAt: null,
  completedAt: null,
  error: null,
  timings: {},
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

function elapsed(fromStage, toStage) {
  const from = _bootState.timings[fromStage];
  const to = _bootState.timings[toStage];
  if (!from || !to) return 'N/A';
  return `${to - from}ms`;
}

function emitRuntimeEvent(eventName, detail = {}) {
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
    BootLogger.info(`Event emitted: ${eventName}`);
  }
}

// ----------------------------------------------------------------
// BOOT PIPELINE
// ================================================================
// LOCKED BOOT ORDER:
// 1. validate environment
// 2. initialize runtime
// 3. validate runtime contracts
// 4. initialize hydration system
// 5. initialize recovery system
// 6. initialize scheduler
// 7. emit runtime initialized
// 8. mount application (caller responsibility)
// 9. emit APP_READY (caller responsibility)
// ================================================================

export async function initializeApp(onReady) {
  BootLogger.group('IMMORTAIL™ Boot Pipeline');

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
    // STEP 4 — Initialize Hydration System
    // ────────────────────────────────────────
    setStage(BOOT_STAGES.INITIALIZING_HYDRATION);
    await initializeHydration();

    // ────────────────────────────────────────
    // STEP 5 — Initialize Recovery System
    // ────────────────────────────────────────
    setStage(BOOT_STAGES.INITIALIZING_RECOVERY);
    initializeRecovery();

    // ────────────────────────────────────────
    // STEP 6 — Initialize Scheduler
    // ────────────────────────────────────────
    setStage(BOOT_STAGES.INITIALIZING_SCHEDULER);
    initializeScheduler();

    // ────────────────────────────────────────
    // STEP 7 — Emit RUNTIME_INITIALIZED
    // ────────────────────────────────────────
    setStage(BOOT_STAGES.EMITTING_RUNTIME_INITIALIZED);
    markRuntimeReady();
    emitRuntimeEvent(RUNTIME_EVENTS.RUNTIME_INITIALIZED, { runtimeState: getRuntimeState() });

    // ────────────────────────────────────────
    // STEP 8 — Mount Application (caller)
    // ────────────────────────────────────────
    setStage(BOOT_STAGES.MOUNTING_APPLICATION);
    BootLogger.info('Handing off to application mount...');

    if (typeof onReady === 'function') {
      await onReady();
    }

    // ────────────────────────────────────────
    // STEP 9 — Emit APP_READY
    // ────────────────────────────────────────
    setStage(BOOT_STAGES.APP_READY);
    _bootState.completedAt = Date.now();

    emitRuntimeEvent(RUNTIME_EVENTS.APP_READY, {
      duration: _bootState.completedAt - _bootState.startedAt,
    });

    BootLogger.info(`Boot COMPLETE. Total duration: ${_bootState.completedAt - _bootState.startedAt}ms`);
    BootLogger.info(`Stage timings:`, _bootState.timings);

  } catch (err) {
    _bootState.stage = BOOT_STAGES.FATAL_ERROR;
    _bootState.error = { message: err.message, stack: err.stack };

    setRuntimeError(err);
    emitRuntimeEvent(RUNTIME_EVENTS.BOOT_FAILED, { error: err.message });

    BootLogger.error(`FATAL BOOT ERROR at stage [${_bootState.stage}]: ${err.message}`);
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
