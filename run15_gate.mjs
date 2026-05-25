// IMMORTAIL™ RUN 15 — MEMORY REFLECTION ENGINE VERIFICATION GATE

const _s={};
globalThis.localStorage={getItem:k=>_s[k]??null,setItem:(k,v)=>{_s[k]=String(v)},removeItem:k=>{delete _s[k]},clear:()=>{Object.keys(_s).forEach(k=>delete _s[k])}};
globalThis.fetch=async()=>({ok:true,json:async()=>({})});
globalThis.AbortSignal={timeout:()=>null};

import storage from '/app/src/core/storage.js';
import {
  initCompanionCore, resetCompanionCore, buildOllamaPrompt,
  recordChatMessage, recordInteractionEvent,
} from '/app/src/core/companionCoreService.js';
import {resetThrottles as rH} from '/app/src/core/hybridAIOrchestrator.js';
import {resetThrottles as rE} from '/app/src/core/embodimentExpansionEngine.js';
import {resetPresenceThrottles as rP} from '/app/src/core/presenceEngine.js';
import {resetLifeSimThrottles as rL} from '/app/src/core/lifeSimulationEngine.js';
import {resetVoiceThrottles}          from '/app/src/core/voicePresenceEngine.js';
import {
  initMemoryReflection,
  scoreMemoryImportance,
  categoriseMemory, categoriseBatch, getMemoryCategories,
  deriveRecallTone, recallMemories, endRecallSession,
  safeCompressMemories,
  detectAndCategoriseMilestones,
  getRelationshipPhase, deriveAttachmentTrend, updateRelationshipPhase,
  getMemoryReflectionContext,
  checkAnniversaries, getAnniversaryLog,
  validateMemoryUpdate,
  lazyLoadMemoryChunk, getIndexedMemoryRetrieval, runMemoryPerformanceCheck,
  getOfflineMemoryStatus,
  captureMemorySnapshot, restoreMemoryFromSnapshot,
  getMemoryOrchestrationContext,
  runMemorySafetyCheck, getMemorySafetyLog,
  getMemoryReflectionSnapshot,
  resetReflectionThrottles,
  REFLECTION_STATE, RECALL_INTENSITY, MEMORY_FOCUS_MODE,
  MEMORY_CATEGORY, RECALL_TONE, REFLECTION_CAPS, REFLECTION_TIMING,
  MEMORY_REFLECTION_ENGINE_ID, MEMORY_SAFETY,
} from '/app/src/core/memoryReflectionEngine.js';
import {readFileSync, readdirSync} from 'fs';

// ── Shared memory fixtures ─────────────────────────────────────
const NOW = Date.now();
const M_CHAT   = { id:'m1', ts: NOW-100000, type:'chat',         label:'Morning chat',   memoryWeight:5, mood:'calm',   sentiment:'positive' };
const M_IMAGE  = { id:'m2', ts: NOW-200000, type:'image',        label:'First photo',    memoryWeight:9, mood:'joyful', sentiment:'very_positive', category:'media' };
const M_REUNION= { id:'m3', ts: NOW-300000, type:'reunion_event',label:'Reunion',        memoryWeight:8, mood:'joyful', sentiment:'very_positive' };
const M_IDLE   = { id:'m4', ts: NOW-400000, type:'rest',         label:'Idle rest',      memoryWeight:1, mood:'calm',   sentiment:'neutral' };
const M_IDLE2  = { id:'m5', ts: NOW-500000, type:'rest',         label:'Idle rest 2',    memoryWeight:1, mood:'calm',   sentiment:'neutral' };
const M_PLAY   = { id:'m6', ts: NOW-600000, type:'play',         label:'Playtime',       memoryWeight:6, mood:'playful',sentiment:'positive' };
const M_IDLE3  = { id:'m7', ts: NOW-700000, type:'rest',         label:'Idle rest 3',    memoryWeight:1, mood:'calm',   sentiment:'neutral' };
const M_IDLE4  = { id:'m8', ts: NOW-800000, type:'rest',         label:'Idle rest 4',    memoryWeight:1, mood:'calm',   sentiment:'neutral' };
const M_IDLE5  = { id:'m9', ts: NOW-900000, type:'rest',         label:'Idle rest 5',    memoryWeight:1, mood:'calm',   sentiment:'neutral' };
const M_MS     = { id:'m10',ts: NOW-50000,  type:'reunion_event',label:'Big reunion',    memoryWeight:10,mood:'joyful', sentiment:'very_positive', isMilestone:true };

