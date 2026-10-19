"""Publish only compact self-play evidence to its dedicated development branch."""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import time

BRANCH = 'benchmarks/wingspan-selfplay-2026-10-19'
DESTINATION = 'wingspan-selfplay'
ORIGINS = {'https://github.com/seanmason/board-game-ai-dev.git', 'https://github.com/seanmason/board-game-ai-dev', 'git@github.com:seanmason/board-game-ai-dev.git'}
TERMINAL = {'complete','stopped','failed','finished','deadline'}

def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))

def atomic(path, data):
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix+'.tmp')
    temp.write_text(json.dumps(data, indent=2, allow_nan=False)+'\n', encoding='utf-8')
    temp.replace(path)

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def text(value):
    if not isinstance(value,str):
        return None
    return re.sub(r'(?:[A-Za-z]:[\\/]|/(?:Users|home|tmp)/|\\\\)[^\r\n]*','[local-path]',value)[:2000]

def numeric(value):
    if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value):
        raise ValueError('Invalid numeric model value')
    return value

def hash_map(values):
    return {(re.split(r'[\\/]',str(k))[-1] if re.match(r'^(?:[A-Za-z]:[\\/]|/|\\\\)',str(k)) else str(k).replace('\\','/')):v for k,v in (values or {}).items() if isinstance(v,str) and re.fullmatch(r'[a-fA-F0-9]{64}',v)}

def metrics(value):
    value=value if isinstance(value,dict) else {}
    return {k:value[k] for k in ['huber','mae','saturation','correctionMean','examples','games','setups'] if isinstance(value.get(k),(int,float)) and math.isfinite(value[k])}

def interval(value):
    return {k:value[k] for k in ['low','high','confidence','replicates','seed','independentGroups','method'] if k in (value or {}) and isinstance(value[k],(int,float,str))}

def comparisons(value):
    value=value or {}
    result={'passed':value.get('passed') is True,'comparisons':{}}
    for name,comparison in value.get('comparisons',{}).items():
        ready=comparison.get('valid') is True and comparison.get('pairs') in (40,100)
        fields=['pairs','valid','latencyValid','passed']+(['winShare','lowerWinnerShare','meanMargin'] if ready else [])
        clean={k:comparison[k] for k in fields if isinstance(comparison.get(k),(int,float,bool)) and math.isfinite(comparison[k])}
        clean['outcomesWithheld']=not ready
        clean['latency']={k:v for k,v in comparison.get('latency',{}).items() if k in ['meanMs','p95Ms','p99Ms','maxMs','opponentMeanMs','opponentP95Ms'] and isinstance(v,(int,float)) and math.isfinite(v)}
        result['comparisons'][text(name)]=clean
    return result

def summary(value):
    """Construct public fields, never recursively copy arbitrary record objects."""
    value=value or {}
    result={k:value[k] for k in ['schema','status','complete','valid','passed','eligible','selectedEpoch','optimizerReset','normalizationFrozen','parityPassed','productionPromotion','elapsedMs','tuningPermitted'] if isinstance(value.get(k),(bool,int,float,str))}
    for key in ['device','eligibilityMeaning','eligibilityCriterion','inference']:
        if key in value: result[key]=text(value[key])
    for key in ['dev','selected','epochZero','reference','zeroHead','linear']:
        if key in value: result[key]=metrics(value[key])
    result['hashes']=hash_map(value.get('hashes'))
    result['modelHashes']=hash_map(value.get('modelHashes'))
    if isinstance(value.get('records'),list):
        result['planned']=value.get('planned',len(value['records']))
        result['recordReceipts']=[]
        for record in value['records']:
            task=record.get('task',{});outcome=record.get('result',{})
            receipt={k:task[k] for k in ['seed','seat','generation'] if isinstance(task.get(k),int)}
            for k in ['id','split','matchup','kind']:
                if k in task: receipt[k]=text(task[k])
            receipt.update(status=text(outcome.get('status')),valid=(record.get('validation') or outcome.get('validation') or {}).get('valid') is True)
            for k in ['elapsedMs','exampleCount']:
                if isinstance(record.get(k),(int,float)) and math.isfinite(record[k]): receipt[k]=record[k]
            if re.fullmatch(r'[a-fA-F0-9]{64}',str(record.get('rawSha256',''))): receipt['rawSha256']=record['rawSha256']
            result['recordReceipts'].append(receipt)
    result['config']={k:v for k,v in value.get('config',{}).items() if k in ['seed','epochs','patience','batchSize','learningRate','weightDecay','auxiliaryWeight','auxiliaryScale','ridgeAlpha','cpuThreads','gpuBytes'] and isinstance(v,(int,float)) and math.isfinite(v)}
    for key in ['modelSha256','linearSha256','manifestSha256','trainingManifestSha256','trainerSha256','warmStartSha256']:
        if re.fullmatch(r'[a-fA-F0-9]{64}',str(value.get(key,''))): result[key]=value[key]
    for key in ['devGroupMaeInterval','groupMaeInterval']:
        if key in value: result[key]=interval(value[key])
    result['history']=[dict(epoch=h.get('epoch'),trainHuber=h.get('trainHuber'),dev=metrics(h.get('dev'))) for h in value.get('history',[]) if isinstance(h,dict)]
    result['strata']={key:{text(name):metrics(m) for name,m in values.items() if isinstance(m,dict)} for key,values in value.get('strata',{}).items() if key in ['generation','round','viewer','engineActivity'] and isinstance(values,dict)}
    # Aggregate latency/coverage retain unfavorable tails/errors without raw decisions.
    result['latency']={k:v for k,v in value.get('latency',{}).items() if k in ['meanMs','p95Ms','p99Ms','maxMs','opponentMeanMs','opponentP95Ms'] and isinstance(v,(float,int)) and math.isfinite(v)}
    return result

