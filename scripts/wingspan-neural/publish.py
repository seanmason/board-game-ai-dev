"""Scoped public evidence publisher. Never copies raw dataset games, venv or .pt.

Use --runtime ROOT --repo EVIDENCE_WORKTREE --once or --deadline UNIX_SECONDS.
--no-git builds reviewable local artifacts without committing/pushing.
"""
from pathlib import Path
from datetime import datetime, timezone
import argparse, hashlib, json, os, shutil, subprocess, time

BRANCH = 'benchmarks/wingspan-neural-2026-10-19'
DESTINATION = 'wingspan-neural'
SOURCE = Path(__file__).resolve().parents[2]
SMALL = [
 'admission.json','seed-audit.json','pilot-launch.json','progress.json','pilot-result.json','pilot-failure.json',
 'requirements-frozen.txt',
 *[f'{stage}/{name}.json' for stage in ['calibration','dataset','canary','screen','confirmation'] for name in ['manifest','checkpoint','summary','analysis','failure']],
 *[f'training/{name}.json' for name in ['training-manifest','selection','loss-curves','offline-report','mlp','linear','parity','failure']],
 'training/requirements-lock.txt',
 *[f'preflight/{name}.json' for name in ['parity','latency','browser','browser-parity','preflight','browser-preflight','summary','report','parity-results','latency-results','browser-results']],
 'execution-source.zip','source-manifest.json','hardware.json',
]

def read(path, default=None):
    try: return json.loads(Path(path).read_text(encoding='utf-8'))
    except (FileNotFoundError, json.JSONDecodeError): return default

def atomic(path, value):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix(path.suffix+'.tmp');tmp.write_text(json.dumps(value,indent=2,allow_nan=False)+'\n',encoding='utf-8')
    for attempt in range(9):
        try: os.replace(tmp,path);return
        except PermissionError:
            if attempt==8: raise
            time.sleep(.025*2**attempt)

def sha(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024), b''): h.update(block)
    return h.hexdigest()

def allowed(path):
    # Literal allowlist, including no raw games and no unrestricted recursion.
    return path in SMALL

def number(n, digits=2):
    return '—' if not isinstance(n,(int,float)) else f'{n:.{digits}f}'

