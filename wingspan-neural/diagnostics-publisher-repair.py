"""Repair-aware wrapper; original diagnostics-publisher.py bytes remain frozen.
Same CLI. No games/training are launched. Old publishers must be dead first.
"""
from pathlib import Path
import importlib.util,json,re
BASE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('frozen_diagnostics_publisher',BASE/'diagnostics-publisher.py');frozen=importlib.util.module_from_spec(spec);spec.loader.exec_module(frozen)
READ=frozen.read;STRICT=frozen.strict_control;OVERLAY=frozen.overlay;REPORT=frozen.append_report;READY=frozen.publisher_ready
ORIGINAL_SHA='dce37b19110469753467659c7a8bd2217ade255a92a82e4a8cce016ae7b545d7'
if frozen.sha(BASE/'diagnostics-publisher.py')!=ORIGINAL_SHA:raise RuntimeError('Original publisher source changed')
EXTRA=['diagnostics-publisher-repair.py','diagnostics-publisher-repair-tests.py',
 *['constant-control/'+x for x in ['repair-resume-prepared.json','repair-resume-execution.json','repair-resume-checkpoint.json','repair-resume-analysis.json','repair-resume-failure.json','repair-resume-tests.json','resume.mjs','resume-tests.mjs','repair-intent.json','repair-process.json','records-inventory.json','result-sha256.json']],
 'repair-intent.json','repair-process.json','diagnostics-records-inventory.json',
 *['independent-review/'+x for x in ['constant-control-final-review.json','constant-control-repair-final-review.json','constant-control-final-independent-review.json','constant-control-repair-final-independent-review.json','diagnostics-final-review.json']]]
frozen.ALLOW.extend(EXTRA)

def certificate(runtime):
 b=runtime/'constant-control';p=READ(b/'repair-resume-prepared.json',{});e=READ(b/'repair-resume-execution.json',{});t=READ(b/'repair-resume-tests.json',{});o=READ(b/'execution-receipt.json',{});issues=[]
 try:
  if p.get('kind')!='mechanical-transport-validation-repair' or e.get('kind')!=p.get('kind'):issues.append('repair-kind')
  failure=READ(b/'failure.json',{}).get('error','').splitlines()
  if not failure or not re.fullmatch(r'Error: Invalid game .*: frozen-task-startedAt',failure[0]):issues.append('original-failure-not-mechanical')
  original=frozen.sha(b/'execution-receipt.json');plan=frozen.sha(b/'plan.json')
  if p.get('originalReceiptSha256')!=original or e.get('originalReceiptSha256')!=original:issues.append('original-receipt-sha')
  if p.get('planSha256')!=plan or e.get('planSha256')!=plan or o.get('planSha256')!=plan:issues.append('original-plan-sha')
  if e.get('preparedSha256')!=frozen.sha(b/'repair-resume-prepared.json'):issues.append('prepared-sha')
  if p.get('sourceSha256')!=frozen.sha(b/'resume.mjs') or e.get('sourceSha256')!=p.get('sourceSha256'):issues.append('repair-source-sha')
  if p.get('testsSha256')!=frozen.sha(b/'resume-tests.mjs') or t.get('status')!='passed':issues.append('repair-tests-sha-or-status')
  if o.get('startedAt')!='2026-10-19T13:56:48.668Z' or o.get('deadline')!='2026-10-19T14:11:48.668Z':issues.append('original-clock')
  for k in ['startedAt','deadline']:
   if p.get(k)!=o.get(k) or e.get(k)!=o.get(k):issues.append('repair-clock-'+k)
  if t.get('originalStartedAt')!=o.get('startedAt') or t.get('originalDeadline')!=o.get('deadline'):issues.append('tests-clock')
  if set(p.get('originalHashes',{}))!={'execution-receipt.json','failure.json','checkpoint.json','analysis.json'}:issues.append('original-artifact-inventory')
  for name,sha in p.get('originalHashes',{}).items():
   if frozen.sha(b/name)!=sha:issues.append('original-artifact-changed-'+name)
  plan_data=READ(b/'plan.json',{})
  if e.get('modelHashes')!=plan_data.get('modelHashes'):issues.append('repair-model-sha')
 except (OSError,TypeError):issues.append('missing-repair-certificate')
 return not issues,issues

