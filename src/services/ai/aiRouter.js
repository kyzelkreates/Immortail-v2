// ================================================================
// IMMORTAIL™ Gen2 — AI ROUTER
// Central request executor. ALL AI calls MUST flow through here.
// No component ever calls a provider directly.
//
// Responsibilities:
//   - Provider selection + priority ordering
//   - Failover routing with retry cascade
//   - Offline fallback (Ollama → local providers)
//   - Request normalization (messages format)
//   - Response normalization (unified schema)
//   - Memory recording (turns, emotional tags)
//   - Personality nudge from responses
//   - Request queue + concurrency guard
//   - Full request/response logging via storage
//   - Identity safety — blocks unsafe content
// ================================================================

import storage from '../../core/storage.js';
import { EventBus } from '../../core/eventBus.js';
import { getProvidersByPriority, getProviderCredentials } from './providerRegistry.js';
import { buildFailoverChain, recordFailure, triggerFailover } from './failoverManager.js';
import { assembleContext } from './contextAssembler.js';
import { normalizeResponse, validateContent, extractEmotionHint } from './responseNormalizer.js';
import { recordUserTurn, recordAssistantTurn } from './memoryEngine.js';
import { applyEmotionNudge, progressAttachment } from './personalityEngine.js';
import { getCatalogueEntry, PROVIDER_TYPES } from './modelProfiles.js';
import { blockGroqMutation } from '../../core/legacyEngine.js';

// Adapters
import * as ollamaAdapter     from './providerAdapters/ollamaAdapter.js';
import * as groqAdapter       from './providerAdapters/groqAdapter.js';
import * as openaiAdapter     from './providerAdapters/openaiAdapter.js';
import * as openrouterAdapter from './providerAdapters/openrouterAdapter.js';
import * as claudeAdapter     from './providerAdapters/claudeAdapter.js';
import * as geminiAdapter     from './providerAdapters/geminiAdapter.js';
import * as customAdapter     from './providerAdapters/customAdapter.js';

export const ROUTER_EVENTS = {
  REQUEST_START:   'SYSTEM::AI_REQUEST_START',
  REQUEST_SUCCESS: 'SYSTEM::AI_REQUEST_SUCCESS',
  REQUEST_FAILED:  'SYSTEM::AI_REQUEST_FAILED',
  QUEUE_FULL:      'SYSTEM::AI_QUEUE_FULL',
  OFFLINE_MODE:    'SYSTEM::AI_OFFLINE_MODE',
};

// ── Adapter map ─────────────────────────────────────────────────
function getAdapter(typeId) {
  switch (typeId) {
    case PROVIDER_TYPES.OLLAMA:     return ollamaAdapter;
    case PROVIDER_TYPES.GROQ:       return groqAdapter;
    case PROVIDER_TYPES.OPENAI:     return openaiAdapter;
    case PROVIDER_TYPES.OPENROUTER: return openrouterAdapter;
    case PROVIDER_TYPES.CLAUDE:     return claudeAdapter;
    case PROVIDER_TYPES.GEMINI:     return geminiAdapter;
    case PROVIDER_TYPES.LMSTUDIO:   return openaiAdapter;
    default:                         return customAdapter;
  }
}

// ── Queue guard ──────────────────────────────────────────────────
let _activeRequests = 0;
const MAX_CONCURRENT = 2;
const _queue         = [];

// ── Router state ─────────────────────────────────────────────────
const _routerState = {
  totalRequests:     0,
  totalSuccesses:    0,
  totalFailures:     0,
  totalFailovers:    0,
  isOffline:         false,
  lastSuccessAt:     null,
  lastProviderUsed:  null,
};

export function getRouterState() { return { ..._routerState }; }

// ════════════════════════════════════════════════════════════════
// PRIMARY ENTRY POINT — send()
// ════════════════════════════════════════════════════════════════

/**
 * Send a message through the AI router.
 *
 * @param {string}  userMessage  - The user's input
 * @param {object}  options      - { taskType, preferFast, requireOffline, timeout, skipMemory }
 * @returns {Promise<NormalizedResponse>}
 */
