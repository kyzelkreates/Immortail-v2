// ================================================================
// IMMORTAIL™ — MEDIA SCREEN (Run 3 upgrade)
// Media events now fuse into companionCore.memory via ingestMedia().
// Feature-flag gated via storage.js SSOT config.
// ================================================================

import React, { useState } from 'react';
import useConfig          from '../hooks/useConfig.js';
import useCompanionCore   from '../hooks/useCompanionCore.js';
import CameraCapture      from '../components/media/CameraCapture.jsx';
import AudioRecorder      from '../components/media/AudioRecorder.jsx';
import VideoUploader      from '../components/media/VideoUploader.jsx';

const INPUT_TABS = [
  { id: 'image', label: '📷 Image', flag: 'imageInput' },
  { id: 'audio', label: '🎙️ Audio', flag: 'audioInput' },
  { id: 'video', label: '🎬 Video', flag: 'videoInput' },
];

export default function MediaScreen() {
  const { config }   = useConfig();
  const features     = config.features ?? {};
  const mediaEnabled = features.mediaInput;

  // Run 3: use companionCore for media memory
  const { mediaMemory, ingestMedia } = useCompanionCore();

  const availableTabs = INPUT_TABS.filter(t => features[t.flag]);
  const [activeTab, setActiveTab] = useState(availableTabs[0]?.id ?? 'image');

  // ── Media ingestion: goes through companionCore (not standalone addMedia) ──
  const handleCapture = (mediaEntry) => {
    // 1. Fuse into unified memory timeline via companionCoreService
    ingestMedia(mediaEntry);
  };

  if (!mediaEnabled) {
    return (
      <div className="screen media-screen">
        <header className="screen-header">
          <h1>Media</h1>
          <p className="screen-subtitle">Media input is disabled</p>
        </header>
        <div className="media-disabled-note">
          Enable media input in Settings → Media to use this feature.
        </div>
      </div>
    );
  }

  return (
    <div className="screen media-screen">
      <header className="screen-header">
        <h1>Media</h1>
        <p className="screen-subtitle">
          {mediaMemory.length} media moment{mediaMemory.length !== 1 ? 's' : ''} in timeline
        </p>
      </header>

      {/* Tab selector */}
      {availableTabs.length > 1 && (
        <div className="media-tabs">
          {availableTabs.map(t => (
            <button
              key={t.id}
              className={'media-tab' + (activeTab === t.id ? ' active' : '')}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Input panel */}
      <div className="media-panel">
        {activeTab === 'image' && features.imageInput && (
          <CameraCapture onCapture={handleCapture} />
        )}
        {activeTab === 'audio' && features.audioInput && (
          <AudioRecorder onRecord={handleCapture} />
        )}
        {activeTab === 'video' && features.videoInput && (
          <VideoUploader onUpload={handleCapture} />
        )}
      </div>

      {/* Media memory log — reads from companionCore.mediaMemory */}
      {mediaMemory.length > 0 && (
        <div className="media-log">
          <h2 className="settings-label">Media Memory</h2>
          <div className="media-log-list">
            {[...mediaMemory].reverse().map(m => (
              <div key={m.id} className="media-log-card">
                {m.type === 'image' && m.dataUrl && (
                  <img src={m.dataUrl} alt={m.label} className="media-thumb" />
                )}
                <div className="media-log-info">
                  <p className="media-log-label">{m.label}</p>
                  <p className="media-log-meta">
                    {m.type} · {new Date(m.ts || m.createdAt).toLocaleTimeString()}
                    {m.mood && ` · mood: ${m.mood}`}
                  </p>
                </div>
                <div className={`media-type-badge media-type-${m.type}`}>{m.type}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
