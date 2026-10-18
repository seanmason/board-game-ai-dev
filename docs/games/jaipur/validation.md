# Jaipur validation evidence — 2026-10-18

Development branch `codex/jaipur`, based on stabilized `bbe379e`.
Game-owner changes only; coordinator integration and release are separate.

Commands (repository root):

```text
node --test test/jaipur.test.js
node scripts/audit-jaipur.mjs
node scripts/verify-jaipur.mjs
node scripts/benchmark-jaipur.mjs
node scripts/browser-jaipur.mjs
node scripts/check-syntax.mjs
npm run check:docs
```

Final engine run: 18/18 tests passed. Includes independent brute-force
physical-card exchange enumeration, partial precious sales, hand limits,
overlap rejection, failed-observation purity, terminal partial refill,
eighth three-card-sale/no-bonus synthetic fixture, immediate third-pile ending,
full-tie agreement, next-round starter, complete-history import rejection,
hostile private getters and same-observation/different-hidden-truth advice.
An entered synthetic complete match reaches two seals through round scoring,
restart, correction and deterministic replay with conservation checked after
every transaction. The actual Jaipur adapter was exercised through the shared
worker lifecycle with partial-ranking pause/resume, bounded completion and stale
generation rejection. This is a synthetic operator-entry integration transcript,
not evidence from an independently played physical copy.
Synthetic fixtures are explicitly not evidence of certified edition data.

Initial browser launch was blocked with sandbox `spawn EPERM`. The rerun requests
explicit permission for headless Chrome; the approved final rerun passed. The browser script creates its own
loopback static server, exercises actual setup and recording, and saves desktop
and tablet PNGs to the system temporary `jaipur-browser-evidence` directory unless
`JAIPUR_SCREENSHOTS` is supplied. Browser checks passed actual setup,
preview/cancel/confirm, private bonus prompt, unknown-opponent action/refill,
undo/redo/reload, atomic malformed import rejection, escaped history, private
export roundtrip, worker advice, keyboard action, complete exchange/payment
editor, validated correction, round scoring and match end. Desktop (1360×1000),
tablet (820×1180) and phone (390×844) had no horizontal overflow. Desktop/tablet
screenshots were visually inspected. Temporary evidence files (not committed):

| File under system temporary `jaipur-browser-evidence` | SHA256 |
| --- | --- |
| desktop.png | `d72fc4a0863bcfdfabcd7b7be3e7fc0bf47b7f64f75369fc8d3c57f27f5d9e92` |
| tablet.png | `d7139ac46243acee5d83eb34be35d6a470da42d09e2702722ab350c0476286b6` |

`node scripts/audit-jaipur.mjs` passed physical count/generation-gate checks and
reported exact-vector certification blocked. `node scripts/check-syntax.mjs`
passed all 225 JavaScript modules. `node scripts/check-docs.mjs` (the command
behind `npm run check:docs`) passed 51 maintained files and nine pre-existing
packaged-game entries; this owner branch has no shared registry edits. The shell
did not expose `npm`, so the underlying Node documentation check was used.

Strength benchmarking reports blocked with zero games: exact hidden token data
is uncertified. No tournament win rate or rollout calibration is claimed.
Remaining validation gates include matching-edition component certification,
publisher edge-case rulings, independent real-table match transcript, coordinator static
import closure/standalone packaging and any release decision.
