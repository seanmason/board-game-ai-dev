"""Frozen exploratory train/dev-only ablation. Execution requires explicit --execute.
Never reads offline-test game files, never calls evaluate_offline, never changes pilot.
"""
from pathlib import Path
import argparse, hashlib, importlib.util, json, math, os, sys, time
ROOT=Path(r'C:/Users/mason/.codex/worktrees/wingspan-neural-20261019')
BASE=Path(__file__).resolve().parent

def read(path):return json.loads(Path(path).read_text(encoding='utf-8-sig'))
def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def write(path,value):
 path=Path(path);path.parent.mkdir(parents=True,exist_ok=True);temp=path.with_suffix(path.suffix+'.tmp');temp.write_text(json.dumps(value,indent=2,allow_nan=False)+'\n',encoding='utf-8');temp.replace(path)
def helper(root=ROOT):
 sys.dont_write_bytecode=True
 spec=importlib.util.spec_from_file_location('frozen_wingspan_trainer',root/'scripts/wingspan-neural/train.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def safe_game(root,relative):
 path=(Path(root)/relative).resolve();games=(Path(root)/'games').resolve()
 if not path.is_relative_to(games):raise ValueError('Selected source is outside dataset/games')
 return path

def load_train_dev(plan):
 """Open only the files listed as train/dev by the frozen manifest."""
 root=Path(plan['datasetRoot']);manifest_path=root/'manifest.json'
 if digest(manifest_path)!=plan['datasetManifestSha256']:raise ValueError('Dataset manifest changed')
 manifest=read(manifest_path);names=manifest['featureNames']
 if names!=plan['fullFeatureNames'] or manifest['featureVersion']!=plan['featureVersion']:raise ValueError('Feature schema changed')
 declared={t['id']:t for t in manifest['tasks']};selected={i for i,t in declared.items() if t['split'] in ['train','dev']}
 if selected!={r['taskId'] for r in plan['dataSources']}:raise ValueError('Incomplete or unexpected train/dev inventory')
 if len(selected)!=len(plan['dataSources']):raise ValueError('Duplicate train/dev inventory')
 split_by_seed={}
 for t in declared.values():
  if t['seed'] in split_by_seed and split_by_seed[t['seed']]!=t['split']:raise ValueError('Manifest setup split leakage')
  split_by_seed[t['seed']]=t['split']
 rows={'train':[],'dev':[]};seen=set();opened=[]
 for source in plan['dataSources']:
  task=declared[source['taskId']]
  if task['split'] not in rows:raise ValueError('Test/calibration file attempted')
  path=safe_game(root,source['file'])
  raw=path.read_bytes();opened.append(str(path))
  if hashlib.sha256(raw).hexdigest()!=source['sha256']:raise ValueError('Train/dev game bytes changed')
  game=json.loads(raw.decode('utf-8-sig'))
  if game['task']!=task or game.get('validation',{}).get('valid') is not True or game.get('result',{}).get('status')!='complete':raise ValueError('Invalid frozen train/dev game')
  scores=game['result']['scores'];examples=game['valueExamples']
  if len(scores)!=2 or not examples:raise ValueError('Missing terminal labels/examples')
  pairs={}
  for e in examples:
   if e['split']!=task['split'] or e['setupSeed']!=task['seed'] or e['gameId']!=task['id'] or e['viewer'] not in [0,1]:raise ValueError('Example grouping mismatch')
   key=(e['gameId'],e['step'],e['viewer'])
   if key in seen:raise ValueError('Duplicate value example')
   seen.add(key);pairs.setdefault(e['step'],set()).add(e['viewer'])
   if len(e['features'])!=len(names) or not all(isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(x) for x in e['features']):raise ValueError('Feature vector invalid')
   if e['targetMargin']!=scores[e['viewer']]-scores[1-e['viewer']] or len(e['targetAux'])!=12 or not all(math.isfinite(x) for x in e['targetAux']):raise ValueError('Terminal labels invalid')
   rows[task['split']].append({k:e[k] for k in ['gameId','setupSeed','split','step','viewer','features','targetMargin','targetAux','round'] if k in e})
  if any(v!={0,1} for v in pairs.values()):raise ValueError('Incomplete viewer pair')
 if not all(rows.values()):raise ValueError('Need both train and dev')
 return rows,opened

def check(plan):
 if digest(__file__)!=plan['probeSha256']:raise ValueError('Frozen probe source changed')
 for path,sha in plan['lockedSources'].items():
  if digest(path)!=sha:raise ValueError('Frozen helper/baseline changed: '+path)

def custom_factory(torch,widths):
 class ValueNet(torch.nn.Module):
  def __init__(self,input_width):
   super().__init__();a,b=widths
   self.trunk=torch.nn.Sequential(torch.nn.Linear(input_width,a),torch.nn.ReLU(),torch.nn.Linear(a,b),torch.nn.ReLU())
   self.value=torch.nn.Linear(b,1);self.auxiliary=torch.nn.Linear(b,12)
  def forward(self,x):
   z=self.trunk(x);return self.value(z).squeeze(-1),self.auxiliary(z)
 return ValueNet

def metrics(t,torch,np,rows,predictions):
 grouped,mae=t.grouped_metric(rows,predictions)
 target=np.asarray([r['targetMargin'] for r in rows],dtype=np.float32)/30
 huber=float(torch.nn.functional.huber_loss(torch.from_numpy((predictions/30).astype(np.float32)),torch.from_numpy(target)))
 phase={}
 for round_number in [1,2,3,4]:
  ids=[i for i,r in enumerate(rows) if r.get('round')==round_number]
  if ids:phase[str(round_number)]=t.grouped_metric([rows[i] for i in ids],predictions[ids])[1]
 return {'devValueHuber':huber,'devGroupMAE':mae,'byRound':phase},grouped

def execute(plan):
 check(plan)
 receipt=BASE/'execution-receipt.json'
 if receipt.exists():raise ValueError('Probe already executed; no automatic retries or new tuning')
 write(receipt,{'startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'planSha256':digest(BASE/'plan.json'),'explicitExecute':True,'testFilesAllowed':False})
 t=helper();np,torch=t.libraries()
 if not torch.cuda.is_available():raise RuntimeError('CUDA required for matched training protocol')
 torch.cuda.set_per_process_memory_fraction(min(1,6*1024**3/torch.cuda.get_device_properties(0).total_memory),0)
 try:
  import ctypes
  if os.name=='nt':ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(),0x4000)
 except OSError:pass
 baseline=read(plan['baselineRoot']+'/training-manifest.json')
 if t.CONFIG!={k:baseline['config'][k] for k in t.CONFIG} or list(t.SEEDS)!=baseline['config']['optimizationSeeds']:raise ValueError('Optimization protocol differs from cached control')
 rows,opened=load_train_dev(plan)
 x,y,aux=t.arrays(rows['train']);dx,dy,daux=t.arrays(rows['dev']);full_norm=t.normalization(x)
 original=t.make_network;original_norm=read(Path(plan['baselineRoot'])/'mlp.json')['normalization']
 if not np.array_equal(full_norm[0],np.asarray(original_norm['mean'],dtype=np.float32)) or not np.array_equal(full_norm[1],np.asarray(original_norm['scale'],dtype=np.float32)):raise ValueError('Cached-control normalization/order is not identical')
 baseline_candidates=read(Path(plan['baselineRoot'])/'selection.json')['candidates']
 reports={};selected_predictions={};selected_groups={};all_states={}
 started=time.perf_counter()
 try:
  for cell in plan['cells']:
   check(plan);key=cell['id'];indices=cell['inputIndices'];widths=cell['widths'];out=BASE/'cells'/key;out.mkdir(parents=True,exist_ok=True)
   train_x=x[:,indices];dev_x=dx[:,indices];norm=t.normalization(train_x)
   training=(t.normalized(train_x,norm),y,aux);development=(t.normalized(dev_x,norm),dy,daux)
   t.make_network=custom_factory(torch,widths)
   curves=None
   if cell['cached']:
    candidates=baseline_candidates;selected=read(Path(plan['baselineRoot'])/'selection.json')['selected']
    models={}
    for candidate in candidates:
     checkpoint=Path(plan['baselineRoot'])/candidate['checkpoint']
     if digest(checkpoint)!=candidate['checkpointSha256']:raise ValueError('Cached checkpoint changed')
     model=t.make_network(len(indices));model.load_state_dict(torch.load(checkpoint,map_location='cpu',weights_only=True)['state_dict']);models[candidate['seed']]=model.eval()
   else:
    model,selected,candidates,curves=t.fit_network(training,development,'cuda',out,epochs=100)
    models={}
    for candidate in candidates:
     model=t.make_network(len(indices));model.load_state_dict(torch.load(out/candidate['checkpoint'],map_location='cpu',weights_only=True)['state_dict']);models[candidate['seed']]=model.eval()
   per_seed=[]
   for candidate in candidates:
    model=models[candidate['seed']];pred=t.model_predictions(model,development[0])
    met,group=metrics(t,torch,np,rows['dev'],pred)
    if abs(met['devValueHuber']-candidate['devValueHuber'])>1e-6:raise ValueError('Checkpoint dev loss does not reproduce frozen selection')
    per_seed.append({**candidate,'recomputedDev':met,'trainingParameters':sum(p.numel() for p in model.parameters())})
    if candidate['seed']==selected['seed']:
     selected_predictions[key]=pred;selected_groups[key]=group;all_states[key]=model
   reports[key]={'featureCount':len(indices),'widths':widths,'cached':cell['cached'],'selectedWithinCellByFrozenDevRule':selected,'perSeed':per_seed,'curves':curves,'normalization':{'mean':norm[0].tolist(),'scale':norm[1].tolist()},'cpuInferenceMs':t.cpu_latency(all_states[key],development[0][0]),'jsInference':'Not measured: compact projection has no deployment adapter; no online candidate generated.'}
   if curves:t.write(out/'loss-curves.json',curves)
   write(out/'dev-report.json',reports[key])
  baseline_groups=selected_groups['full-64-32'];comparisons={}
  for key,groups in selected_groups.items():
   if key!='full-64-32':comparisons[key+'MinusFullControlMAE']=t.bootstrap([groups[seed]-baseline_groups[seed] for seed in baseline_groups])
  report={'status':'complete','startedAfterExplicitSignalOnly':True,'elapsedSeconds':time.perf_counter()-started,'cells':reports,'pairedDevComparisons':comparisons,'testFilesOpened':0,'openedDataFiles':opened,'developmentIsSelectionData':True,'independentConfirmation':False,'adoptionRecommended':False,'productionDefaultsChanged':False,'warnings':plan['warnings'],'freshTestRequiredForAnyNextCandidate':True}
  check(plan);write(BASE/'report.json',report);return report
 finally:t.make_network=original

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--execute',action='store_true');args=parser.parse_args()
 if not args.execute:print('Prepared only. Explicit coordinator signal and --execute required; no data/model fitting started.');return
 plan=read(BASE/'plan.json')
 try:
  report=execute(plan);print(json.dumps({'status':report['status'],'elapsedSeconds':report['elapsedSeconds'],'testFilesOpened':0,'adoptionRecommended':False}))
 except Exception as error:write(BASE/'failure.json',{'error':repr(error),'adoptionRecommended':False});raise
if __name__=='__main__':main()
