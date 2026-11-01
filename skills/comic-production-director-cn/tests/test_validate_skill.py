import json
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
用户锁定字段不得修改。单格失败只返工该格。OCR。英文必须人工终校。双格式。许可证。NOT_RUN。重新生成无文字样稿与源图修复必须区分。删除整个气泡必须使用完整气泡/尾巴遮罩。
漫画专业制作与出版总规范-V1.md
2026-11-02_专业漫画制作外部项目与技能研究.md
2026-11-02_漫画上色翻译与排字工具第二批.md
2026-11-02_MOONKEEP第一话无文字修复与排字工具实物基准测试.md
2026-11-02_欧美漫画平台规格与AI商业化规则研究.md
"""

GOOD_PROFILES = {
    "profiles": {
        "globalcomix": {"ai_art_monetization_allowed": False},
        "tapas": {"upload_size_status": "CONFLICT"},
        "webtoon_canvas": {"upload_spec_status": "UNVERIFIED_OFFICIAL_SPEC"},
        "amazon_kdp": {"ai_disclosure": {"generated_images": True}},
    }
}

REQUIRED = (
    "SKILL.md",
    "SOURCE_LOCK.json",
    "references/外部项目采纳矩阵-V1.md",
    "references/平台导出配置登记表-V1.json",
    "../../docs/漫画专业制作与出版总规范-V1.md",
    "../../docs/Deepresearch/2026-11-02_专业漫画制作外部项目与技能研究.md",
    "../../docs/Deepresearch/2026-11-02_漫画上色翻译与排字工具第二批.md",
    "../../docs/Deepresearch/2026-11-02_MOONKEEP第一话无文字修复与排字工具实物基准测试.md",
    "../../docs/Deepresearch/2026-11-02_欧美漫画平台规格与AI商业化规则研究.md",
)

class SkillContractTests(unittest.TestCase):
    def make_fixture(self, root: Path):
        skill = root / "skills" / "comic-production-director-cn"
        (skill / "references").mkdir(parents=True)
        (skill / "scripts").mkdir()
        (skill / "tests").mkdir()
        for rel in REQUIRED:
            p = (skill / rel).resolve()
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text("{}\n", encoding="utf-8")
        (skill / "SKILL.md").write_text(GOOD_SKILL, encoding="utf-8")
        (skill / "references" / "平台导出配置登记表-V1.json").write_text(json.dumps(GOOD_PROFILES), encoding="utf-8")
        return skill

    def test_valid_skill_contract(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(validate(self.make_fixture(Path(tmp))), [])

    def test_missing_required_reference_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            skill = self.make_fixture(Path(tmp))
            (skill / "references" / "外部项目采纳矩阵-V1.md").unlink()
            self.assertTrue(any(x.startswith("MISSING_REQUIRED_FILE:") for x in validate(skill)))

    def test_missing_lock_rule_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            skill = self.make_fixture(Path(tmp))
            (skill / "SKILL.md").write_text(GOOD_SKILL.replace("用户锁定字段不得修改。", ""), encoding="utf-8")
            self.assertIn("REQUIRED_RULE_MISSING:用户锁定字段不得修改", validate(skill))

    def test_missing_source_reference_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            skill = self.make_fixture(Path(tmp))
            (skill / "SKILL.md").write_text(GOOD_SKILL.replace("2026-11-02_欧美漫画平台规格与AI商业化规则研究.md", ""), encoding="utf-8")
            self.assertTrue(any(x.startswith("SKILL_SOURCE_NOT_REFERENCED:") for x in validate(skill)))

    def test_missing_balloon_mask_rule_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            skill = self.make_fixture(Path(tmp))
            (skill / "SKILL.md").write_text(GOOD_SKILL.replace("完整气泡/尾巴遮罩", ""), encoding="utf-8")
            self.assertIn("REQUIRED_RULE_MISSING:完整气泡/尾巴遮罩", validate(skill))

    def test_invalid_frontmatter_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            skill = self.make_fixture(Path(tmp))
            (skill / "SKILL.md").write_text(GOOD_SKILL.replace("version: 1.0.0", "version: latest"), encoding="utf-8")
            self.assertIn("SKILL_VERSION_INVALID", validate(skill))

    def test_globalcomix_ai_monetization_blocked(self):
        with tempfile.TemporaryDirectory() as tmp:
            skill = self.make_fixture(Path(tmp))
            p = skill / "references" / "平台导出配置登记表-V1.json"
            data = json.loads(p.read_text(encoding="utf-8"))
            data["profiles"]["globalcomix"]["ai_art_monetization_allowed"] = True
            p.write_text(json.dumps(data), encoding="utf-8")
            self.assertIn("GLOBALCOMIX_AI_MONETIZATION_MUST_BE_BLOCKED", validate(skill))

    def test_unverified_webtoon_spec_not_promoted(self):
        with tempfile.TemporaryDirectory() as tmp:
            skill = self.make_fixture(Path(tmp))
            p = skill / "references" / "平台导出配置登记表-V1.json"
            data = json.loads(p.read_text(encoding="utf-8"))
            data["profiles"]["webtoon_canvas"]["upload_spec_status"] = "VERIFIED"
            p.write_text(json.dumps(data), encoding="utf-8")
            self.assertIn("WEBTOON_UNVERIFIED_SPEC_MUST_NOT_BE_PROMOTED", validate(skill))

if __name__ == "__main__":
    unittest.main(verbosity=2)
