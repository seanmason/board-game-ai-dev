import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,applyAction,assertValid,findFoodPayment} from '../wingspan/core.js';
import {candidateActions} from '../wingspan/actions.js';
import {BIRDS} from '../wingspan/catalog.js';
import {openingSetupActions,openingAdjustment} from '../wingspan/opening-strategy.js';
const ready=seed=>{let s=newGame({seed});while(s.phase==='setup')s=applyAction(s,{type:'setup',keep:[],foodDiscard:[],bonusId:s.players[s.currentPlayer].bonusOffer[0]});return s;};
test('bounded deterministic shortlist preserves every existing candidate and all additions apply legally',()=>{
 for(const seed of [1,7,23,59]){const s=newGame({seed}),existing=candidateActions(s),before=JSON.stringify(s),baseline=JSON.stringify(existing),a=openingSetupActions(s,existing);assert.ok(a.length<=24);assert.deepEqual(a.slice(0,existing.length),existing);assert.deepEqual(a,openingSetupActions(s,existing));assert.equal(JSON.stringify(s),before);assert.equal(JSON.stringify(existing),baseline);for(const item of a)assertValid(applyAction(s,item.action));}
});
test('shortlist adds an immediately payable singleton omitted by original greedy setup',()=>{
 let found=false;
 for(let seed=1;seed<=8&&!found;seed++){const s=newGame({seed}),old=candidateActions(s),actions=openingSetupActions(s,old);for(const x of actions.slice(old.length)){if(x.action.keep.length!==1)continue;const after=applyAction(s,x.action),p=after.players[0];if(findFoodPayment(p.food,BIRDS[p.hand[0]])!==null&&!old.some(y=>y.action.keep.length===1&&y.action.keep[0]===p.hand[0])){found=true;break;}}}
 assert.ok(found);
});
test('round-one correction is bounded, pure, supports payable placement and fades to zero',()=>{
 const s=ready(41),p=s.players[0],id=s.deck.find(id=>BIRDS[id].points>=7);s.deck.splice(s.deck.indexOf(id),1);p.hand.push(id);for(const f of Object.keys(p.food))p.food[f]=3;
 const before=JSON.stringify(s),a=openingAdjustment(s,0);assert.ok(a>0&&a<=3);assert.equal(a,openingAdjustment(s,0));assert.equal(JSON.stringify(s),before);s.remaining[0]=4;assert.ok(Math.abs(openingAdjustment(s,0)-a/2)<1e-10);s.remaining[0]=0;assert.equal(openingAdjustment(s,0),0);s.round=2;s.remaining[0]=7;assert.equal(openingAdjustment(s,0),0);s.phase='gameover';assert.equal(openingAdjustment(s,0),0);
});
test('one-food-away options get credit but immediately payable same card is preferred',()=>{
 const s=ready(14),p=s.players[0];const id=s.deck.find(id=>{const b=BIRDS[id];return !b.either&&b.food.seed===2&&Object.values(b.food).reduce((a,b)=>a+b,0)===2;});assert.notEqual(id,undefined);p.hand=[id];for(const f of Object.keys(p.food))p.food[f]=0;p.food.seed=1;const near=openingAdjustment(s,0);p.food.seed=2;assert.ok(near>0);assert.ok(openingAdjustment(s,0)>near);
});
test('terminal and nonopening guards do not inspect private state; public/actor projection suffices',()=>{
 assert.equal(openingAdjustment({phase:'gameover'},0),0);assert.equal(openingAdjustment({phase:'play',round:2},0),0);
 const s=newGame({seed:5}),old=candidateActions(s),expected=openingSetupActions(s,old);for(const key of ['deck','bonusDeck','rngState'])Object.defineProperty(s,key,{get(){throw Error('hidden read');}});for(const key of ['hand','bonuses','bonusOffer'])Object.defineProperty(s.players[1],key,{get(){throw Error('private rival read');}});assert.deepEqual(openingSetupActions(s,old),expected);
 const r=ready(8);r.players[0].hand=[BIRDS.find(b=>b.points===0).id];const a=openingAdjustment(r,0);for(const key of ['deck','bonusDeck'])Object.defineProperty(r,key,{get(){throw Error('hidden read');}});Object.defineProperty(r.players[1],'hand',{get(){throw Error('private rival read');}});assert.equal(openingAdjustment(r,0),a);
});
test('outside setup candidate list is copied without changing its contents',()=>{const s=ready(2),old=candidateActions(s);const result=openingSetupActions(s,old);assert.deepEqual(result,old);assert.notEqual(result,old);});
test('executing a productive first placement earns at least its pending opening credit',()=>{
 const s=ready(46),p=s.players[0];const id=s.deck.find(id=>BIRDS[id].powerType==='brown'&&BIRDS[id].powerCode===31);assert.notEqual(id,undefined);s.deck.splice(s.deck.indexOf(id),1);p.hand.push(id);
 const play=candidateActions(s).find(x=>x.action.type==='playBird'&&x.action.birdId===id);assert.ok(play);const pending=openingAdjustment(s,0),after=applyAction(s,play.action);assertValid(after);assert.ok(openingAdjustment(after,0)>=pending);
});
