"""Synthetic-only publisher tests; no actual pilot files are opened or changed."""
import ctypes,importlib.util,json,hashlib,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace
if hasattr(ctypes,'windll'):
 k=ctypes.windll.kernel32;k.SetPriorityClass.argtypes=[ctypes.c_void_p,ctypes.c_uint32];assert k.SetPriorityClass(ctypes.c_void_p(-1),0x4000)
spec=importlib.util.spec_from_file_location('diagnostics_publisher',Path(__file__).with_name('diagnostics-publisher.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def write(path,value):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(value),encoding='utf-8')
def complete(runtime):
 base=runtime/'constant-control';real=base/'models/real.json';zero=base/'models/zero.json';write(real,{'test':'real'});write(zero,{'test':'zero'});write(runtime/'training/mlp.json',{'test':'real'})
 hashes={'neural':m.sha(real),'linear':m.sha(zero)};tasks=[{'id':str(seed)+'/'+str(seat),'seed':seed,'seat':seat} for seed in range(32) for seat in [0,1]]
 plan={'tasks':tasks,'modelHashes':hashes,'modelFiles':{'neural':'models/real.json','linear':'models/zero.json'},'sourceRealModelSha256':hashes['neural'],'sourceHashes':{},'controlHashes':{}}
 write(base/'plan.json',plan);plan_sha=m.sha(base/'plan.json');write(base/'prepared.json',{'planSha256':plan_sha,'modelHashes':hashes});write(base/'execution-receipt.json',{'planSha256':plan_sha,'modelHashes':hashes});write(base/'checkpoint.json',{'status':'finished','planned':64,'finished':64});write(runtime/'training/offline-report.json',{'selectedModelSha256':hashes['neural']})
 a={'status':'finished','complete':True,'planned':64,'received':64,'valid':64,'independentPairs':32,'issues':[],'missing':[],'modelHashes':hashes,'pairs':[{'seed':seed,'share':.5,'margin':1} for seed in range(32)],'realModelWinnerShare':{'n':32,'mean':.5,'ci95':[.4,.6]},'realModelScoreMargin':{'n':32,'mean':1,'ci95':[0,2]}}
 write(base/'analysis.json',a);return a

def base():return {'schema':1,'rows':[{'matchup':'original-confirmation','winShare':{'mean':.7}}],'status':'finished','stage':'complete','finished':792,'planned':792,'method':'Original fixed pilot.'}
class Tests(unittest.TestCase):
 def test_waits_until_pilot_and_original_publisher_finished(self):
  with tempfile.TemporaryDirectory(prefix='diag-publisher-test-') as d:
   r=Path(d);write(r/'progress.json',{'status':'running'});self.assertFalse(m.publisher_ready(r,lambda p:False)[0]);write(r/'progress.json',{'status':'finished'});write(r/'pilot-result.json',{'status':'finished'});write(r/'publication-status.json',{'success':True,'stage':'complete'});write(r/'publisher-process.json',{'pid':1234});self.assertFalse(m.publisher_ready(r,lambda p:True)[0]);self.assertTrue(m.publisher_ready(r,lambda p:False)[0])
 def test_incomplete_never_has_a_win_statistic(self):
  with tempfile.TemporaryDirectory(prefix='diag-publisher-test-') as d:
   r=Path(d);write(r/'constant-control/checkpoint.json',{'finished':32,'planned':64,'status':'running'});dash=m.overlay(base(),r);row=dash['rows'][-1];self.assertEqual(row['metricKind'],'progress');self.assertIsNone(row['winShare']['mean']);self.assertEqual(dash['rows'][0],base()['rows'][0])
 def test_only_strict_complete_hash_matching_control_has_win_share(self):
  with tempfile.TemporaryDirectory(prefix='diag-publisher-test-') as d:
   r=Path(d);complete(r);self.assertEqual(m.strict_control(r),(True,[]));row=m.overlay(base(),r)['rows'][-1];self.assertEqual(row['metricKind'],'win-share');self.assertEqual(row['winShare']['n'],32);self.assertEqual(row['winShare']['mean'],.5);(r/'constant-control/models/zero.json').write_text('changed');self.assertFalse(m.strict_control(r)[0]);self.assertIsNone(m.overlay(base(),r)['rows'][-1]['winShare']['mean'])
 def test_invalid_summary_or_pairs_cannot_show_win_share(self):
  with tempfile.TemporaryDirectory(prefix='diag-publisher-test-') as d:
   r=Path(d);a=complete(r);a['pairs'][0]['share']=2;write(r/'constant-control/analysis.json',a);self.assertFalse(m.strict_control(r)[0]);self.assertEqual(m.overlay(base(),r)['rows'][-1]['metricKind'],'progress')
 def test_allowlist_and_append_preserve_main_without_raw_copy(self):
  with tempfile.TemporaryDirectory(prefix='diag-publisher-test-') as d:
   root=Path(d);r=root/'runtime';repo=root/'evidence';source=root/'source';target=repo/'wingspan-neural';source.mkdir();target.mkdir(parents=True);(target/'REPORT.md').write_text('MAIN-PILOT-RESULTS\n');write(r/'progress.json',{'status':'finished'});write(r/'pilot-result.json',{'status':'finished'});write(r/'publication-status.json',{'success':True,'stage':'complete'});write(r/'publisher-process.json',{'pid':99999999});write(r/'diagnostics-progress.json',{'status':'running','stage':'feature-capacity'});write(r/'feature-capacity-probe/plan.json',{'cells':[{'id':'compact'}]});write(r/'feature-capacity-probe/cells/compact/dev-report.json',{'devLoss':.1});write(r/'constant-control/results/games/private.json',{'secret':'DO-NOT-PUBLISH'});write(r/'venv/private.json',{'secret':'DO-NOT-PUBLISH'});p=r/'feature-capacity-probe/cells/compact/checkpoint.pt';p.write_text('DO-NOT-PUBLISH');original=(r/'progress.json').read_bytes()
   with patch.object(m.subprocess,'run',return_value=SimpleNamespace(stdout=json.dumps(base()),returncode=0)):
    result=m.publish_once(r,repo,source,no_git=True)
   self.assertTrue(result['success']);self.assertFalse((target/'constant-control/results/games').exists());self.assertFalse((target/'venv').exists());self.assertFalse((target/'feature-capacity-probe/cells/compact/checkpoint.pt').exists());self.assertTrue((target/'feature-capacity-probe/cells/compact/dev-report.json').exists());self.assertEqual((r/'progress.json').read_bytes(),original);text=(target/'REPORT.md').read_text();self.assertTrue(text.startswith('MAIN-PILOT-RESULTS'));self.assertEqual(text.count(m.START),1);m.append_report(target,m.overlay(base(),r),r);self.assertEqual((target/'REPORT.md').read_text().count(m.START),1)

 def test_capacity_row_explicit_nulls_never_imply_failed_heldout_gate(self):
  with tempfile.TemporaryDirectory(prefix='diag-publisher-test-') as d:
   r=Path(d);training=m.overlay(base(),r)['rows'][-2]['training']
   for key in ['heldOutLearning','latestFit','selected']:self.assertIn(key,training);self.assertIsNone(training[key])
 def test_small_followup_receipts_and_sources_are_explicitly_allowlisted(self):
  expected={'followups.py','diagnostics-launch.json','diagnostics-result.json','diagnostics-failure.json','supervisor-tests/followups-tests.py','independent-review/canary-inference-accounting.json'}
  self.assertTrue(expected.issubset(set(m.ALLOW)));self.assertFalse(any(x.endswith('.pt') or '/games/' in x or 'venv/' in x for x in m.ALLOW))
 def test_degenerate_margin_shows_point_without_interval_but_winner_ci_remains_required(self):
  with tempfile.TemporaryDirectory(prefix='diag-publisher-test-') as d:
   r=Path(d);a=complete(r);a['realModelScoreMargin'].update(ci95=None,degenerate=True);write(r/'constant-control/analysis.json',a)
   self.assertTrue(m.strict_control(r)[0]);dash=m.overlay(base(),r);row=dash['rows'][-1];self.assertEqual(row['metricKind'],'win-share');self.assertEqual(row['margin']['mean'],1);self.assertIsNone(row['margin']['low']);self.assertTrue(any('zero observed variation' in text for text in row['limitations']))
   target=r/'evidence';target.mkdir();(target/'REPORT.md').write_text('MAIN RESULT');m.append_report(target,dash,r);self.assertIn('degenerate sample',(target/'REPORT.md').read_text())
   a['realModelWinnerShare'].update(ci95=None,degenerate=True);write(r/'constant-control/analysis.json',a);self.assertFalse(m.strict_control(r)[0])

if __name__=='__main__':unittest.main()
