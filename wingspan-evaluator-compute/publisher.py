from pathlib import Path
import json, subprocess, shutil, time, sys, hashlib, zipfile
from datetime import datetime, timezone
BASE=Path(r'C:\Users\mason\.codex\benchmark-runs\wingspan-evaluator-compute-20261018')
SOURCE=BASE/'study'
REPO=Path(r'C:\Users\mason\OneDrive\Documents\ChatGPT\Board Game AIs\local-run\comparison-publication')
DEST=REPO/'wingspan-evaluator-compute'
BRANCH='benchmarks/ai-comparison-2026-10-18'
SINGLE='--once' in sys.argv
copied={}
def git(*args):
    r=subprocess.run(['git',*args],cwd=REPO,text=True,encoding='utf-8',errors='replace',capture_output=True,timeout=120)
    if r.returncode: raise RuntimeError(r.stderr.strip() or r.stdout.strip())
    return r.stdout.strip()
def read(p): return json.loads(p.read_text(encoding='utf-8'))
def copy_live():
    for src in SOURCE.rglob('*'):
        if not src.is_file() or src.name.endswith('.tmp') or src.suffix=='.log': continue
        rel=src.relative_to(SOURCE)
        stat=src.stat(); key=(stat.st_mtime_ns,stat.st_size)
        if copied.get(str(rel))==key: continue
        target=DEST/rel; target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(src,target);copied[str(rel)]=key

