"""Compile the author's two Markdown drafts into one static, bilingual article."""
from pathlib import Path
import html
import json
import re
import markdown
from bs4 import BeautifulSoup, Comment, NavigableString

SITE = Path(__file__).resolve().parent
DRAFTS = SITE / 'blog_drafts'

def bi(en, zh):
    return f'<span data-en="{html.escape(en, quote=True)}" data-zh="{html.escape(zh, quote=True)}">{html.escape(en)}</span>'

def options(items):
    return ''.join(f'<option value="{v}" data-en="{html.escape(en)}" data-zh="{html.escape(zh)}">{en}</option>' for v,en,zh in items)

def select(id, en, zh, items):
    return f'<label class="select-label">{bi(en,zh)}<select id="{id}">{options(items)}</select></label>'

SIZES = [('16','16 × 16','16 × 16'),('32','32 × 32','32 × 32'),('64','64 × 64','64 × 64')]

def top(number, en, zh, controls=''):
    return f'<div class="figure-topline"><div><span class="figure-number">{bi("FIGURE "+number,"图 "+number)}</span><h3>{bi(en,zh)}</h3></div><div class="figure-selects">{controls}</div></div>'

def leaderboard(task):
    understand = task == 'understanding'
    metrics = [('top1','500-way Top-1','500 选一 Top-1'),('judge','VLM judge','VLM 评分')] if task=='t2p' else [('top1','100-way retrieval','100 选一原图检索'),('siglip','SigLIP similarity','SigLIP 相似度'),('dino','DINO similarity','DINO 相似度')]
    controls = select(task+'-metric','Metric','指标',metrics) if not understand else ''
    if understand:
        board = json.loads((SITE/'assets/benchmarks.json').read_text())[task]
        source_indices = [next(i for i, (key, _) in enumerate(board['resolutions']) if key == source) for source in ['pia', 'astra']]
        overall = next(i for i, (key, _) in enumerate(board['resolutions']) if key == 'overall')
        rows = []
        # Keep one model order; label the source-specific scales explicitly.
        for name, scores in sorted(board['rows'], key=lambda row: row[1][overall], reverse=True):
            cells = ''.join(f'<td data-source="{source}"><div class="understanding-score" style="--score:{scores[index]/maximum*100:.6f}%"><span class="understanding-track" aria-hidden="true"><i></i></span><span>{scores[index]:.1f}%</span></div></td>' for source, index, maximum in zip(['pia', 'astra'], source_indices, [60, 80]))
            rows.append(f'<tr><th scope="row">{html.escape(name)}</th>{cells}</tr>')
        return '<table class="understanding-table"><caption class="visually-hidden">'+bi('Pixel understanding accuracy, averaged across 16², 32² and 64². PIA reduced uses a 0–60% scale; Astra uses 0–80%.','像素理解准确率，取 16²、32²、64² 的平均值。PIA reduced 的刻度为 0–60%，Astra 为 0–80%。')+'</caption><colgroup><col class="understanding-model-column"><col><col></colgroup><thead><tr><th scope="col">'+bi('Model','模型')+'</th><th scope="col"><span class="understanding-source">PIA reduced <small>0–60%</small></span></th><th scope="col"><span class="understanding-source">Astra <small>0–80%</small></span></th></tr></thead><tbody>'+''.join(rows)+'</tbody></table>'
    legend=''.join(f'<span><i class="resolution-color resolution-{key}"></i>{bi(en,zh)}</span>' for key,en,zh in [('16','16²','16²'),('32','32²','32²'),('64','64²','64²'),('avg','Average','平均')])
    case_control = select('t2p-case','Concept','概念',[]) if task=='t2p' else select('compare-case','Source image','源图',[])
    count = len(json.loads((SITE/'assets/benchmarks.json').read_text())[task]['rows'])
    gutter = 64 / (64 + count * 112) * 100
    return f'<div class="leaderboard resolution-board" data-task="{task}"><div class="score-toolbar"><div class="resolution-legend">{legend}</div><div class="score-controls">{controls}{case_control}</div></div><div class="matrix-scroll comparison-scroll" tabindex="0" role="region" aria-label="{task} scores and examples"><div class="comparison-content" style="--columns:{count};--row-label:{gutter:.8f}%"><div id="{task}-rows"></div><div id="{task}-gallery"></div></div></div><p class="score-readout" id="{task}-readout" role="tooltip" hidden></p></div>'




