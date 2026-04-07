#!/usr/bin/env python3
"""
Generate the OmniBazaar Early LP Rewards infographic (multi-chain version).

Produces a PNG at Documents/OmniBazaar_LP_Rewards_Infographic.png showing:
- How the validator overflow system works
- $890K/year total rewards across 5 chains
- 5-chain pool distribution (strategic weights)
- APR vs. total LP investment curve
- Annual rewards vs. network size bar chart
- Key details for investors
"""

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
import numpy as np
import os

# ── Color palette (dark theme) ───────────────────────────────────────────
BG           = "#0b1120"
PANEL_BG     = "#111b2e"
ACCENT_TEAL  = "#00e5a0"
ACCENT_GOLD  = "#ffb740"
TEXT_WHITE    = "#e8ecf2"
TEXT_DIM      = "#8899aa"
BORDER_COLOR = "#1a2840"

CHAIN_COLORS = {
    "OmniCoin": "#00e5a0",
    "Ethereum":   "#627eea",
    "Arbitrum":   "#28a0f0",
    "Base":       "#0052ff",
    "Polygon":    "#8247e5",
}

BAR_COLORS = ["#00e5a0", "#34d98e", "#5ccc7c", "#84bf6a", "#f5a623",
              "#e8963a", "#db8752", "#ce7869", "#c16981"]


def rounded_rect(ax, x, y, w, h, color=PANEL_BG, radius=0.01, lw=1,
                 edge_color=BORDER_COLOR):
    """Draw a rounded rectangle panel."""
    box = FancyBboxPatch(
        (x, y), w, h,
        boxstyle=f"round,pad={radius}",
        facecolor=color, edgecolor=edge_color, linewidth=lw,
        transform=ax.transAxes, clip_on=False,
    )
    ax.add_patch(box)


