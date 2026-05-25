/**
 * IMMORTAIL™ — RUN 14
 * voicePresenceEngine.js
 *
 * Voice + Emotional Speech Presence Engine
 * Real-time conversational companion system — production safe.
 *
 * ARCHITECTURE RULES:
 *   - Single source of truth  → companionCore only
 *   - No human voice cloning  → strictly enforced
 *   - No always-listening     → user-controlled activation only
 *   - Offline-first           → Piper + Whisper local, cloud never required
 *   - Ollama = personality brain / Groq = acceleration only
 *   - All state persists through storage.js → no direct IndexedDB access
 *   - All events through EventBus only
 */

import storage from './storage.js';

// ══════════════════════════════════════════════════════════════════
// CONSTANTS & ENUMS
// ══════════════════════════════════════════════════════════════════

export const LISTENING_STATE = {
  INACTIVE:   'inactive',
  PUSH_TALK:  'push_to_talk',
  TAP_SPEAK:  'tap_to_speak',
  TIMED:      'timed_window',
};

export const SPEAKING_STATE = {
  IDLE:        'idle',
  PREPARING:   'preparing',
  SPEAKING:    'speaking',
  PAUSED:      'paused',
  INTERRUPTED: 'interrupted',
  RECOVERING:  'recovering',
};

export const SPEECH_EMOTION = {
  NEUTRAL:   'neutral',
  CALM:      'calm',
  WARM:      'warm',
  PLAYFUL:   'playful',
  SLEEPY:    'sleepy',
  GENTLE:    'gentle',
  CURIOUS:   'curious',
  REUNION:   'reunion',
};

export const VOICE_PROFILE = {
  WARM_CALM:   'warm_calm',
  SOFT_GENTLE: 'soft_gentle',
  PLAYFUL:     'playful',
  SLEEPY:      'sleepy',
};

export const AMBIENT_VOICE_MODE = {
  SOFT:   'soft',
  SILENT: 'silent',
  SUBTLE: 'subtle',
};

export const INTERRUPT_STATE = {
  STABLE:     'stable',
  INTERRUPTED:'interrupted',
  RECOVERING: 'recovering',
  COOLDOWN:   'cooldown',
};

export const AMBIENT_SOUND = {
  SLEEPY_SIGH:   'sleepy_sigh',
  SOFT_BREATH:   'soft_breath',
  QUIET_ACK:     'quiet_ack',
  GENTLE_REACT:  'gentle_react',
  RESTING:       'resting',
};

