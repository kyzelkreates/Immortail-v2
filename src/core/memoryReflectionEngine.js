/**
 * IMMORTAIL™ — RUN 15
 * memoryReflectionEngine.js
 */

import storage from './storage.js';
import {
  scoreImportance,
  detectMilestones,
  validateCompression,
  IMPORTANCE,
  REL_PHASE,
  CAPS,
} from './lifeStoryEngine.js';

// Re-export for convenience
export { IMPORTANCE, REL_PHASE, CAPS };

export const REFLECTION_STATE = { IDLE:'idle', RECALLING:'recalling', REFLECTING:'reflecting', PRESENTING:'presenting', COOLDOWN:'cooldown' };
export const RECALL_INTENSITY  = { SOFT:'soft', MEDIUM:'medium', DEEP:'deep' };
export const MEMORY_FOCUS_MODE = { BALANCED:'balanced', EMOTIONAL:'emotional', MILESTONES:'milestones', RECENT:'recent', MEDIA:'media' };
export const MEMORY_CATEGORY   = {
  MILESTONES:           'milestones',
  EMOTIONAL_MOMENTS:    'emotionalMoments',
  ROUTINE_INTERACTIONS: 'routineInteractions',
  MEDIA_LINKED:         'mediaLinkedEvents',
  BONDING_EVENTS:       'bondingEvents',
  ENVIRONMENTAL:        'environmentalEvents',
};
export const RECALL_TONE = {
  SOFT:     { warmth:0.6, depth:'light',  sentenceLength:'short',  pacing:'slow'   },
  WARM:     { warmth:0.8, depth:'medium', sentenceLength:'medium', pacing:'gentle' },
  GENTLE:   { warmth:0.7, depth:'light',  sentenceLength:'short',  pacing:'slow'   },
  PLAYFUL:  { warmth:0.9, depth:'medium', sentenceLength:'medium', pacing:'warm'   },
  EMPHASIS: { warmth:1.0, depth:'deep',   sentenceLength:'medium', pacing:'tender' },
};

export const MEMORY_REFLECTION_ENGINE_ID = 'memoryReflectionEngine_V1';
export const MEMORY_SAFETY = {
  fabrication:      false,
  milestoneDelete:  false,
  randomRewrite:    false,
  cloudRequired:    false,
  allOpsReversible: true,
};
export const REFLECTION_CAPS = {
  REFLECTION_QUEUE_MAX:  10,
  RECALL_RESULTS_MAX:    8,
  ANNIVERSARY_LOG_MAX:   30,
  SAFETY_LOG_MAX:        50,
  CATEGORY_MAX_PER_SLOT: 100,
  LAZY_CHUNK_SIZE:       20,
};
export const REFLECTION_TIMING = {
  RECALL_COOLDOWN_MS:       5000,
  ANNIVERSARY_CHECK_DAY_MS: 86400000,
  REFLECTION_THROTTLE_MS:   500,
  ANNIVERSARY_WINDOW_DAYS:  3,
};

let _lastRecallAt        = 0;
let _lastAnniversaryCheck= 0;
let _throttleLastWrite   = 0;
let _safetyLog           = [];

function genId(){ return `${Date.now()}_${Math.random().toString(36).slice(2,6)}`; }
function clamp(v,min=0,max=100){ return Math.max(min,Math.min(max,v)); }

function getDefaultMemoryReflection(){
  return {
    activeRecallMode:         false,
    reflectionState:          REFLECTION_STATE.IDLE,
    emotionalRecallIntensity: RECALL_INTENSITY.MEDIUM,
    lastReflectedMemory:      null,
    reflectionQueue:          [],
    memoryFocusMode:          MEMORY_FOCUS_MODE.BALANCED,
    memoryCategories: {
      [MEMORY_CATEGORY.MILESTONES]:           [],
      [MEMORY_CATEGORY.EMOTIONAL_MOMENTS]:    [],
      [MEMORY_CATEGORY.ROUTINE_INTERACTIONS]: [],
      [MEMORY_CATEGORY.MEDIA_LINKED]:         [],
      [MEMORY_CATEGORY.BONDING_EVENTS]:       [],
      [MEMORY_CATEGORY.ENVIRONMENTAL]:        [],
    },
    anniversaryLog:           [],
    relationshipPhase:        REL_PHASE.STRANGER,
    attachmentTrend:          'stable',
    emotionalContinuityState: 'grounded',
    lastMeaningfulMemory:     null,
    lastAnniversaryCheckAt:   null,
    reflectionVersion:        'V1',
  };
}

