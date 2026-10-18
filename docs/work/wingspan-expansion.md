# Wingspan 24-evaluator expansion

Status: ready to launch after prior confirmation completed656/656.
User explicitly requests at least24 new evaluators, consideration of all prior
trials and rules, and execution of the next batch. Defaults remain unchanged.

## Evidence informing the hypotheses

- Initial low-budget screens established an advantage against the simple heuristic,
  not against a strong external opponent. The 168-game scaling study found no
  reliable monotonic gain above100 with the original evaluator.
- The 10,000-vs300 run stopped at19/20; the larger depth/budget studies stopped
  with119 games retained. These interrupted studies cannot establish convergence.
- The complete72-game depth study had a weak depth12 signal, but every direct
  paired-margin interval included zero.
- Eight-evaluator screening followed by fresh160-game confirmation gave the
  strongest evidence so far for practical-combined:28-12 at100 versus current,
  24-16 at300; combined300 beat combined100 by27-13. Compute may help once the
  evaluator is useful; it is not established as generally ineffective.
- Removing future engine value was harmful: points-only was11-1-28 and the
  hand/egg action-budget planner6-34. Preserve baseline information in this batch.
- Bottleneck, phase, specialization and investment refinements were inconclusive.
- Latest twelve-method screen: row-unlocks30-1-17,+3.25 qualified; synergy,
  tempo and blend showed positive exploratory margins. Bonus-threshold and
  typed-food were unfavorable. Fresh confirmation: row-unlocks26-14,+4.30 vs current, but18-1-21,+0.175 vs practical-combined. This does not support replacing practical-combined.

Sources: prior reports under benchmarks/wingspan, plus runtime checkpoint records
for interrupted runs. No pooling across heterogeneous opponents/budgets for a
single win-rate claim. No fitting new coefficients to individual game outcomes.

## Rules and scope

Rechecked scoring.js, core.js, actions.js and powers.js against the rulebook
review from the previous batch. Score sources are birds, bonuses, round goals,
eggs, caches and tucks. Food is a tie-break, ordinary leftover resources are not
direct points. Respect 8/7/6/5 actions, habitat-column outputs and conversions,
placement payments, egg capacity, right-to-left brown activation, once-between-
turn pink triggers, white placement powers, and green rank versus blue quantity
goals. Evaluators approximate future opportunities; they are not legal planners
or calibrated win probabilities. Candidate generation and rollout policy stay
fixed, so leaf improvements cannot repair missing candidate choices.

## Frozen design

24 new evaluators, each48 games/24 seat-swapped setups versus practical-combined
at100 samples, depth4, step cap48:1152 screen games. Seeds2268400+997*i,i=0..23.
All48 must be valid, win share>=60%, mean margin>0. Select at most4, ranked by
win share, margin, then name. This is exploration, not a significance threshold.
Each qualifier gets60 games versus practical-combined and60 versus row-unlocks,
both300 samples, fresh30 setup pairs2378400+997*i,i=0..29. Maximum1632 total.
The row-unlocks comparator tests the leading recent hypothesis; it is not a
declaration that it is the champion. All stages finish without outcome stopping.
Report setup-paired uncertainty, multiplicity across24 searches, equal-sample
runtime differences, failures and cap diagnostics. Independent confirmation is
essential; do not pool selection into confirmation significance.

24 BelowNormal workers maximum, only after prior game workers finish. Manifest
pins source hashes; individual games and stages checkpoint atomically.
Runner: scripts/benchmark-wingspan-expansion.mjs --out=NEW_DIRECTORY --workers=24.
Runtime: C:/Users/mason/.codex/benchmark-runs/wingspan-expansion-20261018.
Dashboard: http://192.168.50.14:52466/#wingspan-expansion.

Exact new methods: [development hypotheses](../../benchmarks/wingspan/development-methods.md) and [mechanics hypotheses](../../benchmarks/wingspan/mechanics-methods.md). Prior diverse runner stopped on a transient Windows EPERM checkpoint rename after618 per-game records were saved (checkpoint showed617). Resume verified every frozen gameplay hash, preserved the original manifest, and records the orchestration-only retry patch in resume metadata. New runner also retries these locks; a regression test covers transient and permanent failures. Dashboard checks process liveness.

Launched revision b04ce49, PID77552, 24 BelowNormal workers after prior study completed. All647 regression tests pass; documentation and whitespace checks pass. Production defaults unchanged. Prior confirmation is preserved in [diverse results](../../benchmarks/wingspan/2026-10-18-diverse/REPORT.md).