def public_manifest(manifest):
    result={k:manifest[k] for k in ['schema','protocol','status','createdAt','startedAt','deadlineEpochMs','finishedAt','failedAt','workers','cycles','generation','stagnation','productionPromotion'] if k in manifest}
    for k in ['champion','stopReason','revision','sourceRevision']:
        if k in manifest: result[k]=text(manifest[k])
    result['frozenHashes']=hash_map(manifest.get('frozenHashes'))
    result['stages']={}
    for key,entry in manifest.get('stages',{}).items():
        if not re.fullmatch(r'[a-z][a-z0-9-]*',key): raise ValueError('Unsafe stage name')
        result['stages'][key]={k:entry[k] for k in ['kind','status','startedAt','finishedAt','contextHash','planned'] if k in entry}
        if entry.get('error'): result['stages'][key]['error']=text(entry['error'])
        result['stages'][key]['result']=summary(entry.get('result'))
        if entry.get('summary'): result['stages'][key]['summary']=comparisons(entry['summary'])
    if manifest.get('confirmation'): result['confirmation']=comparisons(manifest['confirmation'])
    if manifest.get('finalFreeze'):
        f=manifest['finalFreeze']; result['finalFreeze']={k:f[k] for k in ['generation','frozenAt','hash'] if k in f}
        result['finalFreeze']['candidate']=text(f.get('candidate'))
        result['finalFreeze']['modelHashes']=hash_map(f.get('modelHashes'))
    return result

def public_model(value):
    if value.get('featureVersion')!='wingspan-compact-v1': raise ValueError('Unexpected public model schema')
    norm=value.get('normalization',{})
    result={'featureVersion':value['featureVersion'],'normalization':{k:[numeric(v) for v in norm[k]] for k in ['mean','scale']}}
    if len(result['normalization']['mean'])!=192 or len(result['normalization']['scale'])!=192: raise ValueError('Model normalization shape')
    if 'coefficients' in value:
        if len(value['coefficients'])!=193: raise ValueError('Linear coefficient shape')
        result.update(coefficients=[numeric(x) for x in value['coefficients']],residualScale=10,outputActivation='tanh')
    else:
        names=value.get('featureNames')
        if not isinstance(names,list) or len(names)!=192 or not all(isinstance(n,str) and not re.search(r'(^/|[A-Za-z]:[\\/])',n) for n in names): raise ValueError('Feature name shape')
        result.update(version=1,featureNames=names,id=text(value.get('id')),outputKind='reference-residual',residualScale=10,layers=[])
        if len(value.get('layers',[]))!=3: raise ValueError('Layer count')
        for layer,(n,m,activation) in zip(value['layers'],[(192,32,'relu'),(32,16,'relu'),(16,1,'linear')]):
            if (layer.get('in'),layer.get('out'),layer.get('activation'))!=(n,m,activation) or len(layer.get('weights',[]))!=n*m or len(layer.get('bias',[]))!=m: raise ValueError('Layer shape')
            result['layers'].append({'in':n,'out':m,'activation':activation,'weights':[numeric(x) for x in layer['weights']],'bias':[numeric(x) for x in layer['bias']]})
    return result

