"""Build Card 2: 16:9 (1920x1080) PixelBench T2P Leaderboard + 32x32 Model Outputs."""
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


def load_grid(concept: str, size: int, model: str) -> dict:
    """Load a T2P JSON grid asset."""
    path = ROOT / "assets" / "raw" / "t2p" / concept / model / f"{size}.json"
    return json.loads(path.read_text())


def render_pixel_svg(data: dict, svg_class: str = "pixel-svg") -> str:
    """Render a palette+grid JSON object into a crisp inline SVG."""
    w, h = data["width"], data["height"]
    palette = data["palette"]
    pixels = data["pixels"]

    parts = [
        f'<svg class="{svg_class}" viewBox="0 0 {w} {h}" '
        f'xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">'
    ]
    parts.append(f'<rect x="0" y="0" width="{w}" height="{h}" fill="{palette[0]}"/>')

    for r, row in enumerate(pixels):
        c = 0
        while c < w:
            idx = row[c]
            start = c
            while c < w and row[c] == idx:
                c += 1
            if idx != 0:
                color = palette[idx]
                parts.append(
                    f'<rect x="{start}" y="{r}" width="{c - start}" height="1" fill="{color}"/>'
                )

    parts.append("</svg>")
    return "".join(parts)


def build_html(concept: str = "owl", concept_label: str = "Owl") -> str:
    pixel_font = font_data_uri("pixel-title.woff2")
    charter_roman = font_data_uri("charter-roman.woff2")

    models = [
        {
            "id": "gpt6astra",
            "name": "GPT-6",
            "sub": "Astra",
            "score": 91.0,
            "color": "#233d4d",
        },
        {
            "id": "opus5",
            "name": "Claude",
            "sub": "Opus 5",
            "score": 85.7,
            "color": "#345b70",
        },
        {
            "id": "gpt56sol",
            "name": "GPT-5.6",
            "sub": "Sol",
            "score": 85.3,
            "color": "#436e86",
        },
        {
            "id": "alik3",
            "name": "Kimi",
            "sub": "K3",
            "score": 81.7,
            "color": "#54819a",
        },
        {
            "id": "gemini36",
            "name": "Gemini 3.6",
            "sub": "Flash",
            "score": 79.0,
            "color": "#6793ab",
        },
        {
            "id": "seed21pro",
            "name": "Seed-2.1",
            "sub": "Pro",
            "score": 72.0,
            "color": "#7ea5bb",
        },
        {
            "id": "deepseekv4",
            "name": "DeepSeek",
            "sub": "V4 Pro",
            "score": 53.0,
            "color": "#96b6c8",
        },
    ]

    # High-contrast bar scaling:
    # Lowest (53.0%) -> 54px (fits 31px score cleanly inside),
    # Highest (91.0%) -> 352px (6.5x taller!)
    min_s, max_s = 53.0, 91.0
    min_h, max_h = 54, 352

    columns_html = []
    for m in models:
        t = (m["score"] - min_s) / (max_s - min_s)
        bar_h = round(min_h + (max_h - min_h) * (t ** 1.25))
        score_str = f'{m["score"]:.1f}'.rstrip("0").rstrip(".") + "%"
        svg = render_pixel_svg(load_grid(concept, 32, m["id"]))

        columns_html.append(
            f'<div class="model-col">'
            f'  <div class="bar-stage">'
            f'    <div class="bar-fill" style="height:{bar_h}px; background:{m["color"]}">'
            f'      <span class="bar-score">{score_str}</span>'
            f"    </div>"
            f"  </div>"
            f'  <div class="model-label">'
            f'    <span class="model-name">{m["name"]}</span>'
            f'    <span class="model-sub">{m["sub"]}</span>'
            f"  </div>"
            f'  <div class="output-stage">{svg}</div>'
            f"</div>"
        )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>PixelBench — T2P Leaderboard &amp; Outputs (16:9)</title>
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
    padding: 56px 96px 52px;
    display: flex;
    flex-direction: column;
    transform-origin: center center;
  }}

  .top-row {{
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 24px;
    flex-shrink: 0;
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

  .title-row {{
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 28px;
    flex-shrink: 0;
  }}

  .chart-title {{
    font-family: var(--serif);
    font-weight: 400;
    font-size: 76px;
    line-height: 1.06;
    letter-spacing: -2.4px;
    color: var(--ink);
  }}

  .chart-title .pixel-title {{
    font-family: 'PixelTitle', monospace;
    font-size: 0.92em;
    color: var(--blue);
  }}

  .prompt-pill {{
    font-family: var(--serif);
    font-size: 30px;
    color: var(--muted);
  }}

  .prompt-pill strong {{
    color: var(--ink);
    font-weight: 600;
  }}

  .board-grid {{
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 28px;
    align-items: stretch;
  }}

  .model-col {{
    display: flex;
    flex-direction: column;
    align-items: center;
  }}

  /* Top: Sharp Square-Cornered Vertical Score Bar */
  .bar-stage {{
    flex: 1;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    border-bottom: 2px solid var(--ink);
    padding: 0 16px;
    background-image: linear-gradient(to bottom, #eef2f4 1px, transparent 1px);
    background-size: 100% 25%;
  }}

  .bar-fill {{
    width: 100%;
    border-radius: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }}

  .bar-score {{
    font-family: var(--sans);
    font-size: 32px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.03em;
  }}

  /* Middle: Model Name */
  .model-label {{
    height: 92px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 4px;
  }}

  .model-name {{
    font-family: var(--serif);
    font-size: 29px;
    line-height: 1.15;
    color: var(--ink);
    font-weight: 600;
  }}

  .model-sub {{
    font-family: var(--serif);
    font-size: 24px;
    line-height: 1.15;
    color: var(--muted);
  }}

  /* Bottom: 32x32 Pixel Output */
  .output-stage {{
    width: 100%;
    aspect-ratio: 1;
    flex-shrink: 0;
    border: 1.5px solid var(--line);
    overflow: hidden;
  }}

  .output-stage .pixel-svg {{
    width: 100%;
    height: 100%;
    display: block;
  }}
</style>
</head>
<body>
  <div class="stage-wrapper" id="stage">
    <header class="top-row">
      <span class="wordmark">PixelBench</span>
      <span class="project-url">haoquanzhang.github.io/pixelbench</span>
    </header>

    <section class="title-row">
      <h1 class="chart-title">
        Text-to-Pixel accuracy &amp; generations
      </h1>
      <div class="prompt-pill">
        500-way Top-1 · Prompt: <strong>“{concept_label}”</strong> (32 × 32)
      </div>
    </section>

    <section class="board-grid">
      {''.join(columns_html)}
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
    out_path = ROOT / "t2p-card.html"
    out_path.write_text(build_html("owl", "Owl"), encoding="utf-8")
    print(f"Wrote {out_path} ({out_path.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
