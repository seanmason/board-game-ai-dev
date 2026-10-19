# Wingspan data-efficiency experiment — October 19, 2026

Status: implementation and preflight; no active campaign clock yet.
The user prioritized cheaper training-data generation over the separately approved
network-width comparison. The [frozen design](../plans/wingspan-data-efficiency-2026-10-19.md)
owns comparisons, budgets, selection and stop rules.

## Implementation and ownership

New research namespace: `scripts/wingspan-data-efficiency/`. Production rules,
heuristics and defaults are unchanged. The completed compact campaign remains
preserved in its original source/runtime; its final Validation/Pages/public feed
were verified and its monitoring heartbeat was paused.

The actor chooses one sampled successor per supplied candidate on cheap main
decisions, settles powers, uses prior-only cheap power choices and retains searched
setup. The baseline remains byte-for-byte behavior-equivalent to existing search.
Actual decisions preserve redacted examples and complete terminal labels. Reference
opponents are supported without neural calls. Search h4 excludes its root; cheap
h1 includes only the root plus powers. Do not conflate those depth conventions.

Controller: two outcome-blind full-collection calibrations, fixed balanced sizing,
actual cost-match gate, common replay/development weighting, same frozen warm start,
sequential GPU fits, export parity, one fixed screen and conditional confirmation.
Partial failures stop without retries; ownership/source/config/data/model guards
and original deadline prevent overlapping runs or silent clock resets.

A separate training-only baseline sampling-noise probe selects four retained train
games by identity and32round/viewer cases, preserves labels and exports only safe
aggregates. Old audit/evaluation data never enter fitting or diagnostic selection.

## Validation and publication

Focused actor, protocol/runtime and diagnostic tests passed before integration.
Final integrated commands/results, exact source/model hashes, launch/process receipts,
public evidence branch/dashboard and original deadline will be recorded after the
remaining preflight checks. Unit/browser checks do not establish stronger play or
actual iPad Safari acceptance. No production promotion is automatic.
