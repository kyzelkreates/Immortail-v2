// ================================================================
// IMMORTAIL™ — DEPENDENCY GRAPH ENGINE
// Maps system dependencies, detects circulars, validates boot order.
// NO FEATURE LOGIC. STRUCTURAL VALIDATION ONLY.
// ================================================================

import { SystemLogger } from '../utils/logger.js';
const GraphLogger = SystemLogger;

// ----------------------------------------------------------------
// MODULE REGISTRY — canonical system modules
// Each entry: { id, run, dependsOn[], critical }
// ----------------------------------------------------------------

export const MODULE_REGISTRY = [
  // Run 1 — Core Runtime
  { id: 'environment',         run: 1,  dependsOn: [],                                            critical: true  },
  { id: 'runtime',             run: 1,  dependsOn: ['environment'],                                critical: true  },
  { id: 'validation',          run: 1,  dependsOn: ['runtime'],                                   critical: true  },
  { id: 'hydration',           run: 1,  dependsOn: ['runtime'],                                   critical: true  },
  { id: 'recovery',            run: 1,  dependsOn: ['runtime'],                                   critical: false },
  { id: 'scheduler',           run: 1,  dependsOn: ['runtime'],                                   critical: false },

  // Run 2 — Storage
  { id: 'storage',             run: 2,  dependsOn: ['runtime'],                                   critical: true  },
  { id: 'schemas',             run: 2,  dependsOn: ['storage'],                                   critical: true  },
  { id: 'migrations',          run: 2,  dependsOn: ['schemas'],                                   critical: true  },
  { id: 'storageService',      run: 2,  dependsOn: ['storage', 'schemas', 'migrations'],          critical: true  },

  // Run 3 — State Layer
  { id: 'appState',            run: 3,  dependsOn: ['runtime'],                                   critical: true  },
  { id: 'runtimeState',        run: 3,  dependsOn: ['runtime'],                                   critical: true  },
  { id: 'dogState',            run: 3,  dependsOn: ['runtime'],                                   critical: true  },
  { id: 'sessionState',        run: 3,  dependsOn: ['runtime'],                                   critical: true  },
  { id: 'aiState',             run: 3,  dependsOn: ['runtime'],                                   critical: false },

  // Run 4 — Events + Services
  { id: 'eventBus',            run: 4,  dependsOn: ['runtime'],                                   critical: true  },
  { id: 'eventRegistry',       run: 4,  dependsOn: ['eventBus'],                                  critical: true  },
  { id: 'dogService',          run: 4,  dependsOn: ['storageService', 'dogState', 'eventBus'],    critical: true  },
  { id: 'aiService',           run: 4,  dependsOn: ['storageService', 'aiState',  'eventBus'],    critical: false },
  { id: 'mediaService',        run: 4,  dependsOn: ['storageService', 'eventBus'],                critical: false },
  { id: 'notificationService', run: 4,  dependsOn: ['eventBus'],                                  critical: false },
  { id: 'reconstructionService',run:4,  dependsOn: ['storageService', 'mediaService'],            critical: false },

  // Run 5 — Agents
  { id: 'agentRegistry',       run: 5,  dependsOn: ['eventBus', 'runtimeState'],                  critical: true  },
  { id: 'lifecycleController', run: 5,  dependsOn: ['agentRegistry'],                             critical: true  },
  { id: 'supervisorAgent',     run: 5,  dependsOn: ['lifecycleController', 'eventBus'],            critical: true  },
  { id: 'memoryAgent',         run: 5,  dependsOn: ['supervisorAgent', 'storageService'],          critical: false },
  { id: 'emotionAgent',        run: 5,  dependsOn: ['supervisorAgent', 'dogState'],                critical: false },
  { id: 'dogAgent',            run: 5,  dependsOn: ['supervisorAgent', 'dogService'],              critical: false },
  { id: 'conversationAgent',   run: 5,  dependsOn: ['supervisorAgent', 'aiService'],               critical: false },
  { id: 'routineAgent',        run: 5,  dependsOn: ['supervisorAgent'],                            critical: false },
  { id: 'recoveryAgent',       run: 5,  dependsOn: ['supervisorAgent', 'recovery'],                critical: false },

  // Run 6 — Companion Engines
  { id: 'personalityEngine',   run: 6,  dependsOn: ['dogState', 'storageService'],                critical: false },
  { id: 'emotionEngine',       run: 6,  dependsOn: ['dogState', 'eventBus'],                      critical: false },
  { id: 'memoryEngine',        run: 6,  dependsOn: ['storageService', 'dogState'],                critical: false },
  { id: 'behaviorEngine',      run: 6,  dependsOn: ['emotionEngine', 'personalityEngine'],         critical: false },
  { id: 'bondingEngine',       run: 6,  dependsOn: ['dogState', 'memoryEngine'],                  critical: false },
  { id: 'routineEngine',       run: 6,  dependsOn: ['dogState', 'storageService'],                critical: false },
  { id: 'companionRuntime',    run: 6,  dependsOn: [
      'personalityEngine','emotionEngine','memoryEngine',
      'behaviorEngine','bondingEngine','routineEngine',
    ],                                                                                              critical: false },

  // Run 7 — Media Pipeline
  { id: 'uploadPipeline',      run: 7,  dependsOn: ['storageService', 'mediaService'],            critical: false },
  { id: 'identityProfile',     run: 7,  dependsOn: ['storageService'],                            critical: false },
  { id: 'traitExtraction',     run: 7,  dependsOn: ['identityProfile'],                           critical: false },
  { id: 'reconstructionFoundation', run: 7, dependsOn: ['identityProfile','uploadPipeline'],      critical: false },

  // Run 8 — 3D Engine
  { id: 'renderer',            run: 8,  dependsOn: ['runtime'],                                   critical: false },
  { id: 'sceneManager',        run: 8,  dependsOn: ['renderer'],                                  critical: false },
  { id: 'rigLoader',           run: 8,  dependsOn: ['sceneManager'],                              critical: false },
  { id: 'morphTargets',        run: 8,  dependsOn: ['rigLoader'],                                 critical: false },
  { id: 'animationMixer',      run: 8,  dependsOn: ['rigLoader'],                                 critical: false },
  { id: 'textureSystem',       run: 8,  dependsOn: ['renderer'],                                  critical: false },
  { id: 'emotionAnimations',   run: 8,  dependsOn: ['morphTargets','animationMixer','emotionEngine'], critical: false },

  // Run 9 — UI Shell
  { id: 'uiShell',             run: 9,  dependsOn: ['appState','runtimeState','eventBus'],        critical: true  },
  { id: 'hooks',               run: 9,  dependsOn: ['appState','runtimeState','dogState','eventBus'], critical: true },
  { id: 'screens',             run: 9,  dependsOn: ['hooks','uiShell'],                           critical: true  },
  { id: 'layouts',             run: 9,  dependsOn: ['uiShell'],                                   critical: true  },

  // Run 10 — Integration Layer
  { id: 'dependencyGraph',     run: 10, dependsOn: ['runtime'],                                   critical: true  },
  { id: 'systemHealth',        run: 10, dependsOn: ['dependencyGraph', 'eventBus'],               critical: true  },
  { id: 'integration',         run: 10, dependsOn: ['systemHealth', 'eventBus', 'appState'],      critical: true  },
  { id: 'orchestration',       run: 10, dependsOn: ['integration', 'eventBus'],                   critical: true  },
  { id: 'bootFinalizer',       run: 10, dependsOn: ['orchestration', 'systemHealth'],             critical: true  },
  { id: 'runtimeValidator',    run: 10, dependsOn: ['dependencyGraph', 'systemHealth'],           critical: true  },
];

