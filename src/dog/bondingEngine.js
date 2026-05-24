// ================================================================
// IMMORTAIL™ — BONDING ENGINE (FOUNDATION)
// Bonding progression, trust development, interaction impact tracking.
// BOUNDED VALUES. DETERMINISTIC UPDATES. PERSISTENCE-SAFE.
// ================================================================

import { SystemLogger } from '../utils/logger.js';
import { emit }          from '../events/eventBus.js';
import { DOG_EVENTS }    from '../events/eventTypes.js';

const BondingLogger = SystemLogger;

// ----------------------------------------------------------------
// BONDING DIMENSIONS
// All values bounded to [0.0, 1.0]
// ----------------------------------------------------------------

export const BONDING_DIM = {
  TRUST:        'trust',        // fundamental trust in the owner
  FAMILIARITY:  'familiarity',  // comfort with the person/environment
  ATTACHMENT:   'attachment',   // emotional bond depth
  COMFORT:      'comfort',      // physical/emotional comfort level
  CONSISTENCY:  'consistency',  // consistency of interaction pattern
};

// ----------------------------------------------------------------
// BONDING TIER THRESHOLDS
// ----------------------------------------------------------------

export const BONDING_TIER = {
  STRANGER:    { label: 'stranger',    min: 0.00, max: 0.20 },
  ACQUAINTED:  { label: 'acquainted',  min: 0.20, max: 0.40 },
  FAMILIAR:    { label: 'familiar',    min: 0.40, max: 0.60 },
  BONDED:      { label: 'bonded',      min: 0.60, max: 0.80 },
  DEEPLY_BONDED:{ label: 'deeply_bonded', min: 0.80, max: 1.01 },
};

// ----------------------------------------------------------------
// INTERACTION IMPACT WEIGHTS
// How much different interaction types affect bonding dimensions.
// ----------------------------------------------------------------

export const INTERACTION_TYPE = {
  GREETING:       'greeting',
  FEEDING:        'feeding',
  PLAY:           'play',
  GROOMING:       'grooming',
  TRAINING:       'training',
  COMFORT:        'comfort',
  ABANDONMENT:    'abandonment',    // negative — long absence
  HARSH:          'harsh',          // negative — harsh interaction
};

const INTERACTION_IMPACT = {
  [INTERACTION_TYPE.GREETING]:    { trust: +0.01, familiarity: +0.02, attachment: +0.01, comfort: +0.01, consistency: +0.01 },
  [INTERACTION_TYPE.FEEDING]:     { trust: +0.02, familiarity: +0.01, attachment: +0.01, comfort: +0.03, consistency: +0.02 },
  [INTERACTION_TYPE.PLAY]:        { trust: +0.02, familiarity: +0.02, attachment: +0.03, comfort: +0.02, consistency: +0.01 },
  [INTERACTION_TYPE.GROOMING]:    { trust: +0.02, familiarity: +0.02, attachment: +0.02, comfort: +0.03, consistency: +0.02 },
  [INTERACTION_TYPE.TRAINING]:    { trust: +0.03, familiarity: +0.01, attachment: +0.01, comfort: +0.00, consistency: +0.03 },
  [INTERACTION_TYPE.COMFORT]:     { trust: +0.03, familiarity: +0.01, attachment: +0.04, comfort: +0.04, consistency: +0.01 },
  [INTERACTION_TYPE.ABANDONMENT]: { trust: -0.03, familiarity: -0.01, attachment: -0.02, comfort: -0.03, consistency: -0.04 },
  [INTERACTION_TYPE.HARSH]:       { trust: -0.05, familiarity: +0.00, attachment: -0.04, comfort: -0.05, consistency: -0.02 },
};

// ----------------------------------------------------------------
// BOUNDS
// ----------------------------------------------------------------

const BOND_MIN = 0.0;
const BOND_MAX = 1.0;

const DEFAULT_BONDING = {
  [BONDING_DIM.TRUST]:       0.1,
  [BONDING_DIM.FAMILIARITY]: 0.1,
  [BONDING_DIM.ATTACHMENT]:  0.0,
  [BONDING_DIM.COMFORT]:     0.2,
  [BONDING_DIM.CONSISTENCY]: 0.0,
};

// ----------------------------------------------------------------
// INTERNAL STATE
// ----------------------------------------------------------------

/** @type {Map<string, BondState>} profileId → bond state */
const _states = new Map();