def pct(x): return '-' if x is None else f'{100*x:.1f}%'
def report():
    c=read(SOURCE/'checkpoint.json');d=read(SOURCE/'dashboard.json');m=read(SOURCE/'manifest.json')
    valid=sum(r['counts']['complete'] for r in d['rows'])
    bad=sum(r['finished']-r['counts']['complete'] for r in d['rows'])
    lines=['# Wingspan evaluator and compute study','',f"Status: **{c['status']}**; stage **{c['stage']}**. Snapshot {c['updatedAt']}.",f"Recorded {c['finished']} / {c['planned']} scheduled games; {valid} valid and {bad} invalid records. {len(c['active'])} active games; worker limit {c['workers']}, BelowNormal priority.",'',
    '[Live dashboard](https://seanmason.github.io/board-game-ai-dev/benchmark-dashboard/?study=wingspan-evaluator) · [Frozen protocol](protocol.md) · [Evaluator formulas](methods.md) · [Manifest](manifest.json) · [Checkpoint](checkpoint.json) · [Source archive](execution-source.zip) · [Source archive digest](archive-sha256.txt) · [Seed audit](seed-audit.json)','',
    f"Execution source: `{m['revision']}`. Deployed comparison pipeline is frozen from `66444d1868c364e11712253d73542d50b9cb0705`. Production defaults remain unchanged during research.",'',
    '## Design and decision rules','',
    'Reference plus exceptional-power action economy, ordered sustainable row chains, bounded early investment, and a conservative blend. Each method crosses 100/300 root samples with horizons 4/12 against the fixed reference at 300/4. Horizon counts subsequent ordinary actions across both players, not the acting player alone. The corrected research endpoint finishes pending powers before leaf evaluation; the original deployed pipeline is retained separately.',
    '', 'The screen has 40 fresh seat-swapped setup pairs per cell, 1,600 full games. At most one challenger qualifies using only the 300/4 cell (at least 55% winner share, positive margin, all results valid), ranked by share, margin, stable key. Confirmation uses separate fixed banks: up to six 100-pair comparisons of equal-work strength, sample scaling, horizon scaling, and matched-requested-time strength against deployed R0. If none qualifies, execute only the three reference comparisons. This is 2,200 or 2,800 strength games plus eight prior canaries; no outcome-dependent extra studies.',
    '', 'Fresh superiority requires a one-sided paired-t lower bound above 50% using fixed alpha 0.05/6, positive margin and complete valid results. This is approximate family error control. Promotion additionally requires the equal-work and matched-time gates, with mean latency ratio at most 1.10 and p95 ratio at most 1.25. More compute winning is a separate hypothesis, not a selection rule. Degenerate samples use conservative uncertainty rather than false certainty.',
    '', '## Timing and validation','',
    f"Outcome-blind calibration: 24 fixed diagnostic positions; matched requested-time target **{m['timeBudgetMs']} ms** (ceil median total decision time). Observation, root generation, search initialization and sampling are charged. Mandatory root coverage can overrun the soft target. Timed outcomes can differ under different hardware/load.",
    '', 'Eight reference canaries completed with zero errors, safety caps, unsettled study leaves or uncovered roots. Their original source archive and manifest are preserved under [canary/](canary/). Later challenger-ledger corrections were fixture-tested before screening. Final calibration is [preflight-final/calibration.json](preflight-final/calibration.json); the earlier calibration is retained, superseded for execution.',
    '', 'Local preflight: 945 Node tests passed; syntax checked 354 modules; documentation checked 73 files and 15 packaged entries; dashboard browser checks and the actual 20-card 390-pixel touch layout passed. Automated touch checks do not establish real iPad Safari acceptance. GitHub full Validation separately gates Pages publication.',
    '', 'Initial cost estimate from eight canaries and diagnostic timings: roughly 3-8 hours for the bounded full batch at the original 18 workers, with substantial uncertainty from evaluator cost, power density, and desktop load. No outcome-driven stopping or extra tournaments are authorized by that estimate.',
    '', '## Progress (descriptive, incomplete until scheduled cells finish)','', '| Stage / matchup | Valid / planned | Complete seat pairs | Winner share | Paired 95% interval | Mean margin | Mean candidate decision |','| --- | ---: | ---: | ---: | --- | ---: | ---: |']
    for r in d['rows']:
        w=r['winShare'];margin=r['margin']['mean'];ms=r['meanDecisionMs']
        lines.append(f"| {r['matchup']} | {r['counts']['complete']} / {r['planned']} | {r['completeSeedGroups']} / {r['seedGroups']} | {pct(w['mean'])} | {pct(w['low'])} to {pct(w['high'])} | {'-' if margin is None else f'{margin:.2f}'} | {'-' if ms is None else f'{ms:.1f} ms'} |")
    lines += ['', 'These partial summaries are descriptive. Do not select a winner, claim compute scaling, or change defaults from the live screen. Fixed seed groups are the pairing unit; ties use exact final-outcome share. Invalid/capped records remain in raw evidence and are excluded from valid paired summaries. The runner halts on an invalid result.', '', '## Evidence and reproduction','',
    'Raw immutable per-game JSON appears under [games/](games/); filenames encode task IDs. Execution receipts record actual invocation times and priority. The runner writes screen-analysis.json, selection.json, confirmation-analysis.json and analysis.json only as their stages validate. Source and record SHA256 inventories preserve exact runtime bytes; nested .gitattributes disables line-ending conversion for this evidence folder.', '',
    'For the recorded machine, use the archived 24-worker runtime wrapper to resume the existing execution only after verifying that no runner is active (recorded Node runtime is in execution-receipt.json):', '', '```powershell', 'node PATH_TO_ARCHIVED_RUNTIME_WRAPPER --mode=study --out=EXISTING_EXECUTION_DIRECTORY --workers=24 --calibration=PATH_TO_FROZEN_CALIBRATION_JSON', '```', '',
    'Use exact archived source bytes to satisfy raw hash guards, including Windows line endings. A retained execution can resume only with an identical manifest; never delete invalid or unfavorable records to rerun them.', '',
    'Limits: root choices use the representative generator, not exhaustive legal moves. Heuristics remain bounded approximations; early investment does not forecast gathering actions. Power-flow counters are owner net resource deltas, not exhaustive gross attribution across nested/shared powers. The delayed-discard ledger conservatively matches the current pending model; it does not resolve every unusual physical-card interaction. Legacy R0 endpoint settlement is explicitly uninstrumented, never certified as corrected. Results concern this internal two-player matchup and are not human-strength certification.', '']
    if (SOURCE/'worker-amendment.json').exists():
        am=read(SOURCE/'worker-amendment.json')
        lines += ['## User-authorized worker-count amendment','', 'The user requested 24 workers after the original 18-worker launch. The original manifest, protocol, source archive and calibration remain unchanged. The operational wrapper permits only this manifest-checked concurrency change. It revalidates retained records and all63 frozen source hashes before resuming; evaluator formulas, tasks, seeds, budgets, horizons and decision gates are unchanged.', '', f"At the restart, {am['completedRecordsRetained']} completed games were retained and {len(am['unfinishedIdsRequeued'])} unsaved in-flight games were requeued without recorded outcomes. Screen timing mixes18- and24-worker phases. Confirmation, including matched-time comparisons, runs under24 workers. The original18-worker cost estimate above is historical, not an updated ETA.", '', '[Operational amendment](worker-amendment.json) · [Archived 24-worker wrapper](runtime/runner-workers24.mjs) · [Original 18-worker checkpoint and receipt](executions/initial-18-workers/)', '', 'Wrapper SHA256: `'+am['runnerSha256']+'`.', '', 'The archived wrapper contains paths for the recorded machine and verifies the original manifest and amendment. Relocation or a separate execution requires its own explicit execution manifest; do not reuse this directory for a different study.', '']
    if (SOURCE/'failure.json').exists(): lines += ['## Execution interruption','', 'The runner halted and retained all evidence. See [failure.json](failure.json). No further outcomes are implied.', '']
    if (SOURCE/'analysis.json').exists():
        a=read(SOURCE/'analysis.json');selected=a.get('selection')
        lines += ['## Completed analyses','', '[Final analysis](analysis.json) · [Screen](screen-analysis.json) · [Confirmation](confirmation-analysis.json). Adoption flags are protocol outputs requiring review; production defaults were not changed by this runner.', '', 'Selected challenger: '+(selected['method'] if selected else 'none qualified')+'.', '', '| Fresh comparison | Paired winner share | One-sided corrected lower bound | Mean margin | Superiority gate | Mean / p95 latency ratios |', '| --- | ---: | ---: | ---: | --- | --- |']
        for key,g in a['confirmation']['groups'].items():
            w=g['winShare'];margin=g['margin']['mean'];mean=g.get('meanRatio');tail=g.get('p95Ratio')
            lines.append(f"| {key} | {pct(w['mean'])} | {pct(w['lowerBound'])} | {'-' if margin is None else f'{margin:.2f}'} | {g['superiority']} | {'-' if mean is None else f'{mean:.3f}'} / {'-' if tail is None else f'{tail:.3f}'} |")
        lines += ['', 'Protocol adoption recommendation: **'+str(a['confirmation'].get('adoptionRecommended'))+'**. This flag is not an automatic production change. Failed gates do not establish equivalence; interpret confidence limits and runtime alongside point estimates.', '']
    (DEST/'REPORT.md').write_text('\n'.join(lines),encoding='utf-8')
    return c

