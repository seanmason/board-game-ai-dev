# Exhausted USA train supply correction — 2026-10-18

Based on `f4c61a6`, isolated branch `codex/ttr-supply-followup`.
Ownership: core legal source predicate, focused supply tests and source/evidence
documents only. No AI, benchmark adapter, shared code or game README changed.

The [primary review](sources.md) resolves one former adjudication trigger:
when deck and discard are empty, USA rules prohibit the whole train-card draw
action even if face-up cards remain. Legal generation now rejects those draws
before mutation. A route claim or nonempty destination draw can still continue
the game. Previously recorded/observed effects are not retroactively erased.

Seven new fixtures check physical and digital empty-pile restriction; no
locomotive bypass; recycling from discards; legal last-replacement locomotive;
explicit one-card-mid-turn adjudication with actual physical card retained;
impossible market reset remaining unresolved; unknown-opponent observations and
conservation. The old test expecting the now-illegal zero-supply market draw was
minimally updated to expect rejection and preservation of the original record.

Reproduction:

```text
node --test --test-isolation=none test/ticket-to-ride-supply.test.js test/ticket-to-ride.test.js
node scripts/check-docs.mjs
git diff --check
```

The final combined core/supply run passed **41/41 tests**. The documentation
checker passed68 maintained files /15 packaged entries; core syntax and
`git diff --check` passed. One tiny replay used seed148, two players, candidate
seat0, samples128, maxTurns600: **complete**,166 action substeps, scores57:64,
zero illegal actions, approximately1.97s. This is a single reproduction/smoke,
not a replacement tournament or source of strength claims. No batch
tournament was run. Previous 92/560 unresolved counts (87 market resets, five
unrefillable draws) are historical context, not remeasured counts. This fix must
not be described as resolving all92 cases: the dominant impossible-reset rule
question remains, and policy choices may reach different later positions.

No UI controls changed: existing complete legal-action lists feed both human
recording and AI root choices. No browser launch was needed for a three-line
shared source predicate correction. Physical actual-card observation phases,
undo/import history, cancellation boundaries and explicit adjudication are
preserved. The user has not authorized a Ticket to Ride house convention.