def report(dash):
    lines=['# Wingspan compact self-play evidence','',f"Status: **{dash['status']}** ({dash.get('outcomeStatus')}); stage **{dash['stage']}**.",f"Snapshot: {dash['updatedAt']}. Actual games completed: {dash['finished']} / {dash['planned']} across displayed stages.",'']
    if dash.get('stopReason'): lines += ['Stop reason: '+dash['stopReason'],'']
    lines += ['A finished snapshot may reflect an early stop; it does not imply all proposed cycles ran. Collection and offline prediction losses are not playing-strength evidence. Production promotion remains separate.','', '[Dashboard](dashboard.json) · [Public controller receipt](manifest.json)','', '| Comparison | Valid / scheduled | Complete pairs | Winner share | Margin |','| --- | ---: | ---: | ---: | ---: |']
    for row in dash['rows']:
        if row['metricKind']!='win-share': continue
        share=row['winShare']; margin=row['margin']
        display=lambda v:'—' if v is None else f'{v:.4f}'
        lines.append(f"| {row['matchup']} | {row['counts']['complete']} / {row['planned']} | {row['completeSeedGroups']} / {row['seedGroups']} | {display(share['mean'])} [{display(share['low'])}, {display(share['high'])}] | {display(margin['mean'])} [{display(margin['low'])}, {display(margin['high'])}] |")
    lines += ['', 'Intervals and winner shares stay hidden until the fixed scheduled comparison is complete with valid seat pairs. Unfavorable, invalid, capped and partial outcomes remain in aggregate counts. Requested whole-decision time is a soft bound; see latency mean, p95, p99 and maximum in dashboard rows.','', 'Only allowlisted aggregate receipts and exported model weights are public. Raw games, observations, sealed audit records, task inventories, optimizer files and local paths are excluded. No independent human-strength, calibrated-win-probability or device acceptance claim is made.','']
    return '\n'.join(lines)

