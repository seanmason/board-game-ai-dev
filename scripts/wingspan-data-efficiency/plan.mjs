import {objectHash} from '../wingspan-selfplay/common.mjs';

export const LIMITS=Object.freeze({elapsedMs:3*3600e3,workers:28,calibrationPerArm:140,targetPoolMs:10*60e3,minGroups:160,maxGroups:4080,confirmationPairs:100,screenPairs:40,analysisReserveMs:5*60e3,fitReserveMs:12*60e3,confirmationReserveMs:43*60e3});
export const ARMS=Object.freeze(['baseline','hybrid']);
export const GEN3='frozen-generation-3';
export const EXPLORATION=Object.freeze({trainingFraction:.2,temperature:1,safetyMargin:3,earlyActionsPerRound:2});
export const GATES=Object.freeze({meanRatio:1.1,p95Ratio:1.25,p99Ms:2000,maxMs:5000,screenShare:.525,alpha:.025});
export const actor=(modelId=GEN3)=>({method:'residual',modelId,budget:100,horizon:4});
// New, disjoint banks; collection prefixes intentionally match between arms.
export const seedAt=(bank,index)=>800000000+bank*10000000+index*997;
function trainingTasks(generator,n,calibration=false){
 if(!ARMS.includes(generator)||!Number.isInteger(n)||n<1||!calibration&&(n%40||n<LIMITS.minGroups||n>LIMITS.maxGroups))throw Error('Invalid generator/group count');
 const tasks=Array.from({length:n},(_,i)=>{
  const cell=i%20;
  const mixture=cell<8||cell===16||cell===17?'self':cell<12||cell===18?'reference':'history';
  const split=calibration?'calibration':cell<16?'train':'dev';
  const seat=(cell===18?0:cell===19?1:cell%2)^(Math.floor(i/20)%2);
  const seed=seedAt(calibration?0:1,i);
  return {id:`${calibration?'calibration':'collect'}/${generator}/${i}`,kind:'collect',stage:calibration?'calibration':'collect',generator,cheapProbability:.8,generation:generator==='baseline'?4:5,seed,setupSeed:seed,seat,split,matchup:mixture,candidate:actor(),opponent:mixture==='self'?actor():mixture==='reference'?{method:'reference',budget:100,horizon:4}:actor('frozen-generation-1'),budgetSeed:(seed^0x5f3759df)>>>0,policySeed:(seed^0x19e3779b)>>>0,budgetDistribution:{100:.8,300:.2},exploration:null};
 });
 // Block-local selection preserves identical exploration on every shared prefix,
 // including when the cheap arm is assigned more groups.
 if(!calibration)for(let b=0;b<n/40;b++){const ranked=tasks.slice(b*40,(b+1)*40).filter(t=>t.split==='train').map(task=>({task,rank:objectHash({seed:task.seed,purpose:'early-exploration'})})).sort((a,b)=>a.rank.localeCompare(b.rank));const k=Math.round((b+1)*32*.2)-Math.round(b*32*.2);for(const {task} of ranked.slice(0,k))task.exploration={...EXPLORATION};}
 return tasks;
}
export const calibrationTasks=(generator,n=LIMITS.calibrationPerArm)=>trainingTasks(generator,n,true);
export const collectionTasks=(generator,n)=>trainingTasks(generator,n);
const pairs=(stage,bank,matchup,candidate,opponent,n)=>Array.from({length:n},(_,i)=>seedAt(bank,i)).flatMap(seed=>[0,1].map(seat=>({id:`${stage}/${matchup}/${seed}/${seat}`,kind:'evaluate',stage,generation:4,matchup,seed,seat,candidate:{...actor(candidate),timeMs:1000},opponent:{...actor(opponent),timeMs:1000},exploration:null})));
export const screenTasks=(hybrid,baseline)=>pairs('screen',2,'baseline-trained',hybrid,baseline,LIMITS.screenPairs);
export const confirmationTasks=(hybrid,baseline)=>[...pairs('confirmation',3,'baseline-trained',hybrid,baseline,LIMITS.confirmationPairs),...pairs('confirmation',4,'frozen-generation-3',hybrid,GEN3,LIMITS.confirmationPairs)];
export function freezeAllocation(calibrations,{workers=28,targetPoolMs=LIMITS.targetPoolMs,availableMs=Infinity,limits=LIMITS}={}){
 if(workers!==28)throw Error('Steady calibration requires exactly 28 workers');
 const rates={};for(const arm of ARMS){const c=calibrations[arm],start=c?.completionElapsedMs?.[28],end=c?.completionElapsedMs?.[112];if(c?.complete!==true||c.gameCount!==140||limits.calibrationPerArm!==140||c.steadyWorkers!==28||c.steadyCompletions!==84||!Number.isFinite(c.poolWallMs)||c.poolWallMs<=0||!Number.isFinite(start)||start<0||!Number.isFinite(end)||end<=start||end>c.poolWallMs||c.steadyElapsedMs!==end-start)throw Error('Complete 140-game calibration with valid 28-worker steady timing window required');rates[arm]=c.steadyElapsedMs/84;}
 // Only the fixed completion28->112 timing window enters allocation; outcomes,
 // warmup and the final slow tail are excluded from throughput estimation.
 const reserve=limits.confirmationReserveMs+limits.fitReserveMs+limits.analysisReserveMs;
 const target=Math.min(targetPoolMs,(availableMs-reserve)/2,...ARMS.map(a=>limits.maxGroups*rates[a]));
 if(!Number.isFinite(target)||target<=0)throw Error('Insufficient deadline reserve');
 const counts=Object.fromEntries(ARMS.map(a=>[a,Math.min(limits.maxGroups,Math.floor(target/rates[a]/40)*40)]));
 if(Object.values(counts).some(n=>n<limits.minGroups))throw Error('Calibration cannot fund minimum collection plus fixed confirmation');
 const estimatedPoolMs=Object.fromEntries(ARMS.map(a=>[a,counts[a]*rates[a]]));
 const expectedComputeMatch=computeMatch(Object.fromEntries(ARMS.map(a=>[a,{poolWallMs:estimatedPoolMs[a]}])));
 if(!expectedComputeMatch.passed)throw Error('Rounded fixed counts cannot meet expected compute matching within [.9,1.1]');
 return {counts,ratesMsPerGroup:rates,targetPoolMs:target,estimatedPoolMs,expectedComputeMatch,reserveMs:reserve,outcomeBlind:true,frozen:true,workers};
}
export function computeMatch(collections){const [a,b]=ARMS.map(k=>collections[k]?.poolWallMs);if(![a,b].every(n=>Number.isFinite(n)&&n>0))throw Error('Actual pool timing required');const hybridBaselineRatio=b/a,relativeDifference=Math.abs(hybridBaselineRatio-1),passed=hybridBaselineRatio>=.9&&hybridBaselineRatio<=1.1;return {hybridBaselineRatio,relativeDifference,passed,equalComputeClaimAllowed:passed,criterion:'hybrid / baseline actual whole-batch pool wall in [.9,1.1]; no rescue tuning'};}
