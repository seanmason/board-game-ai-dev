"""Retrying evidence publisher, isolated from the current study's Git checkout."""
from pathlib import Path
import argparse,json,subprocess,time,shutil,hashlib
from datetime import datetime,timezone
def main():
    p=argparse.ArgumentParser();p.add_argument('--config',required=True);p.add_argument('--deadline',type=float,default=0);p.add_argument('--once',action='store_true');args=p.parse_args()
    config=json.loads(Path(args.config).read_text(encoding='utf-8'));source=Path(config['out']);repo=Path(config['publicationRepo']);target=repo/'wingspan-overnight';target.mkdir(exist_ok=True)
    copied={}
    def git(*cmd):
        r=subprocess.run(['git',*cmd],cwd=repo,text=True,encoding='utf-8',errors='replace',capture_output=True,timeout=60)
        if r.returncode: raise RuntimeError(r.stderr or r.stdout)
        return r.stdout.strip()
    while args.once or time.time()<args.deadline:
        try:
            if git('branch','--show-current')!=config['publicationBranch']: raise RuntimeError('Wrong evidence branch')
            for f in source.rglob('*'):
                if not f.is_file() or f.suffix in ['.tmp','.log','.lock'] or f.name in ['ready.json','publication-status.json']: continue
                rel=f.relative_to(source);stamp=(f.stat().st_size,f.stat().st_mtime_ns)
                if copied.get(str(rel))==stamp: continue
                dest=target/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,dest);copied[str(rel)]=stamp
            cp=json.loads((source/'checkpoint.json').read_text(encoding='utf-8'))
            dash=json.loads((source/'dashboard.json').read_text(encoding='utf-8'))
            lines=['# Wingspan unattended investigation','',f"Status: **{cp['status']}**, stage **{cp['stage']}**. Updated {cp['updatedAt']}.",f"Recorded {cp['finished']} / {cp['planned']} scheduled games; maximum30 BelowNormal workers. Deadline {cp.get('deadline','not launched')}.",'',
                '[Live dashboard](https://seanmason.github.io/board-game-ai-dev/benchmark-dashboard/?study=wingspan-overnight) · [Protocol](protocol.md) · [Checkpoint](checkpoint.json) · [Source archive](execution-source.zip) · [Manifest](manifest.json) · [Admission](admission.json) · [Diagnostic records](diagnostics/) · [Raw games](games/)','',
                'The existing study finishes first. Fixed ten-minute mechanism diagnostics precede eight canary games. Timing alone admits a full60-pair screen/200-pair confirmations profile, a compact40/100 profile, or no strength stage. Four interventions face the same reference at1000ms requested per decision. Actual coverage can overrun. At mostone finalist must pass fresh comparisons against that reference AND the frozen deployed AI. Corrected one-sided alpha0.05/3, paired setup unit, positive margin and latency ceilings apply. No automatic promotion. Optional scaling is omitted from this launch to protect completion.','',
                '| Comparison | Valid / scheduled | Complete pairs | Winner share | Mean margin |','| --- | ---: | ---: | ---: | ---: |']
            for row in dash['rows']:
                w=row['winShare']['mean'];m=row['margin']['mean']
                lines.append(f"| {row['matchup']} | {row['counts']['complete']} / {row['planned']} | {row['completeSeedGroups']} / {row['seedGroups']} | {'—' if w is None else f'{100*w:.1f}%'} | {'—' if m is None else f'{m:.2f}'} |")
            lines+=['','Partial summaries are descriptive. Invalid, incomplete and deadline-truncated stages cannot pass. Canary outcomes are validation evidence only. The raw source snapshot, hashed seed audit and per-game records preserve favorable and unfavorable results. Study results concern internal two-player comparisons, not human strength or real iPad latency.','']
            if (source/'analysis.json').exists():
                a=json.loads((source/'analysis.json').read_text(encoding='utf-8'));lines+=['[Final analysis](analysis.json)', '', 'Protocol recommendation supported: **'+str(a.get('adoptionRecommended',False))+'**. Production defaults unchanged.','']
            (target/'REPORT.md').write_text('\n'.join(lines),encoding='utf-8');(target/'.gitattributes').write_text('* -text\n',encoding='utf-8')
            if cp['status'] in ['finished','deadline','interrupted']:
                inventory={str(f.relative_to(source)):hashlib.sha256(f.read_bytes()).hexdigest() for f in (source/'games').glob('*.json')}
                (target/'result-sha256.json').write_text(json.dumps(inventory,indent=2),encoding='utf-8')
            git('add','--','wingspan-overnight')
            if git('diff','--cached','--name-only'): git('-c','user.name=Codex','-c','user.email=codex@openai.com','commit','-m',f"Wingspan overnight: {cp['status']} {cp['finished']} games")
            git('push','origin',config['publicationBranch'])
            (source/'publication-status.json').write_text(json.dumps({'at':datetime.now(timezone.utc).isoformat(),'success':True,'finished':cp['finished']}),encoding='utf-8')
            print(cp['status'],cp['finished'],flush=True)
            if args.once or cp['status'] in ['finished','deadline','interrupted']: return
        except Exception as error:
            (source/'publication-status.json').write_text(json.dumps({'at':datetime.now(timezone.utc).isoformat(),'success':False,'error':str(error)}),encoding='utf-8')
            print(str(error),flush=True)
            if args.once: raise
        time.sleep(min(90,max(0,args.deadline-time.time())))
if __name__=='__main__': main()
