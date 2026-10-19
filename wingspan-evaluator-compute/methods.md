# Evaluator/compute study: frozen mechanism definitions

These research-only methods retain `evaluateLeaf(state, player, 'opening-plan')`
exactly as their reference. No production evaluator, default, or root generator is
changed. This document specifies constants before any strength games; it makes
no playing-strength claim. The parent protocol is
[the evaluator/compute plan](../../docs/work/wingspan-evaluator-compute-2026-10-18.md).

## Information and bounded work

Corrections read the actor's known hand, own food/rows/eggs, public feeder and egg
supply, round and action counts. They never inspect deck identities/order,
opponent hands/bonuses, or RNG. Physical unknown hand placeholders are filtered
with `knownCard`. The exact reference remains unmodified. Public observations
from `core.publicObservation` give identical corrections. Terminal and zero-own-
future-action corrections are exactly zero. Atomic residuals clamp to [-4,4];
blend clamps to [-6,6]. Stable catalog/FOOD/habitat order resolves ties.

Let T be production `remainingActions`. At most n=min(2,ceil(T/3)) activations of
one habitat are considered, never three simultaneous habitat schedules. Each
activation takes base output first, then brown powers right to left. The feeder
is consumed without predicting refill rolls. No optional mat trades are assumed.
All inputs are cloned; no real state, card identity, RNG or pending effect changes.
This is a finite shadow ledger, not a future legal-action search or exact solver.

Ledger utility is U = tucked/cache points + eggs + C*(useful_food/forest_rate +
useful_cards/wetland_rate). Rates are the production resource progression.
C=min(grassland_rate,total installed egg capacity). Useful food is the sum of
min(stock[type], sum(known hand printed cost[type])); useful cards is
min(card stock,max(0,min(2,empty bird slots))). This is a single
shadow price for actions displaced; no additional token value is added. Food
costs in this utility are a conservative typed-demand proxy (alternative food
symbols can overstate future demand); actual placement payments use exact
alternative/wild symbols and 2:1 substitutions. Unknown draws add anonymous card
stock, never an inferred playable identity. Resource surplus has zero value.

Optional exchanges/tucks/repeats execute only for strictly positive local utility.
Raven consumes exactly one egg on a different bird, returns it to supply, and
chooses two independent food types by largest unmet typed demand. Gull/Killdeer
can consume their own egg and produce exactly two cards. Repeats exclude self and
both repeater codes; predator repeats additionally require the target's actual
hunting/fishing group. Repetition runs one target once without recursive repeats.

