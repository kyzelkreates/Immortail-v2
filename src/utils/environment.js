// ================================================================
// IMMORTAIL™ — ENVIRONMENT DETECTION UTILITIES
// Detects platform, device, and browser capabilities.
// ================================================================

import { EnvLogger } from './logger.js';

// ----------------------------------------------------------------
// DEVICE DETECTION
// ----------------------------------------------------------------

export function isMobile() {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export function isTablet() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent);
}

export function isDesktop() {
  return !isMobile() && !isTablet();
}

// ----------------------------------------------------------------
// TOUCH SUPPORT
// ----------------------------------------------------------------

export function hasTouchSupport() {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    navigator.msMaxTouchPoints > 0
  );
}

// ----------------------------------------------------------------
// BROWSER DETECTION
// ----------------------------------------------------------------

export function getBrowserType() {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;

  if (ua.includes('Firefox')) return 'firefox';
  if (ua.includes('Edg/')) return 'edge';
  if (ua.includes('OPR') || ua.includes('Opera')) return 'opera';
  if (ua.includes('Chrome') && !ua.includes('Chromium')) return 'chrome';
  if (ua.includes('Chromium')) return 'chromium';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'safari';
  return 'unknown';
}

export function getBrowserVersion() {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  const match = ua.match(/(Chrome|Firefox|Safari|Edg|OPR)\/?([\d.]+)/);
  return match ? match[2] : 'unknown';
}

// ----------------------------------------------------------------
// ONLINE STATUS
// ----------------------------------------------------------------

export function isOnline() {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

// ----------------------------------------------------------------
// PWA MODE
// ----------------------------------------------------------------

export function isPWAMode() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

// ----------------------------------------------------------------
// PLATFORM DETECTION
// ----------------------------------------------------------------

export function getPlatform() {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;

  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Win/.test(navigator.platform)) return 'windows';
  if (/Mac/.test(navigator.platform)) return 'macos';
  if (/Linux/.test(navigator.platform)) return 'linux';
  return 'unknown';
}

// ----------------------------------------------------------------
// RUNTIME MODE
// ----------------------------------------------------------------

export function getRuntimeMode() {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
    return process.env.NODE_ENV;
  }
  return 'production';
}

// ----------------------------------------------------------------
// FULL ENVIRONMENT SNAPSHOT
// ----------------------------------------------------------------

export function getEnvironmentSnapshot() {
  const snapshot = {
    isMobile: isMobile(),
    isTablet: isTablet(),
    isDesktop: isDesktop(),
    hasTouchSupport: hasTouchSupport(),
    browserType: getBrowserType(),
    browserVersion: getBrowserVersion(),
    platform: getPlatform(),
    isOnline: isOnline(),
    isPWAMode: isPWAMode(),
    runtimeMode: getRuntimeMode(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    language: typeof navigator !== 'undefined' ? navigator.language : 'unknown',
    screenWidth: typeof window !== 'undefined' ? window.screen.width : 0,
    screenHeight: typeof window !== 'undefined' ? window.screen.height : 0,
    devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
  };

  EnvLogger.info('Environment snapshot captured.', snapshot);
  return snapshot;
}
