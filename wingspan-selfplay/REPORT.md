# Wingspan compact self-play evidence

Status: **running** (running); stage **confirmation**.
Snapshot: 2026-10-19T17:23:58.213Z. Actual games completed: 3775 / 3904 across displayed stages.

A finished snapshot may reflect an early stop; it does not imply all proposed cycles ran. Collection and offline prediction losses are not playing-strength evidence. Production promotion remains separate.

[Dashboard](dashboard.json) · [Public controller receipt](manifest.json) · [Frozen source bytes](source.zip) · [Source inventory](source-manifest.json)

| Comparison | Valid / scheduled | Complete pairs | Winner share | Margin |
| --- | ---: | ---: | ---: | ---: |
| screen-1/champion | 80 / 80 | 40 / 40 | 0.6375 [0.5352, 0.7398] | 5.1000 [2.1942, 8.0058] |
| screen-2/champion | 80 / 80 | 40 / 40 | 0.4938 [0.3757, 0.6118] | -0.7625 [-3.4767, 1.9517] |
| screen-2/reference | 80 / 80 | 40 / 40 | 0.6375 [0.5418, 0.7332] | 5.6125 [3.4928, 7.7322] |
| screen-3/champion | 80 / 80 | 40 / 40 | 0.6125 [0.5134, 0.7116] | 1.3125 [-0.9857, 3.6107] |
| screen-3/reference | 80 / 80 | 40 / 40 | 0.7125 [0.6175, 0.8075] | 6.0875 [3.6283, 8.5467] |
| confirmation | 271 / 400 | 0 / 0 | — [—, —] | — [—, —] |

Intervals and winner shares stay hidden until the fixed scheduled comparison is complete with valid seat pairs. Unfavorable, invalid, capped and partial outcomes remain in aggregate counts. Requested whole-decision time is a soft bound; see latency mean, p95, p99 and maximum in dashboard rows.

Only allowlisted aggregate receipts and exported model weights are public. Raw games, observations, sealed audit records, task inventories, optimizer files and local paths are excluded. No independent human-strength, calibrated-win-probability or device acceptance claim is made.
