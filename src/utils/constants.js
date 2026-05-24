// ================================================================
// IMMORTAIL™ — CENTRALIZED CONSTANTS
// SSOT: All runtime strings, stages, and statuses defined here.
// ================================================================

export const APP_METADATA = {
  name: 'IMMORTAIL',
  version: '1.0.0',
  build: 'RUN_1',
};

// ----------------------------------------------------------------
// BOOT STAGES
// ----------------------------------------------------------------
export const BOOT_STAGES = {
  IDLE: 'IDLE',
  VALIDATING_ENVIRONMENT: 'VALIDATING_ENVIRONMENT',
  INITIALIZING_RUNTIME: 'INITIALIZING_RUNTIME',
  VALIDATING_RUNTIME_CONTRACTS: 'VALIDATING_RUNTIME_CONTRACTS',
  INITIALIZING_HYDRATION: 'INITIALIZING_HYDRATION',
  INITIALIZING_RECOVERY: 'INITIALIZING_RECOVERY',
  INITIALIZING_SCHEDULER: 'INITIALIZING_SCHEDULER',
  EMITTING_RUNTIME_INITIALIZED: 'EMITTING_RUNTIME_INITIALIZED',
  MOUNTING_APPLICATION: 'MOUNTING_APPLICATION',
  APP_READY: 'APP_READY',
  FATAL_ERROR: 'FATAL_ERROR',
};

// ----------------------------------------------------------------
// RUNTIME STATUSES
// ----------------------------------------------------------------
export const RUNTIME_STATUS = {
  UNINITIALIZED: 'UNINITIALIZED',
  BOOTING: 'BOOTING',
  READY: 'READY',
  DEGRADED: 'DEGRADED',
  CRASHED: 'CRASHED',
};

// ----------------------------------------------------------------
// RUNTIME MODES
// ----------------------------------------------------------------
export const RUNTIME_MODE = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test',
};

// ----------------------------------------------------------------
// VALIDATION STATUSES
// ----------------------------------------------------------------
export const VALIDATION_STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  WARN: 'WARN',
  SKIPPED: 'SKIPPED',
};

// ----------------------------------------------------------------
// HYDRATION STATUSES
// ----------------------------------------------------------------
export const HYDRATION_STATUS = {
  IDLE: 'IDLE',
  PENDING: 'PENDING',
  COMPLETE: 'COMPLETE',
  FAILED: 'FAILED',
};

// ----------------------------------------------------------------
// RECOVERY STATUSES
// ----------------------------------------------------------------
export const RECOVERY_STATUS = {
  IDLE: 'IDLE',
  TRIGGERED: 'TRIGGERED',
  RECOVERING: 'RECOVERING',
  RESOLVED: 'RESOLVED',
  UNRESOLVABLE: 'UNRESOLVABLE',
};

// ----------------------------------------------------------------
// SCHEDULER CONSTANTS
// ----------------------------------------------------------------
export const SCHEDULER_STATUS = {
  IDLE: 'IDLE',
  RUNNING: 'RUNNING',
  SHUTDOWN: 'SHUTDOWN',
};

export const SCHEDULER_TASK_STATUS = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETE: 'COMPLETE',
  FAILED: 'FAILED',
  REMOVED: 'REMOVED',
};

// ----------------------------------------------------------------
// RUNTIME EVENTS
// ----------------------------------------------------------------
export const RUNTIME_EVENTS = {
  RUNTIME_INITIALIZED: 'RUNTIME_INITIALIZED',
  APP_READY: 'APP_READY',
  BOOT_FAILED: 'BOOT_FAILED',
  RECOVERY_TRIGGERED: 'RECOVERY_TRIGGERED',
};

// ----------------------------------------------------------------
// LOG PREFIXES
// ----------------------------------------------------------------
export const LOG_PREFIX = {
  SYSTEM: '[IMMORTAIL][SYSTEM]',
  BOOT: '[IMMORTAIL][BOOT]',
  RUNTIME: '[IMMORTAIL][RUNTIME]',
  VALIDATION: '[IMMORTAIL][VALIDATION]',
  HYDRATION: '[IMMORTAIL][HYDRATION]',
  RECOVERY: '[IMMORTAIL][RECOVERY]',
  SCHEDULER: '[IMMORTAIL][SCHEDULER]',
  ENV: '[IMMORTAIL][ENV]',
};
