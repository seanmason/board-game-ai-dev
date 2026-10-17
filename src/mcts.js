import {
  applyAction, legalActions, drawFactories, cloneGame, outcomes,
  actionKey, describeAction, completedRows, scoreWallPlacement,
  wallColumn, FLOOR_COSTS
} from "./azul.js";

// Keep the prior tree-search implementation as an explicit control variant.
// Research variants are opt-in until tournaments establish a benefit.
export const SEARCH_VARIANTS = [
  "baseline", "guided", "guided-softmax", "guided-informed"
];

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

/** Optional Azul-specific rollout improvement, not part of the generic tree. */
export function informedHeuristic(state, action) {
  const p = state.players[state.currentPlayer];
  const picked = (action.source < 0 ? state.center : state.factories[action.source])
    .filter(tile => tile === action.color).length;
  const takesMarker = action.source < 0 && state.markerAvailable;
  let placed = 0, progress = 0, future = 0;
  if (action.row >= 0) {
    const row = action.row;
    const line = p.lines[row];
    placed = Math.min(picked, row + 1 - line.count);
    progress = (line.count + placed) / (row + 1);
    if (line.count + placed === row + 1) {
      const column = wallColumn(row, action.color);
      const wall = p.wall.map(cells => [...cells]);
      wall[row][column] = true;
      future = 2.0 * scoreWallPlacement(wall, row, column) + 2.0;
      // Long-term structural bonuses, including the value of ending a round.
      if (wall[row].every(Boolean)) future += 4;
      if (wall.every(cells => cells[column])) future += 6;
      if (wall.every((cells, r) => cells[wallColumn(r, action.color)])) future += 7;
    } else {
      future = 2.0 * progress;
    }
  }
  // Floor penalties are not linear and can hit a seven-slot capacity.
  let floorPenalty = 0;
  const spilling = picked - placed + (takesMarker ? 1 : 0);
  for (let i = 0; i < spilling; i++) {
    const index = p.floor.length + i;
    if (index < FLOOR_COSTS.length) floorPenalty += FLOOR_COSTS[index];
  }
  // The first-player marker has strategic value but also a floor penalty.
  const initiative = takesMarker ? 2.0 : 0;
  return placed * 1.55 + future - floorPenalty * 1.8 + initiative;
}

export function rolloutAction(state, rng = Math.random, policy = "baseline") {
  const actions = legalActions(state);
  if (!actions.length) return null;
  if (rng() < (policy === "informed" ? 0.07 : 0.15))
    return actions[Math.floor(rng() * actions.length)];
  const evaluation = policy === "informed" ? informedHeuristic : heuristicScore;
  const jitter = policy === "informed" ? 2.5 : 7;
  let best = -Infinity, choice = actions[0];
  for (const action of actions) {
    const score = evaluation(state, action) + (rng() - 0.5) * jitter;
    if (score > best) { best = score; choice = action; }
  }
  return choice;
}

