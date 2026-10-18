# Ticket to Ride

Original USA, 2–5 players, 30 original small tickets. Excludes Europe, USA 1910,
anniversary additions and the 33-ticket refresh. This is an implementation candidate
with open source and ruling gates, not a certified faithful release.

## Physical and digital workflow

[Open the companion](../../../ticket-to-ride/index.html). Physical mode records
actual setup, market refills, claims and exact payments, partial train draws and
ticket selections. Opponent blind draws may remain unknown; opponent ticket draws
can record only the number kept. Unknown own cards block advice, not unrelated
public recording. Digital mode provides seeded deals and complete manual play.

Select or inspect advice, then Confirm. The privacy curtain hides private cards,
payment choices and advice. Every seat can reveal final tickets. Session import
validates every snapshot atomically. Export archives contain private cards and
true digital deck order: keep them private. Physical history is read-only until
Latest; corrections need a reason. Unobserved blind draws can cancel, while real
observed effects require correction or explicit table adjudication.

## Implementation and inference

[catalog.js](../../../ticket-to-ride/catalog.js) holds 36 cities, 100 lanes and 30
provisional tickets. [Acquisition evidence](ACQUISITION.md) and the
[source ledger](../../../ticket-to-ride/source-ledger.json) distinguish gates.
[core.js](../../../ticket-to-ride/core.js) owns immutable transitions and import
validation; [actions.js](../../../ticket-to-ride/actions.js) enumerates payments.
[scoring.js](../../../ticket-to-ride/scoring.js) uses connectivity and an exact
maximum weighted trail with witness, allowing repeated cities but no repeated lanes.
Normal UI renders compute route points cheaply; exact trails run for final scores.

[observations.js](../../../ticket-to-ride/observations.js) never reads opponent
card identities or true decks for worker projection. [belief.js](../../../ticket-to-ride/belief.js)
samples possibilities consistent with public purchased cards and remembered private
ticket return timing. Unknown physical draws conservatively forget hidden shuffled
pool positions; this intentionally loses inference precision rather than inventing
which color disappeared. It is not a complete Bayesian model.
[ai.js](../../../ticket-to-ride/ai.js) and [worker.js](../../../ticket-to-ride/worker.js)
compare sampled destination pressure, route points and connection costs. Every legal
root is available, pruning is zero. This is a bounded network heuristic, not rollout
search, calibrated win probability or a demonstrated strength improvement.

## Verification and limitations

At starting revision bbe379e plus this draft:

- `node --test --test-isolation=none test/ticket-to-ride.test.js`: 34 passed.
  Covers tiny-graph independent trail
  enumeration, hostile hidden getters, unknown physical turns, malformed imports,
  public memory, reflected supply and semantic action identity.
- `node scripts/audit-ticket-to-ride.mjs`: structural counts, parallel groups and
  connectedness pass. This does not certify ticket-face fidelity.
- `node scripts/verify-ticket-to-ride.mjs`: complete deterministic 2, 3, 4, 5 player
  transcripts in 132, 207, 269, 342 actions; conservation/completion, not strength evidence.

Coordinator browser acceptance passed against staged suite and standalone assets
using installed Chrome. It covers physical setup and partial draws, concealed
worker advice, full payment access, immutable previews, correction confirmation,
history/reload, invalid import rejection, all-seat final ticket revelation, a
390-pixel phone viewport and an actual touch-enabled tablet context. Browser
review found and fixed phone grid overflow; map padding was extended so Boston's
label is visible. Screenshots are retained under `test-artifacts/ticket-to-ride-*`.
Suite navigation, static/standalone packaging, npm commands and CI are integrated.
No real iPad Safari test or strength tournament has run.

Open acceptance: fresh independent ticket-face review; publisher-quality board
corroboration and visual overlay audit; attributable exhausted-supply rulings or
continued explicit administrative adjudication; complete real tabletop transcript;
real iPad Safari acceptance. See [original handoff](../../plans/next-games-2026-10-18/ticket-to-ride.md).
