# Wingspan: nine-hour unattended investigation

Status: preparation; execution requires the user's final go-ahead. This plan
authorizes no automatic production AI promotion. The nine-hour clock starts when
the supervisor launches after approval, including any wait for the existing study.

## Purpose and fixed sequence

Finish the existing evaluator/compute study with its original source, tasks and
24-worker operational amendment. Its complete confirmation determines the new
anchor: its selected evaluator only if `adoptionRecommended` is true, otherwise
the corrected opening-plan reference. Do not select from partial results. The
new isolated checkout does not modify the canonical running source.

Then run, sequentially:

1. Bounded mechanism diagnostics, up to ten minutes: 24 established fixtures and
   six independent ordinary positions (two each early, middle and late). Compare
   reference, lean E+S, power-aware continuation and no-prior search at incremental
   100/300/1,000 sample checkpoints, two independent search streams, horizon4.
   Preserve per-root prior, leaf and combined rankings, endpoint counters and
   partial NDJSON. These are diagnostics, not win-rate evidence. Root counts
   describe supplied choices; a complete legal-action omission audit is not
   implemented. Existing study confirmation supplies the depth comparisons.
2. Eight full validation canaries: one seat-swapped setup per proposed change,
   each against the anchor, at1,000ms requested per decision. Any invalid game,
   uncovered supplied root, unresolved research leaf, or cap blocks strength work.
3. Admit a fixed strength profile using **only canary durations and time left**.
   Full:60 paired setups per four screen arms (480 games), then200 pairs versus
   each of two references (800 games) for at mostone finalist. Compact:40 pairs
   per arm (320 games), then100 pairs per reference (400 games). The maximums
   are1,280 or720 strength games, plus8 canaries. If neither fits, retain the
   diagnostics and canaries and stop. Do not start an intentionally undersized
   strength comparison. No optional sample-scaling tournament is launched by
   this version; the current study and diagnostic checkpoints cover that question.
4. Screen four fixed interventions against the SAME anchor. Only after every
   screen arm completes validly, select at mostone eligible candidate. No qualifier
   means no confirmation. Confirm a qualifier on wholly fresh banks against both
   that anchor and the actual frozen deployed pipeline.
5. Publish the completed or explicitly incomplete evidence and stop. The morning
   decision is a reviewed next-step recommendation, not an overnight code promotion.

## Candidate definitions

All arms use the existing actual setup expansion, representative root generator,
corrected research endpoints and horizon4. Timed decisions charge observation,
generation and initialization; every supplied root is visited even if that
overruns the requested second. Report measured mean and p95 latency.

| Intervention | Exact change |
| --- | --- |
| power-aware | Grade supported power choices during simulated continuations using useful output minus costs; root prior unchanged |
| noprior | Set persistent prior weight from0.18 to0; retain0.82 leaf weight and UCB exploration3.5 |
| both | Apply both preceding search changes |
| lean-es | Replace anchor evaluator with opening-plan plus clip6(0.5×(E+S)); original shared selected-row ledger and atomic E/S formulas, no placement planning |

The first three retain the anchor evaluator. Lean E+S is a separate complete
evaluator replacement, not an added correction on top of the anchor.

Power grades are continuation preferences, not calibrated probabilities. Useful
typed food has marginal grade0.9, capped by placeable own-hand demand and supported
installed consumers. Needed cards have grade1.1, with a bounded target from open
slots and hand-consuming birds. Known-card retention is
min(2,0.2×printed points+0.05×egg capacity)×min(1,remaining actions/26), zero if
no habitat remains. Egg payment costs1 plus0.15 when removing a bird's last egg.
Supported optional skips grade0; impossible supported choices grade−4; supported
grades clamp to±4. Tucks account for consumed card value and replacement output.
Mandatory delayed discards reserve hand cards. Repeat targets evaluate a supported
primitive once; seed/cache repeats require an actual seed/dual feeder die.
Unsupported/stochastic mechanisms retain the old fallback, with no future deck
or opponent-private-state access. No large coefficient search is performed.

## Statistics and admission

The independent unit is the setup averaged over both seats. A screen candidate
needs at least55% winner share, positive mean score margin, valid complete data,
and candidate/opponent latency ratios no greater than1.10 mean and1.25 p95.
Rank eligible candidates by share, margin, then stable candidate key.

