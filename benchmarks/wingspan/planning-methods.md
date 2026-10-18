# Bounded planning evaluator hypotheses

Twelve new additive corrections to unchanged practical-combined live in
`wingspan/planning-evaluators.js`. They all return zero at gameover or with no
remaining actions. Each is deterministic, pure and bounded to at most three
projected points in either direction. They are experimental hypotheses, not
calibrated probabilities or claims of stronger play.

Earlier results motivated shared-resource accounting and slot matching: plain
hand/point valuation and the pooled action planner failed; row-unlock screening
did not confirm; full-slot penalties and forest development screened well but
were still undergoing independent confirmation when this module was written.
The baseline economy remains intact. No coefficients were fitted to those seeds.

## Candidate portfolio and resource accounting

T includes current player actions and future rounds [8,7,6,5]. Generate actor-hand
card/compatible-non-full-habitat options, order by printed points minus .7*food
symbols, then hand index, then HABITATS order; retain at most six placements.
Thus a flexible bird may occupy multiple options. No hidden card order is read.
Try each first placement and at most six second placements after each feasible
first: at most six single plans and 36 ordered two-play continuations. Hand card
identity, newly filled slots and resources are updated between plays; the same
physical card cannot be reused. This is bounded arithmetic planning, not a full
legal-action tree search or an attempt to project all remaining turns.

Food payment uses actual typed symbols, wild symbols and either costs. Matching
symbols are paid first; wild symbols use any remaining token, and each missing
typed symbol consumes two surplus tokens. Either accepts one allowed token or
two arbitrary tokens. If payment is impossible, a forest action adds its real
row output of favorably selected needed types and spends one action, then payment
is retried. This optimistic acquisition ignores feeder dice/contention. Tokens
actually paid disappear from the local stock, including both tokens in 2:1
substitutions; the next bird cannot reuse them.

Each play pays column eggs [0,1,1,2,2]. Missing eggs require actual grassland
actions at row outputs [2,2,3,3,4,4], shared egg supply and free bird capacity.
Egg laying first spreads one per empty nest, then fills capacity. Payment removes
highest-count nest eggs first and returns eggs to supply. It is a fixed legal
allocation heuristic, not optimized for bonuses/goals. Every food/egg/play action
uses the same remaining-action counter. New birds update row length and capacity.
No brown, white or pink powers are executed in the portfolio. Food output uses
[1,1,2,2,3,3]. Egg conversions, food conversions and extra plays are omitted.

Plan gain is added printed points + newly laid eggs - egg payments. Plan utility
U=plan gain-.65*actions used. B1=max(0,single U); B2=max(B1,pair U). Bonus changes
are kept separate and scored via actual bonusPoints on the final hypothetical
player, including removed hand cards and spent/laid eggs.

## Exact adjustments

Cap3 clamps to [-3,3]; nonnegative values are capped at the bound shown.

