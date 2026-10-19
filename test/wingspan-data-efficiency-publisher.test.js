import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,readdirSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createZeroModel} from '../scripts/wingspan-selfplay/inference.mjs';

const publisher=resolve('scripts/wingspan-data-efficiency/publish.py');
const branch='benchmarks/wingspan-data-efficiency-2026-10-19';
const write=(path,value)=>{mkdirSync(resolve(path,'..'),{recursive:true});writeFileSync(path,JSON.stringify(value));};
function fixture(t,{complete=false}={}) {
  const base=mkdtempSync(join(tmpdir(),'wingspan-publisher-'));t.after(()=>rmSync(base,{recursive:true,force:true}));
  const root=join(base,'source'),runtime=join(base,'runtime'),evidence=join(base,'evidence');
  for(const p of [root,runtime,evidence])mkdirSync(p);
  const git=(...args)=>execFileSync('git',args,{cwd:evidence,encoding:'utf8',windowsHide:true});
  git('init','--initial-branch='+branch);git('remote','add','origin','https://github.com/seanmason/board-game-ai-dev.git');
  const records=Array.from({length:complete?80:78},(_,i)=>({task:{matchup:'baseline-trained',seed:100+Math.floor(i/2),seat:i%2,
    observation:'SECRET-RAW-OBSERVATION',path:'C:/SECRET/RAW'},result:{status:'complete',validation:{valid:true},winShare:1,margin:100,
    scores:['SECRET-OUTCOME'],features:['SECRET-FEATURE']},validation:{valid:true}}));
  const manifest={schema:1,status:complete?'complete':'running',startedAt:Date.now(),deadlineEpochMs:Date.now()+3600000,
    stopReason:complete?'C:/SECRET/STOPREASON':null,config:{workers:28,sourceRevision:'a'.repeat(40),frozenHashes:{'C:/SECRET/source.mjs':'b'.repeat(64)},
      modelHashes:{'frozen-generation-3':'c'.repeat(64)},retained:[{readFiles:'SECRET-READFILES'}],runtimeConfig:{private:'SECRET-CONFIG'}},
    allocation:{counts:{baseline:280,hybrid:560},ratesMsPerGroup:{baseline:10,hybrid:5},targetPoolMs:1200000,private:'SECRET-ALLOCATION'},
    stages:{screen:{status:complete?'complete':'running',planned:80,result:{records,readFiles:'SECRET-READFILES'}},
      'train-baseline':{status:'complete',result:{modelHashes:{'trained-baseline':'d'.repeat(64)},models:{private:'SECRET-MODEL-PATH'}}}},
    screen:{passed:true,comparisons:{'baseline-trained':{pairs:40,valid:true,passed:true,winShare:1,meanMargin:100,private:'SECRET-COMPARISON'}}}};
  const row={matchup:'screen/baseline-trained',policyId:'Hybrid versus baseline',metricKind:'win-share',planned:80,finished:records.length,
    counts:{complete:records.length,private:'SECRET-COUNTS'},inferenceComplete:true,seedGroups:40,completeSeedGroups:records.length/2,
    winShare:{n:40,mean:1,low:.9,high:1,private:'SECRET-INTERVAL'},margin:{n:40,mean:100,low:90,high:110},
    observations:['SECRET-OBSERVATION'],readFiles:['SECRET-READFILES'],budget:{timeMs:1000,horizon:4,private:'SECRET-BUDGET'}};
  const dash={schema:1,study:'wingspan-data-efficiency',status:complete?'finished':'running',outcomeStatus:manifest.status,stage:'screen',
    updatedAt:new Date().toISOString(),finished:records.length,planned:80,rows:[row],private:'SECRET-DASHBOARD',config:{paths:'SECRET-PATHS'}};
  write(join(runtime,'manifest.json'),manifest);write(join(root,'fixture-dashboard.json'),dash);
  const model=createZeroModel();model.private='SECRET-MODEL-EXTRA';write(join(runtime,'stages/train-baseline/model.json'),model);
  const script=join(root,'scripts/wingspan-data-efficiency/dashboard.mjs');mkdirSync(resolve(script,'..'),{recursive:true});
  writeFileSync(script,"import{readFileSync,writeFileSync}from'node:fs';const out=process.argv.find(a=>a.startsWith('--out=')).slice(6);writeFileSync(out,readFileSync('fixture-dashboard.json'));\n");
  const invoke=()=>spawnSync('python',[publisher,'--root='+root,'--runtime='+runtime,'--evidence='+evidence,'--node='+process.execPath,'--once','--no-git'],
    {encoding:'utf8',windowsHide:true});
  return {root,runtime,evidence,manifest,dash,git,invoke};
}
function treeText(dir){return readdirSync(dir,{withFileTypes:true}).map(e=>e.isDirectory()?treeText(join(dir,e.name)):readFileSync(join(dir,e.name),'utf8')).join('\n');}

