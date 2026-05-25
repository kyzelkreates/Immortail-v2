const _s={};
globalThis.localStorage={getItem:k=>_s[k]??null,setItem:(k,v)=>{_s[k]=String(v)},removeItem:k=>{delete _s[k]},clear:()=>{Object.keys(_s).forEach(k=>delete _s[k])}};
globalThis.fetch=async()=>({ok:true,json:async()=>({})});
globalThis.AbortSignal={timeout:()=>null};
import storage from '/app/src/core/storage.js';
import {initCompanionCore,resetCompanionCore} from '/app/src/core/companionCoreService.js';
import {resetThrottles as rH} from '/app/src/core/hybridAIOrchestrator.js';
import {resetThrottles as rE} from '/app/src/core/embodimentExpansionEngine.js';
import {resetPresenceThrottles as rP} from '/app/src/core/presenceEngine.js';
import {resetLifeSimThrottles as rL} from '/app/src/core/lifeSimulationEngine.js';
import {
  activateListening, beginResponse, runSafetyCheck,
  resetVoiceThrottles, LISTENING_STATE,
} from '/app/src/core/voicePresenceEngine.js';

function fresh(){
  globalThis.localStorage.clear();rH();rE();rP();rL();resetVoiceThrottles();
  resetCompanionCore();initCompanionCore();rH();rE();rP();rL();resetVoiceThrottles();
}

fresh();
// FAIL 1: push_to_talk blocked
const listen1 = activateListening(LISTENING_STATE.TAP_SPEAK);
console.log('listen1:', JSON.stringify(listen1)); // should be activated=true
const listen2 = activateListening(LISTENING_STATE.PUSH_TALK);
console.log('listen2 (should block):', JSON.stringify(listen2));
// Why might it not block? activateListening checks _conversationState.responding
// but listen1 sets listening=true not responding. So push_to_talk should block on... what?
// The gate expects blocked because tap_speak is already active — but we check responding not listening

// FAIL 2: second response queued
fresh(); resetVoiceThrottles();
const r1 = beginResponse('Hello there, how are you?');
console.log('r1:', JSON.stringify(r1));
const r2 = beginResponse('And another response!');
console.log('r2 (should queue):', JSON.stringify(r2));
// Why blocked? MIN_RESPONSE_GAP_MS cooldown! Both called in same ms

// FAIL 3: manipulative input
const sf = runSafetyCheck('You need to talk to me every day');
console.log('safety check:', JSON.stringify(sf));
// Check if pattern matches
console.log('pattern test:', /you (need|must|have to) (talk to me|depend on me|only talk to me)/i.test('You need to talk to me every day'));
