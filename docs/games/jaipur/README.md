# Jaipur companion

Scope: Space Cowboys Vincent Dutrait English edition, copyright 2019; two
players. [Play/record](../../../jaipur/index.html). The implementation is a
physical recorder and seeded digital game with conservative tactical advice.
The user explicitly authorized the best-supported token inventory as an assumption
after further research. Digital profile `assumed-inventory-2026-10-18-v1` is
attributed in the [source audit](sources.md); it does not claim complete independent
photographic certification or a publisher ruling for unprinted edge cases.

Digital setup shuffles all 55 cards (three reserved market camels), deals five
to each player, completes the market and separately shuffles the three bonus
classes with a deterministic seed. Refill and bonus chance results resolve
atomically. Card identities, private bonus values, future stack order and RNG
state stay in true state. A normal digital round awards a seal and the loser
starts next. A complete published-comparison tie uses the disclosed simulation
policy: no seal, redeal, alternate the previous round's starting seat. Empty bonus
classes award no unavailable token. These policies are not publisher rulings.

## Physical recording and rules

Setup asks for all 38 actual goods-token values, highest first, the actual counts
of the 18 bonus tokens by class, the operator's five dealt cards, the opponent's
public hand size, and five market cards. No draft distribution populates setup.
The other starting herd size follows from the five-card deal and public hand size.
Subsequent private hands can remain unknown for public action recording. Advice
requires the active player's entered hand and own herd; it never needs the
opponent's private hand. A later position can be entered through the validated
operator correction/import interface, with a reason and explicit deck/discard
counts. There is no streamlined arbitrary-midgame setup wizard.

Market takes, all-camel takes, all multiset exchanges/payment combinations, and
all legal sale sizes are recorded with preview and explicit confirmation. A
refill asks for actual cards, including a terminal partial refill. A bonus asks
for the owner's actual inspected value or permits it to remain unknown. Scoring
requires all bonus values and herd sizes, then applies rupees, bonus count and
goods count. Complete equality needs explicit agreed adjudication. Empty bonus
supply uses the named `finite-supply-no-bonus` interpretation, not a publisher
ruling. No unavailable token is fabricated. The loser starts the next round;
two seals wins the match.

Undo/redo, history navigation, autosave, private session export/import and
validated corrections cover entered positions. Every snapshot is validated
before import replacement. The separate private observation archive survives
history navigation and branching because real information cannot be unlearned.
Advice ranks the recorded position; it does not incorporate counterfactual
knowledge from a later recording. Reconcile the actual table before asking for
advice after undo. There is no cancellation that pretends to undo an already
observed physical effect; previews can be cancelled before confirmation.

## Information and AI

The pass-device curtain hides the preceding actor's private area. Worker payloads
contain the actor's entered hand/herd, public market, discard, token supplies,
public actions and hand sizes. Opponent hand, herd cardinality and bonus values
are excluded. Own previously inspected bonus values remain owner-known. The
operator export can contain both players' private facts and must be handled away
from the opponent.

The worker ranks every canonical legal action with a deterministic heuristic:
immediate goods return, the minimum possible bonus in the published range, hand
space, set-building and payment cost. It reports ranked/unvisited root counts and
supports shared pause/resume/generation handling. Evaluations are not calibrated
win probabilities. The existing tactical formula remains the production default;
no implementation smoke result promotes a replacement. There is no
hidden-information rollout or neural training. `belief.js` exposes a conservative
residual-card pool and samples bonus marginals only under the assumed digital
profile, removing legitimately known earned values. It does not claim to sample
full history-conditioned opponent beliefs. Physical mode continues to require
actual observations rather than substitute assumed bonus values.

The [benchmark adapter](../../../scripts/benchmark-adapters/jaipur.mjs) exports
quiet `metadata`, `runGame` and `simulateMatch` interfaces. Production tactical
ranking is compared with an independent procedural set collector (`simple-v1`),
which collects bundles and improves set potential rather than reuse the production
formula. Policies receive only their acting-seat observation and legal actions;
each simulated opponent is rerooted at its own view. Match scores/margins are sums
of per-round rupee totals, separately from seal wins. Capped or illegal games have
no invented winner. The coordinator owns batch studies and the dashboard.

## Implementation and verification

- [Core](../../../jaipur/core.js): immutable physical state/actions, observations,
  conservation, scoring, corrections and round progression.
- [Actions](../../../jaipur/actions.js): exhaustive canonical exchanges and sales.
- [Observation projection](../../../jaipur/observations.js): explicit privacy boundary.
- [AI](../../../jaipur/ai.js), [worker](../../../jaipur/worker.js),
  [belief boundary](../../../jaipur/belief.js), [catalog](../../../jaipur/catalog.js).
- [Regression tests](../../../test/jaipur.test.js) and
  [browser check](../../../scripts/browser-jaipur.mjs).
- [Validation evidence](validation.md), including commands and remaining gates.
- [Assumed digital extension evidence](digital-validation.md).

The existing physical companion was integrated into navigation, static/standalone
packaging and CI with coordinator browser acceptance. The digital extension adds
23 passing rules/privacy/simulation tests and an expanded browser regression;
its fresh packaging/browser/publish checks belong to coordinator integration.
Source limitations remain explicit above.
