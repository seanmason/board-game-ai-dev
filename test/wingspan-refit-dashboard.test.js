import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {buildRefitDashboard} from '../scripts/wingspan-refit/dashboard.mjs';
const row=(seed,seat)=>({task:{id:`g/${seed}/${seat}`,seed,seat,matchup:'parent',candidate:{modelId:'new'},opponent:{modelId:'parent'}},validation:{valid:true},result:{status:'complete',validation:{valid:true},winShare:seat,margin:seat?2:-2,decisionTimes:{candidate:[1000],opponent:[1000]},diagnostics:{candidate:{errors:0,illegalActions:0}},errors:0,illegalActions:0}});
test('refit fits are not games and partial fixed comparisons remain closed',()=>{const manifest={status:'running',config:{sourceRevision:'a'.repeat(40),modelHashes:{parent:'b'.repeat(64)}},stages:{'f0-gentle':{kind:'train',phase:0,recipe:'gentle',status:'complete',result:{config:{epochs:24},selectedEpoch:1,history:[{epoch:0,dev:{huber:.4}},{epoch:1,dev:{huber:.3}}]}},'s0-gentle':{kind:'screen',recipe:'gentle',planned:80,status:'running',result:{records:[row(1,0)]}}}};let d=buildRefitDashboard({manifest,progressByStage:{'s0-gentle':{completed:1,total:80,active:Array.from({length:28},(_,i)=>({id:String(i)}))}}});assert.equal(d.workers,28);assert.equal(d.finished,1);const screen=d.rows.find(r=>r.stage==='s0-gentle');assert.equal(screen.winShare.mean,null);assert.equal(screen.candidateModelId,'new');assert.equal(d.rows[0].policyId,'Phase 0 gentle fit');manifest.status='complete';manifest.stages['s0-gentle']={...manifest.stages['s0-gentle'],status:'complete',result:{records:Array.from({length:40},(_,i)=>[row(i,0),row(i,1)]).flat()}};d=buildRefitDashboard({manifest});assert.equal(d.finished,80);assert.equal(d.workers,0);assert.equal(d.rows.find(r=>r.stage==='s0-gentle').winShare.mean,.5);});
test('refit publisher retains complete parent gates and hashes while excluding paths and partial outcomes',()=>{const py=String.raw`
import importlib.util,json
from pathlib import Path
p=Path('scripts/wingspan-refit/publish.py');s=importlib.util.spec_from_file_location('publish_refit',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
def game(i,seat): return {'task':{'seed':i,'seat':seat,'matchup':'parent'},'validation':{'valid':True},'result':{'status':'complete','validation':{'valid':True},'errors':0,'illegalActions':0}}
records=[game(i,s) for i in range(40) for s in [0,1]]
summary={'comparisons':{'parent':{'pairs':40,'winShare':.6,'lowerWinnerShare':.51,'meanMargin':2,'passed':True,'latencyValid':True,'valid':True,'latency':{'meanMs':1000,'opponentMeanMs':1001}}},'passed':True}
manifest={'status':'running','config':{'sourceRevision':'a'*40},'stages':{'s0-gentle':{'status':'complete','result':{'records':records},'summary':summary}},'accepted':[]}
d={'schema':1,'study':'wingspan-refit','outcomeStatus':'running','rows':[{'matchup':'s0-gentle/parent','stage':'s0-gentle','comparison':'parent','inferenceComplete':True,'modelHashes':{'new':'b'*64},'candidateModelId':'new','opponentModelId':'parent','winShare':{'n':40,'mean':.6,'low':.5,'high':.7},'margin':{'mean':2},'scope':'SECRET','rawObservations':['SECRET']}],'raw':'SECRET'}
c=m.clean_dashboard(d,manifest);assert c['revision']=='a'*40;assert c['rows'][0]['modelHashes']['new']=='b'*64;assert c['rows'][0]['winShare']['mean']==.6;assert 'SECRET' not in json.dumps(c)
pub=m.public_manifest(manifest);assert pub['stages']['s0-gentle']['comparisonSummary']['comparisons']['parent']['passed'] is True
manifest['stages']['s0-gentle']['result']['records']=records[:-1]
c=m.clean_dashboard(d,manifest);assert c['rows'][0]['winShare']['mean'] is None
pub=m.public_manifest(manifest);assert pub['stages']['s0-gentle']['comparisonSummary']['comparisons']['parent']['outcomesWithheld'] is True
assert m.fixed_ready(manifest,'c0','parent') is False
print('passed')
`;const result=spawnSync('python',['-X','utf8','-c',py],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/passed/);});
