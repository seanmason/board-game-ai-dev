# Love Letter benchmark adapter

The [adapter](../../../scripts/benchmark-adapters/love-letter.mjs) exports quiet
`metadata` and async `runGame({seed,seat,players,budget,policy,opponent,scope})`.
Defaults: two players, seed 1, controlled seat 0, full match, production default
against the simple comparator, 64 action samples per decision. The browser uses
this sampled policy with a 512-sample ceiling; the benchmark budget is explicitly
smaller. No incumbent settings changed. Every root gets at least one sample, so
actual iterations can exceed a small requested budget; diagnostics report both
root count and coverage. Search seed 173 matches the browser.

The comparator is independently coded high-card retention, Guard copy-count
guesses, known-target Baron/Prince tactics and avoidance of Princess suicide. It
uses public discards/exclusions and its own private memory. It never invokes the
production evaluator, sampler or rollout. Every policy receives only its actor
projection and complete legal actor actions. Forced draws/round transitions do
not create extra strategy decisions. First starter defaults to seat 0; callers
can set `starter` explicitly. Date/age tie priority is fixed by setup, not picked
after seeing the outcome.

Complete matches run to the affection target. Output shares follow actual match
winners, with affection totals as scores and `margin:null`: card ranks or token
margins are not used as match utility. Optional `scope:'round'` is explicitly a
round-only diagnostic. Caps, unresolved searches and invalid transitions retain
null shares/scores/margin and distinct status/error fields; they are never draws.
Default cap is 2,000 atomic engine actions. `turns` counts those actions, including
forced draws and round transitions. Latency measures controlled strategy calls
(including belief construction/search) and reports count, total, maximum, p50 and
p95 in milliseconds. It excludes worker startup and projection/transition work;
elapsed time covers the runner. Comparator latency is separate.

Reproduce one full match with the CLI (PowerShell):

```powershell
node scripts/benchmark-love-letter.mjs '{"seed":17,"seat":0,"players":2,"budget":{"iterations":64}}'
node --test --test-concurrency=4 test/love-letter-benchmark.test.js
```

The [captured smoke](benchmark-adapter-smoke.json) is exactly one predeclared seed
17, seat 0, two-player full match: scores 7–4, 11 rounds, 102 atomic actions,
1,536 action samples, full 116/116 root coverage; complete with zero illegal,
capped or unresolved records. It verifies adapter plumbing only. One result
establishes no strength, interval, seat balance or superiority. Source file hash
is captured; replay transcript hashes omit timings and are deterministic.
The coordinator owns the larger study and dashboard. Historical round-smoke
evidence remains in the [overview](README.md), with its original runner revision.
