#!/usr/bin/env python3
"""
OmniBazaar LP Rewards Infographic Generator

Shows how LP APR decreases as total LP investment grows (hyperbolic curve)
and how total annual LP rewards decrease as the validator network grows.

On-chain sources:
  OmniValidatorRewards.sol  — INITIAL_BLOCK_REWARD=15.602, gatewayRewardCap=0.3, serviceNodeRewardCap=0.2
  LiquidityOverflowPool.sol — 30% immediate, 70% vests 90 days, 1-day min stake
"""

from PIL import Image, ImageDraw, ImageFont
import math

# ── Layout ─────────────────────────────────────────────────────
WIDTH = 1200
HEIGHT = 1320
BG       = "#0f1419"
TEAL     = "#00d4aa"
BLUE     = "#1da1f2"
GOLD     = "#f5a623"
RED      = "#e74c3c"
WHITE    = "#ffffff"
MUTED    = "#8899a6"
CARD     = "#192734"
GRID     = "#1c3040"
FILL     = "#0a2820"
DARK_GOLD = "#2a1f00"

OUTPUT = "/home/omnirick/OmniBazaar/Documents/OmniBazaar_LP_Rewards_Infographic.png"

# ── On-chain constants ─────────────────────────────────────────
BLOCK_REWARD    = 15.602       # XOM per 2s epoch
GATEWAY_CAP     = 0.3          # XOM per epoch per gateway
SERVICE_CAP     = 0.2          # XOM per epoch per service node
EPOCHS_PER_YEAR = 365.25 * 24 * 3600 / 2   # 15,778,800

# Current network state (5 gateways, 0 service nodes)
NUM_GW = 5
OVERFLOW_EPOCH = BLOCK_REWARD - NUM_GW * GATEWAY_CAP   # 14.102
ANNUAL_OVERFLOW = OVERFLOW_EPOCH * EPOCHS_PER_YEAR      # ~222.5M XOM