function getReflection(){
  return storage.getCompanionCore().memoryReflection ?? getDefaultMemoryReflection();
}

function saveReflection(patch, force=false){
  const now=Date.now();
  if(!force && now-_throttleLastWrite<REFLECTION_TIMING.REFLECTION_THROTTLE_MS) return false;
  _throttleLastWrite=now;
  const core=storage.getCompanionCore();
  core.memoryReflection={...getReflection(),...patch};
  storage.saveCompanionCore(core);
  return true;
}
function saveReflectionForce(patch){ _throttleLastWrite=0; saveReflection(patch,true); }

function logSafetyEvent(type, detail){
  _safetyLog=[..._safetyLog,{ id:genId(), ts:Date.now(), type, detail:(detail??'').toString().slice(0,80) }].slice(-REFLECTION_CAPS.SAFETY_LOG_MAX);
}

// ── STEP 1 ────────────────────────────────────────────────────
export function initMemoryReflection(){
  const core=storage.getCompanionCore();
  if(!core.memoryReflection){
    core.memoryReflection=getDefaultMemoryReflection();
    storage.saveCompanionCore(core);
  } else {
    const defaults=getDefaultMemoryReflection();
    let patched=false;
    for(const [k,v] of Object.entries(defaults)){
      if(core.memoryReflection[k]===undefined){ core.memoryReflection[k]=v; patched=true; }
    }
    for(const cat of Object.values(MEMORY_CATEGORY)){
      if(!core.memoryReflection.memoryCategories?.[cat]){
        core.memoryReflection.memoryCategories=core.memoryReflection.memoryCategories??{};
        core.memoryReflection.memoryCategories[cat]=[];
        patched=true;
      }
    }
    if(patched) storage.saveCompanionCore(core);
  }
  _lastRecallAt=0; _lastAnniversaryCheck=0;
  console.log('IMMORTAIL MEMORY REFLECTION: boot complete', {
    reflectionState:   core.memoryReflection.reflectionState,
    memoryFocusMode:   core.memoryReflection.memoryFocusMode,
    relationshipPhase: core.memoryReflection.relationshipPhase,
    reflectionVersion: core.memoryReflection.reflectionVersion,
  });
}

// ── STEP 2 ────────────────────────────────────────────────────
export function scoreMemoryImportance(entry, context={}){
  if(!entry) return { score:IMPORTANCE.MIN, category:MEMORY_CATEGORY.ROUTINE_INTERACTIONS, importanceScore:IMPORTANCE.MIN };
  const score=scoreImportance(entry,context);
  let category=MEMORY_CATEGORY.ROUTINE_INTERACTIONS;
  // Type-based categories take priority over score-based ones
  if(['image','video','audio'].includes(entry.type))            category=MEMORY_CATEGORY.MEDIA_LINKED;
  else if(entry.type==='reunion_event')                          category=MEMORY_CATEGORY.BONDING_EVENTS;
  else if(entry.isMilestone||score>=IMPORTANCE.THRESHOLD_MILESTONE) category=MEMORY_CATEGORY.MILESTONES;
  else if(score>=IMPORTANCE.THRESHOLD_HIGH)                      category=MEMORY_CATEGORY.EMOTIONAL_MOMENTS;
  else if(entry.type==='environment'||entry.category==='environment') category=MEMORY_CATEGORY.ENVIRONMENTAL;
  return { score, category, importanceScore:score };
}

// ── STEP 3 ────────────────────────────────────────────────────
export function categoriseMemory(entry, context={}){
  if(!entry?.id) return { categorised:false, reason:'invalid_entry' };
  if(!entry.ts){ logSafetyEvent('categorise_rejected_no_ts',entry.id); return { categorised:false, reason:'missing_timestamp' }; }
  const {score,category}=scoreMemoryImportance(entry,context);
  const enriched={...entry, importanceScore:score, memoryCategory:category};
  const core=storage.getCompanionCore();
  const ref=core.memoryReflection??getDefaultMemoryReflection();
  const cats=ref.memoryCategories??{};
  const existing=cats[category]??[];
  if(existing.length>=REFLECTION_CAPS.CATEGORY_MAX_PER_SLOT){
    if(category!==MEMORY_CATEGORY.MILESTONES){
      const sorted=[...existing].sort((a,b)=>(a.importanceScore??0)-(b.importanceScore??0));
      cats[category]=sorted.slice(1);
    } else { return { categorised:false, reason:'milestone_slot_full' }; }
  }
  if(!cats[category]) cats[category]=[];
  if(!cats[category].some(e=>e.id===enriched.id)) cats[category]=[...(cats[category]??[]),enriched];
  ref.memoryCategories=cats;
  core.memoryReflection=ref;
  storage.saveCompanionCore(core);
  return { categorised:true, category, importanceScore:score, entryId:entry.id };
}

