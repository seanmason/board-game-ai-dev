import test from 'node:test';
import assert from 'node:assert/strict';
import {BIRDS} from '../wingspan/catalog.js';
import {developmentAdjustments} from '../wingspan/development-evaluators.js';
import {efficiencyAdjustments} from '../wingspan/efficiency-evaluators.js';
import {FINAL_EVALUATORS,finalAdjustments} from '../wingspan/final-evaluators.js';
const unit=id=>({id,eggs:0,tucked:[],cached:[]});
const p=()=>({habitats:{forest:[],grassland:[],wetland:[]},food:{seed:3,fruit:3,invertebrate:3,fish:3,rodent:3},hand:[],bonuses:[],pinkUsed:[],goalPoints:[]});
const fixture=()=>({phase:'play',round:2,remaining:[4,5],players:[p(),p()],eggSupply:75,feeder:['seed','dual','fish'],tray:[]});
const cap=x=>Math.max(-4,Math.min(4,x));
function expected(s){const d=developmentAdjustments(s,0),e=efficiencyAdjustments(s,0),a=d['slot-scarcity'],b=e['robust-value'],c=e['engine-saturation'];return {
 'final-space-robust':cap(.5*a+.5*b),'final-space-saturation':cap(.5*a+.5*c),'final-robust-saturation':cap(.5*b+.5*c),'final-space-robust-saturation':cap((a+b+c)/3),'final-development-options':cap(.35*a+.35*d['bonus-card-option']+.3*d['grassland-foundation']),'final-cautious-portfolio':cap(.25*a+.25*b+.25*c+.25*e['tuck-card-opportunity'])};}
test('exact six predeclared weighted formulas and deterministic pure output',()=>{
 const s=fixture();s.players[0].hand=BIRDS.filter(b=>b.points>=7||b.powerCode===13).slice(0,8).map(b=>b.id);s.players[0].habitats.grassland=[unit(BIRDS.find(b=>b.powerCode===30&&b.powerType==='brown').id)];
 const before=JSON.stringify(s),a=finalAdjustments(s,0);assert.equal(FINAL_EVALUATORS.length,6);assert.deepEqual(Object.keys(a),FINAL_EVALUATORS);assert.deepEqual(a,expected(s));assert.deepEqual(a,finalAdjustments(s,0));assert.equal(JSON.stringify(s),before);assert.ok(Object.values(a).every(x=>Number.isFinite(x)&&Math.abs(x)<=4));
});
test('negative correction blends are clamped after combination',()=>{
 const s=fixture(),id=BIRDS.find(b=>b.powerCode===30&&b.powerType==='brown').id;
 // Deliberately saturated synthetic tableau stresses the numeric boundary.
 for(const h of ['forest','grassland','wetland'])s.players[0].habitats[h]=Array.from({length:5},()=>({...unit(id),eggs:BIRDS[id].eggs}));
 s.players[0].hand=BIRDS.slice(0,30).map(b=>b.id);s.eggSupply=0;
 assert.deepEqual(finalAdjustments(s,0),expected(s));assert.equal(finalAdjustments(s,0)['final-space-saturation'],-4);assert.ok(Object.values(finalAdjustments(s,0)).every(x=>Math.abs(x)<=4));
});
test('terminal zeros avoid reading other fields and exhausted final-round state has no correction',()=>{
 assert.deepEqual(finalAdjustments({phase:'gameover'},0),Object.fromEntries(FINAL_EVALUATORS.map(k=>[k,0])));
 const s=fixture();s.round=4;s.remaining=[0,0];assert.ok(Object.values(finalAdjustments(s,0)).every(x=>x===0));
});
test('hidden decks, opponent private cards and tucked identities are inaccessible',()=>{
 const s=fixture();s.players[0].habitats.forest=[unit(BIRDS.find(b=>b.powerCode===31).id)];const a=finalAdjustments(s,0);
 for(const key of ['deck','bonusDeck','rngState'])Object.defineProperty(s,key,{get(){throw Error('hidden state read');}});
 for(const key of ['hand','bonuses','bonusOffer'])Object.defineProperty(s.players[1],key,{get(){throw Error('private opponent read');}});
 Object.defineProperty(s.players[0].habitats.forest[0],'tucked',{get(){throw Error('tucked identities read');}});assert.deepEqual(finalAdjustments(s,0),a);
});
