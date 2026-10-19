/** Fixed profiles are admitted using timing only, before strength outcomes. */
export const CLAIM_ALPHA = 0.05 / 3;
export const CANDIDATES = Object.freeze(['power-aware', 'noprior', 'both', 'lean-es']);
export const METHODS = Object.freeze(['reference', 'exceptional', 'chains', 'investment', 'blend', 'lean-es']);
export const PROFILES = Object.freeze({ full: Object.freeze({ screenPairs: 60, confirmationPairs: 200 }), compact: Object.freeze({ screenPairs: 40, confirmationPairs: 100 }) });
export const REQUESTED_TIME_MS = 1000;
export function profileName(profile = 'full') {
  if (typeof profile === 'string' && Object.hasOwn(PROFILES, profile)) return profile;
  for (const [name, value] of Object.entries(PROFILES)) if (profile === value) return name;
  throw new Error('Choose the frozen full or compact profile before strength outcomes');
}
export function anchorArm(anchor = 'reference') {
  const method = typeof anchor === 'string' ? anchor : anchor?.method;
  if (!METHODS.includes(method) || method === 'lean-es') throw new Error('Anchor must be an original study method');
  return { method, policy: 'original', priorWeight: .18, pipeline: 'study', budget: 300, horizon: 4, timeMs: REQUESTED_TIME_MS };
}
export function candidateArm(key, anchor = 'reference') {
  if (!CANDIDATES.includes(key)) throw new Error('Unknown overnight intervention');
  return { ...anchorArm(anchor), ...(key === 'lean-es' ? { method: 'lean-es' } : {}), policy: ['power-aware', 'both'].includes(key) ? 'power-aware' : 'original', priorWeight: ['noprior', 'both'].includes(key) ? 0 : .18 };
}
function pairs(stage, profile, matchup, candidate, opponent, start, count) {
  return Array.from({ length: count }, (_, i) => start + 997 * i).flatMap(seed => [0, 1].map(seat => ({ id: `overnight/${stage}/${profile}/${matchup}/${seed}/${seat}`, stage, profile, matchup, seed, seat, candidate: { ...candidate }, opponent: { ...opponent }, rolloutStepLimit: 192 })));
}
export function screenTasks(anchor = 'reference', profile = 'full') {
  const p = profileName(profile), base = p === 'full' ? 22000000 : 23000000;
  return CANDIDATES.flatMap(key => pairs('screen', p, key, candidateArm(key, anchor), anchorArm(anchor), base, PROFILES[p].screenPairs));
}
function selectedArm(selected, anchor) {
  if (!selected) return null;
  const key = typeof selected === 'string' ? selected : selected.key;
  const expected = candidateArm(key, anchor);
  if (selected.candidate && Object.keys(expected).some(k => selected.candidate[k] !== expected[k])) throw new Error('Selected intervention differs from frozen anchor configuration');
  return expected;
}
export function confirmationTasks(selected, anchor = 'reference', profile = 'full') {
  const p = profileName(profile), candidate = selectedArm(selected, anchor);
  if (!candidate) return [];
  const count = PROFILES[p].confirmationPairs, base = p === 'full' ? 24000000 : 25000000;
  const deployed = { ...anchorArm('reference'), pipeline: 'deployed' };
  return [...pairs('confirmation', p, 'anchor', candidate, anchorArm(anchor), base, count), ...pairs('confirmation', p, 'deployed', candidate, deployed, base + 997 * 300, count)];
}
export function scalingTasks(selected) {
  if (!selected) return [];
  if (!selected.candidate || !CANDIDATES.includes(selected.key)) throw new Error('Scaling requires the frozen selected candidate configuration');
  const { timeMs, ...candidate } = selected.candidate;
  const expected = candidateArm(selected.key, candidate.method === 'lean-es' ? 'reference' : candidate.method);
  for (const key of ['method', 'policy', 'priorWeight', 'pipeline', 'horizon']) if (candidate[key] !== expected[key]) throw new Error('Invalid selected scaling intervention');
  return pairs('scaling', 'optional', 'samples', { ...candidate, budget: 300 }, { ...candidate, budget: 100 }, 26000000, 100);
}
export function canaryTasks(anchor = 'reference') {
  return CANDIDATES.flatMap((key, i) => pairs('canary', 'canary', key, candidateArm(key, anchor), anchorArm(anchor), 21000000 + 997 * i, 1));
}
