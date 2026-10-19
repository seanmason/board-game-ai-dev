/** Bounded training-only diagnostic. Does not change labels or run games. */
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, isAbsolute, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {observationBaseline} from '../wingspan-selfplay/collect.mjs';
import {encodeObservation, FEATURE_VERSION} from '../wingspan-selfplay/encoder.mjs';

export const NOISE_PROTOCOL = Object.freeze({version:1, purpose:'training-baseline-noise-v1', games:4,
  replicates:16, worldsPerReplicate:4, referenceWorlds:128, rounds:4, viewers:2});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const identityHash = value => hash(JSON.stringify(value));
const check = (ok, message) => {if (!ok) throw Error(message);};
const parse = bytes => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
const mean = xs => xs.reduce((a,b) => a+b, 0)/xs.length;
const safeId = id => typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9/_-]{0,159}$/.test(id);
const pathKey = path => resolve(path).toLowerCase();

function aggregate(cases) {
  const ds = cases.map(c => c.differenceToNoisyReference), sds = cases.map(c => c.samplingSd);
  return {cases:cases.length, meanSamplingSd:mean(sds), maxSamplingSd:Math.max(...sds),
    rootMeanSamplingVariance:Math.sqrt(mean(sds.map(x=>x*x))),
    meanDifferenceToNoisyReference:mean(ds), meanAbsoluteDifferenceToNoisyReference:mean(ds.map(Math.abs)),
    rmsDifferenceToNoisyReference:Math.sqrt(mean(ds.map(x=>x*x)))};
}

