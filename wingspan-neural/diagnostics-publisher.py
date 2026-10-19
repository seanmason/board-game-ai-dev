"""External diagnostics-only evidence publisher; never launches training or games.
Waits for the fixed pilot AND its publisher to finish before evidence mutation.
--runtime ROOT --repo EVIDENCE --source SOURCE --once|--deadline UNIX [--no-git]
"""
from pathlib import Path
from datetime import datetime,timezone
import argparse,ctypes,hashlib,importlib.util,json,math,os,re,shutil,subprocess,time
BRANCH='benchmarks/wingspan-neural-2026-10-19'
DEST='wingspan-neural'
START='<!-- neural-diagnostics:start -->'
END='<!-- neural-diagnostics:end -->'
ALLOW=[
 'diagnostics-progress.json','diagnostics-publisher.py','diagnostics-publisher-tests.py','control-independent-review.json',
 'followups.py','diagnostics-launch.json','diagnostics-result.json','diagnostics-failure.json','supervisor-tests/followups-tests.py',
 'independent-review/canary-inference-accounting.json',
 'independent-review/train-feature-inventory.json',
 *['feature-capacity-probe/'+f for f in ['plan.json','probe.py','inventory-tests.py','execution-receipt.json','report.json','failure.json','tests-preparation.json']],
 *['constant-control/'+f for f in ['plan.json','prepared.json','frozen-readiness.json','protocol.md','seed-audit.json','execution-seed-audit.json','execution-receipt.json','tests-preparation.json','tests-execution.json','analysis.json','checkpoint.json','failure.json','control.mjs','support.mjs','worker.mjs','tests.mjs']]
]
def read(p,default=None):
 try:return json.loads(Path(p).read_text(encoding='utf-8'))
 except (FileNotFoundError,json.JSONDecodeError):return default

def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def atomic(p,value):
 p=Path(p);p.parent.mkdir(parents=True,exist_ok=True);tmp=p.with_suffix(p.suffix+'.tmp');tmp.write_text(json.dumps(value,indent=2,allow_nan=False)+'\n',encoding='utf-8')
 for i in range(9):
  try:os.replace(tmp,p);return
  except PermissionError:
   if i==8:raise
   time.sleep(.025*2**i)

def process_alive(pid):
 if not isinstance(pid,int) or pid<=0:return False
 if os.name=='nt':
  k=ctypes.windll.kernel32;k.OpenProcess.argtypes=[ctypes.c_uint32,ctypes.c_int,ctypes.c_uint32];k.OpenProcess.restype=ctypes.c_void_p;k.GetExitCodeProcess.argtypes=[ctypes.c_void_p,ctypes.POINTER(ctypes.c_uint32)];k.CloseHandle.argtypes=[ctypes.c_void_p]
  handle=k.OpenProcess(0x1000,False,pid)
  if not handle:return k.GetLastError()==5
  try:
   code=ctypes.c_uint32();return not k.GetExitCodeProcess(handle,ctypes.byref(code)) or code.value==259
  finally:k.CloseHandle(handle)
 try:os.kill(pid,0);return True
 except ProcessLookupError:return False
 except PermissionError:return True

def publisher_ready(runtime,alive=process_alive):
 progress=read(runtime/'progress.json',{});result=read(runtime/'pilot-result.json',{});publication=read(runtime/'publication-status.json',{});receipt=read(runtime/'publisher-process.json',{})
 if progress.get('status')!='finished' or result.get('status')!='finished':return False,'fixed pilot not finished'
 if not publication.get('success') or publication.get('stage')!='complete':return False,'original publisher final success not recorded'
 if not isinstance(receipt.get('pid'),int):return False,'original publisher process receipt missing'
 if alive(receipt['pid']):return False,'original publisher still alive; shared worktree untouched'
 return True,'original pilot and publisher finished'

