"""Bounded driver: existing frozen collection -> fit -> parity -> fixed evaluations."""
from pathlib import Path
import argparse,json,subprocess,sys,time,os,ctypes,hashlib
from datetime import datetime,timezone
def read(p): return json.loads(Path(p).read_text(encoding='utf-8'))
def atomic(p,d):
    p=Path(p);p.parent.mkdir(parents=True,exist_ok=True);tmp=p.with_suffix(p.suffix+'.tmp');tmp.write_text(json.dumps(d,indent=2),encoding='utf-8')
    for i in range(9):
        try: os.replace(tmp,p);return
        except PermissionError:
            if i==8: raise
            time.sleep(.025*2**i)
def now(): return datetime.now(timezone.utc).isoformat()
def digest(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def main():
    p=argparse.ArgumentParser();p.add_argument('--runtime',required=True);p.add_argument('--node',required=True);p.add_argument('--root',required=True);args=p.parse_args()
    runtime=Path(args.runtime);root=Path(args.root);deadline=time.time()+6*3600;stage='dataset';status='running';child=None
    receipt=runtime/'pilot-launch.json'
    if receipt.exists(): raise RuntimeError('Pilot already launched; preserve receipt rather than resetting its clock')
    source_hashes={str(f.relative_to(root)).replace('\\','/'):digest(f) for folder in ['wingspan','scripts/wingspan-study','scripts/wingspan-neural'] for f in (root/folder).rglob('*') if f.is_file() and f.suffix in ['.js','.mjs','.json','.py'] and '__pycache__' not in str(f)}
    atomic(runtime/'source-manifest.json',{'createdAt':now(),'sourceHashes':source_hashes})
    atomic(receipt,{'startedAt':now(),'deadline':datetime.fromtimestamp(deadline,timezone.utc).isoformat(),'pid':os.getpid(),'workers':24,'cudaMemoryCeilingGiB':6,'sourceManifestSha256':digest(runtime/'source-manifest.json')})
    model_lock={}
    def check():
        for rel,h in source_hashes.items():
            if digest(root/rel)!=h: raise RuntimeError('Frozen pilot source changed: '+rel)
        for rel,h in model_lock.items():
            if digest(runtime/'training'/rel)!=h: raise RuntimeError('Frozen selected model/certification changed: '+rel)
    def progress(extra=None): atomic(runtime/'progress.json',{'stage':stage,'status':status,'updatedAt':now(),'deadline':datetime.fromtimestamp(deadline,timezone.utc).isoformat(),**(extra or {})})
    def run(command,name,limit):
        nonlocal child
        check()
        remaining=min(limit,deadline-time.time())
        if remaining<=0: raise RuntimeError('Pilot deadline reached')
        with open(runtime/(name+'.stdout.log'),'ab') as out,open(runtime/(name+'.stderr.log'),'ab') as err:
            flags=(subprocess.CREATE_NO_WINDOW|subprocess.BELOW_NORMAL_PRIORITY_CLASS) if os.name=='nt' else 0
            child=subprocess.Popen(command,cwd=root,stdout=out,stderr=err,creationflags=flags)
            atomic(runtime/'owned-pilot-processes.json',{'supervisorPid':os.getpid(),'childPid':child.pid,'stage':stage,'command':command})
            end=time.time()+remaining
            while child.poll() is None:
                check()
                progress()
                if time.time()>end:
                    if os.name=='nt': subprocess.run(['taskkill','/PID',str(child.pid),'/T','/F'],capture_output=True,timeout=20)
                    else: child.kill()
                    child.wait(timeout=20)
                    cp_path=runtime/stage/'checkpoint.json'
                    if cp_path.exists():
                        cp=read(cp_path);cp.update(status='deadline',active=[],updatedAt=now());atomic(cp_path,cp)
                    atomic(runtime/stage/'forced-deadline.json',{'at':now(),'stage':stage,'reason':'Supervisor bounded stage deadline; complete records retained'})
                    raise RuntimeError('Bounded stage deadline: '+name)
                time.sleep(5)
            code=child.returncode;child=None
            if code: raise RuntimeError('Stage failed '+name+'; inspect retained artifacts/logs')
    try:
        if os.name=='nt': ctypes.windll.kernel32.SetThreadExecutionState(0x80000001)
        progress()
        while True:
            check()
            cp=read(runtime/'dataset'/'checkpoint.json');progress({'finished':cp['finished'],'planned':cp['planned']})
            if cp['status']=='finished': break
            if cp['status']=='interrupted': raise RuntimeError('Dataset collection interrupted')
            if time.time()>deadline: raise RuntimeError('Dataset wait deadline')
            time.sleep(15)
        stage='training';progress();run([sys.executable,'-X','utf8',str(root/'scripts/wingspan-neural/train.py'),'--data',str(runtime/'dataset'),'--out',str(runtime/'training'),'--device','cuda','--max-vram-gb','6'],'training',30*60)
        report=read(runtime/'training'/'offline-report.json')
        if not report.get('heldOutLearning'): raise RuntimeError('Offline learning gate failed')
        for file,key in [('mlp.json','selectedModelSha256'),('linear.json','linearModelSha256')]:
            if digest(runtime/'training'/file)!=report.get(key): raise RuntimeError('Offline certificate does not match selected weights: '+file)
        model_lock.update({f:digest(runtime/'training'/f) for f in ['mlp.json','linear.json','parity.json','selection.json','offline-report.json']})
        atomic(runtime/'selected-model-lock.json',{'createdAt':now(),'hashes':model_lock})
        stage='preflight';progress();run([args.node,str(root/'scripts/wingspan-neural/preflight.mjs'),'--models='+str(runtime/'training'),'--out='+str(runtime/'preflight')],'preflight',10*60)
        run([args.node,str(root/'scripts/wingspan-neural/browser-preflight.mjs'),'--models='+str(runtime/'training'),'--out='+str(runtime/'preflight')],'browser-preflight',10*60)
        for next_stage in ['canary','screen','confirmation']:
            if next_stage=='confirmation':
                screen=read(runtime/'screen'/'analysis.json')
                if not screen.get('eligible'): break
            stage=next_stage;progress();run([args.node,'--max-old-space-size=12288',str(root/'scripts/wingspan-neural/eval-run.mjs'),'--out='+str(runtime/next_stage),'--models='+str(runtime/'training'),'--stage='+next_stage,'--workers=24'],next_stage,4*3600)
        status='finished';stage='complete';progress();atomic(runtime/'pilot-result.json',{'status':status,'updatedAt':now(),'screenEligible':read(runtime/'screen'/'analysis.json')['eligible'],'confirmation':read(runtime/'confirmation'/'analysis.json') if (runtime/'confirmation'/'analysis.json').exists() else None,'productionDefaultsChanged':False})
        return 0
    except Exception as e:
        status='interrupted';progress({'error':str(e)});atomic(runtime/'pilot-failure.json',{'stage':stage,'status':status,'at':now(),'error':str(e),'productionDefaultsChanged':False});print(str(e),file=sys.stderr,flush=True)
        return 1
    finally:
        if child and child.poll() is None:
            if os.name=='nt': subprocess.run(['taskkill','/PID',str(child.pid),'/T','/F'],capture_output=True,timeout=20)
            else: child.kill()
        if os.name=='nt': ctypes.windll.kernel32.SetThreadExecutionState(0x80000000)
if __name__=='__main__': sys.exit(main())
