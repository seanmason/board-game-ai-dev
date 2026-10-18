import { createHash } from 'node:crypto';
import { readFile, rename, mkdir, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { TILE_LIST, TILES } from '../carcassonne/catalog.js';
import { newGame, drawTile, applyAction, remaining, rng, assertValid, winners, graph, observation } from '../carcassonne/core.js';
import { createSearch, heuristic, evaluate, utility } from '../carcassonne/ai.js';
import { oracleComponents, oracleScore } from '../test/carcassonne-reference.js';

const execFileAsync = promisify(execFile);
const cli = Object.fromEntries(process.argv.slice(2).map(x => {
  const [k, ...v] = x.replace(/^--/, '').split('='); return [k, v.join('=') || true];
}));
const HORIZON = 3;
const SEED_BASE = 82473119;
const SCENARIOS = {
  '3000-vs-300': { games: 24, pairs: 12, a: { kind: 'search', budget: 3000 }, b: { kind: 'search', budget: 300 } },
  '3000-vs-heuristic': { games: 24, pairs: 12, a: { kind: 'search', budget: 3000 }, b: { kind: 'heuristic' } },
  '300-vs-heuristic': { games: 24, pairs: 12, a: { kind: 'search', budget: 300 }, b: { kind: 'heuristic' } },
  '100-vs-heuristic': { games: 12, pairs: 6, a: { kind: 'search', budget: 100 }, b: { kind: 'heuristic' } },
  '100-vs-30': { games: 12, pairs: 6, a: { kind: 'search', budget: 100 }, b: { kind: 'search', budget: 30 } },
  '10000-vs-3000': { games: 12, pairs: 6, a: { kind: 'search', budget: 10000 }, b: { kind: 'search', budget: 3000 } },
};
const arg = (key, fallback) => cli[key] === undefined ? fallback : cli[key];
const hash = data => createHash('sha256').update(data).digest('hex');
const stable = value => JSON.stringify(value, Object.keys(value ?? {}).sort());
const policyKey = policy => policy.kind === 'heuristic' ? 'heuristic' : `search-${policy.budget}`;
const int = (x, name) => { const n = Number(x); if (!Number.isInteger(n) || n < 1) throw Error(`Invalid ${name}`); return n; };
const scenarioName = String(arg('scenario', ''));
const outputPath = String(arg('out', `benchmarks/carcassonne-budget/${scenarioName || 'calibration'}.json`));
const mode = String(arg('mode', 'run'));

function drawFromPublicCounts(state, random) {
  let n = random() * remaining(state);
  for (const tile of TILE_LIST) { n -= state.remaining[tile.id]; if (n < 0) return tile.id; }
  throw Error('No public tile remained to draw');
}

function endpointKey(s) {
  return JSON.stringify({ phase: s.phase, board: Object.entries(s.board).sort(([a], [b]) => a.localeCompare(b)),
    remaining: TILE_LIST.map(t => s.remaining[t.id]), discarded: s.discarded, drawn: s.drawn,
    currentPlayer: s.currentPlayer, turn: s.turn, scores: s.players.map(p => p.score),
    supply: s.players.map(p => p.supply), meeples: s.meeples });
}

/* This mirrors ai.js's single root-UCB sample so the benchmark can record
 * endpoint and horizon accounting without altering the production policy. */
export function instrumentedIteration(q) {
  const p = q.state.currentPlayer;
  const width = Math.min(q.candidates.length, Math.max(2, Math.floor(1.6 * Math.sqrt(q.iterations + 1))));
  let c = q.candidates.slice(0, width).find(x => !x.visits);
  if (!c) c = q.candidates.slice(0, width).reduce((best, x) => {
    const score = x.sum / x.visits + 3.2 * Math.sqrt(Math.log(q.iterations + 1) / x.visits)
      + .25 * (x.prior - q.candidates[0].prior) / (1 + x.visits);
    return !best || score > best.score ? { x, score } : best;
  }, null)?.x;
  if (!c) return null;
  let s = applyAction(q.state, c.action), turns = 0, draws = 0, discarded = 0;
  for (let d = 0; d < q.horizon && s.phase !== 'gameover'; d++) {
    while (s.phase === 'draw' && remaining(s)) {
      const beforeDiscarded = s.discarded.length;
      s = drawTile(s, drawFromPublicCounts(s, q.random)); draws++;
      discarded += s.discarded.length - beforeDiscarded;
    }
    if (s.phase === 'gameover' || s.phase !== 'place') break;
    const a = heuristic(s, q.random, { stochastic: true });
    if (!a) break;
    s = applyAction(s, a); turns++;
  }
  const value = utility(evaluate(s), p);
  c.visits++; c.sum += value; c.sum2 += value * value; q.iterations++;
  return { endpoint: endpointKey(s), terminal: s.phase === 'gameover', turns, draws, discarded, depth: 1 + turns, action: c.action };
}

function normalizedGraph(components, oracle = false) {
  const representative = components.map(c => [...c.nodes].sort()[0]);
  const byId = new Map(components.map(c => [c.id, [...c.nodes].sort()[0]]));
  return components.map(c => ({ type: c.type, nodes: [...c.nodes].sort(), tiles: [...new Set(c.nodes.map(n => n.split(':')[0]))].sort(),
    open: c.open, shield: c.shields ?? c.shield, neighbors: c.neighbors ?? 0,
    cities: c.type === 'field' ? (oracle ? c.cities.map(i => representative[i]).sort() : [...c.cities].map(id => byId.get(id)).sort()) : [],
    owners: c.owners ?? (c.meeples ? c.meeples.reduce((a, m) => (a[m.player]++, a), [0, 0]) : []) }))
    .sort((a, b) => a.nodes[0].localeCompare(b.nodes[0]));
}
function verifyOracle(state) {
  const prod = normalizedGraph(graph(state).components);
  const oracle = normalizedGraph(oracleComponents(state, TILES), true);
  if (JSON.stringify(prod) !== JSON.stringify(oracle)) throw Error(`Independent graph oracle mismatch at turn ${state.turn}`);
}
function oracleTurnDelta(intermediate, final) {
  const regular = oracleScore(intermediate, TILES, false).scores;
  let expected = regular;
  if (final) {
    const groups = oracleComponents(intermediate, TILES);
    const afterRegular = structuredClone(intermediate);
    afterRegular.meeples = afterRegular.meeples.filter(m => !groups.some(c => c.type !== 'field' && c.open === 0 && c.nodes.includes(`${m.k}:${m.feature}`)));
    const last = oracleScore(afterRegular, TILES, true).scores;
    expected = regular.map((v, i) => v + last[i]);
  }
  return expected;
}
function createReplayState(seed) { return newGame({ players: 2, starter: 0, mode: 'physical', seed }); }

async function atomicJson(path, value) {
  await mkdir(path.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  const temp = `${path}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2) + '\n');
  await rename(temp, path);
}
async function loadCheckpoint(path, identity) {
  try {
    const data = JSON.parse(await readFile(path, 'utf8'));
    if (JSON.stringify(data.identity) !== JSON.stringify(identity)) throw Error('Checkpoint settings do not match this run');
    return data;
  } catch (error) { if (error.code === 'ENOENT') return { identity, completed: [] }; throw error; }
}

function decisionSeed(gameSeed, turn, seat, key) {
  const salt = Number.parseInt(hash(`${gameSeed}:${turn}:${seat}:${key}`).slice(0, 8), 16);
  return (salt ^ gameSeed) >>> 0;
}
function selectAction(state, policy, gameSeed, decisionMetrics) {
  const started = performance.now(), cpuStarted = process.cpuUsage();
  if (policy.kind === 'heuristic') {
    const action = heuristic(state, rng(decisionSeed(gameSeed, state.turn, state.currentPlayer, 'heuristic')));
    const cpu = process.cpuUsage(cpuStarted);
    decisionMetrics.push({ policy: 'heuristic', decisionMs: performance.now() - started, cpuMs: (cpu.user + cpu.system) / 1000 });
    return action;
  }
  const search = createSearch(state, { seed: decisionSeed(gameSeed, state.turn, state.currentPlayer, policyKey(policy)), horizon: HORIZON });
  const rootPreparedMs = performance.now() - started;
  const roots = search.candidates.length;
  const endpoints = new Set(), terminalEndpoints = new Set();
  let terminalRevisits = 0, terminalSamples = 0, sampledContinuations = 0, totalDepth = 0, maxDepth = 0, totalFutureTurns = 0, totalDraws = 0, totalDiscarded = 0;
  const tSearch = performance.now();
  for (let i = 0; i < policy.budget; i++) {
    const m = instrumentedIteration(search);
    if (!m) break;
    sampledContinuations++;
    if (m.terminal) { terminalSamples++; if (terminalEndpoints.has(m.endpoint)) terminalRevisits++; terminalEndpoints.add(m.endpoint); }
    endpoints.add(m.endpoint); totalDepth += m.depth; maxDepth = Math.max(maxDepth, m.depth);
    totalFutureTurns += m.turns; totalDraws += m.draws; totalDiscarded += m.discarded;
  }
  const searchMs = performance.now() - tSearch;
  const chosen = [...search.candidates].sort((a, b) => b.visits - a.visits || b.prior - a.prior || JSON.stringify(a.action).localeCompare(JSON.stringify(b.action)))[0];
  if (!chosen) throw Error('Search produced no root candidate');
  const cpu = process.cpuUsage(cpuStarted);
  decisionMetrics.push({ policy: policyKey(policy), budget: policy.budget, iterations: search.iterations, rootCandidates: roots,
    rootCovered: search.candidates.filter(c => c.visits > 0).length, rootCoverage: roots ? search.candidates.filter(c => c.visits > 0).length / roots : 0,
    sampledContinuations, uniqueEvaluatedEndpoints: endpoints.size, terminalSamples, terminalRevisits,
    sampledHypotheticalDraws: totalDraws, sampledHypotheticalDiscards: totalDiscarded, meanSampledActionDepth: sampledContinuations ? totalDepth / sampledContinuations : 0,
    maxSampledActionDepth: maxDepth, meanFutureTurns: sampledContinuations ? totalFutureTurns / sampledContinuations : 0,
    solvedEarlyExits: 0, rootPreparationMs: rootPreparedMs, searchMs, decisionMs: performance.now() - started, cpuMs: (cpu.user + cpu.system) / 1000 });
  return chosen.action;
}

function checkActionTurn(state, action) {
  const final = remaining(state) === 0;
  let intermediate;
  if (action.type === 'place') {
    intermediate = applyAction(state, { type: 'place', x: action.x, y: action.y, r: action.r });
    if (action.feature !== undefined) {
      if (action.feature !== null) intermediate.meeples.push({ k: intermediate.last, feature: action.feature, player: state.currentPlayer });
    } else if (action.type === 'meeple') throw Error('Unexpected action');
  } else throw Error(`Expected combined placement action, got ${action.type}`);
  const expected = oracleTurnDelta(intermediate, final);
  return expected;
}

export function replayGame(game) {
  if (!Number.isInteger(game.gameSeed) || game.gameSeed < 0 || game.gameSeed > 0xffffffff) throw Error('Replay requires a valid recorded gameSeed');
  let state = createReplayState(game.gameSeed);
  const envRandom = rng((game.gameSeed ^ 0x56c04a9d) >>> 0);
  let recorded = 0;
  for (const action of game.transcript) {
    if (state.phase === 'draw') {
      if (action.type !== 'draw') throw Error('Trace draw phase mismatch');
      const expectedId = drawFromPublicCounts(state, envRandom);
      if (action.id !== expectedId) throw Error('Trace draw differs from environment RNG');
      state = drawTile(state, action.id); recorded++;
    } else {
      if (action.type !== 'place') throw Error('Trace placement phase mismatch');
      const beforeScores = state.players.map(p => p.score), final = remaining(state) === 0;
      let intermediate = applyAction(state, { type: 'place', x: action.x, y: action.y, r: action.r });
      if (action.feature !== null && action.feature !== undefined) intermediate.meeples.push({ k: intermediate.last, feature: action.feature, player: state.currentPlayer });
      const expected = oracleTurnDelta(intermediate, final);
      const next = applyAction(state, action);
      const actual = next.players.map((p, i) => p.score - beforeScores[i]);
      if (JSON.stringify(expected) !== JSON.stringify(actual)) throw Error(`Independent score oracle mismatch after turn ${state.turn}`);
      state = next; recorded++;
    }
    assertValid(state); verifyOracle(state);
  }
  if (state.phase !== 'gameover' || recorded !== game.transcript.length) throw Error('Incomplete game trace');
  if (JSON.stringify(state.players.map(p => p.score)) !== JSON.stringify(game.scores)) throw Error('Replay final score mismatch');
  return { transitions: recorded, finalScores: state.players.map(p => p.score), legal: true, termination: 'gameover', oracle: 'graph+turn-scoring' };
}

async function runGame(index, scenario, seed) {
  const pair = Math.floor(index / 2), policyASeat = index % 2;
  const gameSeed = (seed + pair * 997) >>> 0, envRandom = rng(gameSeed ^ 0x56c04a9d);
  let state = createReplayState(gameSeed), transcript = [], decisionMetrics = [];
  while (state.phase !== 'gameover') {
    if (state.phase === 'draw') {
      const id = drawFromPublicCounts(state, envRandom);
      state = drawTile(state, id); transcript.push({ type: 'draw', id }); assertValid(state); continue;
    }
    const policy = state.currentPlayer === policyASeat ? scenario.a : scenario.b;
    const action = selectAction(observation(state), policy, gameSeed, decisionMetrics);
    const expected = checkActionTurn(state, action);
    const before = state.players.map(p => p.score);
    const next = applyAction(state, action), actual = next.players.map((p, i) => p.score - before[i]);
    if (JSON.stringify(expected) !== JSON.stringify(actual)) throw Error(`Live independent scoring oracle mismatch at turn ${state.turn}: action=${JSON.stringify(action)}, expected=${JSON.stringify(expected)}, actual=${JSON.stringify(actual)}, priorScores=${JSON.stringify(before)}, nextScores=${JSON.stringify(next.players.map(p => p.score))}`);
    state = next; transcript.push(action); assertValid(state); verifyOracle(state);
  }
  const ws = winners(state), rival = 1 - policyASeat;
  const outcome = ws.length === 2 ? 'draw' : ws.includes(policyASeat) ? 'win' : 'loss';
  const row = { index, pair, gameSeed, policyASeat, starter: 0, scores: state.players.map(p => p.score), winners: ws, outcome,
    winShare: ws.includes(policyASeat) ? 1 / ws.length : 0, margin: state.players[policyASeat].score - state.players[rival].score,
    turnCount: state.turn, discarded: state.discarded, decisionMetrics, transcript };
  row.replay = replayGame(row);
  return row;
}

function percentile(sorted, p) { return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] : 0; }
function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b), sum = sorted.reduce((a, b) => a + b, 0);
  return { n: sorted.length, mean: sum / Math.max(1, sorted.length), median: percentile(sorted, .5), p95: percentile(sorted, .95), max: sorted.at(-1) ?? 0 };
}
export function makeReport(identity, completed, environment, sourceHashes) {
  const allDecisions = completed.flatMap(g => g.decisionMetrics);
  const groups = Object.groupBy ? Object.groupBy(completed, g => g.outcome) : completed.reduce((a, g) => ((a[g.outcome] ??= []).push(g), a), {});
  const pairs = Array.from({ length: identity.pairs }, (_, p) => completed.filter(g => g.pair === p));
  const policyMetrics = Object.fromEntries([...new Set(allDecisions.map(d => d.policy))].map(policy => {
    const ds = allDecisions.filter(d => d.policy === policy);
    return [policy, { decisionMs: summarize(ds.map(d => d.decisionMs)), cpuMs: summarize(ds.map(d => d.cpuMs ?? 0)), rootPreparationMs: summarize(ds.filter(d => d.rootPreparationMs !== undefined).map(d => d.rootPreparationMs)),
      searchMs: summarize(ds.filter(d => d.searchMs !== undefined).map(d => d.searchMs)), iterations: summarize(ds.filter(d => d.iterations !== undefined).map(d => d.iterations)),
      rootCoverage: summarize(ds.filter(d => d.rootCoverage !== undefined).map(d => d.rootCoverage)), uniqueEvaluatedEndpoints: summarize(ds.filter(d => d.uniqueEvaluatedEndpoints !== undefined).map(d => d.uniqueEvaluatedEndpoints)),
      terminalSamples: ds.reduce((s, d) => s + (d.terminalSamples ?? 0), 0), terminalRevisits: ds.reduce((s, d) => s + (d.terminalRevisits ?? 0), 0),
      sampledContinuations: ds.reduce((s, d) => s + (d.sampledContinuations ?? 0), 0), sampledHypotheticalDraws: ds.reduce((s, d) => s + (d.sampledHypotheticalDraws ?? 0), 0), solvedEarlyExits: 0 }];
  }));
  return { version: 1, identity, environment, sourceHashes, status: completed.length === identity.games ? 'complete' : 'partial', completedGames: completed.length,
    outcomes: { wins: groups.win?.length ?? 0, draws: groups.draw?.length ?? 0, losses: groups.loss?.length ?? 0, capped: 0, incomplete: identity.games - completed.length },
    winShare: completed.reduce((s, g) => s + g.winShare, 0) / Math.max(1, completed.length), meanScoreMargin: completed.reduce((s, g) => s + g.margin, 0) / Math.max(1, completed.length),
    pairedSeedDifferences: pairs.map(gs => ({ pair: gs[0]?.pair, seed: gs[0]?.gameSeed, outcomes: gs.map(g => g.outcome), margins: gs.map(g => g.margin), meanMargin: gs.reduce((s, g) => s + g.margin, 0) / Math.max(1, gs.length) })),
    policyMetrics, totalCpuSeconds: completed.reduce((s, g) => s + (g.cpuSeconds ?? 0), 0), totalWallSeconds: completed.reduce((s, g) => s + (g.elapsedSeconds ?? 0), 0), unit: 'one fresh root-UCB sampled continuation; exactly one rollout/continuation per iteration, not a full independent game playout',
    accounting: 'uniqueEvaluatedEndpoints counts distinct exact serialized rollout endpoint states within a decision; terminalRevisits counts duplicate terminal endpoints, not reused tree nodes. There is no expanded intermediate search tree. Root depth is one current action plus future combined turn actions; root candidates are all legal combined placement/meeple actions; solved early exits=0.',
    hiddenInformation: 'The environment draws from public remaining tile counts using a separate RNG. Search observations remove digital RNG state; policies receive only observed state. Search rollout draws are sampled from public remaining counts with an independent decision RNG.',
    games: completed };
}

async function fileHash(path) { return hash(await readFile(path)); }
async function environmentInfo() {
  const { stdout: commit } = await execFileAsync('git', ['rev-parse', 'HEAD']);
  return { node: process.version, platform: process.platform, arch: process.arch, cpus: (await import('node:os')).cpus().length,
    cpuModel: (await import('node:os')).cpus()[0]?.model, commit: commit.trim(), capturedAt: new Date().toISOString() };
}

async function runExperiment() {
  if (!SCENARIOS[scenarioName]) throw Error(`--scenario must be one of ${Object.keys(SCENARIOS).join(', ')}`);
  const scenario = SCENARIOS[scenarioName], seed = int(arg('seed', SEED_BASE), 'seed');
  const identity = { scenario: scenarioName, seed, games: scenario.games, pairs: scenario.pairs, players: 2,
    searchA: scenario.a, searchB: scenario.b, horizon: HORIZON, rollout: 'stochastic tuned heuristic; same evaluator', tieBreak: 'visits desc, prior desc, stable JSON action asc', seatSchedule: 'index mod 2 selects policy A physical seat; policy A stays fixed while seat 0/1 reverses; starter always seat 0',
    environmentSeedSchedule: 'seed + floor(gameIndex/2)*997; paired seats share same environment RNG seed', drawRng: 'seed xor 0x56c04a9d', decisionRng: 'sha256(gameSeed,turn,seat,policy) derived per decision' };
  const checkpointPath = `${outputPath}.checkpoint.json`, checkpoint = await loadCheckpoint(checkpointPath, identity), completed = checkpoint.completed;
  const done = new Set(completed.map(g => g.index));
  const environment = checkpoint.environment ?? await environmentInfo();
  const currentHashes = { ai: await fileHash('carcassonne/ai.js'), core: await fileHash('carcassonne/core.js'), catalog: await fileHash('carcassonne/catalog.js'), harness: await fileHash('scripts/evaluate-carcassonne-budget.mjs'), oracle: await fileHash('test/carcassonne-reference.js') };
  const sourceHashes = checkpoint.sourceHashes ?? currentHashes;
  if (JSON.stringify(sourceHashes) !== JSON.stringify(currentHashes)) throw Error('Checkpoint source hashes differ from current source; refusing mixed-source resume');
  const maxNewGames = cli['max-new-games'] === undefined ? scenario.games : int(cli['max-new-games'], 'max-new-games');
  const requestedIndices = cli['game-indices'] === undefined ? Array.from({ length: scenario.games }, (_, i) => i) : String(cli['game-indices']).split(',').map(x => { const n = Number(x); if (!Number.isInteger(n) || n < 0) throw Error('Invalid game-index'); return n; });
  if (requestedIndices.some(i => i >= scenario.games) || new Set(requestedIndices).size !== requestedIndices.length) throw Error('Invalid or duplicate game index');
  let newGames = 0;
  for (const i of requestedIndices) {
    if (newGames >= maxNewGames) break;
    if (done.has(i)) continue;
    const started = process.hrtime.bigint(), cpuBefore = process.cpuUsage();
    const game = await runGame(i, scenario, seed);
    const cpuElapsed = process.cpuUsage(cpuBefore);
    game.cpuSeconds = (cpuElapsed.user + cpuElapsed.system) / 1e6;
    game.elapsedSeconds = Number(process.hrtime.bigint() - started) / 1e9;
    completed.push(game); completed.sort((a, b) => a.index - b.index);
    await atomicJson(checkpointPath, { identity, environment, sourceHashes, completed });
    const report = makeReport(identity, completed, environment, sourceHashes);
    await atomicJson(outputPath, report);
    console.error(`${scenarioName}: completed ${completed.length}/${scenario.games}; game ${i + 1} ${game.outcome}, margin ${game.margin}, ${game.elapsedSeconds.toFixed(1)}s`);
    newGames++;
  }
}

async function calibrate() {
  const seed = int(arg('seed', 90817231), 'seed');
  const stages = [Number(arg('early', 3)), Number(arg('middle', 36)), Number(arg('late', 66))];
  const budgets = String(arg('budgets', '300,3000,10000')).split(',').map(x => int(x, 'budget'));
  const rows = [];
  for (const targetTurn of stages) {
    const gameSeed = (seed + targetTurn * 997) >>> 0, random = rng(gameSeed ^ 0x56c04a9d);
    let state = createReplayState(gameSeed);
    while (state.phase !== 'gameover' && state.turn < targetTurn) {
      if (state.phase === 'draw') state = drawTile(state, drawFromPublicCounts(state, random));
      else state = applyAction(state, heuristic(state, rng(decisionSeed(gameSeed, state.turn, state.currentPlayer, 'calibration-walk'))));
    }
    if (state.phase === 'draw') state = drawTile(state, drawFromPublicCounts(state, random));
    if (!['place', 'meeple'].includes(state.phase)) throw Error(`Cannot calibrate at turn ${targetTurn}`);
    for (const budget of budgets) {
      const t0 = performance.now(), search = createSearch(observation(state), { seed: decisionSeed(gameSeed, targetTurn, 0, `cal-${budget}`), horizon: HORIZON });
      const prep = performance.now() - t0, endpoints = new Set(), terminalSet = new Set(); let terminalSamples = 0, terminalRevisits = 0, maxDepth = 0, draws = 0;
      const t = performance.now();
      let discarded = 0;
      for (let i = 0; i < budget; i++) { const m = instrumentedIteration(search); endpoints.add(m.endpoint); if (m.terminal) { terminalSamples++; if (terminalSet.has(m.endpoint)) terminalRevisits++; terminalSet.add(m.endpoint); } maxDepth = Math.max(maxDepth, m.depth); draws += m.draws; discarded += m.discarded; }
      const elapsed = performance.now() - t;
      rows.push({ targetTurn, actualTurn: state.turn, boardTiles: Object.keys(state.board).length, legalRootActions: search.candidates.length, budget,
        actualIterations: search.iterations, rootPreparationMs: prep, searchMs: elapsed, totalMs: prep + elapsed, uniqueEvaluatedEndpoints: endpoints.size,
        terminalSamples, terminalRevisits, sampledHypotheticalDraws: draws, sampledHypotheticalDiscards: discarded, maxSampledActionDepth: maxDepth, sampledContinuations: search.iterations, solvedEarlyExits: 0 });
      console.error(`calibration turn ${targetTurn}, ${budget}: ${elapsed.toFixed(1)}ms, ${rows.at(-1).legalRootActions} roots`);
    }
  }
  const output = { version: 1, mode: 'calibration', seed, stages, budgets, horizon: HORIZON,
    unit: 'one root-UCB sampled continuation (one rollout); not a full-game playout', environment: await environmentInfo(),
    sourceHashes: { ai: await fileHash('carcassonne/ai.js'), core: await fileHash('carcassonne/core.js'), catalog: await fileHash('carcassonne/catalog.js'), harness: await fileHash('scripts/evaluate-carcassonne-budget.mjs') }, decisions: rows };
  await atomicJson(outputPath, output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (mode === 'calibrate') await calibrate();
  else await runExperiment();
}