def allowlist(runtime):
 files=list(ALLOW);plan=read(runtime/'feature-capacity-probe/plan.json',{})
 for cell in plan.get('cells',[]):
  key=cell.get('id','')
  if not re.fullmatch('[A-Za-z0-9_-]+',key):raise ValueError('Unsafe capacity cell id')
  files.extend('feature-capacity-probe/cells/'+key+'/'+f for f in ['dev-report.json','loss-curves.json'])
 return files

def strict_control(runtime):
 base=runtime/'constant-control';a=read(base/'analysis.json',{});p=read(base/'plan.json',{});prepared=read(base/'prepared.json',{});receipt=read(base/'execution-receipt.json',{})
 issues=[]
 if not(a.get('complete') is True and a.get('status')=='finished' and a.get('planned')==64 and a.get('received')==64 and a.get('valid')==64 and a.get('independentPairs')==32 and a.get('issues')==[] and a.get('missing')==[]):issues.append('not-64-valid-32-pair-strict-complete')
 tasks=p.get('tasks',[]);seeds={t.get('seed') for t in tasks};pairs=a.get('pairs',[])
 cp=read(base/'checkpoint.json',{})
 if cp.get('status')!='finished' or cp.get('finished')!=64 or cp.get('planned')!=64:issues.append('unfinished-checkpoint')
 if len({t.get('id') for t in tasks})!=64 or any(len([t for t in tasks if t.get('seed')==seed])!=2 or {t.get('seat') for t in tasks if t.get('seed')==seed}!={0,1} for seed in seeds):issues.append('task-design')
 if len(tasks)!=64 or len(seeds)!=32 or len(pairs)!=32 or {x.get('seed') for x in pairs}!=seeds or len({x.get('seed') for x in pairs})!=32:issues.append('pair-design')
 for key,field in [('realModelWinnerShare','share'),('realModelScoreMargin','margin')]:
  stat=a.get(key,{})
  values=[x.get(field) for x in pairs]
  if stat.get('n')!=32 or len(values)!=32 or any(not isinstance(v,(int,float)) or not math.isfinite(v) for v in values) or not isinstance(stat.get('mean'),(int,float)) or abs(sum(values)/32-stat.get('mean',0))>1e-9:issues.append('summary-'+key)
 if any(x.get('share') not in [0,.25,.5,.75,1] for x in pairs):issues.append('pair-share-bounds')
 for key in ['realModelWinnerShare','realModelScoreMargin']:
  stat=a.get(key,{});ci=stat.get('ci95')
  if key=='realModelScoreMargin' and ci is None and stat.get('degenerate') is True and len(pairs)==32 and all(x.get('margin')==stat.get('mean') for x in pairs):continue
  if not isinstance(ci,list) or len(ci)!=2 or any(not isinstance(v,(int,float)) or not math.isfinite(v) for v in ci) or not isinstance(stat.get('mean'),(int,float)) or not(ci[0]<=stat.get('mean',0)<=ci[1]):issues.append('invalid-interval-'+key)
 hashes=p.get('modelHashes')
 if not hashes or set(hashes)!= {'neural','linear'} or hashes.get('neural')!=p.get('sourceRealModelSha256') or a.get('modelHashes')!=hashes or prepared.get('modelHashes')!=hashes or receipt.get('modelHashes')!=hashes:issues.append('model-hash-mismatch')
 try:
  plan_sha=sha(base/'plan.json')
  if prepared.get('planSha256')!=plan_sha or receipt.get('planSha256')!=plan_sha:issues.append('plan-receipt-hash')
  for slot,expected in (hashes or {}).items():
   path=(base/p['modelFiles'][slot]).resolve()
   if not path.is_relative_to(base.resolve()) or sha(path)!=expected:issues.append('model-bytes-'+slot)
  if sha(runtime/'training/mlp.json')!=p.get('sourceRealModelSha256'):issues.append('selected-model-bytes')
  offline=read(runtime/'training/offline-report.json',{})
  if offline.get('selectedModelSha256')!=p.get('sourceRealModelSha256'):issues.append('offline-certification')
  for rel,expected in p.get('sourceHashes',{}).items():
   source=Path(p['sourceRoot']).resolve();path=(source/rel).resolve()
   if not path.is_relative_to(source) or sha(path)!=expected:issues.append('frozen-source-hash')
  for rel,expected in p.get('controlHashes',{}).items():
   path=(base/rel).resolve()
   if not path.is_relative_to(base.resolve()) or sha(path)!=expected:issues.append('control-source-hash')
 except (KeyError,OSError,TypeError):issues.append('missing-hash-evidence')
 return not issues,issues

