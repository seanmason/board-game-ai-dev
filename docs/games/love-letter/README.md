# Love Letter — classic sixteen-card companion

Implements AEG / Tempest English classic, copyright 2012: 2–4 players,
sixteen cards, affection targets 7 / 5 / 4. The 2019 twenty-one-card edition,
Spy, Chancellor, Premium additional roles, themed editions and 5–8-player
play are excluded. Integrated into the development suite; full cloud validation gates deployment.

## Rules and provenance

- [Publisher classic rulebook](https://alderac.com/wp-content/uploads/2017/11/Love_Letter_Rules_Final.pdf),
  retrieved as publisher PDF text on 2026-10-18: printed p9 setup;
  pp10–12 turns/elimination; pp13–14 round/match victory; pp15–23 effects.
- [Publisher Premium clarification](https://alderac.com/wp-content/uploads/2017/11/Love-Letter-Premium_Rulebook.pdf),
  printed p6, sixteen-card 2–4-player section: fully equal rank and discard-total
  ties award each tied player affection; next starter follows the tied winners'
  date order. Publisher-indexed full section text was retrieved on 2026-10-18.
  Its 2–4-player table independently preserves 7 / 5 / 4. Direct PDF rendering
  failed the web tool's 14 MB content-length limit. Neither binary PDF hash
  nor a direct visual capture of Premium p6 is claimed.

Relative date/age priority is entered as a seat order; actual dates are not
collected. All fully tied qualifying classic players share match victory.
The extra-role Premium tie-playoff paragraph is excluded. Princess discards
eliminate without replacement; elimination reveals a hand without recursively
executing it. Prince can target self, must do so when every opponent is
protected, and uses the unseen reserve when the deck is empty. Countess with
Prince/King is mandatory; voluntary Countess and Princess remain legal choices.

The catalog audit uses a separate hand transcription of names/ranks/counts.
The semantic tests contain hand-computed card-effect expectations. The long
physical transcript check compares two production pathways; it is explicitly
not an independent rules oracle. No publisher illustrations or prose are bundled.

## Physical recording and privacy

The default is a physical table. Public setup records the three exposed unused
cards for two players. Unseen hands/deck/reserve contain null ranks, never
fabricated identities. Record a draw, optionally enter the actor's actual cards,
select any legal play/target/Guard guess, preview, then confirm. Unknown opponent
hands never block recording. Advice requires the actor's two known cards.

Effects use an atomic pending transaction. It survives reload and may be cancelled
before the physical effect is performed. Confirming records actual public outcomes
and authorized private looks; it has no cancellation route. Undo/history is an
explicit correction to the software record, not a claim that a person has unlearned
information. Each hand correction is recorded and conservatively invalidates
derived private constraints. Earlier snapshots retain provenance.

Private hands are concealed on reload, history navigation and actor handoff.
Users explicitly choose a viewer and reveal their panel. Priest/Baron knowledge
is observer-specific; King transfers memories to the new holder. Guard miss
constraints attach to retained cards, weaken after ambiguous draw/discard, and
are invalidated by replacement. Baron equality and surviving-card lower bounds
constrain compatible worlds. An unlike discard preserves a known card; a matching
discard removes certainty without forbidding another same-rank copy.

The JSON export intentionally contains full entered private knowledge and, in
digital mode, saved hidden state. The UI labels it a private session. It is not a
redacted sharing format. Imports validate every snapshot before replacing the
session. Validation checks coherent positions and sixteen-card conservation,
not whether a fabricated historical sequence was reachable.

## Analysis

The worker receives only the active viewer's projection, complete legal root
actions and an independent seed. Hidden truth/deck/RNG and other viewers' private
memory are omitted. It enumerates copy-weighted compatible hand allocations,
samples unseen deck/reserve order, and compares every root action through a
short complete-round continuation using a deterministic public-count policy.
Opponent continuation policies use their own cards and newly acquired knowledge;
they do not inherit the root viewer's Priest memory. No root actions are pruned.
The browser caps at 512 action samples; pause/resume retains the search.

When zero draw-pile cards remain, every compatible last-turn hand allocation is
evaluated with multiplicity weights. This is an exact last-turn round share
conditional on the represented constraints, not an exact full-game solver.
Earlier values are sampled round win shares. Affection is recorded exactly but
the search does not optimize match win probability or model strategic human
bluffing. Constraints conservatively discard certainty after ambiguous changes;
they do not learn a behavioral likelihood model from a player's card choice.

Bounded implementation smoke: seeds 1–3, every candidate seat, 64 action samples
(at least one per legal root action), one round per assignment. Against random /
deterministic baseline respectively: 2p 4/6 and 3/6 round-share equivalents;
3p 5/9 and 3/9; 4p 6/12 and 5/12. Total 60 rounds, zero illegal or capped
games; approximately four seconds on this host. These small implementation checks
do not establish improved strength. No promotion tournament was run.

## Verification and integration

Executed in the isolated checkout based on `bbe379e`:

```
node --test --test-concurrency=4 test/love-letter.test.js
node scripts/audit-love-letter.mjs
node scripts/verify-love-letter.mjs
node scripts/benchmark-love-letter.mjs
node scripts/check-syntax.mjs
node scripts/check-docs.mjs
```

The game suite currently has 22 tests, including 60 complete seeded random
matches with every generated legal branch validated. Physical transcripts cover
12 complete matches for each player count: 555 / 946 / 1,046 recorded turns and
119 / 112 / 99 round transitions, with pending JSON roundtrips at every effect.
Privacy tests include hostile hidden getters, identical observations under
different true hands, identical seeded advice, and opponent memory separation.
Coordinator browser acceptance passed on 2026-10-18 with installed headless Chrome, including desktop and simulated touch layouts. Screenshot review caught and corrected private-panel control contrast. The browser regression also covers shielded physical declaration choices and non-active digital viewers:

```
node scripts/browser-love-letter.mjs
```

Set `BASE_URL` to the suite root (including a Pages project prefix if needed),
`PLAYWRIGHT_CHANNEL=chrome` to use installed Chrome, and optional `STANDALONE_URL`.
It checks desktop, 820px tablet, 390px phone and 844px landscape; physical pending
reload/cancel, private handoff, preview, undo/redo, atomic import and worker pause.
Screenshots write `test-artifacts/love-letter-*.png`.

Suite navigation, static and standalone packaging, npm scripts, CI checks and
screenshot upload are integrated. Local integration tests passed all 25 game and
static-asset cases; catalog audit and full transcript verification also passed.

Remaining evidence gates: real iPad Safari acceptance, direct Premium p6 visual/binary hash provenance, independent full physical-table
acceptance, and any AI strength claim beyond the bounded smoke above.