def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def rrect(draw, coords, r, fill):
    x1, y1, x2, y2 = coords
    draw.rectangle([x1+r, y1, x2-r, y2], fill=fill)
    draw.rectangle([x1, y1+r, x2, y2-r], fill=fill)
    for cx, cy in [(x1, y1), (x2-2*r, y1), (x1, y2-2*r), (x2-2*r, y2-2*r)]:
        draw.ellipse([cx, cy, cx+2*r, cy+2*r], fill=fill)

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def create():
    img = Image.new('RGB', (WIDTH, HEIGHT), rgb(BG))
    d = ImageDraw.Draw(img)

    B = "/usr/share/fonts/truetype/dejavu/"
    ft = lambda n, s: ImageFont.truetype(B + n, s)
    F_TITLE   = ft("DejaVuSans-Bold.ttf", 42)
    F_SUB     = ft("DejaVuSans-Bold.ttf", 22)
    F_SEC     = ft("DejaVuSans-Bold.ttf", 24)
    F_BODY    = ft("DejaVuSans.ttf", 18)
    F_BBODY   = ft("DejaVuSans-Bold.ttf", 18)
    F_SM      = ft("DejaVuSans.ttf", 15)
    F_BSM     = ft("DejaVuSans-Bold.ttf", 15)
    F_AX      = ft("DejaVuSans.ttf", 13)
    F_BAX     = ft("DejaVuSans-Bold.ttf", 14)
    F_BIG     = ft("DejaVuSans-Bold.ttf", 46)

    y = 30

    # ════════════ TITLE ════════════
    d.text((WIDTH//2, y), "EARLY LP REWARDS", font=F_TITLE, fill=rgb(GOLD), anchor="mt")
    y += 52
    d.text((WIDTH//2, y), "Validator Overflow System", font=F_SUB, fill=rgb(TEAL), anchor="mt")
    y += 32
    d.line([(80, y), (WIDTH-80, y)], fill=rgb(GOLD), width=2)
    y += 20

    # ════════════ HOW IT WORKS ════════════
    rrect(d, (40, y, WIDTH-40, y+120), 12, rgb(CARD))
    d.text((WIDTH//2, y+8), "HOW IT WORKS", font=F_SEC, fill=rgb(WHITE), anchor="mt")
    steps = [
        (f"Block reward = {BLOCK_REWARD} XOM every 2-second epoch", TEAL),
        (f"Validators capped: {GATEWAY_CAP} XOM (gateway) / {SERVICE_CAP} XOM (service node)", WHITE),
        ("Excess overflow flows automatically to LP stakers", GOLD),
    ]
    sy = y + 38
    for i, (txt, c) in enumerate(steps):
        d.text((70, sy), f"{i+1}.", font=F_BBODY, fill=rgb(GOLD))
        d.text((100, sy), txt, font=F_BODY, fill=rgb(c))
        sy += 26
    y += 135

    # ════════════ CURRENT STATE ════════════
    rrect(d, (40, y, WIDTH-40, y+78), 12, rgb(DARK_GOLD))
    rrect(d, (43, y+3, WIDTH-43, y+75), 10, rgb("#151005"))
    om = ANNUAL_OVERFLOW / 1e6
    d.text((WIDTH//2, y+8), f"{om:.1f}M XOM / YEAR", font=F_BIG, fill=rgb(GOLD), anchor="mt")
    d.text((WIDTH//2, y+56),
           f"Available to LP stakers now  \u2014  {NUM_GW} gateways, 0 service nodes",
           font=F_SM, fill=rgb(MUTED), anchor="mt")
    y += 95

    # ════════════ CHART 1: APR vs LP Investment ════════════
    CH1 = 400
    rrect(d, (40, y, WIDTH-40, y+CH1), 12, rgb(CARD))
    d.text((WIDTH//2, y+10), "APR vs. TOTAL LP INVESTMENT", font=F_SEC, fill=rgb(WHITE), anchor="mt")
    d.text((WIDTH//2, y+36),
           f"Year 1  \u2014  {om:.1f}M XOM overflow  \u2014  Formula: APR = {om:.1f}M \u00f7 LP staked",
           font=F_SM, fill=rgb(MUTED), anchor="mt")

    # Chart area
    cx1, cy1, cx2, cy2 = 120, y+58, WIDTH-55, y+CH1-32
    cw, ch = cx2-cx1, cy2-cy1
    xlo, xhi = math.log10(50e6), math.log10(10e9)
    ylo, yhi = 0, 250

    def px(v): return cx1 + (math.log10(v) - xlo) / (xhi - xlo) * cw
    def py(a): return cy2 - (min(a, yhi) - ylo) / (yhi - ylo) * ch

    # Horizontal grid (skip 0% label to avoid overlap with X-axis labels)
    for a in [0, 50, 100, 150, 200, 250]:
        yy = py(a)
        d.line([(cx1, yy), (cx2, yy)], fill=rgb(GRID), width=1)
        if a > 0:
            d.text((cx1-6, yy), f"{a}%", font=F_AX, fill=rgb(MUTED), anchor="rm")

    # Vertical grid (skip first label to avoid 0% overlap)
    for val, lbl in [(100e6,"100M"),(250e6,"250M"),(500e6,"500M"),
                     (1e9,"1B"),(2.5e9,"2.5B"),(5e9,"5B"),(10e9,"10B")]:
        xx = px(val)
        d.line([(xx, cy1), (xx, cy2)], fill=rgb(GRID), width=1)
        d.text((xx, cy2+4), lbl, font=F_AX, fill=rgb(MUTED), anchor="mt")
    # First tick (50M) — draw gridline only, label positioned to avoid 0% overlap
    xx50 = px(50e6)
    d.line([(xx50, cy1), (xx50, cy2)], fill=rgb(GRID), width=1)
    d.text((xx50, cy2+4), "50M", font=F_AX, fill=rgb(MUTED), anchor="mt")

    d.text(((cx1+cx2)//2, cy2+19), "Total LP Investment (XOM)", font=F_BAX, fill=rgb(TEAL), anchor="mt")

    # Fill under curve
    fill_pts = []
    for lp_m in range(50, 10001, 5):
        lp = lp_m * 1e6
        apr = min((ANNUAL_OVERFLOW / lp) * 100, yhi)
        fill_pts.append((px(lp), py(apr)))
    fill_pts.append((px(10e9), py(0)))
    fill_pts.append((px(50e6), py(0)))
    d.polygon(fill_pts, fill=rgb(FILL))

    # Draw curve
    pts = []
    for lp_m in range(50, 10001, 3):
        lp = lp_m * 1e6
        apr = min((ANNUAL_OVERFLOW / lp) * 100, yhi)
        pts.append((px(lp), py(apr)))
    for i in range(len(pts)-1):
        d.line([pts[i], pts[i+1]], fill=rgb(TEAL), width=3)

    # Staking comparison band (5-12% APR)
    bt, bb = py(12), py(5)
    for yy in range(int(bt), int(bb)+1, 2):
        d.line([(cx1+1, yy), (cx2, yy)], fill=rgb("#1a2a20"), width=1)
    d.text((cx1+8, bt-2), "Staking APR range (5\u201312%)", font=F_AX, fill=rgb("#4a7a5a"), anchor="lb")

    # Key data points
    highlights = [
        (100e6,  "222%",  -18, 0),
        (250e6,  "89%",   -18, 0),
        (500e6,  "44.5%", -18, 0),
        (1e9,    "22.3%", -18, 0),
        (2.5e9,  "8.9%",  -18, 0),
        (5e9,    "4.5%",  -18, 0),
    ]
    for lp_val, label, offy, offx in highlights:
        apr = (ANNUAL_OVERFLOW / lp_val) * 100
        xx, yy = px(lp_val), py(apr)
        d.ellipse([xx-4, yy-4, xx+4, yy+4], fill=rgb(GOLD))
        d.text((xx+offx, yy+offy), label, font=F_BSM, fill=rgb(GOLD), anchor="mb")

    y += CH1 + 15

    # ════════════ CHART 2: Annual Overflow vs Network Size ════════════
    CH2 = 290
    rrect(d, (40, y, WIDTH-40, y+CH2), 12, rgb(CARD))
    d.text((WIDTH//2, y+10), "ANNUAL LP REWARDS vs. NETWORK SIZE",
           font=F_SEC, fill=rgb(WHITE), anchor="mt")
    d.text((WIDTH//2, y+36),
           "Each service node reduces overflow by ~3.2M XOM/year  |  Each gateway by ~4.7M",
           font=F_SM, fill=rgb(MUTED), anchor="mt")

    bx1, by2 = 100, y+CH2-28
    bx2 = WIDTH-50
    bw = bx2 - bx1
    by1 = y + 58
    bh = by2 - by1

    bars = []
    for gc in [5, 10, 15, 20, 25, 30, 40, 50]:
        consumed = gc * GATEWAY_CAP
        ov = max(0, BLOCK_REWARD - consumed)
        bars.append((gc, ov * EPOCHS_PER_YEAR / 1e6))

    mx = bars[0][1]
    n = len(bars)
    gap = 14
    bwb = (bw - gap*(n+1)) / n

    for i, (gc, am) in enumerate(bars):
        x0 = bx1 + gap + i*(bwb + gap)
        hb = (am / mx) * bh * 0.82 if mx > 0 else 0
        yt = by2 - hb

        t = i / max(n-1, 1)
        col = lerp(rgb(TEAL), rgb(GOLD), t*2) if t < 0.5 else lerp(rgb(GOLD), rgb(RED), (t-0.5)*2)

        if hb > 4:
            rrect(d, (int(x0), int(yt), int(x0+bwb), by2), 4, col)
        vlbl = f"{am:.0f}M" if am >= 1 else ("~0" if am < 0.5 else f"{am:.1f}M")
        d.text((int(x0+bwb/2), int(yt-3)), vlbl, font=F_BSM, fill=col, anchor="mb")
        d.text((int(x0+bwb/2), by2+4), str(gc), font=F_AX, fill=rgb(MUTED), anchor="mt")

    d.text(((bx1+bx2)//2, by2+19), "Number of Gateway Validators", font=F_BAX, fill=rgb(TEAL), anchor="mt")

    y += CH2 + 12

    # ════════════ KEY DETAILS ════════════
    rrect(d, (40, y, WIDTH-40, y+105), 12, rgb(CARD))
    d.text((60, y+10), "KEY DETAILS", font=F_SEC, fill=rgb(WHITE))
    details = [
        ("30% immediate  /  70% vests linearly over 90 days", TEAL),
        ("1-day minimum stake duration (anti-flash-stake protection)", WHITE),
        ("Emergency withdrawal: 0.5% fee, forfeits unvested rewards", MUTED),
        ("Block reward reduces 1% per year \u2014 overflow shrinks proportionally", MUTED),
    ]
    dy = y + 38
    for txt, c in details:
        d.text((80, dy), "\u2022", font=F_BODY, fill=rgb(GOLD))
        d.text((100, dy), txt, font=F_SM, fill=rgb(c))
        dy += 18
    y += 118

    # ════════════ FOOTER ════════════
    d.text((WIDTH//2, y),
           "OmniBazaar  \u2502  Chain 88008  \u2502  LiquidityOverflowPool + OmniValidatorRewards V3",
           font=F_SM, fill=rgb(MUTED), anchor="mt")

    img.save(OUTPUT, "PNG", quality=95)
    print(f"Saved: {OUTPUT} ({WIDTH}x{HEIGHT})")


if __name__ == "__main__":
    create()
