# Current platform contracts

Reviewed against `560606e` on 2026-10-17. This is an implementation map;
[architecture](../ARCHITECTURE.md) also contains intended future behavior.

| Boundary | Implementation | Contract / checks |
| --- | --- | --- |
| Worker scheduling | [search-worker.js](../../shared/search-worker.js) | Adapter supplies create/run/summarize, optionally advance/batchSize; generation guards, pause/resume, bounded batches. [Tests](../../test/search-worker.test.js) |
| Session loading | [session.js](../../shared/session.js) | Validate every v1 snapshot before replacing live state; consistent player count/mode, bounded cursor, normalized seats. [Tests](../../test/session.test.js) |
| Static assets | [allowlist](../../scripts/static-assets.mjs) | Explicit game/shared assets; optional games are checkout-dependent. [Closure tests](../../test/static-assets.test.js) |
| Preview / standalone packaging | [stager](../../scripts/stage-preview.mjs), [packager](../../scripts/package-game.mjs) | Relative self-contained assets; packaging is separate from release |

Games retain their own rules, observations/beliefs, ranking and views. There is no
universal calibrated meaning for values returned by different search adapters.

Worker slices yield between engine iterations. One synchronous iteration can
exceed the target slice; do not promise hard pause latency. Pause retains in-memory
search; reload does not persist trees. Conditional subtree reuse is game-specific,
not a guarantee of the shared scheduler. Exceptions discard a failed search.

Session validation checks snapshots, not proof that every historical transition
was legal or that a position is reachable. Game validators can add tighter
constraints. Exports can contain entered private facts or digital hidden state;
worker projections must independently enforce information boundaries.

For shared changes inspect all importing game adapters and run affected tests,
asset closure/packaging and relevant browser regressions. Consult
[CI](../../.github/workflows/ci.yml) for commands, not evidence that a new revision
has already passed. [Historical platform review](../PLATFORM_REVIEW.md) explains
origins; its Splendor implementation checklist is historical.