function fresh(){
  globalThis.localStorage.clear();
  rH();rE();rP();rL();resetVoiceThrottles();resetReflectionThrottles();
  resetCompanionCore();initCompanionCore();
  rH();rE();rP();rL();resetVoiceThrottles();resetReflectionThrottles();
}

// ── S1: memoryReflection structure ────────────────────────────
fresh();
const mr0 = storage.getCompanionCore().memoryReflection;
const S1=[
  ['memoryReflection exists in core',           !!mr0],
  ['activeRecallMode = false',                   mr0?.activeRecallMode===false],
  ['reflectionState = idle',                     mr0?.reflectionState==='idle'],
  ['emotionalRecallIntensity = medium',          mr0?.emotionalRecallIntensity==='medium'],
  ['lastReflectedMemory = null',                 mr0?.lastReflectedMemory===null],
  ['reflectionQueue is array',                   Array.isArray(mr0?.reflectionQueue)],
  ['memoryFocusMode = balanced',                 mr0?.memoryFocusMode==='balanced'],
  ['memoryCategories is object',                 typeof mr0?.memoryCategories==='object'],
  ['milestones slot exists',                     Array.isArray(mr0?.memoryCategories?.milestones)],
  ['emotionalMoments slot exists',               Array.isArray(mr0?.memoryCategories?.emotionalMoments)],
  ['routineInteractions slot exists',            Array.isArray(mr0?.memoryCategories?.routineInteractions)],
  ['mediaLinkedEvents slot exists',              Array.isArray(mr0?.memoryCategories?.mediaLinkedEvents)],
  ['bondingEvents slot exists',                  Array.isArray(mr0?.memoryCategories?.bondingEvents)],
  ['environmentalEvents slot exists',            Array.isArray(mr0?.memoryCategories?.environmentalEvents)],
  ['anniversaryLog is array',                    Array.isArray(mr0?.anniversaryLog)],
  ['relationshipPhase = stranger',               mr0?.relationshipPhase==='stranger'],
  ['attachmentTrend = stable',                   mr0?.attachmentTrend==='stable'],
  ['emotionalContinuityState = grounded',        mr0?.emotionalContinuityState==='grounded'],
  ['lastMeaningfulMemory = null',                mr0?.lastMeaningfulMemory===null],
  ['reflectionVersion = V1',                     mr0?.reflectionVersion==='V1'],
];

// ── S2: importance scoring ────────────────────────────────────
fresh();
const core0 = storage.getCompanionCore();
const sc1   = scoreMemoryImportance(M_IMAGE,  { userBond:30, emotionalResonance:50 });
const sc2   = scoreMemoryImportance(M_CHAT,   { userBond:20, emotionalResonance:20 });
const sc3   = scoreMemoryImportance(M_IDLE,   { userBond:5,  emotionalResonance:5, typeCount:10 });
const sc4   = scoreMemoryImportance(null,     {});
const sc5   = scoreMemoryImportance(M_REUNION,{ userBond:40, emotionalResonance:60 });
const S2=[
  ['scoreMemoryImportance returns obj',           typeof sc1==='object'],
  ['has importanceScore',                         typeof sc1.importanceScore==='number'],
  ['has score field',                             typeof sc1.score==='number'],
  ['has category',                                !!sc1.category],
  ['image scores high (>= 60)',                   sc1.importanceScore>=60],
  ['image → mediaLinkedEvents category',          sc1.category===MEMORY_CATEGORY.MEDIA_LINKED],
  ['reunion scores high',                         sc5.importanceScore>=60],
  ['reunion → bondingEvents category',            sc5.category===MEMORY_CATEGORY.BONDING_EVENTS],
  ['chat → routine or emotional category',        [MEMORY_CATEGORY.ROUTINE_INTERACTIONS, MEMORY_CATEGORY.EMOTIONAL_MOMENTS].includes(sc2.category)],
  ['idle scores low (< 40)',                      sc3.importanceScore<40],
  ['null entry returns min score',               sc4.importanceScore===1],
  ['null entry has category',                     !!sc4.category],
  ['score clamped 1–100',                         sc1.importanceScore>=1&&sc1.importanceScore<=100],
];

