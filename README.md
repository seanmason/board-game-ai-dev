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
4. MCTS starts automatically in parallel browser workers. Rankings, simulated win estimates, and score projections update continuously. Highlight an option without changing the recorded state.
5. Use undo/redo, timeline navigation, and export/import to preserve and correct observations. Analysis never commits a suggested move automatically in physical mode.

**Digital gameplay:** switch to Digital game and start a new session. Factories are drawn in the browser. Each seat can be Human or AI; AI seats act after a short computation period. "AI move now" bypasses the wait.

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

The search tree models deterministic draft actions in the **current** round and samples future random refills in rollouts; it does not yet retain a tree across moves or apply a learned value function. Its win estimates are policy-dependent and should not be read as calibrated probabilities. Manual late-game position editing, gray-wall variant, camera recognition, automatic worker throttling and native Rust/WASM optimization are roadmap work. Public deployment, licensing review, and stronger cross-browser testing are release gates.

See [architecture specification](docs/ARCHITECTURE.md) for intended long-run components and acceptance criteria. Official game rules: [Next Move Games](https://cdn.svc.asmodee.net/production-nextmove/uploads/sites/4/2024/06/EN-Azul-Rules-Next-Move-web.pdf).
