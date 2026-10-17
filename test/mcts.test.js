import test from "node:test";
import assert from "node:assert/strict";
import {drawFactories, newGame, seededRandom, legalActions, applyAction} from "../src/azul.js";
import {createSearch, runSearch, searchSummary, bestAction, heuristicScore, rolloutAction} from "../src/mcts.js";

test("MCTS returns only legal root actions and per-player outcomes", () => {
  const s = drawFactories(newGame({players: 3, mode: "digital"}), seededRandom(17));
  const search = createSearch(s, {rng: seededRandom(99), maxNodes: 1000});
  runSearch(search, 35);
  const report = searchSummary(search);
  assert.equal(report.iterations, 35);
  assert.equal(report.candidates.reduce((n, c) => n + c.visits, 0), 35);
  assert.deepEqual(report.candidates.map(c => c.key).sort(),
    [...new Set(report.candidates.map(c => c.key))].sort());
  const valid = new Set(legalActions(s).map(a => [a.source,a.color,a.row].join(":")));
  assert.ok(report.candidates.every(c => valid.has(c.key)));
  assert.ok(report.candidates.every(c => c.winSum.length === 3 && c.scoreSum.length === 3));
  const action = bestAction(search);
  assert.ok(valid.has([action.source,action.color,action.row].join(":")));
  assert.equal(applyAction(s, action).currentPlayer, 1);
});

test("heuristic baseline picks valid action and seeded search is reproducible", () => {
  const state = drawFactories(newGame({players: 2, mode: "digital"}), seededRandom(19));
  const one = createSearch(state, {rng: seededRandom(55)});
  const two = createSearch(state, {rng: seededRandom(55)});
  runSearch(one, 18);
  runSearch(two, 18);
  assert.deepEqual(searchSummary(one), searchSummary(two));
  const action = rolloutAction(state, seededRandom(1));
  assert.ok(Number.isFinite(heuristicScore(state, action)));
});
