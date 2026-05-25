// ================================================================
// IMMORTAIL™ Gen2 — PROVIDER CARD
// Glassmorphism card showing provider health, model, latency.
// ================================================================

import React from 'react';
import { STATUS_COLORS, BADGE_STYLE } from '../../services/ai/modelProfiles.js';

export default function ProviderCard({ provider, onTest, onToggle, onEdit, testing = false }) {
  const statusColor = STATUS_COLORS[provider.status] ?? STATUS_COLORS.unknown;
  const badgeStyle  = BADGE_STYLE[provider.badge]    ?? BADGE_STYLE.CLOUD;

  const lastTested = provider.lastTestedAt
    ? new Date(provider.lastTestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'never';

  const latencyLabel = provider.latencyMs != null
    ? `${provider.latencyMs}ms`
    : '—';

  return (
    <div className={`provider-card ${provider.enabled ? 'provider-card--enabled' : 'provider-card--disabled'}`}>
      {/* Header */}
      <div className="provider-card__header">
        <div className="provider-card__title-row">
          <span className="provider-card__icon">{provider.icon}</span>
          <span className="provider-card__name">{provider.name}</span>
          <span className="provider-card__badge" style={badgeStyle}>{provider.badge}</span>
        </div>
        <div className="provider-card__status-row">
          <span
            className="provider-card__status-dot"
            style={{ background: statusColor.color, boxShadow: `0 0 8px ${statusColor.glow}` }}
          />
          <span className="provider-card__status-label">{provider.status}</span>
          {testing && <span className="provider-card__testing-badge">Testing…</span>}
        </div>
      </div>

      {/* Body */}
      <div className="provider-card__body">
        <div className="provider-card__stat">
          <span className="provider-card__stat-label">Model</span>
          <span className="provider-card__stat-value">{provider.selectedModel || '—'}</span>
        </div>
        <div className="provider-card__stat">
          <span className="provider-card__stat-label">Latency</span>
          <span className="provider-card__stat-value"
            style={{ color: provider.latencyMs < 500 ? '#4ade80' : provider.latencyMs < 2000 ? '#fbbf24' : '#f87171' }}>
            {latencyLabel}
          </span>
        </div>
        <div className="provider-card__stat">
          <span className="provider-card__stat-label">Last tested</span>
          <span className="provider-card__stat-value">{lastTested}</span>
        </div>
        {provider.offlineSafe && (
          <div className="provider-card__offline-badge">🏠 offline-safe</div>
        )}
      </div>

      {/* Actions */}
      <div className="provider-card__actions">
        <button
          className="provider-card__btn provider-card__btn--test"
          onClick={() => onTest?.(provider.id)}
          disabled={testing}
        >
          {testing ? '⏳' : '🔌'} Test
        </button>
        <button
          className="provider-card__btn provider-card__btn--toggle"
          onClick={() => onToggle?.(provider.id)}
        >
          {provider.enabled ? '⏸ Disable' : '▶ Enable'}
        </button>
        <button
          className="provider-card__btn provider-card__btn--edit"
          onClick={() => onEdit?.(provider)}
        >
          ✏️ Edit
        </button>
      </div>

      {/* Test history mini-bar */}
      {(provider.testHistory ?? []).length > 0 && (
        <div className="provider-card__history">
          {provider.testHistory.slice(-10).map((t, i) => (
            <span
              key={i}
              className="provider-card__history-dot"
              style={{ background: t.success ? '#4ade80' : '#f87171' }}
              title={t.success ? `${t.latencyMs}ms` : t.error}
            />
          ))}
        </div>
      )}
    </div>
  );
}
