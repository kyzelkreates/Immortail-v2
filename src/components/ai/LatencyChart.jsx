// ================================================================
// IMMORTAIL™ Gen2 — LATENCY CHART
// CSS-only sparkline chart. No canvas, no external deps.
// Shows last 10 test results per provider.
// ================================================================

import React from 'react';
import { useProviderHealth } from '../../hooks/useProviderHealth.js';

export default function LatencyChart() {
  const { providers } = useProviderHealth();
  const provs = providers.filter(p => p.enabled && (p.testHistory ?? []).length > 0);

  if (provs.length === 0) {
    return <div className="latency-chart latency-chart--empty">No test data yet. Run a connection test.</div>;
  }

  return (
    <div className="latency-chart">
      {provs.map(p => {
        const history = (p.testHistory ?? []).slice(-10);
        const maxLatency = Math.max(...history.map(h => h.latencyMs ?? 0), 1);
        return (
          <div key={p.id} className="latency-chart__provider">
            <div className="latency-chart__header">
              <span>{p.icon} {p.name}</span>
              {p.latencyMs != null && (
                <span className="latency-chart__current"
                  style={{ color: p.latencyMs < 500 ? '#4ade80' : p.latencyMs < 2000 ? '#fbbf24' : '#f87171' }}>
                  {p.latencyMs}ms
                </span>
              )}
            </div>

            <div className="latency-chart__bars">
              {history.map((h, i) => {
                const heightPct = h.success && h.latencyMs
                  ? Math.max(8, Math.round((h.latencyMs / maxLatency) * 100))
                  : 4;
                const color = !h.success ? '#f87171'
                  : h.latencyMs < 500  ? '#4ade80'
                  : h.latencyMs < 2000 ? '#fbbf24'
                  : '#fb923c';
                return (
                  <div
                    key={i}
                    className="latency-chart__bar"
                    style={{ height: `${heightPct}%`, background: color }}
                    title={h.success ? `${h.latencyMs}ms` : `Failed: ${h.error ?? '?'}`}
                  />
                );
              })}
              {/* Pad to 10 slots */}
              {Array.from({ length: 10 - history.length }).map((_, i) => (
                <div key={`pad_${i}`} className="latency-chart__bar latency-chart__bar--empty" />
              ))}
            </div>

            <div className="latency-chart__legend">
              <span>oldest</span><span>newest</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
