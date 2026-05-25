// ================================================================
// IMMORTAIL™ Gen2 — MODEL SELECTOR
// Dropdown to pick active model for a provider.
// Shows known models + fetched models merged, no duplicates.
// ================================================================

import React, { useState } from 'react';
import { getCatalogueEntry } from '../../services/ai/modelProfiles.js';
import { updateProvider }    from '../../services/ai/providerRegistry.js';

export default function ModelSelector({ provider, onUpdate }) {
  const cat      = getCatalogueEntry(provider.typeId);
  const known    = cat?.knownModels ?? [];
  const fetched  = provider.fetchedModels ?? [];
  const allModels = [...new Set([...known, ...fetched])];

  const [custom, setCustom] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const select = (model) => {
    updateProvider(provider.id, { selectedModel: model });
    onUpdate?.();
  };

  const applyCustom = () => {
    if (custom.trim()) {
      select(custom.trim());
      setShowCustom(false);
      setCustom('');
    }
  };

  return (
    <div className="model-selector">
      <div className="model-selector__label">Model</div>
      <select
        className="model-selector__select"
        value={provider.selectedModel ?? ''}
        onChange={e => select(e.target.value)}
      >
        {allModels.length === 0 && (
          <option value="">— enter model name —</option>
        )}
        {allModels.map(m => (
          <option key={m} value={m}>{m}</option>
        ))}
        <option value="__custom__">+ custom model…</option>
      </select>

      {(showCustom || provider.selectedModel === '__custom__') && (
        <div className="model-selector__custom">
          <input
            type="text"
            placeholder="e.g. llama3:70b"
            value={custom}
            onChange={e => setCustom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyCustom()}
            className="model-selector__input"
            autoFocus
          />
          <button className="model-selector__btn" onClick={applyCustom}>Apply</button>
        </div>
      )}

      <button className="model-selector__manual" onClick={() => setShowCustom(v => !v)}>
        ✏️ type manually
      </button>
    </div>
  );
}
