"""Derive a fresh absolute-path training index from the private Windows transfer.

Does not extract archives, alter frozen evidence, install packages or run training.
"""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath


def derive(root, out):
    root, out = Path(root).resolve(), Path(out).resolve()
    if out.exists():
        raise ValueError('Use a new index path; preserve original evidence')
    manifest_path = root / 'transfer-manifest.json'
    manifest_bytes = manifest_path.read_bytes()
    manifest = json.loads(manifest_bytes)
    if manifest.get('schema') != 1 or manifest.get('kind') != 'wingspan-private-transfer':
        raise ValueError('Unsupported private transfer manifest')
    training = manifest.get('training', {})
    records = training.get('records', [])
    if len(records) != training.get('recordCount') or not records:
        raise ValueError('Training inventory count mismatch')
    seen, groups, derived = set(), {}, []
    for record in records:
        if record.get('split') not in ('train', 'dev') or record.get('generation') not in range(1, 6):
            raise ValueError('Only the frozen generation1-5 train/dev inventory is allowed')
        relative = PurePosixPath(record.get('path', ''))
        if not str(relative) or relative.is_absolute() or '..' in relative.parts or ':' in str(relative) or '\\' in str(relative):
            raise ValueError('Unsafe portable input path')
        source = root.joinpath(*relative.parts).resolve()
        if not source.is_relative_to(root) or source in seen:
            raise ValueError('Duplicate or escaping input path')
        seen.add(source)
        group = record.get('setupSeed')
        if group in groups and groups[group] != record['split']:
            raise ValueError('Related setup crosses training/development split')
        groups[group] = record['split']
        raw_bytes = source.read_bytes()
        if hashlib.sha256(raw_bytes).hexdigest() != record.get('sha256'):
            raise ValueError('Raw source hash mismatch: ' + str(relative))
        raw = json.loads(raw_bytes)
        task = raw.get('task', {})
        for key, identity in [('id', 'gameId'), ('seed', 'setupSeed'), ('generation', 'generation'), ('split', 'split')]:
            if task.get(key) != record.get(identity):
                raise ValueError('Raw task identity mismatch: ' + str(relative))
        if task.get('kind') != 'collect' or raw.get('validation', {}).get('valid') is not True or raw.get('result', {}).get('status') != 'complete':
            raise ValueError('Incomplete or forbidden source record')
        derived.append({**record, 'path': str(source)})
    if {s:sum(r['split']==s for r in derived) for s in ['train','dev']} != training.get('splitCounts'):
        raise ValueError('Training/development counts changed')
    index = {k:training[k] for k in ['featureVersion','featureNames','auxNames','architecture','replayMass','selection'] if k in training}
    index.update(schema=1, records=derived, migrationProvenance={
        'transferManifestSha256':hashlib.sha256(manifest_bytes).hexdigest(),
        'originalIndexSha256':training.get('originalIndexSha256'),
        'originalFrozenEvidenceUnchanged':True,
        'meaning':'Derived path-only index; use fresh outputs, never resume old campaigns'})
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open('x', encoding='utf-8', newline='\n') as handle:
        json.dump(index, handle, indent=2, allow_nan=False)
        handle.write('\n')
    return {'records':len(derived),'uniqueSetups':len(groups),'indexSha256':hashlib.sha256(out.read_bytes()).hexdigest()}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    print(json.dumps(derive(args.root, args.out)))