class BondState {
  constructor(profileId, dimensions = {}) {
    this.profileId       = profileId;
    this.dimensions      = { ...DEFAULT_BONDING, ...dimensions };
    this.bondScore       = 0;
    this.tier            = BONDING_TIER.STRANGER.label;
    this.interactionLog  = [];
    this.totalInteractions = 0;
    this.createdAt       = Date.now();
    this.updatedAt       = Date.now();
    this.version         = 1;
  }
}

// ----------------------------------------------------------------
// INITIALIZE BOND STATE
// ----------------------------------------------------------------

/**
 * @param {string} profileId
 * @param {Object} [initialDimensions]
 * @returns {Object} bonding snapshot
 */
export function initializeBondState(profileId, initialDimensions = {}) {
  if (!profileId || typeof profileId !== 'string') {
    throw new BondingError('[BondingEngine] initializeBondState: profileId required.');
  }

  if (_states.has(profileId)) {
    BondingLogger.warn(`[BondingEngine] Bond state for "${profileId}" already initialized.`);
    return getBondingSnapshot(profileId);
  }

  const clamped = _clampDimensions(initialDimensions);
  const state   = new BondState(profileId, clamped);
  state.bondScore = _computeBondScore(state.dimensions);
  state.tier      = _computeTier(state.bondScore);

  _states.set(profileId, state);

  BondingLogger.info(
    `[BondingEngine] Bond state initialized — profileId: ${profileId}, tier: ${state.tier}`
  );

  return getBondingSnapshot(profileId);
}

// ----------------------------------------------------------------
// UPDATE BONDING PROGRESS
// ----------------------------------------------------------------

/**
 * Record an interaction and apply its impact to bonding dimensions.
 * @param {string} profileId
 * @param {string} interactionType — INTERACTION_TYPE value
 * @param {Object} [meta]          — optional interaction metadata
 * @returns {Promise<Object>} updated bonding snapshot
 */
export async function updateBondingProgress(profileId, interactionType, meta = {}) {
  const state = _requireState(profileId);

  if (!Object.values(INTERACTION_TYPE).includes(interactionType)) {
    throw new BondingError(
      `[BondingEngine] Unknown interaction type: "${interactionType}". ` +
      `Valid: ${Object.values(INTERACTION_TYPE).join(', ')}.`
    );
  }

  const impact = INTERACTION_IMPACT[interactionType];
  const prev   = { ...state.dimensions };

  // Apply impact with clamping
  for (const [dim, delta] of Object.entries(impact)) {
    if (dim in state.dimensions) {
      state.dimensions[dim] = _clamp(state.dimensions[dim] + delta);
    }
  }

  const prevTier   = state.tier;
  state.bondScore  = _computeBondScore(state.dimensions);
  state.tier       = _computeTier(state.bondScore);
  state.updatedAt  = Date.now();
  state.version++;
  state.totalInteractions++;

  // Log interaction
  state.interactionLog.push({
    type:        interactionType,
    impact,
    bondScore:   state.bondScore,
    tier:        state.tier,
    timestamp:   Date.now(),
    meta,
  });
  if (state.interactionLog.length > 200) state.interactionLog.shift();

  BondingLogger.info(
    `[BondingEngine] Bonding updated — profileId: ${profileId}, ` +
    `interaction: ${interactionType}, score: ${state.bondScore.toFixed(3)}, tier: ${state.tier}`
  );

  const snap = getBondingSnapshot(profileId);

  await emit(DOG_EVENTS.DOG_STATE_UPDATED, {
    timestamp:   Date.now(),
    dogId:       profileId,
    source:      'bondingEngine',
    runtimeState: snap,
  });

  // Emit tier change notification if tier changed
  if (prevTier !== state.tier) {
    BondingLogger.info(
      `[BondingEngine] Bonding tier CHANGED — profileId: ${profileId}: ${prevTier} → ${state.tier}`
    );
  }

  return snap;
}

// ----------------------------------------------------------------
// CALCULATE BONDING IMPACT
// ----------------------------------------------------------------

/**
 * Preview the impact of an interaction without applying it.
 * @param {string} interactionType
 * @param {Object} currentDimensions
 * @returns {Object} { projectedDimensions, projectedScore, projectedTier }
 */
