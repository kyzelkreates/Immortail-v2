// ================================================================
// IMMORTAIL™ Gen2 — CONTEXT WORKER
// Pre-assembles AI context for upcoming interactions.
// Caches assembled contexts for low-latency responses.
// ================================================================

import { registerWorker, enqueueTask } from './orchestrator.js';
import { assembleContext }              from '../services/ai/contextAssembler.js';

export const WORKER_ID = 'contextWorker';

let _cachedContext = null;
let _cachedAt      = 0;
const CACHE_TTL    = 30000; // 30s

export function boot() {
  registerWorker(WORKER_ID, {
    name:        'Context Worker',
    icon:        '📋',
    description: 'Pre-assembles AI context for low-latency responses',
    handler:     _handle,
  });
}

async function _handle(taskType, payload) {
  switch (taskType) {
    case 'preassemble': return _preassemble(payload);
    case 'invalidate':  return _invalidate();
    default: break;
  }
}

function _preassemble({ userMessage = '[context_refresh]', options = {} } = {}) {
  const ctx = assembleContext(userMessage, options);
  _cachedContext = ctx;
  _cachedAt      = Date.now();
  return ctx;
}

function _invalidate() {
  _cachedContext = null;
  _cachedAt      = 0;
}

export function getCachedContext() {
  if (!_cachedContext || Date.now() - _cachedAt > CACHE_TTL) return null;
  return _cachedContext;
}

export function schedulePreassemble(userMessage, options = {}) {
  enqueueTask(WORKER_ID, 'preassemble', { userMessage, options }, 40);
}

export function scheduleInvalidate() {
  enqueueTask(WORKER_ID, 'invalidate', {}, 100);
}