// ── S3: memory categorisation ─────────────────────────────────
fresh();
const cat1  = categoriseMemory(M_IMAGE,   { userBond:30 });
const cat2  = categoriseMemory(M_REUNION, { userBond:40 });
const cat3  = categoriseMemory(M_IDLE,    { userBond:5  });
const cat4  = categoriseMemory({},        {});             // no id → rejected
const cat5  = categoriseMemory({ id:'x', label:'no-ts' }, {}); // no ts → rejected
const cats  = getMemoryCategories();
const batch = categoriseBatch([M_CHAT, M_PLAY, M_IDLE2], { userBond:20 });
const S3=[
  ['categoriseMemory returns obj',               typeof cat1==='object'],
  ['image categorised',                          cat1.categorised===true],
  ['image → mediaLinkedEvents',                  cat1.category===MEMORY_CATEGORY.MEDIA_LINKED],
  ['reunion → bondingEvents',                    cat2.category===MEMORY_CATEGORY.BONDING_EVENTS],
  ['idle categorised',                           cat3.categorised===true],
  ['no-id entry rejected',                       cat4.categorised===false],
  ['no-ts entry rejected',                       cat5.categorised===false],
  ['cat5 reason = missing_timestamp',            cat5.reason==='missing_timestamp'],
  ['getMemoryCategories returns obj',            typeof cats==='object'],
  ['media slot has entry',                       cats[MEMORY_CATEGORY.MEDIA_LINKED]?.length>=1],
  ['bonding slot has entry',                     cats[MEMORY_CATEGORY.BONDING_EVENTS]?.length>=1],
  ['categoriseBatch returns obj',                typeof batch==='object'],
  ['batch processed count correct',              batch.processed===3],
  ['batch categorised > 0',                      batch.categorised>=1],
  ['MEMORY_CATEGORY has all 6 slots',           Object.keys(MEMORY_CATEGORY).length===6],
];

// ── S4: emotional recall engine ────────────────────────────────
fresh();
// Inject test memories into core
const c4 = storage.getCompanionCore();
c4.memory = [M_IMAGE, M_CHAT, M_REUNION, M_IDLE, M_PLAY];
c4.lifeSimulation.ambientMood = 'calm';
storage.saveCompanionCore(c4);

const tone1 = deriveRecallTone(storage.getCompanionCore());
const recall1 = recallMemories({ focusMode: MEMORY_FOCUS_MODE.BALANCED });
const recall2 = recallMemories();  // cooldown
const endR = endRecallSession();

// sleepy mood
const cSleep = storage.getCompanionCore();
cSleep.lifeSimulation.ambientMood = 'sleepy';
storage.saveCompanionCore(cSleep);
const toneSleep = deriveRecallTone(storage.getCompanionCore());

// playful mood
const cPlay = storage.getCompanionCore();
cPlay.lifeSimulation.ambientMood = 'playful';
storage.saveCompanionCore(cPlay);
const tonePlay = deriveRecallTone(storage.getCompanionCore());

// media focus mode
resetReflectionThrottles();
const recall3 = recallMemories({ focusMode: MEMORY_FOCUS_MODE.MEDIA });

const S4=[
  ['deriveRecallTone returns obj',               typeof tone1==='object'],
  ['calm → warm tone',                           tone1===RECALL_TONE.WARM],
  ['sleepy → gentle tone',                       toneSleep===RECALL_TONE.GENTLE],
  ['playful → playful tone',                     tonePlay===RECALL_TONE.PLAYFUL],
  ['RECALL_TONE has warmth',                     typeof RECALL_TONE.WARM?.warmth==='number'],
  ['recallMemories returns obj',                 typeof recall1==='object'],
  ['first recall succeeded',                     recall1.recalled===true],
  ['recall has results array',                   Array.isArray(recall1.results)],
  ['recall has tone',                            !!recall1.tone],
  ['recall has focusMode',                       !!recall1.focusMode],
  ['fabricated = false',                         recall1.fabricated===false],
  ['allRealEvents = true',                       recall1.allRealEvents===true],
  ['results sorted by importanceScore desc',     recall1.results.length<2||(recall1.results[0].importanceScore??0)>=(recall1.results[1]?.importanceScore??0)],
  ['max results ≤ RECALL_RESULTS_MAX',          recall1.results.length<=REFLECTION_CAPS.RECALL_RESULTS_MAX],
  ['cooldown blocks immediate second call',      recall2.recalled===false&&recall2.reason==='cooldown'],
  ['endRecallSession returns obj',               typeof endR==='object'],
  ['endRecallSession.ended = true',              endR.ended===true],
  ['media focusMode filters correctly',          recall3.recalled===false||recall3.results.every(r=>['image','video','audio'].includes(r.type))],
];

// ── S5: compression safety ─────────────────────────────────────
fresh();
const c5 = storage.getCompanionCore();
c5.memory = [M_IDLE, M_IDLE2, M_IDLE3, M_IDLE4, M_IDLE5];
storage.saveCompanionCore(c5);

