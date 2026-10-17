import test from "node:test";
import assert from "node:assert/strict";
import {
  newGame, recordFactories, drawFactories, seededRandom, legalActions,
  applyAction, resolveRound, scoreWallPlacement, outcomes, finalBonus,
  completedRows, tileCounts, assertValid, wallColumn, MARKER
} from "../src/azul.js";

test("setup and observed factory validation preserve tile counts", () => {
  const s = recordFactories(newGame({players: 2}), [[0, 0, 1, 2], [3, 3, 3, 3], [4, 4, 4, 4], [0, 1, 2, 3], [0, 1, 2, 3]]);
  assert.equal(s.phase, "draft");
  assert.deepEqual(tileCounts(s), [20, 20, 20, 20, 20]);
  assertValid(s);
  assert.throws(() => recordFactories(newGame(), [[0,0,0,0,0],[],[],[],[]]));
  assert.throws(() => recordFactories(newGame(), [[],[],[],[],[]]));
});

test("factory draft moves remainder to center, center claim takes marker", () => {
  let s = recordFactories(newGame(), [[0, 0, 1, 2], [3, 3, 3, 4], [2, 2, 1, 1], [0, 0, 4, 4], [1, 1, 2, 2]]);
  s = applyAction(s, {source: 0, color: 0, row: 1});
  assert.deepEqual(s.center, [1, 2]);
  assert.equal(s.players[0].lines[1].count, 2);
  assert.equal(s.currentPlayer, 1);
  s = applyAction(s, {source: -1, color: 1, row: 0});
  assert.equal(s.nextStarter, 1);
  assert.equal(s.players[1].floor[0], MARKER);
  assert.equal(s.players[1].lines[0].count, 1);
  assertValid(s);
});

test("floor only is always legal; cannot mix colors or duplicate wall color in a row", () => {
  let s = recordFactories(newGame(), [[0,0,1,2], [2,2,3,3], [4,4,4,4], [0,0,0,0], [1,1,1,1]]);
  s = applyAction(s, {source: 0, color: 0, row: 1});
  // Inspect the same player board after a turn; a real turn passes to player 2.
  s.currentPlayer = 0;
  const actions = legalActions(s).filter(a => a.source === 1 && a.color === 2);
  assert.ok(actions.some(a => a.row === -1));
  assert.ok(actions.every(a => a.row !== 1));
  assert.throws(() => applyAction(s, {source: 1, color: 2, row: 1}));
  assertValid(s);
});

test("score connected wall tiles horizontally and vertically, without double count when one axis absent", () => {
  const wall = Array.from({length: 5}, () => Array(5).fill(false));
  wall[2][2] = true;
  assert.equal(scoreWallPlacement(wall, 2, 2), 1);
  wall[2][1] = true;
  assert.equal(scoreWallPlacement(wall, 2, 2), 2);
  wall[1][2] = true;
  wall[3][2] = true;
  assert.equal(scoreWallPlacement(wall, 2, 2), 5); // 2 horizontal + 3 vertical
});
test("end of round scores lines top-down and floors with correct penalties", () => {
  const s = newGame();
  s.phase = "draft";
  s.factories = s.factories.map(() => []);
  const p = s.players[0];
  p.lines[0] = {color: 0, count: 1};
  p.lines[1] = {color: 0, count: 2};
  p.floor = [MARKER, 1, 1, 1, 1];
  // Remove tiles from bag to preserve conservation.
  s.bag[0] -= 3; s.bag[1] -= 4;
  const t = resolveRound(s);
  assert.equal(t.players[0].wall[0][wallColumn(0, 0)], true);
  assert.equal(t.players[0].wall[1][wallColumn(1, 0)], true);
  assert.equal(t.players[0].score, 0); // scored 2 isolated, then lost 8
  assert.equal(t.discard[0], 1);
  assert.equal(t.discard[1], 4);
  assert.equal(t.round, 2);
  assertValid(t);
});

test("floor overflow returns extra tiles to discard while conserving inventory", () => {
  let s = recordFactories(newGame(), [[0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0]]);
  for (let i = 0; i < 5; i++) s = applyAction(s, {source: i, color: 0, row: -1});
  assert.equal(s.phase, "refill");
  assert.equal(s.discard[0], 20);
  assert.equal(s.players[0].score, 0);
  assertValid(s);
});

test("endgame bonuses and ties follow the official conditions", () => {
  const s = newGame();
  s.phase = "gameover";
  for (let r = 0; r < 5; r++) s.players[0].wall[r][0] = true;
  for (let c = 0; c < 5; c++) s.players[0].wall[0][c] = true;
  assert.equal(completedRows(s.players[0]), 1);
  assert.equal(finalBonus(s.players[0]), 9);
  s.players[0].score = 42;
  s.players[1].score = 42;
  assert.deepEqual(outcomes(s), [1, 0]);
  s.players[1].wall[1] = Array(5).fill(true);
  assert.deepEqual(outcomes(s), [0.5, 0.5]);
});

