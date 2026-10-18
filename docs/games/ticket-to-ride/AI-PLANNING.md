# Ticket to Ride planning candidate

`planning-v2` is one explicit deterministic candidate, not the default. The browser
and `production-default` retain the original sampled network evaluator. No game
rules, supplies, catalog data, UI, shared worker or independent benchmark baseline
changed. The original catalog/source and exhausted-supply gates remain open.

## One joint collection plan

The candidate builds route witnesses for its own tickets. Owned lanes cost zero;
unavailable lanes and closed parallel mates are excluded. Collection-weighted
Dijkstra costs use one claim turn, missing cards and train expenditure. Gray lanes
use an actual available hand color, not an imaginary gray card. The current hand
guides path proposals; a second pass reserves colored-route demand first, assigns
gray lanes from remaining color surplus, then spends each locomotive at most once
against the aggregate deficit. Thus two tickets cannot both assume they own the
same cards. Routes longer than the remaining train supply are excluded, and a
joint union exceeding that supply is penalized.

Ticket plans are processed in deterministic cost/value order, discounting reuse
of an existing planned lane to favor overlapping objectives. Each offered legal
retention subset is evaluated with the existing tickets as one union. It is a
greedy network approximation, not an exact joint Steiner-tree solver or optimal
ticket selection. Train feasibility is checked for the union; hand reuse is
reconciled after path proposals rather than solved jointly during Dijkstra.

All legal claims, exact payments and draw sources remain root choices. Claims
receive route points, objective progress and actual ticket-completion credit.
Payment cost considers the resulting deficit for the remaining plan and the
opportunity cost of locomotives. A small urgency term uses public opponent hand
counts; no opponent card identity or sampled ticket is a fact. Triggering the end
with unfinished tickets is penalized. Draw values follow the missing colors of
the joint plan, useful near-complete claims, the extra cost of a first face-up
locomotive and endgame tempo. Blind-card expectation uses only the actor's own
hand and public market/discard/pickup lower bounds. New ticket draws are attractive
only after existing feasible goals are connected, with enough trains/time left.

There is no opponent rollout, hidden-hand search or exact longest-trail term in
the candidate. Approximate path choice, endgame timing and fixed utility weights
may fail in multiplayer blocking positions. Performance must be measured rather
than inferred from these intentions. No weights changed after the smoke below.

## API and measurement

The production search API accepts `createSearch({observation,actions,policy})`.
Omitting policy retains `production-default`; `policy:'planning-v2'` explicitly
selects this candidate. It accepts only actor observations and supplied complete
legal roots. A full deterministic sweep evaluates every root once with zero
pruning. Repeating that sweep adds no information. Summary method text clearly
distinguishes deterministic ranking from sampled evaluation and win probability.

The [benchmark adapter](../../../scripts/benchmark-adapters/ticket-to-ride.mjs)
supports these combinations without changing `simple-v1`:

| Controlled policy | Opponent | Actual policy IDs |
| --- | --- | --- |
| `planning-v2` | `incumbent-v1` | `ttr-deterministic-joint-planning-v2` vs `ttr-production-network-v1` |
| `planning-v2` | `simple-v1` | `ttr-deterministic-joint-planning-v2` vs `ttr-independent-ticket-plan-v1` |
| `production-default` | `simple-v1` | Original comparison unchanged |

The requested sample budget remains the incumbent's fixed budget (default 128,
floored at the complete root count). The candidate performs one full root sweep,
regardless of requested samples. Records identify `candidateSamples:0`, actual
`candidateEvaluations`, complete root coverage, opponent samples, strategy latency,
and `equalTimeComparison:false`. More requested samples do not make this
deterministic candidate stronger. A fixed-sample screen is not an equal-time
comparison; any deployment decision needs that caveat and, if needed, a separate
time comparison. Complete-game scores/outcomes use the unchanged exact engine;
capped/unresolved games retain null shares and never become draws.

Example (PowerShell, one game; not a study):

```powershell
node --input-type=module -e "import {runGame} from './scripts/benchmark-adapters/ticket-to-ride.mjs'; console.log(JSON.stringify(await runGame({seed:40001,players:3,seat:0,policy:'planning-v2',opponent:'incumbent-v1',budget:{samples:128,maxTurns:600}})));"
node --test --test-isolation=none --test-concurrency=4 test/ticket-to-ride.test.js test/ticket-to-ride-planning.test.js
```

## Verification and smoke, based on f4c61a6

All 43 focused/core tests passed: nine new candidate tests plus 34 existing rules,
privacy, scoring and recovery tests. New fixtures cover gray-color collection,
all player-count parallel closures, train feasibility, shared ticket routes,
joint color/wild demand, payment conservation, endgame claim tempo, hostile getters
on opponent hands/tickets and deck/RNG, paired hidden decks with identical advice,
complete root coverage, unchanged incumbent/default output, and candidate versus
both adapter opponent modes. These policy arithmetic fixtures are not independent
certification of board geometry or printed tickets.

Exactly two full-game plumbing smokes were predeclared, controlled seat 0 versus
all incumbent opponents at 128 requested samples, 600-action cap. Both completed
with full root coverage, zero illegal actions, zero caps and zero unresolved games:

| Seed / players | Final scores by seat | Controlled share / margin to best opponent | Actions | Candidate evaluations / sampled worlds | Elapsed |
| --- | --- | --- | ---: | --- | ---: |
| 40001 / 3 | 76, 70, 48 | 1 / +6 | 200 | 1,482 / 0 | 3.16 s |
| 40002 / 4 | 60, 57, 93, 51 | 0 / −33 | 265 | 2,099 / 0 | 3.86 s |

Controlled strategy call mean was approximately 0.65 / 0.60 ms; incumbent opponent
mean approximately 22.5 / 18.0 ms, respectively, on this host. Timing excludes
projection/transition work and is not a hard browser deadline. The unfavorable
four-player result is retained. These two games establish neither strength nor
seat balance and were not used to tune the candidate. No screening, confidence
interval or promotion is claimed here.

The coordinator owns predeclared 40-setup screens separately for three/four
players, all seat rotations, followed only if promising by fresh 100-setup
confirmation and the unchanged independent comparator matchup. Existing default
remains until that evidence supports changing it. No source certification follows
from AI results.