/** Only selected training files are opened. readBytes/baseline allow synthetic unit fixtures. */
export function runBaselineNoise({manifest, baseline=observationBaseline, readBytes=readFileSync}={}) {
  check(typeof manifest === 'string' && isAbsolute(manifest), 'Absolute dataset index required');
  const indexBytes = readBytes(manifest), index = parse(indexBytes);
  check(index.schema === 1 && index.featureVersion === FEATURE_VERSION && Array.isArray(index.records), 'Invalid dataset index');
  // Never inspect, resolve, stat or open paths belonging to excluded splits.
  const train = index.records.filter(r => r?.split === 'train');
  check(train.length >= NOISE_PROTOCOL.games, 'At least four training games required');
  const ids = new Set(), setups = new Set(), paths = new Set();
  for (const r of train) {
    check(safeId(r.gameId) && Number.isSafeInteger(r.setupSeed) && r.setupSeed >= 0 &&
      Number.isInteger(r.generation) && r.generation >= 1 && typeof r.path === 'string' && isAbsolute(r.path), 'Invalid training inventory identity');
    const p = pathKey(r.path);
    check(!ids.has(r.gameId) && !setups.has(r.setupSeed) && !paths.has(p) && p !== pathKey(manifest), 'Duplicate training game/setup/path');
    ids.add(r.gameId); setups.add(r.setupSeed); paths.add(p);
  }
  const selected = train.map(r => ({r, selectionHash:identityHash([NOISE_PROTOCOL.purpose,r.gameId])}))
    .sort((a,b)=>a.selectionHash.localeCompare(b.selectionHash)||a.r.gameId.localeCompare(b.r.gameId)).slice(0,4);
  const cases = [], gameReceipts = [];
  // Validate all selected whole games and all eight cells before any baseline calls.
  for (const {r,selectionHash} of selected) {
    const bytes = readBytes(r.path), record = parse(bytes), task = record.task;
    check(task?.id === r.gameId && task.split === 'train' && task.seed === r.setupSeed && task.generation === r.generation,
      'Selected training record identity mismatch');
    check(record.validation?.valid === true && !(record.validation.issues?.length) && record.result?.status === 'complete' &&
      record.result.validation?.valid === true && !(record.result.validation.issues?.length) && !record.result.errors && !record.result.illegalActions,
      'Selected training record incomplete or invalid');
    check(Array.isArray(record.valueExamples) && record.valueExamples.length > 0, 'Missing training observations');
    const cells = new Map(), positions = new Set();
    for (const e of record.valueExamples) {
      check(e.gameId === r.gameId && e.split === 'train' && e.setupSeed === r.setupSeed && e.generation === r.generation &&
        Number.isInteger(e.step) && e.step > 0 && Number.isInteger(e.round) && e.round >= 1 && e.round <= 4 &&
        [0,1].includes(e.viewer) && e.phase === 'play' && e.observation?.phase === 'play' && e.observation.round === e.round &&
        e.featureVersion === FEATURE_VERSION, 'Invalid training example identity/context');
      encodeObservation(e.observation,e.viewer); // Reject forbidden hidden information in retained observations.
      const key = `${e.round}/${e.viewer}`, previous = cells.get(key);
      const position = `${key}/${e.step}`;
      check(!positions.has(position), 'Duplicate training position cell'); positions.add(position);
      if (!previous || e.step < previous.step) cells.set(key,e);
    }
    check(cells.size === 8, 'Selected training game lacks round/viewer cells');
    const recordSha256 = hash(bytes);
    gameReceipts.push({gameId:r.gameId, selectionHash, recordSha256});
    for (let round=1;round<=4;round++) for (const viewer of [0,1]) {
      const e = cells.get(`${round}/${viewer}`), caseId = `${r.gameId}/round-${round}/viewer-${viewer}/step-${e.step}`;
      cases.push({caseId,gameId:r.gameId,round,viewer,observation:e.observation,
        observationSha256:identityHash(e.observation)});
    }
  }
  const usedSeeds = new Set();
  const seedFor = (caseId,kind,replicate) => {
    let nonce = 0, seed;
    do {seed = Number.parseInt(identityHash([NOISE_PROTOCOL.purpose,caseId,kind,replicate,nonce++]).slice(0,8),16);} while (usedSeeds.has(seed));
    usedSeeds.add(seed); return seed;
  };
  const measured = cases.map(c => {
    const seeds = Array.from({length:16},(_,i)=>seedFor(c.caseId,'replicate',i)), referenceSeed = seedFor(c.caseId,'reference',0);
    // Callbacks receive no targets, outcomes, features or original baseline labels.
    const values = seeds.map(seed=>baseline(structuredClone(c.observation),c.viewer,seed,4));
    const reference = baseline(structuredClone(c.observation),c.viewer,referenceSeed,128);
    check([...values,reference].every(Number.isFinite), 'Nonfinite baseline result');
    const average = mean(values), variance = values.reduce((a,v)=>a+(v-average)**2,0)/15;
    const samplingSd = Math.sqrt(variance), differenceToNoisyReference = average-reference;
    check([samplingSd,differenceToNoisyReference].every(Number.isFinite), 'Nonfinite sampling metric');
    return {...c,samplingSd,differenceToNoisyReference,seedReceiptSha256:identityHash({seeds,referenceSeed})};
  });
  const result = {schema:1,status:'complete',protocol:NOISE_PROTOCOL,manifestSha256:hash(indexBytes),
    selectedGames:gameReceipts, caseReceipts:measured.map(({caseId,gameId,round,viewer,observationSha256,seedReceiptSha256})=>
      ({caseId,gameId,round,viewer,observationSha256,seedReceiptSha256})),
    baselineCalls:32*17, sampledWorlds:32*(16*4+128), aggregate:aggregate(measured),
    byRound:Object.fromEntries([1,2,3,4].map(r=>[r,aggregate(measured.filter(c=>c.round===r))])),
    byViewer:Object.fromEntries([0,1].map(v=>[v,aggregate(measured.filter(c=>c.viewer===v))])),
    byRoundViewer:Object.fromEntries([1,2,3,4].flatMap(r=>[0,1].map(v=>[`${r}/${v}`,aggregate(measured.filter(c=>c.round===r&&c.viewer===v))]))),
    labelsChanged:false,tuningPermitted:false,
    limitations:['Four outcome-blind hash-selected whole training games; 32 correlated cases, not population error estimates.',
      'Sampling SD is the within-position sample SD of sixteen separately seeded four-world estimates, in score points.',
      'The separate 128-world estimate is noisy reference, not truth; differences include its sampling error.',
      'No targets/outcomes/original baseline values are used for selection or metrics. Existing labels remain unchanged.']};
  check(Object.values(result.aggregate).every(Number.isFinite), 'Nonfinite aggregate');
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = Object.fromEntries(process.argv.slice(2).map(a=>{
      const match = /^--(manifest|out)=(.+)$/.exec(a); check(match,'Expected --manifest=... --out=...'); return [match[1],match[2]];
    }));
    check(Object.keys(args).length === 2 && isAbsolute(args.out), 'Absolute manifest and output required');
    const result = runBaselineNoise({manifest:args.manifest});
    mkdirSync(dirname(args.out),{recursive:true});
    writeFileSync(args.out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({status:result.status,cases:result.aggregate.cases,sampledWorlds:result.sampledWorlds}));
  } catch {
    console.error('Baseline-noise diagnostic failed; no successful diagnostic receipt was written.'); process.exitCode=1;
  }
}
