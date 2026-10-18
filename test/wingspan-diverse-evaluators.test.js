import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame} from '../wingspan/core.js';
import {BIRDS,BONUSES} from '../wingspan/catalog.js';
import {scorePlayer} from '../wingspan/scoring.js';
import {DIVERSE_EVALUATORS,evaluateLeaf,diverseAdjustments,typedFoodDeficit} from '../wingspan/leaf-evaluators.js';
const entry=(id,eggs=0)=>({id,eggs,cached:[],tucked:[]});
const fixture=()=>{const s=newGame({seed:21});s.players[0].hand=[];s.players[0].bonuses=[];return s;};
test('twelve diverse methods pure deterministic finite terminal exact and baseline retained',()=>{
 assert.equal(DIVERSE_EVALUATORS.length,12);
 for(let seed=1;seed<=10;seed++){
  const s=newGame({seed}),before=JSON.stringify(s);
  for(const m of DIVERSE_EVALUATORS){const v=evaluateLeaf(s,0,m);assert.ok(Number.isFinite(v),m);assert.equal(v,evaluateLeaf(s,0,m));}
  assert.equal(JSON.stringify(s),before);s.phase='gameover';
  for(const m of DIVERSE_EVALUATORS)assert.equal(evaluateLeaf(s,0,m),scorePlayer(s.players[0]).total);
 }
 [1,4,11].forEach((seed,i)=>assert.equal(evaluateLeaf(newGame({seed}),0),[15.715666666666667,11.795666666666667,15.435666666666666][i]));
});
test('bonus threshold and current race respond to one egg action',()=>{
 const s=fixture(),p=s.players[0];p.bonuses=[BONUSES.find(b=>b.key==='breeding_manager').id];
 const b=BIRDS.find(b=>b.eggs>=4);p.habitats.grassland=[entry(b.id,3)];
 assert.ok(diverseAdjustments(s,0)['bonus-threshold']>0);
 s.goals[0].face={kind:'eggs',habitat:'grassland'};s.remaining[0]=1;s.goalMode='blue';
 assert.ok(diverseAdjustments(s,0)['round-race']>0);
 p.goalPoints=[1];assert.equal(diverseAdjustments(s,0)['round-race'],0);
});
test('future goals credit public structure and blue quantity caps',()=>{
 const s=fixture();s.goals[1].face={kind:'totalBirds'};s.goalMode='blue';
 const before=diverseAdjustments(s,0)['future-goals'];s.players[0].habitats.forest=[entry(0)];
 assert.ok(diverseAdjustments(s,0)['future-goals']>before);
});
test('egg liquidity and new capacity have distinct positive investment signals',()=>{
 const s=fixture(),p=s.players[0];p.habitats.forest=[entry(0,1)];p.hand=[0];
 assert.ok(diverseAdjustments(s,0)['egg-liquidity']>0);
 assert.ok(diverseAdjustments(s,0)['capacity-investment']>0);
});
test('typed food handles matching wild either and two-for-one replacement',()=>{
 const p={food:{seed:1,fish:0,fruit:0,rodent:0,invertebrate:0}};
 const bird={either:false,food:{seed:0,fish:1,fruit:0,rodent:0,invertebrate:0,wild:0}};
 assert.equal(typedFoodDeficit(p,bird),1);p.food.seed=2;assert.equal(typedFoodDeficit(p,bird),0);
 bird.food.fish=0;bird.food.wild=1;p.food.seed=1;assert.equal(typedFoodDeficit(p,bird),0);
 bird.either=true;bird.food.wild=0;bird.food.fish=1;assert.equal(typedFoodDeficit(p,bird),1);
});
test('hand quality typed access and unlocks inspect actual hand cards',()=>{
 const s=fixture(),p=s.players[0];const empty=diverseAdjustments(s,0);p.hand=[0];
 assert.notEqual(diverseAdjustments(s,0)['hand-quality'],empty['hand-quality']);
 assert.notEqual(diverseAdjustments(s,0)['typed-food'],empty['typed-food']);
 p.habitats.forest=[entry(0)];assert.ok(diverseAdjustments(s,0)['row-unlocks']>0);
});
test('power synergy recognizes same-row draw and tuck chain',()=>{
 const s=fixture(),p=s.players[0];const draw=BIRDS.find(b=>b.powerCode===56&&b.powerType==='brown');const tuck=BIRDS.find(b=>b.powerCode===4);
 p.habitats.wetland=[entry(draw.id),entry(tuck.id)];assert.ok(diverseAdjustments(s,0)['power-synergy']>0);
 p.habitats.forest=[p.habitats.wetland.pop()];assert.equal(diverseAdjustments(s,0)['power-synergy'],0);
});
test('cashout activates late and opponent tempo ignores private hands and bonuses',()=>{
 const s=fixture();s.players[0].habitats.grassland=[entry(0)];
 assert.equal(diverseAdjustments(s,0)['endgame-cashout'],0);s.round=4;s.remaining[0]=2;
 assert.notEqual(diverseAdjustments(s,0)['endgame-cashout'],0);
 s.players[1].habitats.forest=[entry(0),entry(0)];const before=diverseAdjustments(s,0)['opponent-tempo'];
 s.players[1].hand=Array(30).fill(0);s.players[1].bonuses=[0,1,2];
 assert.equal(diverseAdjustments(s,0)['opponent-tempo'],before);
 assert.ok(Math.abs(diverseAdjustments(s,0)['strategic-blend'])<=6);
});
test('egg projection spreads nests and play payment removes egg-goal credit',()=>{
 const s=fixture(),p=s.players[0];s.goalMode='blue';s.remaining[0]=1;
 p.habitats.forest=[entry(0),entry(0)];
 s.goals[0].face={kind:'birds',withEgg:true};
 assert.ok(diverseAdjustments(s,0)['round-race']>0);
 s.remaining[0]=0;assert.equal(diverseAdjustments(s,0)['round-race'],0);
 // No free egg action with full capacity; a one-action play spends its egg.
 s.remaining[0]=1;p.habitats.forest=[entry(0,4)];p.habitats.grassland=[entry(0,4)];
 p.hand=[0];s.goals[0].face={kind:'eggs'};
 for(const f of Object.keys(p.food))p.food[f]=5;
 assert.equal(diverseAdjustments(s,0)['round-race'],0);
});
test('repeat synergy needs a productive eligible target in the same habitat',()=>{
 const s=fixture(),p=s.players[0];
 const repeat=BIRDS.find(b=>b.powerCode===43),cache=BIRDS.find(b=>b.powerCode===31);
 p.habitats.forest=[entry(repeat.id)];assert.equal(diverseAdjustments(s,0)['power-synergy'],0);
 p.habitats.forest.push(entry(cache.id));assert.ok(diverseAdjustments(s,0)['power-synergy']>0);
 p.habitats.wetland=[p.habitats.forest.pop()];assert.equal(diverseAdjustments(s,0)['power-synergy'],0);
 const predatorRepeat=BIRDS.find(b=>b.powerCode===49),predator=BIRDS.find(b=>b.powerCode===42);
 p.habitats.forest=[entry(predatorRepeat.id),entry(cache.id)];assert.equal(diverseAdjustments(s,0)['power-synergy'],0);
 p.habitats.forest.push(entry(predator.id));assert.ok(diverseAdjustments(s,0)['power-synergy']>0);
});

test('exhausted shared egg supply blocks goal egg gains and missing play payments',()=>{
 const s=fixture(),p=s.players[0];s.goalMode='blue';s.goals[0].face={kind:'eggs'};p.habitats.forest=[entry(0)];s.eggSupply=0;
 assert.equal(diverseAdjustments(s,0)['round-race'],0);
 p.hand=[0];assert.ok(diverseAdjustments(s,0)['hand-quality']<=0);assert.equal(diverseAdjustments(s,0)['capacity-investment'],0);
});

