import test from 'node:test';
import assert from 'node:assert/strict';
import { TILE_LIST } from '../carcassonne/catalog.js';
import { newGame, drawTile, applyAction, remaining, rng, placements } from '../carcassonne/core.js';
import { createSearch, runSearch, summary, heuristic } from '../carcassonne/ai.js';
import { instrumentedIteration } from '../scripts/evaluate-carcassonne-budget.mjs';

function stateAt(targetTurn, seed) {
  const env = rng(seed ^ 0x56c04a9d), choice = rng(seed ^ 0x377);
  let state = newGame({ mode: 'physical' });
  while (state.phase !== 'gameover' && state.turn < targetTurn) {
    if (state.phase === 'draw') {
      let n = env() * remaining(state), id;
      for (const tile of TILE_LIST) { n -= state.remaining[tile.id]; if (n < 0) { id = tile.id; break; } }
      state = drawTile(state, id);
    } else state = applyAction(state, heuristic(state, choice));
  }
  if (state.phase === 'draw') {
    let n = env() * remaining(state), id;
    for (const tile of TILE_LIST) { n -= state.remaining[tile.id]; if (n < 0) { id = tile.id; break; } }
    state = drawTile(state, id);
  }
  return state;
}

function assertSearchEquivalent(state, { seed, iterations, expectTerminal = false, expectDiscard = false }) {
  const production = createSearch(state, { seed, horizon: 3 });
  const measured = createSearch(state, { seed, horizon: 3 });
  runSearch(production, iterations);
  let terminal = 0, discarded = 0;
  for (let i = 0; i < iterations; i++) {
    const m = instrumentedIteration(measured);
    if (m.terminal) terminal++;
    if (m.discarded) discarded++;
  }
  assert.equal(measured.iterations, production.iterations);
  assert.deepEqual(measured.candidates.map(c => [c.action, c.visits, c.sum, c.sum2]), production.candidates.map(c => [c.action, c.visits, c.sum, c.sum2]));
  assert.deepEqual(summary(measured).candidates[0].action, summary(production).candidates[0].action);
  if (expectTerminal) assert.equal(terminal, iterations, 'final-tile continuations should evaluate terminal states');
  if (expectDiscard) assert.ok(discarded > 0, 'forced unplaceable sampled tiles should be counted as discarded');
}

test('instrumented Carcassonne iterations exactly match production search early, middle, and terminal-late', () => {
  for (const [turn, seed] of [[3, 81231], [36, 81232]]) {
    const state = stateAt(turn, seed);
    assert.ok(['place', 'meeple'].includes(state.phase));
    assertSearchEquivalent(state, { seed: seed + 100, iterations: 30 });
  }
  const final = stateAt(70, 81233);
  assert.equal(final.phase, 'place');
  assert.equal(remaining(final), 0);
  assertSearchEquivalent(final, { seed: 81333, iterations: 30, expectTerminal: true });
});

test('instrumented continuations follow the rules for a sampled unplaceable tile and redraw', () => {
  let state = drawTile(newGame({ mode: 'physical' }), 'E');
  state = applyAction(state, { type: 'place', x: 0, y: -1, r: 2, feature: null });
  const legalNonCity = TILE_LIST.find(tile => state.remaining[tile.id] > 0 && placements(state, tile.id).length > 0 && !tile.edges.includes('C'));
  assert.ok(legalNonCity, 'fixture needs a legal non-city tile to play before the forced discard');
  state = drawTile(state, legalNonCity.id);
  assert.equal(state.phase, 'place');
  state.remaining = Object.fromEntries(TILE_LIST.map(t => [t.id, t.id === 'C' ? 1 : 0]));
  assertSearchEquivalent(state, { seed: 512, iterations: 8, expectTerminal: true, expectDiscard: true });
});
