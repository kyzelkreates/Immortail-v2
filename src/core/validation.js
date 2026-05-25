// ================================================================
// IMMORTAIL™ — VALIDATION FOUNDATION
// Validates browser environment and runtime requirements.
// NO UI LOGIC. RETURNS STRUCTURED RESULTS ONLY.
// ================================================================

import { VALIDATION_STATUS } from '../utils/constants.js';
import { ValidationLogger } from '../utils/logger.js';

// ----------------------------------------------------------------
// INTERNAL: Single validation check runner
// ----------------------------------------------------------------

function runCheck(name, fn) {
  try {
    const result = fn();
    const status = result ? VALIDATION_STATUS.PASS : VALIDATION_STATUS.FAIL;
    ValidationLogger.info(`Check [${name}]: ${status}`);
    return { name, status, passed: result, error: null };
  } catch (err) {
    ValidationLogger.error(`Check [${name}]: EXCEPTION — ${err.message}`);
    return { name, status: VALIDATION_STATUS.FAIL, passed: false, error: err.message };
  }
}

// ----------------------------------------------------------------
// INDIVIDUAL CHECKS
// ----------------------------------------------------------------

function checkLocalStorage() {
  if (typeof localStorage === 'undefined') return false;
  const testKey = '__immortail_ls_test__';
  try {
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

function checkIndexedDB() {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

function checkAsyncSupport() {
  try {
    // If this module loaded without error, async/await is supported.
    return typeof Promise !== 'undefined' && typeof Promise.resolve === 'function';
  } catch {
    return false;
  }
}

function checkWebGL() {
  try {
    if (typeof document === 'undefined') return false;
    const canvas = document.createElement('canvas');
    const ctx =
      canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!ctx;
  } catch {
    return false;
  }
}

function checkBrowserCompatibility() {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof fetch !== 'undefined'
  );
}

function checkMobileCompatibility() {
  // Ensure viewport meta tag / safe touch APIs exist
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function'
  );
}

function checkCustomEventsSupport() {
  return typeof CustomEvent !== 'undefined';
}

// ----------------------------------------------------------------
// VALIDATE ENVIRONMENT
// ----------------------------------------------------------------

export function validateEnvironment() {
  ValidationLogger.group('Environment Validation');

  const checks = [
    runCheck('localStorage', checkLocalStorage),
    runCheck('indexedDB', checkIndexedDB),
    runCheck('asyncSupport', checkAsyncSupport),
    runCheck('webGL', checkWebGL),
    runCheck('browserCompatibility', checkBrowserCompatibility),
    runCheck('mobileCompatibility', checkMobileCompatibility),
    runCheck('customEvents', checkCustomEventsSupport),
  ];

  // WebGL is a warning, not a hard failure
  const criticalChecks = checks.filter(
    (c) => c.name !== 'webGL' && c.name !== 'indexedDB'
  );
  const warnChecks = checks.filter(
    (c) => c.name === 'webGL' || c.name === 'indexedDB'
  );

  // Mark warn-only checks
  warnChecks.forEach((c) => {
    if (!c.passed) {
      c.status = VALIDATION_STATUS.WARN;
    }
  });

  const criticalFailed = criticalChecks.filter((c) => !c.passed);
  const passed = criticalFailed.length === 0;

  const result = {
    passed,
    checks,
    criticalFailed: criticalFailed.map((c) => c.name),
    warnings: warnChecks.filter((c) => !c.passed).map((c) => c.name),
    timestamp: Date.now(),
  };

  if (passed) {
    ValidationLogger.info('Environment validation PASSED.');
  } else {
    ValidationLogger.error(
      `Environment validation FAILED. Critical failures: ${result.criticalFailed.join(', ')}`
    );
  }

  ValidationLogger.groupEnd();
  return result;
}

// ----------------------------------------------------------------
// VALIDATE RUNTIME CONTRACTS
// ----------------------------------------------------------------

export function validateRuntimeContracts(runtimeState) {
  ValidationLogger.group('Runtime Contract Validation');

  const checks = [];

  checks.push(
    runCheck('runtimeState_exists', () => runtimeState !== null && typeof runtimeState === 'object')
  );
  checks.push(
    runCheck('runtimeState_hasVersion', () => typeof runtimeState.version === 'string')
  );
  checks.push(
    runCheck('runtimeState_hasStatus', () => typeof runtimeState.status === 'string')
  );
  checks.push(
    runCheck('runtimeState_hasTimestamp', () => typeof runtimeState.initializedAt === 'number')
  );

  const failed = checks.filter((c) => !c.passed);
  const passed = failed.length === 0;

  const result = {
    passed,
    checks,
    failed: failed.map((c) => c.name),
    timestamp: Date.now(),
  };

  if (passed) {
    ValidationLogger.info('Runtime contracts PASSED.');
  } else {
    ValidationLogger.error(
      `Runtime contracts FAILED: ${result.failed.join(', ')}`
    );
  }

  ValidationLogger.groupEnd();
  return result;
}
