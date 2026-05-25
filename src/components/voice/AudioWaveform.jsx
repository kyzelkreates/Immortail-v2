// ================================================================
// IMMORTAIL™ Run 21 — AUDIO WAVEFORM
// CSS bar waveform driven by mic level from EventBus.
// No canvas. No external libs. Pure React + CSS.
// ================================================================

import React, { useState, useEffect, useRef } from 'react';
import { EventBus } from '../../core/eventBus.js';

const BAR_COUNT = 24;

export default function AudioWaveform({ active = false, height = 48, color = '#7c3aed' }) {
  const [bars, setBars]   = useState(() => Array(BAR_COUNT).fill(4));
  const levelRef          = useRef(0);
  const frameRef          = useRef(null);
  const mountedRef        = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  useEffect(() => {
    const unsub = EventBus.on('SYSTEM::MIC_LEVEL', ({ level }) => {
      levelRef.current = level;
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!active) {
      setBars(Array(BAR_COUNT).fill(4));
      levelRef.current = 0;
      return;
    }

    let phaseOffsets = Array.from({ length: BAR_COUNT }, (_, i) => (i / BAR_COUNT) * Math.PI * 2);

    const tick = () => {
      if (!mountedRef.current) return;
      const lv = levelRef.current;
      const now = Date.now() / 400;

      setBars(phaseOffsets.map((phase, i) => {
        const wave  = (Math.sin(now + phase) + 1) / 2;
        const base  = active ? (lv * 0.7 + wave * 0.3) : 0;
        const h     = Math.max(4, Math.round(base * (height - 4) + 4));
        return h;
      }));

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [active, height]);

  return (
    <div className="audio-waveform" style={{ height }}>
      {bars.map((h, i) => (
        <div
          key={i}
          className="audio-waveform__bar"
          style={{
            height:     h,
            background: color,
            opacity:    active ? 0.7 + (h / height) * 0.3 : 0.2,
            transition: 'height 0.07s ease-out',
          }}
        />
      ))}
    </div>
  );
}
