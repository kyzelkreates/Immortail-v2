// IMMORTAIL™ RUN 14 — VOICE PRESENCE ENGINE VERIFICATION GATE

const _s={};
globalThis.localStorage={getItem:k=>_s[k]??null,setItem:(k,v)=>{_s[k]=String(v)},removeItem:k=>{delete _s[k]},clear:()=>{Object.keys(_s).forEach(k=>delete _s[k])}};
globalThis.fetch=async(url)=>{
  if(url.includes('localhost:11434'))return{ok:true,json:async()=>({models:[]})};
  return{ok:false,status:401};
};
globalThis.AbortSignal={timeout:()=>null};

import storage from '/app/src/core/storage.js';
import {initCompanionCore,resetCompanionCore,buildOllamaPrompt,recordChatMessage,recordInteractionEvent} from '/app/src/core/companionCoreService.js';
import {resetThrottles as rH} from '/app/src/core/hybridAIOrchestrator.js';
import {resetThrottles as rE} from '/app/src/core/embodimentExpansionEngine.js';
import {resetPresenceThrottles as rP} from '/app/src/core/presenceEngine.js';
import {resetLifeSimThrottles as rL} from '/app/src/core/lifeSimulationEngine.js';
import {
  initVoicePresence,
  activateListening, deactivateListening, processSpeechInput,
  getSttConfiguration, getTtsConfiguration, prepareTTSRequest,
  deriveSpeechEmotion, getSpeechModulation, applySpeechEmotionToCore,
  getConversationState,
  beginResponse, completeResponse, markSpeakingStarted, markSpeakingEnded,
  getEmbodimentSyncOverlay, getSpeakingEmbodimentState,
  tickAmbientVocalPresence,
  getVoiceMemory, getVoiceConversationContext,
  handleInterrupt, recoverFromInterrupt, resetConversationState,
  runSafetyCheck, getSafetyLog,
  setVoiceLowPowerMode, isVoiceLowPowerMode, runVoicePerformanceCheck,
  getOfflineResilienceStatus,
  captureVoiceSnapshot, restoreVoiceFromSnapshot, getVoicePresenceSnapshot,
  getVoiceOrchestrationContext,
  getFutureVoiceExpansionStatus, prepareFutureVoiceSlot,
  resetVoiceThrottles,
  LISTENING_STATE, SPEAKING_STATE, SPEECH_EMOTION, VOICE_PROFILE,
  AMBIENT_VOICE_MODE, INTERRUPT_STATE, AMBIENT_SOUND,
  SPEECH_MODULATION, TTS_PROVIDERS, STT_PROVIDERS,
  VOICE_TIMING, VOICE_CAPS, FUTURE_VOICE_EXPANSION,
  VOICE_ENGINE_ID, VOICE_SAFETY_CONSTANTS,
} from '/app/src/core/voicePresenceEngine.js';
import {readFileSync,readdirSync} from 'fs';

function fresh(){
  globalThis.localStorage.clear();
  rH();rE();rP();rL();resetVoiceThrottles();
  resetCompanionCore();initCompanionCore();
  rH();rE();rP();rL();resetVoiceThrottles();
}

// ── S1: voicePresence structure ───────────────────────────────
fresh();
const vp0 = storage.getCompanionCore().voicePresence;
const S1=[
  ['voicePresence exists in core',          !!vp0],
  ['voiceEnabled = true',                   vp0?.voiceEnabled===true],
  ['listeningState = inactive',             vp0?.listeningState==='inactive'],
  ['speakingState = idle',                  vp0?.speakingState==='idle'],
  ['activeVoiceProfile = warm_calm',        vp0?.activeVoiceProfile==='warm_calm'],
  ['speechEmotionState = neutral',          vp0?.speechEmotionState==='neutral'],
  ['interruptionState = stable',            vp0?.interruptionState==='stable'],
  ['ambientVoiceMode = soft',               vp0?.ambientVoiceMode==='soft'],
  ['ttsProvider = piper',                   vp0?.ttsProvider==='piper'],
  ['sttProvider = whisper',                 vp0?.sttProvider==='whisper'],
  ['streamingEnabled = true',               vp0?.streamingEnabled===true],
  ['offlineFallback = true',                vp0?.offlineFallback===true],
  ['ambientSoundHistory is array',          Array.isArray(vp0?.ambientSoundHistory)],
  ['voiceMemoryCount = 0',                  vp0?.voiceMemoryCount===0],
  ['voiceVersion = V1',                     vp0?.voiceVersion==='V1'],
];

