import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {buildSelfplayDashboard,loadSelfplayDashboard} from '../scripts/wingspan-selfplay/dashboard.mjs';

const json=(path,value)=>{mkdirSync(resolve(path,'..'),{recursive:true});writeFileSync(path,JSON.stringify(value));};
const entry=(kind,status,result={})=>({kind,status,result});
function game(seed,seat,{matchup='reference',status='complete',valid=true,id=`${seed}/${seat}`}={}){
 return {task:{id,seed,seat,matchup,candidate:{method:'residual',modelId:'generation-1',timeMs:1000,horizon:4},opponent:{method:'reference'}},result:{status,winShare:1,margin:1,validation:{valid},decisionTimes:{candidate:[10,20],opponent:[20]},diagnostics:{candidate:{decisions:2,roots:4,unvisited:0,iterations:200,learnedLeafCount:100,learnedFallbackCount:2,errors:0}}},validation:{valid},elapsedMs:100};
}
const pairs=n=>Array.from({length:n},(_,seed)=>[game(seed,0),game(seed,1)]).flat();
test('inactive snapshots do not invent running workers or win rates',()=>{
 const d=buildSelfplayDashboard({now:'fixed'});assert.equal(d.schema,1);assert.equal(d.study,'wingspan-selfplay');assert.equal(d.status,'planned');assert.equal(d.workers,0);assert.equal(d.finished,0);assert.equal(d.rows.length,0);
});
test('actual running collection progress counts games and caps worker count',()=>{
 const d=buildSelfplayDashboard({manifest:{status:'running',workers:24,stages:{'collect-1':entry('collect','running')}},progressByStage:{'collect-1':{total:1024,completed:7,active:Array.from({length:30},(_,i)=>({id:'active'+i,secret:'DO_NOT_COPY'}))}}});
 assert.equal(d.status,'running');assert.equal(d.workers,24);assert.equal(d.active.length,24);assert.equal(d.finished,7);assert.equal(d.rows[0].counts.complete,7);assert.equal(d.planned,1024);assert.equal(d.rows[0].winShare.mean,null);assert.ok(!JSON.stringify(d).includes('DO_NOT_COPY'));
});
test('training loss rows and curves never increase global game counts',()=>{
 const d=buildSelfplayDashboard({manifest:{status:'running',stages:{calibration:entry('calibration','complete',{records:[game(0,0)],planned:32}),'train-1':entry('train','running',{config:{seed:1729,epochs:24},history:[{epoch:0,trainHuber:2,dev:{huber:3}},{epoch:1,trainHuber:1,dev:{huber:2}}],selectedEpoch:1,eligible:true})}}});
 const r=d.rows.find(r=>r.metricKind==='loss');assert.equal(d.finished,1);assert.equal(d.planned,32);assert.deepEqual(r.training.latestFit,{seed:1729,epoch:1,devValueHuber:2});assert.equal(r.training.curves.length,2);assert.equal(r.finished,1);assert.equal(r.counts.complete,1);assert.equal(r.progressLabel,'Optimization epochs completed');assert.equal(r.winShare.mean,null);assert.equal(d.workers,0);
});
test('live explicit validation counts and examples override fallback without inventing records',()=>{
 const d=buildSelfplayDashboard({manifest:{status:'running',sourceRevision:'abc123',stages:{'collect-1':entry('collect','running')}},progressByStage:{'collect-1':{total:1024,completed:10,counts:{complete:9,invalid:1,error:1},exampleCount:720,active:[]}}});
 assert.equal(d.rows[0].counts.complete,9);assert.equal(d.rows[0].counts.invalid,1);assert.equal(d.rows[0].examples,720);assert.equal(d.revision,'abc123');
});
test('optional compute checks count as actual global games while loss epochs do not',()=>{
 const d=buildSelfplayDashboard({manifest:{status:'running',stages:{scaling:entry('scaling','complete',{planned:80,records:pairs(40)}),'train-1':entry('train','complete',{config:{epochs:24},history:[{epoch:4,dev:{huber:1}}]})}}});
 assert.equal(d.finished,80);assert.equal(d.planned,80);assert.equal(d.rows.find(r=>r.metricKind==='loss').counts.complete,4);
});
test('failed stages expose a sanitized receipt and at least one known error even without compact records',()=>{
 const d=buildSelfplayDashboard({manifest:{status:'failed',stopReason:'Invalid game',stages:{'collect-1':{kind:'collect',status:'failed',failure:{reason:'Worker validation rejected game',taskId:'collect/1/4',observation:'DO_NOT_COPY'}}}},progressByStage:{'collect-1':{total:1024,completed:2,active:[{id:'stale'}]}}});
 assert.equal(d.rows[0].counts.complete,2);assert.equal(d.rows[0].counts.error,1);assert.deepEqual(d.rows[0].failure,{stage:'collect-1',reason:'Worker validation rejected game',taskId:'collect/1/4'});assert.equal(d.failures.length,1);assert.equal(d.workers,0);assert.ok(!JSON.stringify(d).includes('DO_NOT_COPY'));assert.equal(d.rows[0].winShare.mean,null);
});
test('partial comparisons expose progress but hide all winner-share statistics',()=>{
 const d=buildSelfplayDashboard({manifest:{status:'running',stages:{'screen-1':entry('screen','running',{records:pairs(39)})}}});
 const r=d.rows[0];assert.equal(r.finished,78);assert.equal(r.completeSeedGroups,39);assert.deepEqual(r.winShare,{n:0,mean:null,low:null,high:null});assert.equal(r.margin.mean,null);assert.equal(r.latency.p99Ms,20);assert.equal(r.coverage.iterations,15600);
});
test('complete fixed pairs show bounded paired intervals; duplicates and invalid games cannot',()=>{
 const records=pairs(40),make=rs=>buildSelfplayDashboard({manifest:{status:'running',stages:{'screen-1':entry('screen','complete',{records:rs})}}}).rows[0];
 const full=make(records);assert.equal(full.inferenceComplete,true);assert.equal(full.winShare.mean,1);assert.equal(full.winShare.n,40);assert.ok(full.winShare.low<1);assert.equal(full.winShare.high,1);
 assert.equal(make([...records,records[0]]).winShare.mean,null);
 const invalid=structuredClone(records);invalid[0].validation.valid=false;const bad=make(invalid);assert.equal(bad.winShare.mean,null);assert.equal(bad.counts.invalid,1);
 const capped=structuredClone(records);capped[0].result.status='capped';assert.equal(make(capped).counts.capped,1);
});
test('stopped is honestly finished with reason and zero active workers',()=>{
 const d=buildSelfplayDashboard({manifest:{status:'stopped',stopReason:'No promising candidate',workers:24,generation:1,stages:{'collect-1':entry('collect','complete',{records:[game(0,0)]})}},progressByStage:{'collect-1':{active:[{id:'stale'}]}}});
 assert.equal(d.status,'finished');assert.equal(d.outcomeStatus,'stopped');assert.equal(d.stopReason,'No promising candidate');assert.equal(d.workers,0);assert.deepEqual(d.active,[]);assert.equal(d.finished,1);assert.equal(d.planned,1024);
});
test('loader reads only manifest and progress; excludes raw fields and local paths',()=>{
 const root=mkdtempSync(join(tmpdir(),'wingspan-selfplay-dashboard-'));
 try{
  const secret='NEVER_PUBLIC_RAW_OBSERVATION';json(join(root,'manifest.json'),{status:'running',champion:'R',frozenHashes:{'C:\\Users\\private\\source.mjs':'a'.repeat(64)},stages:{'collect-1':entry('collect','running',{records:[{...game(1,0),valueExamples:[{observation:{secret},features:[secret]}],teacherDecisions:[secret]}]})}});
  json(join(root,'stages','collect-1','progress.json'),{total:1024,completed:1,active:[]});mkdirSync(join(root,'stages','collect-1','games'),{recursive:true});writeFileSync(join(root,'stages','collect-1','games','sealed.json'),'INVALID JSON '+secret);
  const output=JSON.stringify(loadSelfplayDashboard(root));assert.ok(!output.includes(secret));assert.ok(!output.includes('valueExamples'));assert.ok(!output.includes('teacherDecisions'));assert.ok(!output.includes('C:\\Users'));assert.ok(output.includes('source.mjs'));
 }finally{assert.ok(root.startsWith(tmpdir())&&root.includes('wingspan-selfplay-dashboard-'));rmSync(root,{recursive:true,force:true});}
});
test('confirmation requires its full 100 fixed pairs per comparison',()=>{
 const make=n=>buildSelfplayDashboard({manifest:{status:'complete',stages:{confirmation:entry('confirmation','complete',{records:pairs(n)})}}}).rows[0];assert.equal(make(40).winShare.mean,null);assert.equal(make(100).winShare.n,100);
});
test('publisher emits only allowlisted local review evidence and refuses finished-repo origin',()=>{
 const base=mkdtempSync(join(tmpdir(),'wingspan-selfplay-publish-')),runtime=join(base,'runtime'),evidence=join(base,'evidence'),root=resolve(fileURLToPath(new URL('..',import.meta.url))),python=process.env.WINGSPAN_PYTHON??'python';
 try{
  mkdirSync(evidence,{recursive:true});execFileSync('git',['init','-b','benchmarks/wingspan-selfplay-2026-10-19'],{cwd:evidence,stdio:'pipe'});execFileSync('git',['remote','add','origin','https://github.com/seanmason/board-game-ai-dev.git'],{cwd:evidence});
  const secret='PRIVATE_OBSERVATION_NOT_PUBLIC',manifest={schema:1,status:'stopped',stopReason:'No promising candidate',startedAt:Date.now(),stages:{'collect-1':entry('collect','complete',{records:[{...game(1,0),rawSha256:'a'.repeat(64),exampleCount:80,valueExamples:[{secret}]}]}),'train-1':entry('train','complete',{eligible:false,selectedEpoch:0,epochZero:'C:\\Users\\private\\epoch-zero.json',readFiles:[{path:'C:\\Users\\private\\raw.json'}]})}};json(join(runtime,'manifest.json'),manifest);
  manifest.stages['collect-1'].failure={reason:'Retained failure',taskId:'collect/1/invalid',observation:secret};json(join(runtime,'manifest.json'),manifest);
  json(join(runtime,'stages','train-1','model.json'),{version:1,featureVersion:'wingspan-compact-v1',featureNames:Array.from({length:192},(_,i)=>'f'+i),id:'synthetic',outputKind:'reference-residual',residualScale:10,normalization:{mean:Array(192).fill(0),scale:Array(192).fill(1)},layers:[[192,32,'relu'],[32,16,'relu'],[16,1,'linear']].map(([n,m,activation])=>({in:n,out:m,activation,weights:Array(n*m).fill(0),bias:Array(m).fill(0)})),privateObservation:secret});
  mkdirSync(join(runtime,'stages','collect-1','games'),{recursive:true});writeFileSync(join(runtime,'stages','collect-1','games','private.json'),secret);writeFileSync(join(runtime,'model.pt'),secret);
  const args=[join(root,'scripts','wingspan-selfplay','publish.py'),'--runtime',runtime,'--root',root,'--evidence',evidence,'--node',process.execPath,'--once','--no-git'];
  execFileSync(python,['-X','utf8',...args],{encoding:'utf8',timeout:30000});const target=join(evidence,'wingspan-selfplay');assert.ok(existsSync(join(target,'dashboard.json')));assert.ok(existsSync(join(target,'REPORT.md')));assert.ok(!existsSync(join(target,'stages','collect-1','games')));assert.ok(!existsSync(join(target,'model.pt')));
  function texts(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(f=>f.isDirectory()?texts(join(dir,f.name)):[readFileSync(join(dir,f.name),'utf8')]);}
  assert.ok(!texts(target).join('').includes(secret));assert.ok(!texts(target).join('').includes('valueExamples'));assert.equal(JSON.parse(readFileSync(join(runtime,'publish-status.json'),'utf8')).success,true);
  assert.ok(existsSync(join(target,'stages','train-1','model.json')));assert.ok(!texts(target).join('').includes('raw.json'));
  assert.deepEqual(JSON.parse(readFileSync(join(target,'manifest.json'),'utf8')).stages['collect-1'].failure,{reason:'Retained failure',taskId:'collect/1/invalid'});
  execFileSync('git',['remote','set-url','origin','https://github.com/seanmason/board-game-ai.git'],{cwd:evidence});assert.throws(()=>execFileSync(python,['-X','utf8',...args],{encoding:'utf8',stdio:'pipe',timeout:30000}),/non-development repository/);
  execFileSync('git',['remote','set-url','origin','https://github.com/seanmason/board-game-ai-dev.git'],{cwd:evidence});execFileSync('git',['config','remote.origin.pushurl','https://github.com/seanmason/board-game-ai.git'],{cwd:evidence});assert.throws(()=>execFileSync(python,['-X','utf8',...args],{encoding:'utf8',stdio:'pipe',timeout:30000}),/non-development repository push URL/);
  execFileSync('git',['config','--unset','remote.origin.pushurl'],{cwd:evidence});manifest.status='complete';delete manifest.stopReason;json(join(runtime,'manifest.json'),manifest);assert.throws(()=>execFileSync(python,['-X','utf8',...args],{encoding:'utf8',stdio:'pipe',timeout:30000}),/Terminal analysis has not completed/);
 }finally{assert.ok(base.startsWith(tmpdir())&&base.includes('wingspan-selfplay-publish-'));rmSync(base,{recursive:true,force:true});}
});
