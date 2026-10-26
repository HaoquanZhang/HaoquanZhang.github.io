"""Build a portable static ZIP and a fully self-contained, offline HTML preview."""
import base64
import json
import mimetypes
import re
import zipfile
from build_article import main as build_article
build_article()
from pathlib import Path

SITE = Path(__file__).resolve().parent
OUT = SITE / 'dist'
OUT.mkdir(exist_ok=True)

def data_url(path):
    mime = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
    return f'data:{mime};base64,' + base64.b64encode(path.read_bytes()).decode()

html = (SITE / 'index.html').read_text()
css = (SITE / 'styles.css').read_text()
css = re.sub(r"url\('([^']+)'\)", lambda match: f"url('{data_url(SITE / match[1])}')", css)
html = re.sub(r'\s*<link[^>]*rel="preload"[^>]*>', '', html)
html = re.sub(r'<link[^>]*href="styles\.css(?:\?[^\"]*)?"[^>]*>', lambda _: f'<style>{css}</style>', html)
html = re.sub(r'(src|href)="(assets/[^\"]+\.(?:png|svg))"', lambda match: f'{match[1]}="{data_url(SITE / match[2])}"', html)
json_assets = {str(path.relative_to(SITE)): json.loads(path.read_text()) for path in sorted((SITE / 'assets').rglob('*.json'))}
image_assets = {str(path.relative_to(SITE)): data_url(path) for path in sorted((SITE / 'assets').rglob('*.png'))}
embedded = 'window.PIXEL_ASSETS=' + json.dumps(json_assets, separators=(',', ':')) + ';\nwindow.PIXEL_IMAGES=' + json.dumps(image_assets, separators=(',', ':')) + ';'
# Keep execution deferred until every article element exists, including in file:// mode.
scripts = ['i18n.js', 'pixel-transition.js', 'hero.js', 'figures.js', 'scaling.js', 'sidenotes.js', 'article.js']
for name in scripts:
    html = re.sub(r'<script[^>]*src="' + re.escape(name) + r'(?:\?[^\"]*)?"[^>]*></script>', '', html)
script = (embedded + '\n' + '\n'.join((SITE / name).read_text() for name in scripts)).replace('</script', '<\\/script')
html = html.replace('</body>', f'<script>{script}</script>\n</body>')
offline = OUT / 'pixelbench-blog-offline.html'
offline.write_text(html)
with zipfile.ZipFile(OUT / 'pixelbench-blog.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    # The file a reader naturally double-clicks must be the fully working preview.
    # Keep editable, HTTP-served sources together instead of mixing unused assets
    # beside the self-contained entry point.
    archive.writestr('index.html', html)
    archive.writestr('README.txt', (SITE / 'PACKAGE_README.md').read_text())
    for filename in ['index.html', 'styles.css', 'i18n.js', 'pixel-transition.js', 'hero.js', 'figures.js', 'scaling.js', 'sidenotes.js', 'article.js',
                     'template.html', 'figures.html', 'translations.json', 'build.py', 'build_article.py', 'build_title_font.py', 'requirements-build.txt', 'PACKAGE_README.md']:
        archive.write(SITE / filename, 'site/' + filename)
    for filename in ['01-zh.md', '02-en.md']:
        archive.write(SITE / 'blog_drafts' / filename, 'site/blog_drafts/' + filename)
    for path in sorted((SITE / 'assets').rglob('*')):
        if path.is_file():
            archive.write(path, Path('site') / path.relative_to(SITE))
print(f'Offline preview: {offline} ({offline.stat().st_size / 1024 / 1024:.2f} MB)')
print(f'Static package: {OUT / "pixelbench-blog.zip"}')
