// ================================================================
// IMMORTAIL™ — CENTRALIZED EVENT TYPE REGISTRY
// SSOT: ALL event strings defined here. No hardcoded strings elsewhere.
// ================================================================

// ----------------------------------------------------------------
// SYSTEM EVENTS
// ----------------------------------------------------------------
export const SYSTEM_EVENTS = {
  APP_READY:            'SYSTEM::APP_READY',
  APP_SHUTDOWN:         'SYSTEM::APP_SHUTDOWN',
  RUNTIME_INITIALIZED:  'SYSTEM::RUNTIME_INITIALIZED',
  HYDRATION_COMPLETE:   'SYSTEM::HYDRATION_COMPLETE',
  RECOVERY_COMPLETE:    'SYSTEM::RECOVERY_COMPLETE',
  SAFE_MODE_ENTERED:    'SYSTEM::SAFE_MODE_ENTERED',
};

// ----------------------------------------------------------------
// STORAGE EVENTS
// ----------------------------------------------------------------
export const STORAGE_EVENTS = {
  STORAGE_INITIALIZED: 'STORAGE::INITIALIZED',
  STORAGE_WRITE:       'STORAGE::WRITE',
  STORAGE_UPDATE:      'STORAGE::UPDATE',
  STORAGE_ERROR:       'STORAGE::ERROR',
};

// ----------------------------------------------------------------
// STATE EVENTS
// ----------------------------------------------------------------
export const STATE_EVENTS = {
  STATE_UPDATED:         'STATE::UPDATED',
  SESSION_RESTORED:      'STATE::SESSION_RESTORED',
  RUNTIME_STATE_CHANGED: 'STATE::RUNTIME_STATE_CHANGED',
};

// ----------------------------------------------------------------
// DOG EVENTS
// ----------------------------------------------------------------
export const DOG_EVENTS = {
  DOG_STATE_UPDATED:    'DOG::STATE_UPDATED',
  DOG_PROFILE_LOADED:   'DOG::PROFILE_LOADED',
  DOG_RUNTIME_CHANGED:  'DOG::RUNTIME_CHANGED',
};

// ----------------------------------------------------------------
// EMOTION EVENTS
// ----------------------------------------------------------------
export const EMOTION_EVENTS = {
  EMOTION_CHANGED: 'EMOTION::CHANGED',
  EMOTION_SYNCED:  'EMOTION::SYNCED',
};

// ----------------------------------------------------------------
// MEMORY EVENTS
// ----------------------------------------------------------------
export const MEMORY_EVENTS = {
  MEMORY_CREATED:  'MEMORY::CREATED',
  MEMORY_UPDATED:  'MEMORY::UPDATED',
  MEMORY_RESTORED: 'MEMORY::RESTORED',
};

// ----------------------------------------------------------------
// MEDIA EVENTS
// ----------------------------------------------------------------
export const MEDIA_EVENTS = {
  MEDIA_UPLOADED:          'MEDIA::UPLOADED',
  MEDIA_ANALYZED:          'MEDIA::ANALYZED',
  RECONSTRUCTION_COMPLETE: 'MEDIA::RECONSTRUCTION_COMPLETE',
};

// ----------------------------------------------------------------
// AI EVENTS
// ----------------------------------------------------------------
export const AI_EVENTS = {
  AGENT_REGISTERED: 'AI::AGENT_REGISTERED',
  AGENT_REMOVED:    'AI::AGENT_REMOVED',
  TASK_CREATED:     'AI::TASK_CREATED',
  TASK_COMPLETED:   'AI::TASK_COMPLETED',
};

// ----------------------------------------------------------------
// NOTIFICATION EVENTS
// ----------------------------------------------------------------
export const NOTIFICATION_EVENTS = {
  NOTIFICATION_QUEUED:    'NOTIFICATION::QUEUED',
  NOTIFICATION_DELIVERED: 'NOTIFICATION::DELIVERED',
  NOTIFICATION_DISMISSED: 'NOTIFICATION::DISMISSED',
};

// ----------------------------------------------------------------
// RECONSTRUCTION EVENTS
// ----------------------------------------------------------------
export const RECONSTRUCTION_EVENTS = {
  JOB_REGISTERED: 'RECONSTRUCTION::JOB_REGISTERED',
  JOB_STARTED:    'RECONSTRUCTION::JOB_STARTED',
  JOB_COMPLETE:   'RECONSTRUCTION::JOB_COMPLETE',
  JOB_FAILED:     'RECONSTRUCTION::JOB_FAILED',
};

// ----------------------------------------------------------------
// FLAT MAP — all events in one lookup table
// ----------------------------------------------------------------
export const ALL_EVENTS = {
  ...SYSTEM_EVENTS,
  ...STORAGE_EVENTS,
  ...STATE_EVENTS,
  ...DOG_EVENTS,
  ...EMOTION_EVENTS,
  ...MEMORY_EVENTS,
  ...MEDIA_EVENTS,
  ...AI_EVENTS,
  ...NOTIFICATION_EVENTS,
  ...RECONSTRUCTION_EVENTS,
};

// ----------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------

/**
 * Assert that a given event type string is a registered event.
 * Throws if unknown.
 */
export function assertKnownEvent(eventType) {
  const known = Object.values(ALL_EVENTS);
  if (!known.includes(eventType)) {
    throw new Error(
      `[EventTypes] Unknown event type: "${eventType}". Register it in eventTypes.js first.`
    );
  }
}

/**
 * Check without throwing.
 */
export function isKnownEvent(eventType) {
  return Object.values(ALL_EVENTS).includes(eventType);
}