def nil():return {'n':0,'mean':None,'low':None,'high':None}
def row(key,label,kind,planned,finished):
 return dict(game='wingspan',players=2,matchup=key,policy=key,policyId=label,opponentPolicyId='Post-pilot exploratory diagnostic; no promotion claim',scope='Diagnostics only',budget={},planned=planned,finished=finished,counts=dict(complete=0,capped=0,unresolved=0,illegal=0,error=0),seedGroups=0,completeSeedGroups=0,winShare=nil(),margin=nil(),chance=.5,meanDecisionMs=None,maxDecisionMs=None,metricKind=kind,limitations=['The original pilot remains frozen; diagnostic outcomes cannot promote a new model or establish human strength.'])

def overlay(base,runtime):
 dash=json.loads(json.dumps(base));progress=read(runtime/'diagnostics-progress.json',{});plan=read(runtime/'feature-capacity-probe/plan.json',{});capacity=read(runtime/'feature-capacity-probe/report.json',{});cp=read(runtime/'constant-control/checkpoint.json',{});analysis=read(runtime/'constant-control/analysis.json',{})
 cells=plan.get('cells',[]);completed=len(capacity.get('cells',{}))
 if not completed:
  completed=sum((runtime/'feature-capacity-probe/cells'/c['id']/'dev-report.json').is_file() for c in cells if re.fullmatch('[A-Za-z0-9_-]+',c.get('id','')))
 r=row('diagnostics/feature-capacity','Feature/capacity probe · train/development only','loss',len(cells),completed)
 r['counts']['complete']=completed;r['scope']='Optimization cells, not games. Development loss/MAE already used for checkpoint selection; no new test or playing-strength claim.';r['training']={'heldOutLearning':None,'latestFit':None,'selected':None,'probeStatus':capacity.get('status','prepared' if cells else 'not-prepared'),'completedCells':completed,'plannedCells':len(cells),'cells':{k:{'featureCount':v.get('featureCount'),'widths':v.get('widths'),'selected':v.get('selectedWithinCellByFrozenDevRule'),'cpuInferenceMs':v.get('cpuInferenceMs')} for k,v in capacity.get('cells',{}).items()},'pairedDevComparisons':capacity.get('pairedDevComparisons',{})};dash['rows'].append(r)
 finished=cp.get('finished',analysis.get('received',0));r=row('diagnostics/constant-control','NN versus constant-output same-shape MLP · attribution control','progress',64,finished);r['opponentPolicyId']='Same hidden layers/normalization/dense work; final scalar head zeroed. Internal linear slot is NOT the trained ridge.';r['scope']='Fixed64 games/32fresh setup pairs. While incomplete: progress only, no winner-share estimate.';r['seedGroups']=32
 ok,issues=strict_control(runtime)
 if ok:
  r['metricKind']='win-share';r['counts']['complete']=64;r['completeSeedGroups']=32
  for target,key in [('winShare','realModelWinnerShare'),('margin','realModelScoreMargin')]:
   s=analysis[key];ci=s.get('ci95');r[target]={'n':32,'mean':s['mean'],'low':(max(0,ci[0]) if target=='winShare' else ci[0]) if ci else None,'high':(min(1,ci[1]) if target=='winShare' else ci[1]) if ci else None}
  if analysis['realModelScoreMargin'].get('ci95') is None:r['limitations'].append('Margin sample has zero observed variation; point mean is shown without an interval, not as certainty.')
  latency=analysis.get('latency',{}).get('real',{});r['meanDecisionMs']=latency.get('meanMs');r['maxDecisionMs']=latency.get('maxMs');r['scope']='Strict complete constant-output attribution control:64valid games/32pairs; descriptive paired intervals only. This is not independent promotion evidence.'
 r['diagnosticValidation']={'complete':ok,'issues':issues};dash['rows'].append(r)
 dash['originalPilot']={k:base.get(k) for k in ['status','stage','finished','planned']};dash['status']=progress.get('status','planned');dash['stage']=progress.get('stage','diagnostics-prepared');dash['updatedAt']=datetime.now(timezone.utc).isoformat();dash['planned']=base.get('planned',0)+64;dash['finished']=base.get('finished',0)+finished;dash['workers']=progress.get('workers',cp.get('workers',0));dash['active']=[dict(a,game='wingspan',players=2) for a in cp.get('active',[])];dash['method']=base.get('method','')+' Post-pilot diagnostics are shown separately: train/development feature/capacity probes and NN versus same-shape constant-output attribution. Main pilot results remain unchanged.'
 return dash

