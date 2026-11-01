import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPT_DIR))
from validate_skill import validate

GOOD_SKILL = """---
name: comic-production-director-cn
version: 1.0.0
---
用户锁定字段不得修改。单格失败只返工该格。OCR。英文必须人工终校。双格式。许可证。NOT_RUN。
漫画专业制作与出版总规范-V1.md
2026-11-02_专业漫画制作外部项目与技能研究.md
2026-11-02_漫画上色翻译与排字工具第二批.md
"""

REQUIRED = (
    "SKILL.md",
    "SOURCE_LOCK.json",
    "references/外部项目采纳矩阵-V1.md",
    "../../docs/漫画专业制作与出版总规范-V1.md",
    "../../docs/Deepresearch/2026-11-02_专业漫画制作外部项目与技能研究.md",
    "../../docs/Deepresearch/2026-11-02_漫画上色翻译与排字工具第二批.md",
)

class SkillContractTests(unittest.TestCase):
    def make_fixture(self, root: Path):
        skill = root / "skills" / "comic-production-director-cn"
        skill.mkdir(parents=True)
        (skill / "references").mkdir()
        (skill / "scripts").mkdir()
        (skill / "tests").mkdir()
        for rel in REQUIRED:
            p = (skill / rel).resolve()
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text("{}\n", encoding="utf-8")
        (skill / "SKILL.md").write_text(GOOD_SKILL, encoding="utf-8")
        return skill

    def test_valid_skill_contract(self):
        with tempfile.TemporaryDirectory() as tmp:
            skill = self.make_fixture(Path(tmp))
            self.assertEqual(validate(skill), [])

    def test_missing_required_reference_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            skill = self.make_fixture(Path(tmp))
            (skill / "references" / "外部项目采纳矩阵-V1.md").unlink()
            errors = validate(skill)
            self.assertTrue(any(x.startswith("MISSING_REQUIRED_FILE:") for x in errors))

    def test_missing_lock_rule_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            skill = self.make_fixture(Path(tmp))
            (skill / "SKILL.md").write_text(GOOD_SKILL.replace("用户锁定字段不得修改。", ""), encoding="utf-8")
            errors = validate(skill)
            self.assertIn("REQUIRED_RULE_MISSING:用户锁定字段不得修改", errors)

    def test_invalid_frontmatter_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            skill = self.make_fixture(Path(tmp))
            (skill / "SKILL.md").write_text(GOOD_SKILL.replace("version: 1.0.0", "version: latest"), encoding="utf-8")
            errors = validate(skill)
            self.assertIn("SKILL_VERSION_INVALID", errors)

if __name__ == "__main__":
    unittest.main(verbosity=2)
