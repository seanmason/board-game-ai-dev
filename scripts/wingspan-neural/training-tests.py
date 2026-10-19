"""Synthetic training/parity checks only. No board-game simulations or strength evidence."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("wingspan_train", Path(__file__).with_name("train.py"))
train = importlib.util.module_from_spec(spec)
spec.loader.exec_module(train)


def make_dataset(root):
    root = Path(root)
    (root / "games").mkdir(parents=True, exist_ok=True)
    tasks = []
    for split, count, start in (("train", 40, 100), ("dev", 12, 200), ("test", 12, 300)):
        for i in range(count):
            seed = start + i
            margin = ((i % 9) - 4) * 4
            task = dict(id=f"synthetic-{seed}", seed=seed, split=split)
            tasks.append(task)
            components = [dict(birds=70 + margin, bonuses=0, goals=0, eggs=0, cached=0, tucked=0), dict(birds=70, bonuses=0, goals=0, eggs=0, cached=0, tucked=0)]
            examples = []
            for step in range(4):
                for viewer in (0, 1):
                    target = margin if viewer == 0 else -margin
                    examples.append(dict(gameId=task["id"], setupSeed=seed, split=split, step=step, viewer=viewer, round=step + 1, features=[target / 30, step / 4, viewer, 1], targetMargin=target, targetAux=[v for p in (components[viewer], components[1-viewer]) for v in p.values()], baselineMargin=target * .25))
            train.write(root / "games" / f"{seed}.json", dict(task=task, result=dict(status="complete", scores=[70 + margin, 70], scoreComponents=components), valueExamples=examples, teacherDecisions=[], validation=dict(valid=True)))
    train.write(root / "manifest.json", dict(synthetic=True, featureVersion="synthetic-v1", featureNames=["signal", "round", "viewer", "constant"], tasks=tasks))
    return root


class TrainingTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = make_dataset(Path(self.tmp.name) / "data")

    def mutate(self, seed, fn):
        path = self.root / "games" / f"{seed}.json"
        value = train.read(path)
        fn(value)
        train.write(path, value)

    def test_grouped_loader_and_exact_labels(self):
        dataset = train.load_dataset(self.root)
        self.assertEqual({k: len({r["setupSeed"] for r in v}) for k, v in dataset["splits"].items()}, dict(train=40, dev=12, test=12))
        self.mutate(100, lambda g: g["valueExamples"][0].update(targetMargin=999))
        with self.assertRaisesRegex(ValueError, "margin"):
            train.load_dataset(self.root)

    def test_group_leakage_is_rejected_before_fitting(self):
        def leak(game):
            game["task"]["seed"] = 100
            for example in game["valueExamples"]:
                example["setupSeed"] = 100
        self.mutate(200, leak)
        manifest = train.read(self.root / "manifest.json")
        next(t for t in manifest["tasks"] if t["id"] == "synthetic-200")["seed"] = 100
        train.write(self.root / "manifest.json", manifest)
        with self.assertRaisesRegex(ValueError, "leaked"):
            train.load_dataset(self.root)

    def test_frozen_task_and_encoder_identity_are_enforced(self):
        self.mutate(100, lambda g: g["task"].update(seed=888))
        with self.assertRaisesRegex(ValueError, "frozen dataset inventory"):
            train.load_dataset(self.root)
        make_dataset(self.root)
        self.mutate(100, lambda g: g["valueExamples"][0].update(featureVersion="wrong"))
        with self.assertRaisesRegex(ValueError, "feature version"):
            train.load_dataset(self.root)

    def test_invalid_trajectory_or_missing_game_never_reduces_sample_silently(self):
        self.mutate(100, lambda g: g["validation"].update(valid=False))
        with self.assertRaisesRegex(ValueError, "quarantined"):
            train.load_dataset(self.root)
        (self.root / "games" / "100.json").unlink()
        with self.assertRaisesRegex(ValueError, "inventory"):
            train.load_dataset(self.root)

    def test_duplicate_example_and_unpaired_viewer_rejected(self):
        self.mutate(100, lambda g: g["valueExamples"].append(g["valueExamples"][0]))
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            train.load_dataset(self.root)
        make_dataset(self.root)
        self.mutate(100, lambda g: g["valueExamples"].pop())
        with self.assertRaisesRegex(ValueError, "viewer"):
            train.load_dataset(self.root)

    def test_normalization_uses_train_only_and_handles_constant_features(self):
        np, _ = train.libraries()
        dataset = train.load_dataset(self.root)
        x = train.arrays(dataset["splits"]["train"])[0]
        mean, scale = train.normalization(x)
        self.assertEqual(float(scale[-1]), 1)
        self.assertEqual(float(mean[-1]), 1)
        before = mean.copy()
        self.mutate(200, lambda g: [e["features"].__setitem__(0, 1e6) for e in g["valueExamples"]])
        changed = train.load_dataset(self.root)
        after, _ = train.normalization(train.arrays(changed["splits"]["train"])[0])
        np.testing.assert_array_equal(before, after)

    def test_scalar_export_orientation_units_relu_and_float32(self):
        model = dict(normalization=dict(mean=[1, 2], scale=[2, 4]), layers=[dict(**{"in": 2, "out": 2}, weights=[2, 3, -2, 1], bias=[.5, -.5], activation="relu"), dict(**{"in": 2, "out": 1}, weights=[2, -1], bias=[.25], activation="linear")], valueScale=30)
        # normalized [1,1] -> [5.5,0] ->11.25 normalized margin ->337.5 points.
        self.assertEqual(train.scalar_margin(model, [3, 6]), 337.5)

    def test_group_bootstrap_counts_setup_units_not_positions(self):
        report = train.bootstrap([2, 3, 4], repetitions=100)
        self.assertEqual(report["n"], 3)
        self.assertEqual(report["mean"], 3)
        self.assertLess(report["ci95"][0], report["ci95"][1])
        self.assertIsNone(train.bootstrap([2])["ci95"])
        self.assertIsNone(train.bootstrap([2, 2, 2])["ci95"])

    def test_parity_cases_cover_rounds_viewers_endpoints_and_development_only(self):
        np, _ = train.libraries()
        dataset = train.load_dataset(self.root)
        train_x = train.arrays(dataset["splits"]["train"])[0]
        rows = dataset["splits"]["dev"]
        norm = train.normalization(train_x)
        predictions = np.asarray([r["features"][0] for r in rows])
        chosen = train.parity_indices(rows, norm, predictions)
        self.assertGreaterEqual(len(chosen), 30)
        self.assertEqual(len(chosen), len(set(chosen)))
        self.assertIn(0, chosen)
        self.assertIn(len(rows) - 1, chosen)
        self.assertEqual({(rows[i]["round"], rows[i]["viewer"]) for i in chosen}, {(r, v) for r in (1, 2, 3, 4) for v in (0, 1)})
        self.assertTrue(all(rows[i]["split"] == "dev" for i in chosen))

    def test_engine_strata_use_only_viewer_public_installed_rows(self):
        class Poison(dict):
            def get(self, *args):
                raise AssertionError("private/opponent read")
        catalog = {1: dict(powerCode=33, powerType="brown"), 2: dict(powerCode=25, powerType="brown"), 3: dict(powerCode=66, powerType="brown")}
        own = dict(habitats=dict(forest=[dict(id=2)], grassland=[dict(id=3)], wetland=[]))
        row = dict(viewer=0, observation=dict(players=[own, Poison()], deck=Poison()))
        self.assertEqual(train.engine_class(row, catalog), "other-brown-engine")
        own["habitats"]["forest"].append(dict(id=1))
        self.assertEqual(train.engine_class(row, catalog), "exceptional-installed")
        self.assertEqual(train.engine_class(dict(viewer=0), catalog), "not-recorded")

    def test_synthetic_full_fit_exports_three_seed_selection_and_frozen_test_report(self):
        out = Path(self.tmp.name) / "model"
        with contextlib.redirect_stdout(io.StringIO()):
            report = train.train(self.root, out, device="cpu", epochs=100)
        self.assertTrue(report["heldOutLearning"])
        self.assertFalse(report["modelSelectionUsedTest"])
        self.assertFalse(report["strengthClaim"])
        self.assertEqual(len(train.read(out / "selection.json")["candidates"]), 3)
        self.assertEqual(report["splits"]["test"]["metrics"]["mlp"]["groupMAE"]["n"], 12)
        model = train.read(out / "mlp.json")
        self.assertEqual(model["valueScale"], 30)
        self.assertEqual([(x["in"], x["out"], x["activation"]) for x in model["layers"]], [(4, 64, "relu"), (64, 32, "relu"), (32, 1, "linear")])
        self.assertLessEqual(train.read(out / "parity.json")["maxTorchVsScalarDifferencePoints"], .001)
        self.assertGreaterEqual(train.read(out / "parity.json")["fixtureCountPerModel"], 30)
        self.assertEqual(train.digest(out / "mlp.json"), report["selectedModelSha256"])
        with self.assertRaisesRegex(ValueError, "fresh output"):
            train.train(self.root, out, device="cpu", epochs=100)


if __name__ == "__main__":
    unittest.main(verbosity=2)
