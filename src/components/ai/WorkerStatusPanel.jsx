// ================================================================
// IMMORTAIL™ Gen2 — WORKER STATUS PANEL
// Live view of all registered workers + task counts.
// ================================================================

import React from 'react';
import { useWorkerStatus } from '../../hooks/useWorkerStatus.js';

const STATUS_COLOR = {
  idle:    '#6b7280',
  active:  '#4ade80',
  paused:  '#fbbf24',
  error:   '#f87171',
  stopped: '#374151',
};

export default function WorkerStatusPanel() {
  const { workers, activeCount, errorCount, totalTasks, resetWorker } = useWorkerStatus();

  return (
    <div className="worker-panel">
      <div className="worker-panel__header">
        <h3 className="worker-panel__title">Worker System</h3>
        <div className="worker-panel__summary">
          <span style={{ color: '#4ade80' }}>{activeCount} active</span>
          {errorCount > 0 && <span style={{ color: '#f87171' }}>{errorCount} error</span>}
          <span style={{ color: '#6b7280' }}>{totalTasks} tasks run</span>
        </div>
      </div>

      <div className="worker-panel__list">
        {workers.length === 0 && (
          <div className="worker-panel__empty">Workers boot after first AI request.</div>
        )}

        {workers.map(w => (
          <div key={w.id} className={`worker-row worker-row--${w.status}`}>
            <div className="worker-row__left">
              <span className="worker-row__icon">{w.icon}</span>
              <div className="worker-row__info">
                <span className="worker-row__name">{w.name}</span>
                <span className="worker-row__desc">{w.description}</span>
              </div>
            </div>

            <div className="worker-row__right">
              <span
                className="worker-row__status"
                style={{
                  color: STATUS_COLOR[w.status] ?? '#6b7280',
                  textShadow: w.status === 'active' ? `0 0 8px ${STATUS_COLOR.active}88` : 'none',
                }}
              >
                {w.status === 'active' && <span className="worker-row__pulse" />}
                {w.status}
              </span>
              <span className="worker-row__tasks">{w.tasksRun ?? 0} tasks</span>
              {w.status === 'error' && (
                <button className="worker-row__reset" onClick={() => resetWorker(w.id)}>
                  ↺ Reset
                </button>
              )}
            </div>

            {w.lastError && (
              <div className="worker-row__error">{w.lastError.slice(0, 80)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
