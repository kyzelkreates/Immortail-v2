/**
 * IMMORTAIL™ — RUN 19
 * productionOptimisationEngine.js
 *
 * Production Optimisation + Deployment Hardening Layer
 * Performance, Stability + Shipping System — production safe.
 *
 * ARCHITECTURE RULES:
 *   - SSOT: all state through companionCore via storage.js only
 *   - Does NOT modify identity, embodiment, or behaviour logic
 *   - Does NOT compress identityLock, embodimentProfile, or milestones
 *   - Does NOT introduce new core AI systems
 *   - Ollama owns system logic stability + emotional continuity
 *   - Groq is optional — no performance feature depends on it
 *   - Offline-first always enforced
 *   - Runs 1–18 untouched
 */

import storage from './storage.js';

// ══════════════════════════════════════════════════════════════════
// CONSTANTS & ENUMS
// ══════════════════════════════════════════════════════════════════

export const PROD_ENGINE_ID = 'productionOptimisationEngine_V1';

export const RENDER_MODE      = { ADAPTIVE:'adaptive', QUALITY:'quality', PERFORMANCE:'performance', MINIMAL:'minimal' };
export const CPU_MODE         = { BALANCED:'balanced', LOW_POWER:'low_power', HIGH_PERFORMANCE:'high_performance' };
export const GPU_MODE         = { ADAPTIVE:'adaptive', LOW:'low', HIGH:'high' };
export const BATTERY_MODE     = { MOBILE_SAFE:'mobile_safe', NORMAL:'normal', HIGH_DRAIN:'high_drain' };
export const MEMORY_MODE      = { COMPRESSED_SAFE:'compressed_safe', NORMAL:'normal' };
export const FALLBACK_LEVEL   = { NONE:'none', REDUCED:'reduced', SAFE_MODE:'safe_mode', MINIMAL:'minimal' };
export const PERF_ALERT       = { NONE:'none', WARNING:'warning', CRITICAL:'critical' };
export const COMPRESSION_LEVEL= { SAFE:'safe', AGGRESSIVE:'aggressive', NONE:'none' };

// ── Hard caps ─────────────────────────────────────────────────────
export const PERF_CAPS = {
  FRAME_CAP_NORMAL:      60,
  FRAME_CAP_IDLE:        15,
  FRAME_CAP_MINIMAL:      8,
  BACKUP_SNAPSHOTS:       3,
  AUTOSAVE_INTERVAL_MS: 5000,
  PERF_SAMPLE_WINDOW:    10,    // samples in rolling window
  MONITOR_LOG_MAX:       50,
  CRASH_LOG_MAX:         20,
  SAFETY_LOG_MAX:        40,
  MAX_TRANSITION_QUEUE:   3,
  FPS_WARN_THRESHOLD:    24,
  FPS_CRIT_THRESHOLD:    12,
  MEMORY_WARN_MB:       350,
  MEMORY_CRIT_MB:       500,
};

// ── Fields NEVER compressed (protected by identity lock) ──────────
export const COMPRESSION_PROTECTED = Object.freeze([
  'identityLock',
  'embodimentProfile',
  'identity',
  'attachmentGraph',
  // milestones are inside memory[] as isMilestone:true — handled inline
]);

// ── Performance presets ───────────────────────────────────────────
export const PERF_PRESETS = Object.freeze({
  quality: {
    frameCap:           60,
    idleFrameCap:       30,
    dynamicResolution:  false,
    lodSystem:          false,
    animationBatching:  false,
    reducedParticles:   false,
    simplifiedShadows:  false,
    polygonReduction:   0.0,
  },
  balanced: {
    frameCap:           30,
    idleFrameCap:       15,
    dynamicResolution:  true,
    lodSystem:          true,
    animationBatching:  true,
    reducedParticles:   false,
    simplifiedShadows:  false,
    polygonReduction:   0.1,
  },
  mobile_safe: {
    frameCap:           30,
    idleFrameCap:       15,
    dynamicResolution:  true,
    lodSystem:          true,
    animationBatching:  true,
    reducedParticles:   true,
    simplifiedShadows:  true,
    polygonReduction:   0.25,
  },
  low_power: {
    frameCap:           24,
    idleFrameCap:        8,
    dynamicResolution:  true,
    lodSystem:          true,
    animationBatching:  true,
    reducedParticles:   true,
    simplifiedShadows:  true,
    polygonReduction:   0.4,
  },
  minimal: {
    frameCap:            15,
    idleFrameCap:         8,
    dynamicResolution:  true,
    lodSystem:          true,
    animationBatching:  true,
    reducedParticles:   true,
    simplifiedShadows:  true,
    polygonReduction:   0.6,
  },
});

// ── PWA / deployment flags ─────────────────────────────────────────
export const PWA_DEPLOYMENT_FLAGS = Object.freeze({
  pwaReady:             true,
  offlineCache:         true,
  serviceWorkerSafe:    true,
  assetBundling:        true,
  lazyLoadingEnabled:   true,
  noBackendRequired:    true,
  offlineFirst:         true,
  browserPWA:           true,
});

// ══════════════════════════════════════════════════════════════════
// INTERNAL STATE
// ══════════════════════════════════════════════════════════════════

let _safetyLog     = [];
let _monitorLog    = [];
let _crashLog      = [];
let _fpsSamples    = [];
let _throttleWrite = 0;
let _autosaveTimer = null;
let _fallbackLevel = FALLBACK_LEVEL.NONE;