// ----------------------------------------------------------------
// INTERNAL GRAPH STATE
// ----------------------------------------------------------------

let _graph         = null;   // Map<id, ModuleNode>
let _built         = false;
let _lastValidated = null;

class ModuleNode {
  constructor(def) {
    this.id         = def.id;
    this.run        = def.run;
    this.dependsOn  = [...def.dependsOn];
    this.critical   = def.critical;
    this.resolved   = false;  // set true when module boots
    this.depth      = -1;     // topological depth
  }
}

// ----------------------------------------------------------------
// BUILD DEPENDENCY GRAPH
// ----------------------------------------------------------------

/**
 * Build the dependency graph from MODULE_REGISTRY.
 * Computes topological depths and validates uniqueness.
 * @returns {{ graph: Map, nodeCount: number, criticalCount: number }}
 */
export function buildDependencyGraph() {
  GraphLogger.info('[DependencyGraph] Building dependency graph...');
  _graph = new Map();

  // Populate nodes
  for (const def of MODULE_REGISTRY) {
    if (_graph.has(def.id)) {
      GraphLogger.warn(`[DependencyGraph] Duplicate module id: "${def.id}" — skipping.`);
      continue;
    }
    _graph.set(def.id, new ModuleNode(def));
  }

  // Validate all dependsOn references exist
  const missingRefs = [];
  for (const [id, node] of _graph) {
    for (const dep of node.dependsOn) {
      if (!_graph.has(dep)) missingRefs.push({ module: id, missing: dep });
    }
  }
  if (missingRefs.length > 0) {
    GraphLogger.warn(
      `[DependencyGraph] Missing dependency references: ${
        missingRefs.map(r => `${r.module}→${r.missing}`).join(', ')
      }`
    );
  }

  // Compute topological depth via BFS
  _computeDepths();

  _built = true;
  const criticalCount = Array.from(_graph.values()).filter(n => n.critical).length;

  GraphLogger.info(
    `[DependencyGraph] Graph built — ${_graph.size} modules, ` +
    `${criticalCount} critical, ${missingRefs.length} missing refs.`
  );

  return {
    graph:         _graph,
    nodeCount:     _graph.size,
    criticalCount,
    missingRefs,
  };
}

