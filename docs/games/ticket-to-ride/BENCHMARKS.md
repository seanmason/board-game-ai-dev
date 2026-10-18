# Ticket to Ride benchmark adapter

The importable [adapter](../../../scripts/benchmark-adapters/ticket-to-ride.mjs)
exports `metadata` and async `runGame({seed,seat,players,budget,policy,opponent,scope})`.
It prints nothing when imported. Existing smoke CLI is retained unchanged.
Supported player counts are 2, 3, 4 and 5; the candidate occupies exactly `seat`
and every other seat uses the independent practical ticket-plan baseline.

Default budget is `{samples:128,maxTurns:600}`. The current production sampled
network heuristic receives only `publicObservation` and complete legal root
actions. It performs at least one sample of every root, so actual samples can
exceed 128 when more roots exist. Diagnostics report actual samples and minimum
root coverage. This measures the shipped heuristic, not a promoted method.

The independently implemented baseline finds short additional-train paths for its
own tickets, prioritizes completing overlapping plans, collects their missing
colors and penalizes wildcard use. It does not import the production AI evaluator
or path-cost function, and sees the same actor projection. Opponent hands, tickets
and true deck order never enter either policy. A paired-hidden-state regression
checks identical choices from identical visible information.

Returns the shared match schema: policy IDs, requested/effective budget, seed,
candidate seat, player count, status, shares, winners, scores, margin, action count,
elapsed time and candidate decision latency. Margin is candidate score minus the
highest opponent score, only after exact completed scoring. Caps, supply
adjudication and errors have null shares, winners, scores and margin; they are
never counted as draws. Baseline/all-seat latency and catalog gates are diagnostic
fields. `maxTurns` counts action substeps, including draws and ticket selections.

For the coordinator's 40-setup screen, freeze a seed list and rotate the candidate
through every seat for each seed, separately for every player count. Starting
player is `seed % players`, stored in diagnostics. Pair outcomes at seed/setup
level; do not pool counts or call seat rotations independent games. Current
component audit and rare-ruling limitations remain attached to every record.

Local checks on 2026-10-18 after merging canonical `c3f0cf9`:

- Six combined Hive/Ticket to Ride adapter tests passed with
  `node --test --test-isolation=none test/ticket-to-ride-benchmark.test.js test/hive-benchmark.test.js`.
- One tiny default-sample smoke, seed 19, candidate seat 0, two players,
  `maxTurns:8`: capped, zero illegal actions, null shares; approximately 145 ms
  elapsed, four candidate decisions, approximately 44 ms maximum candidate latency.

This is adapter verification only. No 40-setup tournament or promotion has run.
