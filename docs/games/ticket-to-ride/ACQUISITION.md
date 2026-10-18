# Ticket to Ride original USA acquisition gate

Reviewed 2026-10-18 at starting revision `bbe379e`. The target is the original
30-ticket USA game, excluding USA 1910 and the 33-ticket refresh.

The [machine-readable source ledger](../../../ticket-to-ride/source-ledger.json)
records source URLs, observed access failures and exact coverage. All hashes are
null because no component-image bytes were successfully acquired. No catalog,
engine, app, independent component audit or release readiness is claimed.

## Current blocker

Image-search candidates include an Asmodee legacy setup PNG, a larger flat board
at a retailer and a seller photograph of all 30 small destination cards. Web text
access established the source leads; it did not establish readable pixels or
card-by-card facts. Direct image fetching failed. Sandbox shell downloads failed
with connection refusal; the required escalated retry was aborted after waiting
for approval, without successful acquisition. The temporary acquisition directory
was checked and contained no files.

Do not seed a production catalog from remembered routes, a community dataset or
image-search descriptions. The coordinator should receive the actual external
source image location before independent transcription, without first seeing the
production table. Hash the successfully downloaded bytes, then map each lane and
ticket to its visible source location. Do not check publisher artwork into Git.

## Rules evidence and limitations

The [publisher 2015 rules](https://ncdn0.daysofwonder.com/tickettoride/en/img/tt_rules_2015_en.pdf)
support the original 30-ticket inventory. Page 3 provides discard recycling and
prohibits train-card draws with no deck or discards. It does not completely settle
impossible locomotive refreshes, a lone drawable card, zero tickets or no legal
ordinary action. No attributable publisher clarification resolving those cases
was found in this search. Retain the planned `supplyAdjudication` boundary; do not
invent an ordinary pass or classify an unresolved automatic game as a draw.

The [current publisher page](https://www.daysofwonder.com/game/ticket-to-ride/)
lists 33 tickets. The
[2025 refresh rules](https://cdn.svc.asmodee.net/production-daysofwonder/uploads/2025/07/7201N_TICKET2RIDEV2_RULES_EN_20250425_WEB.pdf)
offer four tickets at setup, so they cannot replace the pinned original rules.

Implementation and acquisition requirements remain in the
[original-USA handoff](../../plans/next-games-2026-10-18/ticket-to-ride.md).
No user clarification is necessary merely to retry viewing the identified sources.
If usable online component references cannot be obtained, the concrete alternative
is an unobstructed photograph of the original USA board and readable fronts of all
30 original small destination cards. That physical reference would establish
component facts, not a ruling on the unresolved supply transitions.
