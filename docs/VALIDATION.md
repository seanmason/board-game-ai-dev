# Azul rules validation and AI benchmark policy

**Status:** Browser prototype, validated internally against a separately coded rules oracle. **Not externally certified.**

## Rule reference

Official original Azul rulebook (colored-wall variant):
https://cdn.svc.asmodee.net/production-nextmove/uploads/sites/4/2024/06/EN-Azul-Rules-Next-Move-web.pdf

The independent tests capture publisher examples and constraints covering:
factory drafting, first center claim/marker, pattern-line colors and overflow,
top-to-bottom wall placement, connected horizontal/vertical scoring,
floor penalties (1,1,2,2,2,3,3), retained incomplete lines,
recycled discarded tiles, partial last refill, final 2/7/10 bonuses,
and score/complete-row tie-breaking.

## Reproducible validation suite

`npm test` runs focused Node unit tests, rulebook fixtures and search tests.

`npm run verify:gameplay` runs 10,000 seeded complete games, cycling 2–4 players and different starting players. Each action in production is compared against a separately authored reference implementation in `validation/reference-azul.js`, which uses a different representation (tile arrays in pattern lines and integer-color wall cells) and independently implements transitions and scoring.

Every step checks:
- exact legal-action sets;
- phase, round, player turn, marker and starting player;
- current factories and center;
- remaining bag and recycled lid tiles;
- pattern lines, walls and floors for every player;
- current scores, terminal states and winner shares;
- exact per-color conservation of 100 colored tiles.

**Verified run (2026-10-17)**: 10,000 complete seeded games; 894,795 player moves; 66,810 round refills; no differences against the independently written reference; approximately 30 seconds on GitHub's Ubuntu Node 22 runner. This is a differential agreement result, **not proof of perfect compliance with external rules**: two implementations created by the same project may share a mistaken interpretation.

Physical observation correctness has a focused regression for simultaneous factory entry when the bag exhausts mid-refill and lid tiles are recycled. An observed refill is checked as a complete **unordered** multiset, rejecting incompatible counts. A genuine full physical-game transcript has not yet been externally checked.

## Browser tests

Playwright Chromium smoke tests cover manual entry, live worker analysis,
pause/resume retaining simulation totals, reversible move history, hover
highlights, explicit AI Move Now, no autoplay, and starting-player selection.
Still needed: iPad Safari device testing, accessibility audit, and human
scoring comparison of several complete physical games.

## AI baseline

`npm run benchmark:ai -- --games=24 --playouts=64 --players=2 --opponent=heuristic`
runs a deterministic headless tournament. MCTS rotates player seat; games
are seeded; compute and wins are aggregated. Available options:
`--players=2|3|4`, `--opponent=heuristic|random`, `--games=N`,
`--playouts=N`, `--seed=N`.

`/.github/workflows/benchmark.yml` runs a 2/3/4 player baseline and
uploads machine-readable JSON results. Do not interpret small tournament
samples or noncalibrated MCTS outcomes as strong-play proof. Compare
algorithms only with matched positions, compute budgets, varied seats,
sufficient games, and uncertainty estimates.

## Known limitations and follow-up validation

- Arbitrary incomplete physical positions and corrections to previously
  observed tile inventories remain future work.
- Persisting MCTS trees across game transitions/reloads remains deferred.
- Competing reference implementations and actual human-verified complete
  transcripts would provide additional outside-code corroboration.
- AI policy selection, rollout biases, and confidence calibration still
  require substantial research; tournament results have high uncertainty
  at small sample sizes.
- The original publisher's text/art are not copied; this project must pass
  separate rights/licensing review before being labeled a production release.

## Development release gate

A developer-branch Pages preview is permitted when unit tests, 10,000-game
oracle comparison, syntax checks and selected web assets pass. It is a
preview, **not a final public game release**.
