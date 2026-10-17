import {
  applyAction, legalActions, drawFactories, cloneGame, outcomes,
  actionKey, describeAction, completedRows
} from "./azul.js";

// The search tree covers deterministic drafting decisions in the current round.
// After randomized factory refills, rollout continues but no tree nodes are
// shared across different possible future draws.
export function heuristicScore(state, action) {
  const p = state.players[state.currentPlayer];
  const tiles = (action.source < 0 ? state.center : state.factories[action.source])
    .filter(x => x === action.color).length;
  const marker = action.source < 0 && state.markerAvailable ? 1 : 0;
  if (action.row < 0) return -3 * tiles - marker * 1.7;
  const line = p.lines[action.row];
  const available = action.row + 1 - line.count;
  const placed = Math.min(available, tiles);
  const overflow = tiles - placed;
  const completes = line.count + placed === action.row + 1;
  const column = (action.row + action.color) % 5;
  const wall = p.wall;
  let neighbors = 0;
  for (const [r, c] of [
    [action.row - 1, column], [action.row + 1, column],
    [action.row, column - 1], [action.row, column + 1]
  ]) if (r >= 0 && r < 5 && c >= 0 && c < 5 && wall[r][c]) neighbors++;
  return placed * 2.1 + (completes ? 3.8 + neighbors * 1.4 : line.count * 0.3)
    - overflow * 3.4 - marker * 1.2;
}
export function rolloutAction(state, rng = Math.random) {
  const actions = legalActions(state);
  if (!actions.length) return null;
  if (rng() < 0.15) return actions[Math.floor(rng() * actions.length)];
  let best = -Infinity, choice = actions[0];
  for (const action of actions) {
    const score = heuristicScore(state, action) + (rng() - 0.5) * 7;
    if (score > best) { best = score; choice = action; }
  }
  return choice;
}
function createNode(state, action = null, prior = 0) {
  return {
    action, prior, actor: state.currentPlayer,
    untried: state.phase === "draft" ? legalActions(state) : [],
    children: [], visits: 0,
    rewardSum: Array(state.players.length).fill(0),
    winSum: Array(state.players.length).fill(0),
    scoreSum: Array(state.players.length).fill(0)
  };
}
export function createSearch(rootState, {rng = Math.random, exploration = 1.3, maxNodes = 18000} = {}) {
  if (rootState.phase !== "draft") throw Error("Search requires a drafting position");
  return {
    rootState: cloneGame(rootState), root: createNode(rootState),
    rng, exploration, maxNodes, nodeCount: 1, iterations: 0
  };
}
function weightedChoice(node, rng, exploration) {
  let best = -Infinity, choice = node.children[0];
  for (const child of node.children) {
    const mean = child.rewardSum[node.actor] / child.visits;
    const uct = mean + exploration * Math.sqrt(Math.log(node.visits + 1) / child.visits);
    const prior = 0.025 * child.prior / (1 + child.visits);
    const value = uct + prior + rng() * 1e-8;
    if (value > best) { best = value; choice = child; }
  }
  return choice;
}
function sampleUntried(node, state, rng) {
  let index;
  if (rng() < 0.28) {
    index = Math.floor(rng() * node.untried.length);
  } else {
    let best = -Infinity;
    index = 0;
    for (let i = 0; i < node.untried.length; i++) {
      const value = heuristicScore(state, node.untried[i]) + rng() * 7;
      if (value > best) { best = value; index = i; }
    }
  }
  return node.untried.splice(index, 1)[0];
}
function finishRollout(state, rng, limit = 550) {
  let s = state, moves = 0;
  while (s.phase !== "gameover" && moves++ < limit) {
    if (s.phase === "refill") {
      try { s = drawFactories(s, rng); }
      catch { break; }
    } else {
      const action = rolloutAction(s, rng);
      if (!action) break;
      s = applyAction(s, action);
    }
  }
  const score = s.players.map(p => p.score +
    (s.phase === "gameover" ? 0 :
      p.lines.reduce((a, line, r) => a + line.count * 0.45 + (line.count === r+1 ? 2 : 0), 0) +
      completedRows(p) * 2));
  const win = s.phase === "gameover" ? outcomes(s) : (() => {
    const top = Math.max(...score);
    const leaders = score.map((v, i) => Math.abs(v - top) < 0.000001 ? i : -1).filter(i => i >= 0);
    return score.map((_, i) => leaders.includes(i) ? 1 / leaders.length : 0);
  })();
  const reward = score.map((value, i) =>
    0.85 * win[i] + 0.15 * Math.min(1, Math.max(0, (value + 5) / 150)));
  return {score, win, reward};
}
export function runSearch(search, iterations = 1) {
  const {rng, rootState} = search;
  for (let k = 0; k < iterations; k++) {
    let state = cloneGame(rootState);
    let node = search.root;
    const path = [node];
    while (state.phase === "draft") {
      if (node.untried.length && search.nodeCount < search.maxNodes) {
        const action = sampleUntried(node, state, rng);
        const prior = heuristicScore(state, action);
        state = applyAction(state, action);
        const child = createNode(state, action, prior);
        node.children.push(child);
        node = child;
        path.push(node);
        search.nodeCount++;
        break;
      }
      if (!node.children.length) break;
      node = weightedChoice(node, rng, search.exploration);
      state = applyAction(state, node.action);
      path.push(node);
    }
    const result = finishRollout(state, rng);
    for (const item of path) {
      item.visits++;
      for (let p = 0; p < result.reward.length; p++) {
        item.rewardSum[p] += result.reward[p];
        item.winSum[p] += result.win[p];
        item.scoreSum[p] += result.score[p];
      }
    }
    search.iterations++;
  }
  return search;
}
export function searchSummary(search) {
  const root = search.root;
  const choices = root.children.map(child => ({
    action: child.action,
    key: actionKey(child.action),
    label: describeAction(child.action),
    visits: child.visits,
    winSum: [...child.winSum],
    scoreSum: [...child.scoreSum],
    rewardSum: [...child.rewardSum]
  }));
  choices.sort((a, b) => b.visits - a.visits || b.rewardSum[root.actor] - a.rewardSum[root.actor]);
  return {iterations: search.iterations, nodeCount: search.nodeCount,
    rootPlayer: root.actor, candidates: choices};
}
export function bestAction(search) {
  return searchSummary(search).candidates[0]?.action ?? rolloutAction(search.rootState, search.rng);
}
