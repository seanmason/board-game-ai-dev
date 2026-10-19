"""Bounded follow-up queue; waits for the unchanged pilot, then runs frozen diagnostics."""
import ctypes,hashlib,json,os,subprocess,sys,time
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parent
NODE=Path(r'C:/Users/mason/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe')
LOCKS={'feature-capacity-probe/plan.json':'db99db669b4fe67cbb3ac62aba833aebc7a178e1c9b25d41c8d48588974fc39d','constant-control/plan.json':'9041b65d0911148c8cb360244bcc5704f6d7349ad7b268048fc55e290dda6a39'}
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,value):
 t=p.with_suffix(p.suffix+'.tmp');t.write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')
 for i in range(9):
  try:os.replace(t,p);return
  except PermissionError:
   if i==8:raise
   time.sleep(.025*2**i)
def stamp():return datetime.now(timezone.utc).isoformat()
def check():
 for rel,h in LOCKS.items():
  if hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=h:raise RuntimeError('Frozen follow-up plan changed: '+rel)
def stop(child):
 if child and child.poll() is None:
  if os.name=='nt':subprocess.run(['taskkill','/PID',str(child.pid),'/T','/F'],capture_output=True,timeout=20)
  else:child.kill()
  child.wait(timeout=20)
def main():
 launch=read(ROOT/'pilot-launch.json');deadline=datetime.fromisoformat(launch['deadline']).timestamp()
 receipt=ROOT/'diagnostics-launch.json'
 if receipt.exists():raise RuntimeError('Follow-up queue already launched; no new clock')
 check()
 with receipt.open('x',encoding='utf-8') as f:
  json.dump({'startedAt':stamp(),'deadline':launch['deadline'],'pid':os.getpid(),'plans':LOCKS,'executionScriptSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'executionOrder':['wait-for-complete-fixed-pilot','feature-capacity-probe','constant-control'],'noProductionPromotion':True},f,indent=2)
 stage='waiting-for-pilot';child=None
 def progress(status,**extra):write(ROOT/'diagnostics-progress.json',{'stage':stage,'status':status,'updatedAt':stamp(),'deadline':launch['deadline'],'productionDefaultsChanged':False,**extra})
 def run(command,label,limit=900):
  nonlocal child,stage
  stage=label;check();remaining=min(limit,deadline-time.time())
  if remaining<=0:raise RuntimeError('Original pilot deadline reached')
  flags=(subprocess.CREATE_NO_WINDOW|subprocess.BELOW_NORMAL_PRIORITY_CLASS) if os.name=='nt' else 0
  with (ROOT/(label+'.stdout.log')).open('ab') as out,(ROOT/(label+'.stderr.log')).open('ab') as err:
   child=subprocess.Popen(command,cwd=ROOT,stdout=out,stderr=err,creationflags=flags)
   end=time.time()+remaining
   while child.poll() is None:
    check();progress('running',childPid=child.pid)
    if time.time()>=end:stop(child);raise RuntimeError('Bounded diagnostic deadline: '+label)
    time.sleep(5)
   code=child.returncode;child=None
   if code:raise RuntimeError('Diagnostic failed: '+label+'; inspect retained logs')
 try:
  if os.name=='nt':ctypes.windll.kernel32.SetThreadExecutionState(0x80000001)
  while True:
   check();p=read(ROOT/'progress.json');progress('waiting',pilotStage=p.get('stage'))
   if p.get('status') in ['interrupted','deadline']:raise RuntimeError('Fixed pilot did not finish successfully; follow-ups skipped')
   if p.get('status')=='finished' and (ROOT/'pilot-result.json').exists():
    if read(ROOT/'pilot-result.json').get('status')!='finished':raise RuntimeError('Pilot completion certificate invalid')
    break
   if time.time()>=deadline:raise RuntimeError('Original deadline reached while waiting')
   time.sleep(15)
  run([sys.executable,'-X','utf8',str(ROOT/'feature-capacity-probe/probe.py'),'--execute'],'capacity-diagnostic')
  report=read(ROOT/'feature-capacity-probe/report.json')
  if report.get('status')!='complete' or report.get('testFilesOpened')!=0:raise RuntimeError('Capacity diagnostic invalid')
  run([str(NODE),str(ROOT/'constant-control/control.mjs'),'--execute','--approved-after-fixed-pilot'],'constant-attribution')
  control=read(ROOT/'constant-control/analysis.json')
  if not control.get('complete') or control.get('valid')!=64 or control.get('independentPairs')!=32:raise RuntimeError('Constant control incomplete')
  stage='complete';progress('finished');write(ROOT/'diagnostics-result.json',{'status':'finished','updatedAt':stamp(),'constantControlComplete':True,'testFilesOpenedByCapacityProbe':0,'productionDefaultsChanged':False})
 except Exception as error:
  stop(child);progress('interrupted',error=str(error));write(ROOT/'diagnostics-failure.json',{'stage':stage,'error':str(error),'at':stamp(),'productionDefaultsChanged':False});raise
 finally:
  stop(child)
  if os.name=='nt':ctypes.windll.kernel32.SetThreadExecutionState(0x80000000)
if __name__=='__main__':main()
