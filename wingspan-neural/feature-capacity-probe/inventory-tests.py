"""Synthetic inventory only: no Torch import, fit, GPU use, or board-game run."""
from pathlib import Path
import importlib.util,json,tempfile,unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('capacity_probe',Path(__file__).with_name('probe.py'));p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
BASE=Path(__file__).resolve().parent
class InventoryTests(unittest.TestCase):
 def fixture(self):
  temp=tempfile.TemporaryDirectory(dir=BASE);self.addCleanup(temp.cleanup);root=Path(temp.name);(root/'games').mkdir()
  tasks=[];sources=[]
  for split,seed in [('train',1),('dev',2),('test',3)]:
   task={'id':split+'-game','seed':seed,'split':split};tasks.append(task);path=root/'games'/(split+'.json')
   if split=='test':path.write_text('POISON: MUST NEVER BE OPENED',encoding='utf-8');continue
   examples=[{'gameId':task['id'],'setupSeed':seed,'split':split,'step':1,'viewer':viewer,'round':1,'features':[viewer],'targetMargin':5 if viewer==0 else -5,'targetAux':[0]*12} for viewer in [0,1]]
   p.write(path,{'task':task,'result':{'status':'complete','scores':[75,70]},'validation':{'valid':True},'valueExamples':examples});sources.append({'taskId':task['id'],'file':str(path.relative_to(root)),'sha256':p.digest(path)})
  p.write(root/'manifest.json',{'featureVersion':'synthetic','featureNames':['one'],'tasks':tasks})
  plan={'datasetRoot':str(root),'datasetManifestSha256':p.digest(root/'manifest.json'),'featureVersion':'synthetic','fullFeatureNames':['one'],'dataSources':sources}
  return root,plan
 def test_test_files_are_never_opened_or_listed(self):
  root,plan=self.fixture();forbidden=root/'games/test.json';real_bytes=Path.read_bytes;real_text=Path.read_text
  def rb(path,*a,**kw):
   if path.resolve()==forbidden.resolve():raise AssertionError('TEST DATA OPENED')
   return real_bytes(path,*a,**kw)
  def rt(path,*a,**kw):
   if path.resolve()==forbidden.resolve():raise AssertionError('TEST DATA OPENED')
   return real_text(path,*a,**kw)
  with patch.object(Path,'read_bytes',rb),patch.object(Path,'read_text',rt),patch.object(Path,'glob',side_effect=AssertionError('No data glob permitted')):
   rows,opened=p.load_train_dev(plan)
  self.assertEqual(set(rows),{'train','dev'});self.assertEqual(len(opened),2);self.assertNotIn(str(forbidden),opened)
 def test_missing_train_dev_task_fails_closed(self):
  root,plan=self.fixture();plan['dataSources'].pop()
  with self.assertRaisesRegex(ValueError,'inventory'):p.load_train_dev(plan)
 def test_test_task_injected_in_inventory_rejected_before_open(self):
  root,plan=self.fixture();plan['dataSources'].append({'taskId':'test-game','file':'games/test.json','sha256':'bad'})
  with self.assertRaisesRegex(ValueError,'inventory'):p.load_train_dev(plan)
 def test_changed_train_bytes_fail_hash_guard(self):
  root,plan=self.fixture();(root/'games/train.json').write_text('{}',encoding='utf-8')
  with self.assertRaisesRegex(ValueError,'bytes changed'):p.load_train_dev(plan)
 def test_outside_game_path_rejected(self):
  root,plan=self.fixture();plan['dataSources'][0]['file']='manifest.json'
  with self.assertRaisesRegex(ValueError,'outside'):p.load_train_dev(plan)
 def test_frozen_probe_contains_no_offline_test_evaluation_call(self):
  source=Path(p.__file__).read_text(encoding='utf-8')
  self.assertNotIn('.evaluate_offline(',source);self.assertNotIn('.load_dataset(',source)
  self.assertNotIn("rows['test']",source)
if __name__=='__main__':unittest.main(verbosity=2)
