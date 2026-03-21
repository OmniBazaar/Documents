#!/usr/bin/env python3
"""
OmniBazaar LP Rewards Infographic Generator

Shows how LP APR decreases as total LP investment grows (hyperbolic curve)
and how total annual LP rewards decrease as the validator network grows.
All amounts displayed in USD at $0.004/XOM.

On-chain sources:
  OmniValidatorRewards.sol  — INITIAL_BLOCK_REWARD=15.602, gatewayRewardCap=0.3, serviceNodeRewardCap=0.2
  LiquidityOverflowPool.sol — 30% immediate, 70% vests 90 days, 1-day min stake

APR formula (industry-standard MasterChef model):
  APR = (annualOverflowRewards / totalLPStaked) x 100
  - No auto-compounding (APR, not APY)
  - Price-independent (XOM/XOM ratio cancels out USD conversion)
  - 30% of rewards are immediately claimable, 70% vest linearly over 90 days
  - For stakers holding >90 days, the full APR is realized
"""

from PIL import Image, ImageDraw, ImageFont
import math

# ── Layout ─────────────────────────────────────────────────────
WIDTH = 1200
HEIGHT = 1440
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

# USD conversion
XOM_PRICE = 0.004              # $0.004 per XOM
ANNUAL_OVERFLOW_USD = ANNUAL_OVERFLOW * XOM_PRICE       # ~$890K


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

