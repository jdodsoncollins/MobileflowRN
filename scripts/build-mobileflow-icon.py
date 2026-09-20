#!/usr/bin/env python3
"""Build assets/icon-composer/Mobileflow.icon as code.

Background face = icon.json fill (Default / Dark / Tinted).
Image assets = rim ring + flat monogram only (no glow, no emboss, no baked face).
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
COMPOSER = ROOT / "assets" / "icon-composer"
OUT = COMPOSER / "Mobileflow.icon"
ASSETS = OUT / "Assets"
EXPORTS = COMPOSER / "exports"

SIZE = 1024
CX = CY = SIZE // 2
FONT_PATH = "/System/Library/Fonts/Avenir Next Condensed.ttc"
FONT_SIZE = 600
ACCENT = (91, 76, 255)
MAGENTA = (255, 45, 148)
CYAN = (0, 200, 255)
ICTOOL = Path(
    "/Applications/Xcode.app/Contents/Applications/Icon Composer.app"
    "/Contents/Executables/ictool"
)


def p3(r: int, g: int, b: int, a: float = 1.0) -> str:
    return f"display-p3:{r / 255:.5f},{g / 255:.5f},{b / 255:.5f},{a:.5f}"


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for idx in (8, 7, 6, 5, 4, 3, 2, 1, 0):
        try:
            return ImageFont.truetype(FONT_PATH, size=size, index=idx)
        except Exception:
            continue
    return ImageFont.truetype(
        "/System/Library/Fonts/Supplemental/Arial Black.ttf", size
    )


def monogram_flat() -> Image.Image:
    font = load_font(FONT_SIZE)
    layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    bbox = draw.textbbox((0, 0), "m", font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (SIZE - tw) / 2 - bbox[0]
    y = (SIZE - th) / 2 - bbox[1] - SIZE * 0.02
    draw.text((x, y), "m", font=font, fill=(255, 255, 255, 255))
    return layer


def rim_only() -> Image.Image:
    outer_r, thickness = SIZE * 0.455, SIZE * 0.052
    mask = Image.new("L", (SIZE, SIZE), 0)
    md = ImageDraw.Draw(mask)
    md.ellipse(
        [CX - outer_r, CY - outer_r, CX + outer_r, CY + outer_r], fill=255
    )
    ir = outer_r - thickness
    md.ellipse([CX - ir, CY - ir, CX + ir, CY + ir], fill=0)
    mask_aa = mask.filter(ImageFilter.GaussianBlur(0.8))

    color_field = Image.new("RGBA", (SIZE, SIZE))
    px = color_field.load()
    for y in range(SIZE):
        for x in range(SIZE):
            t = max(
                0.0, min(1.0, ((x - CX) + (y - CY)) / (SIZE * 1.2) + 0.5)
            )
            if t < 0.5:
                u = t * 2
                c = [
                    int(MAGENTA[i] * (1 - u) + ACCENT[i] * u) for i in range(3)
                ]
            else:
                u = (t - 0.5) * 2
                c = [int(ACCENT[i] * (1 - u) + CYAN[i] * u) for i in range(3)]
            px[x, y] = (*c, 255)

    return Image.composite(
        color_field, Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0)), mask_aa
    )


def build_doc() -> dict:
    vert = {
        "start": {"x": 0.5, "y": 0.0},
        "stop": {"x": 0.5, "y": 1.0},
    }
    return {
        "fill": {
            "linear-gradient": [p3(48, 40, 110), p3(22, 18, 58)],
            "orientation": vert,
        },
        "fill-specializations": [
            {
                "appearance": "dark",
                "value": {
                    "linear-gradient": [p3(16, 10, 42), p3(2, 2, 10)],
                    "orientation": vert,
                },
            },
            {
                "appearance": "tinted",
                "value": {"solid": "extended-gray:0.12000,1.00000"},
            },
        ],
        "groups": [
            {
                "layers": [
                    {
                        "name": "Rim",
                        "image-name": "rim.png",
                        "glass": False,
                        "opacity": 1.0,
                        "opacity-specializations": [
                            {"appearance": "tinted", "value": 0.0},
                        ],
                    }
                ],
                "shadow": {"kind": "none", "opacity": 0.0},
                "translucency": {"enabled": False, "value": 0.5},
                "specular": False,
                "lighting": "individual",
            },
            {
                "layers": [
                    {
                        "name": "Monogram",
                        "image-name": "monogram.png",
                        "glass": False,
                        "opacity": 1.0,
                    }
                ],
                "shadow": {"kind": "none", "opacity": 0.0},
                "translucency": {"enabled": False, "value": 0.5},
                "specular": False,
                "lighting": "individual",
            },
        ],
        "supported-platforms": {
            "squares": "shared",
            "circles": ["watchOS"],
        },
    }


def export_preview(rendition: str, dest: Path) -> None:
    if not ICTOOL.is_file():
        print("warn: ictool not found; skip", rendition, file=sys.stderr)
        return
    subprocess.run(
        [
            str(ICTOOL),
            str(OUT),
            "--export-image",
            "--output-file",
            str(dest),
            "--platform",
            "iOS",
            "--rendition",
            rendition,
            "--width",
            "1024",
            "--height",
            "1024",
            "--scale",
            "1",
        ],
        check=True,
        capture_output=True,
        text=True,
    )


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    ASSETS.mkdir(parents=True)
    EXPORTS.mkdir(parents=True, exist_ok=True)

    monogram_flat().save(ASSETS / "monogram.png")
    rim_only().save(ASSETS / "rim.png")

    doc = build_doc()
    (OUT / "icon.json").write_text(json.dumps(doc, indent=2) + "\n")
    print("wrote", OUT / "icon.json")
    print("assets:", sorted(p.name for p in ASSETS.iterdir()))

    for rendition, name in [
        ("Default", "preview-default.png"),
        ("Dark", "preview-dark.png"),
        ("TintedDark", "preview-tinted.png"),
    ]:
        dest = EXPORTS / name
        try:
            export_preview(rendition, dest)
            print("preview", rendition, "->", dest)
        except subprocess.CalledProcessError as e:
            print("ictool failed", rendition, e.stderr[:400], file=sys.stderr)

    # Expo fallback: flattened default
    default_preview = EXPORTS / "preview-default.png"
    if default_preview.is_file():
        im = Image.open(default_preview).convert("RGBA")
        bg = Image.new("RGB", im.size, (0, 0, 0))
        bg.paste(im, mask=im.split()[-1])
        bg.save(ROOT / "assets" / "icon.png", "PNG")
        print("wrote assets/icon.png")


if __name__ == "__main__":
    main()
