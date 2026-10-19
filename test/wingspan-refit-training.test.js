import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const trainer=fileURLToPath(new URL('../scripts/wingspan-refit/train.py',import.meta.url));
const python=process.env.WINGSPAN_PYTHON??'python';
function run(args){return spawnSync(python,['-X','utf8',...args],{encoding:'utf8',timeout:30000});}

test('frozen refit recipes expose only the approved changes without importing torch',()=>{
 const result=run(['-S',trainer,'--describe-only']);
 assert.equal(result.status,0,result.stderr);
 const recipes=JSON.parse(result.stdout);
 assert.deepEqual(Object.keys(recipes),['control','value-only','gentle','gentle-value']);
 for(const [id,config] of Object.entries(recipes)){
  assert.deepEqual(config,{seed:1729,epochs:24,patience:4,batchSize:512,weightDecay:.0001,
   auxiliaryScale:20,ridgeAlpha:10,cpuThreads:4,gpuBytes:6*1024**3,
   learningRate:id.startsWith('gentle')?.0001:.0005,auxiliaryWeight:id.includes('value')?0:.05});
 }
 const override=run([trainer,'--describe-only','--learning-rate','1']);
 assert.notEqual(override.status,0);assert.match(override.stderr,/unrecognized arguments/);
 const audit=run([trainer,'--audit']);
 assert.notEqual(audit.status,0);assert.match(audit.stderr,/unrecognized arguments/);
});

