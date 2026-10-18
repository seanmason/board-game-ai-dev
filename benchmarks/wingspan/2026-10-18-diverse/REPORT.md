# Diverse evaluator screen and fresh confirmation

656/656 successful games; failed 0; rollout safety caps 0. Original gameplay revision 3c78a948d6b9dbdbd45acc0b60d4e75a082b28d4. Wall time 20.2 minutes includes checkpoint crash, interruption and resumed unfinished games. Completed game records were retained; gameplay hashes were verified unchanged before resume. See [resume metadata](resume-records.json).

## Screen: 100 samples, depth4

| Candidate vs opponent | W/D/L | Win share | Mean margin | Paired 95% margin interval | Pairs |
| --- | --- | --- | --- | --- | --- |
| bonus-threshold vs practical-combined | 18/0/30 | 37.50% | -2.35 | -5.21 to 0.50 | 24 |
| capacity-investment vs practical-combined | 22/0/26 | 45.83% | -2.04 | -5.03 to 0.95 | 24 |
| egg-liquidity vs practical-combined | 22/1/25 | 46.88% | 0.29 | -2.31 to 2.89 | 24 |
| endgame-cashout vs practical-combined | 25/1/22 | 53.13% | 1.10 | -0.58 to 2.79 | 24 |
| future-goals vs practical-combined | 25/0/23 | 52.08% | 0.02 | -3.32 to 3.36 | 24 |
| hand-quality vs practical-combined | 24/0/24 | 50.00% | -0.52 | -3.12 to 2.08 | 24 |
| opponent-tempo vs practical-combined | 27/1/20 | 57.29% | 2.10 | -0.67 to 4.88 | 24 |
| power-synergy vs practical-combined | 25/0/23 | 52.08% | 1.90 | 0.13 to 3.66 | 24 |
| round-race vs practical-combined | 25/1/22 | 53.13% | -0.10 | -3.29 to 3.08 | 24 |
| row-unlocks vs practical-combined | 30/1/17 | 63.54% | 3.25 | 0.86 to 5.64 | 24 |
| strategic-blend vs practical-combined | 28/1/19 | 59.38% | 2.27 | -0.24 to 4.78 | 24 |
| typed-food vs practical-combined | 18/1/29 | 38.54% | -2.50 | -4.75 to -0.25 | 24 |

## Confirmation: 300 samples, depth4, independent seeds

| Candidate vs opponent | W/D/L | Win share | Mean margin | Paired 95% margin interval | Pairs |
| --- | --- | --- | --- | --- | --- |
| row-unlocks vs current | 26/0/14 | 65.00% | 4.30 | 1.25 to 7.35 | 20 |
| row-unlocks vs practical-combined | 18/1/21 | 46.25% | 0.17 | -2.15 to 2.50 | 20 |

Only row-unlocks passed the predeclared screen. Screening of twelve variants creates selection bias; confirmation estimates are separate. Intervals use Student-t over setup-pair averaged margins (23df screen,19df confirmation), unadjusted across comparisons sharing seeds. No default change or external human-strength claim. Ordinary intervals do not establish multiplicity-adjusted superiority.

[Raw checkpoint](results.json), [frozen manifest](manifest.json). Individual per-game records remain at C:/Users/mason/.codex/benchmark-runs/wingspan-diverse-20261018.

Interpretation: row-unlocks beat current26-14 but did not improve on practical-combined18-1-21. Its positive screen margin did not replicate against the stronger reference. Power-synergy had a positive ordinary screen margin interval but did not meet the predeclared win-share criterion; it is unconfirmed, especially after twelve comparisons. Preserve practical-combined as experimental reference.
