"""Synthetic repair-publication tests only; no actual control artifacts consumed."""
from pathlib import Path
import ctypes,importlib.util,json,tempfile,unittest
if hasattr(ctypes,'windll'):
 k=ctypes.windll.kernel32;k.SetPriorityClass.argtypes=[ctypes.c_void_p,ctypes.c_uint32];assert k.SetPriorityClass(ctypes.c_void_p(-1),0x4000)
ROOT=Path(__file__).parent
spec=importlib.util.spec_from_file_location('repair_publisher',ROOT/'diagnostics-publisher-repair.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def write(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v),encoding='utf-8')
def fixture(r):
 b=r/'constant-control';write(b/'models/real.json',{'test':'real'});write(b/'models/zero.json',{'test':'zero'});write(r/'training/mlp.json',{'test':'real'});h={'neural':m.frozen.sha(b/'models/real.json'),'linear':m.frozen.sha(b/'models/zero.json')};tasks=[{'id':str(s)+'/'+str(v),'seed':s,'seat':v} for s in range(32) for v in [0,1]]
 p={'tasks':tasks,'modelHashes':h,'modelFiles':{'neural':'models/real.json','linear':'models/zero.json'},'sourceRealModelSha256':h['neural'],'sourceHashes':{},'controlHashes':{}};write(b/'plan.json',p);plan=m.frozen.sha(b/'plan.json');write(b/'prepared.json',{'planSha256':plan,'modelHashes':h});o={'planSha256':plan,'modelHashes':h,'startedAt':'2026-10-19T13:56:48.668Z','deadline':'2026-10-19T14:11:48.668Z'};write(b/'execution-receipt.json',o);write(b/'failure.json',{'error':'Error: Invalid game synthetic: frozen-task-startedAt'});write(b/'checkpoint.json',{'status':'interrupted','finished':1});write(b/'analysis.json',{'status':'interrupted','complete':False,'received':1});write(r/'training/offline-report.json',{'selectedModelSha256':h['neural']});(b/'resume.mjs').write_text('repair source');(b/'resume-tests.mjs').write_text('repair tests')
 original=m.frozen.sha(b/'execution-receipt.json');prep={'kind':'mechanical-transport-validation-repair','planSha256':plan,'originalReceiptSha256':original,'sourceSha256':m.frozen.sha(b/'resume.mjs'),'testsSha256':m.frozen.sha(b/'resume-tests.mjs'),'startedAt':o['startedAt'],'deadline':o['deadline'],'originalHashes':{n:m.frozen.sha(b/n) for n in ['execution-receipt.json','failure.json','checkpoint.json','analysis.json']}};write(b/'repair-resume-prepared.json',prep);write(b/'repair-resume-execution.json',{**prep,'preparedSha256':m.frozen.sha(b/'repair-resume-prepared.json'),'modelHashes':h});write(b/'repair-resume-tests.json',{'status':'passed','originalStartedAt':o['startedAt'],'originalDeadline':o['deadline']});write(b/'repair-resume-checkpoint.json',{'status':'running','planned':64,'finished':10})
 a={'status':'finished','complete':True,'planned':64,'received':64,'valid':64,'independentPairs':32,'issues':[],'missing':[],'modelHashes':h,'pairs':[{'seed':s,'share':.5,'margin':1} for s in range(32)],'realModelWinnerShare':{'n':32,'mean':.5,'ci95':[.4,.6]},'realModelScoreMargin':{'n':32,'mean':1,'ci95':[0,2]}}
 return a
BASE={'schema':1,'rows':[],'status':'finished','stage':'complete','finished':792,'planned':792}
class Tests(unittest.TestCase):
 def test_incomplete_repair_progress_no_winner_statistic(self):
  with tempfile.TemporaryDirectory(prefix='repair-pub-test-') as d:
   r=Path(d);fixture(r);self.assertTrue(m.certificate(r)[0]);dash=m.overlay(BASE,r);self.assertEqual(dash['status'],'running');self.assertEqual(dash['rows'][-1]['finished'],10);self.assertIsNone(dash['rows'][-1]['winShare']['mean'])
 def test_final_repaired_analysis_requires_certificate_and_preserves_original(self):
  with tempfile.TemporaryDirectory(prefix='repair-pub-test-') as d:
   r=Path(d);a=fixture(r);original=(r/'constant-control/analysis.json').read_bytes();write(r/'constant-control/repair-resume-checkpoint.json',{'status':'finished','planned':64,'finished':64});write(r/'constant-control/repair-resume-analysis.json',a);self.assertEqual(m.strict(r),(True,[]));dash=m.overlay(BASE,r);self.assertEqual(dash['status'],'finished');self.assertEqual(dash['rows'][-1]['winShare']['mean'],.5);self.assertEqual((r/'constant-control/analysis.json').read_bytes(),original)
   target=r/'public';target.mkdir();(target/'REPORT.md').write_text('ORIGINAL PILOT');m.append_report(target,dash,r);text=(target/'REPORT.md').read_text();self.assertIn('repair-resume-analysis.json',text);self.assertIn('failed analysis',text);self.assertTrue(text.startswith('ORIGINAL PILOT'))
 def test_bad_receipt_or_clock_suppresses_repair_results(self):
  with tempfile.TemporaryDirectory(prefix='repair-pub-test-') as d:
   r=Path(d);a=fixture(r);write(r/'constant-control/repair-resume-checkpoint.json',{'status':'finished','planned':64,'finished':64});write(r/'constant-control/repair-resume-analysis.json',a);p=r/'constant-control/execution-receipt.json';o=json.loads(p.read_text());o['deadline']='2026-10-19T14:12:48.668Z';write(p,o);self.assertFalse(m.certificate(r)[0]);self.assertIsNone(m.overlay(BASE,r)['rows'][-1]['winShare']['mean'])
if __name__=='__main__':unittest.main()
