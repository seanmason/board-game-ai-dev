import test from 'node:test';
import assert from 'node:assert/strict';
import { PROFILES, CANDIDATES, CLAIM_ALPHA, anchorArm, candidateArm, screenTasks, confirmationTasks, scalingTasks, canaryTasks } from '../scripts/wingspan-overnight/plan.mjs';
import { analyze, selectCandidate, validateResult, validateResults } from '../scripts/wingspan-overnight/analyze.mjs';

function result(task, { winShare = 1, margin = 5, candidateTime = 10, opponentTime = 10 } = {}) {
  const counter = arm => ({ decisions: 2, iterations: arm.timeMs ? 200 : arm.budget * 2, roots: 40, unvisited: 0, rolloutCount: arm.timeMs ? 200 : arm.budget * 2, safetyCapCount: 0, unsettledLeaves: arm.pipeline === 'deployed' ? null : 0, endpointMeasurement: arm.pipeline === 'deployed' ? 'legacy-not-instrumented' : 'resolved-boundary', illegalActions: 0, errors: 0 });
  return { ...structuredClone(task), status: 'complete', scores: task.seat ? [70, 70 + margin] : [70 + margin, 70], margin, winShare, illegalActions: 0, errors: 0, diagnostics: { candidate: counter(task.candidate), opponent: counter(task.opponent) }, decisionTimes: { candidate: [candidateTime, candidateTime], opponent: [opponentTime, opponentTime] } };
}
const selected = (key = 'power-aware', anchor = 'reference') => ({ key, candidate: candidateArm(key, anchor) });
test('profiles have fixed counts and wholly disjoint stage/profile banks', () => {
  assert.deepEqual(PROFILES.full, { screenPairs: 60, confirmationPairs: 200 });
  assert.deepEqual(PROFILES.compact, { screenPairs: 40, confirmationPairs: 100 });
  const banks = [canaryTasks(), screenTasks('reference', 'full'), screenTasks('reference', 'compact'), confirmationTasks(selected(), 'reference', 'full'), confirmationTasks(selected(), 'reference', 'compact'), scalingTasks(selected())];
  assert.deepEqual(banks.map(xs => xs.length), [8, 480, 320, 800, 400, 200]);
  const seeds = banks.map(xs => new Set(xs.map(t => t.seed)));
  seeds.forEach((s, i) => seeds.forEach((other, j) => { if (i !== j) assert.equal([...s].some(x => other.has(x)), false); }));
  const all = banks.flat(); assert.equal(new Set(all.map(t => t.id)).size, all.length);
  assert.equal(confirmationTasks(null).length, 0); assert.equal(scalingTasks(null).length, 0);
  assert.throws(() => screenTasks('reference', 'invented')); assert.throws(() => anchorArm('lean-es'));
});
test('interventions preserve the chosen anchor except their exact declared changes', () => {
  const tasks = screenTasks('chains');
  for (const key of CANDIDATES) {
    const task = tasks.find(t => t.matchup === key);
    assert.deepEqual(task.opponent, anchorArm('chains'));
    assert.equal(task.candidate.method, key === 'lean-es' ? 'lean-es' : 'chains');
    assert.equal(task.candidate.policy, ['power-aware', 'both'].includes(key) ? 'power-aware' : 'original');
    assert.equal(task.candidate.priorWeight, ['noprior', 'both'].includes(key) ? 0 : .18);
    assert.equal(task.candidate.timeMs, 1000); assert.equal(task.rolloutStepLimit, 192);
  }
  const followup = confirmationTasks(selected('both', 'chains'), 'chains');
  assert.deepEqual(followup.find(t => t.matchup === 'anchor').opponent, anchorArm('chains'));
  assert.equal(followup.find(t => t.matchup === 'deployed').opponent.pipeline, 'deployed');
  assert.throws(() => confirmationTasks(selected('both', 'chains'), 'exceptional'));
  const scaling = scalingTasks(selected('both', 'chains'));
  assert.equal(scaling[0].candidate.timeMs, undefined); assert.equal(scaling[0].candidate.budget, 300); assert.equal(scaling[0].opponent.budget, 100);
});
test('strict validation rejects failures, missing config, counters, latency, caps and duplicates', () => {
  const tasks = canaryTasks(), records = tasks.map(t => result(t));
  assert.equal(validateResults(records, tasks).complete, true);
  for (const mutate of [r => { r.status = 'capped'; }, r => { delete r.errors; }, r => { r.margin++; }, r => { r.winShare = .3; }, r => { delete r.candidate.priorWeight; }, r => { r.diagnostics.opponent.safetyCapCount = 1; }, r => { r.diagnostics.candidate.unvisited = 1; }, r => { r.diagnostics.candidate.unsettledLeaves = 1; }, r => { r.diagnostics.candidate.iterations = 1.5; }, r => { r.diagnostics.opponent.rolloutCount--; }, r => { r.decisionTimes.candidate.pop(); }]) {
    const bad = structuredClone(records); mutate(bad[0]);
    const checked = validateResults(bad, tasks);
    assert.equal(checked.complete, false); assert.equal(checked.valid.length, 7); assert.equal(checked.received, 8);
  }
  assert.equal(validateResults([...records, records[0]], tasks).valid.length, 7);
  assert.equal(validateResults(records, [...tasks, tasks[0]]).complete, false);
  assert.equal(validateResults(records.slice(1), tasks).missing.length, 1);
  assert.ok(validateResult(null, tasks[0]).length);
  const scaling = scalingTasks(selected()), r = result(scaling[0]);
  r.diagnostics.candidate.iterations = 599; r.diagnostics.candidate.rolloutCount = 599;
  assert.ok(validateResult(r, scaling[0]).includes('candidate-sample-floor-failure'));
});
test('legacy endpoint null is explicitly marked and never exempts caps or study endpoints', () => {
  const task = confirmationTasks(selected()).find(t => t.matchup === 'deployed'), r = result(task);
  assert.deepEqual(validateResult(r, task), []);
  delete r.diagnostics.opponent.endpointMeasurement; assert.ok(validateResult(r, task).length);
  r.diagnostics.opponent.endpointMeasurement = 'legacy-not-instrumented'; r.diagnostics.opponent.safetyCapCount = 1; assert.ok(validateResult(r, task).length);
  const s = result(canaryTasks()[0]); s.diagnostics.candidate.unsettledLeaves = null; s.diagnostics.candidate.endpointMeasurement = 'legacy-not-instrumented';
  assert.ok(validateResult(s, canaryTasks()[0]).length);
});
test('screen selection requires every fixed arm, pairing, complete evidence and both latency ceilings', () => {
  const tasks = screenTasks('reference', 'compact'), records = tasks.map(t => result(t));
  assert.equal(selectCandidate(records, tasks).key, 'both');
  assert.equal(selectCandidate(records.slice(1), tasks), null);
  assert.equal(selectCandidate([...records, records[0]], tasks), null);
  const slow = records.map(r => r.matchup === 'both' ? { ...r, decisionTimes: { ...r.decisionTimes, candidate: [12, 12] } } : r);
  assert.equal(selectCandidate(slow, tasks).key, 'lean-es');
  assert.equal(selectCandidate(records.filter(r => r.matchup !== 'noprior'), tasks.filter(t => t.matchup !== 'noprior')), null);
  const partialTasks = tasks.filter(t => t.seed === tasks[0].seed);
  assert.equal(selectCandidate(partialTasks.map(t => result(t)), partialTasks), null);
  const report = analyze(records, tasks);
  assert.equal(report.groups.both.winShare.n, 40); assert.equal(report.groups.both.superiority, false);
  assert.equal(report.groups.both.winShare.degenerate, true); assert.ok(report.groups.both.winShare.lowerBound < 1);
});
test('confirmation requires both fresh practical gates with fixed alpha, no automatic promotion', () => {
  for (const profile of ['full', 'compact']) {
    const tasks = confirmationTasks(selected(), 'reference', profile), records = tasks.map(t => result(t));
    let report = analyze(records, tasks);
    assert.equal(report.alpha, .05 / 3); assert.equal(report.alpha, CLAIM_ALPHA);
    assert.equal(report.complete, true); assert.equal(report.status, 'complete'); assert.equal(report.recommendationSupported, true);
    assert.equal(report.autoPromotion, false); assert.equal(report.productionDefaultsChanged, false);
    assert.equal(report.groups.anchor.winShare.n, PROFILES[profile].confirmationPairs);
    assert.equal(report.groups.deployed.legacyEndpointNotInstrumented, true);
    const slow = records.map(r => r.matchup === 'deployed' ? { ...r, decisionTimes: { ...r.decisionTimes, candidate: [20, 20] } } : r);
    report = analyze(slow, tasks); assert.equal(report.groups.deployed.superiority, true); assert.equal(report.recommendationSupported, false);
    report = analyze(records.slice(1), tasks); assert.equal(report.status, 'incomplete'); assert.equal(report.recommendationSupported, false);
    const reduced = tasks.filter(t => t.seed === tasks.find(s => s.matchup === t.matchup).seed);
    report = analyze(reduced.map(t => result(t)), reduced); assert.equal(report.complete, false); assert.equal(report.recommendationSupported, false);
  }
});
test('altered baselines, cross-arm configurations and reused confirmation seeds fail design checks', () => {
  let tasks = screenTasks(); tasks[0].candidate.priorWeight = 0;
  let report = analyze(tasks.map(t => result(t)), tasks); assert.equal(report.designValid, false); assert.equal(report.complete, false);
  tasks = confirmationTasks(selected());
  tasks.filter(t => t.matchup === 'anchor').forEach(t => { t.opponent.method = 'chains'; });
  report = analyze(tasks.map(t => result(t)), tasks); assert.equal(report.recommendationSupported, false); assert.equal(report.designValid, false);
  tasks = confirmationTasks(selected());
  const bank = tasks.filter(t => t.matchup === 'anchor');
  tasks.filter(t => t.matchup === 'deployed').forEach((t, i) => { t.seed = bank[i].seed; });
  report = analyze(tasks.map(t => result(t)), tasks); assert.equal(report.complete, false); assert.equal(report.designValid, false);
});
test('optional scaling is a separate fresh claim, not an adoption substitute', () => {
  const tasks = scalingTasks(selected('lean-es')), records = tasks.map(t => result(t));
  const report = analyze(records, tasks);
  assert.equal(report.complete, true); assert.equal(report.groups.samples.superiority, true);
  assert.equal(report.recommendationSupported, false); assert.equal(report.groups.samples.winShare.n, 100);
  assert.equal(analyze([], []).status, 'not-scheduled');
});
