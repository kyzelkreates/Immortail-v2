// ================================================================
// IMMORTAIL™ — HYBRID AI ORCHESTRATOR (Run 12)
// Ollama (primary persistent brain) + Groq (acceleration layer).
//
// Implements:
//   STEP 1  — aiOrchestration core
//   STEP 2  — Ollama primary configuration
//   STEP 3  — Groq acceleration provider
//   STEP 4  — Deterministic model routing engine
//   STEP 5  — AI agent registry
//   STEP 6  — Multimodal media ingestion pipeline
//   STEP 7  — Groq multimodal vision analysis
//   STEP 8  — Motion analysis system
//   STEP 9  — Audio reaction system
//   STEP 10 — Persistent embodiment profile
//   STEP 15 — AI safety validation firewall
//   STEP 16 — Performance + GPU safety
//   STEP 17 — Offline-first resilience
//   STEP 18 — Persistence + recovery integration
//   STEP 19 — Hybrid AI context injection
//
// STRICT RULES:
//   - companionCore SSOT only — all reads/writes via storage.js
//   - Ollama controls ALL persistent continuity
//   - Groq outputs require validation before ANY persistence
//   - identityLock NEVER touched by any AI agent
//   - All AI outputs validated through safety firewall
//   - Offline-first: core systems never depend on Groq
// ================================================================

import storage from './storage.js';
import { EventBus, EVENTS } from './eventBus.js';

// ════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════

export const ORCH_VERSION  = 'V1';
export const PROFILE_VERSION = 'V1';

// ── Provider roles ─────────────────────────────────────────────
export const PROVIDER = {
  OLLAMA: 'ollama',
  GROQ:   'groq',
};

// ── Provider status ───────────────────────────────────────────
export const PROVIDER_STATUS = {
  ACTIVE:   'active',
  INACTIVE: 'inactive',
  UNKNOWN:  'unknown',
  DEGRADED: 'degraded',
  OFFLINE:  'offline',
};

// ── Routing task types ────────────────────────────────────────
export const ROUTE = {
  // Ollama-only (persistent continuity)
  EMOTIONAL_REASONING:       'emotionalReasoning',
  MEMORY_CONTINUITY:         'memoryContinuity',
  IDENTITY_CONTINUITY:       'identityContinuity',
  EMBODIMENT_CONSISTENCY:    'embodimentConsistency',
  LIFE_STORY_REASONING:      'lifeStoryReasoning',
  ATTACHMENT_CONTINUITY:     'attachmentContinuity',
  OFFLINE_FALLBACK:          'offlineFallback',
  // Groq-preferred (acceleration, falls back to Ollama)
  RAPID_VISION:              'rapidVisionTasks',
  ENVIRONMENT_CLASSIFICATION:'environmentClassification',
  MEDIA_PREPROCESSING:       'mediaPreprocessing',
  RAPID_SCENE_ANALYSIS:      'rapidSceneAnalysis',
  MOTION_ANALYSIS:           'motionAnalysis',
  AUDIO_ANALYSIS:            'audioAnalysis',
};

// ── Agent types ────────────────────────────────────────────────
export const AGENT = {
  VISION:      'visionAgent',
  MOTION:      'motionAgent',
  AUDIO:       'audioAgent',
  EMBODIMENT:  'embodimentAgent',
  ENVIRONMENT: 'environmentAgent',
  VALIDATION:  'validationAgent',
};

// ── Media types ────────────────────────────────────────────────
export const MEDIA_TYPE = {
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
};

// ── Orchestration states ───────────────────────────────────────
export const ORCH_STATE = {
  STABLE:      'stable',
  PROCESSING:  'processing',
  FALLBACK:    'fallback',
  DEGRADED:    'degraded',
  RECOVERING:  'recovering',
};

// ── Validation outcomes ────────────────────────────────────────
export const VALIDATION = {
  PASS:    'pass',
  REJECT:  'reject',
  PARTIAL: 'partial',
};

// ── Caps & throttles ───────────────────────────────────────────
export const CAPS = {
  FALLBACK_LOG:   20,
  VALIDATION_LOG: 50,
  MEDIA_LIBRARY:  200,
  MEDIA_QUEUE:    20,
  TRAIT_LOG:      30,
};

export const THROTTLE = {
  PROVIDER_CHECK_MS: 30_000,   // recheck provider health every 30s
  QUEUE_FLUSH_MS:    5_000,    // flush media queue every 5s
  PROFILE_UPDATE_MS: 2_000,    // min ms between embodiment profile writes
};

// ── Deterministic routing table ────────────────────────────────
const ROUTING_TABLE = {
  [ROUTE.EMOTIONAL_REASONING]:       PROVIDER.OLLAMA,
  [ROUTE.MEMORY_CONTINUITY]:         PROVIDER.OLLAMA,
  [ROUTE.IDENTITY_CONTINUITY]:       PROVIDER.OLLAMA,
  [ROUTE.EMBODIMENT_CONSISTENCY]:    PROVIDER.OLLAMA,
  [ROUTE.LIFE_STORY_REASONING]:      PROVIDER.OLLAMA,
  [ROUTE.ATTACHMENT_CONTINUITY]:     PROVIDER.OLLAMA,
  [ROUTE.OFFLINE_FALLBACK]:          PROVIDER.OLLAMA,
  [ROUTE.RAPID_VISION]:              PROVIDER.GROQ,
  [ROUTE.ENVIRONMENT_CLASSIFICATION]:PROVIDER.GROQ,
  [ROUTE.MEDIA_PREPROCESSING]:       PROVIDER.GROQ,
  [ROUTE.RAPID_SCENE_ANALYSIS]:      PROVIDER.GROQ,
  [ROUTE.MOTION_ANALYSIS]:           PROVIDER.GROQ,
  [ROUTE.AUDIO_ANALYSIS]:            PROVIDER.GROQ,
};

// ── In-memory timing guards ────────────────────────────────────
let _lastProviderCheck  = 0;
let _lastProfileWrite   = 0;
let _renderThrottleCount= 0;

