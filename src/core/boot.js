// ================================================================
// IMMORTAIL™ — CENTRAL APPLICATION BOOTSTRAPPER (Run 8)
// Deterministic 29-step boot pipeline.
//
// BOOT ORDER:
//  1.  validate environment
//  2.  initialize runtime
//  3.  validate runtime contracts
//  4.  initialize storage
//  5.  validate schemas
//  6.  validate migrations
//  7.  initialize state layer
//  8.  initialize event system
//  9.  register event contracts
//  10. initialize hydration system
//  11. hydrate runtime state
//  12. initialize recovery engine
//  13. restore active sessions
//  14. register services
//  15. initialize agent registry
//  16. initialize lifecycle controller
//  17. initialize supervisor agent
//  18. register specialized agents
//  19. initialize companion engines
//  20. synchronize companion runtime
//  21. initialize media pipeline
//  22. initialize reconstruction foundation
//  23. initialize renderer
//  24. initialize scene manager
//  25. initialize visualization systems
//  26. initialize scheduler
//  27. emit runtime initialized
//  28. mount application
//  29. emit APP_READY
// ================================================================

import { BOOT_STAGES, RUNTIME_EVENTS }                           from '../utils/constants.js';
import { BootLogger }                                             from '../utils/logger.js';

// Core — Run 1
import { validateEnvironment, validateRuntimeContracts }         from './validation.js';
import {
  initializeRuntime,
  getRuntimeState    as getCoreRuntimeState,
  updateRuntimeState as updateCoreRuntimeState,
  setRuntimeError,
  markRuntimeReady,
  registerModule,
}                                                                 from './runtime.js';
import { initializeHydration, hydrateRuntime }                   from './hydration.js';
import { initializeRecovery }                                     from './recovery.js';
import { initializeScheduler }                                    from './scheduler.js';

// Storage — Run 2
import { initializeStorage, getStorage, validateMigrationState } from '../storage/storage.js';
import { getMigrationVersion }                                    from '../storage/migrations.js';
import { getAllSchemas, getAllStoreNames }                         from '../storage/schemas.js';

// State — Run 3
import { updateAppState, registerActiveModule }                   from '../state/appState.js';
import { updateRuntimeState, markBootComplete }                   from '../state/runtimeState.js';
import { getSessionState, createSession }                         from '../state/sessionState.js';

// Events — Run 4
import { initializeEventBus }                                     from '../events/eventBus.js';
import { registerAllContracts }                                   from '../events/eventRegistry.js';

// Services — Run 4
import { initializeDogRuntime }                                   from '../services/dogService.js';
import { initializeAIRuntime }                                    from '../services/aiService.js';
import { initializeMediaRuntime }                                 from '../services/mediaService.js';
import { initializeNotificationRuntime }                          from '../services/notificationService.js';
import { initializeReconstructionRuntime }                        from '../services/reconstructionService.js';

// Agents — Run 5
import { registerRuntimeAgent, getRegistryStatus }                from '../agents/registry.js';
import { initializeAgentLifecycle }                               from '../agents/lifecycle.js';
import { initializeSupervisor, registerAgent }                    from '../agents/supervisorAgent.js';
import { initializeMemoryAgent, MEMORY_AGENT_DESCRIPTOR, memoryTaskHandler }                   from '../agents/memoryAgent.js';
import { initializeEmotionAgent, EMOTION_AGENT_DESCRIPTOR, emotionTaskHandler }                from '../agents/emotionAgent.js';
import { initializeDogAgent, DOG_AGENT_DESCRIPTOR, dogTaskHandler }                            from '../agents/dogAgent.js';
import { initializeConversationAgent, CONVERSATION_AGENT_DESCRIPTOR, conversationTaskHandler } from '../agents/conversationAgent.js';
import { initializeRoutineAgent, ROUTINE_AGENT_DESCRIPTOR, routineTaskHandler }                from '../agents/routineAgent.js';
import { initializeRecoveryAgent, RECOVERY_AGENT_DESCRIPTOR, recoveryTaskHandler }             from '../agents/recoveryAgent.js';

// Companion Engines — Run 6
import { initializePersonalityProfile, getPersonalityEngineStatus } from '../dog/personalityEngine.js';
import { initializeEmotionState, getEmotionEngineStatus }           from '../dog/emotionEngine.js';
import { initializeMemoryState, getMemoryEngineStatus }             from '../dog/memoryEngine.js';
import { initializeBehaviorState, getBehaviorEngineStatus }         from '../dog/behaviorEngine.js';
import { initializeBondState, getBondingEngineStatus }              from '../dog/bondingEngine.js';
import { initializeRoutineState, getRoutineEngineStatus }           from '../dog/routineEngine.js';
import { getDogState }                                              from '../state/dogState.js';

