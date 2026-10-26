"""Build Card 1: 16:9 (1920x1080) PixelBench Intro & 16x16 Representation Card."""
from __future__ import annotations
from pathlib import Path
import base64
import json

ROOT = Path(__file__).resolve().parent


def font_data_uri(filename: str) -> str:
    """Encode a WOFF2 font file as a base64 data URI."""
    path = ROOT / "assets" / "fonts" / filename
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:font/woff2;base64,{encoded}"


def load_grid(concept: str, size: int, model: str = "gpt6astra") -> dict:
    """Load a T2P JSON grid asset."""
    path = ROOT / "assets" / "raw" / "t2p" / concept / model / f"{size}.json"
    return json.loads(path.read_text())


def darken_very_light_hex(hex_color: str) -> str:
    """Ensure very light palette colors remain clearly visible as digits on a white canvas."""
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0
    if luminance > 0.90:
        r = int(r * 0.84 + 28) if r == g == b else int(r * 0.88)
        g = int(g * 0.84 + 32) if r == g == b else int(g * 0.86)
        b = int(b * 0.84 + 36) if r == g == b else int(b * 0.82)
        return f"#{max(0, min(255, r)):02X}{max(0, min(255, g)):02X}{max(0, min(255, b)):02X}"
    return hex_color


def render_transition_svg(
    data: dict,
    svg_class: str = "pixel-svg",
) -> str:
    """Render a 16x16 pixel image that smoothly transitions from solid colors (left)
    to colored palette index digits (right) via opacity blending."""
    w, h = data["width"], data["height"]
    palette = data["palette"]
    pixels = data["pixels"]

    cell = 64
    vw, vh = w * cell, h * cell

    digit_palette = [darken_very_light_hex(c) for c in palette]

    parts = [
        f'<svg class="{svg_class}" viewBox="0 0 {vw} {vh}" '
        f'xmlns="http://www.w3.org/2000/svg">'
    ]
    parts.append(f'<rect width="{vw}" height="{vh}" fill="#ffffff"/>')

    font_size = cell * 0.68
    text_len = cell * 0.52
    stroke_w = cell * 0.028

    for r, row in enumerate(pixels):
        for c, idx in enumerate(row):
            x = c * cell
            y = r * cell
            if c <= 4:
                t = 0.0
            elif c >= 11:
                t = 1.0
            else:
                t = (c - 4) / 7.0

            rect_opacity = round(1.0 - t, 3)
            text_opacity = round(t, 3)

            if rect_opacity > 0:
                parts.append(
                    f'<rect x="{x}" y="{y}" width="{cell}" height="{cell}" '
                    f'fill="{palette[idx]}" fill-opacity="{rect_opacity}" '
                    f'shape-rendering="crispEdges"/>'
                )

            if text_opacity > 0:
                d_color = digit_palette[idx]
                cx = x + cell * 0.5
                cy = y + cell * 0.74
                parts.append(
                    f'<text x="{cx}" y="{cy}" text-anchor="middle" '
                    f'font-family="Menlo, Consolas, ui-monospace, monospace" '
                    f'font-weight="900" font-size="{font_size:.1f}" '
                    f'textLength="{text_len:.1f}" lengthAdjust="spacingAndGlyphs" '
                    f'fill="{d_color}" stroke="{d_color}" stroke-width="{stroke_w:.2f}" '
                    f'opacity="{text_opacity}">{idx}</text>'
                )

    parts.append("</svg>")
    return "".join(parts)


def build_html() -> str:
    pixel_font = font_data_uri("pixel-title.woff2")
    charter_roman = font_data_uri("charter-roman.woff2")

    cases_spec = [
        ("mushroom", "Mushroom", "16 × 16"),
        ("owl", "Owl", "16 × 16"),
        ("cherry", "Cherry", "16 × 16"),
        ("turtle", "Turtle", "16 × 16"),
    ]

    specimen_cards_html = []
    for slug, label, res_text in cases_spec:
        svg = render_transition_svg(load_grid(slug, 16))
        specimen_cards_html.append(
            f'<div class="specimen-card">'
            f'  <div class="specimen-art">{svg}</div>'
            f'  <div class="specimen-meta">'
            f'    <span class="specimen-name">{label}</span>'
            f'    <span class="specimen-res">{res_text}</span>'
            f"  </div>"
            f"</div>"
        )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>PixelBench — Twitter Card 1 (16:9)</title>
