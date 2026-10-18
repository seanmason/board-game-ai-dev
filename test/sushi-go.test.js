import test from 'node:test';
import assert from 'node:assert/strict';
import {TYPES,TYPE_IDS,CARDS,ALL_IDS,typeOf,handSize} from '../sushi-go/catalog.js';
import {newGame,applyAction,legalActions,assertValid,random,allCards,rememberHand} from '../sushi-go/core.js';
import {choices,choiceKey} from '../sushi-go/actions.js';
import {localScore,makiScore,puddingScore,winnersFor,roundScore} from '../sushi-go/scoring.js';
import {recordPhysicalAction,recordObservation,publicObservation,analysisBlocker} from '../sushi-go/observations.js';
import {sampleWorld} from '../sushi-go/belief.js';
import {createSearch,runSearch,summary,previewTableau,analysisBudget} from '../sushi-go/ai.js';
import {installSearchWorker} from '../shared/search-worker.js';
import {readSession} from '../shared/session.js';
const entries=types=>{const used={};return types.map(t=>({id:`${t}-${used[t]=(used[t]??-1)+1}`,pick:1}));};
function ordered(types){return previewTableau([],{cards:types,returnId:null});}
function oracle(types){
 const c={},empty=[];let nigiri=0;for(const t of types){c[t]=(c[t]??0)+1;if(t==='wasabi')empty.push(1);if(['egg','salmon','squid'].includes(t)){const base={egg:1,salmon:2,squid:3}[t];nigiri+=base*(empty.length?(empty.pop(),3):1);}}
 let dumpling=0;for(let i=1;i<=Math.min(c.dumpling??0,5);i++)dumpling+=i;
 return Math.floor((c.tempura??0)/2)*5+Math.floor((c.sashimi??0)/3)*10+dumpling+nigiri;
}
function joint(s,actions){for(let p=0;p<s.players;p++)s=applyAction(s,actions?.[p]??legalActions(s,p)[0]);return applyAction(s,{type:'reveal'});}
function reshuffleHands(s,prefixes){
 const publicIDs=new Set([...s.tableaux.flatMap(t=>t.map(e=>e.id)),...s.puddings.flat(),...s.discard]);const pool=ALL_IDS.filter(id=>!publicIDs.has(id)),hands=Array.from({length:s.players},()=>[]);
 for(let p=0;p<s.players;p++)for(const t of prefixes[p]??[]){const i=pool.findIndex(id=>typeOf(id)===t);assert.ok(i>=0);hands[p].push(pool.splice(i,1)[0]);}
 for(let p=0;p<s.players;p++)while(hands[p].length<s.remaining)hands[p].push(pool.shift());s.hands=hands;s.deck=pool;s.deckCount=pool.length;s.memories=Array.from({length:s.players},()=>({}));for(let p=0;p<s.players;p++)rememberHand(s,p);assertValid(s);return s;
}
test('independent 12-type108 catalog, identities, setup and original edition exclusions',()=>{
 assert.deepEqual(Object.values(TYPES).map(c=>c.count),[14,14,14,6,12,8,5,10,5,10,6,4]);assert.equal(ALL_IDS.length,108);assert.equal(new Set(ALL_IDS).size,108);assert.ok(Object.isFrozen(CARDS));
 for(const players of [2,3,4,5]){const s=newGame({players,mode:'digital',seed:51});assert.equal(s.hands[0].length,handSize(players));assert.equal(s.deckCount,108-players*handSize(players));assert.deepEqual(s,newGame({players,mode:'digital',seed:51}));}
 assert.throws(()=>newGame({players:6}));assert.throws(()=>newGame({edition:'party'}));
});
test('source-linked set and dumpling fixtures',()=>{
 for(const [n,want] of [[1,0],[2,5],[5,10]])assert.equal(localScore(entries(Array(n).fill('tempura'))).total,want);
 for(const [n,want] of [[2,0],[3,10],[7,20]])assert.equal(localScore(entries(Array(n).fill('sashimi'))).total,want);
 for(const [n,want] of [[0,0],[1,1],[5,15],[6,15]])assert.equal(localScore(entries(Array(n).fill('dumpling'))).total,want);
});
test('wasabi binds the next nigiri and never retroactively; ordered doubles matter',()=>{
 assert.equal(localScore(ordered(['salmon'])).total,2);assert.equal(localScore(ordered(['wasabi','salmon'])).total,6);assert.equal(localScore(ordered(['salmon','wasabi'])).total,2);
 assert.equal(localScore(ordered(['wasabi','egg','squid'])).total,6);assert.equal(localScore(ordered(['wasabi','squid','egg'])).total,10);assert.equal(localScore(ordered(['wasabi','wasabi','squid','salmon'])).total,15);
});
test('maki ties truncate, first ties suppress second and zero maki is ineligible',()=>{
 for(const [input,want] of [[[5,3,3,2],[6,1,1,0]],[[4,4,2],[3,3,0]],[[5,0],[6,0]],[[0,0,0],[0,0,0]],[[2,2,2,2,1],[1,1,1,1,0]]])assert.deepEqual(makiScore(input),want);
});
test('pudding all-equal, negative truncation, two-player exception and final tiebreak',()=>{
 for(const [input,want] of [[[4,3,0,0],[6,0,-3,-3]],[[1,1,1],[0,0,0]],[[2,0],[6,0]],[[1,1,1,1,0],[1,1,1,1,-6]]])assert.deepEqual(puddingScore(input),want);
 assert.deepEqual(winnersFor([30,30,29],[1,2,4]),[1]);assert.deepEqual(winnersFor([30,30],[2,2]),[0,1]);
});
test('small independent scoring oracle agrees over exhaustive short ordered menus',()=>{
 const subset=['tempura','sashimi','dumpling','wasabi','egg','salmon','squid'];
 function visit(a,depth){assert.equal(localScore(ordered(a)).total,oracle(a));if(depth)for(const t of subset)visit([...a,t],depth-1);}visit([],4);
});
test('complete ordered legal choices match an independent index enumerator',()=>{
 for(const hand of [['salmon'],['tempura','tempura'],['wasabi','salmon'],['egg','salmon','squid'],['tempura','tempura','sashimi']]){
  const ids=entries(hand).map(e=>e.id),table=entries(['chopsticks','chopsticks']),expected=new Set(hand.map(t=>JSON.stringify([[t],null])));
  for(const chop of table)for(let i=0;i<hand.length;i++)for(let j=0;j<hand.length;j++)if(i!==j)expected.add(JSON.stringify([[hand[i],hand[j]],chop.id]));
  assert.deepEqual(new Set(choices(ids,table).map(choiceKey)),expected);
 }
 assert.equal(choices(entries(['chopsticks','salmon']).map(e=>e.id),[]).some(a=>a.cards.length===2),false,'Freshly drafted chopsticks cannot be used');
});
test('simultaneous commitment order cannot affect public position or later players’ observations',()=>{
 const s=newGame({players:3,mode:'digital'}),actions=s.hands.map((_,p)=>legalActions(s,p)[0]),before=publicObservation(s,2);let a=s,b=s;
 for(const p of [0,1,2])a=applyAction(a,actions[p]);for(const p of [2,0,1])b=applyAction(b,actions[p]);assert.deepEqual(a,b);
 assert.deepEqual(publicObservation(applyAction(s,actions[0]),2),before);assert.deepEqual(a.tableaux,[[],[],[]]);assert.deepEqual(applyAction(a,{type:'reveal'}),applyAction(b,{type:'reveal'}));assert.throws(()=>applyAction(s,{type:'reveal'}));
});
test('public projection never touches hidden deck, other hands, or other commitments',()=>{
 const s=newGame({players:3,mode:'digital'}),expected=publicObservation(s,0);
 Object.defineProperty(s,'deck',{get(){throw Error('Hidden deck');}});Object.defineProperty(s,'seed',{get(){throw Error('Hidden seed');}});Object.defineProperty(s.hands,1,{get(){throw Error('Hidden hand');}});Object.defineProperty(s.commitments,1,{get(){throw Error('Hidden commitment');}});Object.defineProperty(s.memories,1,{get(){throw Error('Private other memory');}});
 assert.deepEqual(publicObservation(s,0),expected);assert.equal('deck' in expected,false);assert.equal('seed' in expected,false);
});
test('paired hidden truths give identical seeded worker advice',()=>{
 const a=newGame({players:3,mode:'digital',seed:321}),b=structuredClone(a);[b.hands[1][0],b.deck[0]]=[b.deck[0],b.hands[1][0]];b.commitments[1]={cards:[typeOf(b.hands[1][0])],returnId:null};
 assert.deepEqual(publicObservation(a,0),publicObservation(b,0));const qa=createSearch(publicObservation(a,0),{seed:4}),qb=createSearch(publicObservation(b,0),{seed:4});runSearch(qa,12);runSearch(qb,12);assert.deepEqual(summary(qa),summary(qb));
});
test('Chopsticks double-pick returns old copy and all hands shrink once',()=>{
 let s=reshuffleHands(newGame({players:2,mode:'digital'}),[['chopsticks'],['chopsticks']]);s=joint(s,s.hands.map((h,actor)=>({type:'commit',actor,cards:['chopsticks'],returnId:null})));
 s=reshuffleHands(s,[['wasabi','salmon'],['wasabi','salmon']]);const old=s.tableaux.map(t=>t[0].id),packets=s.packets.slice();s=joint(s,s.hands.map((h,actor)=>({type:'commit',actor,cards:['wasabi','salmon'],returnId:old[actor]})));
 assert.equal(s.remaining,8);assert.equal(localScore(s.tableaux[0]).total,6);assert.ok(s.hands[1].includes(old[0]));assert.equal(s.packets[1],packets[0]);assert.equal(s.tableaux[0].some(e=>e.id===old[0]),false);assertValid(s);
});
test('known packet memory follows public removals and chopsticks insertion',()=>{
 let s=reshuffleHands(newGame({players:2,mode:'digital'}),[['chopsticks'],['chopsticks']]);s=joint(s,s.hands.map((h,actor)=>({type:'commit',actor,cards:['chopsticks'],returnId:null})));s=reshuffleHands(s,[['wasabi','salmon'],['dumpling']]);const packet=s.packets[0],before=structuredClone(s.memories[0][packet].types),old=s.tableaux[0][0].id;
 s=joint(s,[{type:'commit',actor:0,cards:['wasabi','salmon'],returnId:old},legalActions(s,1)[0]]);const m=s.memories[0][packet];assert.equal(m.size,8);assert.equal(m.types.chopsticks,(before.chopsticks??0)+1);assert.equal(m.types.wasabi??0,(before.wasabi??0)-1);assert.equal(m.types.salmon??0,(before.salmon??0)-1);
 const obs=publicObservation(s,0),world=sampleWorld(obs,random(5));assert.deepEqual(world.hands[1].map(typeOf).sort(),Object.entries(m.types).flatMap(([t,c])=>Array(c).fill(t)).sort());assertValid(world);
});
test('sampled opponents receive only their sampled own packet memory',()=>{const s=newGame({players:3,mode:'digital'}),o=publicObservation(s,0),w=sampleWorld(o,random(6));assert.deepEqual(Object.keys(w.memories[1]),[s.packets[1]]);assertValid(w);});
test('final known singletons use exact reveal scoring and the received card is forced',()=>{
 let s=newGame({players:3,mode:'digital',seed:29});while(s.remaining>1)s=joint(s);const o=publicObservation(s,0),q=createSearch(o,{seed:7});assert.equal(q.method,'exact known singleton reveal');for(let p=0;p<3;p++)assert.equal(legalActions(s,p).length,1);runSearch(q,1);
 const end=joint(s),dessert=puddingScore(end.puddings.map(p=>p.length)),values=end.scores.map((v,p)=>v+.4*dessert[p]);assert.equal(summary(q).candidates[0].utility,values[0]-(values[1]+values[2])/2);
});
test('physical private hand entry, partial reveals, reload, cancel and atomic conflict',()=>{
 let s=recordPhysicalAction(newGame({players:2}),{type:'setup'});assert.match(analysisBlocker(s,0),/received hand/);s=recordObservation(s,{type:'hand',player:0,types:Array(10).fill('tempura')});assert.equal(analysisBlocker(s,0),'');
 const before=structuredClone(s);s=recordPhysicalAction(s,{type:'commit',actor:0,cards:['tempura']});assert.deepEqual(s.tableaux,before.tableaux);assert.deepEqual(publicObservation(s,1).ownCommitment,null);assertValid(JSON.parse(JSON.stringify(s)));
 assert.throws(()=>recordObservation(s,{type:'reveal'}));s=recordPhysicalAction(s,{type:'cancelReveal'});assert.deepEqual(s.tableaux,before.tableaux);s=recordPhysicalAction(s,{type:'commit',actor:0,cards:['tempura']});s=recordPhysicalAction(s,{type:'commit',actor:1,cards:['squid']});s=recordObservation(s,{type:'reveal'});assert.equal(s.remaining,9);assert.equal(s.phase,'awaitHands');assert.ok(s.deck.every(c=>c===null));
 const saved=JSON.stringify(s);assert.throws(()=>recordObservation(s,{type:'hand',player:0,types:Array(9).fill('squid')}));assert.equal(JSON.stringify(s),saved);
});
test('explicit physical correction invalidates packet certainty without changing public scores',()=>{
 let s=recordPhysicalAction(newGame({players:2}),{type:'setup'});s=recordObservation(s,{type:'hand',player:0,types:Array(10).fill('tempura')});assert.throws(()=>recordObservation(s,{type:'hand',player:0,types:Array(10).fill('sashimi')}),/explicit correction/);s=recordObservation(s,{type:'hand',player:0,types:Array(10).fill('sashimi'),correction:true});assert.deepEqual(s.scores,[0,0]);assert.equal(s.events.at(-1).type,'handCorrection');
});
test('invalid positions and invalid history index are rejected',()=>{
 const s=newGame({mode:'digital'});for(const mutate of [a=>a.deck.push(a.deck[0]),a=>a.hands[0].pop(),a=>a.round=4,a=>a.scores[0]=999,a=>a.remaining=2,a=>a.phase='gameover']){const b=structuredClone(s);mutate(b);assert.throws(()=>assertValid(b));}
 assert.throws(()=>readSession({format:'sushi-go',version:1,history:[{state:s,label:'Start'}],index:.5},{format:'sushi-go',validateState:assertValid,playerCount:s=>s.players}),/history position/);
});
test('full seeded games keep108 copies, hand sizes synchronized, exact scores and no reshuffle',()=>{
 for(const players of [2,3,4,5])for(let seed=1;seed<=12;seed++){
  const rng=random(seed);let s=newGame({players,mode:'digital',seed}),turns=0;while(s.phase!=='gameover'){
   if(s.phase==='roundEnd'){const before=s.deck.slice();s=applyAction(s,{type:'nextRound'});assert.deepEqual(s.deck,before.slice(0,before.length-players*handSize(players)));continue;}
   const actions=s.hands.map((_,p)=>{const aa=legalActions(s,p);return aa[Math.floor(rng()*aa.length)];});s=joint(s,actions);turns++;assert.equal(allCards(s).length,108);assertValid(s);
  }
  assert.equal(turns,3*handSize(players));assert.equal(s.roundScores.length,3);assert.equal(s.deckCount,108-3*players*handSize(players));assert.equal(s.winners.length>=1,true);
 }
});


