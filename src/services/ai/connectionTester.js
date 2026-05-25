// ================================================================
// IMMORTAIL™ Gen2 — CONNECTION TESTER
// Live API ping, latency, model discovery, token validation.
// All results are stored via providerRegistry — never raw in UI.
// ================================================================

import { getProviderCredentials, recordTestResult, setProviderStatus } from './providerRegistry.js';
import { getCatalogueEntry, PROVIDER_TYPES } from './modelProfiles.js';
import * as ollamaAdapter     from './providerAdapters/ollamaAdapter.js';
import * as groqAdapter       from './providerAdapters/groqAdapter.js';
import * as openaiAdapter     from './providerAdapters/openaiAdapter.js';
import * as openrouterAdapter from './providerAdapters/openrouterAdapter.js';
import * as claudeAdapter     from './providerAdapters/claudeAdapter.js';
import * as geminiAdapter     from './providerAdapters/geminiAdapter.js';
import * as customAdapter     from './providerAdapters/customAdapter.js';
import storage                from '../../core/storage.js';
import { EventBus }           from '../../core/eventBus.js';

export const TEST_EVENTS = {
  TEST_STARTED:   'SYSTEM::AI_TEST_STARTED',
  TEST_COMPLETE:  'SYSTEM::AI_TEST_COMPLETE',
  TEST_FAILED:    'SYSTEM::AI_TEST_FAILED',
};

const _activeTests = new Map(); // providerId → AbortController

// ── Adapter routing ─────────────────────────────────────────────

function getAdapter(typeId) {
  switch (typeId) {
    case PROVIDER_TYPES.OLLAMA:     return ollamaAdapter;
    case PROVIDER_TYPES.GROQ:       return groqAdapter;
    case PROVIDER_TYPES.OPENAI:     return openaiAdapter;
    case PROVIDER_TYPES.OPENROUTER: return openrouterAdapter;
    case PROVIDER_TYPES.CLAUDE:     return claudeAdapter;
    case PROVIDER_TYPES.GEMINI:     return geminiAdapter;
    case PROVIDER_TYPES.LMSTUDIO:   return openaiAdapter;  // OpenAI-compatible
    case PROVIDER_TYPES.CUSTOM:     return customAdapter;
    default:                         return customAdapter;
  }
}

// ── Main test entry point ────────────────────────────────────────

/**
 * Test a provider by ID.
 * Returns { success, latencyMs, models, error, testedAt }
 * Side-effect: updates provider status in storage via recordTestResult.
 */
export async function testProvider(providerId, options = {}) {
  const provider = storage.getProvider(providerId);
  if (!provider) return { success: false, error: 'Provider not found', testedAt: Date.now() };

  // Cancel any in-flight test for this provider
  if (_activeTests.has(providerId)) {
    _activeTests.get(providerId).abort();
    _activeTests.delete(providerId);
  }

  EventBus.emit(TEST_EVENTS.TEST_STARTED, { providerId, typeId: provider.typeId });
  setProviderStatus(providerId, 'testing');

  const creds   = getProviderCredentials(providerId);
  const adapter = getAdapter(provider.typeId);
  const cat     = getCatalogueEntry(provider.typeId);

  let result = { success: false, latencyMs: null, models: [], error: null, testedAt: Date.now() };

  try {
    const pingResult = await adapter.ping(creds.baseUrl, creds.apiKey, creds.authType);
    result.latencyMs = pingResult.latencyMs;

    // Fetch model list if possible
    if (adapter.fetchModels && cat?.modelsPath !== null) {
      try {
        const models = await adapter.fetchModels(creds.baseUrl, creds.apiKey, creds.authType);
        result.models = Array.isArray(models) ? models.slice(0, 30) : [];
      } catch { result.models = []; }
    }

    result.success = true;

  } catch (err) {
    result.error = _parseError(err);
    result.success = false;
  } finally {
    _activeTests.delete(providerId);
  }

  recordTestResult(providerId, result);

  if (result.success) {
    EventBus.emit(TEST_EVENTS.TEST_COMPLETE, {
      providerId,
      latencyMs: result.latencyMs,
      modelCount: result.models.length,
    });
  } else {
    EventBus.emit(TEST_EVENTS.TEST_FAILED, { providerId, error: result.error });
  }

  // Log to AI request log
  storage.appendAILog({
    type:       'connection_test',
    providerId,
    typeId:     provider.typeId,
    success:    result.success,
    latencyMs:  result.latencyMs,
    error:      result.error,
  });

  return result;
}

/**
 * Test all enabled providers in parallel (capped at 4 concurrent).
 */
export async function testAllProviders() {
  const providers = storage.getProviders().filter(p => p.enabled);
  const results   = {};
  // Process in batches of 4
  for (let i = 0; i < providers.length; i += 4) {
    const batch   = providers.slice(i, i + 4);
    const settled = await Promise.allSettled(batch.map(p => testProvider(p.id)));
    settled.forEach((r, idx) => {
      results[batch[idx].id] = r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message };
    });
  }
  return results;
}

/**
 * Quick ping check without model discovery — returns true/false in <2s.
 */
export async function quickPing(providerId) {
  const provider = storage.getProvider(providerId);
  if (!provider) return false;
  const creds   = getProviderCredentials(providerId);
  const adapter = getAdapter(provider.typeId);
  try {
    await adapter.ping(creds.baseUrl, creds.apiKey, creds.authType);
    return true;
  } catch { return false; }
}

// ── Error normalization ──────────────────────────────────────────

function _parseError(err) {
  const msg = err?.message ?? String(err);
  if (msg.includes('fetch')) return 'Cannot reach endpoint — check URL and CORS';
  if (msg.includes('401'))   return 'Invalid API key';
  if (msg.includes('403'))   return 'Forbidden — check API key permissions';
  if (msg.includes('404'))   return 'Endpoint not found — check base URL';
  if (msg.includes('429'))   return 'Rate limited — too many requests';
  if (msg.includes('timeout') || msg.includes('abort')) return 'Request timed out';
  if (msg.includes('ECONNREFUSED') || msg.includes('ERR_CONNECTION_REFUSED')) return 'Connection refused — is the server running?';
  return msg.slice(0, 120);
}
