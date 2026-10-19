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
import {evaluateBeliefRollout,relativeScore,policyGrade} from '../scripts/wingspan-neural/rollout.mjs';
import {createSearch,runSearch,searchSummary} from '../scripts/wingspan-neural/search.mjs';

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


test('model JSON validates shape/version/finiteness and returns raw point margins with copied immutable weights',async()=>{
 const {compileModel,predictFeatures}=await import('../scripts/wingspan-neural/inference.mjs');
 const {FEATURE_VERSION,FEATURE_NAMES}=await import('../scripts/wingspan-neural/encoder.mjs');
 const n=FEATURE_NAMES.length;
 const json={version:1,featureVersion:FEATURE_VERSION,featureNames:[...FEATURE_NAMES],normalization:{mean:Array(n).fill(0),scale:Array(n).fill(1)},
  layers:[{in:n,out:1,weights:Array(n).fill(0),bias:[.5],activation:'linear'}],valueScale:30};
 const model=compileModel(json);assert.equal(predictFeatures(model,Array(n).fill(0)),15);
 json.layers[0].bias[0]=10;json.valueScale=100;assert.equal(predictFeatures(model,Array(n).fill(0)),15);
 assert.equal(compileModel(model),model);assert.ok(Object.isFrozen(model));
 for(const mutate of [x=>x.version=2,x=>x.featureVersion='other',x=>x.featureNames.reverse(),x=>x.normalization.scale[0]=0,
  x=>x.layers[0].weights[0]=NaN,x=>x.layers[0].out=4097,x=>x.layers[0].activation='sigmoid',x=>x.valueScale=1]){
  const invalid=structuredClone({...json,valueScale:30});mutate(invalid);assert.throws(()=>compileModel(invalid),/Invalid Wingspan value model/);
 }
 assert.throws(()=>predictFeatures(model,[1]),/dimensions/);
 const invalid=Array(n).fill(0);invalid[0]=Infinity;assert.throws(()=>predictFeatures(model,invalid),/nonfinite/);
});

async function constantModel(points=30){
 const {FEATURE_VERSION,FEATURE_NAMES}=await import('../scripts/wingspan-neural/encoder.mjs');
 const {compileModel}=await import('../scripts/wingspan-neural/inference.mjs');const n=FEATURE_NAMES.length;
 return compileModel({version:1,featureVersion:FEATURE_VERSION,featureNames:[...FEATURE_NAMES],normalization:{mean:Array(n).fill(0),scale:Array(n).fill(1)},
  layers:[{in:n,out:1,weights:Array(n).fill(0),bias:[points/30],activation:'linear'}],valueScale:30});
}

test('float32 JavaScript inference agrees with an independent Python scalar fixture',async()=>{
 const {execFileSync}=await import('node:child_process');
 const {compileModel,predictFeatures}=await import('../scripts/wingspan-neural/inference.mjs');
 const {FEATURE_VERSION,FEATURE_NAMES,encodeObservation}=await import('../scripts/wingspan-neural/encoder.mjs');
 const n=FEATURE_NAMES.length,features=encodeObservation(publicObservation(ready(),0),0);
 const model={version:1,featureVersion:FEATURE_VERSION,featureNames:[...FEATURE_NAMES],valueScale:30,
  normalization:{mean:Array.from({length:n},(_,i)=>(i%4)*.2),scale:Array.from({length:n},(_,i)=>1+(i%7)*.1)},
  layers:[{in:n,out:3,weights:Array.from({length:n*3},(_,i)=>((i%11)-5)*.002),bias:[.1,.2,-.3],activation:'relu'},
   {in:3,out:1,weights:[.5,-.2,.3],bias:[.1],activation:'linear'}]};
 const python=`import sys,json,struct
x=json.load(sys.stdin)
f=lambda n:struct.unpack('f',struct.pack('f',n))[0]
m=x['model']
v=[f(f(f(z)-f(a))/f(b)) for z,a,b in zip(x['features'],m['normalization']['mean'],m['normalization']['scale'])]
for layer in m['layers']:
 out=[]
 for o in range(layer['out']):
  acc=f(layer['bias'][o])
  for j in range(layer['in']): acc=f(acc+f(v[j]*f(layer['weights'][o*layer['in']+j])))
  out.append(max(0,acc) if layer['activation']=='relu' else acc)
 v=out
print(json.dumps({'margin':f(v[0]*m['valueScale'])}))`;
 const expected=JSON.parse(execFileSync('python',['-c',python],{input:JSON.stringify({model,features}),encoding:'utf8'})).margin;
 assert.equal(predictFeatures(compileModel(model),features),expected);
});