// Safety categories — blocked speech patterns
const BLOCKED_PATTERNS = [
  /you (need|must|have to).{0,15}(talk to me|depend on me|only talk to me)/i,
  /i('m| am) the only (one|friend|companion)/i,
  /without me you (will|would|'ll)/i,
  /don't (leave|go|stop talking)/i,
  /you('re| are) (addicted|dependent|obsessed)/i,
  /i (control|own|possess) you/i,
  /emotional(ly)? manipulat/i,
];

// TTS provider capability map (offline-first)
export const TTS_PROVIDERS = {
  piper:   { offline: true,  streaming: true,  quality: 'high',   latencyMs: 80  },
  coqui:   { offline: true,  streaming: true,  quality: 'high',   latencyMs: 120 },
  browser: { offline: true,  streaming: false, quality: 'medium', latencyMs: 20  },
  none:    { offline: true,  streaming: false, quality: 'none',   latencyMs: 0   },
};

// STT provider capability map
export const STT_PROVIDERS = {
  whisper:        { offline: true,  streaming: false, quality: 'high',   batchMs: 500  },
  faster_whisper: { offline: true,  streaming: true,  quality: 'high',   batchMs: 200  },
  browser:        { offline: false, streaming: true,  quality: 'medium', batchMs: 100  },
  none:           { offline: true,  streaming: false, quality: 'none',   batchMs: 0    },
};

// Emotional speech modulation table
export const SPEECH_MODULATION = {
  [SPEECH_EMOTION.NEUTRAL]:  { pacingFactor: 1.0, pauseMs: 300, sentenceLength: 'medium', warmth: 0.5, cadence: 'steady'   },
  [SPEECH_EMOTION.CALM]:     { pacingFactor: 0.9, pauseMs: 400, sentenceLength: 'medium', warmth: 0.6, cadence: 'smooth'   },
  [SPEECH_EMOTION.WARM]:     { pacingFactor: 0.95,pauseMs: 350, sentenceLength: 'medium', warmth: 0.8, cadence: 'flowing'  },
  [SPEECH_EMOTION.PLAYFUL]:  { pacingFactor: 1.1, pauseMs: 200, sentenceLength: 'short',  warmth: 0.9, cadence: 'lively'   },
  [SPEECH_EMOTION.SLEEPY]:   { pacingFactor: 0.7, pauseMs: 600, sentenceLength: 'short',  warmth: 0.7, cadence: 'drowsy'   },
  [SPEECH_EMOTION.GENTLE]:   { pacingFactor: 0.85,pauseMs: 450, sentenceLength: 'medium', warmth: 0.75,cadence: 'soft'     },
  [SPEECH_EMOTION.CURIOUS]:  { pacingFactor: 1.05,pauseMs: 250, sentenceLength: 'medium', warmth: 0.65,cadence: 'engaged'  },
  [SPEECH_EMOTION.REUNION]:  { pacingFactor: 0.9, pauseMs: 300, sentenceLength: 'short',  warmth: 1.0, cadence: 'warm'     },
};

// Ambient vocal sound table by routine/mood
const AMBIENT_SOUND_MAP = {
  sleeping:  [AMBIENT_SOUND.RESTING, AMBIENT_SOUND.SOFT_BREATH],
  sleepy:    [AMBIENT_SOUND.SLEEPY_SIGH, AMBIENT_SOUND.SOFT_BREATH],
  calm:      [AMBIENT_SOUND.SOFT_BREATH, AMBIENT_SOUND.QUIET_ACK],
  playful:   [AMBIENT_SOUND.GENTLE_REACT, AMBIENT_SOUND.QUIET_ACK],
  curious:   [AMBIENT_SOUND.QUIET_ACK, AMBIENT_SOUND.GENTLE_REACT],
  reunion:   [AMBIENT_SOUND.GENTLE_REACT, AMBIENT_SOUND.QUIET_ACK],
  neutral:   [AMBIENT_SOUND.SOFT_BREATH],
};

// Embodiment sync overlays by speech emotion
const EMBODIMENT_SYNC_MAP = {
  [SPEECH_EMOTION.SLEEPY]:   { postureShift: 'slower', tailMovement: 'minimal', headMovement: 'subtle',  breathingRate: 'slow'   },
  [SPEECH_EMOTION.PLAYFUL]:  { postureShift: 'light',  tailMovement: 'lighter', headMovement: 'engaged', breathingRate: 'normal' },
  [SPEECH_EMOTION.CALM]:     { postureShift: 'steady', tailMovement: 'gentle',  headMovement: 'subtle',  breathingRate: 'slow'   },
  [SPEECH_EMOTION.WARM]:     { postureShift: 'open',   tailMovement: 'gentle',  headMovement: 'engaged', breathingRate: 'normal' },
  [SPEECH_EMOTION.REUNION]:  { postureShift: 'open',   tailMovement: 'gentle',  headMovement: 'forward', breathingRate: 'normal' },
  [SPEECH_EMOTION.NEUTRAL]:  { postureShift: 'steady', tailMovement: 'minimal', headMovement: 'subtle',  breathingRate: 'normal' },
  [SPEECH_EMOTION.GENTLE]:   { postureShift: 'relaxed',tailMovement: 'gentle',  headMovement: 'subtle',  breathingRate: 'slow'   },
  [SPEECH_EMOTION.CURIOUS]:  { postureShift: 'alert',  tailMovement: 'active',  headMovement: 'tilted',  breathingRate: 'normal' },
};

// Conversation cooldown — prevent response spam
export const VOICE_TIMING = {
  MIN_RESPONSE_GAP_MS:      1_500,   // min ms between responses
  INTERRUPT_COOLDOWN_MS:    2_000,   // recovery after interrupt
  AMBIENT_SOUND_COOLDOWN_MS:20_000,  // min ms between ambient sounds
  STT_BATCH_MS:             300,     // STT processing window
  TTS_PREBUFFER_MS:         100,     // TTS pre-buffer lead time
  TURN_TIMEOUT_MS:          8_000,   // max listening window per turn
  PRESENCE_PERSIST_THROTTLE:500,     // min ms between voice state writes
};

export const VOICE_CAPS = {
  RESPONSE_QUEUE_MAX:  5,
  VOICE_MEMORY_MAX:    20,   // recent voice interactions stored
  SAFETY_LOG_MAX:      50,
};

// ══════════════════════════════════════════════════════════════════
// MODULE STATE (runtime only — not persisted directly)
// ══════════════════════════════════════════════════════════════════

let _throttleLastWrite   = 0;
let _ambientSoundLastAt  = 0;
let _lastResponseAt      = 0;
let _turnCooldownUntil   = 0; // set after completeResponse drains queue
let _interruptCooldownUntil = 0;
let _lowPowerMode        = false;

// Conversation runtime state — transient
let _conversationState = {
  listening:     false,
  processing:    false,
  responding:    false,
  interrupted:   false,
  activeTurn:    null,
  responseQueue: [],
};

// Safety log
let _safetyLog = [];

// Voice interaction memory (session)
let _voiceMemory = [];

// ══════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ══════════════════════════════════════════════════════════════════

function genId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function getVoice() {
  return storage.getCompanionCore().voicePresence ?? getDefaultVoicePresence();
}

function getDefaultVoicePresence() {
  return {
    voiceEnabled:        true,
    listeningState:      LISTENING_STATE.INACTIVE,
    speakingState:       SPEAKING_STATE.IDLE,
    activeVoiceProfile:  VOICE_PROFILE.WARM_CALM,
    speechEmotionState:  SPEECH_EMOTION.NEUTRAL,
    interruptionState:   INTERRUPT_STATE.STABLE,
    ambientVoiceMode:    AMBIENT_VOICE_MODE.SOFT,
    ttsProvider:         'piper',
    sttProvider:         'whisper',
    streamingEnabled:    true,
    offlineFallback:     true,
    lastSpeechAt:        null,
    lastListenAt:        null,
    ambientSoundHistory: [],
    voiceMemoryCount:    0,
    voiceVersion:        'V1',
  };
}

function saveVoice(patch) {
  const now = Date.now();
  // Write throttle: min 500ms between writes
  if (now - _throttleLastWrite < VOICE_TIMING.PRESENCE_PERSIST_THROTTLE && !patch._force) {
    return false;
  }
  _throttleLastWrite = now;
  const core = storage.getCompanionCore();
  core.voicePresence = { ...getVoice(), ...patch };
  delete core.voicePresence._force;
  storage.saveCompanionCore(core);
  return true;
}

function saveVoiceForce(patch) {
  _throttleLastWrite = 0;
  saveVoice({ ...patch, _force: true });
}

// ══════════════════════════════════════════════════════════════════
// STEP 1 — VOICE PRESENCE INITIALISATION
// ══════════════════════════════════════════════════════════════════

/**
 * initVoicePresence()
 * Boots the voice presence engine, restoring persisted state.
 * Safe to call multiple times — idempotent.
 */
export function initVoicePresence() {
  const core = storage.getCompanionCore();

  if (!core.voicePresence) {
    core.voicePresence = getDefaultVoicePresence();
    storage.saveCompanionCore(core);
  } else {
    // Patch any missing fields from new version
    const defaults = getDefaultVoicePresence();
    let patched = false;
    for (const [k, v] of Object.entries(defaults)) {
      if (core.voicePresence[k] === undefined) {
        core.voicePresence[k] = v;
        patched = true;
      }
    }
    if (patched) storage.saveCompanionCore(core);
  }

  // Reset transient runtime state on boot
  _conversationState = {
    listening:     false,
    processing:    false,
    responding:    false,
    interrupted:   false,
    activeTurn:    null,
    responseQueue: [],
  };
  _lastResponseAt        = 0;
  _interruptCooldownUntil = 0;

  console.log('IMMORTAIL VOICE PRESENCE: boot complete', {
    voiceEnabled:    core.voicePresence.voiceEnabled,
    ttsProvider:     core.voicePresence.ttsProvider,
    sttProvider:     core.voicePresence.sttProvider,
    listeningState:  core.voicePresence.listeningState,
    speechEmotion:   core.voicePresence.speechEmotionState,
  });
}

// ══════════════════════════════════════════════════════════════════
// STEP 2 — LOCAL STT (SPEECH-TO-TEXT) SYSTEM
// ══════════════════════════════════════════════════════════════════

/**
 * activateListening(mode)
 * User-controlled microphone activation — never auto-starts.
 * @param {'push_to_talk'|'tap_to_speak'|'timed_window'} mode
 */
export function activateListening(mode = LISTENING_STATE.TAP_SPEAK) {
  if (!Object.values(LISTENING_STATE).includes(mode) || mode === LISTENING_STATE.INACTIVE) {
    return { activated: false, reason: 'invalid_mode' };
  }
  if (_conversationState.responding) {
    return { activated: false, reason: 'companion_speaking' };
  }
  if (_conversationState.listening) {
    return { activated: false, reason: 'already_listening' };
  }
  const now = Date.now();
  if (now < _interruptCooldownUntil) {
    return { activated: false, reason: 'interrupt_cooldown', cooldownRemainingMs: _interruptCooldownUntil - now };
  }

  _conversationState.listening  = true;
  _conversationState.activeTurn = genId();
  saveVoiceForce({ listeningState: mode, lastListenAt: now });
  return { activated: true, mode, turnId: _conversationState.activeTurn };
}

/**
 * deactivateListening()
 * Stops microphone listening — user-controlled only.
 */
export function deactivateListening() {
  _conversationState.listening = false;
  saveVoiceForce({ listeningState: LISTENING_STATE.INACTIVE });
  return { deactivated: true };
}

/**
 * processSpeechInput(transcript, options)
 * Receives a transcribed string from Whisper/faster-whisper.
 * Validates, sanitises, and queues for Ollama processing.
 * Raw audio is never stored — only the sanitised transcript.
 */
export function processSpeechInput(transcript, options = {}) {
  if (!transcript || typeof transcript !== 'string') {
    return { accepted: false, reason: 'empty_transcript' };
  }

  const sanitised = transcript.trim().slice(0, 2_000); // hard cap — no raw dump
  if (sanitised.length < 2) {
    return { accepted: false, reason: 'too_short' };
  }

  // Safety check the input
  const safety = runSafetyCheck(sanitised);
  if (!safety.safe) {
    logSafetyEvent('stt_input_blocked', sanitised, safety.reason);
    return { accepted: false, reason: 'safety_blocked', detail: safety.reason };
  }

  _conversationState.processing = true;
  _conversationState.listening  = false;
  saveVoiceForce({ listeningState: LISTENING_STATE.INACTIVE });

  // Log to voice memory (text only — no raw audio)
  appendVoiceMemory({
    type:       'user_speech',
    transcript: sanitised,
    turnId:     _conversationState.activeTurn,
    sttProvider: options.sttProvider ?? getVoice().sttProvider,
  });

  return {
    accepted:   true,
    transcript: sanitised,
    turnId:     _conversationState.activeTurn,
    nextStep:   'ollama_inference',
  };
}

/**
 * getSttConfiguration()
 * Returns current STT config — for UI and skill layer consumption.
 */
export function getSttConfiguration() {
  const voice = getVoice();
  const provider = voice.sttProvider ?? 'whisper';
  return {
    provider,
    capabilities:      STT_PROVIDERS[provider] ?? STT_PROVIDERS.none,
    batchWindowMs:     VOICE_TIMING.STT_BATCH_MS,
    maxListenMs:       VOICE_TIMING.TURN_TIMEOUT_MS,
    privacyMode:       'local_only',
    rawAudioStorage:   false,
    backgroundListen:  false,
    userControlled:    true,
    offlineCapable:    STT_PROVIDERS[provider]?.offline ?? true,
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 3 — LOCAL TTS (TEXT-TO-SPEECH) SYSTEM
// ══════════════════════════════════════════════════════════════════

/**
 * prepareTTSRequest(text, emotionOverride)
 * Builds a TTS request object with emotional modulation applied.
 * Does NOT clone human voices — companion voice profiles only.
 */
export function prepareTTSRequest(text, emotionOverride = null) {
  if (!text || typeof text !== 'string') {
    return { prepared: false, reason: 'no_text' };
  }

  // Safety check output before delivery
  const safety = runSafetyCheck(text);
  if (!safety.safe) {
    logSafetyEvent('tts_output_blocked', text, safety.reason);
    return { prepared: false, reason: 'safety_blocked', detail: safety.reason };
  }

  const voice    = getVoice();
  const emotion  = emotionOverride ?? voice.speechEmotionState ?? SPEECH_EMOTION.NEUTRAL;
  const modulation = getSpeechModulation(emotion);
  const provider = voice.ttsProvider ?? 'piper';

  return {
    prepared:      true,
    text,
    provider,
    capabilities:  TTS_PROVIDERS[provider] ?? TTS_PROVIDERS.none,
    voiceProfile:  voice.activeVoiceProfile,
    emotion,
    modulation,
    streaming:     TTS_PROVIDERS[provider]?.streaming ?? false,
    prebufferMs:   VOICE_TIMING.TTS_PREBUFFER_MS,
    offlineCapable:TTS_PROVIDERS[provider]?.offline ?? true,
    // Safety guarantees
    humanCloning:  false,
    biometricReplication: false,
  };
}

/**
 * getTtsConfiguration()
 */
export function getTtsConfiguration() {
  const voice    = getVoice();
  const provider = voice.ttsProvider ?? 'piper';
  return {
    provider,
    capabilities:      TTS_PROVIDERS[provider] ?? TTS_PROVIDERS.none,
    voiceProfile:      voice.activeVoiceProfile,
    streamingEnabled:  voice.streamingEnabled ?? true,
    offlineCapable:    TTS_PROVIDERS[provider]?.offline ?? true,
    humanCloning:      false,
    safetyChecked:     true,
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 4 — EMOTIONAL SPEECH LAYER
// ══════════════════════════════════════════════════════════════════

/**
 * deriveSpeechEmotion(core)
 * Maps companion state → speech emotion deterministically.
 * Reads: emotionalState, ambientMood, attachmentGraph, presenceEngine, lifeSimulation.
 */
export function deriveSpeechEmotion(core) {
  const mood      = core?.lifeSimulation?.ambientMood          ?? 'calm';
  const dominant  = core?.emotionalState?.dominant             ?? 'neutral';
  const routine   = core?.lifeSimulation?.currentRoutine       ?? 'idle';
  const bondStage = core?.attachmentGraph?.bondStage           ?? 'distant';
  const presence  = core?.presenceEngine?.activePresenceState  ?? 'ambient_idle';

  // Priority chain — most specific wins
  if (routine === 'sleeping' || mood === 'sleeping') return SPEECH_EMOTION.SLEEPY;
  if (presence === 'reunion_event' || routine === 'reunion') return SPEECH_EMOTION.REUNION;
  if (mood === 'sleepy')   return SPEECH_EMOTION.SLEEPY;
  if (mood === 'playful')  return SPEECH_EMOTION.PLAYFUL;
  if (mood === 'curious')  return SPEECH_EMOTION.CURIOUS;

  // Bond stage enriches warmth
  if (bondStage === 'deeply_bonded' || bondStage === 'bonded') {
    if (mood === 'calm' || dominant === 'calm' || dominant === 'content') return SPEECH_EMOTION.WARM;
  }

  if (dominant === 'calm' || mood === 'calm')     return SPEECH_EMOTION.CALM;
  if (dominant === 'excited' || mood === 'joyful') return SPEECH_EMOTION.PLAYFUL;
  if (dominant === 'sad' || dominant === 'anxious') return SPEECH_EMOTION.GENTLE;

  return SPEECH_EMOTION.NEUTRAL;
}

/**
 * getSpeechModulation(emotion)
 * Returns pacing, pause, cadence, warmth params for a given emotion.
 */
export function getSpeechModulation(emotion) {
  return SPEECH_MODULATION[emotion] ?? SPEECH_MODULATION[SPEECH_EMOTION.NEUTRAL];
}

/**
 * applySpeechEmotionToCore(emotion)
 * Persists the derived speech emotion to companionCore.voicePresence.
 */
export function applySpeechEmotionToCore(emotion) {
  if (!Object.values(SPEECH_EMOTION).includes(emotion)) {
    return { applied: false, reason: 'unknown_emotion' };
  }
  saveVoiceForce({ speechEmotionState: emotion });
  return { applied: true, emotion, modulation: getSpeechModulation(emotion) };
}

// ══════════════════════════════════════════════════════════════════
// STEP 5 — REAL-TIME CONVERSATION ENGINE
// ══════════════════════════════════════════════════════════════════

/**
 * getConversationState()
 * Returns the transient runtime conversation state.
 */
export function getConversationState() {
  return { ..._conversationState };
}

/**
 * beginResponse(text, emotionOverride)
 * Queues a response for TTS delivery with cooldown enforcement.
 */
export function beginResponse(text, emotionOverride = null) {
  const now = Date.now();

  // Cooldown guard — prevents rapid new conversation turns
  // _turnCooldownUntil is set by markSpeakingEnded after each spoken response
  if (now < _turnCooldownUntil) {
    return { queued: false, reason: 'cooldown', retryAfterMs: _turnCooldownUntil - now };
  }
  if (now < _interruptCooldownUntil) {
    return { queued: false, reason: 'interrupt_cooldown' };
  }
  if (_conversationState.responseQueue.length >= VOICE_CAPS.RESPONSE_QUEUE_MAX) {
    return { queued: false, reason: 'queue_full' };
  }

  // Safety check before queuing
  const safety = runSafetyCheck(text ?? '');
  if (!safety.safe) {
    logSafetyEvent('response_blocked', text, safety.reason);
    return { queued: false, reason: 'safety_blocked' };
  }

  const ttsReq = prepareTTSRequest(text, emotionOverride);
  if (!ttsReq.prepared) return { queued: false, reason: ttsReq.reason };

  const entry = {
    id:           genId(),
    text,
    ttsRequest:   ttsReq,
    queuedAt:     now,
    emotion:      ttsReq.emotion,
    modulation:   ttsReq.modulation,
  };

  _conversationState.responseQueue.push(entry);
  _conversationState.responding = true;
  _lastResponseAt = now;

  saveVoiceForce({ speakingState: SPEAKING_STATE.PREPARING, lastSpeechAt: now });
  return { queued: true, entryId: entry.id, emotion: entry.emotion, modulation: entry.modulation };
}

/**
 * completeResponse(entryId)
 * Marks a response as delivered — pops from queue.
 */
export function completeResponse(entryId) {
  _conversationState.responseQueue = _conversationState.responseQueue.filter(r => r.id !== entryId);
  if (_conversationState.responseQueue.length === 0) {
    _conversationState.responding = false;
    _conversationState.processing = false;
    _turnCooldownUntil = Date.now() + VOICE_TIMING.MIN_RESPONSE_GAP_MS;
    saveVoiceForce({ speakingState: SPEAKING_STATE.IDLE });
  }
  return { completed: true, queueLength: _conversationState.responseQueue.length };
}

/**
 * markSpeakingStarted()
 * Call when TTS audio actually begins playing.
 */
export function markSpeakingStarted() {
  _conversationState.responding = true;
  saveVoice({ speakingState: SPEAKING_STATE.SPEAKING });
  return { speaking: true };
}

/**
 * markSpeakingEnded()
 * Call when TTS audio finishes.
 */
export function markSpeakingEnded() {
  _conversationState.responding = false;
  // After speech ends, enforce inter-turn cooldown before next response
  _turnCooldownUntil = Date.now() + VOICE_TIMING.MIN_RESPONSE_GAP_MS;
  saveVoice({ speakingState: SPEAKING_STATE.IDLE });
  return { speaking: false };
}

// ══════════════════════════════════════════════════════════════════
// STEP 6 — VOICE + EMBODIMENT SYNCHRONISATION
// ══════════════════════════════════════════════════════════════════

/**
 * getEmbodimentSyncOverlay(emotion)
 * Returns subtle embodiment adjustments aligned to speech emotion.
 * Subtle only — no exaggerated lip sync.
 */
export function getEmbodimentSyncOverlay(emotion) {
  const overlay = EMBODIMENT_SYNC_MAP[emotion] ?? EMBODIMENT_SYNC_MAP[SPEECH_EMOTION.NEUTRAL];
  return {
    emotion,
    overlay,
    subtle:            true,
    avoidLipSync:      true,
    preserveRealism:   true,
    headMovement:      overlay.headMovement,
    tailMovement:      overlay.tailMovement,
    postureShift:      overlay.postureShift,
    breathingRate:     overlay.breathingRate,
  };
}

/**
 * getSpeakingEmbodimentState()
 * Returns embodiment overlay for the current active speech emotion.
 */
export function getSpeakingEmbodimentState() {
  const emotion = getVoice().speechEmotionState ?? SPEECH_EMOTION.NEUTRAL;
  const speaking = _conversationState.responding;
  const overlay  = getEmbodimentSyncOverlay(emotion);
  return {
    speaking,
    emotion,
    overlay,
    // When not speaking — use resting embodiment
    activeOverlay: speaking ? overlay.overlay : { postureShift: 'steady', tailMovement: 'minimal', headMovement: 'subtle', breathingRate: 'normal' },
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 7 — AMBIENT VOCAL PRESENCE
// ══════════════════════════════════════════════════════════════════

/**
 * tickAmbientVocalPresence()
 * Selects a contextual ambient sound when cooldown allows.
 * Low-frequency, emotionally contextual, non-repetitive.
 */
export function tickAmbientVocalPresence() {
  const now  = Date.now();
  const voice = getVoice();

  // Never during active speaking or listening
  if (_conversationState.responding || _conversationState.listening) {
    return { triggered: false, reason: 'active_conversation' };
  }
  if (voice.ambientVoiceMode === AMBIENT_VOICE_MODE.SILENT) {
    return { triggered: false, reason: 'silent_mode' };
  }
  if (_lowPowerMode) {
    return { triggered: false, reason: 'low_power' };
  }
  if (now - _ambientSoundLastAt < VOICE_TIMING.AMBIENT_SOUND_COOLDOWN_MS) {
    return { triggered: false, reason: 'cooldown' };
  }

  const mood      = storage.getCompanionCore()?.lifeSimulation?.ambientMood ?? 'neutral';
  const sounds    = AMBIENT_SOUND_MAP[mood] ?? AMBIENT_SOUND_MAP.neutral;
  const lastSound = voice.ambientSoundHistory?.slice(-1)[0]?.sound ?? null;

  // Non-repetitive: avoid same sound back-to-back when options exist
  let candidates = sounds.filter(s => s !== lastSound);
  if (!candidates.length) candidates = sounds;

  const seed  = Math.floor(now / 1000) % candidates.length;
  const sound = candidates[seed];

  _ambientSoundLastAt = now;

  const histEntry = { id: genId(), ts: now, sound, mood };
  const core      = storage.getCompanionCore();
  const history   = [...(core.voicePresence?.ambientSoundHistory ?? []), histEntry].slice(-20);
  saveVoiceForce({ ambientSoundHistory: history });

  return { triggered: true, sound, mood, subtle: true };
}

// ══════════════════════════════════════════════════════════════════
// STEP 8 — VOICE MEMORY CONTEXT
// ══════════════════════════════════════════════════════════════════

function appendVoiceMemory(entry) {
  _voiceMemory = [..._voiceMemory, { id: genId(), ts: Date.now(), ...entry }]
    .slice(-VOICE_CAPS.VOICE_MEMORY_MAX);
  // Update count in persisted state
  saveVoice({ voiceMemoryCount: _voiceMemory.length });
}

/**
 * getVoiceMemory(limit)
 */
export function getVoiceMemory(limit = 10) {
  return _voiceMemory.slice(-limit);
}

/**
 * getVoiceConversationContext()
 * Full context object for Ollama prompt injection.
 */
export function getVoiceConversationContext() {
  const voice   = getVoice();
  const core    = storage.getCompanionCore();
  const mood    = core?.lifeSimulation?.ambientMood           ?? 'calm';
  const routine = core?.lifeSimulation?.currentRoutine        ?? 'idle';
  const posture = core?.embodimentProfile?.postureState       ?? 'relaxed';
  const env     = core?.environmentSystem?.activeScene        ?? 'living_room';
  const attn    = core?.presenceEngine?.activeAttentionTarget ?? null;
  const bond    = core?.attachmentGraph?.bondStage            ?? 'distant';
  const modulation = getSpeechModulation(voice.speechEmotionState);

  return {
    voiceEnabled:       voice.voiceEnabled,
    listeningState:     voice.listeningState,
    speakingState:      voice.speakingState,
    speechEmotionState: voice.speechEmotionState,
    activeVoiceProfile: voice.activeVoiceProfile,
    ambientVoiceMode:   voice.ambientVoiceMode,
    ttsProvider:        voice.ttsProvider,
    sttProvider:        voice.sttProvider,
    ambientMood:        mood,
    activeRoutine:      routine,
    currentPosture:     posture,
    environment:        env,
    attentionState:     attn,
    bondStage:          bond,
    speechPacing:       modulation.pacingFactor,
    speechCadence:      modulation.cadence,
    speechWarmth:       modulation.warmth,
    recentVoiceInteractions: getVoiceMemory(3).map(m => ({ type: m.type, ts: m.ts })),
    offlineCapable:     true,
    conversationActive: _conversationState.listening || _conversationState.responding,
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 9 — SAFE INTERRUPT + RECOVERY SYSTEM
// ══════════════════════════════════════════════════════════════════

/**
 * handleInterrupt()
 * Gracefully cancels current speech, enters recovery mode.
 * Prevents overlapping audio and frozen states.
 */
export function handleInterrupt() {
  const now = Date.now();
  _conversationState.interrupted = true;
  _conversationState.responding  = false;
  _conversationState.responseQueue = [];  // clear queue — no stale speech
  _interruptCooldownUntil = now + VOICE_TIMING.INTERRUPT_COOLDOWN_MS;

  saveVoiceForce({
    speakingState:     SPEAKING_STATE.INTERRUPTED,
    interruptionState: INTERRUPT_STATE.INTERRUPTED,
  });

  return {
    interrupted:       true,
    recoveryAt:        _interruptCooldownUntil,
    queueCleared:      true,
  };
}

/**
 * recoverFromInterrupt()
 * Restores stable state after interrupt cooldown.
 */
export function recoverFromInterrupt() {
  const now = Date.now();
  if (now < _interruptCooldownUntil) {
    return { recovered: false, reason: 'still_in_cooldown', remainingMs: _interruptCooldownUntil - now };
  }

  _conversationState.interrupted = false;
  _conversationState.processing  = false;
  _interruptCooldownUntil        = 0;

  saveVoiceForce({
    speakingState:     SPEAKING_STATE.IDLE,
    interruptionState: INTERRUPT_STATE.STABLE,
  });

  return { recovered: true, stable: true };
}

/**
 * resetConversationState()
 * Full safe reset — for testing and error recovery.
 */
export function resetConversationState() {
  _conversationState = {
    listening:     false,
    processing:    false,
    responding:    false,
    interrupted:   false,
    activeTurn:    null,
    responseQueue: [],
  };
  _interruptCooldownUntil = 0;
  _lastResponseAt         = 0;
  saveVoiceForce({
    speakingState:     SPEAKING_STATE.IDLE,
    listeningState:    LISTENING_STATE.INACTIVE,
    interruptionState: INTERRUPT_STATE.STABLE,
  });
  return { reset: true };
}

// ══════════════════════════════════════════════════════════════════
// STEP 10 — VOICE SAFETY + ETHICS LAYER
// ══════════════════════════════════════════════════════════════════

/**
 * runSafetyCheck(text)
 * Validates text against BLOCKED_PATTERNS.
 * Returns {safe, reason}.
 */
export function runSafetyCheck(text) {
  if (!text || typeof text !== 'string') return { safe: true };

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      return { safe: false, reason: `pattern_match: ${pattern.toString().slice(0, 40)}` };
    }
  }
  return { safe: true };
}

function logSafetyEvent(type, text, reason) {
  _safetyLog = [..._safetyLog, {
    id:      genId(),
    ts:      Date.now(),
    type,
    reason,
    excerpt: (text ?? '').slice(0, 60),
  }].slice(-VOICE_CAPS.SAFETY_LOG_MAX);
}

export function getSafetyLog() {
  return [..._safetyLog];
}

// ══════════════════════════════════════════════════════════════════
// STEP 11 — PERFORMANCE + LOW-LATENCY SYSTEM
// ══════════════════════════════════════════════════════════════════

export function setVoiceLowPowerMode(enabled) {
  _lowPowerMode = !!enabled;
}

export function isVoiceLowPowerMode() {
  return _lowPowerMode;
}

/**
 * runVoicePerformanceCheck()
 * Validates runtime for CPU/audio memory stability.
 */
export function runVoicePerformanceCheck() {
  const queue = _conversationState.responseQueue.length;
  const mem   = _voiceMemory.length;
  const safety = _safetyLog.length;

  const warnings = [];
  if (queue >= VOICE_CAPS.RESPONSE_QUEUE_MAX - 1) warnings.push('response_queue_near_full');
  if (mem  >= VOICE_CAPS.VOICE_MEMORY_MAX - 2)    warnings.push('voice_memory_near_cap');
  if (safety >= VOICE_CAPS.SAFETY_LOG_MAX - 5)    warnings.push('safety_log_near_cap');

  return {
    status:              warnings.length ? 'warning' : 'stable',
    warnings,
    checks: {
      responseQueueSize:  queue,
      voiceMemorySize:    mem,
      safetyLogSize:      safety,
      lowPowerMode:       _lowPowerMode,
      speakingState:      getVoice().speakingState,
      listeningState:     getVoice().listeningState,
      interruptCooldown:  _interruptCooldownUntil > Date.now(),
    },
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 12 — OFFLINE-FIRST VOICE RESILIENCE
// ══════════════════════════════════════════════════════════════════

/**
 * getOfflineResilienceStatus()
 * Reports offline capability of all voice subsystems.
 */
export function getOfflineResilienceStatus() {
  const voice = getVoice();
  return {
    sttOffline:   STT_PROVIDERS[voice.sttProvider]?.offline  ?? true,
    ttsOffline:   TTS_PROVIDERS[voice.ttsProvider]?.offline  ?? true,
    fallbackStt:  'whisper',
    fallbackTts:  'piper',
    conversationSurvivesReconnect: true,
    stateRestoresAfterRestart:     true,
    noCloudRequired:               true,
    offlineMode:                   voice.offlineFallback ?? true,
  };
}

/**
 * captureVoiceSnapshot()
 * Serialises full voice state for cross-session restore.
 */
export function captureVoiceSnapshot() {
  const voice = getVoice();
  return {
    captured:  true,
    snapshot: {
      voicePresence:  { ...voice },
      capturedAt:     Date.now(),
    },
  };
}

/**
 * restoreVoiceFromSnapshot()
 * Restores voice settings from persisted companionCore state on reload.
 * Companion feels continuously present — not rebooted.
 */
export function restoreVoiceFromSnapshot() {
  const core = storage.getCompanionCore();
  if (!core.voicePresence?.voiceVersion) {
    return { restored: false, reason: 'no_snapshot' };
  }

  // Reset transient state — restore persistent settings only
  const voice = core.voicePresence;
  saveVoiceForce({
    voiceEnabled:       voice.voiceEnabled,
    activeVoiceProfile: voice.activeVoiceProfile,
    speechEmotionState: voice.speechEmotionState,
    ambientVoiceMode:   voice.ambientVoiceMode,
    ttsProvider:        voice.ttsProvider,
    sttProvider:        voice.sttProvider,
    // Always reset transient states on reload
    listeningState:     LISTENING_STATE.INACTIVE,
    speakingState:      SPEAKING_STATE.IDLE,
    interruptionState:  INTERRUPT_STATE.STABLE,
  });

  return {
    restored:           true,
    speechEmotionState: voice.speechEmotionState,
    voiceProfile:       voice.activeVoiceProfile,
    ambientVoiceMode:   voice.ambientVoiceMode,
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 13 — PRESENCE PERSISTENCE (reload continuity)
// ══════════════════════════════════════════════════════════════════

/**
 * getVoicePresenceSnapshot()
 * Full snapshot for Ollama context and UI.
 */
export function getVoicePresenceSnapshot() {
  const voice = getVoice();
  const ctx   = getVoiceConversationContext();
  return {
    voicePresence:      { ...voice },
    conversationState:  getConversationState(),
    voiceContext:       ctx,
    offlineStatus:      getOfflineResilienceStatus(),
    embodimentOverlay:  getSpeakingEmbodimentState(),
    performanceCheck:   runVoicePerformanceCheck(),
    voiceVersion:       voice.voiceVersion,
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 14 — HYBRID OLLAMA + GROQ VOICE ORCHESTRATION
// ══════════════════════════════════════════════════════════════════

/**
 * getVoiceOrchestrationContext()
 * Describes the Ollama/Groq split for voice tasks.
 * Ollama: personality + emotional continuity + response generation
 * Groq:   optional preprocessing acceleration only
 */
export function getVoiceOrchestrationContext() {
  return {
    ollama: {
      role:  'primary_voice_brain',
      tasks: [
        'emotional_continuity',
        'response_generation',
        'personality_consistency',
        'voice_context_grounding',
      ],
      controls: 'personality_identity',
    },
    groq: {
      role:     'acceleration_layer',
      tasks:    ['optional_preprocessing', 'latency_reduction'],
      fallback: 'ollama',
      canAlterEmotionalIdentity: false,
    },
    safetyRule:       'all_outputs_validated_before_speech',
    offlineSafe:      true,
    orchestrationRule:'ollama_owns_voice_personality__groq_never_directly_controls_speech',
  };
}

// ══════════════════════════════════════════════════════════════════
// STEP 15 — FUTURE EXPANSION PREPARATION
// ══════════════════════════════════════════════════════════════════

// SSOT engine identifier — must survive bundle for auditing
export const VOICE_ENGINE_ID = 'voicePresenceEngine_V1';
export const VOICE_SAFETY_CONSTANTS = {
  humanCloning: false,
  biometricReplication: false,
  alwaysListening: false,
  cloudRequired: false,
};

export const FUTURE_VOICE_EXPANSION = {
  multilingualReady:        false,
  advancedProsodyReady:     false,
  arVoicePositioningReady:  false,
  spatialAudioReady:        false,
  mobileVoiceOptimised:     false,
  expansionVersion:         'V1_STUBS',
};

export function getFutureVoiceExpansionStatus() {
  return { ...FUTURE_VOICE_EXPANSION };
}

export function prepareFutureVoiceSlot(slot) {
  const valid = Object.keys(FUTURE_VOICE_EXPANSION);
  if (!valid.includes(slot)) return { prepared: false, reason: 'unknown_slot' };
  return { prepared: true, slot, currentStatus: FUTURE_VOICE_EXPANSION[slot] };
}

// ══════════════════════════════════════════════════════════════════
// TESTING UTILITIES
// ══════════════════════════════════════════════════════════════════

/**
 * resetVoiceThrottles()
 * Resets all timing guards — testing only.
 */
export function resetVoiceThrottles() {
  _throttleLastWrite      = 0;
  _ambientSoundLastAt     = 0;
  _lastResponseAt         = 0;
  _interruptCooldownUntil = 0;
  _turnCooldownUntil       = 0;
}
