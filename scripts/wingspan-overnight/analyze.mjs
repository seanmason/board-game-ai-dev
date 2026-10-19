import { summarize } from '../wingspan-study/analyze.mjs';
import { CLAIM_ALPHA, CANDIDATES, METHODS, PROFILES, anchorArm, candidateArm } from './plan.mjs';
export { summarize } from '../wingspan-study/analyze.mjs';

const taskFields = ['id', 'stage', 'profile', 'matchup', 'seed', 'seat', 'candidate', 'opponent', 'rolloutStepLimit'];
function same(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(k => Object.hasOwn(b, k) && same(a[k], b[k]));
}
function validArm(a) {
  return a && METHODS.includes(a.method) && ['original', 'power-aware'].includes(a.policy) && [.18, 0].includes(a.priorWeight) && ['study', 'deployed'].includes(a.pipeline) && [100, 300, 1000].includes(a.budget) && [4, 12].includes(a.horizon) && (a.timeMs === undefined || Number.isInteger(a.timeMs) && a.timeMs > 0) && (a.pipeline !== 'deployed' || a.method === 'reference' && a.policy === 'original' && a.priorWeight === .18);
}
export function validTask(t) {
  return Boolean(t && typeof t.id === 'string' && t.id && ['screen', 'confirmation', 'scaling', 'canary'].includes(t.stage) && ['full', 'compact', 'optional', 'canary'].includes(t.profile) && typeof t.matchup === 'string' && t.matchup && Number.isSafeInteger(t.seed) && [0, 1].includes(t.seat) && t.rolloutStepLimit === 192 && validArm(t.candidate) && validArm(t.opponent));
}
export function validateResult(r, task) {
  const errors = [];
  if (!r || typeof r !== 'object') return ['missing-result'];
  if (!validTask(task) || !taskFields.every(k => same(r[k], task[k]))) errors.push('task-configuration-mismatch');
  if (r.status !== 'complete') errors.push(`status-${r.status || 'missing'}`);
  if (!Array.isArray(r.scores) || r.scores.length !== 2 || !r.scores.every(Number.isFinite)) errors.push('invalid-scores');
  else if (![0, 1].includes(r.seat) || !Number.isFinite(r.margin) || Math.abs(r.margin - (r.scores[r.seat] - r.scores[1 - r.seat])) > 1e-9) errors.push('invalid-margin');
  if (![0, .5, 1].includes(r.winShare)) errors.push('invalid-win-share');
  if (Number.isFinite(r.margin) && (r.margin > 0 && r.winShare !== 1 || r.margin < 0 && r.winShare !== 0)) errors.push('outcome-score-disagreement');
  for (const key of ['illegalActions', 'errors']) if (r[key] !== 0) errors.push(`nonzero-or-missing-${key}`);
  for (const side of ['candidate', 'opponent']) {
    const d = r.diagnostics?.[side], arm = task?.[side];
    const legacy = arm?.pipeline === 'deployed' && d?.unsettledLeaves === null && d?.endpointMeasurement === 'legacy-not-instrumented';
    for (const key of ['decisions', 'iterations', 'roots', 'unvisited', 'rolloutCount', 'safetyCapCount', 'unsettledLeaves']) {
      if (key === 'unsettledLeaves' && legacy) continue;
      if (!Number.isSafeInteger(d?.[key]) || d[key] < 0) errors.push(`${side}-missing-${key}`);
    }
    if (!(d?.decisions > 0) || !(d?.roots >= d?.decisions)) errors.push(`${side}-invalid-decisions-or-roots`);
    if (!(d?.iterations >= d?.roots) || d?.rolloutCount !== d?.iterations) errors.push(`${side}-invalid-root-accounting`);
    if (arm?.timeMs === undefined && !(d?.iterations >= arm?.budget * d?.decisions)) errors.push(`${side}-sample-floor-failure`);
    for (const key of ['unvisited', 'safetyCapCount', 'unsettledLeaves', 'illegalActions', 'errors']) if (d?.[key]) errors.push(`${side}-${key}`);
    const times = r.decisionTimes?.[side];
    if (!Array.isArray(times) || !times.length || !times.every(x => Number.isFinite(x) && x >= 0) || times.length !== d?.decisions) errors.push(`${side}-decision-times`);
  }
  return errors;
}
export function validateResults(results, tasks) {
  const expected = new Map(), byId = new Map(), issues = [];
  for (const task of tasks) {
    if (!validTask(task)) issues.push({ id: task?.id, errors: ['invalid-expected-task'] });
    if (expected.has(task?.id)) issues.push({ id: task?.id, errors: ['duplicate-expected-task'] });
    expected.set(task?.id, task);
  }
  for (const r of results) { const id = r?.id; const records = byId.get(id) || []; records.push(r); byId.set(id, records); }
  const valid = [];
  for (const [id, records] of byId) {
    const errors = records.length === 1 ? validateResult(records[0], expected.get(id)) : ['duplicate-result'];
    if (errors.length) issues.push({ id, errors }); else valid.push(records[0]);
  }
  const missing = [...expected.keys()].filter(id => !byId.has(id));
  return { expected: tasks.length, received: results.length, valid, issues, missing, complete: issues.length === 0 && missing.length === 0 && valid.length === tasks.length };
}
function pairMeans(records) {
  const bySeed = new Map();
  for (const r of records) { const rs = bySeed.get(r.seed) || []; rs.push(r); bySeed.set(r.seed, rs); }
  return [...bySeed].filter(([, rs]) => rs.length === 2 && new Set(rs.map(r => r.seat)).size === 2).map(([seed, rs]) => ({ seed, winShare: (rs[0].winShare + rs[1].winShare) / 2, margin: (rs[0].margin + rs[1].margin) / 2 }));
}
function latency(records, side) {
  const times = records.flatMap(r => r.decisionTimes[side]).sort((a, b) => a - b), totalMs = times.reduce((a, b) => a + b, 0);
  const timed = records.flatMap(r => r[side].timeMs === undefined ? [] : r.decisionTimes[side].map(ms => ({ ms, target: r[side].timeMs })));
  return { n: times.length, totalMs, mean: times.length ? totalMs / times.length : null, p50: times.length ? times[Math.ceil(.5 * times.length) - 1] : null, p95: times.length ? times[Math.ceil(.95 * times.length) - 1] : null, max: times.length ? times.at(-1) : null, overrunFrequency: timed.length ? timed.filter(t => t.ms > t.target).length / timed.length : null };
}
function expectedPairCount(stage, profile) {
  if (stage === 'screen') return PROFILES[profile]?.screenPairs;
  if (stage === 'confirmation') return PROFILES[profile]?.confirmationPairs;
  if (stage === 'scaling' && profile === 'optional') return 100;
  if (stage === 'canary' && profile === 'canary') return 1;
  return null;
}
function stageDesignValid(tasks, stage) {
  if (!tasks.length || tasks.some(t => !validTask(t) || t.stage !== stage || t.profile !== tasks[0].profile)) return false;
  const keys = [...new Set(tasks.map(t => t.matchup))].sort();
  try {
    if (['screen', 'canary'].includes(stage)) {
      if (!same(keys, [...CANDIDATES].sort())) return false;
      const anchor = anchorArm(tasks[0].opponent);
      if (!tasks.every(t => same(t.opponent, anchor) && same(t.candidate, candidateArm(t.matchup, anchor)))) return false;
      if (stage === 'screen') {
        const seeds = key => [...new Set(tasks.filter(t => t.matchup === key).map(t => t.seed))].sort((a, b) => a - b);
        if (!keys.every(key => same(seeds(key), seeds(keys[0])))) return false;
      }
    } else if (stage === 'confirmation') {
      if (!same(keys, ['anchor', 'deployed'])) return false;
      const anchor = anchorArm(tasks.find(t => t.matchup === 'anchor').opponent);
      const deployed = { ...anchorArm('reference'), pipeline: 'deployed' }, candidate = tasks[0].candidate;
      if (!CANDIDATES.some(key => same(candidate, candidateArm(key, anchor)))) return false;
      if (!tasks.every(t => same(t.candidate, candidate) && same(t.opponent, t.matchup === 'anchor' ? anchor : deployed))) return false;
      const anchorSeeds = new Set(tasks.filter(t => t.matchup === 'anchor').map(t => t.seed));
      if (tasks.some(t => t.matchup === 'deployed' && anchorSeeds.has(t.seed))) return false;
    } else if (stage === 'scaling') {
      if (!same(keys, ['samples'])) return false;
      const candidate = tasks[0].candidate;
      const validCandidate = CANDIDATES.some(key => {
        const { timeMs, ...expected } = candidateArm(key, candidate.method === 'lean-es' ? 'reference' : candidate.method);
        return same(candidate, expected);
      });
      if (!validCandidate || !tasks.every(t => same(t.candidate, candidate) && same(t.opponent, { ...candidate, budget: 100 }))) return false;
    } else return false;
  } catch { return false; }
  return true;
}
export function analyze(results, tasks, { stage = tasks[0]?.stage } = {}) {
  if (!Array.isArray(results) || !Array.isArray(tasks)) throw new Error('Explicit results and frozen tasks required');
  const checked = validateResults(results, tasks), groups = {};
  for (const matchup of new Set(tasks.map(t => t.matchup))) {
    const planned = tasks.filter(t => t.matchup === matchup), records = checked.valid.filter(r => r.matchup === matchup), ps = pairMeans(records);
    const profile = planned[0]?.profile, n = expectedPairCount(stage, profile);
    const shapeValid = n > 0 && planned.length === n * 2 && planned.every(t => t.stage === stage && t.profile === profile && same(t.candidate, planned[0].candidate) && same(t.opponent, planned[0].opponent));
    const complete = checked.complete && shapeValid && ps.length === n;
    const winShare = summarize(ps.map(p => p.winShare), { bounds: [0, 1], alpha: CLAIM_ALPHA });
    const margin = summarize(ps.map(p => p.margin), { alpha: CLAIM_ALPHA });
    const candidateLatency = latency(records, 'candidate'), opponentLatency = latency(records, 'opponent');
    const ratio = (a, b) => b > 0 ? a / b : null;
    const meanRatio = ratio(candidateLatency.mean, opponentLatency.mean), p95Ratio = ratio(candidateLatency.p95, opponentLatency.p95);
    const latencyGate = meanRatio !== null && p95Ratio !== null && meanRatio <= 1.10 && p95Ratio <= 1.25;
    const superiority = ['confirmation', 'scaling'].includes(stage) && complete && winShare.lowerBound > .5 && margin.mean > 0;
    groups[matchup] = { matchup, profile, expected: planned.length, valid: records.length, pairs: ps.length, complete, shapeValid, winShare, margin, candidateLatency, opponentLatency, meanRatio, p95Ratio, latencyGate, superiority, practicalGate: superiority && latencyGate, approximatelyEqualRealizedTime: meanRatio !== null && p95Ratio !== null && meanRatio >= .90 && meanRatio <= 1.10 && p95Ratio >= .80 && p95Ratio <= 1.25, legacyEndpointNotInstrumented: records.some(r => ['candidate', 'opponent'].some(side => r.diagnostics[side]?.endpointMeasurement === 'legacy-not-instrumented')) };
  }
  const designValid = stageDesignValid(tasks, stage);
  const fullShape = designValid && Object.values(groups).length > 0 && Object.values(groups).every(g => g.shapeValid);
  const complete = checked.complete && fullShape;
  if (!designValid) for (const g of Object.values(groups)) { g.complete = false; g.superiority = false; g.practicalGate = false; }
  const bothPracticalPass = stage === 'confirmation' && complete && Object.keys(groups).length === 2 && groups.anchor?.practicalGate === true && groups.deployed?.practicalGate === true;
  return { stage, expected: tasks.length, received: results.length, valid: checked.valid.length, complete, designValid, status: !tasks.length ? 'not-scheduled' : checked.issues.length || !designValid ? 'invalid' : complete ? 'complete' : 'incomplete', missing: checked.missing, issues: checked.issues, alpha: CLAIM_ALPHA, groups, recommendationSupported: bothPracticalPass, adoptionRecommended: bothPracticalPass, productionDefaultsChanged: false, autoPromotion: false };
}
export function selectCandidate(results, tasks) {
  const summary = analyze(results, tasks, { stage: 'screen' });
  if (!summary.complete || Object.keys(summary.groups).length !== CANDIDATES.length || !CANDIDATES.every(key => summary.groups[key])) return null;
  const eligible = CANDIDATES.flatMap(key => {
    const g = summary.groups[key];
    return g.complete && g.latencyGate && g.winShare.mean >= .55 && g.margin.mean > 0 ? [{ key, candidate: { ...tasks.find(t => t.matchup === key).candidate }, winShare: g.winShare.mean, margin: g.margin.mean }] : [];
  });
  return eligible.sort((a, b) => b.winShare - a.winShare || b.margin - a.margin || a.key.localeCompare(b.key))[0] || null;
}
