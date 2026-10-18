from pathlib import Path
import json,hashlib,shutil,datetime,subprocess,zipfile

root=Path('C:/Users/mason/.codex/benchmark-runs/good-enough-20261018')
pub=Path('C:/Users/mason/OneDrive/Documents/ChatGPT/Board Game AIs/local-run/comparison-publication/good-enough')
pub.mkdir(parents=True,exist_ok=True)
arms=['love-low','love-high','sushi-low','sushi-high','hive-control','hive-history']
labels={'love-low':'64 samples','love-high':'512 samples','sushi-low':'64 samples','sushi-high':'256 samples','hive-control':'control, 100 ms','hive-history':'history, 100 ms'}
rows=[];hashes={};manifests=[]
for arm in arms:
    d=json.loads((root/arm/'dashboard.json').read_text(encoding='utf-8'))
    assert d['status']=='finished' and d['finished']==d['planned']
    manifests.append(json.loads((root/arm/'manifest.json').read_text(encoding='utf-8')))
    shutil.copytree(root/arm,pub/arm,dirs_exist_ok=True)
    for row in d['rows']:
        row['policyId']+=' ('+labels[arm]+')'
        rows.append(row)
    for p in (pub/arm).rglob('*.json'):
        hashes[p.relative_to(pub).as_posix()]=hashlib.sha256(p.read_bytes()).hexdigest()
analysis=json.loads((root/'analysis.json').read_text(encoding='utf-8'))
assert len({m['revision'] for m in manifests})==1
source_hashes={}
for m in manifests:
    for path,digest in m['hashes'].items():
        if path in source_hashes:assert source_hashes[path]==digest
        source_hashes[path]=digest
source_modes={}
git_blob_hashes={}
with zipfile.ZipFile(pub/'execution-source.zip','w',compression=zipfile.ZIP_DEFLATED) as archive:
    for path,digest in source_hashes.items():
        content=subprocess.check_output(['git','show',analysis['revision']+':'+path])
        raw=Path(path).read_bytes()
        assert hashlib.sha256(raw).hexdigest()==digest,path
        assert raw.replace(b'\r\n',b'\n')==content.replace(b'\r\n',b'\n'),path
        git_blob_hashes[path]=hashlib.sha256(content).hexdigest()
        source_modes[path]={'mode':'exact Git blob bytes' if raw==content else 'retained raw bytes; Git content equal after CRLF-to-LF normalization','crlfCount':raw.count(b'\r\n'),'bareLfCount':raw.count(b'\n')-raw.count(b'\r\n')}
        archive.writestr(path,raw)
(pub/'source-verification.json').write_text(json.dumps({'revision':analysis['revision'],'verifiedSourcePaths':len(source_hashes),'hashes':source_hashes,'gitBlobHashes':git_blob_hashes,'verification':source_modes,'rawSourceArchive':'execution-source.zip','archiveSha256':hashlib.sha256((pub/'execution-source.zip').read_bytes()).hexdigest()},indent=2),encoding='utf-8')
(pub/'result-sha256.json').write_text(json.dumps(hashes,indent=2),encoding='utf-8')
# Preserve exact runtime bytes independently of Git's text newline normalization.
with zipfile.ZipFile(pub/'execution-results.zip','w',compression=zipfile.ZIP_DEFLATED) as archive:
    for path,digest in hashes.items():
        raw=(root/path).read_bytes()
        assert hashlib.sha256(raw).hexdigest()==digest,path
        archive.writestr(path,raw)
normalized_hashes={path:hashlib.sha256((root/path).read_bytes().replace(b'\r\n',b'\n')).hexdigest() for path in hashes}
(pub/'published-json-sha256.json').write_text(json.dumps(normalized_hashes,indent=2),encoding='utf-8')
verification=json.loads((pub/'source-verification.json').read_text(encoding='utf-8'))
verification['rawResultsArchive']='execution-results.zip'
verification['rawResultsArchiveSha256']=hashlib.sha256((pub/'execution-results.zip').read_bytes()).hexdigest()
verification['gitNormalizedJsonFiles']=sum((root/path).read_bytes()!=(root/path).read_bytes().replace(b'\r\n',b'\n') for path in hashes)
(pub/'source-verification.json').write_text(json.dumps(verification,indent=2),encoding='utf-8')

