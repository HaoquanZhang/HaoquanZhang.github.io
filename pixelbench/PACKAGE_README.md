# PixelBench

## 直接打开

解压 ZIP 后，用浏览器打开最外层的 `index.html`。
页面已内嵌字体、图片、像素网格、图表数据、CSS 和 JavaScript。
中英文切换与交互可离线使用，无需安装依赖或启动服务器。
作者主页和论文引用等外部链接需要联网访问。

## 文件

- `index.html`：可直接打开或部署的完整单文件网站。
- `site/`：分离的 HTML、CSS、JavaScript、图片、字体和数据，以及构建脚本与模板。
- `site/blog_drafts/01-zh.md`、`site/blog_drafts/02-en.md`：当前中英文文章源文件。

## 部署或修改

直接把最外层 `index.html` 放到静态网站托管目录即可。
如果使用分离资源的版本，请完整部署 `site/`，保留其中的目录结构。
本地预览分离资源版本，可在解压目录运行：

```sh
python3 -m http.server 8000 --directory site
```

然后访问 `http://localhost:8000/`。

只有修改 Markdown 或模板后重新构建时，才需要 Python 3.10+ 及构建依赖：

```sh
python3 -m venv .venv
. .venv/bin/activate
python3 -m pip install -r site/requirements-build.txt
python3 site/build.py
```

构建会更新 `site/index.html`，并在 `site/dist/` 生成新的离线 HTML 和 ZIP。
正文修改 `site/blog_drafts/`；页面结构修改 `site/template.html`；样式修改 `site/styles.css`。
像素字体已经生成；仅重新设计字形时，额外安装 `fonttools[woff]` 并运行 `site/build_title_font.py`。

## English

Extract the ZIP and open the top-level `index.html`. All runtime assets are
embedded, so the bilingual article and interactive figures work offline without
installing anything. External author and paper links require an internet connection.

Deploy that single file to a static host, or serve the complete `site/` directory
over HTTP. The editable article is in `site/blog_drafts/`. Python and the dependencies
in `site/requirements-build.txt` are needed only to rebuild after editing the
Markdown or templates; the commands above generate a new HTML and ZIP in
`site/dist/`.