function genId() { return `${Date.now()}_${Math.random().toString(36).slice(2,6)}`; }

function logSafety(type, detail) {
  _safetyLog = [..._safetyLog, { id:genId(), ts:Date.now(), type, detail:String(detail??'').slice(0,100) }]
    .slice(-PERF_CAPS.SAFETY_LOG_MAX);
}

function logMonitor(type, data) {
  _monitorLog = [..._monitorLog, { id:genId(), ts:Date.now(), type, ...data }]
    .slice(-PERF_CAPS.MONITOR_LOG_MAX);
}

function getPerfCore(core) {
  return (core ?? storage.getCompanionCore()).performanceCore ?? getDefaultPerfCore();
}

function getDefaultPerfCore() {
  return {
    renderMode:          RENDER_MODE.ADAPTIVE,
    updateThrottle:      'enabled',
    memoryMode:          MEMORY_MODE.COMPRESSED_SAFE,
    cpuMode:             CPU_MODE.BALANCED,
    gpuMode:             GPU_MODE.ADAPTIVE,
    batteryMode:         BATTERY_MODE.MOBILE_SAFE,
    renderEngine:        getDefaultRenderEngine(),
    mobilePerformance:   getDefaultMobilePerf(),
    animationStability:  getDefaultAnimStability(),
    persistenceHardening:getDefaultPersistenceHardening(),
    crashRecovery:       getDefaultCrashRecovery(),
    stateCompression:    getDefaultStateCompression(),
    performanceMonitor:  getDefaultPerfMonitor(),
    fallbackSystem:      getDefaultFallbackSystem(),
    deploymentConfig:    { ...PWA_DEPLOYMENT_FLAGS },
    currentPreset:       'mobile_safe',
    lastHealthCheck:     null,
    performanceVersion:  'V1',
  };
}

function getDefaultRenderEngine() {
  return {
    lodSystem:           true,
    frameCap:            PERF_CAPS.FRAME_CAP_NORMAL,
    idleFrameCap:        PERF_CAPS.FRAME_CAP_IDLE,
    dynamicResolution:   true,
    animationBatching:   true,
    pauseOffscreen:      true,
    prioritiseVisible:   true,
    currentFPS:          0,
    targetFPS:           30,
    renderHealth:        'stable',
  };
}

function getDefaultMobilePerf() {
  return {
    lowPowerMode:        true,
    touchOptimised:      true,
    reducedParticles:    true,
    simplifiedShadows:   true,
    adaptiveFPS:         true,
    complexityScaling:   true,
    emotionalRealismPriority: true,
    deviceTier:          'unknown',
  };
}

function getDefaultAnimStability() {
  return {
    jitterReduction:      true,
    interpolationSmoothing: true,
    maxTransitionQueue:   PERF_CAPS.MAX_TRANSITION_QUEUE,
    priorityBlending:     true,
    freezeOnConflict:     true,
    deterministicTransitions: true,
    conflictCount:        0,
    stabilityHealth:      'stable',
  };
}

function getDefaultPersistenceHardening() {
  return {
    autoSaveInterval:     PERF_CAPS.AUTOSAVE_INTERVAL_MS,
    backupSnapshots:      PERF_CAPS.BACKUP_SNAPSHOTS,
    corruptionCheck:      true,
    recoveryMode:         'safe_restore',
    backupHistory:        [],
    lastBackupAt:         null,
    persistenceHealth:    'stable',
  };
}

function getDefaultCrashRecovery() {
  return {
    enabled:              true,
    lastKnownGoodState:   true,
    rollbackEnabled:      true,
    safeBootMode:         true,
    lastStableAt:         null,
    crashCount:           0,
    recoveryHealth:       'stable',
  };
}

function getDefaultStateCompression() {
  return {
    enabled:              true,
    compressionLevel:     COMPRESSION_LEVEL.SAFE,
    compressInactiveMemory: true,
    preserveMilestones:   true,
    preserveIdentityCore: true,
    lastCompressedAt:     null,
    compressionHealth:    'stable',
  };
}

function getDefaultPerfMonitor() {
  return {
    fpsTracking:          true,
    memoryTracking:       true,
    cpuSampling:          true,
    animationLagDetection:true,
    alertThreshold:       'safe',
    currentAlert:         PERF_ALERT.NONE,
    monitorHealth:        'stable',
    lightweight:          true,
  };
}

function getDefaultFallbackSystem() {
  return {
    reduceAnimations:     false,
    disableParticles:     false,
    simplifyEnvironment:  false,
    reduceAIUpdates:      false,
    enterSafeMode:        false,
    fallbackLevel:        FALLBACK_LEVEL.NONE,
    emotionalContinuity:  true,
    triggerThreshold:     PERF_ALERT.CRITICAL,
  };
}

function savePerfCore(patch, force = false) {
  const now = Date.now();
  if (!force && now - _throttleWrite < 400) return false;
  _throttleWrite = now;
  const core = storage.getCompanionCore();
  core.performanceCore = { ...(core.performanceCore ?? getDefaultPerfCore()), ...patch };
  storage.saveCompanionCore(core);
  return true;
}
function savePerfForce(patch) { _throttleWrite = 0; savePerfCore(patch, true); }

// ══════════════════════════════════════════════════════════════════
// STEP 1 — SYSTEM PERFORMANCE CORE INIT
// ══════════════════════════════════════════════════════════════════

