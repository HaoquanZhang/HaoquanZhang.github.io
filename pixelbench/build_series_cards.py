"""Build Cards 3, 4, and 5 of the 16:9 (1920x1080) PixelBench Twitter promotion series."""
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


def image_data_uri(rel_path: str) -> str:
    """Encode a PNG file as a base64 data URI."""
    path = ROOT / rel_path
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def load_json(rel_path: str) -> dict:
    """Load a JSON file relative to pixelbench/."""
    return json.loads((ROOT / rel_path).read_text())


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


def common_head(title: str, pixel_font: str, charter_roman: str, extra_css: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>{title}</title>
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
    --mono: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
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

  {extra_css}
</style>
</head>
"""


def fit_script() -> str:
    return """  <script>
    function fitStage() {
      const stage = document.getElementById('stage');
      const scaleX = window.innerWidth / 1920;
      const scaleY = window.innerHeight / 1080;
      const scale = Math.min(scaleX, scaleY);
      stage.style.transform = `scale(${scale})`;
    }
    window.addEventListener('resize', fitStage);
    fitStage();
  </script>
</body>
</html>
"""


# ---------------------------------------------------------------------------
# Card 3: Image-to-Pixel (I2P) Leaderboard + Source + 32x32 Reconstructions
# ---------------------------------------------------------------------------
def build_i2p_card(pixel_font: str, charter_roman: str) -> str:
    case_id = "imagenet_0176"
    case_label = "Saluki"
    source_uri = image_data_uri(f"assets/raw/i2p/{case_id}/source.png")

    # Sorted by Avg SigLIP similarity
    entries = [
        {
            "id": "gpt6astra",
            "name": "GPT-6",
            "sub": "Astra",
            "score": 0.654,
            "color": "#233d4d",
            "is_algo": False,
        },
        {
            "id": "gpt56sol",
            "name": "GPT-5.6",
            "sub": "Sol",
            "score": 0.588,
            "color": "#386077",
            "is_algo": False,
        },
        {
            "id": "opus5",
            "name": "Claude",
            "sub": "Opus 5",
            "score": 0.561,
            "color": "#4f7991",
            "is_algo": False,
        },
        {
            "id": "seed21pro",
            "name": "Seed-2.1",
            "sub": "Pro",
            "score": 0.547,
            "color": "#6690a8",
            "is_algo": False,
        },
        {
            "id": "alik3",
            "name": "Kimi",
            "sub": "K3",
            "score": 0.541,
            "color": "#7ca3b9",
            "is_algo": False,
        },
        {
            "id": "gemini36",
            "name": "Gemini 3.6",
            "sub": "Flash",
            "score": 0.539,
            "color": "#93b5c8",
            "is_algo": False,
        },
        {
            "id": "pia_reduced",
            "name": "PIA",
            "sub": "Algorithm",
            "score": 0.617,
            "color": "#6e7b82",
            "is_algo": True,
        },
    ]

    # High-contrast bar scaling:
    # Lowest score (0.539) -> 54px (fits 28px white score cleanly inside),
    # Highest score (0.654) -> 344px (6.4x taller, leaves clean headroom in bar-stage!)
    min_s, max_s = 0.539, 0.654
    min_h, max_h = 54, 344

    cols_html = []

    for e in entries:
        t = (e["score"] - min_s) / (max_s - min_s)
        bar_h = round(min_h + (max_h - min_h) * (t ** 1.12))
        score_str = f'{e["score"]:.3f}'
        grid = load_json(f'assets/raw/i2p/{case_id}/{e["id"]}/32.json')
        svg = render_pixel_svg(grid)
        algo_cls = " algo-col" if e["is_algo"] else ""

        cols_html.append(
            f'<div class="model-col{algo_cls}">'
            f'  <div class="bar-stage">'
            f'    <div class="bar-fill" style="height:{bar_h}px; background:{e["color"]}">'
            f'      <span class="bar-score">{score_str}</span>'
            f"    </div>"
            f"  </div>"
            f'  <div class="model-label">'
            f'    <span class="model-name">{e["name"]}</span>'
            f'    <span class="model-sub">{e["sub"]}</span>'
            f"  </div>"
            f'  <div class="output-stage">{svg}</div>'
            f"</div>"
        )

    extra_css = """
  .title-row {
    align-items: center;
    margin-bottom: 22px;
  }

  .source-header-card {
    display: flex;
    align-items: center;
    gap: 18px;
    background: #f6f9fa;
    border: 1.5px solid var(--line);
    padding: 8px 16px 8px 10px;
  }

  .source-header-thumb {
    width: 68px;
    height: 68px;
    object-fit: cover;
    border: 1px solid #cfd8dc;
    display: block;
  }

  .source-header-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .source-header-eyebrow {
    font-family: var(--sans);
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--blue);
    text-transform: uppercase;
  }

  .source-header-title {
    font-family: var(--serif);
    font-size: 26px;
    color: var(--ink);
  }

  /* 7-Column Grid (matches Card 2's generous 226x226 image size & zero bottom dead space!) */
  .board-grid {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 28px;
    align-items: stretch;
  }

  .model-col {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .algo-col {
    padding-left: 12px;
    border-left: 2px dashed #c8d4da;
  }

  .bar-stage {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    border-bottom: 2px solid var(--ink);
    padding: 0 14px;
    background-image: linear-gradient(to bottom, #eef2f4 1px, transparent 1px);
    background-size: 100% 25%;
  }

  .bar-fill {
    width: 100%;
    border-radius: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .bar-score {
    font-family: var(--sans);
    font-size: 31px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.03em;
  }

  .model-label {
    height: 92px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 4px;
  }

  .model-name {
    font-family: var(--serif);
    font-size: 29px;
    line-height: 1.15;
    color: var(--ink);
    font-weight: 600;
  }

  .model-sub {
    font-family: var(--serif);
    font-size: 24px;
    line-height: 1.15;
    color: var(--muted);
  }

  .output-stage {
    width: 100%;
    aspect-ratio: 1;
    flex-shrink: 0;
    border: 1.5px solid var(--line);
    overflow: hidden;
  }

  .output-stage .pixel-svg {
    width: 100%;
    height: 100%;
    display: block;
  }
"""
    head = common_head(
        "PixelBench — I2P Leaderboard & Reconstructions (16:9)",
        pixel_font,
        charter_roman,
        extra_css,
    )
    return (
        head
        + f"""<body>
  <div class="stage-wrapper" id="stage">
    <header class="top-row">
      <span class="wordmark">PixelBench</span>
      <span class="project-url">haoquanzhang.github.io/pixelbench</span>
    </header>

    <section class="title-row">
      <h1 class="chart-title">
        Image-to-Pixel similarity &amp; reconstructions
      </h1>
      <div class="source-header-card">
        <img class="source-header-thumb" src="{source_uri}" alt="{case_label}"/>
        <div class="source-header-meta">
          <span class="source-header-eyebrow">SigLIP Similarity · Source Photo</span>
          <span class="source-header-title"><strong>“{case_label}”</strong> → 32 × 32 Grid</span>
        </div>
      </div>
    </section>

    <section class="board-grid">
      {''.join(cols_html)}
    </section>
  </div>
"""
        + fit_script()
    )


# ---------------------------------------------------------------------------
# Card 4: Resolution Scaling (Large Source Image + 2-Line Model Names + Full 10-Resolution Matrix)
# ---------------------------------------------------------------------------
def build_scaling_card(pixel_font: str, charter_roman: str) -> str:
    scaling = load_json("assets/scaling/scaling.json")
    sizes = scaling["sizes"]  # All 10 resolutions: [16, 24, 32, 40, 48, 64, 80, 96, 112, 128]

    models_meta = [
        {"id": "gpt6astra", "line1": "GPT-6", "line2": "Astra", "color": "#233d4d"},
        {"id": "gpt56sol", "line1": "GPT-5.6", "line2": "Sol", "color": "#448568"},
        {"id": "opus5", "line1": "Claude", "line2": "Opus 5", "color": "#c97355"},
        {"id": "gemini36", "line1": "Gemini 3.6", "line2": "Flash", "color": "#6490a8"},
    ]

    case_id = "imagenet_0952"
    source_uri = image_data_uri(f"assets/scaling/i2p/{case_id}/source.png")

    header_cells = ['<div class="matrix-corner"></div>']
    for s in sizes:
        header_cells.append(f'<div class="size-head">{s}²</div>')

    matrix_rows_html = [f'<div class="matrix-header-row">{"".join(header_cells)}</div>']
    for m in models_meta:
        row_cells = [
            f'<div class="model-row-label">'
            f'  <span class="model-bar" style="background:{m["color"]}"></span>'
            f'  <div class="model-row-text">'
            f'    <span class="model-line1">{m["line1"]}</span>'
            f'    <span class="model-line2">{m["line2"]}</span>'
            f"  </div>"
            f"</div>"
        ]
        for s in sizes:
            grid = load_json(f'assets/scaling/i2p/{case_id}/{m["id"]}-{s}.json')
            svg = render_pixel_svg(grid)
            row_cells.append(f'<div class="scale-cell">{svg}</div>')
        matrix_rows_html.append(f'<div class="matrix-row">{"".join(row_cells)}</div>')

    extra_css = """
  .scaling-title-block {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 18px;
    flex-shrink: 0;
  }

  .scaling-main-title {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 78px;
    line-height: 1.05;
    letter-spacing: -2.4px;
    color: var(--ink);
  }

  .scaling-subtitle {
    font-family: var(--serif);
    font-size: 38px;
    line-height: 1.2;
    color: var(--muted);
    letter-spacing: -0.6px;
  }

  .scaling-subtitle .consistent {
    color: var(--blue);
    font-weight: 600;
  }

  .scaling-subtitle .failed {
    color: #b45848;
    font-weight: 600;
  }

  /* Left: Large Source Image (~2 rows tall) | Right: 2-Line Model Names + All 10 Resolutions */
  .scaling-body {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 292px minmax(0, 1fr);
    gap: 32px;
    align-items: center;
  }

  .source-showcase {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-top: 26px;
  }

  .source-frame {
    width: 292px;
    height: 292px;
    border: 4px solid #111416;
    overflow: hidden;
    background: #f6f8f9;
  }

  .source-frame img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .source-caption {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .source-caption-title {
    font-family: var(--serif);
    font-size: 31px;
    font-weight: 600;
    color: var(--ink);
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  .source-caption-sub {
    font-family: var(--sans);
    font-size: 21px;
    font-weight: 500;
    color: var(--muted);
  }

  .matrix-col {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 10px;
  }

  .matrix-header-row {
    display: grid;
    grid-template-columns: 176px repeat(10, minmax(0, 1fr));
    gap: 0;
    align-items: end;
    margin-bottom: -4px;
  }

  .matrix-row {
    display: grid;
    grid-template-columns: 176px repeat(10, minmax(0, 1fr));
    gap: 0;
    align-items: center;
  }

  .size-head {
    font-family: var(--sans);
    font-size: 24px;
    font-weight: 700;
    color: var(--ink);
    text-align: center;
  }

  .model-row-label {
    display: flex;
    align-items: center;
    gap: 14px;
    padding-right: 14px;
  }

  .model-bar {
    width: 8px;
    height: 64px;
    flex-shrink: 0;
  }

  .model-row-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .model-line1 {
    font-family: var(--serif);
    font-size: 31px;
    line-height: 1.08;
    font-weight: 600;
    color: var(--ink);
    white-space: nowrap;
  }

  .model-line2 {
    font-family: var(--serif);
    font-size: 27px;
    line-height: 1.08;
    color: var(--muted);
    white-space: nowrap;
  }

  /* Zero horizontal gap + crisp 4px bold black border (collapse adjacent borders via margin-left) */
  .scale-cell {
    width: 100%;
    aspect-ratio: 1;
    border: 4px solid #111416;
    overflow: hidden;
  }

  .scale-cell + .scale-cell {
    margin-left: -4px;
    width: calc(100% + 4px);
  }

  .scale-cell .pixel-svg {
    width: 100%;
    height: 100%;
    display: block;
  }
"""
    head = common_head(
        "PixelBench — Resolution Scaling (16:9)",
        pixel_font,
        charter_roman,
        extra_css,
    )
    return (
        head
        + f"""<body>
  <div class="stage-wrapper" id="stage">
    <header class="top-row">
      <span class="wordmark">PixelBench</span>
      <span class="project-url">haoquanzhang.github.io/pixelbench</span>
    </header>

    <section class="scaling-title-block">
      <h1 class="scaling-main-title">
        What happens when resolution scales?
      </h1>
      <p class="scaling-subtitle">
        Some models <span class="failed">fail</span> as the grid grows — some stay <span class="consistent">consistent</span>.
      </p>
    </section>

    <section class="scaling-body">
      <div class="source-showcase">
        <div class="source-frame">
          <img src="{source_uri}" alt="Source fig"/>
        </div>
        <div class="source-caption">
          <div class="source-caption-title">
            <span>Source</span>
            <span class="source-caption-sub">“Fig”</span>
          </div>
          <span class="source-caption-sub">16 × 16 → 128 × 128</span>
        </div>
      </div>

      <div class="matrix-col">
        {''.join(matrix_rows_html)}
      </div>
    </section>
  </div>
"""
        + fit_script()
    )


# ---------------------------------------------------------------------------
# Card 5: PRT (Pixel Reconstruction Tuning) Performance Gains
# ---------------------------------------------------------------------------
def build_prt_card(pixel_font: str, charter_roman: str) -> str:
    data = load_json("assets/data.json")
    rows = sorted(data["training"], key=lambda r: -r["delta"])

    # 16 individual benchmarks + 1 single Average (+0.6) bar
    all_items = rows + [
        {"name": "Average", "delta": 0.6, "is_avg": True},
    ]

    # Exact content width = 1920 - 2 * 96 = 1728px.
    W, H = 1728, 790
    zero_y = 602  # Shifted slightly downward for better top/bottom breathing room
    scale = 365   # +1.4 -> 511px tall bar (y = 91)

    chart_left = 70
    chart_right = 1728
    bar_w = 56    # Natural, well-proportioned bar width
    step = 96     # Wider horizontal spacing across 16 benchmarks (x = 114 .. 1554)
    div_x = 1618  # Dashed divider before the single Average bar
    avg_x = 1692  # Single Average bar centered at 1692 (right edge near 1720)

    svg_parts = [
        f'<svg class="prt-svg" viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg">'
    ]

    # Horizontal gridlines for 0, +0.5, +1.0, +1.5
    for val in [0.0, 0.5, 1.0, 1.5]:
        y = zero_y - val * scale
        is_zero = val == 0.0
        stroke = "#252a2c" if is_zero else "#e4ebe8"
        sw = "2.4" if is_zero else "1.5"
        svg_parts.append(
            f'<line x1="{chart_left}" x2="{chart_right}" y1="{y:.1f}" y2="{y:.1f}" '
            f'stroke="{stroke}" stroke-width="{sw}"/>'
        )
        label = f"+{val:g}" if val > 0 else "0"
        svg_parts.append(
            f'<text x="0" y="{y + 9:.1f}" text-anchor="start" class="prt-tick">{label}</text>'
        )

    # Single-line plain text Δ Score definition in the open upper-right region (no background box)
    svg_parts.append(
        f'<text x="1576" y="126" text-anchor="end" class="callout-plain">'
        f'  <tspan font-weight="700" fill="#345b70">Δ Score</tspan> = '
        f'Post-training data &amp; Pixel Reconstruction Tuning data '
        f'<tspan font-weight="700" fill="#345b70">−</tspan> Post-training data only'
        f'</text>'
    )

    # Dashed divider before the single Average column
    svg_parts.append(
        f'<line x1="{div_x}" x2="{div_x}" y1="54" y2="{zero_y + 42}" '
        f'stroke="#b8c7cf" stroke-width="2.2" stroke-dasharray="7 7"/>'
    )

    for idx, item in enumerate(all_items):
        is_avg = item.get("is_avg", False)
        x = 114 + idx * step if not is_avg else avg_x

        val = item["delta"]
        neutral = (177, 194, 183)
        target = (36, 122, 75) if val > 0 else (186, 88, 76)
        weight = min(1.0, abs(val) / (1.4 if val > 0 else 0.3)) ** 0.5
        if val == 0:
            color = "#9ca4a1"
        elif is_avg:
            color = "#233d4d"
        else:
            color = "#" + "".join(
                f"{round(a + (b - a) * weight):02x}" for a, b in zip(neutral, target)
            )

        bar_h = abs(val) * scale if val != 0 else 4
        y = min(zero_y, zero_y - val * scale) if val != 0 else zero_y - 2

        svg_parts.append(
            f'<rect x="{x - bar_w / 2:.1f}" y="{y:.1f}" width="{bar_w}" height="{bar_h:.1f}" '
            f'fill="{color}" shape-rendering="crispEdges"/>'
        )

        delta_str = f"{val:+.1f}" if val != 0 else "0.0"
        if val >= 0:
            val_y = y - 16
            val_cls = "prt-val is-avg" if is_avg else "prt-val"
        else:
            val_y = zero_y - 16
            val_cls = "prt-val is-neg"

        svg_parts.append(
            f'<text x="{x:.1f}" y="{val_y:.1f}" text-anchor="middle" class="{val_cls}">{delta_str}</text>'
        )

        lbl_y = zero_y + 44 if val >= 0 else zero_y + bar_h + 40
        lbl_cls = "prt-bench is-avg" if is_avg else "prt-bench"
        name = item["name"]
        svg_parts.append(
            f'<text x="{x + 8:.1f}" y="{lbl_y:.1f}" text-anchor="end" '
            f'transform="rotate(-40 {x + 8:.1f} {lbl_y:.1f})" class="{lbl_cls}">{name}</text>'
        )

    svg_parts.append("</svg>")

    extra_css = """
  .title-row {
    margin-bottom: 14px;
  }

  /* Single-line full-width serif title (normal Charter/Cambria serif font throughout) */
  .prt-single-title {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 71.5px;
    line-height: 1.08;
    letter-spacing: -1.75px;
    color: var(--ink);
    white-space: nowrap;
  }

  .prt-deck {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: stretch;
    justify-content: center;
  }

  .prt-svg {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
  }

  .prt-tick {
    font-family: var(--sans);
    font-size: 26px;
    font-weight: 600;
    fill: var(--muted);
  }

  .prt-val {
    font-family: var(--sans);
    font-size: 28px;
    font-weight: 700;
    fill: var(--ink);
    letter-spacing: -0.02em;
  }

  .prt-val.is-avg {
    font-size: 30px;
    fill: var(--blue);
  }

  .prt-val.is-neg {
    fill: #a8493d;
  }

  .prt-bench {
    font-family: var(--serif);
    font-size: 26px;
    fill: var(--ink);
  }

  .prt-bench.is-avg {
    font-weight: 700;
    fill: var(--blue);
  }

  .callout-plain {
    font-family: var(--serif);
    font-size: 26px;
    fill: var(--ink);
  }
"""
    head = common_head(
        "PixelBench — Pixel Reconstruction Tuning (16:9)",
        pixel_font,
        charter_roman,
        extra_css,
    )
    return (
        head
        + f"""<body>
  <div class="stage-wrapper" id="stage">
    <header class="top-row">
      <span class="wordmark">PixelBench</span>
      <span class="project-url">haoquanzhang.github.io/pixelbench</span>
    </header>

    <section class="title-row">
      <h1 class="prt-single-title">
        Pixel Reconstruction Tuning improves VLM understanding
      </h1>
    </section>

    <section class="prt-deck">
      {''.join(svg_parts)}
    </section>
  </div>
"""
        + fit_script()
    )


def main() -> None:
    pixel_font = font_data_uri("pixel-title.woff2")
    charter_roman = font_data_uri("charter-roman.woff2")

    outputs = [
        ("i2p-card.html", build_i2p_card(pixel_font, charter_roman)),
        ("scaling-card.html", build_scaling_card(pixel_font, charter_roman)),
        ("prt-card.html", build_prt_card(pixel_font, charter_roman)),
    ]

    for filename, html in outputs:
        path = ROOT / filename
        path.write_text(html, encoding="utf-8")
        print(f"Wrote {path} ({path.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