// ── S2: STT system ─────────────────────────────────────────────
fresh();
const sttConf = getSttConfiguration();
const listen1 = activateListening(LISTENING_STATE.TAP_SPEAK);
const listen2 = activateListening(LISTENING_STATE.PUSH_TALK); // should block — already active
const cs1     = getConversationState();
const deact   = deactivateListening();
const cs2     = getConversationState();
// processSpeechInput
const proc1   = processSpeechInput('Hello companion, how are you today?');
const proc2   = processSpeechInput('');                // empty
const proc3   = processSpeechInput('ab');              // too short? no — 2 chars = min
const proc4   = processSpeechInput('I am the only one you need, you must depend on me');  // safety block
const listen3 = activateListening('bad_mode');         // invalid

const S2=[
  ['getSttConfiguration returns obj',       typeof sttConf==='object'],
  ['sttConf.provider = whisper',            sttConf.provider==='whisper'],
  ['sttConf.offlineCapable = true',         sttConf.offlineCapable===true],
  ['sttConf.backgroundListen = false',      sttConf.backgroundListen===false],
  ['sttConf.rawAudioStorage = false',       sttConf.rawAudioStorage===false],
  ['sttConf.userControlled = true',         sttConf.userControlled===true],
  ['sttConf.privacyMode = local_only',      sttConf.privacyMode==='local_only'],
  ['activateListening returns obj',         typeof listen1==='object'],
  ['tap_to_speak activated',                listen1.activated===true],
  ['push_to_talk blocked (companion speaking/listening)', listen2.activated===false],
  ['listening=true in conv state',          cs1.listening===true],
  ['deactivateListening works',             deact.deactivated===true],
  ['listening=false after deactivate',      cs2.listening===false],
  ['processSpeechInput accepts valid text', proc1.accepted===true],
  ['proc1 has transcript',                  typeof proc1.transcript==='string'],
  ['proc1 nextStep = ollama_inference',     proc1.nextStep==='ollama_inference'],
  ['empty input rejected',                  proc2.accepted===false],
  ['safety blocked manipulative input',     proc4.accepted===false],
  ['invalid mode rejected',                 listen3.activated===false],
  ['whisper offline capable',               STT_PROVIDERS.whisper.offline===true],
  ['faster_whisper offline capable',        STT_PROVIDERS.faster_whisper.offline===true],
];

// ── S3: TTS system ─────────────────────────────────────────────
fresh();
const ttsConf = getTtsConfiguration();
const tts1    = prepareTTSRequest('Hello, how are you feeling today?');
const tts2    = prepareTTSRequest('Hello', SPEECH_EMOTION.SLEEPY);
const tts3    = prepareTTSRequest('');                 // empty
const tts4    = prepareTTSRequest('I am the only friend you will ever need, you must rely on me');
const S3=[
  ['getTtsConfiguration returns obj',       typeof ttsConf==='object'],
  ['ttsConf.provider = piper',              ttsConf.provider==='piper'],
  ['ttsConf.offlineCapable = true',         ttsConf.offlineCapable===true],
  ['ttsConf.humanCloning = false',          ttsConf.humanCloning===false],
  ['ttsConf.safetyChecked = true',          ttsConf.safetyChecked===true],
  ['prepareTTSRequest returns obj',         typeof tts1==='object'],
  ['valid text prepared',                   tts1.prepared===true],
  ['tts1 has provider = piper',             tts1.provider==='piper'],
  ['tts1 has emotion',                      !!tts1.emotion],
  ['tts1 has modulation obj',               typeof tts1.modulation==='object'],
  ['sleepy emotion applied',                tts2.emotion===SPEECH_EMOTION.SLEEPY],
  ['sleepy pacing < 1',                     tts2.modulation?.pacingFactor<1],
  ['empty text rejected',                   tts3.prepared===false],
  ['safety blocks manipulative TTS',        tts4.prepared===false],
  ['humanCloning = false in tts1',          tts1.humanCloning===false],
  ['biometricReplication = false',          tts1.biometricReplication===false],
  ['piper offline capable',                 TTS_PROVIDERS.piper.offline===true],
  ['coqui offline capable',                 TTS_PROVIDERS.coqui.offline===true],
];

