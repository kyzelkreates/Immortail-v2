// ================================================================
// IMMORTAIL™ Run 21 — VOICE COMPANION PAGE
// Full-screen voice companion experience.
// Boots voice workers on mount — shuts down on unmount.
// ================================================================

import React, { useEffect } from 'react';
import VoiceConversationPanel from '../components/voice/VoiceConversationPanel.jsx';
import { startSessionMonitor, stopSessionMonitor } from '../services/voice/realtimeSessionManager.js';

// Boot voice workers lazily (only when page is visited)
async function bootVoiceWorkers() {
  await Promise.all([
    import('../workers/voiceConversationWorker.js').then(m => m.boot()),
    import('../workers/emotionalToneWorker.js').then(m => m.boot()),
    import('../workers/realtimePresenceWorker.js').then(m => m.boot()),
    import('../workers/speechMemoryWorker.js').then(m => m.boot()),
  ]).catch(e => console.warn('[VoicePage] Worker boot warning:', e.message));
}

export default function VoiceCompanionPage() {
  useEffect(() => {
    bootVoiceWorkers().then(() => startSessionMonitor());
    return () => stopSessionMonitor();
  }, []);

  return (
    <div className="voice-companion-page">
      {/* Ambient background */}
      <div className="voice-companion-page__bg">
        <div className="voice-companion-page__bg-orb voice-companion-page__bg-orb--1" />
        <div className="voice-companion-page__bg-orb voice-companion-page__bg-orb--2" />
        <div className="voice-companion-page__bg-orb voice-companion-page__bg-orb--3" />
      </div>

      <div className="voice-companion-page__content">
        <VoiceConversationPanel />
      </div>
    </div>
  );
}
