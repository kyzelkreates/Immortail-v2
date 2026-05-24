// ================================================================
// IMMORTAIL™ — CONVERSATION AGENT (FOUNDATION)
// Conversation orchestration structure. Runtime comm workflows.
// NO LLM CALLS. NO CHAT UI. NO INFERENCE. FOUNDATION ONLY.
// ================================================================

import { SystemLogger }     from '../utils/logger.js';
import { subscribe }         from '../events/eventBus.js';
import { SYSTEM_EVENTS }     from '../events/eventTypes.js';
import { getAgentLifecycleState, LIFECYCLE_STATE } from './lifecycle.js';
import { AGENT_CAPABILITY } from './registry.js';

const ConversationAgentLogger = SystemLogger;

// ----------------------------------------------------------------
// AGENT IDENTITY
// ----------------------------------------------------------------

export const CONVERSATION_AGENT_ID = 'conversation_agent';

// ----------------------------------------------------------------
// TASK TYPES
// ----------------------------------------------------------------

export const CONVERSATION_TASK_TYPE = {
  OPEN_CONTEXT:    'conversation.open_context',
  CLOSE_CONTEXT:   'conversation.close_context',
  QUEUE_MESSAGE:   'conversation.queue_message',
  GET_CONTEXT:     'conversation.get_context',
};

// ----------------------------------------------------------------
// INTERNAL STATE
// ----------------------------------------------------------------

let _initialized = false;
let _agentState  = {
  processedCount:    0,
  errorCount:        0,
  lastActivityAt:    null,
  activeContextId:   null,
  messageQueueSize:  0,
};

/** @type {Map<string, ConversationContext>} */
const _contexts      = new Map();
const _unsubscribers = [];

class ConversationContext {
  constructor(contextId, metadata) {
    this.contextId   = contextId;
    this.metadata    = metadata || {};
    this.messages    = [];   // runtime message queue (no LLM, no storage yet)
    this.openedAt    = Date.now();
    this.closedAt    = null;
    this.isActive    = true;
  }
}

// ----------------------------------------------------------------
// AGENT DESCRIPTOR
// ----------------------------------------------------------------

export const CONVERSATION_AGENT_DESCRIPTOR = {
  id:           CONVERSATION_AGENT_ID,
  capabilities: [AGENT_CAPABILITY.CONVERSATION],
  metadata:     {
    taskTypes:   Object.values(CONVERSATION_TASK_TYPE),
    description: 'Conversation runtime orchestration agent (no inference).',
  },
};

// ----------------------------------------------------------------
// INITIALIZE CONVERSATION AGENT
// ----------------------------------------------------------------

export async function initializeConversationAgent() {
  if (_initialized) {
    ConversationAgentLogger.warn('[ConversationAgent] Already initialized. Skipping.');
    return getConversationAgentState();
  }

  ConversationAgentLogger.info('[ConversationAgent] Initializing conversation agent...');

  _bindSubscriptions();

  _initialized = true;
  ConversationAgentLogger.info('[ConversationAgent] Conversation agent initialized.');
  return getConversationAgentState();
}

// ----------------------------------------------------------------
// PROCESS CONVERSATION TASK
// ----------------------------------------------------------------

