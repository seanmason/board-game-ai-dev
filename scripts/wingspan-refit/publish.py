"""Publish explicitly allowlisted teacher-refit aggregates to development evidence."""
from __future__ import annotations
import argparse
from collections import defaultdict
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import subprocess
import time

BRANCH = 'benchmarks/wingspan-refit-2026-10-19'
DESTINATION = 'wingspan-refit'
ORIGINS = {'https://github.com/seanmason/board-game-ai-dev.git', 'https://github.com/seanmason/board-game-ai-dev', 'git@github.com:seanmason/board-game-ai-dev.git'}
TERMINAL = {'complete', 'stopped', 'failed', 'deadline'}
STATUSES = TERMINAL | {'prepared', 'running', 'pending', 'waiting', 'finished'}
RECIPES = ['control','value-only','gentle','gentle-value']
FIT_STAGES = ['f0-'+r for r in RECIPES] + ['f1']
STAGES = set(FIT_STAGES + ['s0-'+r for r in RECIPES] + ['c0','collect-1','s1','c1','analysis'])
spec = importlib.util.spec_from_file_location('compact_evidence_helpers', Path(__file__).resolve().parents[1]/'wingspan-selfplay'/'publish.py')
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)

def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))

def guarded(path, base=None):
    """Reject links/junctions before resolving; also check every existing ancestor."""
    path = Path(path).absolute()
    for part in [path, *path.parents]:
        if part.is_symlink() or getattr(part, 'is_junction', lambda: False)():
            raise ValueError('Symlink/junction publication path rejected')
    resolved = path.resolve()
    if base is not None and not resolved.is_relative_to(Path(base).resolve()):
        raise ValueError('Publication path escapes scope')
    return resolved

def atomic(path, value):
    path = guarded(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = guarded(path.with_name(path.name+'.publisher.tmp'))
    temp.write_text(json.dumps(value,indent=2,allow_nan=False)+'\n',encoding='utf-8')
    temp.replace(path)

def number(v):
    return isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v)

def numbers(v, keys):
    return {k:v[k] for k in keys if isinstance(v,dict) and number(v.get(k))}

def booleans(v, keys):
    return {k:v[k] for k in keys if isinstance(v,dict) and isinstance(v.get(k),bool)}

def token(v):
    return v if isinstance(v,str) and re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9/_ .-]{0,159}',v) and '..' not in v and not v.startswith('/') else None

def hashes(v):
    result={}
    for k,h in (v if isinstance(v,dict) else {}).items():
        key=str(k).replace('\\','/')
        name=key if token(key) and not re.match(r'^[A-Za-z]:/',key) else Path(key).name+'-'+hashlib.sha256(key.encode()).hexdigest()[:12]
        if token(name) and isinstance(h,str) and re.fullmatch(r'[a-fA-F0-9]{64}',h): result[name]=h
    return result

def fixed_ready(manifest, stage, matchup):
    expected=100 if stage in ['c0','c1'] else 40 if stage=='s1' or stage.startswith('s0-') else None
    entry=manifest.get('stages',{}).get(stage,{})
    if not expected or entry.get('status')!='complete': return False
    records=entry.get('result',{}).get('records',entry.get('result',{}).get('results',[]))
    if not isinstance(records,list): return False
    selected=[r for r in records if r.get('task',{}).get('matchup')==matchup]
    if len(selected)!=2*expected: return False
    pairs=defaultdict(list)
    for row in selected:
        task=row.get('task',{}); result=row.get('result',{})
        if result.get('status')!='complete' or result.get('validation',{}).get('valid') is not True or row.get('validation',result.get('validation',{})).get('valid') is not True: return False
        if result.get('errors') or result.get('illegalActions') or task.get('seat') not in [0,1] or not isinstance(task.get('seed'),int): return False
        pairs[task['seed']].append(task['seat'])
    return len(pairs)==expected and all(sorted(seats)==[0,1] for seats in pairs.values())

def clean_interval(v):
    return numbers(v,['n','mean','low','high','lowerBound'])

