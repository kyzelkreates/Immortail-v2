// ================================================================
// IMMORTAIL™ — UI FORMATTING HELPERS
// Presentation-layer formatting only. NO BUSINESS LOGIC.
// ================================================================

/**
 * Format a timestamp to a human-readable relative string.
 * @param {number} timestamp — Unix ms
 * @returns {string}
 */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return '—';
  const diff = Date.now() - timestamp;
  const sec  = Math.floor(diff / 1000);
  if (sec < 5)   return 'just now';
  if (sec < 60)  return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60)  return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/**
 * Format a timestamp to a short date string.
 */
export function formatShortDate(timestamp) {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/**
 * Format a number as a percentage string.
 */
export function formatPercent(value, decimals = 0) {
  if (typeof value !== 'number') return '—';
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Capitalize the first letter of a string.
 */
export function capitalize(str) {
  if (!str || typeof str !== 'string') return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format a camelCase or snake_case key to a display label.
 */
export function formatLabel(key) {
  if (!key || typeof key !== 'string') return '';
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value, min = 0, max = 1) {
  if (typeof value !== 'number') return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Map a [0..1] value to a display bar width percentage string.
 */
export function toBarWidth(value) {
  const clamped = clamp(value, 0, 1);
  return `${Math.round(clamped * 100)}%`;
}

/**
 * Map an emotion label to a display emoji.
 */
export function emotionToEmoji(emotion) {
  const map = {
    joy:      '😄',
    calm:     '😌',
    excited:  '⚡',
    anxious:  '😰',
    trusting: '🤝',
    attached: '💙',
    stressed: '😓',
    neutral:  '😐',
  };
  return map[emotion] || '❓';
}

/**
 * Map a bonding tier label to a display string.
 */
export function formatBondingTier(tier) {
  const map = {
    stranger:      'Stranger',
    acquainted:    'Acquainted',
    familiar:      'Familiar',
    bonded:        'Bonded',
    deeply_bonded: 'Deeply Bonded',
  };
  return map[tier] || capitalize(tier || '—');
}

/**
 * Format a boot stage label for display.
 */
export function formatBootStage(stage) {
  if (!stage) return '—';
  return stage
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Safe JSON stringify for debug display.
 */
export function safeStringify(obj, indent = 2) {
  try { return JSON.stringify(obj, null, indent); }
  catch { return '[unserializable]'; }
}

/**
 * Truncate a string to maxLen characters.
 */
export function truncate(str, maxLen = 60) {
  if (!str || typeof str !== 'string') return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '…';
}
