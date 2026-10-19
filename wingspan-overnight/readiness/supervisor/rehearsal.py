"""Synthetic supervisor rehearsal. All process/network/power-management boundaries are mocks."""
from pathlib import Path
import contextlib, hashlib, importlib.util, io, json, sys, types, unittest
from unittest.mock import patch, Mock
from datetime import datetime

sys.dont_write_bytecode=True
BASE=Path(r'C:\Users\mason\.codex\benchmark-runs\wingspan-overnight-20261018\preparation-supervisor')
READY=Path(r'C:\Users\mason\.codex\benchmark-runs\wingspan-overnight-20261018\campaign\ready.json')
config_template=json.loads(READY.read_text(encoding='utf-8'))
ready_hash=hashlib.sha256(READY.read_bytes()).hexdigest()
source=Path(config_template['root'])/'scripts/wingspan-overnight/launcher.py'
source_hash=hashlib.sha256(source.read_bytes()).hexdigest()
assert source_hash==config_template['hashes']['scripts/wingspan-overnight/launcher.py']
spec=importlib.util.spec_from_file_location('synthetic_overnight_launcher',source)
launcher=importlib.util.module_from_spec(spec);spec.loader.exec_module(launcher)
EVENTS=[]

def save(path,value):
 path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(value,indent=2),encoding='utf-8')
def read(path): return json.loads(path.read_text(encoding='utf-8'))

class FakeProcess:
 def __init__(self,name,pid): self.name=name;self.pid=pid;self.returncode=0 if name=='runner' else None
 def poll(self): return self.returncode
 def wait(self,timeout=None): EVENTS.append({'event':'mock-wait','process':self.name,'timeout':timeout});self.returncode=0;return 0
 def kill(self): raise AssertionError('No process termination should occur in these rehearsals')
 def terminate(self): raise AssertionError('No process termination should occur in these rehearsals')

