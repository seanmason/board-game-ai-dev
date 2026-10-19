import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,applyAction,publicObservation,seededRandom,assertValid} from '../wingspan/core.js';
import {BIRDS} from '../wingspan/catalog.js';
import {HABITATS,scorePlayer} from '../wingspan/scoring.js';
import {candidateActions} from '../wingspan/actions.js';
import {createSearch as productionSearch,runSearch as productionRun} from '../wingspan/analysis.js';
import {evaluateLeaf} from '../wingspan/leaf-evaluators.js';
import {evaluateBeliefRollout as oldRollout} from '../wingspan/rollout.js';
import {determinize} from '../wingspan/belief.js';
import {evaluateBeliefRollout,relativeScore,policyGrade} from '../scripts/wingspan-study/rollout.mjs';
import {createSearch,runSearch,searchSummary} from '../scripts/wingspan-study/search.mjs';

function ready(seed=418){
  let s=newGame({players:2,seed});
  while(s.phase==='setup'){
    const p=s.players[s.currentPlayer];
    s=applyAction(s,{type:'setup',keep:[],foodDiscard:[],bonusId:p.bonusOffer[0]});
  }
  return s;
}
function place(s,bird,owner,habitat){
  for(const pile of [s.deck,s.birdDiscard,s.tray,...s.players.map(p=>p.hand)]){
    const i=pile.indexOf(bird.id);
    if(i>=0){pile.splice(i,1);break;}
  }
  s.players[owner].habitats[habitat].push({id:bird.id,eggs:0,cached:[],tucked:[]});
}
function powered(){
  const s=ready(),used=new Set();
  for(let owner=0;owner<2;owner++)for(const habitat of HABITATS){
    // Simple unconditional brown outputs: every possible resource action starts powers.
    const bird=BIRDS.find(b=>b.powerType==='brown'&&b.habitats.includes(habitat)&&
      [1,2,3,4,15,16,19,22,25,29,30,31,39,40].includes(b.powerCode)&&!used.has(b.id));
    assert.ok(bird,habitat);used.add(bird.id);place(s,bird,owner,habitat);
  }
  assertValid(s);return s;
}
function sample(s,options={}){
  const root=candidateActions(s).find(x=>x.action.type==='gainFood')??candidateActions(s)[0];
  let leaf,info;
  const diagnostics={};
  const reward=evaluateBeliefRollout(publicObservation(s,s.currentPlayer),root.action,
    seededRandom(101),{diagnostics,...options,onLeaf:(state,details)=>{leaf=state;info=details;}});
  return {leaf,info,diagnostics,reward,root};
}

test('last ordinary action powers settle at horizons 1/2/4/12 without another ordinary action',()=>{
  const s=powered();
  for(const horizon of [1,2,4,12]){
    const {leaf,info,diagnostics}=sample(s,{horizon});
    assert.equal(info.actionTurns,horizon);
    assert.equal(leaf.phase,'play');assert.equal(leaf.pending.length,0);
    assert.equal(leaf.turnContext,null);assert.equal(info.settled,true);
    assert.ok(info.powerSteps>=2,'root and final ordinary action powers resolved');
    assert.equal(diagnostics.safetyCapCount,0);
    assert.equal(info.actionTurnsBySeat.reduce((a,b)=>a+b),horizon);
  }
});

// Independent reproduction of the production horizon-one endpoint, using its
// unchanged softmax policy and draw order. This exposes the missing queue directly.
function oldEndpoint(observation,action,seed){
  const random=seededRandom(seed);
  let s=applyAction(determinize(observation,random),action),turns=0;
  while(s.phase!=='gameover'&&turns<1){
    const options=candidateActions(s);
    const owner=s.phase==='power'?s.pending[0].owner:s.currentPlayer;
    const style=owner===observation.currentPlayer?'greedy':random()<.65?'greedy':'exploratory';
    let choice=options[0];
    if(options.length>1){
      const scores=options.map(x=>policyGrade(s,x.action));
      const top=Math.max(...scores),temp=style==='greedy'?.9:3.4;
      const weights=scores.map(x=>Math.exp(Math.max(-60,(x-top)/temp)));
      let draw=random()*weights.reduce((a,b)=>a+b);
      for(let i=0;i<options.length;i++){draw-=weights[i];if(draw<=0){choice=options[i];break;}}
    }
    if(s.phase==='play')turns++;
    s=applyAction(s,choice.action);
  }
  return s;
}

