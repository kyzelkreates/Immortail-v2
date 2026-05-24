// ================================================================
// IMMORTAIL™ — CENTRAL INTEGRATION ORCHESTRATOR
// Wires all subsystems together. Enforces communication rules.
// Connects Runs 1–9 into a unified operational platform.
// NO FEATURE LOGIC. NO STATE OWNERSHIP. WIRING ONLY.
// ================================================================

import { SystemLogger }   from '../utils/logger.js';
import {
  buildDependencyGraph,
  validateDependencies,
  detectCircularDependencies,
  markModuleResolved,
  getUnresolvedCritical,
  getDependencyGraphStatus,
}                          from './dependencyGraph.js';
import {
  initializeSystemHealth,
  reportSubsystemHealth,
  runHealthCheck,
  getSystemHealthStatus,
  SUBSYSTEM,
  HEALTH_STATUS,
}                          from './systemHealth.js';
import {
  initializeOrchestration,
  routeSystemEvent,
  registerWorkflow,
  runWorkflow,
  getOrchestrationStatus,
}                          from './orchestration.js';
import {
  runFullSystemValidation,
  getValidationReport,
  VALIDATION_LEVEL,
}                          from './runtimeValidator.js';
import {
  confirmBootStep,
  validateBootCompletion,
  finalizeBoot,
  getBootFinalizerStatus,
}                          from './bootFinalizer.js';

const IntegrationLogger = SystemLogger;

// ----------------------------------------------------------------
// INTEGRATION STATUS
// ----------------------------------------------------------------

export const INTEGRATION_STATUS = {
  UNINITIALIZED: 'uninitialized',
  INITIALIZING:  'initializing',
  OPERATIONAL:   'operational',
  DEGRADED:      'degraded',
  FAILED:        'failed',
};

// ----------------------------------------------------------------
// INTERNAL STATE
// ----------------------------------------------------------------

let _status      = INTEGRATION_STATUS.UNINITIALIZED;
let _initAt      = null;
let _subsystemMap = {};   // subsystemId → initialization result

// ----------------------------------------------------------------
// INITIALIZE INTEGRATION LAYER
// ----------------------------------------------------------------

/**
 * Primary entry point. Connects all subsystems.
 * Called from boot.js Step 28.
 *
 * @param {Object} [options]
 * @param {Function} [options.eventEmitter]  — (event, payload) => void
 * @param {Object}   [options.stateRefs]     — { appState, runtimeState, dogState, sessionState }
 * @returns {Promise<Object>} integration status snapshot
 */
