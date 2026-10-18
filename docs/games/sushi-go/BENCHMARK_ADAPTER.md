# Sushi Go benchmark adapter

The [adapter](../../../scripts/benchmark-adapters/sushi-go.mjs) exports quiet
`metadata` and async `runGame({seed,seat,players,budget,policy,opponent,scope})`.
Default: two players, seed 1, controlled seat 0, a complete three-round match,
production browser sampled policy against independently coded local greed, 64
action samples per decision. Browser policy seed 611 is preserved; its normal
ceiling is 256 samples. The benchmark default is an explicitly smaller budget,
not an incumbent change. Root coverage is complete: actual iterations are at
least the number of legal ordered actions, reported alongside requested budget.

The comparator independently counts local sets, ordered Wasabi/Nigiri bindings,
fixed maki/pudding values and small future-set/chopsticks bonuses. It uses no
production heuristic, belief sampler, packet inference or opponent model. It is
deliberately simpler, not claimed to be optimal. Every seat chooses from the
same pre-commit state using only its own projected hand/allowed packet memory and
public tableaux. No hidden commitment is applied until all decisions are ready.
Choices are then committed and revealed atomically by the rules engine.

Full-match shares include all three rounds, final pudding and the pudding-count
tiebreak. Margin is controlled score minus the mean opponent score. Optional
`scope:'round'` excludes future rounds/pudding and must be labeled separately.
Caps/unresolved/illegal transitions get null outcomes, never draw shares. Default
cap is 100 joint reveals; `turns` counts joint reveals, not seat commitments.
Latency covers controlled strategy calls, including sampling/rollouts; count,
total, max, p50 and p95 are milliseconds. It excludes projection, transition and
worker startup; runner elapsed and comparator latency are separate.

```powershell
node scripts/benchmark-sushi-go.mjs '{"seed":17,"seat":0,"players":2,"budget":{"iterations":64}}'
node --test --test-concurrency=4 test/sushi-go-benchmark.test.js
```

The [captured smoke](benchmark-adapter-smoke.json) is one predeclared seed 17,
seat 0, two-player match, scores 59–38 including pudding, 30 joint reveals,
1,920 samples and full 116/116 root coverage. Zero illegal/capped/unresolved
records. This is plumbing evidence only, not a strength study or promotion.
Transcript hashes allow deterministic replay excluding timings; adapter source
hash is captured. Coordinator owns the study/dashboard; prior unfavorable
round-only evidence remains in the [overview](README.md).
