// ================================================================
// IMMORTAIL™ Gen2 — FAILOVER MANAGER
// Deterministic provider failover. Never breaks identity or memory.
// Offline-first fallback chain guaranteed.
// ================================================================

import { getProvidersByPriority, getOfflineSafeProviders, setProviderStatus } from './providerRegistry.js';
import { EventBus } from '../../core/eventBus.js';
import storage      from '../../core/storage.js';

export const FAILOVER_EVENTS = {
  FAILOVER_TRIGGERED: 'SYSTEM::AI_FAILOVER_TRIGGERED',
  FAILOVER_RESOLVED:  'SYSTEM::AI_FAILOVER_RESOLVED',
  ALL_PROVIDERS_DOWN: 'SYSTEM::AI_ALL_PROVIDERS_DOWN',
};

// Failover state — runtime only (not persisted)
const _failoverState = {
  recentFailures:  {},   // providerId → { count, lastAt }
  activeProvider:  null,
  failoverHistory: [],
  isOffline:       false,
};

export function getFailoverState() {
  return { ..._failoverState };
}

/**
 * Record a provider failure. Returns whether it should be marked degraded.
 * Providers with 3+ failures in 60s are considered degraded.
 */
export function recordFailure(providerId) {
  const now     = Date.now();
  const current = _failoverState.recentFailures[providerId] ?? { count: 0, lastAt: 0 };
  // Reset if last failure >60s ago
  if (now - current.lastAt > 60000) {
    _failoverState.recentFailures[providerId] = { count: 1, lastAt: now };
    return false;
  }
  const count = current.count + 1;
  _failoverState.recentFailures[providerId] = { count, lastAt: now };
  if (count >= 3) {
    setProviderStatus(providerId, 'degraded');
    return true;  // caller should trigger failover
  }
  return false;
}

/**
 * Build the ordered failover chain for a given request context.
 * Returns array of providers ordered: primary → backups → offline-safe
 */
export function buildFailoverChain(excludeIds = [], requireOffline = false) {
  let candidates = getProvidersByPriority().filter(p =>
    p.enabled &&
    !excludeIds.includes(p.id) &&
    p.status !== 'degraded'
  );

  if (requireOffline || _failoverState.isOffline) {
    const offlineSafe = candidates.filter(p => p.offlineSafe);
    if (offlineSafe.length > 0) return offlineSafe;
  }

  return candidates;
}

/**
 * Select next provider after a failure, excluding already-tried ones.
 * Returns provider or null if all exhausted.
 */
export function selectNextProvider(triedIds = [], requireOffline = false) {
  const chain = buildFailoverChain(triedIds, requireOffline);
  return chain[0] ?? null;
}

/**
 * Emit failover event and update runtime state.
 */
export function triggerFailover(fromProviderId, toProvider, reason) {
  const entry = {
    ts:          Date.now(),
    from:        fromProviderId,
    to:          toProvider?.id ?? null,
    reason,
  };
  _failoverState.failoverHistory = [..._failoverState.failoverHistory.slice(-49), entry];
  _failoverState.activeProvider  = toProvider?.id ?? null;

  storage.appendAILog({
    type:       'failover',
    from:       fromProviderId,
    to:         toProvider?.id ?? null,
    reason,
  });

  if (toProvider) {
    EventBus.emit(FAILOVER_EVENTS.FAILOVER_TRIGGERED, {
      from: fromProviderId, to: toProvider.id, reason,
    });
  } else {
    EventBus.emit(FAILOVER_EVENTS.ALL_PROVIDERS_DOWN, { reason });
  }
}

export function markOffline() {
  _failoverState.isOffline = true;
}

export function markOnline() {
  _failoverState.isOffline = false;
}

export function resetFailures(providerId) {
  delete _failoverState.recentFailures[providerId];
  setProviderStatus(providerId, 'online');
}

export function getFailoverHistory() {
  return [..._failoverState.failoverHistory];
}