export function categoriseBatch(entries, context={}){
  if(!Array.isArray(entries)||entries.length===0) return { processed:0, results:[] };
  const results=entries.map(e=>categoriseMemory(e,context));
  return { processed:results.length, categorised:results.filter(r=>r.categorised).length, rejected:results.filter(r=>!r.categorised).length, results };
}

export function getMemoryCategories(){ return getReflection().memoryCategories??{}; }

// ── STEP 4 ────────────────────────────────────────────────────
export function deriveRecallTone(core){
  const mood    =core?.lifeSimulation?.ambientMood??'calm';
  const dominant=core?.emotionalState?.dominant??'neutral';
  const presence=core?.presenceEngine?.activePresenceState??'ambient_idle';
  if(presence==='reunion_event') return RECALL_TONE.EMPHASIS;
  if(mood==='sleepy')            return RECALL_TONE.GENTLE;
  if(mood==='playful')           return RECALL_TONE.PLAYFUL;
  if(dominant==='excited')       return RECALL_TONE.PLAYFUL;
  if(dominant==='sad')           return RECALL_TONE.GENTLE;
  return RECALL_TONE.WARM;
}

export function recallMemories(options={}){
  const now=Date.now();
  const core=storage.getCompanionCore();
  const ref=core.memoryReflection??getDefaultMemoryReflection();
  if(now-_lastRecallAt<REFLECTION_TIMING.RECALL_COOLDOWN_MS)
    return { recalled:false, reason:'cooldown', retryAfterMs:REFLECTION_TIMING.RECALL_COOLDOWN_MS-(now-_lastRecallAt) };
  const focusMode   =options.focusMode??ref.memoryFocusMode??MEMORY_FOCUS_MODE.BALANCED;
  const coreMemories=core.memory??[];
  const tone        =deriveRecallTone(core);
  if(coreMemories.length===0) return { recalled:false, reason:'no_memories', results:[], tone };
  const ag=core.attachmentGraph??{};
  const typeCount={};
  for(const m of coreMemories) typeCount[m.type]=(typeCount[m.type]??0)+1;
  const scored=coreMemories.map(m=>({ ...m, importanceScore:scoreImportance(m,{ typeCount:typeCount[m.type]??0, userBond:ag.userBond??0, emotionalResonance:ag.emotionalResonance??0 }) }));
  let candidates=[];
  switch(focusMode){
    case MEMORY_FOCUS_MODE.MILESTONES: candidates=scored.filter(m=>(m.importanceScore??0)>=IMPORTANCE.THRESHOLD_MILESTONE); break;
    case MEMORY_FOCUS_MODE.EMOTIONAL:  candidates=scored.filter(m=>(m.importanceScore??0)>=IMPORTANCE.THRESHOLD_HIGH); break;
    case MEMORY_FOCUS_MODE.RECENT:     candidates=[...scored].sort((a,b)=>(b.ts??0)-(a.ts??0)).slice(0,20); break;
    case MEMORY_FOCUS_MODE.MEDIA:      candidates=scored.filter(m=>['image','video','audio'].includes(m.type)); break;
    default: candidates=scored; break;
  }
  const results=[...candidates].sort((a,b)=>{const d=(b.importanceScore??0)-(a.importanceScore??0);return d!==0?d:(b.ts??0)-(a.ts??0);}).slice(0,REFLECTION_CAPS.RECALL_RESULTS_MAX);
  _lastRecallAt=now;
  const last=results[0]??null;
  saveReflectionForce({ activeRecallMode:true, reflectionState:REFLECTION_STATE.RECALLING, lastReflectedMemory:last?{id:last.id,ts:last.ts,type:last.type}:null, lastMeaningfulMemory:last?{id:last.id,label:last.label??last.type,ts:last.ts}:null });
  return { recalled:true, results, tone, focusMode, emotionState:core?.lifeSimulation?.ambientMood??'calm', recalledAt:now, resultCount:results.length, fabricated:false, allRealEvents:true };
}

