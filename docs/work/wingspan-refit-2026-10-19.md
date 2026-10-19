# Wingspan teacher refits — October 19, 2026

Status: running from 19:53:46.960 UTC; scientific source and deadline are frozen.
The [protocol](../plans/wingspan-refit-2026-10-19.md) fixes the four recipes,
replay, gates and one conditional further self-play iteration. All earlier
campaigns and paused monitors remain untouched. Production is unchanged.

Separate research namespace: `scripts/wingspan-refit/`. The coordinator integrates
trainer/controller branches, owns dashboard/publication and verifies the frozen
runtime. Source/model/inventory hashes, actual launch/deadline/process receipts,
local validation and public evidence will be recorded after final preflight.
The freshly initialized auxiliary head is a mechanism to test, not a claimed
explanation of prior strength results. No new strength evidence exists yet.

## Integrated preflight

Four recipes and the conditional cycle are implemented. Whole paired outcomes are
withheld until fixed comparisons finish. Publication includes per-stage gates,
parent/candidate model hashes and accepted teacher lineage, without local paths.
Raw strength-game receipts remain guarded alongside collection and replay inputs.
The launch enforces the documented generation-3 parent hash and exact CUDA device.

Validation: full `node --test --test-concurrency=6` passed 1,175 tests; after final
receipt/device guard changes, the focused refit suite passed 29 tests. Syntax
checked 440 JavaScript modules; documentation checked 87 files and 15 packaged
entries. Python syntax and dashboard phone/tablet/live-cache browser checks passed.
A separate two-game CPU infrastructure fit exercised the delegated trainer and
export parity; it is excluded from research fitting, selection and strength.
CUDA 2.11.0+cu128 / RTX 3080 was detected in the existing runtime.

Seed preflight covers 1,360 distinct maximum new setup IDs with no overlap against
12,333 retained historical/planned IDs. It reads both the private historical audit
chain and the last campaign's maximum banks, rather than losing old identities
through a public scrubbed source inventory. These checks preceded launch.

## Frozen launch

Scientific revision: `29e5d95d9bc38a80a798c9e969225fecdc7c8580`.
Runtime: `C:/Users/mason/.codex/benchmark-runs/wingspan-refit-20261019/campaign`.
Source: `C:/Users/mason/.codex/worktrees/wingspan-refit-20261019`.
Original active start: **2026-10-19T19:53:46.960Z**. Hard deadline:
**2026-10-19T22:53:46.960Z (5:53 p.m. Central)**. Controller PID 95140 and
publisher PID 93392 were verified against actual command lines. Initial input
verification preceded the active clock; both timestamps remain in local receipts.

All 127 source/config/model/audit guards are frozen. Exact 123-file source archive
SHA-256: `39d511bd669cf40c9e38443af71aef71ed2673b395182645f68251d4f5ae0da8`.
Source, seed audit and parent weights were published before fitting on evidence
branch `benchmarks/wingspan-refit-2026-10-19`. The 90-second publisher confirmed
its initial live push without errors. Phase `f0-control` began normally.

[Dashboard](https://seanmason.github.io/board-game-ai-dev/benchmark-dashboard/?study=wingspan-refit)
deployment is gated by comprehensive Validation/Pages. New monitor:
`review-wingspan-conservative-teacher-refits`; old monitors remain paused.
No stronger teacher is claimed at launch. Production remains unchanged.
