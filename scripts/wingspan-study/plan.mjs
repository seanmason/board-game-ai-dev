/** Frozen design. Seeds must additionally pass the coordinator's historical audit. */
export const METHODS = Object.freeze(['reference', 'exceptional', 'chains', 'investment', 'blend']);
export const CELLS = Object.freeze([100, 300].flatMap(budget => [4, 12].map(horizon => Object.freeze({ budget, horizon }))));
export const CLAIM_ALPHA = 0.05 / 6;
export const arm = (method = 'reference', budget = 300, horizon = 4, pipeline = 'study', timeMs) => ({ method, budget, horizon, pipeline, ...(timeMs === undefined ? {} : { timeMs }) });
function pairs(stage, matchup, candidate, opponent, seeds) {
  return seeds.flatMap(seed => [0, 1].map(seat => ({ id: `${stage}/${matchup}/${seed}/${seat}`, stage, matchup, seed, seat, candidate: { ...candidate }, opponent: { ...opponent }, rolloutStepLimit: 192 })));
}
export function screenTasks() {
  const seeds = Array.from({ length: 40 }, (_, i) => 8000000 + 997 * i);
  return METHODS.flatMap(method => CELLS.flatMap(({ budget, horizon }) => pairs('screen', `${method}-n${budget}-h${horizon}`, arm(method, budget, horizon), arm(), seeds)));
}
export function canaryTasks() {
  return CELLS.flatMap(({ budget, horizon }, i) => pairs('canary', `reference-n${budget}-h${horizon}`, arm('reference', budget, horizon), arm(), [7900000 + 997 * i]));
}
export function confirmationTasks(selectedCandidate, timeBudgetMs) {
  const method = typeof selectedCandidate === 'string' ? selectedCandidate : selectedCandidate?.method;
  if (method && (!METHODS.includes(method) || method === 'reference')) throw new Error('Unknown challenger');
  if (!Number.isInteger(timeBudgetMs) || timeBudgetMs < 1) throw new Error('Freeze a positive whole-millisecond time budget');
  const comparisons = method ? [
    ['evaluator', arm(method), arm()],
    ['candidate-samples', arm(method), arm(method, 100)],
    ['candidate-depth', arm(method, 300, 12), arm(method)],
  ] : [];
  comparisons.push(['reference-samples', arm(), arm('reference', 100)], ['reference-depth', arm('reference', 300, 12), arm()]);
  comparisons.push(['matched-time', arm(method || 'reference', 300, 4, 'study', timeBudgetMs), arm('reference', 300, 4, 'deployed', timeBudgetMs)]);
  // Fixed comparison banks: reference-only execution does not recycle omitted banks.
  const slots = ['evaluator', 'candidate-samples', 'candidate-depth', 'reference-samples', 'reference-depth', 'matched-time'];
  return comparisons.flatMap(([key, candidate, opponent]) => pairs('confirmation', key, candidate, opponent,
    Array.from({ length: 100 }, (_, i) => 9000000 + 997 * (slots.indexOf(key) * 100 + i))));
}