def append_report(target,dash,runtime):
 p=target/'REPORT.md';text=p.read_text(encoding='utf-8');prefix=text.split(START)[0].rstrip()
 capacity=next(r for r in dash['rows'] if r['matchup']=='diagnostics/feature-capacity');control=next(r for r in dash['rows'] if r['matchup']=='diagnostics/constant-control')
 lines=[START,'## Post-pilot exploratory diagnostics','',f"Diagnostic status: **{dash['status']}**, stage **{dash['stage']}**, updated {dash['updatedAt']}. Original pilot results above are preserved.",'','[Diagnostic progress](diagnostics-progress.json) · [Feature inventory](independent-review/train-feature-inventory.json) · [Feature/capacity plan](feature-capacity-probe/plan.json) · [Feature/capacity report](feature-capacity-probe/report.json) · [Constant-output protocol](constant-control/protocol.md) · [Strict control analysis](constant-control/analysis.json)','',f"Feature/capacity cells completed: {capacity['finished']} / {capacity['planned']}. Metrics use train/development data only; development scores were also used for within-cell checkpoint selection. Conditional bootstrap intervals are descriptive, not fresh confirmation. Compact inputs remove information as well as dimensions, so this is not a pure feature-count experiment. No new online candidate is selected.",'',f"NN versus constant-output same-shape MLP: {control['finished']} /64 game records. The control retains the selected network’s hidden layers, normalization and dense work; only the final scalar head is zeroed. The internal linear transport slot is not the trained ridge model.",'']
 if control['metricKind']=='win-share':
  w=control['winShare'];m=control['margin'];margin_ci=f"[{m['low']:.3f}, {m['high']:.3f}]" if m['low'] is not None and m['high'] is not None else 'interval unavailable: degenerate sample, no certainty implied';lines += [f"Strict complete64-game/32-pair result: NN winner share {w['mean']*100:.2f}% with descriptive95% paired interval [{w['low']*100:.2f}, {w['high']*100:.2f}]%; mean margin {m['mean']:.3f} points {margin_ci}. Model bytes, plan receipts and strict analysis must match before these numbers are shown.",'']
 else:lines += ['No winner-share statistic is shown while control validation is incomplete or inconsistent. Incomplete records are not invented outcomes.','']
 lines += ['These are post-pilot exploratory diagnostics, not promotion gates or evidence of independent human strength. Raw game observations, binary checkpoints and virtual environments remain outside Git. Only explicitly listed plans, source, tests, checkpoints, summaries and reports are copied. Main pilot progress files and source remain unchanged.',END,'']
 p.write_text(prefix+'\n\n'+'\n'.join(lines),encoding='utf-8')

