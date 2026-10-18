# Development preview (GitHub Pages)

The development repository and preview have been public. Confirm actual repository
visibility/settings when operating; never assume development work is private.
Preview address: https://seanmason.github.io/board-game-ai-dev/ . This document does
not certify the currently deployed revision or that its deployment succeeded.

## Configuration and published surface

The [preview workflow](../.github/workflows/preview-pages.yml) is authoritative for
triggers, environment and validation. At documentation review it targets `main`
and `feat/wingspan-base-game`, plus manual dispatch. GitHub Pages uses GitHub
Actions as its build source. Inspect the actual deployment run for live state.

Packaging depends on the complete reusable [Validation workflow](../.github/workflows/ci.yml),
including every browser smoke test, for the same checkout revision. Failed or
cancelled validation prevents both packaging and deployment, including manual
dispatches. The push/PR validation remains available independently; the Pages
run deliberately calls the same checks rather than maintaining a smaller copy.

The workflow runs `npm run stage:preview`. The [asset allowlist](../scripts/static-assets.mjs)
and [stager](../scripts/stage-preview.mjs) define the suite navigation, available
game directories and shared runtime assets. Optional games depend on the checkout;
the preview is no longer an Azul-only six-file site. Tests, research reports and
source-reference datasets are not included by the runtime asset allowlist.

Static runtime files are publicly downloadable. The development repository itself
may also expose research/source files regardless of what the preview stages.
No credentials, restricted assets or private data belong in either surface.

## Release boundary

Preview deployment does not modify the finished-game repository or establish a
release gate. See [packaging and release](platform/release.md) for the separate
reviewed release procedure. Inspect CI/browser evidence for the exact source
revision rather than inferring readiness from a successful static deployment.