export function endRecallSession(){
  saveReflectionForce({ activeRecallMode:false, reflectionState:REFLECTION_STATE.IDLE });
  return { ended:true };
}

// ── STEP 5 ────────────────────────────────────────────────────
export function safeCompressMemories(entries, core){
  if(!core) core=storage.getCompanionCore();
  if(!Array.isArray(entries)||entries.length===0) return { compressed:false, reason:'empty_batch' };
  const ref=core.memoryReflection??getDefaultMemoryReflection();
  const milestoneIds=new Set((core.lifeStory?.milestones??[]).map(m=>m.sourceId));
  const milestoneCatIds=new Set((ref.memoryCategories?.[MEMORY_CATEGORY.MILESTONES]??[]).map(e=>e.id));
  const hasMilestone=entries.some(e=>milestoneIds.has(e.id)||milestoneCatIds.has(e.id)||e.isMilestone);
  if(hasMilestone){ logSafetyEvent('compression_blocked_milestone',`batch ${entries.length}`); return { compressed:false, reason:'milestone_in_batch_rejected' }; }
  // Score entries before validation so high-importance check works on unscored raw entries
  const ag=core.attachmentGraph??{};
  const scoredEntries=entries.map(e=>({
    ...e,
    importanceScore: e.importanceScore ?? scoreImportance(e, { userBond: ag.userBond??0 }),
  }));
  const hasHighImportance=scoredEntries.some(e=>(e.importanceScore??0)>=IMPORTANCE.THRESHOLD_HIGH);
  if(hasHighImportance){ logSafetyEvent('compression_blocked_high_importance',`score in batch`); return { compressed:false, reason:'high_importance_entry_in_batch' }; }
  const validation=validateCompression(scoredEntries,core.lifeStory??{});
  if(!validation.safe){ logSafetyEvent('compression_validation_failed',validation.reason); return { compressed:false, reason:validation.reason }; }
  return { compressed:true, entriesEligible:entries.length, reversible:true };
}

// ── STEP 6 ────────────────────────────────────────────────────
export function detectAndCategoriseMilestones(coreMemories, core){
  if(!core) core=storage.getCompanionCore();
  const newMs=detectMilestones(coreMemories??[],core);
  if(newMs.length===0) return { detected:0, milestones:[] };
  for(const ms of newMs) categoriseMemory({...ms, ts:ms.ts??Date.now(), type:ms.type},{});
  const strongest=newMs.reduce((best,m)=>(m.importanceScore??0)>(best?.importanceScore??0)?m:best,null);
  if(strongest) saveReflectionForce({ lastMeaningfulMemory:{ id:strongest.id, label:strongest.label, ts:strongest.ts } });
  return { detected:newMs.length, milestones:newMs };
}

// ── STEP 7 ────────────────────────────────────────────────────
export function getRelationshipPhase(core){
  if(!core) core=storage.getCompanionCore();
  const bond=core.attachmentGraph?.userBond??0;
  // Bond score is authoritative — bondStage only used as a minimum floor, never to override a lower bond score
  if(bond>=85) return REL_PHASE.DEVOTED;
  if(bond>=65) return REL_PHASE.BONDED;
  if(bond>=40) return REL_PHASE.TRUSTED;
  if(bond>=20) return REL_PHASE.FAMILIAR;
  if(bond>=5)  return REL_PHASE.ACQUAINTED;
  return REL_PHASE.STRANGER;
}

export function deriveAttachmentTrend(core){
  if(!core) core=storage.getCompanionCore();
  const ag=core.attachmentGraph??{};
  if((ag.familiarity??0)>50&&(ag.emotionalResonance??0)>40&&(ag.userBond??0)>30) return 'growing';
  if((ag.familiarity??0)<10||(ag.userBond??0)<5) return 'drifting';
  return 'stable';
}

export function updateRelationshipPhase(){
  const core=storage.getCompanionCore();
  const phase=getRelationshipPhase(core);
  const trend=deriveAttachmentTrend(core);
  saveReflectionForce({ relationshipPhase:phase, attachmentTrend:trend });
  return { phase, trend };
}

