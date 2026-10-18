# Hive benchmark adapter

The importable [adapter](../../../scripts/benchmark-adapters/hive.mjs) exports
`metadata` and async `runGame({seed,seat,players,budget,policy,opponent,scope})`.
It is quiet on import and leaves the existing smoke CLI unchanged. Scope is a
complete two-player classic Hive match, with the selected candidate at `seat`.

The tactical follow-up at starting revision `f4c61a6` adds `policy:'tactical-v2'`
against `opponent:'incumbent-v1'`. The candidate identity is
`hive-tactical-guard-v2`; the frozen old search identity remains
`hive-production-alphabeta-v1`. The original independent tactical heuristic is
still available as `opponent:'simple-v1'`. `policy:'incumbent-v1'` also supports
explicit reverse comparisons. The [frozen module](../../../scripts/benchmark-adapters/hive-incumbent.mjs)
copies the starting revision's search implementation with only import paths
changed; it is benchmark-only and is never loaded by the browser.

Default budget is `{ms:100,maxTurns:160,repetitionLimit:4}`. The candidate uses
iterative-deepening alpha-beta, retains the last completed depth, and records
actual nodes and completed depths. Both candidate and incumbent require a full
depth-one floor; the candidate additionally requires verified tactical advice.
The candidate's tactical gate checks every root for an immediate win and verifies
every immediate reply to a recommended nonwinning move. It need not certify
irrelevant lower-ranked alternatives; unverified suggestions remain withheld.
Partially searched deeper roots never masquerade as a completed depth.
One synchronous generator step can exceed the requested time, so actual latency
is recorded rather than claiming a hard time limit. Wall-time search can choose
different completed depths on different hardware despite identical seeds.
Candidate and incumbent use the same requested 100 ms soft budget. Actual latency,
first-depth/tactical-floor elapsed time, maximum floor overruns, completed depths
and tactical reply work are recorded, including when the incumbent is the opponent.

The independent tactical opponent first scans all legal moves for an immediate
surround. It ranks remaining positions by queen liberties, liftable pieces,
beetle pins and deployed pieces, then checks every immediate reply to each ranked
candidate until it finds a move that avoids an immediate loss. If none exists it
takes the highest heuristic choice. This is a practical defensive baseline, not
random play; it does not call the production evaluator. Its reply work and actual
decision latency are recorded separately and can exceed the candidate budget.

Only official queen-surround outcomes, including simultaneous surrounds, receive
shares. Two forced passes, a benchmark repetition threshold, a move cap or errors
never become synthetic draws. Noncomplete results have null shares and winners.
Hive has no score objective, so `scores` and `margin` remain null even on completion.
Diagnostics retain terminal/review/cap reasons and all-seat latency.

The coordinator's 40-setup screen should freeze seeds and run both candidate seat
rotations per seed. Starting player is `seed % 2`; seeded baseline tie-breaking
varies otherwise equivalent choices. Pair results by seed rather than treating
rotations as independent confirmation. No shared dashboard or promotion rule is
changed by this adapter. Publisher diagram certification remains an open gate.

Local checks on 2026-10-18 after merging canonical `c3f0cf9`:

- Six combined adapter tests passed; Hive fixtures verify immediate victory and
  avoidance of all immediate losing replies.
- One tiny default-time smoke, seed 19, candidate seat 0, `maxTurns:6`: capped,
  zero illegal actions, null shares; approximately 313 ms elapsed, three candidate
  decisions, approximately 101 ms maximum candidate latency.

Those initial smoke checks were adapter verification only. The completed original
screen is preserved separately in the [six-game study](../../work/ai-comparison-2026-10-18.md).
It does not test this new tactical candidate or establish promotion.

Follow-up validation: `node --test --test-isolation=none test/hive-tactical.test.js
test/hive-benchmark.test.js test/hive.test.js` passed 33 tests. New fixtures cover
immediate victory at depth one, avoiding every immediate winning reply at depth
one, unavoidable loss reporting, withholding unfinished advice, preserving a
verified result during deeper work, unchanged complete legal roots, frozen policy
selection and cooperative worker pause/resume. No original match transcript was
available in the raw study records, so these are explicit hand-constructed tactical
regressions, not claimed replays of a recorded game. Only short capped API checks
ran; no new full-game screen or promotion was performed. Browser verification is
left to the coordinator because this worktree has no local browser dependency.
