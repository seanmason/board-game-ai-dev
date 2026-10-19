"""Bounded, grouped Wingspan value fitting. Never tunes against the test split."""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import random
import statistics
import subprocess
import sys
import time

# Set before importing numerical runtimes; one trainer, no generation workers.
for _name in ("OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS", "NUMEXPR_NUM_THREADS"):
    os.environ[_name] = "4"
os.environ.setdefault("CUBLAS_WORKSPACE_CONFIG", ":4096:8")

SEEDS = (1729, 2718, 31415)
VALUE_SCALE = 30.0
AUX_SCALE = 20.0
AUX_NAMES = [f"{side}.{key}" for side in ("own", "other") for key in ("birds", "bonuses", "goals", "eggs", "cached", "tucked")]
CONFIG = dict(epochs=100, patience=10, batch_size=512, learning_rate=.001, weight_decay=.0001, auxiliary_weight=.1, ridge_alpha=10.0, cpu_threads=4)
_libraries = None


def libraries():
    global _libraries
    if _libraries is None:
        try:
            import numpy as np
            import torch
        except ImportError as error:
            raise RuntimeError("Run in the isolated environment containing pinned NumPy and PyTorch") from error
        torch.set_num_threads(4)
        try:
            torch.set_num_interop_threads(1)
        except RuntimeError:
            pass  # Already initialized by an embedding test process.
        torch.backends.cuda.matmul.allow_tf32 = False
        torch.backends.cudnn.allow_tf32 = False
        torch.use_deterministic_algorithms(True)
        _libraries = (np, torch)
    return _libraries


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def write(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    temp.replace(path)


def finite_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def load_dataset(root):
    """Validate complete frozen inventory and whole-setup grouping before fitting."""
    root = Path(root).resolve()
    manifest_path = root / "manifest.json"
    manifest = read(manifest_path)
    encoder = manifest.get("encoder", {})
    names = manifest.get("featureNames", encoder.get("featureNames"))
    version = manifest.get("featureVersion", encoder.get("featureVersion"))
    if not isinstance(names, list) or not names or len(set(names)) != len(names) or not all(isinstance(x, str) and x for x in names) or not isinstance(version, str) or not version:
        raise ValueError("Frozen featureVersion and unique featureNames required in dataset manifest")
    declared_tasks = manifest.get("tasks")
    if not isinstance(declared_tasks, list) or not declared_tasks:
        raise ValueError("Explicit frozen dataset task inventory required")
    declared = {t["id"]: t for t in declared_tasks}
    if len(declared) != len(declared_tasks):
        raise ValueError("Duplicate declared dataset task")
    if manifest.get("auxNames", AUX_NAMES) != AUX_NAMES:
        raise ValueError("Auxiliary component order differs from frozen twelve-component target")
    paths = sorted((root / "games").glob("*.json"))
    if not paths:
        raise ValueError("No collected game JSON under dataset/games")
    splits = {key: [] for key in ("train", "dev", "test")}
    setup_splits, game_splits, example_keys, seen_tasks = {}, {}, set(), set()
    sources, quarantined = [], []
    for path in paths:
        game = read(path)
        task, result = game.get("task", {}), game.get("result", {})
        task_id = task.get("id")
        if not isinstance(task_id, str) or not task_id or task_id in seen_tasks:
            raise ValueError(f"Missing/duplicate task id: {path.name}")
        if task_id not in declared or task != declared[task_id]:
            raise ValueError(f"Game task differs from frozen dataset inventory: {task_id}")
        seen_tasks.add(task_id)
        sources.append(dict(file=str(path.relative_to(root)), sha256=digest(path), taskId=task_id))
        if game.get("validation", {}).get("valid") is not True or result.get("status") != "complete":
            quarantined.append(dict(taskId=task_id, reason="invalid/incomplete game; terminal labels not consumed"))
            continue
        scores = result.get("scores")
        if not isinstance(scores, list) or len(scores) != 2 or not all(finite_number(x) for x in scores):
            raise ValueError(f"Invalid exact terminal scores: {task_id}")
        examples = game.get("valueExamples")
        if not isinstance(examples, list) or not examples:
            raise ValueError(f"No value examples: {task_id}")
        for example in examples:
            split, seed, game_id = example.get("split"), example.get("setupSeed"), example.get("gameId")
            if split not in splits or not isinstance(seed, int) or isinstance(seed, bool) or not isinstance(game_id, str) or not game_id:
                raise ValueError(f"Invalid split/group identity: {task_id}")
            if task.get("split", split) != split or task.get("seed", seed) != seed or task_id != game_id:
                raise ValueError(f"Example does not match frozen task: {task_id}")
            if seed in setup_splits and setup_splits[seed] != split or game_id in game_splits and game_splits[game_id] != split:
                raise ValueError("Whole setup/game group leaked across train/dev/test")
            setup_splits[seed], game_splits[game_id] = split, split
            viewer, step = example.get("viewer"), example.get("step")
            if viewer not in (0, 1) or isinstance(viewer, bool) or not isinstance(step, int) or isinstance(step, bool) or step < 0:
                raise ValueError("Invalid viewer/step")
            key = (game_id, step, viewer)
            if key in example_keys:
                raise ValueError("Duplicate value example")
            example_keys.add(key)
            features, target, aux = example.get("features"), example.get("targetMargin"), example.get("targetAux")
            if example.get("featureVersion", version) != version:
                raise ValueError("Example feature version differs from frozen encoder")
            if not isinstance(features, list) or len(features) != len(names) or not all(finite_number(x) for x in features):
                raise ValueError("Invalid feature vector")
            if not finite_number(target) or abs(target - (scores[viewer] - scores[1 - viewer])) > 1e-8:
                raise ValueError("Target margin disagrees with exact game outcome/perspective")
            if not isinstance(aux, list) or len(aux) != 12 or not all(finite_number(x) for x in aux):
                raise ValueError("Invalid auxiliary labels")
            components = result.get("scoreComponents")
            if isinstance(components, list) and len(components) == 2:
                expected = [components[i][name.split(".")[1]] for i, side in ((viewer, "own"), (1 - viewer, "other")) for name in AUX_NAMES if name.startswith(side + ".")]
                if any(abs(a - b) > 1e-8 for a, b in zip(aux, expected)):
                    raise ValueError("Auxiliary labels disagree with exact score components")
            if example.get("baselineMargin") is not None and not finite_number(example["baselineMargin"]):
                raise ValueError("Non-finite observation-safe baseline margin")
            splits[split].append(example)
        # Every recorded ordinary state must contain both viewers, never just one.
        steps = {e["step"] for e in examples}
        if any({e["viewer"] for e in examples if e["step"] == step} != {0, 1} for step in steps):
            raise ValueError("Incomplete paired viewer observations")
    if set(declared) != seen_tasks:
        raise ValueError("Frozen dataset task inventory incomplete or contains unexpected games")
    if quarantined:
        raise ValueError(f"Dataset contains {len(quarantined)} quarantined invalid/incomplete games; no silent sample reduction")
    if any(not rows for rows in splits.values()):
        raise ValueError("Nonempty training, development and offline test groups required")
    return dict(root=root, manifest=manifest, feature_names=names, feature_version=version, splits=splits, sources=sources, manifest_sha256=digest(manifest_path))


def arrays(rows):
    np, _ = libraries()
    return (np.asarray([r["features"] for r in rows], dtype=np.float32), np.asarray([r["targetMargin"] / VALUE_SCALE for r in rows], dtype=np.float32), np.asarray([r["targetAux"] for r in rows], dtype=np.float32) / AUX_SCALE)


def normalization(train_x):
    np, _ = libraries()
    mean = train_x.astype(np.float64).mean(axis=0).astype(np.float32)
    scale = train_x.astype(np.float64).std(axis=0).astype(np.float32)
    scale[scale < 1e-6] = 1.0
    return mean, scale


def normalized(x, norm):
    np, _ = libraries()
    return ((x.astype(np.float32) - norm[0]) / norm[1]).astype(np.float32)


def make_network(width):
    _, torch = libraries()

    class Network(torch.nn.Module):
        def __init__(self):
            super().__init__()
            self.trunk = torch.nn.Sequential(torch.nn.Linear(width, 64), torch.nn.ReLU(), torch.nn.Linear(64, 32), torch.nn.ReLU())
            self.value = torch.nn.Linear(32, 1)
            self.auxiliary = torch.nn.Linear(32, 12)

        def forward(self, x):
            hidden = self.trunk(x)
            return self.value(hidden).squeeze(-1), self.auxiliary(hidden)

    return Network()


def model_predictions(model, x, device="cpu"):
    np, torch = libraries()
    model = model.to(device).eval()
    predictions = []
    with torch.inference_mode():
        for start in range(0, len(x), 4096):
            value, _ = model(torch.from_numpy(x[start:start + 4096]).to(device))
            predictions.extend(value.cpu().numpy().astype(np.float64) * VALUE_SCALE)
    return np.asarray(predictions, dtype=np.float64)


def cpu_latency(model, example):
    np, torch = libraries()
    model = model.cpu().eval()
    x = torch.from_numpy(np.asarray(example, dtype=np.float32).reshape(1, -1))
    with torch.inference_mode():
        for _ in range(10):
            model(x)
        started = time.perf_counter()
        for _ in range(100):
            model(x)
    return (time.perf_counter() - started) * 10  # milliseconds / example


def fit_network(train, dev, device, out, epochs=100):
    np, torch = libraries()
    if not 1 <= epochs <= 100:
        raise ValueError("Epoch ceiling is 100")
    x, y, aux = [torch.from_numpy(a).to(device) for a in train]
    dx, dy, _ = [torch.from_numpy(a).to(device) for a in dev]
    loss_fn = torch.nn.HuberLoss(delta=1.0)
    candidates, curves = [], {}
    for seed in SEEDS:
        random.seed(seed)
        np.random.seed(seed)
        torch.manual_seed(seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(seed)
        model = make_network(x.shape[1]).to(device)
        optimizer = torch.optim.AdamW(model.parameters(), lr=CONFIG["learning_rate"], weight_decay=CONFIG["weight_decay"])
        best, best_epoch, best_state, stale = math.inf, 0, None, 0
        curve = []
        for epoch in range(1, epochs + 1):
            model.train()
            order = torch.randperm(len(x), device=device)
            losses = []
            for start in range(0, len(x), CONFIG["batch_size"]):
                ids = order[start:start + CONFIG["batch_size"]]
                optimizer.zero_grad(set_to_none=True)
                prediction, auxiliary = model(x[ids])
                value_loss, auxiliary_loss = loss_fn(prediction, y[ids]), loss_fn(auxiliary, aux[ids])
                loss = value_loss + CONFIG["auxiliary_weight"] * auxiliary_loss
                loss.backward()
                optimizer.step()
                losses.append(float(loss.detach().cpu()))
            model.eval()
            with torch.inference_mode():
                dev_loss = float(loss_fn(model(dx)[0], dy).cpu())
            curve.append(dict(epoch=epoch, trainingObjective=sum(losses) / len(losses), devValueHuber=dev_loss))
            if not math.isfinite(dev_loss):
                raise RuntimeError("Non-finite development loss")
            if dev_loss < best - 1e-12:
                best, best_epoch, best_state, stale = dev_loss, epoch, copy.deepcopy(model.cpu().state_dict()), 0
                model.to(device)
            else:
                stale += 1
            if epoch == 1 or epoch % 10 == 0:
                print(json.dumps(dict(stage="fit", seed=seed, epoch=epoch, devValueHuber=dev_loss)), flush=True)
            if stale >= CONFIG["patience"]:
                break
        model = make_network(x.shape[1])
        model.load_state_dict(best_state)
        latency = cpu_latency(model, dev[0][0])
        checkpoint = Path(out) / f"checkpoint-{seed}.pt"
        torch.save(dict(state_dict=best_state, seed=seed, bestEpoch=best_epoch, devValueHuber=best), checkpoint)
        candidates.append(dict(seed=seed, bestEpoch=best_epoch, devValueHuber=best, cpuInferenceMs=latency, checkpoint=checkpoint.name, checkpointSha256=digest(checkpoint)))
        curves[str(seed)] = curve
    # Test labels and online outcomes never enter this selection.
    selected = min(candidates, key=lambda c: (c["devValueHuber"], c["cpuInferenceMs"], c["seed"]))
    state = torch.load(Path(out) / selected["checkpoint"], map_location="cpu", weights_only=True)
    chosen = make_network(train[0].shape[1])
    chosen.load_state_dict(state["state_dict"])
    return chosen.eval(), selected, candidates, curves


def fit_ridge(x, y):
    np, _ = libraries()
    # Standard ridge objective ||Xw-y||^2 + alpha||w||^2, intercept unpenalized.
    xd, yd = x.astype(np.float64), y.astype(np.float64)
    xm, ym = xd.mean(axis=0), float(yd.mean())
    centered = xd - xm
    covariance = centered.T @ centered
    covariance.flat[::covariance.shape[0] + 1] += CONFIG["ridge_alpha"]
    weights = np.linalg.solve(covariance, centered.T @ (yd - ym))
    bias = ym - float(xm @ weights)
    return weights.astype(np.float32), np.float32(bias)


def dense_layer(layer, activation):
    return {"in": layer.in_features, "out": layer.out_features, "weights": layer.weight.detach().cpu().float().reshape(-1).tolist(), "bias": layer.bias.detach().cpu().float().tolist(), "activation": activation}


def export_model(dataset, norm, layers, metadata):
    return dict(version=1, featureVersion=dataset["feature_version"], featureNames=dataset["feature_names"], normalization=dict(mean=norm[0].tolist(), scale=norm[1].tolist()), layers=layers, valueScale=VALUE_SCALE, metadata=metadata)


def scalar_margin(model, features):
    """Literal browser fround normalization/product/accumulation parity oracle."""
    np, _ = libraries()
    mean, scale = model["normalization"]["mean"], model["normalization"]["scale"]
    values = [np.float32(np.float32(np.float32(x) - np.float32(m)) / np.float32(s)) for x, m, s in zip(features, mean, scale)]
    for layer in model["layers"]:
        next_values = []
        for o in range(layer["out"]):
            total = np.float32(layer["bias"][o])
            for j in range(layer["in"]):
                total = np.float32(total + np.float32(values[j] * np.float32(layer["weights"][o * layer["in"] + j])))
            if layer["activation"] == "relu":
                total = np.maximum(total, np.float32(0))
            next_values.append(total)
        values = next_values
    return float(np.float32(values[0] * np.float32(model["valueScale"])))


def parity_indices(rows, norm, predictions, minimum=30):
    """Development-only strata, endpoints, input/prediction extrema; no labels."""
    np, _ = libraries()
    chosen = []

    def add(index):
        if int(index) not in chosen:
            chosen.append(int(index))

    for round_number in (1, 2, 3, 4):
        for viewer in (0, 1):
            ids = [i for i, row in enumerate(rows) if row.get("round") == round_number and row["viewer"] == viewer]
            if ids:
                add(ids[0])
                add(ids[-1])
    add(0)
    add(len(rows) - 1)
    features = np.asarray([row["features"] for row in rows], dtype=np.float32)
    nx = normalized(features, norm)
    for values in (features.min(axis=1), features.max(axis=1), np.linalg.norm(nx, axis=1), predictions):
        add(np.argmin(values))
        add(np.argmax(values))
    for index in np.linspace(0, len(rows) - 1, min(max(minimum, 40), len(rows)), dtype=int):
        add(index)
    for index in range(len(rows)):
        if len(chosen) >= min(minimum, len(rows)):
            break
        add(index)
    return chosen


def engine_class(row, catalog):
    """Diagnostic stratum from the viewer's installed PUBLIC birds only."""
    observation = row.get("observation")
    if not isinstance(observation, dict):
        return "not-recorded"
    player = observation.get("players", [])[row["viewer"]]
    ids = [entry.get("id") for habitat in ("forest", "grassland", "wetland") for entry in player.get("habitats", {}).get(habitat, [])]
    birds = [catalog[bird_id] for bird_id in ids if bird_id in catalog]
    if any(bird.get("powerCode") in (33, 41, 43, 49) for bird in birds):
        return "exceptional-installed"
    if sum(bird.get("powerType") == "brown" for bird in birds) >= 2:
        return "other-brown-engine"
    return "other"


def build_parity(dataset, mlp, linear, model, ridge, norm):
    np, _ = libraries()
    parity = dict(version=1, featureVersion=dataset["feature_version"], tolerancePoints=.001, fixtureSplit="dev-only", generatorSha256=digest(__file__), selectionRule="both-viewer/round endpoints, first/last, input extrema and normalized-input-norm extrema, selected-model prediction extrema, deterministic spaced fill; never test labels", models={})
    all_rows = dataset["splits"]["dev"]
    all_x = np.asarray([r["features"] for r in all_rows], dtype=np.float32)
    indices = parity_indices(all_rows, norm, model_predictions(model, normalized(all_x, norm)))
    rows = [all_rows[i] for i in indices]
    parity["fixtureCountPerModel"] = len(rows)
    x = np.asarray([r["features"] for r in rows], dtype=np.float32)
    fast = {"mlp": model_predictions(model, normalized(x, norm)), "linear": (normalized(x, norm) @ ridge[0] + ridge[1]).astype(np.float64) * VALUE_SCALE}
    maximum = 0.0
    for name, exported in (("mlp", mlp), ("linear", linear)):
        fixtures = []
        for i, row in enumerate(rows):
            expected, actual = scalar_margin(exported, row["features"]), float(fast[name][i])
            maximum = max(maximum, abs(expected - actual))
            fixtures.append(dict(features=row["features"], expectedMargin=expected, torchMargin=actual, gameId=row["gameId"], setupSeed=row["setupSeed"], step=row["step"], viewer=row["viewer"], round=row.get("round")))
        parity["models"][name] = fixtures
    parity["maxTorchVsScalarDifferencePoints"] = maximum
    return parity


def bootstrap(values, seed=821337, repetitions=2000):
    np, _ = libraries()
    values = np.asarray(values, dtype=np.float64)
    if not len(values):
        return None
    if len(values) < 2:
        return dict(n=len(values), mean=float(values.mean()), ci95=None, method="insufficient-independent-groups")
    if float(values.max() - values.min()) < 1e-12:
        return dict(n=len(values), mean=float(values.mean()), ci95=None, degenerate=True, method="empirically-degenerate-bootstrap-not-certainty")
    rng = np.random.default_rng(seed)
    estimates = values[rng.integers(0, len(values), size=(repetitions, len(values)))].mean(axis=1)
    return dict(n=len(values), mean=float(values.mean()), ci95=[float(x) for x in np.quantile(estimates, [.025, .975])], method="setup-group-percentile-bootstrap", repetitions=repetitions, seed=seed)


def grouped_metric(rows, predictions):
    groups = {}
    for row, prediction in zip(rows, predictions):
        groups.setdefault(row["setupSeed"], []).append(abs(float(prediction) - row["targetMargin"]))
    means = {seed: statistics.fmean(values) for seed, values in groups.items()}
    return means, bootstrap(list(means.values()))


def evaluate_offline(dataset, model, ridge, norm):
    np, _ = libraries()
    train_target = [r["targetMargin"] for r in dataset["splits"]["train"]]
    constant = statistics.fmean(train_target)
    catalog_path = Path(__file__).resolve().parents[2] / "wingspan" / "data" / "birds.json"
    expected_catalog_hash = dataset["manifest"].get("sourceHashes", {}).get("wingspan/data/birds.json")
    if expected_catalog_hash is not None and digest(catalog_path) != expected_catalog_hash:
        raise ValueError("Public catalog differs from dataset frozen source")
    catalog = {bird["id"]: bird for bird in read(catalog_path)}
    report = dict(target="actual-final-viewer-margin-points", constantTrainMean=constant, uncertaintyUnit="whole-setup-group, both viewers/all turns retained together", engineDefinition="viewer public installed powers33/41/43/49 -> exceptional-installed; otherwise at least2brown birds -> other-brown-engine; otherwise other. Missing observation -> not-recorded. No private fields inspected.", publicCatalogSha256=digest(catalog_path), splits={})
    for split in ("dev", "test"):
        rows = dataset["splits"][split]
        x, _, _ = arrays(rows)
        nx = normalized(x, norm)
        predictions = dict(mlp=model_predictions(model, nx), linear=(nx @ ridge[0] + ridge[1]).astype(np.float64) * VALUE_SCALE, constant=np.full(len(rows), constant))
        reference_complete = all(finite_number(r.get("baselineMargin")) for r in rows)
        if reference_complete:
            predictions["reference"] = np.asarray([r["baselineMargin"] for r in rows], dtype=np.float64)
        metrics, group_means = {}, {}
        for name, values in predictions.items():
            means, summary = grouped_metric(rows, values)
            group_means[name], metrics[name] = means, {"groupMAE": summary, "positionMAE": float(np.abs(values - np.asarray([r["targetMargin"] for r in rows])).mean()), "maxAbsoluteError": float(np.max(np.abs(values - np.asarray([r["targetMargin"] for r in rows]))))}
        comparisons = {}
        for baseline in predictions.keys() - {"mlp"}:
            comparisons[f"mlpMAEminus{baseline}"] = bootstrap([group_means["mlp"][key] - group_means[baseline][key] for key in group_means["mlp"]])
        by_round, by_engine = {}, {}
        for field, target in (("round", by_round), ("engineType", by_engine)):
            strata = [str(row.get("round", "not-recorded")) if field == "round" else engine_class(row, catalog) for row in rows]
            for value in sorted(set(strata)):
                ids = [i for i, stratum in enumerate(strata) if stratum == value]
                subset = [rows[i] for i in ids]
                target[value] = {name: grouped_metric(subset, values[ids])[1] for name, values in predictions.items()}
        # Bins describe point calibration only; they are not win-probability bins.
        values = predictions["mlp"]
        edges = np.quantile(values, np.linspace(0, 1, 6))
        calibration = []
        for i in range(5):
            ids = np.where((values >= edges[i]) & (values <= edges[i + 1] if i == 4 else values < edges[i + 1]))[0]
            if len(ids):
                calibration.append(dict(positionCount=len(ids), setupGroups=len({rows[j]["setupSeed"] for j in ids}), predictedMean=float(values[ids].mean()), actualMean=float(np.asarray([rows[j]["targetMargin"] for j in ids]).mean())))
        report["splits"][split] = dict(examples=len(rows), setupGroups=len(group_means["mlp"]), metrics=metrics, pairedGroupComparisons=comparisons, referenceComparison="complete" if reference_complete else "unavailable: missing observation-safe baselineMargin", byRound=by_round, byEngine=by_engine, pointCalibration=calibration)
    report["heldOutLearning"] = all(report["splits"][split]["metrics"]["mlp"]["groupMAE"]["mean"] < report["splits"][split]["metrics"]["constant"]["groupMAE"]["mean"] for split in ("dev", "test"))
    report["strengthClaim"] = False
    report["modelSelectionUsedTest"] = False
    return report


def train(data, out, device="cuda", max_vram_gb=6, epochs=100):
    np, torch = libraries()
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    if any((out / name).exists() for name in ("selection.json", "mlp.json", "offline-report.json")):
        raise ValueError("Use a fresh output directory; never overwrite a selected model/test report")
    if device not in ("cuda", "cpu") or not finite_number(max_vram_gb) or max_vram_gb <= 0 or max_vram_gb > 6:
        raise ValueError("Choose cpu/cuda and a positive VRAM ceiling at most 6 GiB")
    if device == "cuda":
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA requested but unavailable; no silent CPU fallback")
        total = torch.cuda.get_device_properties(0).total_memory
        torch.cuda.set_per_process_memory_fraction(min(1, max_vram_gb * 1024**3 / total), 0)
        smoke = torch.ones(8, device="cuda", requires_grad=True)
        smoke.square().mean().backward()
        torch.cuda.synchronize()
        del smoke
    dataset = load_dataset(data)
    started = time.perf_counter()
    train_arrays, dev_arrays = arrays(dataset["splits"]["train"]), arrays(dataset["splits"]["dev"])
    norm = normalization(train_arrays[0])
    training = (normalized(train_arrays[0], norm), train_arrays[1], train_arrays[2])
    development = (normalized(dev_arrays[0], norm), dev_arrays[1], dev_arrays[2])
    run_manifest = dict(version=1, createdAt=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), config={**CONFIG, "epochs": epochs, "optimizationSeeds": list(SEEDS), "valueScale": VALUE_SCALE, "auxiliaryScale": AUX_SCALE, "auxiliaryNames": AUX_NAMES}, device=device, maxVramGiB=max_vram_gb, torchVersion=torch.__version__, numpyVersion=np.__version__, pythonVersion=platform.python_version(), cudaVersion=torch.version.cuda, cudaDevice=torch.cuda.get_device_name(0) if device == "cuda" else None, trainerSha256=digest(__file__), datasetManifestSha256=dataset["manifest_sha256"], datasetSources=dataset["sources"], splitGroups={key: len({r["setupSeed"] for r in rows}) for key, rows in dataset["splits"].items()}, normalizationFitSplit="train-only", featureClipping=False, selectionRule="minimum development value Huber, then CPU latency, then seed; test evaluated only after frozen selection")
    write(out / "training-manifest.json", run_manifest)
    try:
        frozen = subprocess.run([sys.executable, "-m", "pip", "freeze"], check=True, capture_output=True, text=True).stdout
        (out / "requirements-lock.txt").write_text(frozen, encoding="utf-8")
    except (subprocess.SubprocessError, OSError) as error:
        raise RuntimeError("Could not freeze installed package versions") from error
    ridge = fit_ridge(training[0], training[1])
    model, selected, candidates, curves = fit_network(training, development, device, out, epochs)
    write(out / "selection.json", {"selected": selected, "candidates": candidates, "selectionSplit": "dev", "testUsed": False})
    write(out / "loss-curves.json", curves)
    metadata = dict(kind="mlp", synthetic=dataset["manifest"].get("synthetic") is True, datasetProfile=dataset["manifest"].get("profile"), selectedSeed=selected["seed"], selectedEpoch=selected["bestEpoch"], datasetManifestSha256=dataset["manifest_sha256"], trainingManifestSha256=digest(out / "training-manifest.json"), mainTarget="actual final viewer-relative margin; one prediction, not two subtracted predictions", auxiliaryTrainingOnly=True, parameterCountIncludingAuxiliary=sum(p.numel() for p in model.parameters()), inferenceParameterCount=sum(p.numel() for layer in (model.trunk[0], model.trunk[2], model.value) for p in layer.parameters()))
    mlp = export_model(dataset, norm, [dense_layer(model.trunk[0], "relu"), dense_layer(model.trunk[2], "relu"), dense_layer(model.value, "linear")], metadata)
    linear = export_model(dataset, norm, [{"in": len(dataset["feature_names"]), "out": 1, "weights": ridge[0].tolist(), "bias": [float(ridge[1])], "activation": "linear"}], {**metadata, "kind": "linear-ridge", "ridgeAlpha": CONFIG["ridge_alpha"], "parameterCountIncludingAuxiliary": len(ridge[0]) + 1, "inferenceParameterCount": len(ridge[0]) + 1, "auxiliaryTrainingOnly": False})
    write(out / "mlp.json", mlp)
    write(out / "linear.json", linear)
    # Freeze selected bytes before touching held-out test metrics.
    frozen_model_sha = digest(out / "mlp.json")
    parity = build_parity(dataset, mlp, linear, model, ridge, norm)
    write(out / "parity.json", parity)
    if parity["maxTorchVsScalarDifferencePoints"] > parity["tolerancePoints"]:
        raise RuntimeError("Export float32 scalar parity exceeded frozen 0.001-point tolerance")
    report = evaluate_offline(dataset, model, ridge, norm)
    if digest(out / "mlp.json") != frozen_model_sha:
        raise RuntimeError("Selected model changed while evaluating offline test")
    report.update(dict(selectedModelSha256=frozen_model_sha, linearModelSha256=digest(out / "linear.json"), elapsedSeconds=time.perf_counter() - started, cudaPeakAllocatedBytes=torch.cuda.max_memory_allocated() if device == "cuda" else 0, offlineStatus="passed" if report["heldOutLearning"] else "failed-no-held-out-learning", productionDefaultsChanged=False))
    write(out / "offline-report.json", report)
    print(json.dumps(dict(stage="finished", offlineStatus=report["offlineStatus"], selectedSeed=selected["seed"], elapsedSeconds=report["elapsedSeconds"])), flush=True)
    if not report["heldOutLearning"]:
        raise RuntimeError("No held-out learning over the training-constant baseline; retain artifacts and stop")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--device", choices=("cpu", "cuda"), default="cuda")
    parser.add_argument("--max-vram-gb", type=float, default=6)
    parser.add_argument("--epochs", type=int, default=100, help="At most100; reduced values only for explicitly separate synthetic/plumbing runs")
    args = parser.parse_args()
    try:
        train(args.data, args.out, args.device, args.max_vram_gb, args.epochs)
    except Exception as error:
        write(Path(args.out) / "failure.json", dict(error=repr(error), at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), productionDefaultsChanged=False))
        raise


if __name__ == "__main__":
    main()
