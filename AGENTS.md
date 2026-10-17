# Agent operating guide

Build many faithful, polished browser board-game companions with competent AI.
Physical tabletop recording and useful analysis take priority over digital play.
Breadth, correctness, usability and simplicity take priority over marginal strength.

## Start here

1. Inspect `git status`, the current branch/revision, and relevant open PRs before editing. Do not overwrite another task's changes.
2. Read [documentation routing](docs/INDEX.md), then the relevant [game overview](docs/games/INDEX.md). Expand into rules, evidence or shared contracts only as the task requires; do not load the whole archive.
3. Verify actual code and execution state. Historical reports, chat memory and handoffs do not establish current behavior or a running job.

## Boundaries

- Exact edition, rules, component facts and complete legal human actions are quality gates. Cite sources and retain regression evidence for disputed interpretations.
- Separate digital true state, physical observations and sampled beliefs. Never use hidden information unavailable to the actor. Actual tabletop observations are authoritative.
- Analysis/hover/variations must not silently change the recorded game. Preserve explicit confirmation, undo/redo, correction and atomic recovery.
- Prefer existing JavaScript, workers, heuristics, tactical search and lightweight MCTS. Neural training, Rust/WASM and major rewrites require explicit authorization and demonstrated need.
- Report candidate pruning and search limits. Utilities, heuristic evaluations, iterations, terminal samples and measured wins are different quantities; none automatically implies calibrated win probability or human strength.
- Keep finished games self-contained for static hosting. This development repository and its preview have been public; never commit secrets or restricted assets. Check actual visibility rather than assuming a repository named `-dev` is private.
- `seanmason/board-game-ai-dev` owns development/evidence. `seanmason/board-game-ai` receives reviewed releases only. Implementation or packaging is not authorization to publish a finished release.

## Work and completion

- Keep changes scoped. For authorized parallel work, isolate branches/worktrees and assign game/module ownership; a coordinator owns shared infrastructure and indexes.
- Follow [documentation maintenance](docs/DOCUMENTATION.md). Update current references alongside substantive changes; preserve historical evidence and unfavorable results.
- Run relevant rules/data checks and tests. UI changes require relevant browser checks; shared changes require affected-game regressions. Record exact commands, revision, results and unexecuted gates. Do not rerun expensive tournaments for documentation-only edits.
- Use [work handoffs](docs/work/README.md) for substantial interrupted work, not permanent duplicate status logs.
- Before completing, check current scope/limitations, obsolete statements, evidence links, reproduction instructions and `npm run check:docs`. Report what changed, verification, limitations and next steps.
