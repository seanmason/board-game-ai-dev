"""Bounded Windows supervisor. --check is read-only; execution needs --start."""
from pathlib import Path
import argparse, ctypes, hashlib, json, os, subprocess, sys, time, zipfile
from datetime import datetime, timezone

def utc(): return datetime.now(timezone.utc).isoformat()
def read(p): return json.loads(Path(p).read_text(encoding='utf-8'))
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def atomic(p, value):
    p=Path(p);p.parent.mkdir(parents=True,exist_ok=True)
    tmp=p.with_suffix(p.suffix+'.tmp');tmp.write_text(json.dumps(value,indent=2),encoding='utf-8')
    for attempt in range(9):
        try: os.replace(tmp,p); return
        except PermissionError:
            if attempt==8: raise
            time.sleep(.025*2**attempt)
def process_info(pid):
    if not isinstance(pid,int) or pid<1: return None
    command=f"Get-CimInstance Win32_Process -Filter 'ProcessId={pid}' | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"
    r=subprocess.run(['powershell','-NoProfile','-Command',command],capture_output=True,text=True,encoding='utf-8',timeout=20)
    if r.returncode: raise RuntimeError('Unable to verify process ownership')
    return json.loads(r.stdout) if r.stdout.strip() else None
def running_owned(pid, marker):
    info=process_info(pid)
    if not info: return False
    if marker.lower() not in (info.get('CommandLine') or '').lower(): raise RuntimeError('Recorded PID belongs to a different process')
    return True
def check(config):
    root=Path(config['root'])
    for rel,h in config['hashes'].items():
        if sha(root/rel)!=h: raise RuntimeError('Frozen source changed: '+rel)
    for key in ['previousManifest','previousWrapper']:
        if sha(config[key])!=config[key+'Hash']: raise RuntimeError('Prior execution file changed: '+key)
    if not Path(config['publicationRepo']).is_dir(): raise RuntimeError('Publication checkout missing')
    r=subprocess.run(['git','branch','--show-current'],cwd=config['publicationRepo'],capture_output=True,text=True,timeout=20)
    if r.returncode or r.stdout.strip()!=config['publicationBranch']: raise RuntimeError('Wrong publication branch')
    if config['workers']!=30 or config['durationHours']!=9: raise RuntimeError('Unexpected resource authorization')
    audit=config['seedAudit']
    if not audit or audit.get('status')!='passed': raise RuntimeError('Seed audit missing or failed')
    return {'ready':True,'revision':config['revision'],'sourceFiles':len(config['hashes']),'workers':30,'hours':9}
def spawn_logged(command, root, out, name):
    flags=(subprocess.CREATE_NO_WINDOW|subprocess.BELOW_NORMAL_PRIORITY_CLASS) if os.name=='nt' else 0
    stdout=open(out/(name+'.stdout.log'),'ab');stderr=open(out/(name+'.stderr.log'),'ab')
    try: return subprocess.Popen(command,cwd=root,stdout=stdout,stderr=stderr,creationflags=flags)
    finally: stdout.close();stderr.close()
def terminate_tree(process):
    if process.poll() is None:
        if os.name=='nt': subprocess.run(['taskkill','/PID',str(process.pid),'/T','/F'],capture_output=True,timeout=20)
        else: process.kill()
        process.wait(timeout=20)
