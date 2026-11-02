import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from contact_sheet import ManifestError, render


class ContactSheetTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def make_manifest(self, layout="2x2", count=4):
        panels = []
        for i in range(1, count + 1):
            name = f"frame_{i:02d}.png"
            Image.new("RGB", (120, 80), (i * 7, i * 11, i * 13)).save(self.root / name)
            panels.append({"order": i, "shot_id": f"SHOT-{i:02d}", "image": name,
                           "timecode": f"00:00:{i:02d}"})
        data = {"layout": layout, "panel_size": [120, 80], "gutter": 4,
                "margin": 4, "label_height": 24, "panels": panels}
        path = self.root / "manifest.json"
        path.write_text(json.dumps(data), encoding="utf-8")
        return path, data

    def test_2x2_dimensions_and_order(self):
        manifest, _ = self.make_manifest()
        output = self.root / "sheet.png"
        result = render(manifest, output)
        self.assertEqual(result["size"], [2*4 + 2*120 + 4, 2*4 + 2*(80+24) + 4])
        self.assertEqual(result["ordered_shot_ids"], ["SHOT-01", "SHOT-02", "SHOT-03", "SHOT-04"])
        self.assertTrue(output.is_file())

    def test_5x5_all_frames_and_order(self):
        manifest, _ = self.make_manifest("5x5", 25)
        output = self.root / "sheet25.png"
        result = render(manifest, output)
        self.assertEqual(result["panel_count"], 25)
        self.assertEqual(result["size"], [2*4 + 5*120 + 4*4, 2*4 + 5*(80+24) + 4*4])
        with Image.open(output) as sheet:
            # First cell and last cell retain the expected source-frame colors.
            self.assertEqual(sheet.getpixel((4+60, 4+40)), (7, 11, 13))
            x_last = 4 + 4*(120+4) + 60
            y_last = 4 + 4*(80+24) + 40
            self.assertEqual(sheet.getpixel((x_last, y_last)), (175, 275 % 256, 325 % 256))

    def test_duplicate_order_rejected(self):
        manifest, data = self.make_manifest()
        data["panels"][1]["order"] = 1
        manifest.write_text(json.dumps(data), encoding="utf-8")
        with self.assertRaisesRegex(ManifestError, "duplicate"):
            render(manifest, self.root / "bad.png")

    def test_count_mismatch_rejected(self):
        manifest, data = self.make_manifest()
        data["layout"] = "3x3"
        manifest.write_text(json.dumps(data), encoding="utf-8")
        with self.assertRaisesRegex(ManifestError, "requires 9"):
            render(manifest, self.root / "bad.png")

    def test_path_traversal_rejected(self):
        manifest, data = self.make_manifest()
        data["panels"][0]["image"] = "../outside.png"
        manifest.write_text(json.dumps(data), encoding="utf-8")
        with self.assertRaisesRegex(ManifestError, "escapes"):
            render(manifest, self.root / "bad.png")

    def test_missing_frame_rejected(self):
        manifest, data = self.make_manifest()
        data["panels"][0]["image"] = "missing.png"
        manifest.write_text(json.dumps(data), encoding="utf-8")
        with self.assertRaisesRegex(ManifestError, "missing"):
            render(manifest, self.root / "bad.png")

    def test_source_frames_are_not_modified(self):
        manifest, _ = self.make_manifest()
        source = self.root / "frame_01.png"
        before = source.read_bytes()
        render(manifest, self.root / "sheet.png")
        self.assertEqual(source.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
