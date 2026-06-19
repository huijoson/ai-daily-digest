#!/usr/bin/env python3
"""Author the iOS app icon for AI Daily Digest in the app's comic-lite style.

Renders a 1024x1024 opaque PNG to assets/icon.png using Pillow only (no SVG step).
Motif: a comic "newspaper page" with a hard offset shadow, a red masthead, and bold
ink headline bars + a small accent bar-chart — evoking a daily news digest with charts.
Run: python3 scripts/make-icon.py
"""
import os
from PIL import Image, ImageDraw

# --- brand palette (from src/client/theme.ts) ---
INK = (26, 26, 26)        # #1a1a1a
PAPER = (253, 246, 236)   # #fdf6ec
CARD = (255, 255, 255)    # #ffffff
ACCENT = (230, 57, 70)    # #e63946

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "icon.png")
SIZE = 1024
S = 4                      # supersample for smooth (anti-aliased) edges
W = SIZE * S


def rr(d, box, radius, **kw):
    d.rounded_rectangle(box, radius=int(radius), **kw)


def main():
    img = Image.new("RGB", (W, W), PAPER)  # RGB = opaque, as iOS requires
    d = ImageDraw.Draw(img)

    border = int(W * 0.026)
    rad = int(W * 0.075)
    m = int(W * 0.155)                      # outer margin
    page = [m, m, W - m, W - m]

    # hard comic drop shadow (offset, no blur)
    off = int(W * 0.034)
    rr(d, [page[0] + off, page[1] + off, page[2] + off, page[3] + off], rad, fill=INK)

    # newspaper page
    rr(d, page, rad, fill=CARD, outline=INK, width=border)

    pad = int(W * 0.052)
    x0, y0, x1, y1 = page[0] + pad, page[1] + pad, page[2] - pad, page[3] - pad
    inner_w = x1 - x0
    thin = max(1, int(border * 0.62))

    # masthead (red bar) with two paper "title" ticks inside it
    mast_h = int((y1 - y0) * 0.205)
    rr(d, [x0, y0, x1, y0 + mast_h], mast_h * 0.30, fill=ACCENT, outline=INK, width=thin)
    tick_h = int(mast_h * 0.16)
    tick_y = y0 + (mast_h - tick_h) // 2
    rr(d, [x0 + int(inner_w * 0.10), tick_y, x0 + int(inner_w * 0.58), tick_y + tick_h], tick_h * 0.5, fill=PAPER)
    rr(d, [x0 + int(inner_w * 0.63), tick_y, x0 + int(inner_w * 0.90), tick_y + tick_h], tick_h * 0.5, fill=PAPER)

    # headline bars (ink), decreasing width
    bar_h = int((y1 - y0) * 0.072)
    gap = int(bar_h * 0.95)
    cy = y0 + mast_h + int(gap * 1.7)
    for wf in (1.0, 0.86, 0.66):
        rr(d, [x0, cy, x0 + int(inner_w * wf), cy + bar_h], bar_h * 0.42, fill=INK)
        cy += bar_h + gap

    # accent mini bar-chart bottom-left (the app's multimodal "charts" nod)
    chart_top = cy + int(gap * 0.6)
    base = y1
    bw = int(inner_w * 0.115)
    bgap = int(bw * 0.55)
    heights = (0.42, 0.72, 1.0)
    cols = (INK, INK, ACCENT)
    bx = x0
    for hf, col in zip(heights, cols):
        bh = int((base - chart_top) * hf)
        rr(d, [bx, base - bh, bx + bw, base], bw * 0.22, fill=col, outline=INK, width=thin)
        bx += bw + bgap

    img = img.resize((SIZE, SIZE), Image.LANCZOS)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img.save(OUT, "PNG")
    print(f"wrote {os.path.normpath(OUT)} ({SIZE}x{SIZE}, mode={img.mode})")


if __name__ == "__main__":
    main()
