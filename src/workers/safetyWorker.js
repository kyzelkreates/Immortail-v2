// ================================================================
// IMMORTAIL™ Gen2 — SAFETY WORKER
// Identity drift detection. Content validation. Firewall enforcement.
// ================================================================

import { registerWorker, enqueueTask } from './orchestrator.js';
import { validateContent }              from '../services/ai/responseNormalizer.js';
import { validateIdentityImmortality }  from '../core/legacyEngine.js';
import { verifyPersonalityConsistency } from '../services/ai/personalityEngine.js';
import { EventBus } from '../core/eventBus.js';

export const WORKER_ID = 'safetyWorker';

export function boot() {
  registerWorker(WORKER_ID, {
    name:        'Safety Worker',
    icon:        '🛡️',
    description: 'Identity drift detection, content firewall',
    handler:     _handle,
  });
}

async function _handle(taskType, payload) {
  switch (taskType) {
    case 'validate_response':   return _validateResponse(payload);
    case 'identity_check':      return _identityCheck();
    case 'personality_check':   return _personalityCheck();
    default: break;
  }
}

function _validateResponse({ content } = {}) {
  if (!content) return { safe: false };
  const safe = validateContent(content);
  if (!safe) {
    EventBus.emit('SYSTEM::SAFETY_VIOLATION', { type: 'content', snippet: content.slice(0, 50) });
  }
  return { safe };
}

function _identityCheck() {
  const result = validateIdentityImmortality();
  if (!result.valid) {
    EventBus.emit('SYSTEM::SAFETY_VIOLATION', { type: 'identity_drift', detail: result.detail });
    console.error('[SafetyWorker] Identity immortality violation:', result.detail);
  }
  return result;
}

function _personalityCheck() {
  const result = verifyPersonalityConsistency();
  if (!result.consistent) {
    EventBus.emit('SYSTEM::SAFETY_VIOLATION', { type: 'personality_inconsistency', checks: result.checks });
  }
  return result;
}

export function scheduleResponseValidation(content) {
  enqueueTask(WORKER_ID, 'validate_response', { content }, 90);
}

export function scheduleIdentityCheck() {
  enqueueTask(WORKER_ID, 'identity_check', {}, 100);
}

export function schedulePersonalityCheck() {
  enqueueTask(WORKER_ID, 'personality_check', {}, 50);
}
