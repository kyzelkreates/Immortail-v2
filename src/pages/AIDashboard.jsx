// ================================================================
// IMMORTAIL™ Gen2 — AI DASHBOARD
// Cinematic live monitoring: health, workers, memory, personality.
// ================================================================

import React, { useState } from 'react';
import AIHealthPanel     from '../components/ai/AIHealthPanel.jsx';
import WorkerStatusPanel from '../components/ai/WorkerStatusPanel.jsx';
import MemoryInspector   from '../components/ai/MemoryInspector.jsx';
import PersonalityViewer from '../components/ai/PersonalityViewer.jsx';
import LatencyChart      from '../components/ai/LatencyChart.jsx';

const PANELS = [
  { id: 'health',      label: '💓 Health',       Component: AIHealthPanel     },
  { id: 'workers',     label: '⚙️ Workers',      Component: WorkerStatusPanel },
  { id: 'memory',      label: '🧠 Memory',       Component: MemoryInspector   },
  { id: 'personality', label: '🐾 Personality',  Component: PersonalityViewer },
  { id: 'latency',     label: '📊 Latency',      Component: LatencyChart      },
];

export default function AIDashboard() {
  const [activePanel, setActivePanel] = useState('health');
  const Panel = PANELS.find(p => p.id === activePanel)?.Component ?? AIHealthPanel;

  return (
    <div className="ai-dashboard">
      {/* Header */}
      <div className="ai-dashboard__header">
        <div className="ai-dashboard__title-row">
          <span className="ai-dashboard__pulse-dot" />
          <h1 className="ai-dashboard__title">AI Dashboard</h1>
        </div>
        <p className="ai-dashboard__subtitle">Live system monitoring</p>
      </div>

      {/* Panel nav */}
      <div className="ai-dashboard__nav">
        {PANELS.map(p => (
          <button
            key={p.id}
            className={`ai-dashboard__nav-btn ${activePanel === p.id ? 'active' : ''}`}
            onClick={() => setActivePanel(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Active panel */}
      <div className="ai-dashboard__panel">
        <Panel />
      </div>
    </div>
  );
}