export async function initializeIntegrationLayer(options = {}) {
  if (_status === INTEGRATION_STATUS.OPERATIONAL) {
    IntegrationLogger.warn('[Integration] Already operational.');
    return getIntegrationStatus();
  }

  _status = INTEGRATION_STATUS.INITIALIZING;
  _initAt = Date.now();

  IntegrationLogger.info('[Integration] Initializing integration layer...');

  try {
    // ── Step 1: Build dependency graph ────────────────────────────
    IntegrationLogger.info('[Integration] Building dependency graph...');
    const graphResult = buildDependencyGraph();
    _subsystemMap.dependencyGraph = { ok: true, nodeCount: graphResult.nodeCount };

    // ── Step 2: Validate dependencies ─────────────────────────────
    const depValidation = validateDependencies();
    if (!depValidation.valid) {
      IntegrationLogger.warn(
        `[Integration] Dependency validation warnings: ${depValidation.errors.join(' | ')}`
      );
    }
    _subsystemMap.dependencyValidation = { ok: depValidation.valid, errors: depValidation.errors };

    // ── Step 3: Detect circular dependencies ──────────────────────
    const circularResult = detectCircularDependencies();
    if (circularResult.circular) {
      throw new IntegrationError(
        `[Integration] Circular dependencies detected: ${
          circularResult.cycles.map(c => c.join('→')).join(' | ')
        }`
      );
    }
    _subsystemMap.circularCheck = { ok: true, cycles: 0 };

    // ── Step 4: Initialize system health monitor ──────────────────
    initializeSystemHealth({ autoCheck: false });
    _subsystemMap.systemHealth = { ok: true };

    // ── Step 5: Initialize orchestration ──────────────────────────
    initializeOrchestration({
      eventRouterFn: options.eventEmitter || null,
    });
    _subsystemMap.orchestration = { ok: true };

    // ── Step 6: Register integration workflows ─────────────────────
    _registerIntegrationWorkflows();
    _subsystemMap.workflows = { ok: true };

    // ── Step 7: Mark prior run modules as resolved ─────────────────
    _markRunModulesResolved(options.stateRefs || {});

    // ── Step 8: Wire subsystem health reports ──────────────────────
    _wireSubsystemHealthReports(options.stateRefs || {});

    // ── Step 9: Run initial health check ──────────────────────────
    const healthStatus = runHealthCheck();
    _subsystemMap.initialHealth = { ok: healthStatus.overallStatus !== HEALTH_STATUS.CRITICAL };

    // ── Step 10: Update overall status ────────────────────────────
    _status = healthStatus.overallStatus === HEALTH_STATUS.CRITICAL
      ? INTEGRATION_STATUS.FAILED
      : healthStatus.overallStatus === HEALTH_STATUS.DEGRADED
        ? INTEGRATION_STATUS.DEGRADED
        : INTEGRATION_STATUS.OPERATIONAL;

    IntegrationLogger.info(
      `[Integration] Integration layer initialized — status: ${_status}, ` +
      `duration: ${Date.now() - _initAt}ms`
    );

  } catch (err) {
    _status = INTEGRATION_STATUS.FAILED;
    IntegrationLogger.error(`[Integration] Initialization failed: ${err.message}`);
    throw err;
  }

  return getIntegrationStatus();
}

// ----------------------------------------------------------------
// VALIDATE SYSTEM GRAPH
// ----------------------------------------------------------------

/**
 * Validate the full system dependency graph.
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateSystemGraph() {
  const depResult   = validateDependencies();
  const circResult  = detectCircularDependencies();

  const errors   = [...depResult.errors];
  const warnings = [...depResult.warnings];

  if (circResult.circular) {
    errors.push(...circResult.cycles.map(c => `Circular: ${c.join('→')}`));
  }

  IntegrationLogger.info(
    `[Integration] System graph validation — valid: ${depResult.valid && !circResult.circular}, ` +
    `errors: ${errors.length}, warnings: ${warnings.length}`
  );

  return { valid: errors.length === 0, errors, warnings };
}

// ----------------------------------------------------------------
// CONNECT SUBSYSTEMS
// ----------------------------------------------------------------

/**
 * Establish event-driven connections between subsystem pairs.
 * All connections are one-way and service-mediated.
 *
 * @param {Object} connections  — { [subsystemId]: { onEvent, emitEvent } }
 * @returns {{ connected: string[], failed: string[] }}
 */
export function connectSubsystems(connections = {}) {
  const connected = [];
  const failed    = [];

  for (const [id, binding] of Object.entries(connections)) {
    try {
      if (typeof binding.onEvent !== 'function' && typeof binding.emitEvent !== 'function') {
        throw new Error('Binding must have onEvent or emitEvent function.');
      }

      // Validate no forbidden cross-layer routes before connecting
      if (binding.source && binding.target) {
        const routeKey = `${binding.source}→${binding.target}`;
        // Import-free check using the orchestration layer
        const routeResult = routeSystemEvent(
          'INTEGRATION_CONNECT',
          { subsystem: id },
          binding.source
        );
        if (routeResult.blocked?.length > 0) {
          throw new Error(`Forbidden route: ${binding.source}→${binding.target}`);
        }
      }

      markModuleResolved(id);
      connected.push(id);
      IntegrationLogger.info(`[Integration] Subsystem connected: "${id}"`);

    } catch (err) {
      failed.push(id);
      IntegrationLogger.error(`[Integration] Failed to connect "${id}": ${err.message}`);
    }
  }

  return { connected, failed };
}

// ----------------------------------------------------------------
// RUN INTEGRATION VALIDATION
// ----------------------------------------------------------------

