// ================================================================
// IMMORTAIL™ — CENTRALIZED CONSTANTS (Event Unification Patch)
// SSOT: All runtime strings, stages, and statuses defined here.
//
// EVENT UNIFICATION NOTE:
// RUNTIME_EVENTS has been retired. All event strings now come from
// eventTypes.js exclusively. This file re-exports SYSTEM_EVENTS as
// RUNTIME_EVENTS for backward-compat during migration — the values
// are now the canonical namespaced strings (e.g. "SYSTEM::APP_READY").
// All call sites should migrate to importing from eventTypes.js directly.
// ================================================================

// ----------------------------------------------------------------
// UNIFIED EVENT RE-EXPORT (replaces the old RUNTIME_EVENTS plain-key map)
// RUNTIME_EVENTS is kept as a name but now points to namespaced values.
// ----------------------------------------------------------------
export {
  SYSTEM_EVENTS   as RUNTIME_EVENTS,
  SYSTEM_EVENTS,
  DOG_EVENTS,
  EMOTION_EVENTS,
  MEMORY_EVENTS,
  STORAGE_EVENTS,
  STATE_EVENTS,
  MEDIA_EVENTS,
  ALL_EVENTS,
}                                                from '../events/eventTypes.js';

// ----------------------------------------------------------------
// APP METADATA
// ----------------------------------------------------------------
export const APP_METADATA = {
  name:    'IMMORTAIL',
  version: '1.0.0',
  build:   'RUN_10',
};

// ----------------------------------------------------------------
// BOOT STAGES
// ----------------------------------------------------------------
export const BOOT_STAGES = {
  IDLE:                           'IDLE',
  VALIDATING_ENVIRONMENT:         'VALIDATING_ENVIRONMENT',
  INITIALIZING_RUNTIME:           'INITIALIZING_RUNTIME',
  VALIDATING_RUNTIME_CONTRACTS:   'VALIDATING_RUNTIME_CONTRACTS',
  INITIALIZING_STORAGE:           'INITIALIZING_STORAGE',
  VALIDATING_SCHEMAS:             'VALIDATING_SCHEMAS',
  RUNNING_MIGRATIONS:             'RUNNING_MIGRATIONS',
  INITIALIZING_STATE_LAYER:       'INITIALIZING_STATE_LAYER',
  INITIALIZING_EVENT_SYSTEM:      'INITIALIZING_EVENT_SYSTEM',
  REGISTERING_EVENT_CONTRACTS:    'REGISTERING_EVENT_CONTRACTS',
  INITIALIZING_HYDRATION:         'INITIALIZING_HYDRATION',
  HYDRATING_RUNTIME:              'HYDRATING_RUNTIME',
  INITIALIZING_RECOVERY:          'INITIALIZING_RECOVERY',
  RESTORING_SESSIONS:             'RESTORING_SESSIONS',
  REGISTERING_SERVICES:           'REGISTERING_SERVICES',
  INITIALIZING_AGENT_REGISTRY:    'INITIALIZING_AGENT_REGISTRY',
  INITIALIZING_LIFECYCLE:         'INITIALIZING_LIFECYCLE',
  INITIALIZING_SUPERVISOR:        'INITIALIZING_SUPERVISOR',
  REGISTERING_AGENTS:             'REGISTERING_AGENTS',
  INITIALIZING_COMPANION_ENGINES: 'INITIALIZING_COMPANION_ENGINES',
  SYNCHRONIZING_COMPANION_RUNTIME:'SYNCHRONIZING_COMPANION_RUNTIME',
  INITIALIZING_MEDIA_PIPELINE:    'INITIALIZING_MEDIA_PIPELINE',
  INITIALIZING_RECONSTRUCTION:    'INITIALIZING_RECONSTRUCTION',
  INITIALIZING_RENDERER:          'INITIALIZING_RENDERER',
  INITIALIZING_SCENE_MANAGER:     'INITIALIZING_SCENE_MANAGER',
  INITIALIZING_VISUALIZATION:     'INITIALIZING_VISUALIZATION',
  INITIALIZING_UI_SHELL:          'INITIALIZING_UI_SHELL',
  INITIALIZING_SCHEDULER:         'INITIALIZING_SCHEDULER',
  INITIALIZING_INTEGRATION_LAYER: 'INITIALIZING_INTEGRATION_LAYER',
  RUNNING_HEALTH_CHECKS:          'RUNNING_HEALTH_CHECKS',
  VALIDATING_DEPENDENCY_GRAPH:    'VALIDATING_DEPENDENCY_GRAPH',
  FINALIZING_BOOT:                'FINALIZING_BOOT',
  EMITTING_RUNTIME_INITIALIZED:   'EMITTING_RUNTIME_INITIALIZED',
  MOUNTING_APPLICATION:           'MOUNTING_APPLICATION',
  APP_READY:                      'APP_READY',
  FATAL_ERROR:                    'FATAL_ERROR',
};

