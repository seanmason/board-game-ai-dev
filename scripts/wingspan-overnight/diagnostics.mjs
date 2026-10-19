/** Bounded mechanism/search diagnostics. These positions and rankings are not strength evidence. */
import {performance} from 'node:perf_hooks';
import {readFileSync,writeFileSync,mkdirSync,appendFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {diagnosticPositions} from '../wingspan-study/fixtures.mjs';
import {newGame,applyAction,publicObservation,seededRandom,assertValid} from '../../wingspan/core.js';
import {candidateActions} from '../../wingspan/actions.js';
import {createSearch,runSearch,searchSummary} from './search.mjs';

export const DEFAULT_PROFILES=Object.freeze([
 {id:'reference',method:'reference',policy:'original',priorWeight:.18},
 {id:'lean-es',method:'lean-es',policy:'original',priorWeight:.18},
 {id:'power-aware',method:'reference',policy:'power-aware',priorWeight:.18},
 {id:'no-prior',method:'reference',policy:'original',priorWeight:0}
]);

/** Independent fixed deals continued by random representative choices, never search-selected. */
export function ordinaryPositions(count=6){
 if(!Number.isInteger(count)||count<0||count>24)throw Error('Invalid ordinary position count');
 return Array.from({length:count},(_,i)=>{
  const seed=930001+i,rng=seededRandom(seed),requestedRound=[1,2,4][Math.floor(i/2)%3],target=2+(i%2)*2;
  let state=newGame({players:2,seed}),transitions=0;
  while(state.phase==='setup'){
   const p=state.players[state.currentPlayer];
   state=applyAction(state,{type:'setup',keep:p.hand.slice(0,2),foodDiscard:['fish','rodent'],bonusId:p.bonusOffer[0]});
   transitions++;
  }
  const consumed=()=>[8,7,6,5][state.round-1]*2-state.remaining.reduce((a,b)=>a+b,0),trace=[];
  const reached=()=>state.round===requestedRound&&consumed()>=target&&state.phase==='play';
  while(!reached()&&state.phase!=='gameover'&&transitions<600){
   const choices=candidateActions(state),offset=Math.floor(rng()*choices.length);
   let next=null,chosen;
   for(let n=0;n<choices.length;n++){
    chosen=choices[(offset+n)%choices.length].action;
    // Random representative choices may consume a card already owed to a
    // mandatory delayed discard. Reject an immediately stranded successor;
    // this is a legality safeguard, never a score/outcome selection rule.
    try{
     const candidate=applyAction(state,chosen);
     if(candidate.phase!=='gameover'&&!candidateActions(candidate).length)continue;
     next=candidate;break;
    }catch{}
   }
   if(!next)throw Error('No legal ordinary fixture continuation '+seed);
   trace.push({phase:state.phase,round:state.round,actor:state.phase==='power'?state.pending[0].owner:state.currentPlayer,action:chosen});
   state=next;transitions++;
  }
  if(!reached())throw Error('Ordinary fixture did not settle at round '+requestedRound+' within 600 transitions: '+seed);
  assertValid(state);
  return {id:'ordinary-'+seed,state,description:'Independent seeded representative-action trajectory; early/middle/late round fixed before generation, no search or outcome conditioning.',
   seed,round:state.round,turn:state.turn,actionsIntoRound:consumed(),requestedRound,requestedActionsIntoRound:target,transitions,trace};
 });
}
export function buildDiagnosticPositions({ordinary=6}={}){
 return [...diagnosticPositions().map(f=>({...f,source:'fixed-mechanism'})),
  ...ordinaryPositions(ordinary).map(f=>({...f,source:'independent-ordinary'}))];
}
function rankings(summary){
 const roots=summary.candidates.map((a,index)=>({...a,index,key:JSON.stringify(a.action),
  mean:a.visits?a.sum/a.visits:null,priorGradeMean:a.visits?a.priorGradeSum/a.visits:null,
  leafDeltaMean:a.visits?a.leafDeltaSum/a.visits:null,
  weightedPriorMean:a.visits?a.priorRewardSum/a.visits:null,weightedLeafMean:a.visits?a.leafRewardSum/a.visits:null}));
 const rank=key=>roots.filter(a=>a.visits).slice().sort((a,b)=>b[key]-a[key]||a.index-b.index).map(a=>a.key);
 return {roots,combined:rank('mean'),prior:rank('priorGradeMean'),leaf:rank('leafDeltaMean')};
}
export function diagnosticSourceHashes(){
 const root=dirname(fileURLToPath(import.meta.url)),hashes={};
 for(const name of ['rollout.mjs','search.mjs','game.mjs','diagnostics.mjs','evaluators.mjs','power-policy.mjs'])
  hashes['scripts/wingspan-overnight/'+name]=createHash('sha256').update(readFileSync(resolve(root,name))).digest('hex');
 hashes['scripts/wingspan-study/fixtures.mjs']=createHash('sha256').update(readFileSync(resolve(root,'../wingspan-study/fixtures.mjs'))).digest('hex');
 return hashes;
}
/** Incremental 100/300/1000 checkpoints share a repeat's random stream; repeats use independent seeds. */
export function runDiagnostics({positions,profiles=DEFAULT_PROFILES,budgets=[100,300,1000],repeats=2,
 horizon=4,maxMs=600000,maxDecisions=Infinity,onRecord,clock=()=>performance.now(),includeSourceHashes=true}={}){
 if(!Number.isFinite(maxMs)||maxMs<=0)throw Error('Invalid diagnostic time limit');
 if(!Number.isInteger(repeats)||repeats<1||repeats>10)throw Error('Invalid diagnostic repeats');
 if(!budgets.length||budgets.some((n,i)=>!Number.isInteger(n)||n<1||n>1000||(i&&n<=budgets[i-1])))throw Error('Invalid diagnostic checkpoints');
 if(maxDecisions!==Infinity&&(!Number.isInteger(maxDecisions)||maxDecisions<1))throw Error('Invalid diagnostic decision limit');
 const started=clock(),cpu=process.cpuUsage(),rows=[];let decisions=0,status='complete';
 const bank=positions??buildDiagnosticPositions();
 const jobs=[];
 for(const [index,f] of bank.entries())for(const profile of profiles)for(let repeat=0;repeat<repeats;repeat++)jobs.push({index,f,profile,repeat});
 const admitted=jobs.slice(0,maxDecisions);
 // Every admitted fixture gets the small checkpoint before any large checkpoint.
 // This keeps a wall-time-limited run useful across the mechanism inventory.
 outer:for(const requested of budgets)for(const job of admitted){
  const {index,f,profile,repeat}=job;
  if(clock()-started>=maxMs){status='time-limited';break outer;}
  if(!job.search){
   decisions++;job.started=clock();
   const actor=f.state.phase==='power'?f.state.pending[0].owner:f.state.currentPlayer;
   const observation=publicObservation(f.state,actor),choices=candidateActions(f.state);
   job.roots=choices.length;
   job.generationMs=clock()-job.started;
   job.search=createSearch(observation,choices,{...profile,rng:seededRandom(940001+index*97+repeat*65537),horizon});
   job.elapsedMs=clock()-job.started;
  }
  const search=job.search,target=Math.max(requested,job.roots),checkpointAt=clock();
  while(search.iterations<target&&clock()-started<maxMs)runSearch(search,1);
  const summary=searchSummary(search),ranking=rankings(summary),complete=search.iterations>=target;
  const row={id:f.id,source:f.source??'provided',profile:profile.id??profile.method,configuration:{...profile,horizon},repeat,
   requested,target,iterations:search.iterations,rootCount:job.roots,coverageFloorOverhead:Math.max(0,job.roots-requested),
   complete,generationMs:job.generationMs,elapsedMs:(job.elapsedMs??0)+clock()-checkpointAt,checkpointElapsedMs:clock()-checkpointAt,diagnostics:summary.diagnostics,rankings:ranking,
   priorLeafTopAgree:ranking.prior[0]===ranking.leaf[0],priorCombinedTopAgree:ranking.prior[0]===ranking.combined[0]};
  job.elapsedMs=row.elapsedMs;
  rows.push(row);onRecord?.(row);
  if(summary.diagnostics.safetyCapCount||summary.diagnostics.unsettledLeaves){status='invalid-endpoint';break outer;}
  if(!complete){status='time-limited';break outer;}
 }
 if(status==='complete'&&admitted.length<jobs.length)status='decision-limited';
 const cpuUsed=process.cpuUsage(cpu);
 return {purpose:'Mechanism and search ranking diagnostics only; no strength claims or game outcomes.',candidateCoverage:'Representative root counts and supplied-root visit coverage only; no comparison against complete legal human actions and no candidate-omission audit.',status,
  complete:status==='complete',createdAt:new Date().toISOString(),elapsedMs:clock()-started,maxMs,maxDecisions:Number.isFinite(maxDecisions)?maxDecisions:null,
  positions:bank.map(f=>({id:f.id,source:f.source??'provided',seed:f.seed??null,round:f.round??f.state.round,turn:f.turn??f.state.turn,actionsIntoRound:f.actionsIntoRound??null,requestedRound:f.requestedRound??null,transitions:f.transitions??null,trace:f.trace??null})),
  profiles,budgets,repeats,horizon,decisions,rows,cpuUsageMicros:cpuUsed,memory:process.memoryUsage(),
  node:process.version,pid:process.pid,sourceHashes:includeSourceHashes?diagnosticSourceHashes():undefined};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=Object.fromEntries(process.argv.slice(2).map(a=>{const i=a.indexOf('=');return [a.slice(2,i<0?undefined:i),i<0?true:a.slice(i+1)];}));
 if(!args.out)throw Error('Use --out=DIR [--max-ms=600000] [--max-decisions=N] [--ordinary=6] [--repeats=2]');
 const out=resolve(args.out);mkdirSync(out,{recursive:true});
 writeFileSync(resolve(out,'diagnostics-records.ndjson'),'');
 writeFileSync(resolve(out,'diagnostics-start.json'),JSON.stringify({createdAt:new Date().toISOString(),purpose:'Non-strength search diagnostics; partial records remain in diagnostics-records.ndjson if externally stopped.',args,sourceHashes:diagnosticSourceHashes()},null,2));
 const result=runDiagnostics({maxMs:Number(args['max-ms']??600000),maxDecisions:args['max-decisions']===undefined?Infinity:Number(args['max-decisions']),
  repeats:Number(args.repeats??2),positions:buildDiagnosticPositions({ordinary:Number(args.ordinary??6)}),
  onRecord:row=>{appendFileSync(resolve(out,'diagnostics-records.ndjson'),JSON.stringify(row)+'\n');writeFileSync(resolve(out,'diagnostics-progress.json'),JSON.stringify({last:row.id,profile:row.profile,repeat:row.repeat,requested:row.requested,iterations:row.iterations,elapsedMs:row.elapsedMs}));
   console.log(JSON.stringify({position:row.id,profile:row.profile,repeat:row.repeat,samples:row.iterations,complete:row.complete}));}});
 writeFileSync(resolve(out,'diagnostics.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({status:result.status,decisions:result.decisions,elapsedMs:result.elapsedMs}));
 if(result.status==='invalid-endpoint')process.exitCode=2;
}