test('learned value blends root-viewer margin once, keeps off-turn perspective and falls back at terminal/setup/pending/physical',async()=>{
 const model=await constantModel(30),s=ready(),ref=relativeScore(s,0);
 assert.equal(relativeScore(s,0,{method:'neural',model}),.5*ref+15);
 s.currentPlayer=1;const offturn=relativeScore(s,0);
 assert.equal(relativeScore(s,0,{method:'neural',model}),.5*offturn+15);
 for(const mutate of [x=>x.phase='setup',x=>{x.phase='power';x.pending=[{owner:1}];},x=>x.mode='physical',x=>x.phase='gameover']){
  const state=structuredClone(s);mutate(state);
  assert.equal(relativeScore(state,0,{method:'neural',model}),relativeScore(state,0));
 }
});

test('both acting and off-turn predictions ignore unavailable hidden identities, and zero blend preserves complete seeded search',async()=>{
 const {predictObservation}=await import('../scripts/wingspan-neural/inference.mjs');
 const model=await constantModel(),s=ready();
 for(const viewer of [0,1]){
  const hidden=structuredClone(s);hidden.deck.reverse();hidden.bonusDeck.reverse();hidden.players[1-viewer].hand.reverse();
  const a=publicObservation(s,viewer),b=publicObservation(hidden,viewer);assert.deepEqual(a,b);
  assert.equal(predictObservation(model,a,viewer),predictObservation(model,b,viewer));
 }
 const obs=publicObservation(s,0),choices=candidateActions(s).slice(0,5);
 const ref=createSearch(obs,choices,{rng:seededRandom(67)}),zero=createSearch(obs,choices,{method:'neural',blend:0,rng:seededRandom(67)});
 runSearch(ref,12);runSearch(zero,12);assert.deepEqual(ref.arms,zero.arms);assert.deepEqual(ref.diagnostics,zero.diagnostics);
 assert.throws(()=>createSearch(obs,choices,{method:'neural'}),/Compiled/);
});

test('model rollout settles ordinary action horizon and game wrapper retains deployed parity without persisting weights',async()=>{
 const model=await constantModel(),s=ready(),obs=publicObservation(s,0),choices=candidateActions(s);
 let leaf,info;evaluateBeliefRollout(obs,choices[0].action,seededRandom(9),{horizon:4,method:'neural',model,onLeaf:(s,i)=>{leaf=s;info=i;}});
 assert.equal(info.actionTurns,4);assert.equal(leaf.phase,'play');assert.equal(leaf.pending.length,0);assert.equal(leaf.turnContext,null);
 const {chooseAction,normalizeArm,play}=await import('../scripts/wingspan-neural/game.mjs');
 const legacy=await import('../scripts/wingspan-study/game.mjs');
 const arm={method:'reference',pipeline:'deployed',budget:100,horizon:4};
 const one=chooseAction(s,arm,{seed:7}),two=legacy.chooseAction(s,arm,{seed:7});
 assert.deepEqual(one.summary,two.summary);assert.deepEqual(one.action,two.action);
 assert.throws(()=>normalizeArm({priorWeight:0}),/prior/);
 const task={seed:8,seat:0,candidate:{method:'neural',pipeline:'study'},opponent:{method:'reference',pipeline:'study'}};
 const stopped=play(task,{models:{neural:model},deadlineEpochMs:0});assert.equal(stopped.status,'deadline');
 assert.equal(Object.hasOwn(stopped,'models'),false);assert.equal(stopped.scores,undefined);
});