// ── STEP 8 ────────────────────────────────────────────────────
export function getMemoryReflectionContext(){
  const core=storage.getCompanionCore();
  const ref =core.memoryReflection??getDefaultMemoryReflection();
  const ls  =core.lifeStory??{};
  const ag  =core.attachmentGraph??{};
  const tone=deriveRecallTone(core);
  const recentMilestones=(ls.milestones??[]).slice(-3).map(m=>({label:m.label,ts:m.ts,type:m.type}));
  const phase=ref.relationshipPhase??getRelationshipPhase(core);
  const trend=ref.attachmentTrend??deriveAttachmentTrend(core);
  const cats=ref.memoryCategories??{};
  return {
    activeRecallMode:         ref.activeRecallMode,
    reflectionState:          ref.reflectionState,
    emotionalRecallIntensity: ref.emotionalRecallIntensity??RECALL_INTENSITY.MEDIUM,
    memoryFocusMode:          ref.memoryFocusMode,
    lastMeaningfulMemory:     ref.lastMeaningfulMemory,
    recentMilestones,
    milestoneCount:           (cats[MEMORY_CATEGORY.MILESTONES]??[]).length,
    emotionalMomentCount:     (cats[MEMORY_CATEGORY.EMOTIONAL_MOMENTS]??[]).length,
    mediaMemoryCount:         (cats[MEMORY_CATEGORY.MEDIA_LINKED]??[]).length,
    bondingEventCount:        (cats[MEMORY_CATEGORY.BONDING_EVENTS]??[]).length,
    relationshipPhase:        phase,
    attachmentTrend:          trend,
    bondStage:                ag.bondStage??'distant',
    userBond:                 ag.userBond??0,
    emotionalContinuityState: ref.emotionalContinuityState??'grounded',
    recallTone:               tone,
    totalMemories:            (core.memory??[]).length,
    lastAnniversaryCheckAt:   ref.lastAnniversaryCheckAt,
    reflectionVersion:        ref.reflectionVersion,
    fabricated:               false,
    allDataRealEvents:        true,
  };
}

// ── STEP 9 ────────────────────────────────────────────────────
export function checkAnniversaries(){
  const now=Date.now();
  if(now-_lastAnniversaryCheck<REFLECTION_TIMING.ANNIVERSARY_CHECK_DAY_MS)
    return { checked:false, reason:'checked_today' };
  const core    =storage.getCompanionCore();
  const ls      =core.lifeStory??{};
  const memories=core.memory??[];
  const detected=[];
  const windowMs=REFLECTION_TIMING.ANNIVERSARY_WINDOW_DAYS*86400000;
  const nowDate =new Date(now);

  for(const ms of (ls.milestones??[])){
    if(!ms.ts) continue;
    const msDate=new Date(ms.ts);
    const yearsDiff=nowDate.getFullYear()-msDate.getFullYear();
    if(yearsDiff<1) continue;
    const annThis=new Date(msDate); annThis.setFullYear(nowDate.getFullYear());
    if(Math.abs(now-annThis.getTime())<=windowMs){
      detected.push({ id:genId(), type:'anniversary', milestoneId:ms.id, label:ms.label, originalTs:ms.ts, yearsAgo:yearsDiff, detectedAt:now, gentle:true });
    }
  }

  const typeCounts={};
  for(const m of memories){ if(!m.type) continue; typeCounts[m.type]=(typeCounts[m.type]??0)+1; }
  const recurring=Object.entries(typeCounts).filter(([,c])=>c>=5).map(([type,count])=>({type,count}));
  if(recurring.length>0) detected.push({ id:genId(), type:'recurring_pattern', patterns:recurring.slice(0,3), detectedAt:now, gentle:true });

  const firstMem=memories.length>0?[...memories].sort((a,b)=>(a.ts??0)-(b.ts??0))[0]:null;
  if(firstMem?.ts){
    const fDate=new Date(firstMem.ts);
    const yrs=nowDate.getFullYear()-fDate.getFullYear();
    if(yrs>=1){
      const annFirst=new Date(fDate); annFirst.setFullYear(nowDate.getFullYear());
      if(Math.abs(now-annFirst.getTime())<=windowMs)
        detected.push({ id:genId(), type:'first_meeting_anniversary', yearsAgo:yrs, originalTs:firstMem.ts, detectedAt:now, gentle:true });
    }
  }

  _lastAnniversaryCheck=now;
  const fresh=storage.getCompanionCore();
  const fRef =fresh.memoryReflection??getDefaultMemoryReflection();
  fRef.anniversaryLog       =[...(fRef.anniversaryLog??[]),...detected].slice(-REFLECTION_CAPS.ANNIVERSARY_LOG_MAX);
  fRef.lastAnniversaryCheckAt=now;
  fresh.memoryReflection=fRef;
  storage.saveCompanionCore(fresh);
  return { checked:true, detected:detected.length, events:detected, gentle:true, noManipulation:true };
}

