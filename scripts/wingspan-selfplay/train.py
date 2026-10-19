"""Bounded compact residual fitting; sealed files are never read during fitting."""
from __future__ import annotations
import argparse
import copy
import hashlib
import json
import math
import os
from pathlib import Path
import random
import struct

for _key in ('OMP_NUM_THREADS', 'MKL_NUM_THREADS', 'OPENBLAS_NUM_THREADS'):
    os.environ[_key] = '4'
os.environ.setdefault('CUBLAS_WORKSPACE_CONFIG', ':4096:8')
import numpy as np
import torch

CONFIG = dict(seed=1729, epochs=24, patience=4, batchSize=512, learningRate=0.0005,
              weightDecay=0.0001, auxiliaryWeight=0.05, auxiliaryScale=20,
              ridgeAlpha=10, cpuThreads=4, gpuBytes=6 * 1024**3)
VERSION = 'wingspan-compact-v1'

def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))

def write(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(data, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    temp.replace(path)

def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def finite(x):
    return isinstance(x, (float, int)) and not isinstance(x, bool) and math.isfinite(x)

def load_dataset(manifest_path, wanted=('train', 'dev')):
    manifest_path = Path(manifest_path).resolve()
    index = read(manifest_path)
    if index.get('schema') != 1 or index.get('featureVersion') != VERSION:
        raise ValueError('Unsupported dataset schema/version')
    for key, count in [('featureNames', 192), ('auxNames', 12)]:
        names = index.get(key)
        if not isinstance(names, list) or len(names) != count or not all(isinstance(x, str) and x for x in names) or len(set(names)) != count:
            raise ValueError('Invalid ' + key)
    records = index.get('records')
    if not isinstance(records, list) or not records:
        raise ValueError('Explicit nonempty record inventory required')
    groups, games, paths = {}, {}, set()
    # Validate *all inventory identities* before opening even a training record.
    for r in records:
        split, game, setup, gen = (r.get(k) for k in ('split', 'gameId', 'setupSeed', 'generation'))
        if split not in ('train', 'dev', 'audit', 'calibration') or not isinstance(game, str) or not game or not isinstance(setup, int) or isinstance(setup, bool) or not isinstance(gen, int) or isinstance(gen, bool) or gen < 1:
            raise ValueError('Invalid record identity or forbidden evaluation split')
        path = Path(r.get('path', ''))
        if not path.is_absolute() or str(path.resolve()).lower() in paths:
            raise ValueError('Record paths must be absolute and unique')
        paths.add(str(path.resolve()).lower())
        if game in games or setup in groups and groups[setup] != split:
            raise ValueError('Duplicate game or setup group crosses splits')
        games[game], groups[setup] = split, split
    rows, sources = {s: [] for s in wanted}, []
    for r in records:
        if r['split'] not in wanted:
            continue  # Do not stat, hash or open sealed records.
        path = Path(r['path'])
        record = read(path)
        task = record.get('task', {})
        if any(task.get(k) != r[v] for k, v in [('id', 'gameId'), ('seed', 'setupSeed'), ('split', 'split'), ('generation', 'generation')]):
            raise ValueError('Task identity differs from inventory')
        if record.get('validation', {}).get('valid') is not True or record.get('result', {}).get('status') != 'complete':
            raise ValueError('Incomplete/invalid records cannot supply labels')
        examples = record.get('valueExamples')
        if not isinstance(examples, list) or not examples:
            raise ValueError('Empty game')
        viewers = set()
        for e in examples:
            if any(e.get(k) != r[k] for k in ('gameId', 'setupSeed', 'split', 'generation')):
                raise ValueError('Example identity crosses frozen group/split')
            if e.get('viewer') not in (0, 1) or isinstance(e.get('viewer'), bool) or e.get('round') not in (1, 2, 3, 4) or isinstance(e.get('round'), bool):
                raise ValueError('Invalid viewer/round')
            viewers.add(e['viewer'])
            for key, count in [('features', 192), ('targetAux', 12)]:
                if not isinstance(e.get(key), list) or len(e[key]) != count or not all(finite(x) for x in e[key]):
                    raise ValueError('Invalid ' + key)
            if not all(finite(e.get(k)) for k in ('baselineMargin', 'targetMargin')):
                raise ValueError('Missing/nonfinite margin')
            scores = record['result'].get('scores')
            if scores is not None and (not isinstance(scores, list) or len(scores) != 2 or not all(finite(v) for v in scores) or abs(e['targetMargin']-(scores[e['viewer']]-scores[1-e['viewer']])) > 1e-8):
                raise ValueError('Target differs from terminal viewer margin')
            if e.get('featureVersion', VERSION) != VERSION:
                raise ValueError('Example feature version mismatch')
            rows[r['split']].append(e)
        if viewers != {0, 1}:
            raise ValueError('Both viewer observations required in every game')
        sources.append(dict(path=str(path), sha256=digest(path), split=r['split']))
    if any(not rows[s] for s in wanted):
        raise ValueError('Requested split empty')
    return index, rows, sources

def weights(rows):
    """Equal generation, setup, game, round and viewer mass, in that order."""
    tree = {}
    for i, r in enumerate(rows):
        node = tree
        for key in (r['generation'], r['setupSeed'], r['gameId'], r['round'], r['viewer']):
            node = node.setdefault(key, {})
        node[i] = None
    result = np.zeros(len(rows), dtype=np.float64)
    def visit(node, mass):
        for k, child in node.items():
            if child is None:
                result[k] = mass / len(node)
            else:
                visit(child, mass / len(node))
    visit(tree, 1.)
    return result

class Network(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.layers = torch.nn.ModuleList([torch.nn.Linear(192, 32), torch.nn.Linear(32, 16), torch.nn.Linear(16, 1)])
        self.aux = torch.nn.Linear(16, 12)
        torch.nn.init.zeros_(self.layers[-1].weight)
        torch.nn.init.zeros_(self.layers[-1].bias)
    def forward(self, x):
        for layer in self.layers[:-1]:
            x = torch.relu(layer(x))
        return torch.tanh(self.layers[-1](x)).squeeze(-1), self.aux(x)

def validate_model(model, index):
    if model.get('version') != 1 or model.get('featureVersion') != VERSION or model.get('featureNames') != index['featureNames'] or model.get('outputKind') != 'reference-residual' or model.get('residualScale') != 10:
        raise ValueError('Warm-start model schema mismatch')
    for key in ('mean', 'scale'):
        a = model.get('normalization', {}).get(key)
        if not isinstance(a, list) or len(a) != 192 or not all(finite(x) and (key != 'scale' or x > 0) for x in a):
            raise ValueError('Invalid normalization')
    if len(model.get('layers', [])) != 3:
        raise ValueError('Invalid model layers')
    for l, (n, m, activation) in zip(model['layers'], [(192,32,'relu'), (32,16,'relu'), (16,1,'linear')]):
        if (l.get('in'), l.get('out'), l.get('activation')) != (n,m,activation) or len(l.get('weights', [])) != n*m or len(l.get('bias', [])) != m or not all(finite(x) for x in l['weights'] + l['bias']):
            raise ValueError('Invalid layer')

def export(net, index, norm, model_id):
    return dict(version=1, featureVersion=VERSION, featureNames=index['featureNames'], id=model_id,
                outputKind='reference-residual', residualScale=10, normalization=norm,
                layers=[dict(**{'in': l.in_features, 'out': l.out_features}, activation='relu' if i < 2 else 'linear',
                             weights=l.weight.detach().cpu().flatten().tolist(), bias=l.bias.detach().cpu().tolist()) for i,l in enumerate(net.layers)])

def restore(net, model):
    with torch.no_grad():
        for layer, data in zip(net.layers, model['layers']):
            layer.weight.copy_(torch.tensor(data['weights']).reshape(layer.weight.shape))
            layer.bias.copy_(torch.tensor(data['bias']))

def f32(x):
    return struct.unpack('f', struct.pack('f', x))[0]

def scalar_predict(model, features):
    # Browser contract: float32 normalize, then rounded scalar product and add.
    norm = model['normalization']
    x = [f32(f32(f32(v) - f32(m)) / f32(s)) for v,m,s in zip(features, norm['mean'], norm['scale'])]
    for layer in model['layers']:
        y = []
        for o in range(layer['out']):
            value = f32(layer['bias'][o])
            for i in range(layer['in']):
                value = f32(value + f32(x[i] * layer['weights'][o * layer['in'] + i]))
            y.append(max(0., value) if layer['activation'] == 'relu' else value)
        x = y
    return 10 * math.tanh(x[0])

def metrics(rows, predictions):
    w = weights(rows)
    truth = np.asarray([r['targetMargin'] - r['baselineMargin'] for r in rows])
    error = np.asarray(predictions) - truth
    a = np.abs(error / 10)
    out = dict(huber=float(w @ np.where(a < 1, .5*a*a, a-.5)), mae=float(w @ np.abs(error)),
               saturation=float(w @ (np.abs(predictions) >= 9.5)), correctionMean=float(w @ np.asarray(predictions)),
               examples=len(rows), games=len({r['gameId'] for r in rows}), setups=len({r['setupSeed'] for r in rows}))
    return out

def strata(rows, predictions, feature_names=None):
    result = {}
    for field in ('generation', 'round', 'viewer'):
        result[field] = {}
        for key in sorted({r[field] for r in rows}):
            ids = [i for i,r in enumerate(rows) if r[field] == key]
            result[field][str(key)] = metrics([rows[i] for i in ids], np.asarray(predictions)[ids])
    if feature_names:
        engine_indices = [i for i,n in enumerate(feature_names) if any(k in n.lower() for k in ('repeat', 'conversion', 'converter', 'consumer', 'producer'))]
        result['engineActivity'] = {}
        if engine_indices:
            active = [any(r['features'][i] != 0 for i in engine_indices) for r in rows]
            for key in (False, True):
                ids = [i for i,a in enumerate(active) if a == key]
                if ids:
                    result['engineActivity']['present' if key else 'absent'] = metrics([rows[i] for i in ids], np.asarray(predictions)[ids])
        else:
            result['engineActivity'] = {'unavailable': 'No named producer/converter/consumer/repeat features in schema'}
    return result

def configure(device):
    torch.set_num_threads(4)
    try:
        torch.set_num_interop_threads(1)
    except RuntimeError:
        pass
    torch.use_deterministic_algorithms(True)
    torch.backends.cuda.matmul.allow_tf32 = False
    torch.backends.cudnn.allow_tf32 = False
    if device == 'cuda':
        if not torch.cuda.is_available():
            raise ValueError('CUDA requested but unavailable')
        torch.cuda.set_per_process_memory_fraction(min(1., CONFIG['gpuBytes']/torch.cuda.get_device_properties(0).total_memory), 0)
    random.seed(CONFIG['seed']); np.random.seed(CONFIG['seed']); torch.manual_seed(CONFIG['seed'])

def fit(manifest, out, warm_start=None, device='cpu'):
    configure(device)
    index, rows, sources = load_dataset(manifest)
    out = Path(out)
    if (out / 'training-summary.json').exists():
        raise ValueError('Use a fresh output directory; preserve prior evidence')
    train, dev = rows['train'], rows['dev']
    warm = read(warm_start) if warm_start else None
    if warm:
        validate_model(warm, index)
        norm = copy.deepcopy(warm['normalization'])
    else:
        if any(r['generation'] != 1 for r in train):
            raise ValueError('Later generations require warm-start frozen normalization')
        raw = np.asarray([r['features'] for r in train], dtype=np.float64)
        w = weights(train)
        mean = w @ raw
        scale = np.sqrt(w @ ((raw-mean)**2))
        scale[scale < 1e-6] = 1
        norm = dict(mean=mean.astype(np.float32).tolist(), scale=scale.astype(np.float32).tolist())
    def xs(rs):
        return ((np.asarray([r['features'] for r in rs], dtype=np.float32)-np.asarray(norm['mean'], dtype=np.float32))/np.asarray(norm['scale'], dtype=np.float32)).astype(np.float32)
    tx, dx = xs(train), xs(dev)
    net = Network().to(device)
    if warm:
        restore(net, warm)
    x = torch.tensor(tx, device=device)
    y = torch.tensor([(r['targetMargin']-r['baselineMargin'])/10 for r in train], dtype=torch.float32, device=device)
    aux = torch.tensor([r['targetAux'] for r in train], dtype=torch.float32, device=device)/20
    w = torch.tensor(weights(train), dtype=torch.float32, device=device)
    devx = torch.tensor(dx, device=device)
    def predict():
        with torch.no_grad():
            return (10*net(devx)[0]).cpu().numpy()
    epoch_zero = export(net, index, norm, 'epoch-zero')
    initial_prediction = predict()
    best_loss = metrics(dev, initial_prediction)['huber']
    best, best_epoch, stale = copy.deepcopy(net.state_dict()), 0, 0
    history = [dict(epoch=0, dev=metrics(dev, initial_prediction))]
    optimizer = torch.optim.AdamW(net.parameters(), lr=CONFIG['learningRate'], weight_decay=CONFIG['weightDecay'])
    for epoch in range(1, CONFIG['epochs']+1):
        net.train()
        order = torch.randperm(len(train), device=device)
        for batch in order.split(CONFIG['batchSize']):
            prediction, ap = net(x[batch])
            loss = torch.nn.functional.huber_loss(prediction, y[batch], reduction='none')
            loss += CONFIG['auxiliaryWeight'] * torch.nn.functional.huber_loss(ap, aux[batch], reduction='none').mean(dim=1)
            # Constant global denominator keeps small game/round cells correctly weighted.
            loss = (loss*w[batch]).sum() * len(train)/len(batch)
            optimizer.zero_grad(); loss.backward(); optimizer.step()
        net.eval()
        dm = metrics(dev, predict())
        history.append(dict(epoch=epoch, dev=dm))
        if dm['huber'] < best_loss - 1e-8:
            best_loss, best, best_epoch, stale = dm['huber'], copy.deepcopy(net.state_dict()), epoch, 0
        else:
            stale += 1
        if stale >= CONFIG['patience']:
            break
    net.load_state_dict(best)
    model = export(net, index, norm, 'selected-epoch-' + str(best_epoch))
    zero = copy.deepcopy(model); zero['id'] = 'equal-cost-zero'
    zero['layers'][-1]['weights'] = [0.] * 16; zero['layers'][-1]['bias'] = [0.]
    # Offline regularized linear residual, trained with identical group weighting.
    design = np.column_stack([tx.astype(np.float64), np.ones(len(train))])
    ww = weights(train)
    penalty = np.eye(193)*CONFIG['ridgeAlpha']; penalty[-1,-1] = 0
    coefficients = np.linalg.solve(design.T @ (ww[:,None]*design) + penalty,
                                   design.T @ (ww*np.asarray([(r['targetMargin']-r['baselineMargin'])/10 for r in train])))
    linear_prediction = 10*np.tanh(np.column_stack([dx, np.ones(len(dev))]) @ coefficients)
    selected_prediction = predict()
    reference = metrics(dev, np.zeros(len(dev)))
    selected = metrics(dev, selected_prediction)
    cases = []
    for e in dev[:8]:
        features = e['features']
        scalar = scalar_predict(model, features)
        with torch.no_grad():
            torch_value = float(10*net(torch.tensor(xs([e]), device=device))[0].cpu()[0])
        if abs(scalar-torch_value) > 0.0002:
            raise ValueError('Scalar/PyTorch export parity failure')
        cases.append(dict(features=features, expected=scalar, torchExpected=torch_value))
    write(out/'model.json', model); write(out/'zero-model.json', zero); write(out/'epoch-zero.json', epoch_zero)
    write(out/'linear-model.json', dict(featureVersion=VERSION, normalization=norm, coefficients=coefficients.tolist(), residualScale=10, outputActivation='tanh'))
    write(out/'parity.json', dict(schema=1, passed=True, status='passed', scope='Python scalar versus PyTorch; JS verification still required', featureVersion=VERSION, tolerance=0.0002, arithmetic='float32-normalize-product-add; float64 final 10*tanh', cases=cases))
    summary = dict(schema=1, config=CONFIG, device=device, optimizerReset=True, warmStartSha256=digest(warm_start) if warm_start else None,
                   normalizationFrozen=True, selectedEpoch=best_epoch, eligible=best_epoch > 0 and selected['huber'] < reference['huber']-1e-8,
                   eligibilityMeaning='Offline prediction only; playing-strength and runtime gates remain required',
                   history=history, dev=selected, epochZero=metrics(dev, initial_prediction), reference=reference,
                   linear=metrics(dev, linear_prediction), strata=strata(dev, selected_prediction, index['featureNames']),
                   trainNormalizedDrift=dict(weightedMean=(weights(train) @ tx.astype(np.float64)).tolist(), maxAbsFeature=float(np.abs(tx).max())),
                   readFiles=sources, manifestSha256=digest(manifest), trainerSha256=digest(__file__),
                   hashes={name:digest(out/name) for name in ['model.json','zero-model.json','epoch-zero.json','linear-model.json','parity.json']})
    write(out/'training-summary.json', summary)
    return summary

def audit(manifest, model_path, out):
    """One-shot terminal reporting; receipt is reserved before sealed records open."""
    out = Path(out)
    receipt = Path(manifest).resolve().with_suffix('.audit-receipt.json')
    model_hash = digest(model_path)
    linear_path = Path(model_path).with_name('linear-model.json')
    linear_hash = digest(linear_path)
    frozen = read(Path(model_path).with_name('training-summary.json'))
    if frozen.get('hashes', {}).get('model.json') != model_hash or frozen.get('hashes', {}).get('linear-model.json') != linear_hash:
        raise ValueError('Audit requires unchanged model/control from completed fit')
    with receipt.open('x', encoding='utf-8') as handle:
        json.dump(dict(schema=1, modelSha256=model_hash, linearSha256=linear_hash, manifestSha256=digest(manifest), status='reserved-no-retry'), handle)
    index, rows, sources = load_dataset(manifest, ('audit',))
    model = read(model_path); validate_model(model, index)
    predictions = [scalar_predict(model, r['features']) for r in rows['audit']]
    # The frozen sibling linear control is produced before audit, never fit here.
    linear = read(linear_path)
    if linear.get('normalization') != model['normalization'] or linear.get('featureVersion') != VERSION or len(linear.get('coefficients', [])) != 193 or not all(finite(v) for v in linear['coefficients']):
        raise ValueError('Frozen linear control mismatch')
    raw = np.asarray([r['features'] for r in rows['audit']], dtype=np.float32)
    normalized = (raw-np.asarray(model['normalization']['mean'],dtype=np.float32))/np.asarray(model['normalization']['scale'],dtype=np.float32)
    linear_predictions = 10*np.tanh(np.column_stack([normalized, np.ones(len(raw))]) @ np.asarray(linear['coefficients']))
    result = dict(schema=1, modelSha256=model_hash, manifestSha256=digest(manifest), trainingManifestSha256=frozen.get('manifestSha256'), readFiles=sources,
                  valid=True, eligible=frozen.get('eligible') is True and metrics(rows['audit'], predictions)['huber'] < metrics(rows['audit'], np.zeros(len(predictions)))['huber']-1e-8,
                  eligibilityCriterion='Frozen development-eligible candidate and audit Huber improves zero/reference by more than 1e-8; no checkpoint reselection',
                  selected=metrics(rows['audit'], predictions), reference=metrics(rows['audit'], np.zeros(len(predictions))),
                  zeroHead=metrics(rows['audit'], np.zeros(len(predictions))), linear=metrics(rows['audit'], linear_predictions),
                  linearSha256=digest(linear_path), strata=strata(rows['audit'], predictions, index['featureNames']), tuningPermitted=False)
    write(out/'audit-summary.json', result)
    write(receipt, dict(schema=1, modelSha256=model_hash, linearSha256=linear_hash, manifestSha256=digest(manifest), status='complete', summarySha256=digest(out/'audit-summary.json')))
    return result

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', required=True); parser.add_argument('--out', required=True)
    parser.add_argument('--warm-start'); parser.add_argument('--device', choices=['cpu','cuda'], default='cpu')
    parser.add_argument('--audit', action='store_true'); parser.add_argument('--model')
    args = parser.parse_args()
    if args.audit:
        if not args.model or args.warm_start:
            parser.error('--audit requires --model and forbids --warm-start')
        result = audit(args.manifest, args.model, args.out)
    else:
        if args.model:
            parser.error('--model is only for --audit')
        result = fit(args.manifest, args.out, args.warm_start, args.device)
    print(json.dumps(result, allow_nan=False))

if __name__ == '__main__':
    main()