test('cached root neural baseline is exactly equal to direct sampled value and visibility fallback is conservative',async()=>{
 const {supportedModelObservation}=await import('../scripts/wingspan-neural/rollout.mjs');
 const model=await constantModel(12),s=ready(),obs=publicObservation(s,0),choices=candidateActions(s);
 assert.equal(supportedModelObservation(obs,0),true);
 const search=createSearch(obs,choices,{method:'neural',model,rng:seededRandom(110)});
 assert.equal(search.initialLearnedMargin,12);
 const direct=evaluateBeliefRollout(obs,choices[0].action,seededRandom(110),{method:'neural',model});
 runSearch(search,1);assert.equal(search.arms[0].sum,direct);
 const masked=structuredClone(obs);masked.players[0].handCount++;
 assert.equal(supportedModelObservation(masked,0),false);
});


test('setup/power root continuations retain the reference and a true terminal leaf is exact',async()=>{
 const model=await constantModel(120);
 const setup=newGame({players:2,seed:531});
 const poweredState=powered(),ordinary=candidateActions(poweredState).find(x=>x.action.type==='gainFood');
 const pending=applyAction(poweredState,ordinary.action);
 for(const state of [setup,pending]){
  const actor=state.phase==='power'?state.pending[0].owner:state.currentPlayer;
  const obs=publicObservation(state,actor),action=candidateActions(state)[0].action;
  const baseline=evaluateBeliefRollout(obs,action,seededRandom(71),{horizon:4});
  assert.equal(evaluateBeliefRollout(obs,action,seededRandom(71),{horizon:4,method:'neural',model}),baseline);
 }
 const final=powered();final.round=4;final.remaining=[1,0];for(const p of final.players)p.goalPoints=[0,0,0];
 const actor=0,obs=publicObservation(final,actor),action=candidateActions(final).find(x=>x.action.type==='gainFood').action;
 let leaf;const reward=evaluateBeliefRollout(obs,action,seededRandom(411),{method:'neural',model,onLeaf:s=>{leaf=s;}});
 assert.equal(leaf.phase,'gameover');assert.equal(leaf.pending.length,0);
 const exact=scorePlayer(leaf.players[0]).total-scorePlayer(leaf.players[1]).total;
 assert.equal(relativeScore(leaf,actor,{method:'neural',model}),exact);
 const initial=determinize(obs,seededRandom(411));
 const before=relativeScore(initial,actor,{method:'neural',model});
 assert.equal(reward,.82*(exact-before)+.18*policyGrade(initial,action,actor));
});


test('learned usage counts only blended leaf endpoints, exposes fallbacks, and records model identity without weights',async()=>{
 const model=await constantModel(),state=ready(),choices=candidateActions(state);
 const search=createSearch(publicObservation(state,0),choices,{method:'neural',model,rng:seededRandom(190)});
 assert.equal(search.diagnostics.learnedLeafCount,0,'cached root baseline is not a leaf evaluation');
 runSearch(search,4);assert.equal(search.diagnostics.learnedLeafCount,4);assert.equal(search.diagnostics.learnedFallbackCount,0);
 const setup=newGame({seed:120}),setupChoices=candidateActions(setup),fallback={};
 evaluateBeliefRollout(publicObservation(setup,0),setupChoices[0].action,seededRandom(44),{method:'neural',model,diagnostics:fallback});
 assert.equal(fallback.learnedLeafCount,0);assert.equal(fallback.learnedFallbackCount,1);
 const zero={};evaluateBeliefRollout(publicObservation(state,0),choices[0].action,seededRandom(90),{method:'neural',model,blend:0,diagnostics:zero});
 assert.equal(zero.learnedLeafCount,0);assert.equal(zero.learnedFallbackCount,0);
 const {play}=await import('../scripts/wingspan-neural/game.mjs');
 const task={seed:8,seat:0,candidate:{method:'neural',pipeline:'study'},opponent:{method:'reference',pipeline:'study'}};
 const record=play(task,{models:{neural:model},modelIds:{neural:'sha256-fixture'},deadlineEpochMs:0});
 assert.deepEqual(record.modelIds,{neural:'sha256-fixture'});assert.equal(JSON.stringify(record).includes('weights'),false);
});
