# Six-game AI comparison — 2026-10-18

Finished all **1,720 scheduled games**: 1598 complete, 122 unresolved. No illegal actions or adapter errors.

[Public dashboard](https://seanmason.github.io/board-game-ai-dev/benchmark-dashboard/) · [Frozen manifest](manifest.json) · [Raw records](results/) · [SHA-256 inventory](result-sha256.json)

## Results

Winner share divides tied wins. Estimates average complete seat-rotation groups; groups with any unresolved game are excluded. These are approximate 95% paired Student-t intervals across setup seeds, not independent-seat intervals. Chance references are 50%, 33.3%, 25%, and 20% for 2–5 players.

| Game | Players | Winner share (95% interval) | Complete groups / 40 | Complete / scheduled games | Mean AI decision |
|---|---:|---:|---:|---:|---:|
| ticket-to-ride | 2 | 62.0% (48.3%–75.7%) | 25 | 64/80 | 38.14 ms |
| ticket-to-ride | 3 | 21.8% (13.4%–30.3%) | 29 | 109/120 | 31.61 ms |
| ticket-to-ride | 4 | 18.2% (10.4%–25.9%) | 33 | 153/160 | 27.89 ms |
| ticket-to-ride | 5 | 4.4% (0.0%–11.2%) | 9 | 142/200 | 25.80 ms |
| love-letter | 2 | 63.7% (53.5%–74.0%) | 40 | 80/80 | 18.57 ms |
| love-letter | 3 | 50.8% (42.5%–59.2%) | 40 | 120/120 | 30.25 ms |
| love-letter | 4 | 53.1% (45.0%–61.3%) | 40 | 160/160 | 41.19 ms |
| jaipur | 2 | 95.0% (90.1%–99.9%) | 40 | 80/80 | 0.03 ms |
| sushi-go | 2 | 98.8% (96.2%–100.0%) | 40 | 80/80 | 218.64 ms |
| sushi-go | 3 | 90.4% (85.0%–95.8%) | 40 | 120/120 | 318.79 ms |
| sushi-go | 4 | 73.8% (65.9%–81.6%) | 40 | 160/160 | 423.23 ms |
| sushi-go | 5 | 69.5% (61.9%–77.1%) | 40 | 200/200 | 505.18 ms |
| lost-cities | 2 | 100.0% (100.0%–100.0%) | 40 | 80/80 | 0.36 ms |
| hive | 2 | 10.9% (1.2%–20.6%) | 16 | 50/80 | 123.91 ms |

## Interpretation

- Love Letter beat the high-card/public-knowledge heuristic in every player-count stratum. All matches completed.
- Jaipur won 95% against the procedural set collector under the explicitly assumed token inventory. This is not physical certification.
- Sushi Go strongly beat the local set-scoring comparator. These results establish an advantage against this opponent, not expert human strength.
- Lost Cities won all 80 matches against a one-step expedition comparator. The baseline is too weak to measure its ceiling. The displayed 100–100% t interval is a zero-observed-variance artifact, not certainty about future wins.
- Ticket to Ride has substantial completion selection, especially five players. Do not read its conditional estimates as unrestricted game strength.
- Hive is weak against this defensive opponent at the tested budget; repetitions also make complete-group estimates selective. No AI default was changed or promoted.

## Missing outcomes

These deterministic bounds retain every known completed share and allow each unresolved outcome any share from zero to one. They are sensitivity bounds, **not confidence intervals**, and do not adjudicate unfinished games.

| Game | Players | Unresolved | Possible all-scheduled share range |
|---|---:|---:|---:|
| ticket-to-ride | 2 | 16/80 | 51.2%–71.2% |
| ticket-to-ride | 3 | 11/120 | 16.7%–25.8% |
| ticket-to-ride | 4 | 7/160 | 18.8%–23.1% |
| ticket-to-ride | 5 | 58/200 | 6.0%–35.0% |
| hive | 2 | 30/80 | 6.9%–44.4% |

Unresolved reasons:
- hive: benchmark-repetition-limit — 30 games.
- ticket-to-ride: Face-up draw cannot be refilled — 5 games.
- ticket-to-ride: Market cannot be resolved under pinned rules — 87 games.

## Opponents and budgets

Forty predeclared setup seeds per matchup, all candidate seats rotated against independent heuristic opponents. Full matches; no adaptive stopping, tuning, or fresh confirmation. Twelve BelowNormal worker threads. Budgets are policy-specific, not equal-time strength comparisons. Latency includes incomplete games and reflects concurrent Windows execution.

| Game | Candidate budget | Independent opponent |
|---|---|---|
| Ticket to Ride | 128 samples, at least one full root sweep | Ticket-path planning and route collection |
| Love Letter | 64 samples, full root coverage floor | High-card retention and public/private-known card information |
| Jaipur | All-root tactical ranking | Procedural bundle collector |
| Sushi Go | 64 samples, full root coverage floor | Local sets, ordered nigiri/wasabi, fixed future-card bonuses |
| Lost Cities | Current practical default; zero samples | Immediate expedition extension |
| Hive | Soft 100 ms, complete depth-one floor | Immediate wins, one-reply loss avoidance, queen liberties and mobility |

Love Letter/Sushi budgets are below browser ceilings. Hive may exceed its soft budget to finish depth one; the defensive baseline is not time capped. Ticket to Ride margins compare best opponent; other scored adapters document their margin definitions in raw diagnostics. Hive has no numeric game score.

## Provenance and limits

The initial 148 results used revision `a2ff13f73358b0c972ef1ca806c0bfc93c7288ae`. A transient Windows atomic-rename lock stopped dashboard saving. Completed records were preserved byte-for-byte. Continuation at `d33aa8c56f0851b7115177f9e1cc60bb7817a291` only added bounded file-operation retries; all game/adapter hashes, tasks, budgets, and seeds match. Runtime output moved outside OneDrive. See [initial manifest](initial-manifest.json) and [continuation record](continuation.json).

Jaipur inventory is an attributed assumption, with explicit tie/redeal and unavailable-bonus policies. Ticket to Ride independent ticket reconciliation and exhausted-supply adjudication remain open. Hive publisher diagram certification remains open. Lost Cities starter and scoring administration follows the adapter’s named policy. Older games and their adopted AI settings were not changed.

This screen does not support a perfect-play claim, a human skill rating, or promotion from exploratory comparisons. Stronger opponents are a more useful next test for Lost Cities and Sushi Go; supply adjudication and Hive strategy are concrete improvement targets. No additional tournament was launched.
