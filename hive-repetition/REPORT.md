# Hive repetition experiments — 2026-10-18

Completed all 240 planned records. This is an exploratory comparison of two
possible remedies for repetition, not a promotion trial.

[Dashboard](https://seanmason.github.io/board-game-ai-dev/benchmark-dashboard/?study=hive-repetition) · [Predeclared protocol](PROTOCOL.md) · [Full analysis](analysis.json) · [Result hashes](result-sha256.json)

## Decision

The history tie-break merits a fresh confirmation study: it completed ten more
games with no lost control completions, a **12.5 percentage-point gain** (paired
95% interval **+5.5 to +19.5**). It passes the predeclared exploratory gate.
It is still research-only: 21 repetitions and four turn caps remain, and the
conditional winning estimate does not establish general strength.

Do not increase the default time budget on this evidence. The 500 ms arm
completed 43 games versus 45 for control, while actual mean decision time rose
from 229 to 522 ms. It searched somewhat deeper but did not solve repetition.
The history candidate averaged 258 ms; a few tactical checks still took seconds.

No errors or illegal actions occurred. Preserve the browser default and plan
any fresh confirmation separately. This batch totals 143 completed games,
93 unresolved repetitions and four caps.

## Design

Current tactical AI at 100 ms, a research public-history tie-break at 100 ms,
and current AI at 500 ms faced the unchanged independent heuristic on the same
40 fresh six-ply openings, both seats rotated. Each arm retained the 160-turn
cap and four-visit repetition stop. Repeats remain unresolved, not draws.
Twelve BelowNormal workers ran arms sequentially. Mandatory tactical checks
and depth-one completion can exceed the soft budget; actual cost is reported.
The browser policy is unchanged. No confirmation tournament runs automatically.

## Results

| Arm | Complete / 80 | Unresolved | Capped | All-scheduled share bounds | Complete groups / 40 | Conditional share | Mean decision |
|---|---:|---:|---:|---:|---:|---:|---:|
| control | 45 | 35 | 0 | 33.8%–77.5% | 13 | 57.7% | 229.0 ms |
| history | 55 | 21 | 4 | 43.1%–74.4% | 20 | 63.7% | 258.1 ms |
| compute | 43 | 37 | 0 | 30.0%–76.2% | 14 | 55.4% | 522.4 ms |

All-scheduled sensitivity bounds allow each incomplete outcome any winner share
from zero to one; they do not classify those games as losses or draws. Conditional
shares include only openings where both seats completed and may be biased.
All arms recorded zero illegal actions or adapter errors.

## Matched differences versus 100 ms control

Intervals use 40 opening means, each averaging both seat rotations. Approximate
95% paired-t intervals are descriptive: two exploratory comparisons were made
without a multiple-comparison correction. Fixed seeds reproduce openings, but
timed searches and sequential execution can vary with desktop load.

| Arm | Completion change (95% interval) | Observed-win lower-bound change (95% interval) | Incomplete → complete | Complete → incomplete |
|---|---:|---:|---:|---:|
| history | +12.5 pp (+5.5 pp to +19.5 pp) | +9.4 pp (+2.9 pp to +15.8 pp) | 10 | 0 |
| compute | -2.5 pp (-13.3 pp to +8.3 pp) | -3.8 pp (-12.0 pp to +4.5 pp) | 8 | 10 |

The observed-win measure uses zero only to calculate a lower bound for unresolved
outcomes; its difference is not a true win-rate difference. Full sensitivity
bounds and individual changed-game identities are in analysis.json.

## Cost, depth and decision

- **control:** completed-depth counts {'1': 2105, '2': 30}; slowest decision 6164.5 ms; 40 distinct canonical openings.
- **history:** completed-depth counts {'1': 2589, '2': 30}; slowest decision 10086.0 ms; 40 distinct canonical openings.
- **compute:** completed-depth counts {'1': 1914, '2': 150, '3': 18}; slowest decision 5271.2 ms; 40 distinct canonical openings.
- **history versus control:** equal-game-weighted mean latency difference +13.8 ms (95% interval -0.2 to +27.7); mean completed-depth difference -0.001. Meets the exploratory follow-up gate: **True**.
- **compute versus control:** equal-game-weighted mean latency difference +297.4 ms (95% interval +271.5 to +323.4); mean completed-depth difference +0.094. Meets the exploratory follow-up gate: **False**.

The gate requires at least ten percentage points better completion, a paired
completion interval above zero, and no worse all-scheduled observed-win lower
bound. Passing only identifies a candidate for separately planned fresh
confirmation; it does not justify a browser promotion. No extra tournament
was launched. Geometry/source limits from the prior Hive report remain.

## Reproduction and provenance

Frozen source revision: `9f1018f02c51693f56e00f5d2165c9e4e91d31eb`.
Each arm contains its manifest (tasks, budgets, source hashes), final dashboard
and all 80 raw records: [control](control/manifest.json),
[history](history/manifest.json), [compute](compute/manifest.json).
See [execution receipt](execution-receipt.json), [runner](run-experiments.py)
and [analysis script](analyze-experiments.py). Scripts retain original local paths;
adjust paths for another machine. Twelve workers ran at a time, not 36.
Dashboard/publication edits are not game inputs.

Research code passed 42 relevant Hive tests including six history-specific
fixtures. Independent review checked public-history semantics, safety guards
and grouped analysis. Final integration validation is recorded after publication.
