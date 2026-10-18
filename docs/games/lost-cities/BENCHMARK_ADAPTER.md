# Lost Cities benchmark adapter

The [adapter](../../../scripts/benchmark-adapters/lost-cities.mjs) exports quiet
`metadata` and async `runGame({seed,seat,players,budget,policy,opponent,scope})`.
Default: seed 1, controlled seat 0, two players, full three-round match, browser
**practical** ranking and zero samples. It calls the same production heuristic
with the browser's stable descending sort. Passing an iteration budget does not
silently switch policies. Optional `policy:'sampled'` must have a positive
`budget.iterations`; its policy ID is different and retains browser seed 1321,
horizon four and full legal root coverage. Browser sample ceiling is 300; no
incumbent settings change.

The independently coded comparator uses current expedition/wager increments,
a simple own-hand sum threshold before starting a suit, low-value discards and
useful exposed top cards. It ignores opponent safety and remembered buried
cards, and never invokes production scoring/search. Both policies receive only
their own projected hand, public state and allowed memory; no true deck or
opponent hand reaches production advice.

Starter ambiguity is handled as explicit benchmark administration, **not** a
publisher ruling: initial starter defaults to seat 0 (caller can override).
Before playing, the next two starters are declared as `(seed+1)%2` and
`(seed+2)%2`. This schedule is independent of results and the controlled seat,
and is recorded through the engine's explicit `chooseStarter` action. Three-round
cumulative totals determine outcomes. Optional `scope:'round'` ends after one
round and must be labeled separately. Margin is controlled score minus opponent
score. Cap is 2,400 phase actions; discard cycles remain legal and never force a
deck draw, fabricated terminal or draw share. Incomplete/error outcomes have null
shares/scores/margin. `turns` counts placements and draws, not starter agreements.
Latency measures strategy calls only (total/max/p50/p95 in milliseconds), with
projection/transition/worker startup excluded; runner elapsed and opponent
latency are separate.

```powershell
node scripts/benchmark-lost-cities.mjs '{"seed":17,"seat":0,"budget":{"iterations":0}}'
node scripts/benchmark-lost-cities.mjs '{"seed":17,"seat":0,"policy":"sampled","budget":{"iterations":64},"scope":"round"}'
node --test --test-concurrency=4 test/lost-cities-benchmark.test.js
```

The [captured smoke](benchmark-adapter-smoke.json) is exactly one predeclared seed
17, controlled seat 0, practical full match: round totals `[0,-1]`, `[0,-1]`,
`[0,-20]`; cumulative 0 to −22, 266 phase actions, zero samples and zero
illegal/capped/unresolved records. Zero expedition points are retained as
observed, not hidden by a favorable-only filter. This verifies plumbing only;
it is not strength evidence. Adapter source and transcript hashes are captured;
latencies are host-dependent. Coordinator owns larger runs/dashboard. Historical
unfavorable sampled smoke is preserved in the [overview](README.md).
