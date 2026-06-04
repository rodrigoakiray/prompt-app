#!/usr/bin/env python3
"""Generate the PWA app icons — a bold editorial '[ ]' placeholder mark with a
typing cursor, on a vermilion field. Run: python make_icons.py"""

from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

VERMILION = (225, 67, 40, 255)
INK = (22, 19, 15, 255)
CREAM = (247, 241, 227, 255)


def rounded(draw, box, r, fill):
    draw.rounded_rectangle(box, radius=r, fill=fill)


def render(size: int, pad_ratio: float, rounded_bg: bool) -> Image.Image:
    S = size
    ss = 4  # supersample for crisp edges
    W = S * ss
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    pad = int(W * pad_ratio)
    inner = W - 2 * pad

    # Background field
    if rounded_bg:
        rounded(d, [pad, pad, pad + inner, pad + inner], int(inner * 0.22), VERMILION)
    else:
        d.rectangle([0, 0, W, W], fill=VERMILION)

    cx, cy = W // 2, W // 2
    # Bracket geometry (centered)
    bh = int(inner * 0.46)          # bracket height
    bw = int(inner * 0.075)         # stroke weight
    nub = int(inner * 0.11)         # horizontal nub length
    gap = int(inner * 0.165)        # half-distance between the two brackets
    top = cy - bh // 2
    bot = cy + bh // 2

    def bracket(x_spine, direction):
        # vertical spine
        d.rectangle([x_spine, top, x_spine + bw, bot], fill=CREAM)
        # top + bottom nubs
        if direction > 0:  # left bracket "["  -> nubs go right
            d.rectangle([x_spine, top, x_spine + nub, top + bw], fill=CREAM)
            d.rectangle([x_spine, bot - bw, x_spine + nub, bot], fill=CREAM)
        else:              # right bracket "]" -> nubs go left
            d.rectangle([x_spine + bw - nub, top, x_spine + bw, top + bw], fill=CREAM)
            d.rectangle([x_spine + bw - nub, bot - bw, x_spine + bw, bot], fill=CREAM)

    bracket(cx - gap - bw, +1)
    bracket(cx + gap, -1)

    # Ink typing cursor between the brackets
    cw = int(inner * 0.035)
    ch = int(bh * 0.62)
    d.rectangle([cx - cw // 2, cy - ch // 2, cx + cw // 2, cy + ch // 2], fill=INK)

    return img.resize((S, S), Image.LANCZOS)


def main():
    render(512, 0.16, True).save(OUT / "icon-512.png")
    render(192, 0.16, True).save(OUT / "icon-192.png")
    # Maskable: full-bleed background, mark inside the safe zone (extra padding)
    render(512, 0.28, False).save(OUT / "icon-maskable-512.png")
    # Apple touch icon: full-bleed (iOS rounds corners itself)
    render(180, 0.18, False).save(OUT / "apple-touch-icon.png")
    # Favicon
    render(32, 0.12, False).save(OUT / "favicon-32.png")
    for f in sorted(OUT.glob("*.png")):
        print(f"  {f.name:<26} {f.stat().st_size:>6} bytes")


if __name__ == "__main__":
    main()