def training_chart():
    """Render the reported deltas, including averages, without requiring JS."""
    rows = sorted(json.loads((SITE/'assets/data.json').read_text())['training'], key=lambda r: -r['delta'])
    averages = json.loads((SITE/'assets/training-summary.json').read_text())['rows']
    parts = ['<svg class="training-chart" viewBox="0 0 1040 365" role="group" aria-label="PRT performance changes" data-en-aria-label="PRT performance changes" data-zh-aria-label="PRT 性能变化" xmlns="http://www.w3.org/2000/svg">']
    def text(x, y, en, zh=None, attrs=''):
        bilingual = f' data-en="{html.escape(en, quote=True)}" data-zh="{html.escape(zh, quote=True)}"' if zh else ''
        return f'<text x="{x}" y="{y}"{bilingual} {attrs}>{html.escape(en)}</text>'
    parts.append(text(18, 17, 'Δ score · OV + Pixel − OV-only', 'Δ 分数 · OV + Pixel − OV-only', 'class="training-axis-title"'))
    parts.append(text(931, 17, 'Average', '平均', 'text-anchor="middle" class="training-axis-title"'))
    zero, scale = 202, 110
    for value in [0, .5, 1, 1.5]:
        y = zero-value*scale
        parts.append(f'<line x1="59" x2="1011" y1="{y}" y2="{y}" class="training-gridline {"training-zero" if value == 0 else ""}"/>')
        parts.append(text(47, y+4, f'+{value:g}' if value else '0', attrs='text-anchor="end" class="training-tick"'))
    for index, row in enumerate(rows+averages):
        average = index >= len(rows)
        x = 86+index*48 if not average else 897+(index-len(rows))*68
        value = row['delta']
        # Solid colors encode direction and magnitude; zero remains neutral.
        neutral = (177, 194, 183)
        target = (40, 126, 79) if value > 0 else (186, 88, 76)
        weight = min(1, abs(value)/(1.4 if value > 0 else .3))**.5
        color = '#9ca4a1' if value == 0 else '#'+''.join(f'{round(a+(b-a)*weight):02x}' for a,b in zip(neutral,target))
        y = min(zero, zero-value*scale)
        height = abs(value)*scale if value else 2
        delta = f'{value:+.1f}' if value else '0.0'
        desc = f'{row["name"]}: OV-only {row["baseline"]:.1f}, OV + Pixel {row["pixel"]:.1f}, Δ {delta}'
        desczh = desc.replace(row['name'], row.get('zh', row['name']), 1)
        parts.append(f'<g class="training-bar" tabindex="0" role="img" aria-describedby="training-readout" aria-label="{html.escape(desc, quote=True)}" data-en-aria-label="{html.escape(desc, quote=True)}" data-zh-aria-label="{html.escape(desczh, quote=True)}" data-benchmark="{html.escape(row["name"], quote=True)}" data-zh-name="{html.escape(row.get("zh", row["name"]), quote=True)}" data-baseline="{row["baseline"]}" data-pixel="{row["pixel"]}" data-delta="{value}" data-average="{str(average).lower()}">')
        parts.append(f'<rect class="training-hit" x="{x-23}" y="29" width="46" height="212" fill="transparent"/>')
        parts.append(f'<rect class="training-column" x="{x-13}" y="{y if value else y-1}" width="26" height="{height}" fill="{color}"/>')
        parts.append(text(x, y-9 if value >= 0 else y+height+16, delta, attrs='text-anchor="middle" class="training-value"'))
        parts.append(text(x+4, 257, row['name'], row.get('zh'), f'text-anchor="end" transform="rotate(-45 {x+4} 257)" class="training-benchmark {"training-average-label" if average else ""}"'))
        parts.append('</g>')
    parts.append('</svg>')
    return '<figure class="wide" id="training-results"><div class="training-chart-scroll" role="region" tabindex="0" aria-label="PRT benchmark results; scroll horizontally" data-en-aria-label="PRT benchmark results; scroll horizontally" data-zh-aria-label="PRT 各 Benchmark 结果，可横向滚动">'+''.join(parts)+'</div><p id="training-readout" class="score-readout" role="tooltip" hidden></p></figure>'


