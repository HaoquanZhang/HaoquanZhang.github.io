# PixelBench

The bilingual, interactive project page is published at
https://haoquanzhang.github.io/pixelbench/.

This directory contains the separate-resource version from `pixelbench-blog.zip`.
The original ZIP is preserved locally at the repository root and excluded from Git.
GitHub Pages serves the checked-in `index.html` directly; no build is required to deploy.

## Preview

From the repository root, run `python3 -m http.server 8000`, then visit
http://localhost:8000/pixelbench/.

## Edit and rebuild

Edit `blog_drafts/01-zh.md` and `blog_drafts/02-en.md` for the article,
`template.html` for its structure and metadata, and `styles.css` for its styles.
The homepage entry is in `../data/publications.json`.
Its two thumbnail states are generated from the original sample grids by
`../scripts/build_pixelbench_preview.py` (requires Pillow).

From this directory:

```sh
python3 -m venv .venv
. .venv/bin/activate
python3 -m pip install -r requirements-build.txt
python3 build_article.py
```

Commit the updated `index.html` along with any edited sources. To additionally
create an offline HTML and a portable ZIP in the ignored `dist/` directory,
run `python3 build.py`.

## Promotional assets

PR cards, social images, rendering scripts, the visual blog, post drafts, and PR
kits are maintained in the separate local workspace `../../pixelbench-pr-assets/`
(a sibling of this website repository, under the local `code` directory).
That workspace includes a dated ZIP, a checksum manifest, and copies of the
rendering inputs, preserving local edits made before the 2026-11-06 cleanup.
See its README for rendering instructions; it is not deployed by GitHub Pages.

Keep the interactive page's `assets/raw/`, `assets/scaling/`, `assets/study/`,
JSON data, and fonts here: the page loads them dynamically. The homepage also
uses `../images/pixelbench-owl.png`, `../images/pixelbench-owl-indices.svg`, and
the pixel title font. These are website dependencies, not promotional exports.
