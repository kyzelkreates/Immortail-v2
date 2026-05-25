// ================================================================
// IMMORTAIL™ Run 21 — VOICE SETTINGS PANEL
// In-page settings: mode, voice, sensitivity, TTS, language.
// Writes via voiceRouter — no direct storage calls.
// ================================================================

import React, { useState, useEffect } from 'react';
import { updateVoiceSettings, getVoiceSettings, getAvailableTTSVoices, getMicrophoneDevices } from '../../services/voice/voiceRouter.js';
import { setSensitivity } from '../../services/voice/microphoneManager.js';

export default function VoiceSettingsPanel({ onClose }) {
  const [settings, setSettings] = useState(() => getVoiceSettings());
  const [voices,   setVoices]   = useState(() => getAvailableTTSVoices());
  const [devices,  setDevices]  = useState([]);

  useEffect(() => {
    getMicrophoneDevices().then(d => setDevices(d));
    // Refresh voices — some browsers load async
    const timer = setTimeout(() => setVoices(getAvailableTTSVoices()), 500);
    return () => clearTimeout(timer);
  }, []);

  const patch = (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    updateVoiceSettings({ [key]: value });
    if (key === 'sensitivity') setSensitivity(value);
  };

  return (
    <div className="voice-settings-panel">
      <div className="voice-settings-panel__header">
        <h3>Voice Settings</h3>
        <button className="voice-settings-panel__close" onClick={onClose}>✕</button>
      </div>

      {/* Conversation mode */}
      <div className="voice-settings-panel__field">
        <label>Conversation mode</label>
        <div className="voice-settings-panel__mode-row">
          {['auto', 'push'].map(m => (
            <button
              key={m}
              className={`voice-settings-panel__mode-btn ${settings.conversationMode === m ? 'active' : ''}`}
              onClick={() => patch('conversationMode', m)}
            >
              {m === 'auto' ? '🔄 Auto' : '🖐 Push-to-talk'}
            </button>
          ))}
        </div>
      </div>

      {/* TTS mode */}
      <div className="voice-settings-panel__field">
        <label>Voice synthesis</label>
        <div className="voice-settings-panel__mode-row">
          {[
            { id: 'browser', label: '🌐 Browser (free)' },
            { id: 'openai',  label: '⚡ OpenAI TTS' },
            { id: 'groq',    label: '🚀 Groq TTS' },
          ].map(opt => (
            <button
              key={opt.id}
              className={`voice-settings-panel__mode-btn ${settings.ttsMode === opt.id ? 'active' : ''}`}
              onClick={() => patch('ttsMode', opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Browser voice selection */}
      {settings.ttsMode === 'browser' && voices.length > 0 && (
        <div className="voice-settings-panel__field">
          <label>Browser voice</label>
          <select
            value={settings.preferredVoiceName ?? ''}
            onChange={e => patch('preferredVoiceName', e.target.value)}
            className="voice-settings-panel__select"
          >
            <option value="">— auto select —</option>
            {voices.map(v => (
              <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
            ))}
          </select>
        </div>
      )}

      {/* Microphone device */}
      {devices.length > 1 && (
        <div className="voice-settings-panel__field">
          <label>Microphone</label>
          <select
            value={settings.preferredDeviceId ?? ''}
            onChange={e => patch('preferredDeviceId', e.target.value)}
            className="voice-settings-panel__select"
          >
            <option value="">— default —</option>
            {devices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0,8)}`}</option>
            ))}
          </select>
        </div>
      )}

      {/* Language */}
      <div className="voice-settings-panel__field">
        <label>Language</label>
        <select
          value={settings.language ?? 'en-US'}
          onChange={e => patch('language', e.target.value)}
          className="voice-settings-panel__select"
        >
          {[
            { id: 'en-US', label: 'English (US)' },
            { id: 'en-GB', label: 'English (UK)' },
            { id: 'es-ES', label: 'Spanish' },
            { id: 'fr-FR', label: 'French' },
            { id: 'de-DE', label: 'German' },
            { id: 'ja-JP', label: 'Japanese' },
            { id: 'zh-CN', label: 'Chinese (Simplified)' },
          ].map(l => (
            <option key={l.id} value={l.id}>{l.label}</option>
          ))}
        </select>
      </div>

      {/* Sensitivity */}
      <div className="voice-settings-panel__field">
        <label>Mic sensitivity ({((settings.sensitivity ?? 1.0) * 100).toFixed(0)}%)</label>
        <input
          type="range" min="0.1" max="3.0" step="0.1"
          value={settings.sensitivity ?? 1.0}
          onChange={e => patch('sensitivity', parseFloat(e.target.value))}
        />
      </div>

      {/* Silence threshold */}
      <div className="voice-settings-panel__field">
        <label>Silence wait ({settings.silenceDebounceMs ?? 900}ms)</label>
        <input
          type="range" min="300" max="2000" step="100"
          value={settings.silenceDebounceMs ?? 900}
          onChange={e => patch('silenceDebounceMs', parseInt(e.target.value))}
        />
        <div className="voice-settings-panel__hint">
          How long to wait after you stop speaking before responding
        </div>
      </div>

      {/* API transcription toggle */}
      <div className="voice-settings-panel__field voice-settings-panel__field--row">
        <label>Force API transcription (Whisper)</label>
        <input
          type="checkbox"
          checked={!!settings.forceAPITranscription}
          onChange={e => patch('forceAPITranscription', e.target.checked)}
        />
      </div>
    </div>
  );
}
