import {collectionTasks as hybridTasks} from '../wingspan-data-efficiency/plan.mjs';

export const LIMITS=Object.freeze({elapsedMs:3*3600e3,workers:28,screenPairs:40,confirmationPairs:100,cycleGames:1040,cycleMinimumRemainingMs:70*60e3});
export const GATES=Object.freeze({meanRatio:1.1,p95Ratio:1.25,p99Ms:2000,maxMs:5000,screenShare:.525,alpha:.025});
export const RECIPES=Object.freeze([
 Object.freeze({id:'control',learningRate:.0005,auxiliaryWeight:.05}),
 Object.freeze({id:'value-only',learningRate:.0005,auxiliaryWeight:0}),
 Object.freeze({id:'gentle',learningRate:.0001,auxiliaryWeight:.05}),
 Object.freeze({id:'gentle-value',learningRate:.0001,auxiliaryWeight:0})
]);
export const PARENT='frozen-generation-3', HISTORY='frozen-generation-1';
export function seedAt(bank,index){if(!Number.isInteger(bank)||bank<0||bank>5||!Number.isInteger(index)||index<0||index>=10000)throw Error('Invalid frozen seed bank/index');return 1_000_000_000+bank*10_000_000+index*997;}
export const actor=modelId=>({method:'residual',modelId,budget:100,horizon:4});
export function comparisonTasks({candidate,parent,phase=0,slot=0,confirmation=false,recipe=null}){
 if(![0,1].includes(phase)||![0,1].includes(slot)||phase===1&&slot!==0)throw Error('Invalid comparison phase/slot');
 const bank=phase===0?(confirmation?2:slot):(confirmation?5:4),n=confirmation?100:40,key=confirmation?(phase?'c1':'c0'):(phase?'s1':`s0-${recipe??slot}`);
 return Array.from({length:n},(_,i)=>seedAt(bank,i)).flatMap(seed=>[0,1].map(seat=>({id:`refit/${key}/${seed}/${seat}`,kind:'evaluate',stage:key,generation:phase?6:5,matchup:'parent',seed,seat,candidate:{...actor(candidate),timeMs:1000},opponent:{...actor(parent),timeMs:1000},exploration:null})));
}
export function collectionTasks(teacher){return hybridTasks('hybrid',1040).map((task,i)=>{const seed=seedAt(3,i);return {...task,id:`refit/collect-1/${i}`,stage:'collect-1',generation:6,seed,setupSeed:seed,candidate:actor(teacher),opponent:task.matchup==='self'?actor(teacher):task.matchup==='reference'?{method:'reference',budget:100,horizon:4}:actor(PARENT),budgetSeed:(seed^0x5f3759df)>>>0,policySeed:(seed^0x19e3779b)>>>0};});}
export const seedBankInventory=()=>[
 ...[0,1].map(slot=>comparisonTasks({candidate:'audit-candidate',parent:PARENT,slot})),
 comparisonTasks({candidate:'audit-candidate',parent:PARENT,confirmation:true}),
 collectionTasks('audit-candidate'),
 comparisonTasks({candidate:'audit-candidate',parent:PARENT,phase:1}),
 comparisonTasks({candidate:'audit-candidate',parent:PARENT,phase:1,confirmation:true})
];
