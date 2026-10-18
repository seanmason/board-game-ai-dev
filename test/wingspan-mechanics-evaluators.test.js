import test from 'node:test';
import assert from 'node:assert/strict';
import {BIRDS} from '../wingspan/catalog.js';
import {MECHANICS_EVALUATORS,mechanicsAdjustments} from '../wingspan/mechanics-evaluators.js';
const bird=(code,type='brown')=>BIRDS.find(b=>b.powerCode===code&&b.powerType===type);
const entry=(code,type='brown')=>({id:bird(code,type).id,eggs:0,cached:[],tucked:[]});
const player=()=>({habitats:{forest:[],grassland:[],wetland:[]},food:{seed:4,fish:4,fruit:4,rodent:4,invertebrate:4},hand:[],bonuses:[],pinkUsed:[],goalPoints:[]});
function fixture(){return {phase:'play',round:1,remaining:[8,8],players:[player(),player()],feeder:['seed'],goalMode:'green',goals:Array(4).fill({face:{kind:'totalBirds'}})};}
const val=(s,k)=>mechanicsAdjustments(s,0)[k];
test('twelve bounded deterministic corrections, pure and terminal zero',()=>{
 const s=fixture();s.players[0].habitats.forest=[entry(31)];const before=JSON.stringify(s),a=mechanicsAdjustments(s,0);
 assert.equal(MECHANICS_EVALUATORS.length,12);assert.deepEqual(a,mechanicsAdjustments(s,0));assert.equal(JSON.stringify(s),before);
 assert.ok(Object.values(a).every(x=>Number.isFinite(x)&&Math.abs(x)<=8));s.phase='gameover';assert.ok(Object.values(mechanicsAdjustments(s,0)).every(x=>x===0));
});
test('ordered card production must run before hand-consuming tucker',()=>{
 const s=fixture();s.players[0].habitats.forest=[entry(27),entry(56)];const forward=val(s,'ordered-engine');s.players[0].habitats.forest.reverse();assert.ok(forward>val(s,'ordered-engine'));
});
test('renewable tuck-draw loop works without initial hand',()=>{
 const s=fixture();s.players[0].habitats.wetland=[entry(4)];assert.ok(val(s,'renewable-tucking')>0);
});
test('cache supply and renewable paid tuck economy',()=>{
 const s=fixture();s.players[0].habitats.forest=[entry(31)];assert.ok(val(s,'food-cache-economy')>0);
 s.players[0].habitats.forest=[entry(23),entry(66)];assert.ok(val(s,'food-cache-economy')>0);
});
test('nest network rewards matching empty nests and respects capacity',()=>{
 const s=fixture();const layer=entry(61);s.players[0].habitats.forest=[layer];const extra=BIRDS.find(b=>b.nest==='cavity'&&b.id!==layer.id);s.players[0].habitats.forest.push({id:extra.id,eggs:0,cached:[],tucked:[]});const open=val(s,'nest-network');
 for(const e of s.players[0].habitats.forest)e.eggs=BIRDS[e.id].eggs;
 assert.ok(open>0);assert.equal(val(s,'nest-network'),0);
});
test('pink egg excludes itself and once-per-interval availability reduces income',()=>{
 const s=fixture();const pink=entry(18,'pink');s.players[0].habitats.forest=[pink];assert.equal(val(s,'pink-egg-income'),0);
 const b=BIRDS.find(b=>b.nest==='cavity'&&b.id!==pink.id);s.players[0].habitats.forest.push({id:b.id,eggs:0,cached:[],tucked:[]});
 s.round=4;s.remaining=[2,2];const available=val(s,'pink-egg-income');s.players[0].pinkUsed=[pink.id];assert.ok(available>val(s,'pink-egg-income'));
});
test('pink food forecasts public opponent opportunities with capped intervals',()=>{
 const s=fixture();s.players[0].habitats.forest=[entry(39,'pink')];assert.ok(val(s,'pink-food-income')>0);s.players.push(player());assert.equal(val(s,'pink-food-income'),val({...s,players:s.players.slice(0,2)},'pink-food-income'));
});
test('repeat requires an eligible same-row brown power',()=>{
 const s=fixture();s.players[0].habitats.forest=[entry(43)];assert.equal(val(s,'repeat-engine'),0);s.players[0].habitats.forest.push(entry(31));assert.ok(val(s,'repeat-engine')>0);
});
test('public green denial and safe lead use exact rank while blue has neither',()=>{
 const s=fixture();s.remaining=[1,0];s.players[0].habitats.forest=[entry(31),entry(66)];s.players[1].habitats.forest=[entry(31)];assert.ok(val(s,'goal-denial')>0);assert.ok(val(s,'goal-safe-lead')>0);s.goalMode='blue';assert.equal(val(s,'goal-denial'),0);assert.equal(val(s,'goal-safe-lead'),0);
});
test('bonus progress is an exact reachable threshold, late play compares net eggs',()=>{
 const s=fixture();const candidates=BIRDS.filter(b=>b.bonuses.includes('anatomist'));s.players[0].bonuses=[0];const a=candidates[0],b=candidates[1];s.players[0].habitats[a.habitats[0]]=[{id:a.id,eggs:a.eggs,cached:[],tucked:[]}];s.players[0].hand=[b.id];assert.ok(val(s,'bonus-progress')>0);
 s.round=4;s.remaining=[2,2];const high=BIRDS.find(b=>b.points>=8);s.players[0].hand=[high.id];assert.ok(val(s,'late-bird-vs-eggs')>0);
});
test('adaptive portfolio responds to concrete engine production',()=>{
 const s=fixture(),base=val(s,'adaptive-portfolio');s.players[0].habitats.forest=[entry(31)];assert.ok(val(s,'adaptive-portfolio')>base);
});
test('hidden decks and opponent private cards cannot affect corrections',()=>{
 const s=fixture();s.players[0].habitats.forest=[entry(31)];const a=mechanicsAdjustments(s,0);
 Object.defineProperty(s,'deck',{get(){throw Error('private deck');}});Object.defineProperty(s,'bonusDeck',{get(){throw Error('private bonuses');}});
 for(const key of ['hand','bonuses','bonusOffer'])Object.defineProperty(s.players[1],key,{get(){throw Error('private opponent');}});
 assert.deepEqual(mechanicsAdjustments(s,0),a);
});

