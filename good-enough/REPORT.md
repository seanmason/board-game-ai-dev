# Compute and practical AI checks — 2026-10-18

All 1,200 scheduled records are retained. This batch contains three exploratory
compute comparisons and one fresh confirmation of Hive completion behavior.
Browser defaults and game rules are unchanged.

[Dashboard](https://seanmason.github.io/board-game-ai-dev/benchmark-dashboard/?study=good-enough) · [Predeclared protocol](PROTOCOL.md) · [Full paired analysis](analysis.json) · [Raw-result hashes](result-sha256.json)

## What this tests

More compute improving results is a useful diagnostic, not a definition of good
play. A useful AI should beat credible simple opponents, finish games reliably,
make legal suggestions, and respond promptly. A strong deterministic heuristic
may need no extra compute; more samples can also reinforce a biased rollout model.
These opponents establish specific comparisons, not expert human playing strength.

Love Letter compares 64/512 samples at two and four players; Sushi Go compares
64/256 at four players, where the earlier comparison has useful headroom. Both
use 40 fresh setups with all candidate seats rotated. Requests have an all-root
coverage floor; actual work is reported. More samples do not deepen the rollout.
Love Letter optimizes round share rather than match share. Sushi Go rolls only
through the current round, with a heuristic pudding adjustment. Sampled opponents
omit some prior private histories; this is model mismatch, not hidden-truth access.

Hive compares tactical-v2/history-v1 at a soft 100 ms on 100 fresh six-ply openings,
both seats. Both retain the 160-turn cap, four-visit repetition stop and mandatory
tactical/depth-one floor. Its primary confirmation endpoint is completion, not
general winning strength. All families face their unchanged simple-v1 heuristic.

## Per-arm results

Winner shares and intervals below use only complete seat-rotation groups. Paired
differences in the following table are the relevant budget comparison.

| Game / players | Arm | Completed / scheduled | Repetition or unresolved / capped | Conditional winner share (95% interval) | Actual iterations / decision | Mean decision |
|---|---|---:|---:|---:|---:|---:|
| love-letter / 2 | 64 samples | 80/80 | 0 / 0 | 57.5% (47.5%–67.5%) | 64.00 | 29.44 ms |
| love-letter / 2 | 512 samples | 80/80 | 0 / 0 | 72.5% (63.0%–82.0%) | 512.00 | 189.10 ms |
| love-letter / 4 | 64 samples | 160/160 | 0 / 0 | 50.0% (43.0%–57.0%) | 64.00 | 63.33 ms |
| love-letter / 4 | 512 samples | 160/160 | 0 / 0 | 52.5% (45.3%–59.7%) | 512.00 | 473.14 ms |
| sushi-go / 4 | 64 samples | 160/160 | 0 / 0 | 83.1% (76.8%–89.5%) | 64.00 | 649.60 ms |
| sushi-go / 4 | 256 samples | 160/160 | 0 / 0 | 90.6% (85.6%–95.6%) | 256.00 | 1672.82 ms |
| hive / 2 | control, 100 ms | 107/200 | 92 / 1 | 51.8% (41.6%–62.0%) | — | 262.89 ms |
| hive / 2 | history, 100 ms | 130/200 | 49 / 21 | 53.4% (44.5%–62.3%) | — | 236.62 ms |

## Matched differences

Each setup is one independent unit, averaging its seat rotations. Differences
are high/candidate minus low/control. Compute-screen intervals are descriptive
95% paired-t intervals across three strata, without multiplicity correction.
Hive has one prespecified primary completion comparison on fresh seeds.

| Game / players | Paired complete setups | Winner-share change (95% interval) | Completion change (95% interval) | Declared criterion met? |
|---|---:|---:|---:|---|
| love-letter / 2 | 40/40 | +15.0 pp (+2.9 to +27.1) | +0.0 pp (+0.0 to +0.0) | True |
| love-letter / 4 | 40/40 | +2.5 pp (-8.0 to +13.0) | +0.0 pp (+0.0 to +0.0) | False |
| sushi-go / 4 | 40/40 | +7.5 pp (-1.0 to +16.0) | +0.0 pp (+0.0 to +0.0) | False |
| hive / 2 | 27/100 | +0.0 pp (+0.0 to +0.0) | +11.5 pp (+6.1 to +16.9) | True |

Compute support requires at least five percentage points gain, a paired interval
above zero, and complete valid games. It remains exploratory. Hive confirmation
requires at least ten percentage points better completion, one-sided 97.5% lower
bound above zero, no worse observed-win lower bound, and zero illegal/errors.
No criterion automatically promotes a browser policy or launches another study.

## Incomplete outcomes, score and cost

Caps/repetitions are not draws or losses. All-scheduled winner-share identification
bounds allow each incomplete result any share from zero to one; these are not
confidence intervals. Conditional comparisons may select easier-to-finish games.

- **love-letter / 2:** all-scheduled share bounds 57.5%–57.5% for control and 72.5%–72.5% for candidate. Paired mean-game latency change 159.84 ms (95% 156.24 to 163.45); score-margin change — (95% — to —).
- **love-letter / 4:** all-scheduled share bounds 50.0%–50.0% for control and 52.5%–52.5% for candidate. Paired mean-game latency change 419.81 ms (95% 408.64 to 430.98); score-margin change — (95% — to —).
- **sushi-go / 4:** all-scheduled share bounds 83.1%–83.1% for control and 90.6%–90.6% for candidate. Paired mean-game latency change 1023.22 ms (95% 951.08 to 1095.35); score-margin change 2.52 (95% 1.45 to 3.59).
- **hive / 2:** all-scheduled share bounds 25.5%–72.0% for control and 33.2%–68.2% for candidate. Paired mean-game latency change -32.92 ms (95% -48.39 to -17.44); score-margin change — (95% — to —).
  Hive lower-bound win-share change: +7.8 pp (+3.1 to +12.4). Opening audit: 100 unique signatures among 100 seeds. Actual search-depth and floor-overrun diagnostics are in analysis.json.

Love Letter has no invented numerical match margin. Sushi Go margin is controlled
seat score minus mean opponent score, not best-opponent margin. Latency tables
pool decisions; paired latency first averages each game then each setup. Different
game lengths and concurrent load mean these are different weightings. Fixed
iteration choices are deterministic for the pinned inputs; timed Hive searches
can vary with load. The control ran alongside both other families, while the history arm ran mostly alongside Sushi Go. Hive meets its predeclared completion criterion under this execution schedule; the entire difference cannot be attributed to history alone. These are not equal-time cross-policy strength comparisons. Both Hive arms finished only depth one on about 98.5% of decisions, and maximum decisions took 11.36 seconds for control and 8.59 seconds for history. The soft 100 ms target does not establish responsive worst-case latency.

## Provenance and reproduction

Frozen execution revision: `b7336fac301169c1ced2d87d710d63031418270f`. All six manifests agree on shared source hashes. [Source verification](source-verification.json) checks retained raw bytes against the execution hashes, then checks equality with the frozen Git contents after CRLF-to-LF normalization. Exact execution bytes are preserved in [execution-source.zip](execution-source.zip); mixed line endings and both hashes are recorded explicitly.

- [love-low manifest and tasks](love-low/manifest.json); raw records are in its games directory.
- [love-high manifest and tasks](love-high/manifest.json); raw records are in its games directory.
- [sushi-low manifest and tasks](sushi-low/manifest.json); raw records are in its games directory.
- [sushi-high manifest and tasks](sushi-high/manifest.json); raw records are in its games directory.
- [hive-control manifest and tasks](hive-control/manifest.json); raw records are in its games directory.
- [hive-history manifest and tasks](hive-history/manifest.json); raw records are in its games directory.

The [execution receipt](execution-receipt.json) records actual process intervals.
Three families used six BelowNormal workers each, at most eighteen total, with
low/control then high/candidate sequentially inside each family. Manifest start
times mark advance planning, not simultaneous execution of six processes.
No extra tournament followed. [Runner](run-experiments.py) and
[publication helper](publish-evidence.py) retain original paths; adjust them on
another machine. The committed `scripts/analyze-good-enough.mjs` accepts explicit
root/output arguments and validates every scheduled result before analysis.

## Practical conclusion

- Two-player Love Letter provides the clearest exploratory compute-scaling signal.
  Four-player Love Letter does not justify paying its large additional cost on
  these results alone.
- Sushi Go already performs well against this comparator at 64 samples. Its
  winner-share increase is uncertain, while the secondary score-margin result
  improves. Keep the distinction between a score objective and winning a match.
- Hive history meets the completion criterion under this schedule, but 35% of its
  games remain unfinished. Repetitions partly become caps; worst-case latency is
  still poor. Keep it research-only and prioritize practical completion and
  responsiveness before a broader tournament.

Compute scaling is supporting evidence, not a requirement or sufficient proof
of good AI. All defaults remain unchanged. This batch is closed; no additional
strength trials were launched.

## Integration validation

Integrated at `7b9f9ea`. Local verification passed: `node --test
--test-concurrency=4` (907 tests), `node scripts/check-syntax.mjs` (319 modules),
`node scripts/check-docs.mjs` (72 documents / 15 packaged game entries), and
`node scripts/browser-dashboard.mjs` using installed headless Chrome. The real
bundled dataset renders eight cards and 1,200/1,200 records at a 390 px touch
viewport with no horizontal overflow. These automated checks are not a real
iPad Safari acceptance test. Full validation-gated Pages deployment is pending.