def fmt_usd(v):
    """Format USD value for axis labels."""
    if v >= 1e6:
        return f"${v/1e6:.0f}M" if v >= 10e6 else f"${v/1e6:.1f}M"
    if v >= 1e3:
        return f"${v/1e3:.0f}K"
    return f"${v:.0f}"


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
    F_BIG     = ft("DejaVuSans-Bold.ttf", 42)
    F_BIGSUB  = ft("DejaVuSans-Bold.ttf", 26)

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
    rrect(d, (40, y, WIDTH-40, y+90), 12, rgb(DARK_GOLD))
    rrect(d, (43, y+3, WIDTH-43, y+87), 10, rgb("#151005"))
    usd_k = ANNUAL_OVERFLOW_USD / 1e3
    om = ANNUAL_OVERFLOW / 1e6
    d.text((WIDTH//2, y+6), f"${usd_k:.0f}K / YEAR", font=F_BIG, fill=rgb(GOLD), anchor="mt")
    d.text((WIDTH//2, y+50), f"{om:.1f}M XOM at ${XOM_PRICE}/XOM",
           font=F_BBODY, fill=rgb(MUTED), anchor="mt")
    d.text((WIDTH//2, y+72),
           f"Available to LP stakers now  \u2014  {NUM_GW} gateways, 0 service nodes",
           font=F_SM, fill=rgb(MUTED), anchor="mt")
    y += 107

    # ════════════ CHART 1: APR vs LP Investment (USD) ════════════
    CH1 = 480
    rrect(d, (40, y, WIDTH-40, y+CH1), 12, rgb(CARD))
    d.text((WIDTH//2, y+10), "APR vs. TOTAL LP INVESTMENT", font=F_SEC, fill=rgb(WHITE), anchor="mt")
    d.text((WIDTH//2, y+36),
           f"APR = annual overflow \u00f7 total LP staked  "
           f"(${usd_k:.0f}K/yr at current network size)",
           font=F_SM, fill=rgb(MUTED), anchor="mt")

    # Chart area
    cx1, cy1, cx2, cy2 = 120, y+58, WIDTH-55, y+CH1-32
    cw, ch = cx2-cx1, cy2-cy1

    # X-axis: $50K to $40M (log scale, in USD)
    xlo, xhi = math.log10(50e3), math.log10(40e6)
    ylo, yhi = 0, 2000  # APR %

    def px(v): return cx1 + (math.log10(v) - xlo) / (xhi - xlo) * cw
    def py(a): return cy2 - (min(a, yhi) - ylo) / (yhi - ylo) * ch

    # Horizontal grid
    for a in [0, 100, 250, 500, 1000, 1500, 2000]:
        yy = py(a)
        d.line([(cx1, yy), (cx2, yy)], fill=rgb(GRID), width=1)
        if a > 0:
            d.text((cx1-6, yy), f"{a:,}%", font=F_AX, fill=rgb(MUTED), anchor="rm")

    # Vertical grid
    xticks = [
        (50e3, "$50K"), (100e3, "$100K"), (250e3, "$250K"),
        (500e3, "$500K"), (1e6, "$1M"), (2.5e6, "$2.5M"),
        (5e6, "$5M"), (10e6, "$10M"), (20e6, "$20M"), (40e6, "$40M"),
    ]
    for val, lbl in xticks:
        xx = px(val)
        d.line([(xx, cy1), (xx, cy2)], fill=rgb(GRID), width=1)
        d.text((xx, cy2+4), lbl, font=F_AX, fill=rgb(MUTED), anchor="mt")

    d.text(((cx1+cx2)//2, cy2+19), "Total LP Investment (USD at $0.004/XOM)",
           font=F_BAX, fill=rgb(TEAL), anchor="mt")

    # Fill under curve
    fill_pts = []
    for step in range(0, 2001):
        usd = 50e3 * (40e6 / 50e3) ** (step / 2000)
        apr = min((ANNUAL_OVERFLOW_USD / usd) * 100, yhi)
        fill_pts.append((px(usd), py(apr)))
    fill_pts.append((px(40e6), py(0)))
    fill_pts.append((px(50e3), py(0)))
    d.polygon(fill_pts, fill=rgb(FILL))

    # Draw curve
    pts = []
    for step in range(0, 2001):
        usd = 50e3 * (40e6 / 50e3) ** (step / 2000)
        apr = min((ANNUAL_OVERFLOW_USD / usd) * 100, yhi)
        pts.append((px(usd), py(apr)))
    for i in range(len(pts)-1):
        d.line([pts[i], pts[i+1]], fill=rgb(TEAL), width=3)

    # Staking comparison band (5-12% APR)
    bt, bb = py(12), py(5)
    for yy in range(int(bt), int(bb)+1, 2):
        d.line([(cx1+1, yy), (cx2, yy)], fill=rgb("#1a2a20"), width=1)
    d.text((cx2-4, bt-2), "Staking APR range (5\u201312%)",
           font=F_AX, fill=rgb("#4a7a5a"), anchor="rb")

    # Key data points
    highlights = [
        (50e3,   "1,780%",  -18, 0),
        (100e3,  "890%",    -18, 0),
        (250e3,  "356%",    -18, 0),
        (500e3,  "178%",    -18, 0),
        (1e6,    "89%",     -18, 0),
        (2.5e6,  "35.6%",   -18, 0),
        (5e6,    "17.8%",   -18, 0),
        (10e6,   "8.9%",    -18, 0),
    ]
    for lp_usd, label, offy, offx in highlights:
        apr = (ANNUAL_OVERFLOW_USD / lp_usd) * 100
        xx, yy = px(lp_usd), py(apr)
        d.ellipse([xx-4, yy-4, xx+4, yy+4], fill=rgb(GOLD))
        d.text((xx+offx, yy+offy), label, font=F_BSM, fill=rgb(GOLD), anchor="mb")

    y += CH1 + 15

    # ════════════ CHART 2: Annual Overflow vs Network Size (USD) ════════════
    CH2 = 290
    rrect(d, (40, y, WIDTH-40, y+CH2), 12, rgb(CARD))
    d.text((WIDTH//2, y+10), "ANNUAL LP REWARDS vs. NETWORK SIZE",
           font=F_SEC, fill=rgb(WHITE), anchor="mt")
    d.text((WIDTH//2, y+36),
           "Each gateway added reduces LP overflow by ~$18.9K/yr  |  "
           "Each service node by ~$12.6K/yr",
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
        usd_annual = ov * EPOCHS_PER_YEAR * XOM_PRICE
        bars.append((gc, usd_annual))

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
        vlbl = f"${am/1e3:.0f}K" if am >= 1000 else f"${am:.0f}"
        d.text((int(x0+bwb/2), int(yt-3)), vlbl, font=F_BSM, fill=col, anchor="mb")
        d.text((int(x0+bwb/2), by2+4), str(gc), font=F_AX, fill=rgb(MUTED), anchor="mt")

    d.text(((bx1+bx2)//2, by2+19), "Number of Gateway Validators",
           font=F_BAX, fill=rgb(TEAL), anchor="mt")

    y += CH2 + 12

    # ════════════ KEY DETAILS ════════════
    rrect(d, (40, y, WIDTH-40, y+140), 12, rgb(CARD))
    d.text((60, y+10), "KEY DETAILS", font=F_SEC, fill=rgb(WHITE))
    details = [
        ("30% immediate  /  70% vests linearly over 90 days", TEAL),
        ("1-day minimum stake duration (anti-flash-stake protection)", WHITE),
        ("Emergency withdrawal: 0.5% fee, forfeits unvested rewards", MUTED),
        ("Block reward reduces 1% per year \u2014 overflow shrinks proportionally", MUTED),
        (f"XOM price used: ${XOM_PRICE}  \u2014  APR is price-independent (XOM in, XOM out)", MUTED),
        ("APR = annual overflow rewards \u00f7 total LP staked  (standard DeFi formula)", MUTED),
    ]
    dy = y + 38
    for txt, c in details:
        d.text((80, dy), "\u2022", font=F_BODY, fill=rgb(GOLD))
        d.text((100, dy), txt, font=F_SM, fill=rgb(c))
        dy += 18
    y += 153

    # ════════════ FOOTER ════════════
    d.text((WIDTH//2, y),
           "OmniBazaar  \u2502  Chain 88008  \u2502  LiquidityOverflowPool + OmniValidatorRewards V3",
           font=F_SM, fill=rgb(MUTED), anchor="mt")

    img.save(OUTPUT, "PNG", quality=95)
    print(f"Saved: {OUTPUT} ({WIDTH}x{HEIGHT})")


if __name__ == "__main__":
    create()