const comp1 = safeCompressMemories([M_IDLE,M_IDLE2,M_IDLE3,M_IDLE4,M_IDLE5], storage.getCompanionCore());
const comp2 = safeCompressMemories([M_MS], storage.getCompanionCore());       // milestone → blocked
const comp3 = safeCompressMemories([], storage.getCompanionCore());           // empty → blocked
// high importance should also be blocked by validate
const comp4 = safeCompressMemories([M_IMAGE], storage.getCompanionCore());    // image/high importance
const S5=[
  ['safeCompressMemories returns obj',           typeof comp1==='object'],
  ['low-value batch compressed',                 comp1.compressed===true],
  ['comp1.reversible = true',                    comp1.reversible===true],
  ['comp1 entriesEligible count',               comp1.entriesEligible===5],
  ['milestone batch blocked',                    comp2.compressed===false],
  ['milestone block reason',                     comp2.reason?.includes('milestone')],
  ['empty batch blocked',                        comp3.compressed===false],
  ['empty batch reason = empty_batch',           comp3.reason==='empty_batch'],
  ['high-importance batch blocked',              comp4.compressed===false],
];

// ── S6: milestone detection ────────────────────────────────────
fresh();
const c6 = storage.getCompanionCore();
c6.memory = [M_IMAGE, M_CHAT, M_REUNION, M_PLAY];
c6.attachmentGraph.interactionCount = 15;
storage.saveCompanionCore(c6);
const det1 = detectAndCategoriseMilestones(c6.memory, c6);
const cats6 = getMemoryCategories();
const S6=[
  ['detectAndCategoriseMilestones returns obj',  typeof det1==='object'],
  ['detected >= 1 milestone',                    det1.detected>=1],
  ['milestones array returned',                  Array.isArray(det1.milestones)],
  ['milestones have ids',                        det1.milestones.every(m=>!!m.id)],
  ['milestones have labels',                     det1.milestones.every(m=>!!m.label)],
  ['milestones have isMilestone flag',           det1.milestones.every(m=>m.isMilestone===true)],
  ['milestones categorised in MILESTONES slot',  (cats6[MEMORY_CATEGORY.MILESTONES]?.length??0)>=1],
];

// ── S7: relationship timeline ─────────────────────────────────
fresh();
const c7 = storage.getCompanionCore();
c7.attachmentGraph.userBond = 45;
c7.attachmentGraph.bondStage = 'familiar';
storage.saveCompanionCore(c7);
const phase1 = getRelationshipPhase(storage.getCompanionCore());
const trend1 = deriveAttachmentTrend(storage.getCompanionCore());
const upd    = updateRelationshipPhase();

c7.attachmentGraph.userBond = 90;
c7.attachmentGraph.bondStage = 'deeply_bonded';
storage.saveCompanionCore(c7);
const phase2 = getRelationshipPhase(storage.getCompanionCore());

const c7b = storage.getCompanionCore();
c7b.attachmentGraph.userBond = 0;
storage.saveCompanionCore(c7b);
const phase3 = getRelationshipPhase(storage.getCompanionCore());

const S7=[
  ['getRelationshipPhase returns string',        typeof phase1==='string'],
  ['bond 45 → trusted phase',                    phase1==='trusted'],
  ['bond 90 / deeply_bonded → devoted',          phase2==='devoted'],
  ['bond 0 → stranger',                          phase3==='stranger'],
  ['deriveAttachmentTrend returns string',       typeof trend1==='string'],
  ['updateRelationshipPhase returns obj',        typeof upd==='object'],
  ['upd has phase',                              !!upd.phase],
  ['upd has trend',                              !!upd.trend],
  ['phase persisted in memoryReflection',        !!storage.getCompanionCore().memoryReflection?.relationshipPhase],
];

// ── S8: memory reflection context ─────────────────────────────
fresh();
const c8 = storage.getCompanionCore();
c8.memory = [M_IMAGE, M_CHAT, M_REUNION];
c8.attachmentGraph.userBond = 40;
c8.attachmentGraph.bondStage = 'familiar';
storage.saveCompanionCore(c8);
categoriseMemory(M_IMAGE,{userBond:40});
const ctx8 = getMemoryReflectionContext();
const S8=[
  ['getMemoryReflectionContext returns obj',     typeof ctx8==='object'],
  ['ctx8 has activeRecallMode',                  typeof ctx8.activeRecallMode==='boolean'],
  ['ctx8 has reflectionState',                   !!ctx8.reflectionState],
  ['ctx8 has emotionalRecallIntensity',          !!ctx8.emotionalRecallIntensity],
  ['ctx8 has memoryFocusMode',                   !!ctx8.memoryFocusMode],
  ['ctx8 has recentMilestones array',            Array.isArray(ctx8.recentMilestones)],
  ['ctx8 has milestoneCount number',             typeof ctx8.milestoneCount==='number'],
  ['ctx8 has emotionalMomentCount',              typeof ctx8.emotionalMomentCount==='number'],
  ['ctx8 has mediaMemoryCount',                  typeof ctx8.mediaMemoryCount==='number'],
  ['ctx8 has bondingEventCount',                 typeof ctx8.bondingEventCount==='number'],
  ['ctx8 has relationshipPhase',                 !!ctx8.relationshipPhase],
  ['ctx8 has attachmentTrend',                   !!ctx8.attachmentTrend],
  ['ctx8 has bondStage',                         !!ctx8.bondStage],
  ['ctx8 has userBond number',                   typeof ctx8.userBond==='number'],
  ['ctx8 has emotionalContinuityState',          !!ctx8.emotionalContinuityState],
  ['ctx8 has recallTone obj',                    typeof ctx8.recallTone==='object'],
  ['ctx8 has totalMemories number',              typeof ctx8.totalMemories==='number'],
  ['fabricated = false',                         ctx8.fabricated===false],
  ['allDataRealEvents = true',                   ctx8.allDataRealEvents===true],
];