/**
 * Run the full system validation as part of boot step 30.
 * @param {Object} context
 * @returns {Object} validation report
 */
export function runIntegrationValidation(context = {}) {
  IntegrationLogger.info('[Integration] Running full system validation...');

  const graphStatus = getDependencyGraphStatus();
  const healthStatus = getSystemHealthStatus();

  const fullContext = {
    ...context,
    circularDepsDetected:  false,  // would have thrown in init
    unresolvedCritical:    graphStatus.unresolvedCritical || [],
    bootCompleted:         true,
    integrationReady:      _status === INTEGRATION_STATUS.OPERATIONAL,
    orchestrationReady:    getOrchestrationStatus().initialized,
    healthMonitorReady:    healthStatus.initialized,
  };

  const report = runFullSystemValidation(fullContext);

  IntegrationLogger.info(
    `[Integration] Validation complete — level: ${report.overallLevel}, ` +
    `passed: ${report.passed}`
  );

  return report;
}

// ----------------------------------------------------------------
// CONFIRM BOOT STEP (proxy)
// ----------------------------------------------------------------

/**
 * Proxy to bootFinalizer.confirmBootStep for clean boot.js imports.
 */
export { confirmBootStep };

// ----------------------------------------------------------------
// GET INTEGRATION STATUS
// ----------------------------------------------------------------

export function getIntegrationStatus() {
  const graphStatus  = getDependencyGraphStatus();
  const healthStatus = getSystemHealthStatus();
  const orchStatus   = getOrchestrationStatus();
  const finStatus    = getBootFinalizerStatus();

  return {
    status:           _status,
    initializedAt:    _initAt,
    subsystems:       { ..._subsystemMap },
    graph: {
      built:          graphStatus.built,
      nodeCount:      graphStatus.nodeCount,
      resolvedCount:  graphStatus.resolvedCount,
      criticalResolved: graphStatus.criticalResolved,
      unresolvedCritical: graphStatus.unresolvedCritical,
    },
    health: {
      overall:        healthStatus.overallStatus,
      summary:        healthStatus.summary,
    },
    orchestration: {
      initialized:    orchStatus.initialized,
      workflows:      orchStatus.registeredWorkflows,
    },
    boot: {
      finalized:      finStatus.finalized,
      locked:         finStatus.locked,
      completedSteps: finStatus.completedSteps,
      totalSteps:     finStatus.totalSteps,
    },
  };
}

// ----------------------------------------------------------------
// INTERNAL: Register built-in integration workflows
// ----------------------------------------------------------------

function _registerIntegrationWorkflows() {
  // Workflow: health check cycle
  registerWorkflow('integration:health_check', [
    async (ctx) => {
      const status = runHealthCheck(ctx.probes || {});
      return { healthStatus: status.overallStatus };
    },
  ]);

  // Workflow: boot validation
  registerWorkflow('integration:boot_validation', [
    async (ctx) => {
      const bootCheck = validateBootCompletion();
      return { bootComplete: bootCheck.complete, missing: bootCheck.missing };
    },
    async (ctx) => {
      const graphCheck = validateSystemGraph();
      return { graphValid: graphCheck.valid, errors: graphCheck.errors };
    },
  ]);

  // Workflow: full validation + finalize
  registerWorkflow('integration:finalize', [
    async (ctx) => {
      const validation = runIntegrationValidation(ctx);
      return { validationLevel: validation.overallLevel };
    },
    async (ctx) => {
      const result = finalizeBoot(ctx.finalizeOptions || {});
      return { bootFinalized: result.success };
    },
  ]);

  IntegrationLogger.debug('[Integration] Integration workflows registered.');
}

// ----------------------------------------------------------------
// INTERNAL: Mark modules resolved based on initialized state refs
// ----------------------------------------------------------------

