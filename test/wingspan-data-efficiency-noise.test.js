import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {newGame,publicObservation} from '../wingspan/core.js';
import {FEATURE_VERSION} from '../scripts/wingspan-selfplay/encoder.mjs';
import {runBaselineNoise} from '../scripts/wingspan-data-efficiency/baseline-noise.mjs';

function fixture() {
  const manifest = resolve('synthetic-noise-index.json'), records = [], files = new Map(), opened = [];
  for (let i=0;i<6;i++) {
    const row = {path:resolve(`synthetic-train-${i}.json`),split:'train',gameId:`collect/1/${i}`,setupSeed:100+i,generation:1};
    records.push(row);
    const state = newGame({players:2,seed:row.setupSeed}); state.phase='play';
    const examples = [];
    for (let round=1;round<=4;round++) for (const viewer of [0,1]) for (const step of [round*10+1,round*10]) {
      state.round=round;
      examples.push({gameId:row.gameId,setupSeed:row.setupSeed,generation:1,split:'train',round,viewer,step,
        phase:'play',featureVersion:FEATURE_VERSION,observation:publicObservation(state,viewer),
        targetMargin:999999,baselineMargin:-999999,features:['private-features-do-not-export']});
    }
    const record = {task:{id:row.gameId,seed:row.setupSeed,generation:1,split:'train'},validation:{valid:true,issues:[]},
      result:{status:'complete',validation:{valid:true,issues:[]},scores:['private-outcomes-do-not-export']},valueExamples:examples};
    files.set(row.path,record);
  }
  records.push({split:'dev',path:resolve('FORBIDDEN-dev.json')},{split:'audit',path:resolve('FORBIDDEN-audit.json')},
    {split:'confirmation',path:resolve('FORBIDDEN-eval.json')});
  const index={schema:1,featureVersion:FEATURE_VERSION,records};
  const readBytes = path => {
    opened.push(path);
    if(path===manifest) return Buffer.from(JSON.stringify(index));
    assert.ok(files.has(path),'Excluded file must never be read');
    return Buffer.from(JSON.stringify(files.get(path)));
  };
  return {manifest,index,files,opened,readBytes};
}
const constant = ()=>7;

test('bounded hash selection opens only four train games and first round/viewer cells; no private export',()=>{
  const f=fixture(), calls=[];
  const out=runBaselineNoise({...f,baseline:(o,v,seed,worlds)=>{calls.push({v,seed,worlds});return 7;}});
  assert.equal(f.opened.length,5);
  assert.equal(out.selectedGames.length,4);
  assert.equal(out.caseReceipts.length,32);
  assert.equal(out.baselineCalls,544);
  assert.equal(out.sampledWorlds,6144);
  assert.equal(calls.filter(c=>c.worlds===4).length,512);
  assert.equal(calls.filter(c=>c.worlds===128).length,32);
  assert.equal(new Set(calls.map(c=>c.seed)).size,544);
  for(const c of out.caseReceipts) assert.ok(c.caseId.endsWith(`step-${c.round*10}`));
  const json=JSON.stringify(out);
  for(const forbidden of ['private-features','private-outcomes','targetMargin','"observation":','"features":','FORBIDDEN',f.manifest])
    assert.equal(json.includes(forbidden),false,forbidden);
  assert.equal(out.aggregate.meanSamplingSd,0);
  assert.equal(out.aggregate.rmsDifferenceToNoisyReference,0);
  assert.equal(out.labelsChanged,false);
  for(const cell of Object.values(out.byRoundViewer)) assert.equal(cell.cases,4);
});