def report(target, dash):
    dataset=read(target/'dataset/manifest.json',{})
    train=read(target/'training/training-manifest.json',{})
    offline=read(target/'training/offline-report.json',{})
    selection=read(target/'training/selection.json',{})
    config=train.get('config',{})
    lines=['# Wingspan neural value pilot','',
        f"Status: **{dash['status']}** · stage **{dash['stage']}** · snapshot {dash['updatedAt']}.",
        f"Recorded {dash['finished']} / {dash['planned']} scheduled actual games across the displayed stages. Data generation and training are not win-rate measurements.",'',
        '[Live dashboard](https://seanmason.github.io/board-game-ai-dev/benchmark-dashboard/?study=wingspan-neural) · [Dataset manifest](dataset/manifest.json) · [Seed audit](seed-audit.json) · [Source archive](execution-source.zip) · [Private-runtime inventory hashes](runtime-inventory.json) · [Model selection](training/selection.json) · [Offline report](training/offline-report.json)','',
        '## Scope and source','',
        'Original 170-bird, two-player Wingspan only. Observation inputs contain each viewer’s separately redacted information; actual final scores supply labels only. All turns, both viewers and related setup groups stay in one split. Calibration is excluded from learning. The data teacher uses the frozen deployed opening-plan package, horizon4, original prior, and independently seeded 80%100/20%300-sample decisions. Complete supplied-root coverage remains mandatory; candidate generation still prunes complete legal play.','',
        f"Dataset profile: `{dataset.get('profile','awaiting manifest')}`. Base Git revision: `{dataset.get('revision',dash.get('revision'))}`. Exact collection files are pinned by dataset manifest source hashes; revision alone does not describe uncommitted frozen modules.",
        f"Feature version: `{dataset.get('featureVersion','awaiting')}`; {len(dataset.get('featureNames',[]))} features. Auxiliary targets: birds, bonuses, goals, eggs, cached and tucked points for both perspectives.",'',
        '## Hardware and training','',
        '| Item | Value |','| --- | --- |',
        '| Data/evaluation CPU pool | At most24 BelowNormal workers; Ryzen9 5950X /32 logical processors |',
        '| Memory / GPU | About96GiB RAM; RTX3080 10GiB; training ceiling6GiB VRAM |',
        f"| Training device | {train.get('cudaDevice',train.get('device','awaiting measured manifest'))} |",
        f"| Python / PyTorch / CUDA | {train.get('pythonVersion','—')} / {train.get('torchVersion','—')} / {train.get('cudaVersion','—')} |",
        '| Networks | Regularized linear control and input→64→32→margin ReLU MLP |',
        '| Fixed value scale / auxiliary loss | Margin30 points; auxiliary coefficient0.1 |',
        '| Optimizer defaults | AdamW learning rate0.001, weight decay0.0001; batch512; at most100 epochs, patience10 |',
        f"| Recorded trainer configuration | `{json.dumps(config,sort_keys=True)}` |",'',
        'Normalization fits train groups only. Three fixed optimization seeds are compared using development Huber loss, then CPU latency, then seed. Test labels do not choose the model. Exported JSON models include normalization, frozen feature names, dense weights, model metadata and point scale. Python/JavaScript and browser parity evidence is retained when available. The selected binary training checkpoints remain outside Git.','',
        f"Selected checkpoint metadata: `{json.dumps(selection.get('selected',{}),sort_keys=True)}`.",
        f"Offline status: **{offline.get('offlineStatus','not evaluated')}**. Held-out learning gate: `{offline.get('heldOutLearning','not evaluated')}`. Offline prediction accuracy does not establish playing strength.",'',
        '## Playing-strength results','',
        '| Comparison | Valid / scheduled | Complete setup pairs | Winner share (descriptive95% paired interval) | Mean margin (95% interval) |',
        '| --- | ---: | ---: | --- | --- |']
    for r in dash['rows']:
        if r.get('metricKind')!='win-share': continue
        w,m=r['winShare'],r['margin']
        share='—' if w['mean'] is None else f"{100*w['mean']:.1f}% [{number(None if w['low'] is None else 100*w['low'],1)}, {number(None if w['high'] is None else 100*w['high'],1)}]%"
        lines.append(f"| {r['matchup']} | {r['counts']['complete']} / {r['planned']} | {r['completeSeedGroups']} / {r['seedGroups']} | {share} | {number(m['mean'])} [{number(m['low'])}, {number(m['high'])}] |")
    if not any(r.get('metricKind')=='win-share' for r in dash['rows']): lines.append('| No strength games recorded | — | — | — | — |')
    lines += ['',
        'One fixed blend uses50% reference relative value plus50% learned viewer-relative margin; the margin prediction is not subtracted twice. Terminal scoring remains exact. Setup/pending or unsupported visibility contexts fall back to the reference. All pilot comparisons request1000ms per whole decision, including preparation, with a soft coverage floor. Linear, corrected-reference and actual-deployed controls remain distinct.','',
        'The screen uses32 fresh paired setups per comparison. A single preselected neural checkpoint can advance only after complete valid results, at least55% winner share and positive margin versus deployed, positive margin versus corrected reference, and mean/p95 latency ceilings1.10/1.25. If eligible, fresh confirmation uses200 pairs versus deployed and100 versus corrected reference. Each superiority claim uses one-sided alpha0.05/2, positive margins, complete validity and the latency gates. The independent unit is the setup pair, not individual observations or games. Partial intervals are descriptive; invalid or incomplete stages cannot establish a passing result. Canary outcomes validate execution only.','']
    for stage in ['screen','confirmation']:
        analysis=read(target/stage/'analysis.json')
        if analysis:
            lines += [f"[{stage.title()} strict analysis]({stage}/analysis.json): complete=`{analysis.get('complete')}`, eligible=`{analysis.get('eligible')}`, adoptionRecommended=`{analysis.get('adoptionRecommended',False)}`.",'']
    lines += ['## Retained evidence and limits','',
        'Raw observations, teacher candidate actions, per-game dataset/evaluation records, virtual environments and .pt checkpoints remain outside Git in the private local runtime. `runtime-inventory.json` records relative filenames, byte sizes and SHA256 digests for completed artifacts, while public manifests retain seed/split assignments and source hashes. Only explicitly allowlisted small summaries, manifests, model/parity/loss JSONs and the source zip are published. Missing linked stages mean no artifact has been produced yet. Favorable, unfavorable, partial and failed summaries are retained.','',
        'This pilot concerns internal two-player simulator comparisons. It does not establish calibrated win probabilities, optimal play, independent human strength, or actual iPad Safari performance. Production defaults remain unchanged; publication is evidence sharing, not automatic promotion.','']
    (target/'REPORT.md').write_text('\n'.join(lines),encoding='utf-8')

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--runtime',required=True);p.add_argument('--repo',required=True);p.add_argument('--node',default='node');p.add_argument('--once',action='store_true');p.add_argument('--deadline',type=float,default=0);p.add_argument('--no-git',action='store_true');args=p.parse_args()
    if not args.once and args.deadline<=time.time(): p.error('Give --once or a future --deadline in Unix seconds')
    runtime=Path(args.runtime).resolve();repo=Path(args.repo).resolve();target=(repo/DESTINATION).resolve()
    if runtime==repo or not target.is_relative_to(repo) or target==runtime or repo==SOURCE: raise RuntimeError('Use a distinct evidence worktree and scoped destination')
    repo.mkdir(parents=True,exist_ok=True)
    if (repo/DESTINATION).is_symlink(): raise RuntimeError('Evidence destination must not be a symlink')
    target.mkdir(exist_ok=True);cached={};inventory={}
    def git(*cmd):
        r=subprocess.run(['git',*cmd],cwd=repo,text=True,encoding='utf-8',errors='replace',capture_output=True,timeout=90)
        if r.returncode: raise RuntimeError(r.stderr or r.stdout)
        return r.stdout.strip()
    while True:
        try:
            if not args.no_git and git('branch','--show-current')!=BRANCH: raise RuntimeError('Wrong evidence branch; refusing Git mutation')
            for rel in SMALL:
                src=runtime/rel
                if not src.is_file(): continue
                if not src.resolve().is_relative_to(runtime): raise RuntimeError('Runtime symlink escapes allowlist')
                if src.stat().st_size>16*1024*1024 and src.suffix!='.zip': raise RuntimeError('Summary unexpectedly exceeds16MiB: '+rel)
                dest=target/rel;dest.parent.mkdir(parents=True,exist_ok=True);stamp=(src.stat().st_size,src.stat().st_mtime_ns)
                if cached.get(rel)!=stamp: shutil.copy2(src,dest);cached[rel]=stamp
            # Hash immutable raw game bytes once per changed file; never copy them.
            for stage in ['calibration','dataset','canary','screen','confirmation']:
                for src in (runtime/stage/'games').glob('*.json'):
                    rel=src.relative_to(runtime).as_posix();stamp=(src.stat().st_size,src.stat().st_mtime_ns)
                    if cached.get('inventory:'+rel)!=stamp:
                        inventory[rel]={'bytes':stamp[0],'sha256':sha(src)};cached['inventory:'+rel]=stamp
            atomic(target/'runtime-inventory.json',{'schemaVersion':1,'storage':'Local runtime outside Git; contents deliberately not published','files':inventory,'fileCount':len(inventory),'bytes':sum(v['bytes'] for v in inventory.values())})
            public_files={}
            for rel in SMALL:
                artifact=target/rel
                if artifact.is_file(): public_files[rel]={'bytes':artifact.stat().st_size,'sha256':sha(artifact)}
            atomic(target/'public-artifacts.json',{'schemaVersion':1,'files':public_files})
            command=[args.node,str(SOURCE/'scripts/wingspan-neural/dashboard.mjs'),'--runtime='+str(runtime)]
            result=subprocess.run(command,cwd=SOURCE,check=True,capture_output=True,text=True,encoding='utf-8',timeout=90)
            dash=json.loads(result.stdout);atomic(target/'dashboard.json',dash);report(target,dash)
            (target/'.gitattributes').write_text('* -text\n',encoding='utf-8')
            if not args.no_git:
                staged=git('diff','--cached','--name-only').splitlines()
                if any(not s.startswith(DESTINATION+'/') for s in staged): raise RuntimeError('Unrelated staged files; refusing commit')
                git('add','--',DESTINATION)
                if git('diff','--cached','--name-only'):
                    git('-c','user.name=Codex','-c','user.email=codex@openai.com','commit','-m',f"Wingspan neural evidence: {dash['stage']} {dash['finished']} games")
                git('push','origin','HEAD:refs/heads/'+BRANCH)
            atomic(runtime/'publication-status.json',{'at':datetime.now(timezone.utc).isoformat(),'success':True,'stage':dash['stage'],'finished':dash['finished'],'destination':DESTINATION,'gitEnabled':not args.no_git})
            print(dash['stage'],dash['status'],dash['finished'],flush=True)
            root_progress=read(runtime/'progress.json',{})
            if args.once or root_progress.get('status') in ['finished','interrupted','deadline']: return
        except Exception as error:
            atomic(runtime/'publication-status.json',{'at':datetime.now(timezone.utc).isoformat(),'success':False,'error':str(error)})
            print(str(error),flush=True)
            if args.once: raise
        if time.time()>=args.deadline: return
        time.sleep(min(90,max(0,args.deadline-time.time())))

if __name__=='__main__': main()
