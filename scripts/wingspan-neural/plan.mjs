export const PROFILES=Object.freeze({full:{games:512,train:320,dev:64,test:128},compact:{games:256,train:160,dev:32,test:64}});
export function dataTasks(profile='full'){
 if(profile==='calibration')return Array.from({length:16},(_,i)=>({id:`neural/calibration/${41000000+997*i}`,stage:'calibration',matchup:'teacher',seed:41000000+997*i,seat:0,budgetSeed:((41000000+997*i)^0x5f3759df)>>>0,split:'calibration'}));
 const p=PROFILES[profile];if(!p)throw Error('Unknown data profile');
 const base=profile==='full'?42000000:43000000;
 // Interleave splits by a fixed permutation; no outcome or feature enters it.
 const splits=[...Array(p.train).fill('train'),...Array(p.dev).fill('dev'),...Array(p.test).fill('test')];
 return Array.from({length:p.games},(_,i)=>{const index=(i*73)%p.games;return {id:`neural/data/${profile}/${base+997*i}`,stage:'dataset',matchup:'teacher',seed:base+997*i,seat:0,budgetSeed:((base+997*i)^0x5f3759df)>>>0,split:splits[index]};});
}
const arm=(method='reference',pipeline='study',timeMs=1000)=>({method,pipeline,budget:300,horizon:4,timeMs});
function pairs(stage,matchup,candidate,opponent,start,n){return Array.from({length:n},(_,i)=>start+997*i).flatMap(seed=>[0,1].map(seat=>({id:`neural/${stage}/${matchup}/${seed}/${seat}`,stage,matchup,seed,seat,candidate:{...candidate},opponent:{...opponent},rolloutStepLimit:192})));}
export function canaryTasks(){return [['linear',arm('linear')],['reference',arm()],['deployed',arm('reference','deployed')],['neural',arm('neural')]].flatMap(([key,opponent],i)=>pairs('canary',key,arm('neural'),opponent,44000000+i*997,1));}
export function screenTasks(){return [['linear',arm('linear')],['reference',arm()],['deployed',arm('reference','deployed')]].flatMap(([key,opponent])=>pairs('screen',key,arm('neural'),opponent,45000000,32));}
export function confirmationTasks(){return [...pairs('confirmation','deployed',arm('neural'),arm('reference','deployed'),46000000,200),...pairs('confirmation','reference',arm('neural'),arm(),47000000,100)];}
export function admitDataProfile(calibration,{workers=24}={}){
 if(calibration.length!==16||calibration.some(r=>!r.validation?.valid||!Number.isFinite(r.elapsedMs)))throw Error('Require sixteen valid functional calibration games');
 const mean=calibration.reduce((n,r)=>n+r.elapsedMs,0)/16,estimateFullMs=512*mean/workers*1.5;
 return {profile:estimateFullMs<=2*3600e3?'full':'compact',estimateFullMs,meanGameMs:mean,workers,reason:'Fixed profile chosen using calibration durations only; calibration games excluded from learning.'};
}
