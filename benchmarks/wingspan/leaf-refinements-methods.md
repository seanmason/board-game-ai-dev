# Experimental leaf refinements

These are deterministic projected-score heuristics, not win probabilities or
faithful future action simulations. All return scorePlayer(...).total at game
end. Existing evaluator formulas, including practical-combined, are unchanged.
No weights were fitted to earlier benchmark seeds.

Let T be remaining player actions, including later rounds, R usableHand +
usableFood, E existing engine estimate, P habitat productivity and G currentGoal +
bonusGrowth. See leaf-evaluators.js for the unchanged feature definitions.

## action-budget-planner

Start with T shared actions, pooled food, current eggs, free egg capacity and
habitat lengths. Inspect playable hand cards in descending printed points, ties
by card id. Choose their shortest eligible habitat. Column egg payment is
[0,1,1,2,2]. Gathering food costs ceil(max(0,foodCost-food)/forest output);
laying missing payment eggs costs ceil(missingEggs/grassland output), provided
current capacity can hold the missing eggs. A play costs one additional action.
Reject if total actions exceed the shared remainder or printed points minus egg
payment is no greater than the eggs the same actions could currently score.
Accepted plays debit all actions, food and eggs, add printed points and newly
laid eggs minus egg payment, and update habitat length and capacity. Finally add
min(free capacity, remaining actions * updated grassland output) egg points.
Return current score + projected gain + currentGoal. No independent resource,
engine, productivity or bonus-growth credit is added, avoiding those duplicate
claims on the budget.

Limitations: pooled food ignores types and conversion costs; hand-only greedy
ordering can miss useful smaller birds or drawing; no power activation income;
new bird capacity and row improvements are included but bonuses are not.
The planner is feasible only within this deliberately simplified economy, not a
legal move/payment solver. Runtime sorts the hand and scans it once.

## bottleneck-engine

Keep practical-combined's 0.7 R + 0.4 P + G fixed. Replace E with E*supply*capacity.
For each repeatable power, nominal activations are T/3 (pink powers multiply by
0.4). Food-consuming codes 9/23/36 demand one food each activation; hand-tuck
codes 4/27/32/35/50/62 demand one card each activation. Egg codes demand their
eligible target count capped by eligible free capacity, times activations;
code 27 also demands one egg slot per activation.

Gathering required is max(0,foodDemand-currentFood)/forestOutput +
max(0,cardDemand-handSize)/wetlandOutput. Supply is min(1,(T/3)/gathering), or
1 with no deficit. Capacity is min(1,freeEggCapacity/eggDemand), or 1 with no
egg demand. Thus stocks are shared across birds, and estimated replenishment
spends one shared allowance of T/3 actions. Final score is current score +
0.7 R + 0.65 E*supply*capacity + 0.4 P + G.

Limitations: the common scale conservatively discounts independent powers too.
Food types and nest-specific competition are approximate. Inherited E still
requires initial food/cards for consuming powers, so empty-stock engines are not
revived by estimated replenishment. Fixed resource/productivity terms can still
overlap engine gathering; this isolates the aggregate engine correction rather
than claiming a fully shared economy. It does not model egg spending powers or
new birds' extra capacity. Runtime is linear in birds plus eligible-target scans
(board size is capped at fifteen birds).

## phase-calibrated

This name denotes predetermined phase weighting, not statistical calibration.
Let early=clamp((T-13)/13,0,1), late=clamp((13-T)/13,0,1), mid=1-early-late.
Blend the following anchor coefficients linearly and continuously:

| Feature | Early (26 actions) | Middle (13) | Late (0) |
| --- | ---: | ---: | ---: |
| R | 0.8 | 0.7 | 0.35 |
| E | 0.85 | 0.65 | 0.2 |
| P | 0.5 | 0.4 | 0.15 |
| G | 0.7 | 1 | 1.2 |

Return current score plus the weighted features. Time-dependent features already
shrink with T; these coefficients additionally reduce speculative income late.
Goal credit can still be optimistic and the existing features still overlap.
No opponent response or round-goal rank prediction is added.

## Verification

