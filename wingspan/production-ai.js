/** Reviewed browser configuration. Selection evidence: docs/games/wingspan/2026-10-19-selection.md. */
export const PRODUCTION_AI=Object.freeze({
  method:'belief-rollout',
  horizon:4,
  leafEvaluator:'opening-plan'
});
