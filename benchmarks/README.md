# Experiment evidence

For new substantial studies use `<game>/<date>-<question>-<unique-id>/REPORT.md`
with configuration and compact results beside it. Use the
[experiment template](../docs/templates/experiment.md). Separate immutable run
outputs if one study has multiple executions. Do not overwrite a prior run.

Record question, code revision/patch, exact command/config, seeds, opponent and
seat/opening design, planned stopping rules, metric definitions, actual timing,
results including failures/caps, uncertainty, limitations and adopt/reject/defer/
inconclusive outcome. Distinguish search iterations from full-game rollouts.
For timed runs record reproduction limits; identical seeds need not reproduce
identical action choices on a different machine or under different load.

Keep small JSON/CSV summaries and meaningful regression traces in Git. For large
artifacts use durable storage and record URLs/checksums; ephemeral CI artifact
links alone cannot support a lasting release gate. Do not retain restricted source
assets merely to make an experiment self-contained.

## Existing evidence locations

- [Practical Kingdomino and Carcassonne study](practical-ai-2026-10-17/REPORT.md):
  48 paired-seat confirmation games, archived traces, reproducible runners and
  the rationale for simple recommendation defaults.

Existing paths remain stable. Consult each [game overview](../docs/games/INDEX.md)
for current interpretation; no historic run was repeated during documentation work.

- [Boop long-budget study](boop-long/REPORT.md): original loop failure and retained records; the [game overview](../docs/games/boop/README.md) links the later targeted repetition regression.
- [Splendor search study](../docs/SPLENDOR_AI_EVALUATION.md): paired comparisons, coverage, inconclusive alternatives and current-policy decision.
- [Azul search study](../docs/SEARCH_RESEARCH.md): ablation, held-out confirmation and throughput.
- [Existing result directory](results/): Splendor and five-game pilot JSON records, linked from their game reports. Do not infer strong play from filenames or positive small samples.
