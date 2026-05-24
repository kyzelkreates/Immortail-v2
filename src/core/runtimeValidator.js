// ================================================================
// IMMORTAIL™ — RUNTIME VALIDATION ENGINE
// Full system integrity validation across all layers.
// NO FEATURE LOGIC. VALIDATION + REPORTING ONLY.
// ================================================================

import { SystemLogger }             from '../utils/logger.js';
import { getDependencyGraphStatus } from './dependencyGraph.js';
import { getSystemHealthStatus, HEALTH_STATUS } from './systemHealth.js';

const ValidatorLogger = SystemLogger;

// ----------------------------------------------------------------
// VALIDATION RESULT LEVELS
// ----------------------------------------------------------------

export const VALIDATION_LEVEL = {
  PASS:    'pass',
  WARN:    'warn',
  FAIL:    'fail',
};

// ----------------------------------------------------------------
// VALIDATION DOMAINS
// ----------------------------------------------------------------

export const VALIDATION_DOMAIN = {
  STORAGE:     'storage',
  STATE:       'state',
  EVENTS:      'events',
  AGENTS:      'agents',
  MEDIA:       'media',
  RENDERING:   'rendering',
  UI:          'ui',
  INTEGRATION: 'integration',
  SSOT:        'ssot',
  BOOT:        'boot',
};

// ----------------------------------------------------------------
// INTERNAL STATE
// ----------------------------------------------------------------

let _lastReport  = null;
let _runCount    = 0;

// ----------------------------------------------------------------
// VALIDATE RUNTIME
// ----------------------------------------------------------------

/**
 * Run a targeted domain validation.
 * @param {string} domain  — VALIDATION_DOMAIN value
 * @param {Object} context — runtime objects passed in for validation
 * @returns {{ domain, level, checks: CheckResult[], summary }}
 */
export function validateRuntime(domain, context = {}) {
  ValidatorLogger.info(`[RuntimeValidator] Validating domain: ${domain}`);

  const checks = _domainChecks[domain]
    ? _domainChecks[domain](context)
    : [_check('domain_registered', false, `Unknown domain: "${domain}"`)];

  const failures = checks.filter(c => c.level === VALIDATION_LEVEL.FAIL);
  const warnings = checks.filter(c => c.level === VALIDATION_LEVEL.WARN);
  const level    = failures.length > 0
    ? VALIDATION_LEVEL.FAIL
    : warnings.length > 0
      ? VALIDATION_LEVEL.WARN
      : VALIDATION_LEVEL.PASS;

  return {
    domain,
    level,
    checks,
    summary: {
      total:    checks.length,
      pass:     checks.filter(c => c.level === VALIDATION_LEVEL.PASS).length,
      warn:     warnings.length,
      fail:     failures.length,
    },
  };
}

// ----------------------------------------------------------------
// RUN FULL SYSTEM VALIDATION
// ----------------------------------------------------------------

/**
 * Run all domain validations and produce a complete validation report.
 * @param {Object} context — { appState, runtimeState, dogState, etc. }
 * @returns {Object} full validation report
 */
