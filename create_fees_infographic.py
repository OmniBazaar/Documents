#!/usr/bin/env python3
"""
OmniBazaar Fee Distribution Infographic Generator
All fees, where they go, and how they are split.
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

OUTPUT = "/home/omnirick/OmniBazaar/OmniBazaar_Fees_Infographic.png"
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


def draw_split_bar(draw, x, y, w, h, segments, font):
    """Draw a horizontal stacked bar showing fee split percentages."""
    total = sum(s[0] for s in segments)
    cx = x
    for pct, label, color in segments:
        seg_w = max(int(w * pct / total), 1)
        if cx + seg_w > x + w:
            seg_w = x + w - cx
        rrect(draw, (cx, y, cx + seg_w, y + h), 4, rgb(color))
        # Label inside the bar if wide enough
        text = f"{pct}% {label}"
        bb = draw.textbbox((0, 0), text, font=font)
        tw = bb[2] - bb[0]
        if seg_w > tw + 8:
            draw.text((cx + seg_w // 2, y + h // 2), text, font=font,
                      fill=rgb(BG), anchor="mm")
        elif seg_w > 30:
            draw.text((cx + seg_w // 2, y + h // 2), f"{pct}%", font=font,
                      fill=rgb(BG), anchor="mm")
        cx += seg_w


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
    f_bar = ImageFont.truetype(B, 13)

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
    draw.text((WIDTH // 2, y), "FEE STRUCTURE &", font=f_title,
              fill=rgb(WHITE), anchor="mm")
    y += 48
    draw.text((WIDTH // 2, y), "DISTRIBUTION", font=f_title,
              fill=rgb(WHITE), anchor="mm")
    y += 42
    draw.text((WIDTH // 2, y),
              "Where every fee goes and how it is split",
              font=f_s, fill=rgb(MUTED), anchor="mm")
    y += 44

    # ── CORE PRINCIPLE ───────────────────────────────────────
    rrect(draw, (40, y, WIDTH - 40, y + 72), 12, rgb(CARD_HI))
    draw.text((WIDTH // 2, y + 18),
              "UNIFIED FEE VAULT  \u2014  Default 70 / 20 / 10 Split",
              font=f_mb, fill=rgb(PRIMARY), anchor="mm")
    draw.text((WIDTH // 2, y + 48),
              "70% ODDAO Treasury   |   "
              "20% Staking Pool   |   10% Protocol Treasury",
              font=f_s, fill=rgb(WHITE), anchor="mm")
    y += 90

    # ════════════════════════════════════════════════════════
    # MARKETPLACE FEES
    # ════════════════════════════════════════════════════════
    hr(draw, y)
    y += 30
    draw.text((WIDTH // 2, y), "MARKETPLACE  (1% of sale)",
              font=f_sect, fill=rgb(WHITE), anchor="mm")
    y += 28
    draw.text((WIDTH // 2, y),
              "Paid by seller  |  Optional 0-3% priority fee on top",
              font=f_t, fill=rgb(MUTED), anchor="mm")
    y += 36

    # Three sub-splits
    mw = (WIDTH - 100 - 24) // 3
    mh = 185
    mkt_splits = [
        ("TRANSACTION FEE", "50% of 1% = 0.50%",
         [(70, "ODDAO", PRIMARY), (20, "Staking", BLUE),
          (10, "Protocol", ORANGE)]),
        ("REFERRAL FEE", "25% of 1% = 0.25%",
         [(70, "Referrer", GREEN), (20, "L2 Referrer", BLUE),
          (10, "ODDAO", ORANGE)]),
        ("LISTING FEE", "25% of 1% = 0.25%",
         [(70, "Listing Node", GREEN), (20, "Selling Node", BLUE),
          (10, "ODDAO", ORANGE)]),
    ]
    for i, (title, subtitle, segments) in enumerate(mkt_splits):
        cx = 50 + i * (mw + 12)
        rrect(draw, (cx, y, cx + mw, y + mh), 12, rgb(CARD))
        rrect(draw, (cx, y, cx + mw, y + 5), 3, rgb(PRIMARY))
        draw.text((cx + mw // 2, y + 26), title, font=f_mb,
                  fill=rgb(PRIMARY), anchor="mm")
        draw.text((cx + mw // 2, y + 50), subtitle, font=f_t,
                  fill=rgb(MUTED), anchor="mm")
        # Split bar
        draw_split_bar(draw, cx + 16, y + 72, mw - 32, 28,
                       segments, f_bar)
        # Legend below bar
        ty = y + 110
        for pct, label, color in segments:
            draw.text((cx + 20, ty), f"\u25CF {pct}% \u2192 {label}",
                      font=f_t, fill=rgb(color))
            ty += 22
    y += mh + 10
    draw.text((WIDTH // 2, y),
              "No referrer? Random validator becomes referrer.  "
              "Priority fees split same as listing fee.",
              font=f_t, fill=rgb(MUTED), anchor="mm")
    y += 36

    # ════════════════════════════════════════════════════════
    # DEX & RWA FEES
    # ════════════════════════════════════════════════════════
    hr(draw, y)
    y += 30
    draw.text((WIDTH // 2, y), "DEX & RWA TRADING", font=f_sect,
              fill=rgb(WHITE), anchor="mm")
    y += 36

    dw = (WIDTH - 110) // 2
    dh = 240

    # DEX card
    cx = 40
    rrect(draw, (cx, y, cx + dw, y + dh), 12, rgb(CARD))
    rrect(draw, (cx, y, cx + dw, y + 5), 3, rgb(BLUE))
    draw.text((cx + dw // 2, y + 28), "DEX TRADING FEE", font=f_mb,
              fill=rgb(BLUE), anchor="mm")
    draw.text((cx + dw // 2, y + 52), "Rate TBD", font=f_t,
              fill=rgb(MUTED), anchor="mm")
    # Main split bar (70/30)
    draw_split_bar(draw, cx + 16, y + 74, dw - 32, 28,
                   [(70, "LP Pool", GREEN), (30, "Vault", ORANGE)], f_bar)
    ty = y + 114
    draw.text((cx + 20, ty), "\u25CF 70% \u2192 LP Pool (liquidity providers)",
              font=f_t, fill=rgb(GREEN))
    ty += 24
    draw.text((cx + 20, ty), "Remaining 30% goes to UnifiedFeeVault:",
              font=f_t, fill=rgb(MUTED))
    ty += 24
    draw.text((cx + 36, ty), "\u25CF 21% \u2192 ODDAO Treasury",
              font=f_t, fill=rgb(PRIMARY))
    ty += 22
    draw.text((cx + 36, ty), "\u25CF 6% \u2192 Staking Pool",
              font=f_t, fill=rgb(BLUE))
    ty += 22
    draw.text((cx + 36, ty), "\u25CF 3% \u2192 Protocol Treasury",
              font=f_t, fill=rgb(ORANGE))

    # RWA card
    cx = 40 + dw + 30
    rrect(draw, (cx, y, cx + dw, y + dh), 12, rgb(CARD))
    rrect(draw, (cx, y, cx + dw, y + 5), 3, rgb(PURPLE))
    draw.text((cx + dw // 2, y + 28), "RWA PROTOCOL FEE", font=f_mb,
              fill=rgb(PURPLE), anchor="mm")
    draw.text((cx + dw // 2, y + 52), "0.30% (immutable on-chain)",
              font=f_t, fill=rgb(MUTED), anchor="mm")
    # Main split bar (70/30)
    draw_split_bar(draw, cx + 16, y + 74, dw - 32, 28,
                   [(70, "LP Pool", GREEN), (30, "Vault", ORANGE)], f_bar)
    ty = y + 114
    draw.text((cx + 20, ty), "\u25CF 70% \u2192 LP Pool (liquidity providers)",
              font=f_t, fill=rgb(GREEN))
    ty += 24
    draw.text((cx + 20, ty), "Remaining 30% goes to UnifiedFeeVault:",
              font=f_t, fill=rgb(MUTED))
    ty += 24
    draw.text((cx + 36, ty), "\u25CF 21% \u2192 ODDAO Treasury",
              font=f_t, fill=rgb(PRIMARY))
    ty += 22
    draw.text((cx + 36, ty), "\u25CF 6% \u2192 Staking Pool",
              font=f_t, fill=rgb(BLUE))
    ty += 22
    draw.text((cx + 36, ty), "\u25CF 3% \u2192 Protocol Treasury",
              font=f_t, fill=rgb(ORANGE))
    y += dh + 16

    # ════════════════════════════════════════════════════════
    # SERVICES THAT SEND 100% TO VAULT
    # ════════════════════════════════════════════════════════
    hr(draw, y)
    y += 30
    draw.text((WIDTH // 2, y), "OTHER FEES \u2192 100% TO VAULT",
              font=f_sect, fill=rgb(WHITE), anchor="mm")
    y += 28
    draw.text((WIDTH // 2, y),
              "These services send all collected fees to UnifiedFeeVault "
              "for 70/20/10 distribution",
              font=f_t, fill=rgb(MUTED), anchor="mm")
    y += 36

    # Grid of service cards
    sw4 = (WIDTH - 80 - 36) // 4
    sh = 135
    vault_services = [
        ("YIELD", "10% of yield gains", "OmniYield-\nFeeCollector", ORANGE),
        ("CHAT", "Tiered pricing\n(20 free/month)", "OmniChatFee", BLUE),
        ("ESCROW", "0.25% of\ntransaction", "MinimalEscrow", GREEN),
        ("ENS NAMES", "Registration fee", "OmniENS", PRIMARY),
    ]
    for i, (title, fee, contract, color) in enumerate(vault_services):
        cx = 40 + i * (sw4 + 12)
        rrect(draw, (cx, y, cx + sw4, y + sh), 12, rgb(CARD))
        rrect(draw, (cx, y, cx + sw4, y + 5), 3, rgb(color))
        draw.text((cx + sw4 // 2, y + 24), title, font=f_mb,
                  fill=rgb(color), anchor="mm")
        ty = y + 52
        for ln in fee.split('\n'):
            draw.text((cx + sw4 // 2, ty), ln, font=f_t,
                      fill=rgb(WHITE), anchor="mm")
            ty += 19
        ty = y + sh - 20
        for ln in contract.split('\n'):
            draw.text((cx + sw4 // 2, ty), ln, font=f_t,
                      fill=rgb(MUTED), anchor="mm")
            ty += 16
    y += sh + 10

    # Vault distribution reminder
    draw_split_bar(draw, 60, y, WIDTH - 120, 30,
                   [(70, "ODDAO Treasury", PRIMARY),
                    (20, "Staking Pool", BLUE),
                    (10, "Protocol", ORANGE)], f_bar)
    y += 46

    # ════════════════════════════════════════════════════════
    # SPECIAL FEES
    # ════════════════════════════════════════════════════════
    hr(draw, y)
    y += 30
    draw.text((WIDTH // 2, y), "SPECIAL FEE STRUCTURES",
              font=f_sect, fill=rgb(WHITE), anchor="mm")
    y += 36

    sw3 = (WIDTH - 100 - 24) // 3
    sh2 = 200
    special = [
        ("ARBITRATION", "5% of disputed amount",
         "50% paid by buyer\n50% paid by seller",
         [(70, "Arbitrators", GREEN), (20, "ODDAO", PRIMARY),
          (10, "Protocol", ORANGE)],
         RED),
        ("PRIVACY (pXOM)", "0.3% conversion fee",
         "XOM \u2194 pXOM conversion\nHandled by COTI network",
         [(100, "COTI Network", PURPLE)],
         PURPLE),
        ("BRIDGE FEES", "Variable per bridge",
         "Cross-chain transfers\nvia OmniBridge",
         [(100, "UnifiedFeeVault", PRIMARY)],
         BLUE),
    ]
    for i, (title, rate, desc, segments, color) in enumerate(special):
        cx = 50 + i * (sw3 + 12)
        rrect(draw, (cx, y, cx + sw3, y + sh2), 12, rgb(CARD))
        rrect(draw, (cx, y, cx + sw3, y + 5), 3, rgb(color))
        draw.text((cx + sw3 // 2, y + 26), title, font=f_mb,
                  fill=rgb(color), anchor="mm")
        draw.text((cx + sw3 // 2, y + 50), rate, font=f_sb,
                  fill=rgb(WHITE), anchor="mm")
        ty = y + 76
        for ln in desc.split('\n'):
            draw.text((cx + sw3 // 2, ty), ln, font=f_t,
                      fill=rgb(MUTED), anchor="mm")
            ty += 20
        # Split bar
        draw_split_bar(draw, cx + 16, y + 128, sw3 - 32, 24,
                       segments, f_bar)
        ty = y + 160
        for pct, label, col in segments:
            draw.text((cx + 20, ty), f"\u25CF {pct}% \u2192 {label}",
                      font=f_t, fill=rgb(col))
            ty += 20
    y += sh2 + 16

    # ════════════════════════════════════════════════════════
    # KEY FACTS
    # ════════════════════════════════════════════════════════
    hr(draw, y)
    y += 30
    draw.text((WIDTH // 2, y), "KEY FACTS", font=f_sect,
              fill=rgb(WHITE), anchor="mm")
    y += 36

    facts = [
        ("\u2713  Users pay ZERO gas fees for OmniCoin transactions "
         "(validators absorb gas costs)", PRIMARY),
        ("\u2713  \"Validator\" is NEVER a direct fee recipient in any "
         "contract", PRIMARY),
        ("\u2713  UnifiedFeeVault is UUPS-upgradeable (splits can be "
         "changed via governance)", BLUE),
        ("\u2713  DEX & RWA: 70% stays in LP pool, only 30% enters the "
         "vault for distribution", BLUE),
        ("\u2713  ODDAO receives fees from EVERY market type via the "
         "vault's 70/20/10 split", ORANGE),
        ("\u2713  Marketplace 1% fee has a unique 3-way sub-split "
         "(transaction / referral / listing)", ORANGE),
        ("\u2713  All fee percentages are enforced on-chain by smart "
         "contracts", PRIMARY),
    ]

    for text, color in facts:
        rrect(draw, (60, y, WIDTH - 60, y + 28), 5, rgb(CARD))
        draw.text((80, y + 14), text, font=f_t, fill=rgb(color),
                  anchor="lm")
        y += 32
    y += 14

    # ════════════════════════════════════════════════════════
    # FLOW DIAGRAM: where money goes
    # ════════════════════════════════════════════════════════
    hr(draw, y)
    y += 30
    draw.text((WIDTH // 2, y), "FEE FLOW SUMMARY", font=f_sect,
              fill=rgb(WHITE), anchor="mm")
    y += 36

    # Source boxes
    sources = [
        ("Marketplace", PRIMARY), ("DEX", BLUE), ("RWA", PURPLE),
        ("Yield", ORANGE), ("Chat", GREEN), ("Escrow", GREEN),
    ]
    src_w = (WIDTH - 80 - 5 * 8) // 6
    for i, (name, color) in enumerate(sources):
        sx = 40 + i * (src_w + 8)
        rrect(draw, (sx, y, sx + src_w, y + 32), 6, rgb(color))
        draw.text((sx + src_w // 2, y + 16), name, font=f_sb,
                  fill=rgb(BG), anchor="mm")
    y += 40

    # Arrow indicators
    draw.text((WIDTH // 2, y + 6), "\u25BC   \u25BC   \u25BC   \u25BC   "
              "\u25BC   \u25BC", font=f_mb, fill=rgb(MUTED), anchor="mm")
    y += 28

    # Vault box
    rrect(draw, (200, y, WIDTH - 200, y + 44), 10, rgb(CARD_HI))
    draw.text((WIDTH // 2, y + 22), "UnifiedFeeVault",
              font=f_lg, fill=rgb(PRIMARY), anchor="mm")
    y += 52

    # Arrow
    draw.text((WIDTH // 2, y + 6), "\u25BC          \u25BC          \u25BC",
              font=f_mb, fill=rgb(MUTED), anchor="mm")
    y += 28

    # Three destination boxes
    dests = [
        ("70%  ODDAO\nTreasury", PRIMARY),
        ("20%  Staking\nPool", BLUE),
        ("10%  Protocol\nTreasury", ORANGE),
    ]
    dw3 = (WIDTH - 100 - 24) // 3
    for i, (label, color) in enumerate(dests):
        dx = 50 + i * (dw3 + 12)
        rrect(draw, (dx, y, dx + dw3, y + 50), 10, rgb(color))
        draw.text((dx + dw3 // 2, y + 25), label.replace('\n', '  '),
                  font=f_mb, fill=rgb(BG), anchor="mm")
    y += 68

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
              "Fee splits enforced on-chain. See UnifiedFeeVault.sol, "
              "RWAAMM.sol, DEXSettlement.sol",
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
