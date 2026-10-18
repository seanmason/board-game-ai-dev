import test from 'node:test';
import assert from 'node:assert/strict';
import {BIRDS} from '../wingspan/catalog.js';
import {EFFICIENCY_EVALUATORS,efficiencyAdjustments} from '../wingspan/efficiency-evaluators.js';
const e=(code,type='brown')=>({id:BIRDS.find(b=>b.powerCode===code&&b.powerType===type).id,eggs:0,tucked:[],cached:[]});
const p=()=>({habitats:{forest:[],grassland:[],wetland:[]},food:Object.fromEntries(['seed','fruit','invertebrate','fish','rodent'].map(f=>[f,0])),hand:[],bonuses:[],pinkUsed:[],goalPoints:[]});
const s=()=>({phase:'play',round:1,remaining:[8,8],players:[p(),p()],eggSupply:75,feeder:['seed','fruit','fish','rodent','dual']});
const value=(x,k)=>efficiencyAdjustments(x,0)[k];
test('twelve deterministic bounded corrections, no state mutation, zero terminal/actionless',()=>{
 const x=s();x.players[0].habitats.forest=[e(31)];const before=JSON.stringify(x),a=efficiencyAdjustments(x,0);assert.equal(EFFICIENCY_EVALUATORS.length,12);assert.equal(JSON.stringify(x),before);assert.deepEqual(a,efficiencyAdjustments(x,0));assert.ok(Object.values(a).every(v=>Number.isFinite(v)&&Math.abs(v)<=7));x.phase='gameover';assert.ok(Object.values(efficiencyAdjustments(x,0)).every(v=>v===0));x.phase='play';x.round=4;x.remaining=[0,0];assert.ok(Object.values(efficiencyAdjustments(x,0)).every(v=>v===0));
});
test('net engine subtracts egg costs and distinguishes supply caching',()=>{
 const x=s();x.players[0].habitats.forest=[e(41)];const costly=value(x,'engine-net-income');x.players[0].habitats.forest=[e(31)];assert.ok(value(x,'engine-net-income')>costly);
});
test('saturation discounts food surplus and full egg capacity',()=>{
 const x=s();x.players[0].habitats.forest=[e(66)];x.players[0].food.seed=20;const surplus=value(x,'engine-saturation');x.players[0].food.seed=0;x.players[0].hand=BIRDS.filter(b=>b.food.seed>=2).slice(0,3).map(b=>b.id);assert.ok(value(x,'engine-saturation')>surplus);
 x.players[0].habitats.forest=[e(30)];x.eggSupply=0;assert.ok(value(x,'engine-saturation')<0);
});
test('shared food and shared eggs subtract public opponent benefit',()=>{
 const x=s();x.players[0].habitats.forest=[e(16)];assert.ok(value(x,'shared-power-net')<0);
 x.players[0].habitats.forest=[e(61)];const empty=value(x,'shared-power-net');const b=BIRDS.find(b=>b.nest==='cavity');x.players[1].habitats.forest=[{id:b.id,eggs:0,tucked:[],cached:[]}];assert.ok(value(x,'shared-power-net')<empty);
});
test('pink models public event chance, capacity, and used interval',()=>{
 const x=s();const pink=e(18,'pink');x.players[0].habitats.forest=[pink];const b=BIRDS.find(b=>b.nest==='cavity'&&b.id!==pink.id);x.players[0].habitats.forest.push({id:b.id,eggs:0,cached:[],tucked:[]});const open=value(x,'pink-event-model');assert.ok(open>0);x.players[0].pinkUsed=[pink.id];assert.ok(value(x,'pink-event-model')<open);x.eggSupply=0;assert.equal(value(x,'pink-event-model'),0);
});
test('dice predator uses outside dice count and card predator exact catalog prior',()=>{
 const x=s();x.players[0].habitats.forest=[e(7)];const full=value(x,'predator-expectation');x.feeder=[];assert.ok(value(x,'predator-expectation')>full);
 for(const [code,threshold] of [[17,75],[42,100],[46,50]]){x.players[0].habitats.forest=[e(code)];const prior=BIRDS.filter(b=>b.wingspan<threshold).length/BIRDS.length;assert.ok(Math.abs(value(x,'predator-expectation')-(prior-.5)*5)<1e-10);}
});
test('repeater discounts unavailable paid resources and respects predator eligibility',()=>{
 const x=s();x.players[0].habitats.forest=[e(43),e(23)];const unavailable=value(x,'repeat-resource-cost');x.players[0].food.seed=2;assert.ok(value(x,'repeat-resource-cost')>unavailable);x.players[0].habitats.forest=[e(49),e(31)];assert.ok(value(x,'repeat-resource-cost')<0);
});
test('tucking preserves sole valuable playable hand card, junk alternative removes penalty',()=>{
 const x=s();x.players[0].habitats.forest=[e(35)];const b=BIRDS.find(b=>b.points>=8&&b.habitats.includes('wetland'));x.players[0].hand=[b.id];for(const f of Object.keys(x.players[0].food))x.players[0].food[f]=5;const precious=value(x,'tuck-card-opportunity');assert.ok(precious<0);x.players[0].hand.push(BIRDS.find(b=>b.points===0).id);assert.ok(value(x,'tuck-card-opportunity')>precious);
});
test('feeder access distinguishes absent matching type from public available die',()=>{
 const x=s();x.players[0].habitats.forest=[e(1)];x.feeder=['fish'];const blocked=value(x,'feeder-access');x.feeder=['seed'];assert.ok(value(x,'feeder-access')>blocked);
});
test('late conversion requires payable food and eggs; phase switch changes horizon',()=>{
 const x=s();const b=BIRDS.find(b=>b.points>=8&&b.habitats.includes('wetland'));x.players[0].hand=[b.id];x.round=4;x.remaining=[2,2];const poor=value(x,'late-conversion');for(const f of Object.keys(x.players[0].food))x.players[0].food[f]=5;assert.ok(value(x,'late-conversion')>poor);
 x.players[0].habitats.forest=[e(31)];const late=value(x,'phase-switch');x.round=1;x.remaining=[8,8];assert.notEqual(value(x,'phase-switch'),late);
});
test('robust value uses conservative scenario; scarcity portfolio responds to excess',()=>{
 const x=s();x.players[0].habitats.forest=[e(66)];const a=value(x,'scarcity-portfolio');x.players[0].food.seed=30;assert.ok(value(x,'scarcity-portfolio')<=a);assert.ok(Number.isFinite(value(x,'robust-value')));
});
test('private opponent cards, hidden decks and tucked identity unavailable',()=>{
 const x=s();x.players[0].habitats.forest=[e(17)];const expected=efficiencyAdjustments(x,0);
 for(const k of ['deck','bonusDeck','rngState'])Object.defineProperty(x,k,{get(){throw Error('hidden state read');}});
 for(const k of ['hand','bonuses','bonusOffer'])Object.defineProperty(x.players[1],k,{get(){throw Error('private opponent read');}});
 Object.defineProperty(x.players[0].habitats.forest[0],'tucked',{get(){throw Error('tucked identity read');}});assert.deepEqual(efficiencyAdjustments(x,0),expected);
});

