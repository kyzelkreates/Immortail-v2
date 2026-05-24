// ================================================================
// IMMORTAIL™ — UI HELPERS
// Safe event wrappers, UI state mappers, rendering helpers.
// NO BUSINESS LOGIC. PRESENTATION UTILITIES ONLY.
// ================================================================

/**
 * Wrap a service call in a safe async handler for UI events.
 * Prevents unhandled promise rejections from crashing the UI.
 *
 * @param {Function} asyncFn
 * @param {Object}   [options]
 * @param {Function} [options.onError]
 * @returns {Function} event handler
 */
export function safeServiceCall(asyncFn, { onError } = {}) {
  return async (...args) => {
    try {
      await asyncFn(...args);
    } catch (err) {
      console.error('[IMMORTAIL UI] Service call failed:', err.message);
      if (typeof onError === 'function') onError(err);
    }
  };
}

/**
 * Map runtime boot state to UI-ready display object.
 * @param {Object} bootState
 * @returns {Object}
 */
export function mapBootStateToUI(bootState) {
  if (!bootState) return { label: 'Unknown', status: 'loading', progress: 0 };

  const { stage, startedAt, completedAt, error } = bootState;

  if (error)          return { label: 'Error',       status: 'error',   progress: 0,   error };
  if (completedAt)    return { label: 'Ready',        status: 'ready',   progress: 100 };
  if (!stage)         return { label: 'Starting…',   status: 'loading', progress: 2 };

  const stageProgress = {
    VALIDATING_ENVIRONMENT:          5,
    INITIALIZING_RUNTIME:            10,
    VALIDATING_RUNTIME_CONTRACTS:    13,
    INITIALIZING_STORAGE:            18,
    VALIDATING_SCHEMAS:              22,
    RUNNING_MIGRATIONS:              26,
    INITIALIZING_STATE_LAYER:        30,
    INITIALIZING_EVENT_SYSTEM:       34,
    REGISTERING_EVENT_CONTRACTS:     37,
    INITIALIZING_HYDRATION:          40,
    HYDRATING_RUNTIME:               43,
    INITIALIZING_RECOVERY:           46,
    RESTORING_SESSIONS:              49,
    REGISTERING_SERVICES:            53,
    INITIALIZING_AGENT_REGISTRY:     57,
    INITIALIZING_LIFECYCLE:          60,
    INITIALIZING_SUPERVISOR:         63,
    REGISTERING_AGENTS:              67,
    INITIALIZING_COMPANION_ENGINES:  71,
    SYNCHRONIZING_COMPANION_RUNTIME: 74,
    INITIALIZING_MEDIA_PIPELINE:     77,
    INITIALIZING_RECONSTRUCTION:     80,
    INITIALIZING_RENDERER:           83,
    INITIALIZING_SCENE_MANAGER:      86,
    INITIALIZING_VISUALIZATION:      89,
    INITIALIZING_UI_SHELL:           92,
    INITIALIZING_SCHEDULER:          95,
    EMITTING_RUNTIME_INITIALIZED:    97,
    MOUNTING_APPLICATION:            98,
    APP_READY:                       100,
  };

  const progress = stageProgress[stage] || 5;
  const label    = stage.replace(/_/g, ' ').toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return { label, status: 'loading', progress };
}

/**
 * Map a companion emotion state to UI display properties.
 * @param {Object} emotionSnapshot — from emotionEngine
 */
export function mapEmotionToDisplay(emotionSnapshot) {
  if (!emotionSnapshot) return { label: 'Unknown', color: '#8a95a3', intensity: 0 };

  const colorMap = {
    joy:      '#34d399',
    calm:     '#60a5fa',
    excited:  '#fbbf24',
    anxious:  '#f87171',
    trusting: '#a78bfa',
    attached: '#f472b6',
    stressed: '#fb923c',
    neutral:  '#8a95a3',
  };

  const { dominantEmotion, intensity } = emotionSnapshot;
  return {
    label:     dominantEmotion || 'neutral',
    color:     colorMap[dominantEmotion] || colorMap.neutral,
    intensity: typeof intensity === 'number' ? intensity : 0,
  };
}

/**
 * Map system health object to a single UI status.
 */
export function mapSystemHealth(runtimeState) {
  if (!runtimeState) return 'unknown';
  if (runtimeState.fatalError) return 'error';
  if (runtimeState.ready)      return 'ready';
  return 'loading';
}

/**
 * Derive initials from a profile name for avatar display.
 */
export function getInitials(name) {
  if (!name || typeof name !== 'string') return '?';
  return name.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

/**
 * Generate a deterministic color from a string seed.
 * Used for avatar / tag coloring without randomness.
 */
export function seedColor(str) {
  if (!str) return '#4f9cf9';
  const PALETTE = [
    '#4f9cf9','#34d399','#fbbf24','#f87171',
    '#a78bfa','#f472b6','#60a5fa','#fb923c',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/**
 * Build className string safely from conditional map.
 * Usage: cx({ active: isActive, disabled: !enabled }, 'base-class')
 */
export function cx(...args) {
  const classes = [];
  for (const arg of args) {
    if (!arg) continue;
    if (typeof arg === 'string') { classes.push(arg); continue; }
    if (typeof arg === 'object') {
      for (const [k, v] of Object.entries(arg)) { if (v) classes.push(k); }
    }
  }
  return classes.join(' ');
}
