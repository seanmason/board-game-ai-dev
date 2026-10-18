# Jaipur physical companion

Scope: Space Cowboys Vincent Dutrait English edition, copyright 2019; two
players. [Play/record](../../../jaipur/index.html). The implementation is a
physical recorder with conservative tactical advice. Generated digital games and
hidden bonus sampling are blocked by the [source audit](sources.md), which has
not certified exact token multiplicities. This is not a complete official digital
edition, an AI strength result, or a released game.

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
win probabilities. There is no hidden-information rollout, generated bonus
distribution, neural training or strength tournament. `belief.js` exposes only a
conservative residual-card pool and refuses exact bonus sampling; it does not
claim to sample full history-conditioned opponent beliefs.

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

No shared registry, allowlist, suite links, CI or package scripts are modified by
the game owner. The coordinator must integrate the exact asset list and run
standalone packaging/static import closure before release. No publishing is
authorized by this implementation.
