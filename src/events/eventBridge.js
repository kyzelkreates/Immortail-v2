// ================================================================
// IMMORTAIL™ — EVENT BRIDGE (TEMPORARY COMPATIBILITY LAYER)
// Intercepts legacy RUNTIME_EVENTS plain-key emissions and
// converts them to SYSTEM:: namespaced events.
//
// ⚠️  MARKED FOR REMOVAL after full migration is verified.
// Once all call sites use SYSTEM_EVENTS directly, delete this file
// and remove all eventBridge imports.
//
// SSOT RULE: eventTypes.js is the only event vocabulary.
//            This bridge only exists during the transition window.
// ================================================================

import { SystemLogger } from '../utils/logger.js';
import { ALL_EVENTS }   from './eventTypes.js';

const BridgeLogger = SystemLogger;

// ----------------------------------------------------------------
// LEGACY KEY → NAMESPACED VALUE MAP
// Built from ALL_EVENTS reverse-lookup.
// Keys are the short human names (e.g. "APP_READY").
// Values are the canonical bus strings (e.g. "SYSTEM::APP_READY").
// ----------------------------------------------------------------

const _legacyToCanonical = new Map();

for (const [shortKey, canonicalValue] of Object.entries(ALL_EVENTS)) {
  // Short key = e.g. "APP_READY", "DOG_STATE_UPDATED"
  // Canonical  = e.g. "SYSTEM::APP_READY", "DOG::STATE_UPDATED"
  _legacyToCanonical.set(shortKey, canonicalValue);
}

// Also map by the raw string before "::" — e.g. "APP_READY" from "SYSTEM::APP_READY"
for (const canonicalValue of Object.values(ALL_EVENTS)) {
  const [, suffix] = canonicalValue.split('::');
  if (suffix && !_legacyToCanonical.has(suffix)) {
    _legacyToCanonical.set(suffix, canonicalValue);
  }
}

// ----------------------------------------------------------------
// NORMALIZE EVENT TYPE
// Core utility — converts any input to canonical namespaced form.
// Idempotent: already-namespaced values are returned as-is.
//
// @param {string} eventType
// @returns {string} canonical event string (e.g. "SYSTEM::APP_READY")
// ----------------------------------------------------------------

export function normalizeEventType(eventType) {
  if (typeof eventType !== 'string' || !eventType) {
    return eventType;
  }

  // Already namespaced — return as-is
  if (eventType.includes('::')) {
    return eventType;
  }

  // Look up in legacy map
  const canonical = _legacyToCanonical.get(eventType);
  if (canonical) {
    BridgeLogger.warn(
      `[EventBridge] ⚠️  DEPRECATED: raw event key "${eventType}" → "${canonical}". ` +
      `Update call site to use SYSTEM_EVENTS constants from eventTypes.js.`
    );
    return canonical;
  }

  // Unknown key — return as-is (let the bus validate and reject)
  return eventType;
}

// ----------------------------------------------------------------
// IS LEGACY KEY
// Returns true if the given string is a non-namespaced legacy key
// that this bridge can translate.
// ----------------------------------------------------------------

export function isLegacyKey(eventType) {
  if (typeof eventType !== 'string') return false;
  if (eventType.includes('::')) return false;
  return _legacyToCanonical.has(eventType);
}

// ----------------------------------------------------------------
// GET ALL LEGACY MAPPINGS (for diagnostics)
// ----------------------------------------------------------------

export function getLegacyMappings() {
  const out = {};
  for (const [k, v] of _legacyToCanonical) out[k] = v;
  return out;
}

// ----------------------------------------------------------------
// INTERCEPT DOM CUSTOM EVENT
// Wraps a DOM CustomEvent dispatch — converts raw key to canonical,
// then dispatches BOTH (for legacy DOM listeners) and re-emits on bus.
//
// @param {string}   eventType  — raw or canonical
// @param {Object}   detail
// @param {Function} [busFn]    — optional eventBus.emit to bridge into bus
// ----------------------------------------------------------------

export function bridgeDispatch(eventType, detail = {}, busFn = null) {
  const canonical = normalizeEventType(eventType);

  // DOM dispatch (for legacy window.addEventListener listeners)
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent(canonical, { detail }));
  }

  // Bus dispatch (for useEventBus subscribers)
  if (typeof busFn === 'function') {
    try {
      busFn(canonical, detail);
    } catch (err) {
      BridgeLogger.warn(`[EventBridge] Bus dispatch failed for "${canonical}": ${err.message}`);
    }
  }

  return canonical;
}

// ----------------------------------------------------------------
// BRIDGE STATUS
// ----------------------------------------------------------------

export function getBridgeStatus() {
  return {
    legacyMappingsCount: _legacyToCanonical.size,
    mappings:            getLegacyMappings(),
    markedForRemoval:    true,
    note:                'Remove after all call sites migrated to SYSTEM_EVENTS.',
  };
}
