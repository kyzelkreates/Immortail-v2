// ================================================================
// IMMORTAIL™ MVP — MEMORY SERVICE
// Lightweight interaction history. No AI, no weighting complexity.
// ================================================================

import storage from './storage.js';

export const MEMORY_CATEGORY = {
  INTERACTION: 'interaction',
  MILESTONE:   'milestone',
  SYSTEM:      'system',
};

/**
 * getMemories()
 * Returns all stored memories, newest first.
 */
export function getMemories() {
  return storage.getMemories().slice().reverse();
}

/**
 * getRecentMemories(n)
 * Returns the N most recent memories.
 */
export function getRecentMemories(n = 20) {
  return getMemories().slice(0, n);
}

/**
 * addMilestone(label)
 * Records a special milestone (e.g. first interaction, bonding level reached).
 */
export function addMilestone(label) {
  storage.addMemory({
    category: MEMORY_CATEGORY.MILESTONE,
    label,
    ts: Date.now(),
  });
}

/**
 * clearMemories()
 * Wipes all interaction history.
 */
export function clearMemories() {
  storage.saveMemories([]);
}

/**
 * formatMemoryDate(ts)
 * Human-readable timestamp for UI display.
 */
export function formatMemoryDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1)    return 'just now';
  if (diffMins < 60)   return `${diffMins}m ago`;
  if (diffHours < 24)  return `${diffHours}h ago`;
  if (diffDays < 7)    return `${diffDays}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
