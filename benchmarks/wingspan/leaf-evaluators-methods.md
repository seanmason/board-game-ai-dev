# Experimental Wingspan leaf evaluators

These deterministic absolute projected scores consume a supplied determinized state. They do not sample, enumerate actions, inspect external information, or mutate state. They are heuristic points, not win probabilities. The existing rollout baseline is unchanged. Every evaluator returns `scorePlayer(player).total` at game over; points-only always returns that total. Remaining own actions are `remaining[player] + sum([8,7,6,5].slice(round))`.

Let P be current total, T remaining actions, H capped usable hand value, F usable food value, E engine income, Q habitat productivity, G goal/bonus increment, B the time-adjusted basic hand/food value, and R the generic baseline engine value:

| Method | Score |
| --- | --- |
| points-only | P |
| remaining-turns | P + B + R |
| engine-income | P + B + E |
| goal-aware | P + B + R + G |
| usable-resources | P + H + F |
| habitat-productivity | P + Q |
| practical-combined | P + .7(H+F) + .65E + .4Q + G |
| conservative | P + .35(H+F) + .3E + .2Q + .5G |

B = (1.1 min(8, hand size) + .9 min(10, food)) T/26. R = sum over habitats of (.85 min(5, brown birds) + .4 birds) T/26. Thus remaining-turns isolates the baseline tempo correction, engine-income replaces its generic engine with power income, and goal-aware adds goals to the corrected baseline.

Playable hand cards require an open compatible habitat. Plays are capped by open spaces, hand size and T/2.5. H sorts `max(0, printed points - .6 food cost - .8) * (.35 + .65 payment access)` and uses only that many plays (fractionally for the final card). Either-food cards cost one; otherwise cost includes wild. Payment access approximates typed matches and 2:1 substitution. Demand is min(1.2T, total playable hand cost, 3 plays); F=.55 min(food, demand).

Q assigns T/3 activations per habitat, with actual base resource progression [1,1,2,2,3,3] (grassland [2,2,3,3,4,4]). Egg output is capped by current egg room and weighted .85; food output by unmet demand weighted .48; card output by open spaces minus hand size weighted .55.

E uses powerCode, never generic brown counts. Each brown power gets T/3 activations, pink powers .4 of that. Food powers get .55 per activation (.9 for codes 29/33), multiplied by unmet demand/T capped at one. Cache codes 1/31/55 get .55/.85/.85. Predators get .55 (42=.7, 46=.4). Paid tuck codes 9/23/36 get 1.1 if the appropriate fish/seed exists. Hand tuck gets .65 times min(1, hand/3), with code 27 adding .5 times egg-room fraction. Egg powers use their actual nest/self/other target category and current capacity, multiplied by min(1, egg room/T). Multi-nest codes 12/26/52/65 allow one per eligible bird. Draw codes 3/21/24/34/41/56/59 get .5 (.2 for 21, .9 for 24), capped by open-space/5 and discounted linearly to zero at ten hand cards. Repeat, movement and extra-bird powers get zero generic income. White powers have already resolved and get no ongoing income.

G adds .65 of the current goal's present-board award only when not already awarded. It also adds .35 times the largest *incremental* bonus score from hypothetically playing one known hand bird, times min(plays,2). Current bonus points are already in P and are not added again.

Limitations: habitat activation shares are fixed; resources are not jointly allocated across projected powers; costs, feeder access and pink trigger rates are approximations; paid powers can run out after an estimated activation; some unusual powers are deliberately undervalued. Current nest capacity can undervalue future bird placement. Bonus progress sees only immediate threshold crossings. There is no calibration or strength claim. Exact per-code weights live in `wingspan/leaf-evaluators.js`.

Validation: `node --test test/wingspan-leaf-evaluators.test.js` (6 tests pass). Covers terminal equality, action tempo, food saturation, power differences/capacity, 30 seeded 2–5 player states, deterministic finite outputs, immutability, distinct formulas, and awarded-goal accounting.

