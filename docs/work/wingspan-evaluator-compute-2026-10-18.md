# Two-player Wingspan: evaluator quality and compute scaling

Status: implementation and reference canaries complete; execution authorized.
The frozen protocol below governs the strength screen and held-out branch.
The [live dashboard](https://seanmason.github.io/board-game-ai-dev/benchmark-dashboard/?study=wingspan-evaluator)
and its linked raw evidence report own current execution status. No production
AI settings change during this study.
Planning source: `66444d1868c364e11712253d73542d50b9cb0705`.

## Questions and decision

Test three separate propositions: a new evaluator improves play at equal work;
more root samples improve that evaluator's playing strength; and longer rollout
continuations improve it. Also measure whether a candidate's compute benefit
exceeds the reference's benefit. Better evaluation need not imply monotonic
scaling: additional samples estimate a fixed approximate continuation policy,
and longer continuations can introduce more policy error. Treat the user's
assertion as a testable property of this complete system, not a selection rule.

Scope is original Wingspan, two players, ordinary full games. Current production
is opening-plan plus expanded actual setup choices, horizon 4. Preserve the
170-bird edition, observation guards and manual tabletop choices. Retain all
historical favorable, unfavorable and interrupted evidence.

## What earlier work established

- [Practical-combined confirmation](../../benchmarks/wingspan/2026-10-18-confirmation/REPORT.md)
  supported its promotion; its 300-vs-100 result was promising but small.
- [Depth screen](../../benchmarks/wingspan/2026-10-17-depth/REPORT.md)
  and earlier sample scaling did not establish consistent improvements.
- [Specialists](../../benchmarks/wingspan/2026-10-18-specialists/REPORT.md),
  [diverse methods](../../benchmarks/wingspan/2026-10-18-diverse/REPORT.md),
  [mechanics](../../benchmarks/wingspan/mechanics-methods.md),
  [efficiency](../../benchmarks/wingspan/efficiency-methods.md) and
  [final synthesis](../../benchmarks/wingspan/2026-10-18-final-selection/REPORT.md)
  already cover generic engine income, net resource costs, ordered powers,
  repeaters and many blends. Screen winners frequently failed fresh confirmation.
  Another large coefficient sweep would repeat those weaknesses.
- [Opening confirmation](../../benchmarks/wingspan/2026-10-18-opening/REPORT.md)
  adopted the combined setup expansion and evaluator (117–83); evaluator-only
  was 106–94 and failed its gate. Compare against that adopted package, rather
  than silently reverting to practical-combined or legacy current.

## Phase 0: trustworthy rollout endpoints and diagnostic fixtures

Source inspection found a prerequisite in `wingspan/rollout.js`: its horizon
counts subsequent ordinary actions across both seats, excluding root/setup/power
choices, but the loop can stop immediately after an action enqueues powers.
The last action's brown/pink chain and turn/round settlement may then be absent
from the evaluated leaf. Reproduce with a failing fixture, then make a research
pipeline that settles the pending action completely before evaluating its leaf.
An action-turn boundary must not start another ordinary action after the horizon.
Keep a finite transition cap; reaching it before settlement is an explicit cap,
not a valid horizon endpoint. Terminal evaluation must equal exact game score.

Define two frozen references:

- R0: the actual deployed opening strategy and old endpoint behavior, retained
  in a benchmark-only snapshot of its actual pipeline for the final practical
  comparison. An old evaluator name passed through corrected rollout code is
  not R0; retain its original endpoint, root generation, priors and source hashes.
- R: the same adopted evaluator, setup roots and continuation policy with the
  endpoint correction shared by all experimental arms. R is the common study
  baseline, not a claim that a new reference already ships.

The reference correction is a methodological prerequisite, not evidence that
any proposed evaluator is stronger. The final equal-time comparison includes R0
so release evidence concerns the actual deployed package.

Before playing strength games, test:

- Raven with/without a second bird that can supply its egg, early/late timing,
  useful typed-food demand versus saturated food, and insufficient egg capacity.
- Franklin's Gull/Killdeer with/without eggs and useful card demand.
- Draw/tuck and food/tuck chains in both placement orders; same birds in other
  habitats; legal repeat targets and optional skips; two- and three-bird rows.
- Horizon 1/2/4/12 when the last action starts brown or pink effects, round-end
  goals, extra plays and game end; verify resolved leaf phase/pending queue.
- Feasible versus impossible two-placement plans, exact typed food conversion,
  egg-column payments and resources shared between plans.
- Privacy, deterministic seeded replay, terminal equality, zero-future residuals,
  full coverage of supplied root choices and retained human move completeness.

Use 24 predeclared legal development positions (including negative controls)
with paired hidden worlds and short independently checked traces. These are
mechanism diagnostics, not a representative win-rate sample. Do not condition
primary full-game deals on seeing a raven, or infer that early raven play causes
victory from post-game correlations.

Check the costs and activation order against the
[official publisher rules reference](https://wingspan.rulepop.com/), with its
base-game scope selected. The code ledger maps ravens to power 33, Gull/Killdeer
to 41, general repeaters to 43 and predator repeaters to 49. Existing source
modules remain the implementation map; no expansion rule enters this study.

Run exactly eight canary full games (four paired setups, disjoint from all study
seeds), checking both rollout lengths and high/low budgets. Separately time the
fixed development positions to estimate throughput. Freeze the numeric
coefficients, source hashes, task list and equal-time budget before strength
outcomes are examined. Failed diagnostics block the study; do not silently
reduce the sample or reinterpret capped runs.

## Four evaluator hypotheses plus the reference

All challengers retain the adopted opening treatment. Use deterministic,
point-valued corrections and a shared local resource ledger. Do not award both
a resource's full future value and the full value of an action saved producing it.
Existing printed score, current resources, goals and unsupported power treatment
must not be counted twice. Unsupported mechanisms contribute no invented yield.

| Key | Hypothesis | Distinction from earlier variants |
| --- | --- | --- |
| R | Corrected adopted opening-plan reference | Common control at every compute setting |
| E | Exceptional powers compress actions | Charge exact power costs and credit feasible ordinary actions displaced by raven/Gull/Killdeer/repeat output, rather than a fixed premium or gross token yield |
| S | Sustainable ordered row chains | A bounded one-/two-activation ledger includes base row output, actual right-to-left production/consumption, egg capacity, card/food stocks, optional skips and repeat eligibility; credit interaction beyond the same powers modeled separately |
| P | Early investment and payback | Own known hand only: at most two placements, exact payments and one shared action budget; compare feasible future operation with the adopted opening plan and fade value when payback time expires |
| B | Conservative combination | Predeclared half-weight combination of E/S/P residuals, sharing resources and a feasible plan instead of summing incompatible uses |

E/S/P each have a proposed correction cap of plus/minus four points; B has a
plus/minus six point cap. Precise formulas and constants must be specified in
method documentation and frozen after fixture work, before any screen results.
Choose no coefficients by replaying successful historical seed outcomes.

Evaluate all habitats. Grassland should earn preference through sustainable
combined output, not a blanket habitat bonus. Rare-power support should generalize
by effect and feasibility; no Raven-implies-victory constant. B and its atomic
components supply useful ablations without launching dozens of blends.

## Phase 1: crossed compute screen

Use the following four cells for each of R/E/S/P/B:

| Cell | Total root samples per decision | Subsequent ordinary-action horizon |
| --- | ---: | ---: |
| Low / short | 100 | 4 |
| High / short | 300 | 4 |
| Low / long | 100 | 12 |
| High / long | 300 | 12 |

Each cell faces the SAME fixed R opponent at 300 samples / horizon 4, on 40
fresh independent deals with both candidate seats: 5 evaluators × 4 cells ×
40 deals × 2 seats = **1,600 games**. The same 40 deals across cells support
within-deal contrasts. They remain 40 independent deals, not 1,600 independent
replicates. Actual outcomes include the game's final tiebreak.

Samples are total root allocations, not samples per move or full-game playouts.
Horizon 12 spans both players, roughly six ordinary actions each; it is not
12-ply minimax or twelve own turns. Report measured own/opponent action counts
rather than assuming a fixed distribution.

Freeze all other inputs: root candidate generation, actual opening expansion
for BOTH players, unchanged simulated setup generator, rollout policy, UCB
exploration 3.5, root-prior weight 0.18, evaluator reward weight 0.82, and a common
192-transition rollout cap. Use max(requested samples, supplied root count) and
report any coverage-floor overhead. Candidate pruning is still present relative
to complete legal play; zero unvisited supplied roots does not mean exhaustive
legal search. No evaluator gets a private candidate expansion.

The existing opening runner expands only the designated challenger. It therefore
needs a symmetric configuration layer for this study; do not reuse its opponent
behavior unmodified. Also parameterize the cap so both sides receive the same
192-transition limit. Any cap at a pending effect invalidates that result for a
strength gate, while retaining the raw record.

For every evaluator report sample improvement at each horizon, horizon
improvement at each sample budget, their interaction, and each gain minus R's
gain on the same deals. A strong evaluator can have a flat compute curve; a weak
one can gain from additional work. Do not define a good evaluator by first
selecting only those with positive scaling.

## Selection and fresh direct confirmation

Select at most ONE challenger from E/S/P/B using ONLY its 300-sample / horizon-4
screen against R: at least 55% winner share, positive mean score margin, all 80
valid complete games and no coverage failures. Rank by winner share, then margin,
then stable key. If none qualifies, retain R as the experimental reference.
Do not use the best-looking grid cell, scaling slope or secondary diagnostic as
a substitute selection endpoint.

With a qualifying challenger C, predeclare six confirmation comparisons:

1. C versus R, both 300 / 4: equal-work evaluator improvement.
2. C 300 / 4 versus C 100 / 4: direct sample scaling.
3. C 300 / 12 versus C 300 / 4: direct horizon scaling.
4. R 300 / 4 versus R 100 / 4: reference sample scaling.
5. R 300 / 12 versus R 300 / 4: reference horizon scaling.
6. C versus deployed R0 at a common time budget and horizon 4: practical whole-
   package comparison, including the shared endpoint correction and evaluator cost.

The grid estimates compute effects for all five evaluators. These direct fresh
scaling tests confirm only C and R: sample scaling at horizon 4, and horizon
scaling at 300 samples. Do not generalize those claims to every setting.

Each comparison receives 100 wholly fresh paired setups / 200 games. Use
separate disjoint seed blocks per comparison, disjoint from all development,
canary, screen and historical retained Wingspan tasks. This stage has at most
**1,200 games**. If no challenger qualifies, run only reference sample scaling,
reference horizon scaling, and R versus R0 at equal time: **600 games**.

Set the equal-time target T before screening to the median measured time R needs
for public-observation preparation, candidate generation and 300 samples at
horizon 4 across the fixed development positions, rounded up
to a whole millisecond. Both sides get T for this same total decision interval,
with search time reduced by already spent observation/candidate-generation time;
both retain the mandatory root-coverage floor, so T is soft. Interleave balanced
seat pairs under comparable worker load and record all concurrent processes.
Report overrun frequency, actual samples, p50/p95/max decision latency and total
time. Call this a matched-requested-time comparison. Only describe realized time
as approximately equal if the arm mean-time ratio is between 0.90 and 1.10 and
the p95 ratio between 0.80 and 1.25. Never claim equal hard deadlines or equal
sample work. A practical adoption gate additionally requires candidate mean
time no more than 1.10 times R0 and p95 no more than 1.25 times R0; a cheaper
candidate is acceptable. These tolerances are usability choices, not statistical
proof that the time distributions are equivalent.

The maximum batch is **2,808 full games**: eight canaries + 1,600 screen + 1,200
confirmation. No additional automatic tournaments follow. Fixed N, no favorable-
outcome stopping, seed replacement or invented losses/draws. Source changes or
invalid observations stop dependent work; retain failed/partial evidence and
record any amended study as a distinct execution.

## Analysis, claims and promotion

The independent unit is the setup-pair mean. Use paired cell differences across
shared screen seeds and paired-t descriptive 95% intervals for win share, score
margin, sample effects, horizon effects and interaction differences. Do not compare
overlap of separate per-arm intervals or pool selected screening games into fresh
confirmation. Score, eggs, cached/tucked points, bonuses and goal points are
secondary mechanism outcomes, not interchangeable primary wins.

For the at most six fresh superiority claims, use a fixed Bonferroni allocation
of one-sided alpha 0.05/6 per claim, even when fewer comparisons are executed.
This provides approximate family error control under the paired-t assumptions,
not a distribution-free guarantee. A claim requires the corresponding setup-paired one-sided t lower bound above
50% winner share, positive mean margin, all scheduled results valid/complete and
zero illegal actions, errors, unvisited supplied roots or rollout safety caps.
Report ordinary 95% intervals as descriptive alongside the corrected decision.
The t bound is approximate; degenerate samples must not imply perfect certainty.
Do not interpret failure to clear a gate as equivalence or proof of no benefit.

A deployment recommendation needs both equal-work C-versus-R evidence and the
matched-requested-time C-versus-actual-R0 evidence, with the stated latency gates. Compute scaling is assessed separately:
no promotion solely because more compute beats less. Any selected horizon or
budget outside these confirmed comparisons requires separate evidence. Preserve
production defaults until those results are reviewed. A hundred paired deals
may settle a substantial effect; this batch is not powered to rule out every
three-percentage-point gain.

A clear negative compute effect for an independently strong evaluator would
contradict the assertion within this tested regime. A flat estimate with a wide
interval would remain inconclusive. Fixed-opponent grid and direct matches may
disagree because of matchup effects; report both without choosing whichever is
more favorable.

If extra samples help but depth hurts, inspect rollout-policy bias and endpoint
metrics. If both fail, check candidate omissions and power-choice frequencies
before proposing another evaluator sweep. Rollout powers currently share coarse
policy grades; fixing that policy or the persistent root prior would be a separate,
explicit ablation, not an unrecorded change halfway through this matrix.

## Instrumentation, execution and publication

Record each arm's configuration, source revision/hashes, seed, seat, true final
outcome, score components, actions by round, early bird placement/availability,
row activation counts, actual power costs/yields, and uncertainty-safe counts.
Decision diagnostics include candidate count/family, root visits and variances,
prior and leaf reward contributions, completed action horizon, resolved leaf
phase, pending count, step-cap frequency, terminal rate and runtime. Detailed
traces can be restricted to the predeclared diagnostic positions and a fixed
sample of full games; aggregate counters stay cheap and must not change RNG.

Run at most 18 BelowNormal benchmark workers, with a hard ceiling of 24 including
all concurrent benchmark families. No unrelated strength tournament overlaps.
First publish timing-derived projected cost; do not assert an ETA before the
pilot. Do not change live sources while workers run. Coordinator owns the
runner/analysis/dashboard; separate owners can implement evaluator modules and
regression fixtures in isolated worktrees from a shared pushed revision.

Prepare source-hash manifests, exact runtime/source archives, raw per-game files,
strict expected-task validation, paired summaries and a public Pages dashboard.
The dashboard shows all cells, progress/health, actual cost, fresh versus screen
stages and incomplete outcomes. The report distinguishes reference corrections,
evaluator gains, compute scaling and practical equal-time performance. Preserve
all earlier studies and the original production source snapshot.

## Immediate implementation order

1. Add the resolved-boundary regression, correct the research pipeline, and freeze
   R0/R plus the common information/candidate interface.
2. Implement E/S/P and the constrained blend, documenting baseline subtraction,
   costs, caps and supported powers. Review fixtures independently.
3. Build and validate the symmetric crossed runner, task/seed audit, diagnostics,
   strict analysis and dashboard; run eight canaries and timing calibration.
4. Freeze formulas and exact task/source manifests, then execute the bounded
   screen and its predeclared held-out branch. Publish all outcomes and review
   adoption against the above separate gates.


## Preflight implementation notes

The eight reference canaries finished at the initial integrated source, with
exact source bytes archived beside their manifest. Subsequent evaluator ledger
corrections affect challenger residuals only; the reference delegates exactly
to adopted opening-plan. Independent fixtures cover those corrections before
screening. Runner validation was also tightened for source inventories, root
coverage, conservative dashboard intervals and the eighteen-worker study limit.
The final timing calibration and study manifest are frozen after those changes.
Power-flow counters describe net resource changes for the pending power owner,
not exhaustive gross attribution across shared/nested powers.
