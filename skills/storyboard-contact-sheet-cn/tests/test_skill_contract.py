import json
import unittest
from pathlib import Path

ROOT = Path.cwd()
SKILL = ROOT / "skills/storyboard-contact-sheet-cn/SKILL.md"
README = ROOT / "skills/storyboard-contact-sheet-cn/README.md"
SOURCE_LOCK = ROOT / "skills/storyboard-contact-sheet-cn/SOURCE_LOCK.json"


class SkillContractTests(unittest.TestCase):
    def test_skill_files_exist(self):
        self.assertTrue(SKILL.is_file())
        self.assertTrue(README.is_file())
        self.assertTrue(SOURCE_LOCK.is_file())

    def test_skill_contains_workflow_and_quality_gates(self):
        text = SKILL.read_text(encoding="utf-8")
        for term in ["触发条件", "逐格生成", "逐格质检", "最终交付合同", "BLOCKED", "NOT_RUN"]:
            self.assertIn(term, text)

    def test_all_layouts_are_documented(self):
        text = SKILL.read_text(encoding="utf-8")
        for layout in ["2×2", "3×3", "3×4", "4×3", "5×5"]:
            self.assertIn(layout, text)

    def test_upstream_sources_exist(self):
        text = SKILL.read_text(encoding="utf-8")
        for path in [
            "skills/storyboard-director-cn/SKILL.md",
            "skills/live-action-safety-storyboard-cn/SKILL.md",
            "skills/comic-production-director-cn/SKILL.md",
            "tools/storyboard-contact-sheet/",
        ]:
            self.assertIn(path, text)
            self.assertTrue((ROOT / path).exists())

    def test_source_lock_is_valid(self):
        lock = json.loads(SOURCE_LOCK.read_text(encoding="utf-8"))
        self.assertEqual(lock["skill"], "storyboard-contact-sheet-cn")
        self.assertEqual(lock["version"], "1.0.0")
        self.assertGreaterEqual(len(lock["upstream_sources"]), 5)


if __name__ == "__main__":
    unittest.main()