export function runFullSystemValidation(context = {}) {
  _runCount++;
  ValidatorLogger.info(`[RuntimeValidator] Full system validation #${_runCount}...`);

  const domainResults = {};
  let overallLevel    = VALIDATION_LEVEL.PASS;

  for (const domain of Object.values(VALIDATION_DOMAIN)) {
    const result = validateRuntime(domain, context);
    domainResults[domain] = result;

    if (result.level === VALIDATION_LEVEL.FAIL) overallLevel = VALIDATION_LEVEL.FAIL;
    else if (result.level === VALIDATION_LEVEL.WARN && overallLevel !== VALIDATION_LEVEL.FAIL) {
      overallLevel = VALIDATION_LEVEL.WARN;
    }
  }

  // Also incorporate dependency graph and health status
  const graphStatus  = getDependencyGraphStatus();
  const healthStatus = getSystemHealthStatus();

  const unresolvedCritical = graphStatus.unresolvedCritical || [];
  if (unresolvedCritical.length > 0) overallLevel = VALIDATION_LEVEL.FAIL;

  const healthLevel =
    healthStatus.overallStatus === HEALTH_STATUS.CRITICAL ? VALIDATION_LEVEL.FAIL :
    healthStatus.overallStatus === HEALTH_STATUS.DEGRADED ? VALIDATION_LEVEL.WARN :
    VALIDATION_LEVEL.PASS;

  if (healthLevel === VALIDATION_LEVEL.FAIL && overallLevel !== VALIDATION_LEVEL.FAIL)
    overallLevel = VALIDATION_LEVEL.FAIL;
  else if (healthLevel === VALIDATION_LEVEL.WARN && overallLevel === VALIDATION_LEVEL.PASS)
    overallLevel = VALIDATION_LEVEL.WARN;

  _lastReport = {
    runCount:           _runCount,
    overallLevel,
    validatedAt:        Date.now(),
    domainResults,
    graphStatus,
    healthSummary:      healthStatus.summary,
    overallHealthStatus: healthStatus.overallStatus,
    unresolvedCritical,
    passed:             overallLevel === VALIDATION_LEVEL.PASS,
  };

  ValidatorLogger.info(
    `[RuntimeValidator] Full validation complete — level: ${overallLevel}, ` +
    `unresolvedCritical: ${unresolvedCritical.length}, ` +
    `health: ${healthStatus.overallStatus}`
  );

  return _lastReport;
}

// ----------------------------------------------------------------
// GET VALIDATION REPORT
// ----------------------------------------------------------------

export function getValidationReport() {
  return _lastReport;
}

// ----------------------------------------------------------------
// DOMAIN CHECK IMPLEMENTATIONS
// Each domain checker receives the context object and returns CheckResult[].
// ----------------------------------------------------------------

