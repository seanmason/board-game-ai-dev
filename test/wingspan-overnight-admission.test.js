import test from 'node:test';
import assert from 'node:assert/strict';
import { admitProfile, runBatch } from '../scripts/wingspan-overnight/runtime.mjs';
import { snapshot } from '../scripts/wingspan-overnight/dashboard.mjs';
import { screenTasks } from '../scripts/wingspan-overnight/plan.mjs';

const timings = () => Array(8).fill(1000);
function result(task) {
  const d = { decisions: 1, iterations: 100, roots: 20, unvisited: 0, rolloutCount: 100, safetyCapCount: 0, unsettledLeaves: 0, illegalActions: 0, errors: 0 };
  return { ...structuredClone(task), status: 'complete', scores: task.seat === 0 ? [75, 70] : [70, 75], margin: 5, winShare: 1, illegalActions: 0, errors: 0, diagnostics: { candidate: { ...d }, opponent: { ...d } }, decisionTimes: { candidate: [100], opponent: [100] } };
}
test('admission deterministically chooses full, compact or none from timings alone', () => {
  const elapsed = Object.freeze(timings()), base = { canaryElapsed: elapsed, workers: 30 };
  const full = admitProfile({ ...base, remainingMs: 1920000 });
  const compact = admitProfile({ ...base, remainingMs: 1860000 });
  const none = admitProfile({ ...base, remainingMs: 1800000 });
  assert.equal(full.profile, 'full'); assert.equal(compact.profile, 'compact'); assert.equal(none.profile, null);
  assert.equal(full.gameMs, 1750); assert.equal(full.reserveMs, 1800000);
  assert.equal(full.scaling, false); assert.equal(compact.scaling, false); assert.equal(none.scaling, false);
  assert.deepEqual(full, admitProfile({ ...base, remainingMs: 1920000, outcomes: Array(8).fill('loss') }));
  assert.deepEqual(full, admitProfile({ ...base, remainingMs: 1920000, outcomes: Array(8).fill('win') }));
  assert.deepEqual(elapsed, timings());
});
test('admission respects exact fit, tail cost and twenty percent or thirty minute reserve', () => {
  const threshold = 1280 * 1750 / 30 + 2000 + 1800000;
  assert.equal(admitProfile({ canaryElapsed: timings(), remainingMs: threshold }).profile, 'full');
  assert.equal(admitProfile({ canaryElapsed: timings(), remainingMs: threshold - 1 }).profile, 'compact');
  const long = admitProfile({ canaryElapsed: [1000, 1000, 1000, 1000, 1000, 1000, 1000, 10000], remainingMs: 9 * 3600000 });
  assert.equal(long.gameMs, 12500); assert.equal(long.reserveMs, 9 * 3600000 * .20);
  assert.equal(long.estimateMs, 1280 * 12500 / 30 + 20000);
  assert.equal(admitProfile({ canaryElapsed: timings(), remainingMs: 0 }).profile, null);
});
test('admission rejects invalid timing evidence, unavailable time and unsupported workers', () => {
  for (const canaryElapsed of [[], Array(7).fill(1000), [...timings().slice(1), 0], [...timings().slice(1), -1], [...timings().slice(1), NaN], [...timings().slice(1), Infinity]]) {
    assert.throws(() => admitProfile({ canaryElapsed, remainingMs: 9 * 3600000 }));
  }
  for (const workers of [0, -1, 1.5, 31, NaN, Infinity]) assert.throws(() => admitProfile({ canaryElapsed: timings(), remainingMs: 9 * 3600000, workers }));
  for (const remainingMs of [-1, NaN, Infinity]) assert.throws(() => admitProfile({ canaryElapsed: timings(), remainingMs }));
});
test('runtime rejects worker overflow before spawning or touching any game records', async () => {
  for (const workers of [0, -1, 1.5, 31, Infinity]) {
    await assert.rejects(runBatch({ tasks: [], workers, validate: () => [] }), /Worker cap is 30/);
  }
});
test('dashboard shows only complete valid seat pairs in partial rows', () => {
  const tasks = screenTasks('reference', 'compact'), first = result(tasks[0]), second = result(tasks[1]);
  let d = snapshot({ tasks, results: [first], status: 'running' });
  let row = d.rows.find(r => r.matchup === 'screen/power-aware');
  assert.equal(d.finished, 1); assert.equal(row.counts.complete, 1); assert.equal(row.completeSeedGroups, 0); assert.equal(row.winShare.mean, null);
  assert.equal(row.planned, 80); assert.equal(row.seedGroups, 40);
  d = snapshot({ tasks, results: [first, second], status: 'running' }); row = d.rows.find(r => r.matchup === 'screen/power-aware');
  assert.equal(row.completeSeedGroups, 1); assert.equal(row.winShare.mean, 1);
  assert.ok(row.winShare.low < 1, 'one unanimous pair never produces certainty');
  assert.equal(d.rows.filter(r => r.completeSeedGroups > 0).length, 1);
  assert.equal(d.adoptionRecommended, undefined); assert.equal(d.status, 'running');
});
test('dashboard excludes invalid counters, altered task config and unfinished results from pairs', () => {
  const tasks = screenTasks('reference', 'compact'), first = result(tasks[0]);
  for (const mutate of [r => { r.status = 'deadline'; }, r => { r.status = 'failed'; }, r => { r.diagnostics.candidate.safetyCapCount = 1; }, r => { r.diagnostics.opponent.unvisited = 1; }, r => { r.candidate.priorWeight = 0; }, r => { delete r.margin; }]) {
    const second = result(tasks[1]); mutate(second);
    const row = snapshot({ tasks, results: [first, second] }).rows.find(r => r.matchup === 'screen/power-aware');
    assert.equal(row.counts.complete, 1); assert.equal(row.completeSeedGroups, 0); assert.equal(row.winShare.mean, null); assert.equal(row.counts.error, 1);
  }
});
test('dashboard counts invalid result categories exactly once', () => {
  const tasks = screenTasks('reference', 'compact'), first = result(tasks[0]), capped = { ...result(tasks[1]), status: 'capped' };
  const row = snapshot({ tasks, results: [first, capped] }).rows.find(r => r.matchup === 'screen/power-aware');
  assert.equal(row.counts.capped, 1); assert.equal(Object.values(row.counts).reduce((a, b) => a + b), row.finished);
});
test('dashboard never treats duplicate seat records as certified pairs', () => {
  const tasks = screenTasks('reference', 'compact'), first = result(tasks[0]), second = result(tasks[1]);
  const row = snapshot({ tasks, results: [first, second, second] }).rows.find(r => r.matchup === 'screen/power-aware');
  assert.equal(row.completeSeedGroups, 0, 'duplicate seat record is not valid paired evidence');
  assert.equal(row.winShare.mean, null);
});
