import hashlib
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class SkillPackageContractTests(unittest.TestCase):
    def test_frontmatter_has_stable_skill_identity_and_version(self):
        text = (ROOT / "SKILL.md").read_text(encoding="utf-8")
        self.assertTrue(text.startswith("---\n"))
        frontmatter = text.split("---", 2)[1]
        self.assertIn("name: video-director-cn", frontmatter)
        self.assertIn('version: "1.0.0"', frontmatter)
        self.assertIn('source_license: "MIT"', frontmatter)

    def test_upstream_skill_references_are_present_in_package(self):
        docs = [
            ROOT / "SKILL.md",
            ROOT / "references" / "upstream-SKILL.md",
        ]
        pattern = re.compile(r"((?:references|scripts)/[^\s`<>\"\])}]+?\.(?:md|py))")
        referenced = set()
        for doc in docs:
            body = doc.read_text(encoding="utf-8")
            referenced.update(pattern.findall(body))
        self.assertTrue(referenced, "no internal upstream references were detected")
        missing = sorted(path for path in referenced if not (ROOT / path).is_file())
        self.assertEqual(missing, [], "missing referenced package files: " + ", ".join(missing))

    def test_source_lock_and_manifest_match_exact_package_files(self):
        lock = json.loads((ROOT / "SOURCE_LOCK.json").read_text(encoding="utf-8"))
        manifest = json.loads((ROOT / "artifact-manifest.json").read_text(encoding="utf-8"))
        locked = {item["path"]: item for item in lock["package_files"]}
        manifested = {item["path"]: item for item in manifest["files"]}
        self.assertEqual(set(manifested), set(locked) | {"SOURCE_LOCK.json"})
        self.assertEqual(manifest["file_count"], len(manifested))
        self.assertEqual(lock["upstream"]["license"], "MIT")
        self.assertEqual(len(lock["upstream"]["commit"]), 40)

        for rel, item in locked.items():
            path = ROOT / rel
            self.assertTrue(path.is_file(), rel)
            data = path.read_bytes()
            self.assertEqual(len(data), item["size_bytes"], rel + " size")
            self.assertEqual(hashlib.sha256(data).hexdigest(), item["sha256"], rel + " SHA-256")
            self.assertEqual(item["sha256"], manifested[rel]["sha256"], rel + " manifest SHA-256")
            self.assertEqual(item["size_bytes"], manifested[rel]["size_bytes"], rel + " manifest size")

        source_lock_bytes = (ROOT / "SOURCE_LOCK.json").read_bytes()
        self.assertEqual(
            hashlib.sha256(source_lock_bytes).hexdigest(),
            manifested["SOURCE_LOCK.json"]["sha256"],
        )
        self.assertEqual(len(source_lock_bytes), manifested["SOURCE_LOCK.json"]["size_bytes"])

    def test_required_upstream_sources_reference_is_retained(self):
        sources = ROOT / "references" / "sources.md"
        self.assertTrue(sources.is_file())
        body = sources.read_text(encoding="utf-8")
        self.assertIn("eight public repositories", body)
        self.assertIn("METHODOLOGY.md", body)


if __name__ == "__main__":
    unittest.main()
