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
import {resetVoiceThrottles} from '/app/src/core/voicePresenceEngine.js';

globalThis.localStorage.clear();rH();rE();rP();rL();resetVoiceThrottles();
resetCompanionCore();initCompanionCore();rH();rE();rP();rL();resetVoiceThrottles();
const core = storage.getCompanionCore();
console.log('voicePresence exists:', !!core.voicePresence);
console.log('voicePresence:', JSON.stringify(core.voicePresence));
