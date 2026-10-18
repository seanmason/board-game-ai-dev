import test from 'node:test';
import assert from 'node:assert/strict';
import {COLORS,CARDS,ALL_IDS,cardType} from '../lost-cities/catalog.js';
import {newGame,applyAction,legalActions,assertValid,random,score,outcome} from '../lost-cities/core.js';
import {canPlay} from '../lost-cities/actions.js';
import {expeditionScore} from '../lost-cities/scoring.js';
import {publicObservation,publicSnapshot,recordPhysicalAction,recordObservation} from '../lost-cities/observations.js';
import {sampleWorld} from '../lost-cities/belief.js';
import {createSearch,runSearch,summary,evaluate} from '../lost-cities/ai.js';
import {readSession} from '../shared/session.js';
const columns=()=>Object.fromEntries(COLORS.map(c=>[c,[]]));
function fixture({hand=['red-7'],expeditions=[columns(),columns()],discards=columns(),deckCount=44,phase='place',current=0}={}){
 const s=newGame({mode:'digital'}),used=new Set([...expeditions.flatMap(p=>COLORS.flatMap(c=>p[c])),...COLORS.flatMap(c=>discards[c]),...hand]);let pool=ALL_IDS.filter(id=>!used.has(id));
 s.expeditions=structuredClone(expeditions);s.discards=structuredClone(discards);s.hands=[[],[]];s.hands[current]=hand.slice();const sizes=[8,8];if(phase==='draw')sizes[current]=7;
 for(let p=0;p<2;p++)while(s.hands[p].length<sizes[p])s.hands[p].push(pool.shift());
 s.deck=pool;s.deckCount=pool.length;s.deckKnowledge={kind:'history',lower:pool.length,upper:pool.length};s.phase=phase;s.current=current;
 s.visibleTops=Object.fromEntries(COLORS.map(c=>[c,discards[c].at(-1)??null]));s.discardSizes=Object.fromEntries(COLORS.map(c=>[c,discards[c].length]));s.memories=s.memories.map(m=>({...m,discards:structuredClone(discards)}));assertValid(s);return s;
}
const idColor=(c,values)=>values.map(v=>`${c}-${v==='W0'||v==='W1'||v==='W2'?v:v}`);
function nearEnd(s){while(s.deck.length>1){const id=s.deck.pop();s.discards[CARDS[id].color].push(id);}s.deckCount=1;s.deckKnowledge={kind:'history',lower:1,upper:1};for(const c of COLORS){s.visibleTops[c]=s.discards[c].at(-1)??null;s.discardSizes[c]=s.discards[c].length;for(const m of s.memories)m.discards[c]=s.discards[c].slice();}assertValid(s);return s;}
test('exact60 original cards, three wagers/color, unique2–10 and seeded8/8/44 setup',()=>{
 assert.equal(ALL_IDS.length,60);for(const c of COLORS){assert.equal(ALL_IDS.filter(id=>CARDS[id].color===c).length,12);assert.equal(ALL_IDS.filter(id=>CARDS[id].color===c&&!CARDS[id].value).length,3);assert.deepEqual(ALL_IDS.filter(id=>CARDS[id].color===c&&CARDS[id].value).map(id=>CARDS[id].value),[2,3,4,5,6,7,8,9,10]);}
 const a=newGame({mode:'digital',seed:42,starter:1});assert.deepEqual(a,newGame({mode:'digital',seed:42,starter:1}));assert.equal(a.deckCount,44);assert.deepEqual(a.hands.map(h=>h.length),[8,8]);assert.equal(a.current,1);assert.throws(()=>newGame({players:3}));assert.throws(()=>newGame({edition:'six-expeditions'}));
});
test('independent printed score fixtures keep8-card bonus outside multiplier',()=>{
 for(const [cards,want] of [[[],0],[['W0'],-40],[['W0','W1'],-60],[[2,3,4],-11],[['W0',2,3,4],-22],[[2,3,4,5,6,7,8,9],44],[['W0',2,3,4,5,6,7,8],50],[['W0','W1',4,5,6,7,8,10],80]])assert.equal(expeditionScore(idColor('red',cards)).total,want);
 assert.equal([3,0,-40,-10,65].reduce((a,b)=>a+b),18);
});
test('independent subset scoring oracle for all five expeditions',()=>{
 for(const color of COLORS)for(let mask=0;mask<512;mask++)for(let wagers=0;wagers<4;wagers++){
  const values=Array.from({length:9},(_,i)=>i+2).filter((_,i)=>mask&(1<<i)),cards=[...Array.from({length:wagers},(_,i)=>`${color}-W${i}`),...values.map(v=>`${color}-${v}`)];let want=0;if(cards.length){want=(values.reduce((n,v)=>n+v,0)-20)*(wagers+1);if(cards.length>=8)want+=20;}assert.equal(expeditionScore(cards).total,want);
 }
});
test('strict ascending suffix, wager prefix and complete poor discards',()=>{
 assert.equal(canPlay(['red-8'],'red-7'),false);assert.equal(canPlay(['red-8'],'red-9'),true);assert.equal(canPlay(['red-8'],'red-W0'),false);assert.equal(canPlay(['red-W0','red-W1'],'red-W2'),true);
 const exp=[columns(),columns()];exp[0].red=['red-8'];const s=fixture({hand:['red-7','red-9','red-W0'],expeditions:exp});const actions=legalActions(s);assert.ok(actions.some(a=>a.type==='discard'&&a.cardId==='red-7'));assert.equal(actions.some(a=>a.type==='play'&&a.cardId==='red-7'),false);assert.ok(actions.some(a=>a.type==='play'&&a.cardId==='red-9'));const before=JSON.stringify(s);assert.throws(()=>applyAction(s,{type:'play',cardId:'red-7'}));assert.equal(JSON.stringify(s),before);
});
test('same-turn takeback is forbidden, other discard top legal and buried card unavailable',()=>{
 const d=columns();d.red=['red-3'];d.blue=['blue-5'];let s=fixture({hand:['red-7'],discards:d});s=applyAction(s,{type:'discard',cardId:'red-7'});assert.equal(s.hands[0].length,7);assert.deepEqual(legalActions(s).map(a=>a.source),['deck','blue']);assert.throws(()=>applyAction(s,{type:'draw',source:'red'}));s=applyAction(s,{type:'draw',source:'blue'});assert.equal(s.hands[0].length,8);assert.deepEqual(s.discards.red,['red-3','red-7']);assert.equal(s.deckCount,42);assert.equal(s.current,1);
});
test('duplicate wagers have canonical choices, all represented copies remain conserved',()=>{const s=fixture({hand:['red-W0','red-W1','red-W2']});assert.equal(legalActions(s).filter(a=>cardType(a.cardId)==='red-W').length,2);assertValid(applyAction(s,legalActions(s).find(a=>a.type==='play'&&a.cardId==='red-W0')));});
test('public pickup remains known through hidden draws until the matching card is played',()=>{
 const d=columns();d.blue=['blue-9'];let s=fixture({hand:['red-7'],discards:d});s=applyAction(s,{type:'discard',cardId:'red-7'});s=applyAction(s,{type:'draw',source:'blue'});assert.deepEqual(publicObservation(s,1).memory.knownHands[0],['blue-9']);
 const a=legalActions(s).find(a=>a.type==='discard');s=applyAction(s,a);s=applyAction(s,{type:'draw',source:'deck'});assert.deepEqual(publicObservation(s,1).memory.knownHands[0],['blue-9']);s=applyAction(s,{type:'play',cardId:'blue-9'});assert.deepEqual(publicObservation(s,1).memory.knownHands[0],[]);
});
test('projection avoids opponent, deck and actual buried-discard getters',()=>{
 let s=newGame({mode:'digital'});const expected=publicObservation(s,0);Object.defineProperty(s,'deck',{get(){throw Error('Hidden deck');}});Object.defineProperty(s,'seed',{get(){throw Error('Hidden seed');}});Object.defineProperty(s,'discards',{get(){throw Error('Hidden buried stack');}});Object.defineProperty(s.hands,1,{get(){throw Error('Hidden opponent');}});assert.deepEqual(publicObservation(s,0),expected);assert.equal('ownHand' in publicSnapshot(s),false);
});
test('paired hidden deck/opponent/buried truths produce identical observations/advice',()=>{
 const d=columns();d.red=['red-3','red-7'];const a=fixture({hand:['blue-9'],discards:d}),b=structuredClone(a);for(const s of [a,b])for(const m of s.memories)m.discards.red[0]=null;
 const buried=b.discards.red[0],i=b.deck.findIndex(id=>CARDS[id].color==='red');[b.discards.red[0],b.deck[i]]=[b.deck[i],buried];[b.hands[1][0],b.deck[0]]=[b.deck[0],b.hands[1][0]];
 const oa=publicObservation(a,0),ob=publicObservation(b,0);assert.deepEqual(oa,ob);const qa=createSearch(oa,{seed:37}),qb=createSearch(ob,{seed:37});runSearch(qa,20);runSearch(qb,20);assert.deepEqual(summary(qa),summary(qb));
});
test('worlds honor public pickups and do not give opponents root-private buried memory',()=>{
 const d=columns();d.blue=['blue-9'];let s=fixture({hand:['red-7'],discards:d});s=applyAction(s,{type:'discard',cardId:'red-7'});s=applyAction(s,{type:'draw',source:'blue'});s=applyAction(s,legalActions(s)[0]);s=applyAction(s,{type:'draw',source:'deck'});const o=publicObservation(s,1),w=sampleWorld(o,random(4));assert.ok(w.hands[0].includes('blue-9'));assertValid(w);
});
test('physical pending draw is atomic, cancellable before performance and reloadable',()=>{
 let s=recordPhysicalAction(newGame(),{type:'setup'});s=recordPhysicalAction(s,{type:'discard',cardId:'red-7'});const before=structuredClone(s);s=recordPhysicalAction(s,{type:'draw',source:'deck'});assert.equal(s.phase,'pending-observation');assert.equal(s.hands[0].length,7);assertValid(JSON.parse(JSON.stringify(s)));assert.deepEqual(recordPhysicalAction(s,{type:'cancel'}),before);const unchanged=JSON.stringify(s);assert.throws(()=>recordObservation(s,{type:'draw',cardId:'red-7'}));assert.equal(JSON.stringify(s),unchanged);s=recordObservation(s,{type:'draw',cardId:null});assert.equal(s.hands[0].length,8);assert.equal(s.deckCount,43);assert.equal(s.current,1);
});
test('physical hand correction is explicit and does not expose entered cards to other viewer',()=>{
 let s=recordPhysicalAction(newGame(),{type:'setup'});const cards=['red-2','red-3','red-4','blue-2','blue-3','blue-4','green-2','green-3'];s=recordObservation(s,{type:'hand',player:0,cards});assert.equal(publicObservation(s,1).memory.knownHands[0].length,0);assert.throws(()=>recordObservation(s,{type:'hand',player:0,cards:Array(8).fill(null)}),/explicit correction/);s=recordObservation(s,{type:'hand',player:0,cards:Array(8).fill(null),correction:true});assert.equal(s.events.at(-1).type,'handCorrection');
});
test('shielded public wager declarations bind an equivalent held copy without exposing its ID',()=>{
 let s=recordPhysicalAction(newGame(),{type:'setup'});s=recordObservation(s,{type:'hand',player:0,cards:['red-W1','blue-2','blue-3','blue-4','blue-5','green-2','green-3','green-4']});s=recordPhysicalAction(s,{type:'play',cardId:'red-W0'});assert.equal(cardType(s.expeditions[0].red[0]),'red-W');assertValid(s);
});
test('midgame witnessed public pickups can be entered without inventing opponent private cards',()=>{
 let s=recordPhysicalAction(newGame(),{type:'setup'});s=recordObservation(s,{type:'hand',player:0,cards:[2,3,4,5,6,7,8,9].map(v=>'red-'+v)});s=recordObservation(s,{type:'memory',observer:0,holder:1,types:['blue-9']});assert.deepEqual(s.hands[1],Array(8).fill(null));assert.deepEqual(publicObservation(s,0).memory.knownHands[1],['blue-9']);const w=sampleWorld(publicObservation(s,0),random(6));assert.ok(w.hands[1].includes('blue-9'));assert.equal('memory' in publicSnapshot(s),false);assert.throws(()=>recordObservation(s,{type:'memory',observer:0,holder:1,types:['red-2']}));
});
test('manual next starter remains an explicit strict-booklet decision, even with a proposal',()=>{
 let s=newGame({mode:'digital',seed:12}),rng=random(7),steps=0;while(s.phase!=='choose-starter'&&steps++<2000){const a=legalActions(s);s=applyAction(s,a[Math.floor(rng()*a.length)]);}assert.equal(s.phase,'choose-starter');assert.deepEqual(legalActions(s),[{type:'chooseStarter',starter:0},{type:'chooseStarter',starter:1}]);const n=applyAction(s,{type:'chooseStarter',starter:1,basis:'agreed'});assert.equal(n.current,1);assert.equal(n.round,2);assert.equal(n.adjudications[0].basis,'agreed');assert.deepEqual(n.scores,s.scores);
});
test('last deck draw ends immediately with8 cards; discard draw leaves the clock at1',()=>{
 let s=nearEnd(newGame({mode:'digital'})),last=s.deck[0];s=applyAction(s,legalActions(s).find(a=>a.type==='discard'));const alternative=legalActions(s).find(a=>a.source!=='deck');assert.ok(alternative);const continuing=applyAction(s,alternative);assert.equal(continuing.deckCount,1);assert.equal(continuing.phase,'place');s=applyAction(s,{type:'draw',source:'deck'});assert.equal(s.phase,'choose-starter');assert.equal(s.hands[s.current].includes(last),true);assert.equal(s.hands[s.current].length,8);assert.equal(legalActions(s).some(a=>a.type==='play'),false);
});
test('three rounds with equal cumulative totals explicitly co-lead with utility shares',()=>{
 let s=newGame({mode:'digital'});for(let round=1;round<=3;round++){s=nearEnd(s);s=applyAction(s,legalActions(s).find(a=>a.type==='discard'));s=applyAction(s,{type:'draw',source:'deck'});if(round<3)s=applyAction(s,{type:'chooseStarter',starter:round%2,basis:'agreed'});}assert.equal(s.phase,'gameover');assert.deepEqual(s.scores,[0,0]);assert.deepEqual(s.winners,[0,1]);assert.deepEqual(outcome(s),[.5,.5]);
});
test('legal discard recycling never creates a fabricated terminal or forces a deck draw',()=>{
 const d=columns();d.red=['red-3'];d.blue=['blue-3'];let s=fixture({hand:['red-2'],discards:d});const index=s.hands[1].findIndex(id=>id==='blue-2');if(index<0){const where=s.deck.indexOf('blue-2');[s.hands[1][0],s.deck[where]]=[s.deck[where],s.hands[1][0]];}const initial=s.deckCount;
 const cycle=[['red-2','blue'],['blue-2','red'],['blue-3','red'],['red-2','blue'],['red-3','blue'],['blue-3','red'],['blue-2','red'],['red-3','blue']];
 for(let loop=0;loop<3;loop++)for(const [cardId,source] of cycle){s=applyAction(s,{type:'discard',cardId});s=applyAction(s,{type:'draw',source});}assert.equal(s.deckCount,initial);assert.equal(s.phase,'place');assert.equal(s.turn,24);
});
test('unknown midgame deck and buried piles remain unconstrained facts until observed',()=>{
 let s=recordPhysicalAction(newGame(),{type:'setup'});const d=Object.fromEntries(COLORS.map(c=>[c,[`${c}-2`]]));s=recordObservation(s,{type:'table',viewer:0,current:0,phase:'place',round:1,expeditions:[columns(),columns()],discards:d,depthKnown:Object.fromEntries(COLORS.map(c=>[c,false])),ownCards:[3,4,5,6,7,8,9,10].map(v=>'yellow-'+v),deckCount:null,lower:1,upper:39,previousRounds:[]});assert.equal(s.deckCount,null);assert.equal(s.unseenCount,39);const w=sampleWorld(publicObservation(s,0),random(7));assertValid(w);assert.ok(w.deckCount>=1&&w.deckCount<=39);
 s=recordPhysicalAction(s,{type:'discard',cardId:'yellow-3'});s=recordPhysicalAction(s,{type:'draw',source:'red'});const before=JSON.stringify(s);assert.throws(()=>recordObservation(s,{type:'draw'}),/newly exposed/);assert.equal(JSON.stringify(s),before);s=recordObservation(s,{type:'draw',newTop:'red-4'});assert.equal(s.visibleTops.red,'red-4');assert.equal(s.hands[0].includes('red-2'),true);assert.equal(s.deckCount,null);
});
test('malformed copies, wrong hand phase, invalid columns/history index reject',()=>{
 const s=newGame({mode:'digital'});for(const mutate of [a=>a.deck[0]=a.deck[1],a=>a.deck[0]='__proto__',a=>a.hands[0].pop(),a=>a.phase='draw',a=>a.scores[0]=999,a=>a.round=4,a=>a.proposedStarter='<invalid>']){const x=structuredClone(s);mutate(x);assert.throws(()=>assertValid(x));}
 assert.throws(()=>readSession({format:'lost',version:1,history:[{state:s,label:'Start'}],index:.5},{format:'lost',validateState:assertValid,playerCount:s=>s.players}),/history position/);
});
test('random complete rounds conserve60, end only on last deck draw and use exact public scores',()=>{
 for(let seed=1;seed<=20;seed++){const rng=random(seed);let s=newGame({mode:'digital',seed}),steps=0;while(s.phase!=='choose-starter'&&steps++<2000){const actions=legalActions(s);for(const a of actions)assertValid(applyAction(s,a));s=applyAction(s,actions[Math.floor(rng()*actions.length)]);}assert.equal(s.phase,'choose-starter');assert.equal(s.deckCount,0);assert.deepEqual(s.hands.map(h=>h.length),[8,8]);assert.deepEqual(s.scores,score(s));const before=score(s);s.hands[0].reverse();assert.deepEqual(score(s),before,'Held cards never score');}
});
