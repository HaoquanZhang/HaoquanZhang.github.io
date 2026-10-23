"""Build the original square-pixel lettering for the title and PixelBench wordmark.

The resulting WOFF2 is a real, selectable-text font. FontTools and Brotli are
needed only to regenerate it, not to build or serve the site.
"""
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

# Each 1 is one square. Lowercase p/y descend two squares below the baseline.
GLYPHS = {
    'P': (700, ['11110', '10001', '10001', '11110', '10000', '10000', '10000']),
    'B': (700, ['11110', '10001', '10001', '11110', '10001', '10001', '11110']),
    'p': (500, ['11110', '10001', '10001', '11110', '10000', '10000', '10000']),
    'i': (700, ['010', '000', '110', '010', '010', '010', '111']),
    'x': (500, ['10001', '01010', '00100', '01010', '10001']),
    'e': (500, ['01110', '10001', '11111', '10000', '01111']),
    'l': (700, ['10', '10', '10', '10', '10', '10', '11']),
    'b': (700, ['10000', '10000', '11110', '10001', '10001', '10001', '11110']),
    'n': (500, ['11110', '10001', '10001', '10001', '10001']),
    'c': (500, ['01111', '10000', '10000', '10000', '01111']),
    'h': (700, ['10000', '10000', '11110', '10001', '10001', '10001', '10001']),
    'y': (500, ['10001', '10001', '10001', '01111', '00001', '10001', '01110']),
    '?': (700, ['01110', '10001', '00001', '00010', '00100', '00000', '00100']),
}
font = FontBuilder(1000, isTTF=True)
names = {character: f'uni{ord(character):04X}' for character in GLYPHS}
font.setupGlyphOrder(['.notdef', 'space', *names.values()])
font.setupCharacterMap({32: 'space', **{ord(c): name for c, name in names.items()}})
outlines = {name: TTGlyphPen(None).glyph() for name in ['.notdef', 'space']}
metrics = {'.notdef': (500, 0), 'space': (320, 0)}
for character, (top, rows) in GLYPHS.items():
    pen = TTGlyphPen(None)
    for row, cells in enumerate(rows):
        # Adjacent pixels in a row share one contour to avoid hairline seams.
        column = 0
        while column < len(cells):
            if cells[column] == '0':
                column += 1
                continue
            start = column
            while column < len(cells) and cells[column] == '1':
                column += 1
            left, right = start * 100, column * 100
            bottom = top - (row + 1) * 100
            pen.moveTo((left, bottom))
            pen.lineTo((left, bottom + 100))
            pen.lineTo((right, bottom + 100))
            pen.lineTo((right, bottom))
            pen.closePath()
    outlines[names[character]] = pen.glyph()
    metrics[names[character]] = ((len(rows[0]) + 1) * 100, 0)
font.setupGlyf(outlines)
font.setupHorizontalMetrics(metrics)
font.setupHorizontalHeader(ascent=800, descent=-200)
font.setupNameTable({'familyName': 'PixelBench Title', 'styleName': 'Regular',
                    'uniqueFontIdentifier': 'PixelBenchTitle-1.0',
                    'fullName': 'PixelBench Title Regular',
                    'psName': 'PixelBenchTitle-Regular', 'version': 'Version 1.0'})
font.setupOS2(sTypoAscender=800, sTypoDescender=-200, sTypoLineGap=0,
              usWinAscent=800, usWinDescent=200, sxHeight=500, sCapHeight=700)
font.setupPost()
font.font.flavor = 'woff2'
destination = Path(__file__).resolve().parent / 'assets/fonts/pixel-title.woff2'
font.save(destination)
print(f'Built {destination.name}: {destination.stat().st_size} bytes')
