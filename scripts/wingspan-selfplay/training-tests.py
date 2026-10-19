"""Synthetic plumbing tests only; no games or strength claims."""
import copy
import os
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('compact_train', Path(__file__).with_name('train.py'))
t = importlib.util.module_from_spec(spec)
spec.loader.exec_module(t)

class TrainingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.index = dict(schema=1, featureVersion=t.VERSION,
                          featureNames=['producer']+[f'f{i}' for i in range(191)], auxNames=[f'a{i}' for i in range(12)], records=[])
        for i, split in enumerate(('train','train','dev','audit','calibration')):
            game = f'g{i}'
            path = self.root / (game+'.json')
            inventory = dict(path=str(path.resolve()), split=split, gameId=game, generation=1, setupSeed=100+i)
            self.index['records'].append(inventory)
            if split in ('train','dev'):
                self.make_record(inventory)
        self.manifest = self.root/'manifest.json'
        t.write(self.manifest, self.index)
        self.config = patch.dict(t.CONFIG, epochs=3, patience=2)
        self.config.start()
    def tearDown(self):
        self.config.stop()
        self.temp.cleanup()
    def make_record(self, r):
        examples=[]
        for round_no in (1,2,3,4):
            for viewer in (0,1):
                examples.append(dict(gameId=r['gameId'], setupSeed=r['setupSeed'], split=r['split'], generation=r['generation'],
                                     viewer=viewer, round=round_no, features=[float((i+round_no+viewer)%7)/7 for i in range(192)],
                                     targetMargin=0., baselineMargin=0., targetAux=[0.]*12, observation={}))
        t.write(r['path'], dict(task=dict(id=r['gameId'],seed=r['setupSeed'],split=r['split'],generation=r['generation']),
                               result=dict(status='complete',scores=[50,50]), validation=dict(valid=True), valueExamples=examples))
    def test_sealed_never_opened(self):
        _, rows, sources=t.load_dataset(self.manifest)
        self.assertEqual(set(rows), {'train','dev'})
        self.assertEqual(len(sources),3)
        self.assertTrue(all(s['split'] in ('train','dev') for s in sources))
        self.assertFalse(Path(self.index['records'][3]['path']).exists())
    def test_inventory_cross_split_rejected_before_file_read(self):
        self.index['records'][3]['setupSeed']=self.index['records'][0]['setupSeed']
        t.write(self.manifest,self.index)
        original=t.read
        with patch.object(t,'read',side_effect=lambda p: original(p) if Path(p)==self.manifest else self.fail('Opened a record before validating inventory')):
            with self.assertRaisesRegex(ValueError,'crosses splits'):
                t.load_dataset(self.manifest)
    def test_malicious_record_and_evaluation_split(self):
        path=self.index['records'][0]['path']; record=t.read(path)
        record['valueExamples'][0]['split']='dev'; t.write(path,record)
        with self.assertRaisesRegex(ValueError,'crosses frozen'):
            t.load_dataset(self.manifest)
        self.index['records'][0]['split']='confirmation'; t.write(self.manifest,self.index)
        with self.assertRaisesRegex(ValueError,'forbidden evaluation'):
            t.load_dataset(self.manifest)
    def test_epoch_zero_export_zero_and_warm_normalization(self):
        out=self.root/'fit'
        summary=t.fit(self.manifest,out)
        self.assertEqual(summary['selectedEpoch'],0)
        self.assertFalse(summary['eligible'])
        self.assertTrue(summary['optimizerReset'])
        model=t.read(out/'model.json'); zero=t.read(out/'zero-model.json')
        self.assertEqual(model['layers'][:2],zero['layers'][:2])
        self.assertEqual(zero['layers'][-1]['weights'],[0.]*16)
        self.assertEqual(t.scalar_predict(zero,[1.]*192),0.)
        self.assertEqual(len(summary['history']),3)
        self.assertTrue(all('trainHuber' in epoch for epoch in summary['history']))
        cases=t.read(out/'parity.json')['cases']
        self.assertEqual({c['round'] for c in cases},{1,2,3,4})
        self.assertEqual({c['viewer'] for c in cases},{0,1})
        self.assertIn('devGroupMaeInterval',summary)
        self.assertEqual({s['split'] for s in summary['readFiles']},{'train','dev'})
        model['normalization']=dict(mean=[2.]*192,scale=[3.]*192)
        warm=self.root/'warm.json'; t.write(warm,model)
        summary2=t.fit(self.manifest,self.root/'warmfit',warm)
        epoch_zero=t.read(self.root/'warmfit'/'epoch-zero.json')
        self.assertEqual(epoch_zero['normalization'],model['normalization'])
        self.assertEqual(epoch_zero['layers'],model['layers'])
        self.assertEqual(summary2['warmStartSha256'],t.digest(warm))
    def test_nonzero_scalar_export_parity(self):
        t.configure('cpu'); net=t.Network()
        with t.torch.no_grad():
            net.layers[-1].weight.fill_(.02); net.layers[-1].bias.fill_(.1)
        norm=dict(mean=[.2]*192,scale=[.7]*192)
        model=t.export(net,self.index,norm,'parity-test')
        features=[i/192 for i in range(192)]
        x=(t.np.asarray(features,dtype=t.np.float32)-t.np.float32(.2))/t.np.float32(.7)
        expected=float((10*net(t.torch.tensor(x)[None,:])[0][0]).detach())
        self.assertAlmostEqual(t.scalar_predict(model,features),expected,places=5)
    def test_residual_can_improve_and_later_generation_needs_warm_start(self):
        for inventory in self.index['records'][:3]:
            record=t.read(inventory['path'])
            for example in record['valueExamples']:
                example['baselineMargin']=-4.
            t.write(inventory['path'],record)
        summary=t.fit(self.manifest,self.root/'learning')
        self.assertGreater(summary['selectedEpoch'],0)
        self.assertTrue(summary['eligible'])
        self.assertLess(summary['dev']['huber'],summary['epochZero']['huber'])
        self.assertTrue(t.read(self.root/'learning'/'parity.json')['passed'])
        for inventory in self.index['records'][:3]:
            inventory['generation']=2
            record=t.read(inventory['path']); record['task']['generation']=2
            for example in record['valueExamples']:
                example['generation']=2
            t.write(inventory['path'],record)
        t.write(self.manifest,self.index)
        with self.assertRaisesRegex(ValueError,'require warm-start'):
            t.fit(self.manifest,self.root/'invalid-gen2')
    def test_group_weight_balance(self):
        _, rows, _=t.load_dataset(self.manifest)
        rows=copy.deepcopy(rows['train'])
        rows.extend(copy.deepcopy(rows[:8]))
        w=t.weights(rows)
        for game in ('g0','g1'):
            self.assertAlmostEqual(sum(v for r,v in zip(rows,w) if r['gameId']==game),.5)
        self.assertAlmostEqual(float(w.sum()),1.)
    def test_audit_one_shot(self):
        t.fit(self.manifest,self.root/'fit')
        self.make_record(self.index['records'][3])
        result=t.audit(self.manifest,self.root/'fit'/'model.json',self.root/'audit')
        self.assertEqual(result['selected']['games'],1)
        self.assertTrue(result['valid'])
        self.assertFalse(result['eligible'])
        self.assertIn('linear',result)
        self.assertEqual({s['split'] for s in result['readFiles']},{'audit'})
        with patch.object(t,'load_dataset',side_effect=AssertionError('Completed audit reopened sealed records')):
            replay=t.audit(self.manifest,self.root/'fit'/'model.json',self.root/'audit2')
        self.assertEqual(replay,result)
        self.assertTrue((self.root/'audit2'/'audit-summary.json').is_file())
        summary_path=self.root/'audit'/'audit-summary.json'
        original=summary_path.read_bytes(); summary_path.write_text('{}',encoding='utf-8')
        with self.assertRaisesRegex(ValueError,'Incomplete or invalid'):
            t.audit(self.manifest,self.root/'fit'/'model.json',self.root/'audit')
        summary_path.write_bytes(original)
        manifest_bytes=self.manifest.read_bytes()
        self.manifest.write_bytes(manifest_bytes+b'\n')
        with self.assertRaisesRegex(ValueError,'another frozen'):
            t.audit(self.manifest,self.root/'fit'/'model.json',self.root/'audit')
        self.manifest.write_bytes(manifest_bytes)
        receipt=self.manifest.with_suffix('.audit-receipt.json')
        saved=t.read(receipt); saved['status']='reserved-no-retry'; t.write(receipt,saved)
        with self.assertRaisesRegex(ValueError,'Incomplete or invalid'):
            t.audit(self.manifest,self.root/'fit'/'model.json',self.root/'audit')
    def test_parity_coverage_and_group_interval(self):
        for i in range(4,12):
            inventory=dict(path=str((self.root/f'extra{i}.json').resolve()),split='dev',gameId=f'extra{i}',generation=1,setupSeed=1000+i)
            self.index['records'].append(inventory); self.make_record(inventory)
        t.write(self.manifest,self.index)
        _,rows,_=t.load_dataset(self.manifest)
        ids=t.parity_indices(rows['dev'])
        self.assertEqual(len(ids),64)
        self.assertGreater(len({rows['dev'][i]['gameId'] for i in ids}),1)
        self.assertEqual({(rows['dev'][i]['round'],rows['dev'][i]['viewer']) for i in ids},{(r,v) for r in range(1,5) for v in (0,1)})
        interval=t.group_mae_interval(rows['dev'],t.np.ones(len(rows['dev'])))
        self.assertAlmostEqual(interval['low'],1.)
        self.assertAlmostEqual(interval['high'],1.)
        self.assertEqual(interval['independentGroups'],9)
    @unittest.skipUnless(not os.environ.get('WINGSPAN_TEST_CPU_ONLY') and t.torch.cuda.is_available(),'CPU-only test run or CUDA unavailable')
    def test_cuda_synthetic_fit(self):
        summary=t.fit(self.manifest,self.root/'cuda',device='cuda')
        self.assertEqual(summary['device'],'cuda')
        self.assertEqual(summary['selectedEpoch'],0)

if __name__=='__main__':
    unittest.main(verbosity=2)