test('old endpoint omits the last action powers while corrected reference settles that queue',()=>{
  const s=powered(),obs=publicObservation(s,0),corrected=sample(s,{horizon:1});
  const old=oldEndpoint(obs,corrected.root.action,101);
  assert.equal(old.phase,'power');assert.ok(old.pending.length>0);assert.ok(old.turnContext);
  assert.equal(corrected.leaf.phase,'play');assert.equal(corrected.leaf.pending.length,0);
  // The reproduced endpoint also agrees with the unmodified production reward.
  const initial=determinize(obs,seededRandom(101));
  const before=evaluateLeaf(initial,0,'opening-plan')-evaluateLeaf(initial,1,'opening-plan');
  const after=evaluateLeaf(old,0,'opening-plan')-evaluateLeaf(old,1,'opening-plan');
  const expected=.82*(after-before)+.18*policyGrade(initial,corrected.root.action,0);
  assert.equal(oldRollout(obs,corrected.root.action,seededRandom(101),{
    horizon:1,maxSteps:192,leafEvaluator:'opening-plan'}),expected);
});

test('root powers settle without advancing an ordinary action, and pending caps are explicit',()=>{
  const s=powered(),root=candidateActions(s).find(x=>x.action.type==='gainFood');
  const pending=applyAction(s,root.action);
  assert.equal(pending.phase,'power');
  // A legal repeated queue isolates a hard transition cap during pending resolution.
  pending.pending.push(structuredClone(pending.pending[0]),structuredClone(pending.pending[0]));
  const obs=publicObservation(pending,pending.pending[0].owner);
  let leaf,info;const diagnostics={};
  evaluateBeliefRollout(obs,{type:'power',skip:true},seededRandom(3),{
    horizon:0,maxSteps:1,diagnostics,onLeaf:(s,i)=>{leaf=s;info=i;}});
  assert.equal(leaf.phase,'power');assert.equal(info.actionTurns,0);
  assert.equal(diagnostics.unsettledLeaves,1);assert.equal(diagnostics.settledLeaf,0);
  assert.equal(diagnostics.safetyCapCount,1);assert.equal(info.pendingCount,1);
  const settled={};
  evaluateBeliefRollout(obs,{type:'power',skip:true},seededRandom(3),{
    horizon:0,diagnostics:settled,onLeaf:(s,i)=>{assert.equal(s.phase,'play');assert.equal(i.actionTurns,0);}});
  assert.equal(settled.settledLeaf,1);assert.equal(settled.safetyCapCount,0);
});

test('root last action settles round goals and terminal powers exactly',()=>{
  for(const round of [1,4]){
    const s=powered();s.round=round;s.remaining=[1,0];
    for(const p of s.players)p.goalPoints=Array(round-1).fill(0);
    const {leaf,info}=sample(s,{horizon:1});
    assert.equal(info.actionTurns,round===4?0:1);
    assert.equal(leaf.pending.length,0);assert.equal(leaf.turnContext,null);
    assert.equal(leaf.players[0].goalPoints.length,round);
    assert.equal(info.terminalReached,round===4);
    if(round===4){
      assert.equal(relativeScore(leaf,0),scorePlayer(leaf.players[0]).total-scorePlayer(leaf.players[1]).total);
    }
  }
});

