// ================================================================
// IMMORTAIL™ — MEMORY SCREEN
// Memory timeline view. READ-ONLY. No engine logic.
// ================================================================

import React, { useState } from 'react';
import { useEventBus }  from '../hooks/useEventBus.js';
import { useDogState }  from '../hooks/useDogState.js';
import { MainLayout }   from '../layouts/MainLayout.jsx';
import { DashboardLayout } from '../layouts/DashboardLayout.jsx';
import {
  formatRelativeTime, formatLabel,
  emotionToEmoji, capitalize,
} from '../utils/formatters.js';
import { cx, seedColor } from '../utils/uiHelpers.js';
import { MEMORY_CATEGORY } from '../dog/memoryEngine.js';

export function MemoryScreen({ onNavigate }) {
  const dogState = useDogState();
  const [events,  setEvents]  = useState([]);
  const [filter,  setFilter]  = useState('all');

  useEventBus('MEMORY_CREATED', (payload) => {
    setEvents((prev) => [
      { ...payload, id: payload.memoryId || Date.now(), receivedAt: Date.now() },
      ...prev.slice(0, 49),
    ]);
  });

  useEventBus('DOG_STATE_UPDATED', (payload) => {
    if (payload?.source === 'bondingEngine' || payload?.source === 'routineEngine') {
      setEvents((prev) => [
        { id: Date.now(), type: payload.source, receivedAt: Date.now() },
        ...prev.slice(0, 49),
      ]);
    }
  });

  const filtered = filter === 'all' ? events : events.filter(e => e.category === filter);

  return (
    <MainLayout screen="memory" onNavigate={onNavigate}>
      <DashboardLayout title="Memory" subtitle="Companion interaction timeline">

        {/* Filter tabs */}
        <div style={styles.filterRow}>
          {['all', ...Object.values(MEMORY_CATEGORY)].map((cat) => (
            <button
              key={cat}
              style={{
                ...styles.filterBtn,
                ...(filter === cat ? styles.filterBtnActive : {}),
              }}
              onClick={() => setFilter(cat)}
            >
              {capitalize(cat)}
            </button>
          ))}
        </div>

        {/* Timeline */}
        {filtered.length === 0 ? (
          <div className="card flex-center" style={styles.empty}>
            <span style={{ fontSize: 32 }}>💭</span>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', textAlign: 'center' }}>
              No memories recorded yet.<br />Interact with your companion to build memories.
            </p>
          </div>
        ) : (
          <div style={styles.timeline}>
            {filtered.map((event) => (
              <MemoryCard key={event.id} event={event} />
            ))}
          </div>
        )}

      </DashboardLayout>
    </MainLayout>
  );
}

function MemoryCard({ event }) {
  const color = seedColor(event.category || event.type || 'memory');
  return (
    <div style={{ ...styles.memCard, borderLeftColor: color }} className="card">
      <div style={styles.memHeader}>
        <span style={{ ...styles.memCategory, color }}>
          {formatLabel(event.category || event.type || 'event')}
        </span>
        <span style={styles.memTime}>{formatRelativeTime(event.receivedAt)}</span>
      </div>
      {event.memoryId && (
        <span style={styles.memId} className="font-mono">id: {event.memoryId}</span>
      )}
    </div>
  );
}

const styles = {
  filterRow: {
    display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap',
    marginBottom: 'var(--space-4)',
  },
  filterBtn: {
    padding:      'var(--space-1) var(--space-3)',
    borderRadius: 'var(--radius-full)',
    border:       '1px solid var(--color-border-muted)',
    background:   'transparent',
    color:        'var(--color-text-muted)',
    fontSize:     'var(--font-size-xs)',
    cursor:       'pointer',
    fontFamily:   'inherit',
    transition:   'all var(--transition-fast)',
  },
  filterBtnActive: {
    background:  'var(--color-accent-primary)',
    color:       '#fff',
    borderColor: 'var(--color-accent-primary)',
  },
  timeline: { display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' },
  empty: {
    flexDirection: 'column', gap: 'var(--space-3)',
    padding: 'var(--space-10)', textAlign: 'center',
  },
  memCard: {
    borderLeft:   '3px solid var(--color-accent-primary)',
    borderRadius: 'var(--radius-md)',
    padding:      'var(--space-3) var(--space-4)',
    background:   'var(--color-bg-surface)',
  },
  memHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  memCategory: { fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semi)' },
  memTime:     { fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' },
  memId:       { fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 4, display: 'block' },
};
