# Work plans and handoffs

Use an issue/PR for ordinary tasks. Create `docs/work/<task-id>.md` only when a
substantial task needs resumable context beyond that discussion. Follow the
[handoff template](../templates/handoff.md). Use task-specific files to avoid
parallel agents overwriting a shared status page.

Verify the actual branch, worktree and process/CI state before resuming. Record
last-observed timestamps for jobs; never infer liveness from a note or old agent
message. Do not store credentials or personal machine configuration here.

At completion, promote durable facts into current references and evidence, mark
the handoff complete with its PR/commit, and remove obsolete next actions. Closed
handoffs may be removed once their useful content is retained in Git history and
canonical documents. This directory is not another permanent game-status index.