// ----------------------------------------------------------------
// VALIDATE DEPENDENCIES
// ----------------------------------------------------------------

/**
 * Validate all declared dependencies are satisfiable.
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateDependencies() {
  _assertBuilt();
  const errors = [], warnings = [];

  for (const [id, node] of _graph) {
    for (const dep of node.dependsOn) {
      if (!_graph.has(dep)) {
        const msg = `Module "${id}" depends on unknown module "${dep}".`;
        if (node.critical) errors.push(msg);
        else               warnings.push(msg);
      }
    }
    // Run order check — no module depends on a higher run
    for (const dep of node.dependsOn) {
      const depNode = _graph.get(dep);
      if (depNode && depNode.run > node.run) {
        errors.push(
          `Module "${id}" (run ${node.run}) depends on "${dep}" (run ${depNode.run}) — invalid forward dependency.`
        );
      }
    }
  }

  _lastValidated = {
    timestamp: Date.now(),
    valid:     errors.length === 0,
    errors,
    warnings,
  };

  GraphLogger.info(
    `[DependencyGraph] Validation — valid: ${_lastValidated.valid}, ` +
    `errors: ${errors.length}, warnings: ${warnings.length}`
  );

  return _lastValidated;
}

// ----------------------------------------------------------------
// DETECT CIRCULAR DEPENDENCIES
// ----------------------------------------------------------------

/**
 * DFS-based circular dependency detection.
 * @returns {{ circular: boolean, cycles: string[][] }}
 */