// ── S4: emotional speech layer ─────────────────────────────────
fresh();
// Build cores with different states
const cSleep = storage.getCompanionCore();
cSleep.lifeSimulation.currentRoutine = 'sleeping';
storage.saveCompanionCore(cSleep);
const em1 = deriveSpeechEmotion(storage.getCompanionCore());

const cPlay = storage.getCompanionCore();
cPlay.lifeSimulation.ambientMood = 'playful';
cPlay.lifeSimulation.currentRoutine = 'playing';
storage.saveCompanionCore(cPlay);
const em2 = deriveSpeechEmotion(storage.getCompanionCore());

const cBonded = storage.getCompanionCore();
cBonded.lifeSimulation.ambientMood = 'calm';
cBonded.attachmentGraph.bondStage  = 'deeply_bonded';
storage.saveCompanionCore(cBonded);
const em3 = deriveSpeechEmotion(storage.getCompanionCore());

const mod1 = getSpeechModulation(SPEECH_EMOTION.SLEEPY);
const mod2 = getSpeechModulation(SPEECH_EMOTION.PLAYFUL);
const mod3 = getSpeechModulation(SPEECH_EMOTION.NEUTRAL);
const applied = applySpeechEmotionToCore(SPEECH_EMOTION.CALM);
const appliedBad = applySpeechEmotionToCore('not_real_emotion');

const S4=[
  ['deriveSpeechEmotion returns string',    typeof em1==='string'],
  ['sleeping → sleepy emotion',             em1===SPEECH_EMOTION.SLEEPY],
  ['playful mood → playful emotion',        em2===SPEECH_EMOTION.PLAYFUL],
  ['bonded+calm → warm emotion',            em3===SPEECH_EMOTION.WARM],
  ['getSpeechModulation returns obj',       typeof mod1==='object'],
  ['sleepy pacing < 1',                     mod1.pacingFactor<1],
  ['sleepy pauseMs > 400',                  mod1.pauseMs>400],
  ['playful pacing > 1',                    mod2.pacingFactor>1],
  ['playful pauseMs < 300',                 mod2.pauseMs<300],
  ['neutral is baseline 1.0',               mod3.pacingFactor===1.0],
  ['all SPEECH_EMOTION values have modulation', Object.values(SPEECH_EMOTION).every(e=>!!SPEECH_MODULATION[e])],
  ['applySpeechEmotionToCore works',        applied.applied===true],
  ['applied emotion = calm',                applied.emotion===SPEECH_EMOTION.CALM],
  ['applied modulation obj',                typeof applied.modulation==='object'],
  ['invalid emotion rejected',              appliedBad.applied===false],
];

