# Boop: rules, search, and validation

Original base game only, researched 2026-10-17. No Halloween ghosts, holiday
ornaments, younger-player variant, publisher art, or copied rulebook prose.

## Project integration review

Reviewed the existing main-based Azul/Pentago engine, worker, session, UI,
reference-validator, packaging and CI boundaries; also inspected the latest
Splendor branch (`af1eed9`) and Wingspan integration/audit context (`90b5076`).
Boop branches from main (`de8b204`) and does not merge either experimental game.
Its pure rules and game-specific search remain separate from the shared worker
lifecycle and atomic session reader. No general framework rewrite is needed.

Primary workflows remain physical-board recording and advanced analysis.
Digital AI seats never autoplay. A suggestion, candidate hover, or uncommitted
placement preview cannot modify the recorded position. Hypothetical variations
have a separate in-memory history; returning restores the recorded history.
Autosave/export preserve the recorded game while exploring a variation.
Variations themselves are not persisted across reload. Correcting a real move
uses undo and a replacement move; an arbitrary position editor is not included.

## Primary rules sources

The publisher-maintained [Dized base rules](https://rules.dized.com/game/3_U-I3tNQyW4X0aaWER7YA/boop)
and [publisher FAQ](https://rules.dized.com/game/3_U-I3tNQyW4X0aaWER7YA/faq)
are the authority used here. Reviewed pages:

- [Setup](https://rules.dized.com/game/3_U-I3tNQyW4X0aaWER7YA/kv2bM8iST--RjDsmGLEYlQ/set-up): eight active kittens per player initially; cats enter through graduation.
- [Booping](https://rules.dized.com/game/3_U-I3tNQyW4X0aaWER7YA/KTmwyoP5Sve2IFMi60vYMg/booping): eight adjacent directions, no chain reaction, occupied destinations block, off-board pieces return to their owner's pool.
- [Graduation](https://rules.dized.com/game/3_U-I3tNQyW4X0aaWER7YA/IVrYQ2VrRpawzrWlKu9tQg/graduating-kittens-into-cats): select one triple; a four-piece line offers its consecutive triples; with eight on the bed, single-piece retrieval is an alternative. Adult cats can be retrieved instead of graduating a kitten. A triple and a singleton are alternatives, never both.
- [Cats](https://rules.dized.com/game/3_U-I3tNQyW4X0aaWER7YA/WiNdG1LiR4qBz5JviHpb5A/cats): kittens cannot push cats; mixed triples return their cats and replace kittens with cats in the pool.
- [Winning](https://rules.dized.com/game/3_U-I3tNQyW4X0aaWER7YA/69R_tkgaS5KTq1IHHKhNtA/winning): three adult cats in a line, or eight adult cats on the bed, checked after all pushes finish.
- FAQ: only the active player wins on their own turn, including when both players have three cats aligned. This overrides assumptions that opponent-made lines instantly win or simultaneous lines draw. Opponent lines remain until that player's turn and may be disrupted before resolution.

`core.js` represents complete turns as placement + exactly one required
resolution. No arbitrary move-limit or repetition draw is added to the rules.
State validation enforces inventory, pools, turn order and terminal conditions;
it is not a proof of reachability from the initial board. Imports validate every
snapshot before replacing any live history.

## AI research and implementation

Primary research: Florian Richoux (2024),
[Injecting Combinatorial Optimization into MCTS: Application to the Board Game boop.](https://arxiv.org/abs/2406.08766),
[full paper](https://arxiv.org/html/2406.08766v1).
The paper combines constrained move selection, expansion, and guided playouts,
and evaluates promotion decisions through a separate heuristic.
Its reported playing strength does **not** describe this implementation.

The dependency-free browser implementation here is an original **guided UCT
MCTS**, with heuristic move ordering, progressive widening, short stochastic
heuristic rollouts, and exact root checks for an immediate own win or an
opponent's immediate winning reply. Root tactical priority precedes visit count.
Unlike the paper, it searches every legal graduation/retrieval as a distinct
complete move and uses no external constraint solver, neural weights, or
permanent heuristic move mask. All legal root moves remain eligible for
expansion as visits grow (until the configured node cap).

The selectable **UCT baseline** uses random expansion/rollouts, the same leaf
evaluator and horizon, and exact already-terminal root win priority. It does not
screen one-move losses. This is a controlled in-project comparator, not an
external Boop engine.

The UI reports 0–100 mean utility. Terminal-rollout wins and terminal sample
counts are recorded separately from cutoff evaluations. A percentage over
completed rollouts is labeled as a biased subset, never a calibrated game win
forecast. The main candidate table never renames heuristic leaves as wins.

Independent root-parallel workers use the shared lifecycle. Pause preserves
trees and RNG in memory. After a real move, only the visited subtree conditioned
on that exact move can survive; imports, corrections, unexpanded moves and method
changes restart search. Worker generations reject stale messages. A 10,000-node
cap bounds expansion; edges store actions/priors rather than precomputed copies
of every child state. Rollout and traversal caps stop analysis cycles without
inventing a game draw. Continuations are sampled most-visited lines, not proofs.

Extra-simulation buttons request at least 250 or 1,000 additional simulations
and pause at the next worker report, so the displayed count may overshoot.
Changing the piece selector filters the placement heatmap; graduation alternatives
are distinguished in the candidate table and preview. Worker count defaults to
one for tablets; up to six can be selected. Browser suspension can stop compute.

## Verification and reproduction

```sh
npm test
npm run check
npm run verify:boop
BOOP_GAMES=1000 npm run verify:boop
npm run benchmark:boop -- --games=24 --ms=25 --opponent=baseline --seed=937291
npm run benchmark:boop -- --games=24 --ms=25 --opponent=tactical --seed=1642911
npm run stage:preview
# Serve preview at 127.0.0.1:8080, then:
npm run browser:boop
npm run package:game -- boop /tmp/boop-site
```

Initial rules validation: **1,000 completed games, 62,480 transitions, 5,203
triple graduations, 8,437 single retrievals, zero capped games or differences**
against the separate two-dimensional oracle in `validation/boop-reference.js`.
The oracle shares neither production transitions nor AI evaluation. It is
separately written within this project, not an externally certified engine.

The Node suite includes targeted movement, size immunity, mixed/overlapping
triples, eight-piece alternatives, active-player-only wins, eight-cat victory,
strict atomic imports, input immutability, seeded search reproducibility,
root tactics, search caps, utility accounting and conditional subtree reuse.

Benchmarks rotate the tested seat through paired identical eight-ply openings,
use held-out seed sets, and include search initialization in the time budget.
Decision timing may overrun by one iteration/startup; actual timings are saved.
Capped games are reported separately and never silently scored as official draws.
Results are exploratory synthetic-opponent evidence, not human Elo.

## Initial strength results

| Opponent | Budget | Guided result | Capped |
| --- | --- | --- | --- |
| UCT baseline | Both nominally 25 ms/move | 24 wins, 0 losses | 0 |
| Tactical greedy | Guided nominally 25 ms/move; opponent untimed one-step | 17 wins, 7 losses | 0 |

The tactical greedy agent shares the evaluator and exact one-turn loss checks.
It averaged 0.81 ms/move versus 26.00 ms/move for guided MCTS, so this second
comparison is **not matched compute**. Baseline actual means were 26.03 ms
(guided) and 25.83 ms (UCT). Small synthetic-opponent samples support keeping
the guided default; they do not establish expert strength. Raw records are
under `benchmarks/boop-*-heldout.json`.

## Hosted verification completed

[Full CI passed](https://github.com/seanmason/board-game-ai-dev/actions/runs/39039893999)
for implementation commit `d328f4d517314feb14e486b193251fad25f5bf09`:

- All **84 Node tests**, JavaScript syntax, asset-closure and standalone packaging.
- Existing **10,000 Azul / 894,795 transitions** and **2,000 Pentago / 58,232
  transitions** reference regressions; existing browser suites still pass.
- Boop's 500-game CI oracle run plus the separate 1,000-game local run above.
- Chromium: manual preview/record, complete graduation alternatives, single cat
  retrieval, terminal wins, pause/resume, conditional reuse, extra simulations,
  hypothetical-branch isolation, invalid-import rejection and recovery, explicit
  AI turns, autosave/reload, touch viewports at 768/390 px, and a real worker in
  the relocated standalone package. Screenshots are retained in the run's
  `boop-browser-evidence` artifact. This is automated browser validation; the
  screenshots have not been independently visually reviewed.

## Remaining release gates

Real-table transcripts, real-device iPad Safari, longer-budget strategic
opponents and release/licensing review remain before a finished publication.
Local Chromium installation was blocked by the runtime's download route; hosted
Chromium validation passed instead. The separate finished-games repository and
live preview deployment are untouched.
