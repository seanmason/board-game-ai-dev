import test from 'node:test';
import assert from 'node:assert/strict';
import {CARDS,RANKS,EDITION} from '../love-letter/catalog.js';
import {newGame,assertValid,legalActions,applyAction,finishTurn,random,domainPlay,remember,outcome} from '../love-letter/core.js';
import {recordObservation,recordPhysicalAction,publicObservation,analysisBlocker} from '../love-letter/observations.js';
import {allocations,sampleWorld} from '../love-letter/belief.js';
import {createSearch,runSearch,summary,analysisBudget} from '../love-letter/ai.js';
import {readSession} from '../shared/session.js';
// Hand-transcribed classic pp9–23. Fixtures redistribute all remaining cards;
// they do not call production setup to decide an effect's expected result.
function fixture(hands,{players=hands.length,deck,protected:protection,affection}={}){
 const s=newGame({players,mode:'digital'}),pool=[1,1,1,1,1,2,2,3,3,4,4,5,5,6,7,8];
 const take=r=>{const i=pool.indexOf(r);assert.ok(i>=0);pool.splice(i,1);return r;};
 s.hands=hands.map(h=>h.map(take));s.reserve=take(pool.at(-1));s.exclusions=players===2?[take(pool[0]),take(pool[0]),take(pool[0])]:[];
 s.discards=Array.from({length:players},()=>[]);
 if(deck){s.deck=deck.map(take);for(const rank of pool.splice(0))s.discards[players-1].push({rank,kind:'played',turn:0});}else s.deck=pool;
 s.drawCount=s.deck.length;s.phase='choosePlay';if(protection)s.protected=protection;if(affection)s.affection=affection;assertValid(s);return s;
}
const play=(s,r,target,guess)=>applyAction(s,{type:'play',cardRank:r,...(target===undefined?{}:{target}),...(guess?{guess}:{})});
test('catalog and edition pin; classic setup player/deck counts',()=>{
 assert.deepEqual(CARDS.slice(1).map(c=>c.count),[5,2,2,2,2,1,1,1]);assert.equal(RANKS.length,16);
 for(const players of [2,3,4]){const s=newGame({players,mode:'digital',seed:317,starter:1});assert.equal(s.deck.length,players===2?10:15-players);assert.equal(s.exclusions.length,players===2?3:0);assert.equal(s.reserveCount,1);assert.equal(s.current,1);assert.deepEqual(s,newGame({players,mode:'digital',seed:317,starter:1}));}
 assert.throws(()=>newGame({edition:'2019'}));assert.throws(()=>newGame({players:5}));assert.throws(()=>newGame({priority:[0,0]}));assert.equal(EDITION,'aeg-classic-2012');
});
test('all Guard targets and guesses are legal independently of target truth',()=>{
 const s=fixture([[1,4],[2],[3]]);const guards=legalActions(s).filter(a=>a.cardRank===1);assert.equal(guards.length,14);assert.deepEqual([...new Set(guards.map(a=>a.guess))],[2,3,4,5,6,7,8]);
 const before=JSON.stringify(s);for(const guess of [1,9])assert.throws(()=>play(s,1,1,guess));assert.throws(()=>play(s,1,0,2));assert.equal(JSON.stringify(s),before);
 const a=play(s,1,1,2);assert.equal(a.alive[1],false);assert.equal(a.discards[1][0].rank,2);
 const b=play(s,1,1,8);assert.equal(b.alive[1],true);assert.deepEqual(b.memories[2][1].excluded,[8]);
});
test('protection, no-target play and forced-self Prince',()=>{
 const s=fixture([[1,5],[2]],{protected:[false,true]});assert.deepEqual(legalActions(s),[{type:'play',cardRank:1},{type:'play',cardRank:5,target:0}]);assert.equal(play(s,1).alive[1],true);
 assert.throws(()=>play(s,5,1));const p=play(s,5,0);assert.equal(p.hands[0].length,1);assert.equal(p.discards[0][1].kind,'prince');
});
test('canonical equal-copy play and mandatory versus voluntary Countess',()=>{
 assert.equal(legalActions(fixture([[4,4],[2]])).length,1);
 for(const r of [5,6]){const s=fixture([[7,r],[2]]);assert.deepEqual(legalActions(s),[{type:'play',cardRank:7}]);assert.throws(()=>play(s,r,1));}
 assert.equal(play(fixture([[7,2],[4]]),7).hands[0][0],2);
});
test('Baron compares retained card: lower, higher, equal; eliminated effects do not fire',()=>{
 for(const [mine,other,loser] of [[1,8,0],[8,1,1],[4,4,null]]){
  const s=play(fixture([[3,mine],[other]]),3,1);if(loser!==null){assert.equal(s.alive[loser],false);assert.equal(s.discards[loser].at(-1).rank,loser===0?mine:other);}else assert.deepEqual(s.alive,[true,true]);
 }
 const s=play(fixture([[3,8],[5],[2]]),3,1);assert.equal(s.hands[1].length,0);assert.equal(s.discards[1].at(-1).kind,'eliminated');
});
test('Priest privacy; remembered card persists across unlike discard, weakens on matching discard',()=>{
 const s=play(fixture([[2,4],[5],[1]]),2,1);
 assert.equal(publicObservation(s,0).memories[1].known,5);assert.equal(publicObservation(s,2).memories[1].known,null);
 const a=structuredClone(s);domainPlay(a,1,1);assert.equal(a.memories[0][1].known,5);domainPlay(a,1,5);assert.equal(a.memories[0][1].known,null);
});
test('Guard failures are retained-slot constraints, not permanent bans',()=>{
 const s=play(fixture([[1,4],[2],[3]]),1,1,8);domainPlay(s,1,8);assert.deepEqual(s.memories[0][1].excluded,[8]);domainPlay(s,1,2);assert.deepEqual(s.memories[0][1].excluded,[]);
});
test('King transfers observers’ knowledge and participant private knowledge',()=>{
 const s=fixture([[6,2],[5],[1]]);remember(s,2,1,5,'Priest');const a=play(s,6,1);
 assert.deepEqual(a.hands,[[5],[2],[1]]);assert.equal(a.memories[2][0].known,5);assert.equal(a.memories[2][1].known,null);assert.equal(a.memories[0][1].known,2);assert.equal(a.memories[1][0].known,5);
});
test('Handmaid expires at next draw, not while waiting or during other turns',()=>{
 let s=play(fixture([[4,2],[1],[3]]),4);assert.equal(s.protected[0],true);s.current=0;s.phase='awaitDraw';s=applyAction(s,{type:'draw'});assert.equal(s.protected[0],false);assert.equal(s.hands[0].length,2);
});
test('Prince discards Princess without replacement and uses reserve on last draw',()=>{
 let s=fixture([[5,2],[8],[1]]);const count=s.drawCount;s=play(s,5,1);assert.equal(s.alive[1],false);assert.equal(s.drawCount,count);
 s=fixture([[5,2],[4]],{deck:[]});const reserve=s.reserve;s=play(s,5,1);assert.equal(s.hands[1][0],reserve);assert.equal(s.reserveCount,0);assert.equal(s.phase,'roundEnd');
});
test('voluntary Princess is legal and immediately loses the round',()=>{const s=play(fixture([[8,2],[4]]),8);assert.deepEqual(s.roundWinners,[1]);assert.deepEqual(s.affection,[0,1]);});
test('showdown rank then discarded totals; complete ties award all and priority chooses starter',()=>{
 const s=newGame({mode:'digital',priority:[1,0]});
 s.phase='choosePlay';s.current=0;s.hands=[[1,4],[4]];s.deck=[];s.drawCount=0;s.reserve=8;s.exclusions=[1,1,2];
 // Sixteen-card conserving piles: 7+6+3+played1 = 5+5+3+2+1+1 = 17.
 s.discards=[[7,6,3],[5,5,3,2,1,1]].map(pile=>pile.map(rank=>({rank,kind:'played',turn:0})));
 s.affection=[6,6];assertValid(s);const won=play(s,1,1,2);assert.deepEqual(won.roundWinners,[0,1]);assert.deepEqual(won.affection,[7,7]);assert.deepEqual(outcome(won),[.5,.5]);
 s.affection=[0,0];const tied=play(s,1,1,2),next=applyAction(tied,{type:'nextRound'});assert.equal(next.current,1,'Date/age priority chooses among tied winners');assert.deepEqual(next.affection,[1,1]);
 const t=fixture([[1,4],[4]],{deck:[]});t.hands[0].shift();t.discards[0].push({rank:1,kind:'played',turn:0});t.phase='awaitDraw';finishTurn(t);assert.deepEqual(t.roundWinners,[1]);
 const u=fixture([[1,8],[4]],{deck:[]});const result=play(u,1,1,2);assert.deepEqual(result.roundWinners,[0]);
});
test('round reset retains affection and follows winner priority',()=>{
 const s=play(fixture([[8,2],[4]]),8);const a=applyAction(s,{type:'nextRound'});assert.equal(a.current,1);assert.equal(a.round,2);assert.deepEqual(a.affection,[0,1]);assert.deepEqual(a.discards,[[],[]]);assert.equal(a.events.length,0);
});
test('hidden truth and deck are never read by projection; seeded advice is invariant',()=>{
 const a=fixture([[1,4],[2],[3]]),b=structuredClone(a);[b.hands[1][0],b.hands[2][0]]=[b.hands[2][0],b.hands[1][0]];
 Object.defineProperty(a,'deck',{get(){throw Error('Hidden deck accessed');}});Object.defineProperty(a,'reserve',{get(){throw Error('Hidden reserve accessed');}});Object.defineProperty(a,'seed',{get(){throw Error('Hidden RNG accessed');}});
 Object.defineProperty(a.hands,1,{get(){throw Error('Hidden opponent accessed');}});
 const oa=publicObservation(a,0),ob=publicObservation(b,0);assert.deepEqual(oa,ob);assert.equal('deck' in oa,false);assert.equal('seed' in oa,false);
 const sa=createSearch(oa,{seed:42}),sb=createSearch(ob,{seed:42});runSearch(sa,40);runSearch(sb,40);assert.deepEqual(summary(sa),summary(sb));
});
test('copy-weighted worlds and opponent policies do not inherit root-private memory',()=>{
 const s=fixture([[1,4],[2],[3]]);remember(s,0,1,2,'Priest');const o=publicObservation(s,0),worlds=allocations(o),w=sampleWorld(o,worlds,random(3));assert.equal(w.hands[1][0],2);assert.equal(w.memories[1][2].known,null);assert.equal(w.memories[1][0].known,null);assertValid(w);
 const weights=allocations(publicObservation(fixture([[4,6],[2],[3]]),0));assert.ok(weights.some(w=>w.weight>1));
});
test('last-turn search enumerates exact weighted round results',()=>{
 const s=fixture([[1,8],[4]],{deck:[]}),search=createSearch(publicObservation(s,0));runSearch(search,search.candidates.length);assert.equal(search.method,'exact last-turn worlds');const princess=summary(search).candidates.find(c=>c.action.cardRank===8);assert.equal(princess.utility,0);assert.equal(summary(search).candidates.find(c=>c.action.cardRank===1&&c.action.guess===4).utility,1);
});
test('physical setup, public recording from unknown hand, cancellation and atomic evidence',()=>{
 let s=newGame({players:3});assert.ok(s.deck.every(r=>r===null));s=recordObservation(s,{type:'setup'});s=recordPhysicalAction(s,{type:'draw'});assert.match(analysisBlocker(s),/two cards/);
 const before=structuredClone(s);s=recordPhysicalAction(s,{type:'play',cardRank:1,target:1,guess:8});assert.equal(s.phase,'resolve');assert.deepEqual(recordPhysicalAction(s,{type:'cancel'}),before);
 const pending=JSON.stringify(s);assert.throws(()=>recordObservation(s,{type:'effect'}));assert.equal(JSON.stringify(s),pending);
 s=recordObservation(s,{type:'effect',hit:false});assert.equal(s.discards[0][0].rank,1);assert.deepEqual(s.hands[1],[null]);assert.equal(s.current,1);
});
test('physical Priest records private actual knowledge only for actor; outsider Baron needs no secret ranks',()=>{
 let s=recordObservation(newGame({players:3}),{type:'setup'});s=recordPhysicalAction(s,{type:'draw'});s=recordPhysicalAction(s,{type:'play',cardRank:2,target:1});s=recordObservation(s,{type:'effect',seen:5});assert.equal(publicObservation(s,0).memories[1].known,5);assert.equal(publicObservation(s,2).memories[1].known,null);
 s=recordPhysicalAction(s,{type:'draw'});s=recordPhysicalAction(s,{type:'play',cardRank:3,target:2});s=recordObservation(s,{type:'effect',comparison:1,loserRank:1});assert.equal(s.alive[2],false);assert.deepEqual(s.hands[1],[null]);
});
test('physical correction, King exchange and Prince replacement preserve unknown slots',()=>{
 let s=recordObservation(newGame({players:3}),{type:'setup'});s=recordObservation(s,{type:'hand',player:0,ranks:[2]});s=recordPhysicalAction(s,{type:'draw'});s=recordObservation(s,{type:'hand',player:0,ranks:[2,6]});s=recordPhysicalAction(s,{type:'play',cardRank:6,target:1});s=recordObservation(s,{type:'effect',received:5,given:2});assert.deepEqual(s.hands,[[5],[2],[null]]);assert.equal(publicObservation(s,2).memories[0].known,null);
 s=recordObservation(s,{type:'hand',player:0,ranks:[4]});assert.equal(s.memories[1][0].known,null);assert.equal(s.events.at(-1).type,'correction');
});
test('physical Princess exposes the other card; contradictory actual evidence leaves pending unchanged',()=>{
 let s=recordObservation(newGame({players:3}),{type:'setup'});s=recordPhysicalAction(s,{type:'draw'});s=recordPhysicalAction(s,{type:'play',cardRank:8});const before=JSON.stringify(s);assert.throws(()=>recordObservation(s,{type:'effect'}),/public card/);assert.equal(JSON.stringify(s),before);
 s=recordObservation(s,{type:'effect',loserRank:4});assert.equal(s.alive[0],false);assert.deepEqual(s.discards[0].map(c=>c.rank),[8,4]);assert.equal(s.current,1);
});
test('malformed imports, wrong counts, phase hands and pending actions rejected atomically',()=>{
 const s=newGame({mode:'digital'});for(const mutate of [a=>a.deck.push(1),a=>a.players=5,a=>a.phase='choosePlay',a=>a.affection[0]=NaN,a=>a.priority=[0,0],a=>a.reserveCount=2,a=>a.phase='gameover']){const a=structuredClone(s);mutate(a);assert.throws(()=>assertValid(a));}
 const data={format:'board-game-ai-love-letter',version:1,history:[{state:s,label:'Start'}],index:.5};assert.throws(()=>readSession(data,{format:data.format,validateState:assertValid,playerCount:s=>s.players}),/history position/);
});
test('seeded random full matches conserve sixteen cards and terminate for every player count',()=>{
 for(const players of [2,3,4])for(let seed=0;seed<20;seed++){const rng=random(seed);let s=newGame({players,mode:'digital',seed}),steps=0;while(s.phase!=='gameover'&&steps++<1000){const actions=legalActions(s);for(const action of actions)assertValid(applyAction(s,action));s=applyAction(s,actions[Math.floor(rng()*actions.length)]);}assert.equal(s.phase,'gameover');assert.ok(steps<1000);assert.equal(outcome(s).reduce((a,b)=>a+b),1);}
});


test('practical advice budgets keep two-player sampling and cover all roots at every effort',()=>{
 assert.equal(analysisBudget(2,12),512);
 for(const players of [3,4])assert.equal(analysisBudget(players,25),64);
 assert.equal(analysisBudget(4,25,'512'),512);
 assert.equal(analysisBudget(2,25,'64'),64);
 assert.equal(analysisBudget(4,80,'64'),80);
 assert.throws(()=>analysisBudget(2,12,'bogus'));
});
