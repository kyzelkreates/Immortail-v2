// ================================================================
// IMMORTAIL™ — CAMERA CAPTURE
// Connects to storage.js SSOT. No external storage systems.
// ================================================================

import React, { useState, useRef, useCallback } from 'react';
import storage from '../../core/storage.js';
import { EventBus } from '../../core/eventBus.js';

export default function CameraCapture({ onCapture }) {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);

  const [phase,   setPhase]   = useState('idle');    // idle | preview | captured | error
  const [preview, setPreview] = useState(null);      // data URL
  const [error,   setError]   = useState(null);
  const [label,   setLabel]   = useState('');

  // ── Start camera ──────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    setError(null);
    setPhase('preview');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current        = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    } catch (err) {
      setError('Camera access denied or unavailable.');
      setPhase('error');
    }
  }, []);

  // ── Stop camera ───────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  // ── Capture frame ─────────────────────────────────────────────

  const captureFrame = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setPreview(dataUrl);
    setPhase('captured');
    stopCamera();
  }, [stopCamera]);

  // ── Persist to SSOT ──────────────────────────────────────────

  const saveCapture = useCallback(() => {
    if (!preview) return;
    const entry = {
      type:    'image',
      source:  'camera',
      dataUrl: preview,
      label:   label.trim() || 'Camera capture',
    };
    storage.addMedia(entry);
    EventBus.emit('SYSTEM::MEDIA_ADDED', entry);
    onCapture?.(entry);
    setPreview(null);
    setPhase('idle');
    setLabel('');
  }, [preview, label, onCapture]);

  // ── Retry ─────────────────────────────────────────────────────

  const retry = () => {
    setPreview(null);
    setError(null);
    setPhase('idle');
  };

  return (
    <div className="media-capture-wrap">
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {phase === 'idle' && (
        <button className="media-trigger-btn" onClick={startCamera}>
          <span>📷</span>
          <span>Open Camera</span>
        </button>
      )}

      {phase === 'preview' && (
        <div className="camera-preview-wrap">
          <video
            ref={videoRef}
            className="camera-video"
            playsInline
            muted
            autoPlay
          />
          <div className="camera-controls">
            <button className="media-action-btn cancel" onClick={() => { stopCamera(); setPhase('idle'); }}>
              Cancel
            </button>
            <button className="media-action-btn capture" onClick={captureFrame}>
              📸 Capture
            </button>
          </div>
        </div>
      )}

      {phase === 'captured' && preview && (
        <div className="captured-wrap">
          <img src={preview} alt="Captured" className="captured-preview" />
          <input
            className="media-label-input"
            placeholder="Label this capture…"
            value={label}
            onChange={e => setLabel(e.target.value)}
            maxLength={60}
          />
          <div className="media-action-row">
            <button className="media-action-btn cancel" onClick={retry}>Retake</button>
            <button className="media-action-btn save"   onClick={saveCapture}>💾 Save</button>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="media-error">
          <p>⚠️ {error}</p>
          <button className="media-action-btn cancel" onClick={retry}>Dismiss</button>
        </div>
      )}
    </div>
  );
}
