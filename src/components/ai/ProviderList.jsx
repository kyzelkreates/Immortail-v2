// ================================================================
// IMMORTAIL™ Gen2 — PROVIDER LIST
// Full list of registered providers with add/test/edit controls.
// ================================================================

import React, { useState } from 'react';
import ProviderCard from './ProviderCard.jsx';
import ProviderForm from './ProviderForm.jsx';
import { removeProvider }  from '../../services/ai/providerRegistry.js';
import { useProviderHealth } from '../../hooks/useProviderHealth.js';

export default function ProviderList() {
  const { providers, testing, test, toggle, refresh } = useProviderHealth();
  const [editing,    setEditing]    = useState(null);     // provider obj or null
  const [showAdd,    setShowAdd]    = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);     // provider id to delete

  const handleEdit    = (p) => { setEditing(p); setShowAdd(false); };
  const handleAdd     = ()  => { setEditing(null); setShowAdd(true); };
  const handleFormDone= ()  => { setEditing(null); setShowAdd(false); refresh(); };

  const handleDelete = (id) => {
    const ok = removeProvider(id);
    if (!ok) { alert('Built-in providers cannot be removed.'); }
    setConfirmDel(null);
    refresh();
  };

  if (showAdd || editing) {
    return (
      <div className="provider-list">
        <ProviderForm
          editing={editing}
          onDone={handleFormDone}
          onCancel={() => { setEditing(null); setShowAdd(false); }}
        />
      </div>
    );
  }

  return (
    <div className="provider-list">
      <div className="provider-list__header">
        <h2 className="provider-list__title">AI Providers</h2>
        <button className="provider-list__add-btn" onClick={handleAdd}>
          ＋ Add provider
        </button>
      </div>

      {providers.length === 0 && (
        <div className="provider-list__empty">
          No providers registered yet. Add one to get started.
        </div>
      )}

      <div className="provider-list__grid">
        {providers.map(p => (
          <div key={p.id} className="provider-list__card-wrap">
            <ProviderCard
              provider={p}
              testing={!!testing[p.id]}
              onTest={test}
              onToggle={toggle}
              onEdit={handleEdit}
            />
            {!p.isBuiltIn && (
              <button
                className="provider-list__delete-btn"
                onClick={() => setConfirmDel(p.id)}
                title="Remove provider"
              >
                🗑
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Confirm delete overlay */}
      {confirmDel && (
        <div className="provider-list__confirm-overlay">
          <div className="provider-list__confirm-box">
            <p>Remove this provider? This cannot be undone.</p>
            <div className="provider-list__confirm-actions">
              <button onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="danger" onClick={() => handleDelete(confirmDel)}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
