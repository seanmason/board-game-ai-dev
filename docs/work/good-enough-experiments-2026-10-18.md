# Practical strength, compute scaling and Hive confirmation — 2026-10-18

## Questions and interpretation

The objective is a useful, responsive AI against a reasonable opponent, with
reliable legal advice and completed games. Increasing win share with compute is
a diagnostic for this search/opponent combination, not a necessary or sufficient
condition for good play. More samples can converge to a biased continuation model;
a good deterministic heuristic may need no samples. Human strength is not measured.

Love Letter and Sushi Go are the cleanest existing sampled policies to test.
Lost Cities and Jaipur defaults are deterministic; increasing an unused iteration
parameter would not test compute scaling. Ticket to Ride's supply adjudications
remain unresolved. Hive's promising history tie-break gets fresh confirmation of
completion improvement, not a general strength-promotion trial.

## Frozen batch: 1,200 records

Three families run concurrently, six BelowNormal workers each: at most eighteen
workers total. Within each family low/control completes before high/candidate.
Every configuration is planned before execution; no interim tuning or optional
success stopping. Source code remains frozen until all six arms finish. Record
all outcomes and actual costs; stop all families for illegal moves, execution
errors or analysis failures and retain interrupted evidence. Caps/repetitions are
incomplete outcomes, never silently converted to draws or losses.

| Family | Low/control | High/candidate | Players | Setups | Seed base | Games |
|---|---|---|---|---:|---:|---:|
| Love Letter | production-default,64 samples | same policy,512 samples | 2 and4, separate strata | 40 each | 9182600 | 480 |
| Sushi Go | production-default,64 samples | same policy,256 samples | 4 | 40 | 9282600 | 320 |
| Hive | tactical-v2,100ms | history-v1,100ms | 2 | 100 | 9382600 | 400 |

Seeds advance by997. Rotate the controlled candidate through every seat against
unchanged `simple-v1` opponents on identical setup seeds within each comparison.
LL/SG play full matches. Sampling seeds match browser173/611, respectively.
Requested iteration counts have an all-root coverage floor, so report actual
iterations per decision and coverage. More samples do not deepen the rollout:
Love Letter optimizes current-round share; Sushi Go rolls to current-round end.
The simulated opponents omit some prior private histories, an explicit model
limitation. True hidden state is not passed to candidate searches.

Hive retains six-ply seeded legal openings, maxDepth5, maxTurns160 and repetition
limit4. Both arms preserve immediate tactical safety and the mandatory depth-one
floor, which may overrun the soft100ms budget. Fresh seed range is disjoint from
the prior40-setup screen. The primary question is completion against the same
independent defensive heuristic; it is not a direct head-to-head strength trial.

## Predeclared analysis and decisions

Use independent setup means, averaging every seat rotation, as the unit of
uncertainty. Do not pool games or player counts. Approximate paired Student-t
intervals compare high/candidate minus low/control on the same setups.

**Compute screens:** paired winner-share differences are primary, separately for
Love Letter2p, Love Letter4p and Sushi Go4p. Show each arm's share versus the named
heuristic, score margins where defined, actual iteration/coverage counts and
latency. A positive scaling signal requires at least+5 percentage points and a
95% paired difference interval above zero, with all outcomes complete and no
errors. Three exploratory comparisons are not multiplicity-adjusted confirmation
or a promotion gate. If incomplete outcomes occur, include all-scheduled bounds
and label complete-pair comparisons conditional; no automatic follow-up tournament.

**Hive confirmation:** primary completion difference across all100 setups,
including caps and repetitions. Confirmation requires at least+10 percentage
points, one-sided97.5% paired-t lower bound above zero, and no lower all-scheduled
observed-win lower bound than control, with zero illegal/errors. This checks one
previously selected candidate on fresh setups. Report incompleteness and full
winner-share sensitivity bounds; the lower-bound score treats incomplete games
as zero only for the mathematical bound, not an adjudicated loss. Confirmation
of completion does not establish a general winning-strength gain or automatically
promote the browser policy. No additional tournament follows within this batch.

For all comparisons report paired completion differences, conditional shares,
all-scheduled outcome bounds, per-decision pooled cost and equal-game-weighted
paired latency. Wall-clock cost is affected by concurrent desktop load; LL/SG
fixed iteration choices are not time-budget dependent. Sequential arms and
concurrent family composition limit exact latency comparisons. Keep historical,
negative and interrupted evidence. Production/browser defaults stay unchanged.

## Reproduction

Existing `scripts/benchmark-comparison.mjs` supports all six arms; no game policy
changes are needed. Use `--workers=6`, `--opponent=simple-v1`, distinct `--out`
folders and the table's policy, iteration/time budget, player counts, seed base
and setup count. Frozen manifests, raw records, execution receipts, analysis and
commands will be published on the existing development evidence branch.


## Closed outcome

All 1,200 scheduled records finished execution at frozen revision
`b7336fac301169c1ced2d87d710d63031418270f`, with zero illegal actions or errors.
All 800 Love Letter/Sushi Go matches completed; Hive had 237 complete, 141
repetition/unresolved and 22 capped records. Two-player Love Letter met the
exploratory compute criterion; four-player Love Letter and Sushi Go did not.
Hive met its completion criterion under the recorded concurrent execution
schedule, with substantial incompleteness and soft-budget latency remaining.
No browser policy or budget was promoted, and no extra tournament followed.

The [report and raw evidence](https://github.com/seanmason/board-game-ai-dev/blob/benchmarks/ai-comparison-2026-10-18/good-enough/REPORT.md)
preserve the original pre-run protocol separately from this closure. Current
interpretation lives in each game's overview; the report includes paired
intervals, costs, limitations, source-byte archive and result hashes.
