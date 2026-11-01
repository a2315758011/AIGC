#!/usr/bin/env python3
"""Static contract validator for comic-production-director-cn (stdlib only)."""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path

REQUIRED_FILES = (
    "SKILL.md",
    "SOURCE_LOCK.json",
    "references/外部项目采纳矩阵-V1.md",
    "references/平台导出配置登记表-V1.json",
    "../../docs/漫画专业制作与出版总规范-V1.md",
    "../../docs/Deepresearch/2026-11-02_专业漫画制作外部项目与技能研究.md",
    "../../docs/Deepresearch/2026-11-02_漫画上色翻译与排字工具第二批.md",
    "../../docs/Deepresearch/2026-11-02_MOONKEEP第一话无文字修复与排字工具实物基准测试.md",
    "../../docs/Deepresearch/2026-11-02_欧美漫画平台规格与AI商业化规则研究.md",
    "../../docs/专业欧美漫画排字与页面阅读规则-V1.md",
)
REQUIRED_RULES = (
    "用户锁定字段不得修改",
    "单格失败只返工该格",
    "OCR",
    "英文必须人工终校",
    "双格式",
    "许可证",
    "NOT_RUN",
    "重新生成无文字样稿",
    "完整气泡/尾巴遮罩",
)
SOURCE_REFERENCES = (
    "docs/漫画专业制作与出版总规范-V1.md",
    "docs/Deepresearch/2026-11-02_专业漫画制作外部项目与技能研究.md",
    "docs/Deepresearch/2026-11-02_漫画上色翻译与排字工具第二批.md",
    "docs/Deepresearch/2026-11-02_MOONKEEP第一话无文字修复与排字工具实物基准测试.md",
    "docs/Deepresearch/2026-11-02_欧美漫画平台规格与AI商业化规则研究.md",
    "平台导出配置登记表-V1.json",
)

def validate(root: Path) -> list[str]:
    errors: list[str] = []
    root = root.resolve()
    for rel in REQUIRED_FILES:
        if not (root / rel).resolve().is_file():
            errors.append(f"MISSING_REQUIRED_FILE:{rel}")
    skill_path = root / "SKILL.md"
    if skill_path.is_file():
        content = skill_path.read_text(encoding="utf-8")
        if not content.startswith("---\n"):
            errors.append("FRONTMATTER_MISSING")
        else:
            match = re.match(r"---\n(.*?)\n---\n", content, re.S)
            if not match:
                errors.append("FRONTMATTER_UNCLOSED")
            else:
                front = match.group(1)
                if not re.search(r"(?m)^name:\s*comic-production-director-cn\s*$", front):
                    errors.append("SKILL_NAME_INVALID")
                if not re.search(r"(?m)^version:\s*\d+\.\d+\.\d+\s*$", front):
                    errors.append("SKILL_VERSION_INVALID")
        for rule in REQUIRED_RULES:
            if rule not in content:
                errors.append(f"REQUIRED_RULE_MISSING:{rule}")
        for rel in SOURCE_REFERENCES:
            if Path(rel).name not in content:
                errors.append(f"SKILL_SOURCE_NOT_REFERENCED:{rel}")
    profile_path = root / "references" / "平台导出配置登记表-V1.json"
    if profile_path.is_file():
        try:
            profiles = json.loads(profile_path.read_text(encoding="utf-8"))
            names = set(profiles.get("profiles", {}))
            for name in ("globalcomix", "tapas", "webtoon_canvas", "amazon_kdp"):
                if name not in names:
                    errors.append(f"PLATFORM_PROFILE_MISSING:{name}")
            gc = profiles.get("profiles", {}).get("globalcomix", {})
            if gc.get("ai_art_monetization_allowed") is not False:
                errors.append("GLOBALCOMIX_AI_MONETIZATION_MUST_BE_BLOCKED")
            tapas = profiles.get("profiles", {}).get("tapas", {})
            if tapas.get("upload_size_status") != "CONFLICT":
                errors.append("TAPAS_FILE_SIZE_CONFLICT_MUST_BE_VISIBLE")
            webtoon = profiles.get("profiles", {}).get("webtoon_canvas", {})
            if webtoon.get("upload_spec_status") != "UNVERIFIED_OFFICIAL_SPEC":
                errors.append("WEBTOON_UNVERIFIED_SPEC_MUST_NOT_BE_PROMOTED")
            kdp = profiles.get("profiles", {}).get("amazon_kdp", {})
            if kdp.get("ai_disclosure", {}).get("generated_images") is not True:
                errors.append("KDP_AI_IMAGE_DISCLOSURE_REQUIRED")
        except (OSError, json.JSONDecodeError, AttributeError) as exc:
            errors.append(f"PLATFORM_PROFILE_JSON_INVALID:{type(exc).__name__}")
    return errors

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    errors = validate(args.root)
    print({"ok": not errors, "root": str(args.root.resolve()), "errors": errors})
    return 0 if not errors else 1

if __name__ == "__main__":
    raise SystemExit(main())