test('practical worker budget covers a legal Chopsticks menu larger than 64 roots',()=>{
 let s=reshuffleHands(newGame({players:2,mode:'digital'}),[['chopsticks'],['chopsticks']]);
 s=joint(s,s.hands.map((h,actor)=>({type:'commit',actor,cards:['chopsticks'],returnId:null})));
 s=reshuffleHands(s,[['tempura','sashimi','dumpling','maki1','maki2','maki3','egg','salmon','squid']]);
 const before=structuredClone(s),actions=legalActions(s,0),observation=publicObservation(s,0);
 assert.ok(actions.length>64,'Fixture must exercise the coverage floor');
 assert.equal(analysisBudget(0),64);assert.equal(analysisBudget(actions.length,'256'),256);
 assert.throws(()=>analysisBudget(actions.length,'bogus'));
 const queue=[],messages=[],scope={postMessage:m=>messages.push(m)};
 const runtime=installSearchWorker({create:()=>createSearch(observation,{actions,seed:611}),run:runSearch,summarize:summary,batchSize:()=>1},{scope,schedule:fn=>queue.push(fn),cancel:()=>{},now:()=>0});
 scope.onmessage({data:{type:'start',generation:1,iterationLimit:analysisBudget(actions.length)}});
 for(let n=0;queue.length&&n<1000;n++)queue.shift()();
 const last=messages.at(-1);assert.equal(last.iterations,actions.length);assert.equal(last.paused,true);
 assert.ok(last.candidates.every(c=>c.visits===1),'Every legal ordered choice receives its sample');
 assert.equal(queue.length,0);assert.deepEqual(s,before);runtime.dispose();
});
