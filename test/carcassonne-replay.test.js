import test from 'node:test';
import assert from 'node:assert/strict';
import { TILE_LIST } from '../carcassonne/catalog.js';
import { newGame, drawTile, applyAction, remaining, rng } from '../carcassonne/core.js';
import { heuristic } from '../carcassonne/ai.js';
import { replayGame } from '../scripts/evaluate-carcassonne-budget.mjs';

test('benchmark replay uses the recorded gameSeed and rejects corrupted draws', () => {
  const gameSeed = 82473119;
  const environment = rng(gameSeed ^ 0x56c04a9d), choices = rng(42);
  let state = newGame({ players: 2, starter: 0, mode: 'physical', seed: gameSeed });
  const transcript = [];
  while (state.phase !== 'gameover') {
    if (state.phase === 'draw') {
      let n = environment() * remaining(state), id;
      for (const tile of TILE_LIST) { n -= state.remaining[tile.id]; if (n < 0) { id = tile.id; break; } }
      transcript.push({ type: 'draw', id });
      state = drawTile(state, id);
    } else {
      const action = heuristic(state, choices);
      transcript.push(action);
      state = applyAction(state, action);
    }
  }
  const game = { gameSeed, transcript, scores: state.players.map(p => p.score) };
  const result = replayGame(game);
  assert.equal(result.legal, true);
  assert.equal(result.transitions, transcript.length);
  assert.deepEqual(result.finalScores, game.scores);
  const corrupted = structuredClone(game);
  corrupted.transcript[0].id = transcript[0].id === 'A' ? 'B' : 'A';
  assert.throws(() => replayGame(corrupted), /Trace draw differs from environment RNG/);
  assert.throws(() => replayGame({ ...game, gameSeed: undefined }), /valid recorded gameSeed/);
});