export function getAnniversaryLog(limit=5){ return (getReflection().anniversaryLog??[]).slice(-limit); }

// ── STEP 10 ───────────────────────────────────────────────────
export function validateMemoryUpdate(existingEntry, proposedUpdate){
  if(!existingEntry) return { valid:false, reason:'no_existing_entry' };
  if(!proposedUpdate) return { valid:false, reason:'no_proposed_update' };
  if(proposedUpdate.ts&&proposedUpdate.ts!==existingEntry.ts){ logSafetyEvent('update_rejected_ts',existingEntry.id); return { valid:false, reason:'timestamp_immutable' }; }
  if(proposedUpdate.isMilestone!==undefined&&proposedUpdate.isMilestone!==existingEntry.isMilestone){ logSafetyEvent('update_rejected_ms_flag',existingEntry.id); return { valid:false, reason:'milestone_flag_immutable' }; }
  if(existingEntry.isMilestone&&proposedUpdate.importanceScore!==undefined&&proposedUpdate.importanceScore<existingEntry.importanceScore){ logSafetyEvent('update_rejected_ms_downgrade',existingEntry.id); return { valid:false, reason:'milestone_importance_cannot_decrease' }; }
  if(proposedUpdate._fabricated===true){ logSafetyEvent('update_rejected_fabrication',existingEntry.id); return { valid:false, reason:'fabrication_blocked' }; }
  return { valid:true };
}

// ── STEP 11 ───────────────────────────────────────────────────
export function lazyLoadMemoryChunk(coreMemories, chunkIndex=0){
  if(!Array.isArray(coreMemories)) return { chunk:[], hasMore:false, chunkIndex };
  const start=chunkIndex*REFLECTION_CAPS.LAZY_CHUNK_SIZE;
  const chunk=coreMemories.slice(start,start+REFLECTION_CAPS.LAZY_CHUNK_SIZE);
  return { chunk, hasMore:chunk.length===REFLECTION_CAPS.LAZY_CHUNK_SIZE, chunkIndex, chunkSize:REFLECTION_CAPS.LAZY_CHUNK_SIZE, totalItems:coreMemories.length };
}

export function getIndexedMemoryRetrieval(coreMemories, options={}){
  if(!Array.isArray(coreMemories)) return { results:[], count:0 };
  const {type,minImportance,category,limit=10}=options;
  let results=coreMemories;
  if(type)          results=results.filter(m=>m.type===type);
  if(minImportance) results=results.filter(m=>(m.importanceScore??0)>=minImportance);
  if(category)      results=results.filter(m=>m.memoryCategory===category);
  return { results:results.slice(0,limit), count:results.length, truncated:results.length>limit };
}

export function runMemoryPerformanceCheck(){
  const core=storage.getCompanionCore();
  const ref =core.memoryReflection??getDefaultMemoryReflection();
  const cats=ref.memoryCategories??{};
  const categoryCounts={};
  for(const [k,v] of Object.entries(cats)) categoryCounts[k]=Array.isArray(v)?v.length:0;
  const total=Object.values(categoryCounts).reduce((a,b)=>a+b,0);
  const warnings=[];
  if((core.memory??[]).length>500) warnings.push('memory_count_high');
  if((ref.reflectionQueue??[]).length>=REFLECTION_CAPS.REFLECTION_QUEUE_MAX-1) warnings.push('reflection_queue_near_full');
  if(_safetyLog.length>=REFLECTION_CAPS.SAFETY_LOG_MAX-5) warnings.push('safety_log_near_full');
  return { status:warnings.length?'warning':'stable', warnings, checks:{ totalMemories:(core.memory??[]).length, totalCategorised:total, categoryCounts, reflectionQueueSize:(ref.reflectionQueue??[]).length, safetyLogSize:_safetyLog.length, anniversaryLogSize:(ref.anniversaryLog??[]).length, activeRecallMode:ref.activeRecallMode } };
}

