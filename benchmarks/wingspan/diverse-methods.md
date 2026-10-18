# Diverse evaluator hypotheses

This batch adds exactly twelve deterministic practical-combined variants. All
pre-existing formulas are unchanged. Each returns actual score at gameover;
otherwise return practical-combined + the adjustment below. These are experimental
score estimates, not calibrated probabilities or established strength gains.
Coefficients are fixed design choices rather than fits to previous match seeds.

## Shared quantities and one-play candidates

T = actual remaining player actions, including later rounds; E/P/usableHand/
usableFood/currentGoal/bonusGrowth are the unchanged baseline features. Room is
sum of unused egg capacity; eggs is current total eggs. Egg and food action
outputs follow the real [2,2,3,3,4,4] and [1,1,2,2,3,3] row progressions.

For every actor-hand bird and compatible non-full habitat, create a shallow
hypothetical placement, remove that one card from hand, and append a zero-egg
bird. First add only the missing payment eggs (within room), then debit the
column egg payment, spending surplus above one per nest before final eggs. No hidden deck order is inspected. Column egg payments are [0,1,1,2,2].
Typed food deficit first covers matching symbols, then wild symbols from surplus,
then missing typed symbols using any two surplus tokens per symbol. Either costs
need one allowed type (or two arbitrary tokens); wild either accepts any token.
Delay = 1 + ceil(typed deficit/forest output) +
ceil(max(0,column payment-current eggs)/grassland output).
A feasible candidate needs delay <= T and missing payment eggs <= min(current room,shared egg supply).
Let M(expression) mean max(0, expression over feasible candidates).

The egg hypothetical adds at most one grassland action's output within actual
bird capacities and shared egg supply. It first spreads one egg per empty nest, then fills nests toward four eggs,
then fills remaining capacity. This is one deterministic distribution,
not an optimized threshold/goal distribution. Bonus calculations use actual
bonusPoints, including hand-size, habitat-minimum and egg-distribution bonuses.
Round awards use actual roundGoalScores, including green ties/zero exclusion and
blue quantity cap of five.

## Exact adjustments

| Method | Adjustment |
| --- | --- |
| bonus-threshold | 0.65 * max(0, M((hypothetical bonus-current bonus)/delay), one-egg-action bonus gain if T>0) - baseline bonusGrowth |
| round-race | For an unpaid current goal: 0.65 * urgency * max(0,best projected award-current award). urgency=1/(1+max(0,current remaining actions-1)/3). Best considers current standing, the egg hypothetical if a current action remains, and placements whose delay fits current-round actions. Already-paid goals give zero. |
| future-goals | Sum over future known goal faces: 0.25 * award at current public structure / distance in rounds (next round distance=1). No current-round or already-paid award is added. |
| egg-liquidity | If T>1 and any feasible candidate: 0.45*min(current eggs,n) + 0.35*min(room,max(0,n-eggs)) - 0.3*max(0,n-eggs-room), where n=min(2,minimum candidate column payment). Otherwise zero. |
| capacity-investment | 0.5 * M(min(new bird egg capacity,max(0,(T-delay)*egg output/3-room))/sqrt(delay)) |
| typed-food | 0.3 * M(max(0,printed points-column payment-0.6*food symbols)/(1+typed deficit)) - 0.25*usableFood |
| hand-quality | 0.45 * M(max(0,printed points-column payment)/delay) - 0.2*usableHand |
| row-unlocks | 0.45 * M((next row output-current row output)*min(5,max(0,T-delay)/3)/delay) |
| power-synergy | min(4, synergy * min(6,T/3)); see power pairs below |
| endgame-cashout | max(0,1-T/8) * (0.7*cashout - existing speculative income); see below |
| opponent-tempo | min(1,T/8)*clamp(public score gap/20 + current action gap*0.15 + reachable egg gap*0.12,-2,2). Public score gap is own visible score minus maximum rival visible score; current action gap is own minus maximum rival remaining actions. Reachable egg gap is own min(room,current actions*grassland output) minus maximum rival equivalent. |
| strategic-blend | clamp(0.5*(bonus-threshold+round-race+capacity-investment+row-unlocks+power-synergy) + 0.25*(typed-food+hand-quality) + 0.5*endgame-cashout,-4,6) |

