#!/usr/bin/env python3
"""Static contract validator for comic-production-director-cn (stdlib only)."""
from __future__ import annotations
import argparse
import re
from pathlib import Path

REQUIRED_FILES = (
    "SKILL.md",
    "SOURCE_LOCK.json",
    "references/外部项目采纳矩阵-V1.md",
    "../../docs/漫画专业制作与出版总规范-V1.md",
    "../../docs/Deepresearch/2026-11-02_专业漫画制作外部项目与技能研究.md",
    "../../docs/Deepresearch/2026-11-02_漫画上色翻译与排字工具第二批.md",
    "../../docs/Deepresearch/2026-11-02_MOONKEEP第一话无文字修复与排字工具实物基准测试.md",
    "../../docs/Deepresearch/2026-11-02_欧美漫画平台规格与AI商业化规则研究.md",
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
)

def validate(root: Path) -> list[str]:
    errors: list[str] = []
    root = root.resolve()
    for rel in REQUIRED_FILES:
        target = (root / rel).resolve()
        if not target.is_file():
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
                if not re.search(r"(?m)^name:\\s*comic-production-director-cn\\s*$", front):
                    errors.append("SKILL_NAME_INVALID")
                if not re.search(r"(?m)^version:\\s*\\d+\\.\\d+\\.\\d+\\s*$", front):
                    errors.append("SKILL_VERSION_INVALID")
        for rule in REQUIRED_RULES:
            if rule not in content:
                errors.append(f"REQUIRED_RULE_MISSING:{rule}")
        for rel in SOURCE_REFERENCES:
            if Path(rel).name not in content:
                errors.append(f"SKILL_SOURCE_NOT_REFERENCED:{rel}")
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
