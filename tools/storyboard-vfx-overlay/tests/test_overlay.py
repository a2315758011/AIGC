import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image
from overlay import render


class OverlayTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.source = self.root / "source.png"
        self.mask = self.root / "mask.png"
        self.config = self.root / "config.json"
        Image.new("RGB", (160, 90), (90, 90, 90)).save(self.source)
        m = Image.new("L", (160, 90), 0)
        for x in range(20, 140):
            for y in range(30, 60):
                m.putpixel((x, y), 255)
        m.save(self.mask)
        self.config.write_text(json.dumps({
            "version": 1, "energy_paths": [[[0.2, 0.5], [0.8, 0.5]]],
            "glint_path": [[0.1, 0.4], [0.3, 0.4]],
            "glow_radius": 3, "core_width": 2
        }), encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def test_render_outputs_frame_and_rgba_overlay(self):
        out, overlay = self.root / "out.png", self.root / "overlay.png"
        result = render(self.source, self.mask, self.config, out, overlay)
        self.assertTrue(out.is_file())
        self.assertTrue(overlay.is_file())
        self.assertEqual(Image.open(out).size, (160, 90))
        self.assertEqual(Image.open(overlay).mode, "RGBA")
        self.assertEqual(result["energy_paths"], 1)
        self.assertTrue(result["glint"])
        self.assertTrue(result["source_unchanged"])

    def test_source_is_not_modified(self):
        before = self.source.read_bytes()
        render(self.source, self.mask, self.config, self.root / "out.png")
        self.assertEqual(self.source.read_bytes(), before)

    def test_mask_clips_overlay(self):
        out, overlay = self.root / "out.png", self.root / "overlay.png"
        render(self.source, self.mask, self.config, out, overlay)
        alpha = Image.open(overlay).getchannel("A")
        self.assertEqual(alpha.getpixel((5, 5)), 0)

    def test_rejects_source_overwrite(self):
        with self.assertRaisesRegex(ValueError, "overwrite"):
            render(self.source, self.mask, self.config, self.source)

    def test_rejects_mismatched_mask(self):
        Image.new("L", (20, 20), 255).save(self.mask)
        with self.assertRaisesRegex(ValueError, "dimensions"):
            render(self.source, self.mask, self.config, self.root / "out.png")

    def test_rejects_out_of_range_points(self):
        cfg = json.loads(self.config.read_text(encoding="utf-8"))
        cfg["energy_paths"] = [[[0.2, 0.5], [1.2, 0.5]]]
        self.config.write_text(json.dumps(cfg), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "between 0 and 1"):
            render(self.source, self.mask, self.config, self.root / "out.png")


if __name__ == "__main__":
    unittest.main()
