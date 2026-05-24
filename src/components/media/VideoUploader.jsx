// ================================================================
// IMMORTAIL™ — VIDEO UPLOADER
// Connects to storage.js SSOT. No external storage systems.
// ================================================================

import React, { useState, useRef, useCallback } from 'react';
import storage from '../../core/storage.js';
import { EventBus } from '../../core/eventBus.js';

const ACCEPTED     = 'video/mp4,video/webm,video/ogg,video/quicktime';
const MAX_SIZE_MB  = 100;
const MAX_SIZE_B   = MAX_SIZE_MB * 1024 * 1024;

export default function VideoUploader({ onUpload }) {
  const inputRef = useRef(null);

  const [phase,   setPhase]   = useState('idle');    // idle | preview | error
  const [file,    setFile]    = useState(null);
  const [videoUrl,setVideoUrl]= useState(null);
  const [label,   setLabel]   = useState('');
  const [error,   setError]   = useState(null);

  // ── File picked ───────────────────────────────────────────────

  const handleFile = useCallback((file) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setError('File must be a video (mp4, webm, ogg, mov).');
      setPhase('error');
      return;
    }
    if (file.size > MAX_SIZE_B) {
      setError(`Video exceeds ${MAX_SIZE_MB}MB limit.`);
      setPhase('error');
      return;
    }
    setError(null);
    setFile(file);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setLabel(file.name.replace(/\.[^.]+$/, ''));
    setPhase('preview');
  }, []);

  const onInputChange = (e) => handleFile(e.target.files?.[0]);

  // ── Drag & drop ───────────────────────────────────────────────

  const onDrop = useCallback((e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files?.[0]);
  }, [handleFile]);

  const onDragOver = (e) => e.preventDefault();

  // ── Persist metadata to SSOT ─────────────────────────────────
  // Video blobs exceed localStorage limits. We persist metadata only.
  // Full binary storage deferred to IndexedDB run.

  const saveUpload = useCallback(() => {
    if (!file) return;
    const entry = {
      type:     'video',
      source:   'upload',
      filename: file.name,
      size:     file.size,
      mimeType: file.type,
      label:    label.trim() || file.name,
      note:     'metadata-only (binary not persisted to localStorage)',
    };
    storage.addMedia(entry);
    EventBus.emit('SYSTEM::MEDIA_ADDED', entry);
    onUpload?.(entry);
    reset();
  }, [file, label, onUpload]);

  const reset = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setFile(null);
    setPhase('idle');
    setLabel('');
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const fmt = (bytes) =>
    bytes > 1024 * 1024
      ? (bytes / (1024 * 1024)).toFixed(1) + ' MB'
      : (bytes / 1024).toFixed(0) + ' KB';

  return (
    <div className="media-capture-wrap">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        style={{ display: 'none' }}
        onChange={onInputChange}
      />

      {phase === 'idle' && (
        <div
          className="video-dropzone"
          onClick={() => inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <span className="dropzone-icon">🎬</span>
          <span className="dropzone-label">Tap to upload video</span>
          <span className="dropzone-hint">mp4 · webm · ogg · mov · up to {MAX_SIZE_MB}MB</span>
        </div>
      )}

      {phase === 'preview' && videoUrl && (
        <div className="captured-wrap">
          <video
            src={videoUrl}
            controls
            className="video-preview"
            preload="metadata"
          />
          <p className="media-meta-note">
            {file?.name} · {fmt(file?.size ?? 0)}
          </p>
          <input
            className="media-label-input"
            placeholder="Label this video…"
            value={label}
            onChange={e => setLabel(e.target.value)}
            maxLength={60}
          />
          <div className="media-action-row">
            <button className="media-action-btn cancel" onClick={reset}>Cancel</button>
            <button className="media-action-btn save"   onClick={saveUpload}>💾 Save</button>
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
