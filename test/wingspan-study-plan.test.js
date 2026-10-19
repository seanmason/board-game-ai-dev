import test from 'node:test';
import assert from 'node:assert/strict';
import { METHODS, CELLS, screenTasks, canaryTasks, confirmationTasks, CLAIM_ALPHA } from '../scripts/wingspan-study/plan.mjs';
import { analyze, selectCandidate, validateResult, validateResults, studentTQuantile, studentTCdf, summarize } from '../scripts/wingspan-study/analyze.mjs';

function result(task, winShare = 1, margin = 5) {
  const candidate = { decisions: 2, iterations: 600, roots: 40, unvisited: 0, rolloutCount: 600, safetyCapCount: 0, unsettledLeaves: 0 };
  return { ...structuredClone(task), status: 'complete', scores: task.seat === 0 ? [70 + margin, 70] : [70, 70 + margin], margin, winShare, illegalActions: 0, errors: 0, diagnostics: { candidate, opponent: { ...candidate } }, decisionTimes: { candidate: [10, 20], opponent: [10, 20] } };
}
test('fixed design has 1600 screen games, eight canaries and disjoint held-out banks', () => {
  const screen = screenTasks(), canaries = canaryTasks(), confirm = confirmationTasks('exceptional', 20);
  assert.equal(METHODS.length, 5); assert.equal(CELLS.length, 4);
  assert.equal(screen.length, 1600); assert.equal(canaries.length, 8); assert.equal(confirm.length, 1200);
  assert.equal(confirmationTasks(null, 20).length, 600);
  const ss = new Set(screen.map(t => t.seed)), cs = new Set(canaries.map(t => t.seed)), fs = new Set(confirm.map(t => t.seed));
  assert.equal(ss.size, 40); assert.equal(cs.size, 4); assert.equal(fs.size, 600);
  assert.equal([...fs].filter(x => ss.has(x) || cs.has(x)).length, 0);
  assert.equal([...ss].filter(x => cs.has(x)).length, 0);
  assert.equal(new Set([...screen, ...canaries, ...confirm].map(t => t.id)).size, 2808);
  for (const t of screen) { assert.deepEqual(t.opponent, { method: 'reference', budget: 300, horizon: 4, pipeline: 'study' }); assert.equal(t.rolloutStepLimit, 192); }
  const reduced = confirmationTasks(null, 20);
  assert.deepEqual(reduced.map(t => t.id), confirm.filter(t => ['reference-samples', 'reference-depth', 'matched-time'].includes(t.matchup)).map(t => t.id));
  assert.throws(() => confirmationTasks('reference', 20)); assert.throws(() => confirmationTasks('blend', 0));
});
test('t quantiles agree with published standard critical values and round-trip', () => {
  assert.ok(Math.abs(studentTQuantile(.975, 1) - 12.706204736) < 1e-6);
  assert.ok(Math.abs(studentTQuantile(.975, 39) - 2.02269092) < 1e-6);
  assert.ok(Math.abs(studentTQuantile(.975, 99) - 1.98421695) < 1e-6);
  const q = studentTQuantile(1 - CLAIM_ALPHA, 99);
  assert.ok(q > 2.43 && q < 2.44);
  assert.ok(Math.abs(studentTCdf(q, 99) - (1 - CLAIM_ALPHA)) < 1e-12);
  assert.ok(Math.abs(studentTQuantile(.025, 39) + studentTQuantile(.975, 39)) < 1e-10);
});
test('zero observed variance is explicitly uncertain, including unanimous winners', () => {
  const s = summarize(Array(100).fill(1), { bounds: [0, 1] });
  assert.equal(s.degenerate, true); assert.equal(s.intervalMethod, 'bounded-Hoeffding-backup');
  assert.ok(s.lowerBound < 1 && s.lowerBound > .5); assert.ok(s.ci95[0] < 1);
  assert.equal(summarize(Array(40).fill(5)).lowerBound, null);
  assert.equal(summarize([1], { bounds: [0, 1] }).lowerBound < .5, true);
});
test('strict validation preserves failed/capped records and rejects config, coverage, duplicate and missing evidence', () => {
  const tasks = canaryTasks(), records = tasks.map(t => result(t));
  assert.equal(validateResults(records, tasks).complete, true);
  for (const mutate of [r => { r.status = 'capped'; }, r => { r.margin++; }, r => { r.winShare = .7; }, r => { r.opponent.budget = 100; }, r => { r.diagnostics.candidate.unvisited = 1; }, r => { r.diagnostics.opponent.safetyCapCount = 1; }, r => { delete r.diagnostics.candidate.unsettledLeaves; }, r => { delete r.errors; }, r => { r.decisionTimes.candidate = []; }, r => { r.diagnostics.candidate.iterations = 10.5; }, r => { r.diagnostics.candidate.roots = 601; }, r => { r.diagnostics.candidate.rolloutCount = 599; }, r => { r.diagnostics.opponent.iterations = 599; r.diagnostics.opponent.rolloutCount = 599; }]) {
    const bad = structuredClone(records); mutate(bad[0]);
    const checked = validateResults(bad, tasks);
    assert.equal(checked.complete, false); assert.equal(checked.received, 8); assert.equal(checked.valid.length, 7); assert.equal(checked.issues.length, 1);
  }
  assert.equal(validateResults([...records, records[0]], tasks).valid.length, 7);
  assert.equal(validateResults(records.slice(1), tasks).missing.length, 1);
  assert.equal(validateResults(records, [...tasks, tasks[0]]).complete, false);
  const missingConfiguration = structuredClone(records[0]); delete missingConfiguration.opponent.pipeline;
  const badTask = structuredClone(tasks[0]); delete badTask.opponent.pipeline;
  assert.equal(validateResults([missingConfiguration], [badTask]).complete, false);
  const tie = result(tasks[0], .5, 0); assert.deepEqual(validateResult(tie, tasks[0]), []);
  tie.winShare = 1; assert.deepEqual(validateResult(tie, tasks[0]), [], 'score tie may be won by final tiebreak');
});
test('legacy endpoint exemption is explicit, pipeline-specific and never exempts a safety cap', () => {
  const task = confirmationTasks('blend', 20).find(t => t.matchup === 'matched-time');
  const r = result(task); r.diagnostics.opponent.unsettledLeaves = null;
  assert.ok(validateResult(r, task).length > 0);
  r.diagnostics.opponent.endpointMeasurement = 'legacy-not-instrumented';
  assert.deepEqual(validateResult(r, task), []);
  r.diagnostics.opponent.safetyCapCount = 1; assert.ok(validateResult(r, task).length > 0);
  const s = result(canaryTasks()[0]); s.diagnostics.candidate.unsettledLeaves = null; s.diagnostics.candidate.endpointMeasurement = 'legacy-not-instrumented';
  assert.ok(validateResult(s, canaryTasks()[0]).length > 0);
});
test('selection uses only fixed 300/4 and stable tie ranking; missing result blocks eligibility', () => {
  const tasks = screenTasks();
  const records = tasks.map(t => result(t, t.candidate.budget === 300 && t.candidate.horizon === 4 ? 1 : 0, t.candidate.budget === 300 && t.candidate.horizon === 4 ? 5 : -5));
  assert.equal(selectCandidate(records).method, 'blend');
  const withoutBlend = records.filter(r => !(r.matchup === 'blend-n300-h4' && r.seat === 0));
  assert.equal(selectCandidate(withoutBlend).method, 'chains');
  const bestWrongCell = tasks.filter(t => t.candidate.method === 'exceptional' && t.candidate.horizon === 12).map(t => result(t));
  assert.equal(selectCandidate(bestWrongCell), null);
  const duplicate = [...records, records.find(r => r.matchup === 'blend-n300-h4')];
  assert.equal(selectCandidate(duplicate).method, 'chains');
});
test('screen contrasts use shared setup means, report interaction and subtract reference gains', () => {
  const tasks = screenTasks();
  const records = tasks.map(t => {
    const score = (t.candidate.budget === 300 ? 4 : 0) + (t.candidate.horizon === 12 ? 2 : 0) + (t.candidate.method === 'exceptional' && t.candidate.budget === 300 ? 2 : 0);
    return result(t, 1, score + 1);
  });
  const report = analyze(records, { tasks });
  assert.equal(report.complete, true);
  assert.equal(report.groups['reference-n100-h4'].pairs, 40);
  assert.equal(report.contrasts.exceptional.samplesH4.margin.mean, 6);
  assert.equal(report.contrasts.exceptional.samplesH4MinusReference.margin.mean, 2);
  assert.equal(report.contrasts.exceptional.depthN300.margin.mean, 2);
  assert.equal(report.contrasts.exceptional.interaction.margin.mean, 0);
  assert.equal(report.contrasts.exceptional.samplesH4.margin.n, 40);
  const partial = analyze(records.slice(1), { tasks });
  assert.equal(partial.complete, false); assert.equal(partial.selectedCandidate, null);
  assert.equal(partial.contrasts.reference.samplesH4.complete, false);
});
test('fresh confirmation applies fixed alpha, latency and complete evidence before adoption', () => {
  const tasks = confirmationTasks('blend', 20), records = tasks.map(t => result(t));
  let report = analyze(records, { tasks });
  assert.equal(report.alpha, .05 / 6); assert.equal(report.adoptionRecommended, true);
  assert.equal(report.groups.evaluator.winShare.n, 100);
  const slow = structuredClone(records);
  slow.filter(r => r.matchup === 'matched-time').forEach(r => { r.decisionTimes.candidate = [20, 40]; });
  report = analyze(slow, { tasks });
  assert.equal(report.groups['matched-time'].superiority, true); assert.equal(report.adoptionRecommended, false);
  const cheap = structuredClone(records);
  cheap.filter(r => r.matchup === 'matched-time').forEach(r => { r.decisionTimes.candidate = [1, 2]; });
  report = analyze(cheap, { tasks });
  assert.equal(report.adoptionRecommended, true); assert.equal(report.groups['matched-time'].approximatelyEqualRealizedTime, false);
  report = analyze(records.slice(1), { tasks }); assert.equal(report.adoptionRecommended, false);
  const shortenedTasks = tasks.filter(t => t.seed === tasks.find(s => s.matchup === t.matchup).seed);
  report = analyze(shortenedTasks.map(t => result(t)), { tasks: shortenedTasks });
  assert.equal(report.adoptionRecommended, false, 'a reduced planned N cannot clear a fresh claim');
  const referenceTasks = confirmationTasks(null, 20);
  report = analyze(referenceTasks.map(t => result(t)), { tasks: referenceTasks });
  assert.equal(report.alpha, .05 / 6); assert.equal(report.adoptionRecommended, false);
});
