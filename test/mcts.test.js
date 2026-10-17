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


test("guided variants always expand legal actions and retain normalized multi-player utility", () => {
  const state = drawFactories(newGame({players:4,mode:"digital"}),seededRandom(543));
  const legal = new Set(legalActions(state).map(a=>[a.source,a.color,a.row].join(":")));
  for (const variant of ["guided","guided-softmax","guided-informed"]) {
    const search = createSearch(state,{rng:seededRandom(321),variant,maxNodes:1500});
    runSearch(search,96);
    const result = searchSummary(search);
    assert.equal(result.iterations,96);
    assert.ok(result.candidates.length > 0);
    assert.ok(result.candidates.length < legal.size, "Widening must restrict early breadth");
    assert.ok(result.candidates.every(c=>legal.has(c.key)));
    assert.equal(result.candidates.reduce((sum,c)=>sum+c.visits,0),96);
    assert.ok(result.candidates.every(c=>c.winSum.length===4 && c.scoreSum.length===4));
    if (variant !== "guided") {
      const rewardTotal=search.root.rewardSum.reduce((sum,x)=>sum+x,0);
      assert.ok(Math.abs(rewardTotal-96)<1e-6,"Softmax reward vector must sum to 1 each playout");
    }
  }
});

test("guided tree visits and action ranking are reproducible with a fixed seed", () => {
  const state=drawFactories(newGame({players:3,mode:"digital"}),seededRandom(18));
  for(const variant of ["guided","guided-softmax","guided-informed"]){
    const a=createSearch(state,{rng:seededRandom(1),variant});
    const b=createSearch(state,{rng:seededRandom(1),variant});
    runSearch(a,24);runSearch(b,24);
    assert.deepEqual(searchSummary(a),searchSummary(b));
    assert.deepEqual(bestAction(a),bestAction(b));
  }
});