test('refit preflight and delegated receipt preserve inventory and existing artifacts',()=>{
 const code=String.raw`
import importlib.util, json, pathlib, sys, tempfile, types, unittest
spec=importlib.util.spec_from_file_location('refit', sys.argv[1])
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

class RefitTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root=pathlib.Path(self.temp.name)
        self.manifest=self.root/'index.json'
        self.warm=self.root/'warm.json'; self.warm.write_text('{}')
        self.records=[]
        for i, split in enumerate(('train','dev')):
            path=self.root/(split+'.json'); path.write_text('{"raw":true}')
            self.records.append(dict(path=str(path.resolve()),split=split,generation=i+1,sha256=m.digest(path)))
        self.save()
    def save(self):
        self.manifest.write_text(json.dumps(dict(records=self.records)))
    def test_recipes_are_immutable_and_copies_are_independent(self):
        with self.assertRaises(TypeError): m.RECIPES['control']['learningRate']=1
        with self.assertRaises(TypeError): m.FIXED_CONFIG['epochs']=100
        config=m.recipe_config('control'); config['epochs']=999
        self.assertEqual(m.recipe_config('control')['epochs'],24)
        with self.assertRaisesRegex(ValueError,'Unknown frozen recipe'): m.recipe_config('other')
    def test_all_splits_checked_before_raw_reads(self):
        self.records[0]['path']=str(self.root/'nonexistent.json')
        for forbidden in ('audit','calibration','test',None):
            self.records[1]['split']=forbidden; self.save()
            with self.assertRaisesRegex(ValueError,'only train/dev'): m.validate_inventory(self.manifest)
    def test_generation_bounds_and_duplicate_paths(self):
        for value in (0,7,True,'1'):
            self.records[0]['generation']=value; self.save()
            with self.assertRaisesRegex(ValueError,'1 through 6'): m.validate_inventory(self.manifest)
        self.records[0]['generation']=6
        m.validate_inventory(self.save() or self.manifest)
        self.records[1]['path']=self.records[0]['path']; self.save()
        with self.assertRaisesRegex(ValueError,'absolute and unique'): m.validate_inventory(self.manifest)
    def test_indexed_hash_and_after_snapshot_hash(self):
        snapshot=m.validate_inventory(self.manifest)
        pathlib.Path(self.records[0]['path']).write_text('{"changed":true}')
        with self.assertRaisesRegex(ValueError,'Raw input changed'): m.verify_snapshot(snapshot)
        with self.assertRaisesRegex(ValueError,'differs from inventory'): m.validate_inventory(self.manifest)
        self.records[0]['sha256']='not-a-hash'; self.save()
        with self.assertRaisesRegex(ValueError,'Invalid inventory sha256'): m.validate_inventory(self.manifest)
    def test_unhashed_inputs_and_manifest_are_still_snapshotted(self):
        del self.records[0]['sha256']; self.save()
        snapshot=m.validate_inventory(self.manifest)
        pathlib.Path(self.records[0]['path']).write_text('different')
        with self.assertRaisesRegex(ValueError,'Raw input changed'): m.verify_snapshot(snapshot)
        self.manifest.write_text('{}')
        with self.assertRaisesRegex(ValueError,'manifest changed'): m.verify_snapshot(snapshot)
    def fake_base(self, mutate=False):
        base=types.SimpleNamespace(CONFIG=m.recipe_config('control'))
        def write(path, value): pathlib.Path(path).write_text(json.dumps(value))
        base.write=write
        def fit(manifest,out,warm,device):
            self.assertEqual(base.CONFIG,m.recipe_config('gentle-value'))
            self.assertEqual(device,'cpu')
            snapshot=m.validate_inventory(manifest)
            result=dict(trainerSha256=m.digest(m.BASE_TRAINER),manifestSha256=m.digest(manifest),
                warmStartSha256=m.digest(warm),readFiles=snapshot['readFiles'])
            write(out/'training-summary.json',result)
            if mutate: pathlib.Path(self.records[0]['path']).write_text('changed during fitting')
            return result
        base.fit=fit
        return base
    def invoke(self,out,mutate=False):
        prior=m.load_base_trainer
        m.load_base_trainer=lambda:self.fake_base(mutate)
        try: return m.fit(self.manifest,out,self.warm,'gentle-value')
        finally: m.load_base_trainer=prior
    def test_delegate_and_separate_complete_receipt(self):
        out=self.root/'out'; result=self.invoke(out)
        receipt=m.read(out/'recipe-receipt.json')
        self.assertEqual(receipt['status'],'complete')
        self.assertEqual(receipt['recipe'],'gentle-value')
        self.assertEqual(receipt['recipeSha256'],m.recipe_digest('gentle-value'))
        self.assertEqual(receipt['baseTrainerSha256'],result['trainerSha256'])
        self.assertEqual(receipt['wrapperSha256'],m.digest(m.__file__))
        self.assertEqual(receipt['trainingSummarySha256'],m.digest(out/'training-summary.json'))
        self.assertNotIn('wrapperSha256',m.read(out/'training-summary.json'))
        original=(out/'training-summary.json').read_bytes()
        with self.assertRaisesRegex(ValueError,'fresh output'): self.invoke(out)
        self.assertEqual((out/'training-summary.json').read_bytes(),original)
    def test_even_empty_existing_outputs_preserved(self):
        out=self.root/'out'; out.mkdir()
        with self.assertRaisesRegex(ValueError,'fresh output'): self.invoke(out)
        self.assertEqual(list(out.iterdir()),[])
    def test_changed_input_during_fit_cannot_complete_receipt(self):
        out=self.root/'out'
        with self.assertRaisesRegex(ValueError,'Raw input changed'): self.invoke(out,True)
        self.assertEqual(m.read(out/'recipe-receipt.json')['status'],'reserved')
    def test_bad_index_hash_never_creates_output(self):
        self.records[0]['sha256']='0'*64; self.save()
        out=self.root/'out'
        with self.assertRaisesRegex(ValueError,'differs from inventory'): self.invoke(out)
        self.assertFalse(out.exists())
    def test_bad_delegated_provenance_cannot_complete_receipt(self):
        prior=m.load_base_trainer
        base=self.fake_base(); fit=base.fit
        def tampered(*args):
            result=fit(*args); result['trainerSha256']='0'*64
            return result
        base.fit=tampered; m.load_base_trainer=lambda:base
        self.addCleanup(setattr,m,'load_base_trainer',prior)
        out=self.root/'out'
        with self.assertRaisesRegex(ValueError,'provenance mismatch'):
            m.fit(self.manifest,out,self.warm,'gentle-value')
        self.assertEqual(m.read(out/'recipe-receipt.json')['status'],'reserved')

unittest.main(argv=[sys.argv[0]])
`;
 const result=run(['-S','-c',code,trainer]);
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stderr,/Ran 10 tests/);
});