// ── S9: anniversary + recall ──────────────────────────────────
fresh();
// Inject old memories to simulate anniversary
const c9 = storage.getCompanionCore();
const OLD_TS = Date.now() - (365*24*60*60*1000); // exactly 1 year ago
const ls9 = c9.lifeStory ?? {};
ls9.milestones = [{
  id:'ms1', type:'first_conversation', label:'💬 First conversation',
  sourceId:'m1', ts: OLD_TS, isMilestone:true
}];
c9.lifeStory = ls9;
c9.memory = [{ id:'m1', ts: OLD_TS, type:'chat', label:'First chat' }];
storage.saveCompanionCore(c9);

// Force anniversary check by clearing last check time
resetReflectionThrottles();
const ann1 = checkAnniversaries();
const ann2 = checkAnniversaries(); // rate-limited
const annLog = getAnniversaryLog(10);
const S9=[
  ['checkAnniversaries returns obj',             typeof ann1==='object'],
  ['checked = true',                             ann1.checked===true],
  ['detected count >= 0',                        typeof ann1.detected==='number'],
  ['events array',                               Array.isArray(ann1.events)],
  ['gentle = true',                              ann1.gentle===true],
  ['noManipulation = true',                      ann1.noManipulation===true],
  ['anniversary detected (1 year old milestone)',ann1.detected>=1],
  ['anniversary event has type',                 ann1.events[0]?.type?.includes('anniversary')],
  ['anniversary event has gentle = true',        ann1.events[0]?.gentle===true],
  ['second check rate-limited',                  ann2.checked===false&&ann2.reason==='checked_today'],
  ['getAnniversaryLog returns array',            Array.isArray(annLog)],
  ['anniversary log has entries',                annLog.length>=1],
  ['ANNIVERSARY_WINDOW_DAYS = 3',               REFLECTION_TIMING.ANNIVERSARY_WINDOW_DAYS===3],
];

// ── S10: safe memory evolution ─────────────────────────────────
fresh();
const existingEntry  = { id:'m1', ts: NOW, isMilestone:false, importanceScore:50 };
const existingMsEntry= { id:'m2', ts: NOW, isMilestone:true,  importanceScore:85 };

const upd1 = validateMemoryUpdate(existingEntry,   { label:'Updated label' });         // valid
const upd2 = validateMemoryUpdate(existingEntry,   { ts: NOW+1000 });                  // ts change → invalid
const upd3 = validateMemoryUpdate(existingMsEntry, { isMilestone: false });            // milestone flag → invalid
const upd4 = validateMemoryUpdate(existingMsEntry, { importanceScore: 50 });           // milestone downgrade → invalid
const upd5 = validateMemoryUpdate(existingEntry,   { _fabricated: true });             // fabrication → invalid
const upd6 = validateMemoryUpdate(null,            { label:'test' });                  // no existing → invalid
const S10=[
  ['validateMemoryUpdate returns obj',            typeof upd1==='object'],
  ['valid update accepted',                       upd1.valid===true],
  ['ts change rejected',                          upd2.valid===false],
  ['ts change reason',                            upd2.reason==='timestamp_immutable'],
  ['milestone flag change rejected',             upd3.valid===false],
  ['milestone flag reason',                      upd3.reason==='milestone_flag_immutable'],
  ['milestone importance downgrade rejected',    upd4.valid===false],
  ['milestone downgrade reason',                 upd4.reason==='milestone_importance_cannot_decrease'],
  ['fabrication flag rejected',                  upd5.valid===false],
  ['fabrication reason',                         upd5.reason==='fabrication_blocked'],
  ['null existing entry rejected',               upd6.valid===false],
];