export async function processConversationTask(task) {
  if (!task || !task.type) {
    throw new Error('[ConversationAgent] processConversationTask: invalid task.');
  }

  ConversationAgentLogger.info(
    `[ConversationAgent] Processing task: "${task.id}" (type: ${task.type})`
  );
  _agentState.lastActivityAt = Date.now();

  let result;

  switch (task.type) {
    case CONVERSATION_TASK_TYPE.OPEN_CONTEXT: {
      const { contextId, metadata } = task.payload;
      if (!contextId) throw new Error('[ConversationAgent] OPEN_CONTEXT: contextId required.');

      if (_contexts.has(contextId)) {
        ConversationAgentLogger.warn(
          `[ConversationAgent] Context "${contextId}" already open. Returning existing.`
        );
        result = _contexts.get(contextId);
      } else {
        const ctx = new ConversationContext(contextId, metadata);
        _contexts.set(contextId, ctx);
        _agentState.activeContextId = contextId;
        result = ctx;
        ConversationAgentLogger.info(`[ConversationAgent] Context opened: "${contextId}"`);
      }
      break;
    }

    case CONVERSATION_TASK_TYPE.CLOSE_CONTEXT: {
      const { contextId } = task.payload;
      const ctx = _contexts.get(contextId);
      if (!ctx) throw new Error(`[ConversationAgent] Context "${contextId}" not found.`);

      ctx.isActive = false;
      ctx.closedAt = Date.now();

      if (_agentState.activeContextId === contextId) {
        _agentState.activeContextId = null;
      }

      result = { closed: true, contextId, messageCount: ctx.messages.length };
      ConversationAgentLogger.info(`[ConversationAgent] Context closed: "${contextId}"`);
      break;
    }

    case CONVERSATION_TASK_TYPE.QUEUE_MESSAGE: {
      const { contextId, message } = task.payload;
      if (!contextId || !message) {
        throw new Error('[ConversationAgent] QUEUE_MESSAGE: contextId and message required.');
      }

      const ctx = _contexts.get(contextId);
      if (!ctx || !ctx.isActive) {
        throw new Error(`[ConversationAgent] No active context "${contextId}".`);
      }

      const entry = {
        id:        `msg_${Date.now()}_${ctx.messages.length}`,
        content:   message,
        queuedAt:  Date.now(),
        processed: false,
      };

      ctx.messages.push(entry);
      _agentState.messageQueueSize = Array.from(_contexts.values())
        .reduce((sum, c) => sum + c.messages.filter((m) => !m.processed).length, 0);

      ConversationAgentLogger.debug(
        `[ConversationAgent] Message queued in context "${contextId}".`
      );
      result = entry;
      break;
    }

    case CONVERSATION_TASK_TYPE.GET_CONTEXT: {
      const { contextId } = task.payload;
      const ctx = _contexts.get(contextId);
      result = ctx
        ? { contextId, messageCount: ctx.messages.length, isActive: ctx.isActive, openedAt: ctx.openedAt }
        : null;
      break;
    }

    default:
      throw new Error(`[ConversationAgent] Unknown task type: "${task.type}".`);
  }

  _agentState.processedCount++;
  return result;
}

// ----------------------------------------------------------------
// GET CONVERSATION AGENT STATE
// ----------------------------------------------------------------

export function getConversationAgentState() {
  return {
    agentId:           CONVERSATION_AGENT_ID,
    initialized:       _initialized,
    processedCount:    _agentState.processedCount,
    errorCount:        _agentState.errorCount,
    lastActivityAt:    _agentState.lastActivityAt,
    activeContextId:   _agentState.activeContextId,
    openContexts:      _contexts.size,
    messageQueueSize:  _agentState.messageQueueSize,
    lifecycleState:    getAgentLifecycleState(CONVERSATION_AGENT_ID)?.state || LIFECYCLE_STATE.IDLE,
  };
}

// ----------------------------------------------------------------
// SHUTDOWN
// ----------------------------------------------------------------

export function shutdownConversationAgent() {
  for (const unsub of _unsubscribers) unsub();
  _unsubscribers.length = 0;
  _contexts.clear();
  _initialized = false;
  ConversationAgentLogger.info('[ConversationAgent] Conversation agent shut down.');
}

// ----------------------------------------------------------------
// TASK HANDLER
// ----------------------------------------------------------------

export async function conversationTaskHandler(task) {
  return processConversationTask(task);
}

// ----------------------------------------------------------------
// INTERNAL: Bind subscriptions
// ----------------------------------------------------------------

function _bindSubscriptions() {
  const unsub = subscribe(SYSTEM_EVENTS.APP_SHUTDOWN, () => {
    ConversationAgentLogger.info('[ConversationAgent] App shutdown — closing all contexts.');
    for (const ctx of _contexts.values()) {
      ctx.isActive = false;
      ctx.closedAt = Date.now();
    }
  }, { subscriberId: CONVERSATION_AGENT_ID });

  _unsubscribers.push(unsub);
}
