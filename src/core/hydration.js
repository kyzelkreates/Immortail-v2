// ================================================================
// IMMORTAIL™ — HYDRATION ORCHESTRATOR (Run 3 — Full Implementation)
// Loads persistent state, validates, maps storage → runtime state.
// NO DIRECT STORAGE ACCESS — routes through storageService.
// ================================================================

import { HYDRATION_STATUS } from '../utils/constants.js';
import { HydrationLogger }  from '../utils/logger.js';

// Storage service — SSOT access point
import { queryEntities, getStorageServiceStatus } from '../services/storageService.js';
import { STORE_NAMES } from '../storage/schemas.js';
import { checkPersistenceIntegrity } from '../storage/persistence.js';

// Runtime state
import { updateRuntimeState as updateCoreRuntime } from './runtime.js';
import { updateAppState, registerActiveModule }     from '../state/appState.js';
import {
  updateRuntimeState,
  markHydrationComplete,
} from '../state/runtimeState.js';
import { hydrateDogState }  from '../state/dogState.js';
import { hydrateAIState }   from '../state/aiState.js';
import { restoreSession }   from '../state/sessionState.js';

// ----------------------------------------------------------------
// HYDRATION EVENTS
// ----------------------------------------------------------------

const HYDRATION_EVENT = 'IMMORTAIL_HYDRATION_COMPLETE';
const HYDRATION_FAILED_EVENT = 'IMMORTAIL_HYDRATION_FAILED';

// ----------------------------------------------------------------
// INTERNAL HYDRATION STATE
// ----------------------------------------------------------------

let _hydrationState = {
  status:      HYDRATION_STATUS.IDLE,
  startedAt:   null,
  completedAt: null,
  error:       null,
  partial:     false,
  results:     {},
  hooks: {
    pre:  [],
    post: [],
  },
};

// ----------------------------------------------------------------
// GET HYDRATION STATE
// ----------------------------------------------------------------

export function getHydrationState() {
  return {
    ..._hydrationState,
    hooks: undefined, // do not expose hook internals
  };
}

// ----------------------------------------------------------------
// REGISTER HYDRATION HOOK
// ----------------------------------------------------------------

export function registerHydrationHook(phase, fn) {
  if (phase !== 'pre' && phase !== 'post') {
    HydrationLogger.warn(`[Hydration] Invalid hook phase "${phase}". Use "pre" or "post".`);
    return;
  }
  if (typeof fn !== 'function') {
    HydrationLogger.warn('[Hydration] Hook must be a function.');
    return;
  }
  _hydrationState.hooks[phase].push(fn);
  HydrationLogger.debug(`[Hydration] Hook registered — phase: ${phase}`);
}

// ----------------------------------------------------------------
// INITIALIZE HYDRATION (boot step — validates preconditions)
// ----------------------------------------------------------------

/**
 * Called at boot step 8. Validates storage is ready for hydration.
 * Does NOT load state — hydrateRuntime() does that (boot step 9).
 */
export async function initializeHydration() {
  HydrationLogger.group('Hydration Initialization');

  if (_hydrationState.status !== HYDRATION_STATUS.IDLE) {
    HydrationLogger.warn('[Hydration] Already initialized. Skipping.');
    HydrationLogger.groupEnd();
    return _hydrationState;
  }

  _hydrationState.status    = HYDRATION_STATUS.PENDING;
  _hydrationState.startedAt = Date.now();

  // Verify storage service is ready before we attempt to hydrate
  const storageStatus = getStorageServiceStatus();
  if (!storageStatus.serviceReady) {
    HydrationLogger.warn('[Hydration] Storage service not ready — hydration will use safe defaults.');
    _hydrationState.partial = true;
  }

  HydrationLogger.info('[Hydration] Hydration system initialized and ready for runtime hydration.');
  updateCoreRuntime({ flags: { hydrationReady: true } });

  HydrationLogger.groupEnd();
  return _hydrationState;
}

// ----------------------------------------------------------------
// HYDRATE RUNTIME (boot step 9 — full orchestration)
// ================================================================
// HYDRATION FLOW:
// 1. load storage snapshot
// 2. validate schemas
// 3. validate persistence integrity
// 4. map storage → runtime state
// 5. restore runtime containers
// 6. validate hydration completion
// 7. emit hydration complete
// ================================================================

