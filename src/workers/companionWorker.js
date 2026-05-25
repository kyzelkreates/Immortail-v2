// ================================================================
// IMMORTAIL™ Gen2 — COMPANION PERSONALITY WORKER
// Handles personality evolution cycles, routine checks, bond updates.
// ================================================================

import { registerWorker, enqueueTask } from './orchestrator.js';
import { evolveTrait, verifyPersonalityConsistency } from '../services/ai/personalityEngine.js';
import storage from '../core/storage.js';

export const WORKER_ID = 'companionWorker';

export function boot() {
  registerWorker(WORKER_ID, {
    name:        'Companion Worker',
    icon:        '🐾',
    description: 'Personality evolution, bond progression, routine sync',
    handler:     _handle,
  });
}

async function _handle(taskType, payload) {
  switch (taskType) {
    case 'evolve_trait':      return _evolveTrait(payload);
    case 'check_consistency': return _checkConsistency();
    case 'tick_routine':      return _tickRoutine();
    default: break;
  }
}

function _evolveTrait({ trait, preference, reason } = {}) {
  if (!trait) return;
  evolveTrait(trait, preference ?? 0.5, reason ?? 'companion_cycle');
}

function _checkConsistency() {
  const result = verifyPersonalityConsistency();
  if (!result.consistent) {
    console.warn('[CompanionWorker] Personality consistency check failed:', result.checks);
  }
}

function _tickRoutine() {
  const core = storage.getCompanionCore();
  const ag   = core?.attachmentGraph ?? {};
  if (ag.userBond > 0.5 && !ag.routineAnchor) {
    storage.patchCompanionCore({
      attachmentGraph: { ...ag, routineAnchor: true, routineAnchoredAt: Date.now() }
    });
  }
}

export function scheduleTraitEvolution(trait, preference, reason) {
  enqueueTask(WORKER_ID, 'evolve_trait', { trait, preference, reason }, 20);
}

export function scheduleConsistencyCheck() {
  enqueueTask(WORKER_ID, 'check_consistency', {}, 10);
}