test('spent goals, zero actions, empty supply and empty-hand forest tuck cannot earn forecasts',()=>{
 const s=fixture();s.round=4;s.remaining=[1,0];s.players[0].habitats.forest=[entry(31),entry(66)];s.players[1].habitats.forest=[entry(31)];s.players[0].goalPoints=[1,1,1,1];assert.equal(val(s,'goal-denial'),0);assert.equal(val(s,'goal-safe-lead'),0);
 s.remaining=[0,0];assert.ok(Object.values(mechanicsAdjustments(s,0)).every(x=>x===0));
 const t=fixture();t.players[0].habitats.forest=[entry(4)];assert.equal(val(t,'renewable-tucking'),0);
 t.players[0].habitats.forest=[entry(61)];t.eggSupply=0;assert.equal(val(t,'nest-network'),0);
});
test('bonus projection debits column egg payment before breeding-manager scoring',()=>{
 const s=fixture();const b=BIRDS.find(b=>b.eggs>=4&&b.habitats.includes('forest'));
 s.players[0].habitats.forest=[{id:b.id,eggs:4,cached:[],tucked:[]}];s.players[0].bonuses=[4];s.players[0].hand=[BIRDS.find(x=>x.id!==b.id&&x.habitats.length===1&&x.habitats[0]==='forest').id];
 assert.equal(val(s,'bonus-progress'),0);
});