`node --test test/wingspan-leaf-refinements.test.js test/wingspan-leaf-evaluators.test.js`
passes eleven tests, including determinism, immutability, terminal scoring,
one-action budget, shared consumables, continuous phase anchors, and recorded
pre-change practical-combined snapshots for seeds 1, 4 and 11. Tournament outcomes
and their sampling limits are recorded separately by the experiment runner.

## Follow-up batch: specialist and payback

These are new methods; the earlier three and every prior evaluator retain their
numeric formulas. The first batch's unfavorable results motivated new structural
ideas, not fitted coefficients. None of these names implies measured strength.

`habitat-specialist` starts from practical-combined, then adds
0.55 * (0.65 * specialistProjection - 0.65 E - 0.4 P). Thus 45% of the old
engine/productivity estimate is retained and the replacement is deliberately
partial. It reserves min(floor(T/4), hand size, open bird slots) actions for
possible plays. Each remaining action greedily chooses the highest-value row,
ties in HABITATS order. All three rows share this action budget. Row base values
are min(forest output, unmet food demand)*0.48,
min(wetland output, unmet card demand)*0.55, and
min(grassland output, remaining egg capacity)*0.85. Initial food demand is
max(0,min(T,3*hand size)-food stock), and initial card demand is
max(0,min(open slots,T/3)-hand size). Those demands decrease when their row acts.

Each chosen row also contributes its brown scoring powers: cache 1 gives 0.55,
cache 31 gives 0.85; predators 7/10/17 give 0.55, 42 gives 0.7, 46 gives 0.4;
food tuck 9/23/36 gives 1.1 when its fish/seed stock is present; hand tuck
4/27/32/35/50/62 gives min(1,remaining hand/3)*0.65, with code 27 adding up to
0.35 for room. Egg codes 2/12/14/18/26/28/30/52/54/61/65/67 give
0.8*min(room, eligible count for mass egg codes 12/26/52/65, otherwise 1).
Nest filters match the earlier engine estimate. Other brown powers give zero.
After a chosen row acts, food tuck and hand tuck powers debit local shared
stocks; wetland actions replenish cards by row output. Grassland output and the
row's estimated egg-power income reduce shared room. Pink income is retained
as a separate coarse allowance: T/3*0.4 times 0.85 for code 55 or 0.3 per other
pink bird. There is no lookup of hidden deck order.

Limitations: this is an arithmetic allocation, not legal activation execution.
Within-row marginal values are computed before consuming stocks, so birds in
one activation can compete for the last resource. Egg room is pooled rather
than tracked per bird, and depletion uses the discounted egg estimate. Replacement
tuck draws, brown food producers, repeat powers and egg-exchange powers are not
simulated; forest food acquisition decreases unmet demand but does not infer
food types for later tucks. Reserving play actions is approximate. Pink estimates
are coarse, and fixed baseline resources/goals can overlap row productivity.

`investment-payback` adds only the best known hand bird's prospective brown
power payoff to practical-combined. For every legal non-full habitat, estimate
play delay as 1 + ceil(food deficit/forest output) +
ceil(column egg deficit/grassland output). Food is pooled, and missing egg
payments must fit current room. If delay >= T, credit zero. Otherwise estimated
activations = min(6,(T-delay)/3), using the same scoring-power values above,
current room plus the new bird's egg capacity, and hand size minus one.
Candidate credit = 0.55*max(0,per-activation value*activations - 0.5*delay).
Take the maximum candidate across all cards/habitats, never the sum. Printed
points and ordinary resources are already in the baseline and receive no extra
credit. Future power costs/targets remain approximate; new self-egg birds can be
optimistic, food types are pooled for payment, and future row activation frequency
is assumed rather than searched. The six-activation cap and 0.55 discount are
fixed design choices.

`specialist-payback` adds both adjustments to practical-combined. They estimate
existing-row exploitation and one prospective engine investment respectively,
but can still compete for time; the play reserve and payback discount only
partially address that overlap. No benchmark-derived parameter fitting was used.

Follow-up verification:
`node --test test/wingspan-specialist-payback.test.js test/wingspan-leaf-refinements.test.js test/wingspan-leaf-evaluators.test.js`
passes all fifteen tests. The new checks cover action allocation, row preference,
max-only investment credit, late-game payback exhaustion, complementary additive
terms, purity, terminal exactness and retained practical-combined snapshots.