def repair_read(path,default=None):
 path=Path(path)
 if path.parent.name=='constant-control' and path.name in ['analysis.json','checkpoint.json']:
  runtime=path.parent.parent
  if certificate(runtime)[0]:path=path.with_name('repair-resume-'+path.name)
 return READ(path,default)

def strict(runtime):
 ok,issues=certificate(runtime)
 if not ok:return False,['repair-certificate:'+x for x in issues]
 cp=READ(runtime/'constant-control/repair-resume-checkpoint.json',{});analysis=READ(runtime/'constant-control/repair-resume-analysis.json',{})
 if cp.get('status')!='finished' or analysis.get('complete') is not True:return False,['repaired-control-not-complete']
 return STRICT(runtime)

def overlay(base,runtime):
 dash=OVERLAY(base,runtime);ok,issues=certificate(runtime);cp=READ(runtime/'constant-control/repair-resume-checkpoint.json',{});r=dash['rows'][-1]
 r['repairCertificate']={'valid':ok,'issues':issues,'analysis':'constant-control/repair-resume-analysis.json','originalFailure':'constant-control/failure.json'}
 if ok:
  if strict(runtime)[0]:dash['status']='finished';dash['stage']='diagnostics-complete-repaired'
  elif cp.get('status')=='running':dash['status']='running';dash['stage']='constant-control-mechanical-resume'
  elif cp.get('status') in ['deadline','interrupted']:dash['status']=cp['status'];dash['stage']='constant-control-repair-'+cp['status']
  elif cp.get('status')=='finished':dash['status']='interrupted';dash['stage']='constant-control-repair-validation-failed'
  r['limitations'].append('A transient transport startedAt field caused the original validator failure. Mechanical repair retains original tasks, models, source, prior records and original deadline; original failed evidence is preserved separately.')
 else:dash['status']='interrupted';dash['stage']='constant-control-repair-certificate-invalid'
 return dash

def append_report(target,dash,runtime):
 REPORT(target,dash,runtime);p=target/'REPORT.md';text=p.read_text(encoding='utf-8');prefix,section=text.split(frozen.START,1)
 section=section.replace('[Strict control analysis](constant-control/analysis.json)','[Strict repaired control analysis](constant-control/repair-resume-analysis.json)')
 explanation='\n\nMechanical transport-validation repair: the original validator mistakenly treated a scheduler-only startedAt field as a frozen task field. The original [failure](constant-control/failure.json), [failed analysis](constant-control/analysis.json), [checkpoint](constant-control/checkpoint.json) and [execution receipt](constant-control/execution-receipt.json) are retained unchanged. The [repair preparation](constant-control/repair-resume-prepared.json), [execution certificate](constant-control/repair-resume-execution.json), [tests](constant-control/repair-resume-tests.json), [repaired checkpoint](constant-control/repair-resume-checkpoint.json) and [repaired analysis](constant-control/repair-resume-analysis.json) identify the resumed accounting. All64 tasks, models and the original deadline2026-10-19T14:11:48.668Z remain fixed. Only a valid repair certificate enables repaired progress, and all final64-game/32-pair/model guards still apply. No new games or new clock are introduced by this publisher.\n\n'
 section=section.replace('## Post-pilot exploratory diagnostics','## Post-pilot exploratory diagnostics'+explanation,1);p.write_text(prefix+frozen.START+section,encoding='utf-8')

def ready(runtime):
 ok,reason=READY(runtime)
 if not ok:return ok,reason
 old=READ(runtime/'diagnostics-publisher-process.json',{})
 if not isinstance(old.get('pid'),int):return False,'original diagnostics publisher receipt missing'
 if frozen.process_alive(old['pid']):return False,'original diagnostics publisher still alive; evidence untouched'
 return True,'all original publishers stopped'
frozen.read=repair_read;frozen.strict_control=strict;frozen.overlay=overlay;frozen.append_report=append_report;frozen.publisher_ready=ready
if __name__=='__main__':frozen.main()
