// ================================================================
// IMMORTAIL™ — BOOT FINALIZER
// Final boot completion controller. Validates all runs are resolved,
// locks runtime state, emits APP_READY.
// NO FEATURE LOGIC. FINALIZATION ONLY.
// ================================================================

import { SystemLogger }                              from '../utils/logger.js';
import { getUnresolvedCritical, getDependencyGraphStatus } from './dependencyGraph.js';
import { getSystemHealthStatus, HEALTH_STATUS }      from './systemHealth.js';

const FinalizerLogger = SystemLogger;

// ----------------------------------------------------------------
// BOOT COMPLETION REQUIREMENTS
// All 34 boot steps that must be confirmed before finalization.
// ----------------------------------------------------------------

export const REQUIRED_BOOT_STEPS = [
  'validate_environment',
  'initialize_runtime',
  'validate_runtime_contracts',
  'initialize_storage',
  'validate_schemas',
  'run_migrations',
  'initialize_state_layer',
  'initialize_event_system',
  'register_event_contracts',
  'initialize_hydration_system',
  'hydrate_runtime_state',
  'initialize_recovery_engine',
  'restore_active_sessions',
  'register_services',
  'initialize_agent_registry',
  'initialize_lifecycle_controller',
  'initialize_supervisor_agent',
  'register_specialized_agents',
  'initialize_companion_engines',
  'synchronize_companion_runtime',
  'initialize_media_pipeline',
  'initialize_reconstruction_foundation',
  'initialize_renderer',
  'initialize_scene_manager',
  'initialize_visualization_systems',
  'initialize_ui_shell',
  'initialize_scheduler',
  'initialize_integration_layer',
  'run_system_health_checks',
  'validate_dependency_graph',
  'finalize_boot',
  'emit_runtime_initialized',
  'mount_application',
  'emit_app_ready',
];

// ----------------------------------------------------------------
// INTERNAL STATE
// ----------------------------------------------------------------

let _finalized     = false;
let _locked        = false;
let _appReadyEmitted = false;

/** @type {Set<string>} confirmed boot steps */
const _completedSteps = new Set();

/** @type {Object|null} finalization report */
let _finalizationReport = null;

// ----------------------------------------------------------------
// CONFIRM BOOT STEP
// ----------------------------------------------------------------

/**
 * Mark a boot step as complete.
 * Called by boot.js after each step succeeds.
 * @param {string} stepId  — must match REQUIRED_BOOT_STEPS entry
 */
export function confirmBootStep(stepId) {
  if (!REQUIRED_BOOT_STEPS.includes(stepId)) {
    FinalizerLogger.warn(`[BootFinalizer] Unknown boot step: "${stepId}" — ignoring.`);
    return false;
  }
  _completedSteps.add(stepId);
  FinalizerLogger.debug(
    `[BootFinalizer] Step confirmed: ${stepId} (${_completedSteps.size}/${REQUIRED_BOOT_STEPS.length})`
  );
  return true;
}

// ----------------------------------------------------------------
// VALIDATE BOOT COMPLETION
// ----------------------------------------------------------------

/**
 * Validate that all required boot steps are confirmed.
 * @returns {{ complete: boolean, missing: string[], completedCount: number }}
 */
export function validateBootCompletion() {
  const missing = REQUIRED_BOOT_STEPS.filter(s => !_completedSteps.has(s));
  const complete = missing.length === 0;

  FinalizerLogger.info(
    `[BootFinalizer] Boot completion check — complete: ${complete}, ` +
    `${_completedSteps.size}/${REQUIRED_BOOT_STEPS.length} steps, ` +
    `missing: ${missing.length}`
  );

  if (!complete) {
    FinalizerLogger.warn(`[BootFinalizer] Missing steps: ${missing.join(', ')}`);
  }

  return { complete, missing, completedCount: _completedSteps.size };
}

// ----------------------------------------------------------------
// FINALIZE BOOT
// ----------------------------------------------------------------

/**
 * Run the finalization sequence.
 * Validates boot completion, dependency graph, system health.
 * Locks the runtime and emits APP_READY if all checks pass.
 *
 * @param {Object} [options]
 * @param {boolean} [options.requireAllSteps=false]  — treat missing non-critical steps as error
 * @param {boolean} [options.skipHealthCheck=false]
 * @returns {{ success: boolean, report: Object }}
 */
