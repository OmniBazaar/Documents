#!/usr/bin/env python3
"""
OmniBazaar Yield Opportunity Infographic Generator
Creates a single-page PNG infographic summarizing the liquidity opportunity.
"""

from PIL import Image, ImageDraw, ImageFont
import os

# Configuration
WIDTH = 1200
HEIGHT = 1600
BACKGROUND_COLOR = "#0f1419"  # Dark background
PRIMARY_COLOR = "#00d4aa"  # Teal/green accent
SECONDARY_COLOR = "#1da1f2"  # Blue accent
TEXT_COLOR = "#ffffff"
MUTED_COLOR = "#8899a6"
CARD_COLOR = "#192734"

# Output path
OUTPUT_PATH = "/home/rickc/OmniBazaar/Documents/OmniBazaar_Yield_Infographic.png"
LOGO_PATH = "/home/rickc/OmniBazaar/OmniCoin-WhiteLetters1000x300.png"
GLOBE_PATH = "/home/rickc/OmniBazaar/UI Mockup/OmniBazaar Globe-clear-256x256.png"

def hex_to_rgb(hex_color):
    """Convert hex color to RGB tuple."""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def draw_rounded_rect(draw, coords, radius, fill):
    """Draw a rounded rectangle."""
    x1, y1, x2, y2 = coords
    draw.rectangle([x1 + radius, y1, x2 - radius, y2], fill=fill)
    draw.rectangle([x1, y1 + radius, x2, y2 - radius], fill=fill)
    draw.ellipse([x1, y1, x1 + 2*radius, y1 + 2*radius], fill=fill)
    draw.ellipse([x2 - 2*radius, y1, x2, y1 + 2*radius], fill=fill)
    draw.ellipse([x1, y2 - 2*radius, x1 + 2*radius, y2], fill=fill)
    draw.ellipse([x2 - 2*radius, y2 - 2*radius, x2, y2], fill=fill)