function createNode(state, action = null, prior = 0, variant = "baseline") {
  let untried = state.phase === "draft" ? legalActions(state) : [];
  if (variant !== "baseline") {
    // Cache each action's score once instead of recomputing evaluations
    // O(actions * log(actions)) times during sort. This preserves the
    // previous deterministic order and doesn't change move selection.
    untried = untried.map(action => ({
      action, score: heuristicScore(state, action)
    })).sort((a, b) => b.score - a.score ||
      actionKey(a.action).localeCompare(actionKey(b.action)))
      .map(item => item.action);
  }
  return {
    action, prior, actor: state.currentPlayer, untried,
    children: [], visits: 0,
    rewardSum: Array(state.players.length).fill(0),
    winSum: Array(state.players.length).fill(0),
    scoreSum: Array(state.players.length).fill(0)
  };
}
export function createSearch(rootState, {
  rng = Math.random, exploration, maxNodes = 18000, variant = "guided-informed"
} = {}) {
  if (rootState.phase !== "draft") throw Error("Search requires a drafting position");
  if (!SEARCH_VARIANTS.includes(variant)) throw Error("Unknown MCTS variant");
  return {
    rootState: cloneGame(rootState),
    root: createNode(rootState, null, 0, variant), rng,
    exploration: exploration ?? (variant === "baseline" ? 1.3 : 0.65),
    maxNodes, variant, nodeCount: 1, iterations: 0
  };
}
function weightedChoice(node, rng, exploration, variant) {
  let best = -Infinity, choice = node.children[0];
  for (const child of node.children) {
    const mean = child.rewardSum[node.actor] / child.visits;
    const uct = mean + exploration * Math.sqrt(Math.log(node.visits + 1) / child.visits);
    const prior = variant === "baseline" ?
      0.025 * child.prior / (1 + child.visits) :
      0.075 * Math.tanh(child.prior / 8) / (1 + child.visits);
    const value = uct + prior + rng() * 1e-8;
    if (value > best) { best = value; choice = child; }
  }
  return choice;
}
function sampleUntried(node, state, rng, variant) {
  if (variant !== "baseline") {
    return node.untried.shift(); // ordered by heuristic at node construction
  }
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
function scoreReward(score, hardWin, variant) {
  if (variant === "baseline" || variant === "guided") {
    return score.map((value, i) =>
      0.85 * hardWin[i] + 0.15 * Math.min(1, Math.max(0, (value + 5) / 150)));
  }
  // Differentiable multiplayer outcome signal: avoids mostly-zero hard wins
  // for non-leading players, while retaining the true winner as an objective.
  // These values are search utilities, NOT calibrated win probabilities.
  const top = Math.max(...score);
  const temperature = 8 + (score.length - 2) * 3;
  const weights = score.map(value => Math.exp((value - top) / temperature));
  const total = weights.reduce((a, b) => a + b, 0);
  return score.map((_, i) => 0.75 * (weights[i] / total) + 0.25 * hardWin[i]);
}
function finishRollout(state, rng, variant, limit = 550) {
  let s = state, moves = 0;
  const policy = variant === "guided-informed" ? "informed" : "baseline";
  while (s.phase !== "gameover" && moves++ < limit) {
    if (s.phase === "refill") {
      try { s = drawFactories(s, rng); }
      catch { break; }
    } else {
      const action = rolloutAction(s, rng, policy);
      if (!action) break;
      s = applyAction(s, action);
    }
  }
  const score = s.players.map(p => p.score +
    (s.phase === "gameover" ? 0 :
      p.lines.reduce((a, line, r) => a + line.count * 0.45 +
        (line.count === r+1 ? 2 : 0), 0) +
      completedRows(p) * 2));
  const win = s.phase === "gameover" ? outcomes(s) : (() => {
    const top = Math.max(...score);
    const leaders = score.map((v, i) =>
      Math.abs(v - top) < 0.000001 ? i : -1).filter(i => i >= 0);
    return score.map((_, i) => leaders.includes(i) ? 1 / leaders.length : 0);
  })();
  return {score, win, reward: scoreReward(score, win, variant)};
}
function allowExpansion(node, search) {
  if (node.untried.length === 0 || search.nodeCount >= search.maxNodes) return false;
  if (search.variant === "baseline") return true;
  const cap = Math.max(1, Math.floor(2.0 * Math.pow(node.visits + 1, 0.45)));
  return node.children.length < cap;
}
export function runSearch(search, iterations = 1) {
  const {rng, rootState, variant} = search;
  for (let k = 0; k < iterations; k++) {
    let state = cloneGame(rootState);
    let node = search.root;
    const path = [node];
    while (state.phase === "draft") {
      if (allowExpansion(node, search)) {
        const action = sampleUntried(node, state, rng, variant);
        const prior = heuristicScore(state, action);
        state = applyAction(state, action);
        const child = createNode(state, action, prior, variant);
        node.children.push(child);
        node = child;
        path.push(node);
        search.nodeCount++;
        break;
      }
      if (!node.children.length) break;
      node = weightedChoice(node, rng, search.exploration, variant);
      state = applyAction(state, node.action);
      path.push(node);
    }
    const result = finishRollout(state, rng, variant);
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
    action: child.action, key: actionKey(child.action),
    label: describeAction(child.action), visits: child.visits,
    winSum: [...child.winSum], scoreSum: [...child.scoreSum],
    rewardSum: [...child.rewardSum]
  }));
  choices.sort((a, b) => b.visits - a.visits ||
    b.rewardSum[root.actor] - a.rewardSum[root.actor]);
  return {
    iterations: search.iterations, nodeCount: search.nodeCount,
    rootPlayer: root.actor, variant: search.variant, candidates: choices,
    rootLegalActions: root.children.length + root.untried.length
  };
}
export function bestAction(search) {
  return searchSummary(search).candidates[0]?.action ??
    rolloutAction(search.rootState, search.rng,
      search.variant === "guided-informed" ? "informed" : "baseline");
}
