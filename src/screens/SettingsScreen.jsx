import React, { useState } from 'react';
import useDog from '../hooks/useDog.js';
import storage from '../core/storage.js';

export default function SettingsScreen() {
  const { dog, changeName, reset } = useDog();
  const [nameInput, setNameInput] = useState(dog.name);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

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

  const memories = storage.getMemories();

  return (
    <div className="screen settings-screen">
      <header className="screen-header">
        <h1>Settings</h1>
        <p className="screen-subtitle">Companion configuration</p>
      </header>

      <div className="settings-body">

        {/* Name */}
        <section className="settings-section">
          <h2 className="settings-label">Companion Name</h2>
          <form onSubmit={handleSaveName} className="name-form">
            <input
              className="name-input"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              maxLength={24}
              placeholder="Enter a name…"
              aria-label="Companion name"
            />
            <button type="submit" className="btn-primary">
              {saved ? '✓ Saved' : 'Save'}
            </button>
          </form>
        </section>

        {/* Stats */}
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

        {/* About */}
        <section className="settings-section">
          <h2 className="settings-label">About</h2>
          <div className="about-card">
            <p><strong>IMMORTAIL™</strong></p>
            <p className="about-sub">Local-first companion. All data stays on your device.</p>
            <p className="about-sub about-version">v1.0.0 · Offline-ready · PWA</p>
          </div>
        </section>

        {/* Danger zone */}
        <section className="settings-section danger-zone">
          <h2 className="settings-label danger">Danger Zone</h2>
          <button
            className={`btn-danger ${confirmReset ? 'confirming' : ''}`}
            onClick={handleReset}
          >
            {confirmReset ? '⚠️ Tap again to confirm reset' : 'Reset Companion'}
          </button>
          {confirmReset && (
            <p className="danger-note">This will erase all data. Cannot be undone.</p>
          )}
        </section>

      </div>
    </div>
  );
}
