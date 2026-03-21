#!/usr/bin/env python3
"""
OmniBazaar User Rewards Infographic Generator
All the ways users can earn XOM in OmniBazaar.
Style matches OmniBazaar_Infographic.png
"""

from PIL import Image, ImageDraw, ImageFont

# Configuration — matches existing infographic palette
WIDTH = 1200
HEIGHT = 3600  # will be cropped to content
BG = "#0f1419"
PRIMARY = "#00d4aa"
BLUE = "#1da1f2"
PURPLE = "#9b59b6"
ORANGE = "#f39c12"
RED = "#e74c3c"
GREEN = "#2ecc71"
WHITE = "#ffffff"
MUTED = "#8899a6"
CARD = "#192734"
CARD_HI = "#1e3044"

OUTPUT = "/home/omnirick/OmniBazaar/Documents/OmniBazaar_Rewards_Infographic.png"
GLOBE = "/home/omnirick/OmniBazaar/UI Mockup/OmniBazaar Globe-clear-256x256.png"


def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rrect(draw, coords, r, fill):
    x1, y1, x2, y2 = coords
    r = min(r, (x2 - x1) // 2, (y2 - y1) // 2)
    draw.rectangle([x1 + r, y1, x2 - r, y2], fill=fill)
    draw.rectangle([x1, y1 + r, x2, y2 - r], fill=fill)
    draw.ellipse([x1, y1, x1 + 2 * r, y1 + 2 * r], fill=fill)
    draw.ellipse([x2 - 2 * r, y1, x2, y1 + 2 * r], fill=fill)
    draw.ellipse([x1, y2 - 2 * r, x1 + 2 * r, y2], fill=fill)
    draw.ellipse([x2 - 2 * r, y2 - 2 * r, x2, y2], fill=fill)


def hr(draw, y, m=80):
    draw.rectangle((m, y, WIDTH - m, y + 1), fill=rgb(MUTED))


def create():
    img = Image.new('RGB', (WIDTH, HEIGHT), rgb(BG))
    draw = ImageDraw.Draw(img)

    B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    R = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    f_title = ImageFont.truetype(B, 48)
    f_sect = ImageFont.truetype(B, 34)
    f_lg = ImageFont.truetype(B, 28)
    f_mb = ImageFont.truetype(B, 22)
    f_m = ImageFont.truetype(R, 22)
    f_sb = ImageFont.truetype(B, 18)
    f_s = ImageFont.truetype(R, 18)
    f_tb = ImageFont.truetype(B, 15)
    f_t = ImageFont.truetype(R, 15)
    f_big = ImageFont.truetype(B, 38)

    y = 20

    # ── LOGO ─────────────────────────────────────────────────
    try:
        globe = Image.open(GLOBE).convert('RGBA')
        globe = globe.resize((80, 80), Image.Resampling.LANCZOS)
        bb = draw.textbbox((0, 0), "OmniBazaar", font=f_title)
        bw = bb[2] - bb[0]
        tw = 80 + 14 + bw
        gx = (WIDTH - tw) // 2
        img.paste(globe, (gx, y + 2), globe)
        draw.text((gx + 94, y + 14), "OmniBazaar", font=f_title,
                  fill=rgb(WHITE))
    except Exception:
        draw.text((WIDTH // 2, y + 40), "OmniBazaar", font=f_title,
                  fill=rgb(PRIMARY), anchor="mm")
    y += 100

    # ── TITLE ────────────────────────────────────────────────
    draw.text((WIDTH // 2, y), "USER REWARDS & EARNING", font=f_title,
              fill=rgb(WHITE), anchor="mm")
    y += 45
    draw.text((WIDTH // 2, y),
              "Every way to earn XOM in the OmniBazaar ecosystem",
              font=f_s, fill=rgb(MUTED), anchor="mm")
    y += 44

    # ── SUMMARY BAR ──────────────────────────────────────────
    rrect(draw, (40, y, WIDTH - 40, y + 72), 12, rgb(CARD))
    stats = [
        ("16.6B", "Total XOM Supply"),
        ("12.47B", "Emissions Budget"),
        ("5-12%", "Staking APR"),
        ("40 Years", "Reward Horizon"),
    ]
    sw = (WIDTH - 80) // len(stats)
    for i, (v, l) in enumerate(stats):
        cx = 40 + sw * i + sw // 2
        draw.text((cx, y + 22), v, font=f_mb, fill=rgb(PRIMARY), anchor="mm")
        draw.text((cx, y + 50), l, font=f_t, fill=rgb(MUTED), anchor="mm")
    y += 92

    # ════════════════════════════════════════════════════════
    # SECTION 1: STAKING REWARDS
    # ════════════════════════════════════════════════════════
    hr(draw, y)
    y += 30
    draw.text((WIDTH // 2, y), "STAKING REWARDS", font=f_sect,
              fill=rgb(WHITE), anchor="mm")
    y += 28
    draw.text((WIDTH // 2, y), "5-12% APR  |  Stake XOM, earn passive income",
              font=f_t, fill=rgb(MUTED), anchor="mm")
    y += 36

    # Staking table header
    rrect(draw, (60, y, WIDTH - 60, y + 32), 5, rgb(CARD_HI))
    cols = [150, 420, 640, 860, 1060]
    hdrs = ["Stake Amount", "Base APR", "Duration Bonus", "Max APR", "Max Pts"]
    for i, h in enumerate(hdrs):
        draw.text((cols[i], y + 16), h, font=f_sb, fill=rgb(MUTED), anchor="mm")
    y += 36

    rows = [
        ("1 - 999K XOM", "5%", "+0% to +3%", "8%", "3-12"),
        ("1M - 9.99M XOM", "6%", "+0% to +3%", "9%", "6-15"),
        ("10M - 99.9M XOM", "7%", "+0% to +3%", "10%", "9-18"),
        ("100M - 999M XOM", "8%", "+0% to +3%", "11%", "12-21"),
        ("1B+ XOM", "9%", "+0% to +3%", "12%", "15-24"),
    ]
    for row in rows:
        for i, v in enumerate(row):
            c = PRIMARY if i == 3 else WHITE
            draw.text((cols[i], y + 12), v, font=f_s, fill=rgb(c), anchor="mm")
        y += 27
    y += 6
    draw.text((WIDTH // 2, y),
              "Duration: No lock +0%  |  1 month +1%  |  6 months +2%  "
              "|  2 years +3%",
              font=f_t, fill=rgb(MUTED), anchor="mm")
    y += 20
    draw.text((WIDTH // 2, y),
              "Staked XOM is productively used for DEX liquidity provision",
              font=f_t, fill=rgb(MUTED), anchor="mm")
    y += 36

    # ════════════════════════════════════════════════════════
    # SECTION 2: BLOCK REWARDS
    # ════════════════════════════════════════════════════════
    hr(draw, y)
    y += 30
    draw.text((WIDTH // 2, y), "BLOCK REWARDS", font=f_sect,
              fill=rgb(WHITE), anchor="mm")
    y += 28
    draw.text((WIDTH // 2, y),
              "6.089 Billion XOM distributed over 40 years",
              font=f_t, fill=rgb(MUTED), anchor="mm")
    y += 36

    bw3 = (WIDTH - 100 - 24) // 3
    bh = 155
    block_cards = [
        ("GATEWAY VALIDATORS", "Capped at 0.3 XOM\nper epoch per gateway",
         "5 \u00d7 0.3 = 1.5", BLUE),
        ("SERVICE NODES", "Capped at 0.2 XOM\nper epoch per node",
         "0 active", PURPLE),
        ("LP OVERFLOW", "All remaining reward\nto liquidity providers",
         "~14.1 XOM/epoch", PRIMARY),
    ]
    for i, (title, desc, amt, color) in enumerate(block_cards):
        cx = 50 + i * (bw3 + 12)
        rrect(draw, (cx, y, cx + bw3, y + bh), 12, rgb(CARD))
        rrect(draw, (cx, y, cx + bw3, y + 5), 3, rgb(color))
        draw.text((cx + bw3 // 2, y + 28), title, font=f_mb,
                  fill=rgb(color), anchor="mm")
        draw.text((cx + bw3 // 2, y + 62), amt, font=f_lg,
                  fill=rgb(WHITE), anchor="mm")
        ty = y + 95
        for ln in desc.split('\n'):
            draw.text((cx + bw3 // 2, ty), ln, font=f_t,
                      fill=rgb(MUTED), anchor="mm")
            ty += 19
    y += bh + 10
    draw.text((WIDTH // 2, y),
              "Initial: 15.6 XOM/epoch (2-sec epochs)  |  "
              "1% reduction every ~146 days  |  "
              "Zero after ~40 years",
              font=f_t, fill=rgb(MUTED), anchor="mm")
    y += 20
    draw.text((WIDTH // 2, y),
              "Overflow = epoch reward \u2212 sum of validator caps  "
              "\u2192  routed to LiquidityOverflowPool",
              font=f_t, fill=rgb(MUTED), anchor="mm")
    y += 36

    # ════════════════════════════════════════════════════════
    # SECTION 3: USER SIGN-UP BONUSES
    # ════════════════════════════════════════════════════════
    hr(draw, y)
    y += 30
    draw.text((WIDTH // 2, y), "SIGN-UP BONUSES", font=f_sect,
              fill=rgb(WHITE), anchor="mm")
    y += 28
    draw.text((WIDTH // 2, y),
              "One-time bonuses that decrease as more users join",
              font=f_t, fill=rgb(MUTED), anchor="mm")
    y += 36

    # Three bonus cards side by side
    bw3 = (WIDTH - 100 - 24) // 3
    bh2 = 310
    bonus_cards = [
        ("WELCOME BONUS", "6.2B XOM budget",
         [("Users 1-1K", "10,000 XOM"),
          ("1K-10K", "5,000 XOM"),
          ("10K-100K", "2,500 XOM"),
          ("100K-1M", "1,250 XOM"),
          ("1M+", "625 XOM")],
         "Requires phone, email,\nTwitter/Telegram follow",
         GREEN),
        ("REFERRAL BONUS", "3B XOM budget",
         [("Users 1-10K", "2,500 XOM"),
          ("10K-100K", "1,250 XOM"),
          ("100K-1M", "625 XOM"),
          ("1M+", "312.5 XOM"),
          ("", "")],
         "Paid to the person\nwho referred the new user",
         ORANGE),
        ("FIRST SALE BONUS", "2B XOM budget",
         [("Users 1-100K", "500 XOM"),
          ("100K-1M", "250 XOM"),
          ("1M-10M", "125 XOM"),
          ("10M+", "62.5 XOM"),
          ("", "")],
         "Create a listing and\ncomplete your first sale",
         PURPLE),
    ]
    for i, (title, budget, tiers, note, color) in enumerate(bonus_cards):
        cx = 50 + i * (bw3 + 12)
        rrect(draw, (cx, y, cx + bw3, y + bh2), 12, rgb(CARD))
        rrect(draw, (cx, y, cx + bw3, y + 5), 3, rgb(color))
        draw.text((cx + bw3 // 2, y + 26), title, font=f_mb,
                  fill=rgb(color), anchor="mm")
        draw.text((cx + bw3 // 2, y + 50), budget, font=f_t,
                  fill=rgb(MUTED), anchor="mm")
        ty = y + 78
        for label, amt in tiers:
            if not label:
                ty += 22
                continue
            draw.text((cx + 20, ty), label, font=f_t, fill=rgb(MUTED))
            draw.text((cx + bw3 - 20, ty), amt, font=f_sb,
                      fill=rgb(WHITE), anchor="ra")
            ty += 26
        ty = y + bh2 - 48
        for ln in note.split('\n'):
            draw.text((cx + bw3 // 2, ty), ln, font=f_t,
                      fill=rgb(MUTED), anchor="mm")
            ty += 18
    y += bh2 + 20

    # ════════════════════════════════════════════════════════
    # SECTION 4: ONGOING EARNINGS
    # ════════════════════════════════════════════════════════
    hr(draw, y)
    y += 30
    draw.text((WIDTH // 2, y), "ONGOING EARNINGS", font=f_sect,
              fill=rgb(WHITE), anchor="mm")
    y += 28
    draw.text((WIDTH // 2, y),
              "Recurring income streams for active participants",
              font=f_t, fill=rgb(MUTED), anchor="mm")
    y += 38

    # Two-column layout
    cw2 = (WIDTH - 110) // 2
    left_x = 40
    right_x = left_x + cw2 + 30

    # Left column cards
    left_cards = [
        ("MARKETPLACE REFERRALS", ORANGE,
         ["You earn 70% of the 0.25%",
          "referral fee on every sale",
          "made by users you referred.",
          "",
          "Your referrer also earns 20%",
          "(two-level system)."]),
        ("LISTING NODE OPERATOR", GREEN,
         ["Host marketplace listings",
          "and earn 70% of 0.25%",
          "listing fee on each sale.",
          "",
          "Min score: 25 pts. No KYC.",
          "No staking minimum."]),
        ("DEX LIQUIDITY PROVIDER", BLUE,
         ["Provide liquidity to DEX",
          "pairs and earn 70% of",
          "all trading fees for",
          "that pool.",
          "",
          "Same for RWA AMM pools."]),
    ]

    right_cards = [
        ("VALIDATOR OPERATOR", PRIMARY,
         ["Capped block reward per epoch",
          "+ service fees.",
          "",
          "Requires: 1M XOM stake,",
          "KYC Tier 4, score >= 50,",
          "24/7 uptime."]),
        ("ARBITRATION PANELIST", PURPLE,
         ["Resolve buyer/seller",
          "disputes and earn 70%",
          "of the 5% arbitration fee.",
          "",
          "Reputation-based",
          "selection."]),
        ("SELL GOODS & SERVICES", WHITE,
         ["Keep 99% of sale price.",
          "Only 1% marketplace fee",
          "(paid by seller).",
          "",
          "Zero gas fees for OmniCoin",
          "transactions."]),
    ]

    card_h = 175
    card_gap = 14

    for col_x, cards in [(left_x, left_cards), (right_x, right_cards)]:
        cy = y
        for title, color, lines in cards:
            rrect(draw, (col_x, cy, col_x + cw2, cy + card_h), 12, rgb(CARD))
            rrect(draw, (col_x, cy, col_x + cw2, cy + 5), 3, rgb(color))
            draw.text((col_x + 20, cy + 22), title, font=f_mb,
                      fill=rgb(color))
            ty = cy + 52
            for ln in lines:
                if ln:
                    draw.text((col_x + 20, ty), ln, font=f_t,
                              fill=rgb(WHITE))
                ty += 20
            cy += card_h + card_gap

    y += 3 * (card_h + card_gap) + 10

    # ════════════════════════════════════════════════════════
    # SECTION 5: PARTICIPATION SCORE REWARDS
    # ════════════════════════════════════════════════════════
    hr(draw, y)
    y += 30
    draw.text((WIDTH // 2, y), "PROOF OF PARTICIPATION (100 Points)",
              font=f_sect, fill=rgb(WHITE), anchor="mm")
    y += 28
    draw.text((WIDTH // 2, y),
              "Higher score = more validator eligibility + better reputation",
              font=f_t, fill=rgb(MUTED), anchor="mm")
    y += 36

    # Score components as horizontal bars
    components = [
        ("KYC Tier", "0-20 pts", "Tier 0=0, Tier 1=5, Tier 2=10, "
         "Tier 3=15, Tier 4=20", 20, PRIMARY),
        ("Staking", "2-24 pts", "Amount tier x3 + Duration tier x3", 24, BLUE),
        ("Reputation", "-10 to +10", "1-star = -10 ... 5-star = +10", 10, ORANGE),
        ("Referrals", "0-10 pts", "One point per new user referred (max 10)",
         10, GREEN),
        ("Forum", "0-5 pts", "Helpful answers, decays if inactive", 5, PURPLE),
        ("Marketplace", "0-5 pts", "Buy/sell transaction count", 5, BLUE),
        ("Publishing", "0-4 pts", "100 listings=1, 1K=2, 10K=3, 100K=4",
         4, ORANGE),
        ("Policing", "0-5 pts", "Report illegal listings accurately",
         5, RED),
        ("Reliability", "-5 to +5", "Uptime as validator/publisher",
         5, PRIMARY),
    ]

    bar_left = 60
    bar_right = WIDTH - 60
    bar_total_w = bar_right - bar_left
    label_w = 180
    pts_w = 100
    desc_start = bar_left + label_w + pts_w + 10

    for comp_name, pts_label, desc, max_pts, color in components:
        rrect(draw, (bar_left, y, bar_right, y + 28), 5, rgb(CARD))
        draw.text((bar_left + 12, y + 14), comp_name, font=f_sb,
                  fill=rgb(color), anchor="lm")
        draw.text((bar_left + label_w + 8, y + 14), pts_label, font=f_sb,
                  fill=rgb(WHITE), anchor="lm")
        draw.text((desc_start, y + 14), desc, font=f_t,
                  fill=rgb(MUTED), anchor="lm")
        y += 32

    y += 8
    rrect(draw, (60, y, WIDTH - 60, y + 36), 8, rgb(CARD_HI))
    draw.text((WIDTH // 2, y + 18),
              "50+ points required to become a Validator  |  "
              "25+ points to run a Listing Node",
              font=f_sb, fill=rgb(PRIMARY), anchor="mm")
    y += 52

    # ════════════════════════════════════════════════════════
    # FOOTER
    # ════════════════════════════════════════════════════════
    hr(draw, y)
    y += 24
    draw.text((WIDTH // 2, y),
              "omnibazaar.com  |  whitepaper.omnibazaar.com",
              font=f_t, fill=rgb(MUTED), anchor="mm")
    y += 22
    draw.text((WIDTH // 2, y),
              "Not financial advice. Crypto investments carry "
              "significant risk. Rewards decrease over time.",
              font=f_t, fill=rgb(MUTED), anchor="mm")
    y += 30

    # ── CROP & SAVE ──────────────────────────────────────────
    final_h = y + 10
    if final_h < HEIGHT:
        img = img.crop((0, 0, WIDTH, final_h))
    img.save(OUTPUT, "PNG", quality=95)
    print(f"Saved: {OUTPUT}")
    print(f"Size: {WIDTH} x {final_h}")


if __name__ == "__main__":
    create()