def make_figures():
    original=BeautifulSoup((SITE/'figures.html').read_text(),'html.parser')
    inspector=str(original.select_one('#inspector'))
    scaling='<figure class="wide scaling-sweep" id="scaling" aria-label="Resolution scaling"><div class="sweep-toolbar"><div class="segmented" id="sweep-task" role="group" aria-label="Task"><button type="button" data-task="i2p" aria-pressed="true">I to P</button><button type="button" data-task="t2p" aria-pressed="false">T to P</button></div><div class="sweep-controls">'+select('sweep-case','Example','示例',[])+'<button type="button" id="sweep-play">'+bi('Replay','重播')+'</button></div></div><div id="sweep-chart" role="group" aria-label="Resolution curves"></div><p class="sweep-scroll-hint">'+bi('Scroll sideways to see all images →','横向滑动查看全部图像 →')+'</p><div class="sweep-scroll" tabindex="0" role="region" aria-label="Resolution images"><div class="sweep-content"><div id="sweep-images"></div></div></div><div class="sweep-footer"><div id="sweep-reference"></div></div><p class="status" id="scale-status" role="status"></p></figure>'
    t2p='<figure class="interactive-figure wide resolution-figure" id="generation" aria-label="Text-to-Pixel">'+leaderboard('t2p')+'<p id="t2p-status" class="status" role="status"></p></figure>'
    comparison='<figure class="interactive-figure wide resolution-figure" id="comparison" aria-label="Image-to-Pixel">'+leaderboard('i2p')+'<p id="compare-status" class="status" role="status"></p></figure>'
    understanding='<figure class="wide" id="understanding-results">'+leaderboard('understanding')+'</figure>'
    training=training_chart()
    return {'representation-inspector':inspector,'t2p-leaderboard-and-cases':t2p,'i2p-leaderboard-and-cases':str(comparison),'resolution-scaling':scaling,'understanding-oracles-and-results':understanding,'prt-results':training}

# Keep published anchors stable; displayed titles come only from Markdown.
SECTION_IDS=['overview','representation','reconstruction','resolution','understanding','training','outlook']

def place_sidenotes(soup):
    """Keep one note per language, beside its paragraph, retaining existing links."""
    reference_order = {
        lang: list(dict.fromkeys(
            ref['href'].split('-', 1)[1]
            for ref in soup.select(f'[data-copy="{lang}"] a.footnote-ref')
        ))
        for lang in ['en', 'zh']
    }
    if reference_order['en'] != reference_order['zh']:
        raise ValueError(
            'Bilingual footnotes must match in first-reference order: '
            f'en={reference_order["en"]}; zh={reference_order["zh"]}'
        )
    for lang in ['en', 'zh']:
        for item in list(soup.select(f'[data-copy="{lang}"] .footnote li[id]')):
            note_id = item['id']
            refs = soup.find_all('a', class_='footnote-ref', href='#'+note_id)
            if not refs:
                continue
            ref = refs[0]
            paragraph = ref.find_parent('p')
            key = note_id.split('-', 1)[1]
            number = ref.get_text()
            explanatory = key in {'correlation', 'dsl', 'pixel-token-cost', 'understanding-setup', 'prt-averages'}
            label = ('注释' if explanatory else '参考文献') if lang == 'zh' else ('Note' if explanatory else 'Reference')
            group = paragraph.find_next_sibling()
            if group is None or 'paragraph-notes' not in group.get('class', []):
                group = soup.new_tag('div', attrs={'class':'paragraph-notes'})
                paragraph.insert_after(group)
            note = soup.new_tag('aside', id=note_id, attrs={
                'class':'sidenote', 'role':'note', 'tabindex':'-1',
                'data-note-key':key, 'data-note-ref':ref.parent['id'],
                'aria-label':f'{label} {number}'})
            details = soup.new_tag('details', attrs={'class':'sidenote-details', 'open':''})
            summary = soup.new_tag('summary')
            summary.string = f'{number} · {label}'
            details.append(summary)
            body = soup.new_tag('div', attrs={'class':'sidenote-content'})
            marker = soup.new_tag('span', attrs={'class':'sidenote-number', 'aria-hidden':'true'})
            marker.string = number
            body.append(marker)
            for child in list(item.contents):
                body.append(child.extract())
            for backref in body.select('.footnote-backref'):
                backref['aria-label'] = '返回正文' if lang == 'zh' else 'Back to text'
                backref.string = '↩ 返回正文' if lang == 'zh' else '↩ Back to text'
            details.append(body)
            note.append(details)
            group.append(note)
            for link in refs:
                link['aria-controls'] = note_id
                link['aria-label'] = f'{label} {number}'
            item.decompose()
    for block in soup.select('.reading-block.references'):
        block.decompose()

