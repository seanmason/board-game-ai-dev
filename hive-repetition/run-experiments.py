from pathlib import Path
import subprocess,json,time
root=Path('C:/Users/mason/.codex/benchmark-runs/hive-repetition-20261018')
root.mkdir(parents=True,exist_ok=True)
receipt=[]
for arm,policy,ms in [('control','tactical-v2',100),('history','history-v1',100),('compute','tactical-v2',500)]:
    out=root/arm
    args=['node','scripts/benchmark-comparison.mjs',f'--out={out}','--games=hive',f'--policy={policy}','--opponent=simple-v1','--players=2','--seed-base=8182600',f'--study=hive-repetition-{arm}','--workers=12','--pairs=40','--budget='+json.dumps({'ms':ms,'maxDepth':5,'openingPlies':6,'maxTurns':160,'repetitionLimit':4})]
    entry={'arm':arm,'command':args,'startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'workers':12}
    with (root/(arm+'.log')).open('w',encoding='utf-8') as log:
        proc=subprocess.Popen(args,stdout=log,stderr=subprocess.STDOUT)
        entry['pid']=proc.pid
        while proc.poll() is None:
            for file in (out/'games').glob('*.json'):
                data=json.loads(file.read_text(encoding='utf-8'))
                if data['status'] in ('error','illegal'):
                    proc.terminate();proc.wait()
                    entry['validityFailure']=file.name
                    (root/'FAILED.json').write_text(json.dumps(entry,indent=2),encoding='utf-8')
                    raise RuntimeError('Stopping on validity failure: '+file.name)
            time.sleep(2)
        if proc.returncode:raise RuntimeError(f'{arm} runner failed: {proc.returncode}')
    entry['completedAt']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());entry['exitCode']=proc.returncode
    receipt.append(entry)
    (root/'execution-receipt.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
    print(arm+' complete',flush=True)
