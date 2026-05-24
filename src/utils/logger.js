// ================================================================
// IMMORTAIL™ — STRUCTURED LOGGER SYSTEM
// FORMAT: [IMMORTAIL][SYSTEM][TYPE] message
// ================================================================

import { LOG_PREFIX } from './constants.js';

// ----------------------------------------------------------------
// INTERNAL HELPERS
// ----------------------------------------------------------------

function getTimestamp() {
  return new Date().toISOString();
}

function formatMessage(prefix, type, message) {
  return `${prefix}[${type}] [${getTimestamp()}] ${message}`;
}

function isRuntimeSafe() {
  return typeof console !== 'undefined';
}

// ----------------------------------------------------------------
// CORE LOG FUNCTIONS
// ----------------------------------------------------------------

function info(prefix, message, ...args) {
  if (!isRuntimeSafe()) return;
  console.info(formatMessage(prefix, 'INFO', message), ...args);
}

function warn(prefix, message, ...args) {
  if (!isRuntimeSafe()) return;
  console.warn(formatMessage(prefix, 'WARN', message), ...args);
}

function error(prefix, message, ...args) {
  if (!isRuntimeSafe()) return;
  console.error(formatMessage(prefix, 'ERROR', message), ...args);
}

function debug(prefix, message, ...args) {
  if (!isRuntimeSafe()) return;
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return;
  console.debug(formatMessage(prefix, 'DEBUG', message), ...args);
}

function group(label) {
  if (!isRuntimeSafe()) return;
  console.group(`[IMMORTAIL] ${label}`);
}

function groupEnd() {
  if (!isRuntimeSafe()) return;
  console.groupEnd();
}

// ----------------------------------------------------------------
// SCOPED LOGGERS
// ----------------------------------------------------------------

function createScopedLogger(prefix) {
  return {
    info: (message, ...args) => info(prefix, message, ...args),
    warn: (message, ...args) => warn(prefix, message, ...args),
    error: (message, ...args) => error(prefix, message, ...args),
    debug: (message, ...args) => debug(prefix, message, ...args),
    group: (label) => group(label),
    groupEnd: () => groupEnd(),
  };
}

// ----------------------------------------------------------------
// NAMED LOGGER EXPORTS
// ----------------------------------------------------------------

export const SystemLogger = createScopedLogger(LOG_PREFIX.SYSTEM);
export const BootLogger = createScopedLogger(LOG_PREFIX.BOOT);
export const RuntimeLogger = createScopedLogger(LOG_PREFIX.RUNTIME);
export const ValidationLogger = createScopedLogger(LOG_PREFIX.VALIDATION);
export const HydrationLogger = createScopedLogger(LOG_PREFIX.HYDRATION);
export const RecoveryLogger = createScopedLogger(LOG_PREFIX.RECOVERY);
export const SchedulerLogger = createScopedLogger(LOG_PREFIX.SCHEDULER);
export const EnvLogger = createScopedLogger(LOG_PREFIX.ENV);

// ----------------------------------------------------------------
// DEFAULT EXPORT — GENERIC LOGGER
// ----------------------------------------------------------------

const Logger = {
  info: (message, ...args) => info(LOG_PREFIX.SYSTEM, message, ...args),
  warn: (message, ...args) => warn(LOG_PREFIX.SYSTEM, message, ...args),
  error: (message, ...args) => error(LOG_PREFIX.SYSTEM, message, ...args),
  debug: (message, ...args) => debug(LOG_PREFIX.SYSTEM, message, ...args),
  group,
  groupEnd,
  createScopedLogger,
};

export default Logger;
