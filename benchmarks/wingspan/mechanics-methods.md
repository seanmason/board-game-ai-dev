# Mechanics evaluator corrections

Experimental deterministic point adjustments to `practical-combined`, with baseline preserved by the integrating caller. No production default or strength claim. Terminal and zero-future-action adjustments are zero. Every method is capped at ±8 points (goal methods ±4; bonus and late-play ±5). Own cards and bonus objectives may be read; opponents contribute public habitats only. Deck contents, opponent hands/bonuses, tucked identities and random state are never read.

Let T be remaining own actions including later rounds and A=min(5,T/3). All methods evaluate current configurations, not exhaustive legal continuations.

| Method | Mechanism and formula before final cap |
| --- | --- |
| ordered-engine | Scan brown powers right to left, starting with wetland base card income; each tuck consumer gains .65 if a card source precedes it, otherwise -.25. A same-activation seed/fish producer before a paid double tucker adds .8. Multiply by A. |
| renewable-tucking | Tuck-and-draw adds .8 when hand or same-activation cards exist; other tuck consumers backed by row card income add .7 (1.1 for tuck-and-egg). Multiply by A. Card flow is consumed in actual activation order. |
| food-cache-economy | Supply cache adds 1; seed feeder cache adds .65 with matching public die, .15 otherwise. Double tuck backed by earlier same-row food adds 1.1; inventory-backed alternative adds up to .6. Multiply by A. |
| nest-network | Brown shared nest egg powers 54/61/67 add .6 per distinct matching or wild nest with free capacity, at most two targets per power. Multiply by A and cap at total current empty egg capacity. White all-nest powers do not generate recurring income. |
| pink-egg-income | .6 times min(eligible empty matching nest capacity excluding owner, projected intervals). Intervals=max(0,min(5,.45T)-already-used). Opponent count cannot multiply income between own turns. |
| pink-food-income | Public opponent row space or predator presence gates .22 per projected interval (.3 for rodent cache). Same interval cap as pink eggs. |
| repeat-engine | Each repeater gets .7 times the best eligible same-row brown power estimate, times A. Excludes all repeat powers as repeat targets; predator repeater permits hunting/fishing only. |
| goal-denial | For an unpaid round only, exact green-board opponent score loss caused by own present quantity, compared with own empty tableau; multiply by 1/(1+max(0,current actions-1)). Zero for blue. |
| goal-safe-lead | Exact own current green award times min(1,quantity lead/max(1,2×largest opponent actions remaining)), times same urgency. Zero without an outright lead and for blue. |
| bonus-progress | Best exact bonus score increment from one currently payable hand bird, including canonical egg removal and hand removal; divide by 1+.25×food cost and multiply by min(1,T/3). Normal food payment permits typed resources, wild costs and 2:1 conversion. |
| late-bird-vs-eggs | For T≤5, .6 times best nonnegative payable bird points minus column eggs plus exact bonus increment minus current base egg harvest. Otherwise zero. |
| adaptive-portfolio | For T>5 choose .6×largest renewable tuck/cache/nest/repeat correction plus .2×ordered; late use .7×late-play instead. Add .25×bonus progress and .2×pink egg income. |

Limitations: activation counts, opponent event likelihood, resource value and power-yield estimates are heuristic; feeder rerolls, hidden draws, future bird placements, opponent counterplay and future global egg supply changes are not simulated (current supply caps egg forecasts). Nest income assumes the owner can exploit the shared power and does not subtract opponents' shared egg awards. Repeat estimates do not simulate consumed inventory across repeats. Goal forecasts use public present quantities and rough safety margins, not probabilities. Bonus projection tries every open compatible habitat but one canonical egg payment; it cannot discover better payments that preserve bonuses. Late comparison excludes future engine activations and food replacement opportunity cost. Caps intentionally limit damage while retaining the established baseline.

Validation: `node --test test/wingspan-mechanics-evaluators.test.js` passes 14 semantic tests, including right-to-left ordering, renewability, cache economy, nest capacity, pink use limits, repeater eligibility, exact green/blue distinction, bonus thresholds, late scoring, portfolio response, purity, terminal zero and private-data access traps. These are mechanism checks, not playing-strength evidence. No tournament launched by this implementation task.