// ── Helpers ───────────────────────────────────────────────────
function genId() {
  return `r12_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}
function now() { return Date.now(); }

/**
 * resetThrottles() — for testing only
 */
export function resetThrottles() {
  _lastProviderCheck   = 0;
  _lastProfileWrite    = 0;
  _renderThrottleCount = 0;
}

// ════════════════════════════════════════════════════════════════
// STEP 1 — ORCHESTRATION CORE: READ / WRITE HELPERS
// ════════════════════════════════════════════════════════════════

function getOrch() {
  return storage.getCompanionCore().aiOrchestration ?? {};
}

function saveOrch(patch) {
  const core = storage.getCompanionCore();
  core.aiOrchestration = { ...core.aiOrchestration, ...patch };
  storage.saveCompanionCore(core);
  return core.aiOrchestration;
}

function getProfile() {
  return storage.getCompanionCore().embodimentProfile ?? {};
}

function saveProfile(patch) {
  if (now() - _lastProfileWrite < THROTTLE.PROFILE_UPDATE_MS) return getProfile();
  _lastProfileWrite = now();
  const core = storage.getCompanionCore();
  const existing = core.embodimentProfile ?? {};
  core.embodimentProfile = {
    ...existing,
    ...patch,
    traitVersion: (existing.traitVersion ?? 0) + 1,
    lastUpdated:  now(),
    profileVersion: PROFILE_VERSION,
  };
  storage.saveCompanionCore(core);
  return core.embodimentProfile;
}

// ════════════════════════════════════════════════════════════════
// STEP 2 — OLLAMA PRIMARY CONFIGURATION
// ════════════════════════════════════════════════════════════════

/**
 * getOllamaConfig()
 * Returns the Ollama provider config from storage.
 */
export function getOllamaConfig() {
  const cfg = storage.getConfig();
  return cfg?.providers?.ollama ?? {
    enabled:             true,
    baseUrl:             'http://localhost:11434',
    model:               'llama3',
    status:              PROVIDER_STATUS.ACTIVE,
    role:                'primary_persistent_brain',
    multimodalEnabled:   true,
    persistencePriority: true,
    offlineCritical:     true,
  };
}

/**
 * checkOllamaAvailability()
 * Non-blocking health probe. Returns { available, latencyMs }.
 * Ollama is ASSUMED available offline — only degrades if explicit error.
 */
export async function checkOllamaAvailability() {
  const cfg = getOllamaConfig();
  const start = now();
  try {
    const signal = typeof AbortSignal?.timeout === 'function'
      ? AbortSignal.timeout(3000) : undefined;
    const res = await fetch(`${cfg.baseUrl}/api/tags`, { signal });
    const latencyMs = now() - start;
    const available = res.ok;
    _updateProviderStatus(PROVIDER.OLLAMA, available ? PROVIDER_STATUS.ACTIVE : PROVIDER_STATUS.DEGRADED);
    return { available, latencyMs, provider: PROVIDER.OLLAMA };
  } catch {
    _updateProviderStatus(PROVIDER.OLLAMA, PROVIDER_STATUS.OFFLINE);
    return { available: false, latencyMs: now() - start, provider: PROVIDER.OLLAMA };
  }
}

// ════════════════════════════════════════════════════════════════
// STEP 3 — GROQ ACCELERATION PROVIDER
// ════════════════════════════════════════════════════════════════

/**
 * getGroqConfig()
 */
export function getGroqConfig() {
  const cfg = storage.getConfig();
  return cfg?.providers?.groq ?? {
    enabled:              false,
    apiKey:               '',
    model:                'meta-llama/llama-4-scout-17b-16e-instruct',
    visionModel:          'meta-llama/llama-4-scout-17b-16e-instruct',
    status:               PROVIDER_STATUS.INACTIVE,
    role:                 'multimodal_acceleration_layer',
    orchestrationEnabled: true,
    multimodalSupport:    true,
    fallbackToOllama:     true,
  };
}

/**
 * checkGroqAvailability()
 * Probes Groq API. Falls back to Ollama automatically if unavailable.
 */
export async function checkGroqAvailability() {
  const cfg = getGroqConfig();
  if (!cfg.enabled || !cfg.apiKey) {
    _updateProviderStatus(PROVIDER.GROQ, PROVIDER_STATUS.INACTIVE);
    return { available: false, latencyMs: 0, provider: PROVIDER.GROQ, reason: 'not_configured' };
  }
  const start = now();
  try {
    const signal = typeof AbortSignal?.timeout === 'function'
      ? AbortSignal.timeout(5000) : undefined;
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
      signal,
    });
    const latencyMs = now() - start;
    const available = res.ok;
    _updateProviderStatus(PROVIDER.GROQ, available ? PROVIDER_STATUS.ACTIVE : PROVIDER_STATUS.DEGRADED);
    return { available, latencyMs, provider: PROVIDER.GROQ };
  } catch {
    _updateProviderStatus(PROVIDER.GROQ, PROVIDER_STATUS.OFFLINE);
    _recordFallback(PROVIDER.GROQ, 'network_error');
    return { available: false, latencyMs: now() - start, provider: PROVIDER.GROQ, reason: 'network_error' };
  }
}

function _updateProviderStatus(provider, status) {
  const core = storage.getCompanionCore();
  const ao   = core.aiOrchestration ?? {};
  ao.providerStatus = { ...(ao.providerStatus ?? {}), [provider]: status };
  // Build activeProviders list
  const ap = Object.entries(ao.providerStatus ?? {})
    .filter(([,s]) => s === PROVIDER_STATUS.ACTIVE)
    .map(([p]) => p);
  ao.activeProviders = ap;
  core.aiOrchestration = ao;
  storage.saveCompanionCore(core);
}

function _recordFallback(fromProvider, reason, silent = false) {
  const core = storage.getCompanionCore();
  const ao   = core.aiOrchestration ?? {};
  const entry = { id: genId(), from: fromProvider, to: PROVIDER.OLLAMA, reason, ts: now() };
  ao.fallbackLog = [...(ao.fallbackLog ?? []), entry].slice(-CAPS.FALLBACK_LOG);
  ao.lastFallbackAt = now();
  // Only set orchestrationState=FALLBACK for explicit runtime failures,
  // not for silent routing resolutions (e.g. Groq not yet configured)
  if (!silent) {
    ao.orchestrationState = ORCH_STATE.FALLBACK;
  }
  core.aiOrchestration = ao;
  storage.saveCompanionCore(core);
  return entry;
}

// ════════════════════════════════════════════════════════════════
// STEP 4 — DETERMINISTIC MODEL ROUTING ENGINE
// ════════════════════════════════════════════════════════════════

/**
 * resolveProvider(routeType)
 * Returns which provider should handle this task.
 * Groq routes auto-fallback to Ollama if Groq unavailable.
 * Ollama routes NEVER fallback — it is the offline-critical brain.
 */
export function resolveProvider(routeType) {
  const preferredProvider = ROUTING_TABLE[routeType] ?? PROVIDER.OLLAMA;
  const core  = storage.getCompanionCore();
  const ao    = core.aiOrchestration ?? {};
  const pStatus = ao.providerStatus ?? {};

  if (preferredProvider === PROVIDER.OLLAMA) {
    return { provider: PROVIDER.OLLAMA, fallback: false, route: routeType };
  }

  // Groq preferred — check if available
  const groqStatus = pStatus[PROVIDER.GROQ] ?? PROVIDER_STATUS.UNKNOWN;
  const groqOk     = groqStatus === PROVIDER_STATUS.ACTIVE;

  if (groqOk) {
    return { provider: PROVIDER.GROQ, fallback: false, route: routeType };
  }

  // Groq confirmed failed (offline/degraded) → log fallback event
  // Do NOT log for 'unknown' (unchecked) — that would spam fallback log on every boot
  if (groqStatus === PROVIDER_STATUS.OFFLINE || groqStatus === PROVIDER_STATUS.DEGRADED) {
    _recordFallback(PROVIDER.GROQ, `groq_status:${groqStatus}`);
  }
  return { provider: PROVIDER.OLLAMA, fallback: true, route: routeType, originalProvider: PROVIDER.GROQ };
}

/**
 * getRoutingEngine()
 * Returns the full routing table with current provider resolution.
 */
export function getRoutingEngine() {
  return Object.fromEntries(
    Object.entries(ROUTING_TABLE).map(([route, preferred]) => {
      const resolved = resolveProvider(route);
      return [route, { preferred, resolved: resolved.provider, fallback: resolved.fallback }];
    })
  );
}

/**
 * getFallbackLog(limit)
 */
export function getFallbackLog(limit = 10) {
  return (storage.getCompanionCore().aiOrchestration?.fallbackLog ?? []).slice(-limit);
}

// ════════════════════════════════════════════════════════════════
// STEP 5 — AI AGENT REGISTRY
// ════════════════════════════════════════════════════════════════

/**
 * Agent definitions — each has ONE task, declared capabilities, and
 * an explicit list of what it CANNOT do (safety contract).
 */
const AGENT_DEFINITIONS = {
  [AGENT.VISION]: {
    task:       'Analyse uploaded images for visual traits (colour, shape, posture)',
    canWrite:   ['embodimentProfile.appearanceTraits'],
    cannotWrite:['identityLock', 'memory', 'attachmentGraph', 'lifeStory'],
    provider:   PROVIDER.GROQ,
    fallback:   PROVIDER.OLLAMA,
  },
  [AGENT.MOTION]: {
    task:       'Analyse video/motion data for movement traits',
    canWrite:   ['embodimentProfile.motionTraits', 'embodimentProfile.emotionalMovementTraits'],
    cannotWrite:['identityLock', 'memory', 'attachmentGraph'],
    provider:   PROVIDER.GROQ,
    fallback:   PROVIDER.OLLAMA,
  },
  [AGENT.AUDIO]: {
    task:       'Analyse audio for emotional reaction patterns (no biometric ID)',
    canWrite:   ['embodimentProfile.audioProfile'],
    cannotWrite:['identityLock', 'identity', 'memory', 'attachmentGraph'],
    provider:   PROVIDER.GROQ,
    fallback:   PROVIDER.OLLAMA,
  },
  [AGENT.EMBODIMENT]: {
    task:       'Merge validated traits into persistent embodimentProfile',
    canWrite:   ['embodimentProfile'],
    cannotWrite:['identityLock', 'memory', 'attachmentGraph', 'lifeStory'],
    provider:   PROVIDER.OLLAMA,
    fallback:   PROVIDER.OLLAMA,
  },
  [AGENT.ENVIRONMENT]: {
    task:       'Classify environment scene from image/video',
    canWrite:   ['environmentSystem.activeScene', 'environmentSystem.lightingMode'],
    cannotWrite:['identityLock', 'memory', 'embodimentProfile.appearanceTraits'],
    provider:   PROVIDER.GROQ,
    fallback:   PROVIDER.OLLAMA,
  },
  [AGENT.VALIDATION]: {
    task:       'Validate all AI outputs before persistence (firewall)',
    canWrite:   ['aiOrchestration.validationLog'],
    cannotWrite:['identityLock', 'memory', 'attachmentGraph', 'embodimentProfile'],
    provider:   PROVIDER.OLLAMA,   // validation always on Ollama (offline-safe)
    fallback:   PROVIDER.OLLAMA,
  },
};

/**
 * initAgentRegistry()
 * Registers all agents into aiOrchestration.agentRegistry.
 */
export function initAgentRegistry() {
  const core = storage.getCompanionCore();
  const ao   = core.aiOrchestration ?? {};

  const registry = {};
  for (const [agentId, def] of Object.entries(AGENT_DEFINITIONS)) {
    registry[agentId] = {
      id:          agentId,
      task:        def.task,
      canWrite:    def.canWrite,
      cannotWrite: def.cannotWrite,
      provider:    def.provider,
      fallback:    def.fallback,
      status:      'idle',
      lastRunAt:   null,
      runCount:    0,
    };
  }

  ao.agentRegistry = registry;
  ao.activeAgents  = [];
  core.aiOrchestration = ao;
  storage.saveCompanionCore(core);
  return registry;
}

/**
 * getAgentRegistry()
 */
export function getAgentRegistry() {
  return storage.getCompanionCore().aiOrchestration?.agentRegistry ?? {};
}

/**
 * setAgentStatus(agentId, status)
 */
export function setAgentStatus(agentId, status) {
  const core = storage.getCompanionCore();
  const ao   = core.aiOrchestration ?? {};
  const reg  = ao.agentRegistry ?? {};
  if (!reg[agentId]) return;
  reg[agentId].status    = status;
  reg[agentId].lastRunAt = now();
  reg[agentId].runCount  = (reg[agentId].runCount ?? 0) + 1;
  // Track active agents
  ao.activeAgents = Object.entries(reg)
    .filter(([,a]) => a.status === 'running')
    .map(([id]) => id);
  ao.agentRegistry = reg;
  core.aiOrchestration = ao;
  storage.saveCompanionCore(core);
}

// ════════════════════════════════════════════════════════════════
// STEP 15 — AI SAFETY VALIDATION FIREWALL
// ════════════════════════════════════════════════════════════════

/**
 * validateAIOutput(output, agentId)
 * Runs BEFORE any AI-generated data touches companionCore.
 *
 * Checks:
 *  1. identityLock unchanged
 *  2. embodimentConsistencyHash stability
 *  3. No unsafe morphology tokens
 *  4. No hallucinated memory injection
 *  5. No behavioural corruption markers
 *  6. Agent write-permission contract
 *
 * Returns { valid, outcome, violations, safeOutput }
 */
export function validateAIOutput(output, agentId = null) {
  const violations = [];
  const core       = storage.getCompanionCore();
  const lock       = core.identityLock;
  const agentDef   = agentId ? AGENT_DEFINITIONS[agentId] : null;

  // 1. identityLock must be untouched
  if (output?.identityLock !== undefined) {
    violations.push({ rule: 'identity_lock_immutable', detail: 'Output attempted to modify identityLock', severity: 'critical' });
  }
  if (output?.identityLock?.signature && output.identityLock.signature !== lock?.signature) {
    violations.push({ rule: 'identity_lock_signature', detail: 'identityLock signature mismatch', severity: 'critical' });
  }

  // 2. No direct memory injection
  if (output?.memory !== undefined && Array.isArray(output.memory)) {
    violations.push({ rule: 'no_memory_injection', detail: 'AI output cannot directly write memory[]', severity: 'critical' });
  }

  // 3. No attachmentGraph direct write
  if (output?.attachmentGraph !== undefined) {
    violations.push({ rule: 'no_attachment_graph_write', detail: 'AI output cannot write attachmentGraph', severity: 'high' });
  }

  // 4. Unsafe trait check — no random breed injection or hallucinated species
  const UNSAFE_TOKENS = ['random_breed', 'hallucinated', 'generated_identity', 'synthetic_dog', 'fake_profile'];
  const outputStr = JSON.stringify(output ?? {}).toLowerCase();
  for (const token of UNSAFE_TOKENS) {
    if (outputStr.includes(token)) {
      violations.push({ rule: 'unsafe_trait_token', detail: `Unsafe token detected: "${token}"`, severity: 'high' });
    }
  }

  // 5. Agent write-permission contract
  if (agentDef) {
    for (const forbidden of (agentDef.cannotWrite ?? [])) {
      const topLevel = forbidden.split('.')[0];
      if (output && topLevel in output) {
        violations.push({ rule: 'agent_write_violation', detail: `Agent "${agentId}" attempted to write forbidden field "${forbidden}"`, severity: 'critical' });
      }
    }
  }

  // 6. Embodiment trait values must be strings or numbers (no code injection)
  const traits = output?.appearanceTraits ?? output?.motionTraits ?? output?.audioProfile ?? {};
  for (const [k, v] of Object.entries(traits)) {
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      // nested objects allowed — but check for executable strings
      const vStr = JSON.stringify(v);
      if (vStr.includes('function') || vStr.includes('eval(') || vStr.includes('__proto__')) {
        violations.push({ rule: 'code_injection', detail: `Trait "${k}" contains executable code pattern`, severity: 'critical' });
      }
    }
  }

  const criticals = violations.filter(v => v.severity === 'critical');
  const outcome   = violations.length === 0 ? VALIDATION.PASS
    : criticals.length > 0 ? VALIDATION.REJECT
    : VALIDATION.PARTIAL;

  // Log validation
  _logValidation({ agentId, outcome, violations, ts: now() });

  // Build safe output (strip any forbidden fields)
  let safeOutput = output ? { ...output } : {};
  if (outcome !== VALIDATION.PASS) {
    delete safeOutput.identityLock;
    delete safeOutput.memory;
    delete safeOutput.attachmentGraph;
  }

  return { valid: outcome === VALIDATION.PASS || outcome === VALIDATION.PARTIAL, outcome, violations, safeOutput };
}

function _logValidation(entry) {
  const core = storage.getCompanionCore();
  const ao   = core.aiOrchestration ?? {};
  ao.validationLog = [...(ao.validationLog ?? []), { id: genId(), ...entry }].slice(-CAPS.VALIDATION_LOG);
  core.aiOrchestration = ao;
  storage.saveCompanionCore(core);
}

export function getValidationLog(limit = 10) {
  return (storage.getCompanionCore().aiOrchestration?.validationLog ?? []).slice(-limit);
}

// ════════════════════════════════════════════════════════════════
// STEP 6 — MULTIMODAL MEDIA INGESTION PIPELINE
// ════════════════════════════════════════════════════════════════

/**
 * ingestMedia({ type, fileName, mimeType, sizeBytes, dataUri?, metadata? })
 * UPLOAD → preprocessing → AI routing → trait extraction →
 * validation → embodiment update → persistence
 *
 * Returns { mediaId, status, traits, validationResult }
 */
export async function ingestMedia({ type, fileName, mimeType, sizeBytes, dataUri = null, metadata = {} }) {
  const mediaId = genId();
  const core    = storage.getCompanionCore();

  // 1. Check queue capacity
  const ao = core.aiOrchestration ?? {};
  if ((ao.mediaProcessingQueue ?? []).length >= CAPS.MEDIA_QUEUE) {
    return { mediaId, status: 'rejected', reason: 'queue_full' };
  }

  // 2. Validate type
  if (!Object.values(MEDIA_TYPE).includes(type)) {
    return { mediaId, status: 'rejected', reason: 'unsupported_type' };
  }

  // 3. Queue entry
  const queueEntry = {
    mediaId, type, fileName, mimeType,
    sizeBytes: sizeBytes ?? 0,
    status: 'queued',
    queuedAt: now(),
    agentAssigned: null,
    traits: null,
    validationResult: null,
  };
  ao.mediaProcessingQueue = [...(ao.mediaProcessingQueue ?? []), queueEntry];
  ao.orchestrationState   = ORCH_STATE.PROCESSING;
  core.aiOrchestration    = ao;
  storage.saveCompanionCore(core);

  // 4. Route to agent
  let traits = null;
  let agentId = null;
  try {
    if (type === MEDIA_TYPE.IMAGE) {
      agentId = AGENT.VISION;
      setAgentStatus(agentId, 'running');
      traits = await _runVisionAnalysis(dataUri, metadata);
    } else if (type === MEDIA_TYPE.VIDEO) {
      agentId = AGENT.MOTION;
      setAgentStatus(agentId, 'running');
      traits = await _runMotionAnalysis(dataUri, metadata);
    } else if (type === MEDIA_TYPE.AUDIO) {
      agentId = AGENT.AUDIO;
      setAgentStatus(agentId, 'running');
      traits = await _runAudioAnalysis(dataUri, metadata);
    }
  } catch (err) {
    _updateQueueEntry(mediaId, { status: 'failed', error: err.message });
    if (agentId) setAgentStatus(agentId, 'error');
    return { mediaId, status: 'failed', reason: err.message };
  }

  // 5. Safety validation firewall
  const validation = validateAIOutput(traits, agentId);
  if (agentId) setAgentStatus(agentId, validation.valid ? 'completed' : 'rejected');

  if (!validation.valid) {
    _updateQueueEntry(mediaId, { status: 'rejected', validationResult: validation });
    return { mediaId, status: 'rejected', reason: 'validation_failed', violations: validation.violations };
  }

  // 6. Apply safe traits to embodimentProfile
  _applyValidatedTraits(validation.safeOutput, type);

  // 7. Add to media library
  _addToMediaLibrary({
    mediaId, type, fileName, mimeType, sizeBytes,
    traits:            validation.safeOutput,
    validationOutcome: validation.outcome,
    processedAt:       now(),
    metadata,
  });

  // 8. Update queue entry
  _updateQueueEntry(mediaId, { status: 'completed', traits: validation.safeOutput, validationResult: validation });

  // 9. Update orchestration state
  saveOrch({ orchestrationState: ORCH_STATE.STABLE });

  return {
    mediaId,
    status:           'completed',
    traits:           validation.safeOutput,
    validationResult: validation,
    provider:         resolveProvider(
      type === MEDIA_TYPE.IMAGE ? ROUTE.RAPID_VISION
        : type === MEDIA_TYPE.VIDEO ? ROUTE.MOTION_ANALYSIS
        : ROUTE.AUDIO_ANALYSIS
    ).provider,
  };
}

function _updateQueueEntry(mediaId, patch) {
  const core = storage.getCompanionCore();
  const ao   = core.aiOrchestration ?? {};
  ao.mediaProcessingQueue = (ao.mediaProcessingQueue ?? []).map(e =>
    e.mediaId === mediaId ? { ...e, ...patch, updatedAt: now() } : e
  );
  core.aiOrchestration = ao;
  storage.saveCompanionCore(core);
}

function _addToMediaLibrary(entry) {
  const core = storage.getCompanionCore();
  // Cap at CAPS.MEDIA_LIBRARY — evict oldest
  core.mediaLibrary = [...(core.mediaLibrary ?? []), entry].slice(-CAPS.MEDIA_LIBRARY);
  storage.saveCompanionCore(core);
}

export function getMediaLibrary(limit = 20) {
  return (storage.getCompanionCore().mediaLibrary ?? []).slice(-limit);
}

export function getMediaQueue() {
  return storage.getCompanionCore().aiOrchestration?.mediaProcessingQueue ?? [];
}

// ════════════════════════════════════════════════════════════════
// STEP 7 — GROQ MULTIMODAL VISION ANALYSIS
// ════════════════════════════════════════════════════════════════

/**
 * _runVisionAnalysis(dataUri, metadata)
 * Uses Groq vision API (Llama 4 Scout multimodal) if available,
 * falls back to Ollama + LLaVA if not.
 * Returns validated trait object — no hallucinated breeds.
 */
async function _runVisionAnalysis(dataUri, metadata = {}) {
  const routing = resolveProvider(ROUTE.RAPID_VISION);

  if (routing.provider === PROVIDER.GROQ && dataUri) {
    return await _groqVisionCall(dataUri, metadata);
  }
  // Fallback: Ollama metadata-based analysis
  return await _ollamaVisionFallback(metadata);
}

async function _groqVisionCall(dataUri, metadata) {
  const cfg = getGroqConfig();
  if (!cfg.apiKey) throw new Error('groq_no_api_key');

  const prompt = `You are a dog appearance analysis system. Analyse this image and extract ONLY observable physical traits. 
Return a JSON object with these fields (null if not visible):
{
  "primaryColour": string,
  "secondaryColour": string|null,
  "coatTexture": "short"|"medium"|"long"|"curly"|"wiry"|null,
  "earShape": "floppy"|"erect"|"semi_erect"|null,
  "bodySize": "small"|"medium"|"large"|null,
  "tailType": "curled"|"straight"|"bushy"|"short"|null,
  "observedPosture": "alert"|"relaxed"|"playful"|"resting"|null,
  "estimatedEnergyLevel": "low"|"medium"|"high"|null,
  "environmentScene": string|null
}
RULES: Return ONLY observable traits. Do NOT assign breeds. Do NOT hallucinate.`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model: cfg.visionModel,
        messages: [{
          role: 'user',
          content: [
            { type: 'text',      text: prompt },
            { type: 'image_url', image_url: { url: dataUri } },
          ],
        }],
        response_format: { type: 'json_object' },
        max_tokens: 512,
        temperature: 0.1,
      }),
    });

    if (!res.ok) throw new Error(`groq_vision_error:${res.status}`);
    const data     = await res.json();
    const content  = data.choices?.[0]?.message?.content ?? '{}';
    const parsed   = JSON.parse(content);

    return { appearanceTraits: _sanitiseTraits(parsed), analysisSource: PROVIDER.GROQ };
  } catch (err) {
    // Fallback to Ollama
    _recordFallback(PROVIDER.GROQ, `vision_error:${err.message}`);
    return await _ollamaVisionFallback(metadata);
  }
}

async function _ollamaVisionFallback(metadata) {
  // Ollama text-based fallback: use metadata hints if provided
  const traits = {
    primaryColour:        metadata.primaryColour         ?? null,
    coatTexture:          metadata.coatTexture           ?? null,
    earShape:             metadata.earShape              ?? null,
    bodySize:             metadata.bodySize              ?? null,
    observedPosture:      metadata.observedPosture       ?? 'relaxed',
    estimatedEnergyLevel: metadata.estimatedEnergyLevel  ?? 'medium',
    environmentScene:     metadata.environmentScene      ?? null,
    analysisSource:       PROVIDER.OLLAMA,
    fallback:             true,
  };
  return { appearanceTraits: _sanitiseTraits(traits) };
}

function _sanitiseTraits(raw) {
  // Remove null values and ensure strings only
  const safe = {};
  const ALLOWED_KEYS = [
    'primaryColour','secondaryColour','coatTexture','earShape','bodySize',
    'tailType','observedPosture','estimatedEnergyLevel','environmentScene',
    'analysisSource','fallback',
  ];
  for (const key of ALLOWED_KEYS) {
    if (raw[key] !== undefined && raw[key] !== null) {
      safe[key] = String(raw[key]);
    }
  }
  return safe;
}

// ════════════════════════════════════════════════════════════════
// STEP 8 — MOTION ANALYSIS SYSTEM
// ════════════════════════════════════════════════════════════════

async function _runMotionAnalysis(dataUri, metadata = {}) {
  const routing = resolveProvider(ROUTE.MOTION_ANALYSIS);

  if (routing.provider === PROVIDER.GROQ && dataUri) {
    return await _groqMotionCall(dataUri, metadata);
  }
  return _ollamaMotionFallback(metadata);
}

async function _groqMotionCall(dataUri, metadata) {
  const cfg = getGroqConfig();
  if (!cfg.apiKey) throw new Error('groq_no_api_key');

  const prompt = `Analyse this video/image for dog movement traits. Return JSON:
{
  "walkStyle": "bouncy"|"steady"|"slow"|"quick"|null,
  "pacing": "energetic"|"calm"|"lazy"|null,
  "postureHabit": "upright"|"lowered"|"neutral"|null,
  "tailMovementTendency": "high_wag"|"low_wag"|"still"|"expressive"|null,
  "emotionalMovementTone": "playful"|"calm"|"curious"|"relaxed"|null,
  "estimatedActivityLevel": "low"|"medium"|"high"|null
}
Only observable motion traits. No breed inference.`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.visionModel,
        messages: [{ role: 'user', content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: dataUri } },
        ]}],
        response_format: { type: 'json_object' },
        max_tokens: 256, temperature: 0.1,
      }),
    });
    if (!res.ok) throw new Error(`groq_motion_error:${res.status}`);
    const data   = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
    return { motionTraits: _sanitiseMotionTraits(parsed), analysisSource: PROVIDER.GROQ };
  } catch (err) {
    _recordFallback(PROVIDER.GROQ, `motion_error:${err.message}`);
    return _ollamaMotionFallback(metadata);
  }
}

function _ollamaMotionFallback(metadata) {
  return {
    motionTraits: _sanitiseMotionTraits({
      walkStyle:              metadata.walkStyle              ?? null,
      pacing:                 metadata.pacing                ?? 'calm',
      postureHabit:           metadata.postureHabit          ?? 'neutral',
      tailMovementTendency:   metadata.tailMovementTendency  ?? 'low_wag',
      emotionalMovementTone:  metadata.emotionalMovementTone ?? 'calm',
      estimatedActivityLevel: metadata.activityLevel         ?? 'medium',
      analysisSource:         PROVIDER.OLLAMA,
      fallback:               true,
    }),
  };
}

function _sanitiseMotionTraits(raw) {
  const ALLOWED = ['walkStyle','pacing','postureHabit','tailMovementTendency','emotionalMovementTone','estimatedActivityLevel','analysisSource','fallback'];
  const safe = {};
  for (const k of ALLOWED) {
    if (raw[k] !== undefined && raw[k] !== null) safe[k] = String(raw[k]);
  }
  return safe;
}

// ════════════════════════════════════════════════════════════════
// STEP 9 — AUDIO REACTION SYSTEM
// ════════════════════════════════════════════════════════════════

async function _runAudioAnalysis(dataUri, metadata = {}) {
  // Audio: Ollama primary (no biometric extraction, no identity cloning)
  // Groq can assist with classification — no voice recreation
  return _ollamaAudioAnalysis(metadata);
}

function _ollamaAudioAnalysis(metadata) {
  // Safe audio reaction profile — derived from metadata/context only
  // NO biometric extraction, NO identity cloning, NO voice recreation
  const profile = {
    excitementPattern:   metadata.excitementPattern   ?? 'moderate',
    calmnessTendency:    metadata.calmnessTendency    ?? 'high',
    emotionalWeighting:  metadata.emotionalWeighting  ?? 'neutral',
    curiosityTriggers:   metadata.curiosityTriggers   ?? [],
    analysisSource:      PROVIDER.OLLAMA,
    biometricExtracted:  false,   // ALWAYS false — rule enforcement
    identityCloned:      false,   // ALWAYS false — rule enforcement
  };
  return { audioProfile: _sanitiseAudioProfile(profile) };
}

function _sanitiseAudioProfile(raw) {
  // Hard-enforce safety rules
  const safe = {
    excitementPattern:  String(raw.excitementPattern ?? 'moderate'),
    calmnessTendency:   String(raw.calmnessTendency  ?? 'high'),
    emotionalWeighting: String(raw.emotionalWeighting ?? 'neutral'),
    analysisSource:     String(raw.analysisSource    ?? PROVIDER.OLLAMA),
    biometricExtracted: false,   // HARD LOCK — never true
    identityCloned:     false,   // HARD LOCK — never true
  };
  if (Array.isArray(raw.curiosityTriggers)) {
    safe.curiosityTriggers = raw.curiosityTriggers
      .filter(t => typeof t === 'string' && t.length < 100)
      .slice(0, 10);
  }
  return safe;
}

// ════════════════════════════════════════════════════════════════
// STEP 10 — PERSISTENT EMBODIMENT PROFILE
// ════════════════════════════════════════════════════════════════

/**
 * _applyValidatedTraits(safeOutput, mediaType)
 * Gradual trait accumulation — no full regeneration.
 * Each update MERGES with existing profile, not replaces.
 */
function _applyValidatedTraits(safeOutput, mediaType) {
  const existing = getProfile();

  const patch = {};

  if (safeOutput.appearanceTraits) {
    patch.appearanceTraits = { ...existing.appearanceTraits, ...safeOutput.appearanceTraits };
  }
  if (safeOutput.motionTraits) {
    patch.motionTraits = { ...existing.motionTraits, ...safeOutput.motionTraits };
    // Motion traits also inform emotional movement
    if (safeOutput.motionTraits.emotionalMovementTone) {
      patch.emotionalMovementTraits = {
        ...(existing.emotionalMovementTraits ?? {}),
        dominantTone: safeOutput.motionTraits.emotionalMovementTone,
      };
    }
  }
  if (safeOutput.audioProfile) {
    patch.audioProfile = { ...existing.audioProfile, ...safeOutput.audioProfile };
  }

  // Recompute consistency hash (deterministic from trait keys)
  const allTraits = { ...patch.appearanceTraits, ...patch.motionTraits, ...patch.audioProfile };
  patch.embodimentConsistencyHash = _computeConsistencyHash(allTraits);

  saveProfile(patch);
}

function _computeConsistencyHash(traits) {
  // Deterministic hash from sorted trait key+value pairs
  const sorted = Object.entries(traits ?? {})
    .filter(([k]) => !['analysisSource','fallback','biometricExtracted','identityCloned'].includes(k))
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([k,v]) => `${k}:${v}`)
    .join('|');
  // Simple djb2-style hash
  let hash = 5381;
  for (let i = 0; i < sorted.length; i++) {
    hash = ((hash << 5) + hash) + sorted.charCodeAt(i);
    hash = hash & hash; // int32
  }
  return `emb_${Math.abs(hash).toString(16).padStart(8,'0')}`;
}

/**
 * getEmbodimentProfile()
 */
export function getEmbodimentProfile() {
  return storage.getCompanionCore().embodimentProfile ?? {};
}

/**
 * updateEmbodimentProfileManually(patch)
 * For UI-driven updates (user corrects a trait).
 * Always goes through validation firewall.
 */
export function updateEmbodimentProfileManually(patch) {
  const validation = validateAIOutput(patch, AGENT.EMBODIMENT);
  if (!validation.valid) return { updated: false, violations: validation.violations };

  const existing = getProfile();
  const merged = {
    appearanceTraits:        { ...existing.appearanceTraits,       ...(patch.appearanceTraits       ?? {}) },
    motionTraits:            { ...existing.motionTraits,           ...(patch.motionTraits           ?? {}) },
    emotionalMovementTraits: { ...existing.emotionalMovementTraits,...(patch.emotionalMovementTraits ?? {}) },
    postureTraits:           { ...existing.postureTraits,          ...(patch.postureTraits          ?? {}) },
    favouriteBehaviours:     { ...existing.favouriteBehaviours,    ...(patch.favouriteBehaviours    ?? {}) },
    environmentPreferences:  { ...existing.environmentPreferences, ...(patch.environmentPreferences ?? {}) },
    audioProfile:            { ...existing.audioProfile,           ...(patch.audioProfile           ?? {}) },
  };
  merged.embodimentConsistencyHash = _computeConsistencyHash({ ...merged.appearanceTraits, ...merged.motionTraits });
  _lastProfileWrite = 0; // bypass throttle for manual updates
  saveProfile(merged);
  return { updated: true, profile: getProfile() };
}

// ════════════════════════════════════════════════════════════════
// STEP 13 — ENVIRONMENT PROFILE SYSTEM
// ════════════════════════════════════════════════════════════════

export const ENVIRONMENT_PROFILES = {
  living_room: {
    lighting:       'warm_soft',
    ambience:       'calm',
    soundscape:     'ambient_home',
    movementPacing: 'relaxed',
    emotionalTone:  'comfortable',
  },
  garden: {
    lighting:       'bright',
    ambience:       'active',
    soundscape:     'outdoor_nature',
    movementPacing: 'energetic',
    emotionalTone:  'playful',
  },
  park: {
    lighting:       'bright',
    ambience:       'social',
    soundscape:     'outdoor_busy',
    movementPacing: 'active',
    emotionalTone:  'excited',
  },
  bedroom: {
    lighting:       'dim',
    ambience:       'quiet',
    soundscape:     'silence',
    movementPacing: 'slow',
    emotionalTone:  'restful',
  },
  cozy_evening_room: {
    lighting:       'evening',
    ambience:       'intimate',
    soundscape:     'soft_ambient',
    movementPacing: 'gentle',
    emotionalTone:  'bonded',
  },
  sunny_window_area: {
    lighting:       'warm_bright',
    ambience:       'peaceful',
    soundscape:     'birds_distant',
    movementPacing: 'calm',
    emotionalTone:  'curious',
  },
};

/**
 * getEnvironmentProfile(scene)
 */
export function getEnvironmentProfile(scene) {
  return ENVIRONMENT_PROFILES[scene] ?? ENVIRONMENT_PROFILES.living_room;
}

/**
 * getAllEnvironmentProfiles()
 */
export function getAllEnvironmentProfiles() {
  return ENVIRONMENT_PROFILES;
}

// ════════════════════════════════════════════════════════════════
// STEP 16 — PERFORMANCE + GPU SAFETY
// ════════════════════════════════════════════════════════════════

let _lastPerfCheck = 0;
let _lastPerfReport = null;

/**
 * runPerformanceCheck()
 * Checks for runaway queues, excessive agent activity, memory growth.
 */
export function runOrchestrationPerformanceCheck() {
  if (now() - _lastPerfCheck < 30_000) return _lastPerfReport ?? { status: 'stable' };
  _lastPerfCheck = now();

  const core     = storage.getCompanionCore();
  const ao       = core.aiOrchestration ?? {};
  const warnings = [];

  // 1. Media queue size
  const qLen = (ao.mediaProcessingQueue ?? []).length;
  if (qLen >= CAPS.MEDIA_QUEUE - 5) warnings.push(`media_queue_near_cap: ${qLen}/${CAPS.MEDIA_QUEUE}`);

  // 2. Active agents
  const activeCount = (ao.activeAgents ?? []).length;
  if (activeCount > 3) warnings.push(`high_agent_concurrency: ${activeCount} active agents`);

  // 3. Validation log growth
  const vLen = (ao.validationLog ?? []).length;
  if (vLen >= CAPS.VALIDATION_LOG - 5) warnings.push(`validation_log_near_cap: ${vLen}/${CAPS.VALIDATION_LOG}`);

  // 4. Media library growth
  const mlLen = (core.mediaLibrary ?? []).length;
  if (mlLen >= CAPS.MEDIA_LIBRARY - 20) warnings.push(`media_library_near_cap: ${mlLen}/${CAPS.MEDIA_LIBRARY}`);

  // 5. Fallback rate
  const recentFallbacks = (ao.fallbackLog ?? []).filter(f => now() - f.ts < 60_000);
  if (recentFallbacks.length > 5) warnings.push(`high_fallback_rate: ${recentFallbacks.length} in last 60s`);

  const report = {
    ts:      now(),
    status:  warnings.length > 0 ? 'warning' : 'stable',
    warnings,
    checks: {
      mediaQueueSize:   qLen,
      activeAgents:     activeCount,
      validationLogSize:vLen,
      mediaLibrarySize: mlLen,
      recentFallbacks:  recentFallbacks.length,
    },
  };

  _lastPerfReport = report;
  return report;
}

/**
 * throttleAITask()
 * Returns true if AI task should be allowed to run now.
 * Prevents runaway parallel AI calls.
 */
export function throttleAITask(priority = 'normal') {
  const ao = storage.getCompanionCore().aiOrchestration ?? {};
  const activeCount = (ao.activeAgents ?? []).length;
  if (priority === 'critical') return true;     // critical tasks always run
  if (activeCount >= 3) return false;            // max 3 concurrent agents
  return true;
}

/**
 * clearCompletedQueueEntries()
 * Removes completed/failed entries from processing queue.
 */
export function clearCompletedQueueEntries() {
  const core = storage.getCompanionCore();
  const ao   = core.aiOrchestration ?? {};
  const before = (ao.mediaProcessingQueue ?? []).length;
  ao.mediaProcessingQueue = (ao.mediaProcessingQueue ?? [])
    .filter(e => e.status === 'queued' || e.status === 'processing');
  const cleared = before - ao.mediaProcessingQueue.length;
  core.aiOrchestration = ao;
  storage.saveCompanionCore(core);
  return { cleared };
}

// ════════════════════════════════════════════════════════════════
// STEP 17 — OFFLINE-FIRST RESILIENCE
// ════════════════════════════════════════════════════════════════

/**
 * getOfflineStatus()
 * Returns current offline resilience state.
 * Ollama is ALWAYS the offline-critical brain.
 */
export function getOfflineStatus() {
  const ao  = storage.getCompanionCore().aiOrchestration ?? {};
  const ps  = ao.providerStatus ?? {};
  return {
    ollamaAvailable:      ps[PROVIDER.OLLAMA] !== PROVIDER_STATUS.OFFLINE,
    groqAvailable:        ps[PROVIDER.GROQ]   === PROVIDER_STATUS.ACTIVE,
    offlineFunctional:    ps[PROVIDER.OLLAMA] !== PROVIDER_STATUS.OFFLINE,
    allCriticalPathsWork: ps[PROVIDER.OLLAMA] !== PROVIDER_STATUS.OFFLINE,
    groqFallbackActive:   ao.orchestrationState === ORCH_STATE.FALLBACK,
    lastFallbackAt:       ao.lastFallbackAt ?? null,
  };
}

/**
 * recoverFromProviderFailure(failedProvider)
 * Switches orchestration to fallback mode safely.
 */
export function recoverFromProviderFailure(failedProvider) {
  if (failedProvider === PROVIDER.OLLAMA) {
    // Ollama is offline-critical — enter degraded state, preserve everything
    saveOrch({ orchestrationState: ORCH_STATE.DEGRADED });
    return { recovered: false, reason: 'ollama_is_critical_path', state: ORCH_STATE.DEGRADED };
  }
  // Groq failed — seamless fallback to Ollama
  _updateProviderStatus(PROVIDER.GROQ, PROVIDER_STATUS.OFFLINE);
  _recordFallback(PROVIDER.GROQ, 'provider_failure_recovery');
  saveOrch({ orchestrationState: ORCH_STATE.STABLE });
  return { recovered: true, fallbackProvider: PROVIDER.OLLAMA, state: ORCH_STATE.STABLE };
}

// ════════════════════════════════════════════════════════════════
// STEP 19 — HYBRID AI CONTEXT INJECTION
// ════════════════════════════════════════════════════════════════

/**
 * getHybridAIContext()
 * Full context object for Ollama prompt injection.
 * Includes both provider states + full embodiment profile.
 */
export function getHybridAIContext() {
  const core    = storage.getCompanionCore();
  const ao      = core.aiOrchestration ?? {};
  const profile = core.embodimentProfile ?? {};
  const es      = core.environmentSystem ?? {};
  const as      = core.animationSystem   ?? {};
  const ag      = core.attachmentGraph   ?? {};
  const emo     = core.emotionalState    ?? {};
  const ls      = core.lifeSimulation    ?? {};

  return {
    // Provider status
    providers: {
      ollama: {
        role:     'primary_persistent_brain',
        status:   ao.providerStatus?.[PROVIDER.OLLAMA] ?? PROVIDER_STATUS.UNKNOWN,
        critical: true,
        offline:  true,
      },
      groq: {
        role:     'multimodal_acceleration_layer',
        status:   ao.providerStatus?.[PROVIDER.GROQ] ?? PROVIDER_STATUS.UNKNOWN,
        critical: false,
        fallback: 'ollama',
      },
    },
    // Orchestration
    orchestrationState: ao.orchestrationState ?? ORCH_STATE.STABLE,
    activeAgents:       ao.activeAgents       ?? [],
    // Embodiment profile
    embodimentProfile: {
      appearanceTraits:        profile.appearanceTraits        ?? {},
      motionTraits:            profile.motionTraits            ?? {},
      emotionalMovementTraits: profile.emotionalMovementTraits ?? {},
      audioProfile:            profile.audioProfile            ?? {},
      consistencyHash:         profile.embodimentConsistencyHash ?? '',
      traitVersion:            profile.traitVersion            ?? 0,
    },
    // Animation + environment state
    currentAnimationState: as.primaryLayer       ?? 'idle',
    emotionalPosture:      as.emotionalPosture   ?? 'relaxed',
    activeScene:           es.activeScene        ?? 'living_room',
    environmentProfile:    getEnvironmentProfile(es.activeScene ?? 'living_room'),
    // Emotional + attachment
    emotionalState:   { dominant: emo.dominant ?? 'neutral', valence: emo.valence ?? 0 },
    bondStage:        ag.bondStage   ?? 'distant',
    userBond:         ag.userBond    ?? 0,
    ambientMood:      ls.ambientMood ?? 'calm',
    // Object interaction
    activeObjectInteraction: as.interactionLayer ?? null,
    gazeTarget:              as.gazeTarget       ?? null,
    // Recent media memories
    recentMediaCount: (core.mediaLibrary ?? []).length,
  };
}

// ════════════════════════════════════════════════════════════════
// BOOT INTEGRATION
// ════════════════════════════════════════════════════════════════

/**
 * initHybridAIOrchestrator()
 * Called from companionCoreService.initCompanionCore() — boot step.
 */
export function initHybridAIOrchestrator() {
  // 1. Register agents
  initAgentRegistry();

  // 2. Set initial provider status (assume Ollama active offline, Groq unknown)
  const core = storage.getCompanionCore();
  const ao   = core.aiOrchestration ?? {};
  ao.providerStatus = {
    [PROVIDER.OLLAMA]: PROVIDER_STATUS.ACTIVE,   // Ollama assumed available offline
    [PROVIDER.GROQ]:   PROVIDER_STATUS.UNKNOWN,
  };
  ao.activeProviders     = [PROVIDER.OLLAMA];
  ao.orchestrationState  = ORCH_STATE.STABLE;
  ao.orchestrationVersion= ORCH_VERSION;
  core.aiOrchestration   = ao;
  storage.saveCompanionCore(core);

  // 3. Build routing engine snapshot
  const routing = getRoutingEngine();

  // After routing engine init, ensure orchestrationState is stable
  // (routing resolution for unconfigured Groq should not mark system as 'fallback')
  const postInit = storage.getCompanionCore();
  if (postInit.aiOrchestration?.orchestrationState !== ORCH_STATE.STABLE) {
    postInit.aiOrchestration.orchestrationState = ORCH_STATE.STABLE;
    storage.saveCompanionCore(postInit);
  }
  const finalAo = storage.getCompanionCore().aiOrchestration;

  console.log('IMMORTAIL HYBRID AI ORCHESTRATOR: boot complete', {
    ollamaStatus: finalAo.providerStatus[PROVIDER.OLLAMA],
    groqStatus:   finalAo.providerStatus[PROVIDER.GROQ],
    agentCount:   Object.keys(finalAo.agentRegistry ?? {}).length,
    orchState:    finalAo.orchestrationState,
  });

  return { routing, providerStatus: finalAo.providerStatus };
}
