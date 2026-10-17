# Development preview (GitHub Pages)

The development repository is **private**, but its GitHub Pages preview is **public on the internet**.

Preview URL once Pages is enabled and the workflow succeeds:
**https://seanmason.github.io/board-game-ai-dev/**

The preview workflow deploys changes to `main` and to `feat/azul-companion-mvp` while that implementation branch is in progress. It is not a production release: production-ready public games go to `seanmason/board-game-ai`.

## Initial setup

1. Open https://github.com/seanmason/board-game-ai-dev/settings/pages.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. The next push to a configured branch will run **Preview on GitHub Pages**. If the first run failed before you enabled Pages, use GitHub Actions to rerun the failed workflow after configuring Pages, or push a follow-up commit.

GitHub Pages from private repositories requires an eligible GitHub plan. A personal private repository does not provide access-controlled Pages; expect the preview to be discoverable publicly.

## Published surface

The workflow builds a temporary `preview/` directory containing only:
- `index.html`
- `styles.css`
- `src/azul.js`
- `src/mcts.js`
- `src/ai-worker.js`
- `src/app.js`
- `.nojekyll`

No tests, private architecture notes, Git history, credentials, or experimental datasets are included. Code needed to render/run the browser site can be downloaded from any publicly available website, so do not put sensitive information in these assets.

## Safety checks

Unit tests and syntax checks must pass before packaging. Deployment occurs via official GitHub Pages actions and the `github-pages` environment. Pages only hosts static assets; no backend, tokens, API keys, or server processes are required.

The public release repository is not modified by this workflow.