export function calculateBondingImpact(interactionType, currentDimensions) {
  if (!Object.values(INTERACTION_TYPE).includes(interactionType)) {
    throw new BondingError(
      `[BondingEngine] calculateBondingImpact: unknown interaction type "${interactionType}".`
    );
  }

  const impact    = INTERACTION_IMPACT[interactionType];
  const projected = { ...currentDimensions };

  for (const [dim, delta] of Object.entries(impact)) {
    if (dim in projected) {
      projected[dim] = _clamp((projected[dim] || 0) + delta);
    }
  }

  const projectedScore = _computeBondScore(projected);
  const projectedTier  = _computeTier(projectedScore);

  return {
    interactionType,
    impact,
    projectedDimensions: projected,
    projectedScore,
    projectedTier,
  };
}

// ----------------------------------------------------------------
// GET BONDING SNAPSHOT
// ----------------------------------------------------------------

/**
 * @param {string} profileId
 * @returns {Object}
 */
export function getBondingSnapshot(profileId) {
  const state = _requireState(profileId);
  return {
    profileId:        state.profileId,
    dimensions:       { ...state.dimensions },
    bondScore:        state.bondScore,
    tier:             state.tier,
    totalInteractions: state.totalInteractions,
    version:          state.version,
    updatedAt:        state.updatedAt,
  };
}

// ----------------------------------------------------------------
// RESTORE FROM PERSISTENCE
// ----------------------------------------------------------------

export function restoreBondState(persistedState) {
  if (!persistedState?.profileId) {
    throw new BondingError('[BondingEngine] restoreBondState: invalid record.');
  }

  const { profileId, dimensions, totalInteractions, version, createdAt } = persistedState;
  const clamped = _clampDimensions(dimensions || {});
  const state   = new BondState(profileId, clamped);

  state.totalInteractions = totalInteractions || 0;
  state.version           = version           || 1;
  state.createdAt         = createdAt         || Date.now();
  state.bondScore         = _computeBondScore(state.dimensions);
  state.tier              = _computeTier(state.bondScore);

  _states.set(profileId, state);

  BondingLogger.info(
    `[BondingEngine] Bond state restored — profileId: ${profileId}, tier: ${state.tier}`
  );
  return getBondingSnapshot(profileId);
}

// ----------------------------------------------------------------
// ENGINE STATUS
// ----------------------------------------------------------------

export function getBondingEngineStatus() {
  return {
    totalProfiles: _states.size,
    profileIds:    Array.from(_states.keys()),
  };
}

// ----------------------------------------------------------------
// INTERNAL: Compute bond score (weighted average of dimensions)
// ----------------------------------------------------------------

const DIMENSION_WEIGHTS = {
  [BONDING_DIM.TRUST]:       0.30,
  [BONDING_DIM.FAMILIARITY]: 0.20,
  [BONDING_DIM.ATTACHMENT]:  0.25,
  [BONDING_DIM.COMFORT]:     0.15,
  [BONDING_DIM.CONSISTENCY]: 0.10,
};

function _computeBondScore(dimensions) {
  let score = 0;
  for (const [dim, weight] of Object.entries(DIMENSION_WEIGHTS)) {
    score += (dimensions[dim] || 0) * weight;
  }
  return Math.min(BOND_MAX, Math.max(BOND_MIN, score));
}

// ----------------------------------------------------------------
// INTERNAL: Compute tier from bond score
// ----------------------------------------------------------------

function _computeTier(score) {
  for (const tier of Object.values(BONDING_TIER)) {
    if (score >= tier.min && score < tier.max) return tier.label;
  }
  return BONDING_TIER.STRANGER.label;
}

// ----------------------------------------------------------------
// INTERNAL: Clamp all dimension values
// ----------------------------------------------------------------

function _clampDimensions(dims) {
  const out = {};
  for (const [k, v] of Object.entries(dims)) {
    if (typeof v === 'number') out[k] = _clamp(v);
  }
  return out;
}

function _clamp(val) {
  return Math.min(BOND_MAX, Math.max(BOND_MIN, val));
}

// ----------------------------------------------------------------
// INTERNAL: Require state or throw
// ----------------------------------------------------------------

function _requireState(profileId) {
  const state = _states.get(profileId);
  if (!state) {
    throw new BondingError(
      `[BondingEngine] State for "${profileId}" not found. Call initializeBondState() first.`
    );
  }
  return state;
}

// ----------------------------------------------------------------
// BONDING ERROR
// ----------------------------------------------------------------

export class BondingError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name      = 'BondingError';
    this.context   = context;
    this.timestamp = Date.now();
  }
}