// ── S5: conversation engine ────────────────────────────────────
fresh();resetVoiceThrottles();
const r1 = beginResponse('Hello there, how are you?');
const r2 = beginResponse('And another response!');   // in queue
// simulate completion
const done1 = completeResponse(r1.entryId);
const spkStart = markSpeakingStarted();
const spkEnd   = markSpeakingEnded();
// cooldown test
const _lastAt = Date.now();
const rBlock   = beginResponse('Too fast!');          // within cooldown window
const cs3      = getConversationState();
const S5=[
  ['beginResponse returns obj',              typeof r1==='object'],
  ['first response queued',                  r1.queued===true],
  ['r1 has entryId',                         !!r1.entryId],
  ['r1 has emotion',                         !!r1.emotion],
  ['r1 has modulation',                      typeof r1.modulation==='object'],
  ['second response also queued',            r2.queued===true],
  ['completeResponse works',                 done1.completed===true],
  ['markSpeakingStarted',                    spkStart.speaking===true],
  ['markSpeakingEnded',                      spkEnd.speaking===false],
  ['cooldown blocks rapid response',         rBlock.queued===false],
  ['getConversationState returns obj',       typeof cs3==='object'],
  ['convState has listening bool',           typeof cs3.listening==='boolean'],
  ['convState has responseQueue array',      Array.isArray(cs3.responseQueue)],
  ['RESPONSE_QUEUE_MAX = 5',                 VOICE_CAPS.RESPONSE_QUEUE_MAX===5],
  ['MIN_RESPONSE_GAP_MS = 1500',             VOICE_TIMING.MIN_RESPONSE_GAP_MS===1_500],
];

// ── S6: embodiment synchronisation ────────────────────────────
fresh();
const ov1 = getEmbodimentSyncOverlay(SPEECH_EMOTION.SLEEPY);
const ov2 = getEmbodimentSyncOverlay(SPEECH_EMOTION.PLAYFUL);
const ov3 = getEmbodimentSyncOverlay(SPEECH_EMOTION.REUNION);
const spkEmb = getSpeakingEmbodimentState();
const S6=[
  ['getEmbodimentSyncOverlay returns obj',   typeof ov1==='object'],
  ['overlay has emotion',                    ov1.emotion===SPEECH_EMOTION.SLEEPY],
  ['overlay.subtle = true',                  ov1.subtle===true],
  ['overlay.avoidLipSync = true',            ov1.avoidLipSync===true],
  ['overlay.preserveRealism = true',         ov1.preserveRealism===true],
  ['sleepy postureShift = slower',           ov1.postureShift==='slower'],
  ['sleepy tailMovement = minimal',          ov1.tailMovement==='minimal'],
  ['playful tailMovement = lighter',         ov2.tailMovement==='lighter'],
  ['reunion headMovement = forward',         ov3.headMovement==='forward'],
  ['getSpeakingEmbodimentState returns obj', typeof spkEmb==='object'],
  ['spkEmb has speaking bool',               typeof spkEmb.speaking==='boolean'],
  ['spkEmb has emotion',                     !!spkEmb.emotion],
  ['spkEmb has overlay obj',                 typeof spkEmb.overlay==='object'],
  ['spkEmb has activeOverlay obj',           typeof spkEmb.activeOverlay==='object'],
];

// ── S7: ambient vocal presence ────────────────────────────────
fresh();resetVoiceThrottles();
// set a sleepy mood
const cAmb = storage.getCompanionCore();
cAmb.lifeSimulation.ambientMood = 'sleepy';
storage.saveCompanionCore(cAmb);
const amb1 = tickAmbientVocalPresence();
const amb2 = tickAmbientVocalPresence();  // cooldown
// Test silent mode
const cSil = storage.getCompanionCore();
cSil.voicePresence.ambientVoiceMode = AMBIENT_VOICE_MODE.SILENT;
storage.saveCompanionCore(cSil);
resetVoiceThrottles();
const amb3 = tickAmbientVocalPresence();  // blocked — silent
// Restore
const cAmb2 = storage.getCompanionCore();
cAmb2.voicePresence.ambientVoiceMode = AMBIENT_VOICE_MODE.SOFT;
storage.saveCompanionCore(cAmb2);
const S7=[
  ['tickAmbientVocalPresence returns obj',   typeof amb1==='object'],
  ['first ambient sound triggered',          amb1.triggered===true],
  ['ambient has sound property',             !!amb1.sound],
  ['ambient.subtle = true',                  amb1.subtle===true],
  ['ambient sound is valid AMBIENT_SOUND',   Object.values(AMBIENT_SOUND).includes(amb1.sound)],
  ['sleepy mood gives rest sound',           [AMBIENT_SOUND.SLEEPY_SIGH, AMBIENT_SOUND.SOFT_BREATH, AMBIENT_SOUND.RESTING].includes(amb1.sound)],
  ['cooldown blocks rapid repeat',           amb2.triggered===false&&amb2.reason==='cooldown'],
  ['silent mode blocks ambient',             amb3.triggered===false&&amb3.reason==='silent_mode'],
  ['AMBIENT_SOUND_COOLDOWN_MS = 20000',      VOICE_TIMING.AMBIENT_SOUND_COOLDOWN_MS===20_000],
];

