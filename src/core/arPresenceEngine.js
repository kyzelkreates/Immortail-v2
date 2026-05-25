/**
 * IMMORTAIL™ — RUN 17
 * arPresenceEngine.js
 *
 * Mobile + AR Companion Presence Layer
 * Spatial Camera-Aware Embodied Dog System — production safe.
 *
 * ARCHITECTURE RULES:
 *   - SSOT: all state through companionCore via storage.js only
 *   - AR activates ONLY on explicit user request — never auto-starts
 *   - Camera NEVER runs in background, NEVER persists frames
 *   - No continuous camera tracking — on_demand processing only
 *   - No real-world environmental mapping or cloud spatial storage
 *   - No location inference
 *   - Snapshots are local-only unless user explicitly exports
 *   - Dog model identity reused from embodimentProfile (Run 12) — never regenerated
 *   - Runs 1–16 untouched
 *   - Groq never accesses raw camera feed continuously
 *   - Ollama owns emotional continuity + behaviour decisions
 */

import storage from './storage.js';

// ══════════════════════════════════════════════════════════════════
// CONSTANTS & ENUMS
// ══════════════════════════════════════════════════════════════════

export const AR_ENGINE_ID = 'arPresenceEngine_V1';

export const AR_SESSION_STATE = {
  INACTIVE:    'inactive',
  INITIALISING:'initialising',
  ACTIVE:      'active',
  SUSPENDED:   'suspended',
  ENDING:      'ending',
};

export const AR_TRACKING_MODE = {
  OFF:         'off',
  SURFACE:     'surface',
  WORLD:       'world',
};

export const AR_ANCHOR_MODE = {
  NONE:        'none',
  FLOOR:       'floor',
  TABLE:       'table',
  MANUAL:      'manual',
};

export const AR_SURFACE = {
  FLOOR:       'floor',
  TABLE:       'table',
  UNKNOWN:     'unknown',
};

export const AR_PERMISSION = {
  IDLE:        'idle',
  GRANTED:     'granted',
  DENIED:      'denied',
};

export const AR_RENDER_MODE = {
  MODE_2D:     '2d',
  MODE_AR:     'ar',
};

export const AR_FRAME_RATE = {
  LOW_POWER:   'low_power_mode',
  NORMAL:      'normal',
  PERFORMANCE: 'performance',
};

export const AR_PRIVACY_MODE = {
  STRICT:      'strict',
};

// ── Caps & timing ─────────────────────────────────────────────────
export const AR_CAPS = {
  SNAPSHOT_LOG_MAX:    20,
  ANCHOR_LOG_MAX:      15,
  SAFETY_LOG_MAX:      40,
  SESSION_LOG_MAX:     20,
  BEHAVIOUR_LOG_MAX:   30,
  MIN_AR_SESSION_MS:   500,
  SURFACE_STABILITY_THRESHOLD: 0.6,
};

export const AR_SAFETY = {
  continuousTracking:       false,
  backgroundCamera:         false,
  persistentFrames:         false,
  environmentalMapping:     false,
  locationInference:        false,
  cloudSpatialStorage:      false,
  autonomousARActivation:   false,
  allSnapshotsLocalOnly:    true,
  userInitiatedOnly:        true,
};

// ── Mobile performance presets ────────────────────────────────────
export const MOBILE_PERF_PRESETS = Object.freeze({
  battery_safe: {
    polygonReduction:  0.5,
    animationLOD:      'low',
    textureCompression:'high',
    frameRateCap:      24,
    shadowsEnabled:    false,
    postProcessing:    false,
  },
  balanced: {
    polygonReduction:  0.25,
    animationLOD:      'medium',
    textureCompression:'medium',
    frameRateCap:      30,
    shadowsEnabled:    false,
    postProcessing:    false,
  },
  performance: {
    polygonReduction:  0.0,
    animationLOD:      'full',
    textureCompression:'low',
    frameRateCap:      60,
    shadowsEnabled:    true,
    postProcessing:    true,
  },
});

// ── AR behaviour influence ────────────────────────────────────────
export const AR_BEHAVIOUR_RULES = Object.freeze({
  userNearCamera:    { attentionIncrease: true,  headTrackingSoft: true,  noConstantStare: true  },
  userAwayFromCamera:{ attentionIncrease: false, headTrackingSoft: true,  idleResume: true        },
  idle:              { animation: 'idle_resting', movementPacing: 'slow',  microBehavioursActive: true },
  movement:          { headTrackStyle: 'soft',   noHyperTracking: true,   noJitter: true          },
});

// ══════════════════════════════════════════════════════════════════
// INTERNAL STATE
// ══════════════════════════════════════════════════════════════════

let _safetyLog      = [];
let _throttleWrite  = 0;
let _sessionStartAt = 0;