class SupervisorRehearsal(unittest.TestCase):
 def prepare(self,name,prior_status='finished',prior_complete=True):
  root=BASE/name;root.mkdir(exist_ok=False);out=root/'out';previous=root/'prior';previous.mkdir()
  config={**config_template,'out':str(out),'previousStudy':str(previous),'previousRunnerPid':424242,
    'previousWrapper':str(root/'mock-prior-wrapper.mjs'),'hashes':{},
    'syntheticRehearsal':True,'purpose':'Mocked control-flow rehearsal only; no workers, network or campaign execution.'}
  save(previous/'checkpoint.json',{'status':prior_status,'active':[]})
  save(previous/'analysis.json',{'screen':{'complete':prior_complete},'confirmation':{'complete':prior_complete}})
  path=root/'fixture-config.json';save(path,config)
  return root,out,previous,config,path
 def invoke(self,config,path,prior_alive=False):
  spawns=[];awake=[];stderr=io.StringIO()
  def fake_check(value):
   self.assertTrue(value['syntheticRehearsal']);EVENTS.append({'event':'mock-check','case':path.parent.name});return {'ready':True,'synthetic':True}
  def fake_spawn(command,root,out,name):
   self.assertEqual(Path(out),Path(config['out']));spawns.append((name,list(command)))
   EVENTS.append({'event':'mock-spawn','case':path.parent.name,'name':name,'command':list(command)})
   if name=='runner':
    cp=read(Path(out)/'checkpoint.json');cp.update(status='finished',stage='complete',planned=12,finished=12,active=[]);save(Path(out)/'checkpoint.json',cp)
    dash=read(Path(out)/'dashboard.json');dash.update(status='finished',stage='complete',planned=12,finished=12,active=[]);save(Path(out)/'dashboard.json',dash)
   return FakeProcess(name,88002 if name=='runner' else 88001)
  def fake_owned(pid,marker):
   self.assertEqual(pid,424242);EVENTS.append({'event':'mock-owned','case':path.parent.name,'pid':pid,'alive':prior_alive});return prior_alive
  def fake_awake(flags): awake.append(flags);return 1
  mocked_windll=types.SimpleNamespace(kernel32=types.SimpleNamespace(SetThreadExecutionState=fake_awake))
  with contextlib.ExitStack() as stack:
   stack.enter_context(patch.object(launcher,'check',fake_check));stack.enter_context(patch.object(launcher,'spawn_logged',fake_spawn))
   stack.enter_context(patch.object(launcher,'running_owned',fake_owned));stack.enter_context(patch.object(launcher.ctypes,'windll',mocked_windll,create=True))
   stack.enter_context(patch.object(launcher.subprocess,'Popen',side_effect=AssertionError('Real Popen forbidden')))
   stack.enter_context(patch.object(launcher.subprocess,'run',side_effect=AssertionError('Real subprocess/network/process-stop forbidden')))
   stack.enter_context(patch.object(launcher,'terminate_tree',side_effect=AssertionError('Real termination forbidden')))
   stack.enter_context(patch.object(launcher.time,'sleep',side_effect=AssertionError('Unexpected real sleep')))
   stack.enter_context(patch.object(sys,'argv',['synthetic-launcher','--config',str(path),'--start']))
   stack.enter_context(contextlib.redirect_stderr(stderr))
   launcher.main()
  (path.parent/'captured-stderr.log').write_text(stderr.getvalue(),encoding='utf-8')
  return spawns,awake
 def test_completed_prior_hands_off_to_mock_node_and_writes_final_receipt(self):
  root,out,previous,config,path=self.prepare('complete-prior')
  before=hashlib.sha256((previous/'checkpoint.json').read_bytes()).hexdigest()
  spawns,awake=self.invoke(config,path)
  self.assertEqual([x[0] for x in spawns],['publisher','runner'])
  self.assertIn('scripts/wingspan-overnight/run.mjs',spawns[1][1][1].replace('\\','/'))
  self.assertIn('--config='+str(path),spawns[1][1]);self.assertIn('--launch='+str(out/'launch.json'),spawns[1][1])
  result=read(out/'supervisor-result.json');self.assertEqual(result['status'],'finished');self.assertEqual(result['stage'],'complete')
  receipt=read(out/'launch.json');duration=(datetime.fromisoformat(receipt['deadline'])-datetime.fromisoformat(receipt['startedAt'])).total_seconds()
  self.assertAlmostEqual(duration,9*3600,delta=1);self.assertEqual(receipt['workers'],30)
  self.assertTrue((out/'execution-source.zip').exists());self.assertTrue((out/'supervisor.lock').exists())
  self.assertEqual(before,hashlib.sha256((previous/'checkpoint.json').read_bytes()).hexdigest())
  self.assertEqual(awake,[0x80000001,0x80000000])
 def test_failed_prior_blocks_mock_node_handoff(self):
  root,out,previous,config,path=self.prepare('failed-prior',prior_status='interrupted')
  spawns,awake=self.invoke(config,path,prior_alive=True)
  self.assertEqual([x[0] for x in spawns],['publisher'])
  self.assertEqual(read(out/'supervisor-result.json')['status'],'interrupted')
  self.assertIn('Previous study failed',read(out/'supervisor-failure.json')['error'])
  self.assertEqual(read(previous/'checkpoint.json')['status'],'interrupted')
 def test_invalid_completed_prior_blocks_mock_node_handoff(self):
  root,out,previous,config,path=self.prepare('invalid-prior',prior_complete=False)
  spawns,awake=self.invoke(config,path)
  self.assertEqual([x[0] for x in spawns],['publisher'])
  self.assertEqual(read(out/'supervisor-result.json')['status'],'interrupted')
  self.assertIn('completed evidence is invalid',read(out/'supervisor-failure.json')['error'])
 def test_duplicate_lock_rejects_without_clock_reset_or_second_handoff(self):
  root,out,previous,config,path=self.prepare('duplicate-lock')
  first,_=self.invoke(config,path);before=(out/'launch.json').read_bytes()
  with self.assertRaisesRegex(RuntimeError,'launch already exists'): self.invoke(config,path)
  self.assertEqual((out/'launch.json').read_bytes(),before)
  self.assertEqual([name for name,_ in first],['publisher','runner'])

if __name__=='__main__':
 stream=io.StringIO();result=unittest.TextTestRunner(stream=stream,verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(SupervisorRehearsal))
 (BASE/'unittest.log').write_text(stream.getvalue(),encoding='utf-8');save(BASE/'events.json',EVENTS)
 unchanged_ready=hashlib.sha256(READY.read_bytes()).hexdigest()==ready_hash
 unchanged_source=hashlib.sha256(source.read_bytes()).hexdigest()==source_hash
 summary={'purpose':'Synthetic mocked launcher rehearsal only. No real --start, workers, network or process stops.',
  'revision':config_template['revision'],'testsRun':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),
  'successful':result.wasSuccessful(),'actualCampaignReadyUnchanged':unchanged_ready,'frozenLauncherSourceUnchanged':unchanged_source,
  'realProcessesStarted':0,'networkCalls':0,'realProcessStops':0}
 save(BASE/'summary.json',summary);print(stream.getvalue());print(json.dumps(summary))
 sys.exit(0 if result.wasSuccessful() and unchanged_ready and unchanged_source else 1)
