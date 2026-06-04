#!/usr/bin/env python3
"""Generate the PWA app icons — a glassy gradient field (iOS style) with a bold
'[ ]' placeholder mark and a typing cursor. Run: python make_icons.py"""

from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

# Vertical gradient stops (blue -> indigo -> pink), iOS-flavoured.
STOPS = [(0.0, (74, 140, 255)), (0.52, (123, 108, 255)), (1.0, (214, 108, 200))]
BRACKET = (255, 255, 255, 255)        # off-white brackets
CURSOR = (255, 255, 255, 150)         # translucent white cursor


def _lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def _grad(t):
    for i in range(len(STOPS) - 1):
        t0, c0 = STOPS[i]; t1, c1 = STOPS[i + 1]
        if t <= t1:
            return _lerp(c0, c1, (t - t0) / (t1 - t0))
    return STOPS[-1][1]


def render(size: int, pad_ratio: float, rounded: bool) -> Image.Image:
    ss = 4
    W = size * ss
    # Gradient field
    base = Image.new("RGB", (W, W))
    bd = ImageDraw.Draw(base)
    for y in range(W):
        bd.line([(0, y), (W, y)], fill=_grad(y / (W - 1)))
    img = base.convert("RGBA")

    # Soft diagonal sheen (glass highlight)
    sheen = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sheen)
    sd.polygon([(0, 0), (W, 0), (0, int(W * 0.62))], fill=(255, 255, 255, 30))
    img = Image.alpha_composite(img, sheen)

    # Bracket geometry
    d = ImageDraw.Draw(img)
    pad = int(W * pad_ratio)
    inner = W - 2 * pad
    cx, cy = W // 2, W // 2
    bh = int(inner * 0.46); bw = int(inner * 0.072); nub = int(inner * 0.11); gap = int(inner * 0.165)
    top, bot = cy - bh // 2, cy + bh // 2

    def bracket(x, direction):
        d.rectangle([x, top, x + bw, bot], fill=BRACKET)
        if direction > 0:
            d.rectangle([x, top, x + nub, top + bw], fill=BRACKET)
            d.rectangle([x, bot - bw, x + nub, bot], fill=BRACKET)
        else:
            d.rectangle([x + bw - nub, top, x + bw, top + bw], fill=BRACKET)
            d.rectangle([x + bw - nub, bot - bw, x + bw, bot], fill=BRACKET)

    bracket(cx - gap - bw, +1)
    bracket(cx + gap, -1)

    # Translucent typing cursor (draw on overlay so alpha applies)
    ov = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    cw = int(inner * 0.034); ch = int(bh * 0.6)
    od.rectangle([cx - cw // 2, cy - ch // 2, cx + cw // 2, cy + ch // 2], fill=CURSOR)
    img = Image.alpha_composite(img, ov)

    if rounded:
        mask = Image.new("L", (W, W), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, W - 1, W - 1], radius=int(W * 0.225), fill=255)
        out = Image.new("RGBA", (W, W), (0, 0, 0, 0))
        out.paste(img, (0, 0), mask)
        img = out

    return img.resize((size, size), Image.LANCZOS)


def main():
    render(512, 0.17, True).save(OUT / "icon-512.png")
    render(192, 0.17, True).save(OUT / "icon-192.png")
    render(512, 0.28, False).save(OUT / "icon-maskable-512.png")   # full-bleed safe zone
    render(180, 0.18, False).save(OUT / "apple-touch-icon.png")
    render(32, 0.14, False).save(OUT / "favicon-32.png")
    for f in sorted(OUT.glob("*.png")):
        print(f"  {f.name:<26} {f.stat().st_size:>6} bytes")


if __name__ == "__main__":
    main()