def clean_dashboard(dash, manifest):
    if dash.get('schema')!=1 or dash.get('study')!='wingspan-refit': raise ValueError('Unexpected dashboard schema/study')
    if dash.get('outcomeStatus')!=manifest.get('status'): raise ValueError('Controller changed during snapshot')
    result={'schema':1,'study':'wingspan-refit','outcomeStatus':manifest['status']}
    for k in ['status','stage']:
        if token(dash.get(k)): result[k]=dash[k]
    if isinstance(dash.get('updatedAt'),str) and re.fullmatch(r'[0-9T:.+Z-]{10,40}',dash['updatedAt']): result['updatedAt']=dash['updatedAt']
    revision=manifest.get('config',{}).get('sourceRevision')
    if isinstance(revision,str) and re.fullmatch(r'[a-fA-F0-9]{40}',revision):result['revision']=revision
    result['method']='Fixed small network teacher refits: two learning rates crossed with auxiliary loss on/off. Development selects at most two distinct candidates; fresh parent comparisons decide research teacher updates. Production is unchanged.'
    result.update(numbers(dash,['finished','planned','startedAt','deadlineEpochMs','elapsedMs','remainingMs','workers']))
    result.update(booleans(dash,['productionPromotion','equalComputeClaimAllowed']))
    result['collectionBudget']=numbers(dash.get('collectionBudget'),['targetPoolMs','baselineGroups','hybridGroups','baselinePoolWallMs','hybridPoolWallMs','actualRatio'])
    result['collectionBudget'].update(booleans(dash.get('collectionBudget'),['equalComputeClaimAllowed']))
    result['fitCosts']=numbers(dash.get('fitCosts'),['baselineWallMs','hybridWallMs'])
    result['rows']=[]
    for row in dash.get('rows',[]):
        if not isinstance(row,dict): continue
        r={k:row[k] for k in ['matchup','policy','policyId','opponentPolicyId','metricKind','stage','comparison','candidateModelId','opponentModelId'] if token(row.get(k))}
        r['modelHashes']=hashes(row.get('modelHashes'))
        r.update(game='wingspan',players=2,scope='Two-player research; complete fixed pairs required for strength results')
        if row.get('status') in STATUSES: r['status']=row['status']
        r.update(numbers(row,['planned','finished','seedGroups','completeSeedGroups','meanDecisionMs','maxDecisionMs']))
        r['counts']=numbers(row.get('counts'),['complete','capped','invalid','unresolved','illegal','error'])
        r['latency']=numbers(row.get('latency'),['n','meanMs','p95Ms','p99Ms','maxMs'])
        r['budget']=numbers(row.get('budget'),['timeMs','horizon','samples','cheapProbability','cheapDecisionProbability','opponentSamples'])
        budget=row.get('budget') or {}
        if isinstance(budget.get('decisionSamples'),str) and re.fullmatch(r'[0-9% /,;:.()+-]{1,96}',budget['decisionSamples']):r['budget']['decisionSamples']=budget['decisionSamples']
        if isinstance(budget.get('horizonConvention'),str):r['budget']['horizonConvention']='Searched horizon counts subsequent main actions; cheap one-step counts the root action only.'
        r['coverage']=numbers(row.get('coverage'),['decisions','iterations','roots','unvisited','learnedLeafCount','learnedFallbackCount','errors','cheapDecisions','searchedDecisions','oneStepEvaluations'])
        key=row.get('matchup',''); stage=row.get('stage') or key.split('/')[0]; matchup=row.get('comparison') or '/'.join(key.split('/')[1:])
        ready=row.get('inferenceComplete') is True and fixed_ready(manifest,stage,matchup)
        r['inferenceComplete']=ready; r['outcomesWithheld']=not ready
        if ready:
            r['winShare']=clean_interval(row.get('winShare')); r['margin']=clean_interval(row.get('margin'))
        else:
            r['winShare']={'n':0,'mean':None,'low':None,'high':None}; r['margin']=dict(r['winShare'])
        training=row.get('training',{})
        if isinstance(training,dict):
            r['training']={k:helpers.metrics(training[k]) for k in ['dev','epochZero','linear','reference','selected'] if isinstance(training.get(k),dict)}
            r['training']['latestFit']=numbers(training.get('latestFit'),['seed','epoch','devValueHuber'])
            r['training']['curves']=[numbers(x,['epoch','trainHuber','devValueHuber']) for x in training.get('curves',[])[:25] if isinstance(x,dict)]
            r['training'].update(numbers(training,['selectedEpoch']))
            r['training'].update(booleans(training,['eligible','parityPassed']))
        result['rows'].append(r)
    return result

