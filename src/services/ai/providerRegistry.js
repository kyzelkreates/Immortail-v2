// ================================================================
// IMMORTAIL™ Gen2 — PROVIDER REGISTRY
// Single source for all registered AI provider configurations.
// All reads/writes strictly through storage SSOT.
// API keys are stored locally — never logged, never sent to UI props.
// ================================================================

import storage                              from '../../core/storage.js';
import { EventBus }                         from '../../core/eventBus.js';
import { buildNewProvider, getDefaultProviders } from './modelProfiles.js';

export const REGISTRY_EVENTS = {
  PROVIDER_ADDED:    'SYSTEM::AI_PROVIDER_ADDED',
  PROVIDER_UPDATED:  'SYSTEM::AI_PROVIDER_UPDATED',
  PROVIDER_REMOVED:  'SYSTEM::AI_PROVIDER_REMOVED',
  PROVIDER_TOGGLED:  'SYSTEM::AI_PROVIDER_TOGGLED',
  REGISTRY_READY:    'SYSTEM::AI_REGISTRY_READY',
};

let _booted = false;

// ── Boot / seed ────────────────────────────────────────────────

export function bootProviderRegistry() {
  if (_booted) return;
  const existing = storage.getProviders();
  if (!existing || existing.length === 0) {
    storage.saveProviders(getDefaultProviders());
  }
  _booted = true;
  EventBus.emit(REGISTRY_EVENTS.REGISTRY_READY, { count: storage.getProviders().length });
  console.log('[ProviderRegistry] boot complete', { providers: storage.getProviders().length });
}

// ── Read operations ─────────────────────────────────────────────

export function getAllProviders() {
  return storage.getProviders();
}

export function getEnabledProviders() {
  return storage.getProviders().filter(p => p.enabled);
}

export function getProviderById(id) {
  return storage.getProvider(id);
}

export function getProvidersByPriority() {
  return [...storage.getProviders()].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

export function getOnlineProviders() {
  return storage.getProviders().filter(p => p.enabled && p.status === 'online');
}

export function getOfflineSafeProviders() {
  return storage.getProviders().filter(p => p.offlineSafe && p.enabled);
}

// ── Write operations ────────────────────────────────────────────

export function addProvider(typeId, config = {}) {
  const provider = buildNewProvider(typeId, config);
  storage.addProvider(provider);
  EventBus.emit(REGISTRY_EVENTS.PROVIDER_ADDED, { id: provider.id, typeId });
  return provider;
}

export function updateProvider(id, patch) {
  // Never allow external code to patch isBuiltIn providers' typeId
  const existing = storage.getProvider(id);
  if (!existing) return false;
  const safePatch = { ...patch };
  if (existing.isBuiltIn) {
    delete safePatch.typeId;
    delete safePatch.isBuiltIn;
  }
  // Never echo API keys in events
  const eventPatch = { ...safePatch };
  delete eventPatch.apiKey;

  storage.updateProvider(id, safePatch);
  EventBus.emit(REGISTRY_EVENTS.PROVIDER_UPDATED, { id, patch: eventPatch });
  return true;
}

export function removeProvider(id) {
  const existing = storage.getProvider(id);
  if (!existing || existing.isBuiltIn) return false;
  storage.deleteProvider(id);
  EventBus.emit(REGISTRY_EVENTS.PROVIDER_REMOVED, { id });
  return true;
}

export function toggleProvider(id) {
  const p = storage.getProvider(id);
  if (!p) return false;
  const enabled = !p.enabled;
  storage.updateProvider(id, { enabled });
  EventBus.emit(REGISTRY_EVENTS.PROVIDER_TOGGLED, { id, enabled });
  return enabled;
}

export function setPriority(id, priority) {
  return updateProvider(id, { priority: Math.max(0, Math.min(100, priority)) });
}

export function setProviderStatus(id, status, latencyMs = null) {
  const patch = { status, updatedAt: Date.now() };
  if (latencyMs !== null) patch.latencyMs = latencyMs;
  storage.updateProvider(id, patch);
}

export function recordTestResult(id, result) {
  const p = storage.getProvider(id);
  if (!p) return;
  const entry = {
    ts:        Date.now(),
    success:   result.success,
    latencyMs: result.latencyMs ?? null,
    error:     result.error     ?? null,
    models:    result.models    ?? null,
  };
  const history = [...(p.testHistory ?? []).slice(-19), entry];
  storage.updateProvider(id, {
    status:           result.success ? 'online' : 'offline',
    latencyMs:        result.latencyMs ?? null,
    lastTestedAt:     Date.now(),
    lastTestedResult: result.success ? 'pass' : 'fail',
    testHistory:      history,
  });
}

// ── Routing helpers used by aiRouter ───────────────────────────

export function selectBestProvider(options = {}) {
  const { requireOffline = false, preferFast = false, taskType = null } = options;
  let candidates = getEnabledProviders().filter(p => p.status === 'online' || p.status === 'unknown');
  if (requireOffline) candidates = candidates.filter(p => p.offlineSafe);
  if (candidates.length === 0) {
    // Fallback: any offline-safe enabled provider
    candidates = getEnabledProviders().filter(p => p.offlineSafe);
  }
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
}

// Safely read API key — never return in UI, only in service layer
export function getProviderCredentials(id) {
  const p = storage.getProvider(id);
  if (!p) return null;
  return { apiKey: p.apiKey ?? '', baseUrl: p.baseUrl, authType: p.authType };
}