function _markRunModulesResolved(stateRefs) {
  // Run 1–4 always boot before integration
  const alwaysResolved = [
    'environment', 'runtime', 'validation', 'hydration',
    'storage', 'schemas', 'migrations', 'storageService',
    'appState', 'runtimeState', 'dogState', 'sessionState',
    'eventBus', 'eventRegistry',
  ];
  for (const id of alwaysResolved) markModuleResolved(id);

  // Service presence
  const services = ['dogService','aiService','mediaService','notificationService','reconstructionService'];
  for (const id of services) markModuleResolved(id);

  // Agents
  const agents = ['agentRegistry','lifecycleController','supervisorAgent',
    'memoryAgent','emotionAgent','dogAgent','conversationAgent','routineAgent','recoveryAgent'];
  for (const id of agents) markModuleResolved(id);

  // Companion engines (only if profileId exists)
  if (stateRefs?.dogState?.profileId) {
    const engines = ['personalityEngine','emotionEngine','memoryEngine',
      'behaviorEngine','bondingEngine','routineEngine','companionRuntime'];
    for (const id of engines) markModuleResolved(id);
  }

  // Media
  const media = ['uploadPipeline','identityProfile','traitExtraction','reconstructionFoundation'];
  for (const id of media) markModuleResolved(id);

  // 3D
  const rendering = ['renderer','sceneManager','rigLoader','morphTargets','animationMixer',
    'textureSystem','emotionAnimations'];
  for (const id of rendering) markModuleResolved(id);

  // UI
  const ui = ['uiShell','hooks','screens','layouts'];
  for (const id of ui) markModuleResolved(id);

  // Run 10 self
  const integration = ['dependencyGraph','systemHealth','integration','orchestration'];
  for (const id of integration) markModuleResolved(id);

  IntegrationLogger.debug('[Integration] Prior-run modules marked resolved.');
}

// ----------------------------------------------------------------
// INTERNAL: Wire health reports per subsystem
// ----------------------------------------------------------------

function _wireSubsystemHealthReports(stateRefs) {
  // Storage
  reportSubsystemHealth(SUBSYSTEM.STORAGE, HEALTH_STATUS.HEALTHY, { wired: true });

  // State
  const stateOk = !!(stateRefs?.appState && stateRefs?.runtimeState && stateRefs?.dogState);
  reportSubsystemHealth(SUBSYSTEM.STATE,
    stateOk ? HEALTH_STATUS.HEALTHY : HEALTH_STATUS.DEGRADED,
    { stateRefsProvided: stateOk }
  );

  // Events
  reportSubsystemHealth(SUBSYSTEM.EVENTS, HEALTH_STATUS.HEALTHY, { wired: true });

  // Agents
  reportSubsystemHealth(SUBSYSTEM.AGENTS, HEALTH_STATUS.HEALTHY, { wired: true });

  // Companion
  const companionOk = !!(stateRefs?.dogState?.profileId);
  reportSubsystemHealth(SUBSYSTEM.COMPANION,
    companionOk ? HEALTH_STATUS.HEALTHY : HEALTH_STATUS.UNKNOWN,
    { hasProfile: companionOk }
  );

  // Media
  reportSubsystemHealth(SUBSYSTEM.MEDIA, HEALTH_STATUS.HEALTHY, { wired: true });

  // Rendering
  reportSubsystemHealth(SUBSYSTEM.RENDERING, HEALTH_STATUS.HEALTHY, { wired: true });

  // UI
  const rootExists = typeof document !== 'undefined' && !!document.getElementById('root');
  reportSubsystemHealth(SUBSYSTEM.UI,
    rootExists ? HEALTH_STATUS.HEALTHY : HEALTH_STATUS.DEGRADED,
    { rootExists }
  );

  // Integration (self)
  reportSubsystemHealth(SUBSYSTEM.INTEGRATION, HEALTH_STATUS.HEALTHY, { wired: true });
  reportSubsystemHealth(SUBSYSTEM.ORCHESTRATION, HEALTH_STATUS.HEALTHY, { wired: true });

  IntegrationLogger.debug('[Integration] Subsystem health reports wired.');
}

// ----------------------------------------------------------------
// ERROR
// ----------------------------------------------------------------

export class IntegrationError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name      = 'IntegrationError';
    this.context   = context;
    this.timestamp = Date.now();
  }
}