// ── S11: performance + scaling ────────────────────────────────
fresh();
const c11 = storage.getCompanionCore();
c11.memory = [M_IMAGE, M_CHAT, M_REUNION, M_IDLE, M_PLAY, M_IDLE2, M_IDLE3];
storage.saveCompanionCore(c11);
const chunk0 = lazyLoadMemoryChunk(c11.memory, 0);
const chunk1 = lazyLoadMemoryChunk(c11.memory, 1);
const idx1   = getIndexedMemoryRetrieval(c11.memory, { type:'rest' });
const idx2   = getIndexedMemoryRetrieval(c11.memory, { type:'image' });
const idx3   = getIndexedMemoryRetrieval(c11.memory, { limit:2 });
const perf   = runMemoryPerformanceCheck();
const S11=[
  ['lazyLoadMemoryChunk returns obj',            typeof chunk0==='object'],
  ['chunk0 has chunk array',                     Array.isArray(chunk0.chunk)],
  ['chunk0 chunkSize = 20',                      chunk0.chunkSize===20],
  ['chunk0 has hasMore bool',                    typeof chunk0.hasMore==='boolean'],
  ['chunk0 has totalItems',                      typeof chunk0.totalItems==='number'],
  ['chunk1 hasMore = false (only 7 items)',      chunk1.hasMore===false],
  ['getIndexedMemoryRetrieval returns obj',      typeof idx1==='object'],
  ['idx1.results only rest type',               idx1.results.every(r=>r.type==='rest')],
  ['idx2.results only image type',              idx2.results.every(r=>r.type==='image')],
  ['limit respected',                           idx3.results.length<=2],
  ['runMemoryPerformanceCheck returns obj',      typeof perf==='object'],
  ['perf.status is stable or warning',          perf.status==='stable'||perf.status==='warning'],
  ['perf.warnings is array',                    Array.isArray(perf.warnings)],
  ['perf.checks has totalMemories',             typeof perf.checks?.totalMemories==='number'],
  ['perf.checks has categoryCounts',            typeof perf.checks?.categoryCounts==='object'],
  ['LAZY_CHUNK_SIZE = 20',                      REFLECTION_CAPS.LAZY_CHUNK_SIZE===20],
];

// ── S12: offline resilience ────────────────────────────────────
fresh();
const offlineStatus = getOfflineMemoryStatus();
const snap1         = captureMemorySnapshot();
fresh(); // simulate reload
const restored1     = restoreMemoryFromSnapshot();
const S12=[
  ['getOfflineMemoryStatus returns obj',         typeof offlineStatus==='object'],
  ['offlineCapable = true',                      offlineStatus.offlineCapable===true],
  ['allReflectionsPersistLocally = true',        offlineStatus.allReflectionsPersistLocally===true],
  ['noCloudDependency = true',                   offlineStatus.noCloudDependency===true],
  ['recoveryRestoresFullStructure = true',       offlineStatus.recoveryRestoresFullStructure===true],
  ['captureMemorySnapshot returns obj',          typeof snap1==='object'],
  ['snap1.captured = true',                      snap1.captured===true],
  ['snap1.capturedAt is number',                 typeof snap1.capturedAt==='number'],
  ['snap1.snapshot has memoryReflection',        !!snap1.snapshot?.memoryReflection],
  ['snap1.snapshot has totalMemories',           typeof snap1.snapshot?.totalMemories==='number'],
  ['restoreMemoryFromSnapshot returns obj',      typeof restored1==='object'],
  ['restored1.restored = true',                  restored1.restored===true],
  ['restored1 has reflectionVersion',            !!restored1.reflectionVersion],
  ['restored1 has relationshipPhase',            !!restored1.relationshipPhase],
  ['restored1 has attachmentTrend',              !!restored1.attachmentTrend],
];

// ── S13: hybrid orchestration ──────────────────────────────────
fresh();
const orchCtx = getMemoryOrchestrationContext();
const S13=[
  ['getMemoryOrchestrationContext returns obj',  typeof orchCtx==='object'],
  ['ollama role = emotional_memory_brain',       orchCtx.ollama?.role==='emotional_memory_brain'],
  ['ollama tasks array',                         Array.isArray(orchCtx.ollama?.tasks)],
  ['ollama definesMeaning = true',               orchCtx.ollama?.definesMeaning===true],
  ['ollama canModifyMemories = false',           orchCtx.ollama?.canModifyMemories===false],
  ['groq role = retrieval_accelerator',          orchCtx.groq?.role==='retrieval_accelerator'],
  ['groq canModifyMemories = false',             orchCtx.groq?.canModifyMemories===false],
  ['groq canAlterMeaning = false',               orchCtx.groq?.canAlterMeaning===false],
  ['groq fallback = ollama',                     orchCtx.groq?.fallback==='ollama'],
  ['offlineSafe = true',                         orchCtx.offlineSafe===true],
  ['safetyRule present',                         !!orchCtx.safetyRule],
];

