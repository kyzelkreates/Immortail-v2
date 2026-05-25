// ================================================================
// IMMORTAIL™ Gen2 — AI SETTINGS PAGE
// Provider registry + connection testing + model selection.
// ================================================================

import React, { useState } from 'react';
import ProviderList    from '../components/ai/ProviderList.jsx';
import ConnectionTester from '../components/ai/ConnectionTester.jsx';
import ModelSelector    from '../components/ai/ModelSelector.jsx';
import { useProviderHealth } from '../hooks/useProviderHealth.js';

const TABS = [
  { id: 'providers',  label: '⚡ Providers' },
  { id: 'test',       label: '🔌 Test' },
];

export default function AISettingsPage() {
  const [tab, setTab] = useState('providers');
  const { providers }  = useProviderHealth();

  return (
    <div className="ai-settings-page">
      <div className="ai-settings-page__header">
        <div className="ai-settings-page__title-row">
          <span className="ai-settings-page__icon">🧠</span>
          <h1 className="ai-settings-page__title">AI Settings</h1>
        </div>
        <p className="ai-settings-page__subtitle">
          Manage providers, API keys, models, and connectivity.
        </p>
      </div>

      <div className="ai-settings-page__tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`ai-settings-page__tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="ai-settings-page__content">
        {tab === 'providers' && <ProviderList />}
        {tab === 'test'      && <ConnectionTester />}
      </div>
    </div>
  );
}