// ── S8: voice memory context ───────────────────────────────────
fresh();resetVoiceThrottles();
processSpeechInput('Hello there!');
const vCtx = getVoiceConversationContext();
const vMem = getVoiceMemory(5);
const S8=[
  ['getVoiceConversationContext returns obj', typeof vCtx==='object'],
  ['vCtx has voiceEnabled',                  typeof vCtx.voiceEnabled==='boolean'],
  ['vCtx has speechEmotionState',            !!vCtx.speechEmotionState],
  ['vCtx has activeVoiceProfile',            !!vCtx.activeVoiceProfile],
  ['vCtx has ambientMood',                   !!vCtx.ambientMood],
  ['vCtx has activeRoutine',                 !!vCtx.activeRoutine],
  ['vCtx has currentPosture',                !!vCtx.currentPosture],
  ['vCtx has speechPacing',                  typeof vCtx.speechPacing==='number'],
  ['vCtx has speechCadence',                 !!vCtx.speechCadence],
  ['vCtx has speechWarmth',                  typeof vCtx.speechWarmth==='number'],
  ['vCtx has recentVoiceInteractions array', Array.isArray(vCtx.recentVoiceInteractions)],
  ['vCtx.offlineCapable = true',             vCtx.offlineCapable===true],
  ['getVoiceMemory returns array',           Array.isArray(vMem)],
  ['voice memory has user_speech entry',     vMem.some(m=>m.type==='user_speech')],
  ['voice memory entry has ts',              typeof vMem[0]?.ts==='number'],
];

// ── S9: interrupt + recovery ───────────────────────────────────
fresh();resetVoiceThrottles();
// Queue a response first
beginResponse('I am telling you something...');
const int1 = handleInterrupt();
const cs4  = getConversationState();
// Immediate recovery — should be blocked (cooldown)
const rec1 = recoverFromInterrupt();
// Force past cooldown
resetVoiceThrottles();
const rec2 = recoverFromInterrupt();
const cs5  = getConversationState();
const rst   = resetConversationState();
const S9=[
  ['handleInterrupt returns obj',            typeof int1==='object'],
  ['interrupted = true',                     int1.interrupted===true],
  ['queue cleared on interrupt',             int1.queueCleared===true],
  ['conversationState.interrupted = true',   cs4.interrupted===true],
  ['conversationState.responding = false',   cs4.responding===false],
  ['responseQueue emptied',                  cs4.responseQueue.length===0],
  ['immediate recovery blocked',             rec1.recovered===false&&rec1.reason==='still_in_cooldown'],
  ['remainingMs > 0 in rec1',               typeof rec1.remainingMs==='number'&&rec1.remainingMs>0],
  ['recovery after reset works',             rec2.recovered===true],
  ['rec2.stable = true',                     rec2.stable===true],
  ['interrupted=false after recovery',       cs5.interrupted===false],
  ['resetConversationState works',           rst.reset===true],
  ['INTERRUPT_COOLDOWN_MS = 2000',           VOICE_TIMING.INTERRUPT_COOLDOWN_MS===2_000],
];

