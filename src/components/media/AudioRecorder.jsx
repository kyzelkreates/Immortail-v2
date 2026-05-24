// ================================================================
// IMMORTAIL™ — AUDIO RECORDER
// Connects to storage.js SSOT. No external storage systems.
// ================================================================

import React, { useState, useRef, useCallback, useEffect } from 'react';
import storage from '../../core/storage.js';
import { EventBus } from '../../core/eventBus.js';

export default function AudioRecorder({ onRecord }) {
  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const timerRef         = useRef(null);

  const [phase,    setPhase]    = useState('idle');      // idle | recording | preview | error
  const [seconds,  setSeconds]  = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [label,    setLabel]    = useState('');
  const [error,    setError]    = useState(null);

  // ── Cleanup on unmount ───────────────────────────────────────

  useEffect(() => () => {
    stopTimer();
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, []);   // eslint-disable-line

  // ── Timer helpers ─────────────────────────────────────────────

  const startTimer = () => {
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
  };
  const stopTimer  = () => { clearInterval(timerRef.current); timerRef.current = null; };

  // ── Start recording ───────────────────────────────────────────

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr     = new MediaRecorder(stream);
      chunksRef.current = [];

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url  = URL.createObjectURL(blob);
        setAudioUrl(url);
        setPhase('preview');
        stopTimer();
      };

      mediaRecorderRef.current = mr;
      mr.start(250);
      setPhase('recording');
      startTimer();
    } catch {
      setError('Microphone access denied or unavailable.');
      setPhase('error');
    }
  }, []);

  // ── Stop recording ────────────────────────────────────────────

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  // ── Persist to SSOT ──────────────────────────────────────────
  // Audio blobs can't be stored directly in localStorage.
  // We store metadata only and flag it as a session recording.
  // The blob lives in-memory until the user navigates away.

  const saveRecording = useCallback(() => {
    const entry = {
      type:      'audio',
      source:    'microphone',
      duration:  seconds,
      label:     label.trim() || `Recording ${new Date().toLocaleTimeString()}`,
      // dataUrl stored as empty — audio is session-only due to localStorage size limits
      // Full IndexedDB path preserved for future run
      note:      'session-only (blob not persisted to localStorage)',
    };
    storage.addMedia(entry);
    EventBus.emit('SYSTEM::MEDIA_ADDED', entry);
    onRecord?.(entry);
    reset();
  }, [seconds, label, onRecord]);

  const reset = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setPhase('idle');
    setSeconds(0);
    setLabel('');
    setError(null);
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;

  return (
    <div className="media-capture-wrap">
      {phase === 'idle' && (
        <button className="media-trigger-btn" onClick={startRecording}>
          <span>🎙️</span>
          <span>Record Audio</span>
        </button>
      )}

      {phase === 'recording' && (
        <div className="recording-active">
          <div className="recording-indicator">
            <span className="rec-dot" />
            <span className="rec-label">REC {fmt(seconds)}</span>
          </div>
          <button className="media-action-btn capture" onClick={stopRecording}>
            ⏹ Stop
          </button>
        </div>
      )}

      {phase === 'preview' && audioUrl && (
        <div className="captured-wrap">
          <audio controls src={audioUrl} className="audio-preview" />
          <p className="media-meta-note">Duration: {fmt(seconds)}</p>
          <input
            className="media-label-input"
            placeholder="Label this recording…"
            value={label}
            onChange={e => setLabel(e.target.value)}
            maxLength={60}
          />
          <div className="media-action-row">
            <button className="media-action-btn cancel" onClick={reset}>Discard</button>
            <button className="media-action-btn save"   onClick={saveRecording}>💾 Save</button>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="media-error">
          <p>⚠️ {error}</p>
          <button className="media-action-btn cancel" onClick={reset}>Dismiss</button>
        </div>
      )}
    </div>
  );
}
