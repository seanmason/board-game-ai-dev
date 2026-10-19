# Live execution operations

Frozen source: a863dc5c8a3a9510729ea6f050633015bb3bec11.
Canonical checkout: C:\Users\mason\OneDrive\Documents\ChatGPT\Board Game AIs\local-run\pages-publish.
Runtime parent: C:\Users\mason\.codex\benchmark-runs\wingspan-evaluator-compute-20261018.
Evidence checkout: local-run/comparison-publication, branch benchmarks/ai-comparison-2026-10-18.

The runner executes the bounded screen and predeclared held-out branch without intervention. It halts on invalid records and preserves them. Do not edit or commit canonical study sources while it runs. Do not launch another orchestrator into this output directory. Use checkpoint.json, execution-receipt.json and the parent's run.stdout.log/run.stderr.log to inspect actual state; PID ownership is in the parent's owned-processes.json. PIDs can be reused, so verify command lines before operating on a process.

The independent publisher copies evidence every 90 seconds, pushes the data branch, and exits after publishing a finished/interrupted checkpoint. Its logs are publisher.stdout.log/publisher.stderr.log in the runtime parent. The dashboard additionally refreshes periodically and labels stale running snapshots. A cached snapshot is not proof of current process health.

Full CI and Pages passed before the strength launch: development workflow run 39180434010. Local full tests: 945 passed, syntax: 354 modules, documentation: 73 files and 15 packaged entries, dashboard automated touch checks passed. Real iPad Safari acceptance remains unperformed.

After completion, review analysis.json, confidence bounds, all validation counters and timing before any production recommendation. The runner and publisher never change production AI settings. Preserve both favorable and unfavorable results, source archives and superseded calibrations. If interrupted by a configuration/rules error, retain all evidence and document an amendment/new execution rather than deleting individual games to rerun them.

## Worker-count amendment

User authorized24 workers. The initial18-worker runner stopped after131 completed results, all retained. The explicit worker-amendment.json and runtime/runner-workers24.mjs govern the resume; original manifest/source hashes/calibration remain frozen. Current logs are run24.stdout.log/run24.stderr.log and publisher24.stdout.log/publisher24.stderr.log in the runtime parent. Current owned-processes.json supersedes owned-processes-initial18.json. Screen timings mix18/24 concurrency; future confirmation runs under24 workers.
