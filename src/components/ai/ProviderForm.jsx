// ================================================================
// IMMORTAIL™ Gen2 — PROVIDER FORM
// Add / Edit AI provider. Keys stored locally — never logged.
// ================================================================

import React, { useState, useEffect } from 'react';
import { PROVIDER_CATALOGUE, PROVIDER_TYPES, getCatalogueEntry } from '../../services/ai/modelProfiles.js';
import { addProvider, updateProvider }   from '../../services/ai/providerRegistry.js';
import storage from '../../core/storage.js';

export default function ProviderForm({ editing = null, onDone, onCancel }) {
  const [typeId,    setTypeId]    = useState(editing?.typeId    ?? PROVIDER_TYPES.OLLAMA);
  const [name,      setName]      = useState(editing?.name      ?? '');
  const [baseUrl,   setBaseUrl]   = useState(editing?.baseUrl   ?? '');
  const [apiKey,    setApiKey]    = useState('');          // never pre-fill from storage
  const [model,     setModel]     = useState(editing?.selectedModel ?? '');
  const [priority,  setPriority]  = useState(editing?.priority  ?? 50);
  const [showKey,   setShowKey]   = useState(false);
  const [errors,    setErrors]    = useState({});

  const cat = getCatalogueEntry(typeId);

  // Update defaults when typeId changes
  useEffect(() => {
    if (!editing) {
      setName(cat.name);
      setBaseUrl(cat.baseUrlDefault);
      setModel(cat.defaultModel);
    }
  }, [typeId, editing]);

  const validate = () => {
    const e = {};
    if (!name.trim())    e.name    = 'Name is required';
    if (!baseUrl.trim()) e.baseUrl = 'Base URL is required';
    if (!model.trim())   e.model   = 'Model is required';
    if (cat.authType === 'bearer' && !editing && !apiKey.trim() && typeId !== PROVIDER_TYPES.OLLAMA && typeId !== PROVIDER_TYPES.LMSTUDIO) {
      e.apiKey = 'API key is required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const patch = {
      name:          name.trim(),
      baseUrl:       baseUrl.trim(),
      selectedModel: model.trim(),
      priority:      Number(priority),
    };
    // Only write apiKey if user entered something
    if (apiKey.trim()) patch.apiKey = apiKey.trim();

    if (editing) {
      updateProvider(editing.id, patch);
    } else {
      addProvider(typeId, { ...patch, apiKey: apiKey.trim() });
    }
    onDone?.();
  };

  return (
    <div className="provider-form">
      <h3 className="provider-form__title">
        {editing ? `Edit ${editing.name}` : 'Add AI Provider'}
      </h3>

      {/* Type selector — only for new providers */}
      {!editing && (
        <div className="provider-form__field">
          <label>Provider type</label>
          <div className="provider-form__type-grid">
            {PROVIDER_CATALOGUE.map(p => (
              <button
                key={p.typeId}
                className={`provider-form__type-btn ${typeId === p.typeId ? 'active' : ''}`}
                onClick={() => setTypeId(p.typeId)}
              >
                <span>{p.icon}</span>
                <span>{p.name}</span>
                <span className="provider-form__type-badge">{p.badge}</span>
              </button>
            ))}
          </div>
          {cat?.description && (
            <div className="provider-form__desc">{cat.description}</div>
          )}
        </div>
      )}

      <div className="provider-form__field">
        <label>Display name</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. My Ollama" className={errors.name ? 'error' : ''} />
        {errors.name && <span className="provider-form__error">{errors.name}</span>}
      </div>

      <div className="provider-form__field">
        <label>Base URL</label>
        <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder={cat?.baseUrlDefault} className={errors.baseUrl ? 'error' : ''} />
        {errors.baseUrl && <span className="provider-form__error">{errors.baseUrl}</span>}
      </div>

      {cat?.authType !== 'none' && (
        <div className="provider-form__field">
          <label>{editing ? 'API key (leave blank to keep existing)' : 'API key'}</label>
          <div className="provider-form__key-row">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={editing ? '••••••••••' : 'sk-...'}
              className={errors.apiKey ? 'error' : ''}
              autoComplete="off"
            />
            <button className="provider-form__show-key" onClick={() => setShowKey(v => !v)}>
              {showKey ? '🙈' : '👁️'}
            </button>
          </div>
          {errors.apiKey && <span className="provider-form__error">{errors.apiKey}</span>}
          <span className="provider-form__key-note">🔒 Stored locally only — never sent to servers</span>
        </div>
      )}

      <div className="provider-form__field">
        <label>Default model</label>
        <input value={model} onChange={e => setModel(e.target.value)} placeholder={cat?.defaultModel} className={errors.model ? 'error' : ''} />
        {cat?.knownModels?.length > 0 && (
          <div className="provider-form__known-models">
            {cat.knownModels.slice(0, 5).map(m => (
              <button key={m} className="provider-form__model-chip" onClick={() => setModel(m)}>{m}</button>
            ))}
          </div>
        )}
        {errors.model && <span className="provider-form__error">{errors.model}</span>}
      </div>

      <div className="provider-form__field">
        <label>Priority ({priority})</label>
        <input type="range" min={0} max={100} value={priority} onChange={e => setPriority(e.target.value)} />
        <div className="provider-form__priority-labels">
          <span>Low</span><span>High</span>
        </div>
      </div>

      <div className="provider-form__actions">
        <button className="provider-form__cancel" onClick={onCancel}>Cancel</button>
        <button className="provider-form__save"   onClick={handleSave}>
          {editing ? 'Save changes' : 'Add provider'}
        </button>
      </div>
    </div>
  );
}
