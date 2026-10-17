import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,legalActions,applyAction,previewPlacement,assertValid,owner,token,matchingLines,actionKey,seededRandom} from '../boop/core.js';
import {readSession} from '../shared/session.js';
export function fixture(entries=[],cats=[0,0],currentPlayer=0){
  const s=newGame({starter:currentPlayer});
  for(const [i,v] of entries)s.board[i]=v;
  s.pools=[0,1].map(p=>[8-cats[p]-s.board.filter(v=>owner(v)===p&&Math.abs(v)===1).length,cats[p]-s.board.filter(v=>owner(v)===p&&Math.abs(v)===2).length]);
  return s;
}
const move=(s,cell,piece=1,graduate=[])=>applyAction(s,{cell,piece,graduate});
test('Boop opens with exactly 36 kitten placements and eight active pieces each',()=>{
  const s=newGame();assertValid(s);assert.equal(legalActions(s).length,36);assert.deepEqual(s.pools,[[8,0],[8,0]]);
  assert.deepEqual(newGame({starter:1}).currentPlayer,1);assert.throws(()=>newGame({mode:'unknown'}));
});
test('simultaneous boops in all eight directions, with no chain reaction',()=>{
  const s=fixture([[7,1],[8,-1],[9,1],[13,-1],[15,1],[19,-1],[20,1],[21,-1]]);
  const p=previewPlacement(s,{cell:14,piece:1});
  for(const i of [7,8,9,13,15,19,20,21])assert.equal(p.state.board[i],0);
  for(const i of [0,2,4,12,16,24,26,28])assert.notEqual(p.state.board[i],0);
  assert.equal(p.moved.length,8);assert.equal(s.board[14],0,'Preview is immutable');
  const chain=previewPlacement(fixture([[14,1],[16,-1]]),{cell:13,piece:1});
  assert.equal(chain.state.board[15],1);assert.equal(chain.state.board[16],-1,'Booped piece does not push again');
});
test('occupied destinations block boops regardless of owners or sizes',()=>{
  for(const values of [[1,1],[1,-1],[-2,1],[2,-2]]){
    const s=fixture([[7,values[0]],[8,values[1]]],[4,4]);
    const p=previewPlacement(s,{cell:6,piece:2});assert.equal(p.state.board[7],values[0]);assert.equal(p.state.board[8],values[1]);
  }
});
test('kitten cannot boop a cat, while cat can boop either kind or owner',()=>{
  let p=previewPlacement(fixture([[8,-2]],[2,2]),{cell:7,piece:1});assert.equal(p.state.board[8],-2);
  p=previewPlacement(fixture([[8,-2],[13,1]],[2,2]),{cell:7,piece:2});assert.equal(p.state.board[9],-2);assert.equal(p.state.board[19],1);
});
test('off-board boops return the exact piece to its owner pool',()=>{
  const s=fixture([[0,-2],[6,1]],[2,2]);const p=previewPlacement(s,{cell:7,piece:2});
  assert.equal(p.state.board[0],0);assert.equal(p.state.pools[1][1],2);assert.equal(p.state.pools[0][0],6);assert.equal(p.state.pools[0][1],1);
});
test('mandatory mixed line returns cats and replaces kittens with cats',()=>{
  const s=fixture([[12,2],[13,1]],[1,0]);
  const p=previewPlacement(s,{cell:14,piece:1});assert.deepEqual(p.choices,[[12,13,14]]);
  assert.throws(()=>move(s,14),/graduation/);
  const next=move(s,14,1,[12,13,14]);assert.deepEqual(next.pools[0],[5,3]);assert.equal(next.board.filter(v=>v>0).length,0);assertValid(next);
});
test('multiple connected and disjoint triples require exactly one chosen line',()=>{
  const s=fixture([[6,1],[7,1],[8,1],[24,1],[25,1],[26,1]]);
  const p=previewPlacement(s,{cell:35,piece:1});assert.equal(p.choices.length,2);
  const next=move(s,35,1,[6,7,8]);assert.ok([24,25,26].every(i=>next.board[i]===1));
  assert.throws(()=>move(s,35,1,[6,7,8,24,25,26]),/graduation/);
  const connected=fixture([[12,1],[13,1],[14,1],[15,1]]);
  const q=previewPlacement(connected,{cell:35,piece:1});assert.equal(q.choices.length,2);
});
test('eight pieces permit a singleton kitten graduation OR cat retrieval, including a line alternative',()=>{
  const s=fixture([[0,2],[2,1],[4,1],[12,1],[13,1],[14,1],[30,1]],[1,0]);
  const p=previewPlacement(s,{cell:35,piece:1});assert.equal(p.choices.filter(g=>g.length===1).length,8);assert.ok(p.choices.some(g=>g.length===3));
  const kitten=move(s,35,1,[2]);assert.equal(kitten.pools[0][1],1);assert.equal(kitten.board[2],0);
  const cat=move(s,35,1,[0]);assert.equal(cat.pools[0][1],1);assert.equal(cat.board[2],1);assertValid(cat);
});
test('winning cat line takes precedence over graduation and only after boops',()=>{
  const s=fixture([[12,2],[13,2]],[3,0]);const next=move(s,14,2);assert.equal(next.winner,0);assert.equal(next.phase,'gameover');assertValid(next);
  assert.throws(()=>move(s,14,2,[12,13,14]),/graduation/);
  const pushed=fixture([[12,2],[13,2],[20,2]],[4,0]);
  assert.equal(previewPlacement(pushed,{cell:14,piece:2}).winner,0);
  const beforeLine=fixture([[12,2],[13,2]],[3,0]);
  // Placing between isolated cats pushes them apart; pre-boop geometry isn't a win.
  const split=fixture([[12,2],[14,2]],[3,0]);assert.equal(previewPlacement(split,{cell:13,piece:2}).winner,null);
  assert.equal(beforeLine.board[14],0);
});
test('eight adult cats on the bed win without a line',()=>{
  const s=fixture([[0,2],[2,2],[5,2],[12,2],[17,2],[30,2],[32,2]],[8,0]);
  const next=move(s,35,2);assert.equal(matchingLines(next.board,0,true).length,0);assert.equal(next.winner,0);assertValid(next);
});
test('only the active player wins, even if both players have winning lines',()=>{
  const s=fixture([[0,2],[1,2],[2,2],[30,-2],[31,-2],[32,-2]],[3,3]);
  const next=move(s,17);assert.equal(next.winner,0);assertValid(next);
  const opponentOnly=fixture([[30,-2],[31,-2],[32,-2]],[0,3]);
  const waiting=move(opponentOnly,0);assert.equal(waiting.winner,null);assert.equal(waiting.currentPlayer,1);assertValid(waiting);
  const win=move(waiting,17);assert.equal(win.winner,1);
});
test('opponent-created kitten lines only graduate on that player own turn',()=>{
  const s=fixture([[30,-1],[31,-1],[32,-1]]);const next=move(s,0);
  assert.equal(next.board[30],-1);assert.deepEqual(next.pools[1],[5,0]);
  assert.throws(()=>move(next,17),/graduation/);const result=move(next,17,1,[30,31,32]);assert.equal(result.pools[1][1],3);
});
test('reject occupied, unavailable, malformed and duplicate graduation moves atomically',()=>{
  const s=fixture([[0,1]]),snapshot=JSON.stringify(s);
  for(const a of [{cell:0,piece:1,graduate:[]},{cell:4,piece:2,graduate:[]},{cell:36,piece:1,graduate:[]},{cell:4,piece:1,graduate:[0,0,0]},{cell:4,piece:1}])assert.throws(()=>applyAction(s,a));
  assert.equal(JSON.stringify(s),snapshot);
});
test('strict import invariants and atomic history parsing',()=>{
  const s=newGame(),file={format:'board-game-ai-boop',version:1,history:[{state:s,label:'Start'}],index:0};
  assert.equal(readSession(file,{format:file.format,validateState:assertValid,playerCount:()=>2}).game,s);
  for(const change of [x=>x.pools[0][0]=7,x=>x.board[1]=3,x=>x.currentPlayer=1,x=>x.winner=0,x=>x.game='pentago',x=>x.ply=0.5]){const bad=structuredClone(s);change(bad);assert.throws(()=>assertValid(bad));}
  const bad=structuredClone(file);bad.history.push({state:{...s,board:[]},label:'Bad'});assert.throws(()=>readSession(bad,{format:file.format,validateState:assertValid,playerCount:()=>2}));
});
test('seeded complete games conserve eight active pieces and never mutate input',()=>{
  const rng=seededRandom(184901);for(let g=0;g<20;g++){
    let s=newGame({starter:g%2});for(let i=0;i<300&&s.phase==='play';i++){
      const old=JSON.stringify(s),actions=legalActions(s);assert.equal(new Set(actions.map(actionKey)).size,actions.length);assert.ok(actions.length);
      const next=applyAction(s,actions[Math.floor(rng()*actions.length)]);assert.equal(JSON.stringify(s),old);assertValid(next);s=next;
    }
  }
});
