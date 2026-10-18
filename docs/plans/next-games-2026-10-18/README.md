# Six-game expansion: selection and implementation handoffs

Researched 2026-10-18. Planning package only: no new game code, implementation
jobs, play-strength results or release/deployment is claimed. Start with
[the shared contract](COMMON.md), then one assigned game plan. These six are new
to the ten-game repository suite. All component, rule and workflow gates apply
before a game is declared complete.

## Selection and popularity

Use number of BGG ratings as the consistent popularity proxy, rather than quality
rank or a subjective favorite list. The figures below are indexed BGG snapshots
retrieved on this date, generally crawled during the preceding week; they are not
guaranteed live counts. Distinct editions/family entries are not silently added.
Ownership is supplemental when available, not a mixed sorting metric. This is a
screened shortlist of popular suitable games, not proof that all BGG games were
exhaustively ranked by implementation difficulty.

| Popularity priority | Game and BGG source | Ratings snapshot | Pinned implementation | Main AI | Handoff |
| --- | --- | ---: | --- | --- | --- |
| 1 | [Ticket to Ride](https://boardgamegeek.com/boardgame/9209/ticket-to-ride/ratings) | 99,695 | Original USA, 30 tickets, 2–5 players | Network/ticket heuristic, sampled continuations | [Plan](ticket-to-ride.md) |
| 2 | [Love Letter](https://boardgamegeek.com/boardgame/129622/love-letter/ratings?comment=1) | 72,430 | Classic 16-card, 2–4 players | Constrained beliefs and short full-round samples | [Plan](love-letter.md) |
| 3 | [Jaipur](https://boardgamegeek.com/boardgame/54043/jaipur/stats) | 59,191 | Standard two-player, first to two seals | Sale/exchange evaluation and sampled rounds | [Plan](jaipur.md) |
| 4 | [Sushi Go!](https://boardgamegeek.com/boardgame/133473/sushi-go/ratings?rated=1) | 53,253 | Original 108-card deck, standard 2–5 players | Exact scoring deltas, remembered-hand sampling | [Plan](sushi-go.md) |
| 5 | [Lost Cities](https://boardgamegeek.com/boardgame/50/lost-cities/ratings) | 51,632 | Original five-expedition, 60-card, 2 players | Expedition-risk heuristic and sampled continuations | [Plan](lost-cities.md) |
| 6 | [Hive](https://boardgamegeek.com/boardgame/2655/hive/ratings) | 40,863 | Classic eleven pieces per player | Iterative-deepening alpha-beta with tactical checks | [Plan](hive.md) |

BGG ratings measure participation on BGG, not worldwide sales. 'Suitable AI'
means a competent transparent opponent/adviser with the current JavaScript
heuristic/search toolkit; it does not promise an optimal full-game solution.
Hidden-information games require sampling and honest uncertainty. Hive gives a
fully public tactical alternative without random draws or card catalogs.

## Why these games

Ticket to Ride offers the largest audience of this shortlist and a small rules
surface with clear route/ticket objectives. It is the highest-effort selection:
faithful original map/ticket transcription and exact final trail scoring are
explicit first tasks. Its popularity justifies that bounded data-audit cost.

Love Letter has only eight character ranks in the selected edition and short
rounds. Hidden information is the main difficulty, rather than a large effects
engine. Card counting and legitimate private observations are tractable; freeform
social bluffing or a language model is unnecessary for legal game decisions.

Jaipur and Lost Cities are compact two-player card economies, with small
catalogs, clear scoring and complete enumerable root decisions. They are strong
fits for the lessons from Wingspan: improve action coverage and use interpretable
opportunity costs before spending on deeper/more numerous rollouts.

Sushi Go! has a fixed small catalog and exact scoring. The meaningful complexity
is simultaneous choice, ordered chopsticks plays and memory of passed hands.
These are specified explicitly so that a superficially correct drafting engine
does not gain hidden information or score the wrong card order.

Hive avoids a large component data project and all private-information machinery.
Its movement and stack gates deserve careful geometric fixtures; 'simple
components' must not be mistaken for trivial legality. The selected classic rule
profile is pinned rather than silently using a newer opening restriction.

## Alternatives considered

- Catan: enormous audience, but negotiation/trading and opponent modelling make
  a convincing physical-game adviser less straightforward than this shortlist.
- 7 Wonders: popular and compatible with drafting, but a much larger component
  catalog and guild/science/commerce interactions than Sushi Go! for this wave.
- Dominion: a plausible later project, but card-effect sequencing, interactions
  and market-set coverage add substantially more audit work than these card games.
- Santorini: approximately 42.7K ratings on BGG, but its defining god powers add
  a significant interaction matrix. An official no-gods mode is implementable,
  but selecting that alone would narrow the product. Love Letter has a larger
  BGG audience and a compact complete classic-edition scope.
- Onitama: approximately 25.2K ratings; a particularly easy later tactical game,
  but lower BGG participation than the six selected games.
- Cooperative communication games, open-ended word games and social-deduction
  negotiation games: difficulty faithfully reproducing the information/communication
  experience and producing good advice with this repository's current methods.

These are engineering judgments, not claims that the alternatives cannot support
AI. Popularity sources for the two close abstract alternatives:
[Santorini](https://boardgamegeek.com/boardgame/194655/santorini/ratings?rated=1),
[Onitama](https://boardgamegeek.com/boardgame/160477/onitama/ratings?rated=1&status=own).

## Execution order and coordination

Start with three independent assignments: Ticket to Ride data acquisition/audit,
Love Letter implementation, and Jaipur implementation. This honors audience
priority while isolating the longest-lead catalog work. The Ticket to Ride agent
can implement the headless engine once its data gate is satisfied. Assign Sushi
Go!, Lost Cities and Hive as slots become available, in that popularity order.
If a source/data gate delays one game, continue the other assignments; do not
fill missing rules/components by guessing. No more than three implementation
subagents alongside the coordinator under the current four-slot limit.

Each assignment prompt: 'Read AGENTS.md, docs/INDEX.md, this package's COMMON.md,
and your game handoff. Implement only your owned game files on a codex branch
or isolated worktree. Resolve named source/data gates before claiming fidelity.
Hand back exact verification evidence and the coordinator integration patch.
Do not publish or deploy.' Prefer the user's requested economical model settings.

The coordinator owns suite menus, asset allowlist, packaging, shared interfaces,
CI and final integration. Each game owner supplies a complete legal human editor,
physical-observation flow, deterministic baseline and its bounded search method.
No common framework rewrite is prerequisite. Real-table entry and reviewable
advice take priority over marginal search strength.

## Review and readiness

[Handoff review](REVIEW.md) records the second-pass checks, corrections and
remaining implementation acquisition gates. A plan can be detailed enough to
start implementation without pretending the not-yet-transcribed board data or
future regression evidence already exists. A gate is a concrete assigned task,
not permission to publish an approximate game as faithful.
