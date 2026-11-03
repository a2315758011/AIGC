#!/usr/bin/env python3
"""Verify exact skill-package file set, byte sizes and SHA-256 values."""
import hashlib
import json
import sys
from pathlib import Path


def main() -> int:
    manifest_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "artifact-manifest.json"
    root = manifest_path.parent
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    entries = manifest.get("files")
    if not isinstance(entries, list):
        print("FAIL: manifest.files must be an array")
        return 1

    expected = {}
    for item in entries:
        rel = item.get("path")
        if not isinstance(rel, str) or not rel or rel in expected:
            print(f"FAIL: invalid or duplicate manifest path: {rel!r}")
            return 1
        expected[rel] = item

    actual = {
        p.relative_to(root).as_posix()
        for p in root.rglob("*")
        if p.is_file() and p != manifest_path and "__pycache__" not in p.parts and p.suffix != ".pyc"
    }
    if actual != set(expected):
        missing = sorted(set(expected) - actual)
        extra = sorted(actual - set(expected))
        print(f"FAIL: file set mismatch; missing={missing}; extra={extra}")
        return 1

    failures = []
    for rel, item in expected.items():
        path = root / rel
        data = path.read_bytes()
        sha = hashlib.sha256(data).hexdigest()
        if len(data) != item.get("size_bytes"):
            failures.append(f"{rel}: size {len(data)} != {item.get('size_bytes')}")
        if sha != item.get("sha256"):
            failures.append(f"{rel}: sha256 {sha} != {item.get('sha256')}")

    if failures:
        print("FAIL: manifest verification")
        print("\n".join(failures))
        return 1
    print(f"PASS: {len(expected)} package files; exact file set, sizes and SHA-256 match")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
