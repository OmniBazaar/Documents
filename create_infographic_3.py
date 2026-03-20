#!/usr/bin/env python3
"""
OmniBazaar Infographic v3 — Mainnet / Pioneer Phase
Simplified, updated for mainnet deployment, gasless, LP overflow rewards.
Style matches existing OmniBazaar dark-theme infographics.
"""

from PIL import Image, ImageDraw, ImageFont

WIDTH = 1200
HEIGHT = 4200  # cropped to content
BG = "#0f1419"
PRIMARY = "#00d4aa"
BLUE = "#1da1f2"
PURPLE = "#9b59b6"
ORANGE = "#f39c12"
RED = "#e74c3c"
GREEN = "#2ecc71"
GOLD = "#ffd700"
WHITE = "#ffffff"
MUTED = "#8899a6"
DIM = "#6b7a99"
CARD = "#192734"
CARD_HI = "#1e3044"
ACCENT_BORDER = "#0d3d56"

OUTPUT = "/home/omnirick/OmniBazaar/OmniBazaar_Infographic_3.png"
GLOBE = "/home/omnirick/OmniBazaar/UI Mockup/OmniBazaar Globe-clear-256x256.png"


def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rrect(draw, coords, r, fill, outline=None, width=0):
    x1, y1, x2, y2 = coords
    r = min(r, (x2 - x1) // 2, (y2 - y1) // 2)
    draw.rectangle([x1 + r, y1, x2 - r, y2], fill=fill, outline=outline,
                    width=width)
    draw.rectangle([x1, y1 + r, x2, y2 - r], fill=fill, outline=outline,
                    width=width)
    draw.ellipse([x1, y1, x1 + 2 * r, y1 + 2 * r], fill=fill)
    draw.ellipse([x2 - 2 * r, y1, x2, y1 + 2 * r], fill=fill)
    draw.ellipse([x1, y2 - 2 * r, x1 + 2 * r, y2], fill=fill)
    draw.ellipse([x2 - 2 * r, y2 - 2 * r, x2, y2], fill=fill)


def hr(draw, y, m=60):
    draw.rectangle((m, y, WIDTH - m, y + 1), fill=rgb(ACCENT_BORDER))


def sect_title(draw, y, text, font):
    draw.text((WIDTH // 2, y), text, font=font, fill=rgb(WHITE), anchor="mm")
    return y + 36


def sect_sub(draw, y, text, font):
    draw.text((WIDTH // 2, y), text, font=font, fill=rgb(MUTED), anchor="mm")
    return y + 28


def draw_gradient_bar(draw, x, y, w, h, segments, font):
    """Horizontal stacked percentage bar."""
    total = sum(s[0] for s in segments)
    cx = x
    for pct, label, color in segments:
        sw = max(int(w * pct / total), 1)
        if cx + sw > x + w:
            sw = x + w - cx
        rrect(draw, (cx, y, cx + sw, y + h), 4, rgb(color))
        text = f"{pct}% {label}"
        bb = draw.textbbox((0, 0), text, font=font)
        tw = bb[2] - bb[0]
        if sw > tw + 6:
            draw.text((cx + sw // 2, y + h // 2), text, font=font,
                      fill=rgb(BG), anchor="mm")
        elif sw > 28:
            draw.text((cx + sw // 2, y + h // 2), f"{pct}%", font=font,
                      fill=rgb(BG), anchor="mm")
        cx += sw


def create():
    img = Image.new('RGB', (WIDTH, HEIGHT), rgb(BG))
    draw = ImageDraw.Draw(img)

    B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    R = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    f_hero = ImageFont.truetype(B, 52)
    f_title = ImageFont.truetype(B, 44)
    f_sect = ImageFont.truetype(B, 28)
    f_lg = ImageFont.truetype(B, 24)
    f_mb = ImageFont.truetype(B, 20)
    f_m = ImageFont.truetype(R, 20)
    f_sb = ImageFont.truetype(B, 16)
    f_s = ImageFont.truetype(R, 16)
    f_tb = ImageFont.truetype(B, 14)
    f_t = ImageFont.truetype(R, 14)
    f_bar = ImageFont.truetype(B, 12)
    f_big_num = ImageFont.truetype(B, 30)

    y = 20

    # ═══════════════════════════════════════════════════════════
    # HEADER: Logo + Title
    # ═══════════════════════════════════════════════════════════
    try:
        globe = Image.open(GLOBE).convert('RGBA')
        globe = globe.resize((80, 80), Image.Resampling.LANCZOS)
        bb = draw.textbbox((0, 0), "OmniBazaar", font=f_hero)
        bw = bb[2] - bb[0]
        tw = 80 + 14 + bw
        gx = (WIDTH - tw) // 2
        img.paste(globe, (gx, y), globe)
        draw.text((gx + 94, y + 12), "OmniBazaar", font=f_hero,
                  fill=rgb(WHITE))
    except Exception:
        draw.text((WIDTH // 2, y + 36), "OmniBazaar", font=f_hero,
                  fill=rgb(PRIMARY), anchor="mm")
    y += 92

    draw.text((WIDTH // 2, y), "PLATFORM OVERVIEW", font=f_title,
              fill=rgb(WHITE), anchor="mm")
    y += 38
    draw.text((WIDTH // 2, y),
              "Live on Mainnet  |  Pioneer Phase  |  Gasless Transactions",
              font=f_s, fill=rgb(PRIMARY), anchor="mm")
    y += 22
    draw.text((WIDTH // 2, y),
              "One App. Every Market. Zero Middlemen.",
              font=f_s, fill=rgb(MUTED), anchor="mm")
    y += 38

    # ═══════════════════════════════════════════════════════════
    # KEY STATS BAR
    # ═══════════════════════════════════════════════════════════
    rrect(draw, (30, y, WIDTH - 30, y + 68), 12, rgb(CARD))
    stats = [
        ("128", "Blockchains"), ("10,000+", "Orders/Sec"),
        ("ZERO", "Gas Fees"), ("2,100+", "RWA Tokens"),
        ("600K+", "Predictions"), ("1-2s", "Finality"),
    ]
    sw = (WIDTH - 60) // len(stats)
    for i, (v, l) in enumerate(stats):
        cx = 30 + sw * i + sw // 2
        c = GREEN if v == "ZERO" else PRIMARY
        draw.text((cx, y + 22), v, font=f_mb, fill=rgb(c), anchor="mm")
        draw.text((cx, y + 46), l, font=f_t, fill=rgb(DIM), anchor="mm")
    y += 82

    # ═══════════════════════════════════════════════════════════
    # SIX WORLD-CLASS MARKETS
    # ═══════════════════════════════════════════════════════════
    hr(draw, y)
    y += 22
    y = sect_title(draw, y, "SIX WORLD-CLASS MARKETS", f_sect)

    markets = [
        ("GOODS &\nSERVICES", PRIMARY,
         ["P2P marketplace", "Escrow protection",
          "Zero gas fees", "SEO listings"],
         "$3.5T sector"),
        ("DEX", BLUE,
         ["10K+ orders/sec", "MEV protection",
          "Spot & perpetuals", "Privacy swaps"],
         "$1.5T sector"),
        ("RWA", PURPLE,
         ["2,100+ tokens", "Stocks & bonds",
          "Real estate", "Treasury bills"],
         "$16T by 2030"),
        ("YIELD", ORANGE,
         ["38 protocols", "APY comparison",
          "Risk scoring", "5 ecosystems"],
         "$100B+ TVL"),
        ("NFTs", RED,
         ["Multi-chain", "Gallery view",
          "List for sale", "Send & receive"],
         "$24B sector"),
        ("PREDICTIONS", GREEN,
         ["600K+ markets", "Polymarket feed",
          "Cross-chain", "Any-token bets"],
         "$28B sector"),
    ]
    cw = (WIDTH - 60 - 5 * 10) // 6
    ch = 175
    for i, (title, color, bullets, volume) in enumerate(markets):
        cx = 30 + i * (cw + 10)
        rrect(draw, (cx, y, cx + cw, y + ch), 10, rgb(CARD))
        rrect(draw, (cx, y, cx + cw, y + 4), 3, rgb(color))
        lines = title.split('\n')
        ty = y + 18
        for ln in lines:
            draw.text((cx + cw // 2, ty), ln, font=f_sb,
                      fill=rgb(color), anchor="mm")
            ty += 18
        ty += 6
        for b in bullets:
            draw.text((cx + cw // 2, ty), b, font=f_t,
                      fill=rgb(WHITE), anchor="mm")
            ty += 17
        draw.text((cx + cw // 2, y + ch - 14), volume, font=f_tb,
                  fill=rgb(color), anchor="mm")
    y += ch + 18

    # ═══════════════════════════════════════════════════════════
    # WHY OMNIBAZAAR IS DIFFERENT
    # ═══════════════════════════════════════════════════════════
    hr(draw, y)
    y += 22
    y = sect_title(draw, y, "WHY OMNIBAZAAR IS DIFFERENT", f_sect)

    dw = (WIDTH - 80 - 30) // 4
    dh = 155
    diffs = [
        ("DECENTRALIZED", PRIMARY,
         ["No central servers",
          "Users hold their keys",
          "Permissionless nodes",
          "Self-sovereign data"]),
        ("PRIVACY (COTI V2)", PURPLE,
         ["pXOM privacy token",
          "MPC garbled circuits",
          "Shielded transactions",
          "Optional by user"]),
        ("PROOF OF\nPARTICIPATION", BLUE,
         ["100-point scoring",
          "KYC + reputation",
          "Stake + activity",
          "50 pts to validate"]),
        ("GASLESS\nTRANSACTIONS", GREEN,
         ["Users pay ZERO gas",
          "Validators absorb cost",
          "ERC-2771 meta-tx",
          "OmniForwarder relay"]),
    ]
    for i, (title, color, bullets) in enumerate(diffs):
        cx = 40 + i * (dw + 10)
        rrect(draw, (cx, y, cx + dw, y + dh), 10, rgb(CARD))
        rrect(draw, (cx, y, cx + dw, y + 4), 3, rgb(color))
        lines = title.split('\n')
        ty = y + 18
        for ln in lines:
            draw.text((cx + dw // 2, ty), ln, font=f_sb,
                      fill=rgb(color), anchor="mm")
            ty += 18
        ty += 6
        for b in bullets:
            draw.text((cx + dw // 2, ty), b, font=f_t,
                      fill=rgb(WHITE), anchor="mm")
            ty += 18
    y += dh + 18

    # ═══════════════════════════════════════════════════════════
    # TRUSTLESS HYBRID ARCHITECTURE (compact)
    # ═══════════════════════════════════════════════════════════
    hr(draw, y)
    y += 22
    y = sect_title(draw, y, "TRUSTLESS HYBRID ARCHITECTURE", f_sect)
    y = sect_sub(draw, y,
                 "Trustless settlement + zero gas fees + massive "
                 "scalability + easy upgrades", f_t)

    hw = (WIDTH - 90) // 2
    bh = 190
    # On-chain
    lx = 30
    rrect(draw, (lx, y, lx + hw, y + bh), 10, rgb(CARD))
    rrect(draw, (lx, y, lx + hw, y + 4), 3, rgb(PRIMARY))
    draw.text((lx + hw // 2, y + 20), "ON-CHAIN (Trustless)", font=f_mb,
              fill=rgb(PRIMARY), anchor="mm")
    items_on = [
        "DEX settlement (dual EIP-712)",
        "RWA AMM + compliance oracle",
        "Escrow (2-of-3 multisig)",
        "Multi-hop swap router",
        "MEV commit-reveal protection",
        "53 deployed contracts",
    ]
    ty = y + 42
    for it in items_on:
        draw.text((lx + 16, ty), f"\u2713 {it}", font=f_t, fill=rgb(WHITE))
        ty += 22

    rx = lx + hw + 30
    rrect(draw, (rx, y, rx + hw, y + bh), 10, rgb(CARD))
    rrect(draw, (rx, y, rx + hw, y + 4), 3, rgb(BLUE))
    draw.text((rx + hw // 2, y + 20), "OFF-CHAIN (Validators)", font=f_mb,
              fill=rgb(BLUE), anchor="mm")
    items_off = [
        "Order matching (10K+ orders/sec)",
        "Marketplace listings on IPFS",
        "Price discovery & routing",
        "P2P encrypted chat relay",
        "KYC processing & scoring",
        "5 validators on Avalanche L1",
    ]
    ty = y + 42
    for it in items_off:
        draw.text((rx + 16, ty), f"\u2713 {it}", font=f_t, fill=rgb(WHITE))
        ty += 22
    y += bh + 18

    # ═══════════════════════════════════════════════════════════
    # OMNIWALLET (compact)
    # ═══════════════════════════════════════════════════════════
    hr(draw, y)
    y += 22
    y = sect_title(draw, y, "OMNIWALLET: 128 CHAINS, ONE WALLET", f_sect)

    ww = (WIDTH - 80 - 30) // 4
    wh = 115
    wallet_items = [
        ("Multi-Chain", BLUE,
         ["ETH, BTC, SOL, DOT", "AVAX, 20+ EVM nets",
          "Hardware wallets"]),
        ("Easy Onboarding", ORANGE,
         ["Email/password signup", "Embedded wallet",
          "5,000 XOM bonus"]),
        ("Security", PRIMARY,
         ["BIP39 HD wallet", "Biometric auth",
          "Secure memory wipe"]),
        ("Accessibility", PURPLE,
         ["12+ languages", "ARIA compliant",
          "Dark/light mode"]),
    ]
    for i, (title, color, bullets) in enumerate(wallet_items):
        cx = 40 + i * (ww + 10)
        rrect(draw, (cx, y, cx + ww, y + wh), 10, rgb(CARD))
        rrect(draw, (cx, y, cx + ww, y + 4), 3, rgb(color))
        draw.text((cx + ww // 2, y + 20), title, font=f_sb,
                  fill=rgb(color), anchor="mm")
        ty = y + 40
        for b in bullets:
            draw.text((cx + ww // 2, ty), b, font=f_t,
                      fill=rgb(WHITE), anchor="mm")
            ty += 17
    y += wh + 18

    # ═══════════════════════════════════════════════════════════
    # EARNING OPPORTUNITIES
    # ═══════════════════════════════════════════════════════════
    hr(draw, y)
    y += 22
    y = sect_title(draw, y, "EARNING OPPORTUNITIES", f_sect)
    y = sect_sub(draw, y,
                 "Multiple revenue streams from day one + "
                 "early LP incentives via validator overflow", f_t)

    # ── LP Overflow Rewards (NEW — the big feature) ──────────
    rrect(draw, (30, y, WIDTH - 30, y + 148), 12, rgb(CARD_HI))
    rrect(draw, (30, y, WIDTH - 30, y + 5), 4, rgb(GOLD))
    draw.text((WIDTH // 2, y + 26),
              "EARLY LP REWARDS  \u2014  Validator Overflow System",
              font=f_lg, fill=rgb(GOLD), anchor="mm")
    draw.text((WIDTH // 2, y + 50),
              "Excess validator block rewards automatically flow to "
              "liquidity providers",
              font=f_t, fill=rgb(MUTED), anchor="mm")

    # Three key points
    ow = (WIDTH - 100) // 3
    pts = [
        ("AUTOMATIC", PRIMARY,
         "Validators capped at 0.3\nXOM/epoch \u2014 excess\nflows to LP pools"),
        ("EARLY = MORE", GOLD,
         "Fewer LPs sharing overflow\nmeans higher per-LP yield.\nFirst movers earn most."),
        ("ANTI-MERCENARY", BLUE,
         "30% immediate payout,\n70% vests over 90 days.\n1-day minimum stake."),
    ]
    for i, (label, color, desc) in enumerate(pts):
        px = 50 + i * ow
        draw.text((px + ow // 2, y + 76), label, font=f_sb,
                  fill=rgb(color), anchor="mm")
        ty = y + 94
        for ln in desc.split('\n'):
            draw.text((px + ow // 2, ty), ln, font=f_t,
                      fill=rgb(WHITE), anchor="mm")
            ty += 16
    y += 162

    # ── Staking Rewards (compact table) ──────────────────────
    draw.text((WIDTH // 2, y), "STAKING REWARDS  \u2014  5-12% APR",
              font=f_mb, fill=rgb(ORANGE), anchor="mm")
    y += 28

    rrect(draw, (50, y, WIDTH - 50, y + 28), 5, rgb(CARD_HI))
    cols = [140, 360, 540, 720, 900, 1060]
    hdrs = ["Tier", "Stake", "Base", "+Lock", "Max", "PoP Pts"]
    for i, h in enumerate(hdrs):
        draw.text((cols[i], y + 14), h, font=f_sb, fill=rgb(DIM),
                  anchor="mm")
    y += 32

    staking_rows = [
        ("1", "1-999K", "5%", "+0-3%", "8%", "3-12"),
        ("2", "1M-9.99M", "6%", "+0-3%", "9%", "6-15"),
        ("3", "10M-99.9M", "7%", "+0-3%", "10%", "9-18"),
        ("4", "100M-999M", "8%", "+0-3%", "11%", "12-21"),
        ("5", "1B+", "9%", "+0-3%", "12%", "15-24"),
    ]
    for row in staking_rows:
        for i, v in enumerate(row):
            c = PRIMARY if i == 4 else WHITE
            draw.text((cols[i], y + 10), v, font=f_s, fill=rgb(c),
                      anchor="mm")
        y += 22
    y += 4
    draw.text((WIDTH // 2, y),
              "Lock bonuses: None +0%  |  1mo +1%  |  6mo +2%  |  2yr +3%",
              font=f_t, fill=rgb(DIM), anchor="mm")
    y += 26

    # ── Revenue Streams (compact grid) ───────────────────────
    draw.text((WIDTH // 2, y), "ADDITIONAL REVENUE STREAMS",
              font=f_mb, fill=rgb(WHITE), anchor="mm")
    y += 26

    ew = (WIDTH - 60 - 4 * 10) // 5
    eh = 90
    earn_cards = [
        ("REFERRALS", GREEN,
         "70% of 0.25%\non every sale"),
        ("LISTING NODE", PRIMARY,
         "70% of 0.25%\nfee per sale"),
        ("VALIDATOR", BLUE,
         "15.6 XOM/block\n+ service fees"),
        ("ARBITRATION", PURPLE,
         "70% of 5%\ndispute fee"),
        ("WELCOME", GOLD,
         "Up to 10,000\nXOM per user"),
    ]
    for i, (title, color, desc) in enumerate(earn_cards):
        cx = 30 + i * (ew + 10)
        rrect(draw, (cx, y, cx + ew, y + eh), 8, rgb(CARD))
        rrect(draw, (cx, y, cx + ew, y + 4), 3, rgb(color))
        draw.text((cx + ew // 2, y + 20), title, font=f_sb,
                  fill=rgb(color), anchor="mm")
        ty = y + 40
        for ln in desc.split('\n'):
            draw.text((cx + ew // 2, ty), ln, font=f_t,
                      fill=rgb(WHITE), anchor="mm")
            ty += 16
    y += eh + 20

    # ═══════════════════════════════════════════════════════════
    # PLATFORM-WIDE EXCELLENCE (merged with Coming Soon)
    # ═══════════════════════════════════════════════════════════
    hr(draw, y)
    y += 22
    y = sect_title(draw, y, "PLATFORM-WIDE EXCELLENCE", f_sect)

    pw = (WIDTH - 60 - 4 * 10) // 5
    ph = 90
    platform_items = [
        ("12+ LANGUAGES", PRIMARY,
         "Full i18n\nARIA compliant"),
        ("PORTFOLIO\nTRACKING", ORANGE,
         "Real-time P&L\nacross markets"),
        ("KYC TIERS", BLUE,
         "Progressive unlock\n4-tier system"),
        ("BROWSER\nEXTENSION", PURPLE,
         "Chrome/Firefox\nDApp connect"),
        ("MOBILE APP", GREEN,
         "iOS & Android\nBiometric auth"),
    ]
    for i, (title, color, desc) in enumerate(platform_items):
        cx = 30 + i * (pw + 10)
        rrect(draw, (cx, y, cx + pw, y + ph), 8, rgb(CARD))
        rrect(draw, (cx, y, cx + pw, y + 4), 3, rgb(color))
        lines = title.split('\n')
        ty = y + 18
        for ln in lines:
            draw.text((cx + pw // 2, ty), ln, font=f_sb,
                      fill=rgb(color), anchor="mm")
            ty += 16
        ty += 4
        for ln in desc.split('\n'):
            draw.text((cx + pw // 2, ty), ln, font=f_t,
                      fill=rgb(WHITE), anchor="mm")
            ty += 16
    y += ph + 18

    # ═══════════════════════════════════════════════════════════
    # TOKENOMICS SNAPSHOT (compact)
    # ═══════════════════════════════════════════════════════════
    hr(draw, y)
    y += 22
    y = sect_title(draw, y, "TOKENOMICS", f_sect)

    rrect(draw, (50, y, WIDTH - 50, y + 110), 12, rgb(CARD))
    tok_l = [
        ("Token:", "XOM (public) / pXOM (private)"),
        ("Total Supply:", "16.6 Billion XOM"),
        ("Blockchain:", "Avalanche L1 (Chain 88008)"),
    ]
    tok_r = [
        ("Consensus:", "Snowman (1-2s finality)"),
        ("Contracts:", "53 deployed on mainnet"),
        ("Gas Model:", "Gasless (ERC-2771 meta-tx)"),
    ]
    ty = y + 16
    for lab, val in tok_l:
        draw.text((80, ty), lab, font=f_sb, fill=rgb(DIM))
        draw.text((260, ty), val, font=f_s, fill=rgb(WHITE))
        ty += 28
    ty = y + 16
    for lab, val in tok_r:
        draw.text((620, ty), lab, font=f_sb, fill=rgb(DIM))
        draw.text((800, ty), val, font=f_s, fill=rgb(WHITE))
        ty += 28
    y += 124

    # ═══════════════════════════════════════════════════════════
    # CTA + FOOTER
    # ═══════════════════════════════════════════════════════════
    rrect(draw, (180, y, WIDTH - 180, y + 46), 23, rgb(PRIMARY))
    draw.text((WIDTH // 2, y + 23),
              "OMNIBAZAAR: THERE'S A MARKET FOR EVERYTHING",
              font=f_mb, fill=rgb(BG), anchor="mm")
    y += 60

    draw.text((WIDTH // 2, y),
              "omnibazaar.com  |  whitepaper.omnibazaar.com  |  "
              "tinyurl.com/obdeck1",
              font=f_t, fill=rgb(DIM), anchor="mm")
    y += 22
    draw.text((WIDTH // 2, y),
              "Not financial advice. Crypto investments carry "
              "significant risk.",
              font=f_t, fill=rgb(DIM), anchor="mm")
    y += 28

    # ── CROP & SAVE ──────────────────────────────────────────
    final_h = y + 8
    if final_h < HEIGHT:
        img = img.crop((0, 0, WIDTH, final_h))
    img.save(OUTPUT, "PNG", quality=95)
    print(f"Saved: {OUTPUT}")
    print(f"Size: {WIDTH} x {final_h}")


if __name__ == "__main__":
    create()
