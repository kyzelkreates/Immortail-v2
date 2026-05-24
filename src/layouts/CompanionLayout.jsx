// ================================================================
// IMMORTAIL™ — COMPANION LAYOUT
// Full-bleed layout for the companion 3D screen.
// NO STATE LOGIC. STRUCTURE ONLY.
// ================================================================

import React from 'react';

/**
 * CompanionLayout — full-viewport structure for companion visualization.
 * 3D canvas is injected as a child later.
 * Info overlays are slotted via infoPanel prop.
 */
export function CompanionLayout({ children, infoPanel, onBack }) {
  return (
    <div style={styles.root}>
      {/* Viewport — full bleed for 3D canvas */}
      <div style={styles.viewport}>
        {children}
      </div>

      {/* Floating back button */}
      {onBack && (
        <button
          style={styles.backBtn}
          onClick={onBack}
          aria-label="Go back"
          className="glass"
        >
          ← Back
        </button>
      )}

      {/* Info overlay — emotion / bonding / status */}
      {infoPanel && (
        <div style={styles.infoPanel} className="glass">
          {infoPanel}
        </div>
      )}
    </div>
  );
}

const styles = {
  root: {
    position: 'relative',
    width:    '100%',
    height:   '100dvh',
    background: 'var(--color-bg-deep)',
    overflow: 'hidden',
  },
  viewport: {
    position: 'absolute',
    inset:    0,
    display:  'flex',
    alignItems:     'center',
    justifyContent: 'center',
  },
  backBtn: {
    position:     'absolute',
    top:          'var(--space-4)',
    left:         'var(--space-4)',
    padding:      'var(--space-2) var(--space-3)',
    borderRadius: 'var(--radius-md)',
    border:       '1px solid var(--color-border-muted)',
    background:   'var(--glass-bg)',
    color:        'var(--color-text-secondary)',
    fontSize:     'var(--font-size-sm)',
    cursor:       'pointer',
    zIndex:       'var(--z-raised)',
  },
  infoPanel: {
    position:     'absolute',
    bottom:       'calc(var(--nav-height) + var(--space-4))',
    left:         'var(--space-4)',
    right:        'var(--space-4)',
    borderRadius: 'var(--radius-lg)',
    padding:      'var(--space-4)',
    zIndex:       'var(--z-raised)',
  },
};