export async function send(userMessage, options = {}) {
  if (!userMessage?.trim()) {
    return normalizeResponse({ content: '' }, { taskType: 'empty' });
  }

  // Concurrency guard — queue if full
  if (_activeRequests >= MAX_CONCURRENT) {
    return new Promise((resolve) => {
      _queue.push(() => send(userMessage, options).then(resolve));
    });
  }

  _activeRequests++;
  _routerState.totalRequests++;
  EventBus.emit(ROUTER_EVENTS.REQUEST_START, { taskType: options.taskType ?? 'conversation' });

  try {
    // 1. Record user turn in memory
    if (!options.skipMemory) {
      recordUserTurn(userMessage);
    }

    // 2. Build context
    const { messages, contextMeta } = assembleContext(userMessage, {
      taskType:          options.taskType      ?? 'conversation',
      includePersonality: options.includePersonality !== false,
      includeMemory:     options.includeMemory !== false,
      includeEmotion:    options.includeEmotion !== false,
    });

    // 3. Execute with failover
    const raw = await _executeWithFailover(messages, options);

    // 4. Normalize + validate
    const normalized = normalizeResponse(raw, {
      taskType:    options.taskType    ?? 'conversation',
      contextMeta,
      emotion:     extractEmotionHint(raw.content),
    });

    if (!normalized.safe) {
      console.warn('[AIRouter] Response failed safety validation — returning safe fallback');
      normalized.content = "I'm here with you. Let me gather my thoughts for a moment.";
    }

    // 5. Record assistant turn
    if (!options.skipMemory) {
      recordAssistantTurn(normalized);
    }

    // 6. Personality evolution from response
    if (!options.skipPersonality) {
      applyEmotionNudge(normalized);
      progressAttachment(0.5);
    }

    _routerState.totalSuccesses++;
    _routerState.lastSuccessAt    = Date.now();
    _routerState.lastProviderUsed = normalized.provider;
    _routerState.isOffline        = false;

    EventBus.emit(ROUTER_EVENTS.REQUEST_SUCCESS, {
      provider:  normalized.provider,
      latencyMs: normalized.latencyMs,
    });

    return normalized;

  } catch (err) {
    _routerState.totalFailures++;
    EventBus.emit(ROUTER_EVENTS.REQUEST_FAILED, { error: err.message });

    // Return emotional fallback — never crash the companion
    return normalizeResponse(
      { content: "I'm still here. Something slowed me down, but I'm with you.", provider: 'fallback' },
      { taskType: options.taskType ?? 'conversation', emotion: { detected: 'calm', valence: 0.1, arousal: 30 } }
    );

  } finally {
    _activeRequests--;
    if (_queue.length > 0) {
      const next = _queue.shift();
      next();
    }
  }
}

// ── Failover execution chain ─────────────────────────────────────

async function _executeWithFailover(messages, options = {}) {
  const triedIds    = [];
  const chain       = buildFailoverChain([], options.requireOffline ?? false);

  if (chain.length === 0) {
    _routerState.isOffline = true;
    EventBus.emit(ROUTER_EVENTS.OFFLINE_MODE, {});
    throw new Error('No providers available — offline mode');
  }

  for (const provider of chain) {
    triedIds.push(provider.id);
    try {
      const result = await _callProvider(provider, messages, options);
      if (triedIds.length > 1) {
        _routerState.totalFailovers++;
        triggerFailover(triedIds[triedIds.length - 2], provider, 'previous_failed');
      }
      return result;
    } catch (err) {
      console.warn(`[AIRouter] Provider "${provider.name}" failed:`, err.message);
      const degraded = recordFailure(provider.id);
      if (degraded) {
        triggerFailover(provider.id, null, err.message);
      }
      // Continue to next provider
    }
  }

  throw new Error('All providers exhausted');
}

// ── Single provider call ─────────────────────────────────────────

async function _callProvider(provider, messages, options = {}) {
  // CRITICAL: If Groq, enforce mutation firewall
  if (provider.typeId === PROVIDER_TYPES.GROQ) {
    const block = blockGroqMutation('identity');
    if (block.blocked && options.taskType === 'identity') {
      throw new Error('Groq cannot handle identity tasks — role lock enforced');
    }
  }

  const creds   = getProviderCredentials(provider.id);
  const adapter = getAdapter(provider.typeId);

  return adapter.chat(
    creds.baseUrl,
    creds.apiKey,
    provider.selectedModel,
    messages,
    { timeout: options.timeout ?? 45000 },
    // extra headers for adapters that need them
    provider.typeId === PROVIDER_TYPES.OPENROUTER ? { 'HTTP-Referer': 'https://immortail.app' } : undefined
  );
}

// ── Task-type routing helpers ────────────────────────────────────

/**
 * Route to the best provider for a given task type.
 * Enforces Ollama for identity/memory tasks.
 */
export function resolveTaskProvider(taskType) {
  const allProviders = getProvidersByPriority().filter(p => p.enabled);

  const OLLAMA_ONLY_TASKS = [
    'emotionalReasoning', 'memoryContinuity', 'identityContinuity',
    'embodimentConsistency', 'lifeStoryReasoning', 'attachmentContinuity',
  ];

  if (OLLAMA_ONLY_TASKS.includes(taskType)) {
    const ollama = allProviders.find(p => p.typeId === PROVIDER_TYPES.OLLAMA && p.enabled);
    if (ollama) return ollama;
  }

  const FAST_PREFERRED = ['rapidVisionTasks', 'mediaPreprocessing', 'rapidSceneAnalysis'];
  if (FAST_PREFERRED.includes(taskType)) {
    const fast = allProviders.find(p => p.typeId === PROVIDER_TYPES.GROQ && p.enabled && p.status === 'online');
    if (fast) return fast;
  }

  return allProviders[0] ?? null;
}

// ── Low-level direct call (used by workers, not UI) ─────────────

export async function rawChat(providerId, messages, options = {}) {
  const provider = storage.getProvider(providerId);
  if (!provider) throw new Error(`Provider ${providerId} not found`);
  return _callProvider(provider, messages, options);
}
