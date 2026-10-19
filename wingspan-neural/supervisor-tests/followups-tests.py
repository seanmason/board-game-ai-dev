"""External follow-up queue tests: all children, waits and kills are mocked."""
from pathlib import Path
from datetime import datetime,timezone
import hashlib,importlib.util,json,tempfile,types,unittest
from unittest.mock import patch,Mock
SOURCE=Path(r'C:/Users/mason/.codex/benchmark-runs/wingspan-neural-20261019/followups.py')
spec=importlib.util.spec_from_file_location('followups_under_test',SOURCE);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
BASE=Path(__file__).resolve().parent

def write(path,value):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(value),encoding='utf-8')
class QueueTests(unittest.TestCase):
 def fixture(self):
  temp=tempfile.TemporaryDirectory(dir=BASE);self.addCleanup(temp.cleanup);root=Path(temp.name)
  locks={}
  for name in ['feature-capacity-probe','constant-control']:
   path=root/name/'plan.json';write(path,{'synthetic':name});locks[str(path.relative_to(root)).replace('\\','/')]=hashlib.sha256(path.read_bytes()).hexdigest()
  write(root/'pilot-launch.json',{'deadline':datetime.fromtimestamp(22600,timezone.utc).isoformat()})
  write(root/'progress.json',{'status':'finished','stage':'complete'});write(root/'pilot-result.json',{'status':'finished'})
  write(root/'feature-capacity-probe/report.json',{'status':'complete','testFilesOpened':0})
  write(root/'constant-control/analysis.json',{'complete':True,'valid':64,'independentPairs':32})
  return root,locks
 def scenario(self,*,failure=False,wait=False,change_plan=False,child_failure=False,hanging=False,bad_reads=False,bad_control=False,existing=False,race=False):
  root,locks=self.fixture();commands=[];events=[];kills=[];clock=[1000]
  if failure:write(root/'progress.json',{'status':'interrupted','stage':'training'})
  if wait or change_plan:write(root/'progress.json',{'status':'running','stage':'screen'});(root/'pilot-result.json').unlink()
  if bad_reads:write(root/'feature-capacity-probe/report.json',{'status':'complete','testFilesOpened':1})
  if bad_control:write(root/'constant-control/analysis.json',{'complete':False,'valid':63,'independentPairs':31})
  receipt=root/'diagnostics-launch.json'
  if existing or race:write(receipt,{'old':'must remain'})
  class Child:
   pid=987654
   def __init__(self,command,**kw):
    commands.append((command,kw));events.append('capacity' if 'probe.py' in ' '.join(map(str,command)) else 'control')
    self.returncode=None if hanging else 1 if child_failure and len(commands)==1 else 0
   def poll(self):return self.returncode
   def wait(self,timeout=None):self.returncode=-1;return -1
   def kill(self):raise AssertionError('Native kill must never execute on Windows fixture')
  def wall():
   if hanging:clock[0]+=1000
   return clock[0]
  def sleep(seconds):
   events.append('wait'+str(seconds))
   if seconds==15:
    if change_plan:write(root/'constant-control/plan.json',{'changed':True})
    else:write(root/'progress.json',{'status':'finished','stage':'complete'});write(root/'pilot-result.json',{'status':'finished'})
  def run(command,**kw):kills.append(command);return types.SimpleNamespace(returncode=0)
  real_exists=Path.exists
  def exists(path):return False if race and path==receipt else real_exists(path)
  fake_windows=types.SimpleNamespace(kernel32=types.SimpleNamespace(SetThreadExecutionState=Mock(return_value=1)))
  caught=None
  with patch.object(m,'ROOT',root),patch.object(m,'LOCKS',locks),patch.object(m.subprocess,'Popen',Child),patch.object(m.subprocess,'run',run),patch.object(m.time,'time',wall),patch.object(m.time,'sleep',sleep),patch.object(m.ctypes,'windll',fake_windows,create=True),patch.object(Path,'exists',exists):
   try:m.main()
   except Exception as error:caught=error
  progress=json.loads((root/'diagnostics-progress.json').read_text()) if (root/'diagnostics-progress.json').exists() else None
  certificate=json.loads((root/'diagnostics-result.json').read_text()) if (root/'diagnostics-result.json').exists() else None
  self.commands,self.events,self.kills,self.caught,self.progress,self.certificate=commands,events,kills,caught,progress,certificate
  self.receipt=json.loads(receipt.read_text())
 def test_wait_then_capacity_then_control_inherits_deadline(self):
  self.scenario(wait=True);self.assertIsNone(self.caught);self.assertEqual(self.events[:3],['wait15','capacity','control'])
  self.assertEqual(self.certificate['status'],'finished');self.assertFalse(self.certificate['productionDefaultsChanged'])
  self.assertEqual(self.receipt['deadline'],datetime.fromtimestamp(22600,timezone.utc).isoformat())
  for command,kw in self.commands:self.assertEqual(kw['creationflags'],m.subprocess.CREATE_NO_WINDOW|m.subprocess.BELOW_NORMAL_PRIORITY_CLASS)
 def test_failed_pilot_skips_all_children(self):
  self.scenario(failure=True);self.assertEqual(self.commands,[]);self.assertIsNotNone(self.caught);self.assertEqual(self.progress['status'],'interrupted')
 def test_duplicate_receipt_preserved_without_new_clock(self):
  self.scenario(existing=True);self.assertEqual(self.commands,[]);self.assertEqual(self.receipt,{'old':'must remain'});self.assertIn('already launched',str(self.caught))
 def test_exclusive_receipt_handles_exists_check_race(self):
  self.scenario(race=True);self.assertEqual(self.commands,[]);self.assertEqual(self.receipt,{'old':'must remain'});self.assertIsInstance(self.caught,FileExistsError)
 def test_changed_plan_while_waiting_blocks_all_children(self):
  self.scenario(change_plan=True);self.assertEqual(self.commands,[]);self.assertIn('plan changed',str(self.caught));self.assertIsNone(self.certificate)
 def test_failed_capacity_child_skips_control(self):
  self.scenario(child_failure=True);self.assertEqual(len(self.commands),1);self.assertIn('Diagnostic failed',str(self.caught));self.assertIsNone(self.certificate)
 def test_capacity_test_reads_block_control(self):
  self.scenario(bad_reads=True);self.assertEqual(len(self.commands),1);self.assertIn('Capacity diagnostic invalid',str(self.caught))
 def test_hanging_child_timeout_kills_only_owned_tree(self):
  self.scenario(hanging=True);self.assertEqual(len(self.commands),1);self.assertEqual(self.kills,[['taskkill','/PID','987654','/T','/F']]);self.assertIn('Bounded diagnostic deadline',str(self.caught));self.assertIsNone(self.certificate)
 def test_incomplete_control_cannot_certify_success(self):
  self.scenario(bad_control=True);self.assertEqual(len(self.commands),2);self.assertIn('control incomplete',str(self.caught));self.assertIsNone(self.certificate)
 def test_atomic_write_retries_windows_permission_errors(self):
  root,locks=self.fixture();target=root/'atomic.json';real_replace=m.os.replace;attempts=[];waits=[]
  def replace(a,b):
   attempts.append((a,b))
   if len(attempts)<3:raise PermissionError('synthetic transient Windows lock')
   return real_replace(a,b)
  with patch.object(m.os,'replace',replace),patch.object(m.time,'sleep',lambda s:waits.append(s)):m.write(target,{'ok':True})
  self.assertEqual(len(attempts),3);self.assertEqual(waits,[.025,.05]);self.assertEqual(json.loads(target.read_text()),{'ok':True})
 def test_atomic_write_has_bounded_retries(self):
  root,locks=self.fixture();attempts=[]
  def replace(a,b):attempts.append(1);raise PermissionError('persistent synthetic lock')
  with patch.object(m.os,'replace',replace),patch.object(m.time,'sleep',lambda _:None):
   with self.assertRaises(PermissionError):m.write(root/'atomic.json',{'ok':True})
  self.assertEqual(len(attempts),9)

if __name__=='__main__':unittest.main(verbosity=2)