def snapshot(runtime, root, evidence, node, deadline=None):
    target=evidence/DESTINATION
    if target.is_symlink(): raise ValueError('Evidence target must not be a symlink')
    target.mkdir(exist_ok=True)
    dashboard_path=runtime/'public-dashboard.json'
    subprocess.run([node,str(root/'scripts/wingspan-selfplay/dashboard.mjs'),'--runtime='+str(runtime),'--out='+str(dashboard_path)],cwd=root,check=True,capture_output=True,text=True,encoding='utf-8',timeout=min(60,max(.1,deadline-time.time())) if deadline else 60)
    dash=read(dashboard_path); manifest=read(runtime/'manifest.json')
    if dash.get('outcomeStatus')!=manifest.get('status'): raise ValueError('Controller changed during snapshot; retry fresh state')
    if manifest.get('status') in TERMINAL:
        if manifest['status']=='complete' and manifest.get('stages',{}).get('analysis',{}).get('status')!='complete': raise ValueError('Terminal analysis has not completed')
        if manifest['status'] in ['stopped','failed','deadline'] and not manifest.get('stopReason'): raise ValueError('Terminal stop reason is not saved')
    written=[]
    def put(rel,value):
        destination=target/rel
        if not destination.resolve().is_relative_to(target.resolve()) or destination.is_symlink(): raise ValueError('Evidence symlink escapes scope')
        atomic(destination,value);written.append((Path(DESTINATION)/rel).as_posix())
    put('dashboard.json',dash);put('manifest.json',public_manifest(manifest))
    for key,entry in manifest.get('stages',{}).items():
        if not re.fullmatch(r'[a-z][a-z0-9-]*',key): raise ValueError('Unsafe stage name')
        if entry.get('result') is not None:
            receipt=summary(entry['result'])
            if entry.get('summary'): receipt['decision']=comparisons(entry['summary'])
            put(f'stages/{key}/summary.json',receipt)
        if entry.get('kind')=='train' or re.fullmatch(r'train-\d+',key):
            for name in ['model.json','zero-model.json','epoch-zero.json','linear-model.json']:
                src=runtime/'stages'/key/name
                if src.is_file():
                    if not src.resolve().is_relative_to(runtime) or src.stat().st_size>16*1024**2: raise ValueError('Unsafe or oversized model artifact')
                    original=read(src);checked=public_model(original)
                    put(f'stages/{key}/{name}',original if original==checked else checked)
    (target/'REPORT.md').write_text(report(dash),encoding='utf-8');written.append(DESTINATION+'/REPORT.md')
    put('public-artifacts.json',{'schema':1,'files':{str(Path(p).relative_to(DESTINATION)).replace('\\','/'):{'sha256':sha(evidence/p),'bytes':(evidence/p).stat().st_size} for p in written}})
    return dash,written

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ['runtime','root','evidence','node']: parser.add_argument('--'+name,required=True)
    parser.add_argument('--once',action='store_true');parser.add_argument('--interval',type=float,default=90)
    parser.add_argument('--no-git',action='store_true',help='Build a local review snapshot; still verifies destination repository and branch')
    args=parser.parse_args()
    runtime,root,evidence=[Path(v).resolve() for v in [args.runtime,args.root,args.evidence]]
    if runtime==evidence or evidence==root or runtime.is_relative_to(evidence) or evidence.is_relative_to(runtime): raise ValueError('Use distinct runtime, source and evidence directories')
    if not 1<=args.interval<=600: raise ValueError('Publication interval must be 1–600 seconds')
    fallback_deadline=time.time()+6*3600+600
    deadline=fallback_deadline
    def git(*argv):
        if time.time()>=deadline: raise TimeoutError('Publisher campaign deadline plus ten-minute grace expired')
        result=subprocess.run(['git',*argv],cwd=evidence,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=min(90,max(.1,deadline-time.time())))
        if result.returncode: raise RuntimeError(result.stderr.strip() or result.stdout.strip())
        return result.stdout.strip()
    def verify():
        if git('remote','get-url','origin') not in ORIGINS: raise ValueError('Refusing non-development repository origin')
        if any(url not in ORIGINS for url in git('remote','get-url','--push','--all','origin').splitlines()): raise ValueError('Refusing non-development repository push URL')
        if git('branch','--show-current')!=BRANCH: raise ValueError('Refusing another evidence branch')
    failures=0
    while True:
        try:
            manifest=read(runtime/'manifest.json')
            deadline=(manifest.get('deadlineEpochMs') or fallback_deadline*1000)/1000+ (600 if manifest.get('deadlineEpochMs') else 0)
            if time.time()>=deadline: raise TimeoutError('Publisher campaign deadline plus ten-minute grace expired')
            verify()
            dash,written=snapshot(runtime,root,evidence,args.node,deadline)
            verify()
            if not args.no_git:
                staged=git('diff','--cached','--name-only').splitlines()
                if any(p not in written for p in staged): raise ValueError('Unrelated staged content; refusing commit')
                git('add','--',*written)
                if git('diff','--cached','--name-only'):
                    git('-c','user.name=Codex','-c','user.email=codex@openai.com','commit','-m',f"Wingspan self-play evidence: {dash['stage']} {dash['finished']} games")
                git('push','origin','HEAD:refs/heads/'+BRANCH)
            atomic(runtime/'publish-status.json',{'schema':1,'at':datetime.now(timezone.utc).isoformat(),'success':True,'status':dash['status'],'outcomeStatus':dash.get('outcomeStatus'),'stage':dash['stage'],'finished':dash['finished'],'gitEnabled':not args.no_git,'consecutiveFailures':0,'deadlineEpochSeconds':deadline})
            failures=0
            if args.once or dash.get('outcomeStatus') in TERMINAL: return
        except Exception as error:
            failures+=1
            atomic(runtime/'publish-status.json',{'schema':1,'at':datetime.now(timezone.utc).isoformat(),'success':False,'error':str(error),'consecutiveFailures':failures,'retryLimit':5})
            if args.once or failures>=5 or isinstance(error,TimeoutError): raise
        try: manifest=read(runtime/'manifest.json')
        except (FileNotFoundError,json.JSONDecodeError): manifest={}
        deadline=(manifest.get('deadlineEpochMs')/1000+600) if manifest.get('deadlineEpochMs') else fallback_deadline
        if time.time()>=deadline: return
        time.sleep(min(args.interval,max(0,deadline-time.time())))

if __name__=='__main__': main()
