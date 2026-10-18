# Wingspan realizable-value experiment

Status: complete, 1,392/1,392 valid games. See the [subsequent all-study synthesis](../../benchmarks/wingspan/2026-10-18-final-selection/REPORT.md) for final results. The following protocol and rationale record the plan before execution.
User requested24 new evaluators reflecting all previous evidence and actual rules.
The active predecessor checkout is not edited and its games are not interrupted.
The deployed browser remains practical-combined at depth4.

## Evidence and rationale

Prior scaling/depth trials did not establish monotonic improvement with compute;
the halted10,000-vs300 and larger matrix studies are incomplete. Practical-combined
then beat original28-12 at100 and24-16 at300 on fresh seeds; combined300 beat100
by27-13. Thus useful evaluation can change the return on computation.
Points-only and hand-only planning lost badly, so retain baseline engine value.
Most later refinements were inconclusive. Row-unlocks won a63.54% screen but
scored18-1-21 against combined in fresh confirmation: selection alone is unreliable.

The latest [24-method screen](../../benchmarks/wingspan/2026-10-18-expansion-screen/REPORT.md)
finished1152 games. Slot-scarcity32-16,+3.10, forest-foundation29-19,+2.73 and
adaptive-portfolio29-19,+2.13 qualified; their360 fresh confirmation games remain
in progress. Bonus-card-option had a large margin but only54.17%win share. Most
unconditional engine additions were neutral. Hypotheses now emphasize competing
resource claims, stranded opportunities, net income and attainable conversions.
No individual game outcomes are used to fit coefficients.

## Rules reviewed

Inspect scoring.js/core.js/actions.js/powers.js: bird points, exact bonus tiers,
round awards, eggs, cached food and tucked cards determine scores. Ordinary food
only breaks ties; ordinary hand cards only score through applicable bonuses.
Respect 8/7/6/5 actions, compatible remaining slots, exact column egg costs,
typed/wild/either food and2:1 substitution, egg capacity/supply, right-to-left
brown powers, optional consumption, once-between-own-turns pink triggers,
white placement timing, shared opponent rewards, and green rank versus blue cap.
The leaf models remain approximations; representative candidate generation and
the rollout policy are unchanged and may limit achievable strength.

## Frozen protocol

24 new methods,48 games each/24 seat-swapped setups versus practical-combined100,
depth4,48-step rollout cap:1152 screen games. Seeds2488400+997*i,i=0..23.
All48 valid, win share>=60%, mean margin>0 to qualify. At most4, ordered by win
share then margin then name. Each gets60games versus practical-combined300 and
60 versus slot-scarcity300,30fresh setup pairs2598400+997*i,i=0..29. Max1632.
Slot-scarcity is a secondary contender, not an established champion. All games
finish within their stage without outcome stopping; failed games remain visible.
Report paired uncertainty, multiplicity across24 exploratory comparisons, runtime
and cap rates. Confirmation remains separate from selection estimates.

Runner scripts/benchmark-wingspan-realizable.mjs --out=NEW_DIRECTORY --workers=24
--after=C:/Users/mason/.codex/benchmark-runs/wingspan-expansion-20261018.
The runner stays alive with stage waiting until predecessor checkpoint says
complete AND its PID has exited. Missing/interrupted predecessors do not count
as completion. At most24 BelowNormal game workers run across the two studies.
Runtime C:/Users/mason/.codex/benchmark-runs/wingspan-realizable-20261018.
Dashboard http://192.168.50.14:52466/#wingspan-realizable.

## Methods

- [12 shared-budget planning methods](../../benchmarks/wingspan/planning-methods.md)
- [12 net-income and conversion methods](../../benchmarks/wingspan/efficiency-methods.md)
`node --test`: 680 passed; syntax: 199 modules; documentation gate passed. New study is launched with the predecessor completion gate.