def clean_comparisons(value,manifest,stage):
    result={'comparisons':{}}
    for name,c in (value or {}).get('comparisons',{}).items():
        if name not in ['parent']: continue
        ready=fixed_ready(manifest,stage,name)
        clean=numbers(c,['pairs']);clean['outcomesWithheld']=not ready
        if ready:
            clean.update(numbers(c,['winShare','lowerWinnerShare','meanMargin']))
            clean.update(booleans(c,['valid','latencyValid','passed']))
            clean['latency']=numbers(c.get('latency'),['meanMs','p95Ms','p99Ms','maxMs','opponentMeanMs','opponentP95Ms'])
        result['comparisons'][name]=clean
    if result['comparisons'] and all(not c['outcomesWithheld'] for c in result['comparisons'].values()):
        result.update(booleans(value,['passed']))
    return result

def public_manifest(m):
    result={'schema':1,'protocol':'wingspan-refit-v1','status':m['status']}
    result.update(numbers(m,['createdAt','startedAt','deadlineEpochMs','finishedAt','failedAt']))
    result.update(booleans(m,['productionPromotion','equalComputeClaimAllowed']))
    # Avoid publishing arbitrary error/stop prose that may embed paths or private records.
    if m.get('stopReason'): result['stopReason']='Controller recorded a terminal stop reason; see reviewed report.'
    config=m.get('config',{})
    result['workers']=config.get('workers') if number(config.get('workers')) else None
    revision=config.get('sourceRevision')
    if isinstance(revision,str) and re.fullmatch(r'[a-fA-F0-9]{40}',revision): result['sourceRevision']=revision
    result['sourceHashes']=hashes(config.get('frozenHashes')); result['modelHashes']=hashes(config.get('modelHashes'))
    result['allocation']={}
    allocation=m.get('allocation') or {}
    for key in ['counts','ratesMsPerGroup','estimatedPoolMs']:
        result['allocation'][key]=numbers(allocation.get(key),['baseline','hybrid'])
    result['allocation'].update(numbers(allocation,['targetPoolMs','reserveMs','workers']))
    result['allocation'].update(booleans(allocation,['outcomeBlind','frozen']))
    result['computeMatch']=numbers(m.get('computeMatch'),['hybridBaselineRatio','relativeDifference'])
    result['computeMatch'].update(booleans(m.get('computeMatch'),['passed','equalComputeClaimAllowed']))
    result['stages']={}
    for key,e in m.get('stages',{}).items():
        if key not in STAGES: raise ValueError('Unexpected stage name')
        r=numbers(e,['startedAt','finishedAt','planned','phase'])
        if token(e.get('recipe')):r['recipe']=e['recipe']
        if e.get('kind') in ['train','screen','confirmation','collect']:r['kind']=e['kind']
        if e.get('status') in STATUSES:r['status']=e['status']
        if e.get('arm') in ['baseline','hybrid']:r['arm']=e['arm']
        v=e.get('result') or {}
        r['result']=numbers(v,['poolWallMs','gameCount','planned','fitWallMs','fitProcessCpuMicros','trainerWallMs','trainerProcessCpuMicros','selectedEpoch'])
        r['result'].update(booleans(v,['complete','eligible','parityPassed','normalizationFrozen']))
        r['result']['processCpuMicros']=numbers(v.get('processCpuMicros'),['user','system'])
        r['result']['modelHashes']=hashes(v.get('modelHashes'))
        for name in ['dev','reference','epochZero','linear']:
            if isinstance(v.get(name),dict):r['result'][name]=helpers.metrics(v[name])
        if isinstance(e.get('summary'),dict):r['comparisonSummary']=clean_comparisons(e['summary'],m,key)
        result['stages'][key]=r
    result['acceptedTeachers']=[]
    for teacher in m.get('accepted',[]):
        if not isinstance(teacher,dict):continue
        phase=teacher.get('phase');stage='c1' if phase==1 else 'c0'
        if not fixed_ready(m,stage,'parent') or teacher.get('confirmation',{}).get('passed') is not True:continue
        t={k:teacher[k] for k in ['candidate','recipe'] if token(teacher.get(k))}
        t.update(numbers(teacher,['phase','acceptedAt']))
        t['hashes']=hashes({k:teacher.get(k) for k in ['modelHash','inferenceHash']})
        records=m['stages'][stage]['result'].get('records',[])
        parent=records[0].get('task',{}).get('opponent',{}).get('modelId') if records else None
        if token(parent):t['parentModelId']=parent
        models={**config.get('modelHashes',{}),**{k:h for entry in m.get('stages',{}).values() for k,h in entry.get('result',{}).get('modelHashes',{}).items()}}
        t['parentHashes']=hashes({parent:models.get(parent)}) if token(parent) else {}
        t['confirmation']=clean_comparisons(teacher.get('confirmation'),m,stage)
        result['acceptedTeachers'].append(t)
    for stage in ['screen','confirmation']:
        if isinstance(m.get(stage),dict):result[stage]=clean_comparisons(m[stage],m,stage)
    return result

