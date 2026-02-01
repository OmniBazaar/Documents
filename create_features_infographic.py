#!/usr/bin/env python3
"""
OmniBazaar Platform Features Infographic Generator
Creates a single-page PNG infographic summarizing OmniBazaar features and benefits.
Style matches OmniBazaar_Yield_Infographic.png
"""

from PIL import Image, ImageDraw, ImageFont
import os

# Configuration
WIDTH = 1200
HEIGHT = 3200  # will be cropped to content
BACKGROUND_COLOR = "#0f1419"
PRIMARY_COLOR = "#00d4aa"
SECONDARY_COLOR = "#1da1f2"
ACCENT_PURPLE = "#9b59b6"
ACCENT_ORANGE = "#f39c12"
TEXT_COLOR = "#ffffff"
MUTED_COLOR = "#8899a6"
CARD_COLOR = "#192734"
CARD_HIGHLIGHT = "#1e3044"

OUTPUT_PATH = "/home/rickc/OmniBazaar/OmniBazaar_Infographic.png"
GLOBE_PATH = "/home/rickc/OmniBazaar/UI Mockup/OmniBazaar Globe-clear-256x256.png"


def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i + 2], 16) for i in (0, 2, 4))


def draw_rounded_rect(draw, coords, radius, fill):
    x1, y1, x2, y2 = coords
    r = min(radius, (x2 - x1) // 2, (y2 - y1) // 2)
    draw.rectangle([x1 + r, y1, x2 - r, y2], fill=fill)
    draw.rectangle([x1, y1 + r, x2, y2 - r], fill=fill)
    draw.ellipse([x1, y1, x1 + 2 * r, y1 + 2 * r], fill=fill)
    draw.ellipse([x2 - 2 * r, y1, x2, y1 + 2 * r], fill=fill)
    draw.ellipse([x1, y2 - 2 * r, x1 + 2 * r, y2], fill=fill)
    draw.ellipse([x2 - 2 * r, y2 - 2 * r, x2, y2], fill=fill)


def draw_gradient_rect(img, coords, color_top, color_bot, radius=0):
    """Draw a rectangle with a vertical gradient fill."""
    x1, y1, x2, y2 = coords
    ct = hex_to_rgb(color_top)
    cb = hex_to_rgb(color_bot)
    h = y2 - y1
    overlay = Image.new('RGBA', (x2 - x1, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for row in range(h):
        t = row / max(h - 1, 1)
        r = int(ct[0] + (cb[0] - ct[0]) * t)
        g = int(ct[1] + (cb[1] - ct[1]) * t)
        b = int(ct[2] + (cb[2] - ct[2]) * t)
        od.line([(0, row), (x2 - x1, row)], fill=(r, g, b, 255))
    if radius > 0:
        mask = Image.new('L', overlay.size, 0)
        md = ImageDraw.Draw(mask)
        draw_rounded_rect(md, (0, 0, overlay.width, overlay.height),
                          radius, 255)
        overlay.putalpha(mask)
    img.paste(overlay, (x1, y1), overlay)


def draw_hr(draw, y, margin=80):
    draw.rectangle((margin, y, WIDTH - margin, y + 1),
                   fill=hex_to_rgb(MUTED_COLOR))


def create_infographic():
    img = Image.new('RGB', (WIDTH, HEIGHT), hex_to_rgb(BACKGROUND_COLOR))
    draw = ImageDraw.Draw(img)

    # Fonts
    try:
        B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        R = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
        f_title = ImageFont.truetype(B, 52)
        f_brand = ImageFont.truetype(B, 56)
        f_sect = ImageFont.truetype(B, 36)
        f_lg = ImageFont.truetype(B, 30)
        f_mb = ImageFont.truetype(B, 24)
        f_m = ImageFont.truetype(R, 24)
        f_n = ImageFont.truetype(R, 20)
        f_sb = ImageFont.truetype(B, 18)
        f_s = ImageFont.truetype(R, 18)
        f_tb = ImageFont.truetype(B, 15)
        f_t = ImageFont.truetype(R, 15)
        f_apy = ImageFont.truetype(B, 40)
    except Exception:
        f_title = f_brand = f_sect = f_lg = f_mb = f_m = ImageFont.load_default()
        f_n = f_sb = f_s = f_tb = f_t = f_apy = f_title

    y = 20

    # ── LOGO: Globe + "OmniBazaar" ────────────────────────────
    try:
        globe = Image.open(GLOBE_PATH).convert('RGBA')
        globe = globe.resize((90, 90), Image.Resampling.LANCZOS)
        # Composite globe + text: center them together
        brand_bbox = draw.textbbox((0, 0), "OmniBazaar", font=f_brand)
        brand_w = brand_bbox[2] - brand_bbox[0]
        total_w = 90 + 16 + brand_w
        gx = (WIDTH - total_w) // 2
        img.paste(globe, (gx, y), globe)
        draw.text((gx + 106, y + 18), "OmniBazaar", font=f_brand,
                  fill=hex_to_rgb(TEXT_COLOR))
    except Exception:
        draw.text((WIDTH // 2, y + 40), "OmniBazaar", font=f_brand,
                  fill=hex_to_rgb(PRIMARY_COLOR), anchor="mm")
    y += 120

    # ── TITLE ─────────────────────────────────────────────────
    draw.text((WIDTH // 2, y), "PLATFORM OVERVIEW", font=f_title,
              fill=hex_to_rgb(TEXT_COLOR), anchor="mm")
    y += 48
    draw.text((WIDTH // 2, y),
              "One App. Every Market. Zero Middlemen.",
              font=f_n, fill=hex_to_rgb(MUTED_COLOR), anchor="mm")
    y += 42

    # ── KEY STATS BAR ─────────────────────────────────────────
    draw_rounded_rect(draw, (40, y, WIDTH - 40, y + 78), 12,
                      hex_to_rgb(CARD_COLOR))
    stats = [("70+", "Blockchains"), ("10,000+", "Orders/Sec"),
             ("1-2s", "Finality"), ("ZERO", "Gas Fees"),
             ("12+", "Languages")]
    sw = (WIDTH - 80) // len(stats)
    for i, (val, lab) in enumerate(stats):
        cx = 40 + sw * i + sw // 2
        draw.text((cx, y + 25), val, font=f_mb,
                  fill=hex_to_rgb(PRIMARY_COLOR), anchor="mm")
        draw.text((cx, y + 54), lab, font=f_t,
                  fill=hex_to_rgb(MUTED_COLOR), anchor="mm")
    y += 96 + 14

    # ── SIX INTEGRATED MARKETS ────────────────────────────────
    draw.text((WIDTH // 2, y), "SIX INTEGRATED MARKETS", font=f_sect,
              fill=hex_to_rgb(TEXT_COLOR), anchor="mm")
    y += 44

    markets = [
        ("GOODS &\nSERVICES", "Zero fees\nP2P escrow\nSeller ratings",
         "$3.5T+ sector", PRIMARY_COLOR),
        ("DEX", "10K+ orders/sec\nMEV protection\nSpot & perpetuals",
         "$1.5T+ sector", SECONDARY_COLOR),
        ("RWA", "Stocks & bonds\nReal estate\nTreasuries",
         "$16T by 2030", ACCENT_PURPLE),
        ("YIELD", "Staking & LP\nAPY comparison\nRisk scoring",
         "$100B+ TVL", ACCENT_ORANGE),
        ("NFTs", "Multi-chain\nSend & receive\nList for sale",
         "$24B+ sector", "#e74c3c"),
        ("PREDICTIONS", "Polymarket\nOmen aggregation\nCross-chain",
         "$27.9B+ sector", "#2ecc71"),
    ]
    cw = (WIDTH - 80 - 5 * 12) // 6
    ch = 192
    for i, (title, desc, volume, color) in enumerate(markets):
        cx = 40 + i * (cw + 12)
        draw_rounded_rect(draw, (cx, y, cx + cw, y + ch), 10,
                          hex_to_rgb(CARD_COLOR))
        draw_rounded_rect(draw, (cx, y, cx + cw, y + 5), 3,
                          hex_to_rgb(color))
        lines = title.split('\n')
        ty = y + 22
        for ln in lines:
            draw.text((cx + cw // 2, ty), ln, font=f_sb,
                      fill=hex_to_rgb(color), anchor="mm")
            ty += 20
        ty += 8
        for ln in desc.split('\n'):
            draw.text((cx + cw // 2, ty), ln, font=f_t,
                      fill=hex_to_rgb(TEXT_COLOR), anchor="mm")
            ty += 19
        # Sector volume at bottom
        draw.text((cx + cw // 2, y + ch - 16), volume, font=f_tb,
                  fill=hex_to_rgb(color), anchor="mm")
    y += ch + 25

    # ── DIFFERENTIATORS ───────────────────────────────────────
    draw_hr(draw, y)
    y += 34
    draw.text((WIDTH // 2, y), "WHY OMNIBAZAAR IS DIFFERENT", font=f_sect,
              fill=hex_to_rgb(TEXT_COLOR), anchor="mm")
    y += 48

    dw = (WIDTH - 100 - 24) // 3
    dh = 215
    diffs = [
        ("DECENTRALIZED\n& SELF-SOVEREIGN", [
            "No central servers",
            "No third-party data",
            "No custodial risk",
            "Users hold their keys",
            "Permissionless validators",
        ], PRIMARY_COLOR),
        ("PRIVACY-ENABLED\n(COTI V2)", [
            "pXOM privacy token",
            "MPC garbled circuits",
            "Shielded transactions",
            "Optional \u2014 user choice",
            "0.5% conversion fee",
        ], ACCENT_PURPLE),
        ("PROOF OF\nPARTICIPATION", [
            "100-point scoring",
            "KYC + reputation",
            "Staking + activity",
            "Community policing",
            "50 pts to validate",
        ], SECONDARY_COLOR),
    ]
    for i, (title, bullets, color) in enumerate(diffs):
        cx = 50 + i * (dw + 12)
        draw_rounded_rect(draw, (cx, y, cx + dw, y + dh), 12,
                          hex_to_rgb(CARD_COLOR))
        lines = title.split('\n')
        ty = y + 22
        for ln in lines:
            draw.text((cx + dw // 2, ty), ln, font=f_sb,
                      fill=hex_to_rgb(color), anchor="mm")
            ty += 22
        ty += 10
        for b in bullets:
            draw.text((cx + 18, ty), f"\u2022 {b}", font=f_t,
                      fill=hex_to_rgb(TEXT_COLOR))
            ty += 22
    y += dh + 25

    # ── TRUSTLESS ARCHITECTURE ────────────────────────────────
    draw_hr(draw, y)
    y += 34
    draw.text((WIDTH // 2, y), "TRUSTLESS HYBRID ARCHITECTURE",
              font=f_sect, fill=hex_to_rgb(TEXT_COLOR), anchor="mm")
    y += 44

    hw = (WIDTH - 110) // 2
    bh = 260

    # On-chain
    lx = 40
    draw_rounded_rect(draw, (lx, y, lx + hw, y + bh), 12,
                      hex_to_rgb(CARD_COLOR))
    draw.text((lx + hw // 2, y + 20), "ON-CHAIN (Trustless)", font=f_mb,
              fill=hex_to_rgb(PRIMARY_COLOR), anchor="mm")
    items_on = [
        "DEX settlement \u2014 dual EIP-712 sigs",
        "Multi-hop swap router",
        "Private DEX (COTI V2 MPC)",
        "Escrow \u2014 2-of-3 multisig",
        "RWA AMM + compliance oracle",
        "MEV commit-reveal protection",
        "Circuit breaker emergency stop",
    ]
    ty = y + 48
    for it in items_on:
        draw.text((lx + 20, ty), f"\u2713 {it}", font=f_t,
                  fill=hex_to_rgb(TEXT_COLOR))
        ty += 26

    # Off-chain
    rx = lx + hw + 30
    draw_rounded_rect(draw, (rx, y, rx + hw, y + bh), 12,
                      hex_to_rgb(CARD_COLOR))
    draw.text((rx + hw // 2, y + 20), "OFF-CHAIN (Validators)", font=f_mb,
              fill=hex_to_rgb(SECONDARY_COLOR), anchor="mm")
    items_off = [
        "Order matching \u2014 10K+ orders/sec",
        "Marketplace listings on IPFS",
        "Price discovery & routing",
        "P2P encrypted chat relay",
        "KYC document processing",
        "Participation scoring",
        "Search engine & indexing",
    ]
    ty = y + 48
    for it in items_off:
        draw.text((rx + 20, ty), f"\u2713 {it}", font=f_t,
                  fill=hex_to_rgb(TEXT_COLOR))
        ty += 26
    y += bh + 25

    # ── WALLET ────────────────────────────────────────────────
    draw_hr(draw, y)
    y += 34
    draw.text((WIDTH // 2, y), "OMNIWALLET: 70+ CHAINS, ONE WALLET",
              font=f_sect, fill=hex_to_rgb(TEXT_COLOR), anchor="mm")
    y += 42

    wfs = [
        ("Multi-Chain",
         "ETH, BTC, SOL, DOT,\nAVAX, ADA, XRP, NEAR,\n20+ EVM networks",
         PRIMARY_COLOR),
        ("Hardware\nWallets",
         "Ledger & Trezor\nUSB + Bluetooth\nSecure signing",
         SECONDARY_COLOR),
        ("Easy\nOnboarding",
         "Email/password signup\nEmbedded wallet\n5,000 XOM bonus",
         ACCENT_ORANGE),
        ("Accessibility",
         "12+ languages\nARIA compliant\nDark/Light mode",
         ACCENT_PURPLE),
    ]
    wcw = (WIDTH - 80 - 36) // 4
    wch = 150
    for i, (title, desc, color) in enumerate(wfs):
        cx = 40 + i * (wcw + 12)
        draw_rounded_rect(draw, (cx, y, cx + wcw, y + wch), 10,
                          hex_to_rgb(CARD_COLOR))
        lines = title.split('\n')
        ty = y + 18
        for ln in lines:
            draw.text((cx + wcw // 2, ty), ln, font=f_sb,
                      fill=hex_to_rgb(color), anchor="mm")
            ty += 20
        ty += 6
        for ln in desc.split('\n'):
            draw.text((cx + wcw // 2, ty), ln, font=f_t,
                      fill=hex_to_rgb(TEXT_COLOR), anchor="mm")
            ty += 19
    y += wch + 8

    draw.text(
        (WIDTH // 2, y + 8),
        "BIP39 HD wallet  \u2022  Cross-chain bridge  \u2022  "
        "ENS-style usernames (alice.omnibazaar)  \u2022  "
        "NFT gallery  \u2022  Biometric auth  \u2022  Listing imports",
        font=f_t, fill=hex_to_rgb(MUTED_COLOR), anchor="mm")
    y += 35

    # ── EARNING OPPORTUNITIES ─────────────────────────────────
    draw_hr(draw, y)
    y += 34
    draw.text((WIDTH // 2, y), "EARNING OPPORTUNITIES", font=f_sect,
              fill=hex_to_rgb(TEXT_COLOR), anchor="mm")
    y += 50

    # ── Liquidity Program: 3 strategy cards (from Yield Brief) ──
    draw.text((WIDTH // 2, y),
              "LIQUIDITY PROGRAM  \u2014  45-180% Projected APY",
              font=f_mb, fill=hex_to_rgb(PRIMARY_COLOR), anchor="mm")
    y += 10
    draw.text((WIDTH // 2, y + 20),
              "2.5 Billion XOM treasury backing your returns",
              font=f_t, fill=hex_to_rgb(MUTED_COLOR), anchor="mm")
    y += 48

    liq_w = (WIDTH - 100 - 24) // 3
    liq_h = 200
    liq_cards = [
        ("LBP", "Dutch Auction", "80-150%",
         ["Price starts HIGH, falls 72hr",
          "Enter at YOUR price",
          "No front-running",
          "Fair price discovery"],
         PRIMARY_COLOR),
        ("BONDING", "Guaranteed Discount", "182-260%",
         ["5-15% discount locked in",
          "7-30 day vesting",
          "No impermanent loss",
          "Compound returns"],
         SECONDARY_COLOR),
        ("MINING", "Passive Income", "36-365%",
         ["Stake LP tokens",
          "30% immediate payout",
          "70% vests over 90 days",
          "Early = highest APY"],
         ACCENT_PURPLE),
    ]
    for i, (title, sub, apy, bullets, color) in enumerate(liq_cards):
        cx = 50 + i * (liq_w + 12)
        # Gradient-tinted card
        draw_gradient_rect(img, (cx, y, cx + liq_w, y + liq_h),
                           CARD_HIGHLIGHT, CARD_COLOR, radius=12)
        draw = ImageDraw.Draw(img)  # refresh draw after paste
        # Color accent bar at top
        draw_rounded_rect(draw, (cx, y, cx + liq_w, y + 5), 3,
                          hex_to_rgb(color))
        # Title
        draw.text((cx + liq_w // 2, y + 22), title, font=f_mb,
                  fill=hex_to_rgb(color), anchor="mm")
        draw.text((cx + liq_w // 2, y + 44), sub, font=f_t,
                  fill=hex_to_rgb(MUTED_COLOR), anchor="mm")
        # Big APY
        draw.text((cx + liq_w // 2, y + 78), apy + " APY", font=f_lg,
                  fill=hex_to_rgb(TEXT_COLOR), anchor="mm")
        # Bullets
        ty = y + 106
        for b in bullets:
            draw.text((cx + 16, ty), f"\u2022 {b}", font=f_t,
                      fill=hex_to_rgb(TEXT_COLOR))
            ty += 21
    y += liq_h + 22

    # ── Staking Rewards table ─────────────────────────────────
    draw.text((WIDTH // 2, y), "STAKING REWARDS  \u2014  5-12% APR",
              font=f_mb, fill=hex_to_rgb(ACCENT_ORANGE), anchor="mm")
    y += 32

    # Table header
    draw_rounded_rect(draw, (60, y, WIDTH - 60, y + 32), 5,
                      hex_to_rgb(CARD_HIGHLIGHT))
    hdrs = ["Stake Amount", "Base APR", "+ Duration", "Max APR"]
    col_x = [150, 430, 680, 950]
    for i, h in enumerate(hdrs):
        draw.text((col_x[i], y + 16), h, font=f_sb,
                  fill=hex_to_rgb(MUTED_COLOR), anchor="mm")
    y += 36

    rows = [
        ("1 \u2014 999K XOM", "5%", "+0-3%", "8%"),
        ("1M \u2014 9.99M XOM", "6%", "+0-3%", "9%"),
        ("10M \u2014 99.9M XOM", "7%", "+0-3%", "10%"),
        ("100M \u2014 999M XOM", "8%", "+0-3%", "11%"),
        ("1B+ XOM", "9%", "+0-3%", "12%"),
    ]
    for row in rows:
        for i, val in enumerate(row):
            color = PRIMARY_COLOR if i == 3 else TEXT_COLOR
            draw.text((col_x[i], y + 11), val, font=f_s,
                      fill=hex_to_rgb(color), anchor="mm")
        y += 25
    y += 4
    draw.text((WIDTH // 2, y),
              "Duration: No lock (+0%)  \u2022  1 month (+1%)  "
              "\u2022  6 months (+2%)  \u2022  2 years (+3%)",
              font=f_t, fill=hex_to_rgb(MUTED_COLOR), anchor="mm")
    y += 30

    # ── Additional Earnings: attractive colored cards ─────────
    draw.text((WIDTH // 2, y), "ADDITIONAL REVENUE STREAMS",
              font=f_mb, fill=hex_to_rgb(TEXT_COLOR), anchor="mm")
    y += 32

    earn_cards = [
        ("MARKETPLACE", "Sell goods and services\nwith low 1% fee",
         "\U0001f6d2", PRIMARY_COLOR),
        ("HOST LISTINGS", "70% of 0.25% on every\nsale + share block rewards",
         "\U0001f4e6", "#2ecc71"),
        ("REFERRALS", "70% of 0.25%\non every sale",
         "\U0001f91d", ACCENT_ORANGE),
        ("VALIDATORS", "15.6 XOM/block\n+ tx & service fees",
         "\u26a1", SECONDARY_COLOR),
        ("ARBITRATION", "70% of 5%\ndispute fee",
         "\u2696", ACCENT_PURPLE),
    ]
    ecw = (WIDTH - 80 - 48) // 5
    ech = 105
    for i, (title, desc, icon, color) in enumerate(earn_cards):
        cx = 40 + i * (ecw + 12)
        # Gradient card
        draw_gradient_rect(img, (cx, y, cx + ecw, y + ech),
                           color, CARD_COLOR, radius=10)
        draw = ImageDraw.Draw(img)
        # Title with icon
        draw.text((cx + ecw // 2, y + 20), title, font=f_sb,
                  fill=hex_to_rgb(TEXT_COLOR), anchor="mm")
        # Description lines
        ty = y + 42
        for ln in desc.split('\n'):
            draw.text((cx + ecw // 2, ty), ln, font=f_t,
                      fill=hex_to_rgb(TEXT_COLOR), anchor="mm")
            ty += 19
    y += ech + 25

    # ── COMING SOON ───────────────────────────────────────────
    draw_hr(draw, y)
    y += 34
    draw.text((WIDTH // 2, y), "COMING SOON", font=f_sect,
              fill=hex_to_rgb(TEXT_COLOR), anchor="mm")
    y += 44

    sw2 = (WIDTH - 100 - 24) // 3
    sh2 = 220
    coming = [
        ("PREDICTION\nMARKET", [
            "$27.9B+ sector volume",
            "Polymarket + Omen",
            "Cross-chain aggregator",
            "Trade with any token",
            "On-chain price data",
            "Position tracking",
        ], ACCENT_ORANGE),
        ("BROWSER\nEXTENSION", [
            "Wallet + DEX + Market",
            "DApp connectivity",
            "Hardware wallets",
            "Privacy swaps",
            "Chrome/Firefox/Brave",
            "Compact popup UX",
        ], SECONDARY_COLOR),
        ("MOBILE APP\n(iOS & Android)", [
            "Full feature parity",
            "Native camera & QR",
            "Biometric auth",
            "Push notifications",
            "Deep linking",
            "60% shared code",
        ], PRIMARY_COLOR),
    ]
    for i, (title, bullets, color) in enumerate(coming):
        cx = 50 + i * (sw2 + 12)
        draw_rounded_rect(draw, (cx, y, cx + sw2, y + sh2), 12,
                          hex_to_rgb(CARD_COLOR))
        lines = title.split('\n')
        ty = y + 22
        for ln in lines:
            draw.text((cx + sw2 // 2, ty), ln, font=f_sb,
                      fill=hex_to_rgb(color), anchor="mm")
            ty += 22
        ty += 8
        for b in bullets:
            draw.text((cx + 18, ty), f"\u2022 {b}", font=f_t,
                      fill=hex_to_rgb(TEXT_COLOR))
            ty += 24
    y += sh2 + 25

    # ── TOKENOMICS ────────────────────────────────────────────
    draw_hr(draw, y)
    y += 34
    draw.text((WIDTH // 2, y), "TOKENOMICS SNAPSHOT", font=f_sect,
              fill=hex_to_rgb(TEXT_COLOR), anchor="mm")
    y += 40

    draw_rounded_rect(draw, (60, y, WIDTH - 60, y + 175), 12,
                      hex_to_rgb(CARD_COLOR))
    tok_l = [
        ("Token:", "XOM (public) / pXOM (private)"),
        ("Total Supply:", "16.6 Billion XOM"),
        ("Circulating:", "~4.13 Billion XOM"),
        ("Emissions:", "~12.47B over 40 years"),
    ]
    tok_r = [
        ("Blockchain:", "Avalanche Subnet-EVM"),
        ("Consensus:", "Snowman (1-2s finality)"),
        ("Welcome Bonus:", "Up to 5,000 XOM"),
        ("Referral Bonus:", "Up to 2,500 XOM"),
    ]
    ty = y + 18
    for lab, val in tok_l:
        draw.text((90, ty), lab, font=f_sb, fill=hex_to_rgb(MUTED_COLOR))
        draw.text((280, ty), val, font=f_s, fill=hex_to_rgb(TEXT_COLOR))
        ty += 35
    ty = y + 18
    for lab, val in tok_r:
        draw.text((620, ty), lab, font=f_sb, fill=hex_to_rgb(MUTED_COLOR))
        draw.text((840, ty), val, font=f_s, fill=hex_to_rgb(TEXT_COLOR))
        ty += 35
    y += 195

    # ── CTA ───────────────────────────────────────────────────
    draw_gradient_rect(img, (200, y, WIDTH - 200, y + 55),
                       PRIMARY_COLOR, "#009977", radius=28)
    draw = ImageDraw.Draw(img)
    draw.text((WIDTH // 2, y + 27),
              "OMNIBAZAAR: THERE'S A MARKET FOR EVERYTHING", font=f_mb,
              fill=hex_to_rgb(BACKGROUND_COLOR), anchor="mm")
    y += 75

    draw.text((WIDTH // 2, y),
              "omnibazaar.com  |  whitepaper.omnibazaar.com  |  "
              "tinyurl.com/obdeck1", font=f_t,
              fill=hex_to_rgb(MUTED_COLOR), anchor="mm")
    y += 28
    draw.text((WIDTH // 2, y),
              "Not financial advice. Crypto investments carry "
              "significant risk.", font=f_t,
              fill=hex_to_rgb(MUTED_COLOR), anchor="mm")
    y += 30

    # ── CROP ──────────────────────────────────────────────────
    final_h = y + 10
    if final_h < HEIGHT:
        img = img.crop((0, 0, WIDTH, final_h))

    img.save(OUTPUT_PATH, "PNG", quality=95)
    print(f"Saved: {OUTPUT_PATH}")
    print(f"Size: {WIDTH} x {final_h}")


if __name__ == "__main__":
    create_infographic()
