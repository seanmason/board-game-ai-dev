import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,applyAction,publicObservation} from '../wingspan/core.js';
import {BIRDS} from '../wingspan/catalog.js';
import {FEATURE_NAMES,FEATURE_VERSION,encodeObservation,supportedModelObservation} from '../scripts/wingspan-selfplay/encoder.mjs';
import {compileModel,isCompiledModel,predictFeatures,predictObservation,createZeroModel} from '../scripts/wingspan-selfplay/inference.mjs';

function ready(){let s=newGame({players:2,seed:418});while(s.phase==='setup'){const p=s.players[s.currentPlayer];s=applyAction(s,{type:'setup',keep:[],foodDiscard:[],bonusId:p.bonusOffer[0]});}return s;}
const feature=(x,name)=>x[FEATURE_NAMES.indexOf(name)];
function row(s,codes,h='grassland'){s.players[0].habitats[h]=codes.map(code=>{const b=BIRDS.find(b=>b.powerType==='brown'&&b.powerCode===code&&b.habitats.includes(h));assert.ok(b,'fixture code '+code);return {id:b.id,eggs:0,cached:[],tucked:[]};});}

test('compact schema freezes exactly 192 unique named finite features in both perspectives',()=>{
 assert.equal(FEATURE_VERSION,'wingspan-compact-v1');assert.equal(FEATURE_NAMES.length,192);assert.equal(new Set(FEATURE_NAMES).size,192);assert.ok(Object.isFrozen(FEATURE_NAMES));
 const s=ready();
 for(const v of [0,1]){const o=publicObservation(s,v),before=JSON.stringify(o),x=encodeObservation(o,v);assert.equal(x.length,192);assert.ok(x.every(Number.isFinite));assert.equal(feature(x,'viewerIsCurrent'),Number(s.currentPlayer===v));assert.equal(feature(x,'supported'),1);assert.equal(JSON.stringify(o),before);}
});

test('hidden true state mutation and partial views leave both acting and off-turn features invariant',()=>{
 const s=ready();s.players[0].hand=s.deck.splice(0,5);s.players[1].hand=s.deck.splice(0,4);row(s,[33,14]);s.players[0].habitats.grassland[0].tucked=s.deck.splice(0,2);
 for(const v of [0,1]){
  const hidden=structuredClone(s);hidden.deck.reverse();hidden.bonusDeck.reverse();hidden.bonusDiscard.reverse();hidden.rngState=123456;hidden.players[1-v].hand=hidden.players[1-v].hand.map((_,i)=>hidden.deck[i]);hidden.players[1-v].bonuses=[25];hidden.players[0].habitats.grassland[0].tucked.reverse();
  const a=publicObservation(s,v),b=publicObservation(hidden,v);assert.deepEqual(encodeObservation(a,v),encodeObservation(b,v));
  for(const o of [a,b]){o.players[v].hand=o.players[v].hand.slice(0,1);o.players[v].bonuses=[];o.publicComplete=false;o.feeder=[null,null];o.tray=[null];o.goals=[null,null,null,null];}
  assert.deepEqual(encodeObservation(a,v),encodeObservation(b,v));assert.equal(feature(encodeObservation(a,v),'ownHandKnown'),0);assert.equal(feature(encodeObservation(a,v),'ownBonusKnown'),0);assert.equal(feature(encodeObservation(a,v),'publicKnown'),0);assert.equal(supportedModelObservation(a,v),false);
 }
});

test('all own hand cards and all bonus cards aggregate without truncation or order dependence',()=>{
 const s=ready();s.players[0].hand=s.deck.splice(0,35);s.players[0].bonuses=Array.from({length:26},(_,i)=>i);
 const o=publicObservation(s,0),x=encodeObservation(o,0);assert.equal(feature(x,'hand.knownCount'),35/20);assert.equal(feature(x,'bonus.knownCount'),26/5);
 o.players[0].hand.reverse();o.players[0].bonuses.reverse();assert.deepEqual(encodeObservation(o,0),x);
 const extra=BIRDS.find(b=>!o.players[0].hand.includes(b.id));o.players[0].hand.push(extra.id);o.players[0].handCount++;
 const y=encodeObservation(o,0);assert.ok(Math.abs(feature(y,'hand.pointsSum')-feature(x,'hand.pointsSum')-extra.points/200)<1e-12);
 assert.equal(feature(y,'hand.knownCount'),36/20);
});

test('semantic raven, hand conversion, free engines and right-to-left dependencies are distinct',()=>{
 const s=ready();row(s,[33,14]);const a=encodeObservation(publicObservation(s,0),0);
 assert.equal(feature(a,'own.grassland.foodOutput'),.2);assert.equal(feature(a,'own.grassland.eggCost'),.1);assert.equal(feature(a,'own.grassland.producerBeforeConsumer'),1/25);assert.equal(feature(a,'own.grassland.consumerBeforeProducer'),0);
 s.players[0].habitats.grassland.reverse();const b=encodeObservation(publicObservation(s,0),0);
 assert.equal(feature(b,'own.grassland.producerBeforeConsumer'),0);assert.equal(feature(b,'own.grassland.consumerBeforeProducer'),1/25);
 row(s,[35,66]);const c=encodeObservation(publicObservation(s,0),0);assert.equal(feature(c,'own.grassland.cardCost'),.1);assert.equal(feature(c,'own.grassland.tuckOutput'),.1);assert.equal(feature(c,'own.grassland.freeOutput'),.1);
 row(s,[43,14]);const d=encodeObservation(publicObservation(s,0),0);assert.equal(feature(d,'own.grassland.repeat'),.1);
});

