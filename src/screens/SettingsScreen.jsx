// ================================================================
// IMMORTAIL™ — SETTINGS SCREEN
// Tabs: Companion · AI Providers · Media Inputs · System
// All state reads/writes through storage.js SSOT.
// NO conditional filtering of Ollama or any provider.
// ================================================================

import React, { useState } from 'react';
import useDog       from "../hooks/useDog.js";
import useCompanionCore from "../hooks/useCompanionCore.js";
import useConfig    from '../hooks/useConfig.js';
import storage      from '../core/storage.js';

const TABS = [
  { id: 'companion', label: '🐾 Companion' },
  { id: 'providers', label: '🤖 AI Providers' },
  { id: 'media',     label: '📷 Media' },
  { id: 'system',    label: '⚙️ System' },
];

export default function SettingsScreen() {
  const { dog, changeName, reset } = useDog();
  const { config, patch }          = useConfig();

  const [activeTab,    setActiveTab]    = useState('companion');
  const [nameInput,    setNameInput]    = useState(dog.name);
  const [saved,        setSaved]        = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const memories  = storage.getMemories();
  const features  = config.features  ?? {};
  const providers = config.providers  ?? {};
  const routes    = config.routes     ?? {};
  const appConfig = config.appConfig  ?? {};

  // ── Companion tab handlers ─────────────────────────────────────

  function handleSaveName(e) {
    e.preventDefault();
    if (!nameInput.trim()) return;
    changeName(nameInput.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  function handleReset() {
    if (!confirmReset) { setConfirmReset(true); return; }
    reset();
    setNameInput('Luna');
    setConfirmReset(false);
  }

  // ── Toggle helpers ─────────────────────────────────────────────

  const toggleFeature  = (key)  => patch(`features.${key}`,           !features[key]);
  const toggleProvider = (name) => patch(`providers.${name}.enabled`,  !providers[name]?.enabled);

  const setOllamaUrl = (url) => patch('providers.ollama.baseUrl', url);
  const setOllamaModel = (m) => patch('providers.ollama.model', m);

  return (
    <div className="screen settings-screen">
      <header className="screen-header">
        <h1>Settings</h1>
        <p className="screen-subtitle">IMMORTAIL™ configuration</p>
      </header>

      {/* Tab bar */}
      <div className="settings-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={'settings-tab' + (activeTab === t.id ? ' active' : '')}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="settings-body">

        {/* ── COMPANION TAB ──────────────────────────────────────── */}
        {activeTab === 'companion' && (
          <>
            <section className="settings-section">
              <h2 className="settings-label">Companion Name</h2>
              <form onSubmit={handleSaveName} className="name-form">
                <input
                  className="name-input"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  maxLength={24}
                  placeholder="Enter a name…"
                />
                <button type="submit" className="btn-primary">
                  {saved ? '✓ Saved' : 'Save'}
                </button>
              </form>
            </section>

            <section className="settings-section">
              <h2 className="settings-label">Stats</h2>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">{dog.totalInteractions}</div>
                  <div className="stat-name">Interactions</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{dog.bonding}%</div>
                  <div className="stat-name">Bond</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{memories.length}</div>
                  <div className="stat-name">Memories</div>
                </div>
              </div>
            </section>

            <section className="settings-section danger-zone">
              <h2 className="settings-label danger">Danger Zone</h2>
              <button
                className={`btn-danger ${confirmReset ? 'confirming' : ''}`}
                onClick={handleReset}
              >
                {confirmReset ? '⚠️ Tap again to confirm' : 'Reset Companion'}
              </button>
              {confirmReset && (
                <p className="danger-note">This erases all companion data. Cannot be undone.</p>
              )}
            </section>
          </>
        )}

        {/* ── AI PROVIDERS TAB ──────────────────────────────────── */}
        {activeTab === 'providers' && (
          <>
            <p className="tab-description">
              AI providers power conversation and behaviour. Toggle and configure each provider below.
            </p>

            {/* Ollama — always shown, no conditional filter */}
            <section className="settings-section">
              <div className="provider-card">
                <div className="provider-header">
                  <div className="provider-info">
                    <span className="provider-icon">🦙</span>
                    <div>
                      <p className="provider-name">Ollama</p>
                      <p className="provider-desc">Local LLM · runs on your device</p>
                    </div>
                  </div>
                  <button
                    className={'toggle-btn' + (providers.ollama?.enabled ? ' on' : '')}
                    onClick={() => toggleProvider('ollama')}
                    aria-label="Toggle Ollama"
                  >
                    {providers.ollama?.enabled ? 'ON' : 'OFF'}
                  </button>
                </div>

                {providers.ollama?.enabled && (
                  <div className="provider-config">
                    <label className="config-label">Base URL</label>
                    <input
                      className="name-input"
                      value={providers.ollama?.baseUrl ?? 'http://localhost:11434'}
                      onChange={e => setOllamaUrl(e.target.value)}
                      placeholder="http://localhost:11434"
                    />
                    <label className="config-label" style={{marginTop:8}}>Model</label>
                    <input
                      className="name-input"
                      value={providers.ollama?.model ?? 'llama3'}
                      onChange={e => setOllamaModel(e.target.value)}
                      placeholder="llama3"
                    />
                    <div className="provider-status">
                      <span className="status-dot active" />
                      <span>Status: {providers.ollama?.status ?? 'active'}</span>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* OpenAI */}
            <section className="settings-section">
              <div className="provider-card">
                <div className="provider-header">
                  <div className="provider-info">
                    <span className="provider-icon">🧠</span>
                    <div>
                      <p className="provider-name">OpenAI</p>
                      <p className="provider-desc">Cloud LLM · requires API key</p>
                    </div>
                  </div>
                  <button
                    className={'toggle-btn' + (providers.openai?.enabled ? ' on' : '')}
                    onClick={() => toggleProvider('openai')}
                    aria-label="Toggle OpenAI"
                  >
                    {providers.openai?.enabled ? 'ON' : 'OFF'}
                  </button>
                </div>
                {providers.openai?.enabled && (
                  <div className="provider-config">
                    <label className="config-label">API Key</label>
                    <input
                      className="name-input"
                      type="password"
                      value={providers.openai?.apiKey ?? ''}
                      onChange={e => patch('providers.openai.apiKey', e.target.value)}
                      placeholder="sk-…"
                    />
                    <label className="config-label" style={{marginTop:8}}>Model</label>
                    <input
                      className="name-input"
                      value={providers.openai?.model ?? 'gpt-4o'}
                      onChange={e => patch('providers.openai.model', e.target.value)}
                      placeholder="gpt-4o"
                    />
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {/* ── MEDIA INPUTS TAB ──────────────────────────────────── */}
        {activeTab === 'media' && (
          <>
            <p className="tab-description">
              Control which media input methods are available in the Media screen.
            </p>

            {[
              { key: 'mediaInput',  label: 'Media Input System', desc: 'Master switch for all media' },
              { key: 'imageInput',  label: 'Image / Camera',     desc: 'Capture photos from camera' },
              { key: 'audioInput',  label: 'Audio Recording',    desc: 'Record voice and audio' },
              { key: 'videoInput',  label: 'Video Upload',       desc: 'Upload video files' },
            ].map(item => (
              <section className="settings-section" key={item.key}>
                <div className="feature-row">
                  <div className="feature-info">
                    <p className="feature-name">{item.label}</p>
                    <p className="feature-desc">{item.desc}</p>
                  </div>
                  <button
                    className={'toggle-btn' + (features[item.key] ? ' on' : '')}
                    onClick={() => toggleFeature(item.key)}
                    aria-label={`Toggle ${item.label}`}
                  >
                    {features[item.key] ? 'ON' : 'OFF'}
                  </button>
                </div>
              </section>
            ))}
          </>
        )}

        {/* ── SYSTEM TAB ────────────────────────────────────────── */}
        {activeTab === 'system' && (
          <>
            <section className="settings-section">
              <h2 className="settings-label">Routing</h2>
              <div className="system-row">
                <span className="system-key">Home URL</span>
                <span className="system-val">{appConfig.homeUrl || '/'}</span>
              </div>
              <div className="system-row">
                <span className="system-key">Home route</span>
                <span className="system-val">{routes.home || '/'}</span>
              </div>
              <div className="system-row">
                <span className="system-key">Memory route</span>
                <span className="system-val">{routes.memory || '/memory'}</span>
              </div>
              <div className="system-row">
                <span className="system-key">Settings route</span>
                <span className="system-val">{routes.settings || '/settings'}</span>
              </div>
            </section>

            <section className="settings-section">
              <h2 className="settings-label">About</h2>
              <div className="about-card">
                <p><strong>IMMORTAIL™</strong></p>
                <p className="about-sub">Local-first companion. All data stays on your device.</p>
                <p className="about-sub about-version">
                  v{appConfig.version ?? '1.0.0'} · Offline-ready · PWA
                </p>
              </div>
            </section>

            <section className="settings-section">
              <h2 className="settings-label">Feature Flags</h2>
              {Object.entries(features).map(([k, v]) => (
                <div className="system-row" key={k}>
                  <span className="system-key">{k}</span>
                  <span className={'system-val flag-' + (v ? 'on' : 'off')}>
                    {v ? '✓ enabled' : '✗ disabled'}
                  </span>
                </div>
              ))}
            </section>
          </>
        )}

      </div>
    </div>
  );
}
