#!/usr/bin/env python3
"""Deterministic contact-sheet renderer. Source frames are read-only."""
from __future__ import annotations
import argparse
import json
import re
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps, UnidentifiedImageError

LAYOUTS = {"2x2": (2, 2), "3x3": (3, 3), "3x4": (3, 4), "4x3": (4, 3), "5x5": (5, 5)}
EXTS = {".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".bmp"}
DEFAULTS = {"panel_size": [640, 360], "gutter": 20, "margin": 28, "label_height": 42,
            "background": "#111820", "cell_background": "#202a35", "label_color": "#f2f5f8"}


class ManifestError(ValueError):
    pass


def read_manifest(path: Path):
    try:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ManifestError(f"manifest read failed: {exc}") from exc
    if not isinstance(data, dict) or data.get("layout") not in LAYOUTS:
        raise ManifestError("manifest root must be an object with layout 2x2/3x3/3x4/4x3/5x5")
    size = data.get("panel_size", DEFAULTS["panel_size"])
    if not isinstance(size, list) or len(size) != 2 or any(type(v) is not int or not 64 <= v <= 8192 for v in size):
        raise ManifestError("panel_size must be [width,height], integer 64..8192")
    for key in ("gutter", "margin", "label_height"):
        value = data.get(key, DEFAULTS[key])
        if type(value) is not int or not 0 <= value <= 512:
            raise ManifestError(f"{key} must be an integer 0..512")
    if data.get("label_height", 42) < 24:
        raise ManifestError("label_height must be at least 24")
    for key in ("background", "cell_background", "label_color"):
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", data.get(key, DEFAULTS[key])):
            raise ManifestError(f"{key} must be a six-digit hex color")
    panels = data.get("panels")
    if not isinstance(panels, list):
        raise ManifestError("panels must be an array")
    rows, cols = LAYOUTS[data["layout"]]
    count = rows * cols
    if len(panels) != count:
        raise ManifestError(f"{data['layout']} requires {count} panels, got {len(panels)}")
    ids, orders, images = set(), set(), set()
    for i, p in enumerate(panels):
        if not isinstance(p, dict):
            raise ManifestError(f"panels[{i}] must be an object")
        order, sid, image = p.get("order"), p.get("shot_id"), p.get("image")
        if type(order) is not int or not 1 <= order <= count:
            raise ManifestError(f"panels[{i}].order must be 1..{count}")
        if not isinstance(sid, str) or not sid.strip():
            raise ManifestError(f"panels[{i}].shot_id is required")
        if not isinstance(image, str) or not image.strip():
            raise ManifestError(f"panels[{i}].image is required")
        if not isinstance(p.get("timecode", ""), str):
            raise ManifestError(f"panels[{i}].timecode must be text")
        if order in orders or sid in ids or image.replace(chr(92), "/") in images:
            raise ManifestError("duplicate order, shot_id or source image")
        orders.add(order); ids.add(sid); images.add(image.replace(chr(92), "/"))
    if orders != set(range(1, count + 1)):
        raise ManifestError(f"orders must be contiguous 1..{count}")
    return data, sorted(panels, key=lambda p: p["order"])


def resolve_frame(root: Path, name: str) -> Path:
    rel = Path(name)
    if rel.is_absolute() or rel.suffix.lower() not in EXTS:
        raise ManifestError(f"invalid relative image path or extension: {name}")
    try:
        path = (root / rel).resolve(strict=True)
        path.relative_to(root.resolve(strict=True))
    except (OSError, ValueError) as exc:
        raise ManifestError(f"missing image or path escapes manifest folder: {name}") from exc
    if not path.is_file():
        raise ManifestError(f"not a file: {name}")
    return path


def load_font(font_path, labels, size):
    candidates = [font_path] if font_path else [
        r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\arial.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/Library/Fonts/Arial.ttf"]
    for candidate in candidates:
        if not candidate:
            continue
        try:
            font = ImageFont.truetype(candidate, size)
            for label in labels:
                font.getbbox(label)
            return font
        except (OSError, UnicodeEncodeError):
            pass
    if any(not label.isascii() for label in labels):
        raise ManifestError("CJK labels need --font with a CJK-capable TTF/TTC font")
    return ImageFont.load_default()


def render(manifest_path: Path, output_path: Path, font_path=None):
    manifest_path = manifest_path.resolve(strict=True)
    data, panels = read_manifest(manifest_path)
    root = manifest_path.parent
    frames = [resolve_frame(root, p["image"]) for p in panels]
    if len(set(frames)) != len(frames):
        raise ManifestError("duplicate resolved source frame")
    output_path = output_path.resolve()
    if output_path in frames or output_path == manifest_path:
        raise ManifestError("output cannot overwrite manifest or source frame")
    rows, cols = LAYOUTS[data["layout"]]
    pw, ph = data.get("panel_size", DEFAULTS["panel_size"])
    gap, margin = data.get("gutter", 20), data.get("margin", 28)
    label_h = data.get("label_height", 42)
    bg = data.get("background", DEFAULTS["background"])
    cell_bg = data.get("cell_background", DEFAULTS["cell_background"])
    label_color = data.get("label_color", DEFAULTS["label_color"])
    labels = [p["shot_id"] + (("  |  " + p["timecode"]) if p.get("timecode") else "") for p in panels]
    font = load_font(font_path, labels, max(14, min(22, label_h // 2)))
    cell_h = ph + label_h
    sheet = Image.new("RGB", (2*margin + cols*pw + (cols-1)*gap,
                              2*margin + rows*cell_h + (rows-1)*gap), bg)
    draw = ImageDraw.Draw(sheet)
    for label in labels:
        if draw.textbbox((0, 0), label, font=font)[2] > pw - 16:
            raise ManifestError(f"label is too wide for panel cell: {label}")
    for i, (panel, frame_path, label) in enumerate(zip(panels, frames, labels)):
        try:
            with Image.open(frame_path) as src:
                src.load()
                frame = ImageOps.exif_transpose(src).convert("RGB")
        except (OSError, UnidentifiedImageError) as exc:
            raise ManifestError(f"cannot decode {panel['image']}: {exc}") from exc
        x = margin + (i % cols) * (pw + gap)
        y = margin + (i // cols) * (cell_h + gap)
        draw.rectangle((x, y, x+pw-1, y+ph-1), fill=cell_bg)
        thumb = ImageOps.contain(frame, (pw, ph), method=Image.Resampling.LANCZOS)
        sheet.paste(thumb, (x+(pw-thumb.width)//2, y+(ph-thumb.height)//2))
        ly = y + ph
        draw.rectangle((x, ly, x+pw-1, ly+label_h-1), fill=bg)
        draw.text((x+8, ly+(label_h-font.size)//2-1), label, font=font, fill=label_color)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path, format="PNG", optimize=True)
    return {"output": str(output_path), "layout": data["layout"], "panel_count": len(panels),
            "size": list(sheet.size), "ordered_shot_ids": [p["shot_id"] for p in panels]}


def main(argv=None):
    parser = argparse.ArgumentParser(description="Create a deterministic storyboard contact sheet.")
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--font")
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args(argv)
    try:
        if args.validate_only:
            data, panels = read_manifest(args.manifest.resolve(strict=True))
            for panel in panels:
                frame = resolve_frame(args.manifest.resolve().parent, panel["image"])
                with Image.open(frame) as im:
                    im.verify()
            print(json.dumps({"valid": True, "layout": data["layout"], "panel_count": len(panels)}, ensure_ascii=False))
        else:
            if args.output is None:
                parser.error("--output is required unless --validate-only is used")
            print(json.dumps({"ok": True, **render(args.manifest, args.output, args.font)}, ensure_ascii=False))
        return 0
    except ManifestError as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