Supported brown codes: 33,41,43,49; hand-tuck 4,27,32,35,62; typed food-tuck
9,23,36; draws 21,24,34,56,59; supply cache 31; supply foods
16,25,29,40,57,60,63,66; egg powers 14,30,12,26,52,65. Draw/discard powers defer
one mandatory discard until the row ends, allowing interim hand consumption.
The original implementation schedules mandatory discards as pending code 1000
and cannot resolve that pending choice from an empty hand. This study therefore
reserves every already-pending discard before a nonreplenishing tuck. It may
reduce that reservation by guaranteed net draws from known later producers
(codes 24/34/56/59: 2/1/1/1 cards respectively); draw-and-discard 21 adds no
net supply. A tuck-and-draw 4 can use a reserved card because its net stock
change is zero. Cards are still discarded only after the row ends. This small
lookahead deliberately ignores conditional/repeated future production and may
undervalue valid chains. It is a conservative match to the existing implemented
pending-choice model, not new rules certification. The official
[Wood Duck entry](https://wingspan.rulepop.com/#power/wood-duck) describes the
end-of-turn discard cost but does not settle the disputed empty-hand case.

Many listed codes occur only as white powers in the original catalog; those
remain inactive. Predator dice/card outcomes, feeder powers, pink powers,
conditional fewest-birds powers, movement, extra plays and other unsupported
powers contribute no invented yield. Existing baseline treatment is retained.

## E: exceptional action economy

For every row activation, evaluate each power alone against the same ledger just
after base output. E's gross term is the sum of these isolated utility changes
for codes 33/41/43/49 in the chosen row schedule. The schedule maximizes total
supported power gain over its base-only counterpart, with skip available.
Subtract the exact adopted `practical-combined` engine slices for every installed
brown 33 and 41: `.65*.9*foodUseful*T/3` and
`.65*.5*min(1,slots/5)*max(0,1-rawHand/10)*T/3` respectively. `foodUseful` is
`min(1,max(0,demand-stockFood)/max(1,T))`, with demand exactly the baseline's
`min(1.2*T,sum(eligible hand costs),min(slots,eligibleHand,T/2.5)*3)`.
Eligible cards have at least one nonfull matching habitat. Gull saturation uses
the raw hand count, exactly matching production's separate code-41 formula.
Repeats have no baseline slice. This replaces existing exceptional engine credit;
printed points, held resources, goals, generic row production and opening
credit are not awarded again.

## S: ordered sustainable row interactions

Use the same chosen habitat schedule and shared stocks. S is its actual supported
power gain (U after full schedule minus U after base-only schedule) minus the
sum of isolated single-power gains above. For each activation the isolated
comparison starts from that activation's actual shared ledger after base output;
thus prior activation stock is retained, and same-activation production,
consumption, capacity competition and repeat feasibility are the interaction.
No generic income multiplier is added. Negative competition can subtract value.
Only the interaction is new: the reference already owns individual ordinary
power income, and E owns exceptional isolated output.

## P: bounded early investment payback

Greedily select at most two placements from the first eight known hand cards,
considering each legal habitat. Exact memoized typed payments use matching food,
alternative/wild symbols and any two tokens per missing symbol. Cap per-type
payment stock at six solely to bound arithmetic; no base bird costs over three
symbols. Food acquisition is deliberately not forecast: unavailable food blocks
a candidate. Egg-column costs are [0,1,1,2,2]. Missing eggs require full ordinary
grassland actions, bounded by current capacity/supply; those actions lay their
full basic output, then exact eggs are debited. Actions, hand identities, food,
egg locations and supply are shared by both placements. Newly installed white
powers are not predicted.

`operation(p,A)` is max(0, best habitat [U after min(2,floor(A)) actual ledger
activations - U before - activation count]). For a candidate with delay d=one
placement + required egg actions, require d<A and value
`operation(after,A-d)-operation(before,A)-egg_column_cost-.5*d > 0`.
Select the largest value with stable ties, debit its plan, then repeat once.
Only operational improvement earns credit, never printed bird score, held
resources or bonus/goal deltas. Subtract the exact existing hand-plan opening
slice: `openingAdjustment(original)-openingAdjustment(original with empty hand)`.
Clamp the final sum. The remaining-action check makes expired payback vanish;
this deliberately bounded two-activation approximation can miss long paybacks,
necessary food gathering, and jointly good plans whose first placement is weak.

## B: constrained half-weight combination

Run P first and reserve its resources/actions. Recompute E/S with those debited
stocks and action budget using only birds installed before the plan. New birds'
operational increment belongs to P, so they cannot earn a second E/S award.
Return clamp6(`.5*(reserved_E + reserved_S + P)`). This is not an unconstrained
sum of independently incompatible plans. All component caps remain in effect.

## Diagnostics and verification

`diagnosticPositions()` defines exactly 24 named full states independently of
this module and coefficients; each conserves 170 unique cards and all eggs and
passes `assertValid`. They are legal invariant-preserving mechanism snapshots,
not claimed turn-by-turn reachable historical games or a representative sample.
They include early/late ravens, missing support, saturated demand, capacity,
Gull/Killdeer demand, draw/tuck and food/tuck orders, three-bird rows, general
and predator repeat controls, typed-stock placement controls and one-action endgame.

Run `node --test test/wingspan-study-evaluators.test.js`. Hand-checked ledger
assertions cover exact egg locations/costs, optional skips, order-dependent
food-tuck output, carry between activations, exact mixed-full-habitat baseline
subtraction, and deferred mandatory-discard reservation with replenishment.
Reference equality, bounds,
terminal/zero-future equality, state purity, determinism and paired hidden-world
invariance cover all 24 fixtures. No full tournament is part of these tests.
The official [publisher rules reference](https://wingspan.rulepop.com/) supports
right-to-left activation, exact placement egg costs, typed food and 2:1 trades;
`core.js` and `powers.js` map original-catalog power costs and repeat eligibility.

Timing is a separate pre-strength calibration, not evidence of superior play.
These constants must be frozen with source hashes before inspecting wins.


Local pre-strength microprofile (Node 24.19.0, shared Windows worker machine):
three warmup passes then five complete batches over 24 fixtures, median batch
elapsed/24: reference 0.3377 ms, E 0.5176, S 0.5063, P 0.8807, B 1.2091.
These are evaluator-only observations, not a whole-decision time budget, hard
latency guarantee or outcome-based coefficient selection. No games were run.
