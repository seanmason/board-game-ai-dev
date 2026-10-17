# Documentation routing

Read [AGENTS.md](../AGENTS.md), then the relevant [game overview](games/INDEX.md).
Start with a small context budget (roughly 1,500–2,500 words); expand when needed.
This index routes work; game overviews own current game status.

| Task | Read next |
| --- | --- |
| Locate a game, its code, limitations or evidence | [Game directory](games/INDEX.md) |
| Fix a rule/card | Game overview → linked rules/source evidence → implementation and regression tests |
| Improve AI | Game overview → current method and relevant experiment; inspect the benchmark harness before designing a run |
| Change physical observations, undo or recovery | Game overview and [shared contracts](platform/README.md) |
| Change workers or shared code | [Shared contracts and regression map](platform/README.md) |
| Understand intended architecture | [Architecture specification](ARCHITECTURE.md); its planned features are not implementation claims |
| Package or release | [Release procedure](platform/release.md) |
| Resume work | [Handoff conventions](work/README.md), relevant PR, then verify branch/process/job state |
| Record findings | [Documentation policy](DOCUMENTATION.md), [experiment conventions](../benchmarks/README.md), [templates](templates/README.md) |
| Understand a consequential choice | [Decision index](decisions/README.md) |

## Authority and freshness

User-approved constraints and requirements define intended behavior; code and
reproducible verification establish observed behavior. Resolve disagreements
explicitly. Current references summarize the checkout; evidence records describe
the revision and conditions tested. An old report's future-work section is not a
current backlog. Branch-only findings must say so and link their exact revision.

Existing uppercase reports retain their URLs and historical evidence. Start from
the game overview for their relevance and limitations. No report has been upgraded
to external certification or fresh test evidence by this documentation migration.