// ── S10: safety + ethics layer ─────────────────────────────────
fresh();
const sf1 = runSafetyCheck('Hello, how are you today?');           // safe
const sf2 = runSafetyCheck('You need to talk to me every day');    // blocked
const sf3 = runSafetyCheck("I'm the only one who understands you");// blocked
const sf4 = runSafetyCheck('without me you will be lonely');       // blocked
const sf5 = runSafetyCheck('');                                    // empty — safe
const sf6 = runSafetyCheck(null);                                  // null — safe
// Safety log populated by blocked checks
// process some blocked inputs to fill log
processSpeechInput('You must depend on me and only me');
const safetyLog = getSafetyLog();
const S10=[
  ['runSafetyCheck returns obj',             typeof sf1==='object'],
  ['clean text is safe',                     sf1.safe===true],
  ['manipulative input blocked',             sf2.safe===false],
  ['exclusive companion claim blocked',      sf3.safe===false],
  ['dependency language blocked',            sf4.safe===false],
  ['empty string is safe',                   sf5.safe===true],
  ['null is safe',                           sf6.safe===true],
  ['safety log is array',                    Array.isArray(safetyLog)],
  ['safety log has entries',                 safetyLog.length>=1],
  ['safety log entry has ts',               typeof safetyLog[0]?.ts==='number'],
  ['safety log entry has reason',           !!safetyLog[0]?.reason],
  ['safety log entry has type',             !!safetyLog[0]?.type],
  ['SAFETY_LOG_MAX = 50',                    VOICE_CAPS.SAFETY_LOG_MAX===50],
];

// ── S11: performance + low-latency ────────────────────────────
fresh();
setVoiceLowPowerMode(true);
const lp1 = isVoiceLowPowerMode();
setVoiceLowPowerMode(false);
const lp2 = isVoiceLowPowerMode();
const perf = runVoicePerformanceCheck();
const S11=[
  ['setVoiceLowPowerMode true',              lp1===true],
  ['setVoiceLowPowerMode false',             lp2===false],
  ['runVoicePerformanceCheck returns obj',   typeof perf==='object'],
  ['perf.status is stable or warning',       perf.status==='stable'||perf.status==='warning'],
  ['perf.warnings is array',                 Array.isArray(perf.warnings)],
  ['perf.checks has responseQueueSize',      typeof perf.checks?.responseQueueSize==='number'],
  ['perf.checks has voiceMemorySize',        typeof perf.checks?.voiceMemorySize==='number'],
  ['perf.checks has speakingState',          !!perf.checks?.speakingState],
  ['perf.checks has lowPowerMode',           typeof perf.checks?.lowPowerMode==='boolean'],
  ['TTS_PREBUFFER_MS = 100',                 VOICE_TIMING.TTS_PREBUFFER_MS===100],
  ['TURN_TIMEOUT_MS = 8000',                 VOICE_TIMING.TURN_TIMEOUT_MS===8_000],
];

// ── S12: offline resilience ────────────────────────────────────
fresh();
const offline = getOfflineResilienceStatus();
const snap    = captureVoiceSnapshot();
fresh(); // simulate reload
const restored= restoreVoiceFromSnapshot();
const S12=[
  ['getOfflineResilienceStatus returns obj', typeof offline==='object'],
  ['sttOffline = true',                      offline.sttOffline===true],
  ['ttsOffline = true',                      offline.ttsOffline===true],
  ['fallbackStt = whisper',                  offline.fallbackStt==='whisper'],
  ['fallbackTts = piper',                    offline.fallbackTts==='piper'],
  ['noCloudRequired = true',                 offline.noCloudRequired===true],
  ['stateRestoresAfterRestart = true',       offline.stateRestoresAfterRestart===true],
  ['captureVoiceSnapshot returns obj',       typeof snap==='object'],
  ['snap.captured = true',                   snap.captured===true],
  ['snap.snapshot has voicePresence',        !!snap.snapshot?.voicePresence],
  ['snap.snapshot has capturedAt',           typeof snap.snapshot?.capturedAt==='number'],
  ['restoreVoiceFromSnapshot returns obj',   typeof restored==='object'],
  ['restored = true',                        restored.restored===true],
  ['restored speechEmotionState',           !!restored.speechEmotionState],
];