def snapshot(config, launch, status, stage):
    out=Path(config['out']);now=utc()
    value={'revision':config['revision'],'startedAt':launch['startedAt'],'updatedAt':now,'deadline':launch['deadline'],'status':status,'stage':stage,'workers':30,'planned':0,'finished':0,'active':[]}
    atomic(out/'checkpoint.json',value)
    atomic(out/'dashboard.json',{**value,'schema':1,'study':'wingspan-overnight-2026-10-18','rows':[],'method':'Nine-hour unattended investigation. '+stage+'. No new strength results yet.'})
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--config',required=True);parser.add_argument('--check',action='store_true');parser.add_argument('--start',action='store_true');args=parser.parse_args()
    config_path=Path(args.config).resolve();config=read(config_path);checked=check(config)
    if args.check: print(json.dumps(checked));return
    if not args.start: raise RuntimeError('Execution requires --start after user approval')
    out=Path(config['out']);out.mkdir(parents=True,exist_ok=True)
    lock=out/'supervisor.lock'
    try: fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY)
    except FileExistsError: raise RuntimeError('A launch already exists; do not start a duplicate campaign')
    os.write(fd,str(os.getpid()).encode());os.close(fd)
    started=time.time();deadline=started+9*3600
    launch={'startedAt':utc(),'deadline':datetime.fromtimestamp(deadline,timezone.utc).isoformat(),'workers':30,'configHash':sha(config_path),'supervisorPid':os.getpid(),'revision':config['revision']}
    atomic(out/'launch.json',launch)
    with zipfile.ZipFile(out/'execution-source.zip','w',zipfile.ZIP_DEFLATED) as archive:
        for rel in config['hashes']: archive.write(Path(config['root'])/rel,rel)
    atomic(out/'archive-sha256.json',{'execution-source.zip':sha(out/'execution-source.zip')})
    publisher=runner=None;status='interrupted';stage='waiting-for-current-study';old_pid=config['previousRunnerPid']
    try:
        if os.name=='nt':
            if not ctypes.windll.kernel32.SetThreadExecutionState(0x80000001): raise RuntimeError('Cannot keep system awake')
        snapshot(config,launch,'running',stage)
        publisher=spawn_logged([sys.executable,'-X','utf8',str(Path(config['root'])/'scripts/wingspan-overnight/publish.py'),'--config',str(config_path),'--deadline',str(deadline+120)],config['root'],out,'publisher')
        # The old study owns all its retained data and keeps its original settings.
        # No new CPU worker pool starts until its exact runner exits successfully.
        previous=Path(config['previousStudy'])
        while True:
            check(config)
            alive=running_owned(old_pid,config['previousWrapper'])
            cp=read(previous/'checkpoint.json')
            if cp['status']=='finished' and not alive:
                evidence=read(previous/'analysis.json')
                if not evidence['screen']['complete'] or not evidence['confirmation']['complete']: raise RuntimeError('Previous completed evidence is invalid')
                break
            if cp['status']=='interrupted' or (previous/'failure.json').exists(): raise RuntimeError('Previous study failed; new campaign blocked')
            if not alive: raise RuntimeError('Previous runner exited without completed evidence; preserved for review')
            if time.time()>=deadline:
                # Only the exact pre-existing owned benchmark is eligible here.
                subprocess.run(['taskkill','/PID',str(old_pid),'/F'],capture_output=True,timeout=20)
                atomic(out/'prior-deadline-stop.json',{'at':utc(),'runnerPid':old_pid,'checkpoint':cp,'reason':'Nine-hour resource window expired; completed old records retained, no new campaign started.'})
                cp.update(status='interrupted',updatedAt=utc(),active=[])
                atomic(previous/'checkpoint.json',cp)
                if (previous/'dashboard.json').exists():
                    old_dash=read(previous/'dashboard.json');old_dash.update(status='interrupted',updatedAt=utc(),active=[]);atomic(previous/'dashboard.json',old_dash)
                atomic(previous/'overnight-deadline-stop.json',{'at':utc(),'runnerPid':old_pid,'supervisorLaunch':str(out/'launch.json'),'completedRecordsPreserved':True})
                status='deadline';stage='prior-study-deadline';snapshot(config,launch,status,stage);return
            snapshot(config,launch,'running',stage);time.sleep(min(20,max(1,deadline-time.time())))
        stage='new-campaign';check(config)
        runner=spawn_logged([config['node'],str(Path(config['root'])/'scripts/wingspan-overnight/run.mjs'),'--config='+str(config_path),'--launch='+str(out/'launch.json')],config['root'],out,'runner')
        atomic(out/'owned-processes.json',{'supervisorPid':os.getpid(),'runnerPid':runner.pid,'publisherPid':publisher.pid,'workers':30,'deadline':launch['deadline']})
        while runner.poll() is None:
            if time.time()>=deadline+15:
                terminate_tree(runner)
                old=read(out/'checkpoint.json');old.update(status='deadline',stage='forced-deadline',updatedAt=utc());atomic(out/'checkpoint.json',old)
                dash=read(out/'dashboard.json');dash.update(status='deadline',stage='forced-deadline',updatedAt=utc(),active=[]);atomic(out/'dashboard.json',dash)
                break
            time.sleep(5)
        cp=read(out/'checkpoint.json');status=cp['status'];stage=cp['stage']
        if runner.returncode and status=='running': raise RuntimeError('Runner exited unexpectedly; retained records require review')
    except Exception as error:
        status='interrupted'
        atomic(out/'supervisor-failure.json',{'at':utc(),'error':str(error),'stage':stage})
        cp=read(out/'checkpoint.json') if (out/'checkpoint.json').exists() else {}
        cp.update(status='interrupted',updatedAt=utc());atomic(out/'checkpoint.json',cp)
        if (out/'dashboard.json').exists():
            dash=read(out/'dashboard.json');dash.update(status='interrupted',updatedAt=utc(),active=[]);atomic(out/'dashboard.json',dash)
        print(str(error),file=sys.stderr,flush=True)
    finally:
        if runner and runner.poll() is None: terminate_tree(runner)
        atomic(out/'supervisor-result.json',{'at':utc(),'status':status,'stage':stage,'productionDefaultsChanged':False})
        if publisher:
            try: publisher.wait(timeout=max(1,min(150,deadline+130-time.time())))
            except subprocess.TimeoutExpired: publisher.terminate();publisher.wait(timeout=20)
        if os.name=='nt': ctypes.windll.kernel32.SetThreadExecutionState(0x80000000)
        # Retain the lock/receipt as protection against accidentally rerunning outcomes.

if __name__=='__main__': main()
