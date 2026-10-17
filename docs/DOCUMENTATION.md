# Documentation maintenance

## Three document lifecycles

| Kind | Owner/location | Update rule |
| --- | --- | --- |
| Current reference | Game overview, platform contract, index | Rewrite obsolete statements when behavior changes; keep concise |
| Evidence | Experiment, rules/data audit, validation report | Preserve original outcomes; append explicit corrections or link replacement evidence |
| Work plan | Issue/PR or `docs/work/` | Update while active; close and promote lasting findings on completion |

Each fact has one canonical home. Indexes route; they do not duplicate detailed
status. README is an introduction, not a chronological development log. Small
games may keep rules and AI in their overview; split into `rules.md` / `ai.md`
only when useful. Existing combined reports remain legacy references during gradual
migration; their current overview resolves superseded statements.

## Game entry points

Use the [game template](templates/game.md): scope, capability and information
boundaries, implementation map, current AI and metric meanings, verification by
dimension, limitations, next priorities and selective evidence links. A single
"complete" flag is insufficient. Separate rules/data, physical workflow, AI,
browser/device and release evidence. Describe missing evidence explicitly.

Reviewed revision/date identifies what was inspected, not a claim that tests were
rerun or every paragraph was reverified. Record tested revisions in evidence.
Link paths rather than unstable line numbers. Use descriptive link labels.

## Claims, sources and decisions

Consequential claims need scope, evidence and limits. Distinguish publisher rules,
publisher clarifications, community interpretation and unresolved inference.
Map difficult interpretations to regression tests. For component-heavy games,
retain per-component audit coverage and provenance. Multiple agreeing datasets
may share ancestry; a production/reference comparison may share catalog facts.

Record decisions only when their rationale will prevent repeated investigation.
Use [decision records](decisions/README.md) for important contracts, algorithm
choices or policy changes; routine details belong near code. Include conditions
for reconsideration rather than turning a failed experiment into a permanent ban.

## Experiments and artifacts

Follow [benchmark conventions](../benchmarks/README.md). Retain failed and
inconclusive results, exact configuration and limitations. Never silently replace
an old run with a rerun. Corrections must distinguish invalidated evidence from
unfavorable but valid evidence. Avoid unsupported aggregate claims across games.
Large artifacts may be stored outside Git, but record durable locations/checksums;
release-critical evidence cannot depend solely on expiring CI artifacts.

## Completion and concurrent work

With substantive changes, update affected references, limitations and evidence in
the same PR. Close superseded plans. Do not copy a chat transcript into the docs;
extract decisions, reproducible facts and remaining uncertainty. Game owners edit
their own overview/evidence; the coordinator handles shared contracts and indexes.
Avoid global mutable status logs that every worker must edit.

Documentation-only work checks links and source consistency; it does not create
new game-strength evidence. `npm run check:docs` checks local Markdown file links
in current documentation, the root agent guide and README, plus game entry-point
coverage. It excludes legacy reports and template placeholders and does not
validate external URLs, anchor fragments, prose claims or code spans. Inspect
those manually when relevant. Do not infer external-source validity from a pass.

Migration is incremental: preserve existing report paths, add overview pointers,
and split a large report when next substantively edited. Avoid empty bureaucracy,
mandatory vector databases or a second knowledge store that must track Git.