test('rejects true states, opponent private identities, tucked IDs and supervised fields',()=>{
 const s=ready();assert.throws(()=>encodeObservation(s,0),/redacted/);
 const base=publicObservation(s,0);row(s,[33]);
 for(const mutation of [o=>o.players[1].hand.push(0),o=>o.players[1].bonuses.push(0),o=>o.players[1].bonusOffer.push(0),o=>o.seed=1,o=>o.targetMargin=42,o=>o.outcome=[1,0],o=>o.goals[0]={tile:99,side:0},o=>o.remaining[0]=NaN]){const o=structuredClone(base);mutation(o);assert.throws(()=>encodeObservation(o,0),/redacted/);assert.equal(supportedModelObservation(o,0),false);}
 const tucked=publicObservation(s,0);tucked.players[0].habitats.grassland[0].tucked=[0];tucked.players[0].habitats.grassland[0].tuckedCount=1;assert.throws(()=>encodeObservation(tucked,0),/tucked/);
});

test('zero residual model keeps complete 6721 parameter hidden architecture and copies data',()=>{
 const json=createZeroModel(),m=compileModel(json),o=publicObservation(ready(),0);
 assert.equal(m.parameterCount,6721);assert.equal(m.inputSize,192);assert.equal(m.outputKind,'reference-residual');assert.equal(m.residualScale,10);assert.ok(isCompiledModel(m));assert.equal(compileModel(m),m);assert.ok(Object.isFrozen(m));
 assert.ok(json.layers[0].weights.some(x=>x!==0));assert.ok(json.layers[1].weights.some(x=>x!==0));
 assert.equal(predictObservation(m,o,0),0);json.layers[2].bias[0]=1;assert.equal(predictObservation(m,o,0),0);assert.equal(predictObservation(compileModel(json),o,0),10*Math.tanh(1));
 const norm={mean:Array(192).fill(.25),scale:Array(192).fill(2)},copy=createZeroModel({normalization:norm});norm.mean[0]=9;assert.equal(copy.normalization.mean[0],.25);
});

test('dense float32 row-major multiplication, normalization and smooth bound match independent scalar calculation',()=>{
 const json=createZeroModel(),features=Array.from({length:192},(_,i)=>(i%9)*.3),f=Math.fround;
 json.normalization.mean=features.map((_,i)=>(i%3)*.2);json.normalization.scale=features.map((_,i)=>1+(i%7)*.1);
 json.layers[2].weights=Array.from({length:16},(_,i)=>(i-7)*.13);json.layers[2].bias=[.17];
 let a=features.map((x,i)=>f(f(f(x)-f(json.normalization.mean[i]))/f(json.normalization.scale[i])));
 for(const layer of json.layers){const next=[];for(let i=0;i<layer.out;i++){let acc=f(layer.bias[i]);for(let j=0;j<layer.in;j++)acc=f(acc+f(a[j]*f(layer.weights[i*layer.in+j])));next.push(layer.activation==='relu'?Math.max(0,acc):acc);}a=next;}
 assert.equal(predictFeatures(compileModel(json),features),10*Math.tanh(a[0]));
 json.layers[2].bias=[1e6];const high=predictFeatures(compileModel(json),features);assert.equal(high,10);
 json.layers[2].bias=[-1e6];assert.equal(predictFeatures(compileModel(json),features),-10);
});

test('unsupported settled coverage and terminal/setup/pending/physical corrections are exactly zero',()=>{
 const json=createZeroModel();json.layers[2].bias=[1];const m=compileModel(json),base=publicObservation(ready(),0);
 assert.ok(predictObservation(m,base,0)>0);
 for(const mutate of [o=>o.phase='gameover',o=>o.phase='setup',o=>o.phase='power',o=>o.pending=[{owner:1}],o=>o.turnContext={actor:0},o=>o.mode='physical',o=>o.publicComplete=false,o=>o.players[0].handCount++,o=>o.players[0].privateBonusCount++,o=>o.players[0].bonusOfferCount++,o=>o.tray=[null]]){const o=structuredClone(base);mutate(o);assert.equal(predictObservation(m,o,0),0);}
});

test('invalid model safety rejects architecture/metadata/normalization and nonnumeric features',()=>{
 for(const mutate of [j=>j.version=2,j=>j.featureVersion='other',j=>j.featureNames.reverse(),j=>j.outputKind='margin',j=>j.residualScale=30,j=>j.layers.pop(),j=>j.layers[0].out=64,j=>j.layers[1].activation='linear',j=>j.layers[2].activation='relu',j=>j.layers[0].weights[0]=Infinity,j=>j.layers[0].bias[0]='1',j=>j.normalization.scale[0]=0,j=>j.normalization.mean[0]=NaN]){const json=createZeroModel();mutate(json);assert.throws(()=>compileModel(json),/Invalid Wingspan value model/);}
 const m=compileModel(createZeroModel());assert.throws(()=>predictFeatures({},Array(192).fill(0)),/compile/);assert.throws(()=>predictFeatures(m,[1]),/dimensions/);
 for(const bad of [NaN,Infinity,'2']){const x=Array(192).fill(0);x[2]=bad;assert.throws(()=>predictFeatures(m,x),/nonfinite/);}
});
