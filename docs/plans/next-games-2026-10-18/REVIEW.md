# Handoff review and implementation readiness

Reviewed 2026-10-18. This is a planning-quality review, not a claim that engines,
UIs, component catalogs or strength experiments have already been implemented.
The coordinator inspected all six handoffs and the shared contract; separate
agents reviewed a different pair from the ones they authored.

## Coverage checked

Every plan, together with COMMON, specifies: exact game/edition/player scope;
primary sources and rule-page references; component schema/counts; setup and
turn phases; complete legal human actions; scoring/endgame/ties; state/action
representation; permitted information and observation memory; physical entry,
confirmation/correction/recovery; a modest initial AI; concrete rule fixtures
and invariants; bounded benchmark design; owned modules and coordinator-only
integration. Planned scripts/files are labelled as future work, not linked as
if they already existed. The six plans can be assigned independently with their
shared contract and scoped module ownership.

| Plan | Rules/catalog detail | Physical/information detail | AI and tests | First implementation gate |
| --- | --- | --- | --- | --- |
| Ticket to Ride | Original 30-ticket edition, lane multigraph and exact trail scoring | Draw/refill/ticket subphases and private objective sampling | Network baseline, sampled search, exact tiny-graph fixtures | Acquire/audit original board lanes and all ticket values; implement named supply-adjudication states |
| Love Letter | All 16 cards/effects, 7/5/4 targets, classic-compatible tie clarification | Viewer-specific Priest/Baron/King/Prince knowledge and event lifetime | Finite belief sampling, exact small endings, privacy fixtures | Preserve publisher clarification evidence alongside fixtures; no unresolved ordinary effect left to agent invention |
| Jaipur | Exact 55-card inventory and complete token vectors with provenance level | Exchanges, herd information, owned bonus values, partial refill | All human sale/payment choices, compact evaluation, sampled rounds | Independently verify token values/multiplicities; resolve or explicitly label rare unprinted supply/tie policies |
| Sushi Go! | All 108 cards/12 printed types, ordered double picks and exact scoring | Simultaneous hidden commitments, hand-passing memory, private handoff | Exact marginals plus constrained samples, joint-transition and scoring fixtures | Archive author/designer clarifications for zero maki and resolution order; build simultaneous transition first |
| Lost Cities | 60 cards/five named suits, exact wager/8-card score formula | Separate placement/draw phases, observed discard memory and deck clock | Complete roots, cautious expedition baseline, cycle-aware sampling | Verify source page map and implement explicit tied-next-starter decision/profile for three-round play |
| Hive | All 22 pieces, Queen deadline, five movement families and stacks | Public physical position, full stack identities, reversible correction | Alpha-beta, exact tactical terminal checks, geometric oracle fixtures | Certify coordinate/height gate cases and continuous-contact movement against source diagrams |

## Issues found and corrected in the second pass

- Kept original Ticket to Ride's 30 tickets distinct from the current 33-ticket
  refresh. Distinguished 45 usable trains per player from physical spares.
  Catalog lane/city counts remain explicit acquisition hypotheses until audited.
- Required maximum-weight edge trails, including revisiting cities, for Ticket
  to Ride's final longest-route score. A diameter/simple-path shortcut would be
  wrong. Added concrete handling of supply cases that the booklet does not resolve.
- Kept classic Love Letter's seven-token two-player target distinct from the
  newer six-token edition. Used the publisher's sixteen-card Premium section to
  resolve fully equal round ties. Added Guard-failure constraint lifetime tests.
- Identified reachable Jaipur bonus-pile exhaustion rather than assuming that
  game termination always prevents it. Defined a named provisional interpretation
  and explicit adjudication phase; neither is mislabelled a publisher ruling.
  Clarified that a drawn own bonus value is private actor knowledge.
- Confirmed Sushi Go!'s 12 printed types (rather than 11), zero-maki eligibility,
  ordered chopsticks/wasabi consequences and residual final equality handling.
- Recomputed Lost Cities' worked fixtures, keeping the eight-card bonus outside
  the wager multiplier. Corrected the visually verified PDF page map and specified
  how exact-search branches handle legal discard cycles without fabricating draws.
- Clarified Hive ground sliding: a zero-contact edge can be illegal even if its
  endpoints each touch the hive. Stack-height-aware Beetle gates need their own
  coordinate fixtures; moving a top Beetle does not remove its support hex.
- Aligned stable app/worker/observations/entry filenames and the two-player
  experiment thresholds with COMMON. Added explicit shared-winner outcomes after
  exhausted final tiebreaks instead of invented seat preferences.
- Distinguished cancelling an unperformed software preview from undoing a real
  private observation: actual knowledge retains event provenance.

## Honest readiness boundary

All six are **ready to assign as implementation projects**, beginning with their
named acquisition/rules gates. That does not mean all are ready for an unattended
faithful full-match tournament on day one. Ticket to Ride has the largest data
acquisition task. Jaipur has an unaudited token-data draft and rare unprinted
outcomes. Lost Cities has a next-round-starter ambiguity. The plans tell the
implementer exactly how to represent an unresolved state without inventing facts
or silently treating a cutoff as a draw; where useful they define a named optional
compatibility policy and restrict evidence claims accordingly.

These are explicit tasks/acceptance boundaries rather than missing specifications
for an agent to guess. A game may deliver a faithful physical adviser and exact
ordinary/single-round rules before claiming certified automatic match behavior.
If a gate cannot be resolved from authorized sources, preserve the issue, its
recorded profile and the resulting limitation; do not certify that dimension.

## Validation of this package

Run repository documentation checks and a separate recursive link/existence scan
for this directory. The existing check-docs script scans maintained overviews,
platform/work/decision files and routing, but does not recursively inspect a new
plans directory. No source-code or strength tests are necessary for a docs-only
planning change, and no such pass result is claimed. Check actual source URLs
and editions manually; a local link scan cannot certify external rule content.

Executed package checks: `node scripts/check-docs.mjs` passed (38 maintained
files, nine packaged-game entry points); the additional recursive scan checked
nine planning Markdown files with zero missing local links; all six plans link
COMMON and exceed 1,200 words; `git diff --check` passed. External content was
reviewed through the source-ledger research described in each plan, not certified
by these offline checks.
