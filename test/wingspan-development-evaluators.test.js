import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame} from '../wingspan/core.js';
import {BIRDS} from '../wingspan/catalog.js';
import {DEVELOPMENT_EVALUATORS,developmentAdjustments} from '../wingspan/development-evaluators.js';
const entry=(id,eggs=0)=>({id,eggs,cached:[],tucked:[]});
const fixture=()=>{const s=newGame({seed:10});s.players[0].hand=[];s.players[0].bonuses=[];return s;};
const rich=p=>{for(const f of Object.keys(p.food))p.food[f]=8;};
test('twelve bounded deterministic pure development hypotheses and terminal zero',()=>{
 assert.equal(DEVELOPMENT_EVALUATORS.length,12);
 for(let seed=1;seed<=10;seed++){
  const s=newGame({seed}),before=JSON.stringify(s),a=developmentAdjustments(s,0);
  assert.deepEqual(a,developmentAdjustments(s,0));for(const n of Object.values(a))assert.ok(Number.isFinite(n)&&Math.abs(n)<=4);
  assert.equal(JSON.stringify(s),before);s.phase='gameover';assert.ok(Object.values(developmentAdjustments(s,0)).every(n=>n===0));
 }
});
test('forest foundation needs food demand and wetland foundation needs card demand',()=>{
 const s=fixture(),p=s.players[0];p.habitats.forest=[entry(0)];p.food=Object.fromEntries(Object.keys(p.food).map(f=>[f,0]));
 assert.equal(developmentAdjustments(s,0)['forest-foundation'],0);p.hand=[0];assert.ok(developmentAdjustments(s,0)['forest-foundation']>0);
 p.habitats.wetland=[entry(0)];assert.ok(developmentAdjustments(s,0)['wetland-foundation']>0);
 p.hand=Array(15).fill(0);assert.equal(developmentAdjustments(s,0)['wetland-foundation'],0);
});
test('grassland foundation needs room and balanced development values breadth',()=>{
 const s=fixture(),p=s.players[0];p.habitats.grassland=[entry(0)];assert.ok(developmentAdjustments(s,0)['grassland-foundation']>0);
 p.habitats.grassland[0].eggs=4;assert.equal(developmentAdjustments(s,0)['grassland-foundation'],0);
 p.habitats.grassland=[entry(0)];p.habitats.forest=[entry(0)];p.habitats.wetland=[entry(0)];
 const broad=developmentAdjustments(s,0)['balanced-development'];p.habitats.forest.push(...p.habitats.wetland);p.habitats.wetland=[];
 assert.ok(broad>developmentAdjustments(s,0)['balanced-development']);
});
test('unlock payback rewards affordable output jumps with future demand',()=>{
 const s=fixture(),p=s.players[0];rich(p);p.habitats.grassland=[entry(0,2)];
 p.hand=[BIRDS.find(b=>b.habitats.includes('grassland')).id];assert.ok(developmentAdjustments(s,0)['unlock-payback']>0);
 s.round=4;s.remaining[0]=1;assert.equal(developmentAdjustments(s,0)['unlock-payback'],0);
});
test('conversion options respect odd columns and usable payment stock',()=>{
 const s=fixture(),p=s.players[0];p.habitats.grassland=[entry(0)];rich(p);
 assert.ok(developmentAdjustments(s,0)['conversion-options']>0);p.food=Object.fromEntries(Object.keys(p.food).map(f=>[f,0]));
 assert.equal(developmentAdjustments(s,0)['conversion-options'],0);
});
test('cheap bird tempo disappears when no future actions remain',()=>{
 const s=fixture(),p=s.players[0];rich(p);p.hand=[0];assert.ok(developmentAdjustments(s,0)['cheap-bird-tempo']>0);
 s.round=4;s.remaining[0]=1;assert.equal(developmentAdjustments(s,0)['cheap-bird-tempo'],0);
});
test('white egg powers respect shared supply and bonus options use visible board prior',()=>{
 const s=fixture(),p=s.players[0];rich(p);
 p.hand=[BIRDS.find(b=>b.powerType==='white'&&b.powerCode===12).id];
 assert.ok(developmentAdjustments(s,0)['white-power-payback']>0);s.eggSupply=0;assert.equal(developmentAdjustments(s,0)['white-power-payback'],0);
 s.eggSupply=75;p.habitats.forest=[entry(0,1),entry(0,1),entry(0,1)];p.hand=[BIRDS.find(b=>b.powerType==='white'&&b.powerCode===13).id];
 assert.ok(developmentAdjustments(s,0)['bonus-card-option']>0);p.hand=[];assert.equal(developmentAdjustments(s,0)['bonus-card-option'],0);
});
test('tray opportunity considers visible cards and hand flexibility rewards alternatives',()=>{
 const s=fixture(),p=s.players[0];rich(p);s.tray=[0];assert.ok(developmentAdjustments(s,0)['tray-opportunity']>0);
 p.hand=[0];assert.equal(developmentAdjustments(s,0)['tray-opportunity'],0);
 p.hand=[BIRDS.find(b=>b.habitats.length===3).id];assert.ok(developmentAdjustments(s,0)['hand-flexibility']>0);
});
test('slot scarcity penalizes cards stranded by full compatible rows',()=>{
 const s=fixture(),p=s.players[0];p.hand=[0];assert.ok(developmentAdjustments(s,0)['slot-scarcity']<=0);
 p.habitats.forest=Array.from({length:5},()=>entry(0));assert.ok(developmentAdjustments(s,0)['slot-scarcity']<-.5);
});
test('hidden decks and rival private cards never affect adjustments',()=>{
 const s=fixture(),p=s.players[0];rich(p);p.hand=[BIRDS.find(b=>b.powerCode===13).id];const a=developmentAdjustments(s,0);
 s.deck.reverse();s.bonusDeck.reverse();s.players[1].hand=Array(30).fill(0);s.players[1].bonuses=[0,1,2];
 assert.deepEqual(developmentAdjustments(s,0),a);
});

