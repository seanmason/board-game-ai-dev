from pathlib import Path
import subprocess,json,time,threading,concurrent.futures,datetime
root=Path('C:/Users/mason/.codex/benchmark-runs/good-enough-20261018')
root.mkdir(parents=True,exist_ok=True)
configs=[('love-low','love-letter','production-default','2,4',40,9182600,{'iterations':64}),('love-high','love-letter','production-default','2,4',40,9182600,{'iterations':512}),('sushi-low','sushi-go','production-default','4',40,9282600,{'iterations':64}),('sushi-high','sushi-go','production-default','4',40,9282600,{'iterations':256}),('hive-control','hive','tactical-v2','2',100,9382600,{'ms':100,'maxDepth':5,'openingPlies':6,'maxTurns':160,'repetitionLimit':4}),('hive-history','hive','history-v1','2',100,9382600,{'ms':100,'maxDepth':5,'openingPlies':6,'maxTurns':160,'repetitionLimit':4})]
commands={}
for arm,game,policy,players,pairs,seed,budget in configs:
 args=['node','scripts/benchmark-comparison.mjs',f'--out={root/arm}',f'--games={game}',f'--policy={policy}','--opponent=simple-v1',f'--players={players}',f'--seed-base={seed}',f'--study=good-enough-{arm}','--workers=6',f'--pairs={pairs}','--budget='+json.dumps(budget)]
 commands[arm]=args
 with (root/(arm+'-plan.log')).open('w',encoding='utf-8') as log:subprocess.run(args+['--plan-only'],stdout=log,stderr=subprocess.STDOUT,check=True)
print('All six arms planned before execution',flush=True)
receipt=[];lock=threading.Lock();failed=threading.Event()
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def save():
 with lock:(root/'execution-receipt.json').write_text(json.dumps({'maxTotalWorkers':18,'workersPerFamily':6,'families':[['love-low','love-high'],['sushi-low','sushi-high'],['hive-control','hive-history']],'runs':receipt},indent=2),encoding='utf-8')
def family(arms):
 try:
  for arm in arms:
   if failed.is_set():return
   entry={'arm':arm,'command':commands[arm],'startedAt':now(),'workers':6}
   with lock:receipt.append(entry)
   save();seen=set()
   with (root/(arm+'.log')).open('w',encoding='utf-8') as log:
    proc=subprocess.Popen(commands[arm],stdout=log,stderr=subprocess.STDOUT);entry['pid']=proc.pid;save()
    while proc.poll() is None:
     for file in (root/arm/'games').glob('*.json'):
      if file.name in seen:continue
      result=json.loads(file.read_text(encoding='utf-8'));seen.add(file.name)
      if result['status'] in ('error','illegal') or result.get('diagnostics',{}).get('error'):
       entry['validityFailure']=file.name;failed.set();break
     if failed.is_set():proc.terminate();proc.wait();entry['status']='interrupted';entry['completedAt']=now();entry['exitCode']=proc.returncode;save();return
     time.sleep(2)
    entry['completedAt']=now();entry['exitCode']=proc.returncode;entry['status']='finished' if proc.returncode==0 else 'interrupted';save()
    if proc.returncode:failed.set();raise RuntimeError(arm+' failed')
    for file in (root/arm/'games').glob('*.json'):
     result=json.loads(file.read_text(encoding='utf-8'))
     if result['status'] in ('error','illegal') or result.get('diagnostics',{}).get('error'):failed.set();raise RuntimeError('Final validity failure '+file.name)
   print(arm+' finished',flush=True)
 except BaseException:
  failed.set();raise
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 futures=[pool.submit(family,arms) for arms in [['love-low','love-high'],['sushi-low','sushi-high'],['hive-control','hive-history']]]
 for future in futures:future.result()
if failed.is_set():raise RuntimeError('Batch interrupted; retained all evidence')
print('All families finished',flush=True)
