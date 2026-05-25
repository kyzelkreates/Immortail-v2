// ================================================================
// IMMORTAIL™ Gen2 — CONNECTION TESTER
// Live test panel. Shows latency, models, error detail.
// ================================================================

import React, { useState, useCallback } from 'react';
import { testProvider, testAllProviders } from '../../services/ai/connectionTester.js';
import { useProviderHealth }              from '../../hooks/useProviderHealth.js';

export default function ConnectionTester() {
  const { providers, refresh }  = useProviderHealth();
  const [results, setResults]   = useState({});
  const [running, setRunning]   = useState({});
  const [runningAll, setRunAll]  = useState(false);

  const runTest = useCallback(async (id) => {
    setRunning(r => ({ ...r, [id]: true }));
    const res = await testProvider(id);
    setResults(r => ({ ...r, [id]: res }));
    setRunning(r => ({ ...r, [id]: false }));
    refresh();
  }, [refresh]);

  const runAll = useCallback(async () => {
    setRunAll(true);
    const res = await testAllProviders();
    setResults(r => ({ ...r, ...res }));
    setRunAll(false);
    refresh();
  }, [refresh]);

  return (
    <div className="conn-tester">
      <div className="conn-tester__header">
        <h3 className="conn-tester__title">Connection Tester</h3>
        <button
          className="conn-tester__test-all"
          onClick={runAll}
          disabled={runningAll}
        >
          {runningAll ? '⏳ Testing all…' : '🔌 Test all'}
        </button>
      </div>

      <div className="conn-tester__list">
        {providers.filter(p => p.enabled).map(p => {
          const r   = results[p.id];
          const isRunning = !!running[p.id];
          return (
            <div key={p.id} className="conn-tester__row">
              <div className="conn-tester__row-info">
                <span className="conn-tester__icon">{p.icon}</span>
                <span className="conn-tester__name">{p.name}</span>
              </div>

              <div className="conn-tester__row-result">
                {isRunning && (
                  <span className="conn-tester__status conn-tester__status--testing">
                    ⏳ Testing…
                  </span>
                )}
                {!isRunning && r && (
                  <>
                    <span className={`conn-tester__status conn-tester__status--${r.success ? 'ok' : 'fail'}`}>
                      {r.success ? '✅ Online' : '❌ Failed'}
                    </span>
                    {r.success && (
                      <span className="conn-tester__latency">{r.latencyMs}ms</span>
                    )}
                    {r.success && r.models?.length > 0 && (
                      <span className="conn-tester__models">{r.models.length} models</span>
                    )}
                    {!r.success && r.error && (
                      <span className="conn-tester__error" title={r.error}>
                        {r.error.slice(0, 45)}{r.error.length > 45 ? '…' : ''}
                      </span>
                    )}
                  </>
                )}
                {!isRunning && !r && (
                  <span className="conn-tester__status conn-tester__status--idle">not tested</span>
                )}
              </div>

              <button
                className="conn-tester__btn"
                onClick={() => runTest(p.id)}
                disabled={isRunning}
              >
                Test
              </button>
            </div>
          );
        })}

        {providers.filter(p => p.enabled).length === 0 && (
          <div className="conn-tester__empty">No enabled providers to test.</div>
        )}
      </div>

      {/* Model discovery section */}
      {Object.entries(results).some(([, r]) => r?.models?.length > 0) && (
        <div className="conn-tester__models-section">
          <h4>Discovered models</h4>
          {Object.entries(results).map(([id, r]) => {
            if (!r?.models?.length) return null;
            const p = providers.find(x => x.id === id);
            return (
              <div key={id} className="conn-tester__model-group">
                <span className="conn-tester__model-provider">{p?.icon} {p?.name}</span>
                <div className="conn-tester__model-chips">
                  {r.models.slice(0, 10).map(m => (
                    <span key={m} className="conn-tester__chip">{m}</span>
                  ))}
                  {r.models.length > 10 && (
                    <span className="conn-tester__chip conn-tester__chip--more">
                      +{r.models.length - 10} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
