import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,applyAction,assertValid} from '../wingspan/core.js';
import {advancedEditor} from '../wingspan/move-editor.js';
function fixture(){
  let s=newGame({seed:12});
  while(s.phase==='setup')s=applyAction(s,{type:'setup',keep:[],foodDiscard:[],bonusId:s.players[s.currentPlayer].bonusOffer[0]});
  for(const id of [68,105,107]){
    const pool=[s.deck,s.birdDiscard,s.tray].find(a=>a.includes(id));
    pool.splice(pool.indexOf(id),1);
  }
  s.players[0].habitats.forest=[{id:68,eggs:1,cached:[],tucked:[]}];
  s.players[0].habitats.grassland=[{id:105,eggs:2,cached:[],tucked:[]}];
  s.eggSupply-=3;s.players[0].hand=[107];
  s.players[0].food={seed:1,fruit:1,fish:2,rodent:0,invertebrate:0};
  s.phase='power';s.pending=[{owner:0,habitat:'forest',index:0,birdId:68,code:37,timing:'white',event:{}}];
  assertValid(s);return s;
}
test('second-bird power accepts a chosen two-for-one payment and egg source',()=>{
  const s=fixture();
  const n=applyAction(s,{type:'power',choice:{birdId:107,habitat:'forest',
    payment:['fish','fish','fruit'],eggs:[{habitat:'grassland',index:0,count:1}]}});
  assert.equal(n.players[0].food.seed,1);
  assert.equal(n.players[0].food.fish,0);
  assert.equal(n.players[0].habitats.forest[0].eggs,1);
  assert.equal(n.players[0].habitats.grassland[0].eggs,1);
  assert.equal(n.players[0].habitats.forest[1].id,107);
  assertValid(n);
});
test('second-bird custom costs reject underpayment and illegal habitats atomically',()=>{
  const s=fixture(),before=structuredClone(s);
  for(const choice of [
    {birdId:107,habitat:'forest',payment:[],eggs:[]},
    {birdId:107,habitat:'forest',payment:['seed','fruit'],eggs:[]},
    {birdId:107,habitat:'wetland',payment:['seed','fruit'],eggs:[]}
  ])assert.throws(()=>applyAction(s,{type:'power',choice}));
  assert.deepEqual(s,before);
});
test('second-bird power exposes the detailed payment editor',()=>{
  const html=advancedEditor(fixture());
  assert.match(html,/Detailed second-bird entry/);
  assert.match(html,/Northern Cardinal/);
  assert.match(html,/adv-food-fish/);
  assert.doesNotMatch(html,/<option value="gainFood"/);
});
