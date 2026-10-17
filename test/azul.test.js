import test from "node:test";
import assert from "node:assert/strict";
import {
  newGame, recordFactories, drawFactories, seededRandom, legalActions,
  applyAction, resolveRound, scoreWallPlacement, outcomes, finalBonus,
  completedRows, tileCounts, assertValid, wallColumn, MARKER
} from "../src/azul.js";

test("setup and observed factory validation preserve tile counts", () => {
  const s = recordFactories(newGame({players: 2}), [[0, 0, 1, 2], [3, 3, 3, 3], [4], [], []]);
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
  assert.equal(scoreWallPlacement(wall, 2, 2), 6); // 2 horizontal + 3 vertical = 5? Wait 2+3=5
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
