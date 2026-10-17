# Development preview (GitHub Pages)

The development repository was switched to **public** to support GitHub Pages; its preview website is also publicly accessible.

Preview URL (configured and previously deployed successfully):
**https://seanmason.github.io/board-game-ai-dev/**

The preview workflow deploys changes to `main` and to `feat/azul-companion-mvp` while that implementation branch is in progress. It is not a production release: production-ready public games go to `seanmason/board-game-ai`.

## Initial setup

1. Open https://github.com/seanmason/board-game-ai-dev/settings/pages.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to a configured branch to run **Preview on GitHub Pages**; the deployment uses the `development-preview` environment to permit feature-branch previews.

The development repository and deployed source files are public. Treat both as untrusted publication surfaces and avoid secrets or restricted materials.

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