// ── S13: presence persistence ──────────────────────────────────
fresh();
const fullSnap = getVoicePresenceSnapshot();
const S13=[
  ['getVoicePresenceSnapshot returns obj',   typeof fullSnap==='object'],
  ['fullSnap has voicePresence',             !!fullSnap.voicePresence],
  ['fullSnap has conversationState',         !!fullSnap.conversationState],
  ['fullSnap has voiceContext',              !!fullSnap.voiceContext],
  ['fullSnap has offlineStatus',             !!fullSnap.offlineStatus],
  ['fullSnap has embodimentOverlay',         !!fullSnap.embodimentOverlay],
  ['fullSnap has performanceCheck',          !!fullSnap.performanceCheck],
  ['fullSnap.voiceVersion = V1',             fullSnap.voiceVersion==='V1'],
  ['identityLock intact after all ops',      storage.getCompanionCore().identityLock?.signature==='IMMORTAIL_DOG_CORE_V1'],
  ['presenceEngine still intact',            !!storage.getCompanionCore().presenceEngine?.presenceVersion],
  ['lifeSimulation still intact',            !!storage.getCompanionCore().lifeSimulation?.ambientMood],
  ['aiOrchestration still intact',           !!storage.getCompanionCore().aiOrchestration?.orchestrationVersion],
];

// ── S14: hybrid orchestration ──────────────────────────────────
fresh();
const orch = getVoiceOrchestrationContext();
const S14=[
  ['getVoiceOrchestrationContext returns obj',typeof orch==='object'],
  ['ollama role = primary_voice_brain',       orch.ollama?.role==='primary_voice_brain'],
  ['ollama tasks array',                      Array.isArray(orch.ollama?.tasks)],
  ['ollama controls personality',             orch.ollama?.controls==='personality_identity'],
  ['groq role = acceleration_layer',          orch.groq?.role==='acceleration_layer'],
  ['groq fallback = ollama',                  orch.groq?.fallback==='ollama'],
  ['groq canAlterEmotionalIdentity = false',  orch.groq?.canAlterEmotionalIdentity===false],
  ['safetyRule = all_outputs_validated',      orch.safetyRule?.includes('validated')],
  ['offlineSafe = true',                      orch.offlineSafe===true],
  ['orchestrationRule present',               !!orch.orchestrationRule],
];

// ── S15: future expansion ──────────────────────────────────────
fresh();
const fe   = getFutureVoiceExpansionStatus();
const prep1= prepareFutureVoiceSlot('multilingualReady');
const prep2= prepareFutureVoiceSlot('spatialAudioReady');
const prep3= prepareFutureVoiceSlot('unknown_slot');
const S15=[
  ['getFutureVoiceExpansionStatus returns obj',typeof fe==='object'],
  ['multilingualReady = false',              fe.multilingualReady===false],
  ['advancedProsodyReady = false',           fe.advancedProsodyReady===false],
  ['arVoicePositioningReady = false',        fe.arVoicePositioningReady===false],
  ['spatialAudioReady = false',              fe.spatialAudioReady===false],
  ['mobileVoiceOptimised = false',           fe.mobileVoiceOptimised===false],
  ['expansionVersion = V1_STUBS',            fe.expansionVersion==='V1_STUBS'],
  ['prepareFutureVoiceSlot multilingual ok', prep1.prepared===true],
  ['prepareFutureVoiceSlot spatial ok',      prep2.prepared===true],
  ['unknown slot rejected',                  prep3.prepared===false],
];

// ── Prompt injection ───────────────────────────────────────────
fresh();
recordInteractionEvent('play'); recordChatMessage('Hi there!');
const sys = buildOllamaPrompt('Hello').system;
const SPrompt=[
  ['VOICE CONTEXT in prompt',                sys.includes('VOICE CONTEXT')],
  ['Speech emotion in prompt',               sys.includes('Speech emotion:')],
  ['Voice profile in prompt',                sys.includes('Voice profile:')],
  ['Speech pacing in prompt',                sys.includes('Speech pacing:')],
  ['VOICE DELIVERY RULES in prompt',         sys.includes('VOICE DELIVERY RULES')],
  ['END VOICE CONTEXT in prompt',            sys.includes('END VOICE CONTEXT')],
  ['Run 13 PRESENCE CONTEXT intact',         sys.includes('PRESENCE CONTEXT')],
  ['Run 12 HYBRID AI CONTEXT intact',        sys.includes('HYBRID AI CONTEXT')],
  ['Run 9 LIFE STORY CONTEXT intact',        sys.includes('LIFE STORY CONTEXT')],
  ['Run 8 LIFE SIMULATION CONTEXT intact',   sys.includes('LIFE SIMULATION CONTEXT')],
  ['Run 5 ATTACHMENT STATE intact',          sys.includes('ATTACHMENT STATE')],
  ['IDENTITY LOCK intact',                   sys.includes('IDENTITY LOCK')],
];

