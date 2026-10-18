# Six-game AI comparison

User authorized best-supported Jaipur token assumptions, development publication,
and AI-versus-practical-heuristic benchmarking with a published dashboard on
2026-10-18. The earlier demand for physical certification before generated Jaipur
play is superseded by this explicit assumption authorization. Source provenance
must remain honest. The finished-release repository remains outside scope.

## Predeclared study

Evaluate current policies for Ticket to Ride, Love Letter, Jaipur, Sushi Go!, Lost
Cities and Hive. Forty independent seeds per game/player-count matchup, seed
`5182600 + 997*i` for `i=0..39`; rotate the candidate through every seat against
practical heuristic opponents. Preserve player-count strata. Full matches where
supported; manual/adjudication simulation policies and remaining source limits
are recorded by each adapter. Lost Cities' production default is practical,
not its optional sampled policy. No incumbent changes follow this screening.

Freeze source revision, file hashes, budgets, policy identities and task list in
the manifest before running. Use twelve BelowNormal workers by default, at most
24. Each game result is checkpointed independently. Resumption requires an exact
manifest match; failures/caps/unresolved games are never relabeled as draws.

Winner shares and margins use complete seed-group averages; approximate 95%
Student-t intervals count independent setups, not seat rotations. Missing groups
are excluded and completion counts remain visible, with an explicit selection
bias caveat. Policy-specific modest budgets measure strength at those budgets;
latency/throughput are not an equal-time strength result. This is screening, not
a promotion or fresh confirmation experiment. Any later promotion requires the
separate confirmation process in [COMMON](../plans/next-games-2026-10-18/COMMON.md).

## Dashboard and reproduction

The [dashboard](../../benchmark-dashboard/index.html) is a suite asset. It loads
sanitized aggregate snapshots from the dedicated public development branch
`benchmarks/ai-comparison-2026-10-18`, with a bundled fallback. It shows update
time and stale-running warnings, never inferring health merely from an old file.
GitHub raw-file caching can delay snapshots by several minutes. The result-only
branch is excluded from push CI to avoid rerunning the whole suite for each
data checkpoint; it cannot trigger Pages. Website code still deploys only after
full same-revision Validation.

Run `node scripts/benchmark-comparison.mjs --out=local-run/ai-comparison-2026-10-18
--workers=12 --pairs=40` on one line after the implementation is published.
Use `--plan-only` to write the frozen task manifest without playing games.
`--games=...` supports focused plumbing checks, which are not study evidence.
The final manifest and raw results will be preserved in the development repository.
