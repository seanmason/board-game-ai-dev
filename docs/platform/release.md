# Packaging and release procedure

The development repository is the source of truth. The separate
[finished-game repository](https://github.com/seanmason/board-game-ai) receives
reviewed, reproducible releases. No game overview alone authorizes publication.

1. Read the game's current overview and resolve or explicitly scope its open gates: rules/data provenance, complete human actions, physical acceptance, AI limitations, target-browser usability and rights/licenses.
2. Record the source commit and relevant verification evidence. A packaged game is not automatically release-ready.
3. Run applicable tests and browser checks, including the relocated standalone worker. Use the game's commands and [CI](../../.github/workflows/ci.yml).
4. Run `npm run package:game -- <game> <new-output-directory>` using a supported ID from the [asset manifest](../../scripts/static-assets.mjs). The destination must not exist. Serve it over HTTP and inspect it.
5. Review asset closure, original/authorized assets, relative URLs and source/license delivery. Preserve durable evidence for the release decision.
6. Publish only under explicit release authorization; retain a mapping from release revision to development source commit and evidence.

`npm run stage:preview` prepares the development suite. The
[preview workflow](../../.github/workflows/preview-pages.yml) controls actual
triggers and deployment; [preview notes](../PREVIEW_DEPLOYMENT.md) explain the
public surface. Do not confuse a development preview with a finished release.