const _domainChecks = {

  // ── Storage ───────────────────────────────────────────────────
  [VALIDATION_DOMAIN.STORAGE]: (ctx) => [
    _check('storage_initialized',   !!ctx.storageInitialized,   'Storage not initialized.'),
    _check('schemas_registered',    (ctx.schemaCount || 0) > 0, 'No schemas registered.'),
    _check('migrations_applied',    ctx.migrationsApplied !== false, 'Migrations not applied.', VALIDATION_LEVEL.WARN),
    _check('storage_service_ready', !!ctx.storageServiceReady,  'storageService not ready.'),
  ],

  // ── State ─────────────────────────────────────────────────────
  [VALIDATION_DOMAIN.STATE]: (ctx) => [
    _check('app_state_exists',     !!ctx.appState,                           'appState missing.'),
    _check('runtime_state_exists', !!ctx.runtimeState,                       'runtimeState missing.'),
    _check('dog_state_exists',     !!ctx.dogState,                           'dogState missing.'),
    _check('session_state_exists', !!ctx.sessionState,                       'sessionState missing.'),
    _check('app_ready_flag',       ctx.appState?.ready === true,             'appState.ready not set.', VALIDATION_LEVEL.WARN),
    _check('no_fatal_error',       !ctx.runtimeState?.fatalError,            'Runtime has fatalError flag.'),
  ],

  // ── Events ────────────────────────────────────────────────────
  [VALIDATION_DOMAIN.EVENTS]: (ctx) => [
    _check('event_bus_initialized', !!ctx.eventBusInitialized,  'EventBus not initialized.'),
    _check('contracts_registered',  (ctx.contractCount || 0) > 0, 'No event contracts registered.', VALIDATION_LEVEL.WARN),
    _check('no_event_bus_error',    !ctx.eventBusError,          'EventBus reported an error.'),
  ],

  // ── Agents ────────────────────────────────────────────────────
  [VALIDATION_DOMAIN.AGENTS]: (ctx) => [
    _check('registry_initialized',  !!ctx.agentRegistryReady,   'Agent registry not initialized.', VALIDATION_LEVEL.WARN),
    _check('supervisor_initialized',!!ctx.supervisorReady,       'Supervisor agent not initialized.', VALIDATION_LEVEL.WARN),
    _check('lifecycle_initialized', !!ctx.lifecycleReady,        'Lifecycle controller not initialized.', VALIDATION_LEVEL.WARN),
    _check('agents_no_crash',       !ctx.agentCrashDetected,     'Agent crash detected.'),
  ],

  // ── Media ─────────────────────────────────────────────────────
  [VALIDATION_DOMAIN.MEDIA]: (ctx) => [
    _check('upload_pipeline_ready', !!ctx.uploadPipelineReady,  'Upload pipeline not ready.', VALIDATION_LEVEL.WARN),
    _check('identity_profile_ready',!!ctx.identityProfileReady, 'Identity profile engine not ready.', VALIDATION_LEVEL.WARN),
  ],

  // ── Rendering ─────────────────────────────────────────────────
  [VALIDATION_DOMAIN.RENDERING]: (ctx) => [
    _check('renderer_initialized',   !!ctx.rendererInitialized,  'Renderer not initialized.', VALIDATION_LEVEL.WARN),
    _check('scene_initialized',      !!ctx.sceneInitialized,     'Scene manager not initialized.', VALIDATION_LEVEL.WARN),
    _check('morph_targets_ready',    !!ctx.morphTargetsReady,    'Morph targets not initialized.', VALIDATION_LEVEL.WARN),
    _check('animation_mixer_ready',  !!ctx.animationMixerReady,  'Animation mixer not initialized.', VALIDATION_LEVEL.WARN),
    _check('texture_system_ready',   !!ctx.textureSystemReady,   'Texture system not initialized.', VALIDATION_LEVEL.WARN),
  ],

  // ── UI ────────────────────────────────────────────────────────
  [VALIDATION_DOMAIN.UI]: (ctx) => [
    _check('ui_shell_mounted',     !!ctx.uiShellMounted,     'UI shell not mounted.', VALIDATION_LEVEL.WARN),
    _check('root_element_exists',  !!ctx.rootElementExists,  'DOM #root element missing.'),
    _check('no_render_error',      !ctx.renderError,         'React render error detected.'),
  ],

  // ── Integration ───────────────────────────────────────────────
  [VALIDATION_DOMAIN.INTEGRATION]: (ctx) => [
    _check('integration_initialized', !!ctx.integrationReady,    'Integration layer not initialized.'),
    _check('orchestration_ready',     !!ctx.orchestrationReady,  'Orchestration not ready.'),
    _check('health_monitor_ready',    !!ctx.healthMonitorReady,  'Health monitor not ready.'),
  ],

  // ── SSOT Compliance ───────────────────────────────────────────
  [VALIDATION_DOMAIN.SSOT]: (ctx) => [
    _check('no_ui_state_mutation',    !ctx.uiStateMutationDetected,   'UI state mutation detected.'),
    _check('no_direct_db_access',     !ctx.directDbAccessDetected,    'Direct DB access detected.'),
    _check('no_circular_deps',        !ctx.circularDepsDetected,      'Circular dependencies detected.'),
    _check('events_routed_correctly', !ctx.eventRoutingViolation,     'Event routing violation detected.', VALIDATION_LEVEL.WARN),
    _check('no_agent_state_ownership',!ctx.agentStateOwnershipDetected,'Agent owns state directly.', VALIDATION_LEVEL.WARN),
  ],

  // ── Boot ──────────────────────────────────────────────────────
  [VALIDATION_DOMAIN.BOOT]: (ctx) => [
    _check('boot_completed',          !!ctx.bootCompleted,         'Boot not completed.'),
    _check('all_critical_resolved',   (ctx.unresolvedCritical || []).length === 0,
                                                                   'Unresolved critical modules.'),
    _check('no_boot_error',           !ctx.bootError,              'Boot error recorded.'),
    _check('runtime_locked',          !!ctx.runtimeLocked,         'Runtime not locked post-boot.', VALIDATION_LEVEL.WARN),
    _check('app_ready_emitted',       !!ctx.appReadyEmitted,       'APP_READY not emitted.', VALIDATION_LEVEL.WARN),
  ],
};

// ----------------------------------------------------------------
// INTERNAL: Build a CheckResult
// ----------------------------------------------------------------

function _check(name, passing, failureMsg, failLevel = VALIDATION_LEVEL.FAIL) {
  return {
    name,
    level:   passing ? VALIDATION_LEVEL.PASS : failLevel,
    message: passing ? null : failureMsg,
    passing,
  };
}

// ----------------------------------------------------------------
// ERROR
// ----------------------------------------------------------------

export class RuntimeValidatorError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name      = 'RuntimeValidatorError';
    this.context   = context;
    this.timestamp = Date.now();
  }
}
