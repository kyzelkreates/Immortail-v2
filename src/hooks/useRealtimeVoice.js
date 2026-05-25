// ================================================================
// IMMORTAIL™ Run 21 — useRealtimeVoice hook
// Microphone level stream + session monitor bindings.
// ================================================================

import { useState, useEffect, useCallback } from 'react';
import { EventBus } from '../core/eventBus.js';
import { getMicState, requestMicrophone, stopMicrophone, listAudioDevices } from '../services/voice/microphoneManager.js';
import { startSessionMonitor, stopSessionMonitor, getMonitorStats } from '../services/voice/realtimeSessionManager.js';

export function useRealtimeVoice() {
  const [micState,    setMicState]    = useState(() => getMicState());
  const [level,       setLevel]       = useState(0);
  const [devices,     setDevices]     = useState([]);
  const [monitorStats, setStats]      = useState(() => getMonitorStats());
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    const unsubs = [
      EventBus.on('SYSTEM::MIC_GRANTED',       () => setMicState(getMicState())),
      EventBus.on('SYSTEM::MIC_DENIED',        () => setMicState(getMicState())),
      EventBus.on('SYSTEM::MIC_STOPPED',       () => { setMicState(getMicState()); setLevel(0); }),
      EventBus.on('SYSTEM::MIC_LEVEL',         ({ level: l }) => setLevel(l)),
      EventBus.on('SYSTEM::VOICE_RECONNECTING',() => setReconnecting(true)),
      EventBus.on('SYSTEM::VOICE_RECONNECTED', () => { setReconnecting(false); setStats(getMonitorStats()); }),
      EventBus.on('SYSTEM::VOICE_HEALTH_OK',   () => setStats(getMonitorStats())),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  const requestMic = useCallback(async (opts = {}) => {
    const stream = await requestMicrophone(opts);
    setMicState(getMicState());
    return stream;
  }, []);

  const releaseMic = useCallback(() => {
    stopMicrophone();
    setMicState(getMicState());
    setLevel(0);
  }, []);

  const refreshDevices = useCallback(async () => {
    const d = await listAudioDevices();
    setDevices(d);
    return d;
  }, []);

  const startMonitor = useCallback(() => startSessionMonitor(), []);
  const stopMonitor  = useCallback(() => stopSessionMonitor(), []);

  return {
    micState, level, devices, monitorStats, reconnecting,
    requestMic, releaseMic, refreshDevices,
    startMonitor, stopMonitor,
  };
}

export default useRealtimeVoice;
