/* The only image data used here are the original, curated research outputs. */
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const {t, label} = window.PB;
  const cache = new Map();
  const hexPattern = /^#[0-9a-f]{6}$/i;
  async function loadJSON(path) {
    if (window.PIXEL_ASSETS && Object.hasOwn(window.PIXEL_ASSETS, path)) return window.PIXEL_ASSETS[path];
    if (!cache.has(path)) {
      cache.set(path, fetch(new URL(path, document.baseURI)).then(response => {
        if (!response.ok) throw new Error(`Could not load ${path}`);
        return response.json();
      }).catch(error => { cache.delete(path); throw error; }));
    }
    return cache.get(path);
  }
  function validate(raster) {
    const { width, height, palette, pixels } = raster;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 512 || height > 512 ||
        !Array.isArray(palette) || !palette.length || !palette.every(color => hexPattern.test(color)) ||
        !Array.isArray(pixels) || pixels.length !== height ||
        !pixels.every(row => Array.isArray(row) && row.length === width && row.every(index => Number.isInteger(index) && index >= 0 && index < palette.length))) {
      throw new Error('This grid could not be validated.');
    }
    return raster;
  }
  const loadRaster = async path => validate(await loadJSON(path));
  function drawRaster(canvas, raster) {
    canvas.width = raster.width;
    canvas.height = raster.height;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    raster.pixels.forEach((row, y) => row.forEach((index, x) => {
      context.fillStyle = raster.palette[index];
      context.fillRect(x, y, 1, 1);
    }));
  }
  function fillSelect(select, options, value) {
    select.replaceChildren(...options.map(option => new Option(option.label, option.id)));
    if (value && options.some(option => option.id === value)) select.value = value;
    select.disabled = false;
  }
  const modelOptions = [
    { id: 'gpt6astra', label: 'GPT-6 Astra' },
    { id: 'opus5', label: 'Claude Opus 5' },
    { id: 'alik3', label: 'Kimi K3' },
    { id: 'gpt56sol', label: 'GPT-5.6 Sol' },
    { id: 'seed21pro', label: 'Seed-2.1 Pro' },
    { id: 'gemini36', label: 'Gemini 3.6 Flash' }
  ];

  function initCitation() {
    const button=$('#copy-citation'),code=$('#bibtex'),status=$('#citation-status');
    let timer;
    const reset=()=>{clearTimeout(timer);button.textContent=t('Copy','复制');status.textContent='';};
    button.hidden=false;
    button.addEventListener('click',async()=>{
      reset();button.disabled=true;
      let copied=false;
      try {await navigator.clipboard.writeText(code.textContent);copied=true;} catch {}
      // The shared preview uses HTTP, where the modern clipboard API may be absent.
      if(!copied){
        const range=document.createRange(),selection=window.getSelection();
        range.selectNodeContents(code);selection.removeAllRanges();selection.addRange(range);
        try {copied=document.execCommand('copy');} catch {}
        if(copied)selection.removeAllRanges();
      }
      button.disabled=false;
      if(copied){button.textContent=t('Copied','已复制');timer=setTimeout(reset,2000);}
      else status.textContent=t('The citation is selected. Press ⌘C or Ctrl+C to copy.','引用已选中，按 ⌘C 或 Ctrl+C 复制。');
    });
    document.addEventListener('languagechange',reset);
  }

  function initContents() {
    const contents = $('.contents');
    const marker = $('.contents-marker');
    const links = [...contents.querySelectorAll('a[href^="#"]')];
    const mobileLinks = [...document.querySelectorAll('.mobile-contents a')];
    const sections = links.map(link => $(link.getAttribute('href')));
    let scheduled = false;
    function update() {
      scheduled = false;
      const threshold = Math.min(220, window.innerHeight * 0.3);
      let active = 0;
      sections.forEach((section, index) => { if (section.getBoundingClientRect().top <= threshold) active = index; });
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 8) active = sections.length - 1;
      links.forEach((link, index) => {
        link.classList.toggle('active', index === active);
        if (index === active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
        if (index === active) mobileLinks[index].setAttribute('aria-current', 'location');
        else mobileLinks[index].removeAttribute('aria-current');
      });
      if (contents.offsetWidth) {
        // Align with the first line, including labels that wrap onto two lines.
        const link = links[active];
        const style = getComputedStyle(link);
        const center = link.offsetTop + parseFloat(style.paddingTop) + parseFloat(style.lineHeight) / 2;
        marker.style.transform = `translateY(${Math.round(center - marker.getBoundingClientRect().height / 2)}px)`;
      }
    }
    const schedule = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('languagechange', schedule);
    mobileLinks.forEach(link => link.addEventListener('click', () => {
      $('.mobile-contents details').open = false;
    }));
    document.fonts.ready.then(schedule);
    update();
  }

  async function initInspector(data) {
    const canvas = $('#pixel-canvas');
    const selection = $('#pixel-selection');
    const status = $('#inspector-status');
    const palette = $('#palette');
    const panel = $('.compact-palette-panel');
    const caseSelect = $('#inspector-case');
    const modelList = $('#inspector-models');
    const sizeButtons = [...document.querySelectorAll('#inspector-resolutions button')];
    let selectedModel = 'gpt6astra', selectedSize = '16', thumbnailKey = '';
    const specimenFields = [...document.querySelectorAll('[data-specimen-field]')];
    const specimenCopy = [...new Set(specimenFields.map(field => field.closest('p')))];
    let raster, sample, x = 8, y = 5, filter = null, request = 0;

    function refreshOptions(id, modelId, size) {
      const item = data.gallery.t2p.find(c => c.id === id);
      if (!item) return null;
      fillSelect(caseSelect, data.gallery.t2p.map(c => ({id:c.id, label:label(c.id,c.label)})), id);
      const models = Object.entries(item.outputs).filter(([, output]) => Object.keys(output.sizes).length);
      if (!models.some(([key]) => key === modelId)) modelId = models[0]?.[0];
      if (!modelId) return null;
      selectedModel = modelId;
      const output = item.outputs[modelId];
      const sizes = Object.keys(output.sizes).sort((a,b) => Number(a)-Number(b));
      const preferred = String(size || data.samples.find(s => s.id === id)?.size || 16);
      const selectedSize = sizes.includes(preferred) ? preferred : sizes[0];
      renderChoices(item, models, modelId, selectedSize);
      return {...item, model:output.label, modelId, size:selectedSize, path:output.sizes[selectedSize]};
    }

    function renderChoices(item, models, modelId, size) {
      selectedSize = size;
      sizeButtons.forEach(button => {
        button.disabled = !item.outputs[modelId].sizes[button.dataset.size];
        button.setAttribute('aria-pressed', String(button.dataset.size === size));
        button.setAttribute('aria-label', t(`${button.dataset.size} by ${button.dataset.size} pixels`, `${button.dataset.size} × ${button.dataset.size} 像素`));
      });
      const key = `${item.id}:${size}`;
      if (key !== thumbnailKey) {
        thumbnailKey = key;
        modelList.replaceChildren(...models.map(([id, output]) => {
          const button = document.createElement('button');
          button.type = 'button'; button.className = 'inspector-model-option'; button.dataset.model = id;
          const thumb = document.createElement('span');
          thumb.className = 'inspector-model-thumb'; thumb.setAttribute('aria-hidden', 'true');
          const name = document.createElement('span'); name.textContent = output.label;
          button.append(thumb, name);
          const path = output.sizes[size];
          button.disabled = !path;
          if (path) {
            const preview = document.createElement('canvas');
            preview.hidden = true; thumb.append(preview);
            loadRaster(path).then(grid => {
              if (!button.isConnected) return;
              if (grid.width !== Number(size) || grid.height !== Number(size)) throw new Error('Unexpected thumbnail resolution');
              drawRaster(preview, grid); preview.hidden = false;
              preview.dataset.path = path;
            }).catch(() => { if (button.isConnected) thumb.textContent = '—'; });
          } else thumb.textContent = '—';
          button.addEventListener('click', () => changeSample(item.id, id, size));
          return button;
        }));
      }
      [...modelList.children].forEach(button => button.setAttribute('aria-pressed', String(button.dataset.model === modelId)));
    }

    function setCopyLoading(loading) {
      [...specimenCopy, panel].forEach(el => {
        el.style.visibility = loading ? 'hidden' : '';
        el.setAttribute('aria-busy', String(loading));
      });
    }
    function renderSpecimenCopy() {
      const used = new Set(raster.pixels.flat());
      const index = used.has(2) ? 2 : used.values().next().value;
      const count = used.size;
      const english = ['zero','one','two','three','four','five','six','seven','eight'];
      const chinese = ['零','一','两','三','四','五','六','七','八'];
      specimenFields.forEach(field => {
        const lang = field.closest('[data-copy]').dataset.copy;
        const values = {
          name: label(sample.id, sample.label.toLowerCase(), lang),
          count: (lang === 'zh' ? chinese : english)[count] || String(count),
          index, hex: raster.palette[index]
        };
        field.textContent = values[field.dataset.specimenField];
      });
      specimenCopy.forEach(el => { el.dataset.specimen = sample.id; });
      setCopyLoading(false);
      document.dispatchEvent(new Event('specimenchange'));
    }
    function draw() {
      if (!raster) return;
      canvas.width = 768; canvas.height = 768;
      const ctx = canvas.getContext('2d');
      const cellX = canvas.width / raster.width, cellY = canvas.height / raster.height;
      raster.pixels.forEach((row, py) => row.forEach((index, px) => {
        ctx.fillStyle = raster.palette[index];
        ctx.fillRect(px * cellX, py * cellY, cellX, cellY);
        if (filter !== null && index !== filter) {
          ctx.fillStyle = '#ffffffbd';
          ctx.fillRect(px * cellX, py * cellY, cellX, cellY);
        }
      }));
      ctx.strokeStyle = '#18344220'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < raster.width; i++) { ctx.moveTo(i * cellX, 0); ctx.lineTo(i * cellX, canvas.height); }
      for (let i = 1; i < raster.height; i++) { ctx.moveTo(0, i * cellY); ctx.lineTo(canvas.width, i * cellY); }
      ctx.stroke();
      ctx.strokeRect(.5, .5, canvas.width - 1, canvas.height - 1);
    }
    function showColor(index, announce = false) {
      const color = raster.palette[index];
      $('#pixel-index').textContent = index;
      $('#pixel-hex').textContent = color;
      $('#color-preview').style.background = color;
      [...palette.children].forEach((button, i) => {
        button.setAttribute('aria-pressed', String(i === index));
      });
      if (announce) status.textContent = t(`Index ${index}, ${color}`, `索引 ${index}，${color}`);
    }
    function selectPixel(newX, newY, announce = false) {
      if (!raster) return;
      if (filter !== null) { filter = null; draw(); }
      x = Math.min(raster.width - 1, Math.max(0, newX));
      y = Math.min(raster.height - 1, Math.max(0, newY));
      const index = raster.pixels[y][x];
      showColor(index, announce);
      canvas.dataset.x = x; canvas.dataset.y = y;
      Object.assign(selection.style, { left: `${x / raster.width * 100}%`, top: `${y / raster.height * 100}%`, width: `${100 / raster.width}%`, height: `${100 / raster.height}%` });
      selection.hidden = false;
      canvas.setAttribute('aria-label', t(`${sample.label}, ${raster.width} by ${raster.height}. Pixel (${x}, ${y}), index ${index}, ${raster.palette[index]}. Use arrow keys to move.`, `${label(sample.id,sample.label)}，${raster.width} × ${raster.height}。像素 (${x}, ${y})，索引 ${index}，${raster.palette[index]}。使用方向键移动。`));
    }
    function previewColor(index, announce = false) {
      if (!raster) return;
      filter = index;
      selection.hidden = true;
      showColor(index, announce); draw();
    }
    function restorePixel() {
      if (!raster) return;
      const focused = [...palette.children].indexOf(document.activeElement);
      if (focused >= 0) previewColor(focused);
      else selectPixel(x, y);
    }
    function renderPalette() {
      palette.replaceChildren(...raster.palette.map((color, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.style.setProperty('--swatch', color);
        button.setAttribute('aria-label', t(`Index ${index}, ${color}`, `索引 ${index}，${color}`));
        button.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') previewColor(index); });
        button.addEventListener('pointerleave', restorePixel);
        button.addEventListener('focus', () => previewColor(index, true));
        button.addEventListener('blur', () => selectPixel(x, y));
        button.addEventListener('click', () => previewColor(index, true));
        return button;
      }));
    }
    async function changeSample(id, modelId = 'gpt6astra', size) {
      const nextSample = refreshOptions(id, modelId, size);
      if (!nextSample) return;
      const current = ++request;
      setCopyLoading(true);
      raster = null; canvas.hidden = true; selection.hidden = true;
      const heroSample = data.samples.find(s => s.id === id);
      const isHero = nextSample.path === heroSample?.path;
      $('#inspector-fallback').hidden = !isHero;
      const thumb = document.querySelector(`.specimen[data-sample="${id}"] img`);
      if (thumb) $('#inspector-fallback').src = thumb.src;
      $('#inspector-fallback').alt = t(`${nextSample.label} pixel image`, `${label(nextSample.id,nextSample.label)}像素图`);
      $('#inspector').setAttribute('aria-busy', 'true');
      status.classList.remove('inspector-announcement');
      status.textContent = t('Loading…','加载中…');
      try {
        const nextRaster = await loadRaster(nextSample.path);
        if (current !== request) return;
        if (nextRaster.width !== Number(nextSample.size) || nextRaster.height !== Number(nextSample.size)) throw new Error('Unexpected grid resolution');
        raster = nextRaster; sample = nextSample; filter = null;
        canvas.hidden = false; $('#inspector-fallback').hidden = true;
        canvas.dataset.sample = id;
        canvas.dataset.model = nextSample.modelId;
        canvas.dataset.size = nextSample.size;
        renderPalette(); draw(); selectPixel(8, 5);
        renderSpecimenCopy();
        status.textContent = '';
        status.classList.add('inspector-announcement');
      } catch (error) {
        if (current === request) status.textContent = t('Could not load the grid. Choose another example or model to try again.','网格加载失败，请选择其他示例或模型重试。');
      } finally { if (current === request) $('#inspector').setAttribute('aria-busy', 'false'); }
    }
    document.querySelectorAll('.specimen[data-sample]').forEach(link => link.addEventListener('click', () => changeSample(link.dataset.sample)));
    caseSelect.addEventListener('change', () => changeSample(caseSelect.value, selectedModel, selectedSize));
    sizeButtons.forEach(button => button.addEventListener('click', () => changeSample(caseSelect.value, selectedModel, button.dataset.size)));
    function point(event) {
      if (!raster) return;
      const rect = canvas.getBoundingClientRect();
      selectPixel(Math.floor((event.clientX - rect.left) / rect.width * raster.width), Math.floor((event.clientY - rect.top) / rect.height * raster.height), event.type === 'pointerdown');
    }
    canvas.addEventListener('pointermove', event => { if (event.pointerType !== 'touch') point(event); });
    canvas.addEventListener('pointerdown', point);
    canvas.addEventListener('keydown', event => {
      const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (directions[event.key]) { event.preventDefault(); const [dx, dy] = directions[event.key]; selectPixel(x + dx, y + dy, true); }
      if (event.key === 'Home' && raster) { event.preventDefault(); selectPixel(0, 0, true); }
      if (event.key === 'End' && raster) { event.preventDefault(); selectPixel(raster.width - 1, raster.height - 1, true); }
    });
    document.addEventListener('languagechange', () => {
      refreshOptions(caseSelect.value || 'mushroom', selectedModel, selectedSize);
      if (!raster) return;
      const activeFilter = filter;
      renderPalette(); selectPixel(x,y);
      if (activeFilter !== null) previewColor(activeFilter);
      status.textContent=''; renderSpecimenCopy();
    });
    await changeSample('mushroom');
  }

  function sourceURL(path) { return window.PIXEL_IMAGES?.[path] || path; }

  initCitation();
  initContents();
  const dataPromise = loadJSON('assets/data.json');
  window.startHeroIntro?.(dataPromise, loadRaster);
  dataPromise.then(async data => {
    const results = await Promise.allSettled([initInspector(data), window.initScalingSweep({loadJSON,loadRaster,drawRaster,fillSelect,sourceURL}), window.initResearch(data,{loadJSON,loadRaster,drawRaster,fillSelect,sourceURL})]);
    const statuses = ['#inspector-status', '#scale-status', '#t2p-status'];
    results.forEach((result, index) => { if (result.status === 'rejected') $(statuses[index]).textContent = t('This figure is unavailable. Reload the page to try again.','交互图暂不可用，请刷新重试。'); });
    document.body.dataset.ready = 'true';
  }).catch(() => {
    ['#inspector-status', '#compare-status', '#scale-status'].forEach(id => {
      $(id).textContent = t('Interactive data could not be loaded. Use the offline edition or serve this folder over HTTP.','交互数据加载失败，请使用离线版本或通过 HTTP 访问。');
    });
  });
})();
