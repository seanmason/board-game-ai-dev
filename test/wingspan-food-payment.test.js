import test from 'node:test';
import assert from 'node:assert/strict';
import {BIRDS} from '../wingspan/catalog.js';
import {FOOD} from '../wingspan/scoring.js';
import {findFoodPayment} from '../wingspan/core.js';

// Frozen pre-repair implementation: independent legacy receipt of first/minimal
// payment ordering. The production implementation skips equivalent token branches.
function satisfiesCost(card,payment){
  const cost=card.food;
  const required=card.either?
    [...FOOD,"wild"].filter(f=>cost[f]>0).map(type=>[type]):
    [...FOOD,"wild"].flatMap(f=>Array.from({length:cost[f]},()=>[f]));
  const alternatives=card.either?
    [[...FOOD,"wild"].filter(f=>cost[f]>0)
      .flatMap(type=>type==="wild"?FOOD:[type])] :
    required.map(([type])=>type==="wild"?[...FOOD]:[type]);
  function matches(index,remaining){
    if(index===alternatives.length)return remaining.every(c=>c===0);
    for(const type of alternatives[index]){
      const i=FOOD.indexOf(type);
      if(remaining[i]){
        remaining[i]--;
        if(matches(index+1,remaining))return true;
        remaining[i]++;
      }
    }
    // Card-playing-only substitution: any TWO tokens replace one symbol.
    const available=remaining.flatMap((n,i)=>Array.from({length:n},()=>i));
    for(let i=0;i<available.length;i++)for(let j=i+1;j<available.length;j++){
      const a=available[i],b=available[j];
      remaining[a]--;remaining[b]--;
      if(matches(index+1,remaining))return true;
      remaining[a]++;remaining[b]++;
    }
    return false;
  }
  const rem=FOOD.map(f=>payment.filter(x=>x===f).length);
  return matches(0,rem);
}
/** Return a single explicitly computable legal payment for AI/second-bird use. */
function legacyFoodPayment(owned,card){
  const types=FOOD.flatMap(f=>Array.from({length:owned[f]},()=>f));
  // A card requires at most three food symbols (or one if alternative).
  for(let k=0;k<=Math.min(types.length,6);k++){
    function pick(from,left,result){
      if(!left)return satisfiesCost(card,result)?result:null;
      for(let i=from;i<=types.length-left;i++){
        const t=pick(i+1,left-1,[...result,types[i]]);
        if(t)return t;
      }
      return null;
    }
    const candidate=pick(0,k,[]);
    if(candidate)return candidate;
  }
  return null;
}

test('equivalent-token pruning preserves first minimal payment for every bird and small food multiset',()=>{
 let checked=0;
 function stocks(prefix,left){
  if(prefix.length===FOOD.length){
   const food=Object.fromEntries(FOOD.map((f,i)=>[f,prefix[i]]));
   for(const bird of BIRDS){assert.deepEqual(findFoodPayment(food,bird),legacyFoodPayment(food,bird),`${bird.name} ${JSON.stringify(food)}`);checked++;}
   return;
  }
  for(let n=0;n<=left;n++)stocks([...prefix,n],left-n);
 }
 stocks([],4);
 assert.equal(checked,126*170);
});

test('large duplicate stocks require at most the same six-token minimal substitute payment',()=>{
 const expensive=BIRDS.find(b=>!b.either&&b.food.fish===3&&Object.values(b.food).reduce((a,b)=>a+b,0)===3);
 assert.ok(expensive);
 const food=Object.fromEntries(FOOD.map(f=>[f,f==='seed'?10000:0]));
 assert.deepEqual(findFoodPayment(food,expensive),Array(6).fill('seed'));
 assert.equal(food.seed,10000,'payment discovery does not mutate holdings');
 const either=BIRDS.find(b=>b.either&&b.food.seed>0);
 assert.deepEqual(findFoodPayment(food,either),['seed']);
});