export async function hydrateRuntime() {
  HydrationLogger.group('Runtime Hydration — Full Orchestration');

  updateRuntimeState({ timestamps: { hydrationStartedAt: Date.now() } });

  try {
    // ── STEP 1: Pre-hydration hooks ──────────────────────────────
    await _runHooks('pre');

    // ── STEP 2: Load storage snapshot ────────────────────────────
    HydrationLogger.info('[Hydration] Step 1/7 — Loading storage snapshot...');

    const storageStatus = getStorageServiceStatus();
    let snapshot = {};

    if (storageStatus.serviceReady) {
      snapshot = await _loadStorageSnapshot();
    } else {
      HydrationLogger.warn('[Hydration] Storage not ready — using empty snapshot (safe defaults).');
      _hydrationState.partial = true;
    }

    // ── STEP 3: Validate schemas ──────────────────────────────────
    HydrationLogger.info('[Hydration] Step 2/7 — Validating snapshot schemas...');
    _validateSnapshotSchemas(snapshot);

    // ── STEP 4: Validate persistence integrity ────────────────────
    HydrationLogger.info('[Hydration] Step 3/7 — Validating persistence integrity...');
    const integrityResult = _validateSnapshotIntegrity(snapshot);
    if (integrityResult.corruptedStores.length > 0) {
      HydrationLogger.warn(
        `[Hydration] Corrupted stores isolated: ${integrityResult.corruptedStores.join(', ')}`
      );
      _hydrationState.partial = true;
    }

    // ── STEP 5: Map storage → runtime state ───────────────────────
    HydrationLogger.info('[Hydration] Step 4/7 — Mapping storage to runtime state...');
    await _mapStorageToRuntimeState(snapshot, integrityResult.cleanStores);

    // ── STEP 6: Validate hydration completion ─────────────────────
    HydrationLogger.info('[Hydration] Step 5/7 — Validating hydration completion...');
    const hydrationValid = validateHydration();
    if (!hydrationValid.valid) {
      HydrationLogger.warn(
        `[Hydration] Hydration incomplete — missing: ${hydrationValid.missing.join(', ')}`
      );
      _hydrationState.partial = true;
    }

    // ── STEP 7: Mark complete and emit event ──────────────────────
    HydrationLogger.info('[Hydration] Step 6/7 — Post-hydration hooks...');
    await _runHooks('post');

    HydrationLogger.info('[Hydration] Step 7/7 — Emitting hydration complete...');
    _hydrationState.status      = HYDRATION_STATUS.COMPLETE;
    _hydrationState.completedAt = Date.now();

    markHydrationComplete();

    updateAppState({
      hydrated: true,
      flags: { hydrationReady: true },
      timestamps: { hydratedAt: _hydrationState.completedAt },
    });

    _emitHydrationEvent(HYDRATION_EVENT, {
      partial:  _hydrationState.partial,
      duration: _hydrationState.completedAt - _hydrationState.startedAt,
    });

    const duration = _hydrationState.completedAt - _hydrationState.startedAt;
    HydrationLogger.info(
      `[Hydration] Runtime hydration COMPLETE. Duration: ${duration}ms. Partial: ${_hydrationState.partial}`
    );

  } catch (err) {
    _hydrationState.status = HYDRATION_STATUS.FAILED;
    _hydrationState.error  = err.message;

    HydrationLogger.error(`[Hydration] Runtime hydration FAILED: ${err.message}`);

    _emitHydrationEvent(HYDRATION_FAILED_EVENT, { error: err.message });

    // Safe default — partial hydration to keep boot alive
    _hydrationState.partial = true;
    markHydrationComplete(); // mark complete even on failure — recovery handles the rest
    updateAppState({ hydrated: true, flags: { hydrationReady: true } });
  } finally {
    HydrationLogger.groupEnd();
  }

  return _hydrationState;
}

// ----------------------------------------------------------------
// VALIDATE HYDRATION
// ----------------------------------------------------------------

/**
 * Validate that all critical runtime containers were hydrated.
 * @returns {{ valid: boolean, missing: string[] }}
 */
export function validateHydration() {
  const missing = [];

  // These are non-fatal — we use partial hydration as fallback
  if (_hydrationState.status === HYDRATION_STATUS.IDLE) {
    missing.push('hydration_not_started');
  }
  if (!_hydrationState.results.sessions) {
    missing.push('sessions');
  }
  if (!_hydrationState.results.dogProfiles) {
    missing.push('dogProfiles');
  }

  return {
    valid:   missing.length === 0,
    missing,
    partial: _hydrationState.partial,
    status:  _hydrationState.status,
  };
}

// ----------------------------------------------------------------
// INTERNAL: Load storage snapshot
// ----------------------------------------------------------------

