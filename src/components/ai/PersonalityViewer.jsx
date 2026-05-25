// ================================================================
// IMMORTAIL™ Gen2 — PERSONALITY VIEWER
// Read-only view of current personality traits + consistency status.
// ================================================================

import React, { useState, useEffect } from 'react';
import { getPersonalitySnapshot, verifyPersonalityConsistency } from '../../services/ai/personalityEngine.js';
import { EventBus } from '../../core/eventBus.js';
import storage from '../../core/storage.js';

const TRAIT_LABELS = {
  curiosity:      { label: 'Curiosity',      icon: '🔭' },
  playfulness:    { label: 'Playfulness',    icon: '🎾' },
  calmness:       { label: 'Calmness',       icon: '🌊' },
  attachment:     { label: 'Attachment',     icon: '🐾' },
  responsiveness: { label: 'Responsiveness', icon: '⚡' },
  independence:   { label: 'Independence',   icon: '🌿' },
};

export default function PersonalityViewer() {
  const [snap,  setSnap]  = useState(() => getPersonalitySnapshot());
  const [check, setCheck] = useState(() => verifyPersonalityConsistency());

  const refresh = () => {
    setSnap(getPersonalitySnapshot());
    setCheck(verifyPersonalityConsistency());
  };

  useEffect(() => {
    const u1 = EventBus.on('SYSTEM::PERSONALITY_TRAIT_EVOLVED', refresh);
    const u2 = EventBus.on('SYSTEM::PERSONALITY_DRIFT_CORRECTED', refresh);
    return () => { u1(); u2(); };
  }, []);

  const traits    = snap.coreTraits    ?? {};
  const baselines = snap.baselineTraits ?? {};

  return (
    <div className="personality-viewer">
      {/* Consistency badge */}
      <div className={`personality-viewer__badge ${check.consistent ? 'ok' : 'warn'}`}>
        {check.consistent
          ? '✅ Personality consistent'
          : '⚠️ Inconsistency detected'}
      </div>

      {/* Drift index */}
      <div className="personality-viewer__drift">
        <span>Drift index</span>
        <span style={{ color: (snap.personalitySnapshot?.driftIndex ?? 0) < 0.1 ? '#4ade80' : '#f87171' }}>
          {((snap.personalitySnapshot?.driftIndex ?? 0) * 100).toFixed(1)}%
        </span>
      </div>

      {/* Trait bars */}
      <div className="personality-viewer__traits">
        {Object.entries(TRAIT_LABELS).map(([key, meta]) => {
          const val      = traits[key] ?? 0;
          const baseline = baselines[key] ?? val;
          const pct      = Math.round(val * 100);
          const bPct     = Math.round(baseline * 100);
          return (
            <div key={key} className="personality-viewer__trait">
              <div className="personality-viewer__trait-header">
                <span>{meta.icon} {meta.label}</span>
                <span className="personality-viewer__trait-value">{pct}%</span>
              </div>
              <div className="personality-viewer__trait-track">
                {/* Baseline marker */}
                <div
                  className="personality-viewer__trait-baseline"
                  style={{ left: `${bPct}%` }}
                  title={`Baseline: ${bPct}%`}
                />
                {/* Current fill */}
                <div
                  className="personality-viewer__trait-fill"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, #6366f1, #a78bfa)`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Evolution mode */}
      <div className="personality-viewer__meta">
        <span>Evolution: {snap.evolutionRate ?? 'slow'}</span>
        <span>Mode: {snap.adaptationMode ?? 'safe'}</span>
        <span>Log: {(snap.evolutionLog ?? []).length} entries</span>
      </div>

      {/* Bond stage */}
      <div className="personality-viewer__bond">
        <span>Bond stage</span>
        <span className="personality-viewer__bond-stage">
          {storage.getCompanionCore()?.attachmentGraph?.bondStage ?? '—'}
        </span>
      </div>
    </div>
  );
}