def terminal_ready(m):
    if m.get('status') not in TERMINAL:return False
    if m.get('stages',{}).get('analysis',{}).get('status')!='complete' and not m.get('stopReason'):
        raise ValueError('Terminal analysis/stop reason not persisted')
    return True

def snapshot(runtime,root,evidence,node,deadline):
    target=guarded(evidence/DESTINATION,evidence);target.mkdir(exist_ok=True)
    dashboard_path=guarded(runtime/'publisher-dashboard.json',runtime)
    script=guarded(root/'scripts/wingspan-refit/dashboard.mjs',root)
    subprocess.run([node,str(script),'--runtime='+str(runtime),'--out='+str(dashboard_path)],cwd=root,check=True,capture_output=True,
                   text=True,encoding='utf-8',timeout=min(60,max(.1,deadline-time.time())))
    m=read(guarded(runtime/'manifest.json',runtime)); terminal=terminal_ready(m)
    dash=clean_dashboard(read(dashboard_path),m);written=[]
    def put(rel,value):
        destination=guarded(target/rel,target);atomic(destination,value);written.append((Path(DESTINATION)/rel).as_posix())
    put('dashboard.json',dash);put('manifest.json',public_manifest(m))
    for stage in FIT_STAGES:
        if m.get('stages',{}).get(stage,{}).get('status')!='complete':continue
        for name in ['model.json','zero-model.json','epoch-zero.json','linear-model.json']:
            src=guarded(runtime/'stages'/stage/name,runtime)
            if src.is_file():
                if src.stat().st_size>16*1024**2:raise ValueError('Oversized model artifact')
                put(f'stages/{stage}/{name}',helpers.public_model(read(src)))
    lines=['# Wingspan teacher-refit evidence','',f"Controller status: **{m['status']}**. Completed displayed games: {dash.get('finished',0)} / {dash.get('planned',0)}.",'',
           '[Dashboard aggregates](dashboard.json) · [Public controller receipt](manifest.json) · [Frozen source](source.zip) · [Source inventory](source-manifest.json) · [Seed audit](seed-audit.json)','',
           'Conservative teacher refits at fixed network size. Auxiliary-head gradients and learning rate are tested on the same replay and development pool. One further self-play cycle is conditional on fresh confirmation. Outcomes remain hidden until each fixed valid seat-paired comparison completes. No automatic production promotion.','',
           'Only allowlisted aggregates and exported model weights are public. Raw games, observations, features, labels, task inventories, read-file receipts and local paths remain private.','']
    report=guarded(target/'REPORT.md',target);temp=guarded(target/'REPORT.md.publisher.tmp',target)
    temp.write_text('\n'.join(lines),encoding='utf-8');temp.replace(report);written.append(DESTINATION+'/REPORT.md')
    put('public-artifacts.json',{'schema':1,'files':{str(Path(p).relative_to(DESTINATION)).replace('\\','/'):
        {'sha256':hashlib.sha256(guarded(evidence/p,evidence).read_bytes()).hexdigest(),'bytes':guarded(evidence/p,evidence).stat().st_size} for p in written}})
    return dash,written,terminal

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ['runtime','root','evidence','node']:parser.add_argument('--'+name,required=True)
    parser.add_argument('--interval',type=float,default=90);parser.add_argument('--once',action='store_true');parser.add_argument('--no-git',action='store_true')
    args=parser.parse_args()
    runtime,root,evidence=[guarded(v) for v in [args.runtime,args.root,args.evidence]]
    paths=[runtime,root,evidence]
    if any(a==b or a.is_relative_to(b) or b.is_relative_to(a) for i,a in enumerate(paths) for b in paths[i+1:]):raise ValueError('Runtime/source/evidence must be separate directories')
    if not 1<=args.interval<=600:raise ValueError('Interval must be 1–600 seconds')
    m=read(guarded(runtime/'manifest.json',runtime));original_deadline=m.get('deadlineEpochMs')
    if not number(original_deadline):raise ValueError('Original runtime deadline required')
    deadline=original_deadline/1000+600
    def git(*argv):
        if time.time()>=deadline:raise TimeoutError('Original deadline plus ten-minute grace expired')
        p=subprocess.run(['git',*argv],cwd=evidence,capture_output=True,text=True,encoding='utf-8',errors='replace',
                         timeout=min(90,max(.1,deadline-time.time())))
        if p.returncode:raise RuntimeError('Evidence Git operation failed')
        return p.stdout.strip()
    def verify():
        if git('remote','get-url','origin') not in ORIGINS:raise ValueError('Development origin required')
        if any(url not in ORIGINS for url in git('remote','get-url','--push','--all','origin').splitlines()):raise ValueError('Development push origin required')
        if git('branch','--show-current')!=BRANCH:raise ValueError('Dedicated evidence branch required')
    verify()
    lock=guarded(runtime/'publisher.lock',runtime)
    with lock.open('x',encoding='utf-8') as handle:json.dump({'pid':os.getpid(),'deadlineEpochMs':original_deadline},handle)
    failures=0
    try:
        while True:
            try:
                m=read(guarded(runtime/'manifest.json',runtime))
                if m.get('deadlineEpochMs')!=original_deadline:raise ValueError('Original runtime deadline changed')
                verify();dash,written,terminal=snapshot(runtime,root,evidence,args.node,deadline);verify()
                if not args.no_git:
                    if any(p not in written for p in git('diff','--cached','--name-only').splitlines()):raise ValueError('Unrelated staged content')
                    git('add','--',*written)
                    if git('diff','--cached','--name-only'):git('-c','user.name=Codex','-c','user.email=codex@openai.com','commit','-m','Wingspan teacher-refit aggregate evidence')
                    git('push','origin','HEAD:refs/heads/'+BRANCH)
                atomic(runtime/'publish-status.json',{'schema':1,'at':datetime.now(timezone.utc).isoformat(),'success':True,
                    'outcomeStatus':m['status'],'terminal':terminal,'publicationConfirmed':not args.no_git,'gitEnabled':not args.no_git,
                    'consecutiveFailures':0,'deadlineEpochSeconds':deadline})
                failures=0
                if args.once or terminal and not args.no_git:return
            except Exception as error:
                failures+=1
                atomic(runtime/'publish-status.json',{'schema':1,'at':datetime.now(timezone.utc).isoformat(),'success':False,
                    'errorType':type(error).__name__,'consecutiveFailures':failures,'retryLimit':5})
                if args.once or failures>=5 or isinstance(error,TimeoutError):raise
            if time.time()>=deadline:raise TimeoutError('Publication grace expired')
            time.sleep(min(args.interval,max(0,deadline-time.time())))
    finally:
        lock.unlink()

if __name__=='__main__':main()
