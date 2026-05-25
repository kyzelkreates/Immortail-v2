// ================================================================
// IMMORTAIL™ — SETTINGS SCREEN
// Tabs: Companion · AI Providers · Media Inputs · System
// All state reads/writes through storage.js SSOT.
// Providers: Ollama · Groq · OpenAI · LM Studio · LocalAI
//            Mistral · HuggingFace · OpenRouter · Anthropic
// ================================================================

import React, { useState } from 'react';
import useDog            from '../hooks/useDog.js';
import useCompanionCore  from '../hooks/useCompanionCore.js';
import useConfig         from '../hooks/useConfig.js';
import storage           from '../core/storage.js';

const TABS = [
  { id: 'companion', label: '🐾 Companion'   },
  { id: 'providers', label: '🤖 AI Providers' },
  { id: 'media',     label: '📷 Media'        },
  { id: 'system',    label: '⚙️ System'        },
];

// ── Full provider catalogue ────────────────────────────────────
const PROVIDER_CATALOGUE = [
  {
    id:       'ollama',
    icon:     '🦙',
    name:     'Ollama',
    desc:     'Local LLM · runs entirely on-device',
    type:     'local',
    fields: [
      { key: 'baseUrl', label: 'Base URL',  placeholder: 'http://localhost:11434', type: 'text'     },
      { key: 'model',   label: 'Model',     placeholder: 'llama3',                 type: 'text'     },
    ],
    badge:    'LOCAL',
  },
  {
    id:       'groq',
    icon:     '⚡',
    name:     'Groq',
    desc:     'Ultra-fast cloud inference · Llama · Mixtral · Gemma',
    type:     'cloud',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'gsk_…',          type: 'password' },
      { key: 'model',  label: 'Model',   placeholder: 'llama3-8b-8192', type: 'text'     },
    ],
    badge:    'FAST',
    docsUrl:  'https://console.groq.com/keys',
  },
  {
    id:       'lmstudio',
    icon:     '🖥️',
    name:     'LM Studio',
    desc:     'Local server · OpenAI-compatible API',
    type:     'local',
    fields: [
      { key: 'baseUrl', label: 'Base URL', placeholder: 'http://localhost:1234/v1', type: 'text' },
      { key: 'model',   label: 'Model',    placeholder: 'local-model',              type: 'text' },
    ],
    badge:    'LOCAL',
  },
  {
    id:       'localai',
    icon:     '🏠',
    name:     'LocalAI',
    desc:     'Self-hosted · OpenAI-compatible · any GGUF model',
    type:     'local',
    fields: [
      { key: 'baseUrl', label: 'Base URL', placeholder: 'http://localhost:8080/v1', type: 'text' },
      { key: 'model',   label: 'Model',    placeholder: 'gpt-3.5-turbo',            type: 'text' },
    ],
    badge:    'LOCAL',
  },
  {
    id:       'openrouter',
    icon:     '🔀',
    name:     'OpenRouter',
    desc:     'Route to 100+ models · Llama · Mistral · Claude · free tiers',
    type:     'cloud',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'sk-or-…',                            type: 'password' },
      { key: 'model',  label: 'Model',   placeholder: 'meta-llama/llama-3-8b-instruct:free', type: 'text'     },
    ],
    badge:    'MULTI',
    docsUrl:  'https://openrouter.ai/keys',
  },
  {
    id:       'huggingface',
    icon:     '🤗',
    name:     'HuggingFace',
    desc:     'Inference API · thousands of open-source models',
    type:     'cloud',
    fields: [
      { key: 'apiKey', label: 'API Key (HF Token)', placeholder: 'hf_…',                                type: 'password' },
      { key: 'model',  label: 'Model',               placeholder: 'mistralai/Mistral-7B-Instruct-v0.2', type: 'text'     },
    ],
    badge:    'OPEN',
    docsUrl:  'https://huggingface.co/settings/tokens',
  },
  {
    id:       'mistral',
    icon:     '🌬️',
    name:     'Mistral AI',
    desc:     'Mistral · Mixtral · Codestral cloud API',
    type:     'cloud',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: '…',              type: 'password' },
      { key: 'model',  label: 'Model',   placeholder: 'mistral-small', type: 'text'     },
    ],
    badge:    'OPEN',
    docsUrl:  'https://console.mistral.ai/api-keys/',
  },
  {
    id:       'anthropic',
    icon:     '🔬',
    name:     'Anthropic',
    desc:     'Claude 3 series · strong reasoning',
    type:     'cloud',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'sk-ant-…',          type: 'password' },
      { key: 'model',  label: 'Model',   placeholder: 'claude-3-haiku-20240307', type: 'text' },
    ],
    badge:    'CLOUD',
    docsUrl:  'https://console.anthropic.com/settings/keys',
  },
  {
    id:       'openai',
    icon:     '🧠',
    name:     'OpenAI',
    desc:     'GPT-4o · GPT-4 · cloud API',
    type:     'cloud',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'sk-…',    type: 'password' },
      { key: 'model',  label: 'Model',   placeholder: 'gpt-4o', type: 'text'     },
    ],
    badge:    'CLOUD',
    docsUrl:  'https://platform.openai.com/api-keys',
  },
];