// Media — Run 7
import { initializeUploadPipeline, getPipelineStatus }              from '../media/uploadPipeline.js';
import { getIdentityProfileEngineStatus }                           from '../media/identityProfile.js';

// 3D Engine — Run 8
import {
  initializeRenderer,
  getRendererConfig,
  PERFORMANCE_TIER,
}                                                                   from '../3d/renderer.js';
import {
  initializeScene,
  getSceneState,
  LIGHTING_PRESET,
  CAMERA_PRESET,
}                                                                   from '../3d/sceneManager.js';
import {
  initializeMorphTargets,
  getMorphEngineStatus,
}                                                                   from '../3d/morphTargets.js';
import {
  initializeAnimationMixer,
  getAnimationEngineStatus,
}                                                                   from '../3d/animationMixer.js';
import {
  initializeTextureSystem,
  getTextureSystemStatus,
}                                                                   from '../3d/textureSystem.js';
import {
  initializeEmotionAnimations,
  getEmotionAnimationEngineStatus,
}                                                                   from '../3d/emotionAnimations.js';

// ----------------------------------------------------------------
// EXTENDED BOOT STAGES
// ----------------------------------------------------------------

const BOOT = {
  ...BOOT_STAGES,
  INITIALIZING_STORAGE:              'INITIALIZING_STORAGE',
  VALIDATING_SCHEMAS:                'VALIDATING_SCHEMAS',
  RUNNING_MIGRATIONS:                'RUNNING_MIGRATIONS',
  INITIALIZING_STATE_LAYER:          'INITIALIZING_STATE_LAYER',
  INITIALIZING_EVENT_SYSTEM:         'INITIALIZING_EVENT_SYSTEM',
  REGISTERING_EVENT_CONTRACTS:       'REGISTERING_EVENT_CONTRACTS',
  HYDRATING_RUNTIME:                 'HYDRATING_RUNTIME',
  RESTORING_SESSIONS:                'RESTORING_SESSIONS',
  REGISTERING_SERVICES:              'REGISTERING_SERVICES',
  INITIALIZING_AGENT_REGISTRY:       'INITIALIZING_AGENT_REGISTRY',
  INITIALIZING_LIFECYCLE:            'INITIALIZING_LIFECYCLE',
  INITIALIZING_SUPERVISOR:           'INITIALIZING_SUPERVISOR',
  REGISTERING_AGENTS:                'REGISTERING_AGENTS',
  INITIALIZING_COMPANION_ENGINES:    'INITIALIZING_COMPANION_ENGINES',
  SYNCHRONIZING_COMPANION_RUNTIME:   'SYNCHRONIZING_COMPANION_RUNTIME',
  INITIALIZING_MEDIA_PIPELINE:       'INITIALIZING_MEDIA_PIPELINE',
  INITIALIZING_RECONSTRUCTION:       'INITIALIZING_RECONSTRUCTION',
  INITIALIZING_RENDERER:             'INITIALIZING_RENDERER',
  INITIALIZING_SCENE_MANAGER:        'INITIALIZING_SCENE_MANAGER',
  INITIALIZING_VISUALIZATION:        'INITIALIZING_VISUALIZATION',
};

// ----------------------------------------------------------------
// INTERNAL BOOT STATE
// ----------------------------------------------------------------

let _bootState = {
  stage:       BOOT.IDLE,
  startedAt:   null,
  completedAt: null,
  error:       null,
  timings:     {},
};

// ----------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------

function setStage(stage) {
  _bootState.stage = stage;
  _bootState.timings[stage] = Date.now();
  BootLogger.info(`Boot stage: ${stage}`);
  updateCoreRuntimeState({ bootStage: stage });
}

function emitRuntimeEvent(eventName, detail = {}) {
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
    BootLogger.info(`DOM event emitted: ${eventName}`);
  }
}

// ----------------------------------------------------------------
// BOOT PIPELINE
// ----------------------------------------------------------------