for name in ['analysis.json','execution-receipt.json']:shutil.copy2(root/name,pub/name)
shutil.copy2('docs/work/good-enough-experiments-2026-10-18.md',pub/'PROTOCOL.md')
shutil.copy2('local-run/run-good-enough.py',pub/'run-experiments.py')
shutil.copy2('local-run/publish-good-enough.py',pub/'publish-evidence.py')
snapshot={'schema':1,'study':'good-enough-2026-10-18','revision':analysis['revision'],'updatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'startedAt':min(m['startedAt'] for m in manifests),'status':'finished','workers':18,'planned':1200,'finished':1200,'active':[],'method':'Three families, at most 18 BelowNormal workers (six each). Love Letter 2/4-player and Sushi Go 4-player: matched 40-setup low/high sample screens; Hive: fresh 100-setup completion confirmation. Each setup rotates all candidate seats against the unchanged heuristic. Compare paired budget differences in the report, not overlapping per-arm intervals. Missing Hive outcomes remain unadjudicated; card winner shares condition on complete groups. No browser policy promotion. More samples reduce Monte Carlo noise under the same rollout model; they do not deepen these searches.','rows':rows}
(pub/'dashboard.json').write_text(json.dumps(snapshot,indent=2),encoding='utf-8')
Path('benchmark-dashboard/snapshot-good-enough.json').write_text(json.dumps(snapshot,indent=2),encoding='utf-8')
pct=lambda n:'—' if n is None else f'{100*n:.1f}%'
num=lambda n:'—' if n is None else f'{n:.2f}'
delta=lambda d:'—' if d['mean'] is None else f"{100*d['mean']:+.1f} pp ({100*d['low']:+.1f} to {100*d['high']:+.1f})" if d['low'] is not None else f"{100*d['mean']:+.1f} pp (interval unavailable)"
lines=['''# Compute and practical AI checks — 2026-10-18

All 1,200 scheduled records are retained. This batch contains three exploratory
compute comparisons and one fresh confirmation of Hive completion behavior.
Browser defaults and game rules are unchanged.

[Dashboard](https://seanmason.github.io/board-game-ai-dev/benchmark-dashboard/?study=good-enough) · [Predeclared protocol](PROTOCOL.md) · [Full paired analysis](analysis.json) · [Raw-result hashes](result-sha256.json)

## What this tests

More compute improving results is a useful diagnostic, not a definition of good
play. A useful AI should beat credible simple opponents, finish games reliably,
make legal suggestions, and respond promptly. A strong deterministic heuristic
may need no extra compute; more samples can also reinforce a biased rollout model.
These opponents establish specific comparisons, not expert human playing strength.

Love Letter compares 64/512 samples at two and four players; Sushi Go compares
64/256 at four players, where the earlier comparison has useful headroom. Both
use 40 fresh setups with all candidate seats rotated. Requests have an all-root
coverage floor; actual work is reported. More samples do not deepen the rollout.
Love Letter optimizes round share rather than match share. Sushi Go rolls only
through the current round, with a heuristic pudding adjustment. Sampled opponents
omit some prior private histories; this is model mismatch, not hidden-truth access.

Hive compares tactical-v2/history-v1 at a soft 100 ms on 100 fresh six-ply openings,
both seats. Both retain the 160-turn cap, four-visit repetition stop and mandatory
tactical/depth-one floor. Its primary confirmation endpoint is completion, not
general winning strength. All families face their unchanged simple-v1 heuristic.

## Per-arm results

Winner shares and intervals below use only complete seat-rotation groups. Paired
differences in the following table are the relevant budget comparison.

| Game / players | Arm | Completed / scheduled | Repetition or unresolved / capped | Conditional winner share (95% interval) | Actual iterations / decision | Mean decision |
|---|---|---:|---:|---:|---:|---:|''']
for s in analysis['strata']:
    for side in ['control','candidate']:
        m=s['metrics'][side];w=m['conditionalWinShare'];c=m['counts']
        lines.append(f"| {s['game']} / {s['players']} | {labels[s[side]]} | {c['complete']}/{m['games']} | {c['unresolved']} / {c['capped']} | {pct(w['mean'])} ({pct(w['low'])}–{pct(w['high'])}) | {num(m['iterationsPerDecision'])} | {num(m['decisionWeightedLatencyMs'])} ms |")
lines.append('''
## Matched differences

Each setup is one independent unit, averaging its seat rotations. Differences
are high/candidate minus low/control. Compute-screen intervals are descriptive
95% paired-t intervals across three strata, without multiplicity correction.
Hive has one prespecified primary completion comparison on fresh seeds.

| Game / players | Paired complete setups | Winner-share change (95% interval) | Completion change (95% interval) | Declared criterion met? |
|---|---:|---:|---:|---|''')
for s in analysis['strata']:
    gate=s['gate'].get('passed',s['gate'].get('positiveDescriptiveSupport'))
    lines.append(f"| {s['game']} / {s['players']} | {s['completePairedGroups']}/{s['setupGroups']} | {delta(s['winShareDelta'])} | {delta(s['completionDelta'])} | {gate} |")
lines.append('''
Compute support requires at least five percentage points gain, a paired interval
above zero, and complete valid games. It remains exploratory. Hive confirmation
requires at least ten percentage points better completion, one-sided 97.5% lower
bound above zero, no worse observed-win lower bound, and zero illegal/errors.
No criterion automatically promotes a browser policy or launches another study.

## Incomplete outcomes, score and cost

Caps/repetitions are not draws or losses. All-scheduled winner-share identification
bounds allow each incomplete result any share from zero to one; these are not
confidence intervals. Conditional comparisons may select easier-to-finish games.
''')
for s in analysis['strata']:
    a=s['metrics']['control'];b=s['metrics']['candidate'];lat=s['pairedGameMeanLatencyDeltaMs'];margin=s['marginDelta']
    lines.append(f"- **{s['game']} / {s['players']}:** all-scheduled share bounds {pct(a['observedWinLowerBound'])}–{pct(a['observedWinUpperBound'])} for control and {pct(b['observedWinLowerBound'])}–{pct(b['observedWinUpperBound'])} for candidate. Paired mean-game latency change {num(lat['mean'])} ms (95% {num(lat['low'])} to {num(lat['high'])}); score-margin change {num(margin['mean'])} (95% {num(margin['low'])} to {num(margin['high'])}).")
    if s['game']=='hive':lines.append(f"  Hive lower-bound win-share change: {delta(s['observedWinLowerBoundDelta'])}. Opening audit: {s['openingIdentity']['uniqueSignatures']} unique signatures among {s['setupGroups']} seeds. Actual search-depth and floor-overrun diagnostics are in analysis.json.")
lines.append('''
Love Letter has no invented numerical match margin. Sushi Go margin is controlled
seat score minus mean opponent score, not best-opponent margin. Latency tables
pool decisions; paired latency first averages each game then each setup. Different
game lengths and concurrent load mean these are different weightings. Fixed
iteration choices are deterministic for the pinned inputs; timed Hive searches
can vary with load. The control ran alongside both other families, while the history arm ran mostly alongside Sushi Go. Hive meets its predeclared completion criterion under this execution schedule; the entire difference cannot be attributed to history alone. These are not equal-time cross-policy strength comparisons. Both Hive arms finished only depth one on about 98.5% of decisions, and maximum decisions took 11.36 seconds for control and 8.59 seconds for history. The soft 100 ms target does not establish responsive worst-case latency.

## Provenance and reproduction

Git normalizes CRLF in readable JSON. result-sha256.json verifies exact bytes
in execution-results.zip; published-json-sha256.json verifies normalized Git
blobs. Archive hashes are recorded in source-verification.json.

''')
lines.append('Frozen execution revision: `'+analysis['revision']+'`. All six manifests agree on shared source hashes. [Source verification](source-verification.json) checks retained raw bytes against the execution hashes, then checks equality with the frozen Git contents after CRLF-to-LF normalization. Exact execution bytes are preserved in [execution-source.zip](execution-source.zip); mixed line endings and both hashes are recorded explicitly.')
lines.append('')
for arm in arms:lines.append(f'- [{arm} manifest and tasks]({arm}/manifest.json); raw records are in its games directory.')
lines.append('''
The [execution receipt](execution-receipt.json) records actual process intervals.
Three families used six BelowNormal workers each, at most eighteen total, with
low/control then high/candidate sequentially inside each family. Manifest start
times mark advance planning, not simultaneous execution of six processes.
No extra tournament followed. [Runner](run-experiments.py) and
[publication helper](publish-evidence.py) retain original paths; adjust them on
another machine. The committed `scripts/analyze-good-enough.mjs` accepts explicit
root/output arguments and validates every scheduled result before analysis.

Final interpretation and integration validation are recorded below.
''')
(pub/'REPORT.md').write_text('\n'.join(lines),encoding='utf-8')
print(json.dumps({'publishedRecords':sum(r['planned'] for r in rows),'verifiedSources':len(source_hashes),'hashes':len(hashes),'dashboardRows':len(rows)}))