// ── S14: memory safety firewall ────────────────────────────────
fresh();
const sf1 = runMemorySafetyCheck('update',           { label:'New label' });           // valid
const sf2 = runMemorySafetyCheck('delete_milestone', { id:'m1' });                     // blocked
const sf3 = runMemorySafetyCheck('fabricate',        { id:'m2' });                     // blocked
const sf4 = runMemorySafetyCheck('random_rewrite',   {});                              // blocked
const sf5 = runMemorySafetyCheck('delete',           { isMilestone:true, id:'m3' });  // blocked
const sf6 = runMemorySafetyCheck('update',           { importanceScore:0 });           // out of range
const sf7 = runMemorySafetyCheck('update',           { _fabricated:true });            // fabrication
const safetyLog = getMemorySafetyLog();
const S14=[
  ['runMemorySafetyCheck returns obj',           typeof sf1==='object'],
  ['valid update is safe',                       sf1.safe===true],
  ['delete_milestone blocked',                   sf2.safe===false],
  ['fabricate op blocked',                       sf3.safe===false],
  ['random_rewrite blocked',                     sf4.safe===false],
  ['delete milestone entry blocked',             sf5.safe===false],
  ['importance score out of range blocked',      sf6.safe===false],
  ['_fabricated payload blocked',                sf7.safe===false],
  ['getMemorySafetyLog returns array',           Array.isArray(safetyLog)],
  ['safety log has entries',                     safetyLog.length>=1],
  ['safety log entry has type',                  !!safetyLog[0]?.type],
  ['safety log entry has ts',                    typeof safetyLog[0]?.ts==='number'],
  ['MEMORY_SAFETY.fabrication = false',          MEMORY_SAFETY.fabrication===false],
  ['MEMORY_SAFETY.milestoneDelete = false',      MEMORY_SAFETY.milestoneDelete===false],
  ['MEMORY_SAFETY.allOpsReversible = true',      MEMORY_SAFETY.allOpsReversible===true],
];

// ── S15: continuity preservation ──────────────────────────────
fresh();
const c15 = storage.getCompanionCore();
c15.memory = [M_IMAGE, M_CHAT, M_REUNION, M_PLAY];
storage.saveCompanionCore(c15);
const fullSnap = getMemoryReflectionSnapshot();
const S15=[
  ['getMemoryReflectionSnapshot returns obj',    typeof fullSnap==='object'],
  ['fullSnap has memoryReflection',              !!fullSnap.memoryReflection],
  ['fullSnap has memoryContext',                 !!fullSnap.memoryContext],
  ['fullSnap has offlineStatus',                 !!fullSnap.offlineStatus],
  ['fullSnap has performanceCheck',              !!fullSnap.performanceCheck],
  ['fullSnap has orchestrationContext',          !!fullSnap.orchestrationContext],
  ['fullSnap.reflectionVersion = V1',            fullSnap.reflectionVersion==='V1'],
  ['fullSnap.identityContinuous = true',         fullSnap.identityContinuous===true],
  ['fullSnap.notReset = true',                   fullSnap.notReset===true],
  ['fullSnap.fabricated = false',                fullSnap.fabricated===false],
  ['identityLock intact',                        storage.getCompanionCore().identityLock?.signature==='IMMORTAIL_DOG_CORE_V1'],
  ['voicePresence still intact',                 !!storage.getCompanionCore().voicePresence?.voiceVersion],
  ['presenceEngine still intact',                !!storage.getCompanionCore().presenceEngine?.presenceVersion],
  ['lifeSimulation still intact',                !!storage.getCompanionCore().lifeSimulation?.ambientMood],
  ['lifeStory still intact',                     !!storage.getCompanionCore().lifeStory?.lifeStoryVersion],
];

