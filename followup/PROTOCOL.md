# Hive and Ticket to Ride follow-up — 2026-10-18

The completed six-game screen identified concrete tactical and planning weaknesses.
This follow-up preserves that evidence and changes only these two games, the
benchmark task configuration, and directly related documentation.

## Changes and gates

Hive: mandatory immediate-win and immediate-loss-reply protection before publishing
advice. Complete human legal actions remain available. This is a correctness
safeguard under COMMON, not an automatic claim of improved playing strength.

Ticket to Ride: implement source-supported empty-deck/discard restrictions. Keep
unsupported supply rulings explicit unless the user separately selects a named
simulation convention. Add one practical route-planning candidate, leaving the
incumbent browser policy unchanged until validation and confirmation support it.

## Predeclared bounded comparisons

Use twelve BelowNormal workers, never more than 24. Freeze source hashes, policies,
budgets and tasks before running; record every incomplete outcome. No new study
of the four successful games is needed now.

- Hive: tactical-v2 versus incumbent-v1 and the unchanged simple-v1 defensive
  comparator, 40 paired setups each. Seed bases 6182600 and 6282600. Both search
  policies receive the same soft 100 ms budget and mandatory first-depth floor;
  actual cost includes required tactical verification. A strength-confirmation
  candidate must reach at least 55% share against the incumbent, with no illegal
  actions/errors and full outcome completion. If it qualifies, use 100 fresh
  paired setups (seed base 7182600), requiring a one-sided 97.5% paired-t lower
  bound above 50%. Hive has no numeric score margin. If cost differs materially,
  report the limitation and do not make an equal-time strength claim.
- Ticket to Ride: planning-v2 versus incumbent-v1 and unchanged simple-v1 at three
  and four players, 40 setups per matchup with all candidate seats rotated.
  Seed bases 6382600 and 6482600 respectively. Candidate ranking may be
  deterministic; the incumbent retains 128 samples and all-root coverage.
  Screen threshold: share at least 1/n + 5 percentage points and positive margin
  versus the best opponent in both player-count strata against both opponents.
  No illegal actions/errors; all outcomes must resolve for promotion. If both
  strata qualify, confirm versus incumbent on 100 fresh setups each (seed base
  7382600), requiring each stratum's one-sided 97.5% paired-t lower bound above
  1/n and positive mean margin. Do not pool player counts. Unresolved outcomes
  prevent promotion; preserve them and retain the incumbent instead.

Only one candidate per game is considered. No adjustment based on favorable
interim results. Adverse/inconclusive evidence stays published. Tactical rules
fixes may ship independently of a strength claim; speculative planning changes
remain opt-in unless the stated gate passes.

## Opening-coverage amendment before valid screening

The first Hive incumbent comparison was stopped after 49 recorded repetition
outcomes: seeds only varied the starting player, so two deterministic policies
replayed the same initial opening. Those records are retained and excluded from
strength evidence. No policy tuning followed. Both valid Hive screens and any
confirmation instead use the same seeded six-ply legal prefix for each seat
rotation, recording exact actions and position hashes. Budget openingPlies=6
is explicit; the original six-game study/default adapter remain unchanged.
Ticket to Ride already has seeded shuffled setups and needs no opening change.
