# Jaipur assumed digital profile validation — 2026-10-18

Base: canonical `c3f0cf9`, merged into owner branch as `d122e40` before edits.
User explicitly authorized assuming the best-supported token inventory and
enabling generated play. The [source ledger](sources.md) records provenance and
the remaining distinction between assumption and physical certification.

Implemented seeded full-round/match digital play, atomic refill/private bonus
resolution, exact 55-card/18-bonus conservation, owner-private projections,
scoring, seal progression and named full-tie redeal/no-seal/alternate-starter
policy. Physical setup/actual observations and manual physical adjudication
continue to use their original audit profile. Repeated round awards are rejected.

Executed:

```text
node --test --test-isolation=none test/jaipur.test.js
node scripts/audit-jaipur.mjs
node scripts/benchmark-jaipur.mjs 5
node --check jaipur/app.js
node --check scripts/browser-jaipur.mjs
node scripts/check-docs.mjs
```

23/23 tests passed. Includes deterministic seeded chance/replay, exact digital
inventory, hostile getters on deck/RNG/bonus stacks/opponent private fields,
same-observation/different-true-order policy invariance, full-tie no-seal/redeal,
no duplicate round awards, physical unknown supply preserved, complete seeded
matches, actor-only policy callback observations, and honest capped adapters.
The conventional Node test command was blocked by this host's test-subprocess
`spawn EPERM`; in-process isolation ran the same fixtures successfully without
an approval or permissions change.

The audit reports digital generation enabled under the named assumption while
retaining `exactTokenVectorsCertified:false`. One adapter smoke, seed5, completed
88 actions / two rounds with totals149:103 and seals2:0. This checks integration;
it is not promotion or strength evidence. No expensive batch study was run here.

The adapter is [scripts/benchmark-adapters/jaipur.mjs](../../../scripts/benchmark-adapters/jaipur.mjs),
quiet on import, with `metadata`, `runGame` and `simulateMatch`. Its independent
`simple-v1` opponent uses a procedural bundle collector. Production still uses
the prior all-root tactical evaluator. Latencies measure only the designated
candidate seat; match point margin sums round rupee margins. Status is complete,
capped, unresolved or illegal; caps never become draws.

The browser script now covers seeded digital setup, private pass-device curtain,
preview purity, automatic chance completion, reload, generated scoring and
next-round dealing in addition to existing physical regression checks. Fresh
staged/standalone browser execution, screenshots, shared import closure,
dashboard/batch studies and preview publishing are coordinator-owned; no new
browser pass or deployment is claimed in this owner evidence.
