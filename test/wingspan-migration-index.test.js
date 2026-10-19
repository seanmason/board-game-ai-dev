import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('portable migration preserves hashes/splits and refuses tampered or escaping inputs',()=>{const script=String.raw`
import tempfile,json,hashlib,importlib.util
from pathlib import Path
s=importlib.util.spec_from_file_location('migration','scripts/wingspan-migration-index.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
with tempfile.TemporaryDirectory() as d:
 root=Path(d);records=[]
 for i,split in enumerate(['train','dev']):
  p=root/(split+'.json');p.write_text(json.dumps({'task':{'kind':'collect','id':split,'seed':i,'generation':1,'split':split},'validation':{'valid':True},'result':{'status':'complete'}}),encoding='utf-8');records.append({'path':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'gameId':split,'setupSeed':i,'generation':1,'split':split})
 data={'schema':1,'kind':'wingspan-private-transfer','training':{'recordCount':2,'splitCounts':{'train':1,'dev':1},'featureVersion':'wingspan-compact-v1','featureNames':[],'auxNames':[],'architecture':[192,32,16,1],'records':records}}
 mp=root/'transfer-manifest.json';mp.write_text(json.dumps(data),encoding='utf-8');before=mp.read_bytes();out=root/'derived.json';r=m.derive(root,out);idx=json.loads(out.read_text(encoding='utf-8'));assert r['records']==2;assert all(Path(x['path']).is_absolute() for x in idx['records']);assert mp.read_bytes()==before;assert idx['records'][0]['sha256']==records[0]['sha256']
 try:m.derive(root,out);raise AssertionError('overwrite allowed')
 except ValueError:pass
 for change in ['hash','path','split','group']:
  x=json.loads(json.dumps(data));row=x['training']['records'][0]
  if change=='hash':row['sha256']='0'*64
  elif change=='path':row['path']='../outside.json'
  elif change=='split':row['split']='audit'
  else:x['training']['records'][1]['setupSeed']=0
  mp.write_text(json.dumps(x),encoding='utf-8')
  try:m.derive(root,root/(change+'.json'));raise AssertionError('invalid source allowed: '+change)
  except ValueError:pass
  assert not (root/(change+'.json')).exists()
print('migration integrity passed')
`;const r=spawnSync('python',['-X','utf8','-c',script],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/migration integrity passed/);});
