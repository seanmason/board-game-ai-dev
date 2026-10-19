import { METHODS, CLAIM_ALPHA, screenTasks } from './plan.mjs';

// Incomplete beta continued fraction and Lanczos log-gamma provide t quantiles,
// including the fixed one-sided Bonferroni decision threshold (no normal shortcut).
function logGamma(z) {
  const c = [676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406, 12.507343278686905, -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7];
  if (z < .5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  z--; let x = .99999999999980993;
  c.forEach((v, i) => { x += v / (z + i + 1); });
  const t = z + c.length - .5;
  return .5 * Math.log(2 * Math.PI) + (z + .5) * Math.log(t) - t + Math.log(x);
}
function betaFraction(a, b, x) {
  const tiny = 1e-300; let c = 1, d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d; let h = d;
  for (let m = 1; m <= 300; m++) {
    const coefficients = [m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m)), -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1))];
    for (const [phase, aa] of coefficients.entries()) {
      d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
      c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
      d = 1 / d; const delta = d * c; h *= delta;
      if (phase === 1 && Math.abs(delta - 1) < 1e-14) return h;
    }
  }
  return h;
}
function beta(x, a, b) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const factor = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log1p(-x));
  return x < (a + 1) / (a + b + 2) ? factor * betaFraction(a, b, x) / a : 1 - factor * betaFraction(b, a, 1 - x) / b;
}
export function studentTCdf(t, df) {
  if (!(df > 0)) throw new Error('Positive degrees of freedom required');
  const tail = .5 * beta(df / (df + t * t), df / 2, .5);
  return t >= 0 ? 1 - tail : tail;
}
export function studentTQuantile(p, df) {
  if (!(p > 0 && p < 1 && df > 0)) throw new Error('Invalid t quantile');
  let lo = -1, hi = 1;
  while (studentTCdf(lo, df) > p) lo *= 2;
  while (studentTCdf(hi, df) < p) hi *= 2;
  for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (studentTCdf(mid, df) < p) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
export function summarize(values, { bounds, alpha = CLAIM_ALPHA } = {}) {
  const n = values.length;
  if (!n) return { n: 0, mean: null, ci95: null, lowerBound: null, degenerate: false };
  const mean = values.reduce((s, x) => s + x, 0) / n;
  const variance = n > 1 ? values.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1) : 0;
  const degenerate = variance < 1e-24;
  if (n < 2 || degenerate) {
    // A constant observed sample is not perfect knowledge. Hoeffding applies
    // to independent bounded setup means, including unanimous outcomes.
    const radius = p => bounds ? (bounds[1] - bounds[0]) * Math.sqrt(Math.log(1 / p) / (2 * n)) : Infinity;
    return { n, mean, variance, degenerate, intervalMethod: bounds ? 'bounded-Hoeffding-backup' : 'unbounded-degenerate', ci95: bounds ? [mean - radius(.025), mean + radius(.025)] : null, lowerBound: bounds ? mean - radius(alpha) : null };
  }
  const se = Math.sqrt(variance / n), radius = studentTQuantile(.975, n - 1) * se;
  return { n, mean, variance, degenerate, intervalMethod: 'paired-t-approximate', ci95: [mean - radius, mean + radius], lowerBound: mean - studentTQuantile(1 - alpha, n - 1) * se };
}
const fields = ['id', 'stage', 'matchup', 'seed', 'seat', 'candidate', 'opponent', 'rolloutStepLimit'];
function validTask(task) {
  const validArm = a => a && METHODS.includes(a.method) && [100, 300].includes(a.budget) && [4, 12].includes(a.horizon) && ['study', 'deployed'].includes(a.pipeline) && (a.timeMs === undefined || (Number.isInteger(a.timeMs) && a.timeMs > 0));
  return task && typeof task.id === 'string' && task.id.length > 0 && ['canary', 'screen', 'confirmation'].includes(task.stage) && typeof task.matchup === 'string' && task.matchup.length > 0 && Number.isSafeInteger(task.seed) && [0, 1].includes(task.seat) && task.rolloutStepLimit === 192 && validArm(task.candidate) && validArm(task.opponent);
}
function same(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keys = Object.keys(a).sort();
  return keys.length === Object.keys(b).length && keys.every(k => Object.hasOwn(b, k) && same(a[k], b[k]));
}
export function validateResult(result, task) {
  const errors = [];
  if (!validTask(task) || !fields.every(k => same(result[k], task[k]))) errors.push('task-configuration-mismatch');
  if (result.status !== 'complete') errors.push(`status-${result.status || 'missing'}`);
  if (!Array.isArray(result.scores) || result.scores.length !== 2 || !result.scores.every(Number.isFinite)) errors.push('invalid-scores');
  else if (!Number.isFinite(result.margin) || Math.abs(result.margin - (result.scores[result.seat] - result.scores[1 - result.seat])) > 1e-9) errors.push('invalid-margin');
  if (![0, .5, 1].includes(result.winShare)) errors.push('invalid-win-share');
  if (Number.isFinite(result.margin) && ((result.margin > 0 && result.winShare !== 1) || (result.margin < 0 && result.winShare !== 0))) errors.push('outcome-score-disagreement');
  for (const key of ['illegalActions', 'errors']) if (result[key] !== 0) errors.push(`nonzero-or-missing-${key}`);
  for (const side of ['candidate', 'opponent']) {
    const d = result.diagnostics?.[side];
    const legacyEndpoint = task?.[side]?.pipeline === 'deployed' && d?.unsettledLeaves === null && d?.endpointMeasurement === 'legacy-not-instrumented';
    for (const key of ['decisions', 'iterations', 'roots', 'unvisited', 'rolloutCount', 'safetyCapCount', 'unsettledLeaves']) {
      if (key === 'unsettledLeaves' && legacyEndpoint) continue;
      if (!Number.isSafeInteger(d?.[key]) || d[key] < 0) errors.push(`${side}-missing-${key}`);
    }
    if (!(d?.decisions > 0)) errors.push(`${side}-zero-decisions`);
    if (!(d?.iterations >= d?.roots) || d?.rolloutCount !== d?.iterations) errors.push(`${side}-invalid-root-accounting`);
    if (task?.[side]?.timeMs === undefined && !(d?.iterations >= task?.[side]?.budget * d?.decisions)) errors.push(`${side}-sample-floor-failure`);
    for (const key of ['unvisited', 'safetyCapCount', 'unsettledLeaves', 'illegalActions', 'errors']) if (d?.[key]) errors.push(`${side}-${key}`);
    const times = result.decisionTimes?.[side];
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
  for (const result of results) { const list = byId.get(result.id) || []; list.push(result); byId.set(result.id, list); }
  const valid = [];
  for (const [id, records] of byId) {
    const errors = records.length === 1 ? validateResult(records[0], expected.get(id)) : ['duplicate-result'];
    if (errors.length) issues.push({ id, errors }); else valid.push(records[0]);
  }
  const missing = [...expected.keys()].filter(id => !byId.has(id));
  return { expected: tasks.length, received: results.length, valid, issues, missing, complete: issues.length === 0 && missing.length === 0 && valid.length === tasks.length };
}
function paired(records) {
  const seeds = new Map();
  for (const r of records) { const list = seeds.get(r.seed) || []; list.push(r); seeds.set(r.seed, list); }
  return new Map([...seeds].filter(([, rs]) => rs.length === 2 && new Set(rs.map(r => r.seat)).size === 2).map(([seed, rs]) => [seed, { winShare: (rs[0].winShare + rs[1].winShare) / 2, margin: (rs[0].margin + rs[1].margin) / 2 }]));
}
function latency(records, side) {
  const xs = records.flatMap(r => r.decisionTimes?.[side] || []).sort((a, b) => a - b);
  const totalMs = xs.reduce((a, b) => a + b, 0);
  const timed = records.flatMap(r => Number.isFinite(r[side]?.timeMs) ? r.decisionTimes[side].map(ms => ({ ms, target: r[side].timeMs })) : []);
  return { n: xs.length, totalMs, mean: xs.length ? totalMs / xs.length : null, p50: xs.length ? xs[Math.ceil(.5 * xs.length) - 1] : null, p95: xs.length ? xs[Math.ceil(.95 * xs.length) - 1] : null, max: xs.length ? xs.at(-1) : null, overrunFrequency: timed.length ? timed.filter(t => t.ms > t.target).length / timed.length : null };
}
export function selectCandidate(results) {
  const tasks = screenTasks();
  const eligible = METHODS.filter(m => m !== 'reference').flatMap(method => {
    const matchup = `${method}-n300-h4`, expected = tasks.filter(t => t.matchup === matchup);
    const checked = validateResults(results.filter(r => r.matchup === matchup || expected.some(t => t.id === r.id)), expected);
    const pairs = [...paired(checked.valid).values()];
    const winShare = summarize(pairs.map(p => p.winShare), { bounds: [0, 1] }).mean;
    const margin = summarize(pairs.map(p => p.margin)).mean;
    return checked.complete && pairs.length === 40 && winShare >= .55 && margin > 0 ? [{ method, winShare, margin }] : [];
  });
  return eligible.sort((a, b) => b.winShare - a.winShare || b.margin - a.margin || a.method.localeCompare(b.method))[0] || null;
}
export function analyze(results, { tasks = screenTasks(), stage = tasks[0]?.stage } = {}) {
  const checked = validateResults(results, tasks), groups = {}, pairMaps = new Map();
  for (const matchup of new Set(tasks.map(t => t.matchup))) {
    const expected = tasks.filter(t => t.matchup === matchup);
    const records = checked.valid.filter(r => r.matchup === matchup);
    const ps = paired(records); pairMaps.set(matchup, ps);
    const localIssues = checked.issues.filter(i => expected.some(t => t.id === i.id));
    const complete = records.length === expected.length && localIssues.length === 0 && checked.issues.every(i => i.errors[0] !== 'duplicate-expected-task');
    const share = summarize([...ps.values()].map(p => p.winShare), { bounds: [0, 1] });
    const margin = summarize([...ps.values()].map(p => p.margin));
    const candidateLatency = latency(records, 'candidate'), opponentLatency = latency(records, 'opponent');
    const ratio = (a, b) => b > 0 ? a / b : null;
    const meanRatio = ratio(candidateLatency.mean, opponentLatency.mean), p95Ratio = ratio(candidateLatency.p95, opponentLatency.p95);
    const latencyGate = meanRatio !== null && p95Ratio !== null && meanRatio <= 1.10 && p95Ratio <= 1.25;
    const superiority = stage === 'confirmation' && expected.length === 200 && complete && checked.issues.length === 0 && ps.size === 100 && share.lowerBound > .5 && margin.mean > 0;
    groups[matchup] = { matchup, expected: expected.length, valid: records.length, pairs: ps.size, complete, winShare: share, margin, candidateLatency, opponentLatency, meanRatio, p95Ratio, latencyGate, legacyEndpointNotInstrumented: records.some(r => ['candidate', 'opponent'].some(s => r.diagnostics[s]?.endpointMeasurement === 'legacy-not-instrumented')), approximatelyEqualRealizedTime: meanRatio >= .90 && meanRatio <= 1.10 && p95Ratio >= .80 && p95Ratio <= 1.25, superiority, practicalGate: superiority && latencyGate };
  }
  const contrasts = {};
  if (stage === 'screen') {
    const definitions = { samplesH4: [[300, 4, 1], [100, 4, -1]], samplesH12: [[300, 12, 1], [100, 12, -1]], depthN100: [[100, 12, 1], [100, 4, -1]], depthN300: [[300, 12, 1], [300, 4, -1]], interaction: [[300, 12, 1], [100, 12, -1], [300, 4, -1], [100, 4, 1]] };
    for (const method of METHODS) {
      contrasts[method] = {};
      for (const [name, terms] of Object.entries(definitions)) {
        const compute = (subtractReference) => {
          const maps = terms.map(([b, h, sign]) => [pairMaps.get(`${method}-n${b}-h${h}`), sign]);
          if (subtractReference) maps.push(...terms.map(([b, h, sign]) => [pairMaps.get(`reference-n${b}-h${h}`), -sign]));
          const seeds = [...(maps[0][0]?.keys() || [])].filter(seed => maps.every(([map]) => map?.has(seed)));
          const metric = key => seeds.map(seed => maps.reduce((sum, [map, sign]) => sum + sign * map.get(seed)[key], 0));
          const range = maps.reduce((sum, [, sign]) => sum + Math.abs(sign), 0);
          return { complete: seeds.length === 40 && checked.complete, winShare: summarize(metric('winShare'), { bounds: [-range / 2, range / 2] }), margin: summarize(metric('margin')) };
        };
        contrasts[method][name] = compute(false);
        contrasts[method][`${name}MinusReference`] = compute(true);
      }
    }
  }
  return { stage, expected: checked.expected, received: checked.received, valid: checked.valid.length, complete: checked.complete, missing: checked.missing, issues: checked.issues, alpha: CLAIM_ALPHA, groups, contrasts, selectedCandidate: stage === 'screen' && checked.complete ? selectCandidate(results) : null, adoptionRecommended: stage === 'confirmation' && checked.complete && groups.evaluator?.superiority === true && groups['matched-time']?.practicalGate === true };
}
export const buildDashboardRows = summary => Object.values(summary.groups);
