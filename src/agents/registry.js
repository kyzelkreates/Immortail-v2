// ================================================================
// IMMORTAIL™ — CENTRAL AGENT REGISTRY
// Runtime agent registration, capability tracking, discovery.
// NO STORAGE ACCESS. NO BUSINESS LOGIC. FOUNDATION ONLY.
// ================================================================

import { SystemLogger } from '../utils/logger.js';

const RegistryLogger = SystemLogger;

// ----------------------------------------------------------------
// AGENT CAPABILITIES
// ----------------------------------------------------------------

export const AGENT_CAPABILITY = {
  MEMORY:         'memory',
  EMOTION:        'emotion',
  DOG_RUNTIME:    'dog_runtime',
  CONVERSATION:   'conversation',
  ROUTINE:        'routine',
  RECOVERY:       'recovery',
  SUPERVISION:    'supervision',
};

// ----------------------------------------------------------------
// AGENT HEALTH STATES
// ----------------------------------------------------------------

export const AGENT_HEALTH = {
  UNKNOWN:   'unknown',
  HEALTHY:   'healthy',
  DEGRADED:  'degraded',
  FAILED:    'failed',
};

// ----------------------------------------------------------------
// REGISTRY RECORD CLASS
// ----------------------------------------------------------------

class AgentRegistryRecord {
  constructor({ id, capabilities, metadata }) {
    this.id              = id;
    this.capabilities    = capabilities || [];
    this.metadata        = metadata    || {};
    this.health          = AGENT_HEALTH.UNKNOWN;
    this.lifecycleStatus = 'idle';
    this.activeTaskCount = 0;
    this.totalTasksHandled = 0;
    this.registeredAt    = Date.now();
    this.lastHealthCheck = null;
    this.lastActivity    = null;
  }
}

// ----------------------------------------------------------------
// INTERNAL REGISTRY STATE
// ----------------------------------------------------------------

/** @type {Map<string, AgentRegistryRecord>} */
const _agents = new Map();

// ----------------------------------------------------------------
// REGISTER RUNTIME AGENT
// ----------------------------------------------------------------

/**
 * Register an agent in the runtime registry.
 * @param {Object} config
 * @param {string}   config.id            — unique agent identifier
 * @param {string[]} config.capabilities  — AGENT_CAPABILITY values
 * @param {Object}   [config.metadata]
 * @returns {AgentRegistryRecord}
 */
export function registerRuntimeAgent(config) {
  const validation = validateAgentRegistration(config);
  if (!validation.valid) {
    throw new RegistryError(
      `[AgentRegistry] Registration failed for "${config?.id}": ${validation.errors.join(' | ')}`
    );
  }

  const { id, capabilities, metadata } = config;

  if (_agents.has(id)) {
    RegistryLogger.warn(`[AgentRegistry] Agent "${id}" already registered. Skipping duplicate.`);
    return _agents.get(id);
  }

  const record = new AgentRegistryRecord({ id, capabilities, metadata });
  _agents.set(id, record);

  RegistryLogger.info(
    `[AgentRegistry] Agent registered: "${id}" | capabilities: [${capabilities.join(', ')}]`
  );

  return record;
}

// ----------------------------------------------------------------
// UNREGISTER RUNTIME AGENT
// ----------------------------------------------------------------

/**
 * Remove an agent from the registry.
 * @param {string} agentId
 */
export function unregisterRuntimeAgent(agentId) {
  if (!_agents.has(agentId)) {
    RegistryLogger.warn(`[AgentRegistry] unregisterRuntimeAgent: "${agentId}" not found.`);
    return false;
  }

  _agents.delete(agentId);
  RegistryLogger.info(`[AgentRegistry] Agent unregistered: "${agentId}"`);
  return true;
}

// ----------------------------------------------------------------
// GET AGENT
// ----------------------------------------------------------------

/**
 * @param {string} agentId
 * @returns {AgentRegistryRecord|null}
 */
export function getAgent(agentId) {
  return _agents.get(agentId) || null;
}

// ----------------------------------------------------------------
// GET ALL AGENTS
// ----------------------------------------------------------------

/**
 * Returns a snapshot of all registered agents.
 * @returns {Object[]}
 */
export function getAllAgents() {
  return Array.from(_agents.values()).map(_snapshotRecord);
}

// ----------------------------------------------------------------
// GET AGENTS BY CAPABILITY
// ----------------------------------------------------------------

/**
 * Find all agents that have a specific capability.
 * @param {string} capability — AGENT_CAPABILITY value
 * @returns {Object[]}
 */
