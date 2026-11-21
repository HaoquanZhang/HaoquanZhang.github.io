/* Minimalist interactive logic and unified choreography for !Bench */
(() => {
  'use strict';

  const S = window.EXCLAMATION_SUMMARY;
  const P = window.EXCLAMATION_PROMPTS || [];
  const PHRASES_EN = window.EXCLAMATION_PHRASES_EN || {};
  const PHRASES_ZH = window.EXCLAMATION_PHRASES_ZH || {};
  let R = window.EXCLAMATION_RESPONSES || [];

  if (!S) return;

  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const $ = (id) => document.getElementById(id);
  const esc = (str) =>
    String(str).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));

  // Unified motion constants matching CSS --dur (360ms) and --ease
  const DUR = 360;
  const EASE_CSS = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const HOVER_DEG = 42;

  // Curated two-line typography for all 11 models so names never wrap awkwardly
  const MODEL_LINES = {
    'grok-4.7': ['Grok', '4.7'],
    'muse-spark-1.3': ['Muse', 'Spark 1.3'],
    'kimi-k3.1-pro-261024': ['Kimi', 'K3.1 Pro'],
    'deepseek-v4.1-flash-1017': ['DeepSeek', 'V4.1'],
    'gpt-6.1-sol': ['GPT-6.1', 'Sol'],
    'claude-opus-5.5': ['Claude', 'Opus 5.5'],
    'gpt-6-luna': ['GPT-6', 'Luna'],
    'hy4': ['HY4', ''],
    'glm-5.3': ['GLM', '5.3'],
    'seed-2.1-pro-0915': ['Seed 2.1', 'Pro'],
    'gemini-4-carbon': ['Gemini 4', 'Carbon']
  };

  const fullLabel = (m) => {
    const pair = MODEL_LINES[m];
    return pair ? (pair[1] ? `${pair[0]} ${pair[1]}` : pair[0]) : m;
  };

  // Primary metric across the site: exclamation marks per 1,000 non-whitespace characters
  const modelsDesc = [...S.config.models].sort((a, b) => {
    const ca = S.summary[a].common;
    const cb = S.summary[b].common;
    if (Math.abs(cb.per_1000_chars - ca.per_1000_chars) > 1e-9) {
      return cb.per_1000_chars - ca.per_1000_chars;
    }
    return cb.exclamation_count - ca.exclamation_count;
  });

  const modelsAsc = [...modelsDesc].reverse();
  const commonSet = new Set(S.common_prompt_ids);
  const commonPrompts = P.filter((q) => commonSet.has(q.id));
  const leaderModel = modelsDesc[0];
  const quietestModel = modelsAsc[0];

  const state = {
    lang: 'en',
    selectedModel: leaderModel,
    phraseModel: leaderModel,
    punctKey: 'question',
    promptId: 'enchat-56',
    modelA: leaderModel,
    modelB: quietestModel,
    mobileSide: 'a'
  };

  try {
    const paramLang = new URLSearchParams(window.location.search).get('lang');
    if (paramLang === 'en' || paramLang === 'zh') {
      state.lang = paramLang;
    }
  } catch {
    // Ignore restricted URL access
  }

  const isZh = () => state.lang === 'zh';
  const t = (zh, en) => (isZh() ? zh : en);
  const fmt = (v, d = 1) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(d));

  // Tapered exclamation stem vector path with consistent stroke weight across heights
  function buildStemPath(wTop, wBot, h) {
    if (h <= 0.5) return '';
    const cx = wTop / 2;
    const taperMix = Math.min(1, Math.max(0, (h - 6) / 36));
    const curTopW = wTop * (0.9 + 0.1 * taperMix);
    const curBotW = curTopW - (curTopW - wBot) * taperMix;

    const xTL = cx - curTopW / 2;
    const xTR = cx + curTopW / 2;
    const xBL = cx - curBotW / 2;
    const xBR = cx + curBotW / 2;

    const rTop = Math.min(curTopW / 2, h * 0.46, 8);
    const rBot = Math.min(curBotW / 2, h * 0.42, 5.5);

    return [
      `M ${(xTL + rTop).toFixed(2)} 0`,
      `L ${(xTR - rTop).toFixed(2)} 0`,
      `Q ${xTR.toFixed(2)} 0 ${xTR.toFixed(2)} ${rTop.toFixed(2)}`,
      `L ${xBR.toFixed(2)} ${(h - rBot).toFixed(2)}`,
      `Q ${xBR.toFixed(2)} ${h.toFixed(2)} ${(xBR - rBot).toFixed(2)} ${h.toFixed(2)}`,
      `L ${(xBL + rBot).toFixed(2)} ${h.toFixed(2)}`,
      `Q ${xBL.toFixed(2)} ${h.toFixed(2)} ${xBL.toFixed(2)} ${(h - rBot).toFixed(2)}`,
      `L ${xTL.toFixed(2)} ${rTop.toFixed(2)}`,
      `Q ${xTL.toFixed(2)} 0 ${(xTL + rTop).toFixed(2)} 0`,
      'Z'
    ].join(' ');
  }

  function readStageGeom() {
    const stage = $('bang-stage');
    if (!stage) return { stemMaxH: 232, stemTopW: 20, stemBotW: 13 };
    const cs = getComputedStyle(stage);
    return {
      stemMaxH: parseFloat(cs.getPropertyValue('--stem-max-h')) || 232,
      stemTopW: parseFloat(cs.getPropertyValue('--stem-top-w')) || 20,
      stemBotW: parseFloat(cs.getPropertyValue('--stem-bot-w')) || 13
    };
  }

  function computeStemHeight(val, peak, stemMaxH) {
    if (!val || val <= 0 || peak <= 0) return 0;
    const minStem = Math.min(6.5, stemMaxH * 0.042);
    return minStem + (val / peak) * (stemMaxH - minStem);
  }

  // Render the 11-column Exclamation Mark Bar Chart
  let barFrame = 0;

  function renderChart(animate = false, delayMs = 0) {
    const stage = $('bang-stage');
    if (!stage) return;

    cancelAnimationFrame(barFrame);
    stage.style.setProperty('--cols', String(modelsAsc.length));
    const geom = readStageGeom();
    const peak = S.summary[leaderModel].common.per_1000_chars;

    stage.innerHTML = modelsAsc
      .map((model) => {
        const c = S.summary[model].common;
        const val = c.per_1000_chars;
        const dispVal = fmt(val, 2);
        const targetH = computeStemHeight(val, peak, geom.stemMaxH);
        const initH = animate && !reducedMotion.matches ? 0 : targetH;
        const [l1, l2] = MODEL_LINES[model] || [model, ''];
        const isLeader = model === leaderModel;
        const isSelected = model === state.selectedModel;

        const labelAria = `${fullLabel(model)}: ${dispVal} per 1k chars (${c.exclamation_count} total)`;
        return `
          <button
            type="button"
            class="bang-col${isLeader ? ' is-leader' : ''}${isSelected ? ' is-selected' : ''}"
            data-model="${esc(model)}"
            data-val="${val}"
            data-disp="${dispVal}"
            data-h="${targetH}"
            aria-pressed="${isSelected}"
            aria-label="${esc(labelAria)}"
          >
            <span class="bang-col__upper">
              <span class="bang-col__val">${animate && !reducedMotion.matches ? '' : dispVal}</span>
              <svg
                class="bang-col__stem-svg"
                width="${geom.stemTopW}"
                height="${Math.max(0, initH)}"
                viewBox="0 0 ${geom.stemTopW} ${Math.max(1, initH)}"
                aria-hidden="true"
              >
                <path class="bang-col__stem-path" d="${buildStemPath(geom.stemTopW, geom.stemBotW, initH)}"></path>
              </svg>
            </span>
            <span class="bang-col__dot" aria-hidden="true"></span>
            <span class="bang-col__label">
              <span class="bang-col__l1">${esc(l1)}</span>
              ${l2 ? `<span class="bang-col__l2">${esc(l2)}</span>` : ''}
            </span>
          </button>`;
      })
      .join('');

    stage.querySelectorAll('.bang-col').forEach((btn) => {
      btn.addEventListener('click', () => {
        const m = btn.dataset.model;
        state.selectedModel = m;
        stage.querySelectorAll('.bang-col').forEach((b) => {
          const active = b.dataset.model === m;
          b.classList.toggle('is-selected', active);
          b.setAttribute('aria-pressed', String(active));
        });

        // Sync both the constellation below and Model A in the reader
        if (state.phraseModel !== m) {
          switchPhraseModel(m, true);
        }
        state.modelA = m;
        if (state.modelB === m) {
          state.modelB = m === quietestModel ? leaderModel : quietestModel;
        }
        syncModelSelects();
        renderComparison();
      });
    });

    if (animate && !reducedMotion.matches) {
      animateColumns(stage, geom, delayMs);
    }
  }

  // Sequential emergence from fewest (left) to most (right) using unified timing
  function animateColumns(stage, geom, delayMs) {
    const cols = [...stage.querySelectorAll('.bang-col')];
    const stagger = 60;
    const t0 = performance.now() + delayMs;
    const easeOut = (x) => 1 - Math.pow(1 - x, 3.6);

    cols.forEach((col) => {
      const dot = col.querySelector('.bang-col__dot');
      const label = col.querySelector('.bang-col__label');
      const valEl = col.querySelector('.bang-col__val');
      dot.style.opacity = '0';
      dot.style.transform = 'scale(0.3)';
      label.style.opacity = '0';
      label.style.setProperty('--label-y', '5px');
      valEl.style.opacity = '0';
    });

    function frame(now) {
      let done = true;

      cols.forEach((col, i) => {
        const targetVal = parseFloat(col.dataset.val) || 0;
        const targetH = parseFloat(col.dataset.h) || 0;
        const local = now - (t0 + i * stagger);

        if (local < 0) {
          done = false;
          return;
        }

        const dot = col.querySelector('.bang-col__dot');
        const label = col.querySelector('.bang-col__label');
        const valEl = col.querySelector('.bang-col__val');
        const svg = col.querySelector('.bang-col__stem-svg');
        const path = col.querySelector('.bang-col__stem-path');

        const pDot = Math.min(1, local / DUR);
        const eDot = easeOut(pDot);
        dot.style.opacity = String(eDot);
        dot.style.transform = `scale(${(0.3 + 0.7 * eDot).toFixed(3)})`;

        label.style.opacity = String(eDot);
        label.style.setProperty('--label-y', `${((1 - eDot) * 5).toFixed(2)}px`);

        const pStem = Math.min(1, Math.max(0, (local - 45) / (DUR * 1.25)));
        const eStem = easeOut(pStem);
        const curH = targetH * eStem;

        svg.setAttribute('height', String(Math.max(0, curH)));
        svg.setAttribute('viewBox', `0 0 ${geom.stemTopW} ${Math.max(1, curH)}`);
        path.setAttribute('d', buildStemPath(geom.stemTopW, geom.stemBotW, curH));

        valEl.style.opacity = String(eStem);
        valEl.textContent = fmt(targetVal * eStem, 2);

        if (pDot < 1 || pStem < 1) {
          done = false;
        }
      });

      if (!done) {
        barFrame = requestAnimationFrame(frame);
      } else {
        cols.forEach((col) => {
          const dot = col.querySelector('.bang-col__dot');
          const label = col.querySelector('.bang-col__label');
          const valEl = col.querySelector('.bang-col__val');
          dot.style.opacity = '';
          dot.style.transform = '';
          label.style.opacity = '';
          label.style.removeProperty('--label-y');
          valEl.style.opacity = '';
          valEl.textContent = col.dataset.disp;
        });
      }
    }

    barFrame = requestAnimationFrame(frame);
  }

  // Collision-free radial constellation of pre-exclamation sense-groups:
  // Outgoing phrases fade out from center -> edges, then incoming phrases emerge.
  function boxesOverlap(a, b) {
    return !(a.r < b.l || a.l > b.r || a.b < b.t || a.t > b.b);
  }

  function renderPhraseModelList() {
    const listEl = $('phrase-model-list');
    if (!listEl) return;

    listEl.innerHTML = modelsDesc
      .map((m) => {
        const den = fmt(S.summary[m].common.per_1000_chars, 2);
        const active = m === state.phraseModel;
        return `
          <button
            type="button"
            class="phrase-model-btn${active ? ' is-active' : ''}"
            data-phrase-model="${esc(m)}"
            role="option"
            aria-selected="${active}"
          >
            <span class="phrase-model-btn__name">${esc(fullLabel(m))}</span>
            <span class="phrase-model-btn__count">${den}</span>
          </button>`;
      })
      .join('');

    listEl.querySelectorAll('.phrase-model-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.phraseModel;
        if (target && target !== state.phraseModel) {
          switchPhraseModel(target, true);
        }
      });
    });
  }

  function syncPhraseModelListActive() {
    document.querySelectorAll('.phrase-model-btn').forEach((btn) => {
      const active = btn.dataset.phraseModel === state.phraseModel;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
      if (active && window.innerWidth <= 640) {
        btn.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
      }
    });
  }

  function switchPhraseModel(nextModel, animate = true) {
    const stage = $('phrase-stage');
    const hubBtn = $('hub-btn');
    if (!stage || !hubBtn) return;

    state.phraseModel = nextModel;
    syncPhraseModelListActive();

    const idx = modelsDesc.indexOf(nextModel) + 1;
    const c = S.summary[nextModel].common;
    $('hub-name').textContent = fullLabel(nextModel);
    $('hub-hint').textContent = isZh()
      ? `每千字 ${fmt(c.per_1000_chars, 2)} · 共 ${c.exclamation_count} 个 ! (${idx}/${modelsDesc.length})`
      : `${fmt(c.per_1000_chars, 2)} / 1k · ${c.exclamation_count} marks (${idx}/${modelsDesc.length})`;

    const shouldAnim = animate && !reducedMotion.matches;
    const prevLayer = stage.querySelector('.phrase-layer:not(.is-exiting)');

    // 1. Outgoing layer: ripple fade-out from center (normR = 0) to periphery (normR = 1)
    if (prevLayer) {
      if (shouldAnim && prevLayer.children.length > 0) {
        prevLayer.classList.add('is-exiting');
        [...prevLayer.children].forEach((el) => {
          const normR = parseFloat(el.dataset.normR) || 0;
          const ux = parseFloat(el.dataset.ux) || 0;
          const uy = parseFloat(el.dataset.uy) || -1;
          el.animate(
            [
              { opacity: 1, transform: 'translate(0px, 0px)' },
              { opacity: 0, transform: `translate(${(ux * 22).toFixed(1)}px, ${(uy * 22).toFixed(1)}px)` }
            ],
            {
              duration: DUR,
              delay: normR * 150,
              fill: 'forwards',
              easing: EASE_CSS
            }
          );
        });
        setTimeout(() => prevLayer.remove(), DUR + 180);
      } else {
        prevLayer.remove();
      }
    }

    // 2. Build incoming layer and measure exact bounding boxes for collision-free placement
    const newLayer = document.createElement('div');
    newLayer.className = 'phrase-layer';
    newLayer.style.visibility = 'hidden';
    stage.appendChild(newLayer);

    const W = stage.clientWidth || 720;
    const H = stage.clientHeight || 460;
    const isNarrow = W < 520;
    const cx0 = W / 2;
    const cy0 = H / 2;

    const hubW = isNarrow
      ? Math.max(136, (hubBtn.offsetWidth || 140) + 12)
      : Math.max(190, (hubBtn.offsetWidth || 180) + 28);
    const hubH = isNarrow
      ? Math.max(54, (hubBtn.offsetHeight || 50) + 12)
      : Math.max(76, (hubBtn.offsetHeight || 60) + 24);
    const hubPadX = isNarrow ? 10 : 22;
    const hubPadY = isNarrow ? 10 : 18;
    const hubBox = {
      l: cx0 - hubW / 2 - hubPadX,
      r: cx0 + hubW / 2 + hubPadX,
      t: cy0 - hubH / 2 - hubPadY,
      b: cy0 + hubH / 2 + hubPadY
    };

    const activePhraseMap = isZh() ? PHRASES_ZH : PHRASES_EN;
    const items = activePhraseMap[nextModel] || [];
    const nodes = items.map((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `phrase-item${item.count >= 2 ? ' phrase-item--freq' : ''}`;
      const sizePx = isNarrow
        ? item.count >= 3 ? 14 : item.count === 2 || item.bang.length >= 2 ? 13 : 11.5
        : item.count >= 3 ? 16 : item.count === 2 || item.bang.length >= 2 ? 14.5 : 13;
      btn.style.fontSize = `${sizePx}px`;
      btn.innerHTML =
        `${esc(item.text)}<span class="phrase-item__bang">${esc(item.bang)}</span>` +
        (item.count > 1 ? `<span class="phrase-item__mul">×${item.count}</span>` : '');
      btn.addEventListener('click', () => {
        state.promptId = item.prompt_id;
        state.modelA = nextModel;
        if (state.modelB === nextModel) {
          state.modelB = nextModel === quietestModel ? leaderModel : quietestModel;
        }
        setMobileCompareSide('a');
        populateSelectors();
        renderComparison();
        $('examples')?.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      });
      newLayer.appendChild(btn);
      return { btn, item };
    });

    const placedBoxes = [hubBox];
    const placedNodes = [];
    const aspectX = isNarrow ? Math.max(0.78, W / H) : Math.min(1.55, Math.max(1.0, W / H));
    const padX = isNarrow ? 5 : 12;
    const padY = isNarrow ? 4 : 8;
    const stepStride = isNarrow ? 2.1 : 2.9;

    nodes.forEach(({ btn }, i) => {
      const pw = btn.offsetWidth;
      const ph = btn.offsetHeight;
      let chosen = null;

      if (nodes.length === 1) {
        // Solitary phrase sits balanced right above the center hub
        chosen = { x: cx0, y: cy0 - hubH / 2 - 36 };
      } else if (nodes.length === 2) {
        const sign = i === 0 ? -1 : 1;
        chosen = { x: cx0 + sign * Math.min(W * 0.2, 120), y: cy0 + sign * (hubH / 2 + 38) };
      } else {
        for (let step = 0; step < 340; step++) {
          const angle = i * 2.3999632 + step * 0.37;
          const rBase = Math.max(hubH * 0.62, 40) + step * stepStride;
          const x = cx0 + Math.cos(angle) * rBase * aspectX;
          const y = cy0 + Math.sin(angle) * rBase;

          const box = {
            l: x - pw / 2 - padX,
            r: x + pw / 2 + padX,
            t: y - ph / 2 - padY,
            b: y + ph / 2 + padY
          };

          if (box.l < 2 || box.r > W - 2 || box.t < 2 || box.b > H - 2) {
            continue;
          }

          if (!placedBoxes.some((other) => boxesOverlap(box, other))) {
            chosen = { x, y };
            placedBoxes.push(box);
            break;
          }
        }
      }

      if (!chosen) {
        btn.remove();
        return;
      }

      const dx = chosen.x - cx0;
      const dy = chosen.y - cy0;
      const dist = Math.hypot(dx / Math.max(1, W / 2), dy / Math.max(1, H / 2));
      const rawLen = Math.hypot(dx, dy) || 1;
      btn.style.left = `${(chosen.x - pw / 2).toFixed(1)}px`;
      btn.style.top = `${(chosen.y - ph / 2).toFixed(1)}px`;
      btn.dataset.ux = (dx / rawLen).toFixed(3);
      btn.dataset.uy = (dy / rawLen).toFixed(3);
      placedNodes.push({ btn, dist });
    });

    const maxDist = Math.max(0.001, ...placedNodes.map((n) => n.dist));
    const minDist = placedNodes.length > 1 ? Math.min(...placedNodes.map((n) => n.dist)) : 0;
    const span = Math.max(0.001, maxDist - minDist);

    placedNodes.forEach(({ btn, dist }) => {
      const normR = placedNodes.length <= 1 ? 0 : (dist - minDist) / span;
      btn.dataset.normR = normR.toFixed(3);

      if (shouldAnim) {
        const ux = parseFloat(btn.dataset.ux) || 0;
        const uy = parseFloat(btn.dataset.uy) || -1;
        const enterDelay = (prevLayer ? 190 : 0) + normR * 130;
        btn.animate(
          [
            { opacity: 0, transform: `translate(${(-ux * 12).toFixed(1)}px, ${(-uy * 12).toFixed(1)}px)` },
            { opacity: 1, transform: 'translate(0px, 0px)' }
          ],
          {
            duration: DUR,
            delay: enterDelay,
            fill: 'both',
            easing: EASE_CSS
          }
        );
      }
    });

    newLayer.style.visibility = 'visible';
  }

  // Top-right Replay Circular Arrow Icon:
  // - Hover: grey -> dark grey + rotate clockwise by HOVER_DEG (+42deg)
  // - Click: spin 1 full circle (+360deg) and replay bar chart
  // - Mouseleave: reverse counter-clockwise by -HOVER_DEG back to upright baseTurns * 360deg
  function initReplayButton() {
    const btn = $('replay-btn');
    if (!btn) return;
    const svg = btn.querySelector('svg');
    let baseTurns = 0;
    let isHovered = false;

    function syncRotation() {
      const deg = baseTurns * 360 + (isHovered ? HOVER_DEG : 0);
      svg.style.setProperty('--rot', `${deg}deg`);
    }

    btn.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'touch') return;
      isHovered = true;
      syncRotation();
    });

    btn.addEventListener('pointerleave', () => {
      isHovered = false;
      syncRotation();
    });

    btn.addEventListener('click', () => {
      baseTurns += 1;
      syncRotation();
      renderChart(true, 0);
    });
  }

  // Side-by-Side Response Reader (Common 54 prompts)
  function populateSelectors() {
    const qSel = $('question-select');
    if (qSel) {
      qSel.innerHTML = commonPrompts
        .map((q) => {
          const snippet = q.prompt.replace(/\s+/g, ' ').slice(0, 56);
          return `<option value="${esc(q.id)}">${esc(q.id)} — ${esc(snippet)}${q.prompt.length > 56 ? '…' : ''}</option>`;
        })
        .join('');
      if (!commonPrompts.some((q) => q.id === state.promptId) && commonPrompts.length) {
        state.promptId = commonPrompts[0].id;
      }
      qSel.value = state.promptId;
    }
    syncModelSelects();
  }

  function syncModelSelects() {
    ['model-a', 'model-b'].forEach((id, idx) => {
      const sel = $(id);
      if (!sel) return;
      sel.innerHTML = modelsDesc
        .map((m) => `<option value="${esc(m)}">${esc(fullLabel(m))}</option>`)
        .join('');
      sel.value = idx === 0 ? state.modelA : state.modelB;
    });
  }

  function setMobileCompareSide(side) {
    state.mobileSide = side === 'b' ? 'b' : 'a';
    const cols = $('compare-columns');
    if (cols) cols.dataset.mobileSide = state.mobileSide;
    document.querySelectorAll('[data-compare-tab]').forEach((btn) => {
      const active = btn.dataset.compareTab === state.mobileSide;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
    });
  }

  function renderComparison() {
    const q = commonPrompts.find((item) => item.id === state.promptId) || commonPrompts[0];
    if (!q) return;

    $('prompt-text').textContent = q.prompt;

    document.querySelectorAll('.quick-pick').forEach((btn) => {
      btn.classList.toggle(
        'is-active',
        btn.dataset.prompt === state.promptId &&
          (!btn.dataset.modelA || btn.dataset.modelA === state.modelA)
      );
    });

    ['a', 'b'].forEach((side) => {
      const model = side === 'a' ? state.modelA : state.modelB;
      const statEl = $(`stat-${side}`);
      const bodyEl = $(`answer-${side}`);
      const tabNameEl = $(`tab-name-${side}`);
      const tabStatEl = $(`tab-stat-${side}`);
      bodyEl.scrollTop = 0;

      if (tabNameEl) tabNameEl.textContent = fullLabel(model);

      if (!R || R.length === 0) {
        statEl.textContent = '…';
        if (tabStatEl) tabStatEl.textContent = '…';
        bodyEl.textContent = t('正在加载回答…', 'Loading response…');
        return;
      }

      const rec = R.find((r) => r.model === model && r.prompt_id === q.id);
      if (!rec) {
        statEl.textContent = '—';
        if (tabStatEl) tabStatEl.textContent = '—';
        bodyEl.textContent = '—';
        return;
      }

      const cnt = rec.metrics.counts.exclamation;
      const den = rec.metrics.density;
      statEl.innerHTML = `<strong>${fmt(den, 2)}</strong>${t('/千字', '/ 1k')} · ${cnt} !`;
      if (tabStatEl) tabStatEl.textContent = `${fmt(den, 2)} ${t('/千字', '/ 1k')} · ${cnt} !`;
      bodyEl.innerHTML = renderResponseMarkdown(rec.text);
    });
  }

  // Safe lightweight Markdown renderer with prose exclamation highlighting (skipping code spans/blocks)
  function formatInlineMarkdown(raw) {
    const tokens = [];
    const stash = (html) => {
      const key = `\u0000T${tokens.length}\u0000`;
      tokens.push(html);
      return key;
    };

    // 1. Protect inline code spans from Markdown parsing and exclamation highlighting
    let text = raw.replace(/`+([^`\n]+)`+/g, (_, code) =>
      stash(`<code class="md-inline-code">${esc(code)}</code>`)
    );

    // 2. Convert Markdown links [label](url) to clean label text without counting URL !
    text = text.replace(/!?\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label) => label);

    // 3. Escape remaining HTML characters
    text = esc(text);

    // 4. Apply bold/italic formatting
    text = text
      .replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
      .replace(/(^|[\s(>])\*([^*\s][^*\n]*?)\*(?=[\s).,!?;:<]|$)/g, '$1<em>$2</em>');

    // 5. Highlight counted prose exclamation marks
    text = text.replace(/[!！]+/g, (m) => `<mark>${m}</mark>`);

    // 6. Restore protected inline code tokens
    return text.replace(/\u0000T(\d+)\u0000/g, (_, idx) => tokens[Number(idx)] || '');
  }

  function renderResponseMarkdown(src) {
    const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Skip blank lines
      if (!line.trim()) {
        i++;
        continue;
      }

      // Fenced code blocks (``` or ~~~)
      const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
      if (fenceMatch) {
        const fence = fenceMatch[1];
        const codeLines = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith(fence)) {
          codeLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) i++;
        blocks.push(`<pre class="md-pre"><code>${esc(codeLines.join('\n'))}</code></pre>`);
        continue;
      }

      // Horizontal rules
      if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
        blocks.push('<hr class="md-hr">');
        i++;
        continue;
      }

      // ATX Headings (# .. ######)
      const headingMatch = line.match(/^\s*#{1,6}\s+(.+)$/);
      if (headingMatch) {
        blocks.push(`<h4 class="md-h">${formatInlineMarkdown(headingMatch[1].trim())}</h4>`);
        i++;
        continue;
      }

      // Blockquotes (> ...)
      if (/^\s*>\s?/.test(line)) {
        const quoteLines = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        blocks.push(`<blockquote class="md-quote">${renderResponseMarkdown(quoteLines.join('\n'))}</blockquote>`);
        continue;
      }

      // Unordered lists (- / * / +)
      if (/^\s*[-*+]\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
          items.push(`<li>${formatInlineMarkdown(lines[i].replace(/^\s*[-*+]\s+/, '').trim())}</li>`);
          i++;
        }
        blocks.push(`<ul>${items.join('')}</ul>`);
        continue;
      }

      // Ordered lists (1. / 1))
      const olMatch = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
      if (olMatch) {
        const startNum = parseInt(olMatch[1], 10);
        const items = [];
        while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
          items.push(`<li>${formatInlineMarkdown(lines[i].replace(/^\s*\d+[.)]\s+/, '').trim())}</li>`);
          i++;
        }
        const startAttr = startNum !== 1 ? ` start="${startNum}"` : '';
        blocks.push(`<ol${startAttr}>${items.join('')}</ol>`);
        continue;
      }

      // Ordinary paragraph (joining consecutive prose lines with <br>)
      const paraLines = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^\s*(?:`{3,}|~{3,}|#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+|---+|\*\*\*+|___+)/.test(lines[i])
      ) {
        paraLines.push(formatInlineMarkdown(lines[i].trim()));
        i++;
      }
      blocks.push(`<p>${paraLines.join('<br>')}</p>`);
    }

    return blocks.join('');
  }

  // 3x2 Small-Multiples Bar Charts for six core punctuation marks (sorted low -> high,
  // leaving the upper-left corner naturally open for each plump Candidate-D punctuation icon)
  const PUNCT_CHARTS = [
    {
      key: 'question',
      en: 'Question',
      zh: '问号',
      svg:
        '<path d="M9 18.5 C9 8.2 16.8 2.5 26 2.5 C35.6 2.5 42 8.5 42 16.8 C42 23.8 37.2 27.6 32 30.8 C28.6 33 27.6 34.6 27.4 37.8 Q27.2 41 23.2 41 Q19.2 41 19.2 37.4 C19.2 31 22.4 28 26.5 25.2 C30 22.8 32 20.6 32 16.8 C32 13 29.2 10.8 25.2 10.8 C21.2 10.8 18.8 13.5 18.2 18.2 Q17.6 21.8 13.5 21.4 Q9 21 9 18.5 Z"/>' +
        '<rect x="15.2" y="45.5" width="16.4" height="15.5" rx="5.4"/>'
    },
    {
      key: 'em_dash',
      en: 'Em-dash',
      zh: '破折号',
      svg: '<rect x="3" y="25" width="42" height="14" rx="5.2"/>'
    },
    {
      key: 'colon',
      en: 'Colon',
      zh: '冒号',
      svg:
        '<rect x="15" y="10" width="18" height="17" rx="5.8"/>' +
        '<rect x="15" y="37" width="18" height="17" rx="5.8"/>'
    },
    {
      key: 'semicolon',
      en: 'Semicolon',
      zh: '分号',
      svg:
        '<rect x="15.2" y="8" width="17.6" height="16.6" rx="5.6"/>' +
        '<path d="M20.5 33.5 L27.2 33.5 Q33 33.5 33 39.4 C33 48.2 27.8 56.4 19.4 60.5 Q15.6 62.2 14.6 59.2 Q13.6 56.4 17 54.3 C21 51.9 23.1 49.2 23.3 46.5 L20.5 46.5 Q14.8 46.5 14.8 40.8 L14.8 39.2 Q14.8 33.5 20.5 33.5 Z"/>'
    },
    {
      key: 'comma',
      en: 'Comma',
      zh: '逗号',
      svg:
        '<path d="M20.5 19 L28.8 19 Q36 19 36 26.2 C36 37.2 29.5 47.6 19 52.8 Q14.4 55 13.2 51.2 Q12 47.6 16.4 45 C21.2 42 23.8 38.6 24 35.2 L20.5 35.2 Q13.5 35.2 13.5 28.2 L13.5 26 Q13.5 19 20.5 19 Z"/>'
    },
    {
      key: 'period',
      en: 'Period',
      zh: '句点',
      svg: '<rect x="13" y="24" width="22" height="21" rx="7"/>'
    }
  ];

  // Offscreen canvas for exact Helvetica label width measurement (inside vs outside bar placement)
  const measureCtx = document.createElement('canvas').getContext('2d');
  function measureModelLabelPx(text) {
    if (!measureCtx) return text.length * 6.8;
    measureCtx.font = '600 11px "Helvetica Neue", Helvetica, Arial, sans-serif';
    return measureCtx.measureText(text).width;
  }

  function renderSummaryTable() {
    const grid = $('punct-multiples');
    if (!grid) return;

    grid.classList.remove('is-tracking');

    grid.innerHTML = PUNCT_CHARTS.map((spec) => {
      // Sort highest -> lowest from top to bottom for horizontal bar readability
      const sortedDesc = [...S.config.models].sort((a, b) => {
        const va = S.summary[a].common.punctuation_per_1000_chars[spec.key] || 0;
        const vb = S.summary[b].common.punctuation_per_1000_chars[spec.key] || 0;
        if (Math.abs(vb - va) > 1e-9) return vb - va;
        return a.localeCompare(b);
      });

      const topM = sortedDesc[0];
      const peak = Math.max(0.001, S.summary[topM].common.punctuation_per_1000_chars[spec.key] || 0);

      const rowsHTML = sortedDesc
        .map((m, idx) => {
          const val = S.summary[m].common.punctuation_per_1000_chars[spec.key] || 0;
          const isZero = val <= 0.0005;
          const pct = isZero ? 0 : Math.max(1.5, (val / peak) * 100);
          const isTop = idx === 0;
          const disp = fmt(val, 2);
          const name = fullLabel(m);

          return `
            <button
              type="button"
              class="hbar-row${isTop ? ' is-top' : ''}${isZero ? ' is-zero' : ''}"
              data-pmodel="${esc(m)}"
              data-pct="${pct.toFixed(3)}"
              data-mname="${esc(name)}"
              aria-label="${esc(`${name}: ${disp} ${isZh() ? spec.zh : spec.en} per 1k chars`)}"
            >
              <span class="hbar-track">
                <span class="hbar-fill" style="width:${pct.toFixed(2)}%"></span>
              </span>
              <span class="hbar-val">${disp}</span>
            </button>`;
        })
        .join('');

      return `
        <article class="punct-card" data-pkey="${spec.key}">
          <div class="punct-card__head">
            <svg class="punct-card__icon" viewBox="0 0 48 64" aria-hidden="true">${spec.svg}</svg>
            <span class="punct-card__title">${esc(isZh() ? spec.zh : spec.en)}</span>
          </div>
          <div class="punct-hbars">${rowsHTML}</div>
        </article>`;
    }).join('');

    // Place each model label inside the bar when wide enough, or outside to the right when short
    const sampleTrack = grid.querySelector('.hbar-track');
    const trackW = sampleTrack ? sampleTrack.clientWidth || 200 : 200;

    grid.querySelectorAll('.hbar-row').forEach((row) => {
      const pct = parseFloat(row.dataset.pct) || 0;
      const name = row.dataset.mname || '';
      const barPx = row.classList.contains('is-zero') ? 2 : (trackW * pct) / 100;
      const neededPx = measureModelLabelPx(name) + 16;
      const track = row.querySelector('.hbar-track');
      const fill = row.querySelector('.hbar-fill');

      if (barPx >= neededPx) {
        fill.innerHTML = `<span class="hbar-name hbar-name--in">${esc(name)}</span>`;
      } else {
        const outSpan = document.createElement('span');
        outSpan.className = 'hbar-name hbar-name--out';
        outSpan.style.left = `${(barPx + 7).toFixed(1)}px`;
        outSpan.textContent = name;
        track.appendChild(outSpan);
      }
    });

    let trackedModel = null;

    function setTrackedModel(modelId) {
      trackedModel = modelId || null;
      grid.classList.toggle('is-tracking', Boolean(trackedModel));
      grid.querySelectorAll('.hbar-row').forEach((row) => {
        if (!trackedModel) {
          row.classList.remove('is-tracked', 'is-dimmed-top');
          return;
        }
        const match = row.dataset.pmodel === trackedModel;
        row.classList.toggle('is-tracked', match);
        if (row.classList.contains('is-top')) {
          row.classList.toggle('is-dimmed-top', !match);
        }
      });
    }

    // Bind hover strictly to the bar stacks (.punct-hbars), never empty header/grid margins
    grid.querySelectorAll('.punct-hbars').forEach((stack) => {
      stack.addEventListener('pointerleave', (e) => {
        if (e.pointerType === 'touch') return;
        setTrackedModel(null);
      });
    });

    grid.querySelectorAll('.hbar-row').forEach((row) => {
      row.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'touch') return;
        setTrackedModel(row.dataset.pmodel);
      });
      row.addEventListener('focus', () => setTrackedModel(row.dataset.pmodel));
      row.addEventListener('blur', () => setTrackedModel(null));
      row.addEventListener('click', () => {
        const next = trackedModel === row.dataset.pmodel ? null : row.dataset.pmodel;
        setTrackedModel(next);
      });
    });
  }

  function applyLanguage(nextLang, pushUrl = false) {
    state.lang = nextLang === 'en' ? 'en' : 'zh';
    root.lang = isZh() ? 'zh-CN' : 'en';

    document.querySelectorAll('[data-zh][data-en]').forEach((el) => {
      el.textContent = isZh() ? el.dataset.zh : el.dataset.en;
    });

    $('lang-toggle').textContent = isZh() ? 'EN' : '中';
    $('replay-btn').setAttribute('title', t('重播动画', 'Replay animation'));
    $('replay-btn').setAttribute('aria-label', t('重播动画', 'Replay animation'));

    document.title = t(
      '!!!Bench — 哪个模型最喜欢说“！”',
      '!!!Bench — Which Model Loves Saying “!” the Most?'
    );

    if (pushUrl) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('lang', state.lang);
        window.history.replaceState(null, '', url);
      } catch {
        // Ignore history state restrictions
      }
    }

    renderChart(false);
    renderPhraseModelList();
    switchPhraseModel(state.phraseModel, false);
    populateSelectors();
    renderComparison();
    renderSummaryTable();
  }

  function bindEvents() {
    $('lang-toggle')?.addEventListener('click', () => {
      applyLanguage(isZh() ? 'en' : 'zh', true);
    });

    $('hub-btn')?.addEventListener('click', () => {
      const curIdx = modelsDesc.indexOf(state.phraseModel);
      const nextModel = modelsDesc[(curIdx + 1) % modelsDesc.length];
      switchPhraseModel(nextModel, true);
    });

    $('question-select')?.addEventListener('change', (e) => {
      state.promptId = e.target.value;
      renderComparison();
    });

    $('next-question')?.addEventListener('click', () => {
      const sel = $('question-select');
      if (!sel || !sel.options.length) return;
      sel.selectedIndex = (sel.selectedIndex + 1) % sel.options.length;
      state.promptId = sel.value;
      renderComparison();
    });

    document.querySelectorAll('[data-compare-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setMobileCompareSide(btn.dataset.compareTab);
      });
    });

    $('model-a')?.addEventListener('change', (e) => {
      state.modelA = e.target.value;
      renderComparison();
    });

    $('model-b')?.addEventListener('change', (e) => {
      state.modelB = e.target.value;
      renderComparison();
    });

    document.querySelectorAll('.quick-pick').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.promptId = btn.dataset.prompt;
        if (btn.dataset.modelA) state.modelA = btn.dataset.modelA;
        if (btn.dataset.modelB) state.modelB = btn.dataset.modelB;
        populateSelectors();
        renderComparison();
      });
    });

    $('punct-select')?.addEventListener('change', (e) => {
      state.punctKey = e.target.value;
      renderSummaryTable();
    });

    document.addEventListener('exclamation-responses-loaded', () => {
      R = window.EXCLAMATION_RESPONSES || [];
      renderComparison();
    });

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        renderChart(false);
        switchPhraseModel(state.phraseModel, false);
        renderSummaryTable();
      }, 100);
    });
  }

  initReplayButton();
  bindEvents();
  applyLanguage(state.lang, false);
  if (!reducedMotion.matches && (!window.location.hash || window.location.hash === '#top')) {
    renderChart(true, 80);
  }
})();
