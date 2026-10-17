# Tabletop Observatory — Board Game AI

A browser-native strategy-game companion and analysis workbench. The first game is **original Azul**.

**Primary workflows:** enter moves and factory refills from a real physical board, or analyze candidate actions and continuations in a KataGo-inspired interface. Full digital play is also supported as an experimental secondary workflow.

**Status:** Development prototype, not yet publicly released. Rules and AI performance are being validated. Development takes place in this private repository; released, source-available standalone games will be published separately at [board-game-ai](https://github.com/seanmason/board-game-ai).

## Start locally

No dependencies or build step:

```sh
python3 -m http.server 8080
```

Open http://localhost:8080/. The app uses native JavaScript modules and Web Workers, so serve over HTTP rather than opening `index.html` as a file.

## Use with a physical game

1. Select **Physical board** and 2–4 players, then start a session.
2. Choose a tile color and tap factory slots to record the **actual observed** tiles. Number keys 1–5 select colors; Erase clears a slot. Confirm when the entire round has been entered.
3. Choose a source/color tile group in the factory offer, then click a legal pattern row (or the floor) on the current player's board. Repeat as real players move.
4. MCTS starts automatically in parallel browser workers. Rankings, simulated win estimates, and score projections update continuously. **Hover over a candidate** to temporarily highlight its source tiles and destination; click to pin a preview. No hover changes the recorded state.
5. **Pause analysis** to stop using CPU while retaining each worker’s MCTS tree, accumulated visits, and results in memory. **Resume analysis** to continue the same search; its simulation count should increase from the previous value.
5. Use undo/redo, timeline navigation, and export/import to preserve and correct observations. Analysis never commits a suggested move automatically in physical mode.

**Digital gameplay:** switch to Digital game and start a new session. Factories are drawn in the browser. Each seat can be Human or AI. **AI players never move automatically**: MCTS searches indefinitely while that position is displayed; click **Play Best Move** on an AI turn to use its current highest-visit candidate. Wait for at least one result before playing.

## Technical notes

- `src/azul.js`: fully serializable state, rules, inventory, legal action and scoring transitions.
- `src/mcts.js`: independent UCT MCTS with rollout heuristic and per-player statistics.
- `src/ai-worker.js`: cancelable batch-based search in module Web Workers.
- `src/app.js`: observation entry, digital game, state history, and position analysis.
- `styles.css`: original, responsive tiles and UI. No game art is bundled.
- `test/`: Node's built-in test runner.

```sh
npm test
npm run check
```

### Current limitations

The search tree models deterministic draft actions in the **current** round and samples future random refills in rollouts. **Pause/resume retains the exact tree and playout statistics as long as this browser tab remains alive.** A changed position, changed worker count, page reload, or browser-tab eviction starts a fresh search; tree reuse across positions or refresh is not yet implemented. It also does not yet apply a learned value function. Its win estimates are policy-dependent and should not be read as calibrated probabilities. Manual late-game position editing, gray-wall variant, camera recognition, automatic worker throttling and native Rust/WASM optimization are roadmap work. Public deployment, licensing review, and stronger cross-browser testing are release gates.

See [architecture specification](docs/ARCHITECTURE.md) for intended long-run components and acceptance criteria. Official game rules: [Next Move Games](https://cdn.svc.asmodee.net/production-nextmove/uploads/sites/4/2024/06/EN-Azul-Rules-Next-Move-web.pdf).