test('selection and results are reproducible, index-order invariant and outcome/label blind',()=>{
  const f=fixture();
  const baseline=(o,v,seed,worlds)=>(seed%1000)/100+(worlds===128?1:0);
  const a=runBaselineNoise({...f,baseline});
  f.index.records.reverse();
  for(const record of f.files.values()) {
    record.result.scores=[-1e12,1e12];
    for(const e of record.valueExamples){e.targetMargin=-1e12;e.baselineMargin=1e12;}
  }
  const b=runBaselineNoise({...f,baseline});
  assert.deepEqual(a.caseReceipts,b.caseReceipts);
  assert.deepEqual(a.aggregate,b.aggregate);
  assert.deepEqual(a.selectedGames.map(g=>g.gameId),b.selectedGames.map(g=>g.gameId));
  assert.ok(a.aggregate.meanSamplingSd>0);
  assert.ok(Object.values(a.aggregate).every(Number.isFinite));
  assert.deepEqual(b,runBaselineNoise({...f,baseline}));
});

test('excluded split paths are not even inspected before filtering',()=>{
  const f=fixture();
  for(const row of f.index.records.filter(r=>r.split!=='train')) {
    Object.defineProperty(row,'path',{get(){throw Error('Forbidden path access');}});
    Object.defineProperty(row,'toJSON',{value(){return {split:this.split};}});
  }
  // Supply the index object through JSON parse-compatible bytes; missing excluded paths remain untouched.
  assert.equal(runBaselineNoise({...f,baseline:constant}).aggregate.cases,32);
});

test('incomplete round/viewer cells fail before baseline calls; no alternate game substitution',()=>{
  const f=fixture(), selected=runBaselineNoise({...f,baseline:constant}).selectedGames[0].gameId;
  const record=[...f.files.values()].find(r=>r.task.id===selected);
  record.valueExamples=record.valueExamples.filter(e=>e.round!==4||e.viewer!==1);
  let calls=0;
  assert.throws(()=>runBaselineNoise({...f,baseline:()=>{calls++;return 0;}}),/lacks round\/viewer/);
  assert.equal(calls,0);
});

test('invalid selected records and cross-split observations fail closed',()=>{
  const f=fixture(), selected=runBaselineNoise({...f,baseline:constant}).selectedGames[0].gameId;
  const record=[...f.files.values()].find(r=>r.task.id===selected);
  record.result.status='failed';
  assert.throws(()=>runBaselineNoise({...f,baseline:constant}),/incomplete or invalid/);
  record.result.status='complete'; record.valueExamples[0].split='audit';
  assert.throws(()=>runBaselineNoise({...f,baseline:constant}),/example identity/);
  record.valueExamples[0].split='train'; record.valueExamples[0].observation.deck=[1,2];
  assert.throws(()=>runBaselineNoise({...f,baseline:constant}),/forbidden deck/);
});

test('duplicate train inventory identities reject before reading any game',()=>{
  const f=fixture(); f.index.records[1].setupSeed=f.index.records[0].setupSeed;
  assert.throws(()=>runBaselineNoise({...f,baseline:constant}),/Duplicate training/);
  assert.deepEqual(f.opened,[f.manifest]);
});

test('sampling SD uses sixteen-replicate sample variance, not uncertainty of their mean',()=>{
  const f=fixture(); let call=0;
  const out=runBaselineNoise({...f,baseline:()=>call++%17});
  assert.ok(Math.abs(out.aggregate.meanSamplingSd-Math.sqrt(340/15))<1e-12);
  assert.equal(out.aggregate.meanDifferenceToNoisyReference,-8.5);
  assert.equal(out.aggregate.meanAbsoluteDifferenceToNoisyReference,8.5);
});

test('nonfinite diagnostic results reject; callbacks cannot mutate retained observations',()=>{
  const f=fixture();
  assert.throws(()=>runBaselineNoise({...f,baseline:()=>NaN}),/Nonfinite/);
  const a=runBaselineNoise({...f,baseline:(o)=>{o.round=99;return 5;}});
  const b=runBaselineNoise({...f,baseline:constant});
  assert.deepEqual(a.caseReceipts,b.caseReceipts);
  assert.equal(a.aggregate.maxSamplingSd,0);
});
