#!/usr/bin/env python3
"""Create a controllable, non-destructive VFX overlay for a storyboard still.

The source frame is never modified. Paths use normalized (0..1) coordinates.
A grayscale mask is required so effects remain inside the approved surface region.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageDraw, ImageFilter


def _points(raw: Any, name: str, size: tuple[int, int]) -> list[tuple[int, int]]:
    if not isinstance(raw, list) or len(raw) < 2:
        raise ValueError(f"{name} must contain at least two normalized points")
    w, h = size
    result = []
    for point in raw:
        if not isinstance(point, list) or len(point) != 2:
            raise ValueError(f"{name} points must be [x, y]")
        x, y = point
        if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
            raise ValueError(f"{name} coordinates must be numeric")
        if not (0 <= x <= 1 and 0 <= y <= 1):
            raise ValueError(f"{name} coordinates must be between 0 and 1")
        result.append((round(x * (w - 1)), round(y * (h - 1))))
    return result


def _draw_path(layer: Image.Image, points: list[tuple[int, int]], width: int,
               fill: tuple[int, int, int, int]) -> None:
    ImageDraw.Draw(layer).line(points, fill=fill, width=width, joint="curve")


def render(source_path: Path, mask_path: Path, config_path: Path,
           output_path: Path, overlay_path: Path | None = None) -> dict[str, Any]:
    source_path, mask_path, config_path, output_path = map(
        Path, (source_path, mask_path, config_path, output_path)
    )
    if output_path.resolve() == source_path.resolve():
        raise ValueError("output must not overwrite the source frame")

    source = Image.open(source_path).convert("RGB")
    mask = Image.open(mask_path).convert("L")
    if mask.size != source.size:
        raise ValueError("mask dimensions must match source frame")

    cfg = json.loads(config_path.read_text(encoding="utf-8"))
    if cfg.get("version") != 1:
        raise ValueError("config version must be 1")
    w, h = source.size
    scale = max(1, round(min(w, h) / 720))
    glow_radius = int(cfg.get("glow_radius", 18))
    core_width = int(cfg.get("core_width", 2))
    opacity = float(cfg.get("opacity", 0.55))
    if not (0 <= opacity <= 1):
        raise ValueError("opacity must be between 0 and 1")
    if not (0 <= glow_radius <= 120) or not (1 <= core_width <= 30):
        raise ValueError("glow_radius/core_width outside safe limits")

    color_raw = cfg.get("color", [255, 45, 55])
    if (not isinstance(color_raw, list) or len(color_raw) != 3
            or any(not isinstance(v, int) or not 0 <= v <= 255 for v in color_raw)):
        raise ValueError("color must be three integer RGB channels")
    color = tuple(color_raw)
    glow = Image.new("RGBA", source.size, (0, 0, 0, 0))
    core = Image.new("RGBA", source.size, (0, 0, 0, 0))

    paths = cfg.get("energy_paths", [])
    if not isinstance(paths, list):
        raise ValueError("energy_paths must be a list")
    for path in paths:
        pts = _points(path, "energy_paths", source.size)
        _draw_path(glow, pts, max(5, core_width * 5) * scale, (*color, round(150 * opacity)))
        _draw_path(core, pts, core_width * scale, (255, 190, 175, round(210 * opacity)))

    # A separate, restrained metallic glint can be drawn without introducing a weapon.
    glint_path = cfg.get("glint_path")
    if glint_path:
        pts = _points(glint_path, "glint_path", source.size)
        glint_color = (205, 225, 255)
        _draw_path(glow, pts, 8 * scale, (*glint_color, round(110 * opacity)))
        _draw_path(core, pts, max(1, scale), (245, 250, 255, round(220 * opacity)))

    if glow_radius:
        glow = glow.filter(ImageFilter.GaussianBlur(glow_radius * scale))

    # Apply the same surface mask to both glow and core; no effect can leak outside it.
    alpha = mask.point(lambda p: round(p * opacity))
    glow.putalpha(ImageChops.multiply(glow.getchannel("A"), alpha))
    core.putalpha(ImageChops.multiply(core.getchannel("A"), alpha))

    base = source.convert("RGBA")
    result = Image.alpha_composite(base, glow)
    result = Image.alpha_composite(result, core).convert("RGB")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(output_path, quality=95)

    if overlay_path:
        overlay_path = Path(overlay_path)
        overlay_path.parent.mkdir(parents=True, exist_ok=True)
        combined = Image.alpha_composite(glow, core)
        combined.save(overlay_path)

    return {"width": w, "height": h, "energy_paths": len(paths),
            "glint": bool(glint_path), "source_unchanged": True}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--mask", required=True, type=Path)
    parser.add_argument("--config", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--overlay", type=Path, help="optional transparent RGBA overlay")
    args = parser.parse_args()
    try:
        print(json.dumps(render(args.source, args.mask, args.config,
                                args.output, args.overlay), ensure_ascii=False))
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        parser.error(str(exc))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