<style>
  @font-face {{
    font-family: 'PixelTitle';
    src: url('{pixel_font}') format('woff2');
    font-style: normal;
    font-weight: 400;
    font-display: block;
  }}
  @font-face {{
    font-family: 'Article';
    src: url('{charter_roman}') format('woff2');
    font-style: normal;
    font-weight: 400;
    font-display: block;
  }}

  :root {{
    --ink: #252a2c;
    --muted: #6e7579;
    --blue: #345b70;
    --line: #dfe5e8;
    --serif: 'Article', Georgia, 'Times New Roman', serif;
    --sans: -apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', Arial, sans-serif;
  }}

  * {{
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }}

  html, body {{
    width: 100%;
    height: 100%;
    background: #ffffff;
    color: var(--ink);
    font-family: var(--serif);
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }}

  .stage-wrapper {{
    width: 1920px;
    height: 1080px;
    background: #ffffff;
    padding: 58px 96px 52px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transform-origin: center center;
  }}

  .top-row {{
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }}

  .wordmark {{
    font-family: 'PixelTitle', monospace;
    font-size: 62px;
    line-height: 1;
    color: var(--ink);
    letter-spacing: 0;
  }}

  .project-url {{
    font-family: var(--sans);
    font-size: 34px;
    font-weight: 500;
    color: var(--blue);
    letter-spacing: -0.01em;
  }}

  .question-section {{
    margin: 4px 0 8px;
  }}

  .question-title {{
    font-family: var(--serif);
    font-weight: 400;
    font-size: 118px;
    line-height: 1.06;
    letter-spacing: -3.6px;
    color: var(--ink);
  }}

  .question-title .pixel-title {{
    font-family: 'PixelTitle', monospace;
    font-size: 0.92em;
    font-weight: 400;
    letter-spacing: -0.015em;
    color: var(--blue);
    white-space: nowrap;
  }}

  .cases-grid {{
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 36px;
    align-items: start;
  }}

  .specimen-card {{
    display: flex;
    flex-direction: column;
  }}

  .specimen-art {{
    width: 100%;
    aspect-ratio: 1;
    overflow: hidden;
    border: 1.5px solid var(--line);
  }}

  .specimen-art .pixel-svg {{
    width: 100%;
    height: 100%;
    display: block;
  }}

  .specimen-meta {{
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-top: 14px;
    padding: 0 2px;
  }}

  .specimen-name {{
    font-family: var(--serif);
    font-size: 34px;
    color: var(--ink);
  }}

  .specimen-res {{
    font-family: var(--serif);
    font-size: 26px;
    color: #83888b;
  }}
</style>
</head>
<body>
  <div class="stage-wrapper" id="stage">
    <header class="top-row">
      <span class="wordmark">PixelBench</span>
      <span class="project-url">haoquanzhang.github.io/pixelbench</span>
    </header>

    <section class="question-section">
      <h1 class="question-title">
        Can LLMs understand and<br/>
        generate images <span class="pixel-title">pixel by pixel?</span>
      </h1>
    </section>

    <section class="cases-grid">
      {''.join(specimen_cards_html)}
    </section>
  </div>

  <script>
    function fitStage() {{
      const stage = document.getElementById('stage');
      const scaleX = window.innerWidth / 1920;
      const scaleY = window.innerHeight / 1080;
      const scale = Math.min(scaleX, scaleY);
      stage.style.transform = `scale(${{scale}})`;
    }}
    window.addEventListener('resize', fitStage);
    fitStage();
  </script>
</body>
</html>
"""


def main() -> None:
    out_path = ROOT / "teaser-card.html"
    out_path.write_text(build_html(), encoding="utf-8")
    print(f"Wrote {out_path} ({out_path.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
