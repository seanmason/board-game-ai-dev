/** Original Azul (colored-wall variant), with no external assets or dependencies.
 * State is serializable and all public transitions return independent copies.
 * Tile IDs: blue=0, yellow=1, red=2, black=3, white=4; first-player marker=5.
 * Official rules: https://cdn.svc.asmodee.net/production-nextmove/uploads/sites/4/2024/06/EN-Azul-Rules-Next-Move-web.pdf
 */
export const COLORS = ["Blue", "Yellow", "Red", "Black", "White"];
export const MARKER = 5;
export const FLOOR_COSTS = [1, 1, 2, 2, 2, 3, 3];
const EMPTY = -1;
const FAIL = message => { throw new Error(message); };
const check = (condition, message) => { if (!condition) FAIL(message); };
const sum = values => values.reduce((a, b) => a + b, 0);
export const factoryCount = players => ({2: 5, 3: 7, 4: 9})[players] ?? FAIL("Azul requires 2–4 players");
export const wallColor = (row, column) => (column - row + 5) % 5;
export const wallColumn = (row, color) => (row + color) % 5;
export const emptyPlayer = () => ({
  score: 0,
  lines: Array.from({length: 5}, () => ({color: EMPTY, count: 0})),
  wall: Array.from({length: 5}, () => Array(5).fill(false)),
  floor: []
});
export function newGame({players = 2, mode = "physical", starter = 0} = {}) {
  check(["physical", "digital"].includes(mode), "Invalid mode");
  check(Number.isInteger(players) && players >= 2 && players <= 4, "Players must be 2–4");
  check(Number.isInteger(starter) && starter >= 0 && starter < players, "Invalid starter");
  return {
    version: 1, mode, phase: "refill", round: 1, starter, currentPlayer: starter,
    nextStarter: null, markerAvailable: true,
    factories: Array.from({length: factoryCount(players)}, () => []), center: [],
    bag: Array(5).fill(20), discard: Array(5).fill(0),
    players: Array.from({length: players}, emptyPlayer)
  };
}
export function cloneGame(s) {
  return {
    ...s, factories: s.factories.map(f => [...f]), center: [...s.center],
    bag: [...s.bag], discard: [...s.discard],
    players: s.players.map(p => ({
      score: p.score,
      lines: p.lines.map(l => ({...l})),
      wall: p.wall.map(row => [...row]),
      floor: [...p.floor]
    }))
  };
}
const validTile = color => Number.isInteger(color) && color >= 0 && color < 5;
const refillBag = s => {
  if (sum(s.bag) === 0) {
    s.bag = [...s.discard];
    s.discard = Array(5).fill(0);
  }
};
function consumeObserved(s, color) {
  check(validTile(color), "Unknown tile color");
  refillBag(s);
  check(s.bag[color] > 0, "Observed factory tiles conflict with tracked bag inventory. Correct an earlier entry or begin a new game.");
  s.bag[color]--;
}
export function recordFactories(state, factories) {
  check(state.phase === "refill", "Factory entry only allowed during refill");
  check(Array.isArray(factories) && factories.length === state.factories.length, "Expected all factories");
  const s = cloneGame(state);
  s.factories = factories.map(factory => {
    check(Array.isArray(factory) && factory.length <= 4, "Each factory has at most four tiles");
    for (const color of factory) consumeObserved(s, color);
    return [...factory];
  });
  check(s.factories.some(f => f.length), "At least one tile must be entered");
  s.phase = "draft";
  s.center = [];
  s.markerAvailable = true;
  s.nextStarter = null;
  s.currentPlayer = s.starter;
  return s;
}
export const seededRandom = (seed = 1) => {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let x = value;
    x = Math.imul(x ^ x >>> 15, x | 1);
    x ^= x + Math.imul(x ^ x >>> 7, x | 61);
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  };
};
function draw(s, rng) {
  refillBag(s);
  const total = sum(s.bag);
  if (total === 0) return null;
  let index = Math.min(total - 1, Math.floor(rng() * total));
  for (let color = 0; color < 5; color++) {
    if (index < s.bag[color]) {
      s.bag[color]--;
      return color;
    }
    index -= s.bag[color];
  }
  FAIL("Unexpected draw state");
}
export function drawFactories(state, rng = Math.random) {
  check(state.phase === "refill", "Cannot draw outside refill phase");
  const s = cloneGame(state);
  s.factories = s.factories.map(() => {
    const tiles = [];
    for (let i = 0; i < 4; i++) {
      const tile = draw(s, rng);
      if (tile !== null) tiles.push(tile);
    }
    return tiles;
  });
  check(s.factories.some(f => f.length), "No drawable tiles remain");
  s.center = [];
  s.markerAvailable = true;
  s.nextStarter = null;
  s.currentPlayer = s.starter;
  s.phase = "draft";
  return s;
}
export function legalActions(s) {
  if (s.phase !== "draft") return [];
  const p = s.players[s.currentPlayer];
  const actions = [];
  for (let source = -1; source < s.factories.length; source++) {
    const tiles = source < 0 ? s.center : s.factories[source];
    for (let color = 0; color < 5; color++) {
      if (!tiles.includes(color)) continue;
      actions.push({source, color, row: -1});
      for (let row = 0; row < 5; row++) {
        const line = p.lines[row];
        if (line.count >= row + 1) continue;
        if (line.count > 0 && line.color !== color) continue;
        if (p.wall[row][wallColumn(row, color)]) continue;
        actions.push({source, color, row});
      }
    }
  }
  return actions;
}
export const actionKey = a => a.source + ":" + a.color + ":" + a.row;
export function describeAction(a) {
  return (a.source < 0 ? "Center" : "Factory " + (a.source + 1)) +
    " · " + COLORS[a.color] + " → " + (a.row < 0 ? "Floor" : "Row " + (a.row + 1));
}
const addFloor = (s, player, tile) => {
  if (player.floor.length < 7) player.floor.push(tile);
  else if (tile !== MARKER) s.discard[tile]++;
};
export function scoreWallPlacement(wall, row, column) {
  const axis = (dr, dc) => {
    let n = 1;
    for (const direction of [-1, 1]) {
      let r = row + dr * direction;
      let c = column + dc * direction;
      while (r >= 0 && r < 5 && c >= 0 && c < 5 && wall[r][c]) {
        n++; r += dr * direction; c += dc * direction;
      }
    }
    return n;
  };
  const h = axis(0, 1), v = axis(1, 0);
  return (h > 1 ? h : 0) + (v > 1 ? v : 0) || 1;
}
export const completedRows = player => player.wall.filter(row => row.every(Boolean)).length;
export function finalBonus(player) {
  let points = completedRows(player) * 2;
  for (let c = 0; c < 5; c++) {
    if (player.wall.every(row => row[c])) points += 7;
  }
  for (let color = 0; color < 5; color++) {
    if (player.wall.every((row, r) => row[wallColumn(r, color)])) points += 10;
  }
  return points;
}
export function resolveRound(s) {
  check(s.phase === "draft", "Cannot score outside drafting phase");
  check(s.factories.every(f => !f.length) && !s.center.length, "Drafting is not finished");
  const result = cloneGame(s);
  for (const p of result.players) {
    for (let r = 0; r < 5; r++) {
      const line = p.lines[r];
      if (line.count !== r + 1) continue;
      const column = wallColumn(r, line.color);
      check(!p.wall[r][column], "Duplicate wall tile");
      p.wall[r][column] = true;
      p.score += scoreWallPlacement(p.wall, r, column);
      result.discard[line.color] += line.count - 1;
      p.lines[r] = {color: EMPTY, count: 0};
    }
    // The marker consumes a floor slot and its corresponding penalty,
    // but it is not a colored tile and never enters the discard pool.
    const penalty = p.floor.reduce((a, _, i) => a + FLOOR_COSTS[i], 0);
    p.score = Math.max(0, p.score - penalty);
    for (const color of p.floor) if (color !== MARKER) result.discard[color]++;
    p.floor = [];
  }
  if (result.players.some(p => completedRows(p))) {
    for (const p of result.players) p.score += finalBonus(p);
    result.phase = "gameover";
    return result;
  }
  result.round++;
  result.starter = result.nextStarter ?? result.starter;
  result.currentPlayer = result.starter;
  result.phase = "refill";
  result.nextStarter = null;
  result.markerAvailable = true;
  result.factories = result.factories.map(() => []);
  result.center = [];
  return result;
}
export function applyAction(state, action) {
  check(state.phase === "draft", "No move allowed at this phase");
  check(legalActions(state).some(a => actionKey(a) === actionKey(action)), "Illegal draft");
  const s = cloneGame(state), p = s.players[s.currentPlayer];
  const source = action.source < 0 ? s.center : s.factories[action.source];
  const picked = source.filter(x => x === action.color);
  const remaining = source.filter(x => x !== action.color);
  if (action.source < 0) {
    s.center = remaining;
    if (s.markerAvailable) {
      s.markerAvailable = false;
      s.nextStarter = s.currentPlayer;
      addFloor(s, p, MARKER);
    }
  } else {
    s.center.push(...remaining);
    s.factories[action.source] = [];
  }
  if (action.row < 0) {
    picked.forEach(color => addFloor(s, p, color));
  } else {
    const line = p.lines[action.row];
    const placeCount = Math.min(action.row + 1 - line.count, picked.length);
    line.color = action.color;
    line.count += placeCount;
    picked.slice(placeCount).forEach(color => addFloor(s, p, color));
  }
  s.currentPlayer = (s.currentPlayer + 1) % s.players.length;
  if (s.factories.every(f => !f.length) && !s.center.length) {
    return resolveRound(s);
  }
  return s;
}
export function outcomes(s) {
  check(s.phase === "gameover", "Outcomes only exist after game over");
  const top = Math.max(...s.players.map(p => p.score));
  const first = s.players.map((p, i) => p.score === top ? i : -1).filter(i => i >= 0);
  const maxRows = Math.max(...first.map(i => completedRows(s.players[i])));
  const winning = first.filter(i => completedRows(s.players[i]) === maxRows);
  return s.players.map((_, i) => winning.includes(i) ? 1 / winning.length : 0);
}
export function tileCounts(s) {
  const totals = [...s.bag];
  for (let c = 0; c < 5; c++) totals[c] += s.discard[c];
  const add = c => { if (validTile(c)) totals[c]++; };
  s.factories.forEach(f => f.forEach(add));
  s.center.forEach(add);
  for (const p of s.players) {
    for (const line of p.lines) if (line.count) totals[line.color] += line.count;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      if (p.wall[r][c]) add(wallColor(r, c));
    }
    p.floor.forEach(add);
  }
  return totals;
}
export function assertValid(s) {
  check(s.version === 1, "Unsupported version");
  check(s.factories.length === factoryCount(s.players.length), "Factory count mismatch");
  check(s.currentPlayer >= 0 && s.currentPlayer < s.players.length, "Invalid current player");
  for (const p of s.players) {
    check(p.floor.length <= 7, "Floor exceeds capacity");
    check(p.lines.length === 5 && p.wall.length === 5, "Bad player board");
    p.lines.forEach((l, r) => {
      check(Number.isInteger(l.count) && l.count >= 0 && l.count <= r + 1, "Invalid pattern line");
      check(l.count ? validTile(l.color) && !p.wall[r][wallColumn(r, l.color)] : l.color === EMPTY,
        "Impossible pattern line");
    });
  }
  check(tileCounts(s).every(n => n === 20), "Tile conservation violated");
  return true;
}