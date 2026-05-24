// ================================================================
// IMMORTAIL™ — MEDIA SCREEN
// Feature-flag gated via storage.js SSOT.
// Mounts CameraCapture, AudioRecorder, VideoUploader.
// ================================================================

import React, { useState, useEffect } from 'react';
import storage from '../core/storage.js';
import { EventBus } from '../core/eventBus.js';
import useConfig from '../hooks/useConfig.js';
import CameraCapture from '../components/media/CameraCapture.jsx';
import AudioRecorder from '../components/media/AudioRecorder.jsx';
import VideoUploader from '../components/media/VideoUploader.jsx';

const TABS = [
  { id: 'image', label: '📷 Image', flag: 'imageInput' },
  { id: 'audio', label: '🎙️ Audio', flag: 'audioInput' },
  { id: 'video', label: '🎬 Video', flag: 'videoInput' },
];

export default function MediaScreen() {
  const { config }            = useConfig();
  const features              = config.features ?? {};
  const mediaEnabled          = features.mediaInput;

  const availableTabs = TABS.filter(t => features[t.flag]);
  const [activeTab, setActiveTab] = useState(availableTabs[0]?.id ?? 'image');
  const [mediaList, setMediaList] = useState(() => storage.getMedia());

  // Re-sync media list on new entries
  useEffect(() => {
    const unsub = EventBus.on('SYSTEM::MEDIA_ADDED', () => {
      setMediaList(storage.getMedia());
    });
    return unsub;
  }, []);

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

  const handleCapture = () => setMediaList(storage.getMedia());

  return (
    <div className="screen media-screen">
      <header className="screen-header">
        <h1>Media</h1>
        <p className="screen-subtitle">{mediaList.length} item{mediaList.length !== 1 ? 's' : ''} captured</p>
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

      {/* Media log */}
      {mediaList.length > 0 && (
        <div className="media-log">
          <h2 className="settings-label">Captured Media</h2>
          <div className="media-log-list">
            {[...mediaList].reverse().map(m => (
              <div key={m.id} className="media-log-card">
                {m.type === 'image' && m.dataUrl && (
                  <img src={m.dataUrl} alt={m.label} className="media-thumb" />
                )}
                <div className="media-log-info">
                  <p className="media-log-label">{m.label}</p>
                  <p className="media-log-meta">
                    {m.type} · {new Date(m.createdAt).toLocaleTimeString()}
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