def draw_infographic():
    """Build and save the complete infographic."""
    fig = plt.figure(figsize=(10.5, 15.5), facecolor=BG, dpi=120)

    ax = fig.add_axes([0, 0, 1, 1], facecolor=BG)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    # ── 1. TITLE ─────────────────────────────────────────────────────────
    ax.text(0.50, 0.980, "EARLY LP REWARDS",
            fontsize=32, fontweight="bold", color=ACCENT_TEAL,
            ha="center", va="top", family="sans-serif")

    # Decorative line BELOW the subtitle (not through the title)
    ax.text(0.50, 0.955, "Multi-Chain Validator Overflow System",
            fontsize=16, fontweight="bold", color=ACCENT_GOLD,
            ha="center", va="top", family="sans-serif")

    ax.plot([0.15, 0.85], [0.935, 0.935], color=ACCENT_TEAL,
            linewidth=1.0, alpha=0.5, transform=ax.transAxes)

    # ── 2. HOW IT WORKS ─────────────────────────────────────────────────
    how_t = 0.922
    how_h = 0.075
    rounded_rect(ax, 0.04, how_t - how_h, 0.92, how_h, radius=0.006)

    ax.text(0.50, how_t - 0.008, "HOW IT WORKS",
            fontsize=14, fontweight="bold", color=TEXT_WHITE,
            ha="center", va="top")

    steps = [
        ("1.", "Block reward = 15.602 XOM every 2-second epoch"),
        ("2.", "Validators capped: 0.3 XOM (gateway) / 0.2 XOM (service node)"),
        ("3.", "Excess overflow flows automatically to LP stakers on 5 chains"),
    ]
    for i, (num, txt) in enumerate(steps):
        y = how_t - 0.030 - i * 0.016
        ax.text(0.07, y, num, fontsize=11, fontweight="bold",
                color=ACCENT_GOLD, ha="left", va="center")
        ax.text(0.10, y, txt, fontsize=11, color=ACCENT_TEAL,
                ha="left", va="center")

    # ── 3. $890K / YEAR BANNER ───────────────────────────────────────────
    ban_t = 0.840
    ban_h = 0.065
    rounded_rect(ax, 0.04, ban_t - ban_h, 0.92, ban_h,
                 color="#0d1f35", radius=0.006,
                 edge_color=ACCENT_TEAL, lw=1.5)

    ax.text(0.50, ban_t - 0.006, "$890K / YEAR",
            fontsize=30, fontweight="bold", color=ACCENT_TEAL,
            ha="center", va="top")
    ax.text(0.50, ban_t - 0.035, "222.5M XOM at $0.004/XOM",
            fontsize=11, color=TEXT_DIM, ha="center", va="top")
    ax.text(0.50, ban_t - 0.051,
            "Strategically weighted across 5 chains  \u2014  5 gateways, 0 service nodes",
            fontsize=10, color=TEXT_DIM, ha="center", va="top")

    # ── 4. 5 POOLS — 5 CHAINS (strategic weights) ───────────────────────
    pool_t = 0.760
    pool_h = 0.120
    rounded_rect(ax, 0.04, pool_t - pool_h, 0.92, pool_h, radius=0.006)

    ax.text(0.50, pool_t - 0.007, "5 POOLS  \u2014  5 CHAINS",
            fontsize=14, fontweight="bold", color=TEXT_WHITE,
            ha="center", va="top")
    ax.text(0.50, pool_t - 0.025,
            "Weighted by strategic value  \u00b7  All XOM/USDC pairs",
            fontsize=10, color=TEXT_DIM, ha="center", va="top")

    # Chain data: (name, subtitle, weight%, $/yr)
    chains = [
        ("OmniCoin", "Home Chain",  35, "$311K/yr"),
        ("Ethereum",   "Mainnet",     12, "$107K/yr"),
        ("Arbitrum",   "One",         22, "$196K/yr"),
        ("Base",       "Mainnet",     22, "$196K/yr"),
        ("Polygon",    "PoS",          9,  "$80K/yr"),
    ]
    card_w = 0.155
    gap = 0.02
    total_w = 5 * card_w + 4 * gap
    start_x = (1.0 - total_w) / 2.0

    for i, (name, sub, weight, annual) in enumerate(chains):
        cx = start_x + i * (card_w + gap)
        cy = pool_t - 0.043
        ch = 0.070
        color = CHAIN_COLORS[name]

        rounded_rect(ax, cx, cy - ch, card_w, ch,
                     color="#0d1a2a", radius=0.004, edge_color=color, lw=1.2)

        # Colored circle indicator
        circle = plt.Circle((cx + card_w / 2, cy - 0.009), 0.007,
                             color=color, transform=ax.transAxes, clip_on=False)
        ax.add_patch(circle)

        # Chain name
        ax.text(cx + card_w / 2, cy - 0.024, name,
                fontsize=9, fontweight="bold", color=TEXT_WHITE,
                ha="center", va="center")

        # Subtitle
        ax.text(cx + card_w / 2, cy - 0.037, sub,
                fontsize=7, color=TEXT_DIM, ha="center", va="center")

        # Weight percentage (large)
        ax.text(cx + card_w / 2, cy - 0.052, f"{weight}%",
                fontsize=13, fontweight="bold", color=color,
                ha="center", va="center")

        # Annual allocation
        ax.text(cx + card_w / 2, cy - 0.065, annual,
                fontsize=7, color=TEXT_DIM, ha="center", va="center")

    # ── 5. APR vs. TOTAL LP INVESTMENT ───────────────────────────────────
    apr_t = 0.625
    apr_h = 0.220
    rounded_rect(ax, 0.04, apr_t - apr_h, 0.92, apr_h, radius=0.006)

    ax.text(0.50, apr_t - 0.007,
            "APR vs. TOTAL LP INVESTMENT",
            fontsize=13, fontweight="bold", color=TEXT_WHITE,
            ha="center", va="top")
    ax.text(0.50, apr_t - 0.024,
            "APR = annual overflow \u00f7 total LP staked  ($890K/yr at current network size)",
            fontsize=8.5, color=TEXT_DIM, ha="center", va="top")

    # Chart inset
    ax_apr = fig.add_axes([0.11, 0.425, 0.80, 0.140], facecolor="#0a0f1a")
    for spine in ("top", "right"):
        ax_apr.spines[spine].set_visible(False)
    for spine in ("bottom", "left"):
        ax_apr.spines[spine].set_color(BORDER_COLOR)
    ax_apr.tick_params(colors=TEXT_DIM, labelsize=8)

    annual_overflow = 890_000
    x_pts = np.array([50, 100, 250, 500, 1000, 2500, 5000, 10000, 20000, 40000])
    apr_pts = (annual_overflow / (x_pts * 1000)) * 100

    x_smooth = np.logspace(np.log10(50), np.log10(40000), 200)
    apr_smooth = (annual_overflow / (x_smooth * 1000)) * 100

    ax_apr.fill_between(x_smooth, apr_smooth, alpha=0.15, color=ACCENT_TEAL)
    ax_apr.plot(x_smooth, apr_smooth, color=ACCENT_TEAL, linewidth=2.5)
    ax_apr.scatter(x_pts, apr_pts, color=ACCENT_TEAL, s=30, zorder=5,
                   edgecolors="#0b1120", linewidths=1)

    labels = {50: "1,780%", 100: "890%", 250: "356%", 500: "178%",
              1000: "89%", 2500: "35.6%", 5000: "17.8%", 10000: "8.9%"}
    for xv, lbl in labels.items():
        yv = (annual_overflow / (xv * 1000)) * 100
        ax_apr.annotate(lbl, (xv, yv), textcoords="offset points",
                        xytext=(0, 10), fontsize=7, fontweight="bold",
                        color=ACCENT_GOLD, ha="center")

    ax_apr.set_xscale("log")
    ax_apr.set_yscale("log")
    ax_apr.set_xlim(40, 50000)
    ax_apr.set_ylim(1, 3000)
    ax_apr.set_xticks(x_pts)
    ax_apr.set_xticklabels(
        ["$50K", "$100K", "$250K", "$500K", "$1M", "$2.5M",
         "$5M", "$10M", "$20M", "$40M"], fontsize=7)
    ax_apr.set_yticks([1, 10, 100, 1000])
    ax_apr.set_yticklabels(["1%", "10%", "100%", "1,000%"], fontsize=7)
    ax_apr.yaxis.set_minor_formatter(matplotlib.ticker.NullFormatter())
    ax_apr.xaxis.set_minor_formatter(matplotlib.ticker.NullFormatter())

    ax_apr.axhspan(5, 12, alpha=0.12, color=ACCENT_GOLD, zorder=0)
    ax_apr.text(38000, 7.5, "Staking APR\nrange (5\u201312%)",
                fontsize=6.5, color=ACCENT_GOLD, ha="right", va="center",
                alpha=0.9)
    ax_apr.set_xlabel("Total LP Investment (USD at $0.004/XOM)",
                      fontsize=8, color=TEXT_DIM, labelpad=4)

    # ── 6. ANNUAL LP REWARDS vs. NETWORK SIZE ────────────────────────────
    bar_t = 0.390
    bar_h = 0.170
    rounded_rect(ax, 0.04, bar_t - bar_h, 0.92, bar_h, radius=0.006)

    ax.text(0.50, bar_t - 0.007,
            "ANNUAL LP REWARDS vs. NETWORK SIZE",
            fontsize=13, fontweight="bold", color=TEXT_WHITE,
            ha="center", va="top")
    ax.text(0.50, bar_t - 0.024,
            "Each gateway added reduces LP overflow by ~\$18.9K/yr"
            "  \u2022  Each service node by ~\$12.6K/yr",
            fontsize=8, color=TEXT_DIM, ha="center", va="top")

    # Bar chart inset
    ax_bar = fig.add_axes([0.11, 0.240, 0.80, 0.090], facecolor="#0a0f1a")
    for spine in ("top", "right"):
        ax_bar.spines[spine].set_visible(False)
    for spine in ("bottom", "left"):
        ax_bar.spines[spine].set_color(BORDER_COLOR)
    ax_bar.tick_params(colors=TEXT_DIM, labelsize=8)

    gateways = [5, 10, 15, 20, 25, 30, 40, 50]
    rewards  = [890, 795, 701, 606, 511, 417, 227, 38]

    bars = ax_bar.bar(
        range(len(gateways)), rewards,
        color=BAR_COLORS[:len(gateways)],
        edgecolor="#0b1120", linewidth=0.5, width=0.7)
    for b, val in zip(bars, rewards):
        ax_bar.text(b.get_x() + b.get_width() / 2,
                    b.get_height() + 15, f"${val}K",
                    ha="center", va="bottom", fontsize=8,
                    fontweight="bold", color=TEXT_WHITE)
    ax_bar.set_xticks(range(len(gateways)))
    ax_bar.set_xticklabels(gateways, fontsize=8)
    ax_bar.set_xlabel("Number of Gateway Validators",
                      fontsize=8, color=TEXT_DIM, labelpad=4)
    ax_bar.set_ylim(0, 1050)
    ax_bar.set_yticks([])

    # ── 7. KEY DETAILS ───────────────────────────────────────────────────
    det_t = 0.205
    det_h = 0.105
    rounded_rect(ax, 0.04, det_t - det_h, 0.92, det_h, radius=0.006)

    ax.text(0.50, det_t - 0.006, "KEY DETAILS",
            fontsize=14, fontweight="bold", color=TEXT_WHITE,
            ha="center", va="top")

    details = [
        (ACCENT_TEAL,
         "30% immediate  /  70% vests linearly over 90 days"),
        (ACCENT_GOLD,
         "1-day minimum stake duration (anti-flash-stake protection)"),
        (TEXT_DIM,
         "Emergency withdrawal: 0.5% fee, forfeits unvested rewards"),
        (TEXT_DIM,
         "Block reward reduces 1% per year \u2014 overflow shrinks proportionally"),
        (TEXT_DIM,
         "XOM price used: $0.004 \u2014 APR is price-independent (XOM in, XOM out)"),
        (TEXT_DIM,
         "APR = annual overflow rewards \u00f7 total LP staked  (standard DeFi formula)"),
        (ACCENT_TEAL,
         "Provide LP on any of 5 chains \u2014 rewards weighted by strategic chain value"),
    ]
    for i, (col, txt) in enumerate(details):
        y = det_t - 0.025 - i * 0.0115
        ax.text(0.08, y, "\u2022", fontsize=10, color=col,
                ha="center", va="center")
        ax.text(0.10, y, txt, fontsize=8.5, color=col,
                ha="left", va="center")

    # ── 8. FOOTER ────────────────────────────────────────────────────────
    ax.text(0.50, 0.020,
            "OmniBazaar  \u2502  Chain 88008  \u2502  "
            "LiquidityOverflowPool + OmniValidatorRewards V3  \u2502  "
            "LayerZero V2 (cross-chain)",
            fontsize=8, color=TEXT_DIM, ha="center", va="bottom")

    # ── Save ─────────────────────────────────────────────────────────────
    out_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "OmniBazaar_LP_Rewards_Infographic.png",
    )
    fig.savefig(out_path, dpi=120, facecolor=BG, bbox_inches="tight",
                pad_inches=0.15)
    plt.close(fig)
    print(f"Saved: {out_path}")


if __name__ == "__main__":
    draw_infographic()