test('real no-git CLI exports allowlisted fields/weights and withholds partial fixed comparison outcomes',t=>{
  const f=fixture(t);const run=f.invoke();assert.equal(run.status,0,run.stderr);
  const target=join(f.evidence,'wingspan-data-efficiency'),text=treeText(target);
  assert.equal(text.includes('SECRET'),false);
  for(const key of ['"records"','"readFiles"','"observations"','"features"','"runtimeConfig"','"retained"'])assert.equal(text.includes(key),false,key);
  const dash=JSON.parse(readFileSync(join(target,'dashboard.json')));
  assert.equal(dash.rows[0].winShare.mean,null);assert.equal(dash.rows[0].margin.mean,null);assert.equal(dash.rows[0].outcomesWithheld,true);
  const m=JSON.parse(readFileSync(join(target,'manifest.json')));
  assert.equal(m.screen.comparisons['baseline-trained'].winShare,undefined);
  const model=JSON.parse(readFileSync(join(target,'stages/train-baseline/model.json')));
  assert.equal(model.layers[0].weights.length,192*32);assert.equal(model.private,undefined);
  const status=JSON.parse(readFileSync(join(f.runtime,'publish-status.json')));
  assert.equal(status.success,true);assert.equal(status.publicationConfirmed,false);
  assert.equal(f.git('status','--porcelain').includes('?? wingspan-data-efficiency/'),true);
});

test('only complete valid fixed pairs expose outcomes, with terminal stop reason persisted',t=>{
  const f=fixture(t,{complete:true});const run=f.invoke();assert.equal(run.status,0,run.stderr);
  const text=treeText(join(f.evidence,'wingspan-data-efficiency'));assert.equal(text.includes('SECRET'),false);
  const dash=JSON.parse(readFileSync(join(f.evidence,'wingspan-data-efficiency/dashboard.json')));
  assert.equal(dash.rows[0].winShare.mean,1);assert.equal(dash.rows[0].inferenceComplete,true);
  assert.equal(JSON.parse(readFileSync(join(f.runtime,'publish-status.json'))).terminal,true);
});

test('same-count duplicate seats cannot expose outcomes',t=>{
  const f=fixture(t,{complete:true});f.manifest.stages.screen.result.records[1].task.seat=0;write(join(f.runtime,'manifest.json'),f.manifest);
  const run=f.invoke();assert.equal(run.status,0,run.stderr);
  const dash=JSON.parse(readFileSync(join(f.evidence,'wingspan-data-efficiency/dashboard.json')));
  assert.equal(dash.rows[0].winShare.mean,null);
});

test('terminal state without persisted analysis or stop reason fails closed',t=>{
  const f=fixture(t,{complete:true});delete f.manifest.stopReason;write(join(f.runtime,'manifest.json'),f.manifest);
  assert.notEqual(f.invoke().status,0);
  const status=JSON.parse(readFileSync(join(f.runtime,'publish-status.json')));assert.equal(status.success,false);
});

test('wrong remote, push remote or branch is refused even with no-git',t=>{
  const f=fixture(t);f.git('remote','set-url','origin','https://github.com/seanmason/board-game-ai.git');assert.notEqual(f.invoke().status,0);
  f.git('remote','set-url','origin','https://github.com/seanmason/board-game-ai-dev.git');
  f.git('remote','set-url','--push','origin','https://github.com/seanmason/board-game-ai.git');assert.notEqual(f.invoke().status,0);
  f.git('config','--unset-all','remote.origin.pushurl');f.git('symbolic-ref','HEAD','refs/heads/wrong-branch');assert.notEqual(f.invoke().status,0);
});

test('deadline is required and duplicate publisher locks are never stolen',t=>{
  const f=fixture(t);write(join(f.runtime,'publisher.lock'),{pid:1234});assert.notEqual(f.invoke().status,0);
  assert.equal(JSON.parse(readFileSync(join(f.runtime,'publisher.lock'))).pid,1234);
  rmSync(join(f.runtime,'publisher.lock'));delete f.manifest.deadlineEpochMs;write(join(f.runtime,'manifest.json'),f.manifest);
  assert.notEqual(f.invoke().status,0);
});

test('existing destination links/junctions are rejected before writing outside evidence scope',t=>{
  const f=fixture(t),outside=join(f.runtime,'outside');mkdirSync(outside);
  try{symlinkSync(outside,join(f.evidence,'wingspan-data-efficiency'),process.platform==='win32'?'junction':'dir');}
  catch(error){if(['EPERM','EACCES'].includes(error.code)){t.skip('Host forbids creating symlink fixture');return;}throw error;}
  assert.notEqual(f.invoke().status,0);
  assert.deepEqual(readdirSync(outside),[]);
});
