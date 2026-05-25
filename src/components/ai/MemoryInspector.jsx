// ================================================================
// IMMORTAIL™ Gen2 — MEMORY INSPECTOR
// Search memory, view stats, export, add milestones.
// ================================================================

import React, { useState } from 'react';
import { useMemoryEngine } from '../../hooks/useMemoryEngine.js';

export default function MemoryInspector() {
  const {
    stats, results, query, search,
    doExport, clearHistory, addMilestone,
    recentTurns, refresh,
  } = useMemoryEngine();

  const [milestoneInput, setMilestoneInput] = useState('');
  const [milestoneDetail, setMilestoneDetail] = useState('');
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [tab, setTab] = useState('stats');

  const handleExport = () => {
    const snap = doExport();
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `immortail_memory_${Date.now()}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleMilestoneSave = () => {
    if (!milestoneInput.trim()) return;
    addMilestone(milestoneInput.trim(), milestoneDetail.trim());
    setMilestoneInput('');
    setMilestoneDetail('');
    setShowMilestoneForm(false);
  };

  return (
    <div className="memory-inspector">
      <div className="memory-inspector__tabs">
        {['stats', 'search', 'turns', 'milestones'].map(t => (
          <button
            key={t}
            className={`memory-inspector__tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* STATS */}
      {tab === 'stats' && (
        <div className="memory-inspector__stats">
          <StatRow label="Conversation turns"   value={stats.totalTurns} />
          <StatRow label="Summaries"            value={stats.totalSummaries} />
          <StatRow label="Emotional tags"       value={stats.totalEmotional} />
          <StatRow label="Milestones"           value={stats.totalMilestones} />
          <StatRow label="Companion memories"   value={stats.companionMemories} />

          <div className="memory-inspector__actions">
            <button className="memory-inspector__btn" onClick={handleExport}>📤 Export memory</button>
            <button className="memory-inspector__btn memory-inspector__btn--danger"
              onClick={() => { if (confirm('Clear conversation history? Milestones are preserved.')) { clearHistory(); } }}>
              🗑 Clear history
            </button>
          </div>
        </div>
      )}

      {/* SEARCH */}
      {tab === 'search' && (
        <div className="memory-inspector__search">
          <input
            className="memory-inspector__search-input"
            placeholder="Search memories…"
            value={query}
            onChange={e => search(e.target.value)}
          />
          {results && (
            <div className="memory-inspector__results">
              {results.turns.length > 0 && (
                <Section label={`Turns (${results.turns.length})`}>
                  {results.turns.slice(-5).map((t, i) => (
                    <div key={i} className="memory-inspector__result-row">
                      <span className="memory-inspector__result-role">{t.role}</span>
                      <span>{(t.content ?? '').slice(0, 100)}</span>
                    </div>
                  ))}
                </Section>
              )}
              {results.milestones.length > 0 && (
                <Section label={`Milestones (${results.milestones.length})`}>
                  {results.milestones.map((m, i) => (
                    <div key={i} className="memory-inspector__result-row">
                      <span className="memory-inspector__milestone-title">🏆 {m.title}</span>
                      <span>{m.detail}</span>
                    </div>
                  ))}
                </Section>
              )}
              {results.summaries.length === 0 && results.turns.length === 0 && results.milestones.length === 0 && (
                <div className="memory-inspector__empty">No results for "{query}"</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* RECENT TURNS */}
      {tab === 'turns' && (
        <div className="memory-inspector__turns">
          {recentTurns.length === 0 && (
            <div className="memory-inspector__empty">No conversation turns yet.</div>
          )}
          {[...recentTurns].reverse().map((t, i) => (
            <div key={i} className={`memory-inspector__turn memory-inspector__turn--${t.role}`}>
              <div className="memory-inspector__turn-header">
                <span className="memory-inspector__turn-role">{t.role}</span>
                {t.emotion?.detected && (
                  <span className="memory-inspector__turn-emotion">{t.emotion.detected}</span>
                )}
                {t.provider && <span className="memory-inspector__turn-provider">{t.provider}</span>}
              </div>
              <div className="memory-inspector__turn-content">
                {(t.content ?? '').slice(0, 200)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MILESTONES */}
      {tab === 'milestones' && (
        <div className="memory-inspector__milestones">
          <button
            className="memory-inspector__btn"
            onClick={() => setShowMilestoneForm(v => !v)}
          >
            ＋ Add milestone
          </button>

          {showMilestoneForm && (
            <div className="memory-inspector__milestone-form">
              <input
                placeholder="Milestone title…"
                value={milestoneInput}
                onChange={e => setMilestoneInput(e.target.value)}
              />
              <input
                placeholder="Detail (optional)"
                value={milestoneDetail}
                onChange={e => setMilestoneDetail(e.target.value)}
              />
              <div className="memory-inspector__milestone-actions">
                <button onClick={() => setShowMilestoneForm(false)}>Cancel</button>
                <button className="primary" onClick={handleMilestoneSave}>Save</button>
              </div>
            </div>
          )}

              <div className="memory-inspector__milestone-note">
            Milestones are permanently protected and never deleted.
            Count: <strong>{stats.totalMilestones}</strong>
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div className="memory-inspector__stat-row">
      <span className="memory-inspector__stat-label">{label}</span>
      <span className="memory-inspector__stat-value">{value}</span>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div className="memory-inspector__section">
      <div className="memory-inspector__section-label">{label}</div>
      {children}
    </div>
  );
}