test('repeat cannot count a single seed for both original paid tuck and repetition',()=>{
 const x=s();x.players[0].habitats.forest=[e(23),e(43)];x.players[0].food.seed=1;const once=value(x,'repeat-resource-cost');x.players[0].food.seed=2;assert.ok(value(x,'repeat-resource-cost')>once);
});
test('pink forecasts cannot fill the same single egg slot repeatedly',()=>{
 const x=s(),pink=e(18,'pink');const b=BIRDS.find(b=>b.nest==='cavity'&&b.id!==pink.id);x.players[0].habitats.forest=[pink,{id:b.id,eggs:b.eggs-1,cached:[],tucked:[]}];assert.ok(value(x,'pink-event-model')<=1);
});
test('retained lone card incurs opportunity cost even for tuck-and-draw',()=>{
 const x=s();x.players[0].habitats.forest=[e(4)];const b=BIRDS.find(b=>b.points>=8&&b.habitats.includes('wetland'));x.players[0].hand=[b.id];for(const f of Object.keys(x.players[0].food))x.players[0].food[f]=5;assert.ok(value(x,'tuck-card-opportunity')<0);
});
test('draw two discard one reserves a card instead of funding two free tucks',()=>{
 const x=s();x.players[0].habitats.forest=[e(35),e(32),e(34)];const b=BIRDS.find(b=>b.points>=8&&b.habitats.includes('wetland'));x.players[0].hand=[b.id];for(const f of Object.keys(x.players[0].food))x.players[0].food[f]=5;const reserved=value(x,'tuck-card-opportunity');assert.ok(reserved<0);x.players[0].habitats.forest[2]=e(56);x.players[0].habitats.forest.push(e(59));assert.equal(value(x,'tuck-card-opportunity'),0);
});