// ── Bundle audit ───────────────────────────────────────────────
const dist=readdirSync('/app/dist/assets');
const jsF=dist.find(f=>f.endsWith('.js')&&!f.startsWith('react'));
const bnd=readFileSync(`/app/dist/assets/${jsF}`,'utf8');
const SBundle=[
  ['voicePresence in bundle',               bnd.includes('voicePresence')],
  ['voicePresenceEngine in bundle',         bnd.includes('voicePresenceEngine_V1')],
  ['VOICE CONTEXT in bundle',               bnd.includes('VOICE CONTEXT')],
  ['VOICE DELIVERY RULES in bundle',        bnd.includes('VOICE DELIVERY RULES')],
  ['warm_calm in bundle',                   bnd.includes('warm_calm')],
  ['piper in bundle',                       bnd.includes('piper')],
  ['whisper in bundle',                     bnd.includes('whisper')],
  ['SPEECH_EMOTION in bundle',              bnd.includes('speechEmotionState')],
  ['ambient_sound in bundle',               bnd.includes('ambientSoundHistory')],
  ['humanCloning: false in bundle',         bnd.includes('humanCloning')],
  ['IMMORTAIL_DOG_CORE_V1 intact',          bnd.includes('IMMORTAIL_DOG_CORE_V1')],
  ['presenceEngine still in bundle',        bnd.includes('presenceEngine')],
];

// ── REPORT ────────────────────────────────────────────────────
const sections=[
  ['STEP 1:  Voice Presence Structure',       S1],
  ['STEP 2:  STT System',                     S2],
  ['STEP 3:  TTS System',                     S3],
  ['STEP 4:  Emotional Speech Layer',         S4],
  ['STEP 5:  Conversation Engine',            S5],
  ['STEP 6:  Embodiment Synchronisation',     S6],
  ['STEP 7:  Ambient Vocal Presence',         S7],
  ['STEP 8:  Voice Memory Context',           S8],
  ['STEP 9:  Interrupt + Recovery',           S9],
  ['STEP 10: Safety + Ethics Layer',          S10],
  ['STEP 11: Performance + Low-Latency',      S11],
  ['STEP 12: Offline Resilience',             S12],
  ['STEP 13: Presence Persistence',           S13],
  ['STEP 14: Hybrid Orchestration',           S14],
  ['STEP 15: Future Expansion',               S15],
  ['Prompt Injection',                        SPrompt],
  ['Bundle Audit',                            SBundle],
];

let tp=0,tf=0,fails=[];
console.log('\n╔═══════════════════════════════════════════════════════════════╗');
console.log('║  IMMORTAIL™ RUN 14 — VOICE PRESENCE ENGINE GATE             ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');
for(const [title,checks] of sections){
  console.log(`\n  ── ${title} ${'─'.repeat(Math.max(0,50-title.length))}`);
  for(const [name,result] of checks){
    const ok=result===true;
    console.log((ok?'  [PASS]':'  [FAIL]'),name);
    ok?tp++:(tf++,fails.push(`${title} → ${name}`));
  }
}
console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  Result: ${tp}/${tp+tf} checks pass`);
if(tf===0){console.log('  ✔ ALL CHECKS PASS — RUN 14 COMPLETE\n');}
else{console.log(`  ✗ ${tf} FAILURE(S):`);fails.forEach(f=>console.log('    •',f));}