// ── Badge colour map ───────────────────────────────────────────
const BADGE_STYLE = {
  LOCAL: { background: '#1a3a2a', color: '#4ade80', border: '1px solid #4ade8044' },
  FAST:  { background: '#2a1a3a', color: '#a78bfa', border: '1px solid #a78bfa44' },
  OPEN:  { background: '#1a2a3a', color: '#60a5fa', border: '1px solid #60a5fa44' },
  MULTI: { background: '#2a2a1a', color: '#fbbf24', border: '1px solid #fbbf2444' },
  CLOUD: { background: '#2a1a1a', color: '#f87171', border: '1px solid #f8717144' },
};

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
  const toggleFeature  = (key)  => patch(`features.${key}`, !features[key]);
  const toggleProvider = (id)   => patch(`providers.${id}.enabled`, !providers[id]?.enabled);
  const setField       = (id, key, val) => patch(`providers.${id}.${key}`, val);

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
              Configure the AI providers that power your companion's brain. Local providers keep
              everything on-device. Cloud providers need an API key but offer faster responses.
            </p>

            {/* Legend */}
            <div className="provider-legend">
              {Object.entries(BADGE_STYLE).map(([badge, style]) => (
                <span key={badge} className="provider-badge" style={style}>{badge}</span>
              ))}
            </div>

            {PROVIDER_CATALOGUE.map(prov => {
              const cfg     = providers[prov.id] ?? {};
              const enabled = !!cfg.enabled;

              return (
                <section className="settings-section" key={prov.id}>
                  <div className="provider-card">

                    {/* Header row */}
                    <div className="provider-header">
                      <div className="provider-info">
                        <span className="provider-icon">{prov.icon}</span>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <p className="provider-name">{prov.name}</p>
                            <span
                              className="provider-badge"
                              style={BADGE_STYLE[prov.badge] ?? {}}
                            >
                              {prov.badge}
                            </span>
                          </div>
                          <p className="provider-desc">{prov.desc}</p>
                        </div>
                      </div>
                      <button
                        className={'toggle-btn' + (enabled ? ' on' : '')}
                        onClick={() => toggleProvider(prov.id)}
                        aria-label={`Toggle ${prov.name}`}
                      >
                        {enabled ? 'ON' : 'OFF'}
                      </button>
                    </div>

                    {/* Expanded config when enabled */}
                    {enabled && (
                      <div className="provider-config">
                        {prov.fields.map(field => (
                          <React.Fragment key={field.key}>
                            <label className="config-label">{field.label}</label>
                            <input
                              className="name-input"
                              type={field.type}
                              value={cfg[field.key] ?? ''}
                              onChange={e => setField(prov.id, field.key, e.target.value)}
                              placeholder={field.placeholder}
                              autoComplete="off"
                              autoCorrect="off"
                              spellCheck={false}
                            />
                          </React.Fragment>
                        ))}

                        {/* Docs link for cloud providers */}
                        {prov.docsUrl && (
                          <a
                            href={prov.docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="provider-docs-link"
                          >
                            🔗 Get API key →
                          </a>
                        )}

                        <div className="provider-status" style={{ marginTop: 10 }}>
                          <span className={'status-dot' + (enabled ? ' active' : '')} />
                          <span>Status: {cfg.status ?? (enabled ? 'configured' : 'disabled')}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              );
            })}

            <p className="tab-note">
              💡 The companion uses Ollama as its persistent brain. Groq and other providers handle
              fast multimodal tasks. All providers fall back gracefully if offline.
            </p>
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
              { key: 'imageInput',  label: 'Image / Camera',     desc: 'Capture photos from camera'  },
              { key: 'audioInput',  label: 'Audio Recording',    desc: 'Record voice and audio'       },
              { key: 'videoInput',  label: 'Video Upload',       desc: 'Upload video files'           },
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
            <p className="tab-description">
              Runtime information and system configuration.
            </p>

            <section className="settings-section">
              <h2 className="settings-label">Routes</h2>
              <div className="system-info">
                <div className="system-row">
                  <span className="system-key">Home</span>
                  <span className="system-val">{appConfig.homeUrl || '/'}</span>
                </div>
                <div className="system-row">
                  <span className="system-key">Memory</span>
                  <span className="system-val">{routes.memory || '/memory'}</span>
                </div>
                <div className="system-row">
                  <span className="system-key">Settings</span>
                  <span className="system-val">{routes.settings || '/settings'}</span>
                </div>
              </div>
            </section>

            <section className="settings-section">
              <h2 className="settings-label">Build</h2>
              <div className="system-info">
                <div className="system-row">
                  <span className="system-key">Version</span>
                  <span className="system-val">v{appConfig.version ?? '1.0.0'}</span>
                </div>
                <div className="system-row">
                  <span className="system-key">Mode</span>
                  <span className="system-val">Offline-ready · PWA</span>
                </div>
                <div className="system-row">
                  <span className="system-key">Architecture</span>
                  <span className="system-val">IMMORTAIL™ SSOT v34</span>
                </div>
              </div>
            </section>
          </>
        )}

      </div>
    </div>
  );
}
