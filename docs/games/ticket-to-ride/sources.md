# USA exhausted-supply source review — 2026-10-18

Scope is the original USA thirty-ticket rules family. This review does not adopt
Europe, Nordic, refresh, digital-platform conventions or the separate authorized
Jaipur inventory assumption. [Catalog acquisition](ACQUISITION.md) and the
[existing ledger](../../../ticket-to-ride/source-ledger.json) retain their
separate component provenance and unresolved audit status.

## Primary sources inspected

- [Days of Wonder legacy English 2015 reprint](https://ncdn0.daysofwonder.com/tickettoride/en/img/tt_rules_2015_en.pdf),
  four-page PDF, accessed 2026-10-18. PDF page3, **Train Car Cards**, explicitly
  prohibits drawing train cards when both the train deck and discards are empty;
  the remaining turn choices are route claim or destination draw. This paragraph
  does not exempt still-visible market cards. The same page requires a face-up
  purchase to be refilled and a three-locomotive market to be discarded/replaced.
- [Publisher-authored original English manual distributed with the official Steam release](https://cdn.akamai.steamstatic.com/steam/apps/108200/manuals/tt_rules_en.pdf?t=1696352833),
  copyright2004, PDF page3, **Train Car Cards**. Independent original-text
  cross-check gives the same exhausted deck/discard prohibition and ordinary
  refill/reset procedure. The host distributes the manual; Days of Wonder is
  the rules author.
- [Publisher 2024 USA English rules](https://cdn.svc.asmodee.net/production-daysofwonder/uploads/2024/05/7201-T2R-Rules-EN-20240423_LOWRES.pdf)
  was cross-searched and its indexed text corroborates the no-deck/no-discard
  paragraph. The direct web fetch did not expose a readable PDF in this pass;
  the implemented decision rests on the two fully readable legacy manuals.

Text was inspected through web PDF extraction; no source bytes were downloaded,
so no new PDF hash is claimed. Source locations refer to PDF pages1–4, counting
the cover as1. The statement about the two empty piles applies to the whole
train-card draw action, not merely blind draws.

## Settled correction

Previously `sources()` offered all five face-up cards even when deck and discard
were both empty, then failed after one was selected because its refill did not
exist. The corrected legal-action generator omits all train draws in that state,
including a face-up locomotive. Existing route claims and nonempty destination
draws remain available; no pass or winner is invented. An empty deck with
nonempty discards still permits drawing after normal recycling. One available
replacement also permits a face-up locomotive's complete one-card turn.

## Not settled by this research

The legacy manuals still require a market containing three locomotives to be
discarded and replaced. Neither gives a stopping exception when fewer than
three non-locomotive cards remain in the combined market/deck/discard pool.
Keeping an unreset market, removing locomotives, dealing fewer market cards, or
ending the game would each add an unprinted convention. No authenticated USA
publisher FAQ or designer clarification for that situation was located.

The exact continuation after a legal first card consumes the final drawable
card (or its refill) also lacks an explicit one-card-turn shortage procedure in
the inspected legacy text. The no-supply restriction now correctly removes
remaining face-up choices; the existing explicit adjudication preserves the
already-observed first card. It does not silently finish the turn or undo a real
private observation. No-ordinary-action and completely exhausted ticket cases
remain explicit; zero destination draws are already omitted.

Searches included the publisher site, legacy USA FAQ paths and combinations of
USA/exhaustion/hoarding/three locomotives with official FAQ and designer names.
The historical publisher FAQ URLs did not return readable material. Search
results for other editions and unattributed secondary summaries were not used
to override this edition. This is a bounded search result, not proof that no
publisher clarification exists anywhere.

The material remaining decision is whether to retain unresolved records until an
attributable ruling is available or authorize a separately named compatibility
convention for impossible market resets/partial train turns. No such convention
has been assumed in this change. See [resolution evidence](supply-resolution.md).