def blocks(lang):
    text=(DRAFTS/('01-zh.md' if lang=='zh' else '02-en.md')).read_text()
    # Explicit editorial directives never become public prose.
    text=re.sub(r'<!-- VISUAL REQUIREMENT:.*?-->', '', text, flags=re.S)
    soup=BeautifulSoup(markdown.markdown(
        text, extensions=['tables','footnotes'],
        extension_configs={'footnotes': {'USE_DEFINITION_ORDER': False}},
    ), 'html.parser')
    soup.h1.decompose()
    for tag in soup.select('[id], a[href]'):
        for attr in ['id','href']:
            if tag.has_attr(attr):tag[attr]=re.sub(r'(fn(?:ref\d*)?:)',rf'\1{lang}-',tag[attr])
    result=[]; buf=[]; section=-1
    def flush():
        if ''.join(buf).strip():result.append(('copy',''.join(buf)))
        buf.clear()
    for node in soup.contents:
        if isinstance(node,Comment):
            m=re.search(r'FIGURE: ([a-z0-9-]+)',str(node))
            if m:flush();result.append(('figure',m[1]))
        elif getattr(node,'name',None)=='h2':
            flush();section+=1
            section_id=SECTION_IDS[section] if section<len(SECTION_IDS) else f'section-{section+1}'
            result.append(('section',section_id));buf.append(str(node))
        elif getattr(node,'name',None)=='div' and 'footnote' in node.get('class',[]):
            flush();result.append(('references',str(node)))
        else:buf.append(str(node))
    flush()
    return result

def main():
    en,zh=blocks('en'),blocks('zh')
    assert [a for a,b in en]==[a for a,b in zh], 'Translation block structure must match the Chinese source'
    figures=make_figures();chunks=[];n=0
    for (kind,a),(_,b) in zip(en,zh):
        if kind=='section':
            assert a==b;n+=1
            if n>1:chunks.append('</section>')
            chunks.append(f'<section id="{a}" class="essay-section" data-section-number="{n}">')
        elif kind=='figure':
            assert a==b;chunks.append(figures[a])
        else:
            chunks.append(f'<div class="prose reading-block{ " references" if kind=="references" else ""}"><div data-copy="en" lang="en">{a}</div><div data-copy="zh" lang="zh-CN">{b}</div></div>')
    chunks.append('</section>')
    template=(SITE/'template.html').read_text().replace('<!--ARTICLE-->','\n'.join(chunks))
    template=template.replace('<!--BIBTEX-->',html.escape((SITE/'assets/citation.bib').read_text().strip()))
    article=BeautifulSoup(''.join(chunks),'html.parser')
    navigation=[]
    for section in article.select('.essay-section'):
        titles=[section.select_one(f'[data-copy="{lang}"] h2') for lang in ['en','zh']]
        assert all(titles), 'Each section needs a heading in both Markdown drafts'
        labels=[' '.join(heading.get_text(' ',strip=True).split()) for heading in titles]
        navigation.append(f'<a href="#{section["id"]}" data-section-number="{section["data-section-number"]}">{bi(*labels)}</a>')
    template=template.replace('<!--CONTENTS-->',''.join(navigation))
    soup=BeautifulSoup(template,'html.parser')
    for section in soup.select('.essay-section'):
        for heading in section.select('[data-copy] h2'):
            heading['data-section-number'] = section['data-section-number']
    place_sidenotes(soup)
    for filename in ['i18n.js','pixel-transition.js','figures.js','scaling.js','sidenotes.js']:
        script=soup.new_tag('script',src=filename,defer=True)
        soup.select_one('script[src="hero.js"]').insert_before(script)
    action=soup.new_tag('div',attrs={'class':'header-actions'})
    link=soup.select_one('.header-link');link.wrap(action)
    language=soup.new_tag('div',id='language-switcher',attrs={
        'class':'language-switcher','role':'group','aria-label':'Language',
        'data-en-aria-label':'Language','data-zh-aria-label':'语言','hidden':''})
    for code,label,name in [('en','EN','English'),('zh','中','中文')]:
        btn=soup.new_tag('button',type='button',attrs={
            'data-language':code,'lang':'en' if code=='en' else 'zh-CN',
            'aria-label':name,'aria-pressed':'false'})
        btn.string=label;language.append(btn)
    soup.body.append(language)
    translations=json.loads((SITE/'translations.json').read_text())
    for node in list(soup.find_all(string=True)):
        if isinstance(node,Comment) or node.parent.name in ['script','style','title'] or node.find_parent(attrs={'data-copy':True}) or node.parent.has_attr('data-en'):continue
        text=str(node); clean=text.strip()
        if clean in translations:
            replacement=BeautifulSoup(bi(clean,translations[clean]),'html.parser').span
            node.replace_with(replacement)
    for tag in soup.find_all(True):
        for attr in ['aria-label','alt','title']:
            value=tag.get(attr)
            if value in translations:
                tag['data-en-'+attr]=value;tag['data-zh-'+attr]=translations[value]
    (SITE/'index.html').write_text(str(soup))
    print('Compiled bilingual article from the two Markdown drafts.')

if __name__=='__main__':main()
