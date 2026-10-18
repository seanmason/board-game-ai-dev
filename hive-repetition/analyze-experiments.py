from pathlib import Path
import json,math,statistics,hashlib,shutil
root=Path('C:/Users/mason/.codex/benchmark-runs/hive-repetition-20261018')
pub=Path('C:/Users/mason/OneDrive/Documents/ChatGPT/Board Game AIs/local-run/comparison-publication/hive-repetition')
pub.mkdir(parents=True,exist_ok=True)
arms={};rows=[];hashes={};metrics={}
def interval(xs):
    mean=statistics.mean(xs);se=statistics.stdev(xs)/math.sqrt(len(xs)) if len(xs)>1 else 0
    return {'mean':mean,'low':mean-2.023*se,'high':mean+2.023*se,'n':len(xs)}
def share(r):return r['shares'][r['seat']] if r['status']=='complete' else 0
def completed(r):return int(r['status']=='complete')
for arm in ['control','history','compute']:
    results=[json.loads(p.read_text(encoding='utf-8')) for p in sorted((root/arm/'games').glob('*.json'))]
    assert len(results)==80 and all(r['status'] not in ('error','illegal') for r in results)
    arms[arm]={(r['seed'],r['seat']):r for r in results}
    assert set(arms[arm])=={(8182600+997*i,seat) for i in range(40) for seat in range(2)}
    snapshot=json.loads((root/arm/'dashboard.json').read_text(encoding='utf-8'));row=snapshot['rows'][0]
    row['limitations']=[x.replace('Both use a soft100ms budget and report actual overruns.', 'Search policies use the configured soft time budget and report actual overruns.') for x in row['limitations']]
    row['policyId']+=' ('+arm+', '+str(row['budget']['ms'])+' ms)';rows.append(row)
    depths=[x for r in results for x in r['diagnostics']['completedDepths']]
    reasons={}
    for r in results:
        if r['status']!='complete':
            why=r['diagnostics'].get('reason') or r['status'];reasons[why]=reasons.get(why,0)+1
    signatures={r['diagnostics']['opening']['sha256'] for r in results}
    metrics[arm]={'complete':sum(map(completed,results)),'unresolved':sum(r['status']=='unresolved' for r in results),'capped':sum(r['status']=='capped' for r in results),'lowerShare':sum(map(share,results))/80,'upperShare':sum(share(r) if completed(r) else 1 for r in results)/80,'completeGroups':row['completeSeedGroups'],'conditionalShare':row['winShare'],'pooledDecisionMs':row['meanDecisionMs'],'maxDecisionMs':row['maxDecisionMs'],'medianGameMeanDecisionMs':statistics.median(r['latency']['totalMs']/max(1,r['latency']['count']) for r in results),'depthCounts':{str(d):depths.count(d) for d in sorted(set(depths))},'distinctOpenings':len(signatures),'reasons':reasons,'historyDecisions':sum(r['diagnostics'].get('historyDecisions',0) for r in results),'historySelectedRepeatedDecisions':sum(r['diagnostics'].get('historySelectedRepeatedDecisions',0) for r in results)}
    shutil.copytree(root/arm,pub/arm,dirs_exist_ok=True)
    for p in sorted((pub/arm).rglob('*.json')):hashes[str(p.relative_to(pub)).replace(chr(92),'/')]=hashlib.sha256(p.read_bytes()).hexdigest()
base=arms['control'];comparisons={}
for arm in ['history','compute']:
    trial=arms[arm];assert trial.keys()==base.keys()
    for key in base:assert base[key]['diagnostics']['opening']['sha256']==trial[key]['diagnostics']['opening']['sha256']
    seeds=sorted({key[0] for key in base});completion=[];wins=[]
    for seed in seeds:
        completion.append(sum(completed(trial[(seed,seat)])-completed(base[(seed,seat)]) for seat in range(2))/2)
        wins.append(sum(share(trial[(seed,seat)])-share(base[(seed,seat)]) for seat in range(2))/2)
    cmp={'completionDifference':interval(completion),'observedWinLowerBoundDifference':interval(wins),'unresolvedToComplete':sum(not completed(base[k]) and completed(trial[k]) for k in base),'completeToUnresolved':sum(completed(base[k]) and not completed(trial[k]) for k in base),'allScheduledTrueShareDifferenceBounds':[metrics[arm]['lowerShare']-metrics['control']['upperShare'],metrics[arm]['upperShare']-metrics['control']['lowerShare']]}
    cmp['meetsExploratoryFollowupGate']=cmp['completionDifference']['mean']>=.1-1e-9 and cmp['completionDifference']['low']>0 and metrics[arm]['lowerShare']>=metrics['control']['lowerShare']
    cmp['changedGames']=[{'seed':k[0],'seat':k[1],'control':base[k]['status'],'arm':trial[k]['status']} for k in sorted(base) if completed(base[k])!=completed(trial[k])]
    latency=lambda r:r['latency']['totalMs']/max(1,r['latency']['count'])
    depth=lambda r:statistics.mean(r['diagnostics']['completedDepths']) if r['diagnostics']['completedDepths'] else 0
    for name,measure in [('gameMeanLatencyDifferenceMs',latency),('gameMeanCompletedDepthDifference',depth)]:
        cmp[name]=interval([sum(measure(trial[(seed,seat)])-measure(base[(seed,seat)]) for seat in range(2))/2 for seed in seeds])
    cmp['pairedCostWeighting']='Equal games within each opening, then equal openings; each game metric averages its candidate decisions.'
    comparisons[arm]=cmp
analysis={'metrics':metrics,'comparisons':comparisons,'note':'Forty opening clusters; approximate t(39) descriptive intervals; two comparisons, no multiplicity adjustment. Bounds include unresolved/capped without assigning outcomes. Timed policies and sequential arms can vary with load.'}
(pub/'analysis.json').write_text(json.dumps(analysis,indent=2),encoding='utf-8')
(pub/'result-sha256.json').write_text(json.dumps(hashes,indent=2),encoding='utf-8')
shutil.copy2(root/'execution-receipt.json',pub/'execution-receipt.json')
shutil.copy2('docs/work/hive-repetition-experiments-2026-10-18.md',pub/'PROTOCOL.md')
shutil.copy2('local-run/run-hive-experiments.py',pub/'run-experiments.py')
shutil.copy2('local-run/analyze-hive-experiments.py',pub/'analyze-experiments.py')
snapshot['startedAt']=json.loads((root/'control'/'manifest.json').read_text(encoding='utf-8'))['startedAt']
snapshot.update(study='hive-repetition-2026-10-18',planned=240,finished=240,rows=rows,active=[],status='finished',method='Exploratory matched-opening comparison: current100ms, public-history tie-break100ms, current500ms; 40 identical six-ply openings with both seats per arm. Twelve BelowNormal workers, arms sequential. Primary metric is completion difference versus control; see report for paired intervals and all-scheduled win-share sensitivity bounds. Card win shares condition on complete seat groups and can be biased. No browser policy promotion.')
(pub/'dashboard.json').write_text(json.dumps(snapshot,indent=2),encoding='utf-8')
Path('benchmark-dashboard/snapshot-hive-repetition.json').write_text(json.dumps(snapshot,indent=2),encoding='utf-8')
print(json.dumps(analysis,indent=2))