test('reference remains adopted opening-plan and diagnostics preserve RNG, privacy and root coverage',()=>{
  const s=ready(),obs=publicObservation(s,0),before=JSON.stringify(obs);
  assert.equal(relativeScore(s,0),evaluateLeaf(s,0,'opening-plan')-evaluateLeaf(s,1,'opening-plan'));
  const choices=candidateActions(s).slice(0,5);
  const stream=()=>{let calls=0;const source=seededRandom(55);return {rng:()=>{calls++;return source();},count:()=>calls};};
  const a=stream(),b=stream();
  const first=createSearch(obs,choices,{rng:a.rng,horizon:1});
  const second=createSearch(obs,choices,{rng:b.rng,horizon:1,diagnostics:false});
  runSearch(first,choices.length+3);runSearch(second,choices.length+3);
  assert.deepEqual(first.arms,second.arms);assert.equal(a.count(),b.count());
  assert.ok(first.arms.every(x=>x.visits>0));assert.equal(first.exploration,3.5);
  assert.equal(first.diagnostics.rolloutCount,choices.length+3);
  assert.equal(JSON.stringify(obs),before);
  const hidden=structuredClone(s);hidden.deck.reverse();hidden.bonusDeck.reverse();
  assert.deepEqual(publicObservation(hidden,0),obs);
  const summary=searchSummary(first);summary.diagnostics.actionTurnsBySeat[0]=999;
  assert.notEqual(first.diagnostics.actionTurnsBySeat[0],999);
  assert.throws(()=>evaluateBeliefRollout(s,choices[0].action,seededRandom(1)),/REDACTED/);
  const invalid=createSearch(obs,[{action:{type:'playBird',birdId:-1,habitat:'forest'}}]);
  assert.throws(()=>runSearch(invalid,1),/hand/);
});


test('root white bonus selection and actual pink activation finish before the boundary',()=>{
  const white=ready();
  const bird=BIRDS.find(b=>b.powerCode===13);
  place(white,bird,0,bird.habitats[0]);
  white.phase='power';white.turnContext={actor:0,main:'playBird'};
  white.pending=[{owner:0,habitat:bird.habitats[0],index:0,birdId:bird.id,
    code:13,timing:'white',event:{type:'playBird',actor:0}}];
  assertValid(white);
  let info,leaf;
  evaluateBeliefRollout(publicObservation(white,0),{type:'power',choice:{}},seededRandom(7),{
    horizon:0,onLeaf:(s,i)=>{leaf=s;info=i;}});
  assert.equal(info.actionTurns,0);assert.equal(info.powerSteps,1);
  assert.equal(leaf.players[0].bonuses.length,2);assert.equal(leaf.phase,'play');
  assert.equal(leaf.pending.length,0);

  const pink=ready();
  const cowbird=BIRDS.find(b=>b.name==='Bronzed Cowbird');
  const support=BIRDS.find(b=>b.powerType==='brown'&&b.habitats.includes('grassland')&&b.eggs>=2);
  place(pink,support,0,'grassland');place(pink,cowbird,1,'grassland');
  const root=candidateActions(pink).find(x=>x.action.type==='layEggs');
  const queued=applyAction(pink,root.action);
  assert.ok(queued.pending.some(x=>x.timing==='pink'));
  evaluateBeliefRollout(publicObservation(pink,0),root.action,seededRandom(7),{
    horizon:0,onLeaf:(s,i)=>{leaf=s;info=i;}});
  assert.equal(info.actionTurns,0);assert.ok(info.powerSteps>=1);
  assert.equal(leaf.pending.length,0);assert.equal(leaf.turnContext,null);
  assert.equal(leaf.phase,'play');
});


test('with no boundary powers the copied root UCB and rollout policy retain exact RNG and rewards',()=>{
  const s=ready(),obs=publicObservation(s,0),choices=candidateActions(s).slice(0,6);
  let callsA=0,callsB=0;const a=seededRandom(91),b=seededRandom(91);
  const research=createSearch(obs,choices,{horizon:1,rng:()=>{callsA++;return a();}});
  const production=productionSearch(obs,choices,{method:'belief-rollout',leafEvaluator:'opening-plan',
    horizon:1,rolloutStepLimit:192,rng:()=>{callsB++;return b();}});
  runSearch(research,choices.length+6);productionRun(production,choices.length+6);
  assert.deepEqual(research.arms,production.arms);assert.equal(callsA,callsB);
  const rewardSum=research.arms.reduce((n,x)=>n+x.sum,0);
  assert.ok(Math.abs(rewardSum-research.diagnostics.priorRewardSum-
    research.diagnostics.leafRewardSum)<1e-10);
});