export function getAgentsByCapability(capability) {
  return Array.from(_agents.values())
    .filter((r) => r.capabilities.includes(capability))
    .map(_snapshotRecord);
}

// ----------------------------------------------------------------
// UPDATE AGENT HEALTH
// ----------------------------------------------------------------

/**
 * @param {string} agentId
 * @param {string} health — AGENT_HEALTH value
 */
export function updateAgentHealth(agentId, health) {
  const record = _agents.get(agentId);
  if (!record) {
    RegistryLogger.warn(`[AgentRegistry] updateAgentHealth: "${agentId}" not found.`);
    return;
  }

  if (!Object.values(AGENT_HEALTH).includes(health)) {
    RegistryLogger.error(`[AgentRegistry] Invalid health value: "${health}"`);
    return;
  }

  record.health          = health;
  record.lastHealthCheck = Date.now();

  RegistryLogger.debug(`[AgentRegistry] Agent "${agentId}" health → ${health}`);
}

// ----------------------------------------------------------------
// UPDATE AGENT LIFECYCLE STATUS
// ----------------------------------------------------------------

/**
 * @param {string} agentId
 * @param {string} status — lifecycle state string
 */
export function updateAgentLifecycleStatus(agentId, status) {
  const record = _agents.get(agentId);
  if (!record) return;

  record.lifecycleStatus = status;
  record.lastActivity    = Date.now();

  RegistryLogger.debug(`[AgentRegistry] Agent "${agentId}" lifecycle → ${status}`);
}

// ----------------------------------------------------------------
// TRACK TASK ACTIVITY
// ----------------------------------------------------------------

export function incrementAgentTaskCount(agentId) {
  const record = _agents.get(agentId);
  if (!record) return;
  record.activeTaskCount++;
  record.lastActivity = Date.now();
}

export function decrementAgentTaskCount(agentId) {
  const record = _agents.get(agentId);
  if (!record) return;
  if (record.activeTaskCount > 0) record.activeTaskCount--;
  record.totalTasksHandled++;
  record.lastActivity = Date.now();
}

// ----------------------------------------------------------------
// VALIDATE AGENT REGISTRATION
// ----------------------------------------------------------------

/**
 * @param {Object} config
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateAgentRegistration(config) {
  const errors = [];

  if (!config || typeof config !== 'object') {
    errors.push('Registration config must be a plain object.');
    return { valid: false, errors };
  }

  if (!config.id || typeof config.id !== 'string' || config.id.trim().length === 0) {
    errors.push('Field "id" must be a non-empty string.');
  }

  if (!Array.isArray(config.capabilities) || config.capabilities.length === 0) {
    errors.push('Field "capabilities" must be a non-empty array.');
  } else {
    const validCaps = Object.values(AGENT_CAPABILITY);
    for (const cap of config.capabilities) {
      if (!validCaps.includes(cap)) {
        errors.push(`Unknown capability: "${cap}". Valid: ${validCaps.join(', ')}.`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ----------------------------------------------------------------
// REGISTRY STATUS
// ----------------------------------------------------------------

export function getRegistryStatus() {
  const agents = Array.from(_agents.values());
  return {
    total:     agents.length,
    healthy:   agents.filter((a) => a.health === AGENT_HEALTH.HEALTHY).length,
    degraded:  agents.filter((a) => a.health === AGENT_HEALTH.DEGRADED).length,
    failed:    agents.filter((a) => a.health === AGENT_HEALTH.FAILED).length,
    activeTasks: agents.reduce((sum, a) => sum + a.activeTaskCount, 0),
    agents:    agents.map(_snapshotRecord),
  };
}

// ----------------------------------------------------------------
// INTERNAL HELPERS
// ----------------------------------------------------------------

function _snapshotRecord(record) {
  return {
    id:                record.id,
    capabilities:      [...record.capabilities],
    health:            record.health,
    lifecycleStatus:   record.lifecycleStatus,
    activeTaskCount:   record.activeTaskCount,
    totalTasksHandled: record.totalTasksHandled,
    registeredAt:      record.registeredAt,
    lastHealthCheck:   record.lastHealthCheck,
    lastActivity:      record.lastActivity,
    metadata:          { ...record.metadata },
  };
}

// ----------------------------------------------------------------
// REGISTRY ERROR
// ----------------------------------------------------------------

export class RegistryError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name      = 'RegistryError';
    this.context   = context;
    this.timestamp = Date.now();
  }
}
