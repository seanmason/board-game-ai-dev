import test from "node:test";
import assert from "node:assert/strict";
import {drawFactories, newGame, seededRandom, legalActions, applyAction} from "../src/azul.js";
import {createSearch, advanceSearch, runSearch, searchSummary, bestAction, heuristicScore, rolloutAction} from "../src/mcts.js";

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


test("enhanced MCTS is the default and baseline remains selectable", () => {
  const state=drawFactories(newGame({players:3,mode:"digital"}),seededRandom(147));
  assert.equal(createSearch(state).variant,"guided-informed");
  assert.equal(createSearch(state,{variant:"baseline"}).variant,"baseline");
  assert.throws(()=>createSearch(state,{variant:"not-a-policy"}),/Unknown MCTS variant/);
});


test("tree re-rooting retains conditional visits, outcome sums and descendants", () => {
  for (const variant of ["baseline", "guided-informed"]) {
    const state=drawFactories(newGame({players:3,mode:"digital"}),seededRandom(97));
    const tree=createSearch(state,{rng:seededRandom(99),variant,maxNodes:5000});
    runSearch(tree,400);
    const candidate=searchSummary(tree).candidates[0];
    assert.ok(candidate,"There should be an explored root action");
    const branch=tree.root.children.find(child=>child.action &&
      [child.action.source,child.action.color,child.action.row].join(":")===candidate.key);
    assert.ok(branch);
    const parentVisits=tree.iterations, savedVisits=branch.visits;
    const oldReward=[...branch.rewardSum], oldWin=[...branch.winSum],
      oldScores=[...branch.scoreSum];
    const previousNodeCount=tree.nodeCount;
    const next=applyAction(state,candidate.action);
    assert.equal(next.phase,"draft","Position must remain in the deterministic round");
    const result=advanceSearch(tree,candidate.action,next);
    assert.deepEqual(result,{reused:true,retainedVisits:savedVisits,retainedNodes:tree.nodeCount});
    assert.equal(tree.root,branch,"Must adopt actual child node, not recreate it");
    assert.equal(tree.iterations,savedVisits);
    assert.ok(tree.iterations>0 && tree.iterations<=parentVisits);
    assert.ok(tree.nodeCount<=previousNodeCount);
    assert.deepEqual(tree.root.rewardSum,oldReward);
    assert.deepEqual(tree.root.winSum,oldWin);
    assert.deepEqual(tree.root.scoreSum,oldScores);
    assert.deepEqual(tree.rootState,next);
    const legal=new Set(legalActions(next).map(a=>[a.source,a.color,a.row].join(":")));
    assert.ok(searchSummary(tree).candidates.every(c=>legal.has(c.key)));
    runSearch(tree,20);
    assert.equal(tree.iterations,savedVisits+20,"Subtree playouts must accumulate");
    assert.ok(legal.has([bestAction(tree).source,bestAction(tree).color,bestAction(tree).row].join(":")));
  }
});

test("incompatible observation never mutates the existing tree", () => {
  const state=drawFactories(newGame({players:2,mode:"digital"}),seededRandom(45));
  const search=createSearch(state,{rng:seededRandom(91),maxNodes:4000});
  runSearch(search,36);
  const action=searchSummary(search).candidates[0].action;
  const correct=applyAction(state,action);
  const incorrect=structuredClone(correct);
  incorrect.players[0].score+=1;
  const oldRoot=search.root, oldState=search.rootState, oldVisits=search.iterations;
  assert.deepEqual(advanceSearch(search,action,incorrect),
    {reused:false,reason:"different-observation"});
  assert.equal(search.root,oldRoot);
  assert.equal(search.rootState,oldState);
  assert.equal(search.iterations,oldVisits);
  assert.deepEqual(advanceSearch(search,{source:400,color:0,row:0},correct),
    {reused:false,reason:"illegal-transition"});
});

test("unexpanded legal actions fall back without stealing unrelated visits", () => {
  const state=drawFactories(newGame({players:4,mode:"digital"}),seededRandom(94));
  const search=createSearch(state,{rng:seededRandom(10),maxNodes:1000});
  runSearch(search,2);
  const expanded=new Set(search.root.children.map(n=>
    [n.action.source,n.action.color,n.action.row].join(":")));
  const action=legalActions(state).find(a=>!expanded.has([a.source,a.color,a.row].join(":")));
  assert.ok(action,"There should be unexpanded actions after two playouts");
  const root=search.root;
  const result=advanceSearch(search,action,applyAction(state,action));
  assert.deepEqual(result,{reused:false,reason:"unexplored-action"});
  assert.equal(search.root,root);
  assert.equal(search.iterations,2);
});

test("chance refills and round-scoring invalidate deterministic tree reuse", () => {
  const rng=seededRandom(511);
  let s=drawFactories(newGame({players:2,mode:"digital"}),rng);
  let turns=0;
  while (s.phase==="draft" && turns<200) {
    const actions=legalActions(s);
    if (s.factories.filter(f=>f.length).length===1 &&
        !s.center.length &&
        s.factories.find(f=>f.length)?.every(x=>x===s.factories.find(f=>f.length)[0])) break;
    s=applyAction(s,actions[0]);
    turns++;
  }
  // Independently obtain a valid position where one drafting action ends round.
  if (s.phase!=="draft" || !legalActions(s).some(a=>applyAction(s,a).phase!=="draft")) {
    s=drawFactories(newGame({players:2,mode:"digital"}),seededRandom(512));
    while(s.phase==="draft") {
      const finishing=legalActions(s).find(a=>applyAction(s,a).phase!=="draft");
      if(finishing)break;
      s=applyAction(s,legalActions(s)[0]);
    }
  }
  const last=legalActions(s).find(a=>applyAction(s,a).phase!=="draft");
  assert.ok(last);
  const search=createSearch(s,{rng:seededRandom(3)});
  runSearch(search,10);
  const next=applyAction(s,last);
  assert.notEqual(next.phase,"draft");
  assert.deepEqual(advanceSearch(search,last,next),
    {reused:false,reason:"chance-or-terminal-boundary"});
});
