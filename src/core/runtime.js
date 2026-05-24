// ================================================================
// IMMORTAIL™ — CENTRAL RUNTIME CONTROLLER
// Manages runtime state, lifecycle, and module registry.
// ================================================================

import { RUNTIME_STATUS, RUNTIME_MODE, APP_METADATA } from '../utils/constants.js';
import { RuntimeLogger } from '../utils/logger.js';
import { getRuntimeMode, getEnvironmentSnapshot } from '../utils/environment.js';

// ----------------------------------------------------------------
// INTERNAL RUNTIME STATE (single source of truth)
// ----------------------------------------------------------------

let _runtimeState = {
  version: APP_METADATA.version,
  build: APP_METADATA.build,
  appName: APP_METADATA.name,

  status: RUNTIME_STATUS.UNINITIALIZED,
  mode: RUNTIME_MODE.PRODUCTION,

  initializedAt: null,
  readyAt: null,

  environment: null,
  moduleRegistry: {},

  bootStage: null,
  error: null,

  flags: {
    hydrationReady: false,
    recoveryReady: false,
    schedulerReady: false,
  },
};

// ----------------------------------------------------------------
// INITIALIZE RUNTIME
// ----------------------------------------------------------------

export async function initializeRuntime() {
  RuntimeLogger.group('Runtime Initialization');

  if (_runtimeState.status !== RUNTIME_STATUS.UNINITIALIZED) {
    RuntimeLogger.warn('Runtime already initialized. Skipping.');
    RuntimeLogger.groupEnd();
    return _runtimeState;
  }

  _runtimeState.status = RUNTIME_STATUS.BOOTING;
  _runtimeState.initializedAt = Date.now();
  _runtimeState.mode = getRuntimeMode();
  _runtimeState.environment = getEnvironmentSnapshot();

  RuntimeLogger.info(`Runtime booting — version ${_runtimeState.version}, mode: ${_runtimeState.mode}`);
  RuntimeLogger.info(`Initialized at: ${new Date(_runtimeState.initializedAt).toISOString()}`);

  RuntimeLogger.groupEnd();
  return _runtimeState;
}

// ----------------------------------------------------------------
// MARK RUNTIME READY
// ----------------------------------------------------------------

export function markRuntimeReady() {
  _runtimeState.status = RUNTIME_STATUS.READY;
  _runtimeState.readyAt = Date.now();
  const bootDuration = _runtimeState.readyAt - (_runtimeState.initializedAt || _runtimeState.readyAt);
  RuntimeLogger.info(`Runtime READY. Boot duration: ${bootDuration}ms`);
}

// ----------------------------------------------------------------
// GET RUNTIME STATE
// ----------------------------------------------------------------

export function getRuntimeState() {
  return { ..._runtimeState };
}

// ----------------------------------------------------------------
// UPDATE RUNTIME STATE (controlled mutation)
// ----------------------------------------------------------------

export function updateRuntimeState(patch) {
  if (typeof patch !== 'object' || patch === null) {
    RuntimeLogger.error('updateRuntimeState: patch must be a non-null object.');
    return;
  }

  // Protect critical fields from direct overwrite
  const protectedFields = ['version', 'build', 'appName', 'initializedAt'];
  protectedFields.forEach((field) => {
    if (field in patch) {
      RuntimeLogger.warn(`updateRuntimeState: Attempted to overwrite protected field "${field}". Ignored.`);
      delete patch[field];
    }
  });

  _runtimeState = {
    ..._runtimeState,
    ...patch,
    flags: {
      ..._runtimeState.flags,
      ...(patch.flags || {}),
    },
  };

  RuntimeLogger.debug('Runtime state updated.', patch);
}

// ----------------------------------------------------------------
// MODULE REGISTRY
// ----------------------------------------------------------------

export function registerModule(moduleName, metadata = {}) {
  if (_runtimeState.moduleRegistry[moduleName]) {
    RuntimeLogger.warn(`Module "${moduleName}" already registered.`);
    return;
  }
  _runtimeState.moduleRegistry[moduleName] = {
    name: moduleName,
    registeredAt: Date.now(),
    ...metadata,
  };
  RuntimeLogger.info(`Module registered: ${moduleName}`);
}

export function getRegisteredModules() {
  return { ..._runtimeState.moduleRegistry };
}

// ----------------------------------------------------------------
// RUNTIME ERROR HANDLING
// ----------------------------------------------------------------

export function setRuntimeError(error) {
  _runtimeState.status = RUNTIME_STATUS.CRASHED;
  _runtimeState.error = {
    message: error?.message || String(error),
    stack: error?.stack || null,
    timestamp: Date.now(),
  };
  RuntimeLogger.error(`Runtime crashed: ${_runtimeState.error.message}`);
}

export function setRuntimeDegraded(reason) {
  _runtimeState.status = RUNTIME_STATUS.DEGRADED;
  RuntimeLogger.warn(`Runtime degraded: ${reason}`);
}