export async function initializeApp(onReady) {
  BootLogger.group('IMMORTAIL™ Boot Pipeline (Run 8 — 29 Steps)');
  _bootState.startedAt = Date.now();
  BootLogger.info(`Boot started at: ${new Date(_bootState.startedAt).toISOString()}`);

  try {
    // ── STEP 1 ────────────────────────────────────────────────────
    setStage(BOOT.VALIDATING_ENVIRONMENT);
    const envValidation = validateEnvironment();
    if (!envValidation.passed) {
      throw new Error(`Environment validation failed: ${envValidation.criticalFailed.join(', ')}`);
    }
    if (envValidation.warnings.length > 0) {
      BootLogger.warn(`Environment warnings: ${envValidation.warnings.join(', ')}`);
    }

    // ── STEP 2 ────────────────────────────────────────────────────
    setStage(BOOT.INITIALIZING_RUNTIME);
    await initializeRuntime();

    // ── STEP 3 ────────────────────────────────────────────────────
    setStage(BOOT.VALIDATING_RUNTIME_CONTRACTS);
    const runtimeSnapshot = getCoreRuntimeState();
    const contractValidation = validateRuntimeContracts(runtimeSnapshot);
    if (!contractValidation.passed) {
      throw new Error(`Runtime contracts failed: ${contractValidation.failed.join(', ')}`);
    }

    // ── STEP 4 ────────────────────────────────────────────────────
    setStage(BOOT.INITIALIZING_STORAGE);
    await initializeStorage();
    registerModule('storage', { version: getMigrationVersion() });

    // ── STEP 5 ────────────────────────────────────────────────────
    setStage(BOOT.VALIDATING_SCHEMAS);
    const storeNames = getAllStoreNames();
    if (storeNames.length === 0) throw new Error('No stores registered.');
    const schemas = getAllSchemas();
    for (const sn of storeNames) {
      const s = schemas[sn];
      if (!s.keyPath || !s.storeName || !s.validationShape) {
        throw new Error(`Schema invalid for store "${sn}".`);
      }
    }
    BootLogger.info(`Schema validation passed — ${storeNames.length} store(s).`);

    // ── STEP 6 ────────────────────────────────────────────────────
    setStage(BOOT.RUNNING_MIGRATIONS);
    const db = getStorage();
    const migrationState = validateMigrationState(db);
    if (!migrationState.valid) {
      throw new Error(`Migration state invalid. Missing: ${migrationState.missingStores.join(', ')}`);
    }
    BootLogger.info(`Migration state valid — v${getMigrationVersion()}.`);

    // ── STEP 7 ────────────────────────────────────────────────────
    setStage(BOOT.INITIALIZING_STATE_LAYER);
    updateAppState({
      initialized: true,
      timestamps:  { bootStartedAt: _bootState.startedAt },
      meta: {
        version:     runtimeSnapshot.version,
        build:       runtimeSnapshot.build,
        environment: runtimeSnapshot.environment?.platform || 'unknown',
      },
    });
    registerActiveModule('stateLayer', { initializedAt: Date.now() });

    // ── STEP 8 ────────────────────────────────────────────────────
    setStage(BOOT.INITIALIZING_EVENT_SYSTEM);
    initializeEventBus({ debugMode: runtimeSnapshot.mode === 'development' });
    registerModule('eventBus', { initializedAt: Date.now() });

    // ── STEP 9 ────────────────────────────────────────────────────
    setStage(BOOT.REGISTERING_EVENT_CONTRACTS);
    const contractCount = registerAllContracts();
    BootLogger.info(`${contractCount} event contracts registered.`);

    // ── STEP 10 ───────────────────────────────────────────────────
    setStage(BOOT.INITIALIZING_HYDRATION);
    await initializeHydration();

    // ── STEP 11 ───────────────────────────────────────────────────
    setStage(BOOT.HYDRATING_RUNTIME);
    await hydrateRuntime();

    // ── STEP 12 ───────────────────────────────────────────────────
    setStage(BOOT.INITIALIZING_RECOVERY);
    initializeRecovery();
    updateAppState({ flags: { recoveryReady: true } });

    // ── STEP 13 ───────────────────────────────────────────────────
    setStage(BOOT.RESTORING_SESSIONS);
    const sessionState = getSessionState();
    if (sessionState.status === 'none' || sessionState.status === 'failed') {
      createSession({ bootRestored: true });
      BootLogger.warn('[Boot] Fresh session created.');
    } else {
      BootLogger.info(`[Boot] Session: ${sessionState.sessionId} (${sessionState.status})`);
    }
    updateAppState({ flags: { sessionReady: true } });
    updateRuntimeState({ sessionRestored: true });

    // ── STEP 14 ───────────────────────────────────────────────────
    setStage(BOOT.REGISTERING_SERVICES);
    await initializeDogRuntime();
    registerActiveModule('dogService', { initializedAt: Date.now() });
    await initializeAIRuntime();
    registerActiveModule('aiService', { initializedAt: Date.now() });
    await initializeMediaRuntime();
    registerActiveModule('mediaService', { initializedAt: Date.now() });
    initializeNotificationRuntime();
    registerActiveModule('notificationService', { initializedAt: Date.now() });
    await initializeReconstructionRuntime();
    registerActiveModule('reconstructionService', { initializedAt: Date.now() });
    BootLogger.info('All services registered.');

    // ── STEP 15 ───────────────────────────────────────────────────
    setStage(BOOT.INITIALIZING_AGENT_REGISTRY);
    const registryStatus = getRegistryStatus();
    BootLogger.info(`Agent registry ready — ${registryStatus.total} pre-registered.`);
    registerActiveModule('agentRegistry', { initializedAt: Date.now() });

    // ── STEP 16 ───────────────────────────────────────────────────
    setStage(BOOT.INITIALIZING_LIFECYCLE);
    initializeAgentLifecycle();
    registerActiveModule('lifecycleController', { initializedAt: Date.now() });

    // ── STEP 17 ───────────────────────────────────────────────────
    setStage(BOOT.INITIALIZING_SUPERVISOR);
    await initializeSupervisor();
    registerActiveModule('supervisorAgent', { initializedAt: Date.now() });

    // ── STEP 18 ───────────────────────────────────────────────────
    setStage(BOOT.REGISTERING_AGENTS);
    await initializeMemoryAgent();
    await registerAgent(MEMORY_AGENT_DESCRIPTOR, memoryTaskHandler);
    registerActiveModule('memoryAgent', { initializedAt: Date.now() });
    await initializeEmotionAgent();
    await registerAgent(EMOTION_AGENT_DESCRIPTOR, emotionTaskHandler);
    registerActiveModule('emotionAgent', { initializedAt: Date.now() });
    await initializeDogAgent();
    await registerAgent(DOG_AGENT_DESCRIPTOR, dogTaskHandler);
    registerActiveModule('dogAgent', { initializedAt: Date.now() });
    await initializeConversationAgent();
    await registerAgent(CONVERSATION_AGENT_DESCRIPTOR, conversationTaskHandler);
    registerActiveModule('conversationAgent', { initializedAt: Date.now() });
    await initializeRoutineAgent();
    await registerAgent(ROUTINE_AGENT_DESCRIPTOR, routineTaskHandler);
    registerActiveModule('routineAgent', { initializedAt: Date.now() });
    await initializeRecoveryAgent();
    await registerAgent(RECOVERY_AGENT_DESCRIPTOR, recoveryTaskHandler);
    registerActiveModule('recoveryAgent', { initializedAt: Date.now() });
    BootLogger.info('All agents registered.');

    // ── STEP 19 ───────────────────────────────────────────────────
    setStage(BOOT.INITIALIZING_COMPANION_ENGINES);
    const dogState  = getDogState();
    const profileId = dogState.profileId;
    if (profileId) {
      initializePersonalityProfile(profileId);
      initializeEmotionState(profileId);
      initializeMemoryState(profileId);
      initializeBehaviorState(profileId);
      initializeBondState(profileId);
      initializeRoutineState(profileId);
      BootLogger.info(`[Boot] Companion engines initialized for profile: ${profileId}`);
    } else {
      BootLogger.info('[Boot] No dog profile — companion engines on standby.');
    }
    registerActiveModule('companionEngines', { initializedAt: Date.now(), profileId: profileId || null });

    // ── STEP 20 ───────────────────────────────────────────────────
    setStage(BOOT.SYNCHRONIZING_COMPANION_RUNTIME);
    updateAppState({
      activeModules: {
        companionRuntime: {
          synchronized:   true,
          profileId:      profileId || null,
          engineStatus: {
            personality: getPersonalityEngineStatus(),
            emotion:     getEmotionEngineStatus(),
            memory:      getMemoryEngineStatus(),
            behavior:    getBehaviorEngineStatus(),
            bonding:     getBondingEngineStatus(),
            routine:     getRoutineEngineStatus(),
          },
          synchronizedAt: Date.now(),
        },
      },
    });
    BootLogger.info('[Boot] Companion runtime synchronized.');

    // ── STEP 21 ───────────────────────────────────────────────────
    setStage(BOOT.INITIALIZING_MEDIA_PIPELINE);
    initializeUploadPipeline();
    registerActiveModule('uploadPipeline', { initializedAt: Date.now() });
    BootLogger.info('[Boot] Media pipeline initialized.');

    // ── STEP 22 ───────────────────────────────────────────────────
    setStage(BOOT.INITIALIZING_RECONSTRUCTION);
    const identityStatus = getIdentityProfileEngineStatus();
    registerActiveModule('identityProfileEngine', {
      initializedAt: Date.now(),
      totalProfiles: identityStatus.totalProfiles,
    });
    BootLogger.info('[Boot] Reconstruction foundation ready.');

    // ── STEP 23: Initialize Renderer ──────────────────────────────
    setStage(BOOT.INITIALIZING_RENDERER);
    const rendererConfig = initializeRenderer();
    registerActiveModule('renderer', {
      initializedAt:   Date.now(),
      performanceTier: rendererConfig.performanceTier,
    });
    BootLogger.info(`[Boot] Renderer initialized — tier: ${rendererConfig.performanceTier}`);

    // ── STEP 24: Initialize Scene Manager ─────────────────────────
    setStage(BOOT.INITIALIZING_SCENE_MANAGER);
    const sceneConfig = initializeScene({
      lightingPreset: LIGHTING_PRESET.NEUTRAL,
      cameraPreset:   CAMERA_PRESET.DEFAULT,
    });
    registerActiveModule('sceneManager', {
      initializedAt:  Date.now(),
      lighting:       sceneConfig.lightingPreset,
      camera:         sceneConfig.cameraPreset,
    });
    BootLogger.info('[Boot] Scene manager initialized.');

    // ── STEP 25: Initialize Visualization Systems ─────────────────
    setStage(BOOT.INITIALIZING_VISUALIZATION);
    const visProfileId = profileId || 'standby';

    initializeMorphTargets(visProfileId);
    registerActiveModule('morphTargets', { initializedAt: Date.now(), profileId: visProfileId });

    initializeAnimationMixer(visProfileId);
    registerActiveModule('animationMixer', { initializedAt: Date.now(), profileId: visProfileId });

    initializeTextureSystem();
    registerActiveModule('textureSystem', {
      initializedAt: Date.now(),
      status: getTextureSystemStatus(),
    });

    initializeEmotionAnimations(visProfileId);
    registerActiveModule('emotionAnimations', { initializedAt: Date.now(), profileId: visProfileId });

    BootLogger.info(
      `[Boot] Visualization systems initialized — ` +
      `morphTargets ✓, animationMixer ✓, textureSystem ✓, emotionAnimations ✓`
    );

    // ── STEP 26 ───────────────────────────────────────────────────
    setStage(BOOT.INITIALIZING_SCHEDULER);
    initializeScheduler();
    updateAppState({ flags: { schedulerReady: true } });

    // ── STEP 27 ───────────────────────────────────────────────────
    setStage(BOOT.EMITTING_RUNTIME_INITIALIZED);
    markRuntimeReady();
    markBootComplete();
    updateAppState({
      ready:  true,
      flags:  { storageReady: true },
      timestamps: { bootCompletedAt: Date.now() },
    });
    emitRuntimeEvent(RUNTIME_EVENTS.RUNTIME_INITIALIZED, {
      runtimeState: getCoreRuntimeState(),
    });

    // ── STEP 28 ───────────────────────────────────────────────────
    setStage(BOOT.MOUNTING_APPLICATION);
    BootLogger.info('Handing off to application mount...');
    if (typeof onReady === 'function') {
      await onReady();
    }

    // ── STEP 29 ───────────────────────────────────────────────────
    setStage(BOOT.APP_READY);
    _bootState.completedAt = Date.now();
    emitRuntimeEvent(RUNTIME_EVENTS.APP_READY, {
      duration: _bootState.completedAt - _bootState.startedAt,
    });
    BootLogger.info(`Boot COMPLETE — ${_bootState.completedAt - _bootState.startedAt}ms`);

  } catch (err) {
    _bootState.stage = BOOT.FATAL_ERROR;
    _bootState.error = { message: err.message, stack: err.stack };
    setRuntimeError(err);
    emitRuntimeEvent(RUNTIME_EVENTS.BOOT_FAILED, { error: err.message });
    BootLogger.error(`FATAL BOOT ERROR at [${_bootState.stage}]: ${err.message}`);
    BootLogger.error(err.stack || '(no stack)');
  } finally {
    BootLogger.groupEnd();
  }

  return _bootState;
}

// ----------------------------------------------------------------
// GET BOOT STATE
// ----------------------------------------------------------------

export function getBootState() {
  return { ..._bootState };
}
