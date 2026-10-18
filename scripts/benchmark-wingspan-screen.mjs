/** Frozen, resumable two-player screen. Iterations are truncated belief samples. */
import {performance} from 'node:perf_hooks';
import {mkdirSync,existsSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {newGame,applyAction,assertValid,seededRandom,publicObservation} from '../wingspan/core.js';
import {candidateActions} from '../wingspan/actions.js';
import {createSearch,runSearch,searchSummary} from '../wingspan/analysis.js';
import {scorePlayer,finalOutcome} from '../wingspan/scoring.js';

export const plan={version:1,horizon:4,stepCap:600,budgets:[30,100],heuristicSamples:100,
  baselineSeeds:[817101,817103,817107,817109,817111,817117],
  headSeeds:[817201,817203,817207,817211]};
export function tasks(){
  const rows=[];
  for(const budget of plan.budgets)for(const seed of plan.baselineSeeds)for(const seat of [0,1])
    rows.push({id:`b${budget}-${seed}-${seat}`,seed,seat,budget,opponent:'heuristic',opponentBudget:100});
  for(const seed of plan.headSeeds)for(const seat of [0,1])
    rows.push({id:`head-${seed}-${seat}`,seed,seat,budget:100,opponent:'belief-rollout',opponentBudget:30});
  return rows;
}
export function play(task,{stepCap=plan.stepCap}={}){
  let state=newGame({players:2,starter:task.seed%2,seed:task.seed});
  const started=performance.now();let steps=0,iterations=0,searchMs=0,alternatives=0,unvisited=0;
  const counters=()=>({rolloutCount:0,actionTurns:0,horizonReached:0,terminalReached:0,safetyCapCount:0});
  const rolloutDiagnostics={candidate:counters(),opponent:counters()};
  try{
    while(state.phase!=='gameover'){
      if(++steps>stepCap)return {...task,status:'capped',steps,rolloutDiagnostics,elapsedMs:performance.now()-started};
      const actor=state.phase==='power'?state.pending[0].owner:state.currentPlayer;
      const choices=candidateActions(state);
      const search=createSearch(publicObservation(state,actor),choices,{
        rng:seededRandom((task.seed^Math.imul(steps,193)^Math.imul(actor+1,982451653))>>>0),
        rolloutStepLimit:task.rolloutStepLimit??48,diagnostics:true,
        leafEvaluator:actor===task.seat?(task.evaluator??"current"):(task.opponentEvaluator??"current"),
        method:actor===task.seat?'belief-rollout':task.opponent,horizon:actor===task.seat?(task.horizon??plan.horizon):(task.opponentHorizon??plan.horizon)});
      const at=performance.now();runSearch(search,actor===task.seat?task.budget:task.opponentBudget);
      searchMs+=performance.now()-at;iterations+=search.iterations;
      const totals=rolloutDiagnostics[actor===task.seat?'candidate':'opponent'];
      for(const key of Object.keys(totals))totals[key]+=search.diagnostics[key];
      alternatives+=search.arms.length;unvisited+=search.arms.filter(a=>!a.visits).length;
      state=applyAction(state,searchSummary(search).candidates[0].action);assertValid(state);
    }
    const scores=state.players.map(p=>scorePlayer(p).total);
    return {...task,status:'complete',steps,rolloutDiagnostics,iterations,searchMs,alternatives,unvisited,
      elapsedMs:performance.now()-started,scores,margin:scores[task.seat]-scores[1-task.seat],
      winShare:finalOutcome(state.players)[task.seat]};
  }catch(error){return {...task,status:'failed',steps,rolloutDiagnostics,elapsedMs:performance.now()-started,error:error.stack};}
}
const atomic=(path,value)=>{writeFileSync(path+'.tmp',JSON.stringify(value,null,2));renameSync(path+'.tmp',path);};
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6);
  if(!out)throw Error('Specify --out=absolute-runtime-directory');
  mkdirSync(out,{recursive:true});
  const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const manifest={plan,revision,tasks:tasks()};const mp=resolve(out,'manifest.json');
  if(existsSync(mp)&&JSON.stringify(JSON.parse(readFileSync(mp,'utf8')))!==JSON.stringify(manifest))
    throw Error('Existing manifest differs; use a fresh directory');
  if(!existsSync(mp))atomic(mp,manifest);
  for(const task of tasks()){
    const path=resolve(out,task.id+'.json');if(existsSync(path))continue;
    console.log(new Date().toISOString(),task.id,'started');
    const result=play(task);atomic(path,result);
    console.log(new Date().toISOString(),task.id,result.status,Math.round(result.elapsedMs)+'ms');
    if(result.status!=='complete'){process.exitCode=1;break;}
  }
  const results=tasks().map(t=>resolve(out,t.id+'.json')).filter(existsSync).map(p=>JSON.parse(readFileSync(p,'utf8')));
  atomic(resolve(out,'checkpoint.json'),{revision,planned:tasks().length,finished:results.length,
    complete:results.filter(r=>r.status==='complete').length,results});
}
