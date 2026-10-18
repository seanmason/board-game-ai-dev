# Hive benchmark adapter

The importable [adapter](../../../scripts/benchmark-adapters/hive.mjs) exports
`metadata` and async `runGame({seed,seat,players,budget,policy,opponent,scope})`.
It is quiet on import and leaves the existing smoke CLI unchanged. Scope is a
complete two-player classic Hive match, with the production candidate at `seat`.

Default budget is `{ms:100,maxTurns:160,repetitionLimit:4}`. The candidate uses
production iterative-deepening alpha-beta, retains the last completed depth, and
records actual nodes and completed depths. A full depth-one sweep is required;
partially searched deeper roots never masquerade as a completed depth.
One synchronous generator step can exceed the requested time, so actual latency
is recorded rather than claiming a hard time limit. Wall-time search can choose
different completed depths on different hardware despite identical seeds.

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

This is adapter verification only. No 40-setup tournament or promotion has run.

The comparison adapter requires a complete depth-one sweep before honoring its
soft 100 ms budget. It uses the shipped evaluator throughout, with no independent
heuristic fallback. Actual latency includes any depth-one overrun.
