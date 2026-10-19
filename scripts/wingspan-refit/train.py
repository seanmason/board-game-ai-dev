"""Four frozen refit recipes delegating unchanged fitting to the compact trainer."""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import time
from types import MappingProxyType


BASE_TRAINER = Path(__file__).resolve().parents[1] / 'wingspan-selfplay' / 'train.py'
FIXED_CONFIG = MappingProxyType(dict(seed=1729, epochs=24, patience=4, batchSize=512,
    weightDecay=0.0001, auxiliaryScale=20, ridgeAlpha=10, cpuThreads=4,
    gpuBytes=6 * 1024**3))
RECIPES = MappingProxyType({name: MappingProxyType(dict(learningRate=lr, auxiliaryWeight=aux))
    for name, lr, aux in [('control', .0005, .05), ('value-only', .0005, 0),
                          ('gentle', .0001, .05), ('gentle-value', .0001, 0)]})


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))


def recipe_config(recipe):
    if recipe not in RECIPES:
        raise ValueError('Unknown frozen recipe: ' + str(recipe))
    return {**FIXED_CONFIG, **RECIPES[recipe]}


def recipe_digest(recipe):
    canonical = json.dumps(dict(recipe=recipe, config=recipe_config(recipe)), sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(canonical.encode('utf-8')).hexdigest()


def validate_inventory(manifest):
    """Validate every split before opening raw inputs, then snapshot their bytes.

    The delegated trainer remains responsible for task/example/schema validation.
    This wrapper additionally forbids even including sealed inventory entries.
    """
    manifest = Path(manifest).resolve()
    manifest_hash = digest(manifest)
    index = read(manifest)
    records = index.get('records')
    if not isinstance(records, list) or not records:
        raise ValueError('Explicit nonempty record inventory required')
    paths = set()
    for record in records:
        if not isinstance(record, dict) or record.get('split') not in ('train', 'dev'):
            raise ValueError('Refit inventory permits only train/dev; sealed audit/calibration forbidden')
        generation = record.get('generation')
        if isinstance(generation, bool) or not isinstance(generation, int) or not 1 <= generation <= 6:
            raise ValueError('Refit inventory generation must be 1 through 6')
        path = record.get('path')
        if not isinstance(path, str) or not Path(path).is_absolute():
            raise ValueError('Record paths must be absolute and unique')
        canonical = str(Path(path).resolve()).casefold()
        if canonical in paths:
            raise ValueError('Record paths must be absolute and unique')
        paths.add(canonical)
        expected = record.get('sha256')
        if 'sha256' in record and (not isinstance(expected, str) or not re.fullmatch('[0-9a-fA-F]{64}', expected)):
            raise ValueError('Invalid inventory sha256')
    if {r['split'] for r in records} != {'train', 'dev'}:
        raise ValueError('Both train and dev inventory required')
    inputs = []
    for record in records:
        actual = digest(record['path'])
        if 'sha256' in record and actual != record['sha256'].lower():
            raise ValueError('Raw input hash differs from inventory sha256: ' + record['path'])
        inputs.append(dict(path=str(Path(record['path']).resolve()), sha256=actual, split=record['split']))
    snapshot = dict(manifestPath=str(manifest), manifestSha256=manifest_hash, readFiles=inputs)
    verify_snapshot(snapshot)
    return snapshot


def verify_snapshot(snapshot):
    if digest(snapshot['manifestPath']) != snapshot['manifestSha256']:
        raise ValueError('Dataset manifest changed during refit')
    for source in snapshot['readFiles']:
        if digest(source['path']) != source['sha256']:
            raise ValueError('Raw input changed during refit: ' + source['path'])


def require_fresh_output(out):
    out = Path(out).resolve()
    if out.exists():
        raise ValueError('Use a fresh output path; preserve all prior evidence')
    return out


def load_base_trainer():
    # The base module establishes CPU/CUDA environment limits before numpy/torch.
    spec = importlib.util.spec_from_file_location('wingspan_refit_base', BASE_TRAINER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def fit(manifest, out, warm_start, recipe, device='cpu'):
    config = recipe_config(recipe)
    if device not in ('cpu', 'cuda'):
        raise ValueError('Device must be cpu or cuda')
    out = require_fresh_output(out)
    snapshot = validate_inventory(manifest)
    warm_start = Path(warm_start).resolve()
    warm_hash, base_hash, wrapper_hash = digest(warm_start), digest(BASE_TRAINER), digest(__file__)
    base = load_base_trainer()
    if set(base.CONFIG) != set(config):
        raise ValueError('Base trainer config contract changed')
    base.CONFIG = config.copy()
    verify_snapshot(snapshot)
    if digest(warm_start) != warm_hash or digest(BASE_TRAINER) != base_hash:
        raise ValueError('Warm start or base trainer changed before refit')
    # Exclusive creation also rejects concurrent attempts using the same output.
    out.mkdir(parents=True, exist_ok=False)
    receipt = dict(schema=1, status='reserved', recipe=recipe, config=config, recipeSha256=recipe_digest(recipe),
        architecture=[192, 32, 16, 1], auxiliaryHead='randomly initialized; not exported or restored',
        wrapperSha256=wrapper_hash, baseTrainerSha256=base_hash,
        warmStartSha256=warm_hash, **snapshot)
    base.write(out / 'recipe-receipt.json', receipt)
    fit_wall, fit_cpu = time.perf_counter_ns(), time.process_time_ns()
    summary = base.fit(manifest, out, warm_start, device)
    receipt.update(trainerWallMs=(time.perf_counter_ns()-fit_wall)/1e6,
        trainerProcessCpuMicros=(time.process_time_ns()-fit_cpu)/1000)
    verify_snapshot(snapshot)
    if digest(warm_start) != warm_hash or digest(BASE_TRAINER) != base_hash or digest(__file__) != wrapper_hash:
        raise ValueError('Warm start or trainer changed during refit')
    if summary.get('trainerSha256') != base_hash or summary.get('manifestSha256') != snapshot['manifestSha256'] or summary.get('warmStartSha256') != warm_hash:
        raise ValueError('Delegated trainer provenance mismatch')
    if summary.get('readFiles') != snapshot['readFiles']:
        # Compare resolved paths because the original trainer preserves index spelling.
        normalized = [{**r, 'path': str(Path(r['path']).resolve())} for r in summary.get('readFiles', [])]
        if normalized != snapshot['readFiles']:
            raise ValueError('Delegated trainer input inventory mismatch')
    receipt.update(status='complete', trainingSummarySha256=digest(out / 'training-summary.json'))
    base.write(out / 'recipe-receipt.json', receipt)
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest')
    parser.add_argument('--out')
    parser.add_argument('--warm-start')
    parser.add_argument('--recipe', choices=tuple(RECIPES))
    parser.add_argument('--device', choices=['cuda', 'cpu'], default='cpu')
    parser.add_argument('--describe-only', action='store_true')
    args = parser.parse_args()
    if args.describe_only:
        print(json.dumps({name: recipe_config(name) for name in RECIPES}, allow_nan=False))
        return
    if any(getattr(args, key) is None for key in ('manifest', 'out', 'warm_start', 'recipe')):
        parser.error('--manifest, --out, --warm-start and --recipe are required for fitting')
    print(json.dumps(fit(args.manifest, args.out, args.warm_start, args.recipe, args.device), allow_nan=False))


if __name__ == '__main__':
    main()
