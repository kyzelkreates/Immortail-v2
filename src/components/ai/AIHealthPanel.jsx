// ================================================================
// IMMORTAIL™ Gen2 — AI HEALTH PANEL
// Live summary: online providers, router state, failover log.
// ================================================================

import React, { useState, useEffect } from 'react';
import { useProviderHealth } from '../../hooks/useProviderHealth.js';
import { getRouterState }   from '../../services/ai/aiRouter.js';
import { getFailoverHistory } from '../../services/ai/failoverManager.js';
import { EventBus }          from '../../core/eventBus.js';
import storage               from '../../core/storage.js';

export default function AIHealthPanel() {
  const { providers, onlineCount, enabledCount } = useProviderHealth();
  const [routerState,    setRouterState]    = useState(() => getRouterState());
  const [failoverLog,    setFailoverLog]    = useState(() => getFailoverHistory());
  const [requestLog,     setRequestLog]     = useState(() => storage.getAILog().slice(-10));

  useEffect(() => {
    const refresh = () => {
      setRouterState(getRouterState());
      setFailoverLog(getFailoverHistory());
      setRequestLog(storage.getAILog().slice(-10));
    };
    const u1 = EventBus.on('SYSTEM::AI_REQUEST_SUCCESS', refresh);
    const u2 = EventBus.on('SYSTEM::AI_REQUEST_FAILED',  refresh);
    const u3 = EventBus.on('SYSTEM::AI_FAILOVER_TRIGGERED', refresh);
    const u4 = EventBus.on('SYSTEM::AI_TEST_COMPLETE',   refresh);
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const healthPct = enabledCount > 0 ? Math.round((onlineCount / enabledCount) * 100) : 0;

  return (
    <div className="ai-health-panel">
      {/* Headline stats */}
      <div className="ai-health-panel__stats">
        <StatBox label="Providers online" value={`${onlineCount}/${enabledCount}`}
          color={onlineCount === enabledCount ? '#4ade80' : onlineCount > 0 ? '#fbbf24' : '#f87171'} />
        <StatBox label="Requests sent"    value={routerState.totalRequests}  color="#60a5fa" />
        <StatBox label="Failovers"        value={routerState.totalFailovers} color="#a78bfa" />
        <StatBox label="Errors"           value={routerState.totalFailures}  color="#f87171" />
      </div>

      {/* Health bar */}
      <div className="ai-health-panel__bar-wrap">
        <div className="ai-health-panel__bar-label">System health</div>
        <div className="ai-health-panel__bar">
          <div
            className="ai-health-panel__bar-fill"
            style={{
              width: `${healthPct}%`,
              background: healthPct === 100 ? '#4ade80' : healthPct > 50 ? '#fbbf24' : '#f87171',
            }}
          />
        </div>
        <div className="ai-health-panel__bar-pct">{healthPct}%</div>
      </div>

      {/* Router status */}
      <div className="ai-health-panel__section">
        <div className="ai-health-panel__section-title">Router status</div>
        <div className="ai-health-panel__row">
          <span>Last provider</span>
          <span>{routerState.lastProviderUsed ?? '—'}</span>
        </div>
        <div className="ai-health-panel__row">
          <span>Offline mode</span>
          <span style={{ color: routerState.isOffline ? '#f87171' : '#4ade80' }}>
            {routerState.isOffline ? 'YES' : 'No'}
          </span>
        </div>
        {routerState.lastSuccessAt && (
          <div className="ai-health-panel__row">
            <span>Last success</span>
            <span>{new Date(routerState.lastSuccessAt).toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      {/* Failover log */}
      {failoverLog.length > 0 && (
        <div className="ai-health-panel__section">
          <div className="ai-health-panel__section-title">Recent failovers</div>
          {failoverLog.slice(-4).map((f, i) => (
            <div key={i} className="ai-health-panel__log-row">
              <span className="ai-health-panel__log-time">
                {new Date(f.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span>{f.from} → {f.to ?? 'none'}</span>
              <span className="ai-health-panel__log-reason">{f.reason}</span>
            </div>
          ))}
        </div>
      )}

      {/* Recent request log */}
      <div className="ai-health-panel__section">
        <div className="ai-health-panel__section-title">Recent requests</div>
        {requestLog.length === 0 && <div className="ai-health-panel__empty">No requests yet</div>}
        {requestLog.map(r => (
          <div key={r.id} className="ai-health-panel__log-row">
            <span className="ai-health-panel__log-time">
              {new Date(r.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className={r.success === false ? 'ai-health-panel__fail' : ''}>
              {r.type === 'failover' ? '↩️ failover' : r.typeId ?? r.type ?? '?'}
            </span>
            {r.latencyMs && <span>{r.latencyMs}ms</span>}
            {r.error && <span className="ai-health-panel__fail">{r.error.slice(0, 30)}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div className="ai-stat-box">
      <div className="ai-stat-box__value" style={{ color }}>{value}</div>
      <div className="ai-stat-box__label">{label}</div>
    </div>
  );
}