export function finalizeBoot(options = {}) {
  if (_finalized) {
    FinalizerLogger.warn('[BootFinalizer] Already finalized.');
    return { success: true, report: _finalizationReport };
  }

  FinalizerLogger.info('[BootFinalizer] Finalizing boot sequence...');

  const errors   = [];
  const warnings = [];

  // ── 1. Boot step completion ────────────────────────────────────
  const bootCheck = validateBootCompletion();
  if (!bootCheck.complete) {
    const msg = `Missing boot steps: ${bootCheck.missing.join(', ')}`;
    if (options.requireAllSteps) errors.push(msg);
    else                         warnings.push(msg);
  }

  // ── 2. Dependency graph ────────────────────────────────────────
  const graphStatus     = getDependencyGraphStatus();
  const unresolved      = graphStatus.unresolvedCritical || [];
  if (unresolved.length > 0) {
    errors.push(`Unresolved critical modules: ${unresolved.join(', ')}`);
  }

  // ── 3. System health ──────────────────────────────────────────
  if (!options.skipHealthCheck) {
    const health = getSystemHealthStatus();
    if (health.overallStatus === HEALTH_STATUS.CRITICAL) {
      errors.push(`System health is CRITICAL — finalization blocked.`);
    } else if (health.overallStatus === HEALTH_STATUS.DEGRADED) {
      warnings.push(`System health is DEGRADED — proceeding with caution.`);
    }
  }

  const success = errors.length === 0;

  // ── 4. Lock runtime (if successful) ───────────────────────────
  if (success) {
    lockRuntimeState();
    emitAppReady();
  }

  _finalized = true;
  _finalizationReport = {
    success,
    finalizedAt:    Date.now(),
    completedSteps: _completedSteps.size,
    totalSteps:     REQUIRED_BOOT_STEPS.length,
    missing:        bootCheck.missing,
    errors,
    warnings,
    locked:         _locked,
    appReadyEmitted: _appReadyEmitted,
    graphSummary:   {
      nodeCount:       graphStatus.nodeCount,
      resolvedCount:   graphStatus.resolvedCount,
      unresolvedCritical: unresolved,
    },
  };

  FinalizerLogger.info(
    `[BootFinalizer] Finalization ${success ? 'SUCCESS' : 'FAILED'} — ` +
    `errors: ${errors.length}, warnings: ${warnings.length}, locked: ${_locked}`
  );

  if (!success) {
    for (const err of errors)  FinalizerLogger.error(`[BootFinalizer] ERROR: ${err}`);
    for (const w of warnings)  FinalizerLogger.warn(`[BootFinalizer] WARN: ${w}`);
  }

  return { success, report: _finalizationReport };
}

// ----------------------------------------------------------------
// LOCK RUNTIME STATE
// ----------------------------------------------------------------

/**
 * Lock the runtime into operational mode.
 * After locking, structural changes to the boot pipeline are rejected.
 * State updates (via state layer) remain allowed.
 */
export function lockRuntimeState() {
  if (_locked) return;
  _locked = true;
  FinalizerLogger.info('[BootFinalizer] Runtime locked into operational mode.');

  // Emit DOM event for any listeners
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('immortail:runtime:locked', {
      detail: { lockedAt: Date.now() },
    }));
  }
}

// ----------------------------------------------------------------
// EMIT APP READY
// ----------------------------------------------------------------

/**
 * Emit the final APP_READY event.
 * Dispatched to both the DOM and the event bus (if available).
 */
export function emitAppReady() {
  if (_appReadyEmitted) return;
  _appReadyEmitted = true;

  const detail = {
    appReadyAt:     Date.now(),
    completedSteps: _completedSteps.size,
  };

  // DOM CustomEvent (UI picks this up)
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('immortailapp:app_ready', { detail }));
  }

  FinalizerLogger.info('[BootFinalizer] APP_READY emitted.');
}

// ----------------------------------------------------------------
// GET FINALIZER STATUS
// ----------------------------------------------------------------

export function getBootFinalizerStatus() {
  return {
    finalized:       _finalized,
    locked:          _locked,
    appReadyEmitted: _appReadyEmitted,
    completedSteps:  _completedSteps.size,
    totalSteps:      REQUIRED_BOOT_STEPS.length,
    pendingSteps:    REQUIRED_BOOT_STEPS.filter(s => !_completedSteps.has(s)),
    report:          _finalizationReport,
  };
}

// ----------------------------------------------------------------
// IS RUNTIME LOCKED
// ----------------------------------------------------------------

export function isRuntimeLocked() { return _locked; }
export function isBootFinalized()  { return _finalized; }
export function isAppReadyEmitted(){ return _appReadyEmitted; }

// ----------------------------------------------------------------
// ERROR
// ----------------------------------------------------------------

export class BootFinalizerError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name      = 'BootFinalizerError';
    this.context   = context;
    this.timestamp = Date.now();
  }
}
