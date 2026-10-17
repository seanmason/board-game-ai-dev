import test from 'node:test';
import assert from 'node:assert/strict';
import {readSession, boundedInteger} from '../shared/session.js';
import {newGame as azul, assertValid as validAzul} from '../src/azul.js';
import {newGame as pentago, assertValid as validPentago} from '../pentago/core.js';

for (const [name, create, validateState, playerCount, seatField, format] of [
  ['Azul', azul, validAzul, s=>s.players.length, 'seatTypes', 'tabletop-observatory-game'],
  ['Pentago', pentago, validPentago, ()=>2, 'seats', 'board-game-ai-pentago']
]) {
  const options={validateState,playerCount,seatField,format};
  const session=()=>({format,version:1,history:[{state:create(),label:'Start'}],index:0,[seatField]:['human','ai']});
  test(`${name}: existing v1 export loads without mutation`,()=>{
    const data=session(), before=structuredClone(data);
    const restored=readSession(data,options);
    assert.equal(restored.game,data.history[0].state);
    assert.deepEqual(restored.seats,['human','ai']);
    assert.deepEqual(data,before);
  });
  test(`${name}: malformed imports leave the caller's current session intact`,()=>{
    let live=readSession(session(),options);
    const original=live;
    for(const mutate of [
      d=>d.index=.5, d=>d.index='0', d=>d.index=-1, d=>d.index=2,
      d=>d.history.push({state:{version:999},label:'Corrupt later snapshot'}),
      d=>d.history[0].label={}, d=>d.format='another-game', d=>d.version=2,
      d=>d.history.push({state:create({mode:'digital'}),label:'Changed mode'})
    ]) {
      const data=session();mutate(data);
      assert.throws(()=>{live=readSession(data,options);});
      assert.equal(live,original);
    }
  });
  test(`${name}: missing cursor and invalid seats are normalized safely`,()=>{
    const data=session();delete data.index;data[seatField]=['robot',null];
    const restored=readSession(data,options);
    assert.equal(restored.index,0);assert.deepEqual(restored.seats,['human','human']);
  });
}
test('worker preferences cannot restore fractional, string or nonfinite counts',()=>{
  for(const value of [1.2,'2',NaN,Infinity,null]) assert.equal(boundedInteger(value,2,1,8),2);
  assert.equal(boundedInteger(99,2,1,8),8);
  assert.equal(boundedInteger(-1,2,1,8),1);
});
