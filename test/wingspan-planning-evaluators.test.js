import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame} from '../wingspan/core.js';
import {BIRDS,BONUSES} from '../wingspan/catalog.js';
import {PLANNING_EVALUATORS,planningPortfolio,planningAdjustments} from '../wingspan/planning-evaluators.js';
const entry=(id,eggs=0)=>({id,eggs,cached:[],tucked:[]});
const setup=()=>{const s=newGame({seed:7});s.players[0].hand=[];s.players[0].bonuses=[];return s;};
const rich=p=>{for(const f of Object.keys(p.food))p.food[f]=10;};
test('twelve planning methods are finite bounded pure terminalzero and private invariant',()=>{
 assert.equal(PLANNING_EVALUATORS.length,12);
 for(let seed=1;seed<=8;seed++){const s=newGame({seed}),before=JSON.stringify(s),a=planningAdjustments(s,0);assert.deepEqual(a,planningAdjustments(s,0));assert.ok(Object.values(a).every(n=>Number.isFinite(n)&&Math.abs(n)<=3));assert.equal(JSON.stringify(s),before);
 s.deck.reverse();s.bonusDeck.reverse();s.players[1].hand=[];s.players[1].bonuses=[];assert.deepEqual(a,planningAdjustments(s,0));s.phase='gameover';assert.ok(Object.values(planningAdjustments(s,0)).every(n=>n===0));}
});
test('shared two-play budget cannot play twice with only one action',()=>{
 const s=setup(),p=s.players[0];rich(p);p.hand=[0,1];s.round=4;s.remaining[0]=1;
 assert.equal(planningPortfolio(s,0).pairs.length,0);assert.equal(planningAdjustments(s,0)['two-bird-plan'],0);
 s.remaining[0]=5;assert.ok(planningPortfolio(s,0).pairs.length>0);assert.ok(planningAdjustments(s,0)['two-bird-plan']>0);
});
test('matching slots detects compatible row contention even with other rows open',()=>{
 const s=setup(),p=s.players[0];p.habitats.forest=Array.from({length:4},()=>entry(0,2));
 p.hand=BIRDS.filter(b=>b.habitats.length===1&&b.habitats[0]==='forest').slice(0,3).map(b=>b.id);
 assert.ok(planningAdjustments(s,0)['matching-slots']<0);
 const plans=planningPortfolio(s,0);assert.equal(plans.pairs.length,0);
});
test('assignment correction detects competing food and actions',()=>{
 const s=setup(),p=s.players[0];rich(p);p.hand=[0,1];s.round=4;s.remaining[0]=1;
 assert.ok(planningAdjustments(s,0)['assignment-hand']<0);
});
test('food demand caps surplus and opportunity recognizes a near payable card',()=>{
 const s=setup(),p=s.players[0];rich(p);assert.ok(planningAdjustments(s,0)['food-demand-cap']<0);
 p.food=Object.fromEntries(Object.keys(p.food).map(f=>[f,0]));const bird=BIRDS.find(b=>!b.either&&Object.values(b.food).reduce((a,b)=>a+b,0)===1&&b.points>0);p.hand=[bird.id];
 assert.ok(planningAdjustments(s,0)['food-opportunity']>0);
});
test('draw prior values options without hidden deck access and stranded cards retain discard use',()=>{
 const s=setup(),p=s.players[0];assert.ok(planningAdjustments(s,0)['draw-option-value']>0);
 p.habitats.forest=Array.from({length:5},()=>entry(0));p.hand=[0];const tuck=BIRDS.find(b=>b.powerType==='brown'&&b.powerCode===4);p.habitats.wetland=[entry(tuck.id)];
 assert.ok(planningAdjustments(s,0)['discard-cost']>0);
});
test('egg reserves require payments and overflow detects a saturated egg engine',()=>{
 const s=setup(),p=s.players[0];rich(p);p.habitats.forest=[entry(0,1)];p.hand=[0];assert.ok(planningAdjustments(s,0)['egg-reserve-planning']>0);
 p.habitats.forest[0].eggs=4;assert.ok(planningAdjustments(s,0)['egg-overflow']<0);
});
test('investment needs repeatable scoring and time to break even',()=>{
 const s=setup(),p=s.players[0];rich(p);p.hand=[BIRDS.find(b=>b.powerType==='brown'&&b.powerCode===31).id];assert.ok(planningAdjustments(s,0)['investment-break-even']>0);
 s.round=4;s.remaining[0]=1;assert.equal(planningAdjustments(s,0)['investment-break-even'],0);
});
test('two-step bonus recognizes threshold missed by either single play',()=>{
 const s=setup(),p=s.players[0];rich(p);const card=BONUSES.find(b=>b.key==='anatomist');p.bonuses=[card.id];
 p.hand=BIRDS.filter(b=>b.bonuses.includes('anatomist')).slice(0,2).map(b=>b.id);
 assert.ok(planningAdjustments(s,0)['bonus-two-step']>0);
 const plans=planningPortfolio(s,0);assert.ok(plans.pairs.every(q=>q.used<=plans.T&&q.p.hand.length===0));
});
test('goal transition values known next goal improvements',()=>{
 const s=setup(),p=s.players[0];rich(p);p.hand=[0];s.goals[0].face={kind:'eggs'};s.goals[1].face={kind:'totalBirds'};
 assert.ok(planningAdjustments(s,0)['goal-transition']>0);
 s.round=4;assert.equal(planningAdjustments(s,0)['goal-transition'],0);
});
test('two-for-one payment consumes shared food before a second play',()=>{
 const s=setup(),p=s.players[0];s.round=4;s.remaining[0]=2;
 const fish=BIRDS.filter(b=>!b.either&&b.food.fish===1&&Object.values(b.food).reduce((a,b)=>a+b,0)===1).slice(0,2);
 p.food=Object.fromEntries(Object.keys(p.food).map(f=>[f,0]));p.food.seed=2;p.hand=fish.map(b=>b.id);
 const portfolio=planningPortfolio(s,0);assert.ok(portfolio.singles.length>0);
 assert.ok(portfolio.singles.every(q=>Object.values(q.p.food).reduce((a,b)=>a+b,0)===0));
 assert.equal(portfolio.pairs.length,0);
});