test("seeded random game, legal actions, and all 100 tiles remain conserved", () => {
  const rng = seededRandom(147);
  let s = drawFactories(newGame({players: 3, mode: "digital"}), rng);
  let moves = 0;
  while (s.phase !== "gameover" && moves < 1000) {
    if (s.phase === "refill") s = drawFactories(s, rng);
    const options = legalActions(s);
    assert.ok(options.length);
    s = applyAction(s, options[Math.floor(rng() * options.length)]);
    assertValid(s);
    moves++;
  }
  assert.ok(moves < 1000, "Game should terminate under a random legal policy");
  assert.equal(outcomes(s).reduce((a, b) => a + b, 0), 1);
});


// The printed rulebook permits refilling the bag from the box lid partway
// through factory setup. Factory contents have no significant tile order.
test("physical refill correctly recycles bag and lid regardless of entry order", () => {
  const s = newGame();
  s.round = 4;
  s.bag = [1, 1, 0, 0, 0];
  s.discard = [19, 19, 20, 20, 20];
  assertValid(s);
  // Recycled colors may be entered BEFORE the old-bag colors in the interface.
  const displays = [
    [2,2,2,2],
    [3,3,3,3],
    [4,4,4,4],
    [0,1,2,3],
    [0,1,4,3]
  ];
  const resulting = recordFactories(s, displays);
  assert.equal(resulting.phase, "draft");
  assert.equal(resulting.bag.reduce((a,b)=>a+b), 80);
  assert.deepEqual(resulting.discard, [0,0,0,0,0]);
  assert.deepEqual(resulting.factories, displays);
  assertValid(resulting);
  // Same multiset in a different factory order is legal and has same bag.
  const reordered = recordFactories(s, [...displays].reverse());
  assert.deepEqual(reordered.bag, resulting.bag);
  assertValid(reordered);
  assert.deepEqual(s.bag, [1,1,0,0,0], "Observation must not mutate source state");
});

test("physical refill rejects impossible observed mixtures atomically", () => {
  const s = newGame();
  s.bag = [1,1,0,0,0];
  s.discard = [19,19,20,20,20];
  const wrong = [
    [2,2,2,2], [3,3,3,3], [4,4,4,4], [0,2,2,3], [0,2,4,3]
  ]; // Old bag yellow tile is missing: cannot recycle yet.
  assert.throws(() => recordFactories(s, wrong), /Yellow/);
  assert.deepEqual(s.bag, [1,1,0,0,0]);
  const short = [[0,1],[2,2,2,2],[3,3,3,3],[4,4,4,4],[0,1,2,3]];
  assert.throws(() => recordFactories(s, short), /Factory 1/);
});

test("partial factory setups are allowed when bag and lid are exhausted", () => {
  const s = newGame({players:4,starter:3});
  s.bag = [1,1,0,0,0];
  s.discard = [0,0,0,0,0];
  // Set aside the other 98 tiles as wall placements, preserving conservation.
  let rest = [19,19,20,20,20];
  for (const p of s.players) {
    for (let r=0;r<5;r++) for (let c=0;c<5;c++) {
      const color=(c-r+5)%5;
      if (rest[color] > 0) { p.wall[r][c]=true; rest[color]--; }
    }
  }
  // Inventory leftover tiles need to be represented somewhere; assign these
  // to the discard pool for an invariant-valid synthetic short-refill case.
  // A complete legal game often cannot reach this extreme, so test the refill
  // protocol independently of global tile accounting.
  const result = recordFactories(s, [[0,1],[],[],[],[],[],[],[],[]]);
  assert.equal(result.currentPlayer,3);
  assert.equal(result.factories[0].length,2);
  assert.equal(result.factories[1].length,0);
  assert.deepEqual(result.bag,[0,0,0,0,0]);
});

test("bag reaching exactly zero does not recycle the lid early",()=>{
  const s=newGame();
  s.bag=[4,4,4,4,4];
  s.discard=[16,16,16,16,16];
  const factories=[
    [0,1,2,3],[4,0,1,2],[3,4,0,1],[2,3,4,0],[1,2,3,4]
  ];
  const actual=recordFactories(s,factories);
  assert.deepEqual(actual.bag,[0,0,0,0,0]);
  assert.deepEqual(actual.discard,[16,16,16,16,16]);
  assertValid(actual);
  // Recycled colors cannot be observed prematurely while old bag is sufficient.
  const bad=factories.map(f=>[...f]);
  bad[0][0]=4;
  assert.throws(()=>recordFactories(s,bad),/White/);
});