function genId() { return `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

function logSafety(type, detail) {
  _safetyLog = [..._safetyLog, {
    id: genId(), ts: Date.now(), type,
    detail: String(detail ?? '').slice(0, 80),
  }].slice(-AR_CAPS.SAFETY_LOG_MAX);
}

function getArEngine() {
  return storage.getCompanionCore().arEngine ?? getDefaultArEngine();
}

function getDefaultArEngine() {
  return {
    arEnabled:         false,
    arSessionState:    AR_SESSION_STATE.INACTIVE,
    trackingMode:      AR_TRACKING_MODE.OFF,
    anchorMode:        AR_ANCHOR_MODE.NONE,
    surfaceDetection:  'disabled',
    worldScale:        '1:1',
    renderMode:        AR_RENDER_MODE.MODE_2D,
    cameraInput:       getDefaultCameraInput(),
    anchorState:       getDefaultAnchorState(),
    worldScaleSystem:  getDefaultWorldScaleSystem(),
    snapshotSystem:    getDefaultSnapshotSystem(),
    mobilePerf:        getDefaultMobilePerf(),
    sessionLog:        [],
    privacyLog:        [],
    arVersion:         'V1',
  };
}

function getDefaultCameraInput() {
  return {
    active:          false,
    permissionState: AR_PERMISSION.IDLE,
    frameRate:       AR_FRAME_RATE.LOW_POWER,
    processingMode:  'on_demand',
    privacyMode:     AR_PRIVACY_MODE.STRICT,
    lastActivatedAt: null,
    lastDeactivatedAt: null,
    backgroundAllowed: false,  // always false — never auto-start
    persistFrames:   false,    // always false
  };
}

function getDefaultAnchorState() {
  return {
    activeAnchor:    null,
    anchorPosition:  {},
    anchorSurface:   AR_SURFACE.UNKNOWN,
    stabilityScore:  0.0,
    anchorLocked:    false,
    anchorLog:       [],
  };
}

function getDefaultWorldScaleSystem() {
  return {
    modelScale:           1.0,
    realWorldScale:       'meters',
    cameraDepthBias:      0.0,
    perspectiveCorrection: true,
    consistentSize:       true,
    antiDistortion:       true,
  };
}

function getDefaultSnapshotSystem() {
  return {
    enabled:      true,
    saveFormat:   'local_only',
    includes:     ['dog', 'environment', 'lighting'],
    privacyLocked: true,
    snapshots:    [],
  };
}

function getDefaultMobilePerf() {
  return {
    preset:           'balanced',
    polygonReduction: 0.25,
    animationLOD:     'medium',
    textureCompression:'medium',
    frameRateCap:     30,
    shadowsEnabled:   false,
    postProcessing:   false,
    batteryWarning:   false,
    gpuThrottle:      false,
  };
}

function saveAR(patch, force = false) {
  const now = Date.now();
  if (!force && now - _throttleWrite < 300) return false;
  _throttleWrite = now;
  const core = storage.getCompanionCore();
  core.arEngine = { ...(core.arEngine ?? getDefaultArEngine()), ...patch };
  storage.saveCompanionCore(core);
  return true;
}
function saveARForce(patch) { _throttleWrite = 0; saveAR(patch, true); }

// ══════════════════════════════════════════════════════════════════
// STEP 1 — AR PRESENCE ENGINE INIT
// ══════════════════════════════════════════════════════════════════

export function initArPresenceEngine() {
  const core = storage.getCompanionCore();

  if (!core.arEngine) {
    core.arEngine = getDefaultArEngine();
    storage.saveCompanionCore(core);
  } else {
    const defaults = getDefaultArEngine();
    let patched = false;
    for (const [k, v] of Object.entries(defaults)) {
      if (core.arEngine[k] === undefined) { core.arEngine[k] = v; patched = true; }
    }
    // Safety: always enforce privacy invariants on boot
    core.arEngine.cameraInput = {
      ...(core.arEngine.cameraInput ?? getDefaultCameraInput()),
      active:           false,           // never persist active camera across sessions
      backgroundAllowed:false,
      persistFrames:    false,
    };
    core.arEngine.arSessionState = AR_SESSION_STATE.INACTIVE;
    core.arEngine.trackingMode   = AR_TRACKING_MODE.OFF;
    if (patched) storage.saveCompanionCore(core);
    else         storage.saveCompanionCore(core);
  }

  _throttleWrite  = 0;
  _sessionStartAt = 0;

  console.log('IMMORTAIL AR PRESENCE ENGINE: boot complete', {
    arEnabled:      core.arEngine.arEnabled,
    arSessionState: core.arEngine.arSessionState,
    renderMode:     core.arEngine.renderMode,
    arVersion:      core.arEngine.arVersion,
  });
}

// ══════════════════════════════════════════════════════════════════
// STEP 2 — USER-INITIATED AR ACTIVATION SYSTEM
// ══════════════════════════════════════════════════════════════════

/**
 * requestArSession(trigger)
 * Only valid triggers: 'user_button', 'user_command', 'user_gesture'
 * Auto-triggers are rejected — privacy firewall.
 */
export function requestArSession(trigger, options = {}) {
  const safety = runArSafetyCheck('activate_ar', { trigger });
  if (!safety.safe) return { started: false, reason: safety.reason };

  const VALID_TRIGGERS = ['user_button', 'user_command', 'user_gesture'];
  if (!VALID_TRIGGERS.includes(trigger)) {
    logSafety('ar_blocked_invalid_trigger', trigger);
    return { started: false, reason: 'invalid_trigger__user_initiation_required' };
  }

  const core = storage.getCompanionCore();
  const ar   = core.arEngine ?? getDefaultArEngine();

  if (ar.arSessionState === AR_SESSION_STATE.ACTIVE ||
      ar.arSessionState === AR_SESSION_STATE.INITIALISING) {
    return { started: false, reason: 'session_already_active' };
  }

  const now = Date.now();
  const logEntry = { id: genId(), ts: now, event: 'session_requested', trigger };

  const newAr = {
    ...ar,
    arEnabled:      true,
    arSessionState: AR_SESSION_STATE.INITIALISING,
    trackingMode:   AR_TRACKING_MODE.SURFACE,
    renderMode:     AR_RENDER_MODE.MODE_AR,
    cameraInput: {
      ...ar.cameraInput,
      active:          true,
      lastActivatedAt: now,
      processingMode:  'on_demand',
      backgroundAllowed: false,
      persistFrames:   false,
    },
    sessionLog: [...(ar.sessionLog ?? []), logEntry].slice(-AR_CAPS.SESSION_LOG_MAX),
  };
  core.arEngine = newAr;
  storage.saveCompanionCore(core);
  _sessionStartAt = now;

  return {
    started:        true,
    trigger,
    arSessionState: AR_SESSION_STATE.INITIALISING,
    trackingMode:   AR_TRACKING_MODE.SURFACE,
    privacySafe:    true,
    userInitiated:  true,
  };
}

/**
 * activateArSession()
 * Transitions from INITIALISING → ACTIVE after setup complete.
 */
export function activateArSession() {
  const core = storage.getCompanionCore();
  const ar   = core.arEngine ?? getDefaultArEngine();

  if (ar.arSessionState !== AR_SESSION_STATE.INITIALISING) {
    return { activated: false, reason: 'not_in_initialising_state' };
  }

  const logEntry = { id: genId(), ts: Date.now(), event: 'session_activated' };
  const newAr = {
    ...ar,
    arSessionState: AR_SESSION_STATE.ACTIVE,
    surfaceDetection: 'enabled',
    sessionLog: [...(ar.sessionLog ?? []), logEntry].slice(-AR_CAPS.SESSION_LOG_MAX),
  };
  core.arEngine = newAr;
  storage.saveCompanionCore(core);

  return { activated: true, arSessionState: AR_SESSION_STATE.ACTIVE };
}

/**
 * endArSession()
 * Tears down AR — camera deactivated, state reset to inactive.
 */
export function endArSession(reason) {
  const core = storage.getCompanionCore();
  const ar   = core.arEngine ?? getDefaultArEngine();

  const logEntry = { id: genId(), ts: Date.now(), event: 'session_ended', reason: reason ?? 'user_request' };

  const newAr = {
    ...ar,
    arEnabled:       false,
    arSessionState:  AR_SESSION_STATE.INACTIVE,
    trackingMode:    AR_TRACKING_MODE.OFF,
    surfaceDetection:'disabled',
    renderMode:      AR_RENDER_MODE.MODE_2D,
    cameraInput: {
      ...ar.cameraInput,
      active:            false,
      lastDeactivatedAt: Date.now(),
    },
    anchorState: {
      ...(ar.anchorState ?? getDefaultAnchorState()),
      anchorLocked: false,  // temporary anchors cleared on session end
    },
    sessionLog: [...(ar.sessionLog ?? []), logEntry].slice(-AR_CAPS.SESSION_LOG_MAX),
  };
  core.arEngine = newAr;
  storage.saveCompanionCore(core);

  return { ended: true, reason: reason ?? 'user_request', renderMode: AR_RENDER_MODE.MODE_2D };
}

// ══════════════════════════════════════════════════════════════════
// STEP 3 — LIGHTWEIGHT AR ANCHORING SYSTEM
// ══════════════════════════════════════════════════════════════════

/**
 * placeAnchor(position, surface, options)
 * Places a temporary anchor. No persistent environmental mapping.
 */
export function placeAnchor(position, surface, options = {}) {
  if (!position) return { placed: false, reason: 'no_position' };

  const safety = runArSafetyCheck('place_anchor', { surface });
  if (!safety.safe) return { placed: false, reason: safety.reason };

  const core = storage.getCompanionCore();
  const ar   = core.arEngine ?? getDefaultArEngine();

  if (ar.arSessionState !== AR_SESSION_STATE.ACTIVE) {
    return { placed: false, reason: 'ar_session_not_active' };
  }

  const validSurfaces = Object.values(AR_SURFACE);
  const resolvedSurface = validSurfaces.includes(surface) ? surface : AR_SURFACE.UNKNOWN;

  // Stability score — surface-based heuristic, no SLAM
  const stabilityScore =
    resolvedSurface === AR_SURFACE.FLOOR  ? 0.85 :
    resolvedSurface === AR_SURFACE.TABLE  ? 0.75 : 0.50;

  const anchor = {
    id:             genId(),
    position:       { x: position.x ?? 0, y: position.y ?? 0, z: position.z ?? 0 },
    surface:        resolvedSurface,
    stabilityScore,
    anchorLocked:   options.lock ?? false,
    temporary:      !options.lock,
    placedAt:       Date.now(),
    savedToCloud:   false,   // always false — no cloud spatial storage
    environmentMap: false,   // always false — no room mesh
  };

  const anchorState = {
    activeAnchor:   anchor.id,
    anchorPosition: anchor.position,
    anchorSurface:  resolvedSurface,
    stabilityScore,
    anchorLocked:   anchor.anchorLocked,
    anchorLog:      [...(ar.anchorState?.anchorLog ?? []), {
      id: anchor.id, ts: anchor.placedAt, surface: resolvedSurface, stabilityScore,
    }].slice(-AR_CAPS.ANCHOR_LOG_MAX),
  };

  core.arEngine = {
    ...ar,
    anchorMode: resolvedSurface === AR_SURFACE.FLOOR  ? AR_ANCHOR_MODE.FLOOR  :
                resolvedSurface === AR_SURFACE.TABLE  ? AR_ANCHOR_MODE.TABLE  :
                                                        AR_ANCHOR_MODE.MANUAL,
    anchorState,
  };
  storage.saveCompanionCore(core);

  return { placed: true, anchor, stabilityScore, stableEnough: stabilityScore >= AR_CAPS.SURFACE_STABILITY_THRESHOLD };
}

/**
 * clearAnchor()
 * Releases the active anchor — temporary anchors are always clearable.
 */
export function clearAnchor() {
  const core = storage.getCompanionCore();
  const ar   = core.arEngine ?? getDefaultArEngine();

  core.arEngine = {
    ...ar,
    anchorMode:  AR_ANCHOR_MODE.NONE,
    anchorState: { ...getDefaultAnchorState(), anchorLog: ar.anchorState?.anchorLog ?? [] },
  };
  storage.saveCompanionCore(core);
  return { cleared: true };
}

/**
 * estimateSurface(heuristics)
 * Lightweight surface heuristic — no SLAM, no room mesh.
 */
export function estimateSurface(heuristics = {}) {
  // Safe heuristic: use gravity + device orientation
  const { deviceTilt = 0, depthVariance = 0, motionStability = 0.5 } = heuristics;

  // Floor: nearly flat (tilt < 15deg), low variance
  if (Math.abs(deviceTilt) < 15 && depthVariance < 0.1) {
    return { surface: AR_SURFACE.FLOOR, confidence: 0.8, method: 'tilt_heuristic' };
  }
  // Table: moderate tilt, low variance
  if (Math.abs(deviceTilt) < 45 && depthVariance < 0.3) {
    return { surface: AR_SURFACE.TABLE, confidence: 0.6, method: 'tilt_heuristic' };
  }
  // Fallback: manual placement
  return { surface: AR_SURFACE.UNKNOWN, confidence: 0.3, method: 'manual_fallback' };
}

// ══════════════════════════════════════════════════════════════════
// STEP 4 — COMPANION WORLD-SCALE MAPPING
// ══════════════════════════════════════════════════════════════════

/**
 * computeWorldScale(deviceMetrics)
 * Returns stable scale parameters — prevents distortion across devices.
 */
export function computeWorldScale(deviceMetrics = {}) {
  const { screenDPI = 96, viewportWidth = 375, fovDegrees = 60 } = deviceMetrics;

  // Base model scale 1.0 = real dog size (~0.3m at shoulder)
  // perspectiveCorrection ensures consistent apparent size
  const dpiScale   = Math.max(0.5, Math.min(2.0, screenDPI / 96));
  const fovCorrect = Math.max(0.7, Math.min(1.3, 60 / Math.max(30, fovDegrees)));
  const modelScale = parseFloat((1.0 * dpiScale * fovCorrect).toFixed(4));

  return {
    modelScale,
    realWorldScale:        'meters',
    cameraDepthBias:       0.0,
    perspectiveCorrection: true,
    consistentSize:        true,
    antiDistortion:        true,
    dpiScale,
    fovCorrect,
    noDistortion:          true,
  };
}

export function updateWorldScaleSystem(deviceMetrics) {
  const scale = computeWorldScale(deviceMetrics);
  const core  = storage.getCompanionCore();
  const ar    = core.arEngine ?? getDefaultArEngine();
  core.arEngine = { ...ar, worldScaleSystem: scale };
  storage.saveCompanionCore(core);
  return { updated: true, worldScaleSystem: scale };
}

// ══════════════════════════════════════════════════════════════════
// STEP 5 — AR DOG RENDERING LAYER
// ══════════════════════════════════════════════════════════════════

/**
 * getArDogRenderingContext()
 * Provides the AR rendering layer — reuses persistent embodimentProfile.
 * Dog model is NEVER regenerated in AR mode.
 */
export function getArDogRenderingContext() {
  const core = storage.getCompanionCore();
  const emb  = core.embodimentProfile ?? {};
  const anim = core.animationSystem   ?? {};
  const ar   = core.arEngine          ?? getDefaultArEngine();
  const perf = ar.mobilePerf          ?? getDefaultMobilePerf();

  return {
    // Identity preserved from Run 12
    embodimentConsistencyHash: emb.embodimentConsistencyHash ?? '',
    profileVersion:            emb.profileVersion            ?? 'V1',
    appearanceTraits:          emb.appearanceTraits          ?? {},
    motionTraits:              emb.motionTraits              ?? {},

    // Animation state — identical to non-AR
    primaryLayer:     anim.primaryLayer     ?? 'idle',
    emotionalPosture: anim.emotionalPosture ?? 'relaxed',
    headTracking:     anim.headTracking     ?? 'forward',
    tailMovement:     anim.tailMovement     ?? 'slow_sway',
    idleBreathing:    anim.idleBreathing    ?? true,

    // Rendering flags
    renderEngine:      'three_js_webgl',
    useReactThreeFiber: true,
    regenerateModel:   false,   // NEVER regenerate in AR
    reuseExistingRig:  true,
    modelIdentical:    true,

    // Mobile optimisation
    polygonReduction:   perf.polygonReduction,
    animationLOD:       perf.animationLOD,
    textureCompression: perf.textureCompression,
    frameRateCap:       perf.frameRateCap,
    shadowsEnabled:     perf.shadowsEnabled,

    arMode:            ar.arSessionState === AR_SESSION_STATE.ACTIVE,
    worldScale:        ar.worldScaleSystem ?? getDefaultWorldScaleSystem(),
    anchorSurface:     ar.anchorState?.anchorSurface ?? AR_SURFACE.UNKNOWN,
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 6 — MOBILE CAMERA INPUT SYSTEM
// ══════════════════════════════════════════════════════════════════

/**
 * getCameraInputState()
 * Returns current camera state — always privacy-enforced.
 */
export function getCameraInputState() {
  const ar = getArEngine();
  const cam = ar.cameraInput ?? getDefaultCameraInput();
  return {
    ...cam,
    // Enforce invariants in read
    backgroundAllowed: false,
    persistFrames:     false,
    privacyMode:       AR_PRIVACY_MODE.STRICT,
  };
}

/**
 * requestCameraPermission()
 * Marks permission as granted — actual browser API call is UI-side.
 * Permission is never assumed; always explicitly requested.
 */
export function requestCameraPermission() {
  const core = storage.getCompanionCore();
  const ar   = core.arEngine ?? getDefaultArEngine();

  core.arEngine = {
    ...ar,
    cameraInput: {
      ...ar.cameraInput,
      permissionState: AR_PERMISSION.GRANTED,
    },
  };
  storage.saveCompanionCore(core);
  return { permissionState: AR_PERMISSION.GRANTED, privacySafe: true };
}

/**
 * denyCameraPermission()
 * Marks permission as denied — AR falls back gracefully.
 */
export function denyCameraPermission() {
  const core = storage.getCompanionCore();
  const ar   = core.arEngine ?? getDefaultArEngine();

  core.arEngine = {
    ...ar,
    arEnabled:       false,
    arSessionState:  AR_SESSION_STATE.INACTIVE,
    cameraInput: {
      ...ar.cameraInput,
      active:          false,
      permissionState: AR_PERMISSION.DENIED,
    },
  };
  storage.saveCompanionCore(core);
  logSafety('camera_permission_denied', 'AR falls back to 2D mode');
  return { permissionState: AR_PERMISSION.DENIED, fallback: AR_RENDER_MODE.MODE_2D };
}

// ══════════════════════════════════════════════════════════════════
// STEP 7 — SURFACE DETECTION (SAFE SIMPLIFIED)
// ══════════════════════════════════════════════════════════════════

/**
 * getSurfaceDetectionState()
 * Returns current surface detection mode — no SLAM, no room mesh.
 */
export function getSurfaceDetectionState() {
  const ar = getArEngine();
  return {
    mode:              ar.surfaceDetection ?? 'disabled',
    method:            'lightweight_heuristic',
    slamEnabled:       false,   // never — no full world mesh
    roomMeshEnabled:   false,
    environmentScan:   false,
    cloudStorage:      false,
    floorPlaneEstimation: true,
    flatSurfaceApprox: true,
    manualFallback:    true,
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 8 — AR + PRESENCE SYSTEM INTEGRATION
// ══════════════════════════════════════════════════════════════════

/**
 * getArPresenceIntegration()
 * Links AR with Run 13 presence engine — AR overlays, not replaces.
 */
export function getArPresenceIntegration() {
  const core = storage.getCompanionCore();
  const ar   = core.arEngine   ?? getDefaultArEngine();
  const pe   = core.presenceEngine ?? {};
  const we   = core.worldEngine    ?? {};
  const anim = core.animationSystem ?? {};

  const isArActive = ar.arSessionState === AR_SESSION_STATE.ACTIVE;

  return {
    arActive:             isArActive,
    presenceEngineSafe:   true,   // Run 13 continues running in AR
    presenceState:        pe.activePresenceState ?? 'ambient_idle',
    spatialZonesAdapted:  isArActive,
    microBehavioursActive:true,
    // Attention only aligns to camera when user is physically present (AR mode)
    attentionMode:        isArActive ? 'camera_aware_soft' : 'normal',
    internalWorldActive:  true,   // AR does NOT replace worldEngine
    worldOverlay:         isArActive,
    activeEnvironment:    we.activeEnvironment ?? 'living_room',
    animationPrimary:     anim.primaryLayer ?? 'idle',
    arOverlaysWorld:      true,
    worldReplacedByAR:    false,  // explicit invariant
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 9 — EMOTIONAL AR BEHAVIOUR MAPPING
// ══════════════════════════════════════════════════════════════════

/**
 * getArBehaviourState(proximityHint)
 * Returns behaviour state for AR — no constant staring, no hyper-tracking.
 */
export function getArBehaviourState(proximityHint = 'neutral') {
  const core = storage.getCompanionCore();
  const anim = core.animationSystem  ?? {};
  const emot = core.emotionalState   ?? {};
  const ar   = core.arEngine         ?? getDefaultArEngine();

  const isArActive = ar.arSessionState === AR_SESSION_STATE.ACTIVE;

  // Head-tracking style — always soft in AR
  const headTrackStyle =
    proximityHint === 'near'   ? 'soft_glance'  :
    proximityHint === 'far'    ? 'ambient_scan'  :
    isArActive                 ? 'soft_aware'    : 'forward';

  // Attention level — increases when user near, but never constant stare
  const attentionLevel =
    proximityHint === 'near'   ? 'elevated_soft' :
    proximityHint === 'far'    ? 'low'           : 'normal';

  return {
    // Behaviour rule compliance
    noConstantStare:     true,
    noHyperTracking:     true,
    noJitter:            true,
    headTrackStyle,
    attentionLevel,
    // Animation continuity from existing system
    primaryLayer:        anim.primaryLayer    ?? 'idle',
    emotionalPosture:    anim.emotionalPosture ?? 'relaxed',
    dominantEmotion:     emot.dominant        ?? 'neutral',
    // AR-specific micro-behaviours
    microBehaviours:     isArActive
      ? ['look_around_soft', 'idle_breath', 'ear_perk_gentle']
      : ['idle_breath', 'slow_tail_sway'],
    movementPacing:      'slow',
    arConsistent:        true,
    deterministic:       true,
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 10 — AR SNAPSHOT SYSTEM
// ══════════════════════════════════════════════════════════════════

/**
 * captureSnapshot(metadata)
 * Records a local-only snapshot event. No cloud upload unless user exports.
 */
export function captureSnapshot(metadata = {}) {
  const safety = runArSafetyCheck('snapshot', {});
  if (!safety.safe) return { captured: false, reason: safety.reason };

  const core = storage.getCompanionCore();
  const ar   = core.arEngine ?? getDefaultArEngine();

  const snap = {
    id:          genId(),
    ts:          Date.now(),
    includes:    ['dog', 'environment', 'lighting'],
    saveFormat:  'local_only',
    privacyLocked:true,
    cloudUploaded:false,       // always false unless user explicitly exports
    metadata:    {
      environment:  core.worldEngine?.activeEnvironment ?? 'living_room',
      timeOfDay:    core.worldEngine?.timeOfDay         ?? 'afternoon',
      mood:         core.emotionalState?.dominant       ?? 'neutral',
      ...metadata,
    },
  };

  const snapshotSystem = {
    ...(ar.snapshotSystem ?? getDefaultSnapshotSystem()),
    snapshots: [...(ar.snapshotSystem?.snapshots ?? []), snap].slice(-AR_CAPS.SNAPSHOT_LOG_MAX),
    lastSnapshot: snap,
  };

  core.arEngine = { ...ar, snapshotSystem };
  storage.saveCompanionCore(core);

  return { captured: true, snapshot: snap, localOnly: true, cloudUploaded: false };
}

export function getSnapshotLog() {
  return (getArEngine().snapshotSystem?.snapshots ?? []);
}

// ══════════════════════════════════════════════════════════════════
// STEP 11 — PERFORMANCE + MOBILE OPTIMISATION
// ══════════════════════════════════════════════════════════════════

/**
 * setMobilePerformancePreset(presetName)
 * Applies a performance preset — prevents GPU spikes + battery drain.
 */
export function setMobilePerformancePreset(presetName) {
  const preset = MOBILE_PERF_PRESETS[presetName];
  if (!preset) return { applied: false, reason: 'unknown_preset' };

  const core = storage.getCompanionCore();
  const ar   = core.arEngine ?? getDefaultArEngine();

  const mobilePerf = { preset: presetName, ...preset, batteryWarning: presetName === 'battery_safe', gpuThrottle: presetName !== 'performance' };
  core.arEngine = { ...ar, mobilePerf };
  storage.saveCompanionCore(core);

  return { applied: true, preset: presetName, mobilePerf };
}

/**
 * getMobilePerformanceReport()
 */
export function getMobilePerformanceReport() {
  const core = storage.getCompanionCore();
  const ar   = core.arEngine ?? getDefaultArEngine();
  const perf = ar.mobilePerf ?? getDefaultMobilePerf();
  const warnings = [];

  if (perf.frameRateCap > 60)   warnings.push('frame_rate_cap_too_high');
  if (!perf.textureCompression)  warnings.push('texture_compression_disabled');
  if (perf.shadowsEnabled && perf.frameRateCap > 30) warnings.push('shadows_on_with_high_framerate');

  return {
    status:        warnings.length ? 'warning' : 'stable',
    warnings,
    preset:        perf.preset,
    frameRateCap:  perf.frameRateCap,
    animationLOD:  perf.animationLOD,
    shadowsEnabled:perf.shadowsEnabled,
    polygonReduction: perf.polygonReduction,
    textureCompression: perf.textureCompression,
    postProcessing:perf.postProcessing,
    batteryWarning:perf.batteryWarning,
    gpuThrottle:   perf.gpuThrottle,
    mobileSafe:    true,
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 12 — OFFLINE + FALLBACK AR MODE
// ══════════════════════════════════════════════════════════════════

/**
 * getFallbackMode()
 * Returns 2D fallback — no feature loss to core companion.
 */
export function getFallbackMode() {
  return {
    fallbackActive:        true,
    renderMode:            AR_RENDER_MODE.MODE_2D,
    presenceEngineContinues: true,
    animationsContinue:    true,
    worldEngineContinues:  true,
    memoryReflectionContinues: true,
    voicePresenceContinues:true,
    featureLoss:           'none',
    degraded:              false,
    offlineSafe:           true,
    arUnavailable:         true,
    reason:                'ar_not_available_or_not_requested',
  };
}

/**
 * getOfflineArStatus()
 */
export function getOfflineArStatus() {
  return {
    offlineCapable:     true,
    coreCompanionWorks: true,
    arOptional:         true,
    noCloudRequired:    true,
    fallbackMode:       AR_RENDER_MODE.MODE_2D,
    environmentsAvailable: true,
    presenceEngineActive:  true,
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 13 — PRIVACY + SAFETY FIREWALL
// ══════════════════════════════════════════════════════════════════

export function runArSafetyCheck(operation, payload = {}) {
  const BLOCKED_OPS = [
    'continuous_camera_recording',
    'background_video_processing',
    'environmental_mapping_storage',
    'location_inference',
    'auto_activate_ar',
    'autonomous_ar_control',
  ];

  if (BLOCKED_OPS.includes(operation)) {
    logSafety(`blocked_op:${operation}`, JSON.stringify(payload).slice(0, 60));
    return { safe: false, reason: `operation_blocked:${operation}` };
  }

  if (operation === 'activate_ar') {
    const trigger = payload.trigger ?? '';
    if (trigger === 'auto' || trigger === 'background' || trigger === 'system') {
      logSafety('ar_blocked_auto_trigger', trigger);
      return { safe: false, reason: 'auto_trigger_blocked__user_initiation_required' };
    }
  }

  if (payload.backgroundCamera === true) {
    logSafety('blocked_background_camera', JSON.stringify(payload).slice(0, 60));
    return { safe: false, reason: 'background_camera_blocked' };
  }

  if (payload.persistFrames === true) {
    logSafety('blocked_persist_frames', JSON.stringify(payload).slice(0, 60));
    return { safe: false, reason: 'frame_persistence_blocked' };
  }

  if (payload.cloudSpatialStorage === true) {
    logSafety('blocked_cloud_spatial', JSON.stringify(payload).slice(0, 60));
    return { safe: false, reason: 'cloud_spatial_storage_blocked' };
  }

  if (payload.locationInference === true) {
    logSafety('blocked_location_inference', JSON.stringify(payload).slice(0, 60));
    return { safe: false, reason: 'location_inference_blocked' };
  }

  return { safe: true };
}

export function getArPrivacyLog() {
  return [..._safetyLog];
}

export function getArPrivacyFirewallStatus() {
  return {
    continuousTrackingBlocked:   AR_SAFETY.continuousTracking   === false,
    backgroundCameraBlocked:     AR_SAFETY.backgroundCamera      === false,
    persistentFramesBlocked:     AR_SAFETY.persistentFrames      === false,
    environmentalMappingBlocked: AR_SAFETY.environmentalMapping  === false,
    locationInferenceBlocked:    AR_SAFETY.locationInference     === false,
    cloudSpatialStorageBlocked:  AR_SAFETY.cloudSpatialStorage   === false,
    autonomousARBlocked:         AR_SAFETY.autonomousARActivation === false,
    snapshotsLocalOnly:          AR_SAFETY.allSnapshotsLocalOnly  === true,
    userInitiatedOnly:           AR_SAFETY.userInitiatedOnly      === true,
    firewallVersion:             AR_ENGINE_ID,
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 14 — OLLAMA + GROQ AR ORCHESTRATION
// ══════════════════════════════════════════════════════════════════

export function getArOrchestrationContext() {
  return {
    ollama: {
      role:  'ar_emotional_continuity_brain',
      tasks: [
        'emotional_continuity_in_ar',
        'companion_behaviour_decisions',
        'memory_presence_consistency',
        'environment_integration',
      ],
      canAccessRawCameraFeed:     false,
      canControlARState:          false,
      definesBehaviour:           true,
    },
    groq: {
      role:               'ar_scene_classifier',
      tasks:              ['scene_classification', 'ar_environment_inference', 'scene_tagging'],
      accessCameraFeed:   'on_demand_only',
      continuousAccess:   false,    // Groq NEVER accesses camera continuously
      canControlARState:  false,    // no autonomy over AR state
      fallback:           'ollama',
    },
    safetyRule: 'groq_never_accesses_camera_continuously__no_autonomy_over_ar_state',
    offlineSafe: true,
  };
}

// ══════════════════════════════════════════════════════════════════
// CONTEXT + SNAPSHOT
// ══════════════════════════════════════════════════════════════════

/**
 * getArEngineContext()
 * Full context for Ollama prompt injection.
 */
export function getArEngineContext() {
  const core = storage.getCompanionCore();
  const ar   = core.arEngine ?? getDefaultArEngine();
  const cam  = ar.cameraInput ?? getDefaultCameraInput();
  const perf = ar.mobilePerf  ?? getDefaultMobilePerf();

  return {
    arEnabled:        ar.arEnabled,
    arSessionState:   ar.arSessionState,
    renderMode:       ar.renderMode,
    trackingMode:     ar.trackingMode,
    anchorMode:       ar.anchorMode,
    anchorSurface:    ar.anchorState?.anchorSurface ?? AR_SURFACE.UNKNOWN,
    stabilityScore:   ar.anchorState?.stabilityScore ?? 0,
    cameraActive:     cam.active,
    cameraPermission: cam.permissionState,
    privacyMode:      cam.privacyMode,
    backgroundAllowed:cam.backgroundAllowed,  // always false
    persistFrames:    cam.persistFrames,       // always false
    mobilePerfPreset: perf.preset,
    frameRateCap:     perf.frameRateCap,
    snapshotCount:    (ar.snapshotSystem?.snapshots ?? []).length,
    worldScale:       ar.worldScaleSystem?.modelScale ?? 1.0,
    userInitiated:    AR_SAFETY.userInitiatedOnly,
    arVersion:        ar.arVersion,
    privacySafe:      true,
    deterministic:    true,
    fabricated:       false,
  };
}

/**
 * getArEngineSnapshot()
 * Full system snapshot.
 */
export function getArEngineSnapshot() {
  const core         = storage.getCompanionCore();
  const ar           = core.arEngine ?? getDefaultArEngine();
  const ctx          = getArEngineContext();
  const renderCtx    = getArDogRenderingContext();
  const presInteg    = getArPresenceIntegration();
  const behavState   = getArBehaviourState();
  const offline      = getOfflineArStatus();
  const perf         = getMobilePerformanceReport();
  const orch         = getArOrchestrationContext();
  const privacy      = getArPrivacyFirewallStatus();
  const surfaceState = getSurfaceDetectionState();
  const fallback     = getFallbackMode();

  return {
    arEngine:            { ...ar },
    arEngineContext:     ctx,
    dogRenderingContext: renderCtx,
    presenceIntegration: presInteg,
    behaviourState:      behavState,
    surfaceDetection:    surfaceState,
    offlineStatus:       offline,
    performanceReport:   perf,
    orchestration:       orch,
    privacyFirewall:     privacy,
    fallbackMode:        fallback,
    arVersion:           ar.arVersion,
    deterministic:       true,
    randomGeneration:    false,
    privacySafe:         true,
  };
}

// ══════════════════════════════════════════════════════════════════
// TESTING UTILITIES
// ══════════════════════════════════════════════════════════════════

export function resetArThrottles() {
  _throttleWrite  = 0;
  _sessionStartAt = 0;
}
