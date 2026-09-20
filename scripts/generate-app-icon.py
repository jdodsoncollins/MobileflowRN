#!/usr/bin/env python3
"""Generate Mobileflow app icon layers + light/dark flattened exports.

Daught-style luminous rim monogram: condensed geometric lowercase 'm'
(Avenir Next Condensed), brand purple rim (magenta → #5B4CFF → cyan).
Full-bleed 1024 canvas (no platform mask).
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

SIZE = 1024
CX = CY = SIZE // 2
ACCENT = (91, 76, 255)
MAGENTA = (255, 45, 148)
CYAN = (0, 200, 255)
FONT_PATH = "/System/Library/Fonts/Avenir Next Condensed.ttc"
FONT_SIZE = 600

ROOT = Path(__file__).resolve().parents[1]
COMPOSER = ROOT / "assets" / "icon-composer"
LAYERS = COMPOSER / "layers"
EXPORTS = COMPOSER / "exports"


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for idx in (8, 7, 6, 5, 4, 3, 2, 1, 0):
        try:
            return ImageFont.truetype(FONT_PATH, size=size, index=idx)
        except Exception:
            continue
    return ImageFont.truetype(
        "/System/Library/Fonts/Supplemental/Arial Black.ttf", size
    )


def radial_gradient(size: int, inner: tuple, outer: tuple) -> Image.Image:
    img = Image.new("RGBA", (size, size))
    px = img.load()
    cx = cy = size / 2
    max_r = math.hypot(cx, cy)
    for y in range(size):
        for x in range(size):
            r = min(1.0, (math.hypot(x - cx, y - cy) / max_r) ** 0.9)
            c = tuple(int(inner[i] * (1 - r) + outer[i] * r) for i in range(3)) + (
                255,
            )
            px[x, y] = c
    return img


def gradient_ring(
    size: int,
    outer_r: float,
    thickness: float,
    saturation: float = 1.0,
    glow_strength: float = 0.35,
) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.ellipse(
        [CX - outer_r, CY - outer_r, CX + outer_r, CY + outer_r], fill=255
    )
    ir = outer_r - thickness
    md.ellipse([CX - ir, CY - ir, CX + ir, CY + ir], fill=0)

    color_field = Image.new("RGBA", (size, size))
    px = color_field.load()
    for y in range(size):
        for x in range(size):
            t = ((x - CX) + (y - CY)) / (SIZE * 1.2) + 0.5
            t = max(0.0, min(1.0, t))
            if t < 0.5:
                u = t * 2
                c = [MAGENTA[i] * (1 - u) + ACCENT[i] * u for i in range(3)]
            else:
                u = (t - 0.5) * 2
                c = [ACCENT[i] * (1 - u) + CYAN[i] * u for i in range(3)]
            c = [min(255, int(v * saturation)) for v in c]
            px[x, y] = (*c, 255)

    glow = mask.filter(ImageFilter.GaussianBlur(20))
    glow_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gpx = glow_img.load()
    gm = glow.load()
    for y in range(size):
        for x in range(size):
            a = gm[x, y]
            if a:
                gpx[x, y] = (*ACCENT, int(a * glow_strength))

    ring = Image.composite(
        color_field, Image.new("RGBA", (size, size), (0, 0, 0, 0)), mask
    )
    ring.putalpha(mask.filter(ImageFilter.GaussianBlur(1.0)))
    return Image.alpha_composite(glow_img, ring)


def monogram(size: int, fill=(255, 255, 255, 255)) -> Image.Image:
    font = load_font(FONT_SIZE)
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    bbox = draw.textbbox((0, 0), "m", font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - tw) / 2 - bbox[0]
    y = (size - th) / 2 - bbox[1] - size * 0.02
    draw.text((x, y), "m", font=font, fill=fill)
    return layer


def letter_glow(
    letter: Image.Image, color=(120, 90, 255), strength: float = 0.55
) -> Image.Image:
    alpha = letter.split()[-1]
    glow = alpha.filter(ImageFilter.GaussianBlur(30))
    img = Image.new("RGBA", letter.size, (0, 0, 0, 0))
    px = img.load()
    g = glow.load()
    for y in range(letter.size[1]):
        for x in range(letter.size[0]):
            a = g[x, y]
            if a:
                px[x, y] = (*color, int(a * strength))
    return img


def vignette(size: int, strength: float = 0.4) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    max_r = size * 0.52
    for y in range(size):
        for x in range(size):
            r = math.hypot(x - CX, y - CY) / max_r
            if r > 1:
                a = min(255, int((r - 1) * 200 * strength + 50 * strength))
                px[x, y] = (0, 0, 0, a)
    return img.filter(ImageFilter.GaussianBlur(10))


def top_sheen(size: int, alpha: int = 22) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse(
        [
            CX - size * 0.4,
            CY - size * 0.55,
            CX + size * 0.4,
            CY - size * 0.05,
        ],
        fill=(255, 255, 255, alpha),
    )
    return img.filter(ImageFilter.GaussianBlur(36))


def compose(mode: str) -> Image.Image:
    if mode == "light":
        base = radial_gradient(SIZE, (48, 40, 110), (22, 18, 58))
        ring = gradient_ring(
            SIZE, SIZE * 0.455, SIZE * 0.052, saturation=1.0, glow_strength=0.28
        )
        glow_col = (150, 120, 255)
        glow_str = 0.42
        sheen_a = 30
        vig = 0.22
    else:
        base = radial_gradient(SIZE, (16, 10, 42), (2, 2, 10))
        ring = gradient_ring(
            SIZE, SIZE * 0.455, SIZE * 0.052, saturation=1.08, glow_strength=0.48
        )
        glow_col = (100, 70, 255)
        glow_str = 0.62
        sheen_a = 14
        vig = 0.4

    letter = monogram(SIZE)
    glow = letter_glow(letter, color=glow_col, strength=glow_str)

    out = base.convert("RGBA")
    out = Image.alpha_composite(out, top_sheen(SIZE, sheen_a))
    out = Image.alpha_composite(out, vignette(SIZE, vig))
    out = Image.alpha_composite(out, glow)
    out = Image.alpha_composite(out, letter)
    out = Image.alpha_composite(out, ring)
    return out


def to_rgb(img: Image.Image) -> Image.Image:
    rgb = Image.new("RGB", img.size, (0, 0, 0))
    rgb.paste(img, mask=img.split()[-1])
    return rgb


def main() -> None:
    LAYERS.mkdir(parents=True, exist_ok=True)
    EXPORTS.mkdir(parents=True, exist_ok=True)

    letter = monogram(SIZE)
    letter.save(LAYERS / "2-monogram.png")
    letter_glow(letter).save(LAYERS / "1-letter-glow.png")
    radial_gradient(SIZE, (16, 10, 42), (2, 2, 10)).save(
        LAYERS / "0-face-dark.png"
    )
    radial_gradient(SIZE, (48, 40, 110), (22, 18, 58)).save(
        LAYERS / "0-face-light.png"
    )
    gradient_ring(SIZE, SIZE * 0.455, SIZE * 0.052).save(LAYERS / "3-rim.png")

    for mode in ("light", "dark"):
        path = EXPORTS / f"Mobileflow-icon-{mode}-1024.png"
        to_rgb(compose(mode)).save(path, "PNG", optimize=True)
        print("wrote", path)

    primary = to_rgb(compose("dark"))
    primary.save(ROOT / "assets" / "icon.png", "PNG")
    appicon = (
        ROOT
        / "ios"
        / "Mobileflow"
        / "Images.xcassets"
        / "AppIcon.appiconset"
        / "App-Icon-1024x1024@1x.png"
    )
    if appicon.parent.exists():
        primary.save(appicon, "PNG")
        print("wrote", appicon)

    primary.save(ROOT / "assets" / "splash-icon.png", "PNG")

    m = monogram(SIZE)
    fg = Image.new("RGBA", (SIZE, SIZE), (11, 18, 32, 255))
    fg = Image.alpha_composite(fg, letter_glow(m, strength=0.4))
    fg = Image.alpha_composite(fg, m)
    fg.save(ROOT / "assets" / "android-icon-foreground.png", "PNG")
    Image.new("RGB", (SIZE, SIZE), (11, 18, 32)).save(
        ROOT / "assets" / "android-icon-background.png", "PNG"
    )
    m.save(ROOT / "assets" / "android-icon-monochrome.png", "PNG")
    print("installed Expo/Android icon assets")


if __name__ == "__main__":
    main()