// ----------------------------------------------------------------
// RUNTIME STATUSES
// ----------------------------------------------------------------
export const RUNTIME_STATUS = {
  UNINITIALIZED: 'UNINITIALIZED',
  BOOTING:       'BOOTING',
  READY:         'READY',
  DEGRADED:      'DEGRADED',
  CRASHED:       'CRASHED',
};

// ----------------------------------------------------------------
// RUNTIME MODES
// ----------------------------------------------------------------
export const RUNTIME_MODE = {
  DEVELOPMENT: 'development',
  PRODUCTION:  'production',
  TEST:        'test',
};

// ----------------------------------------------------------------
// VALIDATION STATUSES
// ----------------------------------------------------------------
export const VALIDATION_STATUS = {
  PASS:    'PASS',
  FAIL:    'FAIL',
  WARN:    'WARN',
  SKIPPED: 'SKIPPED',
};

// ----------------------------------------------------------------
// HYDRATION STATUSES
// ----------------------------------------------------------------
export const HYDRATION_STATUS = {
  IDLE:     'IDLE',
  PENDING:  'PENDING',
  COMPLETE: 'COMPLETE',
  FAILED:   'FAILED',
};

// ----------------------------------------------------------------
// RECOVERY STATUSES
// ----------------------------------------------------------------
export const RECOVERY_STATUS = {
  IDLE:          'IDLE',
  TRIGGERED:     'TRIGGERED',
  RECOVERING:    'RECOVERING',
  RESOLVED:      'RESOLVED',
  UNRESOLVABLE:  'UNRESOLVABLE',
};

// ----------------------------------------------------------------
// SCHEDULER CONSTANTS
// ----------------------------------------------------------------
export const SCHEDULER_STATUS = {
  IDLE:     'IDLE',
  RUNNING:  'RUNNING',
  SHUTDOWN: 'SHUTDOWN',
};

export const SCHEDULER_TASK_STATUS = {
  PENDING:  'PENDING',
  RUNNING:  'RUNNING',
  COMPLETE: 'COMPLETE',
  FAILED:   'FAILED',
  REMOVED:  'REMOVED',
};

// ----------------------------------------------------------------
// LOG PREFIXES
// ----------------------------------------------------------------
export const LOG_PREFIX = {
  SYSTEM:     '[IMMORTAIL][SYSTEM]',
  BOOT:       '[IMMORTAIL][BOOT]',
  RUNTIME:    '[IMMORTAIL][RUNTIME]',
  VALIDATION: '[IMMORTAIL][VALIDATION]',
  HYDRATION:  '[IMMORTAIL][HYDRATION]',
  RECOVERY:   '[IMMORTAIL][RECOVERY]',
  SCHEDULER:  '[IMMORTAIL][SCHEDULER]',
  ENV:        '[IMMORTAIL][ENV]',
};
