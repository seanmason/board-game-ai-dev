# Hive and Ticket to Ride follow-up — 2026-10-18

Completed all **720 valid-screen records**: 616 complete, 104 unresolved. No illegal actions, adapter errors or caps. A separate 49-record run was stopped for insufficient opening diversity and is excluded.

[Dashboard](https://seanmason.github.io/board-game-ai-dev/benchmark-dashboard/?study=followup) · [Predeclared protocol and amendment](PROTOCOL.md) · [Result hashes](result-sha256.json) · [Invalidated opening screen](invalid-opening-screen/INVALIDATED.md)

## Decisions

- Ship Hive’s tested immediate-win / immediate-losing-reply safeguard as a tactical correctness fix. Do not describe it as a confirmed general strength improvement. Its mandatory verification costs more time.
- Ship the source-backed Ticket to Ride restriction: when deck and discard are both empty, train-card draws are unavailable even with face-up cards remaining. Unsupported supply cases continue to request an actual ruling.
- Keep Ticket to Ride planning-v2 as an explicit research candidate; the browser default stays on the incumbent. Its screen is promising, but incomplete outcomes fail the predeclared promotion gate.
- Do not start 100-setup confirmation: neither game meets the full-completion gate. No policy or weights were tuned after seeing screen results.

## Screen results

Shares average complete seed groups, each containing all candidate seat rotations. Approximate 95% paired-t intervals count setup groups, not independent seat games. Incomplete groups are excluded and can cause selection bias.

| Candidate / opponent | Players | Share (95% interval) | Complete groups / 40 | Completed games | Mean score margin | Mean decision |
|---|---:|---:|---:|---:|---:|---:|
| Hive tactical-v2 / incumbent | 2 | 59.2% (50.0%–68.4%) | 19 | 50/80 | — | 291.99 ms |
| Hive tactical-v2 / independent heuristic | 2 | 62.5% (32.9%–92.1%) | 8 | 35/80 | — | 269.15 ms |
| Ticket to Ride planning-v2 / incumbent | 3 | 60.6% (49.4%–71.8%) | 33 | 113/120 | +11.23 | 0.86 ms |
| Ticket to Ride planning-v2 / incumbent | 4 | 70.0% (63.8%–76.2%) | 30 | 150/160 | +15.57 | 0.78 ms |
| Ticket to Ride planning-v2 / independent heuristic | 3 | 77.8% (68.6%–87.0%) | 33 | 111/120 | +23.81 | 1.05 ms |
| Ticket to Ride planning-v2 / independent heuristic | 4 | 74.3% (66.1%–82.5%) | 37 | 157/160 | +23.59 | 0.88 ms |

Ticket to Ride margins are versus the best opponent. Hive has no numerical score. The candidate’s deterministic route-planning work is much cheaper than the incumbent’s 128 samples, but these are not equal-time trials.

## Completion and uncertainty

| Matchup | Players | Unresolved | Possible all-scheduled share range |
|---|---:|---:|---:|
| hive-incumbent | 2 | 30/80 | 43.1%–80.6% |
| hive-baseline | 2 | 45/80 | 30.0%–86.2% |
| ttr-incumbent | 3 | 7/120 | 57.5%–63.3% |
| ttr-incumbent | 4 | 10/160 | 66.2%–72.5% |
| ttr-baseline | 3 | 9/120 | 72.5%–80.0% |
| ttr-baseline | 4 | 3/160 | 71.9%–73.8% |

The ranges above allow each unresolved outcome any winner share from 0 to 1. They are deterministic sensitivity bounds, not confidence intervals or adjudicated outcomes.

Unresolved reasons:
- hive: benchmark-repetition-limit — 75.
- ticket-to-ride: Only one drawable train card or no second source remains — 17.
- ticket-to-ride: Market cannot be resolved under pinned rules — 12.

## Hive: verified safety, incomplete strength evidence

Every published nonwinning recommendation is checked against all immediate opponent replies. If every legal action loses immediately, the search reports that fact. All legal human choices remain available. Cooperative pause/resume retains the verification state; unverified suggestions are withheld. Deeper alpha-beta still evaluates all roots.

The incumbent matchup used40 distinct canonical six-ply legal openings, identical between each pair of seat rotations. The baseline matchup uses its separately frozen opening seeds. The initial stopped run only varied the starting player for two deterministic policies and therefore repeated openings; those 49 records are explicitly excluded. The original six-game comparison used empty starts, so its percentages are not a directly comparable before/after test.

The new safeguard averaged 292 ms per decision against the incumbent, versus 144 ms for the incumbent. The worst candidate decision was about 7.28 seconds under 12 concurrent workers. This is a soft 100 ms budget plus mandatory tactical/first-depth completion, not a hard deadline or equal-time experiment. The browser runs cooperatively in a worker and can pause before a recommendation is verified. Repetition remains a significant playing weakness.

## Ticket to Ride: promising planning, retained incumbent

Planning-v2 connects ticket objectives through a shared route union, budgets colors and locomotives across that union, evaluates gray-route color needs, conserves useful payments, and accounts for remaining trains and endgame urgency. It uses only actor observations and public information, evaluates every legal root, and samples no hidden worlds. The unchanged incumbent and independent heuristic receive their original policies.

Both multiplayer strata beat both opponents on complete groups with positive margins. However, source-unresolved market resets remain. The predetermined rule required all outcomes to resolve before promotion; favorable conditional intervals do not override it. The full-tabletop interpretation and original ticket catalog review remain open. No convention was silently substituted.

## Reproduction and evidence

Source revision: `028b6e2ba7ea8cec79918f3c397f5923a24999ff`. Twelve BelowNormal workers, studies run sequentially. Every directory contains a frozen manifest, final snapshot, and raw per-game results. Seeds, budgets, opening actions/hashes, policy IDs, work coverage and latencies are recorded.

- [Hive / incumbent](hive-incumbent/manifest.json)
- [Hive / heuristic](hive-baseline/manifest.json)
- [Ticket to Ride / incumbent](ttr-incumbent/manifest.json)
- [Ticket to Ride / heuristic](ttr-baseline/manifest.json)

Local integration: 888 tests passed before the opening-only amendment; 19 targeted tests passed after it, including opening replay/diversity and unresolved-only dashboard identity. Syntax 315 modules and maintained-doc checks passed at the first integration. Hive, Ticket to Ride and dashboard browser checks passed, including standalone game packages and touch layouts. Real iPad Safari acceptance remains unperformed.

Manifest `startedAt` values record plan preparation, not simultaneous execution.
The four studies ran sequentially through blocking `subprocess.run`, with twelve
workers total at a time. See [execution receipt](execution-receipt.json).

Final local integration verification passed **892 tests**, syntax for **315
modules**, and maintained documentation checks. Relevant Hive, Ticket to Ride
and dashboard browser checks passed. Frozen study revision `028b6e2` passed full
GitHub Validation. Publication `93ee62a` passed [full Validation](https://github.com/seanmason/board-game-ai-dev/actions/runs/39165797285) and [gated Pages deployment](https://github.com/seanmason/board-game-ai-dev/actions/runs/39165797293). The public dashboard loaded all 720 records and six matchup cards. A subsequent narrow phone-text wrapping fix is covered by the dashboard browser check; real iPad Safari acceptance remains open.