def create_infographic():
    """Create the infographic."""
    # Create base image
    img = Image.new('RGB', (WIDTH, HEIGHT), hex_to_rgb(BACKGROUND_COLOR))
    draw = ImageDraw.Draw(img)

    # Try to load fonts, fall back to default
    try:
        font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 48)
        font_medium = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 32)
        font_normal = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20)
        font_tiny = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
    except:
        font_large = ImageFont.load_default()
        font_medium = font_large
        font_normal = font_large
        font_small = font_large
        font_tiny = font_large

    y_pos = 30

    # Try to add logo
    try:
        logo = Image.open(LOGO_PATH)
        logo = logo.resize((400, 120), Image.Resampling.LANCZOS)
        # Center the logo
        logo_x = (WIDTH - 400) // 2
        img.paste(logo, (logo_x, y_pos), logo if logo.mode == 'RGBA' else None)
        y_pos += 140
    except Exception as e:
        # Draw text header instead
        draw.text((WIDTH//2, y_pos + 50), "OmniBazaar", font=font_large, fill=hex_to_rgb(PRIMARY_COLOR), anchor="mm")
        y_pos += 120

    # Title
    draw.text((WIDTH//2, y_pos), "YIELD OPPORTUNITY", font=font_large, fill=hex_to_rgb(TEXT_COLOR), anchor="mm")
    y_pos += 60

    # Subtitle
    draw.text((WIDTH//2, y_pos), "45-180% Projected APY | Dutch Auction LBP | Guaranteed Bonding Discounts",
              font=font_small, fill=hex_to_rgb(MUTED_COLOR), anchor="mm")
    y_pos += 50

    # Key Stats Bar
    draw_rounded_rect(draw, (50, y_pos, WIDTH-50, y_pos + 80), 10, hex_to_rgb(CARD_COLOR))
    stats = [
        ("APY Range", "45-180%"),
        ("Treasury", "2.5B XOM"),
        ("Total Supply", "16.6B"),
        ("Launch", "Day 1 Full Platform")
    ]
    stat_width = (WIDTH - 100) // 4
    for i, (label, value) in enumerate(stats):
        x = 50 + stat_width * i + stat_width // 2
        draw.text((x, y_pos + 25), value, font=font_medium, fill=hex_to_rgb(PRIMARY_COLOR), anchor="mm")
        draw.text((x, y_pos + 55), label, font=font_tiny, fill=hex_to_rgb(MUTED_COLOR), anchor="mm")
    y_pos += 100

    # Three Strategy Cards
    card_width = (WIDTH - 140) // 3
    card_height = 280

    strategies = [
        {
            "title": "LBP",
            "subtitle": "Dutch Auction",
            "apy": "80-150%",
            "details": [
                "Price starts HIGH",
                "Falls over 72 hours",
                "Enter at YOUR price",
                "No front-running"
            ],
            "color": PRIMARY_COLOR
        },
        {
            "title": "BONDING",
            "subtitle": "Guaranteed Discount",
            "apy": "182-260%",
            "details": [
                "5-15% discount",
                "7-30 day vesting",
                "No impermanent loss",
                "Compound returns"
            ],
            "color": SECONDARY_COLOR
        },
        {
            "title": "MINING",
            "subtitle": "Passive Income",
            "apy": "36-365%",
            "details": [
                "Stake LP tokens",
                "30% immediate",
                "70% vests 90 days",
                "Early = highest APY"
            ],
            "color": "#9b59b6"
        }
    ]

    for i, strat in enumerate(strategies):
        x = 50 + (card_width + 20) * i
        draw_rounded_rect(draw, (x, y_pos, x + card_width, y_pos + card_height), 15, hex_to_rgb(CARD_COLOR))

        # Title
        draw.text((x + card_width//2, y_pos + 30), strat["title"], font=font_medium,
                  fill=hex_to_rgb(strat["color"]), anchor="mm")
        draw.text((x + card_width//2, y_pos + 60), strat["subtitle"], font=font_tiny,
                  fill=hex_to_rgb(MUTED_COLOR), anchor="mm")

        # APY
        draw.text((x + card_width//2, y_pos + 100), strat["apy"] + " APY", font=font_medium,
                  fill=hex_to_rgb(TEXT_COLOR), anchor="mm")

        # Details
        for j, detail in enumerate(strat["details"]):
            draw.text((x + 20, y_pos + 140 + j * 30), f"• {detail}", font=font_small,
                      fill=hex_to_rgb(TEXT_COLOR))

    y_pos += card_height + 30

    # Timeline Section
    draw.text((WIDTH//2, y_pos), "LAUNCH TIMELINE", font=font_medium, fill=hex_to_rgb(TEXT_COLOR), anchor="mm")
    y_pos += 50

    # Timeline bar
    timeline_y = y_pos + 20
    draw.rectangle((100, timeline_y, WIDTH-100, timeline_y + 4), fill=hex_to_rgb(MUTED_COLOR))

    phases = [
        ("Week 1-2", "LBP Launch", "Dutch auction price discovery"),
        ("Week 2+", "Bonding Opens", "5-15% guaranteed discounts"),
        ("Week 3+", "Mining Active", "Stake LP for rewards")
    ]

    phase_width = (WIDTH - 200) // 3
    for i, (timing, title, desc) in enumerate(phases):
        x = 100 + phase_width * i + phase_width // 2
        # Circle on timeline
        draw.ellipse((x-8, timeline_y-6, x+8, timeline_y+10), fill=hex_to_rgb(PRIMARY_COLOR))
        draw.text((x, timeline_y + 30), timing, font=font_small, fill=hex_to_rgb(PRIMARY_COLOR), anchor="mm")
        draw.text((x, timeline_y + 55), title, font=font_normal, fill=hex_to_rgb(TEXT_COLOR), anchor="mm")
        draw.text((x, timeline_y + 80), desc, font=font_tiny, fill=hex_to_rgb(MUTED_COLOR), anchor="mm")

    y_pos += 140

    # Return Scenarios
    draw.text((WIDTH//2, y_pos), "RETURN SCENARIOS (6-MONTH)", font=font_medium, fill=hex_to_rgb(TEXT_COLOR), anchor="mm")
    y_pos += 40

    # Table header
    draw_rounded_rect(draw, (50, y_pos, WIDTH-50, y_pos + 40), 5, hex_to_rgb(CARD_COLOR))
    headers = ["Scenario", "LBP", "Bonding", "Mining", "Blended"]
    col_width = (WIDTH - 100) // 5
    for i, header in enumerate(headers):
        x = 50 + col_width * i + col_width // 2
        draw.text((x, y_pos + 20), header, font=font_small, fill=hex_to_rgb(MUTED_COLOR), anchor="mm")
    y_pos += 45

    # Table rows
    scenarios = [
        ("Conservative", "+15%", "+26%", "+36%", "+25%"),
        ("Base Case", "+75%", "+67%", "+50%", "+65%"),
        ("Optimistic", "+275%", "+220%", "+175%", "+220%")
    ]

    for scenario in scenarios:
        for i, val in enumerate(scenario):
            x = 50 + col_width * i + col_width // 2
            color = PRIMARY_COLOR if i == 4 else TEXT_COLOR
            draw.text((x, y_pos + 15), val, font=font_small, fill=hex_to_rgb(color), anchor="mm")
        y_pos += 35

    y_pos += 20

    # Treasury Backing Section
    draw_rounded_rect(draw, (50, y_pos, WIDTH-50, y_pos + 120), 15, hex_to_rgb(CARD_COLOR))
    draw.text((WIDTH//2, y_pos + 25), "TREASURY BACKING YOUR RETURNS", font=font_normal,
              fill=hex_to_rgb(PRIMARY_COLOR), anchor="mm")
    draw.text((WIDTH//2, y_pos + 60), "2.5 Billion XOM = $12.5M dedicated to investor rewards",
              font=font_small, fill=hex_to_rgb(TEXT_COLOR), anchor="mm")
    draw.text((WIDTH//2, y_pos + 90), "Self-funding model: Bonding & LBP generate USDC inflows exceeding commitments",
              font=font_tiny, fill=hex_to_rgb(MUTED_COLOR), anchor="mm")
    y_pos += 140

    # Platform Components
    draw.text((WIDTH//2, y_pos), "LAUNCHING DAY 1", font=font_medium, fill=hex_to_rgb(TEXT_COLOR), anchor="mm")
    y_pos += 40

    components = [
        ("RWA Aggregator", "Tokenized real-world assets"),
        ("DEX", "10,000+ orders/sec"),
        ("Web3 Wallet", "128 chains"),
        ("Marketplace", "Zero on-chain fees")
    ]

    comp_width = (WIDTH - 100) // 4
    for i, (name, desc) in enumerate(components):
        x = 50 + comp_width * i + comp_width // 2
        draw.text((x, y_pos), name, font=font_small, fill=hex_to_rgb(PRIMARY_COLOR), anchor="mm")
        draw.text((x, y_pos + 25), desc, font=font_tiny, fill=hex_to_rgb(MUTED_COLOR), anchor="mm")

    y_pos += 70

    # Call to Action
    draw_rounded_rect(draw, (200, y_pos, WIDTH-200, y_pos + 60), 30, hex_to_rgb(PRIMARY_COLOR))
    draw.text((WIDTH//2, y_pos + 30), "PARTICIPATION WINDOW IS LIMITED", font=font_normal,
              fill=hex_to_rgb(BACKGROUND_COLOR), anchor="mm")
    y_pos += 80

    # Links
    draw.text((WIDTH//2, y_pos), "omnibazaar.com | whitepaper.omnibazaar.com | tinyurl.com/obdeck1",
              font=font_tiny, fill=hex_to_rgb(MUTED_COLOR), anchor="mm")
    y_pos += 30

    # Disclaimer
    draw.text((WIDTH//2, y_pos), "Not financial advice. Crypto investments carry significant risk.",
              font=font_tiny, fill=hex_to_rgb(MUTED_COLOR), anchor="mm")

    # Save
    img.save(OUTPUT_PATH, "PNG", quality=95)
    print(f"Infographic saved to: {OUTPUT_PATH}")
    return OUTPUT_PATH

if __name__ == "__main__":
    create_infographic()