def archive_final():
    files=sorted((SOURCE/'games').glob('*.json'))
    inventory={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
    (DEST/'result-sha256.json').write_text(json.dumps(inventory,indent=2),encoding='utf-8')
    zpath=DEST/'raw-results.zip'
    with zipfile.ZipFile(zpath,'w',zipfile.ZIP_DEFLATED) as z:
        for p in files:z.write(p,'games/'+p.name)
    (DEST/'raw-results-sha256.txt').write_text(hashlib.sha256(zpath.read_bytes()).hexdigest()+'  raw-results.zip\n',encoding='utf-8')

while True:
    try:
        if git('branch','--show-current')!=BRANCH:raise RuntimeError('Evidence checkout branch changed')
        copy_live();c=report()
        if c['status'] in ['finished','interrupted']: archive_final()
        git('add','--','wingspan-evaluator-compute')
        if git('diff','--cached','--name-only','--','wingspan-evaluator-compute'):
            git('-c','user.name=Codex','-c','user.email=codex@openai.com','commit','-m',f"Wingspan study: {c['status']} {c['finished']}/{c['planned']} games")
        git('push','origin',BRANCH)
        print(datetime.now(timezone.utc).isoformat(),c['status'],c['finished'],c['planned'],flush=True)
        if SINGLE or c['status'] in ['finished','interrupted']:break
    except Exception as e:
        print(datetime.now(timezone.utc).isoformat(),'publication error:',str(e),flush=True)
        if SINGLE:raise
    time.sleep(90)