Each fresh superiority claim requires a one-sided paired lower bound above50%,
positive margin, complete valid data and the same latency ceilings. Use fixed
alpha0.05/3 conservatively, even though the optional third scaling claim is not
launched. Both reference comparisons must pass to support a recommendation.
Paired-t intervals are approximate; degenerate bounded samples use conservative
Hoeffding bounds. Failure to pass does not establish equivalence or no improvement.

Admission estimates one game as max(1.75×canary mean,1.25×canary maximum).
Estimate total strength time as maximum game count×estimated game time/30 plus
two maximum canary durations. Reserve max(30 minutes,20% of remaining time).
Try full, then compact, then no strength stage. Freeze the admission, its digest,
timing inputs and all possible held-out task banks before the first screen result.
Durations under eight canary workers are imperfect predictors of30-worker load;
the conservative factors and hard deadline handle this uncertainty. Actual
full-game tail costs can still make a stage incomplete.

Fresh game banks21–26million and diagnostic deals930001 onward are audited
against retained historical records AND the existing study's planned held-out
banks. See [seed audit](../../scripts/wingspan-overnight/seed-audit.json).
Repeated mechanism fixtures and search RNG streams are not fresh independent deals.

## Unattended operation

The prepared `ready.json` records exact source hashes, revision, prior-study
manifest/wrapper hashes, paths, worker limit and duration. `launcher.py --check`
validates these without starting work. `Start-Overnight.ps1 -Config READY_JSON`
starts the supervisor hidden at BelowNormal priority after user approval.

The supervisor requests Windows system wakefulness without keeping the display
on, waits for the verified prior runner to finish, and starts no new benchmark
worker pool until it has exited. The new pool is capped at30. A failed prior
study blocks the new campaign and preserves the reason. Manual sleep, shutdown
or power loss cannot be prevented or recovered by a running process.

Each completed game is atomically saved and validated. A worker crash with no
returned result retries that task once; a second crash stops the stage. Invalid
returned results are preserved and never retried to obtain a nicer outcome.
Source changes, corrupt retained data or invalid endpoints stop the run.

At nine hours, stop dispatching and terminate remaining owned benchmark workers;
allow at most15seconds for supervisor enforcement and up to two minutes for final
evidence publication. Save interrupted task IDs and completed records. A partial
comparison cannot pass any gate. The supervisor can terminate its owned Node
process tree, including the diagnostic child. If the old study somehow consumes
the whole window, stop that exact owned benchmark and preserve its last checkpoint.

Publication uses a separate evidence checkout/branch, retries transient Git/network
failures, and does not block compute. Local files remain authoritative if public
updates fail; record publication health. The public feed may cache several minutes.
Permanent launch locks prevent duplicate runs or an accidental fresh nine-hour
clock. Whole-supervisor restart is deliberately manual; worker/task recovery is
automatic within the original launch. Any future manual resume must preserve
the same receipt, deadline, source and admission, with all records retained.

## Outputs and limitations

The prepared public dashboard is
[Wingspan overnight](https://seanmason.github.io/board-game-ai-dev/benchmark-dashboard/?study=wingspan-overnight).
Its report and raw data use the dedicated development evidence branch
`benchmarks/wingspan-overnight-2026-10-18`. The original study retains its own feed.

Outputs include source archive and hashes, launch/deadline receipt, diagnostics,
seed audit, canary validation, frozen profile/task banks, paired analyses, per-game
JSON, invalid/partial records, process/retry logs and publication status. Summaries
distinguish screening, confirmation, diagnostics and incomplete results.

Supported-power grading remains approximate; unusual card interactions and
real-table acceptance gaps remain. These experiments measure internal two-player
strength and desktop cost, not human strength or actual iPad Safari performance.
Production defaults remain opening-plan/horizon4 until a later reviewed promotion.

## Readiness verification

Before marking ready: run methods/pipeline parity and privacy fixtures, strict
statistical tests, mock-worker crash/deadline/retention tests, admission and
dashboard malformed-data tests, a bounded real diagnostic smoke, full Node tests,
syntax/docs checks, Python parsing, and automated dashboard touch checks. Record
the exact results in the prepared runtime `readiness.json`. No new strength
tournament starts during preparation. Full Validation gates any Pages publication.
