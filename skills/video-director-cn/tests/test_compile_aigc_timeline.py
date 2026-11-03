import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = Path(__file__).resolve().parent / "fixtures"
sys.path.insert(0, str(ROOT / "scripts"))

from compile_aigc_timeline import ContractError, compile_timeline  # noqa: E402


def load_fixture(name):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class CompileAigcTimelineTests(unittest.TestCase):
    def setUp(self):
        self.ledger = load_fixture("events-valid.json")
        self.render_spec = load_fixture("render-spec-valid.json")

    def test_projects_only_visible_events_and_preserves_stable_ids(self):
        result = compile_timeline(self.ledger, self.render_spec, "EP01")
        self.assertEqual([s["id"] for s in result["scenes"]], ["S001", "S002"])
        self.assertEqual(result["scenes"][0]["beats"], {"E001": 0.5})
        self.assertEqual(result["scenes"][1]["beats"], {"E002": 2.0})
        self.assertEqual(result["hero"]["t"], 2.0)
        self.assertEqual(result["meta"]["dur"], 4.0)

    def test_continuing_event_is_clamped_without_rewriting_source_time(self):
        result = compile_timeline(self.ledger, self.render_spec, "EP01")
        cue = result["scenes"][1]["cueRef"]["E002"]
        self.assertEqual(cue["source_event_start_ms"], 1900)
        self.assertEqual(cue["render_anchor_ms"], 2000)
        self.assertEqual(cue["anchor_policy"], "clamped_to_shot_start_for_continuing_event")
        self.assertEqual(result["scenes"][1]["beats"]["E002"], 2.0)

    def test_does_not_copy_scg_world_state_or_actor_arrays(self):
        result = compile_timeline(self.ledger, self.render_spec, "EP01")
        self.assertNotIn("entities", result)
        self.assertNotIn("relations", result)
        self.assertNotIn("events", result)
        self.assertNotIn("actor_ids", result["scenes"][0])
        self.assertEqual(result["aigc_source"]["episode_id"], "EP01")

    def test_compiled_timeline_passes_upstream_static_validator(self):
        result = compile_timeline(self.ledger, self.render_spec, "EP01")
        with tempfile.TemporaryDirectory() as tmp:
            timeline_path = Path(tmp) / "timeline.json"
            timeline_path.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
            validator = ROOT / "scripts" / "check_timeline.py"
            proc = subprocess.run(
                [sys.executable, str(validator), str(timeline_path)],
                capture_output=True, text=True, check=False
            )
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)

    def test_upstream_validator_rejects_a_gap(self):
        result = compile_timeline(self.ledger, self.render_spec, "EP01")
        result["scenes"][1]["start"] = 2.2
        with tempfile.TemporaryDirectory() as tmp:
            timeline_path = Path(tmp) / "timeline.json"
            timeline_path.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
            proc = subprocess.run(
                [sys.executable, str(ROOT / "scripts" / "check_timeline.py"), str(timeline_path)],
                capture_output=True, text=True, check=False
            )
        self.assertEqual(proc.returncode, 1)
        self.assertIn("gap", proc.stdout)

    def test_unknown_visible_event_is_rejected(self):
        ledger = json.loads(json.dumps(self.ledger))
        ledger["episodes"][0]["shots"][0]["visible_event_ids"] = ["E404"]
        with self.assertRaisesRegex(ContractError, "unknown event_id"):
            compile_timeline(ledger, self.render_spec, "EP01")

    def test_required_visible_event_cannot_disappear_from_all_shots(self):
        ledger = json.loads(json.dumps(self.ledger))
        ledger["episodes"][0]["shots"][0]["visible_event_ids"] = []
        with self.assertRaisesRegex(ContractError, "requires visible evidence"):
            compile_timeline(ledger, self.render_spec, "EP01")

    def test_fps_must_be_explicit(self):
        spec = json.loads(json.dumps(self.render_spec))
        del spec["meta"]["fps"]
        with self.assertRaisesRegex(ContractError, "meta.fps"):
            compile_timeline(self.ledger, spec, "EP01")

    def test_music_clock_requires_bpm(self):
        spec = json.loads(json.dumps(self.render_spec))
        spec["meta"]["clock"] = "music"
        with self.assertRaisesRegex(ContractError, "meta.bpm"):
            compile_timeline(self.ledger, spec, "EP01")

    def test_render_spec_cannot_create_a_second_scene_ledger(self):
        spec = json.loads(json.dumps(self.render_spec))
        spec["scenes"] = []
        with self.assertRaisesRegex(ContractError, "must not define source world/shot data"):
            compile_timeline(self.ledger, spec, "EP01")


    def test_unknown_render_spec_fields_are_rejected(self):
        spec = json.loads(json.dumps(self.render_spec))
        spec["invented_scene_state"] = {"character_position": [1, 2, 3]}
        with self.assertRaisesRegex(ContractError, "unknown render-spec fields"):
            compile_timeline(self.ledger, spec, "EP01")

    def test_source_file_metadata_keeps_only_basename(self):
        with tempfile.TemporaryDirectory() as tmp:
            ledger_path = Path(tmp) / "events.json"
            ledger_path.write_text(json.dumps(self.ledger), encoding="utf-8")
            result = compile_timeline(
                self.ledger, self.render_spec, "EP01",
                source_ledger_path=str(ledger_path)
            )
        self.assertEqual(result["aigc_source"]["event_ledger_path"], "events.json")
        self.assertEqual(len(result["aigc_source"]["event_ledger_sha256"]), 64)

    def test_hero_event_must_be_visible_in_a_shot(self):
        spec = json.loads(json.dumps(self.render_spec))
        spec["hero_event_id"] = "E001"
        ledger = json.loads(json.dumps(self.ledger))
        ledger["episodes"][0]["shots"][0]["visible_event_ids"] = []
        with self.assertRaisesRegex(ContractError, "requires visible evidence"):
            compile_timeline(ledger, spec, "EP01")

    def test_source_shots_are_not_silently_reordered(self):
        ledger = json.loads(json.dumps(self.ledger))
        ledger["episodes"][0]["shots"].reverse()
        with self.assertRaisesRegex(ContractError, "source order"):
            compile_timeline(ledger, self.render_spec, "EP01")


if __name__ == "__main__":
    unittest.main()