// ── STEP 12 ───────────────────────────────────────────────────
export function getOfflineMemoryStatus(){
  return { offlineCapable:true, allReflectionsPersistLocally:true, noCloudDependency:true, recoveryRestoresFullStructure:true };
}

export function captureMemorySnapshot(){
  const core=storage.getCompanionCore();
  const ref =core.memoryReflection??getDefaultMemoryReflection();
  const ls  =core.lifeStory??{};
  return { captured:true, capturedAt:Date.now(), snapshot:{ memoryReflection:{...ref}, milestoneCount:(ls.milestones??[]).length, compressedCount:(ls.compressedMemoryIndex??[]).length, timelineCount:(ls.relationshipTimeline??[]).length, totalMemories:(core.memory??[]).length } };
}

export function restoreMemoryFromSnapshot(){
  const core=storage.getCompanionCore();
  if(!core.memoryReflection?.reflectionVersion) return { restored:false, reason:'no_snapshot' };
  const ref  =core.memoryReflection;
  const phase=getRelationshipPhase(core);
  const trend=deriveAttachmentTrend(core);
  saveReflectionForce({ relationshipPhase:phase, attachmentTrend:trend, emotionalContinuityState:'grounded', activeRecallMode:false, reflectionState:REFLECTION_STATE.IDLE });
  return { restored:true, reflectionVersion:ref.reflectionVersion, relationshipPhase:phase, attachmentTrend:trend, milestoneCount:(ref.memoryCategories?.[MEMORY_CATEGORY.MILESTONES]??[]).length };
}

// ── STEP 13 ───────────────────────────────────────────────────
export function getMemoryOrchestrationContext(){
  return { ollama:{ role:'emotional_memory_brain', tasks:['emotional_continuity','long_term_memory_reasoning','milestone_meaning','relationship_reflection','narrative_coherence'], definesMeaning:true, canModifyMemories:false }, groq:{ role:'retrieval_accelerator', tasks:['fast_indexing','retrieval_acceleration'], canModifyMemories:false, canAlterMeaning:false, fallback:'ollama' }, safetyRule:'groq_never_modifies_memory__ollama_defines_all_meaning', offlineSafe:true };
}

// ── STEP 14 ───────────────────────────────────────────────────
export function runMemorySafetyCheck(operation, payload={}){
  const BLOCKED=['delete_milestone','overwrite_milestone','fabricate','random_rewrite'];
  if(BLOCKED.includes(operation)){ logSafetyEvent(`blocked_op:${operation}`,JSON.stringify(payload).slice(0,60)); return { safe:false, reason:`operation_blocked:${operation}` }; }
  if(payload._fabricated===true){ logSafetyEvent('blocked_fabrication',JSON.stringify(payload).slice(0,60)); return { safe:false, reason:'fabrication_blocked' }; }
  if(operation==='delete'&&payload.isMilestone){ logSafetyEvent('blocked_milestone_delete',payload.id); return { safe:false, reason:'milestone_delete_blocked' }; }
  if(operation==='update'&&payload.importanceScore!==undefined&&(payload.importanceScore<1||payload.importanceScore>100)){ logSafetyEvent('blocked_invalid_score',`${payload.importanceScore}`); return { safe:false, reason:'importance_score_out_of_range' }; }
  return { safe:true };
}

export function getMemorySafetyLog(){ return [..._safetyLog]; }

// ── STEP 15 ───────────────────────────────────────────────────
export function getMemoryReflectionSnapshot(){
  const core =storage.getCompanionCore();
  const ref  =core.memoryReflection??getDefaultMemoryReflection();
  const ls   =core.lifeStory??{};
  return { memoryReflection:{...ref}, memoryContext:getMemoryReflectionContext(), offlineStatus:getOfflineMemoryStatus(), performanceCheck:runMemoryPerformanceCheck(), orchestrationContext:getMemoryOrchestrationContext(), lifeStoryIntact:!!ls.lifeStoryVersion, milestones:(ls.milestones??[]).slice(-5), compressedIndex:(ls.compressedMemoryIndex??[]).slice(-3), relationshipTimeline:(ls.relationshipTimeline??[]).slice(-3), reflectionVersion:ref.reflectionVersion, identityContinuous:true, notReset:true, fabricated:false };
}

export function resetReflectionThrottles(){
  _throttleLastWrite=0; _lastRecallAt=0; _lastAnniversaryCheck=0;
}