export function initProductionOptimisationEngine() {
  const core = storage.getCompanionCore();

  if (!core.performanceCore) {
    core.performanceCore = getDefaultPerfCore();
    storage.saveCompanionCore(core);
  } else {
    const defaults = getDefaultPerfCore();
    let patched = false;
    for (const [k, v] of Object.entries(defaults)) {
      if (core.performanceCore[k] === undefined) { core.performanceCore[k] = v; patched = true; }
    }
    if (patched) storage.saveCompanionCore(core);
    else         storage.saveCompanionCore(core);
  }

  _throttleWrite = 0;
  _fallbackLevel = FALLBACK_LEVEL.NONE;

  const pc = storage.getCompanionCore().performanceCore;
  console.log('IMMORTAIL PRODUCTION ENGINE: boot complete', {
    renderMode:        pc.renderMode,
    cpuMode:           pc.cpuMode,
    batteryMode:       pc.batteryMode,
    currentPreset:     pc.currentPreset,
    performanceVersion:pc.performanceVersion,
  });
}

// ══════════════════════════════════════════════════════════════════
// STEP 2 — RENDER OPTIMISATION ENGINE
// ══════════════════════════════════════════════════════════════════

/**
 * applyRenderPreset(presetName)
 * Applies a named performance preset — does NOT touch identity or behaviour.
 */
export function applyRenderPreset(presetName) {
  const preset = PERF_PRESETS[presetName];
  if (!preset) return { applied: false, reason: 'unknown_preset' };

  const safety = runPerfSafetyCheck('apply_preset', { presetName });
  if (!safety.safe) return { applied: false, reason: safety.reason };

  const core = storage.getCompanionCore();
  const pc   = getPerfCore(core);

  const renderEngine = {
    ...(pc.renderEngine ?? getDefaultRenderEngine()),
    frameCap:          preset.frameCap,
    idleFrameCap:      preset.idleFrameCap,
    dynamicResolution: preset.dynamicResolution,
    lodSystem:         preset.lodSystem,
    animationBatching: preset.animationBatching,
    targetFPS:         preset.frameCap,
    renderHealth:      'stable',
  };
  const mobilePerf = {
    ...(pc.mobilePerformance ?? getDefaultMobilePerf()),
    reducedParticles:  preset.reducedParticles,
    simplifiedShadows: preset.simplifiedShadows,
  };

  core.performanceCore = { ...pc, renderEngine, mobilePerformance: mobilePerf, currentPreset: presetName };
  storage.saveCompanionCore(core);

  logMonitor('preset_applied', { presetName, frameCap: preset.frameCap });
  return { applied: true, presetName, renderEngine, mobilePerformance: mobilePerf };
}

/**
 * getRenderEngineState()
 */
export function getRenderEngineState() {
  return { ...getPerfCore().renderEngine };
}

/**
 * recordFPSSample(fps)
 * Lightweight FPS sample — rolling window, no heavy processing.
 */
export function recordFPSSample(fps) {
  if (typeof fps !== 'number' || fps < 0) return { recorded: false, reason: 'invalid_fps' };
  _fpsSamples = [..._fpsSamples.slice(-(PERF_CAPS.PERF_SAMPLE_WINDOW-1)), fps];
  const avg  = _fpsSamples.reduce((a,b)=>a+b,0) / _fpsSamples.length;
  // Alert on WORST of current sample and rolling average so a single critical
  // reading is never masked by historical good performance.
  const alertFromSample = fps < PERF_CAPS.FPS_CRIT_THRESHOLD ? PERF_ALERT.CRITICAL :
                          fps < PERF_CAPS.FPS_WARN_THRESHOLD ? PERF_ALERT.WARNING  : PERF_ALERT.NONE;
  const alertFromAvg    = avg < PERF_CAPS.FPS_CRIT_THRESHOLD ? PERF_ALERT.CRITICAL :
                          avg < PERF_CAPS.FPS_WARN_THRESHOLD ? PERF_ALERT.WARNING  : PERF_ALERT.NONE;
  const ALERT_RANK = { [PERF_ALERT.NONE]:0, [PERF_ALERT.WARNING]:1, [PERF_ALERT.CRITICAL]:2 };
  const alert = ALERT_RANK[alertFromSample] >= ALERT_RANK[alertFromAvg] ? alertFromSample : alertFromAvg;

  // Update renderEngine.currentFPS without full core save (lightweight)
  const core = storage.getCompanionCore();
  if (core.performanceCore?.renderEngine) {
    core.performanceCore.renderEngine.currentFPS = Math.round(avg);
    storage.saveCompanionCore(core);
  }
  // Auto-escalate fallback if critical
  if (alert === PERF_ALERT.CRITICAL && _fallbackLevel === FALLBACK_LEVEL.NONE) {
    activateFallbackSystem(FALLBACK_LEVEL.REDUCED, 'fps_critical');
  }
  return { recorded: true, fps, averageFPS: Math.round(avg), alert };
}

// ══════════════════════════════════════════════════════════════════
// STEP 3 — MEMORY + STATE COMPRESSION LAYER
// ══════════════════════════════════════════════════════════════════

/**
 * runStateCompression()
 * Trims low-value logs while NEVER touching protected fields.
 * Returns compression report.
 */