Power synergy counts brown powers within the same row only. Draw codes
3/24/34/41/56/59 and hand-tuck codes 4/27/32/35/50/62 give
0.4*min(draw count,tuck count). Seed sources 35/63/66 support seed tuck 23;
fish sources 29/60 support fish tucks 9/36. Each supported food-tuck power adds
0.45, capped to one source per food type per row. Repeat-brown code 43 adds
0.5*min(0.75,best eligible same-row brown scoring income); repeat-predator code
49 uses the best same-row predator code 7/10/17/42/46 instead. Targets exclude
43/49, preventing repeat recursion. Scoring income uses repeatIncome in the prior
refinements methods (cache/predator/tuck/egg approximations); unsupported targets
are zero. These repeat contributions use the same time multiplier and four-point
cap as all synergy. Targets need not be earlier in activation order: optional
ordering and once-per-activation eligibility are approximated by the 0.5 discount.
These pairs reflect actual
resource-to-scoring relationships; they do not simulate activation ordering.

Cashout is max(pure egg scoring, best feasible one-play-plus-eggs scoring).
Pure eggs = min(room,shared egg supply,T*egg output). A candidate gives
max(0,printed points-column egg payment) +
min(room+new bird egg capacity+column egg payment,shared egg supply+column payment,max(0,T-delay)*egg output).
Existing speculative income = 0.7*(usableHand+usableFood) + 0.65 E + 0.4 P +
bonusGrowth. Current goal credit remains unchanged.

Visible opponent score includes only birds, eggs, cached/tucked counters and
awarded goals. Opponent hands and bonus cards are never read by opponent-tempo;
future/current goal awards use public board quantities only. Actor hand and
bonuses are the evaluator's normal actor-visible state.

## Limits and runtime

One-play candidates are arithmetic estimates, not legal move/payment searches.
They assume favorable newly gathered food types and neglect feeder contention,
powers triggered by gathering, payment egg location, and intermediate actions.
Hypothetical placements debit payment eggs using a deterministic distribution;
they do not optimize egg placement or payment for each bonus/goal. Cashout omits powers and uses pooled capacity;
new birds can improve egg output but cashout intentionally retains the current
output. Future goals assume frozen present standings and discount them rather
than predict opponents. Round-race uses only one play or one egg action and can
miss sequences. Egg distribution is heuristic. Pair synergy ignores ordering,
costs and same-turn depletion, and can overlap baseline engine income. Spare food
has no direct terminal points (only tie-break relevance); hand cards have no
terminal points except actual bonuses. Baseline resource credit is reduced by
some variants, not asserted eliminated exactly. Opponent-tempo is a small relative
pressure signal and is never a probability. Strategic-blend deliberately caps
combined adjustments but still contains correlated terms.

Runtime scans actor hand by at most three habitats, and uses bounded board/goal
calculations, shallow hypothetical placements and local copies. No game-tree
branching, recursive leaf evaluation, stochastic sampling or deck lookup occurs.
The shared helper computes the whole adjustment map once per requested leaf;
this favors auditable simple formulas over per-variant micro-optimization.

## Verification

`node --test test/wingspan-diverse-evaluators.test.js test/wingspan-leaf-evaluators.test.js test/wingspan-leaf-refinements.test.js test/wingspan-specialist-payback.test.js`

All 26 tests pass. Fixtures exercise each feature family, exact 2:1/either/wild
food deficits, bonus egg thresholds, blue goal improvement, future known goals,
liquidity/capacity, hand quality, row unlocks, same-row power chains, late cashout,
private-opponent invariance, blend bounds, purity/determinism, terminal scoring,
repeat target presence/habitat restrictions, payment/deadline regressions,
and unchanged pre-batch practical-combined snapshots. Match outcomes and selection
criteria belong to the separate runner evidence; no superiority is claimed here.