| Name | Adjustment |
| --- | --- |
| assignment-hand | Cap3(.3*(B2-top single utility for one distinct card-top single utility for another distinct card)). Single alternatives for one card are deduplicated before choosing the two largest nonnegative utilities. Penalizes independently credited plays that compete for slots, stocks or time. |
| matching-slots | Cap3(.5*(maximum matching-min(10,hand size,total open slots))). Bipartite augmenting-path matching uses the first ten actor-hand cards and every actual individual compatible open slot. Detects habitat contention even when other rows are empty. |
| food-demand-cap | -min(3,.18*max(0,current food-demand)), demand=max net food stock consumed by any one/two-play plan, zero when none. Shrinks credit for surplus stock unsupported by this bounded portfolio. |
| food-opportunity | Up to 2 points: .45*max candidate opportunity. A candidate whose food-symbol count minus current matching typed symbols is exactly one gives max(0,printed points-column payment)/(2+food symbols); others zero. This is a small typed near-payment signal, not an exact marginal token search. |
| draw-option-value | Up to 2: .4*max(0,catalogue mean-B1)*min(1,open slots/4)*min(1,T/6). Catalogue mean detailed below. |
| discard-cost | Up to 2: .4*min(stranded hand count,min(3,brown hand-tuck count*T/3)) plus, with odd forest length, .2*min(stranded count,max(0,3-current food)). Rescues some discard/tuck utility of otherwise unplayable cards. |
| egg-reserve-planning | If any placement option: clamp to [-2,2] of .4*min(eggs,n)+.2*min(room,max(0,n-eggs))-.3*max(0,n-eggs-room), where n=min(2,minimum option column payment). Otherwise zero. This values a shared payment reserve rather than new hand points. |
| egg-overflow | -min(3,.25*max(0,min(6,T/3)*(current grassland output+counted egg powers)-min(room,shared egg supply))). Penalizes an egg-production horizon beyond its current storage sink. |
| investment-break-even | Up to 2: .35*max over feasible single plans of max(0,min(5,actions left/3)*new bird repeat income-.5*actions used). Codes and resource checks below. |
| two-bird-plan | Up to 3: .35*max(0,B2-B1). Only the best shared-budget continuation improvement receives credit. |
| goal-transition | Up to 2: .3*max(0,next-goal quantity gain-.5*max(0,current-goal quantity lost))*min(1,T/8), maximizing across feasible one/two-play plans. Requires both known current and next faces; zero in the last round. |
| bonus-two-step | Up to 3: .55*max(0,best pair bonus gain-best nonnegative single bonus gain). Exact bonus scoring captures threshold crossings missed by either single placement. |

Draw prior uses every fifth static catalogue card (indices divisible by five),
not any actual deck. A card has value zero if all compatible rows are full,
otherwise max(0,printed points-.6*food symbols)/(2+max(0,food symbols-current
food stock)). Average these fixed values. This deliberately simple public prior
ignores typed-food matching and actual remaining card composition; it avoids
hidden-deck lookahead and keeps runtime bounded.

Discard hand-tuck codes are brown 4/27/32/35/50/62. Egg-overflow counts brown
12/14/26/28/30/52/54/61/65/67 as one unit each; mass-nest targets and self/other
nest eligibility are approximated, and overflow can overpenalize income redirected
through future bird plays.

Investment income is zero except supported brown scoring powers: code31=.85;
cache/predator codes1/7/10/17/42/46=.55; hand tucks4/27/32/35/50/62=
.65*min(1,post-play hand size/3); fish/seed tucks9/23/36=
1.1*min(1,post-play matching fish/seed stock); egg codes12/14/26/28/30/52/54/
61/65/67=.7*min(1,post-play free room). Unsupported repeat/resource/movement
powers receive zero. Uniform T/3 future activations and the five-activation cap
are approximations; new brown powers do not activate from the play itself.

## Limitations and cost

Hypotheses are correlated with baseline features and each other. Food-demand-cap
can penalize useful stocks beyond the two-card horizon; matching ignores cards
past the first ten; option pruning can omit a low-point strategic bird or habitat.
Two-bird plans ignore engine powers, opponents, goal awards, optional conversions
and bonus-triggering white powers. Goal-transition uses public quantities rather
than green-rank awards or blue caps and is not a calibrated goal score. Portfolio
payment egg locations are real local debits but chosen without bonus optimization.
The public catalogue prior is a deterministic sample, not the physical draw
distribution. Egg overflow excludes future new capacity, and reserve planning does
not solve whether eggs should instead score. Investment and continuation credit
are discounted additive hints, not additional terminal-score components.

At most six option simulations plus 36 continuations copy small actor-player
structures, each with at most fifteen slots. No whole-state deep clone, evaluator
recursion, random sampling, opponent-private read, actual deck lookup or neural
component is used. All existing files and live confirmation worktrees remain
untouched by this module's implementation.

## Verification

`node --test test/wingspan-planning-evaluators.test.js` passes eleven tests.
Semantic fixtures cover shared actions, compatible-slot contention, independent
assignment overcommit, food demand/opportunity, public draw prior and discard
utility, egg reserve/overflow, investment runway, two-step exact bonus thresholds,
known goal transitions, and consumption of both tokens in a 2:1 payment before a
second play. Tests also check all twelve names, caps, terminal zero, finite values,
determinism, state immutability, hidden-deck-order invariance and rival-private
invariance. Baseline integration/full-suite/benchmarks are coordinator-owned.
