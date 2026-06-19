#!/usr/bin/env python3
"""Author the iOS app icon for AI Daily Digest (comic-lite, "newspaper on red").

Renders a 1024x1024 opaque PNG with Pillow and writes it to BOTH:
  - assets/icon.png                     (for expo.icon)
  - ios/.../AppIcon.appiconset/App-Icon-1024x1024@1x.png  (the prebuilt native catalog's
    single referenced file; Xcode/actool derives the smaller sizes)

Design: a red ground with a cream newspaper page (thick ink border + hard comic shadow),
a red masthead, two bold ink headline bars, and a rising ink/ink/red bar-chart — bold,
high-contrast, reads at small size. Run: python3 scripts/make-icon.py
"""
import os
import shutil
from PIL import Image, ImageDraw

# --- brand palette (src/client/theme.ts) ---
INK = (26, 26, 26)        # #1a1a1a
PAPER = (253, 246, 236)   # #fdf6ec
ACCENT = (230, 57, 70)    # #e63946

HERE = os.path.dirname(__file__)
OUT_ASSET = os.path.join(HERE, "..", "assets", "icon.png")
OUT_IOS = os.path.join(
    HERE, "..", "ios", "AIDailyDigest", "Images.xcassets",
    "AppIcon.appiconset", "App-Icon-1024x1024@1x.png",
)
SIZE = 1024
S = 4                      # supersample for smooth (anti-aliased) edges
W = SIZE * S


def rr(d, box, radius, **kw):
    d.rounded_rectangle(box, radius=int(radius), **kw)


def render():
    img = Image.new("RGB", (W, W), ACCENT)  # red ground; RGB = opaque (iOS requires)
    d = ImageDraw.Draw(img)

    m = int(W * 0.135)
    page = [m, m, W - m, W - m]
    rad = int(W * 0.085)
    bw = int(W * 0.034)
    off = int(W * 0.03)

    rr(d, [page[0] + off, page[1] + off, page[2] + off, page[3] + off], rad, fill=INK)  # hard shadow
    rr(d, page, rad, fill=PAPER, outline=INK, width=bw)                                 # newspaper page

    pad = int(W * 0.055)
    x0, y0, x1, y1 = page[0] + pad, page[1] + pad, page[2] - pad, page[3] - pad
    iw = x1 - x0
    H = y1 - y0

    # bold red masthead (top ~21%)
    mh = int(H * 0.21)
    rr(d, [x0, y0, x1, y0 + mh], mh * 0.26, fill=ACCENT, outline=INK, width=int(bw * 0.7))

    # two thick ink headline bars
    bh = int(H * 0.105)
    h1 = y0 + mh + int(H * 0.075)
    rr(d, [x0, h1, x0 + iw, h1 + bh], bh * 0.34, fill=INK)
    h2 = h1 + bh + int(H * 0.05)
    rr(d, [x0, h2, x0 + int(iw * 0.62), h2 + bh], bh * 0.34, fill=INK)

    # rising bar-chart (ink, ink, red) — bottom band
    ct = y0 + int(H * 0.58)
    base = y1
    band = base - ct
    cbw = int(iw * 0.20)
    cg = int((iw - 3 * cbw) / 2)
    bx = x0
    for hf, col in ((0.52, INK), (0.78, INK), (1.0, ACCENT)):
        h = int(band * hf)
        rr(d, [bx, base - h, bx + cbw, base], cbw * 0.16, fill=col, outline=INK, width=int(bw * 0.6))
        bx += cbw + cg

    return img.resize((SIZE, SIZE), Image.LANCZOS)


def main():
    img = render()
    os.makedirs(os.path.dirname(OUT_ASSET), exist_ok=True)
    img.save(OUT_ASSET, "PNG")
    print(f"wrote {os.path.normpath(OUT_ASSET)} ({SIZE}x{SIZE}, {img.mode})")
    ios_dir = os.path.dirname(OUT_IOS)
    if os.path.isdir(ios_dir):
        shutil.copyfile(OUT_ASSET, OUT_IOS)
        print(f"copied -> {os.path.normpath(OUT_IOS)}")
    else:
        print(f"(skipped iOS catalog: {os.path.normpath(ios_dir)} not present — run after prebuild)")


if __name__ == "__main__":
    main()