def publish_once(runtime,repo,source,node='node',no_git=False,deadline=float('inf')):
 ready,reason=publisher_ready(runtime)
 if not ready:return {'waiting':True,'reason':reason}
 target=(repo/DEST).resolve()
 if repo.resolve()==source.resolve() or not target.is_relative_to(repo.resolve()) or (repo/DEST).is_symlink():raise RuntimeError('Distinct scoped evidence worktree required')
 def git(*args):
  remaining=deadline-time.time()
  if remaining<=0:raise TimeoutError('Diagnostics publisher deadline')
  p=subprocess.run(['git',*args],cwd=repo,capture_output=True,text=True,encoding='utf-8',timeout=min(90,remaining))
  if p.returncode:raise RuntimeError(p.stderr or p.stdout)
  return p.stdout.strip()
 if not no_git:
  if git('branch','--show-current')!=BRANCH:raise RuntimeError('Wrong evidence branch')
  if any(not p.startswith(DEST+'/') for p in git('diff','--cached','--name-only').splitlines()):raise RuntimeError('Unrelated staged files; refusing evidence mutation')
 if not (target/'REPORT.md').is_file():raise RuntimeError('Final original report missing; refusing replacement')
 files=allowlist(runtime)
 for rel in files:
  if time.time()>=deadline:raise TimeoutError('Diagnostics publisher deadline')
  src=runtime/rel
  if not src.is_file():continue
  if not src.resolve().is_relative_to(runtime.resolve()) or src.stat().st_size>16*1024*1024:raise RuntimeError('Unsafe or oversized diagnostic artifact: '+rel)
  dest=target/rel
  if not dest.resolve().is_relative_to(target):raise RuntimeError('Evidence symlink escape')
  dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dest)
 command=[node,str(source/'scripts/wingspan-neural/dashboard.mjs'),'--runtime='+str(runtime)]
 base=json.loads(subprocess.run(command,cwd=source,check=True,capture_output=True,text=True,encoding='utf-8',timeout=min(90,max(.1,deadline-time.time()))).stdout)
 dash=overlay(base,runtime);atomic(target/'dashboard.json',dash);append_report(target,dash,runtime)
 atomic(target/'diagnostic-artifacts.json',{'schemaVersion':1,'files':{r:{'bytes':(target/r).stat().st_size,'sha256':sha(target/r)} for r in files if (target/r).is_file()}})
 if not no_git:
  git('add','--',DEST)
  if git('diff','--cached','--name-only'):git('-c','user.name=Codex','-c','user.email=codex@openai.com','commit','-m','Wingspan post-pilot diagnostic evidence')
  git('push','origin','HEAD:refs/heads/'+BRANCH)
 return {'waiting':False,'success':True,'stage':dash['stage'],'status':dash['status']}

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--runtime',required=True);p.add_argument('--repo',required=True);p.add_argument('--source',default='C:/Users/mason/.codex/worktrees/wingspan-neural-20261019');p.add_argument('--node',default='node');p.add_argument('--once',action='store_true');p.add_argument('--deadline',type=float,default=0);p.add_argument('--no-git',action='store_true');a=p.parse_args()
 if not a.once and a.deadline<=time.time():p.error('Use --once or future--deadline UNIX seconds')
 runtime=Path(a.runtime).resolve();repo=Path(a.repo).resolve();source=Path(a.source).resolve()
 if os.name=='nt':
  k=ctypes.windll.kernel32;k.SetPriorityClass.argtypes=[ctypes.c_void_p,ctypes.c_uint32];k.SetPriorityClass(ctypes.c_void_p(-1),0x4000)
 while True:
  if not a.once and time.time()>=a.deadline:return
  try:
   result=publish_once(runtime,repo,source,a.node,a.no_git,a.deadline if a.deadline else float('inf'));atomic(runtime/'diagnostics-publication-status.json',dict(at=datetime.now(timezone.utc).isoformat(),**result));print(json.dumps(result),flush=True)
   if a.once or (not result.get('waiting') and result.get('status') in ['finished','interrupted','deadline']):return
  except Exception as e:
   atomic(runtime/'diagnostics-publication-status.json',{'success':False,'at':datetime.now(timezone.utc).isoformat(),'error':str(e)});print(str(e),flush=True)
   if a.once:raise
  if time.time()>=a.deadline:return
  time.sleep(min(90,max(0,a.deadline-time.time())))
if __name__=='__main__':main()
