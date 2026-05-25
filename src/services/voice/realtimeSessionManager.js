// ================================================================
// IMMORTAIL™ Run 21 — REALTIME SESSION MANAGER
// Long-running session stability: reconnect, recovery, sync.
// Watches session health and triggers repair without user input.
// ================================================================

import { EventBus }       from '../../core/eventBus.js';
import storage            from '../../core/storage.js';
import { isSessionActive, startVoiceSession, stopVoiceSession, getSessionState } from './voiceStreamManager.js';

const HEALTH_INTERVAL_MS = 15000;   // check every 15s
const MAX_SILENT_MS      = 60000;   // restart if no activity for 60s
const MAX_ERRORS         = 3;       // stop session after 3 consecutive errors

const _monitor = {
  timer:       null,
  errorCount:  0,
  lastActivityTs: Date.now(),
  reconnectCount: 0,
};

// ── Public API ────────────────────────────────────────────────

export function startSessionMonitor() {
  if (_monitor.timer) return;
  _resetActivity();
  _monitor.errorCount     = 0;
  _monitor.reconnectCount = 0;

  _monitor.timer = setInterval(_healthCheck, HEALTH_INTERVAL_MS);

  _monitor.unsubs = [
    EventBus.on('SYSTEM::VOICE_TURN_START',   _resetActivity),
    EventBus.on('SYSTEM::STT_FINAL',          _resetActivity),
    EventBus.on('SYSTEM::TTS_ENDED',          _resetActivity),
    EventBus.on('SYSTEM::VOICE_STREAM_ERROR', ({ code }) => _handleError(code)),
    EventBus.on('SYSTEM::MIC_ERROR',          () => _handleError('mic')),
  ];
}

export function stopSessionMonitor() {
  if (_monitor.timer) { clearInterval(_monitor.timer); _monitor.timer = null; }
  (_monitor.unsubs ?? []).forEach(u => u());
  _monitor.unsubs = [];
}

export function getMonitorStats() {
  return {
    errorCount:     _monitor.errorCount,
    reconnectCount: _monitor.reconnectCount,
    lastActivityAt: _monitor.lastActivityTs,
    idleMs:         Date.now() - _monitor.lastActivityTs,
  };
}

// ── Health check ─────────────────────────────────────────────

async function _healthCheck() {
  if (!isSessionActive()) return;

  const session    = getSessionState();
  const idleMs     = Date.now() - _monitor.lastActivityTs;

  // Stuck in processing for too long — recover
  if (session.state === 'processing' && idleMs > 30000) {
    console.warn('[SessionMonitor] Stuck in processing — forcing recovery');
    _attemptRecover();
    return;
  }

  // No activity in 60s in listening mode — check mic still alive
  if (session.state === 'listening' && idleMs > MAX_SILENT_MS) {
    // This is fine — user just hasn't spoken. Log but don't disrupt.
    storage.patchVoiceSession({ lastHealthCheck: Date.now(), status: 'healthy_idle' });
    return;
  }

  storage.patchVoiceSession({ lastHealthCheck: Date.now(), status: 'healthy' });
  EventBus.emit('SYSTEM::VOICE_HEALTH_OK', { idleMs });
}

function _handleError(code) {
  _monitor.errorCount++;
  storage.patchVoiceSession({ lastError: code, errorCount: _monitor.errorCount });

  if (_monitor.errorCount >= MAX_ERRORS) {
    console.error('[SessionMonitor] Max errors reached — stopping voice session');
    stopVoiceSession();
    stopSessionMonitor();
    EventBus.emit('SYSTEM::VOICE_SESSION_FATAL', { code, errorCount: _monitor.errorCount });
    return;
  }

  // Non-fatal — attempt silent recovery
  setTimeout(_attemptRecover, 1000);
}

async function _attemptRecover() {
  _monitor.reconnectCount++;
  console.log(`[SessionMonitor] Recovery attempt #${_monitor.reconnectCount}`);
  EventBus.emit('SYSTEM::VOICE_RECONNECTING', { attempt: _monitor.reconnectCount });

  try {
    const savedSession = storage.getVoiceSession();
    const mode         = savedSession.mode ?? 'auto';

    stopVoiceSession();
    await new Promise(r => setTimeout(r, 500));
    await startVoiceSession({ mode });
    _monitor.errorCount = 0;
    _resetActivity();

    EventBus.emit('SYSTEM::VOICE_RECONNECTED', { attempt: _monitor.reconnectCount });
  } catch (err) {
    console.error('[SessionMonitor] Recovery failed:', err.message);
  }
}

function _resetActivity() {
  _monitor.lastActivityTs = Date.now();
}
