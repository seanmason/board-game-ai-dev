# Board Game AI — Architecture and Implementation Specification

**Status:** Approved direction, incremental implementation  
**Initial game:** Original Azul (standard colored-wall rules, 2–4 players)  
**Repositories:** [development/research](https://github.com/seanmason/board-game-ai-dev) (private) and [public release](https://github.com/seanmason/board-game-ai) (public)  
**Design priority:** Advanced, continuously improving AI analysis of real physical-board games, with standalone digital gameplay as a secondary use case.

## Product goals

1. **Live physical-board companion (primary):** Quickly enter the players' real moves and observed random tile refills. The *physical* board is authoritative; analysis never modifies the recorded game. Undo, corrections, and state reconciliation are required.
2. **Analysis workbench (primary):** KataGo-inspired continuous analysis with ranked candidate moves, visits, expected per-player scores/outcomes, plausible continuations, time/worker budgets, and optional highlights. Allow branching to hypothetical positions without changing the actual game.
3. **Standalone digital play (secondary):** 2–4 human/AI seats, digital random draws, and the same game rules/rendering/search code. **No automatic AI moves**: explicitly press **Play Best Move** to commit the highest-visit analyzed move; an unsearched fallback is not silently played.
4. **Extensible platform:** Additional games must reuse search coordination, observations, event history, persistence, and UI infrastructure while retaining their own rules and visuals.
5. **Public open source:** Original visual presentation; independently written guides; zero required external runtime services; published games deploy statically on GitHub Pages.

## Repository boundary and publication

- **`board-game-ai-dev`:** source of truth for specifications, implementation, experiments, benchmarks, tests and release engineering.
- **`board-game-ai`:** release destination, including complete source for released versions, build instructions, dependencies/licenses, and the finished static site.
- The release pipeline must be explicit, reviewed, reproducible, and must not automatically publish experimental development commits.
- Do not put unpublished experiments, secrets, or private development history in public artifacts.
- License choice and intellectual-property review are gates before the first public release; mechanics are distinct from copyrighted illustrations, text, and trademark presentation.

## Game abstraction

A game module supplies: initial state, legal actions, apply action, current actor/phase, automatic transitions, terminal outcome, canonical state validation, serialization, action descriptions, player observations, and conditional sampling of unknowns/future chance events.

Keep separate:

- **True state** of a digitally simulated game;
- **Observed state/history** collected while tracking a physical game;
- **Belief/forecast state** that samples unknown information consistent with observations.

Never expose a predetermined hidden bag order or future draw to the search algorithm.

For Azul, track 100 tiles (20 each of 5 colors); 5/7/9 factories with 4 tiles each for 2/3/4 players; factories, center, first-player marker, each player's 5 pattern rows, 5×5 wall, 7 floor spaces, scores, bag and discards, turn order and round state. Standard wall placement is fixed by row/color. Scoring resolves completed pattern lines top to bottom; floor penalties by slot are 1,1,2,2,2,3,3 and scores cannot drop below zero. End after wall-tiling of a round with a complete horizontal wall row, awarding 2/7/10 bonuses for each complete row/column/color, then highest score; ties broken by complete rows and finally shared.

Rules reference: [official original Azul rules](https://cdn.svc.asmodee.net/production-nextmove/uploads/sites/4/2024/06/EN-Azul-Rules-Next-Move-web.pdf). The app must author original wording and artwork rather than reproduce the publisher's rulebook/graphics.

## Recording and event history

An append-only, versioned logical event stream with snapshots supports undo, redo, replay, alternative branches and reconstruction. Distinguish observed factory refills, player drafting choices, deterministic scoring, and hypothetical analysis actions.

Physical-game capture needs optimized factory input (mouse/touch/keyboard) and 3-step drafts (source, color, destination). When following real play, refill tiles are entered as **observations**; the software does not invent their values. Digital mode may sample legal draws.

Explicitly represent state errors and uncertain inventory rather than silently manufacturing tiles. Position editing, including late entry into an ongoing game with uncertain bag/discard counts, is on the roadmap; full editor is not part of initial MVP.

## Search subsystem

A search session is tied to a canonical position/information-state hash and settings version. It supports start, pause, cancel, **Play Best Move**, configurable budget, timed updates and interruptions when the observed state changes. Pausing must preserve each worker’s search tree and cumulative playout statistics in memory; resuming continues from these statistics, not from zero. Changing the state or worker count invalidates the search and may discard its tree. Persisting full trees across page reloads is deferred.

Initial baselines: random legal agent, fast heuristic evaluator, UCT Monte Carlo Tree Search, heuristic-guided MCTS. MCTS must support 2–4 selfish players with a vector of outcomes, not a fake two-team zero-sum reduction. Sampling after a refill must respect known tile counts. Track visits, reward sums, expected final scores and estimates of win/shared-win outcomes with appropriate qualifications; do not present these as calibrated probabilities.

Planned experiments: rollout policy, progressive bias, exploration constants, opponent models, tree reuse, simulation throughput, parallel search aggregation, time-versus-strength, and candidate-specific extension of search.

### Browser execution strategy

- A responsive HTML/CSS/SVG interface and TypeScript application services are the intended long-run frontend.
- Rust compiled to WebAssembly is the intended **optimized** game/search implementation, gated by measured need and benchmark equivalence. A dependency-free JavaScript vertical slice is acceptable for the first implementation where immediate compilation/portability and verified correctness are more useful than premature optimization.
- Use independent Web Workers for search parallelism (root-parallel MCTS), rather than relying on shared-memory WebAssembly threads and custom cross-origin isolation headers unavailable through ordinary GitHub Pages configurations.
- Bound memory and per-update computation; keep the main/UI thread free; throttle updates; offer single-worker and mobile-friendly fallbacks. Browsers can suspend background tabs—persist the game, do not promise background compute while suspended.
- For GitHub Pages project sites, all assets must use relative links or a proper `/board-game-ai/` build base.

## UI/workflows

**Companion:** current state, fast refill entry, active player, three-stage move entry, last recorded action, instant undo, quick recommendation; no automatic AI move application.

**Analyst:** candidate move table with visits and outcomes, analysis on/off, worker/time budgets, progress, recommendation highlights, branching and variation inspection, move-quality comparison. **Hovering any candidate** temporarily highlights its source tiles and destination without selecting or playing it. A move in Azul consists of source + color + pattern-row/floor, so a heatmap on squares alone is inadequate.

**Digital:** game setup, human or AI assignment for each seat, explicitly user-triggered **Play Best Move** for AI turns, and the same analysis overlays. There is no fixed autoplay timer. Manual move entry works when analysis is unavailable, but Play Best Move requires an analyzed candidate.

Guide: independently written rules, collapsed by default. Original CSS/SVG tile motifs; touch and mouse controls, keyboard affordances, colorblind-distinguishable patterns, responsive laptop/iPad layout. No agent-generation notices.

## Validation

**Rules:** official examples, scoring chains, floors and marker, row restrictions, overfill/discard, exact tile conservation, bag/discard refill, ties, scoring floor of zero, variants deferred. Generate random legal games and verify invariants.

**Analysis:** no illegal action, no unavailable future information, correct multiplayer reward dimensions, seeded repeatability, correct cancellation by position ID, simulations confined to legal game states, robust aggregation.

**Benchmarks:** simulations/s, computation budget, per-worker scaling, median/p95 UI latency, memory, win rate vs random and heuristic agents, confidence intervals across seeds, and browser/real-device tests.

Initial **targets rather than measurements**: typical move entry ~3 selections after tile setup; p95 input response <100 ms; initial desktop analysis feedback ~1 s; stale analysis canceled <250 ms. Do not claim targets are achieved until tested.

## Implementation sequence and gates

0. Commit this specification and clarify decisions.
1. Complete, tested original Azul game rules and physical-board capture workflow.
2. Add search worker and KataGo-style live move analysis.
3. Benchmark AI and optimize (consider Rust/WASM based on measured bottlenecks).
4. Add digital game mode, public-release packaging, licensing review, and deploy.
5. Validate shared abstractions with a second game; then extend to a position editor.

**Current implementation authorization:** develop and test in the private development repository. Do **not** publish unfinished work to the public release repository.

## Deferred questions

- Open-source license selection before release (MIT vs Apache-2.0 are candidates).
- Camera-assisted factory/state recognition (valuable for physical-board use, not MVP).
- Arbitrary position editor and uncertain late-game inventory.
- Neural policies, learned value estimation, and heavier MCTS methods after baselines.
- Optional PWA/offline-install enhancements and accessibility audit.