export function detectCircularDependencies() {
  _assertBuilt();

  const visited  = new Set();
  const inStack  = new Set();
  const cycles   = [];

  const dfs = (id, path) => {
    if (inStack.has(id)) {
      // Found a cycle — extract it
      const cycleStart = path.indexOf(id);
      cycles.push([...path.slice(cycleStart), id]);
      return;
    }
    if (visited.has(id)) return;

    visited.add(id);
    inStack.add(id);
    path.push(id);

    const node = _graph.get(id);
    if (node) {
      for (const dep of node.dependsOn) {
        if (_graph.has(dep)) dfs(dep, path);
      }
    }

    path.pop();
    inStack.delete(id);
  };

  for (const id of _graph.keys()) {
    if (!visited.has(id)) dfs(id, []);
  }

  const circular = cycles.length > 0;
  if (circular) {
    GraphLogger.error(
      `[DependencyGraph] Circular dependencies detected: ${
        cycles.map(c => c.join(' → ')).join(' | ')
      }`
    );
  } else {
    GraphLogger.info('[DependencyGraph] No circular dependencies detected.');
  }

  return { circular, cycles };
}

// ----------------------------------------------------------------
// MARK MODULE RESOLVED
// ----------------------------------------------------------------

/**
 * Mark a module as successfully initialized.
 * @param {string} moduleId
 */
export function markModuleResolved(moduleId) {
  const node = _graph?.get(moduleId);
  if (node) {
    node.resolved = true;
    GraphLogger.debug(`[DependencyGraph] Module resolved: ${moduleId}`);
  }
}

// ----------------------------------------------------------------
// GET BOOT ORDER
// ----------------------------------------------------------------

/**
 * Returns modules sorted by topological depth (boot order).
 * @returns {ModuleNode[]}
 */
export function getBootOrder() {
  _assertBuilt();
  return Array.from(_graph.values())
    .sort((a, b) => (a.depth === b.depth ? a.run - b.run : a.depth - b.depth));
}

// ----------------------------------------------------------------
// GET UNRESOLVED CRITICAL MODULES
// ----------------------------------------------------------------

export function getUnresolvedCritical() {
  if (!_graph) return [];
  return Array.from(_graph.values())
    .filter(n => n.critical && !n.resolved)
    .map(n => n.id);
}

// ----------------------------------------------------------------
// GET DEPENDENCY GRAPH STATUS
// ----------------------------------------------------------------

export function getDependencyGraphStatus() {
  if (!_graph) return { built: false };
  const nodes = Array.from(_graph.values());
  return {
    built:          _built,
    nodeCount:      _graph.size,
    resolvedCount:  nodes.filter(n => n.resolved).length,
    criticalCount:  nodes.filter(n => n.critical).length,
    criticalResolved: nodes.filter(n => n.critical && n.resolved).length,
    unresolvedCritical: getUnresolvedCritical(),
    lastValidated:  _lastValidated,
  };
}

// ----------------------------------------------------------------
// INTERNAL: Compute topological depths (BFS from roots)
// ----------------------------------------------------------------

function _computeDepths() {
  // Initialize depths
  for (const node of _graph.values()) node.depth = 0;

  // BFS propagation
  let changed = true;
  let pass    = 0;
  const MAX_PASSES = _graph.size + 1;

  while (changed && pass < MAX_PASSES) {
    changed = false;
    for (const [id, node] of _graph) {
      for (const dep of node.dependsOn) {
        const depNode = _graph.get(dep);
        if (depNode && depNode.depth >= node.depth) {
          node.depth = depNode.depth + 1;
          changed = true;
        }
      }
    }
    pass++;
  }
}

function _assertBuilt() {
  if (!_built || !_graph) {
    throw new DependencyGraphError(
      '[DependencyGraph] Graph not built. Call buildDependencyGraph() first.'
    );
  }
}

// ----------------------------------------------------------------
// ERROR
// ----------------------------------------------------------------

export class DependencyGraphError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name      = 'DependencyGraphError';
    this.context   = context;
    this.timestamp = Date.now();
  }
}