async function _loadStorageSnapshot() {
  const snapshot = {};
  const storesToLoad = [
    STORE_NAMES.SESSIONS,
    STORE_NAMES.DOG_PROFILES,
    STORE_NAMES.SETTINGS,
    STORE_NAMES.EMOTIONS,
    STORE_NAMES.ROUTINES,
  ];

  for (const storeName of storesToLoad) {
    try {
      const records = await queryEntities(storeName);
      snapshot[storeName] = records;
      HydrationLogger.info(
        `[Hydration] Loaded "${storeName}": ${records.length} record(s).`
      );
    } catch (err) {
      HydrationLogger.warn(
        `[Hydration] Could not load "${storeName}": ${err.message}. Using empty.`
      );
      snapshot[storeName] = [];
    }
  }

  return snapshot;
}

// ----------------------------------------------------------------
// INTERNAL: Validate snapshot schemas
// ----------------------------------------------------------------

function _validateSnapshotSchemas(snapshot) {
  for (const [storeName, records] of Object.entries(snapshot)) {
    if (!Array.isArray(records)) {
      throw new HydrationError(
        `[Hydration] Schema validation failed: store "${storeName}" did not return an array.`
      );
    }
  }
  HydrationLogger.info('[Hydration] Snapshot schema validation passed.');
}

// ----------------------------------------------------------------
// INTERNAL: Validate persistence integrity
// ----------------------------------------------------------------

function _validateSnapshotIntegrity(snapshot) {
  const cleanStores    = {};
  const corruptedStores = [];

  for (const [storeName, records] of Object.entries(snapshot)) {
    const clean = records.filter((r) => checkPersistenceIntegrity(r));
    const lost  = records.length - clean.length;

    if (lost > 0) {
      HydrationLogger.warn(
        `[Hydration] Integrity: "${storeName}" — ${lost} corrupted record(s) isolated.`
      );
      corruptedStores.push(storeName);
    }

    cleanStores[storeName] = clean;
    _hydrationState.results[storeName] = {
      total:     records.length,
      clean:     clean.length,
      corrupted: lost,
    };
  }

  return { cleanStores, corruptedStores };
}

// ----------------------------------------------------------------
// INTERNAL: Map storage snapshot → runtime state containers
// ----------------------------------------------------------------

async function _mapStorageToRuntimeState(snapshot, cleanStores) {
  // ── Sessions ─────────────────────────────────────────────────
  const sessions = cleanStores[STORE_NAMES.SESSIONS] || [];
  const lastSession = sessions
    .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))[0] || null;
  restoreSession(lastSession);
  HydrationLogger.info(
    `[Hydration] Session: ${lastSession ? 'restored from storage' : 'created fresh'}`
  );

  // ── Dog Profiles ─────────────────────────────────────────────
  const dogProfiles = cleanStores[STORE_NAMES.DOG_PROFILES] || [];
  const primaryProfile = dogProfiles[0] || null;
  hydrateDogState(primaryProfile);
  HydrationLogger.info(
    `[Hydration] Dog profile: ${primaryProfile ? primaryProfile.name : 'none (defaults)'}`
  );

  // ── AI State ─────────────────────────────────────────────────
  hydrateAIState({});
  HydrationLogger.info('[Hydration] AI state: initialized with defaults.');

  // ── App State ────────────────────────────────────────────────
  const settings = cleanStores[STORE_NAMES.SETTINGS] || [];
  const settingsMap = {};
  for (const s of settings) {
    if (s.key) settingsMap[s.key] = s.value;
  }

  updateAppState({
    meta: {
      settingsLoaded: true,
      settingsCount:  settings.length,
    },
  });

  HydrationLogger.info(`[Hydration] Settings: ${settings.length} key(s) loaded.`);
}

// ----------------------------------------------------------------
// INTERNAL: Run hooks
// ----------------------------------------------------------------

async function _runHooks(phase) {
  const hooks = _hydrationState.hooks[phase] || [];
  HydrationLogger.debug(`[Hydration] Running ${hooks.length} "${phase}" hook(s).`);

  for (const fn of hooks) {
    try {
      await fn();
    } catch (err) {
      HydrationLogger.error(`[Hydration] Hook error [${phase}]: ${err.message}`);
      throw err;
    }
  }
}

// ----------------------------------------------------------------
// INTERNAL: Emit DOM event
// ----------------------------------------------------------------

function _emitHydrationEvent(eventName, detail) {
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  }
}

// ----------------------------------------------------------------
// HYDRATION ERROR CLASS
// ----------------------------------------------------------------

export class HydrationError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name      = 'HydrationError';
    this.context   = context;
    this.timestamp = Date.now();
  }
}