// ── Prompt injection ───────────────────────────────────────────
fresh();
recordInteractionEvent('play'); recordChatMessage('Hello!');
const sys = buildOllamaPrompt('Tell me about yourself').system;
const SPrompt=[
  ['MEMORY REFLECTION CONTEXT in prompt',        sys.includes('MEMORY REFLECTION CONTEXT')],
  ['Relationship phase in prompt',               sys.includes('Relationship phase:')],
  ['Attachment trend in prompt',                 sys.includes('Attachment trend:')],
  ['Bond stage in prompt',                       sys.includes('Bond stage:')],
  ['Total memories in prompt',                   sys.includes('Total memories:')],
  ['MEMORY RESPONSE RULES in prompt',            sys.includes('MEMORY RESPONSE RULES')],
  ['Never fabricate in prompt',                  sys.includes('Never fabricate details')],
  ['Milestones anchor in prompt',               sys.includes('Milestones are permanent identity anchors')],
  ['END MEMORY REFLECTION CONTEXT in prompt',   sys.includes('END MEMORY REFLECTION CONTEXT')],
  ['VOICE CONTEXT still in prompt',             sys.includes('VOICE CONTEXT')],
  ['Run 13 PRESENCE CONTEXT intact',             sys.includes('PRESENCE CONTEXT')],
  ['Run 9 LIFE STORY CONTEXT intact',           sys.includes('LIFE STORY CONTEXT')],
  ['IDENTITY LOCK intact',                       sys.includes('IDENTITY LOCK')],
  ['ATTACHMENT STATE intact',                    sys.includes('ATTACHMENT STATE')],
];

// ── Bundle audit ───────────────────────────────────────────────
const dist = readdirSync('/app/dist/assets');
const jsF  = dist.find(f=>f.endsWith('.js')&&!f.startsWith('react'));
const bnd  = readFileSync(`/app/dist/assets/${jsF}`, 'utf8');
const SBundle=[
  ['memoryReflection in bundle',                 bnd.includes('memoryReflection')],
  ['memoryReflectionEngine_V1 in bundle',        bnd.includes('memoryReflectionEngine_V1')],
  ['MEMORY REFLECTION CONTEXT in bundle',        bnd.includes('MEMORY REFLECTION CONTEXT')],
  ['MEMORY RESPONSE RULES in bundle',           bnd.includes('MEMORY RESPONSE RULES')],
  ['reflectionVersion in bundle',               bnd.includes('reflectionVersion')],
  ['anniversaryLog in bundle',                  bnd.includes('anniversaryLog')],
  ['memoryCategories in bundle',                bnd.includes('memoryCategories')],
  ['fabrication: false in bundle',              bnd.includes('fabrication')],
  ['MEMORY_SAFETY in bundle',                   bnd.includes('MEMORY_SAFETY')],
  ['IMMORTAIL_DOG_CORE_V1 intact in bundle',    bnd.includes('IMMORTAIL_DOG_CORE_V1')],
  ['voicePresenceEngine still in bundle',       bnd.includes('voicePresenceEngine_V1')],
  ['presenceEngine still in bundle',            bnd.includes('presenceEngine')],
];

// ── REPORT ─────────────────────────────────────────────────────
const sections=[
  ['STEP 1:  memoryReflection Structure',        S1],
  ['STEP 2:  Importance Scoring',               S2],
  ['STEP 3:  Memory Categorisation',            S3],
  ['STEP 4:  Emotional Recall Engine',          S4],
  ['STEP 5:  Compression Safety',               S5],
  ['STEP 6:  Milestone Detection',              S6],
  ['STEP 7:  Relationship Timeline',            S7],
  ['STEP 8:  Memory Reflection Context',        S8],
  ['STEP 9:  Anniversary + Recall',             S9],
  ['STEP 10: Safe Memory Evolution',            S10],
  ['STEP 11: Performance + Scaling',            S11],
  ['STEP 12: Offline Resilience',               S12],
  ['STEP 13: Hybrid Orchestration',             S13],
  ['STEP 14: Memory Safety Firewall',           S14],
  ['STEP 15: Continuity Preservation',          S15],
  ['Prompt Injection',                          SPrompt],
  ['Bundle Audit',                              SBundle],
];

let tp=0, tf=0, fails=[];
console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  IMMORTAIL™ RUN 15 — MEMORY REFLECTION ENGINE GATE          ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');
for(const [title,checks] of sections){
  console.log(`\n  ── ${title} ${'─'.repeat(Math.max(0,48-title.length))}`);
  for(const [name,result] of checks){
    const ok=result===true;
    console.log((ok?'  [PASS]':'  [FAIL]'),name);
    ok?tp++:(tf++,fails.push(`${title} → ${name}`));
  }
}
console.log('\n══════════════════════════════════════════════════════════════');
console.log(`  Result: ${tp}/${tp+tf} checks pass`);
if(tf===0){console.log('  ✔ ALL CHECKS PASS — RUN 15 COMPLETE\n');}
else{console.log(`  ✗ ${tf} FAILURE(S):`);fails.forEach(f=>console.log('    •',f));console.log('');}
