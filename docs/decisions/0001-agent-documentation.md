# 0001: Agent-oriented documentation and evidence boundaries

Status: accepted. Date: 2026-10-17. Scope: repository documentation.
Basis: user approved the documentation proposal and requested implementation.

## Problem

Chronological reports mix current behavior, old plans and measured evidence.
An agent can mistake a historical blocker or aspiration for current state.

## Decision

Use a short agent guide, task routing and per-game current overviews. Preserve
existing reports as linked evidence. Separate current references, evidence and
temporary work plans. Keep one canonical home for each fact and migrate gradually.
Use lightweight Markdown and existing Git workflows; add local link/entry checks.

A single global mutable status narrative would duplicate game summaries and
increase contention. A wholesale report rewrite would risk losing provenance.
A separate knowledge database is unnecessary at this scale.

## Consequences and reconsideration

Substantive changes update their current references and relevant evidence together.
Old reports may still contain superseded plans; readers enter through the current
overview. Rules/data, AI, physical workflow, device checks and release readiness
remain separate evidence dimensions.

Revisit automated index generation if the game directory becomes costly to maintain.
Add structured experiment metadata only when actual tooling needs it; do not impose
an unused schema on every existing result. See [policy](../DOCUMENTATION.md).
