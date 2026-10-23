"""Generate matching pixel and palette-index owl images for the homepage.

Run with Python and Pillow installed. All pixels and indices come from the
original PixelBench owl sample, with no border or outer padding.
"""
import json
from pathlib import Path
from PIL import Image, ImageColor

ROOT = Path(__file__).resolve().parents[1]
TILE = 1024
SAMPLES = [('owl', 32)]
collage = Image.new('RGB', (TILE, TILE))
svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">',
    '<title>PixelBench owl: original palette indices</title>',
    '<rect width="1024" height="1024" fill="white"/>',
]

for tile, (name, size) in enumerate(SAMPLES):
    path = ROOT / 'pixelbench/assets/raw/t2p' / name / 'gpt6astra' / f'{size}.json'
    raster = json.loads(path.read_text())
    assert raster['width'] == raster['height'] == size
    colors = [ImageColor.getrgb(color) for color in raster['palette']]
    pixels = Image.new('RGB', (size, size))
    pixels.putdata([colors[index] for row in raster['pixels'] for index in row])
    x0, y0 = (tile % 2) * TILE, (tile // 2) * TILE
    collage.paste(pixels.resize((TILE, TILE), Image.Resampling.NEAREST), (x0, y0))
    cell = TILE / size
    svg.append(f'<g font-family="Menlo,Consolas,monospace" font-weight="900" font-size="{cell * 1.1:g}" text-anchor="middle">')
    for y, row in enumerate(raster['pixels']):
        for x, index in enumerate(row):
            color = raster['palette'][index]
            svg.append(
                f'<text x="{x0 + (x + .5) * cell:g}" y="{y0 + (y + .9) * cell:g}" '
                f'textLength="{cell * .85:g}" lengthAdjust="spacingAndGlyphs" '
                f'fill="{color}" stroke="{color}" stroke-width="{cell * .045:g}">{index}</text>'
            )
    svg.append('</g>')

svg.append('</svg>')
collage.save(ROOT / 'images/pixelbench-owl.png', optimize=True)
(ROOT / 'images/pixelbench-owl-indices.svg').write_text('\n'.join(svg) + '\n')
