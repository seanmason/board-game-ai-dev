# Wingspan leaf evaluator screen

Status: completed 2026-10-18 UTC, all 320 games with zero failures/caps in 6m17s.
See [results](../../benchmarks/wingspan/2026-10-18-evaluators/REPORT.md).
Launched at revision `39fef0b`, initial PID 79204.
The full test run passed 592 tests and found one missing preview dependency;
after adding that module to the asset allowlist, all three asset tests passed.
Documentation checks passed. User halted the depth/budget experiment for quick
feedback from evaluator alternatives. Its 119 completed games remain in their
runtime directories; unfinished games do not count as losses. All three old
processes were stopped, including the queued confidence extension.

Frozen screen: eight alternatives versus the unchanged current evaluator,
40 games each (20 paired setups), 320 games total. Fresh seeds `1388400 + 997*i`,
i=0..19; both candidate seats, balanced starters. Comparisons interleave by seed
for early coverage across alternatives. Same seeds across comparisons help
comparability but do not provide independent evidence between matchups.

Hold all other settings fixed: 100 belief-rollout samples, depth 4, 48-step
rollout safety cap, same representative candidates, follow-up policy, hidden-world
sampling and exploration coefficient. Keep the existing 82% leaf-delta / 18%
root heuristic mixture. Selected leaf evaluator scores both initial and endpoint
states consistently; opponent-relative scoring uses that same evaluator for both
players. Production defaults stay current. The control is retained exactly,
including any limitations in its remaining-turn or terminal-value approximation.

Alternatives: points-only, remaining-turns, engine-income, goal-aware,
practical-combined, usable-resources, conservative and habitat-productivity.
[Exact methods](../../benchmarks/wingspan/leaf-evaluators-methods.md) document
weights, approximations and limitations. These are hypotheses, not tuned winners.

```sh
node scripts/benchmark-wingspan-evaluators.mjs --out=NEW_RUNTIME_DIRECTORY --workers=24
node --test test/wingspan-evaluator-screen.test.js test/wingspan-leaf-evaluators.test.js
```

Runtime: `C:\Users\mason\.codex\benchmark-runs\wingspan-evaluators-20261018`.
24 workers at BelowNormal priority, no concurrent old tournament. Source hashes
and all task IDs are retained in manifest.json; each completed game saves
independently. Dashboard: `http://192.168.50.14:52466/#wingspan-evaluators`.

Fixed completion target, no outcome stopping or replacing seeds. Report W/D/L,
paired score margins, intervals over 20 setup pairs, runtime and safety caps.
Treat early results as provisional and final candidate selection as exploratory:
eight comparisons create selection bias. Confirm promising candidates on fresh
seeds before adopting one. Do not infer human strength or exhaustive legal search.
Check all IDs/seat pairs on completion, preserve raw metrics and manifest, and
update the game overview. No independent full-transcript replay is provided.