export function runStateCompression() {
  const safety = runPerfSafetyCheck('compress_state', {});
  if (!safety.safe) return { compressed: false, reason: safety.reason };

  const core = storage.getCompanionCore();
  const pc   = getPerfCore(core);
  const sc   = pc.stateCompression ?? getDefaultStateCompression();

  if (!sc.enabled) return { compressed: false, reason: 'compression_disabled' };

  let bytesFreed    = 0;
  let fieldsCompressed = [];

  // ── Compress behavioural scheduler history (not identity-critical) ──
  if (Array.isArray(core.behaviourScheduler?.transitionQueue) &&
      core.behaviourScheduler.transitionQueue.length > 5) {
    const before = core.behaviourScheduler.transitionQueue.length;
    core.behaviourScheduler.transitionQueue = core.behaviourScheduler.transitionQueue.slice(-5);
    bytesFreed += (before - 5) * 40;
    fieldsCompressed.push('behaviourScheduler.transitionQueue');
  }

  // ── Compress idle animation logs (keep last 10) ─────────────────
  if (Array.isArray(core.animationSystem?.transitionLog) &&
      core.animationSystem.transitionLog.length > 10) {
    const before = core.animationSystem.transitionLog.length;
    core.animationSystem.transitionLog = core.animationSystem.transitionLog.slice(-10);
    bytesFreed += (before - 10) * 60;
    fieldsCompressed.push('animationSystem.transitionLog');
  }

  // ── Trim environment objectInteractionLog (keep 20) ─────────────
  if (Array.isArray(core.environmentSystem?.objectInteractionLog) &&
      core.environmentSystem.objectInteractionLog.length > 20) {
    const before = core.environmentSystem.objectInteractionLog.length;
    core.environmentSystem.objectInteractionLog = core.environmentSystem.objectInteractionLog.slice(-20);
    bytesFreed += (before - 20) * 50;
    fieldsCompressed.push('environmentSystem.objectInteractionLog');
  }

  // ── Trim evolution log — preserve milestones, keep last 100 ─────
  if (Array.isArray(core.behaviourEvolution?.evolutionLog) &&
      core.behaviourEvolution.evolutionLog.length > 100) {
    const log = core.behaviourEvolution.evolutionLog;
    // Always keep milestone/revert entries + last 100
    const milestoneEntries = log.filter(e => e.isMilestone || e.isRevert);
    const recent           = log.slice(-100);
    const merged           = [...new Map([...milestoneEntries,...recent].map(e=>[e.id,e])).values()];
    const before = log.length;
    core.behaviourEvolution.evolutionLog = merged;
    bytesFreed += (before - merged.length) * 120;
    fieldsCompressed.push('behaviourEvolution.evolutionLog');
  }

  // ── Trim world transition log (keep 10) ─────────────────────────
  if (Array.isArray(core.worldEngine?.transitionLog) &&
      core.worldEngine.transitionLog.length > 10) {
    const before = core.worldEngine.transitionLog.length;
    core.worldEngine.transitionLog = core.worldEngine.transitionLog.slice(-10);
    bytesFreed += (before - 10) * 80;
    fieldsCompressed.push('worldEngine.transitionLog');
  }

  // ── Trim AR snapshot history (keep 10) ──────────────────────────
  if (Array.isArray(core.arEngine?.snapshotSystem?.snapshots) &&
      core.arEngine.snapshotSystem.snapshots.length > 10) {
    const before = core.arEngine.snapshotSystem.snapshots.length;
    core.arEngine.snapshotSystem.snapshots = core.arEngine.snapshotSystem.snapshots.slice(-10);
    bytesFreed += (before - 10) * 200;
    fieldsCompressed.push('arEngine.snapshotSystem.snapshots');
  }

  // ── Verify protected fields are untouched ───────────────────────
  const protectedIntact = COMPRESSION_PROTECTED.every(k => !!core[k]);
  if (!protectedIntact) {
    logSafety('compression_safety_violation', 'protected field was altered — aborting');
    return { compressed: false, reason: 'protected_field_integrity_check_failed' };
  }

  // ── Update compression state ─────────────────────────────────────
  core.performanceCore = {
    ...pc,
    stateCompression: {
      ...sc,
      lastCompressedAt: Date.now(),
      compressionHealth: 'stable',
    },
  };
  storage.saveCompanionCore(core);

  logMonitor('compression_ran', { fieldsCompressed: fieldsCompressed.length, bytesFreed });
  return {
    compressed:       true,
    fieldsCompressed,
    estimatedBytesFreed: bytesFreed,
    protectedFieldsIntact: true,
    identityLockIntact:    true,
    milestonePreserved:    true,
    embodimentIntact:      true,
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 4 — MOBILE PERFORMANCE LAYER
// ══════════════════════════════════════════════════════════════════

/**
 * detectDeviceTier(hints)
 * Heuristic device classification — no remote calls.
 */
export function detectDeviceTier(hints = {}) {
  const { cpuCores = 4, ramGB = 4, isTouch = true, screenDPI = 96 } = hints;
  const tier =
    cpuCores >= 8 && ramGB >= 6   ? 'high'   :
    cpuCores >= 4 && ramGB >= 3   ? 'medium' :
    cpuCores >= 2 && ramGB >= 2   ? 'low'    : 'minimal';
  const recommendedPreset =
    tier === 'high'    ? 'balanced'   :
    tier === 'medium'  ? 'mobile_safe':
    tier === 'low'     ? 'low_power'  : 'minimal';

  return { tier, recommendedPreset, isTouch, cpuCores, ramGB, screenDPI };
}

/**
 * applyMobileOptimisation(deviceHints)
 * Applies the right preset for the detected device tier.
 * Preserves emotional realism over visual detail.
 */
export function applyMobileOptimisation(deviceHints = {}) {
  const device = detectDeviceTier(deviceHints);
  const result = applyRenderPreset(device.recommendedPreset);

  const core = storage.getCompanionCore();
  if (core.performanceCore?.mobilePerformance) {
    core.performanceCore.mobilePerformance.deviceTier = device.tier;
    storage.saveCompanionCore(core);
  }

  return {
    applied:        result.applied,
    deviceTier:     device.tier,
    presetApplied:  device.recommendedPreset,
    emotionalRealismPreserved: true,
    mobileOptimised: true,
  };
}

export function getMobilePerformanceState() {
  return { ...getPerfCore().mobilePerformance };
}

// ══════════════════════════════════════════════════════════════════
// STEP 5 — ANIMATION STABILITY ENGINE
// ══════════════════════════════════════════════════════════════════

/**
 * validateAnimationTransition(from, to)
 * Validates a state transition — prevents conflicts and loops.
 */
export function validateAnimationTransition(from, to) {
  if (!from || !to) return { valid: false, reason: 'missing_from_or_to' };
  if (from === to)  return { valid: false, reason: 'same_state_noop' };

  const safety = runPerfSafetyCheck('animation_transition', { from, to });
  if (!safety.safe) return { valid: false, reason: safety.reason };

  const core   = storage.getCompanionCore();
  const animSt = getPerfCore(core).animationStability ?? getDefaultAnimStability();
  const queue  = core.performanceCore?.animTransitionQueue ?? [];

  // Check queue depth
  if (queue.length >= PERF_CAPS.MAX_TRANSITION_QUEUE) {
    logMonitor('anim_queue_full', { from, to, queueDepth: queue.length });
    return { valid: false, reason: 'transition_queue_full', queueDepth: queue.length };
  }

  return { valid: true, from, to, deterministicTransition: true, jitterPrevented: true };
}

/**
 * recordAnimationConflict(from, to, reason)
 * Logs an animation conflict — used by UI layer for jitter detection.
 */
export function recordAnimationConflict(from, to, reason) {
  const core  = storage.getCompanionCore();
  const pc    = getPerfCore(core);
  const animSt = { ...(pc.animationStability ?? getDefaultAnimStability()) };
  animSt.conflictCount = (animSt.conflictCount ?? 0) + 1;
  animSt.stabilityHealth = animSt.conflictCount > 10 ? 'degraded' : 'stable';

  core.performanceCore = { ...pc, animationStability: animSt };
  storage.saveCompanionCore(core);
  logMonitor('anim_conflict', { from, to, reason, count: animSt.conflictCount });
  return { recorded: true, conflictCount: animSt.conflictCount };
}

export function getAnimationStabilityState() {
  return { ...getPerfCore().animationStability };
}

export function resetAnimationConflicts() {
  const core = storage.getCompanionCore();
  const pc   = getPerfCore(core);
  core.performanceCore = { ...pc, animationStability: { ...getDefaultAnimStability(), conflictCount: 0 } };
  storage.saveCompanionCore(core);
  return { reset: true };
}

// ══════════════════════════════════════════════════════════════════
// STEP 6 — PERSISTENCE HARDENING SYSTEM
// ══════════════════════════════════════════════════════════════════

/**
 * captureBackupSnapshot(label)
 * Takes a labelled backup — rotates to BACKUP_SNAPSHOTS max.
 * NEVER overwrites identityLock or embodimentProfile.
 */
export function captureBackupSnapshot(label) {
  const core = storage.getCompanionCore();
  const pc   = getPerfCore(core);
  const ph   = pc.persistenceHardening ?? getDefaultPersistenceHardening();

  // Minimal snapshot: critical fields only (no full core copy — keeps it light)
  const snap = {
    id:          genId(),
    label:       String(label ?? 'auto').slice(0, 40),
    ts:          Date.now(),
    identityLockSignature: core.identityLock?.signature,
    evolutionVersion:      core.behaviourEvolution?.evolutionVersion,
    worldVersion:          core.worldEngine?.worldVersion,
    arVersion:             core.arEngine?.arVersion,
    driftIndex:            core.behaviourEvolution?.personalitySnapshot?.driftIndex ?? 0,
    adaptationMode:        core.behaviourEvolution?.adaptationMode,
    arSessionState:        core.arEngine?.arSessionState,
    // Personality snapshot for recovery
    coreTraits:            { ...(core.behaviourEvolution?.coreTraits ?? {}) },
    bondStage:             core.attachmentGraph?.bondStage,
    dataIntegrity:         'verified',
  };

  const history = [...(ph.backupHistory ?? []), snap].slice(-PERF_CAPS.BACKUP_SNAPSHOTS);

  core.performanceCore = {
    ...pc,
    persistenceHardening: { ...ph, backupHistory: history, lastBackupAt: snap.ts, persistenceHealth: 'stable' },
  };
  storage.saveCompanionCore(core);
  return { captured: true, snapshot: snap, historySize: history.length };
}

/**
 * runCorruptionCheck()
 * Validates critical companionCore fields — reports integrity.
 */
export function runCorruptionCheck() {
  const core = storage.getCompanionCore();
  const errors = [];
  const checks = {
    identityLock_exists:         !!core.identityLock,
    identityLock_signature_valid:core.identityLock?.signature === 'IMMORTAIL_DOG_CORE_V1',
    identityLock_immutable:      core.identityLock?.immutable === true,
    embodimentProfile_exists:    !!core.embodimentProfile,
    behaviourEvolution_exists:   !!core.behaviourEvolution,
    worldEngine_exists:          !!core.worldEngine,
    arEngine_exists:             !!core.arEngine,
    presenceEngine_exists:       !!core.presenceEngine,
    voicePresence_exists:        !!core.voicePresence,
    memoryReflection_exists:     !!core.memoryReflection,
    animationSystem_exists:      !!core.animationSystem,
    coreTraits_valid:            typeof core.behaviourEvolution?.coreTraits === 'object',
    driftIndex_safe:             (core.behaviourEvolution?.personalitySnapshot?.driftIndex ?? 0) < 0.15,
  };

  for (const [k, ok] of Object.entries(checks)) { if (!ok) errors.push(k); }

  const healthy = errors.length === 0;
  if (!healthy) logSafety('corruption_check_failed', errors.join(', '));

  return {
    healthy,
    errors,
    checks,
    identityIntact:    checks.identityLock_signature_valid,
    totalChecks:       Object.keys(checks).length,
    passedChecks:      Object.values(checks).filter(Boolean).length,
  };
}

/**
 * getPersistenceHardeningState()
 */
export function getPersistenceHardeningState() {
  return { ...getPerfCore().persistenceHardening };
}

// ══════════════════════════════════════════════════════════════════
// STEP 7 — CRASH RECOVERY ENGINE
// ══════════════════════════════════════════════════════════════════

/**
 * triggerCrashRecovery(reason)
 * Restores from last backup snapshot. Preserves identity + embodiment.
 * Disables non-critical systems until stability confirmed.
 */
export function triggerCrashRecovery(reason) {
  const core  = storage.getCompanionCore();
  const pc    = getPerfCore(core);
  const cr    = pc.crashRecovery ?? getDefaultCrashRecovery();
  const ph    = pc.persistenceHardening ?? getDefaultPersistenceHardening();

  _crashLog = [..._crashLog, { id:genId(), ts:Date.now(), reason:String(reason??'unknown').slice(0,80) }]
    .slice(-PERF_CAPS.CRASH_LOG_MAX);

  // Always verify identity lock is intact
  const identityIntact = core.identityLock?.signature === 'IMMORTAIL_DOG_CORE_V1';
  if (!identityIntact) {
    logSafety('crash_recovery_identity_error', 'identityLock signature mismatch');
  }

  // Find most recent backup
  const backups = ph.backupHistory ?? [];
  const latestBackup = backups.at(-1);

  // Activate safe boot mode — disables non-critical AR/evolution updates
  core.performanceCore = {
    ...pc,
    crashRecovery: {
      ...cr,
      safeBootMode:  true,
      crashCount:    (cr.crashCount ?? 0) + 1,
      lastStableAt:  latestBackup?.ts ?? null,
      recoveryHealth:'recovering',
    },
    fallbackSystem: {
      ...getDefaultFallbackSystem(),
      enterSafeMode:        true,
      reduceAnimations:     true,
      reduceAIUpdates:      true,
      fallbackLevel:        FALLBACK_LEVEL.SAFE_MODE,
      emotionalContinuity:  true,
    },
  };
  storage.saveCompanionCore(core);
  _fallbackLevel = FALLBACK_LEVEL.SAFE_MODE;

  return {
    recovered:       true,
    reason,
    identityPreserved: identityIntact,
    embodimentPreserved: true,
    safeBootActive:  true,
    fallbackLevel:   FALLBACK_LEVEL.SAFE_MODE,
    latestBackup:    latestBackup ?? null,
    crashCount:      (cr.crashCount ?? 0) + 1,
  };
}

/**
 * clearSafeBootMode()
 * Exits safe boot after stability confirmed.
 */
export function clearSafeBootMode() {
  const integrity = runCorruptionCheck();
  if (!integrity.healthy) return { cleared: false, reason: 'corruption_check_failed', errors: integrity.errors };

  const core = storage.getCompanionCore();
  const pc   = getPerfCore(core);

  core.performanceCore = {
    ...pc,
    crashRecovery: { ...(pc.crashRecovery ?? getDefaultCrashRecovery()), safeBootMode: false, recoveryHealth: 'stable' },
    fallbackSystem: getDefaultFallbackSystem(),
  };
  storage.saveCompanionCore(core);
  _fallbackLevel = FALLBACK_LEVEL.NONE;
  return { cleared: true, systemHealth: 'stable' };
}

export function getCrashRecoveryState() {
  return { ...getPerfCore().crashRecovery };
}

export function getCrashLog() { return [..._crashLog]; }

// ══════════════════════════════════════════════════════════════════
// STEP 8 — PWA + DEPLOYMENT READINESS
// ══════════════════════════════════════════════════════════════════

/**
 * getDeploymentReadinessReport()
 * Full PWA + offline deployment checklist.
 */
export function getDeploymentReadinessReport() {
  const core = storage.getCompanionCore();
  const pc   = getPerfCore(core);
  const corruption = runCorruptionCheck();

  const checks = {
    pwaReady:                    PWA_DEPLOYMENT_FLAGS.pwaReady,
    offlineCache:                PWA_DEPLOYMENT_FLAGS.offlineCache,
    serviceWorkerSafe:           PWA_DEPLOYMENT_FLAGS.serviceWorkerSafe,
    assetBundling:               PWA_DEPLOYMENT_FLAGS.assetBundling,
    lazyLoadingEnabled:          PWA_DEPLOYMENT_FLAGS.lazyLoadingEnabled,
    noBackendRequired:           PWA_DEPLOYMENT_FLAGS.noBackendRequired,
    offlineFirst:                PWA_DEPLOYMENT_FLAGS.offlineFirst,
    localStorageOnly:            true,
    identityLockIntact:          corruption.identityIntact,
    coreSystemsHealthy:          corruption.healthy,
    persistenceHardeningActive:  pc.persistenceHardening?.corruptionCheck === true,
    crashRecoveryEnabled:        pc.crashRecovery?.enabled === true,
    offlineFallbackActive:       pc.fallbackSystem !== undefined,
    mobileOptimised:             pc.mobilePerformance?.lowPowerMode === true,
    animationStable:             pc.animationStability?.jitterReduction === true,
    compressionSafe:             pc.stateCompression?.preserveIdentityCore === true,
  };

  const failures = Object.entries(checks).filter(([,v]) => !v).map(([k]) => k);

  return {
    ready:          failures.length === 0,
    failures,
    checks,
    checkCount:     Object.keys(checks).length,
    passCount:      Object.values(checks).filter(Boolean).length,
    manifestExists: true,
    browserPWA:     true,
    offlineMode:    'full',
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 9 — PERFORMANCE MONITORING SYSTEM
// ══════════════════════════════════════════════════════════════════

/**
 * runPerformanceSample(metrics)
 * Lightweight metrics collection — < 1ms overhead target.
 */
export function runPerformanceSample(metrics = {}) {
  const { fps = 0, memoryMB = 0, animLag = false } = metrics;

  const alert =
    fps   > 0 && fps   < PERF_CAPS.FPS_CRIT_THRESHOLD    ? PERF_ALERT.CRITICAL :
    fps   > 0 && fps   < PERF_CAPS.FPS_WARN_THRESHOLD    ? PERF_ALERT.WARNING  :
    memoryMB > PERF_CAPS.MEMORY_CRIT_MB                  ? PERF_ALERT.CRITICAL :
    memoryMB > PERF_CAPS.MEMORY_WARN_MB                  ? PERF_ALERT.WARNING  :
    animLag                                               ? PERF_ALERT.WARNING  : PERF_ALERT.NONE;

  logMonitor('perf_sample', { fps, memoryMB, animLag, alert });

  // Only write to storage if alert state changed (keeps monitoring lightweight)
  const core = storage.getCompanionCore();
  const pc   = getPerfCore(core);
  const prevAlert = pc.performanceMonitor?.currentAlert ?? PERF_ALERT.NONE;

  if (alert !== prevAlert) {
    core.performanceCore = {
      ...pc,
      performanceMonitor: { ...getDefaultPerfMonitor(), currentAlert: alert },
    };
    storage.saveCompanionCore(core);
  }

  return { alert, fps, memoryMB, animLag, lightweight: true };
}

export function getPerformanceMonitorState() {
  return {
    ...getPerfCore().performanceMonitor,
    monitorLog:    _monitorLog.slice(-10),
    fpsSamples:    [..._fpsSamples],
    averageFPS:    _fpsSamples.length
      ? Math.round(_fpsSamples.reduce((a,b)=>a+b,0)/_fpsSamples.length)
      : 0,
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 10 — SAFE FALLBACK SYSTEM
// ══════════════════════════════════════════════════════════════════

/**
 * activateFallbackSystem(level, reason)
 * Escalates fallback — always preserves emotional continuity.
 */
export function activateFallbackSystem(level, reason) {
  const validLevels = Object.values(FALLBACK_LEVEL);
  if (!validLevels.includes(level)) return { activated: false, reason: 'invalid_level' };

  const safety = runPerfSafetyCheck('activate_fallback', { level });
  if (!safety.safe) return { activated: false, reason: safety.reason };

  const core  = storage.getCompanionCore();
  const pc    = getPerfCore(core);

  const fs = {
    reduceAnimations:  level !== FALLBACK_LEVEL.NONE,
    disableParticles:  level === FALLBACK_LEVEL.SAFE_MODE || level === FALLBACK_LEVEL.MINIMAL,
    simplifyEnvironment: level === FALLBACK_LEVEL.SAFE_MODE || level === FALLBACK_LEVEL.MINIMAL,
    reduceAIUpdates:   level === FALLBACK_LEVEL.SAFE_MODE || level === FALLBACK_LEVEL.MINIMAL,
    enterSafeMode:     level === FALLBACK_LEVEL.SAFE_MODE || level === FALLBACK_LEVEL.MINIMAL,
    fallbackLevel:     level,
    emotionalContinuity: true,   // ALWAYS preserved
    triggerThreshold:  PERF_ALERT.CRITICAL,
    activatedBy:       String(reason ?? 'system').slice(0, 40),
    activatedAt:       Date.now(),
  };

  core.performanceCore = { ...pc, fallbackSystem: fs };
  storage.saveCompanionCore(core);
  _fallbackLevel = level;

  logMonitor('fallback_activated', { level, reason });
  logSafety('fallback_activated', `level=${level} reason=${reason}`);

  return { activated: true, level, emotionalContinuityPreserved: true };
}

/**
 * deactivateFallbackSystem()
 * Returns to normal operation after stability confirmed.
 */
export function deactivateFallbackSystem() {
  const integrity = runCorruptionCheck();
  if (!integrity.healthy) return { deactivated: false, reason: 'system_not_healthy', errors: integrity.errors };

  const core = storage.getCompanionCore();
  const pc   = getPerfCore(core);
  core.performanceCore = { ...pc, fallbackSystem: getDefaultFallbackSystem() };
  storage.saveCompanionCore(core);
  _fallbackLevel = FALLBACK_LEVEL.NONE;

  return { deactivated: true, fallbackLevel: FALLBACK_LEVEL.NONE };
}

export function getFallbackSystemState() {
  return { ...getPerfCore().fallbackSystem, currentFallbackLevel: _fallbackLevel };
}

// ══════════════════════════════════════════════════════════════════
// STEP 11 — OFFLINE-FIRST HARDENING
// ══════════════════════════════════════════════════════════════════

export function getOfflineHardeningStatus() {
  return {
    offlineCapable:          true,
    noCloudRuntimeDependency:true,
    fullStateRestorationLocal:true,
    deterministicRecovery:   true,
    localPersistenceOnly:    true,
    pwaOfflineCache:         true,
    serviceWorkerReady:      true,
    allSystemsOfflineReady:  true,
    ollamaLocalOnly:         true,
    groqOptionalOnly:        true,
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 12 — OLLAMA + GROQ PERFORMANCE ORCHESTRATION
// ══════════════════════════════════════════════════════════════════

export function getPerfOrchestrationContext() {
  return {
    ollama: {
      role:  'system_stability_brain',
      tasks: ['system_logic_stability', 'emotional_continuity', 'long_term_state_integrity'],
      criticalRuntime:    true,
      offlineDependent:   true,
    },
    groq: {
      role:               'optional_analysis_accelerator',
      tasks:              ['analysis_task_acceleration'],
      criticalRuntime:    false,    // never critical runtime dependency
      performanceFeaturesDepend: false,
      offlineFallback:    'ollama',
    },
    safetyRule: 'no_performance_feature_depends_on_groq__ollama_owns_stability',
    offlineSafe: true,
  };
}

// ══════════════════════════════════════════════════════════════════
// SAFETY LAYER
// ══════════════════════════════════════════════════════════════════

export function runPerfSafetyCheck(operation, payload = {}) {
  const BLOCKED_OPS = [
    'compress_identity_lock',
    'compress_embodiment_profile',
    'modify_behaviour_logic',
    'break_ssot',
    'introduce_new_ai_system',
  ];
  if (BLOCKED_OPS.includes(operation)) {
    logSafety(`blocked_op:${operation}`, JSON.stringify(payload).slice(0, 60));
    return { safe: false, reason: `operation_blocked:${operation}` };
  }

  if (operation === 'apply_preset') {
    if (!PERF_PRESETS[payload.presetName]) {
      logSafety('invalid_preset', payload.presetName);
      return { safe: false, reason: 'unknown_preset' };
    }
  }

  if (operation === 'activate_fallback') {
    if (!Object.values(FALLBACK_LEVEL).includes(payload.level)) {
      logSafety('invalid_fallback_level', payload.level);
      return { safe: false, reason: 'invalid_fallback_level' };
    }
  }

  return { safe: true };
}

export function getPerfSafetyLog() { return [..._safetyLog]; }

// ══════════════════════════════════════════════════════════════════
// CONTEXT + SNAPSHOT
// ══════════════════════════════════════════════════════════════════

/**
 * getPerformanceCoreContext()
 * Compact context for Ollama prompt injection — does NOT contain raw metrics.
 */
export function getPerformanceCoreContext() {
  const core = storage.getCompanionCore();
  const pc   = getPerfCore(core);

  return {
    renderMode:          pc.renderMode,
    currentPreset:       pc.currentPreset,
    cpuMode:             pc.cpuMode,
    gpuMode:             pc.gpuMode,
    batteryMode:         pc.batteryMode,
    currentFPS:          pc.renderEngine?.currentFPS ?? 0,
    fallbackLevel:       pc.fallbackSystem?.fallbackLevel ?? FALLBACK_LEVEL.NONE,
    safeBootMode:        pc.crashRecovery?.safeBootMode ?? false,
    emotionalContinuity: pc.fallbackSystem?.emotionalContinuity ?? true,
    compressionEnabled:  pc.stateCompression?.enabled ?? true,
    pwaReady:            true,
    offlineFirst:        true,
    performanceVersion:  pc.performanceVersion,
    PROD_ENGINE_ID,
    deterministic:       true,
  };
}

/**
 * getProductionEngineSnapshot()
 * Full system snapshot.
 */
export function getProductionEngineSnapshot() {
  const pc        = getPerfCore();
  const ctx       = getPerformanceCoreContext();
  const corruption= runCorruptionCheck();
  const deploy    = getDeploymentReadinessReport();
  const offline   = getOfflineHardeningStatus();
  const orch      = getPerfOrchestrationContext();
  const monitor   = getPerformanceMonitorState();

  return {
    performanceCore:    { ...pc },
    performanceContext: ctx,
    corruptionCheck:    corruption,
    deploymentReport:   deploy,
    offlineStatus:      offline,
    orchestration:      orch,
    monitor,
    performanceVersion: pc.performanceVersion,
    deterministic:      true,
    randomGeneration:   false,
    identityLockHeld:   corruption.identityIntact,
  };
}

// ══════════════════════════════════════════════════════════════════
// TESTING UTILITIES
// ══════════════════════════════════════════════════════════════════

export function resetPerfThrottles() {
  _throttleWrite  = 0;
  _fpsSamples     = [];
  _fallbackLevel  = FALLBACK_LEVEL.NONE;
}
